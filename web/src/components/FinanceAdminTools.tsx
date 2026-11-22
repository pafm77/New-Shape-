import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Download,
  FileSpreadsheet,
  MessageCircle,
} from 'lucide-react';
import { ClientRecord, FidelizacaoRecord, PaymentRecord } from '../types/studio';
import {
  PAYMENT_METHODS,
  buildRecentMonthOptions,
  buildWhatsAppUrl,
  formatShortDate,
  getPaymentCategory,
  isExtraFeePayment,
  normalizePaymentMethod,
} from '../data/seedCatalog';
import { BrandCard, GoldButton, StatusPill } from './UiPrimitives';

interface FinanceAdminToolsProps {
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  whatsappWebMode: boolean;
  onQuickPay: (client: ClientRecord) => void;
  onBanner: (msg: string) => void;
}

type ExportPeriod = 'current_month' | 'last_6_months' | 'all' | 'all_with_future';

function csvEscape(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildLastNMonthKeys(count: number): Set<string> {
  const keys = new Set<string>();
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export const FinanceAdminTools: React.FC<FinanceAdminToolsProps> = ({
  isSuperAdmin,
  clients,
  payments,
  fidelizacoes,
  whatsappWebMode,
  onQuickPay,
  onBanner,
}) => {
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('current_month');

  const recentMonths = useMemo(() => buildRecentMonthOptions(), []);
  const currentMonthYear = recentMonths[0]?.monthYear || '';
  const currentMonthLabel = recentMonths[0]?.monthLabel || '';

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);

  // Ponto 2A: Active clients without a paid monthly fee for current month (excludes Seguro/Jóia)
  const overdueClients = useMemo(() => {
    const paidThisMonthIds = new Set(
      payments
        .filter((p) => p.paid && p.monthYear === currentMonthYear && !isExtraFeePayment(p.note))
        .map((p) => p.clientId)
    );
    return activeClients.filter((c) => !paidThisMonthIds.has(c.id));
  }, [activeClients, payments, currentMonthYear]);

  // Ponto 2B: Active clients whose latest fidelização expires within 30 days or is expired
  const expiringFidelizacoes = useMemo(() => {
    const now = Date.now();
    const activeIds = new Set(activeClients.map((c) => c.id));
    const latestByClient = new Map<string, FidelizacaoRecord>();
    fidelizacoes.forEach((f) => {
      if (!activeIds.has(f.clientId)) return;
      const cur = latestByClient.get(f.clientId);
      if (!cur || f.endDateMillis > cur.endDateMillis) {
        latestByClient.set(f.clientId, f);
      }
    });
    const list: Array<{ client: ClientRecord; fidelizacao: FidelizacaoRecord; daysLeft: number }> = [];
    latestByClient.forEach((fid, clientId) => {
      const client = clientMap.get(clientId);
      if (!client) return;
      const daysLeft = Math.floor((fid.endDateMillis - now) / 86_400_000);
      if (daysLeft <= 30) {
        list.push({ client, fidelizacao: fid, daysLeft });
      }
    });
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [activeClients, fidelizacoes, clientMap]);

  // Ponto 7: Filtered payments for CSV accounting export
  const exportPayments = useMemo(() => {
    const paid = payments.filter((p) => p.paid);
    if (exportPeriod === 'current_month') {
      return paid.filter((p) => p.monthYear === currentMonthYear);
    }
    if (exportPeriod === 'last_6_months') {
      const keys = buildLastNMonthKeys(6);
      return paid.filter((p) => keys.has(p.monthYear));
    }
    if (exportPeriod === 'all' && currentMonthYear) {
      return paid.filter((p) => p.monthYear <= currentMonthYear);
    }
    return paid;
  }, [payments, exportPeriod, currentMonthYear]);

  if (!isSuperAdmin) return null;

  const openWhatsApp = (phone: string, msg: string) => {
    const url = buildWhatsAppUrl(phone, msg, whatsappWebMode);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleExportAccountingCsv = () => {
    const sorted = exportPayments
      .slice()
      .sort((a, b) => (b.monthYear.localeCompare(a.monthYear)) || (b.paidAtMillis - a.paidAtMillis));

    const lines: string[] = [];
    lines.push('Mes;Data Pagamento;Aluno;Modalidade;Tipo;Metodo;Valor (EUR);Estado');

    let totalPers = 0;
    let totalGrupo = 0;
    let totalMensalidades = 0;
    let totalExtras = 0;
    const methodTotals: Record<string, number> = { MbWay: 0, Dinheiro: 0, João: 0, Outro: 0 };

    sorted.forEach((p) => {
      const client = clientMap.get(p.clientId);
      const modalidade =
        client?.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo';
      const category = getPaymentCategory(p.note);
      const tipoLabel =
        category === 'SEGURO'
          ? 'Seguro'
          : category === 'JOIA'
          ? 'Jóia de Inscrição'
          : 'Mensalidade';
      const method = normalizePaymentMethod(p.note) || (p.note?.trim() || 'Outro');
      if (modalidade === 'Personalizado') totalPers += p.amountEur;
      else totalGrupo += p.amountEur;
      if (category === 'MENSALIDADE') totalMensalidades += p.amountEur;
      else totalExtras += p.amountEur;
      if (method in methodTotals) methodTotals[method] += p.amountEur;
      else methodTotals.Outro += p.amountEur;

      const statusLabel = !p.paid
        ? 'Pendente'
        : currentMonthYear && p.monthYear > currentMonthYear
        ? 'Pré-pago (Futuro)'
        : 'Pago';

      lines.push(
        [
          csvEscape(p.monthLabel || p.monthYear),
          csvEscape(p.paidAtMillis > 0 ? formatShortDate(p.paidAtMillis) : ''),
          csvEscape(client?.name || 'Aluno'),
          csvEscape(modalidade),
          csvEscape(tipoLabel),
          csvEscape(method),
          csvEscape(p.amountEur.toFixed(2).replace('.', ',')),
          csvEscape(statusLabel),
        ].join(';')
      );
    });

    const grandTotal = totalPers + totalGrupo;
    lines.push('');
    lines.push('RESUMO CONTABILISTICO;Valor (EUR)');
    lines.push(`Mensalidades;${totalMensalidades.toFixed(2).replace('.', ',')}`);
    lines.push(`Seguro e Joia de Inscricao;${totalExtras.toFixed(2).replace('.', ',')}`);
    lines.push(`Treino Personalizado;${totalPers.toFixed(2).replace('.', ',')}`);
    lines.push(`Treino em Grupo;${totalGrupo.toFixed(2).replace('.', ',')}`);
    PAYMENT_METHODS.forEach((m) => {
      lines.push(`Metodo ${m};${(methodTotals[m] || 0).toFixed(2).replace('.', ',')}`);
    });
    if (methodTotals.Outro > 0) {
      lines.push(`Metodo Outro;${methodTotals.Outro.toFixed(2).replace('.', ',')}`);
    }
    lines.push(`TOTAL FATURADO;${grandTotal.toFixed(2).replace('.', ',')}`);

    // UTF-8 BOM for clean Portuguese characters in Excel
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const suffix =
      exportPeriod === 'current_month'
        ? currentMonthYear
        : exportPeriod === 'last_6_months'
        ? 'ultimos_6_meses'
        : exportPeriod === 'all_with_future'
        ? 'historico_com_futuros'
        : 'historico_realizado';
    const a = document.createElement('a');
    a.href = url;
    a.download = `newshape_faturacao_${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onBanner(`CSV contabilístico exportado (${sorted.length} registo(s))!`);
  };

  return (
    <div className="space-y-4">
      {/* Ponto 2: Alertas de Mensalidades em Atraso & Fidelizações a Expirar */}
      <BrandCard highlight={overdueClients.length > 0 || expiringFidelizacoes.length > 0}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
            <div>
              <h3 className="text-base font-bold text-[#F4F4F5]">
                Alertas de Cobrança & Renovações
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Acompanhamento automático de mensalidades pendentes ({currentMonthLabel}) e contratos a expirar
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={overdueClients.length > 0 ? 'amber' : 'green'}>
              {overdueClients.length} por pagar
            </StatusPill>
            <StatusPill tone={expiringFidelizacoes.length > 0 ? 'red' : 'green'}>
              {expiringFidelizacoes.length} a renovar
            </StatusPill>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Overdue Monthly Fees */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#FACC15]">
              Mensalidades em Falta ({currentMonthLabel})
            </p>
            {overdueClients.length === 0 ? (
              <div className="rounded-xl border border-[#22C55E]/30 bg-[#143521]/40 p-3 text-xs text-[#86EFAC]">
                Todos os alunos ativos já têm a mensalidade de {currentMonthLabel} regularizada ✓
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {overdueClients.map((c) => {
                  const feeText = c.monthlyFeeEur > 0 ? ` (€${c.monthlyFeeEur.toFixed(0)})` : '';
                  const firstName = c.name.trim().split(/\s+/)[0] || c.name;
                  const waMsg = `Olá ${firstName}! 👋 Lembrete simpático da New Shape relativo à mensalidade de ${currentMonthLabel}${feeText}. Quando puderes regularizar, avisa-me. Obrigado e bons treinos! 💪`;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/35 bg-[#242429] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                          <StatusPill
                            tone={c.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}
                          >
                            {c.trainingType === 'PERSONALIZADO' ? 'Pers.' : 'Grupo'}
                          </StatusPill>
                        </div>
                        <p className="text-xs text-[#F59E0B]">
                          {c.monthlyFeeEur > 0
                            ? `€${c.monthlyFeeEur.toFixed(0)}/mês · Pendente`
                            : 'Sem registo este mês'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openWhatsApp(c.phone, waMsg)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#22C55E]/50 bg-[#143521] px-2.5 py-1.5 text-xs font-bold text-[#86EFAC] hover:bg-[#1A472A]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickPay(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#EAB308] px-2.5 py-1.5 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Registar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expiring Fidelizações */}
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#FACC15]">
              <CalendarClock className="h-3.5 w-3.5" />
              Fidelizações a Expirar (≤ 30 dias)
            </p>
            {expiringFidelizacoes.length === 0 ? (
              <div className="rounded-xl border border-[#22C55E]/30 bg-[#143521]/40 p-3 text-xs text-[#86EFAC]">
                Nenhuma fidelização a expirar nos próximos 30 dias ✓
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {expiringFidelizacoes.map(({ client, fidelizacao, daysLeft }) => {
                  const firstName = client.name.trim().split(/\s+/)[0] || client.name;
                  const endStr = formatShortDate(fidelizacao.endDateMillis);
                  const waMsg =
                    daysLeft < 0
                      ? `Olá ${firstName}! A tua fidelização de ${fidelizacao.durationMonths} meses na New Shape terminou em ${endStr}. Queres conversar sobre a renovação do teu plano? 💪`
                      : `Olá ${firstName}! A tua fidelização de ${fidelizacao.durationMonths} meses na New Shape termina em ${endStr} (faltam ${daysLeft} dias). Vamos preparar a renovação? 💪`;
                  return (
                    <div
                      key={fidelizacao.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EF4444]/35 bg-[#242429] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-[#F4F4F5]">{client.name}</p>
                          <StatusPill tone={daysLeft < 0 ? 'red' : 'amber'}>
                            {daysLeft < 0 ? 'Expirada' : `Faltam ${daysLeft}d`}
                          </StatusPill>
                        </div>
                        <p className="text-xs text-[#A1A1AA]">
                          {fidelizacao.durationMonths} meses · Fim em {endStr}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(client.phone, waMsg)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#EAB308]/60 bg-[#3D3314] px-2.5 py-1.5 text-xs font-bold text-[#FACC15] hover:bg-[#52441A]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Avisar Renovação
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </BrandCard>

      {/* Ponto 7: Exportação Financeira para Contabilidade (CSV / Excel) */}
      <BrandCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#EAB308]" />
            <div>
              <h3 className="text-base font-bold text-[#F4F4F5]">
                Exportação para Contabilidade (CSV / Excel)
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Gera ficheiro compatível com Excel PT (UTF-8, separador ponto e vírgula) com detalhe por aluno, modalidade, método e totais.
              </p>
            </div>
          </div>
          <StatusPill tone="gold">{exportPayments.length} registo(s)</StatusPill>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'current_month' as const, label: `Este mês (${currentMonthLabel})` },
                { id: 'last_6_months' as const, label: 'Últimos 6 meses' },
                { id: 'all' as const, label: 'Realizado (até hoje)' },
                { id: 'all_with_future' as const, label: 'Tudo (+ futuros)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setExportPeriod(opt.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  exportPeriod === opt.id
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <GoldButton
            disabled={exportPayments.length === 0}
            onClick={handleExportAccountingCsv}
          >
            <Download className="h-4 w-4" />
            Exportar CSV (Excel)
          </GoldButton>
        </div>
      </BrandCard>
    </div>
  );
};
