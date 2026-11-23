import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  CreditCard,
  Dumbbell,
  FileText,
  History,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  Scale,
  Send,
  Square,
  Timer,
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
  WaitlistEntryRecord,
  WeekResponseRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import {
  buildRecentMonthOptions,
  buildWhatsAppUrl,
  formatShortDate,
  getEffectiveReminderLeadMinutes,
  MEAL_TYPES,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  dispatchLocalPushNotification,
  getNotificationPermission,
  getReminderPreferences,
  scheduleConfirmedWorkoutReminders,
} from '../services/notificationService';
import { StudentAgendaSection } from './StudentAgendaSection';
import { NewShapeLogo } from './NewShapeLogo';
import {
  ExerciseLastLoadBadge,
  resolveLastExerciseLoad,
} from './ExerciseLastLoadBadge';
import {
  BrandCard,
  EmptyState,
  GoldButton,
  Modal,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';
import { AddFoodToMealModal, DailyMacrosSummaryCard } from './PtNutritionSection';
import { AssessmentDashboard, NewAssessmentModal } from './PtAssessmentSection';
import { PrivateChatPanel } from './PtManagementSection';
import { ExerciseProgressModal } from './ExerciseProgressModal';
import { StudentInstallBanner } from './StudentInstallBanner';
import { openStudentEvolutionPdfReport } from '../services/evolutionReportGenerator';

interface StudentPortalProps {
  uid: string;
  client: ClientRecord;
  weeks: TrainingWeekRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntryRecord[];
  weekResponses: WeekResponseRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
  foodItems: FoodItemRecord[];
  nutritionEntries: NutritionEntryRecord[];
  assessments: PhysicalAssessmentRecord[];
  chatMessages: ChatMessageRecord[];
  settings: StudioSettingsRecord;
  initialWeekSlug?: string;
  showInstallPrompt?: boolean;
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
  waitlistEntries,
  weekResponses,
  payments,
  fidelizacoes,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs,
  foodItems,
  nutritionEntries,
  assessments,
  chatMessages,
  settings,
  initialWeekSlug,
  showInstallPrompt = false,
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
  const [historyTarget, setHistoryTarget] = useState<{
    exerciseId: string;
    exerciseName: string;
  } | null>(null);
  const firstName = client.name.trim().split(/\s+/)[0] || client.name;
  const weeklyLimit = client.weeklySessionLimit ?? 0;

  // Push / local training reminders
  const studioDefaultLeadMins = getEffectiveReminderLeadMinutes(settings);
  const [notifPerm, setNotifPerm] = useState(() => getNotificationPermission());
  const [reminderEnabled, setReminderEnabled] = useState(
    () => getReminderPreferences(studioDefaultLeadMins).enabled
  );
  const [hasCustomLead, setHasCustomLead] = useState(
    () => getReminderPreferences(studioDefaultLeadMins).hasCustomLead
  );
  const [reminderLeadMins, setReminderLeadMins] = useState(
    () => getReminderPreferences(studioDefaultLeadMins).leadMinutes
  );

  useEffect(() => {
    if (!hasCustomLead) {
      setReminderLeadMins(studioDefaultLeadMins);
    }
  }, [studioDefaultLeadMins, hasCustomLead]);

  // WhatsApp prompt modal after cancelling or modifying schedule
  const [whatsAppAlertModal, setWhatsAppAlertModal] = useState<{
    title: string;
    subtitle: string;
    message: string;
  } | null>(null);

  // Active workout execution state (captures last-workout baseline loads per item)
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [baselineLoads, setBaselineLoads] = useState<Record<string, string>>({});
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);
  const restIntervalRef = useRef<number | null>(null);

  const visibleSessions = useMemo(
    () => sessions.filter((s) => !s.ptPrivatePersonal),
    [sessions]
  );
  const visibleSessionIds = useMemo(
    () => new Set(visibleSessions.map((s) => s.id)),
    [visibleSessions]
  );

  useEffect(() => {
    if (!reminderEnabled || notifPerm !== 'granted') return;
    return scheduleConfirmedWorkoutReminders(client.id, bookings, visibleSessions, reminderLeadMins);
  }, [reminderEnabled, notifPerm, client.id, bookings, visibleSessions, reminderLeadMins]);

  useEffect(() => {
    if (restSecondsLeft <= 0) {
      if (restIntervalRef.current) {
        window.clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
      return;
    }
    if (!restIntervalRef.current) {
      restIntervalRef.current = window.setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev <= 1) {
            if (restIntervalRef.current) {
              window.clearInterval(restIntervalRef.current);
              restIntervalRef.current = null;
            }
            if (notifPerm === 'granted') {
              void dispatchLocalPushNotification(
                'Descanso terminado · New Shape',
                'Hora da próxima série! Bora 💪',
                'newshape-rest-timer'
              );
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (restIntervalRef.current) {
        window.clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
    };
  }, [restSecondsLeft > 0, notifPerm]);

  const startRestTimer = (seconds: number) => {
    const safeSec = Math.max(10, Math.min(600, seconds || 60));
    setRestSecondsLeft(safeSec);
  };

  const startWorkoutExecution = (planId: string, items: WorkoutPlanItemRecord[]) => {
    const snapshot: Record<string, string> = {};
    items.forEach((it) => {
      snapshot[it.id] = (it.loadKg || it.lastLoadKg || '').trim();
    });
    setBaselineLoads(snapshot);
    setCompletedItemIds(new Set());
    setExecutingPlanId(planId);
    onBanner('Modo execução iniciado! A carga do último treino está visível em cada exercício.');
  };

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
              b.status !== 'CANCELLED' &&
              visibleSessionIds.has(b.sessionId)
          )
        : [],
    [bookings, activeWeek, client.id, visibleSessionIds]
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

  const unreadChatCount = useMemo(
    () => clientMessages.filter((m) => m.senderRole === 'PT' && !m.readAtMillis).length,
    [clientMessages]
  );

  const deliveredPtMsgIdsRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const undelivered = clientMessages.filter(
      (m) =>
        m.senderRole === 'PT' &&
        !m.deliveredAtMillis &&
        !m.readAtMillis &&
        !deliveredPtMsgIdsRef.current.has(m.id)
    );
    if (undelivered.length === 0) return;
    undelivered.forEach((m) => deliveredPtMsgIdsRef.current.add(m.id));
    void repo
      .markChatMessagesDelivered(
        uid,
        undelivered.map((m) => m.id)
      )
      .catch(() => {
        undelivered.forEach((m) => deliveredPtMsgIdsRef.current.delete(m.id));
      });
  }, [uid, clientMessages]);

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
      badge: unreadChatCount > 0 ? unreadChatCount : undefined,
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
          {showInstallPrompt && (
            <StudentInstallBanner
              onInstalled={() =>
                onBanner('App do Aluno adicionada ao ecrã principal!')
              }
            />
          )}
          {tab === 'agenda' && (
            <StudentAgendaSection
              uid={uid}
              client={client}
              firstName={firstName}
              publishedWeeks={publishedWeeks}
              activeWeek={activeWeek}
              activeWeekIdx={activeWeekIdx}
              onSelectWeekKey={setSelectedWeekKey}
              sessions={visibleSessions}
              bookings={bookings}
              clientWeekBookings={clientWeekBookings}
              draftSessionIds={draftSessionIds}
              setDraftSessionIds={setDraftSessionIds}
              waitlistEntries={waitlistEntries}
              weekResponse={weekResponse}
              settings={settings}
              weeklyLimit={weeklyLimit}
              studioDefaultLeadMins={studioDefaultLeadMins}
              notifPerm={notifPerm}
              setNotifPerm={setNotifPerm}
              reminderEnabled={reminderEnabled}
              setReminderEnabled={setReminderEnabled}
              hasCustomLead={hasCustomLead}
              setHasCustomLead={setHasCustomLead}
              reminderLeadMins={reminderLeadMins}
              setReminderLeadMins={setReminderLeadMins}
              onBanner={onBanner}
              onWhatsAppAlert={setWhatsAppAlertModal}
            />
          )}

          {tab === 'treino' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#F4F4F5]">Os Teus Planos de Treino</h2>
                <p className="text-xs text-[#A1A1AA]">
                  Inicia o treino para veres a carga do último treino em cada exercício, usar o temporizador de descanso e registar a carga de hoje.
                </p>
              </div>

              {restSecondsLeft > 0 && (
                <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#EAB308] bg-[#3D3314] px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <Timer className="h-5 w-5 text-[#FACC15]" />
                    <div>
                      <p className="text-xs font-semibold text-[#FACC15]">Descanso em curso</p>
                      <p className="text-xl font-extrabold text-white">
                        {Math.floor(restSecondsLeft / 60)}:
                        {String(restSecondsLeft % 60).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                  <SecondaryButton onClick={() => setRestSecondsLeft(0)}>
                    Saltar descanso
                  </SecondaryButton>
                </div>
              )}

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
                  const isExecuting = executingPlanId === plan.id;
                  const doneCount = items.filter((i) => completedItemIds.has(i.id)).length;

                  return (
                    <BrandCard key={plan.id} highlight>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-[#FACC15]">{plan.title}</h3>
                          {plan.splitLabel && (
                            <p className="text-xs text-[#A1A1AA]">{plan.splitLabel}</p>
                          )}
                          {isExecuting && (
                            <p className="mt-1 text-xs font-bold text-[#22C55E]">
                              Em execução · {doneCount}/{items.length} exercício(s) concluído(s)
                            </p>
                          )}
                        </div>
                        {isExecuting ? (
                          <SecondaryButton
                            onClick={() => {
                              setExecutingPlanId(null);
                              setRestSecondsLeft(0);
                              onBanner('Treino terminado! Bom trabalho 💪');
                            }}
                          >
                            <Square className="h-3.5 w-3.5 text-[#EF4444]" />
                            Terminar treino
                          </SecondaryButton>
                        ) : (
                          <GoldButton
                            disabled={items.length === 0}
                            onClick={() => startWorkoutExecution(plan.id, items)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Executar Treino
                          </GoldButton>
                        )}
                      </div>

                      <div className="mt-3 space-y-2.5 border-t border-[#323238] pt-3">
                        {items.map((item, idx) => {
                          const baselineOverride = isExecuting
                            ? baselineLoads[item.id]
                            : undefined;
                          return (
                            <StudentExerciseLoadCard
                              key={item.id}
                              index={idx}
                              item={item}
                              clientId={client.id}
                              workoutPlans={workoutPlans}
                              workoutPlanItems={workoutPlanItems}
                              workoutLoadLogs={workoutLoadLogs}
                              isExecuting={isExecuting}
                              isDone={completedItemIds.has(item.id)}
                              baselineLoadOverride={baselineOverride}
                              onToggleDone={() => {
                                setCompletedItemIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              onStartRest={() => startRestTimer(item.restSeconds)}
                              onOpenHistory={() =>
                                setHistoryTarget({
                                  exerciseId: item.exerciseId,
                                  exerciseName: item.exerciseName,
                                })
                              }
                              onSaveLoad={async (newLoad) => {
                                const prevForStorage = (
                                  baselineLoads[item.id] ||
                                  item.loadKg ||
                                  item.lastLoadKg ||
                                  newLoad
                                ).trim();
                                await repo.updateWorkoutPlanItemLoad(
                                  uid,
                                  item.id,
                                  newLoad,
                                  prevForStorage,
                                  {
                                    clientId: client.id,
                                    planId: plan.id,
                                    exerciseId: item.exerciseId,
                                    exerciseName: item.exerciseName,
                                  }
                                );
                                onBanner(`Carga de "${item.exerciseName}" atualizada!`);
                              }}
                            />
                          );
                        })}
                      </div>
                    </BrandCard>
                  );
                })
              )}

              {historyTarget && (
                <ExerciseProgressModal
                  open
                  clientName={client.name}
                  clientId={client.id}
                  exerciseId={historyTarget.exerciseId}
                  exerciseName={historyTarget.exerciseName}
                  workoutLoadLogs={workoutLoadLogs}
                  onClose={() => setHistoryTarget(null)}
                />
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
                <div className="flex flex-wrap items-center gap-2">
                  <SecondaryButton
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
                      if (!ok) {
                        onBanner('Permite pop-ups no browser para gerar o relatório PDF.');
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 text-[#EAB308]" />
                    Relatório PDF
                  </SecondaryButton>
                  <GoldButton onClick={() => setShowNewAssessmentModal(true)}>
                    <Plus className="h-4 w-4" />
                    Nova Avaliação
                  </GoldButton>
                </div>
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
                    const parts: string[] = [`${payload.weightKg.toFixed(1)} kg`];
                    if (payload.bodyFatPct > 0) parts.push(`${payload.bodyFatPct.toFixed(1)}% MG`);
                    if (payload.muscleMassKg > 0) parts.push(`${payload.muscleMassKg.toFixed(1)} kg músculo`);
                    const bmiVal =
                      payload.heightCm > 0
                        ? payload.weightKg / Math.pow(payload.heightCm / 100, 2)
                        : 0;
                    if (bmiVal > 0) parts.push(`IMC ${bmiVal.toFixed(1)}`);
                    repo
                      .createPtNotification(uid, {
                        clientId: client.id,
                        clientName: client.name,
                        type: 'ASSESSMENT',
                        summary: `Registou uma nova avaliação física: ${parts.join(' · ')}`,
                        weekKey: '',
                      })
                      .catch(() => {});
                    setShowNewAssessmentModal(false);
                    onBanner('Avaliação física guardada e PT notificado!');
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
                senderClientName={client.name}
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

      {/* WhatsApp Handoff Modal on Cancel / Schedule Change */}
      {whatsAppAlertModal && (
        <Modal
          open
          title={whatsAppAlertModal.title}
          subtitle={whatsAppAlertModal.subtitle}
          onClose={() => setWhatsAppAlertModal(null)}
        >
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-xl border border-[#323238] bg-[#242429] p-3 text-xs text-[#F4F4F5] font-sans">
              {whatsAppAlertModal.message}
            </pre>
            {!settings.ptWhatsappPhone && (
              <p className="text-[11px] text-[#F59E0B]">
                Dica: o WhatsApp vai abrir para escolheres o contacto do teu PT (o PT pode configurar
                o seu número em Definições).
              </p>
            )}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
              <SecondaryButton onClick={() => setWhatsAppAlertModal(null)}>
                Fechar
              </SecondaryButton>
              <GoldButton
                onClick={() => {
                  const url = buildWhatsAppUrl(
                    settings.ptWhatsappPhone || null,
                    whatsAppAlertModal.message,
                    settings.whatsappWebMode
                  );
                  window.open(url, '_blank', 'noopener,noreferrer');
                  setWhatsAppAlertModal(null);
                }}
              >
                <Send className="h-4 w-4" />
                Enviar mensagem pelo WhatsApp
              </GoldButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const StudentExerciseLoadCard: React.FC<{
  index: number;
  item: WorkoutPlanItemRecord;
  clientId: string;
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
  isExecuting: boolean;
  isDone: boolean;
  baselineLoadOverride?: string;
  onToggleDone: () => void;
  onStartRest: () => void;
  onOpenHistory: () => void;
  onSaveLoad: (newLoad: string) => Promise<void>;
}> = ({
  index,
  item,
  clientId,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs,
  isExecuting,
  isDone,
  baselineLoadOverride,
  onToggleDone,
  onStartRest,
  onOpenHistory,
  onSaveLoad,
}) => {
  const [draft, setDraft] = useState(item.loadKg);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item.loadKg);
  }, [item.loadKg]);

  const formatLoadInput = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^\d+([.,]\d+)?$/.test(trimmed)) {
      return `${trimmed.replace(',', '.')} kg`;
    }
    return trimmed;
  };

  const formatted = formatLoadInput(draft);
  const hasChanged = formatted !== item.loadKg.trim();

  const parseNumericLoad = (raw: string): number | null => {
    const m = raw.replace(',', '.').match(/\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  const handleSave = async () => {
    if (saving || !hasChanged) return;
    setSaving(true);
    try {
      await onSaveLoad(formatted);
    } finally {
      setSaving(false);
    }
  };

  const resolvedHistory = useMemo(
    () =>
      resolveLastExerciseLoad({
        item,
        clientId,
        workoutPlans,
        workoutPlanItems,
        baselineLoadOverride,
      }),
    [item, clientId, workoutPlans, workoutPlanItems, baselineLoadOverride]
  );

  const baseNum = parseNumericLoad(resolvedHistory.load || item.loadKg);

  return (
    <div
      className={`rounded-xl border p-3 space-y-2.5 transition ${
        isDone
          ? 'border-[#22C55E]/60 bg-[#143521]/40'
          : isExecuting
          ? 'border-[#EAB308]/50 bg-[#242429]'
          : 'border-[#323238] bg-[#242429]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#F4F4F5]">
            {index + 1}. {item.exerciseName}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#EAB308]">
            {item.sets} séries × {item.reps}
            {item.loadKg ? ` · Atual: ${item.loadKg}` : ''} · descanso {item.restSeconds}s
          </p>
          {item.notes && <p className="mt-1 text-xs text-[#A1A1AA]">{item.notes}</p>}
        </div>
        {isExecuting && (
          <button
            type="button"
            onClick={onToggleDone}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              isDone
                ? 'border-[#22C55E] bg-[#22C55E] text-[#121214]'
                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#22C55E] hover:text-[#22C55E]'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            {isDone ? 'Feito' : 'Concluir'}
          </button>
        )}
      </div>

      {/* Carga do Último Treino (Badge + Tooltip histórico do aluno) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ExerciseLastLoadBadge
          item={item}
          clientId={clientId}
          workoutPlans={workoutPlans}
          workoutPlanItems={workoutPlanItems}
          workoutLoadLogs={workoutLoadLogs}
          baselineLoadOverride={baselineLoadOverride}
          emphasize={isExecuting}
          onOpenHistory={onOpenHistory}
        />
        {resolvedHistory.loggedAtMillis > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA]">
            <History className="h-3 w-3 text-[#EAB308]/75" />
            {formatShortDate(resolvedHistory.loggedAtMillis)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#323238]/70 pt-2">
        <label className="text-[11px] font-semibold text-[#A1A1AA]">
          {isExecuting ? 'Carga hoje (kg):' : 'Carga (kg):'}
        </label>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="Ex: 40 kg"
          className="min-w-[100px] flex-1 rounded-lg border border-[#323238] bg-[#18181B] px-2.5 py-1.5 text-xs font-semibold text-[#F4F4F5] placeholder-[#71717A] outline-none focus:border-[#EAB308]"
        />
        {baseNum !== null && (
          <button
            type="button"
            onClick={() => setDraft(`${baseNum + 2.5} kg`)}
            className="rounded-lg border border-[#323238] bg-[#1B1B1E] px-2 py-1.5 text-[11px] font-bold text-[#FACC15] hover:border-[#EAB308]"
          >
            +2.5 kg
          </button>
        )}
        {isExecuting && item.restSeconds > 0 && (
          <button
            type="button"
            onClick={onStartRest}
            className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#1B1B1E] px-2 py-1.5 text-[11px] font-bold text-[#A1A1AA] hover:border-[#EAB308] hover:text-white"
          >
            <Clock className="h-3 w-3 text-[#EAB308]" />
            {item.restSeconds}s
          </button>
        )}
        <button
          type="button"
          disabled={!hasChanged || saving}
          onClick={handleSave}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            hasChanged
              ? 'bg-[#EAB308] text-[#121214] hover:bg-[#FACC15]'
              : 'border border-[#323238] bg-[#1B1B1E] text-[#71717A] cursor-not-allowed'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};
