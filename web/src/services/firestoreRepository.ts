import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  DocumentReference,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
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
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WeekResponseRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import {
  buildConsecutiveMonths,
  calculateBmi,
  calculateBmrMifflinStJeor,
  createSessionModel,
  DEFAULT_EXERCISES,
  DEFAULT_FOODS,
  DEFAULT_TEMPLATES,
  formatWeekKey,
  formatWeekRangeLabel,
  getMondayOfWeek,
  isValidPortuguesePhone,
  normalizePaymentMethod,
  normalizePortuguesePhone,
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
  settings: (item: StudioSettingsRecord | null) => void;
  onError: (err: Error) => void;
}

export function subscribeStudioData(uid: string, handlers: StudioStreams): () => void {
  const unsubs: Unsubscribe[] = [];

  const listen = <T>(
    name: string,
    mapper: (id: string, data: Record<string, unknown>) => T,
    sort: (list: T[]) => T[],
    cb: (list: T[]) => void
  ) => {
    unsubs.push(
      onSnapshot(
        subcol(uid, name),
        (snap) => {
          const list = snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
          cb(sort(list));
        },
        (err) => handlers.onError(err)
      )
    );
  };

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
    }),
    (list) =>
      list.sort((a, b) => {
        if (a.newClient !== b.newClient) return a.newClient ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }),
    handlers.clients
  );

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
    handlers.weekResponses
  );

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
    handlers.payments
  );

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
    handlers.fidelizacoes
  );

  listen<ExerciseRecord>(
    'exercises',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      name: String(d.name ?? ''),
      muscleGroup: String(d.muscleGroup ?? ''),
      equipment: String(d.equipment ?? ''),
      instructions: String(d.instructions ?? ''),
      custom: Boolean(d.custom ?? false),
    }),
    (list) =>
      list.sort(
        (a, b) =>
          a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)
      ),
    handlers.exercises
  );

  listen<WorkoutPlanRecord>(
    'workout_plans',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      clientId: String(d.clientId ?? ''),
      title: String(d.title ?? ''),
      splitLabel: String(d.splitLabel ?? ''),
      createdAtMillis: Number(d.createdAtMillis ?? 0),
    }),
    (list) => list.sort((a, b) => b.createdAtMillis - a.createdAtMillis),
    handlers.workoutPlans
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
      restSeconds: Number(d.restSeconds ?? 90),
      notes: String(d.notes ?? ''),
      orderIndex: Number(d.orderIndex ?? 0),
    }),
    (list) => list.sort((a, b) => a.orderIndex - b.orderIndex),
    handlers.workoutPlanItems
  );

  listen<FoodItemRecord>(
    'foods',
    (id, d) => ({
      id,
      userId: String(d.userId ?? uid),
      name: String(d.name ?? ''),
      category: String(d.category ?? ''),
      kcalPer100g: Number(d.kcalPer100g ?? 0),
      proteinPer100g: Number(d.proteinPer100g ?? 0),
      carbsPer100g: Number(d.carbsPer100g ?? 0),
      fatPer100g: Number(d.fatPer100g ?? 0),
      custom: Boolean(d.custom ?? false),
    }),
    (list) => list.sort((a, b) => a.name.localeCompare(b.name)),
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
    handlers.nutritionEntries
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
    handlers.physicalAssessments
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
    }),
    (list) => list.sort((a, b) => a.timestampMillis - b.timestampMillis),
    handlers.chatMessages
  );

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
          cutoffHours: Number(d.cutoffHours ?? 12),
          whatsappWebMode: Boolean(d.whatsappWebMode ?? false),
          siteBaseUrl: String(d.siteBaseUrl ?? window.location.origin),
          seeded: Boolean(d.seeded ?? false),
        });
      },
      (err) => handlers.onError(err)
    )
  );

  return () => unsubs.forEach((u) => u());
}

async function commitWrites(writes: Array<[DocumentReference, Record<string, unknown>]>) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach(([ref, payload]) => batch.set(ref, payload));
    await batch.commit();
  }
}

