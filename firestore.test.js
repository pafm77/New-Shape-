const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_pt_123";
const ADMIN_EMAIL = "pafm77pedrinho77@gmail.com";
const BOB_UID = "bob_pt_456";
const BOB_EMAIL = "outro.pt@newshape.pt";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user cannot read or write any New Shape collection", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const past = new Date(Date.now() - 2000);

  await assertFails(unauthDb.collection(`users/${ALICE_UID}/clients`).get());
  await assertFails(
    unauthDb.collection(`users/${ALICE_UID}/clients`).doc("c1").set({
      userId: ALICE_UID,
      name: "Ana Ribeiro",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      createdAt: past,
      updatedAt: past,
    })
  );
  await assertFails(unauthDb.collection(`users/${ALICE_UID}/payments`).get());
});

test("Owner (Super-Admin) can create and partially update Client, Week, Session, Booking, Payment, Fidelizacao, Exercise, Plan, Food, Nutrition, Chat, Template, Settings", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: ADMIN_EMAIL }).firestore();
  const created = new Date(Date.now() - 10000);
  const updated = new Date(Date.now() - 1000);

  // 1. Client create + update (including monthlyFeeEur & fidelizacaoMonths)
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c1").set({
      userId: ALICE_UID,
      name: "Ana Ribeiro",
      phone: "912345678",
      notes: "Objetivo recomposição",
      active: true,
      newClient: false,
      monthlyFeeEur: 120.0,
      fidelizacaoMonths: 12,
      fidelizacaoStartMillis: 1790000000000,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c1").update({
      name: "Ana Ribeiro Silva",
      monthlyFeeEur: 135.0,
      fidelizacaoMonths: 6,
      newClient: false,
      updatedAt: updated,
    })
  );

  // 2. Week + Session + Booking
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/weeks`).doc("2026-W47").set({
      userId: ALICE_UID,
      weekKey: "2026-W47",
      label: "16–22 Nov",
      startDateMillis: 1794873600000,
      published: true,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/sessions`).doc("s1").set({
      userId: ALICE_UID,
      weekKey: "2026-W47",
      dayOfWeek: 1,
      dateLabel: "Segunda, 16 Nov",
      timeLabel: "18:00",
      durationMinutes: 60,
      capacity: 6,
      note: "",
      startMillis: 1794938400000,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/bookings`).doc("b1").set({
      userId: ALICE_UID,
      sessionId: "s1",
      weekKey: "2026-W47",
      clientId: "c1",
      status: "PENDING",
      requestedAtMillis: 1794900000000,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/bookings`).doc("b1").update({
      status: "CONFIRMED",
      updatedAt: updated,
    })
  );

  // 3. Payment & Fidelizacao
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/payments`).doc("p1").set({
      userId: ALICE_UID,
      clientId: "c1",
      monthYear: "2026-11",
      monthLabel: "Nov 2026",
      amountEur: 120.0,
      paid: true,
      paidAtMillis: 1794900000000,
      note: "MB Way",
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/fidelizacoes`).doc("f1").set({
      userId: ALICE_UID,
      clientId: "c1",
      durationMonths: 12,
      startDateMillis: 1790000000000,
      endDateMillis: 1821536000000,
      notes: "Anual",
      createdAt: created,
      updatedAt: created,
    })
  );

  // 4. Exercise, Workout Plan & Item
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/exercises`).doc("ex1").set({
      userId: ALICE_UID,
      name: "Supino Plano com Barra",
      muscleGroup: "Peito",
      equipment: "Barra",
      instructions: "Controlar descida",
      custom: false,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/workout_plans`).doc("wp1").set({
      userId: ALICE_UID,
      clientId: "c1",
      title: "Hipertrofia",
      splitLabel: "Treino A",
      createdAtMillis: 1794900000000,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/workout_plan_items`).doc("wpi1").set({
      userId: ALICE_UID,
      planId: "wp1",
      exerciseId: "ex1",
      exerciseName: "Supino Plano com Barra",
      muscleGroup: "Peito",
      sets: 4,
      reps: "8-10",
      loadKg: "60 kg",
      restSeconds: 90,
      notes: "",
      orderIndex: 0,
      createdAt: created,
      updatedAt: created,
    })
  );

  // 5. Food, Nutrition Entry & Chat
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/foods`).doc("fd1").set({
      userId: ALICE_UID,
      name: "Peito de Frango Grelhado",
      category: "Proteína",
      kcalPer100g: 165.0,
      proteinPer100g: 31.0,
      carbsPer100g: 0.0,
      fatPer100g: 3.6,
      custom: false,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/nutrition_entries`).doc("ne1").set({
      userId: ALICE_UID,
      clientId: "c1",
      mealType: "ALMOCO",
      foodId: "fd1",
      foodName: "Peito de Frango Grelhado",
      grams: 150.0,
      kcal: 247.5,
      protein: 46.5,
      carbs: 0.0,
      fat: 5.4,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/chat_messages`).doc("m1").set({
      userId: ALICE_UID,
      clientId: "c1",
      senderRole: "PT",
      text: "Olá Ana, bom treino!",
      timestampMillis: 1794900000000,
      createdAt: created,
      updatedAt: created,
    })
  );

  // 6. Template & Settings
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/templates`).doc("CONVITE").set({
      userId: ALICE_UID,
      templateKey: "CONVITE",
      title: "Convite",
      description: "Convite semanal",
      body: "Olá {semana} {link}",
      defaultBody: "Olá {semana} {link}",
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/settings`).doc("studio").set({
      userId: ALICE_UID,
      clientsCanEdit: true,
      cutoffHours: 0,
      cutoffMinutes: 15,
      reminderLeadMinutes: 60,
      whatsappWebMode: false,
      siteBaseUrl: "https://newshape.vercel.app",
      seeded: true,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/settings`).doc("studio").update({
      cutoffMinutes: 30,
      cutoffHours: 0,
      reminderLeadMinutes: 45,
      ptWhatsappPhone: "912345678",
      updatedAt: updated,
    })
  );
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/settings`).doc("studio").update({
      reminderLeadMinutes: 2,
      updatedAt: updated,
    })
  );
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/settings`).doc("studio").update({
      reminderLeadMinutes: 2000,
      updatedAt: updated,
    })
  );

  // 7. Physical Assessment create + update + list
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/physical_assessments`).doc("pa1").set({
      userId: ALICE_UID,
      clientId: "c1",
      dateMillis: 1794900000000,
      weightKg: 64.5,
      ageYears: 29,
      heightCm: 168.0,
      sex: "F",
      bodyFatPct: 22.4,
      muscleMassKg: 27.8,
      visceralFat: 4.0,
      bmi: 22.85,
      bmrKcal: 1389.0,
      notes: "Boa evolução",
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/physical_assessments`).doc("pa1").update({
      weightKg: 63.8,
      bmi: 22.6,
      updatedAt: updated,
    })
  );

  // List queries succeed on owner collections
  await assertSucceeds(aliceDb.collection(`users/${ALICE_UID}/clients`).get());
  await assertSucceeds(aliceDb.collection(`users/${ALICE_UID}/payments`).get());
  await assertSucceeds(aliceDb.collection(`users/${ALICE_UID}/physical_assessments`).get());
});

test("Cross-user isolation: Bob cannot read or write Alice's studio data", async () => {
  const past = new Date(Date.now() - 10000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(`users/${ALICE_UID}/clients`).doc("c1").set({
      userId: ALICE_UID,
      name: "Ana Ribeiro",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      createdAt: past,
      updatedAt: past,
    });
  });

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertFails(bobDb.collection(`users/${ALICE_UID}/clients`).doc("c1").get());
  await assertFails(bobDb.collection(`users/${ALICE_UID}/clients`).get());
  await assertFails(
    bobDb.collection(`users/${ALICE_UID}/clients`).doc("c1").update({
      name: "Hijacked",
      updatedAt: new Date(Date.now() - 1000),
    })
  );
});

test("Security bounds: reject ghost fields, extra @DocumentId id, immutable createdAt mutation, invalid durationMonths, and future timestamps", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const created = new Date(Date.now() - 10000);
  const future = new Date(Date.now() + 120000);

  // Reject extra `id` field (@DocumentId parity)
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_bad_id").set({
      id: "c_bad_id",
      userId: ALICE_UID,
      name: "Teste",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Reject ghost field
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_ghost").set({
      userId: ALICE_UID,
      name: "Teste",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      isAdmin: true,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Reject invalid fidelizacao duration (must be 6 or 12)
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/fidelizacoes`).doc("f_bad").set({
      userId: ALICE_UID,
      clientId: "c1",
      durationMonths: 3,
      startDateMillis: 1790000000000,
      endDateMillis: 1800000000000,
      notes: "",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Reject future timestamp
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_future").set({
      userId: ALICE_UID,
      name: "Teste",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      createdAt: future,
      updatedAt: future,
    })
  );

  // Reject mutating createdAt on update
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_ok").set({
      userId: ALICE_UID,
      name: "Original",
      phone: "912345678",
      notes: "",
      active: true,
      newClient: false,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_ok").update({
      createdAt: new Date(Date.now() - 500),
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // Reject invalid physical assessment (weight <= 0 or invalid sex)
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/physical_assessments`).doc("pa_bad").set({
      userId: ALICE_UID,
      clientId: "c1",
      dateMillis: 1794900000000,
      weightKg: -5.0,
      ageYears: 29,
      heightCm: 168.0,
      sex: "X",
      bodyFatPct: 20.0,
      muscleMassKg: 25.0,
      visceralFat: 4.0,
      bmi: 20.0,
      bmrKcal: 1300.0,
      notes: "",
      createdAt: created,
      updatedAt: created,
    })
  );
});

test("Student portal link access: requires valid studentPortalCode and enforces student permissions", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const studentDb = testEnv.authenticatedContext("student_portal_789").firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const created = new Date(Date.now() - 10000);

  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/settings`).doc("studio").set({
      userId: ALICE_UID,
      clientsCanEdit: true,
      cutoffHours: 12,
      whatsappWebMode: false,
      siteBaseUrl: "https://newshape.vercel.app",
      studentPortalCode: "ns_invite_2026_abc",
      seeded: true,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Wrong invite code fails
  await assertFails(
    bobDb.collection(`users/${ALICE_UID}/portal_members`).doc(BOB_UID).set({
      userId: ALICE_UID,
      memberUid: BOB_UID,
      inviteCode: "wrong_code_123",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Valid invite code succeeds
  await assertSucceeds(
    studentDb.collection(`users/${ALICE_UID}/portal_members`).doc("student_portal_789").set({
      userId: ALICE_UID,
      memberUid: "student_portal_789",
      inviteCode: "ns_invite_2026_abc",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Student can register self, book as PENDING, log nutrition/assessment/chat
  await assertSucceeds(
    studentDb.collection(`users/${ALICE_UID}/clients`).doc("c_student").set({
      userId: ALICE_UID,
      name: "Beatriz Silva",
      phone: "919111222",
      notes: "RGPD aceite",
      active: true,
      newClient: true,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    studentDb.collection(`users/${ALICE_UID}/bookings`).doc("bk_stu_1").set({
      userId: ALICE_UID,
      sessionId: "ses_1",
      weekKey: "2026-W47",
      clientId: "c_student",
      status: "PENDING",
      requestedAtMillis: 1794900000000,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Student CANNOT self-confirm a booking
  await assertFails(
    studentDb.collection(`users/${ALICE_UID}/bookings`).doc("bk_stu_bad").set({
      userId: ALICE_UID,
      sessionId: "ses_1",
      weekKey: "2026-W47",
      clientId: "c_student",
      status: "CONFIRMED",
      requestedAtMillis: 1794900000000,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Student CANNOT create payments or sessions
  await assertFails(
    studentDb.collection(`users/${ALICE_UID}/payments`).doc("pay_bad").set({
      userId: ALICE_UID,
      clientId: "c_student",
      monthYear: "2026-11",
      monthLabel: "Nov 2026",
      amountEur: 0,
      paid: true,
      paidAtMillis: 1794900000000,
      note: "MbWay",
      createdAt: created,
      updatedAt: created,
    })
  );

  // PT creates client with trainingType, confirms booking + marks attendance, and creates workout plan item
  const updated = new Date(Date.now() - 1000);
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_student").update({
      trainingType: "PERSONALIZADO",
      updatedAt: updated,
    })
  );
  await assertFails(
    aliceDb.collection(`users/${ALICE_UID}/clients`).doc("c_student").update({
      trainingType: "INVALIDO",
      updatedAt: updated,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/bookings`).doc("bk_stu_1").update({
      status: "CONFIRMED",
      attendanceStatus: "PRESENT",
      updatedAt: updated,
    })
  );
  // Student CANNOT change attendanceStatus on a booking
  await assertFails(
    studentDb.collection(`users/${ALICE_UID}/bookings`).doc("bk_stu_1").update({
      status: "ALTERED",
      attendanceStatus: "ABSENT",
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // PT creates workout plan item; student CAN update ONLY loadKg, NOT sets/reps
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/workout_plan_items`).doc("wpi_stu").set({
      userId: ALICE_UID,
      planId: "wp1",
      exerciseId: "ex1",
      exerciseName: "Supino",
      muscleGroup: "Peito",
      sets: 4,
      reps: "10",
      loadKg: "40 kg",
      restSeconds: 90,
      notes: "",
      orderIndex: 0,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(
    studentDb.collection(`users/${ALICE_UID}/workout_plan_items`).doc("wpi_stu").update({
      loadKg: "45 kg",
      lastLoadKg: "40 kg",
      lastLoggedAtMillis: 1794910000000,
      updatedAt: updated,
    })
  );
  await assertFails(
    studentDb.collection(`users/${ALICE_UID}/workout_plan_items`).doc("wpi_stu").update({
      sets: 10,
      loadKg: "50 kg",
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // Student CAN create pt_notifications (read: false), CANNOT read or mark as read
  await assertSucceeds(
    studentDb.collection(`users/${ALICE_UID}/pt_notifications`).doc("notif_1").set({
      userId: ALICE_UID,
      clientId: "c_student",
      clientName: "Beatriz Silva",
      type: "CANCELLED",
      summary: "Beatriz Silva cancelou o treino de Segunda 18:00.",
      weekKey: "2026-W47",
      read: false,
      timestampMillis: 1794920000000,
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertFails(
    studentDb.collection(`users/${ALICE_UID}/pt_notifications`).doc("notif_1").update({
      read: true,
      updatedAt: updated,
    })
  );
  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/pt_notifications`).doc("notif_1").update({
      read: true,
      updatedAt: updated,
    })
  );
});

test("Super-Admin PT (pafm77pedrinho77@gmail.com) manages PT approvals and is the only PT with billing access", async () => {
  const adminDb = testEnv.authenticatedContext(ALICE_UID, { email: ADMIN_EMAIL }).firestore();
  const otherPtDb = testEnv.authenticatedContext(BOB_UID, { email: BOB_EMAIL }).firestore();
  const created = new Date(Date.now() - 10000);
  const updated = new Date(Date.now() - 1000);

  // Non-admin PT cannot self-approve or claim isAdmin
  await assertFails(
    otherPtDb.collection("pt_accounts").doc(BOB_UID).set({
      uid: BOB_UID,
      email: BOB_EMAIL,
      displayName: "Outro PT",
      status: "APPROVED",
      isAdmin: false,
      requestedAtMillis: 1794900000000,
      reviewedAtMillis: 0,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Non-admin PT can register with status PENDING, isAdmin false
  await assertSucceeds(
    otherPtDb.collection("pt_accounts").doc(BOB_UID).set({
      uid: BOB_UID,
      email: BOB_EMAIL,
      displayName: "Outro PT",
      status: "PENDING",
      isAdmin: false,
      requestedAtMillis: 1794900000000,
      reviewedAtMillis: 0,
      createdAt: created,
      updatedAt: created,
    })
  );

  // Non-admin PT cannot list all pt_accounts or approve themselves
  await assertFails(otherPtDb.collection("pt_accounts").get());
  await assertFails(
    otherPtDb.collection("pt_accounts").doc(BOB_UID).update({
      status: "APPROVED",
      reviewedAtMillis: 1794910000000,
      updatedAt: updated,
    })
  );

  // Super-Admin can list and approve non-admin PT
  await assertSucceeds(adminDb.collection("pt_accounts").get());
  await assertSucceeds(
    adminDb.collection("pt_accounts").doc(BOB_UID).update({
      status: "APPROVED",
      reviewedAtMillis: 1794910000000,
      updatedAt: updated,
    })
  );

  // Non-admin PT CANNOT read or create payments even under their own userId
  await assertFails(otherPtDb.collection(`users/${BOB_UID}/payments`).get());
  await assertFails(
    otherPtDb.collection(`users/${BOB_UID}/payments`).doc("pay_bob").set({
      userId: BOB_UID,
      clientId: "c1",
      monthYear: "2026-11",
      monthLabel: "Nov 2026",
      amountEur: 100.0,
      paid: true,
      paidAtMillis: 1794900000000,
      note: "MbWay",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Super-Admin CAN read and create payments
  await assertSucceeds(
    adminDb.collection(`users/${ALICE_UID}/payments`).doc("pay_admin").set({
      userId: ALICE_UID,
      clientId: "c1",
      monthYear: "2026-11",
      monthLabel: "Nov 2026",
      amountEur: 120.0,
      paid: true,
      paidAtMillis: 1794900000000,
      note: "MbWay",
      createdAt: created,
      updatedAt: created,
    })
  );
  await assertSucceeds(adminDb.collection(`users/${ALICE_UID}/payments`).get());
});



