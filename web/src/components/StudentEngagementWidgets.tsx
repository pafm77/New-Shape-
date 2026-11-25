import React, { useMemo, useState } from 'react';
import {
  Activity,
  Cake,
  CalendarDays,
  CheckCircle2,
  Flame,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import {
  AnnouncementReadRecord,
  BookingRecord,
  ClientRecord,
  StudioAnnouncementRecord,
  TrainingSessionRecord,
  WorkoutFeedbackFeeling,
  WorkoutFeedbackRecord,
} from '../types/studio';
import { buildWhatsAppUrl, formatShortDate } from '../data/seedCatalog';
import { BrandCard, FieldLabel, GoldButton, Input, Modal, SecondaryButton, StatusPill, Textarea } from './UiPrimitives';

// --- Date & Birthday Utilities ---
export interface ParsedBirthDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export function parseBirthDate(raw?: string | null): ParsedBirthDate | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1920 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function formatBirthDatePt(raw?: string | null): string {
  const p = parseBirthDate(raw);
  if (!p) return '';
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

export function getCurrentAge(raw?: string | null, now = new Date()): number | null {
  const p = parseBirthDate(raw);
  if (!p) return null;
  let age = now.getFullYear() - p.year;
  const curMonth = now.getMonth() + 1;
  const curDay = now.getDate();
  if (curMonth < p.month || (curMonth === p.month && curDay < p.day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export interface UpcomingBirthdayItem {
  client: ClientRecord;
  turningAge: number;
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
  formattedDayMonth: string;
}

export function getUpcomingBirthdays(
  clients: ClientRecord[],
  windowDays = 30,
  now = new Date()
): UpcomingBirthdayItem[] {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const items: UpcomingBirthdayItem[] = [];

  for (const client of clients) {
    if (!client.active) continue;
    const p = parseBirthDate(client.birthDate);
    if (!p) continue;

    let targetYear = now.getFullYear();
    const buildBirthdayDate = (yr: number) => {
      // Handle Feb 29 on non-leap years as Feb 28
      const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
      const day = p.month === 2 && p.day === 29 && !isLeap ? 28 : p.day;
      return new Date(yr, p.month - 1, day);
    };

    let nextBday = buildBirthdayDate(targetYear);
    if (nextBday.getTime() < todayMidnight) {
      targetYear += 1;
      nextBday = buildBirthdayDate(targetYear);
    }

    const daysUntil = Math.round((nextBday.getTime() - todayMidnight) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= windowDays) {
      const turningAge = targetYear - p.year;
      if (turningAge > 0 && turningAge <= 120) {
        items.push({
          client,
          turningAge,
          daysUntil,
          isToday: daysUntil === 0,
          isTomorrow: daysUntil === 1,
          formattedDayMonth: `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`,
        });
      }
    }
  }

  return items.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.client.name.localeCompare(b.client.name)
  );
}

// --- 1. Student Portal: Active Studio Announcements Banner (only shown when active & unread) ---
export const StudioAnnouncementsBanner: React.FC<{
  announcements: StudioAnnouncementRecord[];
  reads: AnnouncementReadRecord[];
  client: ClientRecord;
  onMarkRead: (announcementId: string) => Promise<void>;
}> = ({ announcements, reads, client, onMarkRead }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = Date.now();

  const unreadActive = useMemo(() => {
    const readIds = new Set(
      reads.filter((r) => r.clientId === client.id).map((r) => r.announcementId)
    );
    return announcements.filter(
      (a) => a.active && a.expiresAtMillis > now && !readIds.has(a.id)
    );
  }, [announcements, reads, client.id, now]);

  if (unreadActive.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {unreadActive.map((ann) => {
        const daysLeft = Math.max(1, Math.ceil((ann.expiresAtMillis - now) / 86_400_000));
        return (
          <BrandCard
            key={ann.id}
            highlight
            className="bg-gradient-to-br from-[#2A2311] via-[#1B1B1E] to-[#1B1B1E] border-[#EAB308]/75"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="gold">
                    <Megaphone className="h-3.5 w-3.5" />
                    Aviso do Estúdio
                  </StatusPill>
                  <span className="text-[11px] text-[#A1A1AA]">
                    Válido por mais {daysLeft} dia{daysLeft === 1 ? '' : 's'} · até{' '}
                    {formatShortDate(ann.expiresAtMillis)}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[#F4F4F5]">{ann.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#E4E4E7]">
                  {ann.message}
                </p>
              </div>
              <div className="shrink-0 pt-1">
                <GoldButton
                  type="button"
                  disabled={busyId === ann.id}
                  onClick={async () => {
                    setBusyId(ann.id);
                    try {
                      await onMarkRead(ann.id);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {busyId === ann.id ? 'A guardar...' : 'Lido'}
                </GoldButton>
              </div>
            </div>
          </BrandCard>
        );
      })}
    </div>
  );
};

// --- 2. Student Portal: 30-Day Birth Date Reminder Banner ---
export const BirthDateReminderBanner: React.FC<{
  client: ClientRecord;
  reminderUntilMillis: number;
  onSaveBirthDate: (birthDate: string) => Promise<void>;
}> = ({ client, reminderUntilMillis, onSaveBirthDate }) => {
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = Date.now();
  const hasBirthDate = Boolean(parseBirthDate(client.birthDate));
  const windowActive = reminderUntilMillis <= 0 || now <= reminderUntilMillis;

  if (hasBirthDate || !windowActive) return null;

  const daysRemaining =
    reminderUntilMillis > 0
      ? Math.max(1, Math.ceil((reminderUntilMillis - now) / 86_400_000))
      : 30;

  const handleSave = async () => {
    if (!parseBirthDate(birthDate)) {
      setError('Escolhe uma data de nascimento válida.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSaveBirthDate(birthDate);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BrandCard className="border-[#38BDF8]/50 bg-[#102A3A]/35">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="blue">
              <Cake className="h-3.5 w-3.5" />
              Completa o teu perfil
            </StatusPill>
            <span className="text-[11px] text-[#A1A1AA]">
              Lembrete ativo ({daysRemaining} dia{daysRemaining === 1 ? '' : 's'} restantes)
            </span>
          </div>
          <p className="text-sm font-bold text-[#F4F4F5]">
            Adiciona a tua data de nascimento 🎂
          </p>
          <p className="text-xs text-[#D4D4D8]">
            Assim a equipa New Shape pode assinalar o teu aniversário e personalizar melhor o teu acompanhamento.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value);
              setError('');
            }}
            max={new Date().toISOString().slice(0, 10)}
            min="1925-01-01"
            className="sm:w-44"
            aria-label="Data de nascimento"
          />
          <GoldButton
            type="button"
            disabled={saving || !birthDate}
            onClick={handleSave}
            className="whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'A guardar...' : 'Guardar data'}
          </GoldButton>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-[#EF4444]">{error}</p>}
    </BrandCard>
  );
};

// --- 3. Student Portal: Weekly Training Goal & Streak Card ---
function getMondayMidnight(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

export const WeeklyGoalStreakCard: React.FC<{
  client: ClientRecord;
  bookings: BookingRecord[];
  sessions: TrainingSessionRecord[];
}> = ({ client, bookings, sessions }) => {
  const goal = useMemo(() => {
    if (client.weeklyGoalSessions && client.weeklyGoalSessions > 0) {
      return client.weeklyGoalSessions;
    }
    if (client.weeklySessionLimit && client.weeklySessionLimit > 0) {
      return client.weeklySessionLimit;
    }
    return 2;
  }, [client.weeklyGoalSessions, client.weeklySessionLimit]);

  const { currentWeekCount, streakWeeks, bestStreak } = useMemo(() => {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const countByWeekStart = new Map<number, number>();
    const currentWeekStart = getMondayMidnight(new Date());

    bookings.forEach((b) => {
      if (b.clientId !== client.id) return;
      if (b.status !== 'CONFIRMED') return;
      if (b.attendanceStatus === 'ABSENT') return;
      const s = sessionMap.get(b.sessionId);
      if (!s || !s.startMillis) return;
      const wkStart = getMondayMidnight(new Date(s.startMillis));
      countByWeekStart.set(wkStart, (countByWeekStart.get(wkStart) ?? 0) + 1);
    });

    const currentCount = countByWeekStart.get(currentWeekStart) ?? 0;

    // Streak: count backwards from current week if already met, else from previous week
    let streak = 0;
    const WEEK_MS = 7 * 86_400_000;
    let cursor = currentCount >= goal ? currentWeekStart : currentWeekStart - WEEK_MS;
    for (let i = 0; i < 52; i++) {
      const c = countByWeekStart.get(cursor) ?? 0;
      if (c >= goal) {
        streak += 1;
        cursor -= WEEK_MS;
      } else {
        break;
      }
    }

    // Best streak across recorded weeks
    const metWeeks = Array.from(countByWeekStart.entries())
      .filter(([, c]) => c >= goal)
      .map(([wk]) => wk)
      .sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    let prev = -1;
    metWeeks.forEach((wk) => {
      if (prev >= 0 && Math.abs(wk - prev - WEEK_MS) < 4 * 3_600_000) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = wk;
    });

    return {
      currentWeekCount: currentCount,
      streakWeeks: streak,
      bestStreak: Math.max(best, streak),
    };
  }, [client.id, bookings, sessions, goal]);

  const pct = Math.min(100, Math.round((currentWeekCount / Math.max(1, goal)) * 100));
  const goalMet = currentWeekCount >= goal;

  return (
    <BrandCard highlight={goalMet} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3D3314] text-[#EAB308]">
            <Target className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#F4F4F5]">Meta Semanal & Sequência</h3>
            <p className="text-xs text-[#A1A1AA]">
              {currentWeekCount} de {goal} treino{goal === 1 ? '' : 's'} confirmado
              {currentWeekCount === 1 ? '' : 's'} esta semana
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {goalMet ? (
            <StatusPill tone="green">
              <Sparkles className="h-3.5 w-3.5" />
              Meta cumprida!
            </StatusPill>
          ) : (
            <StatusPill tone="gold">
              Falta{goal - currentWeekCount === 1 ? '' : 'm'} {goal - currentWeekCount}
            </StatusPill>
          )}
          {streakWeeks > 0 && (
            <StatusPill tone="amber">
              <Flame className="h-3.5 w-3.5" />
              {streakWeeks} sem. seguida{streakWeeks === 1 ? '' : 's'}
            </StatusPill>
          )}
        </div>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#242429]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            goalMet ? 'bg-[#22C55E]' : 'bg-[#EAB308]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A1A1AA]">
        <span>
          {streakWeeks > 0
            ? `🔥 Estás numa sequência de ${streakWeeks} semana${streakWeeks === 1 ? '' : 's'} a cumprir o objetivo!`
            : goalMet
              ? 'Excelente trabalho! Continua assim na próxima semana para construir a tua sequência.'
              : 'Confirma os teus treinos da semana para manter o ritmo e ativar a tua sequência.'}
        </span>
        {bestStreak > 1 && (
          <span className="font-semibold text-[#FACC15]">Recorde: {bestStreak} sem.</span>
        )}
      </div>
    </BrandCard>
  );
};

// --- 4. Student Portal: Post-Workout Quick Feedback Modal ---
export const PostWorkoutFeedbackModal: React.FC<{
  open: boolean;
  planTitle: string;
  onClose: () => void;
  onSubmit: (payload: {
    rpe: number;
    feeling: WorkoutFeedbackFeeling;
    note: string;
  }) => Promise<void>;
}> = ({ open, planTitle, onClose, onSubmit }) => {
  const [feeling, setFeeling] = useState<WorkoutFeedbackFeeling>('IDEAL');
  const [rpe, setRpe] = useState<number>(7);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectFeeling = (next: WorkoutFeedbackFeeling) => {
    setFeeling(next);
    if (next === 'LEVE') setRpe(5);
    else if (next === 'IDEAL') setRpe(7);
    else setRpe(9);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ rpe, feeling, note: note.trim() });
      setNote('');
      setFeeling('IDEAL');
      setRpe(7);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Como correu o treino?"
      subtitle={planTitle || 'Feedback pós-treino para o PT'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Sensação geral</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'LEVE', label: 'Leve', desc: 'Fácil / recuperação', tone: 'border-[#22C55E] bg-[#143521] text-[#22C55E]' },
                { key: 'IDEAL', label: 'Ideal', desc: 'No ponto certo', tone: 'border-[#EAB308] bg-[#3D3314] text-[#FACC15]' },
                { key: 'PESADO', label: 'Pesado', desc: 'Muito exigente', tone: 'border-[#EF4444] bg-[#3B1518] text-[#EF4444]' },
              ] as const
            ).map((opt) => {
              const active = feeling === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectFeeling(opt.key)}
                  className={`rounded-xl border px-3 py-2.5 text-center transition ${
                    active
                      ? opt.tone
                      : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:border-[#52525B]'
                  }`}
                >
                  <div className="text-sm font-extrabold">{opt.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-85">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel>Esforço sentido (RPE 1 a 10)</FieldLabel>
            <StatusPill tone={rpe >= 9 ? 'red' : rpe >= 6 ? 'gold' : 'green'}>
              RPE {rpe}/10
            </StatusPill>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRpe(v)}
                className={`min-h-[40px] rounded-xl border text-xs font-extrabold transition ${
                  rpe === v
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#E4E4E7] hover:border-[#EAB308]/60'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Nota rápida para o PT (opcional)</FieldLabel>
          <Textarea
            rows={2}
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Senti ligeiro desconforto no ombro ou consegui subir 2,5 kg no agachamento..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <SecondaryButton type="button" onClick={onClose} className="flex-1">
            Agora não
          </SecondaryButton>
          <GoldButton type="submit" disabled={submitting} className="flex-1">
            <Send className="h-4 w-4" />
            {submitting ? 'A enviar...' : 'Enviar feedback'}
          </GoldButton>
        </div>
      </form>
    </Modal>
  );
};

// --- 5. PT/Admin Home: Upcoming Birthdays & Exact Age Card ---
export const UpcomingBirthdaysCard: React.FC<{
  clients: ClientRecord[];
  whatsappWebMode: boolean;
  reminderUntilMillis: number;
  onRenewReminder?: () => Promise<void>;
}> = ({ clients, whatsappWebMode, reminderUntilMillis, onRenewReminder }) => {
  const [renewing, setRenewing] = useState(false);
  const upcoming = useMemo(() => getUpcomingBirthdays(clients, 30), [clients]);
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const missingBirthDateCount = useMemo(
    () => activeClients.filter((c) => !parseBirthDate(c.birthDate)).length,
    [activeClients]
  );

  const now = Date.now();
  const reminderActive = reminderUntilMillis > now;
  const reminderDaysLeft = reminderActive
    ? Math.max(1, Math.ceil((reminderUntilMillis - now) / 86_400_000))
    : 0;

  if (upcoming.length === 0 && missingBirthDateCount === 0) return null;

  const sendBirthdayWhatsApp = (item: UpcomingBirthdayItem) => {
    const firstName = item.client.name.trim().split(/\s+/)[0] || item.client.name;
    const msg = item.isToday
      ? `Parabéns ${firstName}! 🎉🎂 Toda a equipa New Shape deseja-te um excelente ${item.turningAge}º aniversário, cheio de saúde, energia e grandes treinos! 💪`
      : `Olá ${firstName}! 🎂 Vimos que o teu ${item.turningAge}º aniversário está quase a chegar (${item.formattedDayMonth}). Muitos parabéns antecipados da equipa New Shape! 💪`;
    const url = buildWhatsAppUrl(item.client.phone, msg, whatsappWebMode);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <BrandCard
      highlight={upcoming.some((u) => u.isToday)}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3D3314] text-[#EAB308]">
            <Cake className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#F4F4F5]">
              Aniversários dos Alunos
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              {upcoming.length > 0
                ? `${upcoming.length} aniversário${upcoming.length === 1 ? '' : 's'} nos próximos 30 dias`
                : 'Sem aniversários nos próximos 30 dias'}
            </p>
          </div>
        </div>
        {upcoming.some((u) => u.isToday) && (
          <StatusPill tone="gold">🎂 Aniversariante hoje!</StatusPill>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map((item) => (
            <div
              key={item.client.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${
                item.isToday
                  ? 'border-[#EAB308]/70 bg-[#3D3314]/35'
                  : 'border-[#323238] bg-[#242429]/70'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#F4F4F5]">
                    {item.client.name}
                  </span>
                  <StatusPill tone={item.isToday ? 'gold' : item.daysUntil <= 7 ? 'amber' : 'blue'}>
                    {item.isToday
                      ? 'Hoje! 🎉'
                      : item.isTomorrow
                        ? 'Amanhã'
                        : `${item.formattedDayMonth} (em ${item.daysUntil}d)`}
                  </StatusPill>
                </div>
                <p className="mt-0.5 text-xs text-[#D4D4D8]">
                  <span className="font-semibold text-[#FACC15]">
                    Faz {item.turningAge} anos
                  </span>{' '}
                  · {formatBirthDatePt(item.client.birthDate)}
                </p>
              </div>
              {item.client.phone && (
                <button
                  type="button"
                  onClick={() => sendBirthdayWhatsApp(item)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#143521] border border-[#22C55E]/40 px-3 py-1.5 text-xs font-bold text-[#22C55E] transition hover:bg-[#19452B]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Parabéns
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {missingBirthDateCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#323238] bg-[#161619] px-3 py-2 text-xs text-[#A1A1AA]">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-[#38BDF8]" />
            {missingBirthDateCount} aluno{missingBirthDateCount === 1 ? '' : 's'} ainda sem data de nascimento ·{' '}
            {reminderActive
              ? `lembrete ativo (${reminderDaysLeft}d restantes)`
              : 'lembrete de 30 dias expirado'}
          </span>
          {!reminderActive && onRenewReminder && (
            <button
              type="button"
              disabled={renewing}
              onClick={async () => {
                setRenewing(true);
                try {
                  await onRenewReminder();
                } finally {
                  setRenewing(false);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-[#242429] px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:bg-[#2F2F36]"
            >
              <RefreshCw className="h-3 w-3" />
              {renewing ? 'A renovar...' : 'Renovar +30 dias'}
            </button>
          )}
        </div>
      )}
    </BrandCard>
  );
};

// --- 6. PT Training Tab: Recent Post-Workout Feedback List for Selected Student ---
export const PtRecentFeedbackCard: React.FC<{
  clientName: string;
  feedbackItems: WorkoutFeedbackRecord[];
  onDelete?: (id: string) => Promise<void>;
}> = ({ clientName, feedbackItems, onDelete }) => {
  if (feedbackItems.length === 0) return null;

  const feelingMeta = (feeling: WorkoutFeedbackFeeling) => {
    if (feeling === 'LEVE') return { label: 'Leve', tone: 'green' as const };
    if (feeling === 'PESADO') return { label: 'Pesado', tone: 'red' as const };
    return { label: 'Ideal', tone: 'gold' as const };
  };

  return (
    <BrandCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3D3314] text-[#EAB308]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#F4F4F5]">
              Feedback Pós-Treino — {clientName}
            </h4>
            <p className="text-[11px] text-[#A1A1AA]">
              Últimos {Math.min(feedbackItems.length, 6)} registos de esforço (RPE)
            </p>
          </div>
        </div>
        <StatusPill tone="neutral">{feedbackItems.length}</StatusPill>
      </div>

      <div className="space-y-2">
        {feedbackItems.slice(0, 6).map((fb) => {
          const meta = feelingMeta(fb.feeling);
          return (
            <div
              key={fb.id}
              className="rounded-xl border border-[#323238] bg-[#242429]/60 p-3 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  <StatusPill tone={fb.rpe >= 9 ? 'red' : fb.rpe >= 6 ? 'gold' : 'green'}>
                    RPE {fb.rpe}/10
                  </StatusPill>
                  <span className="text-xs font-bold text-[#F4F4F5]">{fb.planTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A1A1AA]">
                    {formatShortDate(fb.timestampMillis)}
                  </span>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(fb.id)}
                      title="Apagar feedback"
                      className="rounded-lg p-1 text-[#71717A] hover:bg-[#3B1518] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {fb.note && (
                <p className="text-xs italic text-[#D4D4D8]">“{fb.note}”</p>
              )}
            </div>
          );
        })}
      </div>
    </BrandCard>
  );
};
