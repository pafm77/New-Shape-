import React, { useMemo, useState } from 'react';
import { Dumbbell, ExternalLink, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  ExerciseRecord,
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

  const [showNewPlan, setShowNewPlan] = useState(false);
  const [targetPlan, setTargetPlan] = useState<WorkoutPlanRecord | null>(null);
  const [assignPlan, setAssignPlan] = useState<WorkoutPlanRecord | null>(null);
  const [historyItem, setHistoryItem] = useState<{
    item: WorkoutPlanItemRecord;
    clientId: string;
  } | null>(null);

  const clientPlans = useMemo(
    () =>
      effectiveClient
        ? workoutPlans.filter((p) => p.clientId === effectiveClient.id)
        : [],
    [workoutPlans, effectiveClient]
  );

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
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
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
              <GoldButton disabled={!effectiveClient} onClick={() => setShowNewPlan(true)}>
                <Plus className="h-4 w-4" />
                Novo Plano de Treino
              </GoldButton>
            </div>
          </BrandCard>

          {clientPlans.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="h-6 w-6" />}
              title="Sem planos atribuídos"
              subtitle={`Cria um plano para ${effectiveClient?.name || 'este aluno'} e escolhe exercícios da biblioteca.`}
            />
          ) : (
            <div className="space-y-4">
              {clientPlans.map((plan) => {
                const items = workoutPlanItems
                  .filter((i) => i.planId === plan.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                return (
                  <BrandCard key={plan.id} highlight>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-[#F4F4F5]">{plan.title}</h3>
                        {plan.splitLabel && (
                          <p className="text-xs font-semibold text-[#FACC15]">{plan.splitLabel}</p>
                        )}
                      </div>
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

                    <div className="my-3 border-t border-[#323238]" />

                    {items.length === 0 ? (
                      <p className="text-xs text-[#A1A1AA]">Ainda sem exercícios neste plano.</p>
                    ) : (
                      <div className="divide-y divide-[#323238]/60">
                        {items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-sm font-bold text-[#F4F4F5]">
                                {idx + 1}. {item.exerciseName}
                              </p>
                              <p className="text-xs font-medium text-[#EAB308]">
                                {item.sets} séries × {item.reps}
                                {item.loadKg ? ` · ${item.loadKg}` : ''} · Descanso{' '}
                                {item.restSeconds}s
                              </p>
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
                              {item.notes && (
                                <p className="text-xs text-[#A1A1AA]">{item.notes}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => repo.removeExerciseFromPlan(uid, item.id)}
                              className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <SecondaryButton fullWidth onClick={() => setTargetPlan(plan)}>
                        <Plus className="h-4 w-4" />
                        Adicionar Exercício
                      </SecondaryButton>
                      <SecondaryButton
                        fullWidth
                        disabled={activeClients.length <= 1}
                        onClick={() => setAssignPlan(plan)}
                      >
                        <Users className="h-4 w-4" />
                        Adicionar a mais alunos
                      </SecondaryButton>
                    </div>
                  </BrandCard>
                );
              })}
            </div>
          )}

          {effectiveClient && clientFeedback.length > 0 && (
            <PtRecentFeedbackCard
              clientName={effectiveClient.name}
              feedbackItems={clientFeedback}
              onDelete={async (id) => {
                await repo.deleteWorkoutFeedback(uid, id);
                onBanner('Feedback removido.');
              }}
            />
          )}

          {showNewPlan && effectiveClient && (
            <NewPlanModal
              clients={activeClients}
              initialClientId={effectiveClient.id}
              onClose={() => setShowNewPlan(false)}
              onCreate={async (selectedIds, title, split) => {
                const count = await repo.createWorkoutPlansForClients(
                  uid,
                  selectedIds,
                  title,
                  split
                );
                setShowNewPlan(false);
                onBanner(
                  count > 1
                    ? `Plano de treino criado para ${count} alunos!`
                    : 'Plano de treino criado!'
                );
              }}
            />
          )}

          {assignPlan && (
            <AssignPlanToClientsModal
              plan={assignPlan}
              clients={activeClients.filter((c) => c.id !== assignPlan.clientId)}
              itemCount={workoutPlanItems.filter((i) => i.planId === assignPlan.id).length}
              onClose={() => setAssignPlan(null)}
              onAssign={async (targetIds) => {
                const count = await repo.assignWorkoutPlanToClients(
                  uid,
                  assignPlan,
                  workoutPlanItems,
                  targetIds
                );
                setAssignPlan(null);
                onBanner(
                  count === 1
                    ? 'Plano copiado para 1 aluno!'
                    : `Plano copiado para ${count} alunos!`
                );
              }}
            />
          )}

          {targetPlan && (
            <AddExerciseToPlanModal
              planTitle={targetPlan.title}
              exercises={exercises}
              onClose={() => setTargetPlan(null)}
              onAdd={async (exercise, sets, reps, load, rest, notes) => {
                const count = workoutPlanItems.filter((i) => i.planId === targetPlan.id).length;
                await repo.addExerciseToPlan(
                  uid,
                  targetPlan.id,
                  exercise,
                  sets,
                  reps,
                  load,
                  rest,
                  notes,
                  count
                );
                setTargetPlan(null);
                onBanner('Exercício adicionado ao plano.');
              }}
            />
          )}

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

const NewPlanModal: React.FC<{
  clients: ClientRecord[];
  initialClientId: string;
  onClose: () => void;
  onCreate: (clientIds: string[], title: string, split: string) => Promise<void>;
}> = ({ clients, initialClientId, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [split, setSplit] = useState('Treino A · Corpo Inteiro');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialClientId ? [initialClientId] : clients[0] ? [clients[0].id] : []
  );

  const toggleClient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = clients.length > 0 && selectedIds.length === clients.length;

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
          <div className="max-h-44 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
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
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!title.trim() || selectedIds.length === 0}
            onClick={() => onCreate(selectedIds, title, split)}
          >
            {selectedIds.length > 1
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
  onAssign: (targetClientIds: string[]) => Promise<void>;
}> = ({ plan, clients, itemCount, onClose, onAssign }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleClient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = clients.length > 0 && selectedIds.length === clients.length;

  return (
    <Modal
      open
      title="Adicionar Plano a Mais Alunos"
      subtitle={`${plan.title} · ${itemCount} exercício(s) serão copiados`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Cada aluno selecionado recebe uma cópia independente deste plano (incluindo todos os
          exercícios) para poder registar as suas próprias cargas.
        </p>
        {clients.length === 0 ? (
          <p className="text-xs text-[#A1A1AA]">Não existem outros alunos ativos disponíveis.</p>
        ) : (
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
            <div className="max-h-52 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
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
        )}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={selectedIds.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onAssign(selectedIds);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? 'A copiar...'
              : `Adicionar a ${selectedIds.length || ''} aluno(s)`}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const AddExerciseToPlanModal: React.FC<{
  planTitle: string;
  exercises: ExerciseRecord[];
  onClose: () => void;
  onAdd: (
    ex: ExerciseRecord,
    sets: number,
    reps: string,
    load: string,
    rest: number,
    notes: string
  ) => Promise<void>;
}> = ({ planTitle, exercises, onClose, onAdd }) => {
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
            <FieldLabel>Descanso (s)</FieldLabel>
            <Input type="number" value={rest} onChange={(e) => setRest(e.target.value)} />
          </div>
        </div>
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
                notes
              )
            }
          >
            Adicionar
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
