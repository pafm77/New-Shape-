import {
  BookingRecord,
  ClientRecord,
  MakeupCreditReason,
  MakeupCreditRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WeekResponseRecord,
} from '../types/studio';

export const MAKEUP_VALIDITY_DAYS = 30;
export const DAY_MILLIS = 86_400_000;
export const MAKEUP_VALIDITY_MILLIS = MAKEUP_VALIDITY_DAYS * DAY_MILLIS;

export type ComputedMakeupStatus = 'AVAILABLE' | 'USED' | 'EXPIRED';

export interface ComputedMakeupCredit {
  id: string;
  reason: MakeupCreditReason;
  weekKey: string;
  sourceLabel: string;
  occurredAtMillis: number;
  expiresAtMillis: number;
  daysLeft: number;
  status: ComputedMakeupStatus;
  dismissibleCreditDocId?: string;
  usedByBookingId?: string;
}

export interface ClientMakeupSummary {
  clientId: string;
  availableCount: number;
  usedCount: number;
  expiredCount: number;
  activeMakeupBookingsCount: number;
  absentCount30d: number;
  removedCount30d: number;
  missedWeekCount30d: number;
  manualCount30d: number;
  totalAbsencesAllTime: number;
  nearestExpiryDays: number | null;
  credits: ComputedMakeupCredit[];
}

interface RawMakeupCredit {
  id: string;
  reason: MakeupCreditReason;
  weekKey: string;
  sourceLabel: string;
  occurredAtMillis: number;
  expiresAtMillis: number;
  dismissibleCreditDocId?: string;
}

export function makeupReasonLabel(reason: MakeupCreditReason | string): string {
  switch (reason) {
    case 'ABSENT':
      return 'Falta';
    case 'REMOVED':
      return 'Treino removido';
    case 'MISSED_WEEK':
      return 'Não marcou treino';
    case 'MANUAL':
      return 'Atribuída pelo PT';
    default:
      return 'Compensação';
  }
}

