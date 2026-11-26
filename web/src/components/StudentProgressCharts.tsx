import React, { useMemo, useState } from 'react';
import { Activity, Award, Dumbbell, Flame, TrendingUp, Trophy } from 'lucide-react';
import {
  BookingRecord,
  TrainingSessionRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { formatShortDate } from '../data/seedCatalog';
import { BrandCard, StatusPill } from './UiPrimitives';

interface StrengthSeries {
  exerciseName: string;
  points: { dateMillis: number; loadKg: number; label: string }[];
  prKg: number;
  prDateMillis: number;
  prDateLabel: string;
  latestKg: number;
  deltaKg: number;
}

function parseNumericLoad(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(',', '.');
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const StudentConsistencyCard: React.FC<{
  clientId: string;
  bookings: BookingRecord[];
  sessions: TrainingSessionRecord[];
}> = ({ clientId, bookings, sessions }) => {
  const stats = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;
    const sevenDaysAgo = now - 7 * 86_400_000;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    let monthCount = 0;
    let weekCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let totalAllTime = 0;

    // Last 6 months buckets
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const nowDate = new Date();
    const monthlyBuckets: { key: string; label: string; count: number; isCurrent: boolean }[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyBuckets.push({
        key,
        label: monthNames[d.getMonth()],
        count: 0,
        isCurrent: offset === 0,
      });
    }
    const bucketMap = new Map(monthlyBuckets.map((b) => [b.key, b]));

    bookings.forEach((b) => {
      if (b.clientId !== clientId || b.status !== 'CONFIRMED') return;
      const s = sessionMap.get(b.sessionId);
      if (!s || s.startMillis > now) return;
      if (b.attendanceStatus !== 'ABSENT') {
        totalAllTime += 1;
        const sd = new Date(s.startMillis);
        const mk = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}`;
        const bucket = bucketMap.get(mk);
        if (bucket) bucket.count += 1;
      }
      if (s.startMillis >= thirtyDaysAgo) {
        if (b.attendanceStatus === 'PRESENT') presentCount += 1;
        if (b.attendanceStatus === 'ABSENT') absentCount += 1;
        if (b.attendanceStatus !== 'ABSENT') monthCount += 1;
      }
      if (s.startMillis >= sevenDaysAgo && b.attendanceStatus !== 'ABSENT') {
        weekCount += 1;
      }
    });

    const marked = presentCount + absentCount;
    const ratePct = marked > 0 ? Math.round((presentCount / marked) * 100) : monthCount > 0 ? 100 : null;
    const maxBucketCount = Math.max(1, ...monthlyBuckets.map((b) => b.count));
    return { monthCount, weekCount, ratePct, totalAllTime, monthlyBuckets, maxBucketCount };
  }, [clientId, bookings, sessions]);

  return (
    <BrandCard>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[#FACC15]" />
          <h3 className="text-sm font-bold text-[#F4F4F5]">Consistência de Treino</h3>
        </div>
        {stats.ratePct !== null && (
          <StatusPill tone={stats.ratePct >= 80 ? 'green' : stats.ratePct >= 55 ? 'amber' : 'red'}>
            {stats.ratePct}% assiduidade (30d)
          </StatusPill>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-[11px] text-[#A1A1AA]">Últimos 7 dias</p>
          <p className="mt-0.5 text-lg font-extrabold text-[#FACC15]">{stats.weekCount}</p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-[11px] text-[#A1A1AA]">Últimos 30 dias</p>
          <p className="mt-0.5 text-lg font-extrabold text-[#22C55E]">{stats.monthCount}</p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-[11px] text-[#A1A1AA]">Total treinos</p>
          <p className="mt-0.5 text-lg font-extrabold text-[#F4F4F5]">{stats.totalAllTime}</p>
        </div>
      </div>

      {/* 6-month frequency bar chart */}
      <div className="mt-3 rounded-xl border border-[#323238]/60 bg-[#161619] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#A1A1AA]">
            Frequência mensal (últimos 6 meses)
          </span>
          <span className="text-[10px] font-bold text-[#FACC15]">treinos/mês</span>
        </div>
        <div className="grid grid-cols-6 items-end gap-2 h-24 pt-4">
          {stats.monthlyBuckets.map((b) => {
            const heightPct =
              b.count > 0 ? Math.max(16, Math.round((b.count / stats.maxBucketCount) * 100)) : 8;
            return (
              <div key={b.key} className="flex h-full flex-col items-center justify-end gap-1">
                <span
                  className={`text-[10px] font-bold ${
                    b.count > 0 ? (b.isCurrent ? 'text-[#FACC15]' : 'text-[#F4F4F5]') : 'text-[#52525B]'
                  }`}
                >
                  {b.count}
                </span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                      b.count === 0
                        ? 'bg-[#242429]'
                        : b.isCurrent
                          ? 'bg-[#EAB308]'
                          : 'bg-[#22C55E]/80'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] ${
                    b.isCurrent ? 'font-bold text-[#F4F4F5]' : 'text-[#A1A1AA]'
                  }`}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </BrandCard>
  );
};

export const StrengthEvolutionChartCard: React.FC<{
  clientId: string;
  workoutLoadLogs: WorkoutLoadLogRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
}> = ({ clientId, workoutLoadLogs, workoutPlans, workoutPlanItems }) => {
  const seriesList = useMemo<StrengthSeries[]>(() => {
    const byExercise = new Map<
      string,
      { displayName: string; pts: { dateMillis: number; loadKg: number; label: string }[] }
    >();

    // 1. Collect from explicit workoutLoadLogs
    workoutLoadLogs
      .filter((l) => l.clientId === clientId)
      .forEach((log) => {
        const val = parseNumericLoad(log.loadKg);
        if (val === null) return;
        const name = (log.exerciseName || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const entry = byExercise.get(key) || { displayName: name, pts: [] };
        entry.pts.push({
          dateMillis: log.loggedAtMillis || Date.now(),
          loadKg: val,
          label: formatShortDate(log.loggedAtMillis || Date.now()),
        });
        byExercise.set(key, entry);
      });

    // 2. Supplement from workoutPlanItems if an exercise has a current/last load not yet in logs
    const clientPlanIds = new Set(
      workoutPlans.filter((p) => p.clientId === clientId).map((p) => p.id)
    );
    workoutPlanItems
      .filter((it) => clientPlanIds.has(it.planId))
      .forEach((it) => {
        const name = (it.exerciseName || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const entry = byExercise.get(key) || { displayName: name, pts: [] };
        if (entry.pts.length === 0) {
          const prevVal = parseNumericLoad(it.lastLoadKg);
          const currVal = parseNumericLoad(it.loadKg);
          if (prevVal !== null && currVal !== null && prevVal !== currVal) {
            entry.pts.push({
              dateMillis: Date.now() - 7 * 86_400_000,
              loadKg: prevVal,
              label: 'Anterior',
            });
            entry.pts.push({
              dateMillis: Date.now(),
              loadKg: currVal,
              label: 'Atual',
            });
          } else if (currVal !== null) {
            entry.pts.push({
              dateMillis: Date.now(),
              loadKg: currVal,
              label: 'Atual',
            });
          }
          if (entry.pts.length > 0) {
            byExercise.set(key, entry);
          }
        }
      });

    const result: StrengthSeries[] = [];
    byExercise.forEach(({ displayName, pts }) => {
      const sorted = [...pts].sort((a, b) => a.dateMillis - b.dateMillis);
      if (sorted.length === 0) return;
      let prPoint = sorted[0];
      sorted.forEach((p) => {
        if (p.loadKg >= prPoint.loadKg) prPoint = p;
      });
      const firstKg = sorted[0].loadKg;
      const latestKg = sorted[sorted.length - 1].loadKg;
      result.push({
        exerciseName: displayName,
        points: sorted,
        prKg: prPoint.loadKg,
        prDateMillis: prPoint.dateMillis,
        prDateLabel: prPoint.label,
        latestKg,
        deltaKg: latestKg - firstKg,
      });
    });

    return result.sort((a, b) => {
      if (b.points.length !== a.points.length) return b.points.length - a.points.length;
      return b.prKg - a.prKg;
    });
  }, [clientId, workoutLoadLogs, workoutPlans, workoutPlanItems]);

  const [selectedName, setSelectedName] = useState<string>('');
  const [showAllPrs, setShowAllPrs] = useState(false);
  const activeSeries =
    seriesList.find((s) => s.exerciseName === selectedName) || seriesList[0] || null;
  const rankedPrs = useMemo(
    () => [...seriesList].sort((a, b) => b.prKg - a.prKg),
    [seriesList]
  );
  const fourteenDaysAgo = Date.now() - 14 * 86_400_000;

  if (!activeSeries) {
    return (
      <BrandCard>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-[#EAB308]" />
          <h3 className="text-base font-bold text-[#F4F4F5]">Evolução de Cargas (Força)</h3>
        </div>
        <p className="mt-2 text-xs text-[#A1A1AA]">
          Assim que forem registadas cargas nos exercícios do plano de treino, o gráfico de evolução e os recordes (PR) aparecem aqui automaticamente.
        </p>
      </BrandCard>
    );
  }

  const pts = activeSeries.points;
  const values = pts.map((p) => p.loadKg);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = Math.max(maxVal - minVal, 2);
  const padMin = Math.max(0, minVal - span * 0.15);
  const padMax = maxVal + span * 0.15;
  const padRange = Math.max(padMax - padMin, 1);

  const W = 520;
  const H = 170;
  const padX = 28;
  const padY = 20;
  const usableW = W - padX * 2;
  const usableH = H - padY * 2;

  const coords = pts.map((p, idx) => {
    const x =
      pts.length === 1 ? W / 2 : padX + (idx / (pts.length - 1)) * usableW;
    const norm = (p.loadKg - padMin) / padRange;
    const y = padY + usableH - norm * usableH;
    return { x, y, val: p.loadKg, label: p.label };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padY + usableH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padY + usableH).toFixed(1)} Z`
      : '';

  const formatKg = (v: number) => (Number.isInteger(v) ? `${v} kg` : `${v.toFixed(1)} kg`);

  return (
    <BrandCard highlight>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#FACC15]" />
          <div>
            <h3 className="text-base font-bold text-[#F4F4F5]">Evolução de Cargas (Força)</h3>
            <p className="text-[11px] text-[#A1A1AA]">
              Progresso por exercício · {seriesList.length} exercício(s) com registo
            </p>
          </div>
        </div>
        <StatusPill tone="gold">
          <Award className="mr-1 inline h-3 w-3" />
          PR: {formatKg(activeSeries.prKg)}
        </StatusPill>
      </div>

      {/* Mural de Recordes Pessoais (Hall of PRs) */}
      <div className="mt-3 rounded-xl border border-[#323238] bg-[#161619] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-[#FACC15]" />
            <span className="text-xs font-extrabold text-[#F4F4F5]">
              Mural de Recordes Pessoais (PR)
            </span>
          </div>
          {rankedPrs.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllPrs((v) => !v)}
              className="text-[11px] font-bold text-[#FACC15] hover:underline"
            >
              {showAllPrs ? 'Mostrar menos' : `Ver todos (${rankedPrs.length})`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(showAllPrs ? rankedPrs : rankedPrs.slice(0, 4)).map((pr, idx) => {
            const isSelected = pr.exerciseName === activeSeries.exerciseName;
            const isRecent = pr.prDateMillis >= fourteenDaysAgo && pr.points.length >= 2;
            return (
              <button
                key={pr.exerciseName}
                type="button"
                onClick={() => setSelectedName(pr.exerciseName)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  isSelected
                    ? 'border-[#EAB308] bg-[#3D3314]/45'
                    : 'border-[#323238] bg-[#242429]/80 hover:border-[#52525B]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-[#FACC15]">#{idx + 1}</span>
                    <span className="truncate text-xs font-bold text-[#F4F4F5]">
                      {pr.exerciseName}
                    </span>
                    {isRecent && (
                      <span className="shrink-0 rounded-full bg-[#3D3314] px-1.5 py-0.5 text-[9px] font-extrabold text-[#FACC15]">
                        🔥 Novo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#A1A1AA]">
                    {pr.prDateLabel}
                    {pr.deltaKg > 0.05 ? ` · +${formatKg(pr.deltaKg)} evolução` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-[#FACC15]">
                  {formatKg(pr.prKg)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercise Selector Chips */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {seriesList.map((s) => {
          const selected = s.exerciseName === activeSeries.exerciseName;
          return (
            <button
              key={s.exerciseName}
              type="button"
              onClick={() => setSelectedName(s.exerciseName)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                selected
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {s.exerciseName} ({formatKg(s.prKg)})
            </button>
          );
        })}
      </div>

      {/* 3 KPI Tiles */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#242429] p-2.5 text-center">
          <p className="text-[10px] font-semibold text-[#A1A1AA]">Recorde (PR)</p>
          <p className="mt-0.5 text-sm font-extrabold text-[#FACC15]">
            {formatKg(activeSeries.prKg)}
          </p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5 text-center">
          <p className="text-[10px] font-semibold text-[#A1A1AA]">Última Carga</p>
          <p className="mt-0.5 text-sm font-extrabold text-[#F4F4F5]">
            {formatKg(activeSeries.latestKg)}
          </p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5 text-center">
          <p className="text-[10px] font-semibold text-[#A1A1AA]">Evolução</p>
          <p
            className={`mt-0.5 text-sm font-extrabold ${
              activeSeries.deltaKg > 0
                ? 'text-[#22C55E]'
                : activeSeries.deltaKg < 0
                ? 'text-[#EF4444]'
                : 'text-[#A1A1AA]'
            }`}
          >
            {activeSeries.deltaKg > 0 ? '+' : ''}
            {Number.isInteger(activeSeries.deltaKg)
              ? `${activeSeries.deltaKg} kg`
              : `${activeSeries.deltaKg.toFixed(1)} kg`}
          </p>
        </div>
      </div>

      {/* SVG Area/Line Chart */}
      <div className="mt-3 rounded-xl bg-[#161619] p-2.5 border border-[#323238]/60">
        {coords.length === 1 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Activity className="h-5 w-5 text-[#EAB308]" />
            <p className="mt-1.5 text-sm font-bold text-[#F4F4F5]">
              {formatKg(coords[0].val)} registados ({coords[0].label})
            </p>
            <p className="text-[11px] text-[#A1A1AA]">
              Regista mais uma sessão deste exercício para ver a linha de evolução.
            </p>
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
              <defs>
                <linearGradient id="strengthGoldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EAB308" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#EAB308" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((t, i) => {
                const y = padY + usableH * t;
                return (
                  <line
                    key={i}
                    x1={padX}
                    x2={W - padX}
                    y1={y}
                    y2={y}
                    stroke="#323238"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}
              <path d={areaPath} fill="url(#strengthGoldGrad)" />
              <path
                d={linePath}
                fill="none"
                stroke="#FACC15"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {coords.map((c, idx) => (
                <g key={idx}>
                  <circle cx={c.x} cy={c.y} r="5.5" fill="#FACC15" />
                  <circle cx={c.x} cy={c.y} r="2.5" fill="#121214" />
                  <text
                    x={c.x}
                    y={Math.max(12, c.y - 10)}
                    textAnchor="middle"
                    fill="#F4F4F5"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {Number.isInteger(c.val) ? c.val : c.val.toFixed(1)}
                  </text>
                </g>
              ))}
            </svg>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#A1A1AA]">
              <span>Início: {pts[0].label}</span>
              <span>
                Mín {formatKg(minVal)} · Máx {formatKg(maxVal)}
              </span>
              <span>Último: {pts[pts.length - 1].label}</span>
            </div>
          </>
        )}
      </div>
    </BrandCard>
  );
};
