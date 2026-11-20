import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CreditCard,
  Dumbbell,
  LogOut,
  MessageCircle,
  Plus,
  Scale,
  UserCheck,
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
  onSwitchToPt: () => void;
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

  const activeWeek =
    publishedWeeks.find((w) => w.weekKey === selectedWeekKey) ||
    publishedWeeks[0] ||
    null;

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

  const tabs: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="h-4 w-4" /> },
    { id: 'treino', label: 'Treino', icon: <Dumbbell className="h-4 w-4" /> },
    { id: 'nutricao', label: 'Nutrição', icon: <Utensils className="h-4 w-4" /> },
    { id: 'avaliacao', label: 'Avaliação', icon: <Scale className="h-4 w-4" /> },
    { id: 'mensalidade', label: 'Mensalidade', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
  ];

  const currentMonth = useMemo(() => buildRecentMonthOptions()[0], []);
  const monthPaid = clientPayments.find(
    (p) => p.monthYear === currentMonth.monthYear && p.paid
  );

  return (
    <div className="min-h-screen bg-[#121214] text-[#F4F4F5]">
      <header className="sticky top-0 z-30 border-b border-[#323238] bg-[#121214]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <NewShapeLogo compact />
            <div className="hidden sm:block h-6 w-px bg-[#323238]" />
            <div>
              <p className="text-sm font-bold text-[#F4F4F5]">Olá, {firstName}! 👋</p>
              <button
                type="button"
                onClick={onSwitchStudent}
                className="text-xs font-semibold text-[#EAB308] hover:underline"
              >
                Não és tu? Mudar aluno
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onSwitchToPt} className="min-h-[38px] px-3 py-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5" />
              Vista PT
            </SecondaryButton>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sair"
              className="rounded-xl border border-[#323238] bg-[#1B1B1E] p-2 text-[#A1A1AA] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-2.5 flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
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
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {publishedWeeks.map((w) => (
                    <button
                      key={w.weekKey}
                      type="button"
                      onClick={() => setSelectedWeekKey(w.weekKey)}
                      className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-bold ${
                        activeWeek?.weekKey === w.weekKey
                          ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                          : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA]'
                      }`}
                    >
                      Semana {w.label}
                    </button>
                  ))}
                </div>

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
                      .map((s) => {
                        const occupied = bookings.filter(
                          (b) => b.sessionId === s.id && b.status !== 'CANCELLED'
                        ).length;
                        const spotsLeft = Math.max(0, s.capacity - occupied);
                        const isMine = draftSessionIds.has(s.id);
                        const alreadyBooked = clientWeekBookings.some(
                          (b) => b.sessionId === s.id
                        );
                        const cutoffMs = settings.cutoffHours * 3_600_000;
                        const isCutoffLocked =
                          s.startMillis > 0 && Date.now() > s.startMillis - cutoffMs;
                        const editLocked = !settings.clientsCanEdit || isCutoffLocked;
                        const fullAndNotMine = spotsLeft === 0 && !alreadyBooked;

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
                                <StatusPill
                                  tone={
                                    isMine
                                      ? 'gold'
                                      : spotsLeft === 0
                                      ? 'red'
                                      : 'green'
                                  }
                                >
                                  {spotsLeft === 0 ? 'Lotado' : `${spotsLeft} vagas`}
                                </StatusPill>
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
            <h2 className="text-xl font-bold text-[#F4F4F5]">Os Teus Planos de Treino</h2>
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
            <h2 className="text-xl font-bold text-[#F4F4F5]">Mensalidade & Fidelização</h2>

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
            <h2 className="text-xl font-bold text-[#F4F4F5]">Chat com o Personal Trainer</h2>
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
  );
};
