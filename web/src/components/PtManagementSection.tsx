import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CreditCard,
  Edit3,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import {
  ChatMessageRecord,
  ClientRecord,
  FidelizacaoRecord,
  PaymentRecord,
} from '../types/studio';
import {
  buildRecentMonthOptions,
  formatPhoneDisplay,
  formatShortDate,
  formatTimeAgo,
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
import { RegisterPaymentModal } from './PtClientsSection';

interface PtManagementSectionProps {
  uid: string;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  chatMessages: ChatMessageRecord[];
  initialSubTab?: 'finance' | 'fidelizacao' | 'chat';
  initialChatClientId?: string;
  onBanner: (msg: string) => void;
}

export const PtManagementSection: React.FC<PtManagementSectionProps> = ({
  uid,
  clients,
  payments,
  fidelizacoes,
  chatMessages,
  initialSubTab = 'finance',
  initialChatClientId = '',
  onBanner,
}) => {
  const [subTab, setSubTab] = useState<'finance' | 'fidelizacao' | 'chat'>(initialSubTab);
  const [selectedChatClientId, setSelectedChatClientId] = useState(initialChatClientId);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialChatClientId) setSelectedChatClientId(initialChatClientId);
  }, [initialChatClientId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
        {[
          { id: 'finance' as const, label: 'Finanças' },
          { id: 'fidelizacao' as const, label: 'Fidelizações' },
          { id: 'chat' as const, label: 'Chat' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
              subTab === t.id
                ? 'bg-[#EAB308] text-[#121214]'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'finance' && (
        <FinanceSubTab
          uid={uid}
          clients={clients}
          payments={payments}
          onBanner={onBanner}
        />
      )}

      {subTab === 'fidelizacao' && (
        <FidelizacaoSubTab
          uid={uid}
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
          selectedClientId={selectedChatClientId}
          onSelectClient={setSelectedChatClientId}
        />
      )}
    </div>
  );
};

const FinanceSubTab: React.FC<{
  uid: string;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, clients, payments, onBanner }) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const [pickClientModal, setPickClientModal] = useState(false);
  const [payClient, setPayClient] = useState<ClientRecord | null>(null);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const paidPayments = useMemo(() => payments.filter((p) => p.paid), [payments]);

  const totalRevenue = useMemo(
    () => paidPayments.reduce((s, p) => s + p.amountEur, 0),
    [paidPayments]
  );

  const monthBuckets = useMemo(() => {
    const opts = buildRecentMonthOptions().slice().reverse();
    return opts.map((m) => {
      const sum = paidPayments
        .filter((p) => p.monthYear === m.monthYear)
        .reduce((s, p) => s + p.amountEur, 0);
      return { ...m, total: sum };
    });
  }, [paidPayments]);

  const activeMonthsCount = Math.max(
    1,
    new Set(paidPayments.map((p) => p.monthYear).filter(Boolean)).size
  );
  const monthlyAvg = totalRevenue / activeMonthsCount;
  const maxBucket = Math.max(100, ...monthBuckets.map((b) => b.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Finanças & Faturação</h2>
          <p className="text-xs text-[#A1A1AA]">
            Controlo de mensalidades recebidas e receita mensal
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BrandCard highlight>
          <p className="text-xs text-[#A1A1AA]">Total Faturação</p>
          <p className="mt-1 text-2xl font-extrabold text-[#FACC15]">
            €{totalRevenue.toFixed(0)}
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-xs text-[#A1A1AA]">Mensalidades Pagas</p>
          <p className="mt-1 text-2xl font-extrabold text-[#22C55E]">
            {paidPayments.length}
          </p>
        </BrandCard>
        <BrandCard>
          <p className="text-xs text-[#A1A1AA]">Média Mensal de Faturação</p>
          <p className="mt-1 text-2xl font-extrabold text-[#F4F4F5]">
            €{monthlyAvg.toFixed(0)}
          </p>
        </BrandCard>
      </div>

      <BrandCard>
        <h3 className="text-sm font-bold text-[#F4F4F5]">Receita dos Últimos 6 Meses</h3>
        <div className="mt-4 grid grid-cols-6 items-end gap-2 h-40 pt-4">
          {monthBuckets.map((b) => {
            const pct = Math.max(4, Math.round((b.total / maxBucket) * 100));
            return (
              <div key={b.monthYear} className="flex h-full flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-bold text-[#FACC15]">
                  {b.total > 0 ? `€${b.total.toFixed(0)}` : '—'}
                </span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    style={{ height: `${b.total > 0 ? pct : 4}%` }}
                    className={`w-full max-w-[40px] rounded-t-lg transition-all ${
                      b.total > 0 ? 'bg-[#EAB308]' : 'bg-[#242429]'
                    }`}
                  />
                </div>
                <span className="text-[11px] text-[#A1A1AA] truncate max-w-full">
                  {b.monthLabel.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </BrandCard>

      <div className="space-y-2.5">
        <h3 className="text-base font-bold text-[#F4F4F5]">
          Histórico de Pagamentos ({paidPayments.length})
        </h3>
        {paidPayments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Sem pagamentos registados"
            subtitle="Clica em + Pagamento para registar a primeira mensalidade."
          />
        ) : (
          <div className="space-y-2">
            {paidPayments.map((p) => {
              const client = clientMap.get(p.clientId);
              return (
                <BrandCard key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#F4F4F5]">
                        {client?.name || 'Aluno'} ·{' '}
                        <span className="text-[#FACC15]">€{p.amountEur.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-[#A1A1AA]">
                        {p.monthLabel} · {formatShortDate(p.paidAtMillis)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.deletePayment(uid, p.id);
                        onBanner('Pagamento removido.');
                      }}
                      className="rounded-lg p-2 text-[#EF4444] hover:bg-[#3B1518]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </BrandCard>
              );
            })}
          </div>
        )}
      </div>

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
          onClose={() => setPayClient(null)}
          onConfirm={async (my, ml, amt, note) => {
            await repo.recordPayment(uid, payClient.id, my, ml, amt, note);
            setPayClient(null);
            onBanner('Mensalidade registada!');
          }}
        />
      )}
    </div>
  );
};

const FidelizacaoSubTab: React.FC<{
  uid: string;
  clients: ClientRecord[];
  fidelizacoes: FidelizacaoRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, clients, fidelizacoes, onBanner }) => {
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
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={async (clientId, duration, startMillis, notes) => {
            await repo.saveFidelizacao(
              uid,
              clientId,
              duration,
              startMillis,
              notes,
              editing?.id
            );
            setModalOpen(false);
            setEditing(null);
            onBanner('Fidelização guardada!');
          }}
        />
      )}
    </div>
  );
};

