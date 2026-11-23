import { BookingRecord, TrainingSessionRecord } from '../types/studio';

const LS_REMINDER_ENABLED = 'newshape_reminder_enabled';
const LS_REMINDER_LEAD_MIN = 'newshape_reminder_lead_minutes';
const LS_PT_ALERTS_ENABLED = 'newshape_pt_alerts_enabled';
const LS_FIRED_REMINDERS = 'newshape_fired_reminders';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .catch(() => null);
  }
  return swRegistrationPromise;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    await registerNotificationServiceWorker();
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function dispatchLocalPushNotification(
  title: string,
  body: string,
  tag?: string,
  url = '/'
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await registerNotificationServiceWorker();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag || `newshape-${Date.now()}`,
        data: { url },
      });
      return true;
    }
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: tag || `newshape-${Date.now()}`,
    });
    return true;
  } catch {
    return false;
  }
}

export function getReminderPreferences(defaultLeadMinutes = 60): {
  enabled: boolean;
  leadMinutes: number;
  hasCustomLead: boolean;
} {
  const fallback = Math.max(5, Math.min(1440, Math.round(defaultLeadMinutes || 60)));
  if (typeof window === 'undefined') {
    return { enabled: false, leadMinutes: fallback, hasCustomLead: false };
  }
  const enabled = localStorage.getItem(LS_REMINDER_ENABLED) === 'true';
  const storedRaw = localStorage.getItem(LS_REMINDER_LEAD_MIN);
  if (storedRaw === null) {
    return { enabled, leadMinutes: fallback, hasCustomLead: false };
  }
  const rawLead = Number(storedRaw);
  const leadMinutes =
    Number.isFinite(rawLead) && rawLead >= 5 && rawLead <= 1440
      ? Math.round(rawLead)
      : fallback;
  return { enabled, leadMinutes, hasCustomLead: true };
}

export function saveReminderPreferences(
  enabled: boolean,
  leadMinutes?: number | null
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_REMINDER_ENABLED, enabled ? 'true' : 'false');
  if (leadMinutes === null) {
    localStorage.removeItem(LS_REMINDER_LEAD_MIN);
  } else if (typeof leadMinutes === 'number' && Number.isFinite(leadMinutes)) {
    const safe = Math.max(5, Math.min(1440, Math.round(leadMinutes)));
    localStorage.setItem(LS_REMINDER_LEAD_MIN, String(safe));
  }
}

export function getPtAlertsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(LS_PT_ALERTS_ENABLED);
  return raw === null ? true : raw === 'true';
}

export function savePtAlertsPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_PT_ALERTS_ENABLED, enabled ? 'true' : 'false');
}

function hasReminderFired(key: string): boolean {
  try {
    const raw = localStorage.getItem(LS_FIRED_REMINDERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(key);
  } catch {
    return false;
  }
}

function markReminderFired(key: string): void {
  try {
    const raw = localStorage.getItem(LS_FIRED_REMINDERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.from(new Set([...list, key])).slice(-100);
    localStorage.setItem(LS_FIRED_REMINDERS, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function formatLeadMinutesLabel(mins: number): string {
  const m = Math.max(5, Math.min(1440, Math.round(mins)));
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return h === 1 ? '1h' : `${h}h`;
  }
  if (m > 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${rem} min`;
  }
  return `${m} min`;
}

export function scheduleConfirmedWorkoutReminders(
  clientId: string,
  bookings: BookingRecord[],
  sessions: TrainingSessionRecord[],
  leadMinutes: number
): () => void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return () => {};
  }

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const now = Date.now();
  const leadMs = Math.max(5, leadMinutes) * 60_000;
  const maxScheduleWindowMs = 7 * 24 * 60 * 60_000;
  const timers: number[] = [];

  bookings
    .filter((b) => b.clientId === clientId && b.status === 'CONFIRMED')
    .forEach((booking) => {
      const session = sessionMap.get(booking.sessionId);
      if (!session || session.startMillis <= now) return;

      const triggerAt = session.startMillis - leadMs;
      const delay = triggerAt - now;
      const fireKey = `${booking.id}_${session.startMillis}_${leadMinutes}`;

      if (hasReminderFired(fireKey)) return;

      if (delay <= 0 && session.startMillis - now <= leadMs) {
        markReminderFired(fireKey);
        const minsLeft = Math.max(1, Math.round((session.startMillis - now) / 60_000));
        void dispatchLocalPushNotification(
          'Lembrete de Treino · New Shape',
          `O teu treino começa em ~${minsLeft} min (${session.dateLabel} às ${session.timeLabel}). Até já!`,
          fireKey,
          window.location.pathname + window.location.search
        );
      } else if (delay > 0 && delay <= maxScheduleWindowMs) {
        const timerId = window.setTimeout(() => {
          if (hasReminderFired(fireKey)) return;
          markReminderFired(fireKey);
          void dispatchLocalPushNotification(
            'Lembrete de Treino · New Shape',
            `O teu treino é daqui a ${formatLeadMinutesLabel(leadMinutes)} (${session.dateLabel} às ${session.timeLabel}). Prepara-te!`,
            fireKey,
            window.location.pathname + window.location.search
          );
        }, delay);
        timers.push(timerId);
      }
    });

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}
