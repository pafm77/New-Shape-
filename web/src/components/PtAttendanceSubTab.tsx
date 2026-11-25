import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MessageCircle,
  Search,
  TrendingUp,
  UserX,
  X,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  TrainingSessionRecord,
} from '../types/studio';
import { formatPhoneDisplay, formatShortDate } from '../data/seedCatalog';
import {
  BrandCard,
  EmptyState,
  Input,
  StatusPill,
} from './UiPrimitives';

interface PtAttendanceSubTabProps {
  clients: ClientRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
}

type PeriodScope = 'week' | 'month';
type ListFilter = 'all' | 'inactive' | 'absences';

export interface StudentAttendanceRow {
  client: ClientRecord;
  scheduledCount: number;
  presentCount: number;
  absentCount: number;
  markedCount: number;
  attendanceRatePct: number | null;
  lastWorkoutMillis: number | null;
  daysSinceLastWorkout: number | null;
  hasUpcomingBooking: boolean;
  isInactive: boolean;
}

const DAY_MS = 86_400_000;

export function computeInactiveStudentsCount(
  clients: ClientRecord[],
  sessions: TrainingSessionRecord[],
  bookings: BookingRecord[],
  thresholdDays = 7
): number {
  const now = Date.now();
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const lastWorkoutByClient = new Map<string, number>();

  bookings.forEach((b) => {
    if (b.status !== 'CONFIRMED') return;
    if (b.attendanceStatus === 'ABSENT') return;
    const s = sessionMap.get(b.sessionId);
    if (!s) return;
    if (s.startMillis <= now) {
      const prev = lastWorkoutByClient.get(b.clientId) ?? 0;
      if (s.startMillis > prev) {
        lastWorkoutByClient.set(b.clientId, s.startMillis);
      }
    }
  });

  return clients
    .filter((c) => c.active)
    .filter((c) => {
      const last = lastWorkoutByClient.get(c.id);
      if (last == null) return true;
      const days = Math.floor((now - last) / DAY_MS);
      return days >= thresholdDays;
    }).length;
}

