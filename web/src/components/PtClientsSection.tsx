import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CreditCard,
  Dumbbell,
  FileText,
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
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { openStudentEvolutionPdfReport } from '../services/evolutionReportGenerator';
import {
  PAYMENT_METHODS,
  PaymentMethod,
  buildConsecutiveMonths,
  buildRecentMonthOptions,
  formatPhoneDisplay,
  formatRgpdConsentStamp,
  formatShortDate,
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

interface PtClientsSectionProps {
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
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
  sessions,
  bookings,
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
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [payTarget, setPayTarget] = useState<ClientRecord | null>(null);

  const recentMonths = useMemo(() => buildRecentMonthOptions(), []);
  const currentMonthYear = recentMonths[0].monthYear;
  const currentMonthLabel = recentMonths[0].monthLabel;

  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null;

  if (selectedClient) {
    return (
      <ClientProfileView
        uid={uid}
        isSuperAdmin={isSuperAdmin}
        client={selectedClient}
        sessions={sessions}
        bookings={bookings.filter((b) => b.clientId === selectedClient.id)}
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
  const persCount = activeClientsList.filter((c) => c.trainingType === 'PERSONALIZADO').length;
  const grupoCount = activeClientsList.filter((c) => c.trainingType !== 'PERSONALIZADO').length;

  const filtered = clients.filter((c) => {
    if (!showInactive && !c.active) return false;
    if (typeFilter === 'PERSONALIZADO' && c.trainingType !== 'PERSONALIZADO') return false;
    if (typeFilter === 'GRUPO' && c.trainingType === 'PERSONALIZADO') return false;
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

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'ALL' as const, label: `Todos (${showInactive ? clients.length : activeClientsList.length})` },
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum aluno encontrado"
          subtitle="Adiciona um novo cliente ou importa uma lista CSV."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const monthPay = payments.find(
              (p) => p.clientId === c.id && p.monthYear === currentMonthYear && p.paid
            );
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
                      {c.newClient && <StatusPill tone="blue">Novo</StatusPill>}
                      {!c.active && <StatusPill>Inativo</StatusPill>}
                    </div>
                    <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(c.phone)}</p>
                    {((isSuperAdmin && c.monthlyFeeEur > 0) || c.fidelizacaoMonths > 0) && (
                      <p className="mt-1 text-xs font-semibold text-[#EAB308]">
                        {[
                          isSuperAdmin && c.monthlyFeeEur > 0 ? `€${c.monthlyFeeEur.toFixed(0)}/mês` : '',
                          c.fidelizacaoMonths > 0 ? `Fidelização ${c.fidelizacaoMonths}m` : '',
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
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    className="text-xs font-semibold text-[#A1A1AA] hover:text-white"
                  >
                    Ver perfil →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewClientModal
          onClose={() => setShowNewModal(false)}
          onSave={async (name, phone, notes, trainingType, weeklySessionLimit) => {
            await repo.addClient(uid, { name, phone, notes, trainingType, weeklySessionLimit });
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
          defaultDurationMonths={payTarget.fidelizacaoMonths}
          onClose={() => setPayTarget(null)}
          onConfirm={async (my, ml, amount, method, durationMonths) => {
            await repo.recordPayment(
              uid,
              payTarget.id,
              my,
              ml,
              amount,
              method,
              durationMonths
            );
            setPayTarget(null);
            onBanner(
              durationMonths > 1
                ? `Pagamento de ${durationMonths} meses registado (€${(
                    amount / durationMonths
                  ).toFixed(2)}/mês)!`
                : 'Mensalidade registada!'
            );
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
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
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
  sessions,
  bookings,
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
  const [monthlyFee, setMonthlyFee] = useState(
    client.monthlyFeeEur > 0 ? String(client.monthlyFeeEur) : ''
  );
  const [fidMonths, setFidMonths] = useState(client.fidelizacaoMonths);
  const [fidStart, setFidStart] = useState(
    client.fidelizacaoStartMillis > 0 ? client.fidelizacaoStartMillis : Date.now()
  );
  const [showPay, setShowPay] = useState(false);

  const monthPayment = payments.find((p) => p.monthYear === currentMonthYear && p.paid);

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
            </div>
            <p className={`text-xs ${client.active ? 'text-[#22C55E]' : 'text-[#A1A1AA]'}`}>
              {client.active ? 'Aluno ativo' : 'Aluno inativo'}
            </p>
          </div>
        </div>
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
          <div className={`grid grid-cols-1 ${isSuperAdmin ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div>
              <FieldLabel>Telemóvel WhatsApp</FieldLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-[#242429] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-bold text-[#F4F4F5]">
                    {p.monthLabel} · €{p.amountEur.toFixed(2)}
                  </p>
                  <p className="text-[#A1A1AA]">
                    {formatShortDate(p.paidAtMillis)}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => repo.deletePayment(uid, p.id)}
                  className="text-[#EF4444] hover:opacity-80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
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
        </>
      )}

      {isSuperAdmin && showPay && (
        <RegisterPaymentModal
          clientName={client.name}
          defaultAmount={client.monthlyFeeEur > 0 ? client.monthlyFeeEur : 120}
          defaultDurationMonths={client.fidelizacaoMonths}
          onClose={() => setShowPay(false)}
          onConfirm={async (my, ml, amt, method, durationMonths) => {
            await repo.recordPayment(uid, client.id, my, ml, amt, method, durationMonths);
            setShowPay(false);
            onBanner(
              durationMonths > 1
                ? `Pagamento de ${durationMonths} meses registado (€${(
                    amt / durationMonths
                  ).toFixed(2)}/mês)!`
                : 'Pagamento registado!'
            );
          }}
        />
      )}
    </div>
  );
};

const NewClientModal: React.FC<{
  onClose: () => void;
  onSave: (
    name: string,
    phone: string,
    notes: string,
    trainingType: TrainingType,
    weeklySessionLimit: number
  ) => Promise<void>;
}> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType>('GRUPO');
  const [weeklySessionLimit, setWeeklySessionLimit] = useState<number>(0);
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
          <FieldLabel>Telemóvel (9 dígitos)</FieldLabel>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="914 000 001"
          />
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
              return onSave(name, phone, combinedNotes, trainingType, weeklySessionLimit);
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
          Cola uma pessoa por linha com nome e telemóvel separados por ponto e vírgula (
          <code className="text-[#FACC15]">Ana Ribeiro;912 345 678</code>) ou escolhe um ficheiro
          CSV.
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
    durationMonths: 1 | 6 | 12
  ) => Promise<void>;
}> = ({ clientName, defaultAmount, defaultDurationMonths = 1, onClose, onConfirm }) => {
  const initialDuration: 1 | 6 | 12 =
    defaultDurationMonths === 6 || defaultDurationMonths === 12 ? defaultDurationMonths : 1;
  const monthOptions = useMemo(() => buildRecentMonthOptions(), []);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [durationMonths, setDurationMonths] = useState<1 | 6 | 12>(initialDuration);
  const [amount, setAmount] = useState(String(defaultAmount * initialDuration));
  const [method, setMethod] = useState<PaymentMethod>('MbWay');

  const numericAmount = Math.max(0, Number(amount) || 0);
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
              ? `Valor total pago (${durationMonths} meses) (€)`
              : 'Valor (€)'}
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
              <p className="mt-0.5 text-[11px] text-[#F4F4F5]/80">
                Conta 1 mensalidade por mês em todo o período ({coveredMonths[0]?.monthLabel} →{' '}
                {coveredMonths[coveredMonths.length - 1]?.monthLabel}).
              </p>
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
            onClick={() =>
              onConfirm(
                monthOptions[selectedIdx].monthYear,
                monthOptions[selectedIdx].monthLabel,
                numericAmount,
                method,
                durationMonths
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
