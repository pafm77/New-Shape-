import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  CheckCheck,
  CreditCard,
  Edit3,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  ArrowLeft,
  UserX,
} from 'lucide-react';
import {
  ChatMessageRecord,
  ClientRecord,
  FidelizacaoRecord,
  PaymentRecord,
  PtAccountRecord,
  PtNotificationRecord,
  StudioSettingsRecord,
  TrainingType,
} from '../types/studio';
import {
  MONTHS_PT,
  PAYMENT_METHODS,
  PaymentMethod,
  buildConsecutiveMonths,
  buildRecentMonthOptions,
  formatPhoneDisplay,
  formatShortDate,
  formatTimeAgo,
  getEffectiveClientFidelizacaoMonths,
  getPaymentCategory,
  isExtraFeePayment,
  normalizePaymentMethod,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
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
import { RegisterPaymentModal, SplitPaymentFidelizacaoModal } from './PtClientsSection';
import { FinanceChart } from './FinanceChart';
import { FinanceAdminTools } from './FinanceAdminTools';
import { AppInstallGuideSubTab } from './AppInstallGuideSubTab';

export type ManagementSubTab = 'finance' | 'team' | 'fidelizacao' | 'chat' | 'guide';

interface PtManagementSectionProps {
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  chatMessages: ChatMessageRecord[];
  ptNotifications?: PtNotificationRecord[];
  ptAccounts: PtAccountRecord[];
  settings: StudioSettingsRecord;
  whatsappWebMode?: boolean;
  initialSubTab?: ManagementSubTab;
  initialChatClientId?: string;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

export const PtManagementSection: React.FC<PtManagementSectionProps> = ({
  uid,
  isSuperAdmin,
  clients,
  payments,
  fidelizacoes,
  chatMessages,
  ptNotifications = [],
  ptAccounts,
  settings,
  whatsappWebMode = false,
  initialSubTab = 'finance',
  initialChatClientId = '',
  onOpenWhatsApp,
  onBanner,
}) => {
  const safeInitial: ManagementSubTab =
    !isSuperAdmin && (initialSubTab === 'finance' || initialSubTab === 'team')
      ? 'fidelizacao'
      : initialSubTab;
  const [subTab, setSubTab] = useState<ManagementSubTab>(safeInitial);
  const [selectedChatClientId, setSelectedChatClientId] = useState(initialChatClientId);

  useEffect(() => {
    if (!initialSubTab) return;
    if (!isSuperAdmin && (initialSubTab === 'finance' || initialSubTab === 'team')) {
      setSubTab('fidelizacao');
    } else {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab, isSuperAdmin]);

  useEffect(() => {
    if (initialChatClientId) setSelectedChatClientId(initialChatClientId);
  }, [initialChatClientId]);

  const pendingPtCount = useMemo(
    () => ptAccounts.filter((a) => !a.isAdmin && a.status === 'PENDING').length,
    [ptAccounts]
  );

  const unreadChatCount = useMemo(
    () => chatMessages.filter((m) => m.senderRole === 'STUDENT' && !m.readAtMillis).length,
    [chatMessages]
  );

  const tabs: Array<{ id: ManagementSubTab; label: string; badge?: number }> = isSuperAdmin
    ? [
        { id: 'finance', label: 'Finanças' },
        {
          id: 'team',
          label: 'Equipa PT',
          badge: pendingPtCount > 0 ? pendingPtCount : undefined,
        },
        { id: 'fidelizacao', label: 'Fidelizações' },
        { id: 'chat', label: 'Chat', badge: unreadChatCount > 0 ? unreadChatCount : undefined },
        { id: 'guide', label: 'Guia App (PDF)' },
      ]
    : [
        { id: 'fidelizacao', label: 'Fidelizações' },
        { id: 'chat', label: 'Chat', badge: unreadChatCount > 0 ? unreadChatCount : undefined },
        { id: 'guide', label: 'Guia App (PDF)' },
      ];

  return (
    <div className="space-y-4">
      <div
        className={`grid gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5 ${
          isSuperAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3'
        }`}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs sm:text-sm font-bold transition ${
              subTab === t.id
                ? 'bg-[#EAB308] text-[#121214]'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${
                  subTab === t.id
                    ? 'bg-[#121214] text-[#FACC15]'
                    : 'bg-[#EF4444] text-white'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {isSuperAdmin && subTab === 'finance' && (
        <FinanceSubTab
          uid={uid}
          isSuperAdmin={isSuperAdmin}
          clients={clients}
          payments={payments}
          fidelizacoes={fidelizacoes}
          whatsappWebMode={whatsappWebMode}
          onBanner={onBanner}
        />
      )}

      {isSuperAdmin && subTab === 'team' && (
        <TeamApprovalSubTab ptAccounts={ptAccounts} onBanner={onBanner} />
      )}

      {subTab === 'fidelizacao' && (
        <FidelizacaoSubTab
          uid={uid}
          isSuperAdmin={isSuperAdmin}
          clients={clients}
          fidelizacoes={fidelizacoes}
          onBanner={onBanner}
        />
      )}

      {subTab === 'chat' && (
        <PtChatSubTab
          uid={uid}
          clients={clients}
          chatMessages={chatMessages}
          ptNotifications={ptNotifications}
          selectedClientId={selectedChatClientId}
          onSelectClient={setSelectedChatClientId}
        />
      )}

      {subTab === 'guide' && (
        <AppInstallGuideSubTab
          uid={uid}
          settings={settings}
          onOpenWhatsApp={onOpenWhatsApp}
          onBanner={onBanner}
        />
      )}
    </div>
  );
};

const TeamApprovalSubTab: React.FC<{
  ptAccounts: PtAccountRecord[];
  onBanner: (msg: string) => void;
}> = ({ ptAccounts, onBanner }) => {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const nonAdminAccounts = useMemo(
    () => ptAccounts.filter((a) => !a.isAdmin),
    [ptAccounts]
  );
  const pending = nonAdminAccounts.filter((a) => a.status === 'PENDING');
  const reviewed = nonAdminAccounts.filter((a) => a.status !== 'PENDING');

  const handleReview = async (acc: PtAccountRecord, status: 'APPROVED' | 'REJECTED') => {
    setBusyUid(acc.uid);
    try {
      await repo.reviewPtAccount(acc.uid, status);
      onBanner(
        status === 'APPROVED'
          ? `PT ${acc.displayName || acc.email} confirmado e autorizado!`
          : `Registo de ${acc.displayName || acc.email} recusado.`
      );
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#F4F4F5]">Aprovação de Personal Trainers</h2>
        <p className="text-xs text-[#A1A1AA]">
          Apenas o administrador pode confirmar novos PTs registados. Os restantes PTs não têm
          acesso à faturação.
        </p>
      </div>

      <BrandCard highlight={pending.length > 0}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#EAB308]" />
            <h3 className="text-sm font-bold text-[#FACC15]">
              Pedidos Pendentes ({pending.length})
            </h3>
          </div>
          <StatusPill tone={pending.length > 0 ? 'amber' : 'green'}>
            {pending.length > 0 ? 'Requer confirmação' : 'Tudo em dia'}
          </StatusPill>
        </div>

        {pending.length === 0 ? (
          <p className="mt-2.5 text-xs text-[#A1A1AA]">
            Não há novos Personal Trainers a aguardar confirmação neste momento.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {pending.map((acc) => (
              <div
                key={acc.uid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAB308]/40 bg-[#242429] p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#F4F4F5]">
                    {acc.displayName || 'Personal Trainer'}
                  </p>
                  <p className="truncate text-xs text-[#A1A1AA]">{acc.email}</p>
                  {acc.requestedAtMillis > 0 && (
                    <p className="mt-0.5 text-[11px] text-[#FACC15]">
                      Registado em {formatShortDate(acc.requestedAtMillis)} ·{' '}
                      {formatTimeAgo(acc.requestedAtMillis)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <GoldButton
                    disabled={busyUid === acc.uid}
                    onClick={() => handleReview(acc, 'APPROVED')}
                  >
                    <Check className="h-4 w-4" />
                    Confirmar PT
                  </GoldButton>
                  <button
                    type="button"
                    disabled={busyUid === acc.uid}
                    onClick={() => handleReview(acc, 'REJECTED')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#EF4444]/40 bg-[#3B1518] px-3 py-2 text-xs font-bold text-[#FCA5A5] hover:bg-[#521C20] disabled:opacity-50"
                  >
                    <UserX className="h-4 w-4" />
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </BrandCard>

      <BrandCard>
        <h3 className="text-sm font-bold text-[#F4F4F5]">
          Personal Trainers Registados ({reviewed.length})
        </h3>
        {reviewed.length === 0 ? (
          <p className="mt-2 text-xs text-[#A1A1AA]">
            Ainda não existem outros Personal Trainers aprovados ou recusados.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {reviewed.map((acc) => {
              const approved = acc.status === 'APPROVED';
              return (
                <div
                  key={acc.uid}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#242429] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold text-[#F4F4F5]">
                        {acc.displayName || 'Personal Trainer'}
                      </p>
                      <StatusPill tone={approved ? 'green' : 'red'}>
                        {approved ? 'Aprovado · Sem faturação' : 'Recusado'}
                      </StatusPill>
                    </div>
                    <p className="truncate text-xs text-[#A1A1AA]">{acc.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {approved ? (
                      <button
                        type="button"
                        disabled={busyUid === acc.uid}
                        onClick={() => handleReview(acc, 'REJECTED')}
                        className="rounded-lg border border-[#323238] bg-[#1B1B1E] px-2.5 py-1.5 text-xs font-bold text-[#FCA5A5] hover:border-[#EF4444]"
                      >
                        Revogar acesso
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyUid === acc.uid}
                        onClick={() => handleReview(acc, 'APPROVED')}
                        className="rounded-lg bg-[#EAB308] px-2.5 py-1.5 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                      >
                        Aprovar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BrandCard>
    </div>
  );
};

const FinanceSubTab: React.FC<{
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  whatsappWebMode: boolean;
  onBanner: (msg: string) => void;
}> = ({ uid, isSuperAdmin, clients, payments, fidelizacoes, whatsappWebMode, onBanner }) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const [pickClientModal, setPickClientModal] = useState(false);
  const [payClient, setPayClient] = useState<ClientRecord | null>(null);
  const [splitTargetPayment, setSplitTargetPayment] = useState<PaymentRecord | null>(null);
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [trainingFilter, setTrainingFilter] = useState<'ALL' | TrainingType>('ALL');
  const [periodScope, setPeriodScope] = useState<'realized' | 'current_month' | 'all_with_future'>(
    'realized'
  );

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const allPaidPayments = useMemo(() => payments.filter((p) => p.paid), [payments]);

  const recentMonths = useMemo(() => buildRecentMonthOptions(), []);
  const currentMonthYear = recentMonths[0]?.monthYear || '';
  const currentMonthLabel = recentMonths[0]?.monthLabel || '';

  const futurePrepaidPayments = useMemo(
    () =>
      currentMonthYear
        ? allPaidPayments.filter((p) => p.monthYear > currentMonthYear)
        : [],
    [allPaidPayments, currentMonthYear]
  );

  const futurePrepaidTotal = useMemo(
    () => futurePrepaidPayments.reduce((s, p) => s + p.amountEur, 0),
    [futurePrepaidPayments]
  );

  const scopedAllPaidPayments = useMemo(() => {
    if (periodScope === 'current_month') {
      return allPaidPayments.filter((p) => p.monthYear === currentMonthYear);
    }
    if (periodScope === 'realized' && currentMonthYear) {
      return allPaidPayments.filter((p) => p.monthYear <= currentMonthYear);
    }
    return allPaidPayments;
  }, [allPaidPayments, periodScope, currentMonthYear]);

  const getPaymentType = (p: PaymentRecord): TrainingType =>
    clientMap.get(p.clientId)?.trainingType === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'GRUPO';

  const paidPayments = useMemo(
    () =>
      trainingFilter === 'ALL'
        ? scopedAllPaidPayments
        : scopedAllPaidPayments.filter((p) => getPaymentType(p) === trainingFilter),
    [scopedAllPaidPayments, trainingFilter, clientMap]
  );

  const trainingBreakdown = useMemo(() => {
    const calc = (type: TrainingType) => {
      const list = scopedAllPaidPayments.filter((p) => getPaymentType(p) === type);
      const monthlyList = list.filter((p) => !isExtraFeePayment(p.note));
      const total = list.reduce((s, p) => s + p.amountEur, 0);
      const monthList = list.filter((p) => p.monthYear === currentMonthYear);
      const monthTotal = monthList.reduce((s, p) => s + p.amountEur, 0);
      const monthlyTotal = monthlyList.reduce((s, p) => s + p.amountEur, 0);
      const pairCount = new Set(monthlyList.map((p) => `${p.clientId}__${p.monthYear}`)).size;
      const avgPerStudent = pairCount > 0 ? monthlyTotal / pairCount : 0;
      return {
        count: monthlyList.length,
        totalRecords: list.length,
        total,
        monthTotal,
        monthCount: monthList.filter((p) => !isExtraFeePayment(p.note)).length,
        avgPerStudent,
      };
    };
    return {
      PERSONALIZADO: calc('PERSONALIZADO'),
      GRUPO: calc('GRUPO'),
    };
  }, [scopedAllPaidPayments, currentMonthYear, clientMap]);

  const monthlyFeePayments = useMemo(
    () => paidPayments.filter((p) => !isExtraFeePayment(p.note)),
    [paidPayments]
  );
  const extraFeePayments = useMemo(
    () => paidPayments.filter((p) => isExtraFeePayment(p.note)),
    [paidPayments]
  );
  const extraFeeTotal = useMemo(
    () => extraFeePayments.reduce((s, p) => s + p.amountEur, 0),
    [extraFeePayments]
  );

  const currentMonthPayments = useMemo(
    () => paidPayments.filter((p) => p.monthYear === currentMonthYear),
    [paidPayments, currentMonthYear]
  );
  const currentMonthMonthlyPayments = useMemo(
    () => currentMonthPayments.filter((p) => !isExtraFeePayment(p.note)),
    [currentMonthPayments]
  );
  const currentMonthExtraTotal = useMemo(
    () =>
      currentMonthPayments
        .filter((p) => isExtraFeePayment(p.note))
        .reduce((s, p) => s + p.amountEur, 0),
    [currentMonthPayments]
  );

  const currentMonthRevenue = useMemo(
    () => currentMonthPayments.reduce((s, p) => s + p.amountEur, 0),
    [currentMonthPayments]
  );
  const currentMonthMonthlyRevenue = useMemo(
    () => currentMonthMonthlyPayments.reduce((s, p) => s + p.amountEur, 0),
    [currentMonthMonthlyPayments]
  );

  const totalRevenue = useMemo(
    () => paidPayments.reduce((s, p) => s + p.amountEur, 0),
    [paidPayments]
  );
  const monthlyFeeTotal = useMemo(
    () => monthlyFeePayments.reduce((s, p) => s + p.amountEur, 0),
    [monthlyFeePayments]
  );

  const activeMonthsCount = Math.max(
    1,
    new Set(monthlyFeePayments.map((p) => p.monthYear).filter(Boolean)).size
  );
  const monthlyAvg = monthlyFeePayments.length > 0 ? monthlyFeeTotal / activeMonthsCount : 0;

  const studentMonthPairsCount = useMemo(() => {
    const keys = new Set(
      monthlyFeePayments.map((p) => `${p.clientId}__${p.monthYear}`)
    );
    return keys.size;
  }, [monthlyFeePayments]);

  const avgMonthlyPerStudent =
    studentMonthPairsCount > 0 ? monthlyFeeTotal / studentMonthPairsCount : 0;

  const currentMonthUniqueStudents = useMemo(
    () => new Set(currentMonthMonthlyPayments.map((p) => p.clientId)).size,
    [currentMonthMonthlyPayments]
  );

  const currentMonthAvgPerStudent =
    currentMonthUniqueStudents > 0
      ? currentMonthMonthlyRevenue / currentMonthUniqueStudents
      : 0;

  const groupedByMethod = useMemo(() => {
    const groups: Record<PaymentMethod, PaymentRecord[]> = {
      MbWay: [],
      Dinheiro: [],
      João: [],
    };
    const other: PaymentRecord[] = [];
    paidPayments.forEach((p) => {
      const m = normalizePaymentMethod(p.note);
      if (m) {
        groups[m].push(p);
      } else {
        other.push(p);
      }
    });
    return { groups, other };
  }, [paidPayments]);

  const visibleMethods: PaymentMethod[] =
    methodFilter === 'ALL' ? [...PAYMENT_METHODS] : [methodFilter];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Finanças & Faturação</h2>
          <p className="text-xs text-[#A1A1AA]">
            Controlo mensal (fidelizações de 6/12 meses divididas por mês) e listas por método
          </p>
        </div>
        <GoldButton
          disabled={activeClients.length === 0}
          onClick={() => setPickClientModal(true)}
        >
          <Plus className="h-4 w-4" />
          Pagamento
        </GoldButton>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'realized' as const, label: 'Até este mês (Realizado)' },
                { id: 'current_month' as const, label: `Só ${currentMonthLabel}` },
                {
                  id: 'all_with_future' as const,
                  label:
                    futurePrepaidPayments.length > 0
                      ? `Incluir futuros (+${futurePrepaidPayments.length})`
                      : 'Incluir futuros',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodScope(opt.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  periodScope === opt.id
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  id: 'ALL' as const,
                  label: `Todos (${
                    trainingBreakdown.PERSONALIZADO.count + trainingBreakdown.GRUPO.count
                  })`,
                },
                {
                  id: 'PERSONALIZADO' as const,
                  label: `Treino Personalizado (${trainingBreakdown.PERSONALIZADO.count})`,
                },
                {
                  id: 'GRUPO' as const,
                  label: `Treino em Grupo (${trainingBreakdown.GRUPO.count})`,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTrainingFilter(opt.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  trainingFilter === opt.id
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {futurePrepaidPayments.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EAB308]/35 bg-[#3D3314]/45 px-3.5 py-2 text-xs text-[#FACC15]">
            <span>
              <strong>Fidelizações pré-pagas (meses futuros):</strong>{' '}
              {futurePrepaidPayments.length} mensalidade(s) · €{futurePrepaidTotal.toFixed(2)} —
              contabilizadas automaticamente 1 por mês (sem inflacionar o mês do pagamento).
            </span>
          </div>
        )}
      </div>

      {/* Distinção Personalizado vs Grupo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            {
              key: 'PERSONALIZADO' as const,
              title: 'Treino Personalizado',
              tone: 'gold' as const,
              accent: 'text-[#FACC15]',
              data: trainingBreakdown.PERSONALIZADO,
            },
            {
              key: 'GRUPO' as const,
              title: 'Treino em Grupo',
              tone: 'blue' as const,
              accent: 'text-[#60A5FA]',
              data: trainingBreakdown.GRUPO,
            },
          ] as const
        ).map((item) => {
          const active = trainingFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTrainingFilter(active ? 'ALL' : item.key)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? 'border-[#EAB308] bg-[#3D3314]/50'
                  : 'border-[#323238] bg-[#1B1B1E] hover:border-[#EAB308]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#F4F4F5]">{item.title}</span>
                <StatusPill tone={item.tone}>{item.data.count} mens.</StatusPill>
              </div>
              <p className={`mt-1.5 text-2xl font-extrabold ${item.accent}`}>
                €{item.data.total.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-[#A1A1AA]">
                Este mês ({currentMonthLabel}):{' '}
                <strong className="text-[#F4F4F5]">€{item.data.monthTotal.toFixed(2)}</strong> ·
                Média/aluno:{' '}
                <strong className="text-[#F4F4F5]">€{item.data.avgPerStudent.toFixed(2)}</strong>
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <BrandCard highlight>
          <p className="text-xs text-[#A1A1AA]">Faturação ({currentMonthLabel})</p>
          <p className="mt-1 text-2xl font-extrabold text-[#FACC15]">
            €{currentMonthRevenue.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            {currentMonthMonthlyPayments.length} mens.
            {currentMonthExtraTotal > 0 ? ` + €${currentMonthExtraTotal.toFixed(2)} seguro/jóia` : ' este mês'}
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-xs text-[#A1A1AA]">Média Mensal</p>
          <p className="mt-1 text-2xl font-extrabold text-[#F4F4F5]">
            €{monthlyAvg.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            só mensalidades ({activeMonthsCount} mês/es)
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-xs text-[#A1A1AA]">Média Mensal / Aluno</p>
          <p className="mt-1 text-2xl font-extrabold text-[#60A5FA]">
            €{avgMonthlyPerStudent.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            {currentMonthUniqueStudents > 0
              ? `Este mês: €${currentMonthAvgPerStudent.toFixed(2)} (${currentMonthUniqueStudents} al.)`
              : `${studentMonthPairsCount} mens./aluno (excl. seguro/jóia)`}
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-xs text-[#A1A1AA]">Mensalidades Pagas</p>
          <p className="mt-1 text-2xl font-extrabold text-[#22C55E]">
            {monthlyFeePayments.length}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            {extraFeePayments.length > 0
              ? `+ ${extraFeePayments.length} seguro/jóia (€${extraFeeTotal.toFixed(2)})`
              : '1 por mês de fidelização'}
          </p>
        </BrandCard>
        <BrandCard className="col-span-2 lg:col-span-1">
          <p className="text-xs text-[#A1A1AA]">
            {periodScope === 'current_month'
              ? `Total (${currentMonthLabel})`
              : periodScope === 'all_with_future'
              ? 'Total (c/ futuros)'
              : 'Total Realizado'}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#FACC15]">
            €{totalRevenue.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
            {extraFeeTotal > 0
              ? `Inclui €${extraFeeTotal.toFixed(2)} seguro/jóia`
              : periodScope === 'realized'
              ? 'Até este mês (1/mês fidel.)'
              : periodScope === 'current_month'
              ? 'Apenas mês atual'
              : 'Inclui meses pré-pagos'}
          </p>
        </BrandCard>
      </div>

      <FinanceChart
        payments={payments}
        clients={clients}
        isSuperAdmin={isSuperAdmin}
      />

      <FinanceAdminTools
        isSuperAdmin={isSuperAdmin}
        clients={clients}
        payments={payments}
        fidelizacoes={fidelizacoes}
        whatsappWebMode={whatsappWebMode}
        onQuickPay={(c) => setPayClient(c)}
        onBanner={onBanner}
      />

      {/* Totais por Método de Pagamento + Filtro */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[#F4F4F5]">
            Faturação por Método de Pagamento
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMethodFilter('ALL')}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                methodFilter === 'ALL'
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
              }`}
            >
              Todas as Listas ({paidPayments.length})
            </button>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  methodFilter === m
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {m} ({groupedByMethod.groups[m].length})
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => {
            const list = groupedByMethod.groups[m];
            const sum = list.reduce((s, p) => s + p.amountEur, 0);
            const active = methodFilter === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(active ? 'ALL' : m)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-[#EAB308] bg-[#3D3314]/50'
                    : 'border-[#323238] bg-[#1B1B1E] hover:border-[#EAB308]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#A1A1AA]">
                    {m}
                  </span>
                  <StatusPill tone="gold">{list.length} reg.</StatusPill>
                </div>
                <p className="mt-1.5 text-xl font-extrabold text-[#FACC15]">
                  €{sum.toFixed(2)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Listas separadas por MbWay, Dinheiro e João */}
      {paidPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="Sem pagamentos registados"
          subtitle="Clica em + Pagamento para registar a primeira mensalidade."
        />
      ) : (
        <div className="space-y-4">
          {visibleMethods.map((methodName) => {
            const list = groupedByMethod.groups[methodName];
            const subtotal = list.reduce((s, p) => s + p.amountEur, 0);
            const title =
              methodName === 'Dinheiro'
                ? 'Pagamentos em Dinheiro'
                : `Pagamentos por ${methodName}`;

            return (
              <BrandCard key={methodName}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#323238] pb-3">
                  <div>
                    <h4 className="text-base font-bold text-[#F4F4F5]">{title}</h4>
                    <p className="text-xs text-[#A1A1AA]">
                      {list.length} mensalidade(s) registada(s)
                    </p>
                  </div>
                  <StatusPill tone="gold">Subtotal: €{subtotal.toFixed(2)}</StatusPill>
                </div>

                {list.length === 0 ? (
                  <p className="pt-3 text-xs text-[#A1A1AA]">
                    Sem pagamentos registados por {methodName}.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {list.map((p) => {
                      const client = clientMap.get(p.clientId);
                      const isFuture = Boolean(currentMonthYear && p.monthYear > currentMonthYear);
                      const isFid = p.note.toLowerCase().includes('fideliza');
                      const category = getPaymentCategory(p.note);
                      const isExtra = category !== 'MENSALIDADE';
                      const fidDetail = isFid ? p.note.split('·').slice(1).join('·').trim() : '';
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-bold text-[#F4F4F5]">
                                {client?.name || 'Aluno'} ·{' '}
                                <span className="text-[#FACC15]">€{p.amountEur.toFixed(2)}</span>
                              </p>
                              <StatusPill
                                tone={
                                  client?.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'
                                }
                              >
                                {client?.trainingType === 'PERSONALIZADO'
                                  ? 'Personalizado'
                                  : 'Grupo'}
                              </StatusPill>
                              {category === 'SEGURO' && <StatusPill tone="blue">Seguro</StatusPill>}
                              {category === 'JOIA' && <StatusPill tone="amber">Jóia</StatusPill>}
                              {isFuture && <StatusPill tone="amber">Futuro</StatusPill>}
                            </div>
                            <p className="text-xs text-[#A1A1AA]">
                              {p.monthLabel} · {formatShortDate(p.paidAtMillis)}
                              {fidDetail ? (
                                <span className="text-[#FACC15]/90"> · {fidDetail}</span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {!isFid && !isExtra && p.amountEur > 0 && (
                              <button
                                type="button"
                                onClick={() => setSplitTargetPayment(p)}
                                className="rounded-lg border border-[#EAB308]/50 bg-[#3D3314]/60 px-2 py-1 text-[11px] font-bold text-[#FACC15] hover:bg-[#3D3314]"
                              >
                                Dividir 6/12m
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                await repo.deletePayment(uid, p.id);
                                onBanner('Pagamento removido.');
                              }}
                              aria-label="Apagar pagamento"
                              className="rounded-lg p-2 text-[#EF4444] hover:bg-[#3B1518]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </BrandCard>
            );
          })}

          {methodFilter === 'ALL' && groupedByMethod.other.length > 0 && (
            <BrandCard>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#323238] pb-3">
                <div>
                  <h4 className="text-base font-bold text-[#F4F4F5]">
                    Outros Registos (histórico antigo)
                  </h4>
                  <p className="text-xs text-[#A1A1AA]">
                    {groupedByMethod.other.length} registo(s) anteriores
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {groupedByMethod.other.map((p) => {
                  const client = clientMap.get(p.clientId);
                  const isFuture = Boolean(currentMonthYear && p.monthYear > currentMonthYear);
                  const isFid = p.note.toLowerCase().includes('fideliza');
                  const category = getPaymentCategory(p.note);
                  const isExtra = category !== 'MENSALIDADE';
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-[#F4F4F5]">
                            {client?.name || 'Aluno'} ·{' '}
                            <span className="text-[#FACC15]">€{p.amountEur.toFixed(2)}</span>
                          </p>
                          <StatusPill
                            tone={
                              client?.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'
                            }
                          >
                            {client?.trainingType === 'PERSONALIZADO'
                              ? 'Personalizado'
                              : 'Grupo'}
                          </StatusPill>
                          {category === 'SEGURO' && <StatusPill tone="blue">Seguro</StatusPill>}
                          {category === 'JOIA' && <StatusPill tone="amber">Jóia</StatusPill>}
                          {isFuture && <StatusPill tone="amber">Futuro</StatusPill>}
                        </div>
                        <p className="text-xs text-[#A1A1AA]">
                          {p.monthLabel} · {formatShortDate(p.paidAtMillis)}
                          {p.note ? ` · ${p.note}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isFid && !isExtra && p.amountEur > 0 && (
                          <button
                            type="button"
                            onClick={() => setSplitTargetPayment(p)}
                            className="rounded-lg border border-[#EAB308]/50 bg-[#3D3314]/60 px-2 py-1 text-[11px] font-bold text-[#FACC15] hover:bg-[#3D3314]"
                          >
                            Dividir 6/12m
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await repo.deletePayment(uid, p.id);
                            onBanner('Pagamento removido.');
                          }}
                          aria-label="Apagar pagamento"
                          className="rounded-lg p-2 text-[#EF4444] hover:bg-[#3B1518]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </BrandCard>
          )}
        </div>
      )}

      {pickClientModal && (
        <Modal
          open
          title="Escolher Aluno para Pagamento"
          onClose={() => setPickClientModal(false)}
        >
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {activeClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setPickClientModal(false);
                  setPayClient(c);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-left hover:border-[#EAB308]"
              >
                <div>
                  <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                  <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(c.phone)}</p>
                </div>
                <span className="text-xs font-bold text-[#EAB308]">
                  {c.monthlyFeeEur > 0 ? `€${c.monthlyFeeEur}/mês` : 'Selecionar →'}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {payClient && (
        <RegisterPaymentModal
          clientName={payClient.name}
          defaultAmount={payClient.monthlyFeeEur > 0 ? payClient.monthlyFeeEur : 120}
          defaultDurationMonths={getEffectiveClientFidelizacaoMonths(payClient, fidelizacoes)}
          onClose={() => setPayClient(null)}
          onConfirm={async (my, ml, amt, method, durationMonths, extras) => {
            await repo.recordPayment(uid, payClient.id, my, ml, amt, method, durationMonths, extras);
            setPayClient(null);
            const extraParts: string[] = [];
            if (extras.seguroEur > 0) extraParts.push(`Seguro €${extras.seguroEur.toFixed(2)}`);
            if (extras.joiaEur > 0) extraParts.push(`Jóia €${extras.joiaEur.toFixed(2)}`);
            const extraSuffix = extraParts.length > 0 ? ` + ${extraParts.join(' + ')}` : '';
            onBanner(
              durationMonths > 1 && amt > 0
                ? `Pagamento de ${durationMonths} meses (€${(
                    amt / durationMonths
                  ).toFixed(2)}/mês)${extraSuffix} registado e adicionado às Fidelizações!`
                : `Pagamento registado${extraSuffix ? ` (${extraParts.join(' + ')})` : ''}!`
            );
          }}
        />
      )}

      {splitTargetPayment && (
        <SplitPaymentFidelizacaoModal
          clientName={clientMap.get(splitTargetPayment.clientId)?.name || 'Aluno'}
          payment={splitTargetPayment}
          defaultMonths={
            getEffectiveClientFidelizacaoMonths(
              clientMap.get(splitTargetPayment.clientId),
              fidelizacoes
            ) === 12
              ? 12
              : 6
          }
          onClose={() => setSplitTargetPayment(null)}
          onConfirm={async (months) => {
            await repo.splitPaymentIntoFidelizacao(uid, splitTargetPayment, months);
            setSplitTargetPayment(null);
            onBanner(
              `Pagamento dividido por ${months} meses (€${(
                splitTargetPayment.amountEur / months
              ).toFixed(2)}/mês) e adicionado às Fidelizações!`
            );
          }}
        />
      )}
    </div>
  );
};

const FidelizacaoSubTab: React.FC<{
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  fidelizacoes: FidelizacaoRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, isSuperAdmin, clients, fidelizacoes, onBanner }) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FidelizacaoRecord | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Fidelizações (6 / 12 meses)</h2>
          <p className="text-xs text-[#A1A1AA]">
            Acompanha contratos ativos, progresso e datas de renovação
          </p>
        </div>
        <GoldButton
          disabled={activeClients.length === 0}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Fidelização
        </GoldButton>
      </div>

      {fidelizacoes.length === 0 ? (
        <EmptyState
          icon={<Award className="h-6 w-6" />}
          title="Sem contratos de fidelização"
          subtitle="Regista contratos de 6 ou 12 meses para acompanhar os prazos dos teus alunos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fidelizacoes.map((f) => {
            const client = clientMap.get(f.clientId);
            const now = Date.now();
            const totalMs = Math.max(1, f.endDateMillis - f.startDateMillis);
            const elapsedMs = Math.max(0, Math.min(totalMs, now - f.startDateMillis));
            const pct = Math.round((elapsedMs / totalMs) * 100);
            const daysLeft = Math.floor((f.endDateMillis - now) / 86_400_000);

            return (
              <BrandCard key={f.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base font-bold text-[#F4F4F5]">
                        {client?.name || 'Aluno'}
                      </h3>
                      <StatusPill tone="gold">{f.durationMonths} Meses</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-[#A1A1AA]">
                      {formatShortDate(f.startDateMillis)} → {formatShortDate(f.endDateMillis)}
                    </p>
                  </div>
                  <StatusPill tone={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'amber' : 'green'}>
                    {daysLeft < 0 ? 'Expirada' : `Faltam ${daysLeft} dias`}
                  </StatusPill>
                </div>

                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#242429]">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-[#EAB308]"
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-[#A1A1AA]">
                    <span>Progresso</span>
                    <span>{pct}%</span>
                  </div>
                </div>

                {f.notes && <p className="mt-2 text-xs text-[#F4F4F5]">{f.notes}</p>}

                <div className="mt-3 flex justify-end gap-2 border-t border-[#323238] pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(f);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:bg-[#242429]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.deleteFidelizacao(uid, f.id);
                      onBanner('Fidelização removida.');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#EF4444] hover:bg-[#3B1518]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </button>
                </div>
              </BrandCard>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <FidelizacaoModal
          clients={activeClients}
          existing={editing}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={async (clientId, duration, startMillis, endMillis, notes, payment) => {
            await repo.saveFidelizacao(
              uid,
              clientId,
              duration,
              startMillis,
              notes,
              editing?.id,
              isSuperAdmin ? endMillis : undefined
            );
            if (!editing && isSuperAdmin && payment && payment.totalAmountEur > 0) {
              const startDate = new Date(startMillis);
              const startMonthYear = `${startDate.getFullYear()}-${String(
                startDate.getMonth() + 1
              ).padStart(2, '0')}`;
              const startMonthLabel = `${MONTHS_PT[startDate.getMonth()]} ${startDate.getFullYear()}`;
              await repo.recordPayment(
                uid,
                clientId,
                startMonthYear,
                startMonthLabel,
                payment.totalAmountEur,
                payment.method,
                duration,
                { skipAutoFidelizacao: true }
              );
              setModalOpen(false);
              setEditing(null);
              onBanner(
                `Fidelização guardada e pagamento dividido por ${duration} meses (€${(
                  payment.totalAmountEur / duration
                ).toFixed(2)}/mês)!`
              );
              return;
            }
            setModalOpen(false);
            setEditing(null);
            onBanner('Fidelização guardada!');
          }}
        />
      )}
    </div>
  );
};

function toIsoDateLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function addMonthsToIsoDate(isoDate: string, months: number): string {
  const parsed = isoDate ? new Date(`${isoDate}T09:00:00`) : new Date();
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  base.setMonth(base.getMonth() + months);
  return toIsoDateLocal(base.getTime());
}

export const FidelizacaoModal: React.FC<{
  clients: ClientRecord[];
  existing: FidelizacaoRecord | null;
  isSuperAdmin?: boolean;
  onClose: () => void;
  onSave: (
    clientId: string,
    duration: 6 | 12,
    startMillis: number,
    endMillis: number,
    notes: string,
    payment?: { totalAmountEur: number; method: PaymentMethod }
  ) => Promise<void>;
}> = ({ clients, existing, isSuperAdmin = false, onClose, onSave }) => {
  const [clientId, setClientId] = useState(existing?.clientId || clients[0]?.id || '');
  const [duration, setDuration] = useState<6 | 12>(existing?.durationMonths || 6);
  const initialStartStr = toIsoDateLocal(existing?.startDateMillis || Date.now());
  const [startDateStr, setStartDateStr] = useState(initialStartStr);
  const [endDateStr, setEndDateStr] = useState(
    existing?.endDateMillis
      ? toIsoDateLocal(existing.endDateMillis)
      : addMonthsToIsoDate(initialStartStr, existing?.durationMonths || 6)
  );
  const [endDateCustomized, setEndDateCustomized] = useState(() => {
    if (!existing?.endDateMillis) return false;
    const autoEnd = addMonthsToIsoDate(initialStartStr, existing.durationMonths);
    return toIsoDateLocal(existing.endDateMillis) !== autoEnd;
  });
  const [notes, setNotes] = useState(existing?.notes || '');
  const [recordPaymentNow, setRecordPaymentNow] = useState(false);
  const selectedClient = clients.find((c) => c.id === clientId);
  const baseMonthly = selectedClient && selectedClient.monthlyFeeEur > 0 ? selectedClient.monthlyFeeEur : 100;
  const [totalPaidStr, setTotalPaidStr] = useState(String(baseMonthly * (existing?.durationMonths || 6)));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('MbWay');

  const numericTotalPaid = Math.max(0, Number(totalPaidStr) || 0);
  const previewPerMonth = numericTotalPaid / duration;
  const startMonthKey = startDateStr ? startDateStr.slice(0, 7) : toIsoDateLocal(Date.now()).slice(0, 7);
  const previewMonths = useMemo(
    () => buildConsecutiveMonths(startMonthKey, duration),
    [startMonthKey, duration]
  );

  const startMillisPreview = startDateStr ? new Date(`${startDateStr}T09:00:00`).getTime() : Date.now();
  const endMillisPreview = endDateStr
    ? new Date(`${endDateStr}T09:00:00`).getTime()
    : new Date(`${addMonthsToIsoDate(startDateStr, duration)}T09:00:00`).getTime();
  const invalidRange =
    !Number.isNaN(startMillisPreview) &&
    !Number.isNaN(endMillisPreview) &&
    endMillisPreview <= startMillisPreview;

  const handleClientChange = (nextId: string) => {
    setClientId(nextId);
    const nextClient = clients.find((c) => c.id === nextId);
    const nextBase = nextClient && nextClient.monthlyFeeEur > 0 ? nextClient.monthlyFeeEur : 100;
    setTotalPaidStr(String(nextBase * duration));
  };

  const handleDurationChange = (nextDuration: 6 | 12) => {
    const prevAuto = baseMonthly * duration;
    if (Math.abs(numericTotalPaid - prevAuto) < 0.01) {
      setTotalPaidStr(String(baseMonthly * nextDuration));
    }
    setDuration(nextDuration);
    setEndDateStr(addMonthsToIsoDate(startDateStr, nextDuration));
    setEndDateCustomized(false);
  };

  const handleStartDateChange = (nextStart: string) => {
    setStartDateStr(nextStart);
    if (nextStart) {
      setEndDateStr(addMonthsToIsoDate(nextStart, duration));
      setEndDateCustomized(false);
    }
  };

  return (
    <Modal
      open
      title={existing ? 'Editar Fidelização' : 'Nova Fidelização'}
      onClose={onClose}
    >
      <div className="space-y-3">
        {!existing && (
          <div>
            <FieldLabel>Aluno</FieldLabel>
            <select
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <FieldLabel>Duração</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {([6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleDurationChange(m)}
                className={`rounded-xl border py-2 text-xs font-bold ${
                  duration === m
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {m} Meses
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Data de início</FieldLabel>
            <Input
              type="date"
              value={startDateStr}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-1">
              <FieldLabel>Data de fim</FieldLabel>
              {isSuperAdmin && endDateCustomized && (
                <button
                  type="button"
                  onClick={() => {
                    setEndDateStr(addMonthsToIsoDate(startDateStr, duration));
                    setEndDateCustomized(false);
                  }}
                  className="mb-1 text-[11px] font-bold text-[#FACC15] hover:underline"
                >
                  Auto (+{duration}m)
                </button>
              )}
            </div>
            <Input
              type="date"
              value={endDateStr}
              disabled={!isSuperAdmin}
              onChange={(e) => {
                setEndDateStr(e.target.value);
                setEndDateCustomized(true);
              }}
              className="disabled:opacity-60"
            />
          </div>
        </div>
        <p className="text-[11px] text-[#A1A1AA]">
          {isSuperAdmin
            ? 'A data de fim é calculada automaticamente (+6/+12 meses), mas o administrador pode adaptar a data de início e fim.'
            : 'Data de fim calculada automaticamente a partir da data de início.'}
        </p>
        {invalidRange && (
          <p className="text-xs font-semibold text-[#EF4444]">
            A data de fim deve ser posterior à data de início.
          </p>
        )}

        <div>
          <FieldLabel>Notas (opcional)</FieldLabel>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {!existing && isSuperAdmin && (
          <div className="space-y-2.5 rounded-xl border border-[#323238] bg-[#242429]/80 p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                checked={recordPaymentNow}
                onChange={(e) => setRecordPaymentNow(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#EAB308]"
              />
              <span className="text-[#F4F4F5]">
                <strong>Registar pagamento da fidelização</strong> (dividido pelos {duration} meses)
              </span>
            </label>

            {recordPaymentNow && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <FieldLabel>Valor total pago pelos {duration} meses (€)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={totalPaidStr}
                    onChange={(e) => setTotalPaidStr(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Método de pagamento</FieldLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`rounded-lg border py-1.5 text-xs font-bold ${
                          payMethod === m
                            ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                            : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-[#EAB308]/40 bg-[#3D3314]/60 p-2 text-xs text-[#FACC15]">
                  <p className="font-bold">
                    €{numericTotalPaid.toFixed(2)} ÷ {duration} meses = €
                    {previewPerMonth.toFixed(2)}/mês
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#F4F4F5]/85">
                    Conta apenas 1 mensalidade/mês ({previewMonths[0]?.monthLabel} →{' '}
                    {previewMonths[previewMonths.length - 1]?.monthLabel}).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!clientId || invalidRange}
            onClick={() => {
              const safeStart = Number.isNaN(startMillisPreview) ? Date.now() : startMillisPreview;
              const fallbackEnd = new Date(safeStart);
              fallbackEnd.setMonth(fallbackEnd.getMonth() + duration);
              const safeEnd =
                isSuperAdmin && !Number.isNaN(endMillisPreview) && endMillisPreview > safeStart
                  ? endMillisPreview
                  : fallbackEnd.getTime();
              return onSave(
                clientId,
                duration,
                safeStart,
                safeEnd,
                notes,
                !existing && isSuperAdmin && recordPaymentNow && numericTotalPaid > 0
                  ? { totalAmountEur: numericTotalPaid, method: payMethod }
                  : undefined
              );
            }}
          >
            Guardar Fidelização
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const MessageReceiptIcon: React.FC<{
  message: ChatMessageRecord;
  onGoldBubble?: boolean;
}> = ({ message, onGoldBubble = true }) => {
  const isRead = Boolean(message.readAtMillis && message.readAtMillis > 0);
  const isDelivered = Boolean(message.deliveredAtMillis && message.deliveredAtMillis > 0);

  if (isRead) {
    return (
      <span
        title="Lida"
        aria-label="Mensagem lida"
        className={`inline-flex items-center ${
          onGoldBubble ? 'text-[#1E40AF]' : 'text-[#38BDF8]'
        }`}
      >
        <CheckCheck className="h-3.5 w-3.5 stroke-[2.5]" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span
        title="Entregue"
        aria-label="Mensagem entregue"
        className={`inline-flex items-center ${
          onGoldBubble ? 'text-[#121214]/75' : 'text-[#A1A1AA]'
        }`}
      >
        <CheckCheck className="h-3.5 w-3.5 stroke-[2.2]" />
      </span>
    );
  }
  return (
    <span
      title="Enviada"
      aria-label="Mensagem enviada"
      className={`inline-flex items-center ${
        onGoldBubble ? 'text-[#121214]/60' : 'text-[#71717A]'
      }`}
    >
      <Check className="h-3.5 w-3.5 stroke-[2.2]" />
    </span>
  );
};

const PtChatSubTab: React.FC<{
  uid: string;
  clients: ClientRecord[];
  chatMessages: ChatMessageRecord[];
  ptNotifications?: PtNotificationRecord[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
}> = ({
  uid,
  clients,
  chatMessages,
  ptNotifications = [],
  selectedClientId,
  onSelectClient,
}) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const sortedThreads = useMemo(() => {
    const msgsByClient = new Map<string, ChatMessageRecord[]>();
    chatMessages.forEach((m) => {
      const list = msgsByClient.get(m.clientId) || [];
      list.push(m);
      msgsByClient.set(m.clientId, list);
    });

    return activeClients
      .map((client) => {
        const msgs = msgsByClient.get(client.id) || [];
        const unreadMsgs = msgs.filter((m) => m.senderRole === 'STUDENT' && !m.readAtMillis);
        const lastMsg = msgs[msgs.length - 1] || null;
        const latestUnreadTs = unreadMsgs.length > 0 ? unreadMsgs[unreadMsgs.length - 1].timestampMillis : 0;
        return {
          client,
          msgs,
          unreadCount: unreadMsgs.length,
          lastMsg,
          latestUnreadTs,
          latestMsgTs: lastMsg ? lastMsg.timestampMillis : 0,
        };
      })
      .sort((a, b) => {
        // 1) Unread conversations ALWAYS at the top (most recent unread first)
        const aUnread = a.unreadCount > 0 ? 1 : 0;
        const bUnread = b.unreadCount > 0 ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        if (a.latestUnreadTs !== b.latestUnreadTs) return b.latestUnreadTs - a.latestUnreadTs;
        // 2) Conversations with messages (most recent first)
        if (a.latestMsgTs !== b.latestMsgTs) return b.latestMsgTs - a.latestMsgTs;
        // 3) Alphabetical
        return a.client.name.localeCompare(b.client.name, 'pt');
      });
  }, [activeClients, chatMessages]);

  if (selectedClient) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectClient('')}
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-[#F4F4F5]">{selectedClient.name}</h3>
            <p className="text-xs text-[#A1A1AA]">
              Chat privado · {selectedClient.phone ? formatPhoneDisplay(selectedClient.phone) : 'Sem telemóvel'}
            </p>
          </div>
        </div>

        <PrivateChatPanel
          uid={uid}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          viewerRole="PT"
          messages={chatMessages.filter((m) => m.clientId === selectedClient.id)}
          ptNotifications={ptNotifications}
        />
      </div>
    );
  }

  const totalUnread = sortedThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Chat Privado com Alunos</h2>
          <p className="text-xs text-[#A1A1AA]">
            Mensagens por ler aparecem automaticamente no topo
          </p>
        </div>
        {totalUnread > 0 && (
          <StatusPill tone="red">
            {totalUnread} {totalUnread === 1 ? 'mensagem por ler' : 'mensagens por ler'}
          </StatusPill>
        )}
      </div>

      {sortedThreads.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Sem alunos ativos"
          subtitle="Adiciona alunos no separador Alunos para iniciar conversas."
        />
      ) : (
        <div className="space-y-2">
          {sortedThreads.map(({ client: c, unreadCount, lastMsg }) => {
            const hasUnread = unreadCount > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClient(c.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                  hasUnread
                    ? 'border-[#EAB308]/80 bg-[#3D3314]/30 hover:border-[#FACC15]'
                    : 'border-[#323238] bg-[#1B1B1E] hover:border-[#EAB308]/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                    {hasUnread && (
                      <span className="h-2 w-2 rounded-full bg-[#EF4444]" aria-hidden="true" />
                    )}
                  </div>
                  <p
                    className={`mt-0.5 flex items-center gap-1 truncate text-xs ${
                      hasUnread ? 'font-semibold text-[#F4F4F5]' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {lastMsg && lastMsg.senderRole === 'PT' && (
                      <MessageReceiptIcon message={lastMsg} onGoldBubble={false} />
                    )}
                    <span className="truncate">
                      {lastMsg
                        ? `${lastMsg.senderRole === 'PT' ? 'Tu: ' : ''}${lastMsg.text}`
                        : 'Nenhuma mensagem ainda — toca para conversar'}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {lastMsg && (
                    <span
                      className={`text-[11px] ${
                        hasUnread ? 'font-bold text-[#FACC15]' : 'text-[#A1A1AA]'
                      }`}
                    >
                      {formatTimeAgo(lastMsg.timestampMillis)}
                    </span>
                  )}
                  {hasUnread && (
                    <span className="rounded-full bg-[#EF4444] px-2 py-0.5 text-[11px] font-extrabold text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PrivateChatPanel: React.FC<{
  uid: string;
  clientId: string;
  clientName: string;
  viewerRole: 'PT' | 'STUDENT';
  messages: ChatMessageRecord[];
  senderClientName?: string;
  ptNotifications?: PtNotificationRecord[];
}> = ({
  uid,
  clientId,
  clientName,
  viewerRole,
  messages,
  senderClientName,
  ptNotifications = [],
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const markedReadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Automatically mark incoming messages as READ when the conversation is open
  useEffect(() => {
    const incomingUnread = messages.filter(
      (m) => m.senderRole !== viewerRole && !m.readAtMillis && !markedReadIdsRef.current.has(m.id)
    );
    if (incomingUnread.length > 0) {
      incomingUnread.forEach((m) => markedReadIdsRef.current.add(m.id));
      void repo.markChatMessagesRead(uid, incomingUnread).catch(() => {
        incomingUnread.forEach((m) => markedReadIdsRef.current.delete(m.id));
      });
    }
  }, [uid, viewerRole, messages]);

  // When PT opens a student's chat, also mark matching CHAT notifications in bell as read
  useEffect(() => {
    if (viewerRole !== 'PT' || ptNotifications.length === 0) return;
    const hasUnreadChatNotif = ptNotifications.some(
      (n) => !n.read && n.type === 'CHAT' && n.clientId === clientId
    );
    if (hasUnreadChatNotif) {
      void repo.markClientChatNotificationsRead(uid, ptNotifications, clientId).catch(() => {});
    }
  }, [uid, viewerRole, clientId, ptNotifications]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await repo.sendChatMessage(
        uid,
        clientId,
        viewerRole,
        draft,
        viewerRole === 'STUDENT' ? senderClientName || clientName : undefined
      );
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <BrandCard className="flex flex-col">
      {/* Compact receipt legend */}
      <div className="mb-2.5 flex flex-wrap items-center justify-end gap-3 border-b border-[#323238] pb-2 text-[10px] text-[#A1A1AA]">
        <span className="inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-[#71717A]" /> Enviada
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCheck className="h-3 w-3 text-[#A1A1AA]" /> Entregue
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCheck className="h-3 w-3 text-[#38BDF8]" /> Lida
        </span>
      </div>

      <div className="max-h-[420px] min-h-[260px] flex-1 space-y-2.5 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center text-center text-xs text-[#A1A1AA]">
            <MessageCircle className="mb-2 h-6 w-6 text-[#EAB308]" />
            <p className="font-semibold text-[#F4F4F5]">Sem mensagens com {clientName}</p>
            <p className="mt-0.5">Envia a primeira mensagem abaixo.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === viewerRole;
            const statusText = m.readAtMillis
              ? 'Lida'
              : m.deliveredAtMillis
              ? 'Entregue'
              : 'Enviada';
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    mine
                      ? 'bg-[#EAB308] text-[#121214]'
                      : 'border border-[#323238] bg-[#242429] text-[#F4F4F5]'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                      mine ? 'text-[#121214]/75 font-semibold' : 'text-[#A1A1AA]'
                    }`}
                  >
                    <span>
                      {m.senderRole === 'PT' ? 'PT' : 'Aluno'} ·{' '}
                      {formatTimeAgo(m.timestampMillis)}
                    </span>
                    {mine && (
                      <span className="inline-flex items-center gap-0.5" title={statusText}>
                        <MessageReceiptIcon message={m} onGoldBubble />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="mt-3 flex items-center gap-2 border-t border-[#323238] pt-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escrever mensagem..."
          className="flex-1"
        />
        <GoldButton type="submit" disabled={!draft.trim() || sending}>
          <Send className="h-4 w-4" />
          Enviar
        </GoldButton>
      </form>
    </BrandCard>
  );
};
