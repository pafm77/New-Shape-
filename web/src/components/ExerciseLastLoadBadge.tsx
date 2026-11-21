import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, History, Info, LineChart as LineChartIcon, TrendingDown, TrendingUp } from 'lucide-react';
import {
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { formatShortDate } from '../data/seedCatalog';

export interface ExerciseLastLoadInfo {
  load: string;
  loggedAtMillis: number;
  sourceLabel: string;
  isFromHistory: boolean;
  deltaKg: number | null;
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseNumericLoadKg(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(',', '.').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Looks up the historical load used in the student's last workout for a specific exercise,
 * checking both the current workout plan item and historical entries for the same student
 * across all their workout plans.
 */
export function resolveLastExerciseLoad(params: {
  item: WorkoutPlanItemRecord;
  clientId: string;
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  baselineLoadOverride?: string;
}): ExerciseLastLoadInfo {
  const { item, clientId, workoutPlans, workoutPlanItems, baselineLoadOverride } = params;

  const clientPlansById = new Map<string, WorkoutPlanRecord>();
  workoutPlans.forEach((p) => {
    if (p.clientId === clientId) clientPlansById.set(p.id, p);
  });

  const targetName = normalizeExerciseName(item.exerciseName);
  const currentLoadNum = parseNumericLoadKg(item.loadKg);

  const computeDelta = (prevLoad: string): number | null => {
    const prevNum = parseNumericLoadKg(prevLoad);
    if (prevNum === null || currentLoadNum === null) return null;
    const diff = Number((currentLoadNum - prevNum).toFixed(1));
    return diff;
  };

  // 1. Direct lastLoadKg or execution baseline on this plan item
  const directLast = (baselineLoadOverride ?? item.lastLoadKg ?? '').trim();
  if (directLast) {
    return {
      load: directLast,
      loggedAtMillis: item.lastLoggedAtMillis || 0,
      sourceLabel: 'Último treino neste plano',
      isFromHistory: true,
      deltaKg: computeDelta(directLast),
    };
  }

  // 2. Search historical workout plan items for this same student & exercise across other plans
  interface Candidate {
    load: string;
    timestamp: number;
    loggedAtMillis: number;
    planTitle: string;
  }

  const candidates: Candidate[] = [];
  workoutPlanItems.forEach((other) => {
    if (other.id === item.id) return;
    const plan = clientPlansById.get(other.planId);
    if (!plan) return;

    const sameExercise =
      (item.exerciseId && other.exerciseId && item.exerciseId === other.exerciseId) ||
      normalizeExerciseName(other.exerciseName) === targetName;

    if (!sameExercise) return;

    const loadCandidate = (other.lastLoadKg || other.loadKg || '').trim();
    if (!loadCandidate) return;

    const loggedTs = other.lastLoggedAtMillis || 0;
    const sortTs = loggedTs > 0 ? loggedTs : plan.createdAtMillis || 0;
    candidates.push({
      load: loadCandidate,
      timestamp: sortTs,
      loggedAtMillis: loggedTs,
      planTitle: plan.title,
    });
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.timestamp - a.timestamp);
    const best = candidates[0];
    return {
      load: best.load,
      loggedAtMillis: best.loggedAtMillis,
      sourceLabel: `Histórico · ${best.planTitle}`,
      isFromHistory: true,
      deltaKg: computeDelta(best.load),
    };
  }

  // 3. Fallback to current loadKg on this item if the student/PT has already entered a load
  const fallbackLoad = (item.loadKg || '').trim();
  if (fallbackLoad) {
    return {
      load: fallbackLoad,
      loggedAtMillis: item.lastLoggedAtMillis || 0,
      sourceLabel: item.lastLoggedAtMillis ? 'Último registo do aluno' : 'Carga atual definida no plano',
      isFromHistory: Boolean(item.lastLoggedAtMillis),
      deltaKg: 0,
    };
  }

  return {
    load: '',
    loggedAtMillis: 0,
    sourceLabel: 'Ainda sem histórico registado',
    isFromHistory: false,
    deltaKg: null,
  };
}

interface ExerciseLastLoadBadgeProps {
  item: WorkoutPlanItemRecord;
  clientId: string;
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs?: WorkoutLoadLogRecord[];
  baselineLoadOverride?: string;
  emphasize?: boolean;
  onOpenHistory?: () => void;
}

export const ExerciseLastLoadBadge: React.FC<ExerciseLastLoadBadgeProps> = ({
  item,
  clientId,
  workoutPlans,
  workoutPlanItems,
  workoutLoadLogs = [],
  baselineLoadOverride,
  emphasize = false,
  onOpenHistory,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const info = useMemo(
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

  const prStats = useMemo(() => {
    const targetName = normalizeExerciseName(item.exerciseName);
    let maxKg = 0;
    let logsCount = 0;
    workoutLoadLogs.forEach((l) => {
      if (l.clientId !== clientId) return;
      const same =
        (item.exerciseId && l.exerciseId && item.exerciseId === l.exerciseId) ||
        normalizeExerciseName(l.exerciseName) === targetName;
      if (!same) return;
      logsCount += 1;
      const kg = l.numericKg > 0 ? l.numericKg : parseNumericLoadKg(l.loadKg) ?? 0;
      if (kg > maxKg) maxKg = kg;
    });
    const currentKg = parseNumericLoadKg(item.loadKg) ?? 0;
    const lastKg = parseNumericLoadKg(info.load) ?? 0;
    const bestKg = Math.max(maxKg, currentKg, lastKg);
    const isCurrentPr = bestKg > 0 && currentKg > 0 && currentKg >= bestKg;
    return { bestKg, isCurrentPr, logsCount };
  }, [workoutLoadLogs, clientId, item.exerciseId, item.exerciseName, item.loadKg, info.load]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasLoad = Boolean(info.load);

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <div
        ref={containerRef}
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          aria-expanded={open}
          aria-label={
            hasLoad
              ? `Carga do último treino em ${item.exerciseName}: ${info.load}`
              : `Sem histórico de carga para ${item.exerciseName}`
          }
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
            hasLoad
              ? emphasize
                ? 'border-[#EAB308] bg-[#3D3314] text-[#FACC15] shadow-sm'
                : 'border-[#EAB308]/45 bg-[#3D3314]/55 text-[#FACC15] hover:border-[#EAB308]'
              : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#52525B]'
          }`}
        >
          <History className="h-3 w-3 shrink-0" />
          <span>
            {hasLoad ? `Últ. treino: ${info.load}` : 'Últ. treino: —'}
          </span>
          {info.deltaKg !== null && info.deltaKg !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                info.deltaKg > 0
                  ? 'bg-[#14532D]/80 text-[#4ADE80]'
                  : 'bg-[#451A03]/80 text-[#FBBF24]'
              }`}
            >
              {info.deltaKg > 0 ? `+${info.deltaKg} kg` : `${info.deltaKg} kg`}
            </span>
          )}
          <Info className="h-3 w-3 shrink-0 opacity-75" />
        </button>

        {open && (
          <div
            role="tooltip"
            className="absolute left-0 z-30 mt-1.5 w-64 rounded-xl border border-[#EAB308]/50 bg-[#161619] p-3 text-left shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#323238] pb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#FACC15]">
                <History className="h-3.5 w-3.5" />
                Histórico de Carga
              </span>
              {info.loggedAtMillis > 0 && (
                <span className="text-[10px] font-semibold text-[#A1A1AA]">
                  {formatShortDate(info.loggedAtMillis)}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1.5 text-xs">
              <p className="truncate font-bold text-[#F4F4F5]">{item.exerciseName}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A1A1AA]">Último treino:</span>
                <span className="font-extrabold text-[#FACC15]">
                  {hasLoad ? info.load : 'Sem registo'}
                </span>
              </div>
              {item.loadKg && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#A1A1AA]">Carga atual:</span>
                  <span className="font-bold text-[#F4F4F5]">{item.loadKg}</span>
                </div>
              )}
              {prStats.bestKg > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#A1A1AA]">Recorde (PR):</span>
                  <span className="font-extrabold text-[#FACC15]">
                    🏆 {prStats.bestKg} kg
                  </span>
                </div>
              )}
              {info.deltaKg !== null && info.deltaKg !== 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#A1A1AA]">Evolução:</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      info.deltaKg > 0 ? 'text-[#4ADE80]' : 'text-[#FBBF24]'
                    }`}
                  >
                    {info.deltaKg > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {info.deltaKg > 0 ? `+${info.deltaKg} kg` : `${info.deltaKg} kg`}
                  </span>
                </div>
              )}
              <p className="pt-1 text-[10px] text-[#A1A1AA]">{info.sourceLabel}</p>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onOpenHistory();
                  }}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#EAB308] px-2.5 py-1.5 text-[11px] font-extrabold text-[#121214] hover:bg-[#FACC15]"
                >
                  <LineChartIcon className="h-3.5 w-3.5" />
                  Ver gráfico & PR
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {prStats.bestKg > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenHistory?.();
          }}
          title="Ver evolução de cargas e Recorde Pessoal (PR)"
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold transition ${
            prStats.isCurrentPr
              ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
              : 'border-[#EAB308]/50 bg-[#3D3314]/60 text-[#FACC15] hover:border-[#EAB308]'
          }`}
        >
          <Award className="h-3 w-3" />
          PR {prStats.bestKg} kg
        </button>
      )}

      {onOpenHistory && prStats.bestKg === 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenHistory();
          }}
          className="inline-flex items-center gap-1 rounded-full border border-[#323238] bg-[#1B1B1E] px-2 py-0.5 text-[10px] font-bold text-[#A1A1AA] hover:border-[#EAB308] hover:text-[#FACC15]"
        >
          <LineChartIcon className="h-3 w-3" />
          Evolução
        </button>
      )}
    </div>
  );
};
