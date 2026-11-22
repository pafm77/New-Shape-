import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trash2,
  Calendar,
  CheckCheck,
  Clock,
  Link2,
  X,
} from 'lucide-react';
import {
  AttendanceStatus,
  BookingRecord,
  BookingWithSession,
  ClientRecord,
  MessageTemplateRecord,
  PendingConfirmationCard,
  PtNotificationRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WaitlistEntryRecord,
  WeekResponseRecord,
} from '../types/studio';
import {
  buildMessageFromTemplate,
  buildPtPortalLink,
  buildStudentPortalLink,
  buildWhatsAppUrl,
  DEFAULT_WEB_BASE_URL,
  formatCutoffLabel,
  formatPhoneDisplay,
  formatTimeAgo,
  getEffectiveCutoffMinutes,
  getEffectiveReminderLeadMinutes,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  dispatchLocalPushNotification,
  formatLeadMinutesLabel,
  getNotificationPermission,
  getPtAlertsPreference,
  requestNotificationPermission,
  savePtAlertsPreference,
} from '../services/notificationService';
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
import { PtMarcacoesView } from './PtMarcacoesView';

interface PtHomeSectionProps {
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  weeks: TrainingWeekRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntryRecord[];
  weekResponses: WeekResponseRecord[];
  ptNotifications: PtNotificationRecord[];
  pendingPtCount: number;
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  pendingQueue: PendingConfirmationCard[];
  lockedByWhatsApp: boolean;
  onShiftWeek: (delta: number) => void;
  onWhatsAppOpened: () => void;
  onConfirmCard: (card: PendingConfirmationCard) => Promise<void>;
  onJumpToTeamApprovals: () => void;
  onBanner: (msg: string) => void;
}

