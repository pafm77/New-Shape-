import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, History, TrendingUp } from 'lucide-react';
import {
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { formatShortDate } from '../data/seedCatalog';
import { Modal, SecondaryButton, StatusPill } from './UiPrimitives';
import { parseNumericLoadKg } from './ExerciseLastLoadBadge';

export function normalizeExerciseKey(exerciseId: string, exerciseName: string): string {
  const cleanName = exerciseName.trim().toLowerCase().replace(/\s+/g, ' ');
  return cleanName || exerciseId.trim().toLowerCase();
}

export interface ExercisePrEntry {
  exerciseName: string;
  prKg: number;
  prLabel: string;
  prDateMillis: number;
  latestKg: number;
  latestLabel: string;
  entriesCount: number;
}

/**
 * Computes each exercise's Personal Record (PR) and latest load for a given student
 * across both `workout_load_logs` and current/previous `workout_plan_items`.
 */
export function computeClientExercisePrs(params: {
  clientId: string;
  workoutLoadLogs: WorkoutLoadLogRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
}): Map<string, ExercisePrEntry> {
  const { clientId, workoutLoadLogs, workoutPlans, workoutPlanItems } = params;
  const map = new Map<string, ExercisePrEntry>();

  const registerPoint = (
    exerciseId: string,
    exerciseName: string,
    loadLabel: string,
    numericKg: number,
    ts: number
  ) => {
    if (!exerciseName.trim() || !loadLabel.trim() || numericKg <= 0) return;
    const key = normalizeExerciseKey(exerciseId, exerciseName);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        exerciseName: exerciseName.trim(),
        prKg: numericKg,
        prLabel: loadLabel.trim(),
        prDateMillis: ts,
        latestKg: numericKg,
        latestLabel: loadLabel.trim(),
        entriesCount: 1,
      });
      return;
    }
    const nextPr = numericKg > existing.prKg;
    map.set(key, {
      exerciseName: existing.exerciseName,
      prKg: nextPr ? numericKg : existing.prKg,
      prLabel: nextPr ? loadLabel.trim() : existing.prLabel,
      prDateMillis: nextPr ? ts : existing.prDateMillis,
      latestKg: ts >= existing.prDateMillis ? numericKg : existing.latestKg,
      latestLabel: ts >= existing.prDateMillis ? loadLabel.trim() : existing.latestLabel,
      entriesCount: existing.entriesCount + 1,
    });
  };

  workoutLoadLogs
    .filter((l) => l.clientId === clientId)
    .sort((a, b) => a.loggedAtMillis - b.loggedAtMillis)
    .forEach((l) => {
      const kg = l.numericKg > 0 ? l.numericKg : parseNumericLoadKg(l.loadKg) ?? 0;
      registerPoint(l.exerciseId, l.exerciseName, l.loadKg, kg, l.loggedAtMillis);
    });

  const clientPlanIds = new Set(
    workoutPlans.filter((p) => p.clientId === clientId).map((p) => p.id)
  );
  workoutPlanItems
    .filter((i) => clientPlanIds.has(i.planId))
    .forEach((item) => {
      const currentKg = parseNumericLoadKg(item.loadKg) ?? 0;
      const lastKg = parseNumericLoadKg(item.lastLoadKg) ?? 0;
      const key = normalizeExerciseKey(item.exerciseId, item.exerciseName);
      const alreadyHasLogs = map.has(key);
      if (!alreadyHasLogs) {
        if (lastKg > 0 && item.lastLoadKg) {
          registerPoint(
            item.exerciseId,
            item.exerciseName,
            item.lastLoadKg,
            lastKg,
            Math.max(0, (item.lastLoggedAtMillis || Date.now()) - 86_400_000)
          );
        }
        if (currentKg > 0 && item.loadKg) {
          registerPoint(
            item.exerciseId,
            item.exerciseName,
            item.loadKg,
            currentKg,
            item.lastLoggedAtMillis || Date.now()
          );
        }
      } else {
        // Still update PR if current item's loadKg exceeds logged PR
        const existing = map.get(key)!;
        if (currentKg > existing.prKg && item.loadKg) {
          map.set(key, {
            ...existing,
            prKg: currentKg,
            prLabel: item.loadKg.trim(),
            prDateMillis: item.lastLoggedAtMillis || Date.now(),
          });
        }
      }
    });

  return map;
}

interface ExerciseProgressModalProps {
  open: boolean;
  clientId: string;
  clientName?: string;
  exerciseId: string;
  exerciseName: string;
  currentLoadKg?: string;
  lastLoadKg?: string;
  lastLoggedAtMillis?: number;
  workoutLoadLogs: WorkoutLoadLogRecord[];
  onClose: () => void;
}

