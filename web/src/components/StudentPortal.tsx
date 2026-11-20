import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  LogOut,
  MessageCircle,
  Plus,
  Scale,
  UserCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import {
  BookingRecord,
  ChatMessageRecord,
  ClientRecord,
  FidelizacaoRecord,
  FoodItemRecord,
  MealTypeKey,
  NutritionEntryRecord,
  PaymentRecord,
  PhysicalAssessmentRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WeekResponseRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import {
  buildRecentMonthOptions,
  formatShortDate,
  MEAL_TYPES,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import { NewShapeLogo } from './NewShapeLogo';
import {
  BrandCard,
  EmptyState,
  GoldButton,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';
import { AddFoodToMealModal, DailyMacrosSummaryCard } from './PtNutritionSection';
import { AssessmentDashboard, NewAssessmentModal } from './PtAssessmentSection';
import { PrivateChatPanel } from './PtManagementSection';

interface StudentPortalProps {
  uid: string;
  client: ClientRecord;
  weeks: TrainingWeekRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  foodItems: FoodItemRecord[];
  nutritionEntries: NutritionEntryRecord[];
  assessments: PhysicalAssessmentRecord[];
  chatMessages: ChatMessageRecord[];
  settings: StudioSettingsRecord;
  initialWeekSlug?: string;
  onSwitchStudent: () => void;
  onSwitchToPt?: () => void;
  onSignOut: () => void;
  onBanner: (msg: string) => void;
}

type StudentTab = 'agenda' | 'treino' | 'nutricao' | 'avaliacao' | 'mensalidade' | 'chat';

export const StudentPortal: React.FC<StudentPortalProps> = ({
  uid,
  client,
  weeks,
  sessions,
  bookings,
  weekResponses,
  payments,
  fidelizacoes,
  workoutPlans,
  workoutPlanItems,
  foodItems,
  nutritionEntries,
  assessments,
  chatMessages,
  settings,
  initialWeekSlug,
  onSwitchStudent,
  onSwitchToPt,
  onSignOut,
  onBanner,
}) => {
  const [tab, setTab] = useState<StudentTab>('agenda');
  const [addMealTarget, setAddMealTarget] = useState<{
    key: MealTypeKey;
    label: string;
  } | null>(null);
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const firstName = client.name.trim().split(/\s+/)[0] || client.name;

  const publishedWeeks = useMemo(
    () => weeks.filter((w) => w.published),
    [weeks]
  );

  const [selectedWeekKey, setSelectedWeekKey] = useState(() => {
    if (initialWeekSlug) {
      const match = publishedWeeks.find(
        (w) => w.weekKey.toLowerCase() === initialWeekSlug.toLowerCase()
      );
      if (match) return match.weekKey;
    }
    return publishedWeeks[0]?.weekKey || '';
  });

  useEffect(() => {
    if (!selectedWeekKey && publishedWeeks.length > 0) {
      const match = initialWeekSlug
        ? publishedWeeks.find(
            (w) => w.weekKey.toLowerCase() === initialWeekSlug.toLowerCase()
          )
        : undefined;
      setSelectedWeekKey(match?.weekKey || publishedWeeks[0].weekKey);
    }
  }, [publishedWeeks, selectedWeekKey, initialWeekSlug]);

  const activeWeekIdx = Math.max(
    0,
    publishedWeeks.findIndex((w) => w.weekKey === selectedWeekKey)
  );
  const activeWeek = publishedWeeks[activeWeekIdx] || publishedWeeks[0] || null;

  const clientWeekBookings = useMemo(
    () =>
      activeWeek
        ? bookings.filter(
            (b) =>
              b.weekKey === activeWeek.weekKey &&
              b.clientId === client.id &&
              b.status !== 'CANCELLED'
          )
        : [],
    [bookings, activeWeek, client.id]
  );

  const [draftSessionIds, setDraftSessionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDraftSessionIds(new Set(clientWeekBookings.map((b) => b.sessionId)));
  }, [activeWeek?.weekKey, client.id, bookings]);

  const weekResponse = activeWeek
    ? weekResponses.find(
        (r) => r.weekKey === activeWeek.weekKey && r.clientId === client.id
      )
    : undefined;

  const clientPlans = useMemo(
    () => workoutPlans.filter((p) => p.clientId === client.id),
    [workoutPlans, client.id]
  );

  const clientNutrition = useMemo(
    () => nutritionEntries.filter((e) => e.clientId === client.id),
    [nutritionEntries, client.id]
  );

  const clientAssessments = useMemo(
    () =>
      assessments
        .filter((a) => a.clientId === client.id)
        .sort((a, b) => a.dateMillis - b.dateMillis),
    [assessments, client.id]
  );

  const clientPayments = useMemo(
    () => payments.filter((p) => p.clientId === client.id),
    [payments, client.id]
  );

  const clientFidelizacoes = useMemo(
    () => fidelizacoes.filter((f) => f.clientId === client.id),
    [fidelizacoes, client.id]
  );

  const clientMessages = useMemo(
    () => chatMessages.filter((m) => m.clientId === client.id),
    [chatMessages, client.id]
  );

  const navItems: {
    id: StudentTab;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'agenda',
      label: 'Agenda',
      mobileLabel: 'Agenda',
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      id: 'treino',
      label: 'Treino',
      mobileLabel: 'Treino',
      icon: <Dumbbell className="h-4 w-4" />,
    },
    {
      id: 'nutricao',
      label: 'Nutrição',
      mobileLabel: 'Nutrição',
      icon: <Utensils className="h-4 w-4" />,
    },
    {
      id: 'avaliacao',
      label: 'Avaliação',
      mobileLabel: 'Avaliação',
      icon: <Scale className="h-4 w-4" />,
    },
    {
      id: 'mensalidade',
      label: 'Mensalidade',
      mobileLabel: 'Mensal.',
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: 'chat',
      label: 'Chat',
      mobileLabel: 'Chat',
      icon: <MessageCircle className="h-4 w-4" />,
      badge: clientMessages.length > 0 ? clientMessages.length : undefined,
    },
  ];

  const currentMonth = useMemo(() => buildRecentMonthOptions()[0], []);
  const monthPaid = clientPayments.find(
    (p) => p.monthYear === currentMonth.monthYear && p.paid
  );

  return (
    <div className="min-h-screen bg-[#121214] text-[#F4F4F5] pb-20 lg:pb-0 lg:flex">
      {/* Desktop Sidebar — Idêntica ao Painel PT */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#323238] bg-[#18181B] p-4">
        <div className="mb-6">
          <NewShapeLogo compact />
          <p className="mt-2 truncate text-xs font-semibold text-[#FACC15]">
            Olá, {firstName}!
          </p>
          <p className="truncate text-[11px] text-[#A1A1AA]">{client.name}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                tab === item.id
                  ? 'bg-[#EAB308] text-[#121214]'
                  : 'text-[#A1A1AA] hover:bg-[#242429] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    tab === item.id
                      ? 'bg-[#121214] text-[#FACC15]'
                      : 'bg-[#EAB308] text-[#121214]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-4 space-y-2 border-t border-[#323238] pt-4">
          <button
            type="button"
            onClick={onSwitchStudent}
            className="flex w-full items-center gap-2 rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs font-bold text-[#F4F4F5] hover:border-[#EAB308]"
          >
            <Users className="h-4 w-4 text-[#EAB308]" />
            Mudar de aluno
          </button>
          {onSwitchToPt && (
            <button
              type="button"
              onClick={onSwitchToPt}
              className="flex w-full items-center gap-2 rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs font-bold text-[#F4F4F5] hover:border-[#EAB308]"
            >
              <UserCheck className="h-4 w-4 text-[#EAB308]" />
              Vista PT
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Mobile Top Bar — Idêntica ao Painel PT */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#323238] bg-[#121214]/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <NewShapeLogo compact />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwitchStudent}
              className="rounded-xl border border-[#323238] bg-[#1B1B1E] px-2.5 py-1.5 text-xs font-bold text-[#F4F4F5]"
            >
              {firstName}
            </button>
            {onSwitchToPt && (
              <button
                type="button"
                onClick={onSwitchToPt}
                className="rounded-xl border border-[#323238] bg-[#1B1B1E] px-2.5 py-1.5 text-xs font-bold text-[#FACC15]"
              >
                Vista PT
              </button>
            )}
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sair"
              className="rounded-xl border border-[#323238] bg-[#1B1B1E] p-1.5 text-[#A1A1AA]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
          {tab === 'agenda' && (
            <div className="space-y-4">
              {publishedWeeks.length === 0 ? (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="Sem semanas publicadas"
                  subtitle="O teu Personal Trainer ainda não publicou os horários da próxima semana."
                />
              ) : (
                <>
                  <BrandCard>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={activeWeekIdx <= 0}
                        onClick={() => {
                          const prev = publishedWeeks[activeWeekIdx - 1];
                          if (prev) setSelectedWeekKey(prev.weekKey);
                        }}
                        aria-label="Semana anterior"
                        className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429] disabled:opacity-30"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-[#EAB308]">
                          Escolhe os teus treinos
                        </p>
                        <h2 className="text-lg font-bold text-[#F4F4F5]">
                          Semana {activeWeek?.label}
                        </h2>
                      </div>
                      <button
                        type="button"
                        disabled={activeWeekIdx >= publishedWeeks.length - 1}
                        onClick={() => {
                          const next = publishedWeeks[activeWeekIdx + 1];
                          if (next) setSelectedWeekKey(next.weekKey);
                        }}
                        aria-label="Semana seguinte"
                        className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429] disabled:opacity-30"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </BrandCard>

                  {weekResponse?.status === 'UNAVAILABLE' && (
                    <div className="rounded-2xl border border-[#F59E0B]/50 bg-[#3B2A10] p-4 text-sm text-[#FDE68A]">
                      Marcaste que <strong>não podes treinar</strong> esta semana. Se mudares de
                      ideia, seleciona os horários abaixo.
                    </div>
                  )}

                  {clientWeekBookings.length > 0 && (
                    <div
                      className={`rounded-2xl border p-4 text-sm ${
                        clientWeekBookings.some(
                          (b) => b.status === 'PENDING' || b.status === 'ALTERED'
                        )
                          ? 'border-[#EAB308] bg-[#3D3314] text-[#FACC15]'
                          : 'border-[#22C55E]/50 bg-[#143521] text-[#86EFAC]'
                      }`}
                    >
                      {clientWeekBookings.some(
                        (b) => b.status === 'PENDING' || b.status === 'ALTERED'
                      )
                        ? 'Pedido recebido! 🙌 O teu PT vai confirmar no WhatsApp em breve.'
                        : 'Treinos confirmados ✓ — Até já no estúdio!'}
                    </div>
                  )}

                  {activeWeek && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {sessions
                        .filter((s) => s.weekKey === activeWeek.weekKey)
                        .sort((a, b) => a.startMillis - b.startMillis)
                        .map((s) => {
                          // Apenas marcações confirmadas pelo PT preenchem vaga
                          const confirmedCount = bookings.filter(
                            (b) => b.sessionId === s.id && b.status === 'CONFIRMED'
                          ).length;
                          const isFull = confirmedCount >= s.capacity;
                          const isMine = draftSessionIds.has(s.id);
                          const existingForSession = clientWeekBookings.find(
                            (b) => b.sessionId === s.id
                          );
                          const alreadyBooked = Boolean(existingForSession);
                          const cutoffMs = settings.cutoffHours * 3_600_000;
                          const isCutoffLocked =
                            s.startMillis > 0 && Date.now() > s.startMillis - cutoffMs;
                          const editLocked = !settings.clientsCanEdit || isCutoffLocked;
                          const fullAndNotMine = isFull && !alreadyBooked;

                          const pillTone = existingForSession
                            ? existingForSession.status === 'CONFIRMED'
                              ? 'green'
                              : 'amber'
                            : isFull
                            ? 'red'
                            : isMine
                            ? 'gold'
                            : 'green';

                          const pillLabel = existingForSession
                            ? existingForSession.status === 'CONFIRMED'
                              ? 'Confirmado'
                              : 'Por confirmar'
                            : isFull
                            ? 'Esgotado'
                            : 'Disponível';

                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={editLocked || fullAndNotMine}
                              onClick={() => {
                                setDraftSessionIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  return next;
                                });
                              }}
                              className={`rounded-2xl border p-4 text-left transition ${
                                isMine
                                  ? 'border-[#EAB308] bg-[#3D3314]/70'
                                  : 'border-[#323238] bg-[#1B1B1E] hover:border-[#EAB308]/50'
                              } disabled:cursor-not-allowed disabled:opacity-55`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-[#EAB308]">
                                    {s.dateLabel}
                                  </p>
                                  <p className="mt-0.5 text-lg font-extrabold text-[#F4F4F5]">
                                    {s.timeLabel} · {s.durationMinutes} min
                                  </p>
                                  {s.note && (
                                    <p className="mt-0.5 text-xs text-[#A1A1AA]">{s.note}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <StatusPill tone={pillTone}>{pillLabel}</StatusPill>
                                  {isMine && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FACC15]">
                                      <Check className="h-3.5 w-3.5" />
                                      Selecionado
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isCutoffLocked && (
                                <p className="mt-2 text-[11px] text-[#F59E0B]">
                                  Prazo de alteração ({settings.cutoffHours}h antes) encerrado
                                </p>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}

                  {activeWeek && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <GoldButton
                        fullWidth
                        disabled={!settings.clientsCanEdit}
                        onClick={async () => {
                          await repo.submitStudentBookings(
                            uid,
                            activeWeek.weekKey,
                            client.id,
                            draftSessionIds,
                            clientWeekBookings
                          );
                          onBanner('Marcação enviada ao Personal Trainer!');
                        }}
                      >
                        <Check className="h-4 w-4" />
                        {clientWeekBookings.length > 0
                          ? `Guardar alterações (${draftSessionIds.size})`
                          : `Marcar treinos (${draftSessionIds.size})`}
                      </GoldButton>

                      <SecondaryButton
                        fullWidth
                        disabled={!settings.clientsCanEdit}
                        onClick={async () => {
                          await repo.markStudentUnavailable(
                            uid,
                            activeWeek.weekKey,
                            client.id,
                            clientWeekBookings
                          );
                          setDraftSessionIds(new Set());
                          onBanner('Registado: indisponível esta semana.');
                        }}
                      >
                        Esta semana não posso
                      </SecondaryButton>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'treino' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#F4F4F5]">Os Teus Planos de Treino</h2>
                <p className="text-xs text-[#A1A1AA]">
                  Prescritos pelo teu Personal Trainer
                </p>
              </div>
              {clientPlans.length === 0 ? (
                <EmptyState
                  icon={<Dumbbell className="h-6 w-6" />}
                  title="Sem plano de treino ainda"
                  subtitle="O teu Personal Trainer vai publicar o teu plano de treino aqui."
                />
              ) : (
                clientPlans.map((plan) => {
                  const items = workoutPlanItems
                    .filter((i) => i.planId === plan.id)
                    .sort((a, b) => a.orderIndex - b.orderIndex);
                  return (
                    <BrandCard key={plan.id} highlight>
                      <h3 className="text-base font-bold text-[#FACC15]">{plan.title}</h3>
                      {plan.splitLabel && (
                        <p className="text-xs text-[#A1A1AA]">{plan.splitLabel}</p>
                      )}
                      <div className="mt-3 space-y-2 border-t border-[#323238] pt-3">
                        {items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="rounded-xl bg-[#242429] p-3"
                          >
                            <p className="text-sm font-bold text-[#F4F4F5]">
                              {idx + 1}. {item.exerciseName}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-[#EAB308]">
                              {item.sets} séries × {item.reps}
                              {item.loadKg ? ` · ${item.loadKg}` : ''} · descanso {item.restSeconds}s
                            </p>
                            {item.notes && (
                              <p className="mt-1 text-xs text-[#A1A1AA]">{item.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </BrandCard>
                  );
                })
              )}
            </div>
          )}

          {tab === 'nutricao' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#F4F4F5]">As Minhas Refeições & Macros</h2>
                <p className="text-xs text-[#A1A1AA]">
                  Adiciona os teus alimentos em cada refeição — o teu PT acompanha o teu plano
                </p>
              </div>
              <DailyMacrosSummaryCard entries={clientNutrition} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {MEAL_TYPES.map((meal) => {
                  const entries = clientNutrition.filter((e) => e.mealType === meal.key);
                  const mKcal = entries.reduce((s, e) => s + e.kcal, 0);
                  const mProt = entries.reduce((s, e) => s + e.protein, 0);
                  const mCarbs = entries.reduce((s, e) => s + e.carbs, 0);
                  const mFat = entries.reduce((s, e) => s + e.fat, 0);
                  return (
                    <BrandCard key={meal.key}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-[#F4F4F5]">{meal.label}</h3>
                          <p className="text-xs font-medium text-[#EAB308]">
                            {mKcal.toFixed(0)} kcal · P {mProt.toFixed(0)}g · HC {mCarbs.toFixed(0)}g ·
                            G {mFat.toFixed(0)}g
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddMealTarget(meal)}
                          className="rounded-lg px-2.5 py-1 text-xs font-bold text-[#FACC15] hover:bg-[#242429]"
                        >
                          + Alimento
                        </button>
                      </div>
                      {entries.length === 0 ? (
                        <p className="mt-2 text-xs text-[#A1A1AA]">Sem alimentos registados.</p>
                      ) : (
                        <div className="mt-2.5 space-y-2 border-t border-[#323238] pt-2.5">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-2 rounded-xl bg-[#242429] px-3 py-2 text-xs"
                            >
                              <div>
                                <p className="font-bold text-[#F4F4F5]">
                                  {entry.foodName} ({entry.grams.toFixed(0)}g)
                                </p>
                                <p className="text-[#A1A1AA]">
                                  {entry.kcal.toFixed(0)} kcal · P {entry.protein.toFixed(1)}g · HC{' '}
                                  {entry.carbs.toFixed(1)}g · G {entry.fat.toFixed(1)}g
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => repo.removeNutritionEntry(uid, entry.id)}
                                aria-label="Remover alimento"
                                className="text-[#EF4444] hover:opacity-80"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </BrandCard>
                  );
                })}
              </div>

              {addMealTarget && (
                <AddFoodToMealModal
                  mealLabel={addMealTarget.label}
                  foods={foodItems}
                  onClose={() => setAddMealTarget(null)}
                  onAdd={async (food, grams) => {
                    await repo.addNutritionEntry(
                      uid,
                      client.id,
                      addMealTarget.key,
                      food,
                      grams
                    );
                    setAddMealTarget(null);
                    onBanner('Alimento adicionado!');
                  }}
                />
              )}
            </div>
          )}

          {tab === 'avaliacao' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#F4F4F5]">A Tua Avaliação Física</h2>
                  <p className="text-xs text-[#A1A1AA]">
                    Regista as tuas medições (IMC e TMB calculados automaticamente)
                  </p>
                </div>
                <GoldButton onClick={() => setShowNewAssessmentModal(true)}>
                  <Plus className="h-4 w-4" />
                  Nova Avaliação
                </GoldButton>
              </div>
              <AssessmentDashboard
                assessments={clientAssessments}
                onDelete={async (id) => {
                  await repo.deletePhysicalAssessment(uid, id);
                  onBanner('Avaliação apagada.');
                }}
              />

              {showNewAssessmentModal && (
                <NewAssessmentModal
                  clientName={client.name}
                  latest={clientAssessments[clientAssessments.length - 1] || null}
                  onClose={() => setShowNewAssessmentModal(false)}
                  onSave={async (payload) => {
                    await repo.addPhysicalAssessment(uid, {
                      clientId: client.id,
                      dateMillis: Date.now(),
                      ...payload,
                    });
                    setShowNewAssessmentModal(false);
                    onBanner('Avaliação física guardada!');
                  }}
                />
              )}
            </div>
          )}

          {tab === 'mensalidade' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#F4F4F5]">Mensalidade & Fidelização</h2>
                <p className="text-xs text-[#A1A1AA]">
                  Estado da mensalidade atual, contrato e histórico
                </p>
              </div>

              <BrandCard highlight={!monthPaid}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#A1A1AA]">Estado em {currentMonth.monthLabel}</p>
                    <p className="mt-0.5 text-xl font-extrabold text-[#F4F4F5]">
                      {client.monthlyFeeEur > 0 ? `€${client.monthlyFeeEur}/mês` : 'Plano ativo'}
                    </p>
                  </div>
                  <StatusPill tone={monthPaid ? 'green' : 'amber'}>
                    {monthPaid ? `Pago €${monthPaid.amountEur.toFixed(0)} ✓` : 'Pendente'}
                  </StatusPill>
                </div>
              </BrandCard>

              {clientFidelizacoes.length > 0 && (
                <BrandCard>
                  <h3 className="text-base font-bold text-[#F4F4F5]">Fidelização</h3>
                  <div className="mt-2.5 space-y-2">
                    {clientFidelizacoes.map((f) => {
                      const daysLeft = Math.floor((f.endDateMillis - Date.now()) / 86_400_000);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-xl bg-[#242429] p-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#FACC15]">
                              Contrato {f.durationMonths} Meses
                            </p>
                            <p className="text-[#A1A1AA]">
                              {formatShortDate(f.startDateMillis)} →{' '}
                              {formatShortDate(f.endDateMillis)}
                            </p>
                          </div>
                          <StatusPill
                            tone={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'amber' : 'green'}
                          >
                            {daysLeft < 0 ? 'Expirada' : `${daysLeft} dias rest.`}
                          </StatusPill>
                        </div>
                      );
                    })}
                  </div>
                </BrandCard>
              )}

              <BrandCard>
                <h3 className="text-base font-bold text-[#F4F4F5]">Histórico de Pagamentos</h3>
                {clientPayments.length === 0 ? (
                  <p className="mt-2 text-xs text-[#A1A1AA]">Sem pagamentos registados.</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {clientPayments.map((p) => (
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
                        <StatusPill tone="green">Pago</StatusPill>
                      </div>
                    ))}
                  </div>
                )}
              </BrandCard>
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-bold text-[#F4F4F5]">Chat com o Personal Trainer</h2>
                <p className="text-xs text-[#A1A1AA]">
                  Conversa privada em tempo real
                </p>
              </div>
              <PrivateChatPanel
                uid={uid}
                clientId={client.id}
                clientName="Personal Trainer"
                viewerRole="STUDENT"
                messages={clientMessages}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav — Idêntica ao Painel PT */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[#323238] bg-[#18181B]/95 backdrop-blur-md lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold ${
              tab === item.id ? 'text-[#FACC15]' : 'text-[#A1A1AA]'
            }`}
          >
            {item.icon}
            <span>{item.mobileLabel}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute right-2 top-1 rounded-full bg-[#EAB308] px-1.5 text-[9px] font-extrabold text-[#121214]">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};