export async function ensureSeeded(uid: string): Promise<void> {
  const settingsRef = doc(subcol(uid, 'settings'), 'studio');
  const settingsSnap = await getDoc(settingsRef);
  const now = Date.now();
  const dayMs = 86_400_000;

  if (settingsSnap.exists() && settingsSnap.data()?.seeded === true) {
    // Ensure any missing default foods or initial assessment backfill
    const existingFoodsSnap = await getDocs(subcol(uid, 'foods'));
    const existingFoodIds = new Set(existingFoodsSnap.docs.map((d) => d.id));
    const missingFoods = DEFAULT_FOODS.filter((f) => !existingFoodIds.has(f.id));
    const existingAssess = await getDocs(query(subcol(uid, 'physical_assessments'), limit(1)));
    const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

    missingFoods.forEach((fd) => {
      writes.push([
        doc(subcol(uid, 'foods'), fd.id),
        {
          userId: uid,
          name: fd.name,
          category: fd.category,
          kcalPer100g: fd.kcalPer100g,
          proteinPer100g: fd.proteinPer100g,
          carbsPer100g: fd.carbsPer100g,
          fatPer100g: fd.fatPer100g,
          custom: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
    });

    if (existingAssess.empty) {
      [
        ['pa_ana_1', now - dayMs * 60, 68.5, 29, 166, 'F' as const, 26.8, 25.1, 6.0, 'Avaliação inicial'],
        ['pa_ana_2', now - dayMs * 30, 66.8, 29, 166, 'F' as const, 24.9, 25.5, 5.5, 'Boa evolução de força'],
        ['pa_ana_3', now - dayMs * 2, 65.4, 29, 166, 'F' as const, 23.2, 26.0, 5.0, 'Recomposição corporal consistente'],
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
    }

    if (writes.length > 0) await commitWrites(writes);
    return;
  }

  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

  DEFAULT_EXERCISES.forEach((ex) => {
    writes.push([
      doc(subcol(uid, 'exercises'), ex.id),
      {
        userId: uid,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        instructions: ex.instructions,
        custom: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

  DEFAULT_FOODS.forEach((fd) => {
    writes.push([
      doc(subcol(uid, 'foods'), fd.id),
      {
        userId: uid,
        name: fd.name,
        category: fd.category,
        kcalPer100g: fd.kcalPer100g,
        proteinPer100g: fd.proteinPer100g,
        carbsPer100g: fd.carbsPer100g,
        fatPer100g: fd.fatPer100g,
        custom: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
  });

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
    { id: 'client_ana', name: 'Ana Ribeiro', phone: '912345678', notes: 'Objetivo: recomposição corporal · Manhãs/18h', newClient: false, fee: 120, fidM: 12, fidStart: now - 60 * dayMs },
    { id: 'client_bruno', name: 'Bruno Costa', phone: '912345602', notes: 'Lesão antiga joelho direito — evitar impacto', newClient: false, fee: 95, fidM: 6, fidStart: now - 145 * dayMs },
    { id: 'client_eva', name: 'Eva Martins', phone: '912345605', notes: 'Treino força 3x/semana', newClient: false, fee: 120, fidM: 12, fidStart: now - 30 * dayMs },
    { id: 'client_filipe', name: 'Filipe Sousa', phone: '912345606', notes: '', newClient: false, fee: 110, fidM: 0, fidStart: 0 },
    { id: 'client_hugo', name: 'Hugo Pereira', phone: '912345608', notes: 'Horário pós-laboral', newClient: false, fee: 95, fidM: 0, fidStart: 0 },
    { id: 'client_joao', name: 'João Almeida', phone: '912345610', notes: '', newClient: true, fee: 100, fidM: 0, fidStart: 0 },
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
    ['wpi_1', 'ex_15', 'Agachamento Livre com Barra', 'Pernas', 4, '8-10', '50 kg', 120, 'Controlar descida 3s', 0],
    ['wpi_2', 'ex_2', 'Supino Inclinado com Halteres', 'Peito', 3, '10-12', '14 kg', 90, '', 1],
    ['wpi_3', 'ex_8', 'Puxada à Frente (Lat Pulldown)', 'Costas', 3, '10-12', '45 kg', 90, '', 2],
    ['wpi_4', 'ex_26', 'Elevações Laterais com Halteres', 'Ombros', 3, '12-15', '6 kg', 60, '', 3],
    ['wpi_5', 'ex_37', 'Prancha Abdominal (Plank)', 'Core', 3, '45s', 'Corporal', 45, '', 4],
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
    ['pa_ana_1', now - dayMs * 60, 68.5, 29, 166, 'F' as const, 26.8, 25.1, 6.0, 'Avaliação inicial'],
    ['pa_ana_2', now - dayMs * 30, 66.8, 29, 166, 'F' as const, 24.9, 25.5, 5.5, 'Boa evolução de força'],
    ['pa_ana_3', now - dayMs * 2, 65.4, 29, 166, 'F' as const, 23.2, 26.0, 5.0, 'Recomposição corporal consistente'],
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
      cutoffHours: 12,
      whatsappWebMode: false,
      siteBaseUrl: window.location.origin || 'https://new-shape-treinos.vercel.app',
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
  }
): Promise<string> {
  const ref = doc(subcol(uid, 'clients'));
  const fidMonths = payload.fidelizacaoMonths === 6 || payload.fidelizacaoMonths === 12 ? payload.fidelizacaoMonths : 0;
  await setDoc(ref, {
    userId: uid,
    name: payload.name.trim().slice(0, 100),
    phone: normalizePortuguesePhone(payload.phone),
    notes: payload.notes.trim().slice(0, 500),
    active: true,
    newClient: Boolean(payload.newClient ?? false),
    monthlyFeeEur: Math.max(0, Math.min(100000, payload.monthlyFeeEur ?? 0)),
    fidelizacaoMonths: fidMonths,
    fidelizacaoStartMillis: Math.max(0, Math.round(payload.fidelizacaoStartMillis ?? 0)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClient(uid: string, client: ClientRecord): Promise<void> {
  const fidMonths = client.fidelizacaoMonths === 6 || client.fidelizacaoMonths === 12 ? client.fidelizacaoMonths : 0;
  await updateDoc(doc(subcol(uid, 'clients'), client.id), {
    name: client.name.trim().slice(0, 100),
    phone: normalizePortuguesePhone(client.phone),
    notes: client.notes.trim().slice(0, 500),
    active: client.active,
    newClient: false,
    monthlyFeeEur: Math.max(0, Math.min(100000, client.monthlyFeeEur)),
    fidelizacaoMonths: fidMonths,
    fidelizacaoStartMillis: Math.max(0, Math.round(client.fidelizacaoStartMillis)),
    updatedAt: serverTimestamp(),
  });
}

export async function importClientsCsv(
  uid: string,
  rawText: string,
  existingClients: ClientRecord[]
): Promise<ImportResult> {
  const existingPhones = new Set(existingClients.map((c) => c.phone));
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
    if (parts.length < 2) {
      errors.push(`Linha ${idx + 1}: formato inválido`);
      return;
    }
    const name = parts[0].slice(0, 100);
    const phone = normalizePortuguesePhone(parts[1]);
    if (!name || !isValidPortuguesePhone(phone)) {
      errors.push(`Linha ${idx + 1}: telemóvel inválido (${parts[1]})`);
      return;
    }
    if (existingPhones.has(phone)) {
      ignored++;
      return;
    }
    existingPhones.add(phone);
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
  note: string
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
  existingTargetSessions: TrainingSessionRecord[]
): Promise<number> {
  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];
  prevSessions.forEach((prev) => {
    const [hStr, mStr] = prev.timeLabel.split(':');
    const h = Number(hStr) || 18;
    const m = Number(mStr) || 0;
    const exists = existingTargetSessions.some(
      (s) => s.dayOfWeek === prev.dayOfWeek && s.timeLabel === prev.timeLabel
    );
    if (!exists) {
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
      writes.push([
        doc(subcol(uid, 'sessions')),
        {
          ...s,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ]);
    }
  });
  if (writes.length > 0) await commitWrites(writes);
  return writes.length;
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

export async function submitStudentBookings(
  uid: string,
  weekKey: string,
  clientId: string,
  selectedSessionIds: Set<string>,
  existingClientBookings: BookingRecord[]
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(subcol(uid, 'week_responses'), `${weekKey}_${clientId}`));

  const activeExisting = existingClientBookings.filter((b) => b.status !== 'CANCELLED');
  const wasConfirmed = activeExisting.some((b) => b.status === 'CONFIRMED');
  const existingSessionIds = new Set(activeExisting.map((b) => b.sessionId));
  const now = Date.now();

  if (selectedSessionIds.size === 0 && activeExisting.length > 0) {
    if (wasConfirmed) {
      activeExisting.forEach((b) => {
        batch.update(doc(subcol(uid, 'bookings'), b.id), {
          status: 'CANCELLED',
          requestedAtMillis: now,
          updatedAt: serverTimestamp(),
        });
      });
    } else {
      activeExisting.forEach((b) => batch.delete(doc(subcol(uid, 'bookings'), b.id)));
    }
    await batch.commit();
    return;
  }

  activeExisting.forEach((b) => {
    if (!selectedSessionIds.has(b.sessionId)) {
      batch.delete(doc(subcol(uid, 'bookings'), b.id));
    } else if (wasConfirmed) {
      batch.update(doc(subcol(uid, 'bookings'), b.id), {
        status: 'ALTERED',
        requestedAtMillis: now,
        updatedAt: serverTimestamp(),
      });
    }
  });

  selectedSessionIds.forEach((sid) => {
    if (!existingSessionIds.has(sid)) {
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
export async function recordPayment(
  uid: string,
  clientId: string,
  monthYear: string,
  monthLabel: string,
  amountEur: number,
  note: string,
  durationMonths: 1 | 6 | 12 = 1
): Promise<void> {
  const validMethod = normalizePaymentMethod(note) || 'MbWay';
  const monthsCount: 1 | 6 | 12 = durationMonths === 6 || durationMonths === 12 ? durationMonths : 1;
  const totalClamped = Math.max(0, Math.min(100000, amountEur));
  const perMonthAmount = Number((totalClamped / monthsCount).toFixed(2));
  const targetMonths =
    monthsCount === 1
      ? [{ monthYear, monthLabel }]
      : buildConsecutiveMonths(monthYear, monthsCount);
  const now = Date.now();
  const batch = writeBatch(db);

  targetMonths.forEach((m) => {
    batch.set(doc(subcol(uid, 'payments')), {
      userId: uid,
      clientId,
      monthYear: m.monthYear,
      monthLabel: m.monthLabel,
      amountEur: perMonthAmount,
      paid: true,
      paidAtMillis: now,
      note: validMethod,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
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
  existingId?: string
): Promise<void> {
  const start = new Date(startDateMillis);
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);
  const endDateMillis = end.getTime();

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

export async function createWorkoutPlan(
  uid: string,
  clientId: string,
  title: string,
  splitLabel: string
): Promise<void> {
  await setDoc(doc(subcol(uid, 'workout_plans')), {
    userId: uid,
    clientId,
    title: title.trim().slice(0, 120),
    splitLabel: splitLabel.trim().slice(0, 120),
    createdAtMillis: Date.now(),
    createdAt: serverTimestamp(),
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

export async function removeExerciseFromPlan(uid: string, itemId: string): Promise<void> {
  await deleteDoc(doc(subcol(uid, 'workout_plan_items'), itemId));
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

export async function importFoodsExcelCsv(
  uid: string,
  rawText: string,
  existingFoods: FoodItemRecord[]
): Promise<ImportResult> {
  const existingNames = new Set(existingFoods.map((f) => f.name.toLowerCase()));
  let added = 0;
  let ignored = 0;
  const errors: string[] = [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const writes: Array<[DocumentReference, Record<string, unknown>]> = [];

  lines.forEach((line, idx) => {
    const low = line.toLowerCase();
    if (idx === 0 && (low.includes('alimento') || low.includes('nome')) && (low.includes('kcal') || low.includes('caloria'))) {
      return;
    }
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim());
    if (parts.length < 5) {
      errors.push(`Linha ${idx + 1}: colunas insuficientes (usa Nome;Categoria;Kcal;Prot;HC;Gord)`);
      return;
    }
    const hasCat = parts.length >= 6;
    const name = parts[0].slice(0, 120);
    const category = (hasCat ? parts[1] : 'Personalizado').slice(0, 40) || 'Personalizado';
    const numStart = hasCat ? 2 : 1;
    const parseNum = (s: string) => Number((s || '0').replace(',', '.')) || 0;
    const kcal = Math.max(0, parseNum(parts[numStart]));
    const protein = Math.max(0, parseNum(parts[numStart + 1]));
    const carbs = Math.max(0, parseNum(parts[numStart + 2]));
    const fat = Math.max(0, parseNum(parts[numStart + 3]));

    if (!name) {
      errors.push(`Linha ${idx + 1}: nome vazio`);
      return;
    }
    if (existingNames.has(name.toLowerCase())) {
      ignored++;
      return;
    }
    existingNames.add(name.toLowerCase());
    writes.push([
      doc(subcol(uid, 'foods')),
      {
        userId: uid,
        name,
        category,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        custom: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]);
    added++;
  });

  if (writes.length > 0) await commitWrites(writes);
  return { added, ignored, errors };
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
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;
  await setDoc(doc(subcol(uid, 'chat_messages')), {
    userId: uid,
    clientId,
    senderRole,
    text: trimmed,
    timestampMillis: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  await setDoc(
    doc(subcol(uid, 'settings'), 'studio'),
    {
      userId: uid,
      clientsCanEdit: settings.clientsCanEdit,
      cutoffHours: Math.max(0, Math.min(72, Math.round(settings.cutoffHours))),
      whatsappWebMode: settings.whatsappWebMode,
      siteBaseUrl: (settings.siteBaseUrl.trim() || window.location.origin).slice(0, 300),
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
