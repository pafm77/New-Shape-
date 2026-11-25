import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CreditCard,
  Dumbbell,
  FileText,
  KeyRound,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import {
  AttendanceStatus,
  BookingRecord,
  ClientRecord,
  FidelizacaoRecord,
  PaymentRecord,
  PhysicalAssessmentRecord,
  TrainingSessionRecord,
  TrainingType,
  TrainingWeekRecord,
  WeekResponseRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { openStudentEvolutionPdfReport } from '../services/evolutionReportGenerator';
import {
  DEFAULT_JOIA_EUR,
  FIXED_DAY_OPTIONS,
  PAYMENT_METHODS,
  PaymentMethod,
  buildConsecutiveMonths,
  buildRecentMonthOptions,
  formatFixedSlot,
  formatFixedSlotsSummary,
  formatPhoneDisplay,
  formatRgpdConsentStamp,
  formatShortDate,
  getEffectiveClientFidelizacaoMonths,
  getPaymentCategory,
  isExtraFeePayment,
  normalizeFixedSlots,
  splitAmountAcrossMonths,
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
import { formatBirthDatePt, getCurrentAge, parseBirthDate } from './StudentEngagementWidgets';

interface PtClientsSectionProps {
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  assessments: PhysicalAssessmentRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
  onJumpToWorkout: (clientId: string) => void;
  onJumpToNutrition: (clientId: string) => void;
  onJumpToChat: (clientId: string) => void;
  onBanner: (msg: string) => void;
}

export const PtClientsSection: React.FC<PtClientsSectionProps> = ({
  uid,
  isSuperAdmin,
  clients,
  activeWeek,
  sessions,
  bookings,
  weekResponses,
  payments,
  fidelizacoes,
  assessments,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs,
  onJumpToWorkout,
  onJumpToNutrition,
  onJumpToChat,
  onBanner,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | TrainingType>('ALL');
  const [fidelizacaoFilter, setFidelizacaoFilter] = useState<'ALL' | 'ANY_FID' | '6' | '12' | 'NONE'>('ALL');
  const [fixedOnlyFilter, setFixedOnlyFilter] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [payTarget, setPayTarget] = useState<ClientRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);

  const recentMonths = useMemo(() => buildRecentMonthOptions(), []);
  const currentMonthYear = recentMonths[0].monthYear;
  const currentMonthLabel = recentMonths[0].monthLabel;

  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null;

  const clientFidMonthsMap = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const eff = getEffectiveClientFidelizacaoMonths(c, fidelizacoes);
      map.set(c.id, eff === 6 || eff === 12 ? eff : 0);
    });
    return map;
  }, [clients, fidelizacoes]);

  const clientUpcomingBookingsMap = useMemo(() => {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const minMillis = todayStart.getTime();
    const map = new Map<string, { confirmed: number; pending: number; nextLabel: string }>();

    const grouped = new Map<string, Array<{ booking: BookingRecord; session: TrainingSessionRecord }>>();
    bookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;
      const ses = sessionById.get(b.sessionId);
      if (!ses || ses.startMillis < minMillis) return;
      const list = grouped.get(b.clientId) || [];
      list.push({ booking: b, session: ses });
      grouped.set(b.clientId, list);
    });

    grouped.forEach((items, clientId) => {
      items.sort((a, b) => a.session.startMillis - b.session.startMillis);
      const confirmed = items.filter((i) => i.booking.status === 'CONFIRMED').length;
      const pending = items.filter((i) => i.booking.status !== 'CONFIRMED').length;
      const next = items[0]?.session;
      const nextLabel = next ? `${next.dateLabel} · ${next.timeLabel.replace(':', 'h')}` : '';
      map.set(clientId, { confirmed, pending, nextLabel });
    });

    return map;
  }, [bookings, sessions]);

  if (selectedClient) {
    return (
      <ClientProfileView
        uid={uid}
        isSuperAdmin={isSuperAdmin}
        client={selectedClient}
        activeWeek={activeWeek}
        sessions={sessions}
        allBookings={bookings}
        bookings={bookings.filter((b) => b.clientId === selectedClient.id)}
        weekResponses={weekResponses}
        payments={payments.filter((p) => p.clientId === selectedClient.id)}
        fidelizacoes={fidelizacoes.filter((f) => f.clientId === selectedClient.id)}
        assessments={assessments.filter((a) => a.clientId === selectedClient.id)}
        workoutPlans={workoutPlans}
        workoutPlanItems={workoutPlanItems}
        workoutLoadLogs={workoutLoadLogs}
        currentMonthYear={currentMonthYear}
        currentMonthLabel={currentMonthLabel}
        onBack={() => setSelectedClientId(null)}
        onJumpToWorkout={() => onJumpToWorkout(selectedClient.id)}
        onJumpToNutrition={() => onJumpToNutrition(selectedClient.id)}
        onJumpToChat={() => onJumpToChat(selectedClient.id)}
        onBanner={onBanner}
      />
    );
  }

  const activeClientsList = clients.filter((c) => c.active);
  const baseVisibleClients = showInactive ? clients : activeClientsList;
  const persCount = baseVisibleClients.filter((c) => c.trainingType === 'PERSONALIZADO').length;
  const grupoCount = baseVisibleClients.filter((c) => c.trainingType !== 'PERSONALIZADO').length;
  const fixedClientsCount = baseVisibleClients.filter((c) => (c.fixedSlots?.length ?? 0) > 0).length;

  const fid6Count = baseVisibleClients.filter((c) => clientFidMonthsMap.get(c.id) === 6).length;
  const fid12Count = baseVisibleClients.filter((c) => clientFidMonthsMap.get(c.id) === 12).length;
  const fidAnyCount = fid6Count + fid12Count;
  const noFidCount = baseVisibleClients.length - fidAnyCount;

  const filtered = baseVisibleClients.filter((c) => {
    if (typeFilter === 'PERSONALIZADO' && c.trainingType !== 'PERSONALIZADO') return false;
    if (typeFilter === 'GRUPO' && c.trainingType === 'PERSONALIZADO') return false;
    if (fixedOnlyFilter && (c.fixedSlots?.length ?? 0) === 0) return false;
    const effFid = clientFidMonthsMap.get(c.id) || 0;
    if (fidelizacaoFilter === 'ANY_FID' && effFid !== 6 && effFid !== 12) return false;
    if (fidelizacaoFilter === '6' && effFid !== 6) return false;
    if (fidelizacaoFilter === '12' && effFid !== 12) return false;
    if (fidelizacaoFilter === 'NONE' && (effFid === 6 || effFid === 12)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Alunos</h2>
          <p className="text-xs text-[#A1A1AA]">
            {activeClientsList.length} ativos ({persCount} Personalizado · {grupoCount} Grupo) ·{' '}
            {clients.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4" />
            Importar CSV
          </SecondaryButton>
          <GoldButton onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </GoldButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome ou telemóvel..."
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#A1A1AA]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 accent-[#EAB308]"
          />
          Mostrar inativos
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'ALL' as const, label: `Todos (${baseVisibleClients.length})` },
              { id: 'PERSONALIZADO' as const, label: `Treino Personalizado (${persCount})` },
              { id: 'GRUPO' as const, label: `Treino em Grupo (${grupoCount})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                typeFilter === opt.id
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFixedOnlyFilter((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              fixedOnlyFilter
                ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                : 'border-[#EAB308]/40 bg-[#3D3314]/40 text-[#FACC15] hover:bg-[#3D3314]'
            }`}
          >
            Dias fixos ({fixedClientsCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
            Fidelização:
          </span>
          {(
            [
              { id: 'ALL' as const, label: 'Todas' },
              { id: 'ANY_FID' as const, label: `6 ou 12m (${fidAnyCount})` },
              { id: '6' as const, label: `6 Meses (${fid6Count})` },
              { id: '12' as const, label: `12 Meses (${fid12Count})` },
              { id: 'NONE' as const, label: `Sem fidel. (${noFidCount})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFidelizacaoFilter(opt.id)}
              className={`rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                fidelizacaoFilter === opt.id
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum aluno encontrado"
          subtitle="Adiciona um novo cliente, ajusta os filtros ou importa uma lista CSV."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const monthPay = payments.find(
              (p) =>
                p.clientId === c.id &&
                p.monthYear === currentMonthYear &&
                p.paid &&
                !isExtraFeePayment(p.note)
            );
            const effectiveFid = clientFidMonthsMap.get(c.id) || 0;
            const upcomingInfo = clientUpcomingBookingsMap.get(c.id);
            const hasBookedTrainings = (upcomingInfo?.confirmed ?? 0) > 0;
            const hasPendingTrainings = (upcomingInfo?.pending ?? 0) > 0;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className="cursor-pointer rounded-2xl border border-[#323238] bg-[#1B1B1E] p-4 transition hover:border-[#EAB308]/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base font-bold text-[#F4F4F5]">{c.name}</h3>
                      <StatusPill tone={c.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}>
                        {c.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
                      </StatusPill>
                      {(c.weeklySessionLimit ?? 0) > 0 && (
                        <StatusPill tone="neutral">{c.weeklySessionLimit}x/sem</StatusPill>
                      )}
                      {parseBirthDate(c.birthDate) && (
                        <StatusPill tone="blue">
                          🎂 {formatBirthDatePt(c.birthDate).slice(0, 5)}
                          {getCurrentAge(c.birthDate) !== null ? ` (${getCurrentAge(c.birthDate)}a)` : ''}
                        </StatusPill>
                      )}
                      {hasBookedTrainings ? (
                        <StatusPill tone="green">
                          ✓ {upcomingInfo!.confirmed} marcado{upcomingInfo!.confirmed > 1 ? 's' : ''}
                        </StatusPill>
                      ) : hasPendingTrainings ? (
                        <StatusPill tone="amber">
                          {upcomingInfo!.pending} por confirmar
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Por marcar</StatusPill>
                      )}
                      {c.newClient && <StatusPill tone="blue">Novo</StatusPill>}
                      {!c.active && <StatusPill>Inativo</StatusPill>}
                    </div>
                    <p className="text-xs text-[#A1A1AA]">
                      {c.phone ? formatPhoneDisplay(c.phone) : 'Sem telemóvel'}
                      {upcomingInfo?.nextLabel ? ` · Próx.: ${upcomingInfo.nextLabel}` : ''}
                    </p>
                    {(c.fixedSlots?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs font-semibold text-[#FACC15]">
                        Fixo: {formatFixedSlotsSummary(c.fixedSlots)}
                      </p>
                    )}
                    {((isSuperAdmin && c.monthlyFeeEur > 0) || effectiveFid > 0) && (
                      <p className="mt-1 text-xs font-semibold text-[#EAB308]">
                        {[
                          isSuperAdmin && c.monthlyFeeEur > 0 ? `€${c.monthlyFeeEur.toFixed(0)}/mês` : '',
                          effectiveFid > 0 ? `Fidelização ${effectiveFid}m` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <StatusPill tone={monthPay ? 'green' : 'amber'}>
                      {monthPay ? `Pago €${monthPay.amountEur.toFixed(0)}` : 'Por pagar'}
                    </StatusPill>
                  )}
                </div>

                <div
                  className="mt-3 flex items-center justify-between border-t border-[#323238] pt-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isSuperAdmin ? (
                    <button
                      type="button"
                      onClick={() => setPayTarget(c)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EAB308] hover:underline"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {monthPay ? 'Registar outro pagamento' : 'Apontar pagamento'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#71717A]">Perfil & Assiduidade</span>
                  )}
                  <div className="flex items-center gap-3">
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#EF4444] hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedClientId(c.id)}
                      className="text-xs font-semibold text-[#A1A1AA] hover:text-white"
                    >
                      Ver perfil →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewClientModal
          onClose={() => setShowNewModal(false)}
          onSave={async (
            name,
            phone,
            notes,
            trainingType,
            weeklySessionLimit,
            birthDate,
            weeklyGoalSessions
          ) => {
            await repo.addClient(uid, {
              name,
              phone,
              notes,
              trainingType,
              weeklySessionLimit,
              birthDate,
              weeklyGoalSessions,
            });
            setShowNewModal(false);
            onBanner('Aluno adicionado!');
          }}
        />
      )}

      {showImportModal && (
        <ImportClientsModal
          onClose={() => setShowImportModal(false)}
          onImport={(raw) => repo.importClientsCsv(uid, raw, clients)}
        />
      )}

      {isSuperAdmin && payTarget && (
        <RegisterPaymentModal
          clientName={payTarget.name}
          defaultAmount={payTarget.monthlyFeeEur > 0 ? payTarget.monthlyFeeEur : 120}
          defaultDurationMonths={getEffectiveClientFidelizacaoMonths(payTarget, fidelizacoes)}
          onClose={() => setPayTarget(null)}
          onConfirm={async (my, ml, amount, method, durationMonths, extras) => {
            await repo.recordPayment(
              uid,
              payTarget.id,
              my,
              ml,
              amount,
              method,
              durationMonths,
              extras
            );
            setPayTarget(null);
            const extraParts: string[] = [];
            if (extras.seguroEur > 0) extraParts.push(`Seguro €${extras.seguroEur.toFixed(2)}`);
            if (extras.joiaEur > 0) extraParts.push(`Jóia €${extras.joiaEur.toFixed(2)}`);
            const extraSuffix = extraParts.length > 0 ? ` + ${extraParts.join(' + ')}` : '';
            onBanner(
              durationMonths > 1 && amount > 0
                ? `Pagamento de ${durationMonths} meses (€${(
                    amount / durationMonths
                  ).toFixed(2)}/mês)${extraSuffix} registado e adicionado às Fidelizações!`
                : `Pagamento registado${extraSuffix ? ` (${extraParts.join(' + ')})` : ''}!`
            );
          }}
        />
      )}

      {isSuperAdmin && deleteTarget && (
        <DeleteClientConfirmModal
          client={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const name = deleteTarget.name;
            await repo.deleteClientAccount(uid, deleteTarget.id);
            if (selectedClientId === deleteTarget.id) {
              setSelectedClientId(null);
            }
            setDeleteTarget(null);
            onBanner(`Conta de ${name} eliminada permanentemente.`);
          }}
        />
      )}
    </div>
  );
};

const ClientProfileView: React.FC<{
  uid: string;
  isSuperAdmin: boolean;
  client: ClientRecord;
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  allBookings: BookingRecord[];
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  assessments: PhysicalAssessmentRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
  currentMonthYear: string;
  currentMonthLabel: string;
  onBack: () => void;
  onJumpToWorkout: () => void;
  onJumpToNutrition: () => void;
  onJumpToChat: () => void;
  onBanner: (msg: string) => void;
}> = ({
  uid,
  isSuperAdmin,
  client,
  activeWeek,
  sessions,
  allBookings,
  bookings,
  weekResponses,
  payments,
  fidelizacoes,
  assessments,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs,
  currentMonthYear,
  currentMonthLabel,
  onBack,
  onJumpToWorkout,
  onJumpToNutrition,
  onJumpToChat,
  onBanner,
}) => {
  const [profileTab, setProfileTab] = useState<'profile' | 'attendance'>('profile');
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [notes, setNotes] = useState(client.notes);
  const [trainingType, setTrainingType] = useState<TrainingType>(
    client.trainingType === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'GRUPO'
  );
  const [weeklySessionLimit, setWeeklySessionLimit] = useState<number>(
    client.weeklySessionLimit ?? 0
  );
  const [birthDate, setBirthDate] = useState<string>(client.birthDate || '');
  const [weeklyGoalSessions, setWeeklyGoalSessions] = useState<number>(
    client.weeklyGoalSessions ?? 0
  );
  const [monthlyFee, setMonthlyFee] = useState(
    client.monthlyFeeEur > 0 ? String(client.monthlyFeeEur) : ''
  );
  const [fidMonths, setFidMonths] = useState(client.fidelizacaoMonths);
  const [fidStart, setFidStart] = useState(
    client.fidelizacaoStartMillis > 0 ? client.fidelizacaoStartMillis : Date.now()
  );
  const [fixedSlotsDraft, setFixedSlotsDraft] = useState<string[]>(
    normalizeFixedSlots(client.fixedSlots)
  );
  const [newFixedDay, setNewFixedDay] = useState<number>(1);
  const [newFixedTime, setNewFixedTime] = useState<string>('09:00');
  const [savingFixed, setSavingFixed] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [splitTargetPayment, setSplitTargetPayment] = useState<PaymentRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const monthPayment = payments.find(
    (p) => p.monthYear === currentMonthYear && p.paid && !isExtraFeePayment(p.note)
  );

  const endMillis = useMemo(() => {
    if (!fidMonths) return 0;
    const d = new Date(fidStart);
    d.setMonth(d.getMonth() + fidMonths);
    return d.getTime();
  }, [fidMonths, fidStart]);

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const confirmedHistory = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'CONFIRMED')
      .map((b) => ({ booking: b, session: sessionMap.get(b.sessionId) }))
      .filter(
        (item): item is { booking: BookingRecord; session: TrainingSessionRecord } =>
          Boolean(item.session)
      )
      .sort((a, b) => b.session.startMillis - a.session.startMillis);
  }, [bookings, sessionMap]);

  const upcomingBookings = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const minMs = todayStart.getTime();
    return bookings
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => ({ booking: b, session: sessionMap.get(b.sessionId) }))
      .filter(
        (item): item is { booking: BookingRecord; session: TrainingSessionRecord } =>
          Boolean(item.session && item.session.startMillis >= minMs)
      )
      .sort((a, b) => a.session.startMillis - b.session.startMillis);
  }, [bookings, sessionMap]);

  const presentCount = confirmedHistory.filter((i) => i.booking.attendanceStatus === 'PRESENT').length;
  const absentCount = confirmedHistory.filter((i) => i.booking.attendanceStatus === 'ABSENT').length;
  const markedCount = presentCount + absentCount;
  const pendingAttendanceCount = confirmedHistory.length - markedCount;
  const donePct = markedCount > 0 ? (presentCount / markedCount) * 100 : 0;
  const absentPct = markedCount > 0 ? (absentCount / markedCount) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#F4F4F5]">{client.name}</h2>
              <StatusPill tone={client.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}>
                {client.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
              </StatusPill>
              {client.notes.toLowerCase().includes('rgpd aceite') && (
                <StatusPill tone="green">RGPD ✓</StatusPill>
              )}
              {Boolean(client.loginPinHash) && (
                <StatusPill tone="gold">PIN 🔒</StatusPill>
              )}
            </div>
            <p className={`text-xs ${client.active ? 'text-[#22C55E]' : 'text-[#A1A1AA]'}`}>
              {client.active ? 'Aluno ativo' : 'Aluno inativo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {Boolean(client.loginPinHash) && (
            <button
              type="button"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Repor o PIN de 4 dígitos de ${client.name}? O aluno poderá entrar só com o telemóvel e criar um novo PIN.`
                  )
                ) {
                  return;
                }
                await repo.updateClientPinHash(uid, client.id, '');
                onBanner('PIN reposto! O aluno pode agora entrar sem PIN e definir um novo.');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#EAB308]/40 bg-[#3D3314]/60 px-2.5 py-1 text-xs font-bold text-[#FACC15] hover:border-[#EAB308]"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Repor PIN
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await repo.updateClient(uid, { ...client, active: !client.active });
              onBanner(client.active ? 'Aluno desativado.' : 'Aluno reativado.');
            }}
            className={`text-xs font-bold ${
              client.active ? 'text-[#EF4444]' : 'text-[#22C55E]'
            } hover:underline`}
          >
            {client.active ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SecondaryButton onClick={onJumpToWorkout}>
          <Dumbbell className="h-4 w-4" />
          Treino
        </SecondaryButton>
        <SecondaryButton onClick={onJumpToNutrition}>
          <Utensils className="h-4 w-4" />
          Nutrição
        </SecondaryButton>
        <SecondaryButton onClick={onJumpToChat}>
          <MessageCircle className="h-4 w-4" />
          Chat
        </SecondaryButton>
        <GoldButton
          onClick={() => {
            const ok = openStudentEvolutionPdfReport({
              client,
              assessments,
              bookings,
              sessions,
              workoutPlans,
              workoutPlanItems,
              workoutLoadLogs,
            });
            onBanner(
              ok
                ? 'Relatório de Evolução PDF pronto para guardar ou imprimir!'
                : 'Autoriza pop-ups no browser para gerar o relatório PDF.'
            );
          }}
        >
          <FileText className="h-4 w-4" />
          Relatório PDF
        </GoldButton>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
        <button
          type="button"
          onClick={() => setProfileTab('profile')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            profileTab === 'profile'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Perfil & Plano
        </button>
        <button
          type="button"
          onClick={() => setProfileTab('attendance')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            profileTab === 'attendance'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Assiduidade {markedCount > 0 ? `(${donePct.toFixed(0)}%)` : ''}
        </button>
      </div>

      {profileTab === 'attendance' ? (
        <div className="space-y-4">
          <BrandCard highlight>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-[#EAB308]" />
                <h3 className="text-base font-bold text-[#FACC15]">Assiduidade nos Treinos</h3>
              </div>
              <StatusPill tone={markedCount === 0 ? 'neutral' : donePct >= 75 ? 'green' : 'amber'}>
                {markedCount > 0 ? `${donePct.toFixed(0)}% feitos` : 'Sem registos'}
              </StatusPill>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-[#22C55E]/30 bg-[#143521]/60 p-3">
                <p className="text-[11px] text-[#86EFAC]">Treinos Feitos</p>
                <p className="mt-0.5 text-2xl font-extrabold text-[#22C55E]">
                  {markedCount > 0 ? `${donePct.toFixed(0)}%` : '—'}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">{presentCount} presença(s)</p>
              </div>
              <div className="rounded-xl border border-[#EF4444]/30 bg-[#3B1518]/60 p-3">
                <p className="text-[11px] text-[#FCA5A5]">Faltas</p>
                <p className="mt-0.5 text-2xl font-extrabold text-[#EF4444]">
                  {markedCount > 0 ? `${absentPct.toFixed(0)}%` : '—'}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">{absentCount} falta(s)</p>
              </div>
              <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
                <p className="text-[11px] text-[#A1A1AA]">Registados</p>
                <p className="mt-0.5 text-2xl font-extrabold text-[#F4F4F5]">{markedCount}</p>
                <p className="text-[11px] text-[#A1A1AA]">com presença/falta</p>
              </div>
              <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
                <p className="text-[11px] text-[#A1A1AA]">Por registar</p>
                <p className="mt-0.5 text-2xl font-extrabold text-[#FACC15]">
                  {pendingAttendanceCount}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">confirmados</p>
              </div>
            </div>

            {markedCount > 0 && (
              <div className="mt-3">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#242429]">
                  <div
                    style={{ width: `${donePct}%` }}
                    className="h-full bg-[#22C55E] transition-all"
                  />
                  <div
                    style={{ width: `${absentPct}%` }}
                    className="h-full bg-[#EF4444] transition-all"
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
                  <span className="text-[#22C55E]">
                    Feitos: {presentCount} ({donePct.toFixed(1)}%)
                  </span>
                  <span className="text-[#EF4444]">
                    Faltas: {absentCount} ({absentPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </BrandCard>

          <BrandCard>
            <h3 className="text-base font-bold text-[#F4F4F5]">
              Histórico de Treinos Confirmados ({confirmedHistory.length})
            </h3>
            {confirmedHistory.length === 0 ? (
              <p className="mt-2 text-xs text-[#A1A1AA]">
                Ainda não existem treinos confirmados para este aluno.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {confirmedHistory.map(({ booking, session }) => {
                  const isPresent = booking.attendanceStatus === 'PRESENT';
                  const isAbsent = booking.attendanceStatus === 'ABSENT';
                  const toggle = async (next: AttendanceStatus) => {
                    const target: AttendanceStatus =
                      booking.attendanceStatus === next ? '' : next;
                    await repo.setBookingAttendance(uid, booking.id, target);
                    onBanner(
                      target === 'PRESENT'
                        ? 'Presença confirmada ✓'
                        : target === 'ABSENT'
                        ? 'Falta registada.'
                        : 'Registo de presença limpo.'
                    );
                  };
                  return (
                    <div
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#242429] p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#F4F4F5]">
                          {session.dateLabel} · {session.timeLabel.replace(':', 'h')}
                        </p>
                        <p className="text-xs text-[#A1A1AA]">
                          {session.durationMinutes} min
                          {session.note ? ` · ${session.note}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggle('PRESENT')}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                            isPresent
                              ? 'border-[#22C55E] bg-[#22C55E] text-[#121214]'
                              : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#22C55E] hover:text-[#22C55E]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Presente
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle('ABSENT')}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                            isAbsent
                              ? 'border-[#EF4444] bg-[#EF4444] text-white'
                              : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#EF4444] hover:text-[#EF4444]'
                          }`}
                        >
                          <X className="h-3.5 w-3.5" />
                          Falta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BrandCard>
        </div>
      ) : (
        <>
      <BrandCard highlight={upcomingBookings.length > 0}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[#EAB308]" />
            <h3 className="text-base font-bold text-[#F4F4F5]">Próximos Treinos Marcados</h3>
          </div>
          <StatusPill tone={upcomingBookings.length > 0 ? 'green' : 'neutral'}>
            {upcomingBookings.length > 0
              ? `${upcomingBookings.length} marcado${upcomingBookings.length > 1 ? 's' : ''}`
              : 'Sem marcações'}
          </StatusPill>
        </div>
        {upcomingBookings.length === 0 ? (
          <p className="mt-2 text-xs text-[#A1A1AA]">
            Este aluno ainda não tem treinos marcados para hoje ou próximos dias.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {upcomingBookings.map(({ booking, session }) => (
              <div
                key={booking.id}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  booking.status === 'CONFIRMED'
                    ? 'border-[#22C55E]/40 bg-[#143524]/40 text-[#86EFAC]'
                    : 'border-[#F59E0B]/40 bg-[#3F2A10]/40 text-[#FDE68A]'
                }`}
              >
                {session.dateLabel} · {session.timeLabel.replace(':', 'h')}{' '}
                {booking.status === 'CONFIRMED' ? '✓' : '(por confirmar)'}
              </div>
            ))}
          </div>
        )}
      </BrandCard>

      {(isSuperAdmin || (client.fixedSlots?.length ?? 0) > 0) && (
        <BrandCard highlight={(client.fixedSlots?.length ?? 0) > 0}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#FACC15]">Dias Fixos Semanais</h3>
              <p className="text-xs text-[#A1A1AA]">
                Marcações geradas automaticamente todas as semanas como{' '}
                <strong className="text-[#F4F4F5]">Por confirmar</strong> para aprovação do PT.
              </p>
            </div>
            <StatusPill tone={fixedSlotsDraft.length > 0 ? 'gold' : 'neutral'}>
              {fixedSlotsDraft.length > 0
                ? `${fixedSlotsDraft.length} horário${fixedSlotsDraft.length > 1 ? 's' : ''}`
                : 'Sem dias fixos'}
            </StatusPill>
          </div>

          {fixedSlotsDraft.length === 0 ? (
            <p className="mt-2.5 text-xs text-[#A1A1AA]">
              Este aluno ainda não tem dias fixos definidos.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {fixedSlotsDraft.map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB308]/50 bg-[#3D3314]/60 px-3 py-1.5 text-xs font-bold text-[#FACC15]"
                >
                  {formatFixedSlot(slot)}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      aria-label={`Remover ${formatFixedSlot(slot)}`}
                      onClick={() =>
                        setFixedSlotsDraft((prev) => prev.filter((item) => item !== slot))
                      }
                      className="rounded-full p-0.5 text-[#FACC15] hover:bg-[#121214]/40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {isSuperAdmin && (
            <div className="mt-3 space-y-3 border-t border-[#323238] pt-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[130px] flex-1">
                  <FieldLabel>Dia da semana</FieldLabel>
                  <select
                    value={newFixedDay}
                    onChange={(e) => setNewFixedDay(Number(e.target.value))}
                    className="min-h-[44px] w-full rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-sm text-[#F4F4F5] focus:border-[#EAB308] focus:outline-none"
                  >
                    {FIXED_DAY_OPTIONS.map((d) => (
                      <option key={d.dayOfWeek} value={d.dayOfWeek}>
                        {d.full}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-[120px]">
                  <FieldLabel>Hora</FieldLabel>
                  <Input
                    type="time"
                    value={newFixedTime}
                    onChange={(e) => setNewFixedTime(e.target.value)}
                  />
                </div>
                <SecondaryButton
                  onClick={() => {
                    if (!newFixedTime) return;
                    const key = `${newFixedDay}|${newFixedTime}`;
                    setFixedSlotsDraft((prev) => normalizeFixedSlots([...prev, key]));
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </SecondaryButton>
              </div>

              <div className="flex flex-wrap gap-2">
                <GoldButton
                  disabled={savingFixed}
                  onClick={async () => {
                    setSavingFixed(true);
                    try {
                      const normalized = normalizeFixedSlots(fixedSlotsDraft);
                      await repo.updateClientFixedSlots(uid, client.id, normalized);
                      let appliedCount = 0;
                      if (activeWeek && normalized.length > 0 && client.active) {
                        const res = await repo.applyFixedSchedulesForWeek(
                          uid,
                          activeWeek,
                          [{ ...client, fixedSlots: normalized }],
                          sessions,
                          allBookings,
                          weekResponses,
                          client.id
                        );
                        appliedCount = res.createdBookings;
                      }
                      onBanner(
                        appliedCount > 0
                          ? `Dias fixos guardados! ${appliedCount} marcação(ões) enviada(s) para Por confirmar.`
                          : 'Dias fixos guardados!'
                      );
                    } finally {
                      setSavingFixed(false);
                    }
                  }}
                >
                  <Check className="h-4 w-4" />
                  {savingFixed ? 'A guardar...' : 'Guardar Dias Fixos'}
                </GoldButton>
                {fixedSlotsDraft.length > 0 && (
                  <SecondaryButton
                    disabled={savingFixed}
                    onClick={() => setFixedSlotsDraft([])}
                  >
                    Limpar lista
                  </SecondaryButton>
                )}
              </div>
            </div>
          )}
        </BrandCard>
      )}

      <BrandCard>
        <h3 className="text-base font-bold text-[#FACC15]">Dados do Perfil & Plano</h3>
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel>Nome completo</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Tipo de Treino</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'PERSONALIZADO' as const, label: 'Treino Personalizado' },
                  { id: 'GRUPO' as const, label: 'Treino em Grupo' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrainingType(opt.id)}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    trainingType === opt.id
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Limite Semanal de Treinos (Pacote)</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  onClick={() => setWeeklySessionLimit(lim)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    weeklySessionLimit === lim
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {lim === 0 ? 'Sem limite' : `${lim}x/sem`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Data de Nascimento (opcional)
                {getCurrentAge(birthDate) !== null ? ` · ${getCurrentAge(birthDate)} anos` : ''}
              </FieldLabel>
              <Input
                type="date"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                min="1925-01-01"
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Meta Semanal de Treinos (Sequência)</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setWeeklyGoalSessions(goal)}
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                      weeklyGoalSessions === goal
                        ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                        : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {goal === 0 ? 'Auto' : `${goal}x`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={`grid grid-cols-1 ${isSuperAdmin ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div>
              <FieldLabel>Telemóvel WhatsApp (opcional)</FieldLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Sem telemóvel"
              />
            </div>
            {isSuperAdmin && (
              <div>
                <FieldLabel>Valor Mensalidade (€)</FieldLabel>
                <Input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  placeholder="120"
                />
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Fidelização (se aplicável)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[
                { m: 0, label: 'Sem fidel.' },
                { m: 6, label: '6 Meses' },
                { m: 12, label: '12 Meses' },
              ].map((opt) => (
                <button
                  key={opt.m}
                  type="button"
                  onClick={() => {
                    setFidMonths(opt.m);
                    if (opt.m > 0 && fidStart <= 0) setFidStart(Date.now());
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    fidMonths === opt.m
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fidMonths > 0 && (
              <p className="mt-1.5 text-xs text-[#FACC15]">
                Início: {formatShortDate(fidStart)} → Fim: {formatShortDate(endMillis)}
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Notas / Lesões / Objetivos</FieldLabel>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <GoldButton
            fullWidth
            onClick={async () => {
              await repo.updateClient(uid, {
                ...client,
                name,
                phone,
                notes,
                monthlyFeeEur: Math.max(0, Number(monthlyFee) || 0),
                fidelizacaoMonths: fidMonths,
                fidelizacaoStartMillis: fidMonths > 0 ? fidStart : 0,
                trainingType,
                weeklySessionLimit,
                birthDate,
                weeklyGoalSessions,
              });
              onBanner('Perfil do aluno guardado!');
            }}
          >
            Guardar alterações
          </GoldButton>
        </div>
      </BrandCard>

      {isSuperAdmin && (
      <BrandCard highlight={!monthPayment}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#F4F4F5]">
              Mensalidade ({currentMonthLabel})
            </h3>
            <p className={`text-xs ${monthPayment ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
              {monthPayment
                ? `Pago €${monthPayment.amountEur.toFixed(2)} em ${formatShortDate(
                    monthPayment.paidAtMillis
                  )}`
                : 'Sem registo de pagamento este mês'}
            </p>
          </div>
          <StatusPill tone={monthPayment ? 'green' : 'amber'}>
            {monthPayment ? 'Pago ✓' : 'Pendente'}
          </StatusPill>
        </div>

        <div className="mt-3">
          <GoldButton fullWidth onClick={() => setShowPay(true)}>
            <CreditCard className="h-4 w-4" />
            Registar Pagamento de Mensalidade
          </GoldButton>
        </div>

        {payments.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-[#323238] pt-3">
            <FieldLabel>Histórico de pagamentos</FieldLabel>
            {payments.map((p) => {
              const isFuture = Boolean(currentMonthYear && p.monthYear > currentMonthYear);
              const isAlreadyFid = p.note.toLowerCase().includes('fideliza');
              const category = getPaymentCategory(p.note);
              const isExtra = category !== 'MENSALIDADE';
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#242429] px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-[#F4F4F5]">
                        {p.monthLabel} · €{p.amountEur.toFixed(2)}
                      </p>
                      {category === 'SEGURO' && <StatusPill tone="blue">Seguro</StatusPill>}
                      {category === 'JOIA' && <StatusPill tone="amber">Jóia</StatusPill>}
                      {isFuture && <StatusPill tone="amber">Futuro</StatusPill>}
                    </div>
                    <p className="text-[#A1A1AA]">
                      {formatShortDate(p.paidAtMillis)}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isAlreadyFid && !isExtra && p.amountEur > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitTargetPayment(p)}
                        className="rounded-lg border border-[#EAB308]/50 bg-[#3D3314]/60 px-2 py-1 text-[11px] font-bold text-[#FACC15] hover:bg-[#3D3314]"
                      >
                        Dividir 6/12m
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => repo.deletePayment(uid, p.id)}
                      className="text-[#EF4444] hover:opacity-80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BrandCard>
      )}

      {fidelizacoes.length > 0 && (
        <BrandCard>
          <h3 className="text-base font-bold text-[#F4F4F5]">Contratos de Fidelização</h3>
          <div className="mt-2 space-y-2">
            {fidelizacoes.map((f) => {
              const daysLeft = Math.floor((f.endDateMillis - Date.now()) / 86_400_000);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl bg-[#242429] p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#FACC15]">{f.durationMonths} Meses</p>
                    <p className="text-[#A1A1AA]">
                      {formatShortDate(f.startDateMillis)} → {formatShortDate(f.endDateMillis)}
                    </p>
                  </div>
                  <StatusPill tone={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'amber' : 'green'}>
                    {daysLeft < 0 ? 'Expirada' : `${daysLeft} dias rest.`}
                  </StatusPill>
                </div>
              );
            })}
          </div>
        </BrandCard>
      )}

      {isSuperAdmin && (
        <div className="rounded-2xl border border-[#EF4444]/40 bg-[#3B1518]/35 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#FCA5A5]">
                Zona de Administrador · Eliminar Conta
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Remove permanentemente a conta de {client.name} e todos os seus dados (marcações,
                planos de treino, nutrição, avaliações, pagamentos, fidelizações e chat).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EF4444] bg-[#EF4444]/15 px-3.5 py-2 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar conta
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {isSuperAdmin && showDeleteConfirm && (
        <DeleteClientConfirmModal
          client={client}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            const name = client.name;
            await repo.deleteClientAccount(uid, client.id);
            setShowDeleteConfirm(false);
            onBack();
            onBanner(`Conta de ${name} eliminada permanentemente.`);
          }}
        />
      )}

      {isSuperAdmin && showPay && (
        <RegisterPaymentModal
          clientName={client.name}
          defaultAmount={client.monthlyFeeEur > 0 ? client.monthlyFeeEur : 120}
          defaultDurationMonths={getEffectiveClientFidelizacaoMonths(client, fidelizacoes)}
          onClose={() => setShowPay(false)}
          onConfirm={async (my, ml, amt, method, durationMonths, extras) => {
            await repo.recordPayment(uid, client.id, my, ml, amt, method, durationMonths, extras);
            setShowPay(false);
            const extraParts: string[] = [];
            if (extras.seguroEur > 0) extraParts.push(`Seguro €${extras.seguroEur.toFixed(2)}`);
            if (extras.joiaEur > 0) extraParts.push(`Jóia €${extras.joiaEur.toFixed(2)}`);
            const extraSuffix = extraParts.length > 0 ? ` + ${extraParts.join(' + ')}` : '';
            onBanner(
              durationMonths > 1 && amt > 0
                ? `Pagamento de ${durationMonths} meses (€${(
                    amt / durationMonths
                  ).toFixed(2)}/mês)${extraSuffix} registado e adicionado às Fidelizações!`
                : `Pagamento registado${extraSuffix ? ` (${extraParts.join(' + ')})` : ''}!`
            );
          }}
        />
      )}

      {isSuperAdmin && splitTargetPayment && (
        <SplitPaymentFidelizacaoModal
          clientName={client.name}
          payment={splitTargetPayment}
          defaultMonths={getEffectiveClientFidelizacaoMonths(client, fidelizacoes) === 12 ? 12 : 6}
          onClose={() => setSplitTargetPayment(null)}
          onConfirm={async (months) => {
            await repo.splitPaymentIntoFidelizacao(uid, splitTargetPayment, months);
            setSplitTargetPayment(null);
            onBanner(
              `Pagamento dividido por ${months} meses (€${(
                splitTargetPayment.amountEur / months
              ).toFixed(2)}/mês) e adicionado às Fidelizações!`
            );
          }}
        />
      )}
    </div>
  );
};

const DeleteClientConfirmModal: React.FC<{
  client: ClientRecord;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ client, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open
      title="Eliminar conta do aluno?"
      subtitle="Esta ação é permanente e não pode ser anulada."
      onClose={() => {
        if (!deleting) onClose();
      }}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#EF4444]/40 bg-[#3B1518]/50 p-3.5 text-xs space-y-1.5">
          <p className="font-bold text-[#FCA5A5]">
            {client.name}
            {client.phone ? ` · ${formatPhoneDisplay(client.phone)}` : ''}
          </p>
          <p className="text-[#D4D4D8] leading-relaxed">
            Serão eliminados permanentemente o perfil do aluno, marcações, planos de treino,
            registos de cargas, nutrição, avaliações físicas, pagamentos, fidelizações e mensagens
            de chat.
          </p>
        </div>

        {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton disabled={deleting} onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              setError(null);
              try {
                await onConfirm();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Não foi possível eliminar a conta. Tenta novamente.'
                );
                setDeleting(false);
              }
            }}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'A eliminar...' : 'Eliminar permanentemente'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const NewClientModal: React.FC<{
  onClose: () => void;
  onSave: (
    name: string,
    phone: string,
    notes: string,
    trainingType: TrainingType,
    weeklySessionLimit: number,
    birthDate: string,
    weeklyGoalSessions: number
  ) => Promise<void>;
}> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType>('GRUPO');
  const [weeklySessionLimit, setWeeklySessionLimit] = useState<number>(0);
  const [birthDate, setBirthDate] = useState('');
  const [weeklyGoalSessions, setWeeklyGoalSessions] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);

  return (
    <Modal open title="Novo Cliente" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Nome completo</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marta Dias" />
        </div>
        <div>
          <FieldLabel>Telemóvel (opcional · 9 dígitos)</FieldLabel>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Opcional — podes deixar vazio"
          />
          <p className="mt-1 text-[11px] text-[#A1A1AA]">
            Podes adicionar o cliente apenas com o nome e preencher o telemóvel mais tarde.
          </p>
        </div>
        <div>
          <FieldLabel>Tipo de Treino</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'PERSONALIZADO' as const, label: 'Treino Personalizado' },
                { id: 'GRUPO' as const, label: 'Treino em Grupo' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTrainingType(opt.id)}
                className={`rounded-xl border py-2 text-xs font-bold transition ${
                  trainingType === opt.id
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Limite Semanal de Treinos (Pacote)</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((lim) => (
              <button
                key={lim}
                type="button"
                onClick={() => setWeeklySessionLimit(lim)}
                className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                  weeklySessionLimit === lim
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {lim === 0 ? 'Sem limite' : `${lim}x/sem`}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Data de Nascimento (opcional)</FieldLabel>
            <Input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              min="1925-01-01"
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Meta Semanal (Streak)</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setWeeklyGoalSessions(goal)}
                  className={`rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
                    weeklyGoalSessions === goal
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {goal === 0 ? 'Auto' : `${goal}x`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <FieldLabel>Notas (opcional)</FieldLabel>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429]/80 p-3 text-xs">
          <input
            type="checkbox"
            checked={rgpdAccepted}
            onChange={(e) => setRgpdAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#EAB308]"
          />
          <span className="text-[#A1A1AA]">
            <strong className="text-[#F4F4F5]">Consentimento RGPD obtido</strong> — o aluno
            autorizou o tratamento dos dados pessoais.
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!name.trim()}
            onClick={() => {
              const rgpdStamp = rgpdAccepted ? formatRgpdConsentStamp() : '';
              const combinedNotes = [notes.trim(), rgpdStamp].filter(Boolean).join(' · ');
              return onSave(
                name,
                phone,
                combinedNotes,
                trainingType,
                weeklySessionLimit,
                birthDate,
                weeklyGoalSessions
              );
            }}
          >
            Adicionar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const ImportClientsModal: React.FC<{
  onClose: () => void;
  onImport: (raw: string) => Promise<{ added: number; ignored: number; errors: string[] }>;
}> = ({ onClose, onImport }) => {
  const [rawText, setRawText] = useState('Marta Dias;914 000 001\nPedro Luz;+351 914 000 002');
  const [result, setResult] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawText(text);
  };

  return (
    <Modal open title="Importar lista ou CSV" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Cola uma pessoa por linha com nome e telemóvel opcional separados por ponto e vírgula (
          <code className="text-[#FACC15]">Ana Ribeiro;912 345 678</code> ou apenas{' '}
          <code className="text-[#FACC15]">Marta Dias</code>) ou escolhe um ficheiro CSV.
        </p>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="block w-full text-xs text-[#A1A1AA] file:mr-3 file:rounded-lg file:border-0 file:bg-[#242429] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#FACC15]"
        />
        <Textarea rows={5} value={rawText} onChange={(e) => setRawText(e.target.value)} />
        {result && <p className="text-xs font-semibold text-[#FACC15]">{result}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
          <GoldButton
            onClick={async () => {
              const res = await onImport(rawText);
              setResult(
                `Adicionados: ${res.added} · Ignorados: ${res.ignored} · Erros: ${res.errors.length}`
              );
            }}
          >
            Importar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

export const RegisterPaymentModal: React.FC<{
  clientName: string;
  defaultAmount: number;
  defaultDurationMonths?: number;
  onClose: () => void;
  onConfirm: (
    monthYear: string,
    monthLabel: string,
    amount: number,
    method: PaymentMethod,
    durationMonths: 1 | 6 | 12,
    extras: { seguroEur: number; joiaEur: number }
  ) => Promise<void>;
}> = ({ clientName, defaultAmount, defaultDurationMonths = 1, onClose, onConfirm }) => {
  const initialDuration: 1 | 6 | 12 =
    defaultDurationMonths === 6 || defaultDurationMonths === 12 ? defaultDurationMonths : 1;
  const monthOptions = useMemo(() => buildRecentMonthOptions(), []);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [durationMonths, setDurationMonths] = useState<1 | 6 | 12>(initialDuration);
  const [amount, setAmount] = useState(String(defaultAmount * initialDuration));
  const [method, setMethod] = useState<PaymentMethod>('MbWay');
  const [includeSeguro, setIncludeSeguro] = useState(false);
  const [seguroAmount, setSeguroAmount] = useState('');
  const [includeJoia, setIncludeJoia] = useState(false);
  const [joiaAmount, setJoiaAmount] = useState(String(DEFAULT_JOIA_EUR));

  const numericAmount = Math.max(0, Number(amount) || 0);
  const numericSeguro = includeSeguro ? Math.max(0, Number(seguroAmount) || 0) : 0;
  const numericJoia = includeJoia ? Math.max(0, Number(joiaAmount) || 0) : 0;
  const grandTotal = numericAmount + numericSeguro + numericJoia;
  const perMonthValue = numericAmount / durationMonths;
  const coveredMonths = useMemo(
    () => buildConsecutiveMonths(monthOptions[selectedIdx].monthYear, durationMonths),
    [monthOptions, selectedIdx, durationMonths]
  );

  const handleDurationChange = (nextDuration: 1 | 6 | 12) => {
    const prevAuto = defaultAmount * durationMonths;
    if (Math.abs(numericAmount - prevAuto) < 0.01) {
      setAmount(String(defaultAmount * nextDuration));
    }
    setDurationMonths(nextDuration);
  };

  return (
    <Modal open title="Registar Mensalidade" subtitle={`Aluno: ${clientName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>{durationMonths > 1 ? 'Mês inicial da fidelização' : 'Mês'}</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {monthOptions.slice(0, 4).map((m, idx) => (
              <button
                key={m.monthYear}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  selectedIdx === idx
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {m.monthLabel}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Período / Fidelização paga</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {([
              { m: 1 as const, label: '1 Mês' },
              { m: 6 as const, label: '6 Meses' },
              { m: 12 as const, label: '12 Meses' },
            ]).map((opt) => (
              <button
                key={opt.m}
                type="button"
                onClick={() => handleDurationChange(opt.m)}
                className={`rounded-xl border py-2 text-xs font-bold transition ${
                  durationMonths === opt.m
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>
            {durationMonths > 1
              ? `Valor total da mensalidade (${durationMonths} meses) (€)`
              : 'Valor da mensalidade (€)'}
          </FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {durationMonths > 1 && (
            <div className="mt-2 rounded-xl border border-[#EAB308]/40 bg-[#3D3314]/60 p-2.5 text-xs text-[#FACC15]">
              <p className="font-bold">
                €{numericAmount.toFixed(2)} ÷ {durationMonths} meses = €
                {perMonthValue.toFixed(2)}/mês
              </p>
              <p className="mt-0.5 text-[11px] text-[#F4F4F5]/85">
                Conta 1 mensalidade/mês ({coveredMonths[0]?.monthLabel} →{' '}
                {coveredMonths[coveredMonths.length - 1]?.monthLabel}) e adiciona automaticamente o
                contrato à subaba <strong>Fidelizações</strong> (datas editáveis pelo admin).
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-[#323238] bg-[#242429]/80 p-3">
          <div>
            <FieldLabel>Taxas adicionais (opcional)</FieldLabel>
            <p className="-mt-1 text-[11px] text-[#A1A1AA]">
              Incluídos na faturação total, mas excluídos da média de mensalidades.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2.5">
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs font-semibold text-[#F4F4F5]">
              <input
                type="checkbox"
                checked={includeSeguro}
                onChange={(e) => setIncludeSeguro(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[#EAB308]"
              />
              <span>Seguro</span>
            </label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                disabled={!includeSeguro}
                value={seguroAmount}
                onChange={(e) => setSeguroAmount(e.target.value)}
                placeholder="Valor €"
                className="pr-6 text-right disabled:opacity-40"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#A1A1AA]">
                €
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5">
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs font-semibold text-[#F4F4F5]">
              <input
                type="checkbox"
                checked={includeJoia}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncludeJoia(checked);
                  if (checked && !joiaAmount) setJoiaAmount(String(DEFAULT_JOIA_EUR));
                }}
                className="h-4 w-4 shrink-0 accent-[#EAB308]"
              />
              <span>Jóia de Inscrição ({DEFAULT_JOIA_EUR}€)</span>
            </label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                disabled={!includeJoia}
                value={joiaAmount}
                onChange={(e) => setJoiaAmount(e.target.value)}
                placeholder={String(DEFAULT_JOIA_EUR)}
                className="pr-6 text-right disabled:opacity-40"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#A1A1AA]">
                €
              </span>
            </div>
          </div>

          {(numericSeguro > 0 || numericJoia > 0) && (
            <div className="flex items-center justify-between border-t border-[#323238] pt-2 text-xs">
              <span className="text-[#A1A1AA]">Total a faturar</span>
              <span className="font-extrabold text-[#FACC15]">€{grandTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Método de pagamento</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMethod(opt)}
                className={`rounded-xl border py-2 text-xs font-bold transition ${
                  method === opt
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={grandTotal <= 0}
            onClick={() =>
              onConfirm(
                monthOptions[selectedIdx].monthYear,
                monthOptions[selectedIdx].monthLabel,
                numericAmount,
                method,
                durationMonths,
                { seguroEur: numericSeguro, joiaEur: numericJoia }
              )
            }
          >
            Marcar como Pago
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

export const SplitPaymentFidelizacaoModal: React.FC<{
  clientName: string;
  payment: PaymentRecord;
  defaultMonths?: 6 | 12;
  onClose: () => void;
  onConfirm: (months: 6 | 12) => Promise<void>;
}> = ({ clientName, payment, defaultMonths = 6, onClose, onConfirm }) => {
  const [months, setMonths] = useState<6 | 12>(defaultMonths);
  const [busy, setBusy] = useState(false);

  const splitValues = useMemo(
    () => splitAmountAcrossMonths(payment.amountEur, months),
    [payment.amountEur, months]
  );
  const coveredMonths = useMemo(
    () => buildConsecutiveMonths(payment.monthYear, months),
    [payment.monthYear, months]
  );
  const perMonth = splitValues[0] ?? 0;

  return (
    <Modal
      open
      title="Dividir Pagamento por Fidelização"
      subtitle={`${clientName} · €${payment.amountEur.toFixed(2)} (${payment.monthLabel})`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Divide este valor pelos meses da fidelização para que cada mês contabilize apenas{' '}
          <strong className="text-[#F4F4F5]">1 mensalidade</strong> (em vez do valor total num único
          mês).
        </p>

        <div>
          <FieldLabel>Duração da fidelização</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {([6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`rounded-xl border py-2 text-xs font-bold transition ${
                  months === m
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {m} Meses
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#EAB308]/40 bg-[#3D3314]/60 p-3 text-xs text-[#FACC15]">
          <p className="font-bold">
            €{payment.amountEur.toFixed(2)} ÷ {months} meses = €{perMonth.toFixed(2)}/mês
          </p>
          <p className="mt-1 text-[11px] text-[#F4F4F5]/85">
            Período: {coveredMonths[0]?.monthLabel} →{' '}
            {coveredMonths[coveredMonths.length - 1]?.monthLabel} · Conta 1 mensalidade/mês.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(months);
              } finally {
                setBusy(false);
              }
            }}
          >
            Dividir por {months} meses
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

