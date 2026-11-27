import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  EyeOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  AttendanceStatus,
  BookingRecord,
  ClientRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  getWeekDayWorkoutType,
} from '../types/studio';
import {
  DAYS_PT,
  formatDayDate,
  formatPhoneDisplay,
  formatWeekKey,
  formatWeekRangeLabel,
  getMondayOfWeek,
  MONTHS_PT,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import { getMakeupClientIdsForWeek } from '../services/makeupCalculator';
import { BrandCard, EmptyState, GoldButton, SecondaryButton, StatusPill } from './UiPrimitives';
import { PrivatePersonalSessionModal } from './PrivatePersonalSessionModal';
import { DayWorkoutTypesModal } from './DayWorkoutTypesModal';

interface PtTrainingAgendaViewProps {
  uid: string;
  clients: ClientRecord[];
  weeks?: TrainingWeekRecord[];
  sessions: TrainingSessionRecord[];
  bookings: BookingRecord[];
  onOpenClientPlan?: (clientId: string) => void;
  onBanner: (msg: string) => void;
}

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sessionMatchesDate(session: TrainingSessionRecord, targetDate: Date): boolean {
  if (session.startMillis > 0) {
    return isSameCalendarDay(new Date(session.startMillis), targetDate);
  }
  const monday = getMondayOfWeek(targetDate);
  const targetWeekKey = formatWeekKey(monday);
  const jsDay = targetDate.getDay();
  const targetIsoDay = jsDay === 0 ? 7 : jsDay;
  return session.weekKey === targetWeekKey && session.dayOfWeek === targetIsoDay;
}

export const PtTrainingAgendaView: React.FC<PtTrainingAgendaViewProps> = ({
  uid,
  clients,
  weeks = [],
  sessions,
  bookings,
  onOpenClientPlan,
  onBanner,
}) => {
  const [selectedDateMs, setSelectedDateMs] = useState<number>(() => startOfDay(new Date()).getTime());
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [showDayTypesModal, setShowDayTypesModal] = useState(false);
  const [counterMonthOffset, setCounterMonthOffset] = useState(0);
  const [showClientBreakdown, setShowClientBreakdown] = useState(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDate = useMemo(() => new Date(selectedDateMs), [selectedDateMs]);
  const isSelectedToday = isSameCalendarDay(selectedDate, today);
  const selectedMonday = useMemo(() => getMondayOfWeek(selectedDate), [selectedDate]);
  const selectedWeekKey = useMemo(() => formatWeekKey(selectedMonday), [selectedMonday]);
  const selectedWeek = useMemo(
    () => weeks.find((w) => w.weekKey === selectedWeekKey) || null,
    [weeks, selectedWeekKey]
  );
  const makeupClientIdsForSelectedWeek = useMemo(
    () => getMakeupClientIdsForWeek(bookings, selectedWeekKey),
    [bookings, selectedWeekKey]
  );

  const counterMonthDate = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth() + counterMonthOffset, 1);
    return base;
  }, [today, counterMonthOffset]);

  const personalStats = useMemo(() => {
    const targetYear = counterMonthDate.getFullYear();
    const targetMonth = counterMonthDate.getMonth();
    let given = 0;
    let absent = 0;
    let pending = 0;
    const perClient = new Map<
      string,
      { clientId: string; name: string; given: number; absent: number; pending: number }
    >();

    bookings.forEach((b) => {
      if (b.status !== 'CONFIRMED') return;
      const ses = sessionMap.get(b.sessionId);
      if (!ses || ses.startMillis <= 0) return;
      const client = clientMap.get(b.clientId);
      const isPersonal = Boolean(ses.ptPrivatePersonal) || client?.trainingType === 'PERSONALIZADO';
      if (!isPersonal) return;

      const dt = new Date(ses.startMillis);
      if (dt.getFullYear() !== targetYear || dt.getMonth() !== targetMonth) return;

      const entry = perClient.get(b.clientId) || {
        clientId: b.clientId,
        name: client?.name || 'Aluno removido',
        given: 0,
        absent: 0,
        pending: 0,
      };
      if (b.attendanceStatus === 'PRESENT') {
        given += 1;
        entry.given += 1;
      } else if (b.attendanceStatus === 'ABSENT') {
        absent += 1;
        entry.absent += 1;
      } else {
        pending += 1;
        entry.pending += 1;
      }
      perClient.set(b.clientId, entry);
    });

    const byClient = Array.from(perClient.values()).sort(
      (a, b) => b.given - a.given || b.pending - a.pending || a.name.localeCompare(b.name)
    );
    return { given, absent, pending, total: given + absent + pending, byClient };
  }, [bookings, sessionMap, clientMap, counterMonthDate]);

  const shiftDay = (deltaDays: number) => {
    const next = new Date(selectedDateMs);
    next.setDate(next.getDate() + deltaDays);
    setSelectedDateMs(startOfDay(next).getTime());
  };

  // 7-day strip for the week containing selectedDate
  const weekDaysStrip = useMemo(() => {
    const monday = getMondayOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const daySessions = sessions.filter((s) => sessionMatchesDate(s, d));
      const daySessionIds = new Set(daySessions.map((s) => s.id));
      const confirmedCount = bookings.filter(
        (b) => daySessionIds.has(b.sessionId) && b.status === 'CONFIRMED'
      ).length;
      return {
        date: d,
        short: WEEKDAY_SHORT[idx],
        dayNum: d.getDate(),
        isSelected: isSameCalendarDay(d, selectedDate),
        isToday: isSameCalendarDay(d, today),
        sessionCount: daySessions.length,
        confirmedCount,
      };
    });
  }, [selectedDate, today, sessions, bookings]);

  const daySessions = useMemo(
    () =>
      sessions
        .filter((s) => sessionMatchesDate(s, selectedDate))
        .sort((a, b) => a.startMillis - b.startMillis || a.timeLabel.localeCompare(b.timeLabel)),
    [sessions, selectedDate]
  );

  // Day KPIs
  const daySummary = useMemo(() => {
    const sessionIds = new Set(daySessions.map((s) => s.id));
    const confirmed = bookings.filter(
      (b) => sessionIds.has(b.sessionId) && b.status === 'CONFIRMED'
    );
    const present = confirmed.filter((b) => b.attendanceStatus === 'PRESENT').length;
    const absent = confirmed.filter((b) => b.attendanceStatus === 'ABSENT').length;
    return {
      slots: daySessions.length,
      confirmed: confirmed.length,
      present,
      absent,
    };
  }, [daySessions, bookings]);

  const handleSetAttendance = async (
    bookingId: string,
    nextStatus: AttendanceStatus,
    clientName: string
  ) => {
    setBusyBookingId(bookingId);
    try {
      await repo.setBookingAttendance(uid, bookingId, nextStatus);
      onBanner(
        nextStatus === 'PRESENT'
          ? `Presença de ${clientName} confirmada ✓`
          : nextStatus === 'ABSENT'
          ? `Falta de ${clientName} registada.`
          : `Registo de presença de ${clientName} limpo.`
      );
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleMarkAllPresent = async (confirmedBookings: BookingRecord[]) => {
    const toMark = confirmedBookings.filter((b) => b.attendanceStatus !== 'PRESENT');
    if (toMark.length === 0) return;
    await Promise.all(toMark.map((b) => repo.setBookingAttendance(uid, b.id, 'PRESENT')));
    onBanner(`${toMark.length} aluno(s) marcados como presentes ✓`);
  };

  const jsDay = selectedDate.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const selectedDayWorkoutType = getWeekDayWorkoutType(selectedWeek, isoDay);

  return (
    <div className="space-y-4">
      {/* Day-by-Day Header */}
      <BrandCard>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            aria-label="Dia anterior"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-lg font-bold text-[#F4F4F5]">
                {DAYS_PT[isoDay]}, {selectedDate.getDate()} {MONTHS_PT[selectedDate.getMonth()]}
              </h2>
              {isSelectedToday && <StatusPill tone="gold">Hoje</StatusPill>}
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Agenda de treinos · Confirma quem veio em cada horário
            </p>
            {selectedDayWorkoutType && (
              <div className="mt-1.5 flex justify-center">
                <StatusPill tone="gold">Treino do dia: {selectedDayWorkoutType}</StatusPill>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => shiftDay(1)}
            aria-label="Dia seguinte"
            className="rounded-xl p-2 text-[#EAB308] hover:bg-[#242429]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* 7-day Strip */}
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekDaysStrip.map((d) => (
            <button
              key={d.date.getTime()}
              type="button"
              onClick={() => setSelectedDateMs(d.date.getTime())}
              className={`flex min-h-[60px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 transition ${
                d.isSelected
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : d.isToday
                  ? 'border-[#EAB308]/60 bg-[#3D3314]/40 text-[#F4F4F5] hover:border-[#EAB308]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:border-[#52525B] hover:text-white'
              }`}
            >
              <span className="text-[10px] font-bold">{d.short}</span>
              <span className="mt-0.5 text-sm font-extrabold leading-none">{d.dayNum}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  d.sessionCount > 0
                    ? d.isSelected
                      ? 'bg-[#121214]'
                      : 'bg-[#EAB308]'
                    : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Quick Today + KPIs */}
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#323238] pt-3">
          <div className="rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#A1A1AA]">Horários</p>
            <p className="text-base font-extrabold text-[#F4F4F5]">{daySummary.slots}</p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#A1A1AA]">Marcados</p>
            <p className="text-base font-extrabold text-[#FACC15]">{daySummary.confirmed}</p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#A1A1AA]">Presenças</p>
            <p className="text-base font-extrabold text-[#22C55E]">
              {daySummary.present}✓
              {daySummary.absent > 0 && (
                <span className="ml-1 text-xs text-[#EF4444]">{daySummary.absent}✕</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#323238] pt-3">
          {!isSelectedToday ? (
            <button
              type="button"
              onClick={() => setSelectedDateMs(today.getTime())}
              className="rounded-xl border border-[#EAB308]/50 bg-[#3D3314]/50 px-3 py-1.5 text-xs font-bold text-[#FACC15] hover:bg-[#EAB308] hover:text-[#121214]"
            >
              Voltar a Hoje ({formatDayDate(today)})
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#A1A1AA]">
              <EyeOff className="h-3.5 w-3.5 text-[#FACC15]" />
              Podes marcar treinos privados só para o PT
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={() => setShowDayTypesModal(true)}>
              <Dumbbell className="h-4 w-4" />
              {selectedDayWorkoutType ? 'Editar tipo do dia' : 'Tipo de treino'}
            </SecondaryButton>
            <GoldButton onClick={() => setShowPrivateModal(true)}>
              <Plus className="h-4 w-4" />
              Personalizado (Oculto)
            </GoldButton>
          </div>
        </div>
      </BrandCard>

      {/* Personal Training Monthly Counter Card */}
      <BrandCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#FACC15]">
              Treinos Personalizados Dados
            </p>
            <p className="text-xs text-[#A1A1AA]">
              Contabiliza presenças confirmadas (✓) em treinos personalizados
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[#323238] bg-[#242429] p-1">
            <button
              type="button"
              onClick={() => setCounterMonthOffset((prev) => prev - 1)}
              aria-label="Mês anterior"
              className="rounded-lg p-1.5 text-[#EAB308] hover:bg-[#1B1B1E]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[116px] text-center text-xs font-bold text-[#F4F4F5]">
              {MONTHS_PT[counterMonthDate.getMonth()]} {counterMonthDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setCounterMonthOffset((prev) => prev + 1)}
              aria-label="Mês seguinte"
              className="rounded-lg p-1.5 text-[#EAB308] hover:bg-[#1B1B1E]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#22C55E]/40 bg-[#143521]/30 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#86EFAC]">Dados (✓)</p>
            <p className="text-lg font-extrabold text-[#22C55E]">{personalStats.given}</p>
          </div>
          <div className="rounded-xl border border-[#EF4444]/35 bg-[#3B1518]/25 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#FCA5A5]">Faltas (✕)</p>
            <p className="text-lg font-extrabold text-[#EF4444]">{personalStats.absent}</p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-[#A1A1AA]">Por registar</p>
            <p className="text-lg font-extrabold text-[#FACC15]">{personalStats.pending}</p>
          </div>
        </div>

        {personalStats.byClient.length > 0 && (
          <div className="mt-2.5 border-t border-[#323238] pt-2.5">
            <button
              type="button"
              onClick={() => setShowClientBreakdown((prev) => !prev)}
              className="flex w-full items-center justify-between text-xs font-bold text-[#FACC15] hover:underline"
            >
              <span>Detalhe por aluno ({personalStats.byClient.length})</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showClientBreakdown ? 'rotate-180' : ''}`}
              />
            </button>
            {showClientBreakdown && (
              <div className="mt-2 space-y-1.5">
                {personalStats.byClient.map((row) => (
                  <div
                    key={row.clientId}
                    className="flex items-center justify-between rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[#F4F4F5]">{row.name}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusPill tone="green">{row.given} dado(s) ✓</StatusPill>
                      {row.absent > 0 && <StatusPill tone="red">{row.absent} falta(s)</StatusPill>}
                      {row.pending > 0 && (
                        <StatusPill tone="amber">{row.pending} por registar</StatusPill>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </BrandCard>

      {/* Hour-by-Hour Cards */}
      {daySessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Sem treinos marcados neste dia"
          subtitle="Usa as setas ou os dias da semana acima para consultar outros dias."
        />
      ) : (
        <div className="space-y-3">
          {daySessions.map((session) => {
            const allActiveBookings = bookings.filter(
              (b) => b.sessionId === session.id && b.status !== 'CANCELLED'
            );
            const confirmedBookings = allActiveBookings
              .filter((b) => b.status === 'CONFIRMED')
              .sort((a, b) => {
                const ca = clientMap.get(a.clientId)?.name || '';
                const cb = clientMap.get(b.clientId)?.name || '';
                return ca.localeCompare(cb);
              });
            const pendingBookings = allActiveBookings.filter(
              (b) => b.status === 'PENDING' || b.status === 'ALTERED'
            );
            const presentCount = confirmedBookings.filter(
              (b) => b.attendanceStatus === 'PRESENT'
            ).length;
            const absentCount = confirmedBookings.filter(
              (b) => b.attendanceStatus === 'ABSENT'
            ).length;
            const allPresent =
              confirmedBookings.length > 0 && presentCount === confirmedBookings.length;

            return (
              <BrandCard key={session.id} highlight={isSelectedToday}>
                {/* Slot Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 min-w-[68px] flex-col items-center justify-center rounded-xl border border-[#EAB308]/60 bg-[#3D3314]/60 px-2">
                      <span className="text-base font-extrabold leading-none text-[#FACC15]">
                        {session.timeLabel.replace(':', 'h')}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#D4D4D8]">
                        <Clock className="h-2.5 w-2.5" />
                        {session.durationMinutes}m
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {session.ptPrivatePersonal && (
                          <StatusPill tone="gold">Personalizado · Oculto</StatusPill>
                        )}
                        <StatusPill
                          tone={confirmedBookings.length >= session.capacity ? 'red' : 'gold'}
                        >
                          {confirmedBookings.length}/{session.capacity} confirmados
                        </StatusPill>
                        {(presentCount > 0 || absentCount > 0) && (
                          <StatusPill tone="green">
                            {presentCount}✓{absentCount > 0 ? ` · ${absentCount}✕` : ''}
                          </StatusPill>
                        )}
                        {pendingBookings.length > 0 && (
                          <StatusPill tone="amber">
                            +{pendingBookings.length} pendente(s)
                          </StatusPill>
                        )}
                      </div>
                      {session.note && (
                        <p className="mt-1 text-xs text-[#A1A1AA]">{session.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {confirmedBookings.length > 1 && !allPresent && (
                      <button
                        type="button"
                        onClick={() => handleMarkAllPresent(confirmedBookings)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#22C55E]/50 bg-[#143521]/50 px-2.5 py-1.5 text-xs font-bold text-[#86EFAC] hover:bg-[#22C55E] hover:text-[#121214]"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Todos vieram
                      </button>
                    )}
                    {session.ptPrivatePersonal && (
                      <button
                        type="button"
                        aria-label="Apagar treino personalizado oculto"
                        onClick={async () => {
                          await repo.deleteSession(uid, session.id, allActiveBookings, session);
                          onBanner('Treino personalizado oculto removido.');
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#EF4444]/40 bg-[#3B1518]/50 px-2.5 py-1.5 text-xs font-bold text-[#FCA5A5] hover:bg-[#EF4444] hover:text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Apagar
                      </button>
                    )}
                  </div>
                </div>

                <div className="my-3 border-t border-[#323238]" />

                {/* Confirmed Students + Direct Attendance Confirmation */}
                {confirmedBookings.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA]">
                    Sem alunos confirmados neste horário.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {confirmedBookings.map((b) => {
                      const client = clientMap.get(b.clientId);
                      if (!client) return null;
                      const isPresent = b.attendanceStatus === 'PRESENT';
                      const isAbsent = b.attendanceStatus === 'ABSENT';
                      const isBusy = busyBookingId === b.id;
                      const isMakeupClientWeek =
                        Boolean(b.makeup) || makeupClientIdsForSelectedWeek.has(b.clientId);

                      return (
                        <div
                          key={b.id}
                          className={`rounded-xl border p-3 transition ${
                            isMakeupClientWeek
                              ? 'border-[#A855F7] bg-[#2E1065]/45'
                              : isPresent
                              ? 'border-[#22C55E]/55 bg-[#143521]/30'
                              : isAbsent
                              ? 'border-[#EF4444]/55 bg-[#3B1518]/30'
                              : 'border-[#323238] bg-[#242429]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-sm font-bold ${
                                    isMakeupClientWeek ? 'text-[#E9D5FF]' : 'text-[#F4F4F5]'
                                  }`}
                                >
                                  {client.name}
                                </span>
                                {b.makeup ? (
                                  <StatusPill tone="purple">Compensação</StatusPill>
                                ) : isMakeupClientWeek ? (
                                  <StatusPill tone="purple">Em compensação</StatusPill>
                                ) : null}
                                <StatusPill
                                  tone={
                                    client.trainingType === 'PERSONALIZADO' ? 'gold' : 'blue'
                                  }
                                >
                                  {client.trainingType === 'PERSONALIZADO'
                                    ? 'Personalizado'
                                    : 'Grupo'}
                                </StatusPill>
                              </div>
                              <p className="text-[11px] text-[#A1A1AA]">
                                {formatPhoneDisplay(client.phone)}
                              </p>
                            </div>

                            {onOpenClientPlan && (
                              <button
                                type="button"
                                onClick={() => onOpenClientPlan(client.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#323238] bg-[#1B1B1E] px-2.5 py-1 text-[11px] font-bold text-[#FACC15] hover:border-[#EAB308]"
                              >
                                <Dumbbell className="h-3 w-3" />
                                Plano
                              </button>
                            )}
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleSetAttendance(
                                  b.id,
                                  isPresent ? '' : 'PRESENT',
                                  client.name
                                )
                              }
                              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition disabled:opacity-40 ${
                                isPresent
                                  ? 'border-[#22C55E] bg-[#22C55E] text-[#121214]'
                                  : 'border-[#323238] bg-[#1B1B1E] text-[#D4D4D8] hover:border-[#22C55E] hover:text-[#86EFAC]'
                              }`}
                            >
                              <Check className="h-4 w-4" />
                              {isPresent ? 'Veio ao treino ✓' : 'Confirmar presença'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleSetAttendance(
                                  b.id,
                                  isAbsent ? '' : 'ABSENT',
                                  client.name
                                )
                              }
                              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition disabled:opacity-40 ${
                                isAbsent
                                  ? 'border-[#EF4444] bg-[#EF4444] text-white'
                                  : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA] hover:border-[#EF4444] hover:text-[#FCA5A5]'
                              }`}
                            >
                              <X className="h-4 w-4" />
                              {isAbsent ? 'Faltou ✕' : 'Marcar falta'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pending requests notice (if any) */}
                {pendingBookings.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#F59E0B]/35 bg-[#3B2A14]/30 px-3 py-2 text-xs text-[#FCD34D]">
                    {pendingBookings.length} pedido(s) ainda por aceitar neste horário:{' '}
                    {pendingBookings
                      .map((b) => clientMap.get(b.clientId)?.name)
                      .filter(Boolean)
                      .join(', ')}
                    . Aceita em <strong>Início → Marcações</strong>.
                  </div>
                )}
              </BrandCard>
            );
          })}
        </div>
      )}
      <PrivatePersonalSessionModal
        open={showPrivateModal}
        clients={clients}
        initialDateMs={selectedDateMs}
        onClose={() => setShowPrivateModal(false)}
        onSubmit={async (payload) => {
          await repo.createPrivatePersonalSessionAndBooking(uid, payload);
          setSelectedDateMs(startOfDay(new Date(payload.dateMs)).getTime());
          onBanner(
            `Treino personalizado (oculto) marcado para ${payload.clientName} ✓`
          );
        }}
      />
      <DayWorkoutTypesModal
        open={showDayTypesModal}
        weekLabel={selectedWeek?.label || formatWeekRangeLabel(selectedMonday)}
        initialEnabled={Boolean(selectedWeek?.showDayWorkoutTypes)}
        initialTypes={selectedWeek?.dayWorkoutTypes ?? {}}
        initialFocusDay={isoDay}
        onClose={() => setShowDayTypesModal(false)}
        onSave={async (enabled, typesMap) => {
          const ensured = await repo.ensureWeekExists(uid, selectedMonday.getTime());
          await repo.updateWeekDayWorkoutTypes(uid, ensured.weekKey, enabled, typesMap);
          const activeCount = Object.values(typesMap).filter((v) => v.trim().length > 0).length;
          onBanner(
            enabled && activeCount > 0
              ? `Tipos de treino guardados (${activeCount} dia(s)) ✓`
              : 'Tipos de treino por dia desativados para esta semana ✓'
          );
        }}
      />
    </div>
  );
};
