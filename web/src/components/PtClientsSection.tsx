import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Dumbbell,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  Utensils,
} from 'lucide-react';
import { ClientRecord, FidelizacaoRecord, PaymentRecord } from '../types/studio';
import {
  buildRecentMonthOptions,
  formatPhoneDisplay,
  formatShortDate,
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

interface PtClientsSectionProps {
  uid: string;
  clients: ClientRecord[];
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  onJumpToWorkout: (clientId: string) => void;
  onJumpToNutrition: (clientId: string) => void;
  onJumpToChat: (clientId: string) => void;
  onBanner: (msg: string) => void;
}

export const PtClientsSection: React.FC<PtClientsSectionProps> = ({
  uid,
  clients,
  payments,
  fidelizacoes,
  onJumpToWorkout,
  onJumpToNutrition,
  onJumpToChat,
  onBanner,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [payTarget, setPayTarget] = useState<ClientRecord | null>(null);

  const recentMonths = useMemo(() => buildRecentMonthOptions(), []);
  const currentMonthYear = recentMonths[0].monthYear;
  const currentMonthLabel = recentMonths[0].monthLabel;

  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null;

  if (selectedClient) {
    return (
      <ClientProfileView
        uid={uid}
        client={selectedClient}
        payments={payments.filter((p) => p.clientId === selectedClient.id)}
        fidelizacoes={fidelizacoes.filter((f) => f.clientId === selectedClient.id)}
        currentMonthYear={currentMonthYear}
        currentMonthLabel={currentMonthLabel}
        onBack={() => setSelectedClientId(null)}
        onJumpToWorkout={() => onJumpToWorkout(selectedClient.id)}
        onJumpToNutrition={() => onJumpToNutrition(selectedClient.id)}
        onJumpToChat={() => onJumpToChat(selectedClient.id)}
        onBanner={onBanner}
      />
    );
  }

  const filtered = clients.filter((c) => {
    if (!showInactive && !c.active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Alunos</h2>
          <p className="text-xs text-[#A1A1AA]">
            {clients.filter((c) => c.active).length} ativos · {clients.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4" />
            Importar CSV
          </SecondaryButton>
          <GoldButton onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </GoldButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome ou telemóvel..."
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#A1A1AA]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 accent-[#EAB308]"
          />
          Mostrar inativos
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum aluno encontrado"
          subtitle="Adiciona um novo cliente ou importa uma lista CSV."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const monthPay = payments.find(
              (p) => p.clientId === c.id && p.monthYear === currentMonthYear && p.paid
            );
            return (
              <div
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className="cursor-pointer rounded-2xl border border-[#323238] bg-[#1B1B1E] p-4 transition hover:border-[#EAB308]/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base font-bold text-[#F4F4F5]">{c.name}</h3>
                      {c.newClient && <StatusPill tone="blue">Novo</StatusPill>}
                      {!c.active && <StatusPill>Inativo</StatusPill>}
                    </div>
                    <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(c.phone)}</p>
                    {(c.monthlyFeeEur > 0 || c.fidelizacaoMonths > 0) && (
                      <p className="mt-1 text-xs font-semibold text-[#EAB308]">
                        {[
                          c.monthlyFeeEur > 0 ? `€${c.monthlyFeeEur.toFixed(0)}/mês` : '',
                          c.fidelizacaoMonths > 0 ? `Fidelização ${c.fidelizacaoMonths}m` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <StatusPill tone={monthPay ? 'green' : 'amber'}>
                    {monthPay ? `Pago €${monthPay.amountEur.toFixed(0)}` : 'Por pagar'}
                  </StatusPill>
                </div>

                <div
                  className="mt-3 flex items-center justify-between border-t border-[#323238] pt-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setPayTarget(c)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EAB308] hover:underline"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {monthPay ? 'Registar outro pagamento' : 'Apontar pagamento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    className="text-xs font-semibold text-[#A1A1AA] hover:text-white"
                  >
                    Ver perfil →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewClientModal
          onClose={() => setShowNewModal(false)}
          onSave={async (name, phone, notes) => {
            await repo.addClient(uid, { name, phone, notes });
            setShowNewModal(false);
            onBanner('Aluno adicionado!');
          }}
        />
      )}

      {showImportModal && (
        <ImportClientsModal
          onClose={() => setShowImportModal(false)}
          onImport={(raw) => repo.importClientsCsv(uid, raw, clients)}
        />
      )}

      {payTarget && (
        <RegisterPaymentModal
          clientName={payTarget.name}
          defaultAmount={payTarget.monthlyFeeEur > 0 ? payTarget.monthlyFeeEur : 120}
          onClose={() => setPayTarget(null)}
          onConfirm={async (my, ml, amount, note) => {
            await repo.recordPayment(uid, payTarget.id, my, ml, amount, note);
            setPayTarget(null);
            onBanner('Mensalidade registada!');
          }}
        />
      )}
    </div>
  );
};

const ClientProfileView: React.FC<{
  uid: string;
  client: ClientRecord;
  payments: PaymentRecord[];
  fidelizacoes: FidelizacaoRecord[];
  currentMonthYear: string;
  currentMonthLabel: string;
  onBack: () => void;
  onJumpToWorkout: () => void;
  onJumpToNutrition: () => void;
  onJumpToChat: () => void;
  onBanner: (msg: string) => void;
}> = ({
  uid,
  client,
  payments,
  fidelizacoes,
  currentMonthYear,
  currentMonthLabel,
  onBack,
  onJumpToWorkout,
  onJumpToNutrition,
  onJumpToChat,
  onBanner,
}) => {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [notes, setNotes] = useState(client.notes);
  const [monthlyFee, setMonthlyFee] = useState(
    client.monthlyFeeEur > 0 ? String(client.monthlyFeeEur) : ''
  );
  const [fidMonths, setFidMonths] = useState(client.fidelizacaoMonths);
  const [fidStart, setFidStart] = useState(
    client.fidelizacaoStartMillis > 0 ? client.fidelizacaoStartMillis : Date.now()
  );
  const [showPay, setShowPay] = useState(false);

  const monthPayment = payments.find((p) => p.monthYear === currentMonthYear && p.paid);

  const endMillis = useMemo(() => {
    if (!fidMonths) return 0;
    const d = new Date(fidStart);
    d.setMonth(d.getMonth() + fidMonths);
    return d.getTime();
  }, [fidMonths, fidStart]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#F4F4F5]">{client.name}</h2>
            <p className={`text-xs ${client.active ? 'text-[#22C55E]' : 'text-[#A1A1AA]'}`}>
              {client.active ? 'Aluno ativo' : 'Aluno inativo'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await repo.updateClient(uid, { ...client, active: !client.active });
            onBanner(client.active ? 'Aluno desativado.' : 'Aluno reativado.');
          }}
          className={`text-xs font-bold ${
            client.active ? 'text-[#EF4444]' : 'text-[#22C55E]'
          } hover:underline`}
        >
          {client.active ? 'Desativar' : 'Reativar'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SecondaryButton onClick={onJumpToWorkout}>
          <Dumbbell className="h-4 w-4" />
          Treino
        </SecondaryButton>
        <SecondaryButton onClick={onJumpToNutrition}>
          <Utensils className="h-4 w-4" />
          Nutrição
        </SecondaryButton>
        <SecondaryButton onClick={onJumpToChat}>
          <MessageCircle className="h-4 w-4" />
          Chat
        </SecondaryButton>
      </div>

      <BrandCard>
        <h3 className="text-base font-bold text-[#FACC15]">Dados do Perfil & Plano</h3>
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel>Nome completo</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Telemóvel WhatsApp</FieldLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Valor Mensalidade (€)</FieldLabel>
              <Input
                type="number"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Fidelização (se aplicável)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[
                { m: 0, label: 'Sem fidel.' },
                { m: 6, label: '6 Meses' },
                { m: 12, label: '12 Meses' },
              ].map((opt) => (
                <button
                  key={opt.m}
                  type="button"
                  onClick={() => {
                    setFidMonths(opt.m);
                    if (opt.m > 0 && fidStart <= 0) setFidStart(Date.now());
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    fidMonths === opt.m
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fidMonths > 0 && (
              <p className="mt-1.5 text-xs text-[#FACC15]">
                Início: {formatShortDate(fidStart)} → Fim: {formatShortDate(endMillis)}
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Notas / Lesões / Objetivos</FieldLabel>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <GoldButton
            fullWidth
            onClick={async () => {
              await repo.updateClient(uid, {
                ...client,
                name,
                phone,
                notes,
                monthlyFeeEur: Math.max(0, Number(monthlyFee) || 0),
                fidelizacaoMonths: fidMonths,
                fidelizacaoStartMillis: fidMonths > 0 ? fidStart : 0,
              });
              onBanner('Perfil do aluno guardado!');
            }}
          >
            Guardar alterações
          </GoldButton>
        </div>
      </BrandCard>

      <BrandCard highlight={!monthPayment}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#F4F4F5]">
              Mensalidade ({currentMonthLabel})
            </h3>
            <p className={`text-xs ${monthPayment ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
              {monthPayment
                ? `Pago €${monthPayment.amountEur.toFixed(2)} em ${formatShortDate(
                    monthPayment.paidAtMillis
                  )}`
                : 'Sem registo de pagamento este mês'}
            </p>
          </div>
          <StatusPill tone={monthPayment ? 'green' : 'amber'}>
            {monthPayment ? 'Pago ✓' : 'Pendente'}
          </StatusPill>
        </div>

        <div className="mt-3">
          <GoldButton fullWidth onClick={() => setShowPay(true)}>
            <CreditCard className="h-4 w-4" />
            Registar Pagamento de Mensalidade
          </GoldButton>
        </div>

        {payments.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-[#323238] pt-3">
            <FieldLabel>Histórico de pagamentos</FieldLabel>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-[#242429] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-bold text-[#F4F4F5]">
                    {p.monthLabel} · €{p.amountEur.toFixed(2)}
                  </p>
                  <p className="text-[#A1A1AA]">
                    {formatShortDate(p.paidAtMillis)}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => repo.deletePayment(uid, p.id)}
                  className="text-[#EF4444] hover:opacity-80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </BrandCard>

      {fidelizacoes.length > 0 && (
        <BrandCard>
          <h3 className="text-base font-bold text-[#F4F4F5]">Contratos de Fidelização</h3>
          <div className="mt-2 space-y-2">
            {fidelizacoes.map((f) => {
              const daysLeft = Math.floor((f.endDateMillis - Date.now()) / 86_400_000);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl bg-[#242429] p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#FACC15]">{f.durationMonths} Meses</p>
                    <p className="text-[#A1A1AA]">
                      {formatShortDate(f.startDateMillis)} → {formatShortDate(f.endDateMillis)}
                    </p>
                  </div>
                  <StatusPill tone={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'amber' : 'green'}>
                    {daysLeft < 0 ? 'Expirada' : `${daysLeft} dias rest.`}
                  </StatusPill>
                </div>
              );
            })}
          </div>
        </BrandCard>
      )}

      {showPay && (
        <RegisterPaymentModal
          clientName={client.name}
          defaultAmount={client.monthlyFeeEur > 0 ? client.monthlyFeeEur : 120}
          onClose={() => setShowPay(false)}
          onConfirm={async (my, ml, amt, note) => {
            await repo.recordPayment(uid, client.id, my, ml, amt, note);
            setShowPay(false);
            onBanner('Pagamento registado!');
          }}
        />
      )}
    </div>
  );
};

const NewClientModal: React.FC<{
  onClose: () => void;
  onSave: (name: string, phone: string, notes: string) => Promise<void>;
}> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal open title="Novo Cliente" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Nome completo</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marta Dias" />
        </div>
        <div>
          <FieldLabel>Telemóvel (9 dígitos)</FieldLabel>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="914 000 001"
          />
        </div>
        <div>
          <FieldLabel>Notas (opcional)</FieldLabel>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton disabled={!name.trim()} onClick={() => onSave(name, phone, notes)}>
            Adicionar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const ImportClientsModal: React.FC<{
  onClose: () => void;
  onImport: (raw: string) => Promise<{ added: number; ignored: number; errors: string[] }>;
}> = ({ onClose, onImport }) => {
  const [rawText, setRawText] = useState('Marta Dias;914 000 001\nPedro Luz;+351 914 000 002');
  const [result, setResult] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawText(text);
  };

  return (
    <Modal open title="Importar lista ou CSV" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#A1A1AA]">
          Cola uma pessoa por linha com nome e telemóvel separados por ponto e vírgula (
          <code className="text-[#FACC15]">Ana Ribeiro;912 345 678</code>) ou escolhe um ficheiro
          CSV.
        </p>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="block w-full text-xs text-[#A1A1AA] file:mr-3 file:rounded-lg file:border-0 file:bg-[#242429] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#FACC15]"
        />
        <Textarea rows={5} value={rawText} onChange={(e) => setRawText(e.target.value)} />
        {result && <p className="text-xs font-semibold text-[#FACC15]">{result}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
          <GoldButton
            onClick={async () => {
              const res = await onImport(rawText);
              setResult(
                `Adicionados: ${res.added} · Ignorados: ${res.ignored} · Erros: ${res.errors.length}`
              );
            }}
          >
            Importar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

export const RegisterPaymentModal: React.FC<{
  clientName: string;
  defaultAmount: number;
  onClose: () => void;
  onConfirm: (monthYear: string, monthLabel: string, amount: number, note: string) => Promise<void>;
}> = ({ clientName, defaultAmount, onClose, onConfirm }) => {
  const monthOptions = useMemo(() => buildRecentMonthOptions(), []);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [note, setNote] = useState('MB Way');

  return (
    <Modal open title="Registar Mensalidade" subtitle={`Aluno: ${clientName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Mês</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {monthOptions.slice(0, 4).map((m, idx) => (
              <button
                key={m.monthYear}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  selectedIdx === idx
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {m.monthLabel}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Valor (€)</FieldLabel>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Método / Nota</FieldLabel>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="MB Way, Dinheiro..." />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            onClick={() =>
              onConfirm(
                monthOptions[selectedIdx].monthYear,
                monthOptions[selectedIdx].monthLabel,
                Math.max(0, Number(amount) || 0),
                note
              )
            }
          >
            Marcar como Pago
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
