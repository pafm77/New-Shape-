import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
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
  formatCutoffLabel,
  formatShortDate,
  getEffectiveCutoffMinutes,
  getEffectiveReminderLeadMinutes,
  MEAL_TYPES,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  dispatchLocalPushNotification,
  formatLeadMinutesLabel,
  getNotificationPermission,
  getReminderPreferences,
  requestNotificationPermission,
  saveReminderPreferences,
  scheduleConfirmedWorkoutReminders,
} from '../services/notificationService';
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

  useEffect(() => {
    if (!reminderEnabled || notifPerm !== 'granted') return;
    return scheduleConfirmedWorkoutReminders(client.id, bookings, sessions, reminderLeadMins);
  }, [reminderEnabled, notifPerm, client.id, bookings, sessions, reminderLeadMins]);

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
                        {weeklyLimit > 0 && (
                          <div className="mt-1.5 flex justify-center">
                            <StatusPill
                              tone={draftSessionIds.size >= weeklyLimit ? 'amber' : 'gold'}
                            >
                              Pacote: {draftSessionIds.size} / {weeklyLimit} treinos esta semana
                            </StatusPill>
                          </div>
                        )}
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

                  {/* Training Reminder Push Notification Card */}
                  <BrandCard>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-[#EAB308]" />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-[#F4F4F5]">
                            Lembretes de Treino (Notificações Push)
                          </p>
                          <p className="text-[11px] text-[#A1A1AA]">
                            Recebe um aviso antes de cada treino confirmado.
                          </p>
                        </div>
                      </div>
                      {notifPerm === 'granted' && reminderEnabled ? (
                        <StatusPill tone="green">
                          Ativo · {formatLeadMinutesLabel(reminderLeadMins)} antes
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Desativado</StatusPill>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {notifPerm !== 'granted' ? (
                        <GoldButton
                          onClick={async () => {
                            const res = await requestNotificationPermission();
                            setNotifPerm(res);
                            if (res === 'granted') {
                              setReminderEnabled(true);
                              saveReminderPreferences(
                                true,
                                hasCustomLead ? reminderLeadMins : null
                              );
                              onBanner('Lembretes de treino ativados!');
                            } else {
                              onBanner('Autoriza as notificações nas definições do browser.');
                            }
                          }}
                        >
                          <Bell className="h-4 w-4" />
                          {notifPerm === 'unsupported'
                            ? 'Indisponível neste browser'
                            : 'Ativar lembretes push'}
                        </GoldButton>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !reminderEnabled;
                              setReminderEnabled(next);
                              saveReminderPreferences(
                                next,
                                hasCustomLead ? reminderLeadMins : null
                              );
                              onBanner(
                                next
                                  ? 'Lembretes de treino ativados!'
                                  : 'Lembretes de treino desativados.'
                              );
                            }}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                              reminderEnabled
                                ? 'border-[#22C55E] bg-[#143521] text-[#86EFAC]'
                                : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                            }`}
                          >
                            {reminderEnabled ? 'Lembretes ligados ✓' : 'Ligar lembretes'}
                          </button>

                          {Array.from(new Set([studioDefaultLeadMins, 15, 30, 60, 120]))
                            .sort((a, b) => a - b)
                            .map((mins) => {
                              const isStudioDefault = mins === studioDefaultLeadMins;
                              return (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => {
                                    setReminderLeadMins(mins);
                                    setReminderEnabled(true);
                                    if (isStudioDefault) {
                                      setHasCustomLead(false);
                                      saveReminderPreferences(true, null);
                                    } else {
                                      setHasCustomLead(true);
                                      saveReminderPreferences(true, mins);
                                    }
                                    onBanner(
                                      `Lembrete definido para ${formatLeadMinutesLabel(mins)} antes do treino.`
                                    );
                                  }}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                                    reminderLeadMins === mins && reminderEnabled
                                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                                  }`}
                                >
                                  {formatLeadMinutesLabel(mins)}
                                  {isStudioDefault ? ' (PT)' : ''}
                                </button>
                              );
                            })}

                          <button
                            type="button"
                            onClick={async () => {
                              await dispatchLocalPushNotification(
                                'Lembrete de Treino · New Shape',
                                `Olá ${firstName}! Os teus lembretes push estão ativos (${formatLeadMinutesLabel(reminderLeadMins)} antes do treino) 💪`
                              );
                              onBanner('Notificação de teste enviada!');
                            }}
                            className="rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:border-[#EAB308]"
                          >
                            Testar
                          </button>
                        </>
                      )}
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
                          const cutoffMinutes = getEffectiveCutoffMinutes(settings);
                          const cutoffMs = cutoffMinutes * 60_000;
                          const isCutoffLocked =
                            cutoffMs > 0 &&
                            s.startMillis > 0 &&
                            Date.now() > s.startMillis - cutoffMs;
                          const editLocked = !settings.clientsCanEdit || isCutoffLocked;
                          const fullAndNotMine = isFull && !alreadyBooked;
                          const sessionWaitlist = waitlistEntries
                            .filter((w) => w.sessionId === s.id)
                            .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
                          const myWaitlistIdx = sessionWaitlist.findIndex(
                            (w) => w.clientId === client.id
                          );
                          const myWaitlistEntry =
                            myWaitlistIdx >= 0 ? sessionWaitlist[myWaitlistIdx] : null;

                          const pillTone = existingForSession
                            ? existingForSession.status === 'CONFIRMED'
                              ? 'green'
                              : 'amber'
                            : myWaitlistEntry
                            ? 'amber'
                            : isFull
                            ? 'red'
                            : isMine
                            ? 'gold'
                            : 'green';

                          const pillLabel = existingForSession
                            ? existingForSession.status === 'CONFIRMED'
                              ? 'Confirmado'
                              : 'Por confirmar'
                            : myWaitlistEntry
                            ? `Espera #${myWaitlistIdx + 1}`
                            : isFull
                            ? 'Esgotado'
                            : 'Disponível';

                          return (
                            <div
                              key={s.id}
                              className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                                isMine
                                  ? 'border-[#EAB308] bg-[#3D3314]/70'
                                  : myWaitlistEntry
                                  ? 'border-[#F59E0B]/60 bg-[#3B2A10]/40'
                                  : 'border-[#323238] bg-[#1B1B1E] hover:border-[#EAB308]/50'
                              }`}
                            >
                              <button
                                type="button"
                                disabled={editLocked || fullAndNotMine}
                                onClick={() => {
                                  if (
                                    !isMine &&
                                    weeklyLimit > 0 &&
                                    draftSessionIds.size >= weeklyLimit
                                  ) {
                                    onBanner(
                                      `Atingiste o limite semanal do teu pacote (${weeklyLimit} treino(s)/semana). Retira um horário ou fala com o teu PT.`
                                    );
                                    return;
                                  }
                                  setDraftSessionIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(s.id)) next.delete(s.id);
                                    else next.add(s.id);
                                    return next;
                                  });
                                }}
                                className="w-full text-left disabled:cursor-not-allowed disabled:opacity-65"
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
                                    Prazo de alteração ({formatCutoffLabel(cutoffMinutes)} antes) encerrado
                                  </p>
                                )}
                              </button>

                              {fullAndNotMine && !editLocked && (
                                <div className="mt-3 border-t border-[#323238]/70 pt-2.5 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-[#A1A1AA]">
                                    {myWaitlistEntry
                                      ? `Estás em #${myWaitlistIdx + 1} na lista de espera`
                                      : sessionWaitlist.length > 0
                                      ? `${sessionWaitlist.length} em lista de espera`
                                      : 'Turma completa'}
                                  </span>
                                  {myWaitlistEntry ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await repo.leaveWaitlist(uid, myWaitlistEntry.id);
                                        onBanner('Saíste da lista de espera.');
                                      }}
                                      className="rounded-lg border border-[#EF4444]/60 bg-[#3B1518] px-2.5 py-1 text-xs font-bold text-[#FCA5A5] hover:bg-[#4B1A1E]"
                                    >
                                      Sair da espera
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await repo.joinWaitlist(
                                          uid,
                                          s.id,
                                          activeWeek.weekKey,
                                          client.id
                                        );
                                        onBanner('Entraste na lista de espera! O PT será avisado se abrir vaga.');
                                      }}
                                      className="rounded-lg border border-[#EAB308]/60 bg-[#3D3314] px-2.5 py-1 text-xs font-bold text-[#FACC15] hover:bg-[#4D4019]"
                                    >
                                      Entrar na lista de espera
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
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
                          if (weeklyLimit > 0 && draftSessionIds.size > weeklyLimit) {
                            onBanner(
                              `O teu pacote permite até ${weeklyLimit} treino(s) por semana.`
                            );
                            return;
                          }
                          const sessionMap = new Map(sessions.map((s) => [s.id, s]));
                          const prevIds = new Set(clientWeekBookings.map((b) => b.sessionId));
                          const removedIds = Array.from(prevIds).filter(
                            (id) => !draftSessionIds.has(id)
                          );
                          const addedIds = Array.from(draftSessionIds).filter(
                            (id) => !prevIds.has(id)
                          );
                          const hadExisting = clientWeekBookings.length > 0;
                          const hasScheduleChange =
                            hadExisting && (removedIds.length > 0 || addedIds.length > 0);
                          const isFullCancel = hadExisting && draftSessionIds.size === 0;

                          await repo.submitStudentBookings(
                            uid,
                            activeWeek.weekKey,
                            client.id,
                            draftSessionIds,
                            clientWeekBookings
                          );

                          if (isFullCancel || hasScheduleChange) {
                            const fmtSessions = (ids: string[]) =>
                              ids
                                .map((id) => sessionMap.get(id))
                                .filter((s): s is TrainingSessionRecord => Boolean(s))
                                .map((s) => `${s.dateLabel} às ${s.timeLabel}`)
                                .join(', ');

                            const removedTxt = fmtSessions(removedIds);
                            const nextTxt = fmtSessions(Array.from(draftSessionIds));

                            const notifType = isFullCancel ? 'CANCELLED' : 'ALTERED';
                            const summary = isFullCancel
                              ? `${client.name} cancelou o(s) treino(s) da semana ${activeWeek.label}${
                                  removedTxt ? ` (${removedTxt})` : ''
                                }.`
                              : `${client.name} alterou o horário na semana ${activeWeek.label}.${
                                  removedTxt ? ` Retirou: ${removedTxt}.` : ''
                                }${nextTxt ? ` Novo horário: ${nextTxt}.` : ''}`;

                            await repo
                              .createPtNotification(uid, {
                                clientId: client.id,
                                clientName: client.name,
                                type: notifType,
                                summary,
                                weekKey: activeWeek.weekKey,
                              })
                              .catch(() => {});

                            const waMsg = isFullCancel
                              ? `Olá! Sou ${client.name} (New Shape). Tive de cancelar o meu treino da semana ${activeWeek.label}${
                                  removedTxt ? ` (${removedTxt})` : ''
                                }. Já atualizei na app!`
                              : `Olá! Sou ${client.name} (New Shape). Modifiquei o meu horário de treino da semana ${activeWeek.label}.${
                                  removedTxt ? `\n• Retirado: ${removedTxt}` : ''
                                }${nextTxt ? `\n• Novo horário: ${nextTxt}` : ''}\nJá atualizei na app!`;

                            setWhatsAppAlertModal({
                              title: isFullCancel
                                ? 'Treino cancelado — Avisa o PT no WhatsApp'
                                : 'Horário modificado — Avisa o PT no WhatsApp',
                              subtitle:
                                'O teu Personal Trainer já recebeu uma notificação na app. Envia também a mensagem pelo WhatsApp para confirmar.',
                              message: waMsg,
                            });
                          }

                          onBanner(
                            isFullCancel
                              ? 'Treino cancelado e PT notificado!'
                              : hasScheduleChange
                              ? 'Alteração de horário enviada e PT notificado!'
                              : 'Marcação enviada ao Personal Trainer!'
                          );
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
                          const sessionMap = new Map(sessions.map((s) => [s.id, s]));
                          const hadExisting = clientWeekBookings.length > 0;
                          const prevSessionsTxt = clientWeekBookings
                            .map((b) => sessionMap.get(b.sessionId))
                            .filter((s): s is TrainingSessionRecord => Boolean(s))
                            .map((s) => `${s.dateLabel} às ${s.timeLabel}`)
                            .join(', ');

                          await repo.markStudentUnavailable(
                            uid,
                            activeWeek.weekKey,
                            client.id,
                            clientWeekBookings
                          );
                          setDraftSessionIds(new Set());

                          if (hadExisting) {
                            const summary = `${client.name} cancelou os treinos e marcou indisponibilidade na semana ${activeWeek.label}${
                              prevSessionsTxt ? ` (${prevSessionsTxt})` : ''
                            }.`;
                            await repo
                              .createPtNotification(uid, {
                                clientId: client.id,
                                clientName: client.name,
                                type: 'UNAVAILABLE',
                                summary,
                                weekKey: activeWeek.weekKey,
                              })
                              .catch(() => {});

                            setWhatsAppAlertModal({
                              title: 'Treinos cancelados — Avisa o PT no WhatsApp',
                              subtitle:
                                'O teu PT foi notificado na app de que não podes treinar esta semana. Envia-lhe a mensagem pelo WhatsApp.',
                              message: `Olá! Sou ${client.name} (New Shape). Esta semana (${activeWeek.label}) não vou conseguir treinar e cancelei a minha marcação${
                                prevSessionsTxt ? ` (${prevSessionsTxt})` : ''
                              } na app.`,
                            });
                          }

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
