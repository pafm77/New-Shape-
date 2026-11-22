import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  MessageTemplateRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
} from '../types/studio';
import {
  buildMessageFromTemplate,
  formatPhoneDisplay,
  MONTHS_PT,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  BrandCard,
  EmptyState,
  FieldLabel,
  GoldButton,
  Input,
  Modal,
  SecondaryButton,
  StatusPill,
  Textarea,
} from './UiPrimitives';

interface PtTrainingMarcacoesViewProps {
  uid: string;
  clients: ClientRecord[];
  weeks: TrainingWeekRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  onShiftWeek: (delta: number) => void;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

const WEEKDAYS_PT: Array<{ day: number; short: string; full: string }> = [
  { day: 1, short: 'Seg', full: 'Segunda' },
  { day: 2, short: 'Ter', full: 'Terça' },
  { day: 3, short: 'Qua', full: 'Quarta' },
  { day: 4, short: 'Qui', full: 'Quinta' },
  { day: 5, short: 'Sex', full: 'Sexta' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
  { day: 7, short: 'Dom', full: 'Domingo' },
];

function computeEndTime(timeLabel: string, durationMinutes: number): string {
  const parts = timeLabel.split(':');
  if (parts.length < 2) return '';
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const total = h * 60 + m + Math.max(0, durationMinutes);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

interface PendingMessageModal {
  title: string;
  subtitle: string;
  client: ClientRecord;
  message: string;
  weekSummaryMessage?: string;
}

export const PtTrainingMarcacoesView: React.FC<PtTrainingMarcacoesViewProps> = ({
  uid,
  clients,
  weeks,
  activeWeek,
  sessions,
  bookings,
  templates,
  settings,
  selectedClientId,
  onSelectClient,
  onShiftWeek,
  onOpenWhatsApp,
  onBanner,
}) => {
  const activeClients = useMemo(
    () => [...clients.filter((c) => c.active)].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const [clientQuery, setClientQuery] = useState('');
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return activeClients;
    return activeClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }, [activeClients, clientQuery]);

  const effectiveClient = useMemo(() => {
    return (
      activeClients.find((c) => c.id === selectedClientId) ||
      filteredClients[0] ||
      activeClients[0] ||
      null
    );
  }, [activeClients, filteredClients, selectedClientId]);

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const weekMap = useMemo(() => new Map(weeks.map((w) => [w.weekKey, w])), [weeks]);

  const weekKey = activeWeek?.weekKey || '';

  const weekSessions = useMemo(
    () =>
      weekKey
        ? sessions
            .filter((s) => s.weekKey === weekKey)
            .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel))
        : [],
    [sessions, weekKey]
  );

  // Active bookings for the selected student in the currently viewed week
  const studentWeekBookings = useMemo(() => {
    if (!effectiveClient || !weekKey) return [];
    return bookings
      .filter(
        (b) =>
          b.clientId === effectiveClient.id &&
          b.weekKey === weekKey &&
          b.status !== 'CANCELLED'
      )
      .map((booking) => ({
        booking,
        session: sessionMap.get(booking.sessionId) || null,
      }))
      .filter((x): x is { booking: BookingRecord; session: TrainingSessionRecord } => x.session !== null)
      .sort(
        (a, b) =>
          a.session.startMillis - b.session.startMillis ||
          a.session.timeLabel.localeCompare(b.session.timeLabel)
      );
  }, [bookings, effectiveClient, weekKey, sessionMap]);

  const studentBookedBySessionId = useMemo(() => {
    const map = new Map<string, BookingRecord>();
    studentWeekBookings.forEach(({ booking }) => map.set(booking.sessionId, booking));
    return map;
  }, [studentWeekBookings]);

  const confirmedCountInWeek = useMemo(
    () => studentWeekBookings.filter((x) => x.booking.status === 'CONFIRMED').length,
    [studentWeekBookings]
  );

  // Per-day metadata for the 7-day strip
  const dayStats = useMemo(() => {
    const now = new Date();
    const mondayMs = activeWeek?.startDateMillis || 0;
    return WEEKDAYS_PT.map(({ day, short, full }) => {
      const date = mondayMs ? new Date(mondayMs + (day - 1) * 86400000) : null;
      const isToday =
        date !== null &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const daySessions = weekSessions.filter((s) => s.dayOfWeek === day);
      const studentHasDay = daySessions.some((s) => studentBookedBySessionId.has(s.id));
      return {
        day,
        short,
        full,
        dayNumber: date ? date.getDate() : null,
        monthLabel: date ? MONTHS_PT[date.getMonth()] : '',
        isToday,
        sessions: daySessions,
        studentHasDay,
      };
    });
  }, [activeWeek?.startDateMillis, weekSessions, studentBookedBySessionId]);

