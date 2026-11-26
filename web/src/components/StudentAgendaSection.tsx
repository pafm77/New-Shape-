import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  BookingRecord,
  ClientRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WaitlistEntryRecord,
  WeekResponseRecord,
  getWeekDayWorkoutType,
} from '../types/studio';
import {
  DAYS_PT,
  formatCutoffLabel,
  formatFixedSlotsSummary,
  getEffectiveCutoffMinutes,
  MONTHS_PT,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  dispatchLocalPushNotification,
  formatLeadMinutesLabel,
  requestNotificationPermission,
  saveReminderPreferences,
} from '../services/notificationService';
import {
  BrandCard,
  EmptyState,
  GoldButton,
  Modal,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';

type StudentAgendaSubTab = 'marcar' | 'marcacoes';

const DAY_SHORT_PT: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  7: 'Dom',
};

function computeEndTimeLabel(timeLabel: string, durationMinutes: number): string {
  const [hStr, mStr] = timeLabel.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const total = h * 60 + m + Math.max(0, durationMinutes);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function getRelativeDayTag(startMillis: number): 'Hoje' | 'Amanhã' | null {
  if (!startMillis) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(startMillis);
  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const diffDays = Math.round((targetStart - todayStart) / 86_400_000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return null;
}

function getWeekDayDate(week: TrainingWeekRecord, dayOfWeek: number): Date {
  const base = new Date(week.startDateMillis);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + (dayOfWeek - 1));
  return d;
}

export interface StudentAgendaSectionProps {
  uid: string;
  client: ClientRecord;
  firstName: string;
  publishedWeeks: TrainingWeekRecord[];
  activeWeek: TrainingWeekRecord | null;
  activeWeekIdx: number;
  onSelectWeekKey: (weekKey: string) => void;
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  clientWeekBookings: BookingRecord[];
  draftSessionIds: Set<string>;
  setDraftSessionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  waitlistEntries: WaitlistEntryRecord[];
  weekResponse?: WeekResponseRecord;
  settings: StudioSettingsRecord;
  weeklyLimit: number;
  studioDefaultLeadMins: number;
  notifPerm: NotificationPermission | 'unsupported';
  setNotifPerm: (p: NotificationPermission | 'unsupported') => void;
  reminderEnabled: boolean;
  setReminderEnabled: (v: boolean) => void;
  hasCustomLead: boolean;
  setHasCustomLead: (v: boolean) => void;
  reminderLeadMins: number;
  setReminderLeadMins: (m: number) => void;
  onBanner: (msg: string) => void;
  onWhatsAppAlert: (modal: { title: string; subtitle: string; message: string }) => void;
}

export const StudentAgendaSection: React.FC<StudentAgendaSectionProps> = ({
  uid,
  client,
  firstName,
  publishedWeeks,
  activeWeek,
  activeWeekIdx,
  onSelectWeekKey,
  sessions,
  bookings,
  clientWeekBookings,
  draftSessionIds,
  setDraftSessionIds,
  waitlistEntries,
  weekResponse,
  settings,
  weeklyLimit,
  studioDefaultLeadMins,
  notifPerm,
  setNotifPerm,
  reminderEnabled,
  setReminderEnabled,
  hasCustomLead,
  setHasCustomLead,
  reminderLeadMins,
  setReminderLeadMins,
  onBanner,
  onWhatsAppAlert,
}) => {
  const [subTab, setSubTab] = useState<StudentAgendaSubTab>('marcar');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [showPastConfirmed, setShowPastConfirmed] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{
    booking: BookingRecord;
    session: TrainingSessionRecord;
    week?: TrainingWeekRecord;
  } | null>(null);
  const [swapTarget, setSwapTarget] = useState<{
    booking: BookingRecord;
    session: TrainingSessionRecord;
    week?: TrainingWeekRecord;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const weekSessions = useMemo(() => {
    if (!activeWeek) return [];
    return sessions
      .filter((s) => s.weekKey === activeWeek.weekKey && !s.ptPrivatePersonal)
      .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel));
  }, [sessions, activeWeek]);

  // Auto-select best day when switching week (today if inside week with sessions, else first day with sessions)
  useEffect(() => {
    if (!activeWeek) return;
    const now = new Date();
    const todayDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = activeWeek.startDateMillis;
    const weekEnd = weekStart + 7 * 86_400_000;
    const isCurrentWeek = todayStart >= weekStart && todayStart < weekEnd;

    const daysWithSessions = Array.from(new Set(weekSessions.map((s) => s.dayOfWeek))).sort(
      (a, b) => a - b
    );
    if (isCurrentWeek && daysWithSessions.includes(todayDayOfWeek)) {
      setSelectedDay(todayDayOfWeek);
    } else if (daysWithSessions.length > 0) {
      setSelectedDay(daysWithSessions[0]);
    } else {
      setSelectedDay(1);
    }
  }, [activeWeek?.weekKey, weekSessions.length]);

  const daySessions = useMemo(
    () =>
      weekSessions
        .filter((s) => s.dayOfWeek === selectedDay)
        .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel)),
    [weekSessions, selectedDay]
  );

  // All confirmed & pending bookings across ALL weeks for the "Marcações" sub-tab
  const sessionMap = useMemo(
    () => new Map(sessions.filter((s) => !s.ptPrivatePersonal).map((s) => [s.id, s])),
    [sessions]
  );
  const visibleSessionDayById = useMemo(() => {
    const map = new Map<string, number>();
    sessionMap.forEach((s, id) => map.set(id, s.dayOfWeek));
    return map;
  }, [sessionMap]);
  const weekMap = useMemo(() => new Map(publishedWeeks.map((w) => [w.weekKey, w])), [publishedWeeks]);

  const myConfirmedItems = useMemo(() => {
    return bookings
      .filter((b) => b.clientId === client.id && b.status === 'CONFIRMED')
      .map((booking) => {
        const session = sessionMap.get(booking.sessionId);
        return session ? { booking, session, week: weekMap.get(booking.weekKey) } : null;
      })
      .filter(
        (
          item
        ): item is {
          booking: BookingRecord;
          session: TrainingSessionRecord;
          week: TrainingWeekRecord | undefined;
        } => Boolean(item)
      )
      .sort((a, b) => a.session.startMillis - b.session.startMillis);
  }, [bookings, client.id, sessionMap, weekMap]);

  const myPendingItems = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (b) =>
          b.clientId === client.id &&
          (b.status === 'PENDING' || b.status === 'ALTERED')
      )
      .map((booking) => {
        const session = sessionMap.get(booking.sessionId);
        if (!session) return null;
        if (session.startMillis > 0 && session.startMillis <= now) return null;
        return { booking, session, week: weekMap.get(booking.weekKey) };
      })
      .filter(
        (
          item
        ): item is {
          booking: BookingRecord;
          session: TrainingSessionRecord;
          week: TrainingWeekRecord | undefined;
        } => Boolean(item)
      )
      .sort((a, b) => a.session.startMillis - b.session.startMillis);
  }, [bookings, client.id, sessionMap, weekMap]);

  const nowMs = Date.now();
  const upcomingConfirmed = useMemo(
    () =>
      myConfirmedItems.filter(
        ({ session }) =>
          session.startMillis + Math.max(30, session.durationMinutes) * 60_000 >= nowMs
      ),
    [myConfirmedItems, nowMs]
  );
  const pastConfirmed = useMemo(
    () =>
      myConfirmedItems
        .filter(
          ({ session }) =>
            session.startMillis + Math.max(30, session.durationMinutes) * 60_000 < nowMs
        )
        .reverse(),
    [myConfirmedItems, nowMs]
  );

  // Selected draft sessions across the active week for quick pill summary
  const selectedWeekSummary = useMemo(() => {
    return weekSessions
      .filter((s) => draftSessionIds.has(s.id))
      .sort((a, b) => a.startMillis - b.startMillis);
  }, [weekSessions, draftSessionIds]);

  const hasUnsavedDraftChanges = useMemo(() => {
    const existingIds = new Set(clientWeekBookings.map((b) => b.sessionId));
    if (existingIds.size !== draftSessionIds.size) return true;
    for (const id of draftSessionIds) {
      if (!existingIds.has(id)) return true;
    }
    return false;
  }, [clientWeekBookings, draftSessionIds]);

  const cutoffMinutes = getEffectiveCutoffMinutes(settings);
  const cutoffMs = cutoffMinutes * 60_000;

  const getBookingEditState = (booking: BookingRecord, session: TrainingSessionRecord) => {
    const now = Date.now();
    const isStartedOrPast = session.startMillis > 0 && now >= session.startMillis;
    const isCutoffLocked =
      cutoffMs > 0 && session.startMillis > 0 && now > session.startMillis - cutoffMs;
    const isConfirmedLockedByPt = booking.status === 'CONFIRMED' && !settings.clientsCanEdit;
    const canModify = !isStartedOrPast && !isCutoffLocked && !isConfirmedLockedByPt;
    const lockReason = isStartedOrPast
      ? 'Este treino já começou ou terminou.'
      : isCutoffLocked
      ? `Prazo de alteração (${formatCutoffLabel(cutoffMinutes)} antes) encerrado.`
      : isConfirmedLockedByPt
      ? 'Alterações bloqueadas pelo PT.'
      : null;
    return { canModify, lockReason };
  };

  const getWeekActiveVisibleBookings = (weekKey: string) =>
    bookings.filter(
      (b) =>
        b.weekKey === weekKey &&
        b.clientId === client.id &&
        b.status !== 'CANCELLED' &&
        sessionMap.has(b.sessionId)
    );

  const handleCancelSingleBooking = async (target: {
    booking: BookingRecord;
    session: TrainingSessionRecord;
    week?: TrainingWeekRecord;
  }) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const weekKey = target.booking.weekKey;
      const weekLabel = target.week?.label || weekKey;
      const activeForWeek = getWeekActiveVisibleBookings(weekKey);
      const nextIds = new Set(
        activeForWeek
          .map((b) => b.sessionId)
          .filter((sid) => sid !== target.booking.sessionId)
      );

      await repo.submitStudentBookings(
        uid,
        weekKey,
        client.id,
        nextIds,
        activeForWeek,
        visibleSessionDayById
      );

      if (activeWeek?.weekKey === weekKey) {
        setDraftSessionIds(nextIds);
      }

      const cancelledDesc = `${target.session.dateLabel} às ${target.session.timeLabel.replace(':', 'h')}`;
      const summary = `${client.name} desmarcou o treino de ${cancelledDesc} (semana ${weekLabel}).`;
      await repo
        .createPtNotification(uid, {
          clientId: client.id,
          clientName: client.name,
          type: 'CANCELLED',
          summary,
          weekKey,
        })
        .catch(() => {});

      setCancelTarget(null);
      onWhatsAppAlert({
        title: 'Treino desmarcado — Avisa o PT no WhatsApp',
        subtitle:
          'O teu lugar foi libertado e o teu Personal Trainer já recebeu uma notificação na app. Envia também a mensagem pelo WhatsApp para confirmar.',
        message: `Olá! Sou ${client.name} (New Shape). Tive de desmarcar o meu treino de ${cancelledDesc} (semana ${weekLabel}). Já atualizei na app!`,
      });
      onBanner(`Treino de ${cancelledDesc} desmarcado!`);
    } catch {
      onBanner('Não foi possível desmarcar o treino. Tenta novamente.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSwapSingleBooking = async (
    target: {
      booking: BookingRecord;
      session: TrainingSessionRecord;
      week?: TrainingWeekRecord;
    },
    newSession: TrainingSessionRecord
  ) => {
    if (actionBusy) return;
    const weekKey = target.booking.weekKey;
    const activeForWeek = getWeekActiveVisibleBookings(weekKey);
    const otherBookedDays = new Set<number>();
    activeForWeek.forEach((b) => {
      if (b.sessionId === target.booking.sessionId) return;
      const sess = sessionMap.get(b.sessionId);
      if (sess) otherBookedDays.add(sess.dayOfWeek);
    });
    if (otherBookedDays.has(newSession.dayOfWeek)) {
      onBanner('Já tens um treino marcado nesse dia (máx. 1 treino por dia).');
      return;
    }

    setActionBusy(true);
    try {
      const weekLabel = target.week?.label || weekKey;
      const nextIds = new Set(
        activeForWeek
          .map((b) => b.sessionId)
          .filter((sid) => sid !== target.booking.sessionId)
      );
      nextIds.add(newSession.id);

      await repo.submitStudentBookings(
        uid,
        weekKey,
        client.id,
        nextIds,
        activeForWeek,
        visibleSessionDayById
      );

      if (activeWeek?.weekKey === weekKey) {
        setDraftSessionIds(nextIds);
      }

      const oldDesc = `${target.session.dateLabel} às ${target.session.timeLabel.replace(':', 'h')}`;
      const newDesc = `${newSession.dateLabel} às ${newSession.timeLabel.replace(':', 'h')}`;
      const summary = `${client.name} trocou o treino na semana ${weekLabel}: saiu de ${oldDesc} para ${newDesc}.`;
      await repo
        .createPtNotification(uid, {
          clientId: client.id,
          clientName: client.name,
          type: 'ALTERED',
          summary,
          weekKey,
        })
        .catch(() => {});

      setSwapTarget(null);
      onWhatsAppAlert({
        title: 'Horário trocado — Avisa o PT no WhatsApp',
        subtitle:
          'O pedido de troca foi enviado e o teu Personal Trainer já recebeu uma notificação na app. Envia também a mensagem pelo WhatsApp para confirmar.',
        message: `Olá! Sou ${client.name} (New Shape). Troquei o meu treino da semana ${weekLabel}:\n• Anterior: ${oldDesc}\n• Novo horário: ${newDesc}\nJá atualizei na app!`,
      });
      onBanner(`Treino trocado para ${newDesc}!`);
    } catch (err) {
      onBanner(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível trocar o horário. Tenta novamente.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const swapCandidateSessions = useMemo(() => {
    if (!swapTarget) return [];
    const weekKey = swapTarget.booking.weekKey;
    const activeWeekBookings = bookings.filter(
      (b) =>
        b.weekKey === weekKey &&
        b.clientId === client.id &&
        b.status !== 'CANCELLED' &&
        sessionMap.has(b.sessionId)
    );
    const activeWeekBookedIds = new Set(activeWeekBookings.map((b) => b.sessionId));
    // Days where the student already has ANOTHER workout (max 1 workout per day)
    const otherBookedDays = new Set<number>();
    activeWeekBookings.forEach((b) => {
      if (b.sessionId === swapTarget.session.id) return;
      const sess = sessionMap.get(b.sessionId);
      if (sess) otherBookedDays.add(sess.dayOfWeek);
    });
    const now = Date.now();
    return sessions
      .filter((s) => {
        if (s.ptPrivatePersonal) return false;
        if (s.weekKey !== weekKey) return false;
        if (s.id === swapTarget.session.id) return false;
        if (activeWeekBookedIds.has(s.id)) return false;
        if (otherBookedDays.has(s.dayOfWeek)) return false;
        if (s.startMillis > 0 && now >= s.startMillis) return false;
        if (cutoffMs > 0 && s.startMillis > 0 && now > s.startMillis - cutoffMs) return false;
        const confirmedCount = bookings.filter(
          (b) => b.sessionId === s.id && b.status === 'CONFIRMED'
        ).length;
        return confirmedCount < s.capacity;
      })
      .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel));
  }, [swapTarget, sessions, bookings, client.id, cutoffMs, sessionMap]);

  const swapCandidatesByDay = useMemo(() => {
    const map = new Map<number, TrainingSessionRecord[]>();
    swapCandidateSessions.forEach((s) => {
      const arr = map.get(s.dayOfWeek) || [];
      arr.push(s);
      map.set(s.dayOfWeek, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [swapCandidateSessions]);

  const totalManageableCount = upcomingConfirmed.length + myPendingItems.length;

  const selectedDayDate = activeWeek ? getWeekDayDate(activeWeek, selectedDay) : null;
  const selectedDayTitle = selectedDayDate
    ? `${DAYS_PT[selectedDay]}, ${selectedDayDate.getDate()} ${MONTHS_PT[selectedDayDate.getMonth()]}`
    : DAYS_PT[selectedDay] || 'Dia';

  return (
    <div className="space-y-4">
      {/* Sub-tab Switcher: Horários (Marcar) vs Marcações (Confirmados) */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
        <button
          type="button"
          onClick={() => setSubTab('marcar')}
          className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
            subTab === 'marcar'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Horários</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('marcacoes')}
          className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
            subTab === 'marcacoes'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <CalendarCheck2 className="h-4 w-4 shrink-0" />
          <span>Marcações</span>
          {totalManageableCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                subTab === 'marcacoes'
                  ? 'bg-[#121214] text-[#86EFAC]'
                  : 'bg-[#143521] text-[#86EFAC] border border-[#22C55E]/40'
              }`}
            >
              {totalManageableCount}
            </span>
          )}
        </button>
      </div>

      {/* ==================== SUB-TAB 1: HORÁRIOS (DIA A DIA / HORA A HORA) ==================== */}
      {subTab === 'marcar' && (
        <>
          {(client.fixedSlots?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-[#EAB308]/45 bg-[#3D3314]/55 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="gold">Horário Fixo</StatusPill>
                <span className="text-xs font-bold text-[#FACC15]">
                  {formatFixedSlotsSummary(client.fixedSlots)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[#E4E4E7]">
                Os teus dias fixos são marcados automaticamente todas as semanas e ficam a aguardar
                confirmação do teu PT. Podes sempre alterar ou cancelar se precisares.
              </p>
            </div>
          )}
          {publishedWeeks.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="Sem semanas publicadas"
              subtitle="O teu Personal Trainer ainda não publicou os horários da próxima semana."
            />
          ) : (
            <>
              {/* Week Selector */}
              <BrandCard>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={activeWeekIdx <= 0}
                    onClick={() => {
                      const prev = publishedWeeks[activeWeekIdx - 1];
                      if (prev) onSelectWeekKey(prev.weekKey);
                    }}
                    aria-label="Semana anterior"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#EAB308] hover:bg-[#242429] disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-[#EAB308]">
                      Escolhe o dia e a hora do treino
                    </p>
                    <h2 className="text-lg font-bold text-[#F4F4F5]">
                      Semana {activeWeek?.label}
                    </h2>
                    {weeklyLimit > 0 && (
                      <div className="mt-1.5 flex justify-center">
                        <StatusPill
                          tone={draftSessionIds.size >= weeklyLimit ? 'amber' : 'gold'}
                        >
                          Pacote: {draftSessionIds.size} / {weeklyLimit} treinos esta semana
                        </StatusPill>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={activeWeekIdx >= publishedWeeks.length - 1}
                    onClick={() => {
                      const next = publishedWeeks[activeWeekIdx + 1];
                      if (next) onSelectWeekKey(next.weekKey);
                    }}
                    aria-label="Semana seguinte"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#EAB308] hover:bg-[#242429] disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* 7-Day Selector Strip (Seg - Dom) */}
                {activeWeek && (
                  <div className="mt-4 pt-3.5 border-t border-[#323238]/80">
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                        const d = getWeekDayDate(activeWeek, dayNum);
                        const sessionsOnDay = weekSessions.filter((s) => s.dayOfWeek === dayNum);
                        const selectedOnDay = sessionsOnDay.filter((s) =>
                          draftSessionIds.has(s.id)
                        ).length;
                        const confirmedOnDay = sessionsOnDay.filter((s) =>
                          clientWeekBookings.some(
                            (b) => b.sessionId === s.id && b.status === 'CONFIRMED'
                          )
                        ).length;
                        const isSelectedDay = selectedDay === dayNum;
                        const hasSessions = sessionsOnDay.length > 0;
                        const dayWorkoutType = getWeekDayWorkoutType(activeWeek, dayNum);

                        return (
                          <button
                            key={dayNum}
                            type="button"
                            title={dayWorkoutType ? `Treino do dia: ${dayWorkoutType}` : undefined}
                            onClick={() => setSelectedDay(dayNum)}
                            className={`relative flex flex-col items-center justify-center rounded-xl border py-2 px-1 transition min-h-[68px] ${
                              isSelectedDay
                                ? 'border-[#EAB308] bg-[#EAB308] text-[#121214] shadow-md'
                                : confirmedOnDay > 0
                                ? 'border-[#22C55E]/60 bg-[#143521]/50 text-[#F4F4F5] hover:border-[#22C55E]'
                                : selectedOnDay > 0
                                ? 'border-[#EAB308]/60 bg-[#3D3314]/60 text-[#FACC15] hover:border-[#EAB308]'
                                : hasSessions
                                ? 'border-[#323238] bg-[#242429] text-[#F4F4F5] hover:border-[#EAB308]/50'
                                : 'border-[#26262B] bg-[#18181B] text-[#71717A] opacity-60 hover:opacity-90'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide ${
                                isSelectedDay ? 'text-[#121214]/80' : 'text-[#A1A1AA]'
                              }`}
                            >
                              {DAY_SHORT_PT[dayNum]}
                            </span>
                            <span className="mt-0.5 text-base font-extrabold leading-none">
                              {d.getDate()}
                            </span>
                            <div className="mt-1.5 flex items-center gap-0.5 h-3">
                              {confirmedOnDay > 0 ? (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isSelectedDay ? 'bg-[#121214]' : 'bg-[#22C55E]'
                                  }`}
                                  title="Treino confirmado"
                                />
                              ) : selectedOnDay > 0 ? (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isSelectedDay ? 'bg-[#121214]' : 'bg-[#EAB308]'
                                  }`}
                                  title="Horário selecionado"
                                />
                              ) : hasSessions ? (
                                <span
                                  className={`text-[9px] font-bold ${
                                    isSelectedDay ? 'text-[#121214]/80' : 'text-[#A1A1AA]'
                                  }`}
                                >
                                  {sessionsOnDay.length}h
                                </span>
                              ) : (
                                <span className="text-[9px]">—</span>
                              )}
                            </div>
                            {dayWorkoutType && (
                              <span
                                className={`mt-1 max-w-full truncate px-0.5 text-[9px] font-bold leading-tight ${
                                  isSelectedDay ? 'text-[#121214]' : 'text-[#FACC15]'
                                }`}
                              >
                                {dayWorkoutType}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </BrandCard>

              {/* Status banners */}
              {weekResponse?.status === 'UNAVAILABLE' && (
                <div className="rounded-2xl border border-[#F59E0B]/50 bg-[#3B2A10] p-3.5 text-xs sm:text-sm text-[#FDE68A]">
                  Marcaste que <strong>não podes treinar</strong> esta semana. Se mudares de
                  ideia, escolhe os horários abaixo.
                </div>
              )}

              {clientWeekBookings.length > 0 && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3.5 text-xs sm:text-sm ${
                    clientWeekBookings.some(
                      (b) => b.status === 'PENDING' || b.status === 'ALTERED'
                    )
                      ? 'border-[#EAB308] bg-[#3D3314] text-[#FACC15]'
                      : 'border-[#22C55E]/50 bg-[#143521] text-[#86EFAC]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {clientWeekBookings.some(
                        (b) => b.status === 'PENDING' || b.status === 'ALTERED'
                      )
                        ? 'Pedido enviado! 🙌 O teu PT vai confirmar no WhatsApp em breve.'
                        : 'Treinos confirmados ✓'}
                    </p>
                    <p className="text-[11px] opacity-85">
                      Podes trocar de horário ou desmarcar diretamente em cada treino ou em Marcações.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('marcacoes')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                      clientWeekBookings.some(
                        (b) => b.status === 'PENDING' || b.status === 'ALTERED'
                      )
                        ? 'border-[#EAB308]/60 bg-[#2A230D] text-[#FACC15] hover:bg-[#3B3113]'
                        : 'border-[#22C55E]/60 bg-[#0F291A] text-[#86EFAC] hover:bg-[#163B25]'
                    }`}
                  >
                    Gerir Marcações →
                  </button>
                </div>
              )}

              {/* Day Navigator Header + Hour-by-Hour Slots */}
              {activeWeek && (
                <BrandCard highlight>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#323238]">
                    <button
                      type="button"
                      disabled={selectedDay <= 1}
                      onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
                      aria-label="Dia anterior"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#323238] bg-[#242429] text-[#EAB308] hover:border-[#EAB308] disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-center">
                      <p className="text-sm sm:text-base font-extrabold text-[#F4F4F5]">
                        {selectedDayTitle}
                      </p>
                      {(() => {
                        const selectedDayWorkoutType = getWeekDayWorkoutType(activeWeek, selectedDay);
                        return selectedDayWorkoutType ? (
                          <div className="mt-1 flex justify-center">
                            <StatusPill tone="gold">
                              Treino do dia: {selectedDayWorkoutType}
                            </StatusPill>
                          </div>
                        ) : null;
                      })()}
                      <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                        {daySessions.length === 0
                          ? 'Sem horários publicados neste dia'
                          : `${daySessions.length} horário${daySessions.length > 1 ? 's' : ''} disponível${daySessions.length > 1 ? 's' : ''} · Máx. 1 treino/dia`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={selectedDay >= 7}
                      onClick={() => setSelectedDay((d) => Math.min(7, d + 1))}
                      aria-label="Dia seguinte"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#323238] bg-[#242429] text-[#EAB308] hover:border-[#EAB308] disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {daySessions.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <Clock className="mx-auto h-7 w-7 text-[#71717A]" />
                      <p className="text-sm font-bold text-[#F4F4F5]">
                        Sem treinos em {DAYS_PT[selectedDay]}
                      </p>
                      <p className="text-xs text-[#A1A1AA]">
                        Toca noutro dia da barra acima para veres os horários disponíveis.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {daySessions.map((s) => {
                        const confirmedCount = bookings.filter(
                          (b) => b.sessionId === s.id && b.status === 'CONFIRMED'
                        ).length;
                        const isFull = confirmedCount >= s.capacity;
                        const isMine = draftSessionIds.has(s.id);
                        const existingForSession = clientWeekBookings.find(
                          (b) => b.sessionId === s.id
                        );
                        const alreadyBooked = Boolean(existingForSession);
                        const otherBookedOnDay = daySessions.find(
                          (other) =>
                            other.id !== s.id &&
                            draftSessionIds.has(other.id) &&
                            clientWeekBookings.some((b) => b.sessionId === other.id)
                        );
                        const otherDraftOnDay = daySessions.find(
                          (other) => other.id !== s.id && draftSessionIds.has(other.id)
                        );
                        const cutoffMinutes = getEffectiveCutoffMinutes(settings);
                        const cutoffMs = cutoffMinutes * 60_000;
                        const isPastSession =
                          s.startMillis > 0 && Date.now() >= s.startMillis;
                        const isCutoffLocked =
                          isPastSession ||
                          (cutoffMs > 0 &&
                            s.startMillis > 0 &&
                            Date.now() > s.startMillis - cutoffMs);
                        const editLocked = !settings.clientsCanEdit || isCutoffLocked;
                        const fullAndNotMine = isFull && !alreadyBooked;
                        const hasAnyActiveBookingOnDay = daySessions.some(
                          (other) =>
                            other.id !== s.id &&
                            clientWeekBookings.some((b) => b.sessionId === other.id)
                        );
                        const sessionWaitlist = waitlistEntries
                          .filter((w) => w.sessionId === s.id)
                          .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
                        const myWaitlistIdx = sessionWaitlist.findIndex(
                          (w) => w.clientId === client.id
                        );
                        const myWaitlistEntry =
                          myWaitlistIdx >= 0 ? sessionWaitlist[myWaitlistIdx] : null;
                        const endTime = computeEndTimeLabel(s.timeLabel, s.durationMinutes);

                        const pillTone = existingForSession
                          ? existingForSession.status === 'CONFIRMED'
                            ? 'green'
                            : isPastSession
                            ? 'neutral'
                            : 'amber'
                          : myWaitlistEntry
                          ? 'amber'
                          : isPastSession
                          ? 'neutral'
                          : isFull
                          ? 'red'
                          : isMine
                          ? 'gold'
                          : 'green';

                        const pillLabel = existingForSession
                          ? existingForSession.status === 'CONFIRMED'
                            ? 'Confirmado'
                            : isPastSession
                            ? 'Expirado'
                            : 'Por confirmar'
                          : myWaitlistEntry
                          ? `Espera #${myWaitlistIdx + 1}`
                          : isPastSession
                          ? 'Já passou'
                          : isFull
                          ? 'Esgotado'
                          : isMine
                          ? 'Selecionado'
                          : 'Disponível';

                        return (
                          <div
                            key={s.id}
                            className={`rounded-2xl border transition ${
                              existingForSession?.status === 'CONFIRMED' && isMine
                                ? 'border-[#22C55E] bg-[#143521]/45'
                                : isMine
                                ? 'border-[#EAB308] bg-[#3D3314]/70'
                                : myWaitlistEntry
                                ? 'border-[#F59E0B]/60 bg-[#3B2A10]/40'
                                : otherBookedOnDay
                                ? 'border-[#2A2A30] bg-[#1D1D21]/65 opacity-80'
                                : 'border-[#323238] bg-[#242429]/70 hover:border-[#EAB308]/50'
                            }`}
                          >
                            <button
                              type="button"
                              disabled={editLocked || fullAndNotMine}
                              onClick={() => {
                                if (isMine) {
                                  setDraftSessionIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(s.id);
                                    return next;
                                  });
                                  return;
                                }
                                // Enforce max 1 training per day
                                if (otherBookedOnDay) {
                                  onBanner(
                                    `Só podes marcar 1 treino por dia. Já tens treino às ${otherBookedOnDay.timeLabel} — usa "Trocar horário" para mudar a hora.`
                                  );
                                  return;
                                }
                                if (otherDraftOnDay) {
                                  setDraftSessionIds((prev) => {
                                    const next = new Set(prev);
                                    daySessions.forEach((ds) => next.delete(ds.id));
                                    next.add(s.id);
                                    return next;
                                  });
                                  onBanner(
                                    `Horário deste dia atualizado para ${s.timeLabel} (máx. 1 treino por dia).`
                                  );
                                  return;
                                }
                                if (weeklyLimit > 0 && draftSessionIds.size >= weeklyLimit) {
                                  onBanner(
                                    `Atingiste o limite semanal do teu pacote (${weeklyLimit} treino(s)/semana). Retira um horário ou fala com o teu PT.`
                                  );
                                  return;
                                }
                                setDraftSessionIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(s.id);
                                  return next;
                                });
                              }}
                              className="w-full p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-65"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Time Pill Block */}
                                  <div
                                    className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[74px] border ${
                                      isMine
                                        ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                                        : 'border-[#323238] bg-[#18181B] text-[#FACC15]'
                                    }`}
                                  >
                                    <span className="text-base font-extrabold leading-tight">
                                      {s.timeLabel}
                                    </span>
                                    {endTime && (
                                      <span
                                        className={`text-[10px] font-semibold ${
                                          isMine ? 'text-[#121214]/75' : 'text-[#A1A1AA]'
                                        }`}
                                      >
                                        até {endTime}
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-[#F4F4F5] truncate">
                                      Treino · {s.durationMinutes} min
                                    </p>
                                    {s.note ? (
                                      <p className="mt-0.5 text-xs text-[#A1A1AA] truncate">
                                        {s.note}
                                      </p>
                                    ) : (
                                      <p
                                        className={`mt-0.5 text-xs ${
                                          !isMine && otherBookedOnDay
                                            ? 'text-[#F59E0B]'
                                            : 'text-[#A1A1AA]'
                                        }`}
                                      >
                                        {isMine
                                          ? 'Toca para desmarcar este horário'
                                          : isFull
                                          ? 'Horário completo'
                                          : otherBookedOnDay
                                          ? `Já tens treino neste dia às ${otherBookedOnDay.timeLabel} (máx. 1/dia)`
                                          : otherDraftOnDay
                                          ? 'Toca para mudar para este horário (máx. 1/dia)'
                                          : 'Toca para selecionar este horário'}
                                      </p>
                                    )}
                                    {s.note && !isMine && otherBookedOnDay && (
                                      <p className="mt-0.5 text-[11px] text-[#F59E0B]">
                                        Já tens treino neste dia às {otherBookedOnDay.timeLabel} (máx. 1/dia)
                                      </p>
                                    )}
                                    {isCutoffLocked && (
                                      <p className="mt-1 text-[11px] text-[#F59E0B]">
                                        Prazo de alteração ({formatCutoffLabel(cutoffMinutes)} antes) encerrado
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <StatusPill tone={pillTone}>{pillLabel}</StatusPill>
                                  <span
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                      isMine
                                        ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                                        : 'border-[#52525B] text-transparent'
                                    }`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              </div>
                            </button>

                            {existingForSession && (() => {
                              const editState = getBookingEditState(existingForSession, s);
                              return (
                                <div className="mx-3.5 mb-3 border-t border-[#323238]/70 pt-2.5 flex flex-wrap items-center justify-between gap-2">
                                  {editState.canModify ? (
                                    <>
                                      <span className="text-[11px] text-[#A1A1AA]">
                                        Precisas de mudar este treino?
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSwapTarget({
                                              booking: existingForSession,
                                              session: s,
                                              week: activeWeek,
                                            })
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB308]/60 bg-[#3D3314] px-3 py-1.5 text-xs font-bold text-[#FACC15] transition hover:bg-[#4D4019]"
                                        >
                                          <ArrowLeftRight className="h-3.5 w-3.5" />
                                          Trocar horário
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCancelTarget({
                                              booking: existingForSession,
                                              session: s,
                                              week: activeWeek,
                                            })
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#EF4444]/60 bg-[#3B1518] px-3 py-1.5 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#4B1A1E]"
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                          Desmarcar
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-[11px] text-[#F59E0B]">
                                      {editState.lockReason}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {fullAndNotMine && !editLocked && (
                              <div className="mx-3.5 mb-3 border-t border-[#323238]/70 pt-2.5 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#A1A1AA]">
                                  {myWaitlistEntry
                                    ? `Estás em #${myWaitlistIdx + 1} na lista de espera`
                                    : sessionWaitlist.length > 0
                                    ? `${sessionWaitlist.length} em lista de espera`
                                    : 'Turma completa'}
                                </span>
                                {myWaitlistEntry ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await repo.leaveWaitlist(uid, myWaitlistEntry.id);
                                      onBanner('Saíste da lista de espera.');
                                    }}
                                    className="rounded-lg border border-[#EF4444]/60 bg-[#3B1518] px-2.5 py-1 text-xs font-bold text-[#FCA5A5] hover:bg-[#4B1A1E]"
                                  >
                                    Sair da espera
                                  </button>
                                ) : hasAnyActiveBookingOnDay ? (
                                  <span className="text-[11px] font-semibold text-[#F59E0B]">
                                    Já tens treino neste dia (máx. 1/dia)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (hasAnyActiveBookingOnDay) {
                                        onBanner(
                                          'Já tens um treino marcado neste dia (máx. 1 treino por dia).'
                                        );
                                        return;
                                      }
                                      await repo.joinWaitlist(
                                        uid,
                                        s.id,
                                        activeWeek.weekKey,
                                        client.id
                                      );
                                      onBanner(
                                        'Entraste na lista de espera! O PT será avisado se abrir vaga.'
                                      );
                                    }}
                                    className="rounded-lg border border-[#EAB308]/60 bg-[#3D3314] px-2.5 py-1 text-xs font-bold text-[#FACC15] hover:bg-[#4D4019]"
                                  >
                                    Entrar na lista de espera
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </BrandCard>
              )}

              {/* Selected Summary Chips across the whole week */}
              {activeWeek && selectedWeekSummary.length > 0 && (
                <div className="rounded-2xl border border-[#323238] bg-[#1B1B1E] p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#FACC15]">
                      Selecionados nesta semana ({selectedWeekSummary.length}):
                    </p>
                    {hasUnsavedDraftChanges && (
                      <span className="rounded-full border border-[#F59E0B]/50 bg-[#3B2A10] px-2 py-0.5 text-[10px] font-bold text-[#FDE68A]">
                        Toca em &ldquo;Guardar alterações&rdquo; abaixo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWeekSummary.map((s) => {
                      const lockedByCutoff =
                        cutoffMs > 0 &&
                        s.startMillis > 0 &&
                        Date.now() > s.startMillis - cutoffMs;
                      const canRemoveChip = settings.clientsCanEdit && !lockedByCutoff;
                      return (
                        <div
                          key={s.id}
                          className="inline-flex items-center rounded-xl border border-[#EAB308]/50 bg-[#3D3314]/60 text-xs font-bold text-[#FACC15]"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDay(s.dayOfWeek)}
                            className="px-2.5 py-1 hover:text-white"
                          >
                            {DAY_SHORT_PT[s.dayOfWeek]} · {s.timeLabel}
                          </button>
                          {canRemoveChip && (
                            <button
                              type="button"
                              aria-label={`Remover ${DAY_SHORT_PT[s.dayOfWeek]} ${s.timeLabel}`}
                              onClick={() =>
                                setDraftSessionIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(s.id);
                                  return next;
                                })
                              }
                              className="border-l border-[#EAB308]/35 px-1.5 py-1 text-[#FCA5A5] hover:bg-[#3B1518] rounded-r-xl"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit / Unavailable Actions */}
              {activeWeek && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <GoldButton
                    fullWidth
                    disabled={!settings.clientsCanEdit || actionBusy}
                    onClick={async () => {
                      if (actionBusy) return;
                      if (weeklyLimit > 0 && draftSessionIds.size > weeklyLimit) {
                        onBanner(
                          `O teu pacote permite até ${weeklyLimit} treino(s) por semana.`
                        );
                        return;
                      }
                      // Validate max 1 training per day across draft selections
                      const seenDays = new Set<number>();
                      for (const sid of draftSessionIds) {
                        const day = visibleSessionDayById.get(sid);
                        if (day !== undefined) {
                          if (seenDays.has(day)) {
                            onBanner(
                              'Só podes marcar 1 treino por dia. Remove o horário duplicado antes de guardar.'
                            );
                            return;
                          }
                          seenDays.add(day);
                        }
                      }

                      const prevIds = new Set(clientWeekBookings.map((b) => b.sessionId));
                      const removedIds = Array.from(prevIds).filter(
                        (id) => !draftSessionIds.has(id)
                      );
                      const addedIds = Array.from(draftSessionIds).filter(
                        (id) => !prevIds.has(id)
                      );
                      const hadExisting = clientWeekBookings.length > 0;
                      const hasScheduleChange =
                        hadExisting && (removedIds.length > 0 || addedIds.length > 0);
                      const isFullCancel = hadExisting && draftSessionIds.size === 0;

                      setActionBusy(true);
                      try {
                        await repo.submitStudentBookings(
                          uid,
                          activeWeek.weekKey,
                          client.id,
                          draftSessionIds,
                          clientWeekBookings,
                          visibleSessionDayById
                        );

                        const isPartialCancelOnly =
                          !isFullCancel && removedIds.length > 0 && addedIds.length === 0;

                        if (isFullCancel || hasScheduleChange) {
                          const fmtSessions = (ids: string[]) =>
                            ids
                              .map((id) => sessionMap.get(id))
                              .filter((s): s is TrainingSessionRecord => Boolean(s))
                              .map((s) => `${s.dateLabel} às ${s.timeLabel}`)
                              .join(', ');

                          const removedTxt = fmtSessions(removedIds);
                          const nextTxt = fmtSessions(Array.from(draftSessionIds));

                          const notifType =
                            isFullCancel || isPartialCancelOnly ? 'CANCELLED' : 'ALTERED';
                          const summary = isFullCancel
                            ? `${client.name} cancelou o(s) treino(s) da semana ${activeWeek.label}${
                                removedTxt ? ` (${removedTxt})` : ''
                              }.`
                            : isPartialCancelOnly
                              ? `${client.name} desmarcou o treino de ${removedTxt} (semana ${activeWeek.label}). Os restantes treinos mantêm-se confirmados.`
                              : `${client.name} alterou o horário na semana ${activeWeek.label}.${
                                  removedTxt ? ` Retirou: ${removedTxt}.` : ''
                                }${nextTxt ? ` Novo horário: ${nextTxt}.` : ''}`;

                          await repo
                            .createPtNotification(uid, {
                              clientId: client.id,
                              clientName: client.name,
                              type: notifType,
                              summary,
                              weekKey: activeWeek.weekKey,
                            })
                            .catch(() => {});

                          const waMsg = isFullCancel
                            ? `Olá! Sou ${client.name} (New Shape). Tive de cancelar o meu treino da semana ${activeWeek.label}${
                                removedTxt ? ` (${removedTxt})` : ''
                              }. Já atualizei na app!`
                            : isPartialCancelOnly
                              ? `Olá! Sou ${client.name} (New Shape). Tive de desmarcar o meu treino de ${removedTxt} (semana ${activeWeek.label}). Os restantes treinos mantêm-se marcados na app!`
                              : `Olá! Sou ${client.name} (New Shape). Modifiquei o meu horário de treino da semana ${activeWeek.label}.${
                                  removedTxt ? `\n• Retirado: ${removedTxt}` : ''
                                }${nextTxt ? `\n• Novo horário: ${nextTxt}` : ''}\nJá atualizei na app!`;

                          onWhatsAppAlert({
                            title:
                              isFullCancel || isPartialCancelOnly
                                ? 'Treino desmarcado — Avisa o PT no WhatsApp'
                                : 'Horário modificado — Avisa o PT no WhatsApp',
                            subtitle: isPartialCancelOnly
                              ? 'O teu lugar foi libertado e os restantes treinos confirmados mantêm-se ativos. Envia também a mensagem pelo WhatsApp para avisar o PT.'
                              : 'O teu Personal Trainer já recebeu uma notificação na app. Envia também a mensagem pelo WhatsApp para confirmar.',
                            message: waMsg,
                          });
                        }

                        onBanner(
                          isFullCancel
                            ? 'Treino cancelado e PT notificado!'
                            : isPartialCancelOnly
                              ? 'Treino desmarcado! Os restantes treinos mantêm-se confirmados.'
                            : hasScheduleChange
                            ? 'Alteração de horário enviada e PT notificado!'
                            : 'Marcação enviada ao Personal Trainer!'
                        );
                      } catch (err) {
                        onBanner(
                          err instanceof Error && err.message
                            ? err.message
                            : 'Não foi possível guardar a marcação. Tenta novamente.'
                        );
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {actionBusy
                      ? 'A guardar...'
                      : clientWeekBookings.length > 0
                      ? `Guardar alterações (${draftSessionIds.size})`
                      : `Marcar treinos (${draftSessionIds.size})`}
                  </GoldButton>

                  <SecondaryButton
                    fullWidth
                    disabled={!settings.clientsCanEdit || actionBusy}
                    onClick={async () => {
                      if (actionBusy) return;
                      setActionBusy(true);
                      try {
                        const hadExisting = clientWeekBookings.length > 0;
                        const prevSessionsTxt = clientWeekBookings
                          .map((b) => sessionMap.get(b.sessionId))
                          .filter((s): s is TrainingSessionRecord => Boolean(s))
                          .map((s) => `${s.dateLabel} às ${s.timeLabel}`)
                          .join(', ');

                        await repo.markStudentUnavailable(
                          uid,
                          activeWeek.weekKey,
                          client.id,
                          clientWeekBookings
                        );
                        setDraftSessionIds(new Set());

                        if (hadExisting) {
                          const summary = `${client.name} cancelou os treinos e marcou indisponibilidade na semana ${activeWeek.label}${
                            prevSessionsTxt ? ` (${prevSessionsTxt})` : ''
                          }.`;
                          await repo
                            .createPtNotification(uid, {
                              clientId: client.id,
                              clientName: client.name,
                              type: 'UNAVAILABLE',
                              summary,
                              weekKey: activeWeek.weekKey,
                            })
                            .catch(() => {});

                          onWhatsAppAlert({
                            title: 'Treinos cancelados — Avisa o PT no WhatsApp',
                            subtitle:
                              'O teu PT foi notificado na app de que não podes treinar esta semana. Envia-lhe a mensagem pelo WhatsApp.',
                            message: `Olá! Sou ${client.name} (New Shape). Esta semana (${activeWeek.label}) não vou conseguir treinar e cancelei a minha marcação${
                              prevSessionsTxt ? ` (${prevSessionsTxt})` : ''
                            } na app.`,
                          });
                        }

                        onBanner('Registado: indisponível esta semana.');
                      } catch {
                        onBanner('Não foi possível registar. Tenta novamente.');
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    Esta semana não posso
                  </SecondaryButton>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ==================== SUB-TAB 2: MARCAÇÕES (TREINOS CONFIRMADOS PELO PT) ==================== */}
      {subTab === 'marcacoes' && (
        <div className="space-y-4">
          {/* Header summary */}
          <BrandCard highlight>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#EAB308]">
                  As tuas marcações confirmadas
                </p>
                <h2 className="text-lg font-bold text-[#F4F4F5]">
                  Próximos Treinos Confirmados
                </h2>
                <p className="mt-0.5 text-xs text-[#A1A1AA]">
                  Consulta rapidamente o dia e a hora de cada treino confirmado pelo teu PT.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={upcomingConfirmed.length > 0 ? 'green' : 'neutral'}>
                  {upcomingConfirmed.length} confirmado{upcomingConfirmed.length === 1 ? '' : 's'}
                </StatusPill>
                {myPendingItems.length > 0 && (
                  <StatusPill tone="amber">{myPendingItems.length} pendente{myPendingItems.length === 1 ? '' : 's'}</StatusPill>
                )}
              </div>
            </div>
          </BrandCard>

          {/* Upcoming Confirmed Workouts */}
          {upcomingConfirmed.length === 0 ? (
            <BrandCard>
              <div className="py-6 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#242429] text-[#EAB308]">
                  <CalendarCheck2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F4F4F5]">
                    Ainda não tens treinos confirmados
                  </h3>
                  <p className="mt-1 text-xs text-[#A1A1AA]">
                    {myPendingItems.length > 0
                      ? 'Tens pedidos enviados a aguardar confirmação do teu Personal Trainer. Assim que forem aceites aparecem aqui.'
                      : 'Escolhe os teus dias e horários na aba Horários para enviares o pedido ao teu PT.'}
                  </p>
                </div>
                <div className="pt-1 flex justify-center">
                  <GoldButton onClick={() => setSubTab('marcar')}>
                    <Calendar className="h-4 w-4" />
                    Escolher horários
                  </GoldButton>
                </div>
              </div>
            </BrandCard>
          ) : (
            <div className="space-y-2.5">
              {upcomingConfirmed.map(({ booking, session, week }, idx) => {
                const relTag = getRelativeDayTag(session.startMillis);
                const endTime = computeEndTimeLabel(session.timeLabel, session.durationMinutes);
                const isNextUp = idx === 0;

                return (
                  <div
                    key={booking.id}
                    className={`rounded-2xl border p-4 transition ${
                      isNextUp
                        ? 'border-[#22C55E] bg-gradient-to-r from-[#143521]/80 to-[#1B1B1E]'
                        : 'border-[#22C55E]/40 bg-[#1B1B1E]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex flex-col items-center justify-center rounded-xl border border-[#22C55E]/60 bg-[#143521] px-3 py-2 min-w-[78px] text-center">
                          <span className="text-base font-extrabold text-[#86EFAC] leading-tight">
                            {session.timeLabel}
                          </span>
                          {endTime && (
                            <span className="text-[10px] font-semibold text-[#86EFAC]/75">
                              {endTime}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isNextUp && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#EAB308] px-2 py-0.5 text-[10px] font-extrabold text-[#121214]">
                                <Sparkles className="h-2.5 w-2.5" />
                                Próximo treino
                              </span>
                            )}
                            {relTag && (
                              <span className="rounded-full border border-[#EAB308]/50 bg-[#3D3314] px-2 py-0.5 text-[10px] font-bold text-[#FACC15]">
                                {relTag}
                              </span>
                            )}
                            {week && (
                              <span className="text-[11px] text-[#A1A1AA]">
                                Semana {week.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-base font-extrabold text-[#F4F4F5]">
                            {session.dateLabel}
                          </p>
                          <p className="text-xs text-[#A1A1AA]">
                            {session.timeLabel.replace(':', 'h')}
                            {endTime ? ` – ${endTime.replace(':', 'h')}` : ''} ·{' '}
                            {session.durationMinutes} min
                            {session.note ? ` · ${session.note}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusPill tone="green">Confirmado ✓</StatusPill>
                        {booking.attendanceStatus === 'PRESENT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#86EFAC]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Presença registada
                          </span>
                        )}
                        {booking.attendanceStatus === 'ABSENT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FCA5A5]">
                            <XCircle className="h-3.5 w-3.5" />
                            Falta registada
                          </span>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const editState = getBookingEditState(booking, session);
                      return (
                        <div className="mt-3 pt-3 border-t border-[#22C55E]/25 flex flex-wrap items-center justify-between gap-2">
                          {editState.canModify ? (
                            <div className="grid w-full grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSwapTarget({ booking, session, week })}
                                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#EAB308]/60 bg-[#3D3314]/80 px-3 py-2 text-xs font-bold text-[#FACC15] transition hover:bg-[#4D4019]"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                Trocar horário
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelTarget({ booking, session, week })}
                                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#EF4444]/60 bg-[#3B1518]/90 px-3 py-2 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#4B1A1E]"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Desmarcar treino
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#F59E0B]">
                              {editState.lockReason}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Requests awaiting PT confirmation */}
          {myPendingItems.length > 0 && (
            <BrandCard>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-bold text-[#FACC15]">
                    A aguardar confirmação do PT ({myPendingItems.length})
                  </p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Podes trocar o horário ou desmarcar enquanto aguardas confirmação.
                  </p>
                </div>
                <StatusPill tone="amber">Pendente</StatusPill>
              </div>
              <div className="space-y-2.5">
                {myPendingItems.map(({ booking, session, week }) => {
                  const editState = getBookingEditState(booking, session);
                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-[#EAB308]/35 bg-[#3D3314]/35 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#F4F4F5]">{session.dateLabel}</p>
                          <p className="text-xs text-[#FACC15]">
                            {session.timeLabel.replace(':', 'h')} · {session.durationMinutes} min
                            {week ? ` · Sem. ${week.label}` : ''}
                            {session.note ? ` · ${session.note}` : ''}
                          </p>
                        </div>
                        <StatusPill tone="amber">Por confirmar</StatusPill>
                      </div>
                      {editState.canModify ? (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EAB308]/20">
                          <button
                            type="button"
                            onClick={() => setSwapTarget({ booking, session, week })}
                            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#EAB308]/60 bg-[#2A230D] px-3 py-1.5 text-xs font-bold text-[#FACC15] transition hover:bg-[#3B3113]"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Trocar horário
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget({ booking, session, week })}
                            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#EF4444]/60 bg-[#3B1518] px-3 py-1.5 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#4B1A1E]"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Desmarcar
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#F59E0B]">{editState.lockReason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </BrandCard>
          )}

          {/* Training Reminder Push Notification Card */}
          <BrandCard>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#EAB308]" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#F4F4F5]">
                    Lembretes de Treino (Notificações Push)
                  </p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Recebe um aviso antes de cada treino confirmado.
                  </p>
                </div>
              </div>
              {notifPerm === 'granted' && reminderEnabled ? (
                <StatusPill tone="green">
                  Ativo · {formatLeadMinutesLabel(reminderLeadMins)} antes
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">Desativado</StatusPill>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {notifPerm !== 'granted' ? (
                <GoldButton
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    setNotifPerm(res);
                    if (res === 'granted') {
                      setReminderEnabled(true);
                      saveReminderPreferences(
                        true,
                        hasCustomLead ? reminderLeadMins : null
                      );
                      onBanner('Lembretes de treino ativados!');
                    } else {
                      onBanner('Autoriza as notificações nas definições do browser.');
                    }
                  }}
                >
                  <Bell className="h-4 w-4" />
                  {notifPerm === 'unsupported'
                    ? 'Indisponível neste browser'
                    : 'Ativar lembretes push'}
                </GoldButton>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !reminderEnabled;
                      setReminderEnabled(next);
                      saveReminderPreferences(
                        next,
                        hasCustomLead ? reminderLeadMins : null
                      );
                      onBanner(
                        next
                          ? 'Lembretes de treino ativados!'
                          : 'Lembretes de treino desativados.'
                      );
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      reminderEnabled
                        ? 'border-[#22C55E] bg-[#143521] text-[#86EFAC]'
                        : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                    }`}
                  >
                    {reminderEnabled ? 'Lembretes ligados ✓' : 'Ligar lembretes'}
                  </button>

                  {Array.from(new Set([studioDefaultLeadMins, 15, 30, 60, 120]))
                    .sort((a, b) => a - b)
                    .map((mins) => {
                      const isStudioDefault = mins === studioDefaultLeadMins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setReminderLeadMins(mins);
                            setReminderEnabled(true);
                            if (isStudioDefault) {
                              setHasCustomLead(false);
                              saveReminderPreferences(true, null);
                            } else {
                              setHasCustomLead(true);
                              saveReminderPreferences(true, mins);
                            }
                            onBanner(
                              `Lembrete definido para ${formatLeadMinutesLabel(mins)} antes do treino.`
                            );
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                            reminderLeadMins === mins && reminderEnabled
                              ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                              : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {formatLeadMinutesLabel(mins)}
                          {isStudioDefault ? ' (PT)' : ''}
                        </button>
                      );
                    })}

                  <button
                    type="button"
                    onClick={async () => {
                      await dispatchLocalPushNotification(
                        'Lembrete de Treino · New Shape',
                        `Olá ${firstName}! Os teus lembretes push estão ativos (${formatLeadMinutesLabel(reminderLeadMins)} antes do treino) 💪`
                      );
                      onBanner('Notificação de teste enviada!');
                    }}
                    className="rounded-lg border border-[#323238] bg-[#242429] px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:border-[#EAB308]"
                  >
                    Testar
                  </button>
                </>
              )}
            </div>
          </BrandCard>

          {/* Past Confirmed Workouts (Collapsible History) */}
          {pastConfirmed.length > 0 && (
            <BrandCard>
              <button
                type="button"
                onClick={() => setShowPastConfirmed((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-xs font-bold text-[#A1A1AA]">
                  Treinos confirmados anteriores ({pastConfirmed.length})
                </span>
                <span className="text-xs font-semibold text-[#EAB308]">
                  {showPastConfirmed ? 'Ocultar' : 'Ver histórico'}
                </span>
              </button>
              {showPastConfirmed && (
                <div className="mt-3 space-y-2 border-t border-[#323238] pt-3">
                  {pastConfirmed.map(({ booking, session }) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#323238] bg-[#242429]/60 px-3.5 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#F4F4F5]">{session.dateLabel}</p>
                        <p className="text-xs text-[#A1A1AA]">
                          {session.timeLabel.replace(':', 'h')} · {session.durationMinutes} min
                        </p>
                      </div>
                      {booking.attendanceStatus === 'PRESENT' ? (
                        <StatusPill tone="green">Realizado ✓</StatusPill>
                      ) : booking.attendanceStatus === 'ABSENT' ? (
                        <StatusPill tone="red">Faltou</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Concluído</StatusPill>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </BrandCard>
          )}
        </div>
      )}

      {/* ==================== MODAL: DESMARCAR TREINO ==================== */}
      <Modal
        open={Boolean(cancelTarget)}
        title="Desmarcar treino?"
        subtitle={
          cancelTarget
            ? `${cancelTarget.session.dateLabel} · ${cancelTarget.session.timeLabel.replace(':', 'h')} (${cancelTarget.session.durationMinutes} min)`
            : undefined
        }
        onClose={() => {
          if (!actionBusy) setCancelTarget(null);
        }}
      >
        {cancelTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#EF4444]/40 bg-[#3B1518]/60 p-3.5 text-xs text-[#FCA5A5] space-y-1">
              <p className="font-bold text-[#F4F4F5]">
                Queres mesmo desmarcar este treino?
              </p>
              <p className="leading-relaxed">
                O teu lugar neste horário será libertado e o teu Personal Trainer será avisado
                automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleCancelSingleBooking(cancelTarget)}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {actionBusy ? 'A desmarcar...' : 'Confirmar desmarcação'}
              </button>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  const target = cancelTarget;
                  setCancelTarget(null);
                  setSwapTarget(target);
                }}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#EAB308]/60 bg-[#3D3314]/80 px-4 py-2 text-xs font-bold text-[#FACC15] transition hover:bg-[#4D4019] disabled:opacity-50"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Prefiro trocar de horário
              </button>

              <SecondaryButton
                fullWidth
                disabled={actionBusy}
                onClick={() => setCancelTarget(null)}
              >
                Manter treino
              </SecondaryButton>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== MODAL: TROCAR HORÁRIO DO TREINO ==================== */}
      <Modal
        open={Boolean(swapTarget)}
        title="Trocar horário do treino"
        subtitle={
          swapTarget
            ? `A trocar: ${swapTarget.session.dateLabel} às ${swapTarget.session.timeLabel.replace(':', 'h')}`
            : undefined
        }
        onClose={() => {
          if (!actionBusy) setSwapTarget(null);
        }}
      >
        {swapTarget && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-[#EAB308]/40 bg-[#3D3314]/50 px-3.5 py-2.5 text-xs text-[#FACC15]">
              Escolhe abaixo o novo dia e hora para a semana{' '}
              <strong>{swapTarget.week?.label || swapTarget.booking.weekKey}</strong> (máx. 1 treino
              por dia). A troca é imediata e o teu PT é avisado automaticamente.
            </div>

            {swapCandidatesByDay.length === 0 ? (
              <div className="rounded-xl border border-[#323238] bg-[#242429] p-5 text-center space-y-2">
                <Clock className="mx-auto h-6 w-6 text-[#A1A1AA]" />
                <p className="text-sm font-bold text-[#F4F4F5]">
                  Sem outros horários com vagas nesta semana
                </p>
                <p className="text-xs text-[#A1A1AA]">
                  Podes desmarcar este treino ou falar diretamente com o teu PT no chat.
                </p>
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
                {swapCandidatesByDay.map(([dayNum, list]) => (
                  <div key={dayNum} className="space-y-1.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#EAB308]">
                      {DAYS_PT[dayNum] || `Dia ${dayNum}`} · {list[0]?.dateLabel}
                    </p>
                    <div className="space-y-1.5">
                      {list.map((candidate) => {
                        const confirmedCount = bookings.filter(
                          (b) => b.sessionId === candidate.id && b.status === 'CONFIRMED'
                        ).length;
                        const spotsLeft = Math.max(0, candidate.capacity - confirmedCount);
                        const endT = computeEndTimeLabel(
                          candidate.timeLabel,
                          candidate.durationMinutes
                        );
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleSwapSingleBooking(swapTarget, candidate)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#323238] bg-[#242429] p-3 text-left transition hover:border-[#EAB308] hover:bg-[#3D3314]/40 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="rounded-lg border border-[#EAB308]/40 bg-[#18181B] px-2.5 py-1.5 text-sm font-extrabold text-[#FACC15]">
                                {candidate.timeLabel}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#F4F4F5] truncate">
                                  {candidate.dateLabel}
                                  {endT ? ` · até ${endT}` : ''}
                                </p>
                                <p className="text-[11px] text-[#A1A1AA] truncate">
                                  {candidate.durationMinutes} min
                                  {candidate.note ? ` · ${candidate.note}` : ''}
                                </p>
                              </div>
                            </div>
                            <StatusPill tone="green">
                              {spotsLeft} {spotsLeft === 1 ? 'vaga' : 'vagas'}
                            </StatusPill>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <SecondaryButton
              fullWidth
              disabled={actionBusy}
              onClick={() => setSwapTarget(null)}
            >
              Fechar
            </SecondaryButton>
          </div>
        )}
      </Modal>
    </div>
  );
};
