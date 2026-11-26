import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Dumbbell, ExternalLink, Eye, Link2, Maximize2, Minimize2, Plus, Search, Trash2, Unlink, Users, X, Zap } from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  ExerciseRecord,
  formatBlockItemLabel,
  groupWorkoutPlanItems,
  MessageTemplateRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WorkoutFeedbackRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import * as repo from '../services/firestoreRepository';
import { DEFAULT_MUSCLE_GROUPS } from '../data/seedCatalog';
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
import { ExerciseLastLoadBadge } from './ExerciseLastLoadBadge';
import { ExerciseProgressModal } from './ExerciseProgressModal';
import { PtTrainingAgendaView } from './PtTrainingAgendaView';
import { PtTrainingMarcacoesView } from './PtTrainingMarcacoesView';
import { PtRecentFeedbackCard } from './StudentEngagementWidgets';

interface PtTrainingSectionProps {
  uid: string;
  clients: ClientRecord[];
  weeks: TrainingWeekRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  exercises: ExerciseRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
  workoutFeedback?: WorkoutFeedbackRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  initialClientId?: string;
  onShiftWeek: (delta: number) => void;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

export const PtTrainingSection: React.FC<PtTrainingSectionProps> = ({
  uid,
  clients,
  weeks,
  activeWeek,
  sessions,
  bookings,
  exercises,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs,
  workoutFeedback = [],
  templates,
  settings,
  initialClientId,
  onShiftWeek,
  onOpenWhatsApp,
  onBanner,
}) => {
  const [subTab, setSubTab] = useState<'plans' | 'marcacoes' | 'agenda' | 'library'>('plans');
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId || activeClients[0]?.id || ''
  );

  const effectiveClient =
    activeClients.find((c) => c.id === selectedClientId) || activeClients[0] || null;

  const [plansViewMode, setPlansViewMode] = useState<'client' | 'drafts'>('client');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [targetPlan, setTargetPlan] = useState<WorkoutPlanRecord | null>(null);
  const [assignPlan, setAssignPlan] = useState<WorkoutPlanRecord | null>(null);
  const [schedulePlan, setSchedulePlan] = useState<WorkoutPlanRecord | null>(null);
  const [historyItem, setHistoryItem] = useState<{
    item: WorkoutPlanItemRecord;
    clientId: string;
  } | null>(null);
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Set<string>>(() => new Set());

