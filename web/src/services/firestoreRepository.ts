import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  DocumentReference,
  Query,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AnnouncementReadRecord,
  AttendanceStatus,
  BookingRecord,
  ChatMessageRecord,
  ClientRecord,
  ExerciseRecord,
  FidelizacaoRecord,
  FoodItemRecord,
  ImportResult,
  MealTypeKey,
  MessageTemplateRecord,
  NutritionEntryRecord,
  PaymentRecord,
  PhysicalAssessmentRecord,
  PtAccountRecord,
  PtAccountStatus,
  PtNotificationRecord,
  PtNotificationType,
  StudioAnnouncementRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingType,
  TrainingWeekRecord,
  WaitlistEntryRecord,
  WeekResponseRecord,
  WorkoutFeedbackFeeling,
  WorkoutFeedbackRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
  isSuperAdminEmail,
} from '../types/studio';
import {
  buildConsecutiveMonths,
  calculateBmi,
  calculateBmrMifflinStJeor,
  createSessionModel,
  DEFAULT_EXERCISES,
  DEFAULT_FOODS,
  DEFAULT_TEMPLATES,
  DEFAULT_WEB_BASE_URL,
  formatWeekKey,
  formatWeekRangeLabel,
  generatePortalCode,
  getEffectiveCutoffMinutes,
  getEffectiveReminderLeadMinutes,
  normalizeFixedSlots,
  parseFixedSlot,
  getMondayOfWeek,
  isValidPortuguesePhone,
  normalizePaymentMethod,
  normalizePortuguesePhone,
  splitAmountAcrossMonths,
} from '../data/seedCatalog';

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

function subcol(uid: string, name: string) {
  return collection(userDoc(uid), name);
}

export interface StudioStreams {
  clients: (items: ClientRecord[]) => void;
  weeks: (items: TrainingWeekRecord[]) => void;
  sessions: (items: TrainingSessionRecord[]) => void;
  bookings: (items: BookingRecord[]) => void;
  weekResponses: (items: WeekResponseRecord[]) => void;
  payments: (items: PaymentRecord[]) => void;
  fidelizacoes: (items: FidelizacaoRecord[]) => void;
  exercises: (items: ExerciseRecord[]) => void;
  workoutPlans: (items: WorkoutPlanRecord[]) => void;
  workoutPlanItems: (items: WorkoutPlanItemRecord[]) => void;
  foods: (items: FoodItemRecord[]) => void;
  nutritionEntries: (items: NutritionEntryRecord[]) => void;
  physicalAssessments: (items: PhysicalAssessmentRecord[]) => void;
  chatMessages: (items: ChatMessageRecord[]) => void;
  templates: (items: MessageTemplateRecord[]) => void;
  ptNotifications?: (items: PtNotificationRecord[]) => void;
  workoutLoadLogs?: (items: WorkoutLoadLogRecord[]) => void;
  waitlistEntries?: (items: WaitlistEntryRecord[]) => void;
  studioAnnouncements?: (items: StudioAnnouncementRecord[]) => void;
  announcementReads?: (items: AnnouncementReadRecord[]) => void;
  workoutFeedback?: (items: WorkoutFeedbackRecord[]) => void;
  settings: (item: StudioSettingsRecord | null) => void;
  onError: (err: Error) => void;
}

export interface StudioSubscriptionOptions {
  includePayments?: boolean;
  includePtNotifications?: boolean;
  includeTemplates?: boolean;
  includeExercises?: boolean;
  scopedClientId?: string | null;
  minimalAuthOnly?: boolean;
}

function mergeExercisesWithDefaults(uid: string, customItems: ExerciseRecord[]): ExerciseRecord[] {
  const byId = new Map<string, ExerciseRecord>();
  DEFAULT_EXERCISES.forEach((ex) => {
    byId.set(ex.id, { ...ex, userId: uid, custom: false });
  });
  customItems.forEach((ex) => {
    byId.set(ex.id, ex);
  });
  return Array.from(byId.values()).sort(
    (a, b) => a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)
  );
}