  const defaultDay = useMemo(() => {
    const todayEntry = dayStats.find((d) => d.isToday && d.sessions.length > 0);
    if (todayEntry) return todayEntry.day;
    const withSessions = dayStats.find((d) => d.sessions.length > 0);
    return withSessions ? withSessions.day : 1;
  }, [dayStats]);

  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [swappingTarget, setSwappingTarget] = useState<{
    booking: BookingRecord;
    session: TrainingSessionRecord;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messageModal, setMessageModal] = useState<PendingMessageModal | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Keep selected day valid when week changes
  useEffect(() => {
    setSelectedDay(defaultDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  // Clear swap mode when switching student
  useEffect(() => {
    setSwappingTarget(null);
  }, [effectiveClient?.id]);

  const currentDayInfo = dayStats.find((d) => d.day === selectedDay) || dayStats[0];

  const buildConfirmMessage = (
    client: ClientRecord,
    targetSessions: TrainingSessionRecord[],
    targetWeek: TrainingWeekRecord | null
  ): string => {
    return buildMessageFromTemplate(templates, 'CONFIRMACAO', settings.siteBaseUrl, {
      clientName: client.name,
      sessions: targetSessions,
      week: targetWeek,
      ptUid: uid,
      studentPortalCode: settings.studentPortalCode,
    });
  };

  const buildSwapMessage = (
    client: ClientRecord,
    oldSession: TrainingSessionRecord,
    newSession: TrainingSessionRecord,
    updatedWeekSessions: TrainingSessionRecord[],
    targetWeek: TrainingWeekRecord | null
  ): string => {
    const oldEnd = computeEndTime(oldSession.timeLabel, oldSession.durationMinutes);
    const newEnd = computeEndTime(newSession.timeLabel, newSession.durationMinutes);
    const oldStr = `${oldSession.dateLabel} às ${oldSession.timeLabel.replace(':', 'h')}${oldEnd ? `–${oldEnd.replace(':', 'h')}` : ''}`;
    const newStr = `${newSession.dateLabel} às ${newSession.timeLabel.replace(':', 'h')}${newEnd ? `–${newEnd.replace(':', 'h')}` : ''}`;

    const base = buildMessageFromTemplate(templates, 'ALTERACAO', settings.siteBaseUrl, {
      clientName: client.name,
      sessions: updatedWeekSessions.length > 0 ? updatedWeekSessions : [newSession],
      week: targetWeek,
      ptUid: uid,
      studentPortalCode: settings.studentPortalCode,
    });
    return `${base}\n\n🔄 Troca efetuada:\n• Antes: ${oldStr}\n• Novo horário: ${newStr}`;
  };

  const handleBookForStudent = async (session: TrainingSessionRecord) => {
    if (!effectiveClient) return;
    setBusyKey(session.id);
    try {
      await repo.addManualBooking(uid, session.id, session.weekKey, effectiveClient.id);
      const targetWeek = weekMap.get(session.weekKey) || activeWeek;
      const singleMsg = buildConfirmMessage(effectiveClient, [session], targetWeek);

      const allWeekConfirmed = [
        ...studentWeekBookings
          .filter((x) => x.booking.status === 'CONFIRMED' && x.session.id !== session.id)
          .map((x) => x.session),
        session,
      ].sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel));
      const weekSummary =
        allWeekConfirmed.length > 1
          ? buildConfirmMessage(effectiveClient, allWeekConfirmed, targetWeek)
          : undefined;

      onBanner(`Treino marcado para ${effectiveClient.name} (${session.dateLabel} · ${session.timeLabel}).`);
      setMessageModal({
        title: 'Treino marcado · Enviar mensagem',
        subtitle: `${effectiveClient.name} · ${session.dateLabel} às ${session.timeLabel}`,
        client: effectiveClient,
        message: singleMsg,
        weekSummaryMessage: weekSummary,
      });
    } catch (e) {
      onBanner((e as Error).message || 'Erro ao marcar treino.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmPendingBooking = async (booking: BookingRecord, session: TrainingSessionRecord) => {
    if (!effectiveClient) return;
    setBusyKey(booking.id);
    try {
      await repo.confirmClientBookings(uid, [booking]);
      const targetWeek = weekMap.get(session.weekKey) || activeWeek;
      const msg = buildConfirmMessage(effectiveClient, [session], targetWeek);
      onBanner(`Horário de ${effectiveClient.name} confirmado.`);
      setMessageModal({
        title: 'Marcação confirmada · Enviar mensagem',
        subtitle: `${effectiveClient.name} · ${session.dateLabel} às ${session.timeLabel}`,
        client: effectiveClient,
        message: msg,
      });
    } catch (e) {
      onBanner((e as Error).message || 'Erro ao confirmar marcação.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSwapToSession = async (newSession: TrainingSessionRecord) => {
    if (!effectiveClient || !swappingTarget) return;
    setBusyKey(newSession.id);
    try {
      const { booking: oldBooking, session: oldSession } = swappingTarget;
      await repo.swapBookingToSession(uid, oldBooking, newSession);

      const targetWeek = weekMap.get(newSession.weekKey) || activeWeek;
      const updatedWeekConfirmed = bookings
        .filter(
          (b) =>
            b.clientId === effectiveClient.id &&
            b.weekKey === newSession.weekKey &&
            b.status === 'CONFIRMED' &&
            b.id !== oldBooking.id
        )
        .map((b) => sessionMap.get(b.sessionId))
        .filter((s): s is TrainingSessionRecord => Boolean(s));

      const merged = [
        ...updatedWeekConfirmed.filter((s) => s.id !== newSession.id),
        newSession,
      ].sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel));

      const swapMsg = buildSwapMessage(effectiveClient, oldSession, newSession, [newSession], targetWeek);
      const weekSummary =
        merged.length > 1
          ? buildSwapMessage(effectiveClient, oldSession, newSession, merged, targetWeek)
          : undefined;

      setSwappingTarget(null);
      onBanner(
        `Horário de ${effectiveClient.name} trocado para ${newSession.dateLabel} às ${newSession.timeLabel}.`
      );
      setMessageModal({
        title: 'Horário trocado · Enviar mensagem',
        subtitle: `${effectiveClient.name} · Novo: ${newSession.dateLabel} às ${newSession.timeLabel}`,
        client: effectiveClient,
        message: swapMsg,
        weekSummaryMessage: weekSummary,
      });
    } catch (e) {
      onBanner((e as Error).message || 'Erro ao trocar horário.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveBooking = async (booking: BookingRecord, session: TrainingSessionRecord) => {
    if (!effectiveClient) return;
    setBusyKey(booking.id);
    try {
      await repo.removeBooking(uid, booking.id);
      if (swappingTarget?.booking.id === booking.id) {
        setSwappingTarget(null);
      }
      const firstName = effectiveClient.name.trim().split(/\s+/)[0] || effectiveClient.name;
      const cancelMsg = `Olá ${firstName}, o teu treino de ${session.dateLabel} às ${session.timeLabel.replace(':', 'h')} foi desmarcado. Diz-me quando preferes reagendar! 💪 New Shape`;
      onBanner(`Treino de ${effectiveClient.name} desmarcado.`);
      setMessageModal({
        title: 'Treino desmarcado · Avisar aluno',
        subtitle: `${effectiveClient.name} · ${session.dateLabel} às ${session.timeLabel}`,
        client: effectiveClient,
        message: cancelMsg,
      });
    } catch (e) {
      onBanner((e as Error).message || 'Erro ao desmarcar treino.');
    } finally {
      setBusyKey(null);
    }
  };

  if (activeClients.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-6 w-6" />}
        title="Sem alunos ativos"
        subtitle="Adiciona alunos na aba Alunos para poderes marcar ou trocar treinos por eles."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Select Student */}
      <BrandCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#FACC15]">
              Marcar ou Trocar Treino pelo Aluno
            </p>
            <p className="text-xs text-[#A1A1AA]">
              Escolhe o aluno, marca ou troca o horário e envia logo a mensagem de confirmação.
            </p>
          </div>
          {effectiveClient && (
            <StatusPill tone={effectiveClient.trainingType === 'PERSONALIZADO' ? 'gold' : 'green'}>
              {effectiveClient.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
            </StatusPill>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Pesquisar Aluno</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
              <Input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Nome ou telemóvel..."
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Aluno Selecionado ({filteredClients.length})</FieldLabel>
            <select
              value={effectiveClient?.id || ''}
              onChange={(e) => onSelectClient(e.target.value)}
              className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm font-semibold text-[#F4F4F5] outline-none focus:border-[#EAB308]"
            >
              {filteredClients.length === 0 ? (
                <option value="">Nenhum aluno encontrado</option>
              ) : (
                filteredClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${formatPhoneDisplay(c.phone)}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {effectiveClient && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#242429]/70 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#F4F4F5]">{effectiveClient.name}</p>
              <p className="text-xs text-[#A1A1AA]">
                {effectiveClient.phone ? formatPhoneDisplay(effectiveClient.phone) : 'Sem telemóvel'}
                {effectiveClient.weeklySessionLimit && effectiveClient.weeklySessionLimit > 0
                  ? ` · Pacote ${effectiveClient.weeklySessionLimit}×/semana`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={confirmedCountInWeek > 0 ? 'green' : 'neutral'}>
                {confirmedCountInWeek}
                {effectiveClient.weeklySessionLimit && effectiveClient.weeklySessionLimit > 0
                  ? `/${effectiveClient.weeklySessionLimit}`
                  : ''}{' '}
                confirmado(s)
              </StatusPill>
            </div>
          </div>
        )}
      </BrandCard>

      {/* Week Navigation + Current Bookings of this Student */}
      <BrandCard highlight={Boolean(swappingTarget)}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onShiftWeek(-1)}
            aria-label="Semana anterior"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#323238] bg-[#242429] text-[#F4F4F5] hover:border-[#EAB308]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Semana
            </p>
            <p className="text-sm font-extrabold text-[#F4F4F5]">
              {activeWeek ? activeWeek.label : 'Sem semana criada'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onShiftWeek(1)}
            aria-label="Semana seguinte"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#323238] bg-[#242429] text-[#F4F4F5] hover:border-[#EAB308]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Active Swap Banner */}
        {swappingTarget && effectiveClient && (
          <div className="mt-3 rounded-xl border border-[#EAB308] bg-[#3D3314]/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#FACC15]">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Modo Troca Ativo · {effectiveClient.name}
                </p>
                <p className="mt-0.5 text-xs text-[#F4F4F5]">
                  A trocar{' '}
                  <strong>
                    {swappingTarget.session.dateLabel} às {swappingTarget.session.timeLabel}
                  </strong>
                  . Escolhe abaixo o novo dia e horário (nesta ou noutra semana).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSwappingTarget(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#EAB308]/50 bg-[#1B1B1E] px-2.5 py-1.5 text-xs font-bold text-[#FACC15] hover:bg-[#242429]"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar troca
              </button>
            </div>
          </div>
        )}

        {/* Current Bookings for the selected student in this week */}
        {effectiveClient && (
          <div className="mt-3 border-t border-[#323238] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#F4F4F5]">
                Horários de {effectiveClient.name.split(' ')[0]} nesta semana (
                {studentWeekBookings.length})
              </p>
              {confirmedCountInWeek > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const confirmedSessions = studentWeekBookings
                      .filter((x) => x.booking.status === 'CONFIRMED')
                      .map((x) => x.session);
                    const msg = buildConfirmMessage(effectiveClient, confirmedSessions, activeWeek);
                    setMessageModal({
                      title: 'Enviar confirmação da semana',
                      subtitle: `${effectiveClient.name} · ${confirmedSessions.length} treino(s) confirmado(s)`,
                      client: effectiveClient,
                      message: msg,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAB308] px-2.5 py-1.5 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar mensagem ({confirmedCountInWeek})
                </button>
              )}
            </div>

            {studentWeekBookings.length === 0 ? (
              <p className="mt-2 text-xs text-[#A1A1AA]">
                Ainda sem treinos marcados nesta semana. Escolhe um dia e horário abaixo para marcar.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {studentWeekBookings.map(({ booking, session }) => {
                  const isSwappingThis = swappingTarget?.booking.id === booking.id;
                  const endTime = computeEndTime(session.timeLabel, session.durationMinutes);
                  const isConfirmed = booking.status === 'CONFIRMED';
                  return (
                    <div
                      key={booking.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
                        isSwappingThis
                          ? 'border-[#EAB308] bg-[#3D3314]/50'
                          : isConfirmed
                          ? 'border-[#22C55E]/40 bg-[#143524]/25'
                          : 'border-[#F59E0B]/40 bg-[#3F2A10]/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-[#F4F4F5]">
                            {session.dateLabel}
                          </span>
                          <StatusPill tone={isConfirmed ? 'green' : 'amber'}>
                            {isConfirmed ? 'Confirmado ✓' : 'Por confirmar'}
                          </StatusPill>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-[#FACC15]">
                          {session.timeLabel}
                          {endTime ? ` – ${endTime}` : ''} · {session.durationMinutes} min
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isConfirmed && (
                          <button
                            type="button"
                            disabled={busyKey === booking.id}
                            onClick={() => handleConfirmPendingBooking(booking, session)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#22C55E] px-2.5 py-1 text-xs font-bold text-[#0B1F14] hover:brightness-110 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Confirmar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSwappingTarget(isSwappingThis ? null : { booking, session })
                          }
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                            isSwappingThis
                              ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                              : 'border-[#EAB308]/60 bg-[#1B1B1E] text-[#FACC15] hover:bg-[#3D3314]'
                          }`}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          {isSwappingThis ? 'A trocar...' : 'Trocar horário'}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === booking.id}
                          onClick={() => handleRemoveBooking(booking, session)}
                          aria-label="Desmarcar treino"
                          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[#EF4444]/40 bg-[#3B1518]/60 px-2.5 py-1 text-xs font-bold text-[#EF4444] hover:bg-[#3B1518] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </BrandCard>

      {/* Step 2: Day-by-Day, Hour-by-Hour Picker */}
      {weekSessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Sem horários nesta semana"
          subtitle="Cria os horários desta semana em Início → Semanas ou muda para outra semana acima."
        />
      ) : (
        <div className="space-y-3">
          {/* 7-day strip */}
          <div className="grid grid-cols-7 gap-1.5">
            {dayStats.map((d) => {
              const isSelected = d.day === selectedDay;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDay(d.day)}
                  className={`flex flex-col items-center justify-center rounded-xl border px-1 py-2 transition ${
                    isSelected
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : d.sessions.length > 0
                      ? 'border-[#323238] bg-[#1B1B1E] text-[#F4F4F5] hover:border-[#EAB308]/60'
                      : 'border-[#27272A] bg-[#141416] text-[#71717A]'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">{d.short}</span>
                  {d.dayNumber !== null && (
                    <span className="mt-0.5 text-sm font-extrabold">{d.dayNumber}</span>
                  )}
                  <div className="mt-1 flex items-center gap-1">
                    {d.studentHasDay && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? 'bg-[#121214]' : 'bg-[#22C55E]'
                        }`}
                      />
                    )}
                    <span
                      className={`text-[9px] font-bold ${
                        isSelected
                          ? 'text-[#121214]/80'
                          : d.sessions.length > 0
                          ? 'text-[#A1A1AA]'
                          : 'text-[#52525B]'
                      }`}
                    >
                      {d.sessions.length}h
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Day Header */}
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setSelectedDay((prev) => (prev <= 1 ? 7 : prev - 1))}
              aria-label="Dia anterior"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#323238] bg-[#1B1B1E] text-[#F4F4F5] hover:border-[#EAB308]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-extrabold text-[#F4F4F5]">
                {currentDayInfo.full}
                {currentDayInfo.dayNumber !== null
                  ? `, ${currentDayInfo.dayNumber} ${currentDayInfo.monthLabel}`
                  : ''}
              </p>
              <p className="text-xs text-[#A1A1AA]">
                {currentDayInfo.sessions.length} horário(s) disponível(is)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay((prev) => (prev >= 7 ? 1 : prev + 1))}
              aria-label="Dia seguinte"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#323238] bg-[#1B1B1E] text-[#F4F4F5] hover:border-[#EAB308]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Hour-by-hour slots */}
          {currentDayInfo.sessions.length === 0 ? (
            <BrandCard>
              <p className="py-4 text-center text-xs text-[#A1A1AA]">
                Sem horários neste dia. Seleciona outro dia da semana acima.
              </p>
            </BrandCard>
          ) : (
            <div className="space-y-2.5">
              {currentDayInfo.sessions.map((session) => {
                const confirmedInSlot = bookings.filter(
                  (b) => b.sessionId === session.id && b.status === 'CONFIRMED'
                ).length;
                const isFull = confirmedInSlot >= session.capacity;
                const existingBooking = studentBookedBySessionId.get(session.id);
                const isOriginalSwapSlot = swappingTarget?.session.id === session.id;
                const endTime = computeEndTime(session.timeLabel, session.durationMinutes);
                const isBusy = busyKey === session.id || busyKey === existingBooking?.id;

                return (
                  <BrandCard
                    key={session.id}
                    highlight={Boolean(existingBooking) || isOriginalSwapSlot}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex flex-col items-center justify-center rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-center min-w-[78px]">
                          <span className="text-base font-extrabold text-[#FACC15]">
                            {session.timeLabel}
                          </span>
                          {endTime && (
                            <span className="text-[10px] font-semibold text-[#A1A1AA]">
                              até {endTime}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F4F4F5]">
                              <Clock className="h-3.5 w-3.5 text-[#A1A1AA]" />
                              {session.durationMinutes} min
                            </span>
                            <StatusPill tone={isFull ? 'red' : 'neutral'}>
                              {confirmedInSlot}/{session.capacity} confirmados
                            </StatusPill>
                          </div>
                          {session.note && (
                            <p className="mt-1 text-xs text-[#FACC15]">{session.note}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {swappingTarget ? (
                          isOriginalSwapSlot ? (
                            <StatusPill tone="gold">Horário atual</StatusPill>
                          ) : existingBooking ? (
                            <StatusPill tone="green">Já marcado ✓</StatusPill>
                          ) : (
                            <GoldButton
                              disabled={isBusy}
                              onClick={() => handleSwapToSession(session)}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                              {isBusy ? 'A trocar...' : 'Trocar para aqui'}
                            </GoldButton>
                          )
                        ) : existingBooking ? (
                          <div className="flex items-center gap-1.5">
                            <StatusPill
                              tone={existingBooking.status === 'CONFIRMED' ? 'green' : 'amber'}
                            >
                              {existingBooking.status === 'CONFIRMED' ? 'Marcado ✓' : 'Por confirmar'}
                            </StatusPill>
                            <button
                              type="button"
                              onClick={() =>
                                setSwappingTarget({ booking: existingBooking, session })
                              }
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#EAB308]/60 bg-[#242429] px-3 py-1.5 text-xs font-bold text-[#FACC15] hover:bg-[#3D3314]"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <GoldButton
                            disabled={isBusy}
                            onClick={() => handleBookForStudent(session)}
                          >
                            <Plus className="h-4 w-4" />
                            {isBusy
                              ? 'A marcar...'
                              : isFull
                              ? 'Marcar (extra)'
                              : 'Marcar treino'}
                          </GoldButton>
                        )}
                      </div>
                    </div>
                  </BrandCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Send Message Modal */}
      {messageModal && (
        <Modal
          open
          title={messageModal.title}
          subtitle={messageModal.subtitle}
          onClose={() => {
            setMessageModal(null);
            setCopiedMsg(false);
          }}
        >
          <div className="space-y-3">
            {messageModal.weekSummaryMessage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMessageModal((prev) =>
                      prev && prev.weekSummaryMessage
                        ? {
                            ...prev,
                            message: prev.weekSummaryMessage,
                            weekSummaryMessage: prev.message,
                          }
                        : prev
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAB308]/60 bg-[#3D3314]/50 px-3 py-1.5 text-xs font-bold text-[#FACC15] hover:bg-[#3D3314]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Alternar: só este treino / semana completa
                </button>
              </div>
            )}

            <div>
              <FieldLabel>Mensagem para {messageModal.client.name}</FieldLabel>
              <Textarea
                rows={5}
                value={messageModal.message}
                onChange={(e) =>
                  setMessageModal((prev) => (prev ? { ...prev, message: e.target.value } : null))
                }
              />
            </div>

            <div className="space-y-2 pt-1">
              <GoldButton
                fullWidth
                onClick={() => {
                  onOpenWhatsApp(messageModal.client.phone || null, messageModal.message);
                  onBanner(`WhatsApp aberto para ${messageModal.client.name}.`);
                  setMessageModal(null);
                  setCopiedMsg(false);
                }}
              >
                <Send className="h-4 w-4" />
                Enviar pelo WhatsApp
              </GoldButton>

              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton
                  fullWidth
                  onClick={async () => {
                    try {
                      await repo.sendChatMessage(
                        uid,
                        messageModal.client.id,
                        'PT',
                        messageModal.message
                      );
                      onBanner(`Mensagem enviada no Chat da app para ${messageModal.client.name}.`);
                    } catch (e) {
                      onBanner((e as Error).message || 'Erro ao enviar no chat.');
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat da App
                </SecondaryButton>

                <SecondaryButton
                  fullWidth
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(messageModal.message).catch(() => {});
                    }
                    setCopiedMsg(true);
                    onBanner('Mensagem copiada.');
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {copiedMsg ? 'Copiada ✓' : 'Copiar'}
                </SecondaryButton>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