  const togglePlanCollapsed = (planId: string) => {
    setCollapsedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const todayIso = useMemo(() => getTodayIsoDate(), []);

  const unassignedPlans = useMemo(
    () => workoutPlans.filter((p) => !p.clientId || !p.clientId.trim()),
    [workoutPlans]
  );

  const clientPlans = useMemo(
    () =>
      effectiveClient
        ? workoutPlans.filter((p) => p.clientId === effectiveClient.id)
        : [],
    [workoutPlans, effectiveClient]
  );

  const displayedPlans = plansViewMode === 'drafts' ? unassignedPlans : clientPlans;

  const clientFeedback = useMemo(
    () =>
      effectiveClient
        ? workoutFeedback.filter((f) => f.clientId === effectiveClient.id)
        : [],
    [workoutFeedback, effectiveClient]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setSubTab('plans')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'plans'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Planos
        </button>
        <button
          type="button"
          onClick={() => setSubTab('marcacoes')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'marcacoes'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Marcações
        </button>
        <button
          type="button"
          onClick={() => setSubTab('agenda')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'agenda'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Agenda
        </button>
        <button
          type="button"
          onClick={() => setSubTab('library')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'library'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Exercícios ({exercises.length})
        </button>
      </div>

      {subTab === 'plans' ? (
        <div className="space-y-4">
          <BrandCard>
            <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-[#323238] bg-[#121214] p-1">
              <button
                type="button"
                onClick={() => setPlansViewMode('client')}
                className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                  plansViewMode === 'client'
                    ? 'bg-[#EAB308] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Por Aluno
              </button>
              <button
                type="button"
                onClick={() => setPlansViewMode('drafts')}
                className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                  plansViewMode === 'drafts'
                    ? 'bg-[#EAB308] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Sem Aluno / Modelos ({unassignedPlans.length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              {plansViewMode === 'client' ? (
                <div className="flex-1">
                  <FieldLabel>Selecionar Aluno</FieldLabel>
                  <select
                    value={effectiveClient?.id || ''}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
                  >
                    {activeClients.length === 0 ? (
                      <option value="">Sem alunos ativos</option>
                    ) : (
                      activeClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <p className="flex-1 text-xs text-[#A1A1AA]">
                  Cria modelos ou planos de treino sem aluno associado. Monta os exercícios primeiro e
                  atribui-os aos alunos quando quiseres, com data agendada se preferires.
                </p>
              )}
              <GoldButton onClick={() => setShowNewPlan(true)}>
                <Plus className="h-4 w-4" />
                Novo Plano de Treino
              </GoldButton>
            </div>
          </BrandCard>

          {displayedPlans.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="h-6 w-6" />}
              title={
                plansViewMode === 'drafts' ? 'Sem planos por atribuir' : 'Sem planos atribuídos'
              }
              subtitle={
                plansViewMode === 'drafts'
                  ? 'Cria um plano sem aluno para montar os exercícios primeiro e atribuí-lo mais tarde.'
                  : `Cria um plano para ${effectiveClient?.name || 'este aluno'} e escolhe exercícios da biblioteca.`
              }
            />
          ) : (
            <div className="space-y-4">
              {displayedPlans.length > 1 && (() => {
                const allCollapsed = displayedPlans.every((p) => collapsedPlanIds.has(p.id));
                return (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-xs font-semibold text-[#A1A1AA]">
                      {displayedPlans.length} planos de treino
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCollapsedPlanIds((prev) => {
                          const next = new Set(prev);
                          if (allCollapsed) {
                            displayedPlans.forEach((p) => next.delete(p.id));
                          } else {
                            displayedPlans.forEach((p) => next.add(p.id));
                          }
                          return next;
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#323238] bg-[#242429] px-3 py-1.5 text-xs font-bold text-[#FACC15] transition hover:border-[#EAB308]"
                    >
                      {allCollapsed ? (
                        <>
                          <Maximize2 className="h-3.5 w-3.5" />
                          Maximizar todos
                        </>
                      ) : (
                        <>
                          <Minimize2 className="h-3.5 w-3.5" />
                          Minimizar todos
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {displayedPlans.map((plan) => {
                const items = workoutPlanItems
                  .filter((i) => i.planId === plan.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                const isDraft = !plan.clientId || !plan.clientId.trim();
                const scheduledDate = (plan.availableFromDate || '').trim();
                const isScheduledFuture =
                  !isDraft && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && scheduledDate > todayIso;
                const isExpanded = !collapsedPlanIds.has(plan.id);

                return (
                  <BrandCard key={plan.id} highlight>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => togglePlanCollapsed(plan.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <h3 className="text-lg font-bold text-[#F4F4F5]">{plan.title}</h3>
                        {(plan.splitLabel || !isExpanded) && (
                          <p className="text-xs font-semibold text-[#FACC15]">
                            {[plan.splitLabel, !isExpanded ? `${items.length} exercício(s)` : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePlanCollapsed(plan.id)}
                          aria-label={isExpanded ? 'Minimizar plano' : 'Maximizar plano'}
                          title={isExpanded ? 'Minimizar plano' : 'Maximizar plano'}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#242429] px-2 py-1.5 text-[11px] font-bold text-[#FACC15] transition hover:border-[#EAB308]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Minimizar</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Maximizar</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await repo.deleteWorkoutPlan(uid, plan.id, workoutPlanItems);
                            onBanner('Plano apagado.');
                          }}
                          aria-label="Apagar plano"
                          className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      {isDraft ? (
                        <div className="flex items-center gap-2">
                          <StatusPill tone="gold">Sem aluno · Modelo</StatusPill>
                          <span className="text-xs text-[#A1A1AA]">
                            {items.length} exercício(s)
                          </span>
                        </div>
                      ) : isScheduledFuture ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone="amber">
                            Agendado · {formatIsoPt(scheduledDate)}
                          </StatusPill>
                          <span className="text-xs text-[#A1A1AA]">
                            Oculto para o aluno até {formatIsoPt(scheduledDate)}
                          </span>
                        </div>
                      ) : (
                        <StatusPill tone="green">Visível para o aluno</StatusPill>
                      )}

                      {!isDraft && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSchedulePlan(plan)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:border-[#EAB308]"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {isScheduledFuture ? 'Alterar data' : 'Agendar dia'}
                          </button>
                          {isScheduledFuture && (
                            <button
                              type="button"
                              onClick={async () => {
                                await repo.updateWorkoutPlanSchedule(uid, plan.id, '');
                                onBanner('Plano disponibilizado imediatamente ao aluno!');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#22C55E]/40 bg-[#143521] px-2.5 py-1 text-xs font-semibold text-[#22C55E] hover:bg-[#19452A]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Libertar agora
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <>
                    <div className="my-3 border-t border-[#323238]" />

                    {items.length === 0 ? (
                      <p className="text-xs text-[#A1A1AA]">Ainda sem exercícios neste plano.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(() => {
                          const blocks = groupWorkoutPlanItems(items);
                          let flatIdx = 0;
                          return blocks.map((block, blockIdx) => {
                            if (block.isGrouped) {
                              const startIdx = flatIdx;
                              flatIdx += block.items.length;
                              return (
                                <div
                                  key={`group_${block.supersetGroup}_${startIdx}`}
                                  className="rounded-xl border border-[#EAB308]/55 border-l-4 border-l-[#EAB308] bg-[#242429]/75 p-3 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <StatusPill tone="gold">{block.groupLabel}</StatusPill>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await repo.ungroupSupersetBlock(uid, block.items);
                                        onBanner('Grupo de exercícios separado.');
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#1B1B1E] px-2.5 py-1 text-[11px] font-semibold text-[#A1A1AA] hover:border-[#EAB308] hover:text-[#F4F4F5]"
                                    >
                                      <Unlink className="h-3.5 w-3.5" />
                                      Desagrupar
                                    </button>
                                  </div>
                                  {block.items.map((item, inIdx) => {
                                    const isNonLast = inIdx < block.items.length - 1;
                                    const isLast = inIdx === block.items.length - 1;
                                    return (
                                      <div key={item.id} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-3 py-1">
                                          <div className="min-w-0 flex-1 space-y-1.5">
                                            <p className="text-sm font-bold text-[#F4F4F5]">
                                              {formatBlockItemLabel(block, inIdx)}. {item.exerciseName}
                                            </p>
                                            <p className="text-xs font-medium text-[#EAB308]">
                                              {item.sets} séries × {item.reps}
                                              {item.loadKg ? ` · ${item.loadKg}` : ''} ·{' '}
                                              {isNonLast
                                                ? 'Sem descanso → passa ao seguinte'
                                                : isLast
                                                ? `Descanso após bloco: ${item.restSeconds}s`
                                                : `Descanso ${item.restSeconds}s`}
                                            </p>
                                            {!isDraft && (
                                              <ExerciseLastLoadBadge
                                                item={item}
                                                clientId={plan.clientId}
                                                workoutPlans={workoutPlans}
                                                workoutPlanItems={workoutPlanItems}
                                                workoutLoadLogs={workoutLoadLogs}
                                                onOpenHistory={() =>
                                                  setHistoryItem({ item, clientId: plan.clientId })
                                                }
                                              />
                                            )}
                                            {item.notes && (
                                              <p className="text-xs text-[#A1A1AA]">{item.notes}</p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              repo.removeExerciseFromPlan(
                                                uid,
                                                item.id,
                                                workoutPlanItems
                                              )
                                            }
                                            className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                        {isNonLast && (
                                          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#EAB308]/15 px-2.5 py-1 text-[11px] font-semibold text-[#FACC15]">
                                            <Zap className="h-3 w-3" />
                                            Sem descanso · passa logo ao seguinte
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }

                            const item = block.items[0];
                            const prevItem = flatIdx > 0 ? items[flatIdx - 1] : null;
                            flatIdx += 1;
                            return (
                              <div
                                key={item.id}
                                className={
                                  blockIdx > 0 ? 'border-t border-[#323238]/60 pt-2' : ''
                                }
                              >
                                {prevItem && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await repo.linkExerciseWithPrevious(uid, prevItem, item);
                                      onBanner('Exercícios agrupados sem descanso entre eles!');
                                    }}
                                    className="mb-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#FACC15] hover:bg-[#EAB308]/15"
                                  >
                                    <Link2 className="h-3.5 w-3.5" />
                                    Agrupar com anterior (sem descanso)
                                  </button>
                                )}
                                <div className="flex items-center justify-between gap-3 py-1">
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <p className="text-sm font-bold text-[#F4F4F5]">
                                      {formatBlockItemLabel(block, 0)}. {item.exerciseName}
                                    </p>
                                    <p className="text-xs font-medium text-[#EAB308]">
                                      {item.sets} séries × {item.reps}
                                      {item.loadKg ? ` · ${item.loadKg}` : ''} · Descanso{' '}
                                      {item.restSeconds}s
                                    </p>
                                    {!isDraft && (
                                      <ExerciseLastLoadBadge
                                        item={item}
                                        clientId={plan.clientId}
                                        workoutPlans={workoutPlans}
                                        workoutPlanItems={workoutPlanItems}
                                        workoutLoadLogs={workoutLoadLogs}
                                        onOpenHistory={() =>
                                          setHistoryItem({ item, clientId: plan.clientId })
                                        }
                                      />
                                    )}
                                    {item.notes && (
                                      <p className="text-xs text-[#A1A1AA]">{item.notes}</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      repo.removeExerciseFromPlan(uid, item.id, workoutPlanItems)
                                    }
                                    className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <SecondaryButton fullWidth onClick={() => setTargetPlan(plan)}>
                        <Plus className="h-4 w-4" />
                        Adicionar Exercício
                      </SecondaryButton>
                      {isDraft ? (
                        <GoldButton
                          fullWidth
                          disabled={activeClients.length === 0}
                          onClick={() => setAssignPlan(plan)}
                        >
                          <Users className="h-4 w-4" />
                          Atribuir a alunos...
                        </GoldButton>
                      ) : (
                        <SecondaryButton
                          fullWidth
                          disabled={activeClients.length <= 1}
                          onClick={() => setAssignPlan(plan)}
                        >
                          <Users className="h-4 w-4" />
                          Adicionar a mais alunos
                        </SecondaryButton>
                      )}
                    </div>
                      </>
                    )}
                  </BrandCard>
                );
              })}
            </div>
          )}

          {plansViewMode === 'client' && effectiveClient && clientFeedback.length > 0 && (
            <PtRecentFeedbackCard
              clientName={effectiveClient.name}
              feedbackItems={clientFeedback}
              onDelete={async (id) => {
                await repo.deleteWorkoutFeedback(uid, id);
                onBanner('Feedback removido.');
              }}
            />
          )}

          {showNewPlan && (
            <NewPlanModal
              clients={activeClients}
              initialClientId={plansViewMode === 'client' ? effectiveClient?.id || '' : ''}
              defaultUnassigned={plansViewMode === 'drafts' || activeClients.length === 0}
              onClose={() => setShowNewPlan(false)}
              onCreate={async (selectedIds, title, split, availableFromDate) => {
                const count = await repo.createWorkoutPlansForClients(
                  uid,
                  selectedIds,
                  title,
                  split,
                  availableFromDate
                );
                setShowNewPlan(false);
                if (selectedIds.length === 0) {
                  setPlansViewMode('drafts');
                  onBanner('Plano guardado em "Sem Aluno / Modelos"!');
                } else {
                  setPlansViewMode('client');
                  if (!effectiveClient || !selectedIds.includes(effectiveClient.id)) {
                    setSelectedClientId(selectedIds[0]);
                  }
                  const schedSuffix = availableFromDate
                    ? ` (visível a ${formatIsoPt(availableFromDate)})`
                    : '';
                  onBanner(
                    count > 1
                      ? `Plano de treino criado para ${count} alunos${schedSuffix}!`
                      : `Plano de treino criado${schedSuffix}!`
                  );
                }
              }}
            />
          )}

          {assignPlan && (
            <AssignPlanToClientsModal
              plan={assignPlan}
              clients={
                !assignPlan.clientId || !assignPlan.clientId.trim()
                  ? activeClients
                  : activeClients.filter((c) => c.id !== assignPlan.clientId)
              }
              itemCount={workoutPlanItems.filter((i) => i.planId === assignPlan.id).length}
              onClose={() => setAssignPlan(null)}
              onAssign={async (targetIds, availableFromDate) => {
                const count = await repo.assignWorkoutPlanToClients(
                  uid,
                  assignPlan,
                  workoutPlanItems,
                  targetIds,
                  availableFromDate
                );
                setAssignPlan(null);
                const schedSuffix = availableFromDate
                  ? ` (visível a ${formatIsoPt(availableFromDate)})`
                  : '';
                onBanner(
                  count === 1
                    ? `Plano atribuído a 1 aluno${schedSuffix}!`
                    : `Plano atribuído a ${count} alunos${schedSuffix}!`
                );
              }}
            />
          )}

          {schedulePlan && (
            <SchedulePlanModal
              plan={schedulePlan}
              todayIso={todayIso}
              onClose={() => setSchedulePlan(null)}
              onSave={async (availableFromDate) => {
                await repo.updateWorkoutPlanSchedule(uid, schedulePlan.id, availableFromDate);
                setSchedulePlan(null);
                onBanner(
                  availableFromDate
                    ? `Acesso agendado para ${formatIsoPt(availableFromDate)}.`
                    : 'Plano disponibilizado imediatamente ao aluno!'
                );
              }}
            />
          )}

          {targetPlan && (() => {
            const sortedPlanItems = workoutPlanItems
              .filter((i) => i.planId === targetPlan.id)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            const previousExercise = sortedPlanItems[sortedPlanItems.length - 1] || null;
            return (
              <AddExerciseToPlanModal
                planTitle={targetPlan.title}
                exercises={exercises}
                previousExercise={previousExercise}
                onClose={() => setTargetPlan(null)}
                onAdd={async (exercise, sets, reps, load, rest, notes, groupWithPrevious) => {
                  const nextOrder =
                    sortedPlanItems.reduce((m, i) => Math.max(m, i.orderIndex), -1) + 1;
                  await repo.addExerciseToPlan(
                    uid,
                    targetPlan.id,
                    exercise,
                    sets,
                    reps,
                    load,
                    rest,
                    notes,
                    nextOrder,
                    groupWithPrevious ? previousExercise : null
                  );
                  setTargetPlan(null);
                  onBanner(
                    groupWithPrevious && previousExercise
                      ? `Exercício agrupado sem descanso com "${previousExercise.exerciseName}"!`
                      : 'Exercício adicionado ao plano.'
                  );
                }}
              />
            );
          })()}

          {historyItem && (
            <ExerciseProgressModal
              open
              clientId={historyItem.clientId}
              clientName={effectiveClient?.name}
              exerciseId={historyItem.item.exerciseId}
              exerciseName={historyItem.item.exerciseName}
              currentLoadKg={historyItem.item.loadKg}
              lastLoadKg={historyItem.item.lastLoadKg}
              lastLoggedAtMillis={historyItem.item.lastLoggedAtMillis}
              workoutLoadLogs={workoutLoadLogs}
              onClose={() => setHistoryItem(null)}
            />
          )}
        </div>
      ) : subTab === 'marcacoes' ? (
        <PtTrainingMarcacoesView
          uid={uid}
          clients={clients}
          weeks={weeks}
          activeWeek={activeWeek}
          sessions={sessions}
          bookings={bookings}
          templates={templates}
          settings={settings}
          selectedClientId={effectiveClient?.id || ''}
          onSelectClient={(cid) => setSelectedClientId(cid)}
          onShiftWeek={onShiftWeek}
          onOpenWhatsApp={onOpenWhatsApp}
          onBanner={onBanner}
        />
      ) : subTab === 'agenda' ? (
        <PtTrainingAgendaView
          uid={uid}
          clients={clients}
          weeks={weeks}
          sessions={sessions}
          bookings={bookings}
          onOpenClientPlan={(cid) => {
            setSelectedClientId(cid);
            setSubTab('plans');
          }}
          onBanner={onBanner}
        />
      ) : (
        <ExerciseLibraryView uid={uid} exercises={exercises} onBanner={onBanner} />
      )}
    </div>
  );
};

const ExerciseLibraryView: React.FC<{
  uid: string;
  exercises: ExerciseRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, exercises, onBanner }) => {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('Todos');
  const [showAdd, setShowAdd] = useState(false);

  const groups = useMemo(
    () => ['Todos', ...Array.from(new Set(exercises.map((e) => e.muscleGroup))).sort()],
    [exercises]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (group === 'Todos' || e.muscleGroup === group) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.equipment.toLowerCase().includes(q) ||
          e.muscleGroup.toLowerCase().includes(q) ||
          e.instructions.toLowerCase().includes(q))
    );
  }, [exercises, group, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#F4F4F5]">Biblioteca de Exercícios</h2>
          <p className="text-xs text-[#A1A1AA]">
            {filtered.length} de {exercises.length} exercício(s)
          </p>
        </div>
        <GoldButton onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Acrescentar
        </GoldButton>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar exercício, nome EN, músculo ou equipamento..."
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              group === g
                ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {filtered.map((ex) => {
          const videoMatch = ex.instructions.match(/https:\/\/\S+/);
          const videoUrl = videoMatch ? videoMatch[0] : '';
          const cleanInstr = ex.instructions
            .replace(/\s*·?\s*Vídeo:\s*https:\/\/\S+/i, '')
            .replace(/https:\/\/\S+/g, '')
            .trim();
          return (
            <div
              key={ex.id}
              className="flex items-start justify-between gap-2 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-4"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#F4F4F5]">{ex.name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone="gold">{ex.muscleGroup}</StatusPill>
                  {ex.equipment && <StatusPill>{ex.equipment}</StatusPill>}
                  {ex.custom && <StatusPill tone="blue">Personalizado</StatusPill>}
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-[#EAB308]/40 bg-[#3D3314]/60 px-2 py-0.5 text-[11px] font-bold text-[#FACC15] hover:bg-[#52441A]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Vídeo
                    </a>
                  )}
                </div>
                {cleanInstr && (
                  <p className="mt-2 text-xs text-[#A1A1AA]">{cleanInstr}</p>
                )}
              </div>
              {ex.custom && (
                <button
                  type="button"
                  onClick={async () => {
                    await repo.deleteExercise(uid, ex.id);
                    onBanner('Exercício apagado.');
                  }}
                  className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddCustomExerciseModal
          onClose={() => setShowAdd(false)}
          onSave={async (name, grp, equip, instr) => {
            await repo.addCustomExercise(uid, name, grp, equip, instr);
            setShowAdd(false);
            onBanner('Exercício acrescentado!');
          }}
        />
      )}
    </div>
  );
};

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIsoDate(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextMondayIsoDate(): string {
  const dt = new Date();
  const dow = dt.getDay(); // 0=Sun..6=Sat
  const daysUntilMonday = dow === 1 ? 7 : dow === 0 ? 1 : 8 - dow;
  dt.setDate(dt.getDate() + daysUntilMonday);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIsoPt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const AccessSchedulePicker: React.FC<{
  isScheduled: boolean;
  onIsScheduledChange: (val: boolean) => void;
  selectedDate: string;
  onSelectedDateChange: (val: string) => void;
}> = ({ isScheduled, onIsScheduledChange, selectedDate, onSelectedDateChange }) => {
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const tomorrowIso = useMemo(() => addDaysIsoDate(1), []);
  const nextMonIso = useMemo(() => nextMondayIsoDate(), []);
  const plus7Iso = useMemo(() => addDaysIsoDate(7), []);

  return (
    <div className="space-y-2 rounded-xl border border-[#323238] bg-[#1B1B1E] p-3">
      <FieldLabel>Acesso do aluno</FieldLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onIsScheduledChange(false)}
          className={`min-h-[36px] rounded-xl border text-xs font-bold transition ${
            !isScheduled
              ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
              : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
          }`}
        >
          Imediato
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedDate) onSelectedDateChange(tomorrowIso);
            onIsScheduledChange(true);
          }}
          className={`min-h-[36px] rounded-xl border text-xs font-bold transition ${
            isScheduled
              ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
              : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
          }`}
        >
          Agendar dia
        </button>
      </div>
      {isScheduled && (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Amanhã', value: tomorrowIso },
              { label: 'Próx. Segunda', value: nextMonIso },
              { label: '+7 dias', value: plus7Iso },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onSelectedDateChange(preset.value)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                  selectedDate === preset.value
                    ? 'border-[#F59E0B] bg-[#F59E0B] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            min={todayIso}
            value={selectedDate || tomorrowIso}
            onChange={(e) => onSelectedDateChange(e.target.value)}
            className="w-full rounded-xl border border-[#F59E0B]/50 bg-[#242429] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
          />
          <p className="text-[11px] text-[#A1A1AA]">
            O aluno só verá este plano a partir do dia{' '}
            <span className="font-semibold text-[#FACC15]">
              {formatIsoPt(selectedDate || tomorrowIso)}
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
};

const NewPlanModal: React.FC<{
  clients: ClientRecord[];
  initialClientId: string;
  defaultUnassigned?: boolean;
  onClose: () => void;
  onCreate: (
    clientIds: string[],
    title: string,
    split: string,
    availableFromDate: string
  ) => Promise<void>;
}> = ({ clients, initialClientId, defaultUnassigned = false, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [split, setSplit] = useState('Treino A · Corpo Inteiro');
  const [assignNow, setAssignNow] = useState(!defaultUnassigned && clients.length > 0);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialClientId ? [initialClientId] : clients[0] ? [clients[0].id] : []
  );
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => addDaysIsoDate(1));

  const toggleClient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = clients.length > 0 && selectedIds.length === clients.length;
  const canSubmit = Boolean(title.trim()) && (!assignNow || selectedIds.length > 0);

  return (
    <Modal open title="Novo Plano de Treino" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Nome do Plano</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Hipertrofia 3x"
          />
        </div>
        <div>
          <FieldLabel>Divisão / Dia</FieldLabel>
          <Input value={split} onChange={(e) => setSplit(e.target.value)} />
        </div>

        <div>
          <FieldLabel>Destino do plano</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setAssignNow(false)}
              className={`min-h-[38px] rounded-xl border text-xs font-bold transition ${
                !assignNow
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
              }`}
            >
              Guardar sem aluno
            </button>
            <button
              type="button"
              disabled={clients.length === 0}
              onClick={() => setAssignNow(true)}
              className={`min-h-[38px] rounded-xl border text-xs font-bold transition disabled:opacity-40 ${
                assignNow
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
              }`}
            >
              Atribuir já a alunos
            </button>
          </div>
        </div>

        {!assignNow ? (
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3 text-xs text-[#A1A1AA]">
            O plano fica guardado em <strong className="text-[#F4F4F5]">Sem Aluno / Modelos</strong>{' '}
            para adicionares exercícios primeiro e atribuíres aos alunos mais tarde (com data
            agendada se quiseres).
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <FieldLabel>Alunos ({selectedIds.length} selecionado(s))</FieldLabel>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(allSelected ? [] : clients.map((c) => c.id))
                  }
                  className="text-xs font-bold text-[#FACC15] hover:underline"
                >
                  {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
                {clients.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between gap-2.5 px-3 py-2 text-xs hover:bg-[#2E2E35]"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClient(c.id)}
                          className="h-4 w-4 accent-[#EAB308]"
                        />
                        <span className="font-semibold text-[#F4F4F5]">{c.name}</span>
                      </span>
                      <StatusPill tone={c.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}>
                        {c.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
                      </StatusPill>
                    </label>
                  );
                })}
              </div>
            </div>

            <AccessSchedulePicker
              isScheduled={isScheduled}
              onIsScheduledChange={setIsScheduled}
              selectedDate={scheduledDate}
              onSelectedDateChange={setScheduledDate}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!canSubmit}
            onClick={() =>
              onCreate(
                assignNow ? selectedIds : [],
                title,
                split,
                assignNow && isScheduled ? scheduledDate : ''
              )
            }
          >
            {!assignNow
              ? 'Guardar sem aluno'
              : selectedIds.length > 1
              ? `Criar para ${selectedIds.length} alunos`
              : 'Criar Plano'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const AssignPlanToClientsModal: React.FC<{
  plan: WorkoutPlanRecord;
  clients: ClientRecord[];
  itemCount: number;
  onClose: () => void;
  onAssign: (targetClientIds: string[], availableFromDate: string) => Promise<void>;
}> = ({ plan, clients, itemCount, onClose, onAssign }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => addDaysIsoDate(1));
  const [saving, setSaving] = useState(false);

  const toggleClient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = clients.length > 0 && selectedIds.length === clients.length;
  const isDraft = !plan.clientId || !plan.clientId.trim();

  return (
    <Modal
      open
      title={isDraft ? 'Atribuir Plano a Alunos' : 'Adicionar Plano a Mais Alunos'}
      subtitle={`${plan.title} · ${itemCount} exercício(s) serão copiados`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Cada aluno selecionado recebe uma cópia independente deste plano (incluindo todos os
          exercícios) para poder registar as suas próprias cargas.
        </p>
        {clients.length === 0 ? (
          <p className="text-xs text-[#A1A1AA]">Não existem alunos ativos disponíveis.</p>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <FieldLabel>Escolher alunos ({selectedIds.length})</FieldLabel>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(allSelected ? [] : clients.map((c) => c.id))
                  }
                  className="text-xs font-bold text-[#FACC15] hover:underline"
                >
                  {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
                {clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center justify-between gap-2.5 px-3 py-2 text-xs hover:bg-[#2E2E35]"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleClient(c.id)}
                        className="h-4 w-4 accent-[#EAB308]"
                      />
                      <span className="font-semibold text-[#F4F4F5]">{c.name}</span>
                    </span>
                    <StatusPill tone={c.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}>
                      {c.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
                    </StatusPill>
                  </label>
                ))}
              </div>
            </div>

            <AccessSchedulePicker
              isScheduled={isScheduled}
              onIsScheduledChange={setIsScheduled}
              selectedDate={scheduledDate}
              onSelectedDateChange={setScheduledDate}
            />
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={selectedIds.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onAssign(selectedIds, isScheduled ? scheduledDate : '');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? 'A guardar...'
              : `${isDraft ? 'Atribuir' : 'Adicionar'} a ${selectedIds.length || ''} aluno(s)`}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const SchedulePlanModal: React.FC<{
  plan: WorkoutPlanRecord;
  todayIso: string;
  onClose: () => void;
  onSave: (availableFromDate: string) => Promise<void>;
}> = ({ plan, todayIso, onClose, onSave }) => {
  const existingDate = (plan.availableFromDate || '').trim();
  const initialScheduled =
    /^\d{4}-\d{2}-\d{2}$/.test(existingDate) && existingDate > todayIso;
  const [isScheduled, setIsScheduled] = useState(initialScheduled);
  const [scheduledDate, setScheduledDate] = useState(
    initialScheduled ? existingDate : addDaysIsoDate(1)
  );
  const [saving, setSaving] = useState(false);

  return (
    <Modal open title="Agendar Acesso do Aluno" subtitle={plan.title} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Escolhe se este plano fica visível de imediato ou apenas a partir de uma data específica.
        </p>
        <AccessSchedulePicker
          isScheduled={isScheduled}
          onIsScheduledChange={setIsScheduled}
          selectedDate={scheduledDate}
          onSelectedDateChange={setScheduledDate}
        />
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(isScheduled ? scheduledDate : '');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'A guardar...' : isScheduled ? 'Guardar data' : 'Libertar agora'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const AddExerciseToPlanModal: React.FC<{
  planTitle: string;
  exercises: ExerciseRecord[];
  previousExercise?: WorkoutPlanItemRecord | null;
  onClose: () => void;
  onAdd: (
    ex: ExerciseRecord,
    sets: number,
    reps: string,
    load: string,
    rest: number,
    notes: string,
    groupWithPrevious: boolean
  ) => Promise<void>;
}> = ({ planTitle, exercises, previousExercise, onClose, onAdd }) => {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('Todos');
  const groups = useMemo(
    () => ['Todos', ...Array.from(new Set(exercises.map((e) => e.muscleGroup))).sort()],
    [exercises]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (groupFilter === 'Todos' || e.muscleGroup === groupFilter) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.muscleGroup.toLowerCase().includes(q) ||
          e.equipment.toLowerCase().includes(q) ||
          e.instructions.toLowerCase().includes(q))
    );
  }, [exercises, groupFilter, search]);
  const [selectedId, setSelectedId] = useState(exercises[0]?.id || '');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10-12');
  const [load, setLoad] = useState('');
  const [rest, setRest] = useState('90');
  const [notes, setNotes] = useState('');
  const [groupWithPrevious, setGroupWithPrevious] = useState(false);

  const selected = filtered.find((e) => e.id === selectedId) || filtered[0] || null;

  return (
    <Modal open title={`Adicionar a ${planTitle}`} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar exercício, músculo ou equipamento..."
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                groupFilter === g
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
          {filtered.map((ex) => (
            <label
              key={ex.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-[#2E2E35]"
            >
              <input
                type="radio"
                name="ex_pick"
                checked={selected?.id === ex.id}
                onChange={() => setSelectedId(ex.id)}
                className="accent-[#EAB308]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#F4F4F5]">{ex.name}</p>
                <p className="text-[11px] text-[#EAB308]">
                  {ex.muscleGroup}
                  {ex.equipment ? ` · ${ex.equipment}` : ''}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Séries</FieldLabel>
            <Input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Repetições</FieldLabel>
            <Input value={reps} onChange={(e) => setReps(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Carga (ex: 40 kg)</FieldLabel>
            <Input value={load} onChange={(e) => setLoad(e.target.value)} />
          </div>
          <div>
            <FieldLabel>{groupWithPrevious ? 'Descanso após bloco (s)' : 'Descanso (s)'}</FieldLabel>
            <Input type="number" value={rest} onChange={(e) => setRest(e.target.value)} />
          </div>
        </div>
        {previousExercise && (
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
              groupWithPrevious
                ? 'border-[#EAB308] bg-[#EAB308]/10'
                : 'border-[#323238] bg-[#242429] hover:border-[#EAB308]/50'
            }`}
          >
            <input
              type="checkbox"
              checked={groupWithPrevious}
              onChange={(e) => setGroupWithPrevious(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#EAB308]"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-bold ${
                  groupWithPrevious ? 'text-[#FACC15]' : 'text-[#F4F4F5]'
                }`}
              >
                Agrupar com o anterior ({previousExercise.exerciseName})
              </p>
              <p className="text-[11px] text-[#A1A1AA]">
                Executar os 2 exercícios seguidos sem descanso entre eles.
              </p>
            </div>
          </label>
        )}
        <div>
          <FieldLabel>Observações técnicas</FieldLabel>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!selected}
            onClick={() =>
              selected &&
              onAdd(
                selected,
                Math.max(1, Number(sets) || 3),
                reps || '10-12',
                load,
                Math.max(0, Number(rest) || 90),
                notes,
                groupWithPrevious
              )
            }
          >
            {groupWithPrevious ? 'Adicionar em Bi-set' : 'Adicionar'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const AddCustomExerciseModal: React.FC<{
  onClose: () => void;
  onSave: (name: string, group: string, equip: string, instructions: string) => Promise<void>;
}> = ({ onClose, onSave }) => {
  const groups = DEFAULT_MUSCLE_GROUPS;
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Peito');
  const [equip, setEquip] = useState('Halteres');
  const [instr, setInstr] = useState('');

  return (
    <Modal open title="Acrescentar Exercício" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Nome do exercício</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Grupo muscular</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  group === g
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Equipamento</FieldLabel>
          <Input value={equip} onChange={(e) => setEquip(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Notas / Execução</FieldLabel>
          <Textarea rows={2} value={instr} onChange={(e) => setInstr(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton disabled={!name.trim()} onClick={() => onSave(name, group, equip, instr)}>
            Guardar Exercício
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