function mergeFoodsWithDefaults(uid: string, customItems: FoodItemRecord[]): FoodItemRecord[] {
  const byId = new Map<string, FoodItemRecord>();
  DEFAULT_FOODS.forEach((fd) => {
    byId.set(fd.id, { ...fd, userId: uid, custom: false });
  });
  customItems.forEach((fd) => {
    byId.set(fd.id, fd);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeStudioData(
  uid: string,
  handlers: StudioStreams,
  options: StudioSubscriptionOptions = {}
): () => void {
  const {
    includePayments = true,
    includePtNotifications = false,
    includeTemplates = true,
    includeExercises = true,
    scopedClientId = null,
    minimalAuthOnly = false,
  } = options;
  const unsubs: Unsubscribe[] = [];

  const listenQuery = <T>(
    source: Query,
    mapper: (id: string, data: Record<string, unknown>) => T,
    sort: (list: T[]) => T[],
    cb: (list: T[]) => void
  ) => {
    unsubs.push(
      onSnapshot(
        source,
        (snap) => {
          const list = snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
          cb(sort(list));
        },
        (err) => handlers.onError(err)
      )
    );
  };

  const listen = <T>(
    name: string,
    mapper: (id: string, data: Record<string, unknown>) => T,
    sort: (list: T[]) => T[],
    cb: (list: T[]) => void,
    filterByClient = false
  ) => {
    const colRef = subcol(uid, name);
    const source =
      filterByClient && scopedClientId
        ? query(colRef, where('clientId', '==', scopedClientId))
        : colRef;
    listenQuery(source, mapper, sort, cb);
  };

  // Always subscribe to clients & studio settings (required for login/role/portal resolution)
  listen<ClientRecord>(
    'clients',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      name: String(d.name ?? ''),
      phone: String(d.phone ?? ''),
      notes: String(d.notes ?? ''),
      active: Boolean(d.active ?? true),
      newClient: Boolean(d.newClient ?? false),
      monthlyFeeEur: Number(d.monthlyFeeEur ?? 0),
      fidelizacaoMonths: Number(d.fidelizacaoMonths ?? 0),
      fidelizacaoStartMillis: Number(d.fidelizacaoStartMillis ?? 0),
      trainingType: d.trainingType === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'GRUPO',
      weeklySessionLimit: Number(d.weeklySessionLimit ?? 0),
      fixedSlots: Array.isArray(d.fixedSlots)
        ? normalizeFixedSlots(d.fixedSlots.map(String))
        : [],
      loginPinHash: typeof d.loginPinHash === 'string' ? d.loginPinHash : '',
      birthDate: typeof d.birthDate === 'string' ? d.birthDate : '',
      weeklyGoalSessions: Number(d.weeklyGoalSessions ?? 0),
    }),
    (list) =>
      list.sort((a, b) => {
        if (a.newClient !== b.newClient) return a.newClient ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }),
    handlers.clients
  );

  unsubs.push(
    onSnapshot(
      doc(subcol(uid, 'settings'), 'studio'),
      (snap) => {
        if (!snap.exists()) {
          handlers.settings(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        handlers.settings({
          id: snap.id,
          userId: String(d.userId ?? uid),
          clientsCanEdit: Boolean(d.clientsCanEdit ?? true),
          cutoffHours: Number(d.cutoffHours ?? 0),
          cutoffMinutes:
            d.cutoffMinutes !== undefined ? Number(d.cutoffMinutes) : undefined,
          reminderLeadMinutes:
            d.reminderLeadMinutes !== undefined ? Number(d.reminderLeadMinutes) : undefined,
          whatsappWebMode: Boolean(d.whatsappWebMode ?? false),
          siteBaseUrl: String(d.siteBaseUrl ?? window.location.origin ?? DEFAULT_WEB_BASE_URL),
          studentPortalCode: String(d.studentPortalCode ?? ''),
          ptWhatsappPhone: String(d.ptWhatsappPhone ?? ''),
          birthDateReminderUntilMillis: Number(d.birthDateReminderUntilMillis ?? 0),
          seeded: Boolean(d.seeded ?? false),
        });
      },
      (err) => handlers.onError(err)
    )
  );

  // Before an external student picks their phone/profile, don't read any other collections
  if (minimalAuthOnly) {
    handlers.weeks([]);
    handlers.sessions([]);
    handlers.bookings([]);
    handlers.weekResponses([]);
    handlers.payments([]);
    handlers.fidelizacoes([]);
    handlers.exercises([]);
    handlers.workoutPlans([]);
    handlers.workoutPlanItems([]);
    handlers.foods(mergeFoodsWithDefaults(uid, []));
    handlers.nutritionEntries([]);
    handlers.physicalAssessments([]);
    handlers.chatMessages([]);
    handlers.templates([]);
    handlers.ptNotifications?.([]);
    handlers.workoutLoadLogs?.([]);
    handlers.waitlistEntries?.([]);
    handlers.studioAnnouncements?.([]);
    handlers.announcementReads?.([]);
    handlers.workoutFeedback?.([]);
    return () => unsubs.forEach((u) => u());
  }

  listen<TrainingWeekRecord>(
    'weeks',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      weekKey: String(d.weekKey ?? id),
      label: String(d.label ?? ''),
      startDateMillis: Number(d.startDateMillis ?? 0),
      published: Boolean(d.published ?? false),
    }),
    (list) => list.sort((a, b) => a.startDateMillis - b.startDateMillis),
    handlers.weeks
  );

  listen<TrainingSessionRecord>(
    'sessions',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      weekKey: String(d.weekKey ?? ''),
      dayOfWeek: Number(d.dayOfWeek ?? 1),
      dateLabel: String(d.dateLabel ?? ''),
      timeLabel: String(d.timeLabel ?? '18:00'),
      durationMinutes: Number(d.durationMinutes ?? 60),
      capacity: Number(d.capacity ?? 6),
      note: String(d.note ?? ''),
      startMillis: Number(d.startMillis ?? 0),
      ptPrivatePersonal: Boolean(d.ptPrivatePersonal ?? false),
    }),
    (list) => list.sort((a, b) => a.startMillis - b.startMillis),
    handlers.sessions
  );

  listen<BookingRecord>(
    'bookings',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      sessionId: String(d.sessionId ?? ''),
      weekKey: String(d.weekKey ?? ''),
      clientId: String(d.clientId ?? ''),
      status: (String(d.status ?? 'PENDING') as BookingRecord['status']),
      attendanceStatus:
        d.attendanceStatus === 'PRESENT' ||
        d.attendanceStatus === 'ABSENT' ||
        d.attendanceStatus === 'PENDING'
          ? d.attendanceStatus
          : '',
      requestedAtMillis: Number(d.requestedAtMillis ?? 0),
    }),
    (list) => list.sort((a, b) => a.requestedAtMillis - b.requestedAtMillis),
    handlers.bookings
  );

  listen<WeekResponseRecord>(
    'week_responses',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      weekKey: String(d.weekKey ?? ''),
      clientId: String(d.clientId ?? ''),
      status: (String(d.status ?? 'UNAVAILABLE') as 'UNAVAILABLE' | 'REMINDED'),
    }),
    (list) => list,
    handlers.weekResponses,
    true
  );

  if (includePayments) {
    listen<PaymentRecord>(
      'payments',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        clientId: String(d.clientId ?? ''),
        monthYear: String(d.monthYear ?? ''),
        monthLabel: String(d.monthLabel ?? ''),
        amountEur: Number(d.amountEur ?? 0),
        paid: Boolean(d.paid ?? true),
        paidAtMillis: Number(d.paidAtMillis ?? 0),
        note: String(d.note ?? ''),
      }),
      (list) => list.sort((a, b) => b.paidAtMillis - a.paidAtMillis),
      handlers.payments,
      true
    );
  } else {
    handlers.payments([]);
  }

  listen<FidelizacaoRecord>(
    'fidelizacoes',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      durationMonths: (Number(d.durationMonths) === 12 ? 12 : 6),
      startDateMillis: Number(d.startDateMillis ?? 0),
      endDateMillis: Number(d.endDateMillis ?? 0),
      notes: String(d.notes ?? ''),
    }),
    (list) => list.sort((a, b) => a.endDateMillis - b.endDateMillis),
    handlers.fidelizacoes,
    true
  );

  // Exercises: bundled 385-exercise catalog is served locally; only PT custom exercises are read from Firestore
  if (includeExercises) {
    listenQuery<ExerciseRecord>(
      query(subcol(uid, 'exercises'), where('custom', '==', true)),
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        name: String(d.name ?? ''),
        muscleGroup: String(d.muscleGroup ?? ''),
        equipment: String(d.equipment ?? ''),
        instructions: String(d.instructions ?? ''),
        custom: Boolean(d.custom ?? true),
      }),
      (customList) => mergeExercisesWithDefaults(uid, customList),
      handlers.exercises
    );
  } else {
    handlers.exercises([]);
  }

  listen<WorkoutPlanRecord>(
    'workout_plans',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      title: String(d.title ?? ''),
      splitLabel: String(d.splitLabel ?? ''),
      availableFromDate: typeof d.availableFromDate === 'string' ? d.availableFromDate : '',
      createdAtMillis: Number(d.createdAtMillis ?? 0),
    }),
    (list) => list.sort((a, b) => b.createdAtMillis - a.createdAtMillis),
    handlers.workoutPlans,
    true
  );

  listen<WorkoutPlanItemRecord>(
    'workout_plan_items',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      planId: String(d.planId ?? ''),
      exerciseId: String(d.exerciseId ?? ''),
      exerciseName: String(d.exerciseName ?? ''),
      muscleGroup: String(d.muscleGroup ?? ''),
      sets: Number(d.sets ?? 3),
      reps: String(d.reps ?? '10-12'),
      loadKg: String(d.loadKg ?? ''),
      lastLoadKg: typeof d.lastLoadKg === 'string' ? d.lastLoadKg : '',
      lastLoggedAtMillis: Number(d.lastLoggedAtMillis ?? 0),
      restSeconds: Number(d.restSeconds ?? 90),
      notes: String(d.notes ?? ''),
      orderIndex: Number(d.orderIndex ?? 0),
    }),
    (list) => list.sort((a, b) => a.orderIndex - b.orderIndex),
    handlers.workoutPlanItems
  );

  // Foods: bundled ~380-food catalog is served locally; only custom foods are read from Firestore
  listenQuery<FoodItemRecord>(
    query(subcol(uid, 'foods'), where('custom', '==', true)),
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      name: String(d.name ?? ''),
      category: String(d.category ?? ''),
      kcalPer100g: Number(d.kcalPer100g ?? 0),
      proteinPer100g: Number(d.proteinPer100g ?? 0),
      carbsPer100g: Number(d.carbsPer100g ?? 0),
      fatPer100g: Number(d.fatPer100g ?? 0),
      custom: Boolean(d.custom ?? true),
    }),
    (customList) => mergeFoodsWithDefaults(uid, customList),
    handlers.foods
  );

  listen<NutritionEntryRecord>(
    'nutrition_entries',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      mealType: (String(d.mealType ?? 'ALMOCO') as MealTypeKey),
      foodId: String(d.foodId ?? ''),
      foodName: String(d.foodName ?? ''),
      grams: Number(d.grams ?? 0),
      kcal: Number(d.kcal ?? 0),
      protein: Number(d.protein ?? 0),
      carbs: Number(d.carbs ?? 0),
      fat: Number(d.fat ?? 0),
    }),
    (list) => list,
    handlers.nutritionEntries,
    true
  );

  listen<PhysicalAssessmentRecord>(
    'physical_assessments',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      dateMillis: Number(d.dateMillis ?? 0),
      weightKg: Number(d.weightKg ?? 0),
      ageYears: Number(d.ageYears ?? 25),
      heightCm: Number(d.heightCm ?? 170),
      sex: (String(d.sex) === 'F' ? 'F' : 'M'),
      bodyFatPct: Number(d.bodyFatPct ?? 0),
      muscleMassKg: Number(d.muscleMassKg ?? 0),
      visceralFat: Number(d.visceralFat ?? 0),
      bmi: Number(d.bmi ?? 0),
      bmrKcal: Number(d.bmrKcal ?? 0),
      notes: String(d.notes ?? ''),
    }),
    (list) => list.sort((a, b) => a.dateMillis - b.dateMillis),
    handlers.physicalAssessments,
    true
  );

  listen<ChatMessageRecord>(
    'chat_messages',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      senderRole: (String(d.senderRole) === 'STUDENT' ? 'STUDENT' : 'PT'),
      text: String(d.text ?? ''),
      timestampMillis: Number(d.timestampMillis ?? 0),
      deliveredAtMillis: Number(d.deliveredAtMillis ?? 0),
      readAtMillis: Number(d.readAtMillis ?? 0),
    }),
    (list) => list.sort((a, b) => a.timestampMillis - b.timestampMillis),
    handlers.chatMessages,
    true
  );

  if (includeTemplates) {
    listen<MessageTemplateRecord>(
      'templates',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        templateKey: String(d.templateKey ?? id),
        title: String(d.title ?? ''),
        description: String(d.description ?? ''),
        body: String(d.body ?? ''),
        defaultBody: String(d.defaultBody ?? ''),
      }),
      (list) => list,
      handlers.templates
    );
  } else {
    handlers.templates([]);
  }

  if (includePtNotifications && handlers.ptNotifications) {
    listen<PtNotificationRecord>(
      'pt_notifications',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        clientId: String(d.clientId ?? ''),
        clientName: String(d.clientName ?? ''),
        type:
          d.type === 'CANCELLED' ||
          d.type === 'UNAVAILABLE' ||
          d.type === 'ASSESSMENT' ||
          d.type === 'CHAT' ||
          d.type === 'FEEDBACK'
            ? d.type
            : 'ALTERED',
        summary: String(d.summary ?? ''),
        weekKey: String(d.weekKey ?? ''),
        read: Boolean(d.read ?? false),
        timestampMillis: Number(d.timestampMillis ?? 0),
      }),
      (list) => list.sort((a, b) => b.timestampMillis - a.timestampMillis),
      handlers.ptNotifications
    );
  } else if (handlers.ptNotifications) {
    handlers.ptNotifications([]);
  }

  if (handlers.workoutLoadLogs) {
    listen<WorkoutLoadLogRecord>(
      'workout_load_logs',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        clientId: String(d.clientId ?? ''),
        planId: String(d.planId ?? ''),
        planItemId: String(d.planItemId ?? ''),
        exerciseId: String(d.exerciseId ?? ''),
        exerciseName: String(d.exerciseName ?? ''),
        loadKg: String(d.loadKg ?? ''),
        numericKg: Number(d.numericKg ?? 0),
        loggedAtMillis: Number(d.loggedAtMillis ?? 0),
      }),
      (list) => list.sort((a, b) => a.loggedAtMillis - b.loggedAtMillis),
      handlers.workoutLoadLogs,
      true
    );
  }

  if (handlers.waitlistEntries) {
    listen<WaitlistEntryRecord>(
      'waitlist_entries',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        sessionId: String(d.sessionId ?? ''),
        weekKey: String(d.weekKey ?? ''),
        clientId: String(d.clientId ?? ''),
        createdAtMillis: Number(d.createdAtMillis ?? 0),
      }),
      (list) => list.sort((a, b) => a.createdAtMillis - b.createdAtMillis),
      handlers.waitlistEntries
    );
  }

  if (handlers.studioAnnouncements) {
    listen<StudioAnnouncementRecord>(
      'studio_announcements',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        title: String(d.title ?? ''),
        message: String(d.message ?? ''),
        durationDays: Number(d.durationDays ?? 7),
        createdAtMillis: Number(d.createdAtMillis ?? 0),
        expiresAtMillis: Number(d.expiresAtMillis ?? 0),
        active: Boolean(d.active ?? true),
      }),
      (list) => list.sort((a, b) => b.createdAtMillis - a.createdAtMillis),
      handlers.studioAnnouncements
    );
  }

  if (handlers.announcementReads) {
    listen<AnnouncementReadRecord>(
      'announcement_reads',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        announcementId: String(d.announcementId ?? ''),
        clientId: String(d.clientId ?? ''),
        clientName: String(d.clientName ?? ''),
        readAtMillis: Number(d.readAtMillis ?? 0),
      }),
      (list) => list.sort((a, b) => b.readAtMillis - a.readAtMillis),
      handlers.announcementReads,
      true
    );
  }

  if (handlers.workoutFeedback) {
    listen<WorkoutFeedbackRecord>(
      'workout_feedback',
      (id, d) => ({
        id,
        userId: String(d.userId ?? uid),
        clientId: String(d.clientId ?? ''),
        clientName: String(d.clientName ?? ''),
        planId: String(d.planId ?? ''),
        planTitle: String(d.planTitle ?? ''),
        rpe: Number(d.rpe ?? 7),
        feeling:
          d.feeling === 'LEVE' || d.feeling === 'PESADO' ? d.feeling : 'IDEAL',
        note: String(d.note ?? ''),
        timestampMillis: Number(d.timestampMillis ?? 0),
      }),
      (list) => list.sort((a, b) => b.timestampMillis - a.timestampMillis),
      handlers.workoutFeedback,
      true
    );
  }

  return () => unsubs.forEach((u) => u());
}

// --- PT Accounts & Admin Approval ---
function mapPtAccount(id: string, d: Record<string, unknown>): PtAccountRecord {
  const rawStatus = String(d.status ?? 'PENDING');
  const status: PtAccountStatus =
    rawStatus === 'APPROVED' || rawStatus === 'REJECTED' ? rawStatus : 'PENDING';
  return {
    id,
    uid: String(d.uid ?? id),
    email: String(d.email ?? ''),
    displayName: String(d.displayName ?? ''),
    status,
    isAdmin: Boolean(d.isAdmin ?? false),
    requestedAtMillis: Number(d.requestedAtMillis ?? 0),
    reviewedAtMillis: Number(d.reviewedAtMillis ?? 0),
  };
}

export async function ensurePtAccount(
  uid: string,
  email: string,
  displayName: string
): Promise<PtAccountRecord> {
  const cleanEmail = email.trim().toLowerCase();
  const isAdmin = isSuperAdminEmail(cleanEmail);
  const ref = doc(db, 'pt_accounts', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return mapPtAccount(snap.id, snap.data() as Record<string, unknown>);
  }
  const now = Date.now();
  const status: PtAccountStatus = isAdmin ? 'APPROVED' : 'PENDING';
  const safeName = (displayName.trim() || cleanEmail.split('@')[0] || 'Personal Trainer').slice(0, 120);
  await setDoc(ref, {
    uid,
    email: cleanEmail.slice(0, 160),
    displayName: safeName,
    status,
    isAdmin,
    requestedAtMillis: now,
    reviewedAtMillis: isAdmin ? now : 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: uid,
    uid,
    email: cleanEmail,
    displayName: safeName,
    status,
    isAdmin,
    requestedAtMillis: now,
    reviewedAtMillis: isAdmin ? now : 0,
  };
}

export function subscribeOwnPtAccount(
  uid: string,
  cb: (account: PtAccountRecord | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'pt_accounts', uid),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb(mapPtAccount(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err)
  );
}

export function subscribeAllPtAccounts(
  cb: (accounts: PtAccountRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'pt_accounts'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapPtAccount(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const rank = (s: PtAccountStatus) => (s === 'PENDING' ? 0 : s === 'APPROVED' ? 1 : 2);
          return rank(a.status) - rank(b.status) || b.requestedAtMillis - a.requestedAtMillis;
        });
      cb(list);
    },
    (err) => onError?.(err)
  );
}

