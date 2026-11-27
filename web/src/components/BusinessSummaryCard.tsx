import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  FidelizacaoRecord,
  PaymentRecord,
  isSuperAdminEmail,
} from '../types/studio';
import {
  getEffectiveClientFidelizacaoMonths,
  isExtraFeePayment,
} from '../data/seedCatalog';
import { BrandCard, StatusPill } from './UiPrimitives';

const PT_MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const PT_MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface BusinessSummaryCardProps {
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  bookings: BookingRecord[];
  isSuperAdmin: boolean;
  userEmail?: string | null;
  onJumpToFinance?: () => void;
  onJumpToFidelizacoes?: () => void;
}

type PeriodMonths = 6 | 12;
type ChartFocus = 'all' | 'revenue' | 'students' | 'loyalty';

interface MonthlyRevenueDatum {
  monthYear: string;
  shortLabel: string;
  fullLabel: string;
  mensalidades: number;
  extras: number;
  total: number;
  personalizado: number;
  grupo: number;
  payingStudents: number;
}

interface MonthlyNewStudentsDatum {
  monthYear: string;
  shortLabel: string;
  fullLabel: string;
  grupo: number;
  personalizado: number;
  total: number;
  names: string[];
}

interface LoyaltySliceDatum {
  key: '12m' | '6m' | 'mensal';
  name: string;
  value: number;
  pct: number;
  color: string;
}

function buildRecentMonthBuckets(count: PeriodMonths): Array<{
  monthYear: string;
  shortLabel: string;
  fullLabel: string;
}> {
  const now = new Date();
  const list: Array<{ monthYear: string; shortLabel: string; fullLabel: string }> = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const mIdx = d.getMonth();
    list.push({
      monthYear: `${yyyy}-${mm}`,
      shortLabel: count === 12 ? PT_MONTH_SHORT[mIdx] : `${PT_MONTH_SHORT[mIdx]} ${String(yyyy).slice(-2)}`,
      fullLabel: `${PT_MONTH_FULL[mIdx]} ${yyyy}`,
    });
  }
  return list;
}