export const FidelizacaoModal: React.FC<{
  clients: ClientRecord[];
  existing: FidelizacaoRecord | null;
  onClose: () => void;
  onSave: (
    clientId: string,
    duration: 6 | 12,
    startMillis: number,
    notes: string
  ) => Promise<void>;
}> = ({ clients, existing, onClose, onSave }) => {
  const [clientId, setClientId] = useState(existing?.clientId || clients[0]?.id || '');
  const [duration, setDuration] = useState<6 | 12>(existing?.durationMonths || 6);
  const toIsoDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };
  const [startDateStr, setStartDateStr] = useState(
    toIsoDate(existing?.startDateMillis || Date.now())
  );
  const [notes, setNotes] = useState(existing?.notes || '');

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
              onChange={(e) => setClientId(e.target.value)}
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
                onClick={() => setDuration(m)}
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

        <div>
          <FieldLabel>Data de início</FieldLabel>
          <Input
            type="date"
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>Notas (opcional)</FieldLabel>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!clientId}
            onClick={() => {
              const parsed = startDateStr ? new Date(`${startDateStr}T09:00:00`).getTime() : Date.now();
              return onSave(clientId, duration, Number.isNaN(parsed) ? Date.now() : parsed, notes);
            }}
          >
            Guardar Fidelização
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const PtChatSubTab: React.FC<{
  uid: string;
  clients: ClientRecord[];
  chatMessages: ChatMessageRecord[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
}> = ({ uid, clients, chatMessages, selectedClientId, onSelectClient }) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

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
              Chat privado · {formatPhoneDisplay(selectedClient.phone)}
            </p>
          </div>
        </div>

        <PrivateChatPanel
          uid={uid}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          viewerRole="PT"
          messages={chatMessages.filter((m) => m.clientId === selectedClient.id)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold text-[#F4F4F5]">Chat Privado com Alunos</h2>
        <p className="text-xs text-[#A1A1AA]">
          Escolhe um aluno para enviar ou responder a mensagens em tempo real
        </p>
      </div>

      {activeClients.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Sem alunos ativos"
          subtitle="Adiciona alunos no separador Alunos para iniciar conversas."
        />
      ) : (
        <div className="space-y-2">
          {activeClients.map((c) => {
            const msgs = chatMessages.filter((m) => m.clientId === c.id);
            const last = msgs[msgs.length - 1];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClient(c.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-4 text-left transition hover:border-[#EAB308]/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#A1A1AA]">
                    {last
                      ? `${last.senderRole === 'PT' ? 'Tu: ' : ''}${last.text}`
                      : 'Nenhuma mensagem ainda — toca para conversar'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {last && (
                    <span className="text-[11px] text-[#A1A1AA]">
                      {formatTimeAgo(last.timestampMillis)}
                    </span>
                  )}
                  {msgs.length > 0 && <StatusPill tone="gold">{msgs.length}</StatusPill>}
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
}> = ({ uid, clientId, clientName, viewerRole, messages }) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await repo.sendChatMessage(uid, clientId, viewerRole, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <BrandCard className="flex flex-col">
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
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? 'text-[#121214]/75 font-semibold' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {m.senderRole === 'PT' ? 'PT' : 'Aluno'} ·{' '}
                    {formatTimeAgo(m.timestampMillis)}
                  </p>
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