export const PtHomeSection: React.FC<PtHomeSectionProps> = ({
  uid,
  isSuperAdmin,
  clients,
  activeWeek,
  sessions,
  bookings,
  waitlistEntries,
  weekResponses,
  ptNotifications,
  pendingPtCount,
  templates,
  settings,
  pendingQueue,
  lockedByWhatsApp,
  onShiftWeek,
  onWhatsAppOpened,
  onConfirmCard,
  onJumpToTeamApprovals,
  onBanner,
}) => {
  const [subTab, setSubTab] = useState<'confirm' | 'marcacoes' | 'weeks' | 'responses' | 'messages'>('confirm');

  const openWa = (phone: string | null, message: string, lock: boolean) => {
    const url = buildWhatsAppUrl(phone, message, settings.whatsappWebMode);
    if (lock) onWhatsAppOpened();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation: Por confirmar / Marcações / Semanas / Respostas / Mensagens */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
        {[
          {
            id: 'confirm' as const,
            label: pendingQueue.length > 0 ? `Por confirmar (${pendingQueue.length})` : 'Por confirmar',
          },
          { id: 'marcacoes' as const, label: 'Marcações' },
          { id: 'weeks' as const, label: 'Semanas' },
          { id: 'responses' as const, label: 'Respostas' },
          { id: 'messages' as const, label: 'Mensagens' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`min-h-[40px] flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
              subTab === tab.id
                ? 'bg-[#EAB308] text-[#121214]'
                : 'text-[#A1A1AA] hover:bg-[#242429] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'confirm' && (
        <PorConfirmarView
          uid={uid}
          isSuperAdmin={isSuperAdmin}
          clients={clients}
          activeWeek={activeWeek}
          sessions={sessions}
          bookings={bookings}
          weekResponses={weekResponses}
          ptNotifications={ptNotifications}
          pendingPtCount={pendingPtCount}
          templates={templates}
          settings={settings}
          pendingQueue={pendingQueue}
          lockedByWhatsApp={lockedByWhatsApp}
          onJumpToResponses={() => setSubTab('responses')}
          onJumpToTeamApprovals={onJumpToTeamApprovals}
          onConfirmCard={onConfirmCard}
          onOpenWhatsApp={(phone, msg) => openWa(phone, msg, true)}
          onBanner={onBanner}
        />
      )}

      {subTab === 'marcacoes' && (
        <PtMarcacoesView
          uid={uid}
          clients={clients}
          activeWeek={activeWeek}
          sessions={sessions}
          bookings={bookings}
          waitlistEntries={waitlistEntries}
          templates={templates}
          settings={settings}
          onShiftWeek={onShiftWeek}
          onOpenWhatsApp={(phone, msg) => openWa(phone, msg, false)}
          onBanner={onBanner}
        />
      )}

      {subTab === 'weeks' && (
        <SemanasView
          uid={uid}
          clients={clients}
          activeWeek={activeWeek}
          sessions={sessions}
          bookings={bookings}
          waitlistEntries={waitlistEntries}
          templates={templates}
          settings={settings}
          onShiftWeek={onShiftWeek}
          onOpenWhatsApp={(phone, msg) => openWa(phone, msg, false)}
          onBanner={onBanner}
        />
      )}

      {subTab === 'responses' && (
        <RespostasView
          uid={uid}
          clients={clients}
          activeWeek={activeWeek}
          bookings={bookings}
          weekResponses={weekResponses}
          templates={templates}
          settings={settings}
          onShiftWeek={onShiftWeek}
          onOpenWhatsApp={(phone, msg) => openWa(phone, msg, true)}
        />
      )}

      {subTab === 'messages' && (
        <MensagensSettingsView
          uid={uid}
          activeWeek={activeWeek}
          templates={templates}
          settings={settings}
          onBanner={onBanner}
        />
      )}
    </div>
  );
};

// ---------------- Por Confirmar ----------------
const PorConfirmarView: React.FC<{
  uid: string;
  isSuperAdmin: boolean;
  clients: ClientRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  ptNotifications: PtNotificationRecord[];
  pendingPtCount: number;
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  pendingQueue: PendingConfirmationCard[];
  lockedByWhatsApp: boolean;
  onJumpToResponses: () => void;
  onJumpToTeamApprovals: () => void;
  onConfirmCard: (card: PendingConfirmationCard) => Promise<void>;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}> = ({
  uid,
  isSuperAdmin,
  clients,
  activeWeek,
  sessions,
  bookings,
  weekResponses,
  ptNotifications,
  pendingPtCount,
  templates,
  settings,
  pendingQueue,
  lockedByWhatsApp,
  onJumpToResponses,
  onJumpToTeamApprovals,
  onConfirmCard,
  onOpenWhatsApp,
  onBanner,
}) => {
  const activeClients = clients.filter((c) => c.active);
  const unreadNotifs = useMemo(
    () => ptNotifications.filter((n) => !n.read),
    [ptNotifications]
  );
  const weekBookedIds = useMemo(() => {
    if (!activeWeek) return new Set<string>();
    return new Set(
      bookings
        .filter((b) => b.weekKey === activeWeek.weekKey && b.status !== 'CANCELLED')
        .map((b) => b.clientId)
    );
  }, [bookings, activeWeek]);

  const unavailableIds = useMemo(() => {
    if (!activeWeek) return new Set<string>();
    return new Set(
      weekResponses
        .filter((r) => r.weekKey === activeWeek.weekKey && r.status === 'UNAVAILABLE')
        .map((r) => r.clientId)
    );
  }, [weekResponses, activeWeek]);

  const notRespondedCount = activeClients.filter(
    (c) => !weekBookedIds.has(c.id) && !unavailableIds.has(c.id)
  ).length;

  return (
    <div className="space-y-4">
      {isSuperAdmin && pendingPtCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAB308] bg-[#3D3314] p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[#FACC15] mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#FACC15]">
                {pendingPtCount} Personal Trainer(s) a aguardar confirmação
              </p>
              <p className="text-xs text-[#F4F4F5]">
                Confirma ou recusa o registo em Gestão → Equipa PT.
              </p>
            </div>
          </div>
          <GoldButton onClick={onJumpToTeamApprovals}>Ver pedidos PT</GoldButton>
        </div>
      )}

      {unreadNotifs.length > 0 && (
        <BrandCard highlight>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#FACC15]" />
              <h3 className="text-sm font-bold text-[#FACC15]">
                Notificações Recentes ({unreadNotifs.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={async () => {
                await repo.markAllPtNotificationsRead(uid, ptNotifications);
                onBanner('Alertas marcados como lidos.');
              }}
              className="text-xs font-bold text-[#FACC15] hover:underline"
            >
              Marcar todos lidos
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {unreadNotifs.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#242429] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-[#F4F4F5]">{n.clientName}</span>
                    <StatusPill
                      tone={
                        n.type === 'CANCELLED'
                          ? 'red'
                          : n.type === 'UNAVAILABLE'
                          ? 'amber'
                          : n.type === 'ASSESSMENT'
                          ? 'green'
                          : 'gold'
                      }
                    >
                      {n.type === 'CANCELLED'
                        ? 'Cancelou treino'
                        : n.type === 'UNAVAILABLE'
                        ? 'Indisponível'
                        : n.type === 'ASSESSMENT'
                        ? 'Nova avaliação física'
                        : 'Alterou horário'}
                    </StatusPill>
                    <span className="text-[11px] text-[#A1A1AA]">
                      {formatTimeAgo(n.timestampMillis)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#D4D4D8]">{n.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => repo.markPtNotificationRead(uid, n.id)}
                  className="rounded-lg border border-[#323238] bg-[#1B1B1E] px-2.5 py-1 text-[11px] font-bold text-[#FACC15] hover:border-[#EAB308]"
                >
                  OK
                </button>
              </div>
            ))}
          </div>
        </BrandCard>
      )}

      <PortalLinksCard
        uid={uid}
        settings={settings}
        onOpenWhatsApp={onOpenWhatsApp}
        onBanner={onBanner}
      />

      {activeWeek && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAB308]/40 bg-[#3D3314]/70 p-4">
          <div>
            <p className="text-sm font-bold text-[#FACC15]">Semana {activeWeek.label}</p>
            <p className="text-xs text-[#F4F4F5]">
              {notRespondedCount} aluno(s) ativo(s) ainda por responder
            </p>
          </div>
          <button
            type="button"
            onClick={onJumpToResponses}
            className="text-xs font-bold text-[#FACC15] hover:underline"
          >
            Ver respostas →
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <h2 className="text-xl font-bold text-[#F4F4F5]">Por confirmar</h2>
        {pendingQueue.length > 0 && <StatusPill tone="gold">{pendingQueue.length}</StatusPill>}
      </div>

      {pendingQueue.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="h-6 w-6" />}
          title="Fila vazia!"
          subtitle="Todos os pedidos de marcação estão confirmados."
        />
      ) : (
        <div className="space-y-3">
          {pendingQueue.map((card, index) => (
            <PendingCardItem
              key={`${card.client.id}_${card.week.weekKey}`}
              card={card}
              isFirst={index === 0}
              locked={lockedByWhatsApp}
              weekSessions={sessions.filter((s) => s.weekKey === card.week.weekKey)}
              allBookings={bookings}
              templates={templates}
              settings={settings}
              onConfirmAll={async () => {
                const tplKey = card.isCancelledAll ? 'CANCELAMENTO' : 'CONFIRMACAO';
                const msg = buildMessageFromTemplate(templates, tplKey, settings.siteBaseUrl, {
                  clientName: card.client.name,
                  sessions: card.items.map((i) => i.session),
                  week: card.week,
                  ptUid: uid,
                  studentPortalCode: settings.studentPortalCode,
                });
                await onConfirmCard(card);
                onOpenWhatsApp(card.client.phone, msg);
              }}
              onRejectItem={async (item) => {
                const msg = buildMessageFromTemplate(templates, 'RECUSA', settings.siteBaseUrl, {
                  clientName: card.client.name,
                  sessions: [item.session],
                  week: card.week,
                  ptUid: uid,
                  studentPortalCode: settings.studentPortalCode,
                });
                await repo.removeBooking(uid, item.booking.id);
                onBanner('Horário recusado e removido.');
                onOpenWhatsApp(card.client.phone, msg);
              }}
              onMoveItem={async (item, targetSession) => {
                const msg = buildMessageFromTemplate(templates, 'ALTERACAO', settings.siteBaseUrl, {
                  clientName: card.client.name,
                  sessions: [targetSession],
                  week: card.week,
                  ptUid: uid,
                  studentPortalCode: settings.studentPortalCode,
                });
                await repo.moveBooking(uid, item.booking.id, targetSession.id);
                onBanner(`Movido para ${targetSession.dateLabel} · ${targetSession.timeLabel}`);
                onOpenWhatsApp(card.client.phone, msg);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PendingCardItem: React.FC<{
  card: PendingConfirmationCard;
  isFirst: boolean;
  locked: boolean;
  weekSessions: TrainingSessionRecord[];
  allBookings: BookingRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  onConfirmAll: () => Promise<void>;
  onRejectItem: (item: BookingWithSession) => Promise<void>;
  onMoveItem: (item: BookingWithSession, target: TrainingSessionRecord) => Promise<void>;
}> = ({
  card,
  isFirst,
  locked,
  weekSessions,
  allBookings,
  templates,
  settings,
  onConfirmAll,
  onRejectItem,
  onMoveItem,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [moveOpenId, setMoveOpenId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  const previewText = buildMessageFromTemplate(
    templates,
    card.isCancelledAll ? 'CANCELAMENTO' : 'CONFIRMACAO',
    settings.siteBaseUrl,
    {
      clientName: card.client.name,
      sessions: card.items.map((i) => i.session),
      week: card.week,
      ptUid: card.client.userId,
      studentPortalCode: settings.studentPortalCode,
    }
  );

  return (
    <BrandCard highlight={isFirst}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[#F4F4F5]">{card.client.name}</h3>
            {card.isAltered && <StatusPill tone="amber">Alterado</StatusPill>}
            {card.isCancelledAll && <StatusPill tone="red">Cancelou</StatusPill>}
            {card.client.newClient && <StatusPill tone="blue">Novo</StatusPill>}
          </div>
          <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(card.client.phone)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#A1A1AA]">{formatTimeAgo(card.requestedAtMillis)}</p>
          <p className="text-xs font-semibold text-[#EAB308]">{card.week.label}</p>
        </div>
      </div>

      <div className="my-3 border-t border-[#323238]" />

      <div className="space-y-2.5">
        {card.items.map((item) => {
          const isMoveOpen = moveOpenId === item.booking.id;
          const availableTargets = weekSessions.filter((s) => {
            if (s.id === item.session.id) return false;
            const confirmedTaken = allBookings.filter(
              (b) => b.sessionId === s.id && b.status === 'CONFIRMED'
            ).length;
            return s.capacity - confirmedTaken > 0;
          });

          return (
            <div key={item.booking.id} className="rounded-xl bg-[#242429]/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#F4F4F5]">
                  {item.session.dateLabel} – {item.session.timeLabel.replace(':', 'h')}
                </p>
                {!card.isCancelledAll && (
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onRejectItem(item)}
                      className="text-[#EF4444] hover:underline disabled:opacity-40"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (isMoveOpen) {
                          setMoveOpenId(null);
                        } else {
                          setMoveOpenId(item.booking.id);
                          setSelectedTargetId(availableTargets[0]?.id || '');
                        }
                      }}
                      className="text-[#EAB308] hover:underline disabled:opacity-40"
                    >
                      {isMoveOpen ? 'Fechar mover' : 'Mover para...'}
                    </button>
                  </div>
                )}
              </div>

              {isMoveOpen && (
                <div className="mt-2.5 space-y-2 rounded-xl border border-[#323238] bg-[#1B1B1E] p-3">
                  {availableTargets.length === 0 ? (
                    <p className="text-xs text-[#A1A1AA]">
                      Sem outros treinos com vagas esta semana.
                    </p>
                  ) : (
                    <>
                      <select
                        value={selectedTargetId}
                        onChange={(e) => setSelectedTargetId(e.target.value)}
                        className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs text-[#F4F4F5] outline-none focus:border-[#EAB308]"
                      >
                        {availableTargets.map((t) => {
                          const confirmedTaken = allBookings.filter(
                            (b) => b.sessionId === t.id && b.status === 'CONFIRMED'
                          ).length;
                          return (
                            <option key={t.id} value={t.id}>
                              {t.dateLabel} – {t.timeLabel.replace(':', 'h')} (
                              {t.capacity - confirmedTaken} vagas)
                            </option>
                          );
                        })}
                      </select>
                      <SecondaryButton
                        fullWidth
                        disabled={locked || !selectedTargetId}
                        onClick={() => {
                          const target = availableTargets.find((t) => t.id === selectedTargetId);
                          if (target) {
                            setMoveOpenId(null);
                            onMoveItem(item, target);
                          }
                        }}
                      >
                        Mover, confirmar e abrir WhatsApp
                      </SecondaryButton>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowPreview((p) => !p)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#A1A1AA] hover:text-white"
      >
        {showPreview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Ver mensagem
      </button>

      {showPreview && (
        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[#323238] bg-[#242429] p-3 text-xs text-[#F4F4F5] font-sans">
          {previewText}
        </pre>
      )}

      <div className="mt-4">
        {isFirst ? (
          <GoldButton fullWidth disabled={locked} onClick={onConfirmAll}>
            <Check className="h-4 w-4" />
            {card.isCancelledAll ? 'Responder e abrir WhatsApp' : 'Confirmar e abrir WhatsApp'}
          </GoldButton>
        ) : (
          <SecondaryButton fullWidth disabled={locked} onClick={onConfirmAll}>
            <Check className="h-4 w-4" />
            {card.isCancelledAll ? 'Responder e abrir WhatsApp' : 'Confirmar e abrir WhatsApp'}
          </SecondaryButton>
        )}
      </div>
    </BrandCard>
  );
};

// ---------------- Semanas ----------------
const SemanasView: React.FC<{
  uid: string;
  clients: ClientRecord[];
  activeWeek: TrainingWeekRecord | null;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntryRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  onShiftWeek: (delta: number) => void;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}> = ({
  uid,
  clients,
  activeWeek,
  sessions,
  bookings,
  waitlistEntries,
  templates,
  settings,
  onShiftWeek,
  onOpenWhatsApp,
  onBanner,
}) => {
  const [showNewSession, setShowNewSession] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [editSession, setEditSession] = useState<TrainingSessionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingSessionRecord | null>(null);

  const weekSessions = useMemo(
    () =>
      activeWeek
        ? sessions.filter((s) => s.weekKey === activeWeek.weekKey).sort((a, b) => a.startMillis - b.startMillis)
        : [],
    [sessions, activeWeek]
  );

  const detailSession = detailSessionId ? sessions.find((s) => s.id === detailSessionId) || null : null;

  const inviteMsg = activeWeek
    ? buildMessageFromTemplate(templates, 'CONVITE', settings.siteBaseUrl, {
        week: activeWeek,
        ptUid: uid,
        studentPortalCode: settings.studentPortalCode,
      })
    : '';

  const handleDuplicatePrev = async () => {
    if (!activeWeek) return;
    const prevMonday = new Date(activeWeek.startDateMillis);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const { weekKey: prevKey } = await repo.ensureWeekExists(uid, prevMonday.getTime());
    const prevSessions = sessions.filter((s) => s.weekKey === prevKey);
    if (prevSessions.length === 0) {
      onBanner('A semana anterior não tem treinos para duplicar.');
      return;
    }
    const added = await repo.duplicatePreviousWeek(uid, activeWeek, prevSessions, weekSessions);
    onBanner(`${added} treino(s) copiado(s) da semana anterior.`);
  };

  const handleExportCsv = () => {
    if (!activeWeek) return;
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const rows = ['Dia;Hora;Duracao(min);Vagas;Inscrito;Telemovel;Estado;Nota'];
    weekSessions.forEach((s) => {
      const sBookings = bookings.filter((b) => b.sessionId === s.id && b.status !== 'CANCELLED');
      if (sBookings.length === 0) {
        rows.push(`${s.dateLabel};${s.timeLabel};${s.durationMinutes};${s.capacity};(Sem inscritos);; ;${s.note}`);
      } else {
        sBookings.forEach((b) => {
          const c = clientMap.get(b.clientId);
          rows.push(
            `${s.dateLabel};${s.timeLabel};${s.durationMinutes};${s.capacity};${c?.name || ''};${
              c?.phone || ''
            };${b.status};${s.note}`
          );
        });
      }
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `new-shape-${activeWeek.weekKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onBanner('CSV da semana exportado.');
  };

  return (
    <div className="space-y-4">
      <BrandCard>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onShiftWeek(-1)}
            aria-label="Semana anterior"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-[#F4F4F5]">{activeWeek?.label || 'Semana'}</h2>
            <p
              className={`text-xs font-medium ${
                activeWeek?.published ? 'text-[#22C55E]' : 'text-[#F59E0B]'
              }`}
            >
              {activeWeek?.published
                ? 'Publicada · Visível para alunos'
                : 'Rascunho · Oculta dos alunos'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onShiftWeek(1)}
            aria-label="Semana seguinte"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {activeWeek && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <GoldButton onClick={() => setShowNewSession(true)}>
              <Plus className="h-4 w-4" />
              Novo treino
            </GoldButton>
            <SecondaryButton
              onClick={async () => {
                await repo.setWeekPublished(uid, activeWeek.weekKey, !activeWeek.published);
                onBanner(!activeWeek.published ? 'Semana publicada!' : 'Semana ocultada.');
              }}
            >
              {activeWeek.published ? 'Despublicar' : 'Publicar semana'}
            </SecondaryButton>
            <SecondaryButton onClick={handleDuplicatePrev}>
              <Copy className="h-4 w-4" />
              Duplicar anterior
            </SecondaryButton>
            <SecondaryButton onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </SecondaryButton>
          </div>
        )}
      </BrandCard>

      {activeWeek?.published && (
        <BrandCard highlight>
          <h3 className="text-sm font-bold text-[#FACC15]">Convite da semana</h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[#242429] p-3 text-xs text-[#F4F4F5] font-sans">
            {inviteMsg}
          </pre>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SecondaryButton
              onClick={async () => {
                await navigator.clipboard.writeText(inviteMsg);
                onBanner('Convite copiado!');
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar mensagem
            </SecondaryButton>
            <GoldButton onClick={() => onOpenWhatsApp(null, inviteMsg)}>
              <Share2 className="h-4 w-4" />
              Partilhar no WhatsApp
            </GoldButton>
          </div>
        </BrandCard>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#F4F4F5]">Treinos ({weekSessions.length})</h3>
      </div>

      {weekSessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Sem treinos nesta semana"
          subtitle="Carrega em '+ Novo treino' ou 'Duplicar anterior' para criar os horários."
        />
      ) : (
        <div className="space-y-2.5">
          {weekSessions.map((session) => {
            const sBookings = bookings.filter(
              (b) => b.sessionId === session.id && b.status !== 'CANCELLED'
            );
            const confirmedBookings = sBookings.filter((b) => b.status === 'CONFIRMED');
            const confirmedCount = confirmedBookings.length;
            const pendingCount = sBookings.filter(
              (b) => b.status === 'PENDING' || b.status === 'ALTERED'
            ).length;
            const presentCount = confirmedBookings.filter(
              (b) => b.attendanceStatus === 'PRESENT'
            ).length;
            const absentCount = confirmedBookings.filter(
              (b) => b.attendanceStatus === 'ABSENT'
            ).length;
            const sessionWaitlistCount = waitlistEntries.filter(
              (w) => w.sessionId === session.id
            ).length;
            const isFull = confirmedCount >= session.capacity;
            const nowDate = new Date();
            const sesDate = new Date(session.startMillis);
            const isToday =
              session.startMillis > 0 &&
              nowDate.getFullYear() === sesDate.getFullYear() &&
              nowDate.getMonth() === sesDate.getMonth() &&
              nowDate.getDate() === sesDate.getDate();

            return (
              <div
                key={session.id}
                onClick={() => setDetailSessionId(session.id)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition hover:border-[#EAB308]/60 ${
                  isToday
                    ? 'border-[#EAB308]/70 bg-[#3D3314]/35'
                    : 'border-[#323238] bg-[#1B1B1E]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-bold text-[#F4F4F5]">
                      {session.dateLabel} · {session.timeLabel.replace(':', 'h')}
                    </p>
                    {isToday && <StatusPill tone="gold">Hoje</StatusPill>}
                    {(presentCount > 0 || absentCount > 0) && (
                      <StatusPill tone="green">
                        {presentCount}✓{absentCount > 0 ? ` · ${absentCount}✕` : ''}
                      </StatusPill>
                    )}
                    {sessionWaitlistCount > 0 && (
                      <StatusPill tone="amber">
                        Espera: {sessionWaitlistCount}
                      </StatusPill>
                    )}
                  </div>
                  <p className="text-xs text-[#A1A1AA]">
                    {session.durationMinutes} min{session.note ? ` · ${session.note}` : ''}
                    {isToday && confirmedCount > 0 ? ' · Toca para marcar presenças' : ''}
                  </p>
                  {pendingCount > 0 && (
                    <p className="mt-1 text-xs font-semibold text-[#F59E0B]">
                      {pendingCount} por confirmar
                    </p>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <StatusPill tone={isFull ? 'red' : 'gold'}>
                    {confirmedCount}/{session.capacity}
                  </StatusPill>
                  <button
                    type="button"
                    onClick={() => setEditSession(session)}
                    aria-label="Editar treino"
                    className="rounded-lg p-2 text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(session)}
                    aria-label="Apagar treino"
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

      {/* New Session Modal */}
      {showNewSession && activeWeek && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onCreate={async (days, h, m, dur, cap, note) => {
            await repo.createSessions(uid, activeWeek, days, h, m, dur, cap, note);
            setShowNewSession(false);
            onBanner('Treino(s) criado(s)!');
          }}
        />
      )}

      {/* Session Detail Modal */}
      {detailSession && (
        <SessionDetailModal
          session={detailSession}
          bookings={bookings.filter((b) => b.sessionId === detailSession.id && b.status !== 'CANCELLED')}
          waitlistEntries={waitlistEntries
            .filter((w) => w.sessionId === detailSession.id)
            .sort((a, b) => a.createdAtMillis - b.createdAtMillis)}
          clients={clients}
          onClose={() => setDetailSessionId(null)}
          onAddClient={async (clientId) => {
            await repo.addManualBooking(uid, detailSession.id, detailSession.weekKey, clientId);
            onBanner('Cliente adicionado e confirmado.');
          }}
          onRemoveBooking={async (bid) => {
            await repo.removeBooking(uid, bid);
            onBanner('Inscrição removida.');
          }}
          onPromoteWaitlist={async (entry) => {
            await repo.promoteWaitlistEntry(uid, entry);
            onBanner('Aluno promovido da lista de espera para Confirmado ✓');
          }}
          onRemoveWaitlist={async (entryId) => {
            await repo.leaveWaitlist(uid, entryId);
            onBanner('Aluno removido da lista de espera.');
          }}
          onSetAttendance={async (bid, status) => {
            await repo.setBookingAttendance(uid, bid, status);
            onBanner(
              status === 'PRESENT'
                ? 'Presença confirmada ✓'
                : status === 'ABSENT'
                ? 'Falta registada.'
                : 'Presença limpa.'
            );
          }}
          onEdit={() => {
            setDetailSessionId(null);
            setEditSession(detailSession);
          }}
        />
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          onClose={() => setEditSession(null)}
          onSave={async (updated) => {
            await repo.updateSession(uid, updated);
            setEditSession(null);
            onBanner('Treino atualizado.');
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title="Apagar treino?"
        onClose={() => setDeleteTarget(null)}
      >
        <p className="text-sm text-[#A1A1AA]">
          Isto vai apagar{' '}
          <strong className="text-white">
            {deleteTarget?.dateLabel} às {deleteTarget?.timeLabel}
          </strong>{' '}
          e todas as reservas associadas.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={() => setDeleteTarget(null)}>Cancelar</SecondaryButton>
          <button
            type="button"
            onClick={async () => {
              if (deleteTarget) {
                await repo.deleteSession(uid, deleteTarget.id, bookings);
                setDeleteTarget(null);
                onBanner('Treino apagado.');
              }
            }}
            className="rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#DC2626]"
          >
            Apagar
          </button>
        </div>
      </Modal>
    </div>
  );
};

const NewSessionModal: React.FC<{
  onClose: () => void;
  onCreate: (days: number[], h: number, m: number, dur: number, cap: number, note: string) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const [days, setDays] = useState<number[]>([1, 3]);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState('6');
  const [note, setNote] = useState('');
  const dayLabels = [
    [1, 'Seg'],
    [2, 'Ter'],
    [3, 'Qua'],
    [4, 'Qui'],
    [5, 'Sex'],
    [6, 'Sáb'],
    [7, 'Dom'],
  ] as const;

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <Modal open title="Novo treino" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <FieldLabel>Dias (podes escolher vários)</FieldLabel>
          <div className="grid grid-cols-7 gap-1.5">
            {dayLabels.map(([num, lbl]) => {
              const active = days.includes(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggleDay(num)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                    active
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#F4F4F5]'
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Vagas</FieldLabel>
            <Input
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Duração</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {[45, 60, 75, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  duration === d
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Nota (opcional, ex: treino ao ar livre)</FieldLabel>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Treino ao ar livre"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={days.length === 0}
            onClick={() => {
              const [hStr, mStr] = time.split(':');
              onCreate(
                days,
                Number(hStr) || 18,
                Number(mStr) || 0,
                duration,
                Math.max(1, Number(capacity) || 6),
                note
              );
            }}
          >
            Criar treino
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const EditSessionModal: React.FC<{
  session: TrainingSessionRecord;
  onClose: () => void;
  onSave: (updated: TrainingSessionRecord) => Promise<void>;
}> = ({ session, onClose, onSave }) => {
  const [timeLabel, setTimeLabel] = useState(session.timeLabel);
  const [duration, setDuration] = useState(String(session.durationMinutes));
  const [capacity, setCapacity] = useState(String(session.capacity));
  const [note, setNote] = useState(session.note);

  return (
    <Modal open title="Editar treino" subtitle={session.dateLabel} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Hora (HH:mm)</FieldLabel>
          <Input type="time" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Duração (min)</FieldLabel>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Vagas</FieldLabel>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel>Nota opcional</FieldLabel>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            onClick={() =>
              onSave({
                ...session,
                timeLabel: timeLabel || session.timeLabel,
                durationMinutes: Math.max(10, Number(duration) || session.durationMinutes),
                capacity: Math.max(1, Number(capacity) || session.capacity),
                note,
              })
            }
          >
            Guardar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const SessionDetailModal: React.FC<{
  session: TrainingSessionRecord;
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntryRecord[];
  clients: ClientRecord[];
  onClose: () => void;
  onAddClient: (clientId: string) => Promise<void>;
  onRemoveBooking: (bookingId: string) => Promise<void>;
  onPromoteWaitlist: (entry: WaitlistEntryRecord) => Promise<void>;
  onRemoveWaitlist: (entryId: string) => Promise<void>;
  onSetAttendance: (bookingId: string, status: AttendanceStatus) => Promise<void>;
  onEdit: () => void;
}> = ({
  session,
  bookings,
  waitlistEntries,
  clients,
  onClose,
  onAddClient,
  onRemoveBooking,
  onPromoteWaitlist,
  onRemoveWaitlist,
  onSetAttendance,
  onEdit,
}) => {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const enrolledIds = new Set(bookings.map((b) => b.clientId));
  const availableClients = clients.filter((c) => c.active && !enrolledIds.has(c.id));
  const [selectedClientId, setSelectedClientId] = useState(availableClients[0]?.id || '');

  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;

  return (
    <Modal
      open
      title={`${session.dateLabel} · ${session.timeLabel.replace(':', 'h')}`}
      subtitle={`${confirmedCount}/${session.capacity} vagas preenchidas (${bookings.length} pedidos) · ${session.durationMinutes} min`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Inscritos & Confirmação de Presença</FieldLabel>
          {bookings.length === 0 ? (
            <p className="text-xs text-[#A1A1AA]">Ainda não há inscritos neste treino.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => {
                const c = clientMap.get(b.clientId);
                if (!c) return null;
                const confirmed = b.status === 'CONFIRMED';
                const isPresent = b.attendanceStatus === 'PRESENT';
                const isAbsent = b.attendanceStatus === 'ABSENT';
                return (
                  <div
                    key={b.id}
                    className="space-y-2 rounded-xl border border-[#323238] bg-[#242429] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                          <StatusPill
                            tone={c.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'}
                          >
                            {c.trainingType === 'PERSONALIZADO' ? 'Personalizado' : 'Grupo'}
                          </StatusPill>
                        </div>
                        <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(c.phone)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill tone={confirmed ? 'green' : 'amber'}>
                          {confirmed ? 'Confirmado' : 'Pendente'}
                        </StatusPill>
                        <button
                          type="button"
                          onClick={() => onRemoveBooking(b.id)}
                          className="text-xs font-semibold text-[#EF4444] hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </div>

                    {confirmed && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#323238]/70 pt-2">
                        <span className="text-[11px] font-semibold text-[#A1A1AA]">
                          Presença no treino:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onSetAttendance(b.id, isPresent ? '' : 'PRESENT')
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                              isPresent
                                ? 'border-[#22C55E] bg-[#22C55E] text-[#121214]'
                                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#22C55E] hover:text-[#22C55E]'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Presente
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onSetAttendance(b.id, isAbsent ? '' : 'ABSENT')
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                              isAbsent
                                ? 'border-[#EF4444] bg-[#EF4444] text-white'
                                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#EF4444] hover:text-[#EF4444]'
                            }`}
                          >
                            <X className="h-3.5 w-3.5" />
                            Falta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {waitlistEntries.length > 0 && (
          <div className="border-t border-[#323238] pt-3 space-y-2">
            <FieldLabel>
              Lista de Espera ({waitlistEntries.length}) · Ordem de chegada
            </FieldLabel>
            <div className="space-y-2">
              {waitlistEntries.map((entry, idx) => {
                const c = clientMap.get(entry.clientId);
                if (!c) return null;
                return (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#3B2A10]/45 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill tone="amber">#{idx + 1}</StatusPill>
                        <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                        {formatPhoneDisplay(c.phone)} · entrou {formatTimeAgo(entry.createdAtMillis)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onPromoteWaitlist(entry)}
                        className="rounded-lg bg-[#EAB308] px-2.5 py-1.5 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
                      >
                        Promover ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveWaitlist(entry.id)}
                        className="text-xs font-semibold text-[#EF4444] hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {availableClients.length > 0 && (
          <div className="border-t border-[#323238] pt-3 space-y-2">
            <FieldLabel>Adicionar cliente à mão (fica logo confirmado)</FieldLabel>
            <select
              value={selectedClientId || availableClients[0].id}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
            >
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatPhoneDisplay(c.phone)})
                </option>
              ))}
            </select>
            <GoldButton
              fullWidth
              onClick={() => onAddClient(selectedClientId || availableClients[0].id)}
            >
              Adicionar (Confirmado)
            </GoldButton>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onEdit}>Editar treino</SecondaryButton>
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
        </div>
      </div>
    </Modal>
  );
};

// ---------------- Respostas (Lembretes) ----------------
const RespostasView: React.FC<{
  uid: string;
  clients: ClientRecord[];
  activeWeek: TrainingWeekRecord | null;
  bookings: BookingRecord[];
  weekResponses: WeekResponseRecord[];
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  onShiftWeek: (delta: number) => void;
  onOpenWhatsApp: (phone: string, msg: string) => void;
}> = ({
  uid,
  clients,
  activeWeek,
  bookings,
  weekResponses,
  templates,
  settings,
  onShiftWeek,
  onOpenWhatsApp,
}) => {
  const activeClients = clients.filter((c) => c.active);
  const bookedIds = new Set(
    activeWeek
      ? bookings
          .filter((b) => b.weekKey === activeWeek.weekKey && b.status !== 'CANCELLED')
          .map((b) => b.clientId)
      : []
  );
  const unavailableIds = new Set(
    activeWeek
      ? weekResponses
          .filter((r) => r.weekKey === activeWeek.weekKey && r.status === 'UNAVAILABLE')
          .map((r) => r.clientId)
      : []
  );
  const remindedIds = new Set(
    activeWeek
      ? weekResponses
          .filter((r) => r.weekKey === activeWeek.weekKey && r.status === 'REMINDED')
          .map((r) => r.clientId)
      : []
  );

  const missing = activeClients.filter((c) => !bookedIds.has(c.id) && !unavailableIds.has(c.id));
  const unavailable = activeClients.filter((c) => unavailableIds.has(c.id));

  return (
    <div className="space-y-4">
      <BrandCard>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onShiftWeek(-1)}
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-xs text-[#A1A1AA]">Ainda não responderam</p>
            <h2 className="text-lg font-bold text-[#F4F4F5]">{activeWeek?.label || '—'}</h2>
          </div>
          <button
            type="button"
            onClick={() => onShiftWeek(1)}
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-[#A1A1AA]">
          {missing.length} clientes ativos ainda não responderam. Envia um lembrete de cada vez.
        </p>
      </BrandCard>

      {missing.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="Todos responderam!"
          subtitle="Todos os clientes ativos já marcaram ou avisaram esta semana."
        />
      ) : (
        <div className="space-y-2.5">
          {missing.map((c) => {
            const isReminded = remindedIds.has(c.id);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-4"
              >
                <div>
                  <p className="text-sm font-bold text-[#F4F4F5]">{c.name}</p>
                  <p className="text-xs text-[#A1A1AA]">{formatPhoneDisplay(c.phone)}</p>
                </div>
                {isReminded ? (
                  <StatusPill tone="green">Enviado ✓</StatusPill>
                ) : (
                  activeWeek && (
                    <SecondaryButton
                      onClick={async () => {
                        const msg = buildMessageFromTemplate(
                          templates,
                          'LEMBRETE',
                          settings.siteBaseUrl,
                          {
                            clientName: c.name,
                            week: activeWeek,
                            ptUid: uid,
                            studentPortalCode: settings.studentPortalCode,
                          }
                        );
                        await repo.markClientReminded(uid, activeWeek.weekKey, c.id);
                        onOpenWhatsApp(c.phone, msg);
                      }}
                    >
                      Lembrete
                    </SecondaryButton>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-[#A1A1AA]">
            Disseram &ldquo;Esta semana não posso&rdquo; ({unavailable.length})
          </h3>
          {unavailable.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-[#323238] bg-[#1B1B1E] px-4 py-3"
            >
              <span className="text-sm text-[#F4F4F5]">{c.name}</span>
              <StatusPill>Não pode</StatusPill>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------- Mensagens & Definições ----------------
const MensagensSettingsView: React.FC<{
  uid: string;
  activeWeek: TrainingWeekRecord | null;
  templates: MessageTemplateRecord[];
  settings: StudioSettingsRecord;
  onBanner: (msg: string) => void;
}> = ({ uid, activeWeek, templates, settings, onBanner }) => {
  const [clientsCanEdit, setClientsCanEdit] = useState(settings.clientsCanEdit);
  const [cutoffMinutes, setCutoffMinutes] = useState(
    String(getEffectiveCutoffMinutes(settings))
  );
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(
    String(getEffectiveReminderLeadMinutes(settings))
  );
  const [whatsappWebMode, setWhatsappWebMode] = useState(settings.whatsappWebMode);
  const [siteBaseUrl, setSiteBaseUrl] = useState(settings.siteBaseUrl);
  const [ptWhatsappPhone, setPtWhatsappPhone] = useState(settings.ptWhatsappPhone || '');
  const [notifPerm, setNotifPerm] = useState(() => getNotificationPermission());
  const [ptAlertsEnabled, setPtAlertsEnabled] = useState(() => getPtAlertsPreference());

  useEffect(() => {
    setClientsCanEdit(settings.clientsCanEdit);
    setCutoffMinutes(String(getEffectiveCutoffMinutes(settings)));
    setReminderLeadMinutes(String(getEffectiveReminderLeadMinutes(settings)));
    setWhatsappWebMode(settings.whatsappWebMode);
    setSiteBaseUrl(settings.siteBaseUrl);
    setPtWhatsappPhone(settings.ptWhatsappPhone || '');
  }, [settings]);

  const parsedMinutes =
    cutoffMinutes.trim() === '' || Number.isNaN(Number(cutoffMinutes))
      ? 15
      : Math.max(0, Math.min(4320, Math.round(Number(cutoffMinutes))));

  const parsedReminderMinutes =
    reminderLeadMinutes.trim() === '' || Number.isNaN(Number(reminderLeadMinutes))
      ? 60
      : Math.max(5, Math.min(1440, Math.round(Number(reminderLeadMinutes))));

  return (
    <div className="space-y-4">
      <PortalLinksCard
        uid={uid}
        settings={settings}
        showRegenerate
        onOpenWhatsApp={(phone, msg) => {
          const url = buildWhatsAppUrl(phone, msg, settings.whatsappWebMode);
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
        onBanner={onBanner}
      />

      <div>
        <h2 className="text-xl font-bold text-[#F4F4F5]">Mensagens WhatsApp</h2>
        <p className="text-xs text-[#A1A1AA]">
          Edita os textos enviados aos clientes. Usa {'{nome}'}, {'{treinos}'}, {'{link}'} e{' '}
          {'{semana}'}.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map((tpl) => (
          <TemplateEditorCard
            key={tpl.templateKey}
            template={tpl}
            uid={uid}
            settings={settings}
            activeWeekLabel={activeWeek?.label || '16–22 Nov'}
            onSave={async (body) => {
              await repo.saveMessageTemplate(uid, tpl.templateKey, body);
              onBanner(`Modelo "${tpl.title}" guardado.`);
            }}
            onReset={async () => {
              await repo.saveMessageTemplate(uid, tpl.templateKey, tpl.defaultBody);
              onBanner(`Modelo "${tpl.title}" reposto.`);
            }}
          />
        ))}
      </div>

      <h2 className="pt-2 text-xl font-bold text-[#F4F4F5]">Definições</h2>
      <BrandCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#F4F4F5]">Clientes podem alterar o pedido</p>
              <p className="text-xs text-[#A1A1AA]">
                Mesmo depois de confirmado. A alteração volta à fila como &ldquo;Alterado&rdquo;.
              </p>
            </div>
            <input
              type="checkbox"
              checked={clientsCanEdit}
              onChange={(e) => setClientsCanEdit(e.target.checked)}
              className="h-5 w-5 accent-[#EAB308]"
            />
          </div>

          <div>
            <FieldLabel>Antecedência mínima antes do treino (minutos)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={4320}
              value={cutoffMinutes}
              onChange={(e) => setCutoffMinutes(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[#A1A1AA]">
              Atual: <strong className="text-[#FACC15]">{formatCutoffLabel(parsedMinutes)}</strong> antes do treino
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { mins: 15, label: '15 min' },
                { mins: 30, label: '30 min' },
                { mins: 60, label: '1h' },
                { mins: 120, label: '2h' },
                { mins: 720, label: '12h' },
                { mins: 0, label: 'Sem limite' },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  onClick={() => setCutoffMinutes(String(preset.mins))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    parsedMinutes === preset.mins
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:border-[#EAB308] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Antecedência dos lembretes push de treino (minutos)</FieldLabel>
            <Input
              type="number"
              min={5}
              max={1440}
              value={reminderLeadMinutes}
              onChange={(e) => setReminderLeadMinutes(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[#A1A1AA]">
              Atual:{' '}
              <strong className="text-[#FACC15]">
                {formatLeadMinutesLabel(parsedReminderMinutes)}
              </strong>{' '}
              antes do treino (entre 5 min e 24h)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { mins: 15, label: '15 min' },
                { mins: 30, label: '30 min' },
                { mins: 45, label: '45 min' },
                { mins: 60, label: '1h' },
                { mins: 120, label: '2h' },
                { mins: 1440, label: '24h' },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  onClick={() => setReminderLeadMinutes(String(preset.mins))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    parsedReminderMinutes === preset.mins
                      ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:border-[#EAB308] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#F4F4F5]">Sempre web.whatsapp.com</p>
              <p className="text-xs text-[#A1A1AA]">
                Útil no computador se a app WhatsApp Desktop não abrir diretamente.
              </p>
            </div>
            <input
              type="checkbox"
              checked={whatsappWebMode}
              onChange={(e) => setWhatsappWebMode(e.target.checked)}
              className="h-5 w-5 accent-[#EAB308]"
            />
          </div>

          <div>
            <FieldLabel>Telemóvel WhatsApp do PT (para avisos de cancelamento/alteração)</FieldLabel>
            <Input
              type="tel"
              value={ptWhatsappPhone}
              onChange={(e) => setPtWhatsappPhone(e.target.value)}
              placeholder="Ex: 912 345 678"
            />
            <p className="mt-1 text-[11px] text-[#A1A1AA]">
              Quando um aluno cancela ou altera o horário, a app abre logo o WhatsApp dirigido a este número.
            </p>
          </div>

          <div className="rounded-xl border border-[#323238] bg-[#242429]/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#F4F4F5]">Notificações Push no Browser (PT)</p>
                <p className="text-xs text-[#A1A1AA]">
                  Recebe um alerta imediato sempre que um aluno cancelar ou alterar o horário.
                </p>
              </div>
              <input
                type="checkbox"
                checked={ptAlertsEnabled}
                onChange={(e) => {
                  const next = e.target.checked;
                  setPtAlertsEnabled(next);
                  savePtAlertsPreference(next);
                }}
                className="h-5 w-5 accent-[#EAB308]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {notifPerm !== 'granted' ? (
                <SecondaryButton
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    setNotifPerm(res);
                    if (res === 'granted') {
                      setPtAlertsEnabled(true);
                      savePtAlertsPreference(true);
                      onBanner('Notificações push ativadas!');
                    } else {
                      onBanner('Permissão de notificações não autorizada neste browser.');
                    }
                  }}
                >
                  <Bell className="h-4 w-4 text-[#EAB308]" />
                  {notifPerm === 'unsupported'
                    ? 'Não suportado neste browser'
                    : 'Ativar notificações push'}
                </SecondaryButton>
              ) : (
                <>
                  <StatusPill tone="green">Push ativo ✓</StatusPill>
                  <SecondaryButton
                    onClick={async () => {
                      await dispatchLocalPushNotification(
                        'New Shape · Teste de Alerta PT',
                        'As notificações de cancelamento e alteração de horário estão ativas!'
                      );
                      onBanner('Notificação de teste enviada.');
                    }}
                  >
                    Testar notificação
                  </SecondaryButton>
                </>
              )}
            </div>
          </div>

          <div>
            <FieldLabel>Endereço do site nos links</FieldLabel>
            <Input
              value={siteBaseUrl}
              onChange={(e) => setSiteBaseUrl(e.target.value)}
              placeholder={DEFAULT_WEB_BASE_URL}
            />
          </div>

          <GoldButton
            fullWidth
            onClick={async () => {
              await repo.saveStudioSettings(uid, {
                ...settings,
                clientsCanEdit,
                cutoffHours: Math.floor(parsedMinutes / 60),
                cutoffMinutes: parsedMinutes,
                reminderLeadMinutes: parsedReminderMinutes,
                whatsappWebMode,
                siteBaseUrl: siteBaseUrl.trim() || window.location.origin || DEFAULT_WEB_BASE_URL,
                ptWhatsappPhone,
                seeded: true,
              });
              onBanner('Definições guardadas!');
            }}
          >
            Guardar definições
          </GoldButton>
        </div>
      </BrandCard>
    </div>
  );
};

const PortalLinksCard: React.FC<{
  uid: string;
  settings: StudioSettingsRecord;
  showRegenerate?: boolean;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}> = ({ uid, settings, showRegenerate = false, onOpenWhatsApp, onBanner }) => {
  const [regenerating, setRegenerating] = useState(false);
  const [syncingDomain, setSyncingDomain] = useState(false);
  const ptLink = buildPtPortalLink(settings.siteBaseUrl);
  const studentLink = buildStudentPortalLink(
    settings.siteBaseUrl,
    uid,
    settings.studentPortalCode
  );
  const studentInviteText = `Olá! 💪 Já podes aceder ao teu Portal de Aluno New Shape (marcações, treinos, nutrição e avaliações) através deste link:\n${studentLink}\n\nEntras apenas com o teu número de telemóvel!`;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentHost = typeof window !== 'undefined' ? window.location.host : '';
  const normalizedSavedBase = settings.siteBaseUrl.trim().replace(/\/+$/, '');
  const showDomainMismatch =
    currentOrigin.startsWith('https://') &&
    normalizedSavedBase.length > 0 &&
    normalizedSavedBase !== currentOrigin;

  return (
    <BrandCard highlight>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#EAB308]" />
          <h3 className="text-sm font-bold text-[#FACC15]">Links de Acesso (PT e Aluno)</h3>
        </div>
        {showRegenerate && (
          <button
            type="button"
            disabled={regenerating}
            onClick={async () => {
              setRegenerating(true);
              try {
                await repo.regenerateStudentPortalCode(uid);
                onBanner('Novo código do Link do Aluno gerado!');
              } finally {
                setRegenerating(false);
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-[11px] font-semibold text-[#A1A1AA] hover:border-[#EAB308] hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            {regenerating ? 'A gerar...' : 'Renovar código aluno'}
          </button>
        )}
      </div>

      {showDomainMismatch && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/50 bg-[#3B2A10] px-3 py-2.5 text-xs text-[#FDE68A]">
          <span>
            Os links estão a usar <strong>{normalizedSavedBase}</strong> em vez do endereço atual (
            <strong>{currentHost}</strong>).
          </span>
          <button
            type="button"
            disabled={syncingDomain}
            onClick={async () => {
              setSyncingDomain(true);
              try {
                await repo.saveStudioSettings(uid, {
                  ...settings,
                  siteBaseUrl: currentOrigin,
                });
                onBanner(`Links atualizados para ${currentHost}!`);
              } finally {
                setSyncingDomain(false);
              }
            }}
            className="rounded-lg bg-[#EAB308] px-2.5 py-1 text-xs font-bold text-[#121214] hover:bg-[#FACC15]"
          >
            {syncingDomain ? 'A atualizar...' : `Usar ${currentHost}`}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-[#323238] bg-[#242429]/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#F4F4F5]">Link do PT (Painel de Gestão)</p>
              <p className="mt-0.5 truncate text-[11px] font-mono text-[#A1A1AA]">{ptLink}</p>
            </div>
            <SecondaryButton
              onClick={async () => {
                await navigator.clipboard.writeText(ptLink);
                onBanner('Link do PT copiado!');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar PT
            </SecondaryButton>
          </div>
        </div>

        <div className="rounded-xl border border-[#EAB308]/40 bg-[#242429]/80 p-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#FACC15]">
              Link do Aluno (Entrada direta só com telemóvel)
            </p>
            <p className="mt-0.5 break-all text-[11px] font-mono text-[#F4F4F5]">
              {settings.studentPortalCode
                ? studentLink
                : 'A gerar código de acesso do aluno...'}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <SecondaryButton
              disabled={!settings.studentPortalCode}
              onClick={async () => {
                await navigator.clipboard.writeText(studentLink);
                onBanner('Link do Aluno copiado!');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Link Aluno
            </SecondaryButton>
            <GoldButton
              disabled={!settings.studentPortalCode}
              onClick={() => onOpenWhatsApp(null, studentInviteText)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Enviar no WhatsApp
            </GoldButton>
            <a
              href="/guia-do-aluno-new-shape.pdf"
              download="Guia-do-Aluno-New-Shape.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#323238] bg-[#242429] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#F4F4F5] transition hover:border-[#EAB308] hover:text-[#FACC15]"
            >
              <Download className="h-3.5 w-3.5 text-[#EAB308]" />
              Guia do Aluno (PDF)
            </a>
          </div>
        </div>
      </div>
    </BrandCard>
  );
};

const TemplateEditorCard: React.FC<{
  template: MessageTemplateRecord;
  uid: string;
  settings: StudioSettingsRecord;
  activeWeekLabel: string;
  onSave: (body: string) => Promise<void>;
  onReset: () => Promise<void>;
}> = ({ template, uid, settings, activeWeekLabel, onSave, onReset }) => {
  const [body, setBody] = useState(template.body);

  const preview = body
    .replaceAll('{nome}', 'Ana')
    .replaceAll('{treinos}', '• Segunda, 16 Nov – 18h00\n• Quarta, 18 Nov – 19h00')
    .replaceAll(
      '{link}',
      buildStudentPortalLink(settings.siteBaseUrl, uid, settings.studentPortalCode, '2026-w47')
    )
    .replaceAll('{semana}', activeWeekLabel);

  return (
    <BrandCard>
      <h3 className="text-sm font-bold text-[#FACC15]">{template.title}</h3>
      <p className="text-xs text-[#A1A1AA]">{template.description}</p>
      <div className="mt-3">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['{nome}', '{treinos}', '{link}', '{semana}'].map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setBody((b) => `${b} ${tag}`)}
            className="rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-xs font-mono text-[#FACC15] hover:border-[#EAB308]"
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold text-[#A1A1AA] mb-1">Pré-visualização</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-[#242429] p-3 text-xs text-[#F4F4F5] font-sans">
          {preview}
        </pre>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setBody(template.defaultBody);
            onReset();
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#A1A1AA] hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Repor original
        </button>
        <GoldButton onClick={() => onSave(body)}>
          <Clock className="hidden" />
          Guardar
        </GoldButton>
      </div>
    </BrandCard>
  );
};
