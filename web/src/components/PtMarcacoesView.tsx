import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  MessageTemplateRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WaitlistEntryRecord,
} from '../types/studio';
import {
  buildMessageFromTemplate,
  DAYS_PT,
  formatPhoneDisplay,
  formatTimeAgo,
  MONTHS_PT,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  BrandCard,
  EmptyState,
  GoldButton,
  Modal,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';

interface PtMarcacoesViewProps {
  uid: string;
  clients: ClientRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntryRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  onShiftWeek: (delta: number) => void;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

const WEEKDAY_SHORT: Array<{ day: number; short: string; full: string }> = [
  { day: 1, short: 'Seg', full: 'Segunda' },
  { day: 2, short: 'Ter', full: 'Terça' },
  { day: 3, short: 'Qua', full: 'Quarta' },
  { day: 4, short: 'Qui', full: 'Quinta' },
  { day: 5, short: 'Sex', full: 'Sexta' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
  { day: 7, short: 'Dom', full: 'Domingo' },
];

export const PtMarcacoesView: React.FC<PtMarcacoesViewProps> = ({
  uid,
  clients,
  activeWeek,
  sessions,
  bookings,
  waitlistEntries,
  templates,
  settings,
  onShiftWeek,
  onOpenWhatsApp,
  onBanner,
}) => {
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const weekSessions = useMemo(
    () =>
      activeWeek
        ? sessions
            .filter((s) => s.weekKey === activeWeek.weekKey)
            .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel))
        : [],
    [sessions, activeWeek]
  );

  const weekBookings = useMemo(
    () =>
      activeWeek
        ? bookings.filter((b) => b.weekKey === activeWeek.weekKey)
        : [],
    [bookings, activeWeek]
  );

  // Per-day metadata for the 7 weekly tabs
  const dayStats = useMemo(() => {
    const now = new Date();
    const mondayMs = activeWeek?.startDateMillis || 0;
    return WEEKDAY_SHORT.map(({ day, short, full }) => {
      const date = mondayMs ? new Date(mondayMs + (day - 1) * 86400000) : null;
      const isToday =
        date !== null &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const daySessions = weekSessions.filter((s) => s.dayOfWeek === day);
      const daySessionIds = new Set(daySessions.map((s) => s.id));
      const dayBookings = weekBookings.filter(
        (b) => daySessionIds.has(b.sessionId) && b.status !== 'CANCELLED'
      );
      const pendingCount = dayBookings.filter(
        (b) => b.status === 'PENDING' || b.status === 'ALTERED'
      ).length;
      const confirmedCount = dayBookings.filter((b) => b.status === 'CONFIRMED').length;

      return {
        day,
        short,
        full,
        date,
        dayNumber: date ? date.getDate() : null,
        monthLabel: date ? MONTHS_PT[date.getMonth()] : '',
        isToday,
        sessions: daySessions,
        pendingCount,
        confirmedCount,
      };
    });
  }, [activeWeek?.startDateMillis, weekSessions, weekBookings]);

  const defaultDay = useMemo(() => {
    const withPending = dayStats.find((d) => d.pendingCount > 0);
    if (withPending) return withPending.day;
    const todayEntry = dayStats.find((d) => d.isToday);
    if (todayEntry) return todayEntry.day;
    const withSessions = dayStats.find((d) => d.sessions.length > 0);
    return withSessions ? withSessions.day : 1;
  }, [dayStats]);

  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Track clients accepted in this workflow (per weekKey) so the PT sends WhatsApp ONLY at the end
  const [queuedByWeek, setQueuedByWeek] = useState<Record<string, string[]>>({});
  const [sentByWeek, setSentByWeek] = useState<Record<string, string[]>>({});
  const [showSendModal, setShowSendModal] = useState(false);
  const [includeAllConfirmed, setIncludeAllConfirmed] = useState(false);
  const [expandedPreviewClientId, setExpandedPreviewClientId] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  // Reset selected day & slot when switching week
  useEffect(() => {
    setSelectedDay(defaultDay);
    setSelectedSessionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWeek?.weekKey]);

  const currentDayInfo = dayStats.find((d) => d.day === selectedDay) || dayStats[0];
  const daySessions = currentDayInfo?.sessions || [];

  const weekKey = activeWeek?.weekKey || '';
  const queuedClientIds = useMemo(
    () => (weekKey ? queuedByWeek[weekKey] || [] : []),
    [queuedByWeek, weekKey]
  );
  const sentClientIds = useMemo(
    () => new Set(weekKey ? sentByWeek[weekKey] || [] : []),
    [sentByWeek, weekKey]
  );

  const totalWeekPending = useMemo(
    () =>
      weekBookings.filter((b) => b.status === 'PENDING' || b.status === 'ALTERED').length,
    [weekBookings]
  );

  // Build ready-to-notify list grouped by student (all CONFIRMED sessions of that student in activeWeek)
  const confirmedClientGroups = useMemo(() => {
    if (!activeWeek) return [];
    const sessionMap = new Map(weekSessions.map((s) => [s.id, s]));
    const byClient = new Map<string, TrainingSessionRecord[]>();

    weekBookings
      .filter((b) => b.status === 'CONFIRMED')
      .forEach((b) => {
        const ses = sessionMap.get(b.sessionId);
        if (!ses) return;
        const arr = byClient.get(b.clientId) || [];
        if (!arr.some((x) => x.id === ses.id)) arr.push(ses);
        byClient.set(b.clientId, arr);
      });

    const out: Array<{
      client: ClientRecord;
      sessions: TrainingSessionRecord[];
      wasQueued: boolean;
      wasSent: boolean;
      message: string;
    }> = [];

    byClient.forEach((clientSessions, clientId) => {
      const client = clientMap.get(clientId);
      if (!client) return;
      const sorted = clientSessions.slice().sort((a, b) => a.startMillis - b.startMillis);
      const message = buildMessageFromTemplate(templates, 'CONFIRMACAO', settings.siteBaseUrl, {
        clientName: client.name,
        sessions: sorted,
        week: activeWeek,
        ptUid: uid,
        studentPortalCode: settings.studentPortalCode,
      });
      out.push({
        client,
        sessions: sorted,
        wasQueued: queuedClientIds.includes(clientId),
        wasSent: sentClientIds.has(clientId),
        message,
      });
    });

    return out.sort((a, b) => {
      if (a.wasQueued !== b.wasQueued) return a.wasQueued ? -1 : 1;
      if (a.wasSent !== b.wasSent) return a.wasSent ? 1 : -1;
      return a.client.name.localeCompare(b.client.name);
    });
  }, [
    activeWeek,
    weekSessions,
    weekBookings,
    clientMap,
    templates,
    settings.siteBaseUrl,
    settings.studentPortalCode,
    uid,
    queuedClientIds,
    sentClientIds,
  ]);

  const unsentQueuedGroups = useMemo(
    () => confirmedClientGroups.filter((g) => g.wasQueued && !g.wasSent),
    [confirmedClientGroups]
  );

  const modalGroups = useMemo(
    () =>
      includeAllConfirmed || queuedClientIds.length === 0
        ? confirmedClientGroups
        : confirmedClientGroups.filter((g) => g.wasQueued),
    [confirmedClientGroups, includeAllConfirmed, queuedClientIds.length]
  );

  const addClientToNotifyQueue = (clientId: string) => {
    if (!weekKey) return;
    setQueuedByWeek((prev) => {
      const existing = prev[weekKey] || [];
      if (existing.includes(clientId)) return prev;
      return { ...prev, [weekKey]: [...existing, clientId] };
    });
    // If previously marked sent, re-open since new slot was accepted
    setSentByWeek((prev) => {
      const existing = prev[weekKey] || [];
      if (!existing.includes(clientId)) return prev;
      return { ...prev, [weekKey]: existing.filter((id) => id !== clientId) };
    });
  };

  const markClientMessageSent = (clientId: string) => {
    if (!weekKey) return;
    setSentByWeek((prev) => {
      const existing = prev[weekKey] || [];
      if (existing.includes(clientId)) return prev;
      return { ...prev, [weekKey]: [...existing, clientId] };
    });
  };

  const handleAcceptOne = async (booking: BookingRecord, clientName: string) => {
    setBusyBookingId(booking.id);
    try {
      await repo.confirmClientBookings(uid, [booking]);
      addClientToNotifyQueue(booking.clientId);
      onBanner(`${clientName} aceite ✓ (envia a mensagem no final quando quiseres)`);
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleRejectOne = async (booking: BookingRecord, clientName: string) => {
    setBusyBookingId(booking.id);
    try {
      await repo.removeBooking(uid, booking.id);
      onBanner(`Pedido de ${clientName} recusado.`);
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleAcceptAllInSession = async (pendingList: BookingRecord[]) => {
    if (pendingList.length === 0) return;
    await repo.confirmClientBookings(uid, pendingList);
    pendingList.forEach((b) => addClientToNotifyQueue(b.clientId));
    onBanner(`${pendingList.length} marcação(ões) aceite(s) ✓`);
  };

  return (
    <div className="space-y-4">
      {/* Week Header */}
      <BrandCard>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onShiftWeek(-1)}
            aria-label="Semana anterior"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
              Marcações por dia
            </p>
            <h2 className="text-lg font-bold text-[#F4F4F5]">
              {activeWeek?.label || 'Semana atual'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onShiftWeek(1)}
            aria-label="Semana seguinte"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#323238] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={totalWeekPending > 0 ? 'amber' : 'green'}>
              {totalWeekPending > 0
                ? `${totalWeekPending} pedido(s) por aceitar`
                : 'Tudo aceite esta semana'}
            </StatusPill>
            {unsentQueuedGroups.length > 0 && (
              <StatusPill tone="gold">
                {unsentQueuedGroups.length} confirmação(ões) por enviar
              </StatusPill>
            )}
          </div>
          {confirmedClientGroups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIncludeAllConfirmed(queuedClientIds.length === 0);
                setShowSendModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB308]/60 bg-[#3D3314] px-3 py-1.5 text-xs font-bold text-[#FACC15] transition hover:bg-[#EAB308] hover:text-[#121214]"
            >
              <Send className="h-3.5 w-3.5" />
              {unsentQueuedGroups.length > 0
                ? `Enviar confirmações (${unsentQueuedGroups.length})`
                : `Enviar mensagens (${confirmedClientGroups.length})`}
            </button>
          )}
        </div>
      </BrandCard>

      {/* Weekly 7-Day Selector */}
      <div className="grid grid-cols-7 gap-1.5">
        {dayStats.map((d) => {
          const isSelected = d.day === selectedDay;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => {
                setSelectedDay(d.day);
                setSelectedSessionId(null);
              }}
              className={`relative flex min-h-[68px] flex-col items-center justify-center rounded-2xl border px-1 py-2 transition ${
                isSelected
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214] shadow-md shadow-[#EAB308]/20'
                  : d.isToday
                  ? 'border-[#EAB308]/60 bg-[#3D3314]/40 text-[#F4F4F5] hover:border-[#EAB308]'
                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#52525B] hover:text-white'
              }`}
            >
              {d.pendingCount > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${
                    isSelected
                      ? 'bg-[#121214] text-[#FACC15]'
                      : 'bg-[#F59E0B] text-[#121214]'
                  }`}
                >
                  {d.pendingCount}
                </span>
              )}
              <span className="text-[11px] font-bold">{d.short}</span>
              <span className="mt-0.5 text-base font-extrabold leading-none">
                {d.dayNumber ?? '—'}
              </span>
              <span
                className={`mt-1 text-[10px] font-semibold ${
                  isSelected
                    ? 'text-[#121214]/80'
                    : d.sessions.length > 0
                    ? 'text-[#EAB308]'
                    : 'text-[#52525B]'
                }`}
              >
                {d.sessions.length > 0 ? `${d.sessions.length}h` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#F4F4F5]">
            {DAYS_PT[selectedDay]}
            {currentDayInfo?.dayNumber
              ? `, ${currentDayInfo.dayNumber} ${currentDayInfo.monthLabel}`
              : ''}
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Toca num horário para ver todas as pessoas que pediram esse treino e aceitar uma a uma.
          </p>
        </div>
        {currentDayInfo && currentDayInfo.pendingCount > 0 && (
          <StatusPill tone="amber">{currentDayInfo.pendingCount} por aceitar</StatusPill>
        )}
      </div>

      {/* Time Slots for Selected Day */}
      {daySessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Sem horários neste dia"
          subtitle="Seleciona outro dia da semana acima ou cria novos horários na subaba Semanas."
        />
      ) : (
        <div className="space-y-2.5">
          {daySessions.map((session) => {
            const isOpen = selectedSessionId === session.id;
            const sessionBookings = weekBookings
              .filter((b) => b.sessionId === session.id && b.status !== 'CANCELLED')
              .sort((a, b) => {
                const aPending = a.status === 'PENDING' || a.status === 'ALTERED';
                const bPending = b.status === 'PENDING' || b.status === 'ALTERED';
                if (aPending !== bPending) return aPending ? -1 : 1;
                return a.requestedAtMillis - b.requestedAtMillis;
              });
            const pendingBookings = sessionBookings.filter(
              (b) => b.status === 'PENDING' || b.status === 'ALTERED'
            );
            const confirmedBookings = sessionBookings.filter((b) => b.status === 'CONFIRMED');
            const sessionWaitlist = waitlistEntries
              .filter((w) => w.sessionId === session.id)
              .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            const isFull = confirmedBookings.length >= session.capacity;

            return (
              <div
                key={session.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  isOpen
                    ? 'border-[#EAB308] bg-[#1B1B1E]'
                    : pendingBookings.length > 0
                    ? 'border-[#F59E0B]/50 bg-[#1B1B1E] hover:border-[#EAB308]'
                    : 'border-[#323238] bg-[#1B1B1E] hover:border-[#52525B]'
                }`}
              >
                {/* Clickable Slot Row */}
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(isOpen ? null : session.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-12 min-w-[64px] flex-col items-center justify-center rounded-xl border px-2 ${
                        isOpen
                          ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                          : 'border-[#323238] bg-[#242429] text-[#FACC15]'
                      }`}
                    >
                      <span className="text-sm font-extrabold leading-none">
                        {session.timeLabel.replace(':', 'h')}
                      </span>
                      <span
                        className={`mt-0.5 text-[10px] font-semibold ${
                          isOpen ? 'text-[#121214]/80' : 'text-[#A1A1AA]'
                        }`}
                      >
                        {session.durationMinutes}m
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-[#F4F4F5]">
                          {sessionBookings.length === 0
                            ? 'Sem pedidos'
                            : `${sessionBookings.length} pessoa(s) neste horário`}
                        </span>
                        {pendingBookings.length > 0 && (
                          <StatusPill tone="amber">
                            {pendingBookings.length} por aceitar
                          </StatusPill>
                        )}
                        {sessionWaitlist.length > 0 && (
                          <StatusPill tone="blue">Espera: {sessionWaitlist.length}</StatusPill>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#A1A1AA]">
                        {confirmedBookings.length}/{session.capacity} confirmados
                        {session.note ? ` · ${session.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={isFull ? 'red' : 'gold'}>
                      {confirmedBookings.length}/{session.capacity}
                    </StatusPill>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-[#EAB308]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#A1A1AA]" />
                    )}
                  </div>
                </button>

                {/* Expanded People List */}
                {isOpen && (
                  <div className="border-t border-[#323238] bg-[#161619] p-4 space-y-3">
                    {pendingBookings.length > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EAB308]/30 bg-[#3D3314]/35 px-3 py-2">
                        <span className="text-xs font-semibold text-[#FACC15]">
                          {pendingBookings.length} pedidos à espera neste horário
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAcceptAllInSession(pendingBookings)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#EAB308] px-2.5 py-1 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Aceitar todos deste horário
                        </button>
                      </div>
                    )}

                    {sessionBookings.length === 0 ? (
                      <p className="py-2 text-center text-xs text-[#A1A1AA]">
                        Nenhum aluno pediu este horário ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sessionBookings.map((b) => {
                          const client = clientMap.get(b.clientId);
                          if (!client) return null;
                          const isConfirmed = b.status === 'CONFIRMED';
                          const isAltered = b.status === 'ALTERED';
                          const isBusy = busyBookingId === b.id;

                          return (
                            <div
                              key={b.id}
                              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                                isConfirmed
                                  ? 'border-[#22C55E]/35 bg-[#143521]/25'
                                  : 'border-[#323238] bg-[#242429]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-[#F4F4F5]">
                                    {client.name}
                                  </span>
                                  <StatusPill
                                    tone={
                                      client.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'
                                    }
                                  >
                                    {client.trainingType === 'PERSONALIZADO'
                                      ? 'Personalizado'
                                      : 'Grupo'}
                                  </StatusPill>
                                  {isConfirmed ? (
                                    <StatusPill tone="green">Aceite ✓</StatusPill>
                                  ) : isAltered ? (
                                    <StatusPill tone="amber">Alterado</StatusPill>
                                  ) : (
                                    <StatusPill tone="amber">Pendente</StatusPill>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#A1A1AA]">
                                  <span>{formatPhoneDisplay(client.phone)}</span>
                                  {b.requestedAtMillis > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTimeAgo(b.requestedAtMillis)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {!isConfirmed ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleRejectOne(b, client.name)}
                                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#EF4444]/60 bg-[#3B1518]/50 px-3 py-1.5 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white disabled:opacity-40"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Recusar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleAcceptOne(b, client.name)}
                                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-[#22C55E] px-3.5 py-1.5 text-xs font-extrabold text-[#121214] transition hover:bg-[#4ADE80] disabled:opacity-40"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Aceitar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRejectOne(b, client.name)}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-[#3B1518]/60"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Waitlist if present */}
                    {sessionWaitlist.length > 0 && (
                      <div className="border-t border-[#323238] pt-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">
                          Lista de Espera ({sessionWaitlist.length})
                        </p>
                        {sessionWaitlist.map((w, idx) => {
                          const client = clientMap.get(w.clientId);
                          if (!client) return null;
                          return (
                            <div
                              key={w.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#3B2A14]/35 p-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <StatusPill tone="amber">#{idx + 1}</StatusPill>
                                <div>
                                  <p className="text-xs font-bold text-[#F4F4F5]">{client.name}</p>
                                  <p className="text-[11px] text-[#A1A1AA]">
                                    {formatPhoneDisplay(client.phone)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await repo.promoteWaitlistEntry(uid, w);
                                    addClientToNotifyQueue(w.clientId);
                                    onBanner(`${client.name} promovido e aceite ✓`);
                                  }}
                                  className="rounded-lg bg-[#EAB308] px-2.5 py-1 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                                >
                                  Aceitar vaga ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await repo.leaveWaitlist(uid, w.id);
                                    onBanner('Removido da lista de espera.');
                                  }}
                                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[#EF4444] hover:bg-[#3B1518]"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Final Action Bar — Send WhatsApp Confirmations ONLY when PT wants */}
      {confirmedClientGroups.length > 0 && (
        <BrandCard highlight={unsentQueuedGroups.length > 0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#FACC15]" />
              <div>
                <p className="text-sm font-bold text-[#F4F4F5]">
                  {unsentQueuedGroups.length > 0
                    ? `${unsentQueuedGroups.length} aluno(s) aceites prontos para confirmar no WhatsApp`
                    : `${confirmedClientGroups.length} aluno(s) com treinos confirmados esta semana`}
                </p>
                <p className="text-xs text-[#A1A1AA]">
                  Podes continuar a aceitar todos os horários da semana e enviar as mensagens de
                  confirmação só no final.
                </p>
              </div>
            </div>
            <GoldButton
              onClick={() => {
                setIncludeAllConfirmed(queuedClientIds.length === 0);
                setShowSendModal(true);
              }}
            >
              <Send className="h-4 w-4" />
              Enviar confirmações
            </GoldButton>
          </div>
        </BrandCard>
      )}

      {/* Modal: Send Confirmation Messages when PT chooses */}
      <Modal
        open={showSendModal}
        title="Enviar mensagens de confirmação"
        subtitle={`Semana ${activeWeek?.label || ''} · Cada mensagem inclui todos os horários aceites do aluno`}
        onClose={() => setShowSendModal(false)}
      >
        <div className="space-y-3">
          {queuedClientIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#242429] px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#D4D4D8]">
                <input
                  type="checkbox"
                  checked={includeAllConfirmed}
                  onChange={(e) => setIncludeAllConfirmed(e.target.checked)}
                  className="h-4 w-4 accent-[#EAB308]"
                />
                Mostrar também outros alunos já confirmados ({confirmedClientGroups.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!weekKey) return;
                  setQueuedByWeek((prev) => ({ ...prev, [weekKey]: [] }));
                  setSentByWeek((prev) => ({ ...prev, [weekKey]: [] }));
                  onBanner('Lista de envios limpa.');
                }}
                className="text-xs font-semibold text-[#A1A1AA] hover:text-white"
              >
                Limpar fila
              </button>
            </div>
          )}

          {modalGroups.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#A1A1AA]">
              Nenhum aluno com marcações confirmadas para enviar mensagem.
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
              {modalGroups.map((group) => {
                const isPreviewOpen = expandedPreviewClientId === group.client.id;
                return (
                  <div
                    key={group.client.id}
                    className={`rounded-xl border p-3 space-y-2 ${
                      group.wasSent
                        ? 'border-[#22C55E]/40 bg-[#143521]/25'
                        : 'border-[#323238] bg-[#242429]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-[#F4F4F5]">
                            {group.client.name}
                          </span>
                          {group.wasSent && <StatusPill tone="green">Enviado ✓</StatusPill>}
                        </div>
                        <p className="text-[11px] text-[#A1A1AA]">
                          {formatPhoneDisplay(group.client.phone)} · {group.sessions.length}{' '}
                          treino(s)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPreviewClientId(isPreviewOpen ? null : group.client.id)
                        }
                        className="text-xs font-semibold text-[#FACC15] hover:underline"
                      >
                        {isPreviewOpen ? 'Ocultar texto' : 'Ver texto'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.sessions.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-lg border border-[#323238] bg-[#1B1B1E] px-2 py-0.5 text-[11px] font-semibold text-[#D4D4D8]"
                        >
                          {s.dateLabel} · {s.timeLabel.replace(':', 'h')}
                        </span>
                      ))}
                    </div>

                    {isPreviewOpen && (
                      <pre className="whitespace-pre-wrap rounded-xl border border-[#323238] bg-[#1B1B1E] p-2.5 font-sans text-xs text-[#F4F4F5]">
                        {group.message}
                      </pre>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <SecondaryButton
                        onClick={async () => {
                          await navigator.clipboard.writeText(group.message);
                          onBanner(`Mensagem de ${group.client.name} copiada!`);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </SecondaryButton>
                      <GoldButton
                        onClick={() => {
                          markClientMessageSent(group.client.id);
                          onOpenWhatsApp(group.client.phone, group.message);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {group.wasSent ? 'Reenviar WhatsApp' : 'Enviar WhatsApp'}
                      </GoldButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <SecondaryButton onClick={() => setShowSendModal(false)}>Fechar</SecondaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
