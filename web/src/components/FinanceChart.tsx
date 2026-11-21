import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ShieldCheck } from 'lucide-react';
import {
  ClientRecord,
  PaymentRecord,
  isSuperAdminEmail,
} from '../types/studio';
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

export interface FinanceChartProps {
  payments: PaymentRecord[];
  clients: ClientRecord[];
  isSuperAdmin: boolean;
  userEmail?: string | null;
}

interface MonthlyChartDatum {
  monthYear: string;
  shortLabel: string;
  fullLabel: string;
  personalizado: number;
  grupo: number;
  total: number;
  personalizadoCount: number;
  grupoCount: number;
}

interface CustomTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: MonthlyChartDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}

const FinanceChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="min-w-[200px] rounded-xl border border-[#EAB308]/45 bg-[#161619]/95 p-3 shadow-2xl backdrop-blur-md">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#FACC15]">
        {datum.fullLabel}
      </p>
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-[#F4F4F5]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#EAB308]" />
            Personalizado
          </span>
          <span className="font-bold text-[#FACC15]">
            €{datum.personalizado.toFixed(2)}{' '}
            <span className="font-normal text-[#A1A1AA]">
              ({datum.personalizadoCount})
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-[#F4F4F5]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#60A5FA]" />
            Grupo
          </span>
          <span className="font-bold text-[#60A5FA]">
            €{datum.grupo.toFixed(2)}{' '}
            <span className="font-normal text-[#A1A1AA]">
              ({datum.grupoCount})
            </span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-[#323238] pt-1.5">
          <span className="font-semibold text-[#A1A1AA]">Total Recebido</span>
          <span className="font-extrabold text-white">€{datum.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

function buildLastSixMonths(): Array<{
  monthYear: string;
  shortLabel: string;
  fullLabel: string;
}> {
  const now = new Date();
  const months: Array<{ monthYear: string; shortLabel: string; fullLabel: string }> = [];
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const idx = d.getMonth();
    months.push({
      monthYear: `${yyyy}-${mm}`,
      shortLabel: `${PT_MONTH_SHORT[idx]} ${String(yyyy).slice(-2)}`,
      fullLabel: `${PT_MONTH_FULL[idx]} ${yyyy}`,
    });
  }
  return months;
}

export const FinanceChart: React.FC<FinanceChartProps> = ({
  payments,
  clients,
  isSuperAdmin,
  userEmail,
}) => {
  const [chartMode, setChartMode] = useState<'grouped' | 'stacked'>('grouped');

  // Strict admin-only gate (pafm77pedrinho77@gmail.com)
  const canView =
    isSuperAdmin && (userEmail === undefined || isSuperAdminEmail(userEmail));

  const { data, totalPersonalizado, totalGrupo, grandTotal, totalCount } = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const baseMonths = buildLastSixMonths();
    const bucketMap = new Map<string, MonthlyChartDatum>();

    baseMonths.forEach((m) => {
      bucketMap.set(m.monthYear, {
        monthYear: m.monthYear,
        shortLabel: m.shortLabel,
        fullLabel: m.fullLabel,
        personalizado: 0,
        grupo: 0,
        total: 0,
        personalizadoCount: 0,
        grupoCount: 0,
      });
    });

    payments.forEach((p) => {
      if (!p.paid || !p.monthYear) return;
      const bucket = bucketMap.get(p.monthYear);
      if (!bucket) return;
      const client = clientMap.get(p.clientId);
      const isPersonalizado = client?.trainingType === 'PERSONALIZADO';
      if (isPersonalizado) {
        bucket.personalizado = Number((bucket.personalizado + p.amountEur).toFixed(2));
        bucket.personalizadoCount += 1;
      } else {
        bucket.grupo = Number((bucket.grupo + p.amountEur).toFixed(2));
        bucket.grupoCount += 1;
      }
      bucket.total = Number((bucket.personalizado + bucket.grupo).toFixed(2));
    });

    const rows = baseMonths.map((m) => bucketMap.get(m.monthYear)!);
    const sumPers = rows.reduce((s, r) => s + r.personalizado, 0);
    const sumGrupo = rows.reduce((s, r) => s + r.grupo, 0);
    const count = rows.reduce((s, r) => s + r.personalizadoCount + r.grupoCount, 0);

    return {
      data: rows,
      totalPersonalizado: sumPers,
      totalGrupo: sumGrupo,
      grandTotal: sumPers + sumGrupo,
      totalCount: count,
    };
  }, [payments, clients]);

  if (!canView) return null;

  const persShare = grandTotal > 0 ? Math.round((totalPersonalizado / grandTotal) * 100) : 0;
  const grupoShare = grandTotal > 0 ? Math.round((totalGrupo / grandTotal) * 100) : 0;

  return (
    <BrandCard highlight>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#EAB308]" />
            <h3 className="text-sm sm:text-base font-bold text-[#F4F4F5]">
              Mensalidades Recebidas — Últimos 6 Meses
            </h3>
            <StatusPill tone="gold">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            </StatusPill>
          </div>
          <p className="mt-0.5 text-xs text-[#A1A1AA]">
            Comparação mensal entre Treino Personalizado e Treino em Grupo ({totalCount} mensalidade(s) paga(s))
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#323238] bg-[#121214] p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setChartMode('grouped')}
            className={`rounded-lg px-2.5 py-1 transition ${
              chartMode === 'grouped'
                ? 'bg-[#EAB308] text-[#121214]'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Lado a lado
          </button>
          <button
            type="button"
            onClick={() => setChartMode('stacked')}
            className={`rounded-lg px-2.5 py-1 transition ${
              chartMode === 'stacked'
                ? 'bg-[#EAB308] text-[#121214]'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Empilhado
          </button>
        </div>
      </div>

      {/* 6-Month Totals Strip */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#EAB308]/30 bg-[#3D3314]/35 px-3 py-2">
          <p className="text-[11px] font-semibold text-[#FACC15]">Personalizado (6m)</p>
          <p className="mt-0.5 text-sm sm:text-base font-extrabold text-white">
            €{totalPersonalizado.toFixed(2)}
          </p>
          <p className="text-[10px] text-[#A1A1AA]">{persShare}% do total</p>
        </div>
        <div className="rounded-xl border border-[#60A5FA]/30 bg-[#172554]/35 px-3 py-2">
          <p className="text-[11px] font-semibold text-[#60A5FA]">Grupo (6m)</p>
          <p className="mt-0.5 text-sm sm:text-base font-extrabold text-white">
            €{totalGrupo.toFixed(2)}
          </p>
          <p className="text-[10px] text-[#A1A1AA]">{grupoShare}% do total</p>
        </div>
        <div className="rounded-xl border border-[#323238] bg-[#242429] px-3 py-2">
          <p className="text-[11px] font-semibold text-[#A1A1AA]">Total (6 meses)</p>
          <p className="mt-0.5 text-sm sm:text-base font-extrabold text-[#22C55E]">
            €{grandTotal.toFixed(2)}
          </p>
          <p className="text-[10px] text-[#A1A1AA]">
            Média €{(grandTotal / 6).toFixed(0)}/mês
          </p>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="mt-4 h-[260px] w-full">
        {grandTotal === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#161619] p-6 text-center">
            <BarChart3 className="h-7 w-7 text-[#EAB308]/60" />
            <p className="mt-2 text-sm font-bold text-[#F4F4F5]">
              Ainda sem mensalidades recebidas nos últimos 6 meses
            </p>
            <p className="mt-1 max-w-sm text-xs text-[#A1A1AA]">
              Assim que registares pagamentos de alunos de treino personalizado ou grupo, o gráfico é atualizado automaticamente.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -12, bottom: 2 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2C2C33"
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
                tickFormatter={(value: number) => `€${value}`}
              />
              <Tooltip
                content={<FinanceChartTooltip />}
                cursor={{ fill: 'rgba(234, 179, 8, 0.08)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Bar
                dataKey="personalizado"
                name="Treino Personalizado"
                stackId={chartMode === 'stacked' ? 'revenue' : undefined}
                fill="#EAB308"
                radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="grupo"
                name="Treino em Grupo"
                stackId={chartMode === 'stacked' ? 'revenue' : undefined}
                fill="#60A5FA"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </BrandCard>
  );
};