export function formatShortDatePt(millis: number): string {
  if (!millis || millis <= 0) return '—';
  const d = new Date(millis);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Returns the set of clientIds that have at least one active (non-CANCELLED) makeup booking
 * in the specified weekKey (or any week if weekKey is empty).
 * Used so ALL bookings of that student in that week render in distinct violet/purple for the PT.
 */
export function getMakeupClientIdsForWeek(
  bookings: BookingRecord[],
  weekKey: string
): Set<string> {
  const result = new Set<string>();
  for (const b of bookings) {
    if (b.makeup && b.status !== 'CANCELLED' && (!weekKey || b.weekKey === weekKey)) {
      result.add(b.clientId);
    }
  }
  return result;
}

export function computeClientMakeupSummary(
  client: ClientRecord,
  weeks: TrainingWeekRecord[],
  sessions: TrainingSessionRecord[],
  bookings: BookingRecord[],
  weekResponses: WeekResponseRecord[],
  makeupCredits: MakeupCreditRecord[],
  nowMillis: number = Date.now()
): ClientMakeupSummary {
  const sessionsById = new Map<string, TrainingSessionRecord>();
  for (const s of sessions) sessionsById.set(s.id, s);

  const clientBookings = bookings.filter((b) => b.clientId === client.id);
  const clientPersistedCredits = makeupCredits.filter((c) => c.clientId === client.id);
  const clientResponsesByWeek = new Map<string, WeekResponseRecord>();
  for (const wr of weekResponses) {
    if (wr.clientId === client.id) clientResponsesByWeek.set(wr.weekKey, wr);
  }

  const totalAbsencesAllTime = clientBookings.filter((b) => b.attendanceStatus === 'ABSENT').length;

  const rawCredits: RawMakeupCredit[] = [];

  // 1. Persisted credits (REMOVED bookings/sessions, MANUAL PT credits)
  for (const c of clientPersistedCredits) {
    if (c.dismissed) continue;
    const occurred = c.occurredAtMillis > 0 ? c.occurredAtMillis : nowMillis;
    const expires = c.expiresAtMillis > 0 ? c.expiresAtMillis : occurred + MAKEUP_VALIDITY_MILLIS;
    rawCredits.push({
      id: `doc_${c.id}`,
      reason: c.reason,
      weekKey: c.weekKey,
      sourceLabel: c.sourceLabel || makeupReasonLabel(c.reason),
      occurredAtMillis: occurred,
      expiresAtMillis: expires,
      dismissibleCreditDocId: c.id,
    });
  }

  // 2. ABSENT bookings (non-makeup)
  for (const b of clientBookings) {
    if (b.makeup || b.attendanceStatus !== 'ABSENT') continue;
    const sess = sessionsById.get(b.sessionId);
    const occurred =
      (sess && sess.startMillis > 0 ? sess.startMillis : 0) ||
      (b.requestedAtMillis > 0 ? b.requestedAtMillis : 0) ||
      nowMillis;
    const expires = occurred + MAKEUP_VALIDITY_MILLIS;
    const label = sess
      ? `Falta · ${sess.dateLabel} ${sess.timeLabel}`
      : `Falta em treino (${b.weekKey})`;
    rawCredits.push({
      id: `absent_${b.id}`,
      reason: 'ABSENT',
      weekKey: b.weekKey,
      sourceLabel: label,
      occurredAtMillis: occurred,
      expiresAtMillis: expires,
    });
  }

  // 3. Active CANCELLED bookings (awaiting PT confirmation, non-makeup)
  for (const b of clientBookings) {
    if (b.makeup || b.status !== 'CANCELLED') continue;
    const sess = sessionsById.get(b.sessionId);
    const occurred =
      (sess && sess.startMillis > 0 ? sess.startMillis : 0) ||
      (b.requestedAtMillis > 0 ? b.requestedAtMillis : 0) ||
      nowMillis;
    const expires = occurred + MAKEUP_VALIDITY_MILLIS;
    const label = sess
      ? `Treino cancelado · ${sess.dateLabel} ${sess.timeLabel}`
      : `Treino cancelado (${b.weekKey})`;
    rawCredits.push({
      id: `cancelled_${b.id}`,
      reason: 'REMOVED',
      weekKey: b.weekKey,
      sourceLabel: label,
      occurredAtMillis: occurred,
      expiresAtMillis: expires,
    });
  }

  // 4. MISSED_WEEK ("Não marcou treino") for active clients
  if (client.active) {
    const clientCreatedMillis = client.createdAtMillis || 0;
    const nonMakeupCountByWeek = new Map<string, number>();
    for (const b of clientBookings) {
      if (!b.makeup) {
        nonMakeupCountByWeek.set(b.weekKey, (nonMakeupCountByWeek.get(b.weekKey) || 0) + 1);
      }
    }
    const removedCountByWeek = new Map<string, number>();
    for (const c of clientPersistedCredits) {
      if (c.reason === 'REMOVED') {
        removedCountByWeek.set(c.weekKey, (removedCountByWeek.get(c.weekKey) || 0) + 1);
      }
    }

    for (const week of weeks) {
      if (!week.published || !week.startDateMillis || week.startDateMillis <= 0) continue;
      const weekEndMillis = week.startDateMillis + 7 * DAY_MILLIS;
      const weekHasEnded = weekEndMillis <= nowMillis;
      const isUnavailable = clientResponsesByWeek.get(week.weekKey)?.status === 'UNAVAILABLE';

      if (clientCreatedMillis > 0 && weekEndMillis < clientCreatedMillis && !isUnavailable) {
        continue;
      }
      if (!weekHasEnded && !isUnavailable) continue;

      const occurred = weekHasEnded
        ? weekEndMillis
        : Math.min(nowMillis, week.startDateMillis > 0 ? week.startDateMillis : nowMillis) || nowMillis;
      const expires = occurred + MAKEUP_VALIDITY_MILLIS;

      if (expires + 15 * DAY_MILLIS < nowMillis) continue;

      const accountedInWeek =
        (nonMakeupCountByWeek.get(week.weekKey) || 0) +
        (removedCountByWeek.get(week.weekKey) || 0);

      const limit = client.weeklySessionLimit || 0;
      const missingSlots =
        limit > 0
          ? Math.max(0, limit - accountedInWeek)
          : isUnavailable && accountedInWeek === 0
          ? 1
          : 0;

      for (let idx = 0; idx < missingSlots; idx++) {
        const label = isUnavailable
          ? `Não treinou (indisponível) · ${week.label}`
          : `Não marcou treino · ${week.label}`;
        rawCredits.push({
          id: `missed_${week.weekKey}_${idx}`,
          reason: 'MISSED_WEEK',
          weekKey: week.weekKey,
          sourceLabel: label,
          occurredAtMillis: occurred,
          expiresAtMillis: expires,
        });
      }
    }
  }

  // 5. FIFO consumption by active makeup bookings (oldest-expiring credit consumed first)
  const sortedRaw = [...rawCredits].sort((a, b) => a.expiresAtMillis - b.expiresAtMillis);
  const activeMakeupBookings = clientBookings
    .filter((b) => Boolean(b.makeup) && b.status !== 'CANCELLED' && b.attendanceStatus !== 'ABSENT')
    .sort((a, b) => (a.requestedAtMillis || 0) - (b.requestedAtMillis || 0));

  const consumedCreditIds = new Map<string, string>();
  for (const mb of activeMakeupBookings) {
    const refTime = mb.requestedAtMillis > 0 ? mb.requestedAtMillis : nowMillis;
    const match =
      sortedRaw.find((rc) => !consumedCreditIds.has(rc.id) && rc.expiresAtMillis >= refTime) ||
      sortedRaw.find((rc) => !consumedCreditIds.has(rc.id) && rc.expiresAtMillis > nowMillis);
    if (match) {
      consumedCreditIds.set(match.id, mb.id);
    }
  }

  const computed: ComputedMakeupCredit[] = sortedRaw.map((rc) => {
    const usedBy = consumedCreditIds.get(rc.id);
    const remainingMillis = rc.expiresAtMillis - nowMillis;
    const status: ComputedMakeupStatus = usedBy
      ? 'USED'
      : remainingMillis <= 0
      ? 'EXPIRED'
      : 'AVAILABLE';
    const daysLeft =
      remainingMillis > 0 ? Math.max(1, Math.ceil(remainingMillis / DAY_MILLIS)) : 0;
    return {
      id: rc.id,
      reason: rc.reason,
      weekKey: rc.weekKey,
      sourceLabel: rc.sourceLabel,
      occurredAtMillis: rc.occurredAtMillis,
      expiresAtMillis: rc.expiresAtMillis,
      daysLeft,
      status,
      dismissibleCreditDocId: rc.dismissibleCreditDocId,
      usedByBookingId: usedBy,
    };
  });

  const available = computed.filter((c) => c.status === 'AVAILABLE');
  const used = computed.filter((c) => c.status === 'USED');
  const expired = computed.filter((c) => c.status === 'EXPIRED');
  const within30d = computed.filter((c) => c.status !== 'EXPIRED');

  const visibleCredits: ComputedMakeupCredit[] = [
    ...available.sort((a, b) => a.expiresAtMillis - b.expiresAtMillis),
    ...used.sort((a, b) => b.occurredAtMillis - a.occurredAtMillis),
    ...expired
      .filter((c) => nowMillis - c.expiresAtMillis <= 15 * DAY_MILLIS)
      .sort((a, b) => b.expiresAtMillis - a.expiresAtMillis),
  ];

  const nearestExpiryDays =
    available.length > 0 ? Math.min(...available.map((c) => c.daysLeft)) : null;

  return {
    clientId: client.id,
    availableCount: available.length,
    usedCount: used.length,
    expiredCount: expired.length,
    activeMakeupBookingsCount: activeMakeupBookings.length,
    absentCount30d: within30d.filter((c) => c.reason === 'ABSENT').length,
    removedCount30d: within30d.filter((c) => c.reason === 'REMOVED').length,
    missedWeekCount30d: within30d.filter((c) => c.reason === 'MISSED_WEEK').length,
    manualCount30d: within30d.filter((c) => c.reason === 'MANUAL').length,
    totalAbsencesAllTime,
    nearestExpiryDays,
    credits: visibleCredits,
  };
}

export function computeAllClientsMakeupSummaries(
  clients: ClientRecord[],
  weeks: TrainingWeekRecord[],
  sessions: TrainingSessionRecord[],
  bookings: BookingRecord[],
  weekResponses: WeekResponseRecord[],
  makeupCredits: MakeupCreditRecord[],
  nowMillis: number = Date.now()
): Map<string, ClientMakeupSummary> {
  const map = new Map<string, ClientMakeupSummary>();
  for (const client of clients) {
    map.set(
      client.id,
      computeClientMakeupSummary(
        client,
        weeks,
        sessions,
        bookings,
        weekResponses,
        makeupCredits,
        nowMillis
      )
    );
  }
  return map;
}