export const PtAttendanceSubTab: React.FC<PtAttendanceSubTabProps> = ({
  clients,
  sessions,
  bookings,
  onOpenWhatsApp,
}) => {
  const [period, setPeriod] = useState<PeriodScope>('month');
  const [inactivityDays, setInactivityDays] = useState<number>(7);
  const [filterMode, setFilterMode] = useState<ListFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { rows, avgRatePct, totalPresent, totalAbsent, inactiveRows } = useMemo(() => {
    const now = Date.now();
    const startOfPeriod =
      period === 'week' ? now - 7 * DAY_MS : now - 30 * DAY_MS;

    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const activeClients = clients
      .filter((c) => c.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    // Pre-aggregate per client
    const lastWorkoutByClient = new Map<string, number>();
    const hasUpcomingByClient = new Set<string>();
    const periodBookingsByClient = new Map<string, BookingRecord[]>();

    bookings.forEach((b) => {
      if (b.status !== 'CONFIRMED') return;
      const s = sessionMap.get(b.sessionId);
      if (!s) return;

      if (s.startMillis > now) {
        hasUpcomingByClient.add(b.clientId);
      } else if (b.attendanceStatus !== 'ABSENT') {
        const prev = lastWorkoutByClient.get(b.clientId) ?? 0;
        if (s.startMillis > prev) {
          lastWorkoutByClient.set(b.clientId, s.startMillis);
        }
      }

      if (s.startMillis >= startOfPeriod && s.startMillis <= now) {
        const arr = periodBookingsByClient.get(b.clientId) || [];
        arr.push(b);
        periodBookingsByClient.set(b.clientId, arr);
      }
    });

    let sumPresent = 0;
    let sumAbsent = 0;

    const computed: StudentAttendanceRow[] = activeClients.map((client) => {
      const pBookings = periodBookingsByClient.get(client.id) || [];
      const scheduledCount = pBookings.length;
      const presentCount = pBookings.filter((b) => b.attendanceStatus === 'PRESENT').length;
      const absentCount = pBookings.filter((b) => b.attendanceStatus === 'ABSENT').length;
      const markedCount = presentCount + absentCount;

      // If PT marked attendance, use PRESENT / (PRESENT + ABSENT);
      // otherwise if there are past confirmed bookings with no absences, reflect confirmed participation
      const attendanceRatePct =
        markedCount > 0
          ? Math.round((presentCount / markedCount) * 100)
          : scheduledCount > 0
          ? 100
          : null;

      sumPresent += presentCount;
      sumAbsent += absentCount;

      const lastMs = lastWorkoutByClient.get(client.id) ?? null;
      const daysSince = lastMs != null ? Math.max(0, Math.floor((now - lastMs) / DAY_MS)) : null;
      const isInactive = daysSince === null || daysSince >= inactivityDays;

      return {
        client,
        scheduledCount,
        presentCount,
        absentCount,
        markedCount,
        attendanceRatePct,
        lastWorkoutMillis: lastMs,
        daysSinceLastWorkout: daysSince,
        hasUpcomingBooking: hasUpcomingByClient.has(client.id),
        isInactive,
      };
    });

    const inactiveList = computed
      .filter((r) => r.isInactive)
      .sort((a, b) => {
        if (a.daysSinceLastWorkout === null && b.daysSinceLastWorkout === null) {
          return a.client.name.localeCompare(b.client.name, 'pt');
        }
        if (a.daysSinceLastWorkout === null) return 1;
        if (b.daysSinceLastWorkout === null) return -1;
        return b.daysSinceLastWorkout - a.daysSinceLastWorkout;
      });

    const totalMarked = sumPresent + sumAbsent;
    const avgRate =
      totalMarked > 0
        ? Math.round((sumPresent / totalMarked) * 100)
        : computed.some((r) => r.scheduledCount > 0)
        ? 100
        : null;

    return {
      rows: computed,
      avgRatePct: avgRate,
      totalPresent: sumPresent,
      totalAbsent: sumAbsent,
      inactiveRows: inactiveList,
    };
  }, [clients, sessions, bookings, period, inactivityDays]);

  const filteredRows = useMemo(() => {
    const q = searchQuery
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return rows
      .filter((r) => {
        if (filterMode === 'inactive' && !r.isInactive) return false;
        if (filterMode === 'absences' && r.absentCount === 0) return false;
        if (!q) return true;
        const hay = `${r.client.name} ${r.client.phone || ''}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Inactive first when viewing all, then by scheduled count desc
        if (a.isInactive !== b.isInactive) return a.isInactive ? -1 : 1;
        return b.scheduledCount - a.scheduledCount;
      });
  }, [rows, filterMode, searchQuery]);

  const buildCheckInMessage = (row: StudentAttendanceRow) => {
    const firstName = row.client.name.trim().split(' ')[0] || row.client.name;
    if (row.daysSinceLastWorkout != null) {
      return `Olá ${firstName}! Já faz ${row.daysSinceLastWorkout} dias desde o teu último treino na New Shape 💪 Está tudo bem contigo? Quando voltamos a treinar?`;
    }
    return `Olá ${firstName}! Sentimos a tua falta na New Shape 💪 Vamos agendar o teu próximo treino esta semana?`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Assiduidade & Inatividade</h2>
          <p className="text-xs text-[#A1A1AA]">
            Resumo semanal/mensal de presenças, faltas e alerta de alunos sem treinar
          </p>
        </div>

        {/* Period switcher */}
        <div className="flex rounded-xl border border-[#323238] bg-[#1B1B1E] p-1">
          {(
            [
              { id: 'week' as const, label: 'Últimos 7 dias' },
              { id: 'month' as const, label: 'Últimos 30 dias' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                period === opt.id
                  ? 'bg-[#EAB308] text-[#121214]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BrandCard>
          <p className="text-[11px] font-semibold text-[#A1A1AA]">Taxa Média</p>
          <p className="mt-1 text-2xl font-extrabold text-[#FACC15]">
            {avgRatePct !== null ? `${avgRatePct}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            {period === 'week' ? 'Nos últimos 7 dias' : 'Nos últimos 30 dias'}
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-[11px] font-semibold text-[#A1A1AA]">Presenças</p>
          <p className="mt-1 text-2xl font-extrabold text-[#22C55E]">{totalPresent}</p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">Marcadas pelo PT</p>
        </BrandCard>
        <BrandCard>
          <p className="text-[11px] font-semibold text-[#A1A1AA]">Faltas</p>
          <p className="mt-1 text-2xl font-extrabold text-[#EF4444]">{totalAbsent}</p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">No período selecionado</p>
        </BrandCard>
        <BrandCard highlight={inactiveRows.length > 0}>
          <p className="text-[11px] font-semibold text-[#A1A1AA]">
            Inativos (≥{inactivityDays}d)
          </p>
          <p
            className={`mt-1 text-2xl font-extrabold ${
              inactiveRows.length > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
            }`}
          >
            {inactiveRows.length}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">Alunos ativos em alerta</p>
        </BrandCard>
      </div>

      {/* Inactivity Threshold + Alert Card */}
      <BrandCard highlight={inactiveRows.length > 0}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${
                inactiveRows.length > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
              }`}
            />
            <h3 className="text-sm font-bold text-[#F4F4F5]">
              Alerta de Inatividade ({inactiveRows.length})
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#A1A1AA]">Avisar após:</span>
            {[7, 10, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setInactivityDays(d)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                  inactivityDays === d
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {inactiveRows.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#143521]/40 px-3 py-2.5 text-xs text-[#86EFAC]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Excelente! Todos os alunos ativos treinaram nos últimos {inactivityDays} dias.
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {inactiveRows.slice(0, 6).map((row) => (
              <div
                key={row.client.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#242429] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#F4F4F5]">{row.client.name}</span>
                    <StatusPill tone="amber">
                      {row.daysSinceLastWorkout != null
                        ? `Há ${row.daysSinceLastWorkout} dias sem treinar`
                        : 'Sem treinos registados'}
                    </StatusPill>
                    {row.hasUpcomingBooking && (
                      <StatusPill tone="green">Já tem próximo treino</StatusPill>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                    {row.lastWorkoutMillis
                      ? `Último treino: ${formatShortDate(row.lastWorkoutMillis)}`
                      : 'Ainda sem histórico de treinos'}
                    {row.client.phone ? ` · ${formatPhoneDisplay(row.client.phone)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenWhatsApp(row.client.phone || null, buildCheckInMessage(row))
                  }
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/50 px-3 py-1.5 text-xs font-bold text-[#86EFAC] transition hover:bg-[#25D366] hover:text-[#121214]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
              </div>
            ))}
            {inactiveRows.length > 6 && (
              <button
                type="button"
                onClick={() => setFilterMode('inactive')}
                className="text-xs font-bold text-[#FACC15] hover:underline"
              >
                Ver todos os {inactiveRows.length} alunos inativos abaixo →
              </button>
            )}
          </div>
        )}
      </BrandCard>

      {/* Search + Filter Pills */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar aluno por nome ou telemóvel..."
            className="pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpar pesquisa"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all' as const, label: `Todos (${rows.length})` },
              { id: 'inactive' as const, label: `Inativos (${inactiveRows.length})` },
              {
                id: 'absences' as const,
                label: `Com faltas (${rows.filter((r) => r.absentCount > 0).length})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                filterMode === f.id
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-student Attendance Cards */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-6 w-6" />}
          title="Sem alunos ativos"
          subtitle="Adiciona alunos para acompanhar a assiduidade semanal e mensal."
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="Nenhum aluno encontrado"
          subtitle="Ajusta o filtro ou a pesquisa para ver outros alunos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredRows.map((row) => {
            const pct = row.attendanceRatePct ?? 0;
            const rateTone =
              row.attendanceRatePct === null
                ? 'neutral'
                : pct >= 80
                ? 'green'
                : pct >= 55
                ? 'amber'
                : 'red';

            return (
              <BrandCard key={row.client.id} highlight={row.isInactive}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-bold text-[#F4F4F5]">{row.client.name}</h3>
                      {row.isInactive && (
                        <StatusPill tone="amber">
                          {row.daysSinceLastWorkout != null
                            ? `${row.daysSinceLastWorkout}d sem treinar`
                            : 'Sem treinos'}
                        </StatusPill>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {row.lastWorkoutMillis
                        ? `Último treino: ${formatShortDate(row.lastWorkoutMillis)}`
                        : 'Sem treinos passados'}
                    </p>
                  </div>
                  <StatusPill tone={rateTone}>
                    {row.attendanceRatePct !== null ? `${row.attendanceRatePct}%` : 'Sem registo'}
                  </StatusPill>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#242429]">
                    <div
                      style={{ width: `${row.attendanceRatePct ?? 0}%` }}
                      className={`h-full rounded-full transition-all ${
                        rateTone === 'green'
                          ? 'bg-[#22C55E]'
                          : rateTone === 'amber'
                          ? 'bg-[#F59E0B]'
                          : rateTone === 'red'
                          ? 'bg-[#EF4444]'
                          : 'bg-[#52525B]'
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#242429] py-2">
                    <p className="text-[10px] font-semibold text-[#A1A1AA]">Realizados</p>
                    <p className="text-sm font-extrabold text-[#F4F4F5]">{row.scheduledCount}</p>
                  </div>
                  <div className="rounded-xl bg-[#242429] py-2">
                    <p className="text-[10px] font-semibold text-[#A1A1AA]">Presenças</p>
                    <p className="text-sm font-extrabold text-[#22C55E]">{row.presentCount}</p>
                  </div>
                  <div className="rounded-xl bg-[#242429] py-2">
                    <p className="text-[10px] font-semibold text-[#A1A1AA]">Faltas</p>
                    <p className="text-sm font-extrabold text-[#EF4444]">{row.absentCount}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#323238] pt-2.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA]">
                    <TrendingUp className="h-3.5 w-3.5 text-[#EAB308]" />
                    {row.hasUpcomingBooking ? 'Tem treino agendado' : 'Sem próximo treino'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenWhatsApp(row.client.phone || null, buildCheckInMessage(row))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-xs font-bold text-[#86EFAC] hover:border-[#25D366]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Contactar
                  </button>
                </div>
              </BrandCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