function toMonthYearFromMillis(ms: number): string {
  if (!ms || ms <= 0) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resolveClientJoinMonthYear(
  client: ClientRecord,
  earliestFidStartByClient: Map<string, number>,
  earliestPaymentMonthByClient: Map<string, string>,
  earliestBookingMsByClient: Map<string, number>
): string {
  if (client.createdAtMillis && client.createdAtMillis > 0) {
    return toMonthYearFromMillis(client.createdAtMillis);
  }
  const fidStart = Math.min(
    client.fidelizacaoStartMillis > 0 ? client.fidelizacaoStartMillis : Number.POSITIVE_INFINITY,
    earliestFidStartByClient.get(client.id) ?? Number.POSITIVE_INFINITY
  );
  if (Number.isFinite(fidStart) && fidStart > 0) {
    return toMonthYearFromMillis(fidStart);
  }
  const payMonth = earliestPaymentMonthByClient.get(client.id);
  if (payMonth) return payMonth;
  const bookingMs = earliestBookingMsByClient.get(client.id);
  if (bookingMs && bookingMs > 0) return toMonthYearFromMillis(bookingMs);
  return '';
}

interface TooltipPropsBase<T> {
  active?: boolean;
  payload?: Array<{ payload?: T }>;
}

const RevenueTooltip: React.FC<TooltipPropsBase<MonthlyRevenueDatum>> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="min-w-[210px] rounded-xl border border-[#EAB308]/45 bg-[#161619]/95 p-3 shadow-2xl backdrop-blur-md">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#FACC15]">
        {d.fullLabel}
      </p>
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#F4F4F5] font-semibold">Mensalidades</span>
          <span className="font-extrabold text-[#FACC15]">€{d.mensalidades.toFixed(2)}</span>
        </div>
        {d.extras > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#A1A1AA]">Extras (Seguro/Jóia)</span>
            <span className="font-bold text-[#38BDF8]">+€{d.extras.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-[#323238] pt-1.5 space-y-1">
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-[#A1A1AA]">Personalizado</span>
            <span className="font-semibold text-[#FDE68A]">€{d.personalizado.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-[#A1A1AA]">Grupo</span>
            <span className="font-semibold text-[#93C5FD]">€{d.grupo.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-[#A1A1AA]">Alunos pagantes</span>
            <span className="font-bold text-white">{d.payingStudents}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewStudentsTooltip: React.FC<TooltipPropsBase<MonthlyNewStudentsDatum>> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="min-w-[195px] max-w-[240px] rounded-xl border border-[#22C55E]/45 bg-[#161619]/95 p-3 shadow-2xl backdrop-blur-md">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#86EFAC]">
        {d.fullLabel}
      </p>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-[#F4F4F5]">Novos alunos</span>
          <span className="font-extrabold text-white">{d.total}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[#A1A1AA]">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            Grupo
          </span>
          <span className="font-bold text-[#86EFAC]">{d.grupo}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[#A1A1AA]">
            <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
            Personalizado
          </span>
          <span className="font-bold text-[#FACC15]">{d.personalizado}</span>
        </div>
        {d.names.length > 0 && (
          <div className="mt-1.5 border-t border-[#323238] pt-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
              Entradas:
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#D4D4D8]">
              {d.names.slice(0, 4).join(', ')}
              {d.names.length > 4 ? ` +${d.names.length - 4}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const LoyaltyTooltip: React.FC<TooltipPropsBase<LoyaltySliceDatum>> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-xl border border-[#323238] bg-[#161619]/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="text-xs font-bold text-[#F4F4F5]">{d.name}</span>
      </div>
      <p className="mt-1 text-xs font-extrabold text-white">
        {d.value} aluno(s) <span className="font-semibold text-[#A1A1AA]">({d.pct}%)</span>
      </p>
    </div>
  );
};

export const BusinessSummaryCard: React.FC<BusinessSummaryCardProps> = ({
  clients,
  payments,
  fidelizacoes,
  bookings,
  isSuperAdmin,
  userEmail,
  onJumpToFinance,
  onJumpToFidelizacoes,
}) => {
  const [periodMonths, setPeriodMonths] = useState<PeriodMonths>(6);
  const [focus, setFocus] = useState<ChartFocus>('all');
  const [collapsed, setCollapsed] = useState(false);

  // Strict admin-only gate
  const canView =
    isSuperAdmin && (userEmail === undefined || isSuperAdminEmail(userEmail));

  const analytics = useMemo(() => {
    const months = buildRecentMonthBuckets(periodMonths);
    const currentMonthYear = months[months.length - 1]?.monthYear ?? '';
    const prevMonthYear = months[months.length - 2]?.monthYear ?? '';
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    // 1) Revenue Evolution (Mensalidades recebidas)
    const revMap = new Map<string, MonthlyRevenueDatum & { payerIds: Set<string> }>();
    months.forEach((m) => {
      revMap.set(m.monthYear, {
        monthYear: m.monthYear,
        shortLabel: m.shortLabel,
        fullLabel: m.fullLabel,
        mensalidades: 0,
        extras: 0,
        total: 0,
        personalizado: 0,
        grupo: 0,
        payingStudents: 0,
        payerIds: new Set<string>(),
      });
    });

    let futurePrepaidEur = 0;
    payments.forEach((p) => {
      if (!p.paid || !p.monthYear) return;
      if (currentMonthYear && p.monthYear > currentMonthYear) {
        futurePrepaidEur += p.amountEur;
        return;
      }
      const bucket = revMap.get(p.monthYear);
      if (!bucket) return;
      const extra = isExtraFeePayment(p.note);
      const isPers = clientMap.get(p.clientId)?.trainingType === 'PERSONALIZADO';
      if (extra) {
        bucket.extras = Number((bucket.extras + p.amountEur).toFixed(2));
      } else {
        bucket.mensalidades = Number((bucket.mensalidades + p.amountEur).toFixed(2));
        if (isPers) {
          bucket.personalizado = Number((bucket.personalizado + p.amountEur).toFixed(2));
        } else {
          bucket.grupo = Number((bucket.grupo + p.amountEur).toFixed(2));
        }
        if (p.clientId) bucket.payerIds.add(p.clientId);
      }
      bucket.total = Number((bucket.mensalidades + bucket.extras).toFixed(2));
      bucket.payingStudents = bucket.payerIds.size;
    });

    const revenueSeries: MonthlyRevenueDatum[] = months.map((m) => {
      const b = revMap.get(m.monthYear)!;
      return {
        monthYear: b.monthYear,
        shortLabel: b.shortLabel,
        fullLabel: b.fullLabel,
        mensalidades: b.mensalidades,
        extras: b.extras,
        total: b.total,
        personalizado: b.personalizado,
        grupo: b.grupo,
        payingStudents: b.payingStudents,
      };
    });

    const totalMensalidadesWindow = revenueSeries.reduce((s, r) => s + r.mensalidades, 0);
    const totalExtrasWindow = revenueSeries.reduce((s, r) => s + r.extras, 0);
    const avgMonthlyMensalidades = totalMensalidadesWindow / periodMonths;
    const currentMonthMensalidades = revMap.get(currentMonthYear)?.mensalidades ?? 0;
    const prevMonthMensalidades = revMap.get(prevMonthYear)?.mensalidades ?? 0;
    const revenueDeltaPct =
      prevMonthMensalidades > 0
        ? Math.round(((currentMonthMensalidades - prevMonthMensalidades) / prevMonthMensalidades) * 100)
        : null;

    // 2) New Students per Month
    const earliestFidStartByClient = new Map<string, number>();
    fidelizacoes.forEach((f) => {
      if (f.startDateMillis > 0) {
        const cur = earliestFidStartByClient.get(f.clientId);
        if (cur === undefined || f.startDateMillis < cur) {
          earliestFidStartByClient.set(f.clientId, f.startDateMillis);
        }
      }
    });

    const earliestPaymentMonthByClient = new Map<string, string>();
    payments.forEach((p) => {
      if (p.paid && p.monthYear) {
        const cur = earliestPaymentMonthByClient.get(p.clientId);
        if (!cur || p.monthYear < cur) {
          earliestPaymentMonthByClient.set(p.clientId, p.monthYear);
        }
      }
    });

    const earliestBookingMsByClient = new Map<string, number>();
    bookings.forEach((b) => {
      if (b.requestedAtMillis > 0) {
        const cur = earliestBookingMsByClient.get(b.clientId);
        if (cur === undefined || b.requestedAtMillis < cur) {
          earliestBookingMsByClient.set(b.clientId, b.requestedAtMillis);
        }
      }
    });

    const studentMap = new Map<string, MonthlyNewStudentsDatum>();
    months.forEach((m) => {
      studentMap.set(m.monthYear, {
        monthYear: m.monthYear,
        shortLabel: m.shortLabel,
        fullLabel: m.fullLabel,
        grupo: 0,
        personalizado: 0,
        total: 0,
        names: [],
      });
    });

    clients.forEach((c) => {
      const joinYm = resolveClientJoinMonthYear(
        c,
        earliestFidStartByClient,
        earliestPaymentMonthByClient,
        earliestBookingMsByClient
      );
      if (!joinYm) return;
      const bucket = studentMap.get(joinYm);
      if (!bucket) return;
      if (c.trainingType === 'PERSONALIZADO') {
        bucket.personalizado += 1;
      } else {
        bucket.grupo += 1;
      }
      bucket.total += 1;
      bucket.names.push(c.name);
    });

    const newStudentsSeries = months.map((m) => studentMap.get(m.monthYear)!);
    const totalNewStudentsWindow = newStudentsSeries.reduce((s, r) => s + r.total, 0);
    const currentMonthNewStudents = studentMap.get(currentMonthYear)?.total ?? 0;
    const prevMonthNewStudents = studentMap.get(prevMonthYear)?.total ?? 0;
    const newStudentsDiff = currentMonthNewStudents - prevMonthNewStudents;

    // 3) Loyalty / Fidelização Rate
    const activeClients = clients.filter((c) => c.active);
    const totalClientsCount = clients.length;
    const activeClientsCount = activeClients.length;
    const activeRetentionPct =
      totalClientsCount > 0 ? Math.round((activeClientsCount / totalClientsCount) * 100) : 0;

    let count12m = 0;
    let count6m = 0;
    let countMensal = 0;
    let persFidelized = 0;
    let persTotal = 0;
    let grupoFidelized = 0;
    let grupoTotal = 0;

    activeClients.forEach((c) => {
      const eff = getEffectiveClientFidelizacaoMonths(c, fidelizacoes);
      if (eff === 12) count12m += 1;
      else if (eff === 6) count6m += 1;
      else countMensal += 1;

      const hasLoyalty = eff >= 6;
      if (c.trainingType === 'PERSONALIZADO') {
        persTotal += 1;
        if (hasLoyalty) persFidelized += 1;
      } else {
        grupoTotal += 1;
        if (hasLoyalty) grupoFidelized += 1;
      }
    });

    const fidelizedCount = count12m + count6m;
    const loyaltyRatePct =
      activeClientsCount > 0 ? Math.round((fidelizedCount / activeClientsCount) * 100) : 0;

    const now = Date.now();
    const expiringSoonCount = fidelizacoes.filter((f) => {
      const daysLeft = Math.floor((f.endDateMillis - now) / 86_400_000);
      return daysLeft >= 0 && daysLeft <= 30;
    }).length;

    const loyaltySlices: LoyaltySliceDatum[] = [
      {
        key: '12m',
        name: 'Fidelização 12 meses',
        value: count12m,
        pct: activeClientsCount > 0 ? Math.round((count12m / activeClientsCount) * 100) : 0,
        color: '#EAB308',
      },
      {
        key: '6m',
        name: 'Fidelização 6 meses',
        value: count6m,
        pct: activeClientsCount > 0 ? Math.round((count6m / activeClientsCount) * 100) : 0,
        color: '#38BDF8',
      },
      {
        key: 'mensal',
        name: 'Sem fidelização (Mensal)',
        value: countMensal,
        pct: activeClientsCount > 0 ? Math.round((countMensal / activeClientsCount) * 100) : 0,
        color: '#52525B',
      },
    ];

    return {
      revenueSeries,
      totalMensalidadesWindow,
      totalExtrasWindow,
      avgMonthlyMensalidades,
      currentMonthMensalidades,
      revenueDeltaPct,
      futurePrepaidEur,
      newStudentsSeries,
      totalNewStudentsWindow,
      currentMonthNewStudents,
      newStudentsDiff,
      totalClientsCount,
      activeClientsCount,
      activeRetentionPct,
      fidelizedCount,
      loyaltyRatePct,
      expiringSoonCount,
      loyaltySlices,
      persLoyaltyPct: persTotal > 0 ? Math.round((persFidelized / persTotal) * 100) : 0,
      grupoLoyaltyPct: grupoTotal > 0 ? Math.round((grupoFidelized / grupoTotal) * 100) : 0,
      persTotal,
      grupoTotal,
    };
  }, [clients, payments, fidelizacoes, bookings, periodMonths]);

  if (!canView) return null;

  const nonZeroLoyaltySlices = analytics.loyaltySlices.filter((s) => s.value > 0);

  return (
    <BrandCard highlight className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3D3314] text-[#FACC15] border border-[#EAB308]/40">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-[#F4F4F5]">
                  Resumo de Negócio
                </h2>
                <StatusPill tone="gold">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                </StatusPill>
              </div>
              <p className="text-[11px] sm:text-xs text-[#A1A1AA]">
                Evolução de mensalidades recebidas, novos alunos por mês e taxa de fidelização
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!collapsed && (
            <div className="inline-flex rounded-xl border border-[#323238] bg-[#121214] p-0.5 text-[11px] font-bold">
              {([6, 12] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPeriodMonths(m)}
                  className={`min-h-[30px] rounded-lg px-2.5 py-1 transition ${
                    periodMonths === m
                      ? 'bg-[#EAB308] text-[#121214]'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {m}M
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expandir resumo de negócio' : 'Minimizar resumo de negócio'}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#323238] bg-[#242429] px-2.5 py-1.5 text-xs font-bold text-[#D4D4D8] hover:border-[#EAB308]/60 hover:text-white transition"
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-4 w-4 text-[#FACC15]" />
                <span className="hidden sm:inline">Expandir</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 text-[#A1A1AA]" />
                <span className="hidden sm:inline">Minimizar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Executive KPI Cards (always visible even when charts are collapsed) */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* KPI 1: Mensalidades */}
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setFocus((cur) => (cur === 'revenue' ? 'all' : 'revenue'));
          }}
          className={`group text-left rounded-2xl border p-3.5 transition ${
            focus === 'revenue' && !collapsed
              ? 'border-[#EAB308] bg-[#3D3314]/45'
              : 'border-[#323238] bg-[#161619] hover:border-[#EAB308]/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FACC15]">
              <CreditCard className="h-3.5 w-3.5" />
              Mensalidades (Mês)
            </span>
            {analytics.revenueDeltaPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  analytics.revenueDeltaPct >= 0
                    ? 'bg-[#143521] text-[#86EFAC]'
                    : 'bg-[#3B1518] text-[#FCA5A5]'
                }`}
              >
                {analytics.revenueDeltaPct >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {analytics.revenueDeltaPct >= 0 ? '+' : ''}
                {analytics.revenueDeltaPct}%
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-white">
            €{analytics.currentMonthMensalidades.toFixed(0)}
          </p>
          <p className="mt-1 text-[11px] text-[#A1A1AA]">
            Média {periodMonths}m:{' '}
            <span className="font-semibold text-[#D4D4D8]">
              €{analytics.avgMonthlyMensalidades.toFixed(0)}/mês
            </span>
            {analytics.futurePrepaidEur > 0 && (
              <span className="text-[#86EFAC]">
                {' '}
                · +€{analytics.futurePrepaidEur.toFixed(0)} adiant.
              </span>
            )}
          </p>
        </button>

        {/* KPI 2: Novos Alunos */}
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setFocus((cur) => (cur === 'students' ? 'all' : 'students'));
          }}
          className={`group text-left rounded-2xl border p-3.5 transition ${
            focus === 'students' && !collapsed
              ? 'border-[#22C55E] bg-[#143521]/45'
              : 'border-[#323238] bg-[#161619] hover:border-[#22C55E]/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86EFAC]">
              <UserPlus className="h-3.5 w-3.5" />
              Novos Alunos ({periodMonths}m)
            </span>
            <span className="rounded-full bg-[#143521] px-2 py-0.5 text-[10px] font-extrabold text-[#86EFAC]">
              +{analytics.currentMonthNewStudents} este mês
            </span>
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-white">
            +{analytics.totalNewStudentsWindow}
          </p>
          <p className="mt-1 text-[11px] text-[#A1A1AA]">
            Base ativa:{' '}
            <span className="font-semibold text-[#D4D4D8]">
              {analytics.activeClientsCount} aluno(s)
            </span>{' '}
            ({analytics.totalClientsCount} total)
          </p>
        </button>

        {/* KPI 3: Taxa de Fidelização */}
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setFocus((cur) => (cur === 'loyalty' ? 'all' : 'loyalty'));
          }}
          className={`group text-left rounded-2xl border p-3.5 transition ${
            focus === 'loyalty' && !collapsed
              ? 'border-[#38BDF8] bg-[#102A3A]/55'
              : 'border-[#323238] bg-[#161619] hover:border-[#38BDF8]/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
              <Award className="h-3.5 w-3.5" />
              Taxa de Fidelização
            </span>
            <span className="rounded-full bg-[#102A3A] px-2 py-0.5 text-[10px] font-extrabold text-[#7DD3FC]">
              Ativos {analytics.activeRetentionPct}%
            </span>
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-white">
            {analytics.loyaltyRatePct}%
          </p>
          <p className="mt-1 text-[11px] text-[#A1A1AA]">
            <span className="font-semibold text-[#D4D4D8]">
              {analytics.fidelizedCount}/{analytics.activeClientsCount}
            </span>{' '}
            com plano 6m/12m
            {analytics.expiringSoonCount > 0 && (
              <span className="text-[#FACC15]"> · {analytics.expiringSoonCount} a renovar</span>
            )}
          </p>
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 space-y-4">
          {/* Focus Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#323238]/80 pt-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Todos os gráficos' },
                  { id: 'revenue', label: 'Mensalidades' },
                  { id: 'students', label: 'Novos alunos' },
                  { id: 'loyalty', label: 'Fidelização' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFocus(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                    focus === tab.id
                      ? 'bg-[#EAB308] text-[#121214]'
                      : 'border border-[#323238] bg-[#161619] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {onJumpToFinance && (
                <button
                  type="button"
                  onClick={onJumpToFinance}
                  className="text-[11px] font-bold text-[#FACC15] hover:underline"
                >
                  Abrir Finanças →
                </button>
              )}
              {onJumpToFidelizacoes && (
                <button
                  type="button"
                  onClick={onJumpToFidelizacoes}
                  className="text-[11px] font-bold text-[#38BDF8] hover:underline"
                >
                  Gerir Fidelizações →
                </button>
              )}
            </div>
          </div>

          {/* Charts Bento Grid */}
          <div
            className={`grid grid-cols-1 gap-4 ${
              focus === 'all' ? 'lg:grid-cols-2' : ''
            }`}
          >
            {/* Chart 1: Evolução de Mensalidades Recebidas */}
            {(focus === 'all' || focus === 'revenue') && (
              <div
                className={`rounded-2xl border border-[#323238] bg-[#161619] p-4 ${
                  focus === 'all' ? 'lg:col-span-2' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#F4F4F5]">
                      <BarChart3 className="h-4 w-4 text-[#EAB308]" />
                      Evolução de Mensalidades Recebidas ({periodMonths} meses)
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA]">
                      Total no período:{' '}
                      <span className="font-bold text-[#FACC15]">
                        €{analytics.totalMensalidadesWindow.toFixed(2)}
                      </span>
                      {analytics.totalExtrasWindow > 0 && (
                        <span>
                          {' '}
                          + €{analytics.totalExtrasWindow.toFixed(2)} extras (seguro/jóia)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#A1A1AA]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
                      Mensalidades (€)
                    </span>
                    {analytics.avgMonthlyMensalidades > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-3 bg-[#38BDF8]" />
                        Média (€{analytics.avgMonthlyMensalidades.toFixed(0)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 h-[220px] w-full">
                  {analytics.totalMensalidadesWindow <= 0 ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#121214]/70 p-4 text-center">
                      <CreditCard className="h-6 w-6 text-[#EAB308]/60" />
                      <p className="mt-2 text-xs font-bold text-[#F4F4F5]">
                        Sem mensalidades recebidas neste período
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                        Assim que registares pagamentos, a curva de evolução é atualizada automaticamente.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analytics.revenueSeries}
                        margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="nsMensalidadesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EAB308" stopOpacity={0.42} />
                            <stop offset="95%" stopColor="#EAB308" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#27272A"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fill: '#A1A1AA', fontSize: 11, fontWeight: 600 }}
                          axisLine={{ stroke: '#323238' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#A1A1AA', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `€${v}`}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        {analytics.avgMonthlyMensalidades > 0 && (
                          <ReferenceLine
                            y={analytics.avgMonthlyMensalidades}
                            stroke="#38BDF8"
                            strokeDasharray="4 4"
                            strokeOpacity={0.75}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="mensalidades"
                          name="Mensalidades"
                          stroke="#EAB308"
                          strokeWidth={2.5}
                          fill="url(#nsMensalidadesGrad)"
                          dot={{ r: 3.5, fill: '#FACC15', stroke: '#121214', strokeWidth: 1.5 }}
                          activeDot={{ r: 6, fill: '#FACC15', stroke: '#121214', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Chart 2: Novos Alunos por Mês */}
            {(focus === 'all' || focus === 'students') && (
              <div className="rounded-2xl border border-[#323238] bg-[#161619] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#F4F4F5]">
                      <UserPlus className="h-4 w-4 text-[#22C55E]" />
                      Novos Alunos por Mês
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA]">
                      {analytics.totalNewStudentsWindow} entrada(s) nos últimos {periodMonths} meses
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] text-[#A1A1AA]">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                      Grupo
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
                      Personalizado
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-[215px] w-full">
                  {analytics.totalNewStudentsWindow <= 0 ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#121214]/70 p-4 text-center">
                      <Users className="h-6 w-6 text-[#22C55E]/60" />
                      <p className="mt-2 text-xs font-bold text-[#F4F4F5]">
                        Sem novos alunos registados neste período
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                        Novos alunos adicionados aparecem agrupados por mês de entrada.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.newStudentsSeries}
                        margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#27272A"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fill: '#A1A1AA', fontSize: 11, fontWeight: 600 }}
                          axisLine={{ stroke: '#323238' }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: '#A1A1AA', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<NewStudentsTooltip />}
                          cursor={{ fill: 'rgba(34, 197, 94, 0.08)' }}
                        />
                        <Bar
                          dataKey="grupo"
                          name="Grupo"
                          stackId="newStudents"
                          fill="#22C55E"
                          radius={[0, 0, 0, 0]}
                          maxBarSize={30}
                        />
                        <Bar
                          dataKey="personalizado"
                          name="Personalizado"
                          stackId="newStudents"
                          fill="#EAB308"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Chart 3: Taxa de Fidelização */}
            {(focus === 'all' || focus === 'loyalty') && (
              <div className="rounded-2xl border border-[#323238] bg-[#161619] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#F4F4F5]">
                      <Award className="h-4 w-4 text-[#38BDF8]" />
                      Taxa de Fidelização
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA]">
                      Distribuição de contratos entre alunos ativos ({analytics.activeClientsCount})
                    </p>
                  </div>
                  <StatusPill tone={analytics.loyaltyRatePct >= 60 ? 'green' : analytics.loyaltyRatePct >= 35 ? 'gold' : 'amber'}>
                    {analytics.loyaltyRatePct}% fidelizados
                  </StatusPill>
                </div>

                {analytics.activeClientsCount === 0 ? (
                  <div className="mt-3 flex h-[215px] flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#121214]/70 p-4 text-center">
                    <Award className="h-6 w-6 text-[#38BDF8]/60" />
                    <p className="mt-2 text-xs font-bold text-[#F4F4F5]">
                      Sem alunos ativos ainda
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                      Adiciona alunos para calcular a taxa de fidelização em tempo real.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                    {/* Donut Chart */}
                    <div className="relative h-[190px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={nonZeroLoyaltySlices}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="62%"
                            outerRadius="86%"
                            paddingAngle={nonZeroLoyaltySlices.length > 1 ? 3 : 0}
                            cornerRadius={6}
                            stroke="none"
                          >
                            {nonZeroLoyaltySlices.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<LoyaltyTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-white">
                          {analytics.loyaltyRatePct}%
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                          Fidelizados
                        </span>
                      </div>
                    </div>

                    {/* Contract Breakdown & Retention Metrics */}
                    <div className="space-y-2.5">
                      {analytics.loyaltySlices.map((s) => (
                        <div key={s.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1.5 text-[#D4D4D8] font-medium">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </span>
                            <span className="font-bold text-white">
                              {s.value}{' '}
                              <span className="text-[11px] font-normal text-[#A1A1AA]">
                                ({s.pct}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#242429]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#323238] pt-2.5 text-[11px]">
                        <div className="rounded-xl bg-[#1B1B1E] px-2.5 py-2 border border-[#323238]/70">
                          <p className="text-[#A1A1AA]">Grupo fidel.</p>
                          <p className="mt-0.5 font-extrabold text-[#F4F4F5]">
                            {analytics.grupoTotal > 0 ? `${analytics.grupoLoyaltyPct}%` : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#1B1B1E] px-2.5 py-2 border border-[#323238]/70">
                          <p className="text-[#A1A1AA]">Person. fidel.</p>
                          <p className="mt-0.5 font-extrabold text-[#FACC15]">
                            {analytics.persTotal > 0 ? `${analytics.persLoyaltyPct}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </BrandCard>
  );
};