export const ExerciseProgressModal: React.FC<ExerciseProgressModalProps> = ({
  open,
  clientId,
  clientName,
  exerciseId,
  exerciseName,
  currentLoadKg,
  lastLoadKg,
  lastLoggedAtMillis,
  workoutLoadLogs,
  onClose,
}) => {
  const targetKey = normalizeExerciseKey(exerciseId, exerciseName);

  const historyPoints = useMemo(() => {
    const matched = workoutLoadLogs
      .filter(
        (l) =>
          l.clientId === clientId &&
          ((exerciseId && l.exerciseId && l.exerciseId === exerciseId) ||
            normalizeExerciseKey(l.exerciseId, l.exerciseName) === targetKey)
      )
      .sort((a, b) => a.loggedAtMillis - b.loggedAtMillis)
      .map((l) => {
        const kg = l.numericKg > 0 ? l.numericKg : parseNumericLoadKg(l.loadKg) ?? 0;
        return {
          id: l.id,
          dateLabel: formatShortDate(l.loggedAtMillis),
          loggedAtMillis: l.loggedAtMillis,
          loadKg: l.loadKg,
          kg,
        };
      });

    if (matched.length > 0) return matched;

    // Synthesize fallback points from item fields if no dedicated log yet
    const fallback: Array<{
      id: string;
      dateLabel: string;
      loggedAtMillis: number;
      loadKg: string;
      kg: number;
    }> = [];
    const lastKgNum = parseNumericLoadKg(lastLoadKg);
    const curKgNum = parseNumericLoadKg(currentLoadKg);
    if (lastLoadKg && lastKgNum !== null && lastLoadKg.trim() !== currentLoadKg?.trim()) {
      fallback.push({
        id: 'fallback_prev',
        dateLabel: 'Anterior',
        loggedAtMillis: Math.max(0, (lastLoggedAtMillis || Date.now()) - 86_400_000),
        loadKg: lastLoadKg.trim(),
        kg: lastKgNum,
      });
    }
    if (currentLoadKg && curKgNum !== null) {
      fallback.push({
        id: 'fallback_cur',
        dateLabel: lastLoggedAtMillis ? formatShortDate(lastLoggedAtMillis) : 'Atual',
        loggedAtMillis: lastLoggedAtMillis || Date.now(),
        loadKg: currentLoadKg.trim(),
        kg: curKgNum,
      });
    }
    return fallback;
  }, [workoutLoadLogs, clientId, exerciseId, targetKey, currentLoadKg, lastLoadKg, lastLoggedAtMillis]);

  const numericPoints = historyPoints.filter((p) => p.kg > 0);
  const prPoint = useMemo(() => {
    if (numericPoints.length === 0) return null;
    return numericPoints.reduce((best, cur) => (cur.kg >= best.kg ? cur : best), numericPoints[0]);
  }, [numericPoints]);

  const firstKg = numericPoints[0]?.kg ?? null;
  const latestKg = numericPoints[numericPoints.length - 1]?.kg ?? null;
  const evolutionDelta =
    firstKg !== null && latestKg !== null && numericPoints.length >= 2
      ? Number((latestKg - firstKg).toFixed(1))
      : null;

  return (
    <Modal
      open={open}
      title="Evolução de Cargas & Recorde (PR)"
      subtitle={clientName ? `${exerciseName} · ${clientName}` : exerciseName}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-[#EAB308]/50 bg-[#3D3314]/50 p-3">
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#FACC15]">
              <Award className="h-3.5 w-3.5" />
              Recorde (PR)
            </p>
            <p className="mt-1 text-lg font-extrabold text-[#FACC15]">
              {prPoint ? `${prPoint.kg} kg` : '—'}
            </p>
            <p className="text-[10px] text-[#A1A1AA]">
              {prPoint ? prPoint.dateLabel : 'Sem registo'}
            </p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#A1A1AA]">
              Última Carga
            </p>
            <p className="mt-1 text-lg font-extrabold text-[#F4F4F5]">
              {latestKg !== null ? `${latestKg} kg` : currentLoadKg || '—'}
            </p>
            <p className="text-[10px] text-[#A1A1AA]">
              {historyPoints.length} registo(s)
            </p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#A1A1AA]">
              <TrendingUp className="h-3.5 w-3.5" />
              Evolução
            </p>
            <p
              className={`mt-1 text-lg font-extrabold ${
                evolutionDelta === null
                  ? 'text-[#A1A1AA]'
                  : evolutionDelta > 0
                  ? 'text-[#22C55E]'
                  : evolutionDelta < 0
                  ? 'text-[#F59E0B]'
                  : 'text-[#F4F4F5]'
              }`}
            >
              {evolutionDelta === null
                ? '—'
                : evolutionDelta > 0
                ? `+${evolutionDelta} kg`
                : `${evolutionDelta} kg`}
            </p>
            <p className="text-[10px] text-[#A1A1AA]">1.º → último</p>
          </div>
        </div>

        {numericPoints.length >= 2 ? (
          <div className="rounded-xl border border-[#323238] bg-[#18181B] p-3">
            <p className="mb-2 text-xs font-bold text-[#F4F4F5]">Progressão de Carga (kg)</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={numericPoints} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#2E2E35" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="#A1A1AA"
                    tick={{ fill: '#A1A1AA', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#A1A1AA"
                    tick={{ fill: '#A1A1AA', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit=" kg"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1B1B1E',
                      borderColor: '#EAB308',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F4F4F5',
                    }}
                    formatter={(value: unknown) => [`${value} kg`, 'Carga']}
                  />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke="#EAB308"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#FACC15', stroke: '#121214', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#FACC15' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#323238] bg-[#242429]/60 p-4 text-center text-xs text-[#A1A1AA]">
            <History className="mx-auto mb-1.5 h-5 w-5 text-[#EAB308]" />
            Regista pelo menos 2 cargas ao longo das sessões para visualizar o gráfico de evolução.
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#A1A1AA]">
            Histórico Cronológico
          </p>
          {historyPoints.length === 0 ? (
            <p className="text-xs text-[#71717A]">Ainda sem registos de carga para este exercício.</p>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {historyPoints
                .slice()
                .reverse()
                .map((p) => {
                  const isPr = prPoint && p.kg > 0 && p.kg === prPoint.kg;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs"
                    >
                      <span className="text-[#A1A1AA]">{p.dateLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#F4F4F5]">{p.loadKg}</span>
                        {isPr && <StatusPill tone="gold">🏆 PR</StatusPill>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
        </div>
      </div>
    </Modal>
  );
};
