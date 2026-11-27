import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  MakeupCreditRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WeekResponseRecord,
} from '../types/studio';
import { formatPhoneDisplay } from '../data/seedCatalog';
import {
  computeAllClientsMakeupSummaries,
  formatShortDatePt,
  getMakeupClientIdsForWeek,
  makeupReasonLabel,
} from '../services/makeupCalculator';
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
} from './UiPrimitives';

interface PtCompensacoesViewProps {
  uid: string;
  clients: ClientRecord[];
  weeks: TrainingWeekRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  makeupCredits: MakeupCreditRecord[];
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

type CompFilter = 'ELIGIBLE' | 'BOOKED' | 'ABSENT' | 'ALL';

export const ManualMakeupCreditModal: React.FC<{
  open: boolean;
  clientName: string;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}> = ({ open, clientName, onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      title="Atribuir Compensação (30 dias)"
      subtitle={`Aluno: ${clientName} · Válida durante 30 dias a partir de hoje`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Motivo / Nota (opcional)</FieldLabel>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Treino desmarcado por motivos pessoais"
          />
        </div>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancelar
          </SecondaryButton>
          <GoldButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(note.trim() || 'Compensação atribuída pelo PT');
                setNote('');
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus className="h-4 w-4" />
            {busy ? 'A guardar...' : 'Adicionar +1 Compensação'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

export const PtCompensacoesView: React.FC<PtCompensacoesViewProps> = ({
  uid,
  clients,
  weeks,
  sessions,
  bookings,
  weekResponses,
  makeupCredits,
  onOpenWhatsApp,
  onBanner,
}) => {
  const [filter, setFilter] = useState<CompFilter>('ELIGIBLE');
  const [search, setSearch] = useState('');
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(() => new Set());
  const [manualCreditClient, setManualCreditClient] = useState<ClientRecord | null>(null);
  const [busyCreditId, setBusyCreditId] = useState<string | null>(null);

  const activeClients = useMemo(
    () => clients.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const summaryMap = useMemo(
    () =>
      computeAllClientsMakeupSummaries(
        activeClients,
        weeks,
        sessions,
        bookings,
        weekResponses,
        makeupCredits
      ),
    [activeClients, weeks, sessions, bookings, weekResponses, makeupCredits]
  );

  const anyWeekMakeupClientIds = useMemo(
    () => getMakeupClientIdsForWeek(bookings, ''),
    [bookings]
  );

  const kpis = useMemo(() => {
    let eligibleClients = 0;
    let totalAvailable = 0;
    let bookedClients = 0;
    let totalAbsences30d = 0;
    activeClients.forEach((c) => {
      const s = summaryMap.get(c.id);
      if (!s) return;
      if (s.availableCount > 0) {
        eligibleClients += 1;
        totalAvailable += s.availableCount;
      }
      if (anyWeekMakeupClientIds.has(c.id) || s.activeMakeupBookingsCount > 0) {
        bookedClients += 1;
      }
      totalAbsences30d += s.absentCount30d;
    });
    return { eligibleClients, totalAvailable, bookedClients, totalAbsences30d };
  }, [activeClients, summaryMap, anyWeekMakeupClientIds]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeClients
      .map((client) => ({
        client,
        summary: summaryMap.get(client.id)!,
        hasActiveMakeup: anyWeekMakeupClientIds.has(client.id),
      }))
      .filter(({ client, summary, hasActiveMakeup }) => {
        if (!summary) return false;
        if (filter === 'ELIGIBLE' && summary.availableCount <= 0) return false;
        if (filter === 'BOOKED' && !hasActiveMakeup && summary.activeMakeupBookingsCount <= 0) {
          return false;
        }
        if (filter === 'ABSENT' && summary.totalAbsencesAllTime <= 0 && summary.absentCount30d <= 0) {
          return false;
        }
        if (!q) return true;
        return (
          client.name.toLowerCase().includes(q) ||
          (client.phone && client.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
        );
      })
      .sort((a, b) => {
        if (b.summary.availableCount !== a.summary.availableCount) {
          return b.summary.availableCount - a.summary.availableCount;
        }
        if (b.hasActiveMakeup !== a.hasActiveMakeup) return b.hasActiveMakeup ? 1 : -1;
        if (b.summary.absentCount30d !== a.summary.absentCount30d) {
          return b.summary.absentCount30d - a.summary.absentCount30d;
        }
        return a.client.name.localeCompare(b.client.name);
      });
  }, [activeClients, summaryMap, anyWeekMakeupClientIds, filter, search]);

  const toggleExpand = (clientId: string) => {
    setExpandedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <BrandCard className="border-[#A855F7]/60 bg-[#2E1065]/25">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D8B4FE]" />
              <h2 className="text-base font-extrabold text-[#F4F4F5]">
                Compensações de Treinos (Validade 30 dias)
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#D8B4FE]/90">
              Contabilização automática de faltas, treinos removidos e semanas sem marcação. Quando
              um aluno marca compensação, todos os treinos dele nessa semana aparecem a{' '}
              <strong className="text-[#E9D5FF]">roxo</strong>.
            </p>
          </div>
          <StatusPill tone="purple">Validade: 30 dias</StatusPill>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[#A855F7]/45 bg-[#2E1065]/45 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#D8B4FE]">Podem compensar</p>
            <p className="text-lg font-extrabold text-[#E9D5FF]">{kpis.eligibleClients}</p>
          </div>
          <div className="rounded-xl border border-[#A855F7]/45 bg-[#2E1065]/45 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#D8B4FE]">Créditos (30d)</p>
            <p className="text-lg font-extrabold text-[#F4F4F5]">{kpis.totalAvailable}</p>
          </div>
          <div className="rounded-xl border border-[#A855F7]/45 bg-[#1B1B1E] px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#D8B4FE]">A compensar</p>
            <p className="text-lg font-extrabold text-[#D8B4FE]">{kpis.bookedClients}</p>
          </div>
          <div className="rounded-xl border border-[#EF4444]/40 bg-[#3B1518]/35 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#FCA5A5]">Faltas (30d)</p>
            <p className="text-lg font-extrabold text-[#EF4444]">{kpis.totalAbsences30d}</p>
          </div>
        </div>
      </BrandCard>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'ELIGIBLE' as const, label: `Podem compensar (${kpis.eligibleClients})` },
            { id: 'BOOKED' as const, label: `A compensar (${kpis.bookedClients})` },
            {
              id: 'ABSENT' as const,
              label: `Com faltas (${activeClients.filter((c) => (summaryMap.get(c.id)?.totalAbsencesAllTime ?? 0) > 0).length})`,
            },
            { id: 'ALL' as const, label: `Todos (${activeClients.length})` },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              filter === opt.id
                ? 'border-[#A855F7] bg-[#A855F7] text-white'
                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#A855F7]/60 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar aluno por nome ou telemóvel..."
          className="pl-9"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Sem alunos neste filtro"
          subtitle={
            filter === 'ELIGIBLE'
              ? 'Nenhum aluno tem compensações disponíveis nos últimos 30 dias.'
              : 'Ajusta o filtro ou a pesquisa para consultar outros alunos.'
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ client, summary, hasActiveMakeup }) => {
            const isExpanded = expandedClientIds.has(client.id);
            const activeMakeupBookings = bookings
              .filter((b) => b.clientId === client.id && b.makeup && b.status !== 'CANCELLED')
              .map((b) => ({ booking: b, session: sessionMap.get(b.sessionId) }))
              .filter(
                (x): x is { booking: BookingRecord; session: TrainingSessionRecord } =>
                  Boolean(x.session)
              )
              .sort((a, b) => a.session.startMillis - b.session.startMillis);

            const isVioletCard = summary.availableCount > 0 || hasActiveMakeup;

            return (
              <div
                key={client.id}
                className={`rounded-2xl border p-4 space-y-3 transition ${
                  isVioletCard
                    ? 'border-[#A855F7]/70 bg-[#2E1065]/30'
                    : 'border-[#323238] bg-[#1B1B1E]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base font-bold text-[#F4F4F5]">{client.name}</h3>
                      <StatusPill tone={client.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}>
                        {client.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
                      </StatusPill>
                      {summary.availableCount > 0 && (
                        <StatusPill tone="purple">
                          {summary.availableCount} comp. disponível
                          {summary.availableCount > 1 ? 'eis' : ''}
                        </StatusPill>
                      )}
                      {summary.nearestExpiryDays !== null && (
                        <StatusPill tone={summary.nearestExpiryDays <= 7 ? 'amber' : 'purple'}>
                          Expira em {summary.nearestExpiryDays}d
                        </StatusPill>
                      )}
                      {activeMakeupBookings.length > 0 && (
                        <StatusPill tone="purple">
                          A compensar ({activeMakeupBookings.length})
                        </StatusPill>
                      )}
                      {summary.totalAbsencesAllTime > 0 && (
                        <StatusPill tone="red">
                          {summary.totalAbsencesAllTime} falta
                          {summary.totalAbsencesAllTime > 1 ? 's' : ''}
                        </StatusPill>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#A1A1AA]">
                      {client.phone ? formatPhoneDisplay(client.phone) : 'Sem telemóvel'}
                      {(client.weeklySessionLimit ?? 0) > 0
                        ? ` · Pacote ${client.weeklySessionLimit}×/semana`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setManualCreditClient(client)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#A855F7]/70 bg-[#2E1065]/70 px-2.5 py-1.5 text-xs font-bold text-[#E9D5FF] hover:bg-[#A855F7] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      +1 Comp. (30d)
                    </button>
                    {client.phone && summary.availableCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const firstName = client.name.trim().split(/\s+/)[0] || client.name;
                          const expTxt =
                            summary.nearestExpiryDays !== null
                              ? ` (o próximo crédito expira em ${summary.nearestExpiryDays} dia(s))`
                              : '';
                          const msg = `Olá ${firstName}! Tens ${summary.availableCount} treino(s) de compensação disponível(eis) na New Shape${expTxt}. Podes marcar diretamente na tua Agenda do Portal do Aluno 💪`;
                          onOpenWhatsApp(client.phone, msg);
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#22C55E]/50 bg-[#143521]/50 px-2.5 py-1.5 text-xs font-bold text-[#86EFAC] hover:bg-[#22C55E] hover:text-[#121214]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Lembrar
                      </button>
                    )}
                  </div>
                </div>

                {/* 30d breakdown strip */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-lg border border-[#323238] bg-[#242429] px-2 py-1 text-[#D4D4D8]">
                    Faltas (30d): <strong className="text-[#FCA5A5]">{summary.absentCount30d}</strong>
                  </span>
                  <span className="rounded-lg border border-[#323238] bg-[#242429] px-2 py-1 text-[#D4D4D8]">
                    Removidos (30d):{' '}
                    <strong className="text-[#FDE68A]">{summary.removedCount30d}</strong>
                  </span>
                  <span className="rounded-lg border border-[#323238] bg-[#242429] px-2 py-1 text-[#D4D4D8]">
                    Não marcou (30d):{' '}
                    <strong className="text-[#D8B4FE]">{summary.missedWeekCount30d}</strong>
                  </span>
                  {summary.manualCount30d > 0 && (
                    <span className="rounded-lg border border-[#A855F7]/40 bg-[#2E1065]/40 px-2 py-1 text-[#E9D5FF]">
                      Manual PT: <strong>{summary.manualCount30d}</strong>
                    </span>
                  )}
                </div>

                {/* Active makeup bookings */}
                {activeMakeupBookings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#D8B4FE]">
                      Treinos de compensação marcados:
                    </span>
                    {activeMakeupBookings.map(({ booking, session }) => (
                      <span
                        key={booking.id}
                        className="rounded-lg border border-[#A855F7] bg-[#2E1065]/80 px-2 py-0.5 text-[11px] font-bold text-[#E9D5FF]"
                      >
                        {session.dateLabel} · {session.timeLabel.replace(':', 'h')}{' '}
                        {booking.status === 'CONFIRMED' ? '✓' : '(pendente)'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expandable 30d credit list */}
                {summary.credits.length > 0 && (
                  <div className="border-t border-[#323238]/80 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(client.id)}
                      className="flex w-full items-center justify-between text-xs font-bold text-[#D8B4FE] hover:underline"
                    >
                      <span>Detalhe de créditos (30 dias) · {summary.credits.length}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {summary.credits.map((credit) => (
                          <div
                            key={credit.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#18181B] px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-[#F4F4F5]">
                                  {credit.sourceLabel}
                                </span>
                                <StatusPill
                                  tone={
                                    credit.status === 'AVAILABLE'
                                      ? 'purple'
                                      : credit.status === 'USED'
                                      ? 'green'
                                      : 'neutral'
                                  }
                                >
                                  {credit.status === 'AVAILABLE'
                                    ? `Disponível (${credit.daysLeft}d)`
                                    : credit.status === 'USED'
                                    ? 'Usada ✓'
                                    : 'Expirada'}
                                </StatusPill>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                                {makeupReasonLabel(credit.reason)} · Origem:{' '}
                                {formatShortDatePt(credit.occurredAtMillis)} · Válida até:{' '}
                                {formatShortDatePt(credit.expiresAtMillis)}
                              </p>
                            </div>
                            {credit.dismissibleCreditDocId && credit.status === 'AVAILABLE' && (
                              <button
                                type="button"
                                disabled={busyCreditId === credit.dismissibleCreditDocId}
                                onClick={async () => {
                                  const docId = credit.dismissibleCreditDocId!;
                                  setBusyCreditId(docId);
                                  try {
                                    await repo.dismissMakeupCredit(uid, docId, true);
                                    onBanner('Crédito de compensação anulado.');
                                  } finally {
                                    setBusyCreditId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#EF4444]/40 bg-[#3B1518]/50 px-2.5 py-1 text-[11px] font-bold text-[#FCA5A5] hover:bg-[#EF4444] hover:text-white disabled:opacity-40"
                              >
                                <Trash2 className="h-3 w-3" />
                                Anular
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {manualCreditClient && (
        <ManualMakeupCreditModal
          open
          clientName={manualCreditClient.name}
          onClose={() => setManualCreditClient(null)}
          onConfirm={async (note) => {
            await repo.addManualMakeupCredit(uid, manualCreditClient.id, note);
            onBanner(`+1 compensação (30 dias) atribuída a ${manualCreditClient.name} ✓`);
          }}
        />
      )}
    </div>
  );
};