export async function reviewPtAccount(
  ptUid: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<void> {
  await updateDoc(doc(db, 'pt_accounts', ptUid), {
    status,
    reviewedAtMillis: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

// --- PT Notifications (Cancelamentos & Alterações) ---
export async function createPtNotification(
  uid: string,
  payload: {
    clientId: string;
    clientName: string;
    type: PtNotificationType;
    summary: string;
    weekKey: string;
  }
): Promise<void> {
  await setDoc(doc(subcol(uid, 'pt_notifications')), {
    userId: uid,
    clientId: payload.clientId.slice(0, 128),
    clientName: payload.clientName.trim().slice(0, 100) || 'Aluno',
    type: payload.type,
    summary: payload.summary.trim().slice(0, 400),
    weekKey: payload.weekKey.slice(0, 30),
    read: false,
    timestampMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markPtNotificationRead(uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(subcol(uid, 'pt_notifications'), notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

export async function markAllPtNotificationsRead(
  uid: string,
  notifications: PtNotificationRecord[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(subcol(uid, 'pt_notifications'), n.id), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function deletePtNotification(uid: string, notificationId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'pt_notifications'), notificationId));
}

async function commitWrites(writes: Array<[DocumentReference, Record<string, unknown>]>) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach(([ref, payload]) => batch.set(ref, payload));
    await batch.commit();
  }
}

export async function ensureSeeded(uid: string, isSuperAdmin = false): Promise<void> {
  const settingsRef = doc(subcol(uid, 'settings'), 'studio');
  const settingsSnap = await getDoc(settingsRef);
  const now = Date.now();
  const dayMs = 86_400_000;

  if (settingsSnap.exists() && settingsSnap.data()?.seeded === true) {
    // Already seeded: avoid scanning exercises/foods/assessments (static catalogs are bundled locally)
    const settingsData = settingsSnap.data();
    const currentCode = settingsData?.studentPortalCode;
    const missingPortalCode = typeof currentCode !== 'string' || currentCode.length < 8;
    const missingCutoffMinutes = settingsData?.cutoffMinutes === undefined;
    const missingReminderLeadMinutes = settingsData?.reminderLeadMinutes === undefined;
    const savedBaseUrl = typeof settingsData?.siteBaseUrl === 'string' ? settingsData.siteBaseUrl : '';
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const shouldSyncNewShapeDomain =
      currentOrigin === DEFAULT_WEB_BASE_URL &&
      savedBaseUrl !== DEFAULT_WEB_BASE_URL &&
      savedBaseUrl.includes('.vercel.app');
    if (
      missingPortalCode ||
      missingCutoffMinutes ||
      missingReminderLeadMinutes ||
      shouldSyncNewShapeDomain
    ) {
      await updateDoc(settingsRef, {
        updatedAt: serverTimestamp(),
        ...(missingPortalCode ? { studentPortalCode: generatePortalCode() } : {}),
        ...(missingCutoffMinutes ? { cutoffMinutes: 15, cutoffHours: 0 } : {}),
        ...(missingReminderLeadMinutes ? { reminderLeadMinutes: 60 } : {}),
        ...(shouldSyncNewShapeDomain ? { siteBaseUrl: DEFAULT_WEB_BASE_URL } : {}),
      });
    }
    return;
  }

  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

  // Default exercises and foods are bundled locally in the app (only custom items are written to Firestore)
  DEFAULT_TEMPLATES.forEach((tpl) => {
    writes.push([
      doc(subcol(uid, 'templates'), tpl.templateKey),
      {
        userId: uid,
        templateKey: tpl.templateKey,
        title: tpl.title,
        description: tpl.description,
        body: tpl.body,
        defaultBody: tpl.defaultBody,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  const sampleClients = [
    { id: 'client_ana', name: 'Ana Ribeiro', phone: '912345678', notes: 'Objetivo: recomposição corporal · Manhãs/18h', newClient: false, fee: 120, fidM: 12, fidStart: now - 60 * dayMs, trainingType: 'PERSONALIZADO' as TrainingType },
    { id: 'client_bruno', name: 'Bruno Costa', phone: '912345602', notes: 'Lesão antiga joelho direito — evitar impacto', newClient: false, fee: 95, fidM: 6, fidStart: now - 145 * dayMs, trainingType: 'GRUPO' as TrainingType },
    { id: 'client_eva', name: 'Eva Martins', phone: '912345605', notes: 'Treino força 3x/semana', newClient: false, fee: 120, fidM: 12, fidStart: now - 30 * dayMs, trainingType: 'PERSONALIZADO' as TrainingType },
    { id: 'client_filipe', name: 'Filipe Sousa', phone: '912345606', notes: '', newClient: false, fee: 110, fidM: 0, fidStart: 0, trainingType: 'GRUPO' as TrainingType },
    { id: 'client_hugo', name: 'Hugo Pereira', phone: '912345608', notes: 'Horário pós-laboral', newClient: false, fee: 95, fidM: 0, fidStart: 0, trainingType: 'GRUPO' as TrainingType },
    { id: 'client_joao', name: 'João Almeida', phone: '912345610', notes: '', newClient: true, fee: 100, fidM: 0, fidStart: 0, trainingType: 'GRUPO' as TrainingType },
  ];

  sampleClients.forEach((c) => {
    writes.push([
      doc(subcol(uid, 'clients'), c.id),
      {
        userId: uid,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        active: true,
        newClient: c.newClient,
        monthlyFeeEur: c.fee,
        fidelizacaoMonths: c.fidM,
        fidelizacaoStartMillis: Math.round(c.fidStart),
        trainingType: c.trainingType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  const monday1 = getMondayOfWeek(new Date());
  const monday2 = new Date(monday1);
  monday2.setDate(monday2.getDate() + 7);
  const weekKey1 = formatWeekKey(monday1);
  const weekKey2 = formatWeekKey(monday2);

  writes.push([
    doc(subcol(uid, 'weeks'), weekKey1),
    {
      userId: uid,
      weekKey: weekKey1,
      label: formatWeekRangeLabel(monday1),
      startDateMillis: monday1.getTime(),
      published: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ]);

  writes.push([
    doc(subcol(uid, 'weeks'), weekKey2),
    {
      userId: uid,
      weekKey: weekKey2,
      label: formatWeekRangeLabel(monday2),
      startDateMillis: monday2.getTime(),
      published: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ]);

  const sampleSessions = [
    ['ses_1', createSessionModel(uid, weekKey1, monday1.getTime(), 1, 18, 0, 60, 6, '')],
    ['ses_2', createSessionModel(uid, weekKey1, monday1.getTime(), 1, 19, 0, 60, 6, '')],
    ['ses_3', createSessionModel(uid, weekKey1, monday1.getTime(), 2, 7, 30, 45, 5, 'Treino de mobilidade')],
    ['ses_4', createSessionModel(uid, weekKey1, monday1.getTime(), 2, 19, 0, 60, 6, '')],
    ['ses_5', createSessionModel(uid, weekKey1, monday1.getTime(), 3, 18, 0, 60, 6, '')],
    ['ses_6', createSessionModel(uid, weekKey1, monday1.getTime(), 3, 19, 0, 60, 6, 'Treino ao ar livre')],
    ['ses_7', createSessionModel(uid, weekKey1, monday1.getTime(), 5, 18, 30, 60, 6, '')],
    ['ses_8', createSessionModel(uid, weekKey2, monday2.getTime(), 1, 18, 0, 60, 6, '')],
    ['ses_9', createSessionModel(uid, weekKey2, monday2.getTime(), 3, 18, 0, 60, 6, '')],
    ['ses_10', createSessionModel(uid, weekKey2, monday2.getTime(), 5, 18, 30, 60, 6, '')],
  ] as const;

  sampleSessions.forEach(([sid, s]) => {
    writes.push([
      doc(subcol(uid, 'sessions'), sid),
      {
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  const sampleBookings = [
    ['bk_1', 'ses_1', 'client_ana', 'CONFIRMED', now - 36_000_000],
    ['bk_2', 'ses_5', 'client_ana', 'CONFIRMED', now - 36_000_000],
    ['bk_3', 'ses_6', 'client_bruno', 'CONFIRMED', now - 30_000_000],
    ['bk_4', 'ses_1', 'client_eva', 'PENDING', now - 28_000_000],
    ['bk_5', 'ses_5', 'client_eva', 'PENDING', now - 28_000_000],
    ['bk_6', 'ses_4', 'client_filipe', 'PENDING', now - 20_000_000],
    ['bk_7', 'ses_4', 'client_hugo', 'ALTERED', now - 10_000_000],
    ['bk_8', 'ses_7', 'client_hugo', 'ALTERED', now - 10_000_000],
  ] as const;

  sampleBookings.forEach(([bid, sid, cid, status, ts]) => {
    writes.push([
      doc(subcol(uid, 'bookings'), bid),
      {
        userId: uid,
        sessionId: sid,
        weekKey: weekKey1,
        clientId: cid,
        status,
        requestedAtMillis: Math.round(ts),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  const recentMonths = [
    { my: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, ml: 'Mês Atual' },
  ];
  const dNow = new Date();
  const m0 = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}`;
  const d1 = new Date(dNow.getFullYear(), dNow.getMonth() - 1, 1);
  const m1 = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}`;
  const d2 = new Date(dNow.getFullYear(), dNow.getMonth() - 2, 1);
  const m2 = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
  const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const l0 = `${monthsPt[dNow.getMonth()]} ${dNow.getFullYear()}`;
  const l1 = `${monthsPt[d1.getMonth()]} ${d1.getFullYear()}`;
  const l2 = `${monthsPt[d2.getMonth()]} ${d2.getFullYear()}`;
  void recentMonths;

  if (isSuperAdmin) {
    [
      ['pay_1', 'client_ana', m0, l0, 120, now - dayMs * 5, 'MbWay'],
      ['pay_2', 'client_bruno', m0, l0, 95, now - dayMs * 3, 'João'],
      ['pay_3', 'client_eva', m0, l0, 120, now - dayMs * 2, 'MbWay'],
      ['pay_4', 'client_ana', m1, l1, 120, now - dayMs * 35, 'MbWay'],
      ['pay_5', 'client_bruno', m1, l1, 95, now - dayMs * 34, 'João'],
      ['pay_6', 'client_filipe', m1, l1, 110, now - dayMs * 33, 'Dinheiro'],
      ['pay_7', 'client_ana', m2, l2, 120, now - dayMs * 65, 'MbWay'],
      ['pay_8', 'client_eva', m2, l2, 120, now - dayMs * 62, 'MbWay'],
    ].forEach(([pid, cid, my, ml, amt, paidAt, note]) => {
      writes.push([
        doc(subcol(uid, 'payments'), String(pid)),
        {
          userId: uid,
          clientId: String(cid),
          monthYear: String(my),
          monthLabel: String(ml),
          amountEur: Number(amt),
          paid: true,
          paidAtMillis: Math.round(Number(paidAt)),
          note: String(note),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
    });
  }

  [
    ['fid_1', 'client_ana', 12, now - dayMs * 60, now + dayMs * 305, 'Plano Anual 3x/sem'],
    ['fid_2', 'client_bruno', 6, now - dayMs * 145, now + dayMs * 35, 'Plano Semestral 2x/sem'],
    ['fid_3', 'client_eva', 12, now - dayMs * 30, now + dayMs * 335, 'Plano Anual + Nutrição'],
  ].forEach(([fid, cid, dur, st, end, notes]) => {
    writes.push([
      doc(subcol(uid, 'fidelizacoes'), String(fid)),
      {
        userId: uid,
        clientId: String(cid),
        durationMonths: Number(dur),
        startDateMillis: Math.round(Number(st)),
        endDateMillis: Math.round(Number(end)),
        notes: String(notes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  writes.push([
    doc(subcol(uid, 'workout_plans'), 'wp_ana_1'),
    {
      userId: uid,
      clientId: 'client_ana',
      title: 'Recomposição Corporal',
      splitLabel: 'Treino A · Corpo Inteiro',
      createdAtMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ]);

  [
    ['wpi_1', 'ex_csv_336', 'Agachamento búlgaro', 'Quadríceps', 4, '8-10', '20 kg', 120, 'Controlar descida 3s', 0],
    ['wpi_2', 'ex_csv_309', 'Supino inclinado com halteres', 'Peito', 3, '10-12', '14 kg', 90, '', 1],
    ['wpi_3', 'ex_csv_209', 'Puxada à frente', 'Costas', 3, '10-12', '45 kg', 90, '', 2],
    ['wpi_4', 'ex_csv_267', 'Elevações laterais com halteres', 'Ombros', 3, '12-15', '6 kg', 60, '', 3],
    ['wpi_5', 'ex_csv_68', 'Prancha', 'Core', 3, '45s', 'Corporal', 45, '', 4],
  ].forEach(([id, exId, exName, grp, sets, reps, load, rest, notes, idx]) => {
    writes.push([
      doc(subcol(uid, 'workout_plan_items'), String(id)),
      {
        userId: uid,
        planId: 'wp_ana_1',
        exerciseId: String(exId),
        exerciseName: String(exName),
        muscleGroup: String(grp),
        sets: Number(sets),
        reps: String(reps),
        loadKg: String(load),
        restSeconds: Number(rest),
        notes: String(notes),
        orderIndex: Number(idx),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  [
    ['ne_1', 'PEQUENO_ALMOCO', 'fd_20', 'Flocos de Aveia', 60, 225, 8.1, 36, 4.2],
    ['ne_2', 'PEQUENO_ALMOCO', 'fd_13', 'Whey Protein Concentrada', 30, 120, 23.4, 2.4, 1.8],
    ['ne_3', 'ALMOCO', 'fd_1', 'Peito de Frango Grelhado', 150, 247.5, 46.5, 0, 5.4],
    ['ne_4', 'ALMOCO', 'fd_15', 'Arroz Basmati Cozido', 180, 234, 4.9, 50.4, 0.5],
    ['ne_5', 'LANCHE_TARDE', 'fd_10', 'Queijo Quark 0% MG', 150, 93, 18, 5.3, 0.3],
    ['ne_6', 'LANCHE_TARDE', 'fd_25', 'Banana', 100, 89, 1.1, 23, 0.3],
    ['ne_7', 'JANTAR', 'fd_5', 'Salmão Grelhado', 140, 291.2, 28, 0, 18.2],
    ['ne_8', 'JANTAR', 'fd_17', 'Batata Doce Cozida/Assada', 160, 144, 3.2, 33.6, 0.2],
  ].forEach(([id, meal, fid, fname, g, kcal, p, c, f]) => {
    writes.push([
      doc(subcol(uid, 'nutrition_entries'), String(id)),
      {
        userId: uid,
        clientId: 'client_ana',
        mealType: String(meal),
        foodId: String(fid),
        foodName: String(fname),
        grams: Number(g),
        kcal: Number(kcal),
        protein: Number(p),
        carbs: Number(c),
        fat: Number(f),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  [
    ['chat_1', 'client_ana', 'STUDENT', 'Olá! Posso aumentar 2.5kg no agachamento esta semana?', now - 7_200_000],
    ['chat_2', 'client_ana', 'PT', 'Olá Ana! Sim, se fizeres as 8 repetições limpas na primeira série, sobe para 52.5 kg 💪', now - 5_400_000],
    ['chat_3', 'client_eva', 'STUDENT', 'Já marquei os treinos desta semana na agenda!', now - 3_600_000],
  ].forEach(([id, cid, role, txt, ts]) => {
    writes.push([
      doc(subcol(uid, 'chat_messages'), String(id)),
      {
        userId: uid,
        clientId: String(cid),
        senderRole: String(role),
        text: String(txt),
        timestampMillis: Math.round(Number(ts)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  [
    ['pa_ana_1', now - dayMs * 60, 68.5, 29, 166, 'F' as const, 26.8, 36.6, 6.0, 'Avaliação inicial'],
    ['pa_ana_2', now - dayMs * 30, 66.8, 29, 166, 'F' as const, 24.9, 38.2, 5.5, 'Boa evolução de força'],
    ['pa_ana_3', now - dayMs * 2, 65.4, 29, 166, 'F' as const, 23.2, 39.8, 5.0, 'Recomposição corporal consistente'],
  ].forEach(([id, dt, w, age, h, sex, fat, muscle, visc, notes]) => {
    writes.push([
      doc(subcol(uid, 'physical_assessments'), String(id)),
      {
        userId: uid,
        clientId: 'client_ana',
        dateMillis: Math.round(Number(dt)),
        weightKg: Number(w),
        ageYears: Math.round(Number(age)),
        heightCm: Number(h),
        sex: String(sex),
        bodyFatPct: Number(fat),
        muscleMassKg: Number(muscle),
        visceralFat: Number(visc),
        bmi: calculateBmi(Number(w), Number(h)),
        bmrKcal: calculateBmrMifflinStJeor(Number(w), Number(h), Number(age), sex as 'M' | 'F'),
        notes: String(notes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  writes.push([
    settingsRef,
    {
      userId: uid,
      clientsCanEdit: true,
      cutoffHours: 0,
      cutoffMinutes: 15,
      reminderLeadMinutes: 60,
      whatsappWebMode: false,
      siteBaseUrl: window.location.origin || DEFAULT_WEB_BASE_URL,
      studentPortalCode: generatePortalCode(),
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ]);

  await commitWrites(writes);
}

// --- Clients ---
export async function addClient(
  uid: string,
  payload: {
    name: string;
    phone: string;
    notes: string;
    newClient?: boolean;
    monthlyFeeEur?: number;
    fidelizacaoMonths?: number;
    fidelizacaoStartMillis?: number;
    trainingType?: TrainingType;
    weeklySessionLimit?: number;
    loginPinHash?: string;
    birthDate?: string;
    weeklyGoalSessions?: number;
  }
): Promise<string> {
  const ref = doc(subcol(uid, 'clients'));
  const docData: Record<string, unknown> = {
    userId: uid,
    name: payload.name.trim().slice(0, 100),
    phone: normalizePortuguesePhone(payload.phone),
    notes: payload.notes.trim().slice(0, 500),
    active: true,
    newClient: Boolean(payload.newClient ?? false),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (payload.monthlyFeeEur !== undefined) {
    docData.monthlyFeeEur = Math.max(0, Math.min(100000, payload.monthlyFeeEur));
  }
  if (payload.fidelizacaoMonths !== undefined) {
    docData.fidelizacaoMonths =
      payload.fidelizacaoMonths === 6 || payload.fidelizacaoMonths === 12
        ? payload.fidelizacaoMonths
        : 0;
  }
  if (payload.fidelizacaoStartMillis !== undefined) {
    docData.fidelizacaoStartMillis = Math.max(0, Math.round(payload.fidelizacaoStartMillis));
  }
  if (payload.trainingType !== undefined) {
    docData.trainingType =
      payload.trainingType === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'GRUPO';
  }
  if (payload.weeklySessionLimit !== undefined) {
    docData.weeklySessionLimit = Math.max(
      0,
      Math.min(21, Math.round(payload.weeklySessionLimit))
    );
  }
  const cleanPinHash = (payload.loginPinHash || '').trim().slice(0, 160);
  if (cleanPinHash) {
    docData.loginPinHash = cleanPinHash;
  }
  const cleanBirthDate = (payload.birthDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanBirthDate)) {
    docData.birthDate = cleanBirthDate;
  }
  if (payload.weeklyGoalSessions !== undefined) {
    docData.weeklyGoalSessions = Math.max(0, Math.min(14, Math.round(payload.weeklyGoalSessions)));
  }
  await setDoc(ref, docData);
  return ref.id;
}

export async function updateClient(uid: string, client: ClientRecord): Promise<void> {
  const fidMonths = client.fidelizacaoMonths === 6 || client.fidelizacaoMonths === 12 ? client.fidelizacaoMonths : 0;
  const trainingType: TrainingType = client.trainingType === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'GRUPO';
  const weeklySessionLimit = Math.max(0, Math.min(21, Math.round(client.weeklySessionLimit ?? 0)));
  const weeklyGoalSessions = Math.max(0, Math.min(14, Math.round(client.weeklyGoalSessions ?? 0)));
  const rawBirth = (client.birthDate || '').trim();
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(rawBirth) ? rawBirth : '';
  await updateDoc(doc(subcol(uid, 'clients'), client.id), {
    name: client.name.trim().slice(0, 100),
    phone: normalizePortuguesePhone(client.phone),
    notes: client.notes.trim().slice(0, 500),
    active: client.active,
    newClient: false,
    monthlyFeeEur: Math.max(0, Math.min(100000, client.monthlyFeeEur)),
    fidelizacaoMonths: fidMonths,
    fidelizacaoStartMillis: Math.max(0, Math.round(client.fidelizacaoStartMillis)),
    trainingType,
    weeklySessionLimit,
    birthDate,
    weeklyGoalSessions,
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientBirthDate(
  uid: string,
  clientId: string,
  birthDate: string
): Promise<void> {
  const clean = birthDate.trim();
  if (clean !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    throw new Error('Data de nascimento inválida (usa AAAA-MM-DD).');
  }
  await updateDoc(doc(subcol(uid, 'clients'), clientId), {
    birthDate: clean,
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientFixedSlots(
  uid: string,
  clientId: string,
  fixedSlots: string[]
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'clients'), clientId), {
    fixedSlots: normalizeFixedSlots(fixedSlots),
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientPinHash(
  uid: string,
  clientId: string,
  loginPinHash: string
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'clients'), clientId), {
    loginPinHash: loginPinHash.trim().slice(0, 160),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClientAccount(uid: string, clientId: string): Promise<void> {
  if (!clientId) return;
  const refsToDelete: DocumentReference[] = [];
  const clientScopedCollections = [
    'bookings',
    'week_responses',
    'waitlist_entries',
    'payments',
    'fidelizacoes',
    'workout_load_logs',
    'workout_feedback',
    'announcement_reads',
    'nutrition_entries',
    'physical_assessments',
    'chat_messages',
    'pt_notifications',
    'portal_members',
  ];

  for (const colName of clientScopedCollections) {
    try {
      const snap = await getDocs(query(subcol(uid, colName), where('clientId', '==', clientId)));
      snap.forEach((d) => refsToDelete.push(d.ref));
    } catch {
      // Ignore optional/empty subcollections if inaccessible
    }
  }

  try {
    const plansSnap = await getDocs(
      query(subcol(uid, 'workout_plans'), where('clientId', '==', clientId))
    );
    for (const planDoc of plansSnap.docs) {
      refsToDelete.push(planDoc.ref);
      try {
        const itemsSnap = await getDocs(
          query(subcol(uid, 'workout_plan_items'), where('planId', '==', planDoc.id))
        );
        itemsSnap.forEach((itemDoc) => refsToDelete.push(itemDoc.ref));
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }

  refsToDelete.push(doc(subcol(uid, 'clients'), clientId));

  const CHUNK_SIZE = 400;
  for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function applyFixedSchedulesForWeek(
  uid: string,
  targetWeek: TrainingWeekRecord,
  clients: ClientRecord[],
  existingSessions: TrainingSessionRecord[],
  existingBookings: BookingRecord[],
  weekResponses: WeekResponseRecord[],
  onlyClientId?: string
): Promise<{ createdBookings: number; createdSessions: number; affectedClients: number }> {
  const unavailableClientIds = new Set(
    weekResponses
      .filter((r) => r.weekKey === targetWeek.weekKey && r.status === 'UNAVAILABLE')
      .map((r) => r.clientId)
  );

  const targetClients = clients.filter(
    (c) =>
      c.active &&
      (!onlyClientId || c.id === onlyClientId) &&
      !unavailableClientIds.has(c.id) &&
      normalizeFixedSlots(c.fixedSlots).length > 0
  );

  if (targetClients.length === 0) {
    return { createdBookings: 0, createdSessions: 0, affectedClients: 0 };
  }

  const sessionMap = new Map<string, { id: string; startMillis: number }>();
  existingSessions
    .filter((s) => s.weekKey === targetWeek.weekKey)
    .forEach((s) => {
      const key = `${s.dayOfWeek}|${s.timeLabel}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, { id: s.id, startMillis: s.startMillis });
      }
    });

  const existingClientSessionKeys = new Set(
    existingBookings
      .filter((b) => b.weekKey === targetWeek.weekKey)
      .map((b) => `${b.clientId}|${b.sessionId}`)
  );

  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];
  const now = Date.now();
  let createdSessions = 0;
  let createdBookings = 0;
  const affectedClientIds = new Set<string>();

  for (const client of targetClients) {
    const slots = normalizeFixedSlots(client.fixedSlots);
    let clientHadNewBooking = false;

    for (const rawSlot of slots) {
      const parsed = parseFixedSlot(rawSlot);
      if (!parsed) continue;
      let sessionEntry = sessionMap.get(parsed.key);
      if (sessionEntry) {
        if (sessionEntry.startMillis > 0 && sessionEntry.startMillis <= now) continue;
      } else {
        const sessionData = createSessionModel(
          uid,
          targetWeek.weekKey,
          targetWeek.startDateMillis,
          parsed.dayOfWeek,
          parsed.hour,
          parsed.minute,
          60,
          client.trainingType === 'PERSONALIZADO' ? 1 : 6,
          'Horário Fixo'
        );
        if (sessionData.startMillis > 0 && sessionData.startMillis <= now) continue;
        const sessionRef = doc(subcol(uid, 'sessions'));
        writes.push([
          sessionRef,
          {
            ...sessionData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        ]);
        sessionEntry = { id: sessionRef.id, startMillis: sessionData.startMillis };
        sessionMap.set(parsed.key, sessionEntry);
        createdSessions += 1;
      }

      const bookingKey = `${client.id}|${sessionEntry.id}`;
      if (existingClientSessionKeys.has(bookingKey)) continue;

      existingClientSessionKeys.add(bookingKey);
      const bookingRef = doc(subcol(uid, 'bookings'));
      writes.push([
        bookingRef,
        {
          userId: uid,
          sessionId: sessionEntry.id,
          weekKey: targetWeek.weekKey,
          clientId: client.id,
          status: 'PENDING',
          attendanceStatus: 'PENDING',
          requestedAtMillis: now,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
      createdBookings += 1;
      clientHadNewBooking = true;
    }

    if (clientHadNewBooking) {
      affectedClientIds.add(client.id);
    }
  }

  if (writes.length > 0) {
    await commitWrites(writes);
  }
  return {
    createdBookings,
    createdSessions,
    affectedClients: affectedClientIds.size,
  };
}

export async function importClientsCsv(
  uid: string,
  rawText: string,
  existingClients: ClientRecord[]
): Promise<ImportResult> {
  const existingPhones = new Set(existingClients.map((c) => c.phone).filter(Boolean));
  const existingPhoneLessNames = new Set(
    existingClients
      .filter((c) => !c.phone)
      .map((c) => c.name.trim().toLowerCase())
  );
  let added = 0;
  let ignored = 0;
  const errors: string[] = [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

  lines.forEach((line, idx) => {
    if (idx === 0 && line.toLowerCase().includes('nome') && line.toLowerCase().includes('telem')) return;
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const parts = line.split(delimiter).map((p) => p.trim());
    const name = (parts[0] || '').slice(0, 100);
    if (!name) {
      errors.push(`Linha ${idx + 1}: nome em falta`);
      return;
    }
    const rawPhone = parts.length >= 2 ? parts[1] : '';
    let phone = '';
    if (rawPhone) {
      phone = normalizePortuguesePhone(rawPhone);
      if (!isValidPortuguesePhone(phone)) {
        errors.push(`Linha ${idx + 1}: telemóvel inválido (${rawPhone})`);
        return;
      }
      if (existingPhones.has(phone)) {
        ignored++;
        return;
      }
      existingPhones.add(phone);
    } else {
      const nameKey = name.toLowerCase();
      if (existingPhoneLessNames.has(nameKey)) {
        ignored++;
        return;
      }
      existingPhoneLessNames.add(nameKey);
    }
    writes.push([
      doc(subcol(uid, 'clients')),
      {
        userId: uid,
        name,
        phone,
        notes: '',
        active: true,
        newClient: false,
        monthlyFeeEur: 0,
        fidelizacaoMonths: 0,
        fidelizacaoStartMillis: 0,
        trainingType: 'GRUPO',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
    added++;
  });

  if (writes.length > 0) await commitWrites(writes);
  return { added, ignored, errors };
}

// --- Weeks & Sessions ---
export async function ensureWeekExists(uid: string, mondayMillis: number): Promise<TrainingWeekRecord> {
  const d = new Date(mondayMillis);
  const key = formatWeekKey(d);
  const label = formatWeekRangeLabel(d);
  const ref = doc(subcol(uid, 'weeks'), key);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      userId: uid,
      weekKey: key,
      label,
      startDateMillis: Math.round(mondayMillis),
      published: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: key, userId: uid, weekKey: key, label, startDateMillis: mondayMillis, published: false };
  }
  return {
    id: key,
    userId: uid,
    weekKey: key,
    label: String(snap.data()?.label ?? label),
    startDateMillis: Number(snap.data()?.startDateMillis ?? mondayMillis),
    published: Boolean(snap.data()?.published ?? false),
  };
}

export async function setWeekPublished(uid: string, weekKey: string, published: boolean): Promise<void> {
  await updateDoc(doc(subcol(uid, 'weeks'), weekKey), {
    published,
    updatedAt: serverTimestamp(),
  });
}

export async function createSessions(
  uid: string,
  week: TrainingWeekRecord,
  days: number[],
  hour: number,
  minute: number,
  durationMinutes: number,
  capacity: number,
  note: string,
  ptPrivatePersonal = false
): Promise<void> {
  const writes: Array<[DocumentReference, Record<string, unknown>]> = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => {
      const s = createSessionModel(
        uid,
        week.weekKey,
        week.startDateMillis,
        day,
        hour,
        minute,
        durationMinutes,
        capacity,
        note.trim().slice(0, 200)
      );
      return [
        doc(subcol(uid, 'sessions')),
        {
          ...s,
          ptPrivatePersonal: Boolean(ptPrivatePersonal),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ];
    });
  await commitWrites(writes);
}

export async function updateSession(uid: string, session: TrainingSessionRecord): Promise<void> {
  await updateDoc(doc(subcol(uid, 'sessions'), session.id), {
    timeLabel: session.timeLabel.slice(0, 20),
    durationMinutes: Math.max(10, Math.min(300, Math.round(session.durationMinutes))),
    capacity: Math.max(1, Math.min(100, Math.round(session.capacity))),
    note: session.note.trim().slice(0, 200),
    startMillis: Math.round(session.startMillis),
    ptPrivatePersonal: Boolean(session.ptPrivatePersonal),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSession(
  uid: string,
  sessionId: string,
  relatedBookings: BookingRecord[]
): Promise<void> {
  const batch = writeBatch(db);
  relatedBookings
    .filter((b) => b.sessionId === sessionId)
    .forEach((b) => batch.delete(doc(subcol(uid, 'bookings'), b.id)));
  batch.delete(doc(subcol(uid, 'sessions'), sessionId));
  await batch.commit();
}

export async function duplicatePreviousWeek(
  uid: string,
  targetWeek: TrainingWeekRecord,
  prevSessions: TrainingSessionRecord[],
  existingTargetSessions: TrainingSessionRecord[],
  prevBookings: BookingRecord[] = [],
  existingTargetBookings: BookingRecord[] = []
): Promise<{
  added: number;
  addedPrivateBookings: number;
  createdSessions: TrainingSessionRecord[];
  createdBookings: BookingRecord[];
}> {
  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];
  const createdSessions: TrainingSessionRecord[] = [];
  const createdBookings: BookingRecord[] = [];
  let addedSessions = 0;
  let addedPrivateBookings = 0;

  const targetSessionByKey = new Map<string, TrainingSessionRecord>();
  existingTargetSessions.forEach((s) => {
    const k = `${s.dayOfWeek}|${s.timeLabel}|${Boolean(s.ptPrivatePersonal)}`;
    if (!targetSessionByKey.has(k)) targetSessionByKey.set(k, s);
  });

  const existingBookingKeys = new Set<string>(
    existingTargetBookings
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => `${b.sessionId}|${b.clientId}`)
  );

  prevSessions.forEach((prev) => {
    const [hStr, mStr] = prev.timeLabel.split(':');
    const h = Number(hStr) || 18;
    const m = Number(mStr) || 0;
    const isPrivate = Boolean(prev.ptPrivatePersonal);
    const slotKey = `${prev.dayOfWeek}|${prev.timeLabel}|${isPrivate}`;
    let targetSession = targetSessionByKey.get(slotKey);

    if (!targetSession) {
      const s = createSessionModel(
        uid,
        targetWeek.weekKey,
        targetWeek.startDateMillis,
        prev.dayOfWeek,
        h,
        m,
        prev.durationMinutes,
        prev.capacity,
        prev.note
      );
      const ref = doc(subcol(uid, 'sessions'));
      writes.push([
        ref,
        {
          ...s,
          ptPrivatePersonal: isPrivate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
      targetSession = { id: ref.id, ...s, ptPrivatePersonal: isPrivate };
      createdSessions.push(targetSession);
      targetSessionByKey.set(slotKey, targetSession);
      addedSessions += 1;
    }

    // Also duplicate confirmed/active student bookings attached to private 1-on-1 PT sessions
    if (isPrivate && targetSession) {
      const activePrevBookings = prevBookings.filter(
        (b) => b.sessionId === prev.id && b.status !== 'CANCELLED'
      );
      activePrevBookings.forEach((prevB) => {
        const bkKey = `${targetSession!.id}|${prevB.clientId}`;
        if (!existingBookingKeys.has(bkKey)) {
          existingBookingKeys.add(bkKey);
          const bRef = doc(subcol(uid, 'bookings'));
          const nowMs = Date.now();
          writes.push([
            bRef,
            {
              userId: uid,
              sessionId: targetSession!.id,
              weekKey: targetWeek.weekKey,
              clientId: prevB.clientId,
              status: 'CONFIRMED',
              attendanceStatus: '',
              requestedAtMillis: nowMs,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          ]);
          createdBookings.push({
            id: bRef.id,
            userId: uid,
            sessionId: targetSession!.id,
            weekKey: targetWeek.weekKey,
            clientId: prevB.clientId,
            status: 'CONFIRMED',
            attendanceStatus: '',
            requestedAtMillis: nowMs,
          });
          addedPrivateBookings += 1;
        }
      });
    }
  });

  if (writes.length > 0) await commitWrites(writes);
  return {
    added: addedSessions,
    addedPrivateBookings,
    createdSessions,
    createdBookings,
  };
}

export async function createPrivatePersonalSessionAndBooking(
  uid: string,
  payload: {
    clientId: string;
    dateMs: number;
    hour: number;
    minute: number;
    durationMinutes: number;
    note?: string;
  }
): Promise<{ sessionId: string; bookingId: string }> {
  const targetDate = new Date(payload.dateMs);
  const monday = getMondayOfWeek(targetDate);
  const week = await ensureWeekExists(uid, monday.getTime());
  const jsDay = targetDate.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const safeHour = Math.max(0, Math.min(23, Math.round(payload.hour)));
  const safeMinute = Math.max(0, Math.min(59, Math.round(payload.minute)));
  const safeDuration = Math.max(15, Math.min(240, Math.round(payload.durationMinutes || 60)));
  const cleanNote = (payload.note ?? '').trim().slice(0, 200) || 'Treino Personalizado (Privado PT)';

  const sessionModel = createSessionModel(
    uid,
    week.weekKey,
    week.startDateMillis,
    isoDay,
    safeHour,
    safeMinute,
    safeDuration,
    1,
    cleanNote
  );

  const sessionRef = doc(subcol(uid, 'sessions'));
  const bookingRef = doc(subcol(uid, 'bookings'));
  const batch = writeBatch(db);
  batch.set(sessionRef, {
    ...sessionModel,
    ptPrivatePersonal: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(bookingRef, {
    userId: uid,
    sessionId: sessionRef.id,
    weekKey: week.weekKey,
    clientId: payload.clientId,
    status: 'CONFIRMED',
    attendanceStatus: '',
    requestedAtMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { sessionId: sessionRef.id, bookingId: bookingRef.id };
}

// --- Bookings & Confirmations ---
export async function addManualBooking(
  uid: string,
  sessionId: string,
  weekKey: string,
  clientId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(subcol(uid, 'week_responses'), `${weekKey}_${clientId}`));
  batch.set(doc(subcol(uid, 'bookings')), {
    userId: uid,
    sessionId,
    weekKey,
    clientId,
    status: 'CONFIRMED',
    requestedAtMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function removeBooking(uid: string, bookingId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'bookings'), bookingId));
}

export async function confirmClientBookings(uid: string, bookings: BookingRecord[]): Promise<void> {
  const batch = writeBatch(db);
  bookings.forEach((b) => {
    const ref = doc(subcol(uid, 'bookings'), b.id);
    if (b.status === 'CANCELLED') {
      batch.delete(ref);
    } else {
      batch.update(ref, { status: 'CONFIRMED', updatedAt: serverTimestamp() });
    }
  });
  await batch.commit();
}

export async function restoreBookings(uid: string, snapshots: BookingRecord[]): Promise<void> {
  const batch = writeBatch(db);
  snapshots.forEach((b) => {
    const ref = doc(subcol(uid, 'bookings'), b.id);
    if (b.status === 'CANCELLED') {
      batch.set(ref, {
        userId: uid,
        sessionId: b.sessionId,
        weekKey: b.weekKey,
        clientId: b.clientId,
        status: b.status,
        requestedAtMillis: Math.round(b.requestedAtMillis),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(ref, { status: b.status, updatedAt: serverTimestamp() });
    }
  });
  await batch.commit();
}

export async function moveBooking(uid: string, bookingId: string, newSessionId: string): Promise<void> {
  await updateDoc(doc(subcol(uid, 'bookings'), bookingId), {
    sessionId: newSessionId,
    status: 'CONFIRMED',
    updatedAt: serverTimestamp(),
  });
}

export async function swapBookingToSession(
  uid: string,
  booking: BookingRecord,
  newSession: TrainingSessionRecord
): Promise<void> {
  if (booking.weekKey === newSession.weekKey) {
    await updateDoc(doc(subcol(uid, 'bookings'), booking.id), {
      sessionId: newSession.id,
      status: 'CONFIRMED',
      attendanceStatus: '',
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const batch = writeBatch(db);
  batch.delete(doc(subcol(uid, 'bookings'), booking.id));
  batch.delete(doc(subcol(uid, 'week_responses'), `${newSession.weekKey}_${booking.clientId}`));
  batch.set(doc(subcol(uid, 'bookings')), {
    userId: uid,
    sessionId: newSession.id,
    weekKey: newSession.weekKey,
    clientId: booking.clientId,
    status: 'CONFIRMED',
    requestedAtMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setBookingAttendance(
  uid: string,
  bookingId: string,
  attendanceStatus: AttendanceStatus
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'bookings'), bookingId), {
    attendanceStatus,
    updatedAt: serverTimestamp(),
  });
}

const inFlightStudentBookingKeys = new Set<string>();

export async function submitStudentBookings(
  uid: string,
  weekKey: string,
  clientId: string,
  selectedSessionIds: Set<string>,
  existingClientBookings: BookingRecord[],
  visibleSessionDayById?: Map<string, number>
): Promise<void> {
  const lockKey = `${uid}_${weekKey}_${clientId}`;
  if (inFlightStudentBookingKeys.has(lockKey)) {
    throw new Error('Marcação já em curso. Aguarda um momento.');
  }
  inFlightStudentBookingKeys.add(lockKey);

  try {
    // Enforce at most 1 training per day across selected sessions
    if (visibleSessionDayById && visibleSessionDayById.size > 0) {
      const seenDays = new Set<number>();
      for (const sid of selectedSessionIds) {
        const day = visibleSessionDayById.get(sid);
        if (day !== undefined) {
          if (seenDays.has(day)) {
            throw new Error('Só podes marcar 1 treino por dia.');
          }
          seenDays.add(day);
        }
      }
    }

    // Fetch live week bookings from Firestore to prevent race-condition duplicates on rapid taps
    const liveById = new Map<string, BookingRecord>();
    try {
      const liveSnap = await getDocs(
        query(subcol(uid, 'bookings'), where('weekKey', '==', weekKey))
      );
      liveSnap.docs.forEach((d) => {
        const data = d.data();
        const bClientId = String(data.clientId ?? '');
        const bSessionId = String(data.sessionId ?? '');
        const bStatus = String(data.status ?? 'PENDING') as BookingRecord['status'];
        if (bClientId !== clientId || bStatus === 'CANCELLED') return;
        if (visibleSessionDayById && visibleSessionDayById.size > 0 && !visibleSessionDayById.has(bSessionId)) {
          return;
        }
        liveById.set(d.id, {
          id: d.id,
          userId: String(data.userId ?? uid),
          sessionId: bSessionId,
          weekKey: String(data.weekKey ?? weekKey),
          clientId: bClientId,
          status: bStatus,
          attendanceStatus: String(data.attendanceStatus ?? '') as AttendanceStatus,
          requestedAtMillis: Number(data.requestedAtMillis ?? 0),
        });
      });
    } catch {
      // Fallback to caller-provided existing bookings if query fails
    }

    existingClientBookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;
      if (visibleSessionDayById && visibleSessionDayById.size > 0 && !visibleSessionDayById.has(b.sessionId)) {
        return;
      }
      if (!liveById.has(b.id)) {
        liveById.set(b.id, b);
      }
    });

    // Prefer keeping CONFIRMED bookings first if legacy duplicates exist for the same session
    const activeExisting = Array.from(liveById.values()).sort((a, b) => {
      if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
      if (b.status === 'CONFIRMED' && a.status !== 'CONFIRMED') return 1;
      return a.requestedAtMillis - b.requestedAtMillis;
    });

    const batch = writeBatch(db);
    batch.delete(doc(subcol(uid, 'week_responses'), `${weekKey}_${clientId}`));

    const wasConfirmed = activeExisting.some((b) => b.status === 'CONFIRMED');
    const now = Date.now();

    if (selectedSessionIds.size === 0 && activeExisting.length > 0) {
      if (wasConfirmed) {
        const cancelledSessions = new Set<string>();
        activeExisting.forEach((b) => {
          if (cancelledSessions.has(b.sessionId)) {
            batch.delete(doc(subcol(uid, 'bookings'), b.id));
          } else {
            cancelledSessions.add(b.sessionId);
            batch.update(doc(subcol(uid, 'bookings'), b.id), {
              status: 'CANCELLED',
              requestedAtMillis: now,
              updatedAt: serverTimestamp(),
            });
          }
        });
      } else {
        activeExisting.forEach((b) => batch.delete(doc(subcol(uid, 'bookings'), b.id)));
      }
      await batch.commit();
      return;
    }

    const keptSessionIds = new Set<string>();
    activeExisting.forEach((b) => {
      if (!selectedSessionIds.has(b.sessionId) || keptSessionIds.has(b.sessionId)) {
        // Delete unselected bookings AND any duplicate docs for the same sessionId
        batch.delete(doc(subcol(uid, 'bookings'), b.id));
      } else {
        // Keep already-booked sessions with their existing status (CONFIRMED stays CONFIRMED)
        // so cancelling or editing another session never forces the PT to re-confirm them.
        keptSessionIds.add(b.sessionId);
      }
    });

    selectedSessionIds.forEach((sid) => {
      if (!keptSessionIds.has(sid)) {
        batch.set(doc(subcol(uid, 'bookings')), {
          userId: uid,
          sessionId: sid,
          weekKey,
          clientId,
          status: wasConfirmed ? 'ALTERED' : 'PENDING',
          requestedAtMillis: now,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } finally {
    inFlightStudentBookingKeys.delete(lockKey);
  }
}

export async function markStudentUnavailable(
  uid: string,
  weekKey: string,
  clientId: string,
  existingBookings: BookingRecord[]
): Promise<void> {
  const batch = writeBatch(db);
  existingBookings.forEach((b) => batch.delete(doc(subcol(uid, 'bookings'), b.id)));
  batch.set(doc(subcol(uid, 'week_responses'), `${weekKey}_${clientId}`), {
    userId: uid,
    weekKey,
    clientId,
    status: 'UNAVAILABLE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function markClientReminded(
  uid: string,
  weekKey: string,
  clientId: string
): Promise<void> {
  await setDoc(doc(subcol(uid, 'week_responses'), `${weekKey}_${clientId}`), {
    userId: uid,
    weekKey,
    clientId,
    status: 'REMINDED',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// --- Payments & Fidelizações ---
function computeFidelizacaoStartMillisForMonth(monthYear: string, fallbackMillis: number): number {
  const nowDate = new Date(fallbackMillis);
  const currentMonthKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
  if (!monthYear || monthYear === currentMonthKey) {
    return Math.round(fallbackMillis);
  }
  const [yStr, mStr] = monthYear.split('-');
  const y = Number(yStr) || nowDate.getFullYear();
  const mIdx = Math.max(0, Math.min(11, (Number(mStr) || nowDate.getMonth() + 1) - 1));
  return new Date(y, mIdx, 1, 9, 0, 0, 0).getTime();
}

export async function recordPayment(
  uid: string,
  clientId: string,
  monthYear: string,
  monthLabel: string,
  amountEur: number,
  note: string,
  durationMonths: 1 | 6 | 12 = 1,
  extras?: {
    seguroEur?: number;
    joiaEur?: number;
    skipAutoFidelizacao?: boolean;
  }
): Promise<void> {
  const validMethod = normalizePaymentMethod(note) || 'MbWay';
  const monthsCount: 1 | 6 | 12 = durationMonths === 6 || durationMonths === 12 ? durationMonths : 1;
  const totalClamped = Math.max(0, Math.min(100000, Number.isFinite(amountEur) ? amountEur : 0));
  const seguroClamped = Math.max(0, Math.min(100000, Number.isFinite(extras?.seguroEur) ? Number(extras?.seguroEur) : 0));
  const joiaClamped = Math.max(0, Math.min(100000, Number.isFinite(extras?.joiaEur) ? Number(extras?.joiaEur) : 0));

  if (totalClamped <= 0 && seguroClamped <= 0 && joiaClamped <= 0) return;

  const now = Date.now();
  const batch = writeBatch(db);

  if (totalClamped > 0) {
    const perMonthAmounts = splitAmountAcrossMonths(totalClamped, monthsCount);
    const targetMonths =
      monthsCount === 1
        ? [{ monthYear, monthLabel }]
        : buildConsecutiveMonths(monthYear, monthsCount);

    targetMonths.forEach((m, idx) => {
      const installmentNote =
        monthsCount > 1
          ? `${validMethod} · Fidelização ${monthsCount}m (${idx + 1}/${monthsCount} · total €${totalClamped.toFixed(2)})`.slice(0, 200)
          : validMethod;
      batch.set(doc(subcol(uid, 'payments')), {
        userId: uid,
        clientId,
        monthYear: m.monthYear,
        monthLabel: m.monthLabel,
        amountEur: perMonthAmounts[idx] ?? Number((totalClamped / monthsCount).toFixed(2)),
        paid: true,
        paidAtMillis: now,
        note: installmentNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // Automatically register the 6/12-month contract in Fidelizações
    if (monthsCount > 1 && !extras?.skipAutoFidelizacao) {
      const fidStartMillis = computeFidelizacaoStartMillisForMonth(monthYear, now);
      const endDate = new Date(fidStartMillis);
      endDate.setMonth(endDate.getMonth() + monthsCount);
      const fidEndMillis = endDate.getTime();
      const perMonth = totalClamped / monthsCount;
      const fidNotes = `Fidelização ${monthsCount}m · Pago €${totalClamped.toFixed(2)} (€${perMonth.toFixed(2)}/mês · ${validMethod})`.slice(0, 300);

      batch.set(doc(subcol(uid, 'fidelizacoes')), {
        userId: uid,
        clientId,
        durationMonths: monthsCount,
        startDateMillis: Math.round(fidStartMillis),
        endDateMillis: Math.round(fidEndMillis),
        notes: fidNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (seguroClamped > 0) {
    batch.set(doc(subcol(uid, 'payments')), {
      userId: uid,
      clientId,
      monthYear,
      monthLabel,
      amountEur: Number(seguroClamped.toFixed(2)),
      paid: true,
      paidAtMillis: now,
      note: `${validMethod} · Seguro`.slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (joiaClamped > 0) {
    batch.set(doc(subcol(uid, 'payments')), {
      userId: uid,
      clientId,
      monthYear,
      monthLabel,
      amountEur: Number(joiaClamped.toFixed(2)),
      paid: true,
      paidAtMillis: now,
      note: `${validMethod} · Jóia de Inscrição`.slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  if (totalClamped > 0 && monthsCount > 1 && !extras?.skipAutoFidelizacao) {
    const fidStartMillis = computeFidelizacaoStartMillisForMonth(monthYear, now);
    try {
      await updateDoc(doc(subcol(uid, 'clients'), clientId), {
        fidelizacaoMonths: monthsCount,
        fidelizacaoStartMillis: Math.round(fidStartMillis),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore if client document is missing
    }
  }
}

export async function splitPaymentIntoFidelizacao(
  uid: string,
  payment: PaymentRecord,
  durationMonths: 6 | 12
): Promise<void> {
  const validMethod = normalizePaymentMethod(payment.note) || 'MbWay';
  const totalClamped = Math.max(0, Math.min(100000, payment.amountEur));
  const perMonthAmounts = splitAmountAcrossMonths(totalClamped, durationMonths);
  const targetMonths = buildConsecutiveMonths(payment.monthYear, durationMonths);
  const paidAt = payment.paidAtMillis > 0 ? Math.round(payment.paidAtMillis) : Date.now();
  const fidStartMillis = computeFidelizacaoStartMillisForMonth(payment.monthYear, paidAt);
  const endDate = new Date(fidStartMillis);
  endDate.setMonth(endDate.getMonth() + durationMonths);
  const fidEndMillis = endDate.getTime();
  const perMonth = totalClamped / durationMonths;
  const fidNotes = `Fidelização ${durationMonths}m · Pago €${totalClamped.toFixed(2)} (€${perMonth.toFixed(2)}/mês · ${validMethod})`.slice(0, 300);

  const batch = writeBatch(db);

  batch.delete(doc(subcol(uid, 'payments'), payment.id));
  targetMonths.forEach((m, idx) => {
    const installmentNote =
      `${validMethod} · Fidelização ${durationMonths}m (${idx + 1}/${durationMonths} · total €${totalClamped.toFixed(2)})`.slice(0, 200);
    batch.set(doc(subcol(uid, 'payments')), {
      userId: uid,
      clientId: payment.clientId,
      monthYear: m.monthYear,
      monthLabel: m.monthLabel,
      amountEur: perMonthAmounts[idx] ?? Number((totalClamped / durationMonths).toFixed(2)),
      paid: true,
      paidAtMillis: paidAt,
      note: installmentNote,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.set(doc(subcol(uid, 'fidelizacoes')), {
    userId: uid,
    clientId: payment.clientId,
    durationMonths,
    startDateMillis: Math.round(fidStartMillis),
    endDateMillis: Math.round(fidEndMillis),
    notes: fidNotes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  try {
    await updateDoc(doc(subcol(uid, 'clients'), payment.clientId), {
      fidelizacaoMonths: durationMonths,
      fidelizacaoStartMillis: Math.round(fidStartMillis),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if client document is missing
  }
}

export async function deletePayment(uid: string, paymentId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'payments'), paymentId));
}

export async function saveFidelizacao(
  uid: string,
  clientId: string,
  durationMonths: 6 | 12,
  startDateMillis: number,
  notes: string,
  existingId?: string,
  customEndDateMillis?: number
): Promise<void> {
  const start = new Date(startDateMillis);
  const autoEnd = new Date(start);
  autoEnd.setMonth(autoEnd.getMonth() + durationMonths);
  const endDateMillis =
    customEndDateMillis && customEndDateMillis > startDateMillis
      ? customEndDateMillis
      : autoEnd.getTime();

  if (existingId) {
    await updateDoc(doc(subcol(uid, 'fidelizacoes'), existingId), {
      durationMonths,
      startDateMillis: Math.round(startDateMillis),
      endDateMillis: Math.round(endDateMillis),
      notes: notes.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(doc(subcol(uid, 'fidelizacoes')), {
      userId: uid,
      clientId,
      durationMonths,
      startDateMillis: Math.round(startDateMillis),
      endDateMillis: Math.round(endDateMillis),
      notes: notes.trim().slice(0, 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Keep client profile fidelizacaoMonths in sync so RegisterPaymentModal auto-selects 6/12 months
  try {
    await updateDoc(doc(subcol(uid, 'clients'), clientId), {
      fidelizacaoMonths: durationMonths,
      fidelizacaoStartMillis: Math.round(startDateMillis),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if client document is missing
  }
}

export async function deleteFidelizacao(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'fidelizacoes'), id));
}

// --- Exercises & Workout Plans ---
export async function addCustomExercise(
  uid: string,
  name: string,
  muscleGroup: string,
  equipment: string,
  instructions: string
): Promise<void> {
  await setDoc(doc(subcol(uid, 'exercises')), {
    userId: uid,
    name: name.trim().slice(0, 120),
    muscleGroup: muscleGroup.trim().slice(0, 40),
    equipment: equipment.trim().slice(0, 60),
    instructions: instructions.trim().slice(0, 600),
    custom: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExercise(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'exercises'), id));
}

function normalizeAvailableFromDate(raw?: string): string {
  const clean = (raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}

export async function createWorkoutPlan(
  uid: string,
  clientId: string,
  title: string,
  splitLabel: string,
  availableFromDate = ''
): Promise<void> {
  await createWorkoutPlansForClients(
    uid,
    clientId ? [clientId] : [],
    title,
    splitLabel,
    availableFromDate
  );
}

export async function createWorkoutPlansForClients(
  uid: string,
  clientIds: string[],
  title: string,
  splitLabel: string,
  availableFromDate = ''
): Promise<number> {
  const uniqueIds = Array.from(new Set(clientIds.filter(Boolean)));
  const cleanTitle = title.trim().slice(0, 120);
  const cleanSplit = splitLabel.trim().slice(0, 120);
  const now = Date.now();
  if (uniqueIds.length === 0) {
    // Unassigned draft / reusable template plan (not attached to any student yet)
    await setDoc(doc(subcol(uid, 'workout_plans')), {
      userId: uid,
      clientId: '',
      title: cleanTitle,
      splitLabel: cleanSplit,
      availableFromDate: '',
      createdAtMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 0;
  }
  const cleanDate = normalizeAvailableFromDate(availableFromDate);
  const writes: Array<[DocumentReference, Record<string, unknown>]> = uniqueIds.map((cid) => [
    doc(subcol(uid, 'workout_plans')),
    {
      userId: uid,
      clientId: cid,
      title: cleanTitle,
      splitLabel: cleanSplit,
      availableFromDate: cleanDate,
      createdAtMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ]);
  await commitWrites(writes);
  return uniqueIds.length;
}

export async function assignWorkoutPlanToClients(
  uid: string,
  sourcePlan: WorkoutPlanRecord,
  sourceItems: WorkoutPlanItemRecord[],
  targetClientIds: string[],
  availableFromDate = ''
): Promise<number> {
  const uniqueTargets = Array.from(
    new Set(targetClientIds.filter((cid) => cid && cid !== sourcePlan.clientId))
  );
  if (uniqueTargets.length === 0) return 0;
  const cleanDate = normalizeAvailableFromDate(availableFromDate);
  const now = Date.now();
  const sortedItems = sourceItems
    .filter((i) => i.planId === sourcePlan.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

  uniqueTargets.forEach((cid) => {
    const newPlanRef = doc(subcol(uid, 'workout_plans'));
    writes.push([
      newPlanRef,
      {
        userId: uid,
        clientId: cid,
        title: sourcePlan.title.trim().slice(0, 120),
        splitLabel: sourcePlan.splitLabel.trim().slice(0, 120),
        availableFromDate: cleanDate,
        createdAtMillis: now,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);

    sortedItems.forEach((item, idx) => {
      writes.push([
        doc(subcol(uid, 'workout_plan_items')),
        {
          userId: uid,
          planId: newPlanRef.id,
          exerciseId: item.exerciseId,
          exerciseName: item.exerciseName.slice(0, 120),
          muscleGroup: item.muscleGroup.slice(0, 40),
          sets: Math.max(1, Math.min(30, Math.round(item.sets))),
          reps: item.reps.trim().slice(0, 40) || '10-12',
          loadKg: item.loadKg.trim().slice(0, 40),
          restSeconds: Math.max(0, Math.min(600, Math.round(item.restSeconds))),
          notes: item.notes.trim().slice(0, 300),
          orderIndex: idx,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
    });
  });

  await commitWrites(writes);
  return uniqueTargets.length;
}

export async function updateWorkoutPlanSchedule(
  uid: string,
  planId: string,
  availableFromDate: string
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'workout_plans'), planId), {
    availableFromDate: normalizeAvailableFromDate(availableFromDate),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkoutPlan(
  uid: string,
  planId: string,
  items: WorkoutPlanItemRecord[]
): Promise<void> {
  const batch = writeBatch(db);
  items
    .filter((i) => i.planId === planId)
    .forEach((i) => batch.delete(doc(subcol(uid, 'workout_plan_items'), i.id)));
  batch.delete(doc(subcol(uid, 'workout_plans'), planId));
  await batch.commit();
}

export async function addExerciseToPlan(
  uid: string,
  planId: string,
  exercise: ExerciseRecord,
  sets: number,
  reps: string,
  loadKg: string,
  restSeconds: number,
  notes: string,
  orderIndex: number
): Promise<void> {
  await setDoc(doc(subcol(uid, 'workout_plan_items')), {
    userId: uid,
    planId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: Math.max(1, Math.min(30, Math.round(sets))),
    reps: reps.trim().slice(0, 40) || '10-12',
    loadKg: loadKg.trim().slice(0, 40),
    restSeconds: Math.max(0, Math.min(600, Math.round(restSeconds))),
    notes: notes.trim().slice(0, 300),
    orderIndex: Math.max(0, Math.min(200, Math.round(orderIndex))),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function parseLoadKgNumber(loadKg: string): number {
  const match = loadKg.replace(',', '.').match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(2000, Number(n.toFixed(2)));
}

export async function updateWorkoutPlanItemLoad(
  uid: string,
  itemId: string,
  loadKg: string,
  previousLoadKg?: string,
  logContext?: {
    clientId: string;
    planId: string;
    exerciseId: string;
    exerciseName: string;
  }
): Promise<void> {
  const cleanLoad = loadKg.trim().slice(0, 40);
  const cleanPrev = (previousLoadKg !== undefined ? previousLoadKg : cleanLoad).trim().slice(0, 40);
  const now = Date.now();
  await updateDoc(doc(subcol(uid, 'workout_plan_items'), itemId), {
    loadKg: cleanLoad,
    lastLoadKg: cleanPrev || cleanLoad,
    lastLoggedAtMillis: now,
    updatedAt: serverTimestamp(),
  });
  if (logContext && logContext.clientId && logContext.exerciseName.trim() && cleanLoad) {
    await setDoc(doc(subcol(uid, 'workout_load_logs')), {
      userId: uid,
      clientId: logContext.clientId.slice(0, 128),
      planId: logContext.planId.slice(0, 128),
      planItemId: itemId.slice(0, 128),
      exerciseId: logContext.exerciseId.slice(0, 128),
      exerciseName: logContext.exerciseName.trim().slice(0, 120),
      loadKg: cleanLoad,
      numericKg: parseLoadKgNumber(cleanLoad),
      loggedAtMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function removeExerciseFromPlan(uid: string, itemId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'workout_plan_items'), itemId));
}

// --- Waitlist (Lista de Espera) ---
export async function joinWaitlist(
  uid: string,
  sessionId: string,
  weekKey: string,
  clientId: string
): Promise<void> {
  const entryId = `${sessionId}_${clientId}`.slice(0, 120);
  await setDoc(doc(subcol(uid, 'waitlist_entries'), entryId), {
    userId: uid,
    sessionId: sessionId.slice(0, 128),
    weekKey: weekKey.slice(0, 30),
    clientId: clientId.slice(0, 128),
    createdAtMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function leaveWaitlist(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'waitlist_entries'), entryId));
}

export async function promoteWaitlistEntry(
  uid: string,
  entry: WaitlistEntryRecord
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(subcol(uid, 'waitlist_entries'), entry.id));
  batch.delete(doc(subcol(uid, 'week_responses'), `${entry.weekKey}_${entry.clientId}`));
  batch.set(doc(subcol(uid, 'bookings')), {
    userId: uid,
    sessionId: entry.sessionId,
    weekKey: entry.weekKey,
    clientId: entry.clientId,
    status: 'CONFIRMED',
    requestedAtMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// --- Nutrition & Foods ---
export async function addCustomFood(
  uid: string,
  name: string,
  category: string,
  kcalPer100g: number,
  proteinPer100g: number,
  carbsPer100g: number,
  fatPer100g: number
): Promise<void> {
  await setDoc(doc(subcol(uid, 'foods')), {
    userId: uid,
    name: name.trim().slice(0, 120),
    category: category.trim().slice(0, 40),
    kcalPer100g: Math.max(0, kcalPer100g),
    proteinPer100g: Math.max(0, proteinPer100g),
    carbsPer100g: Math.max(0, carbsPer100g),
    fatPer100g: Math.max(0, fatPer100g),
    custom: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFood(uid: string, foodId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'foods'), foodId));
}

export async function deleteCustomFoods(uid: string, foodIds: string[]): Promise<number> {
  const uniqueIds = Array.from(new Set(foodIds.filter(Boolean)));
  for (let i = 0; i < uniqueIds.length; i += 400) {
    const batch = writeBatch(db);
    uniqueIds.slice(i, i + 400).forEach((id) => {
      batch.delete(doc(subcol(uid, 'foods'), id));
    });
    await batch.commit();
  }
  return uniqueIds.length;
}

export async function addNutritionEntry(
  uid: string,
  clientId: string,
  mealType: MealTypeKey,
  food: FoodItemRecord,
  grams: number
): Promise<void> {
  const factor = grams / 100;
  await setDoc(doc(subcol(uid, 'nutrition_entries')), {
    userId: uid,
    clientId,
    mealType,
    foodId: food.id,
    foodName: food.name,
    grams,
    kcal: Number((food.kcalPer100g * factor).toFixed(1)),
    protein: Number((food.proteinPer100g * factor).toFixed(1)),
    carbs: Number((food.carbsPer100g * factor).toFixed(1)),
    fat: Number((food.fatPer100g * factor).toFixed(1)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeNutritionEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'nutrition_entries'), entryId));
}

// --- Physical Assessments ---
export async function addPhysicalAssessment(
  uid: string,
  payload: {
    clientId: string;
    dateMillis: number;
    weightKg: number;
    ageYears: number;
    heightCm: number;
    sex: 'M' | 'F';
    bodyFatPct: number;
    muscleMassKg: number;
    visceralFat: number;
    notes: string;
  }
): Promise<void> {
  const bmi = calculateBmi(payload.weightKg, payload.heightCm);
  const bmrKcal = calculateBmrMifflinStJeor(
    payload.weightKg,
    payload.heightCm,
    payload.ageYears,
    payload.sex
  );
  await setDoc(doc(subcol(uid, 'physical_assessments')), {
    userId: uid,
    clientId: payload.clientId,
    dateMillis: Math.round(payload.dateMillis),
    weightKg: Math.max(1, Math.min(500, payload.weightKg)),
    ageYears: Math.max(5, Math.min(120, Math.round(payload.ageYears))),
    heightCm: Math.max(50, Math.min(260, payload.heightCm)),
    sex: payload.sex,
    bodyFatPct: Math.max(0, Math.min(80, payload.bodyFatPct)),
    muscleMassKg: Math.max(0, Math.min(200, payload.muscleMassKg)),
    visceralFat: Math.max(0, Math.min(60, payload.visceralFat)),
    bmi,
    bmrKcal,
    notes: payload.notes.trim().slice(0, 500),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePhysicalAssessment(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'physical_assessments'), id));
}

// --- Chat ---
export async function sendChatMessage(
  uid: string,
  clientId: string,
  senderRole: 'PT' | 'STUDENT',
  text: string,
  senderClientName?: string
): Promise<void> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;
  const now = Date.now();
  await setDoc(doc(subcol(uid, 'chat_messages')), {
    userId: uid,
    clientId,
    senderRole,
    text: trimmed,
    timestampMillis: now,
    deliveredAtMillis: 0,
    readAtMillis: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (senderRole === 'STUDENT') {
    try {
      await createPtNotification(uid, {
        clientId,
        clientName: senderClientName?.trim() || 'Aluno',
        type: 'CHAT',
        summary: trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed,
        weekKey: '',
      });
    } catch {
      // Non-blocking notification failure
    }
  }
}

export async function markChatMessagesDelivered(
  uid: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  const now = Date.now();
  for (let i = 0; i < messageIds.length; i += 400) {
    const batch = writeBatch(db);
    messageIds.slice(i, i + 400).forEach((id) => {
      batch.update(doc(subcol(uid, 'chat_messages'), id), {
        deliveredAtMillis: now,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export async function markChatMessagesRead(
  uid: string,
  messages: ChatMessageRecord[]
): Promise<void> {
  const unread = messages.filter((m) => !m.readAtMillis);
  if (unread.length === 0) return;
  const now = Date.now();
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);
    unread.slice(i, i + 400).forEach((m) => {
      batch.update(doc(subcol(uid, 'chat_messages'), m.id), {
        deliveredAtMillis: m.deliveredAtMillis && m.deliveredAtMillis > 0 ? m.deliveredAtMillis : now,
        readAtMillis: now,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export async function markClientChatNotificationsRead(
  uid: string,
  notifications: PtNotificationRecord[],
  clientId: string
): Promise<void> {
  const unread = notifications.filter(
    (n) => !n.read && n.type === 'CHAT' && n.clientId === clientId
  );
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(subcol(uid, 'pt_notifications'), n.id), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// --- Templates & Settings ---
export async function saveMessageTemplate(
  uid: string,
  templateKey: string,
  body: string
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'templates'), templateKey), {
    body: body.slice(0, 1500),
    updatedAt: serverTimestamp(),
  });
}

export async function saveStudioSettings(
  uid: string,
  settings: StudioSettingsRecord
): Promise<void> {
  const ref = doc(subcol(uid, 'settings'), 'studio');
  const snap = await getDoc(ref);
  const cleanUrl = (settings.siteBaseUrl.trim() || window.location.origin || DEFAULT_WEB_BASE_URL).slice(0, 300);
  const code =
    settings.studentPortalCode && settings.studentPortalCode.length >= 8
      ? settings.studentPortalCode.slice(0, 64)
      : generatePortalCode();

  const cutoffMins = getEffectiveCutoffMinutes(settings);
  const reminderLeadMins = getEffectiveReminderLeadMinutes(settings);
  const cleanPtPhone = normalizePortuguesePhone(settings.ptWhatsappPhone || '').slice(0, 20);

  if (snap.exists()) {
    await updateDoc(ref, {
      clientsCanEdit: settings.clientsCanEdit,
      cutoffHours: Math.floor(cutoffMins / 60),
      cutoffMinutes: cutoffMins,
      reminderLeadMinutes: reminderLeadMins,
      whatsappWebMode: settings.whatsappWebMode,
      siteBaseUrl: cleanUrl,
      studentPortalCode: code,
      ptWhatsappPhone: cleanPtPhone,
      seeded: true,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      userId: uid,
      clientsCanEdit: settings.clientsCanEdit,
      cutoffHours: Math.floor(cutoffMins / 60),
      cutoffMinutes: cutoffMins,
      reminderLeadMinutes: reminderLeadMins,
      whatsappWebMode: settings.whatsappWebMode,
      siteBaseUrl: cleanUrl,
      studentPortalCode: code,
      ptWhatsappPhone: cleanPtPhone,
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function regenerateStudentPortalCode(uid: string): Promise<string> {
  const newCode = generatePortalCode();
  await updateDoc(doc(subcol(uid, 'settings'), 'studio'), {
    studentPortalCode: newCode,
    updatedAt: serverTimestamp(),
  });
  return newCode;
}

export async function joinStudioPortal(
  ptUid: string,
  inviteCode: string,
  memberUid: string
): Promise<void> {
  const ref = doc(subcol(ptUid, 'portal_members'), memberUid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    if (snap.data()?.inviteCode === inviteCode) return;
    await deleteDoc(ref);
  }
  await setDoc(ref, {
    userId: ptUid,
    memberUid,
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePortalMemberClientId(
  ptUid: string,
  memberUid: string,
  clientId: string
): Promise<void> {
  const ref = doc(subcol(ptUid, 'portal_members'), memberUid);
  await updateDoc(ref, {
    clientId,
    updatedAt: serverTimestamp(),
  });
}

// --- Birth Date 30-Day Reminder Window ---
export async function setBirthDateReminderWindow(
  uid: string,
  durationDays = 30
): Promise<number> {
  const clampedDays = Math.max(1, Math.min(90, Math.round(durationDays)));
  const untilMillis = Date.now() + clampedDays * 86_400_000;
  await updateDoc(doc(subcol(uid, 'settings'), 'studio'), {
    birthDateReminderUntilMillis: untilMillis,
    updatedAt: serverTimestamp(),
  });
  return untilMillis;
}

// --- Studio Announcements & Read Receipts ---
export async function createStudioAnnouncement(
  uid: string,
  payload: {
    title: string;
    message: string;
    durationDays: number;
  }
): Promise<string> {
  const title = payload.title.trim().slice(0, 120);
  const message = payload.message.trim().slice(0, 1200);
  if (!title || !message) {
    throw new Error('Preenche o título e a mensagem do aviso.');
  }
  const durationDays = Math.max(1, Math.min(90, Math.round(payload.durationDays || 7)));
  const now = Date.now();
  const expiresAtMillis = now + durationDays * 86_400_000;
  const ref = doc(subcol(uid, 'studio_announcements'));
  await setDoc(ref, {
    userId: uid,
    title,
    message,
    durationDays,
    createdAtMillis: now,
    expiresAtMillis,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function closeStudioAnnouncement(
  uid: string,
  announcementId: string
): Promise<void> {
  await updateDoc(doc(subcol(uid, 'studio_announcements'), announcementId), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStudioAnnouncement(
  uid: string,
  announcementId: string
): Promise<void> {
  const readsSnap = await getDocs(
    query(subcol(uid, 'announcement_reads'), where('announcementId', '==', announcementId))
  );
  const batch = writeBatch(db);
  readsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(subcol(uid, 'studio_announcements'), announcementId));
  await batch.commit();
}

export async function markAnnouncementRead(
  uid: string,
  payload: {
    announcementId: string;
    clientId: string;
    clientName: string;
  }
): Promise<void> {
  const readId = `${payload.announcementId}_${payload.clientId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const ref = doc(subcol(uid, 'announcement_reads'), readId);
  const existing = await getDoc(ref);
  const now = Date.now();
  if (existing.exists()) {
    await updateDoc(ref, {
      readAtMillis: now,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      userId: uid,
      announcementId: payload.announcementId.slice(0, 128),
      clientId: payload.clientId.slice(0, 128),
      clientName: payload.clientName.trim().slice(0, 100) || 'Aluno',
      readAtMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// --- Post-Workout Feedback ---
export async function addWorkoutFeedback(
  uid: string,
  payload: {
    clientId: string;
    clientName: string;
    planId: string;
    planTitle: string;
    rpe: number;
    feeling: WorkoutFeedbackFeeling;
    note: string;
  }
): Promise<string> {
  const now = Date.now();
  const rpe = Math.max(1, Math.min(10, Math.round(payload.rpe || 7)));
  const feeling: WorkoutFeedbackFeeling =
    payload.feeling === 'LEVE' || payload.feeling === 'PESADO' ? payload.feeling : 'IDEAL';
  const cleanTitle = payload.planTitle.trim().slice(0, 120) || 'Treino';
  const cleanNote = payload.note.trim().slice(0, 400);
  const cleanName = payload.clientName.trim().slice(0, 100) || 'Aluno';

  const ref = doc(subcol(uid, 'workout_feedback'));
  await setDoc(ref, {
    userId: uid,
    clientId: payload.clientId.slice(0, 128),
    clientName: cleanName,
    planId: payload.planId.slice(0, 128),
    planTitle: cleanTitle,
    rpe,
    feeling,
    note: cleanNote,
    timestampMillis: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    const feelingPt = feeling === 'LEVE' ? 'Leve' : feeling === 'PESADO' ? 'Pesado' : 'Ideal';
    const summaryBase = `Feedback pós-treino (${feelingPt} · RPE ${rpe}/10) em ${cleanTitle}`;
    const summary = cleanNote ? `${summaryBase}: "${cleanNote}"` : summaryBase;
    const notifRef = doc(subcol(uid, 'pt_notifications'));
    await setDoc(notifRef, {
      userId: uid,
      clientId: payload.clientId.slice(0, 128),
      clientName: cleanName,
      type: 'FEEDBACK',
      summary: summary.slice(0, 400),
      weekKey: '',
      read: false,
      timestampMillis: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking notification failure
  }

  return ref.id;
}

export async function deleteWorkoutFeedback(
  uid: string,
  feedbackId: string
): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'workout_feedback'), feedbackId));
}

