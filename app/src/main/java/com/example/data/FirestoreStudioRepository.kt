package com.example.data

import com.example.data.model.*
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.tasks.await
import java.util.Calendar

data class ImportResult(
    val added: Int,
    val ignored: Int,
    val errors: List<String>
)

class FirestoreStudioRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    private fun requireUserId(): String {
        return auth.currentUser?.uid?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Inicia sessão com o Google antes de aceder ao Firestore.")
    }

    private fun userDoc(uid: String) = db.collection("users").document(uid)

    private inline fun <reified T : Any> observeSubcollection(
        uid: String,
        subcollection: String,
        crossinline sort: (List<T>) -> List<T> = { it }
    ): Flow<List<T>> = flow {
        require(uid.isNotBlank()) { "UID inválido para consulta Firestore." }
        val path = "users/$uid/$subcollection"
        emitAll(
            userDoc(uid).collection(subcollection)
                .snapshots()
                .map { snapshot ->
                    val list = snapshot.toObjects(T::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    sort(list)
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val toLog = firestoreError ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.LIST, path)
                    }
                    throw error
                }
        )
    }

    fun observeClients(uid: String): Flow<List<ClientRecord>> =
        observeSubcollection<ClientRecord>(uid, "clients") { list ->
            list.sortedWith(compareByDescending<ClientRecord> { it.newClient }.thenBy { it.name.lowercase() })
        }

    fun observeWeeks(uid: String): Flow<List<TrainingWeekRecord>> =
        observeSubcollection<TrainingWeekRecord>(uid, "weeks") { it.sortedBy { w -> w.startDateMillis } }

    fun observeSessions(uid: String): Flow<List<TrainingSessionRecord>> =
        observeSubcollection<TrainingSessionRecord>(uid, "sessions") { it.sortedBy { s -> s.startMillis } }

    fun observeBookings(uid: String): Flow<List<BookingRecord>> =
        observeSubcollection<BookingRecord>(uid, "bookings") { it.sortedBy { b -> b.requestedAtMillis } }

    fun observeWeekResponses(uid: String): Flow<List<WeekResponseRecord>> =
        observeSubcollection(uid, "week_responses")

    fun observePayments(uid: String): Flow<List<PaymentRecord>> =
        observeSubcollection<PaymentRecord>(uid, "payments") { it.sortedByDescending { p -> p.paidAtMillis } }

    fun observeFidelizacoes(uid: String): Flow<List<FidelizacaoRecord>> =
        observeSubcollection<FidelizacaoRecord>(uid, "fidelizacoes") { it.sortedBy { f -> f.endDateMillis } }

    fun observeExercises(uid: String): Flow<List<ExerciseRecord>> =
        observeSubcollection<ExerciseRecord>(uid, "exercises") { list ->
            list.sortedWith(compareBy<ExerciseRecord> { it.muscleGroup }.thenBy { it.name })
        }

    fun observeWorkoutPlans(uid: String): Flow<List<WorkoutPlanRecord>> =
        observeSubcollection<WorkoutPlanRecord>(uid, "workout_plans") { it.sortedByDescending { p -> p.createdAtMillis } }

    fun observeWorkoutPlanItems(uid: String): Flow<List<WorkoutPlanItemRecord>> =
        observeSubcollection<WorkoutPlanItemRecord>(uid, "workout_plan_items") { it.sortedBy { i -> i.orderIndex } }

    fun observeFoods(uid: String): Flow<List<FoodItemRecord>> =
        observeSubcollection<FoodItemRecord>(uid, "foods") { it.sortedBy { f -> f.name } }

    fun observeNutritionEntries(uid: String): Flow<List<NutritionEntryRecord>> =
        observeSubcollection(uid, "nutrition_entries")

    fun observeChatMessages(uid: String): Flow<List<ChatMessageRecord>> =
        observeSubcollection<ChatMessageRecord>(uid, "chat_messages") { it.sortedBy { m -> m.timestampMillis } }

    fun observeTemplates(uid: String): Flow<List<MessageTemplateRecord>> =
        observeSubcollection(uid, "templates")

    fun observePhysicalAssessments(uid: String): Flow<List<PhysicalAssessmentRecord>> =
        observeSubcollection<PhysicalAssessmentRecord>(uid, "physical_assessments") { it.sortedBy { a -> a.dateMillis } }

    fun observeSettings(uid: String): Flow<StudioSettingsRecord?> = flow {
        require(uid.isNotBlank()) { "UID inválido." }
        val docRef = userDoc(uid).collection("settings").document("studio")
        emitAll(
            docRef.snapshots()
                .map { snap ->
                    if (snap.exists()) snap.toObject(StudioSettingsRecord::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    else null
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val toLog = firestoreError ?: (error as? Exception)
                    if (toLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(toLog, OperationType.GET, docRef.path)
                    }
                    throw error
                }
        )
    }

    // --- Initial Seed (Idempotent) ---
    suspend fun ensureSeeded(uid: String): Result<Unit> = try {
        val currentUid = requireUserId()
        check(currentUid == uid)
        val settingsRef = userDoc(uid).collection("settings").document("studio")
        val settingsSnap = settingsRef.get().await()
        if (settingsSnap.exists() && settingsSnap.getBoolean("seeded") == true) {
            // Backfill expanded food catalog & sample assessments for already-seeded accounts
            val existingFoodsSnap = userDoc(uid).collection("foods").get().await()
            val existingFoodIds = existingFoodsSnap.documents.map { it.id }.toSet()
            val missingFoods = SeedCatalog.defaultFoods.filter { it.id !in existingFoodIds }

            val existingAssessmentsSnap = userDoc(uid).collection("physical_assessments").limit(1).get().await()
            val backfillWrites = mutableListOf<Pair<com.google.firebase.firestore.DocumentReference, Map<String, Any>>>()

            missingFoods.forEach { fd ->
                val ref = userDoc(uid).collection("foods").document(fd.id)
                backfillWrites += ref to mapOf(
                    "userId" to uid,
                    "name" to fd.name,
                    "category" to fd.category,
                    "kcalPer100g" to fd.kcalPer100g,
                    "proteinPer100g" to fd.proteinPer100g,
                    "carbsPer100g" to fd.carbsPer100g,
                    "fatPer100g" to fd.fatPer100g,
                    "custom" to false,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            if (existingAssessmentsSnap.isEmpty) {
                val now = System.currentTimeMillis()
                val dayMs = 86_400_000L
                listOf(
                    listOf("pa_ana_1", now - dayMs * 60, 68.5, 29, 166.0, "F", 26.8, 25.1, 6.0, "Avaliação inicial"),
                    listOf("pa_ana_2", now - dayMs * 30, 66.8, 29, 166.0, "F", 24.9, 25.5, 5.5, "Boa evolução de força"),
                    listOf("pa_ana_3", now - dayMs * 2, 65.4, 29, 166.0, "F", 23.2, 26.0, 5.0, "Recomposição corporal consistente")
                ).forEach { pa ->
                    val w = pa[2] as Double
                    val age = pa[3] as Int
                    val h = pa[4] as Double
                    val sex = pa[5] as String
                    backfillWrites += userDoc(uid).collection("physical_assessments").document(pa[0] as String) to mapOf(
                        "userId" to uid,
                        "clientId" to "client_ana",
                        "dateMillis" to (pa[1] as Long),
                        "weightKg" to w,
                        "ageYears" to age,
                        "heightCm" to h,
                        "sex" to sex,
                        "bodyFatPct" to (pa[6] as Double),
                        "muscleMassKg" to (pa[7] as Double),
                        "visceralFat" to (pa[8] as Double),
                        "bmi" to PhysicalCalculations.calculateBmi(w, h),
                        "bmrKcal" to PhysicalCalculations.calculateBmrMifflinStJeor(w, h, age, sex),
                        "notes" to (pa[9] as String),
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                }
            }

            backfillWrites.chunked(400).forEach { chunk ->
                val batch = db.batch()
                chunk.forEach { (ref, payload) -> batch.set(ref, payload) }
                batch.commit().await()
            }
            val existingCode = settingsSnap.getString("studentPortalCode").orEmpty()
            if (existingCode.length < 8) {
                settingsRef.update(
                    mapOf(
                        "studentPortalCode" to generatePortalCode(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            Result.success(Unit)
        } else {
            val writes = mutableListOf<Pair<com.google.firebase.firestore.DocumentReference, Map<String, Any>>>()

            // Exercises
            SeedCatalog.defaultExercises.forEach { ex ->
                val ref = userDoc(uid).collection("exercises").document(ex.id)
                writes += ref to mapOf(
                    "userId" to uid,
                    "name" to ex.name,
                    "muscleGroup" to ex.muscleGroup,
                    "equipment" to ex.equipment,
                    "instructions" to ex.instructions,
                    "custom" to false,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Foods
            SeedCatalog.defaultFoods.forEach { fd ->
                val ref = userDoc(uid).collection("foods").document(fd.id)
                writes += ref to mapOf(
                    "userId" to uid,
                    "name" to fd.name,
                    "category" to fd.category,
                    "kcalPer100g" to fd.kcalPer100g,
                    "proteinPer100g" to fd.proteinPer100g,
                    "carbsPer100g" to fd.carbsPer100g,
                    "fatPer100g" to fd.fatPer100g,
                    "custom" to false,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Templates
            SeedCatalog.defaultTemplates.forEach { tpl ->
                val ref = userDoc(uid).collection("templates").document(tpl.templateKey)
                writes += ref to mapOf(
                    "userId" to uid,
                    "templateKey" to tpl.templateKey,
                    "title" to tpl.title,
                    "description" to tpl.description,
                    "body" to tpl.body,
                    "defaultBody" to tpl.defaultBody,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Sample Clients
            val clients = listOf(
                Triple("client_ana", "Ana Ribeiro", "912345678") to ("Objetivo: recomposição corporal · Manhãs/18h" to false),
                Triple("client_bruno", "Bruno Costa", "912345602") to ("Lesão antiga joelho direito — evitar impacto" to false),
                Triple("client_eva", "Eva Martins", "912345605") to ("Treino força 3x/semana" to false),
                Triple("client_filipe", "Filipe Sousa", "912345606") to ("" to false),
                Triple("client_hugo", "Hugo Pereira", "912345608") to ("Horário pós-laboral" to false),
                Triple("client_joao", "João Almeida", "912345610") to ("" to true)
            )
            val feeDefaults = mapOf(
                "client_ana" to Triple(120.0, 12, System.currentTimeMillis() - 60 * 86_400_000L),
                "client_bruno" to Triple(95.0, 6, System.currentTimeMillis() - 145 * 86_400_000L),
                "client_eva" to Triple(120.0, 12, System.currentTimeMillis() - 30 * 86_400_000L),
                "client_filipe" to Triple(110.0, 0, 0L),
                "client_hugo" to Triple(95.0, 0, 0L),
                "client_joao" to Triple(100.0, 0, 0L)
            )
            clients.forEach { (idNamePhone, notesNew) ->
                val (cid, cname, cphone) = idNamePhone
                val (cnotes, cisNew) = notesNew
                val (feeEur, fidMonths, fidStart) = feeDefaults[cid] ?: Triple(0.0, 0, 0L)
                writes += userDoc(uid).collection("clients").document(cid) to mapOf(
                    "userId" to uid,
                    "name" to cname,
                    "phone" to cphone,
                    "notes" to cnotes,
                    "active" to true,
                    "newClient" to cisNew,
                    "monthlyFeeEur" to feeEur,
                    "fidelizacaoMonths" to fidMonths,
                    "fidelizacaoStartMillis" to fidStart,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Weeks (current & next)
            val cal = Calendar.getInstance().apply {
                firstDayOfWeek = Calendar.MONDAY
                set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val currentMonday = cal.timeInMillis
            val weekKey1 = SeedCatalog.formatWeekKey(cal)
            val weekLabel1 = SeedCatalog.formatWeekRangeLabel(cal)

            val nextCal = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 7) }
            val nextMonday = nextCal.timeInMillis
            val weekKey2 = SeedCatalog.formatWeekKey(nextCal)
            val weekLabel2 = SeedCatalog.formatWeekRangeLabel(nextCal)

            writes += userDoc(uid).collection("weeks").document(weekKey1) to mapOf(
                "userId" to uid,
                "weekKey" to weekKey1,
                "label" to weekLabel1,
                "startDateMillis" to currentMonday,
                "published" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            writes += userDoc(uid).collection("weeks").document(weekKey2) to mapOf(
                "userId" to uid,
                "weekKey" to weekKey2,
                "label" to weekLabel2,
                "startDateMillis" to nextMonday,
                "published" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            // Sessions
            val sampleSessions = listOf(
                "ses_1" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 1, 18, 0, 60, 6, ""),
                "ses_2" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 1, 19, 0, 60, 6, ""),
                "ses_3" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 2, 7, 30, 45, 5, "Treino de mobilidade"),
                "ses_4" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 2, 19, 0, 60, 6, ""),
                "ses_5" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 3, 18, 0, 60, 6, ""),
                "ses_6" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 3, 19, 0, 60, 6, "Treino ao ar livre"),
                "ses_7" to SeedCatalog.createSession(uid, weekKey1, currentMonday, 5, 18, 30, 60, 6, ""),
                "ses_8" to SeedCatalog.createSession(uid, weekKey2, nextMonday, 1, 18, 0, 60, 6, ""),
                "ses_9" to SeedCatalog.createSession(uid, weekKey2, nextMonday, 3, 18, 0, 60, 6, ""),
                "ses_10" to SeedCatalog.createSession(uid, weekKey2, nextMonday, 5, 18, 30, 60, 6, "")
            )
            sampleSessions.forEach { (sid, s) ->
                writes += userDoc(uid).collection("sessions").document(sid) to mapOf(
                    "userId" to uid,
                    "weekKey" to s.weekKey,
                    "dayOfWeek" to s.dayOfWeek,
                    "dateLabel" to s.dateLabel,
                    "timeLabel" to s.timeLabel,
                    "durationMinutes" to s.durationMinutes,
                    "capacity" to s.capacity,
                    "note" to s.note,
                    "startMillis" to s.startMillis,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Bookings
            val now = System.currentTimeMillis()
            val sampleBookings = listOf(
                Triple("bk_1", "ses_1", "client_ana") to (BookingStatus.CONFIRMED.name to now - 36_000_000),
                Triple("bk_2", "ses_5", "client_ana") to (BookingStatus.CONFIRMED.name to now - 36_000_000),
                Triple("bk_3", "ses_6", "client_bruno") to (BookingStatus.CONFIRMED.name to now - 30_000_000),
                Triple("bk_4", "ses_1", "client_eva") to (BookingStatus.PENDING.name to now - 28_000_000),
                Triple("bk_5", "ses_5", "client_eva") to (BookingStatus.PENDING.name to now - 28_000_000),
                Triple("bk_6", "ses_4", "client_filipe") to (BookingStatus.PENDING.name to now - 20_000_000),
                Triple("bk_7", "ses_4", "client_hugo") to (BookingStatus.ALTERED.name to now - 10_000_000),
                Triple("bk_8", "ses_7", "client_hugo") to (BookingStatus.ALTERED.name to now - 10_000_000)
            )
            sampleBookings.forEach { (idSesClient, statusTime) ->
                val (bid, sid, cid) = idSesClient
                val (st, ts) = statusTime
                writes += userDoc(uid).collection("bookings").document(bid) to mapOf(
                    "userId" to uid,
                    "sessionId" to sid,
                    "weekKey" to weekKey1,
                    "clientId" to cid,
                    "status" to st,
                    "requestedAtMillis" to ts,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Payments
            val dayMs = 86_400_000L
            val samplePayments = listOf(
                listOf("pay_1", "client_ana", "2026-11", "Nov 2026", 120.0, now - dayMs * 5, "MbWay"),
                listOf("pay_2", "client_bruno", "2026-11", "Nov 2026", 95.0, now - dayMs * 3, "João"),
                listOf("pay_3", "client_eva", "2026-11", "Nov 2026", 120.0, now - dayMs * 2, "MbWay"),
                listOf("pay_4", "client_ana", "2026-10", "Out 2026", 120.0, now - dayMs * 35, "MbWay"),
                listOf("pay_5", "client_bruno", "2026-10", "Out 2026", 95.0, now - dayMs * 34, "João"),
                listOf("pay_6", "client_filipe", "2026-10", "Out 2026", 110.0, now - dayMs * 33, "Dinheiro"),
                listOf("pay_7", "client_ana", "2026-09", "Set 2026", 120.0, now - dayMs * 65, "MbWay"),
                listOf("pay_8", "client_eva", "2026-09", "Set 2026", 120.0, now - dayMs * 62, "Dinheiro")
            )
            samplePayments.forEach { p ->
                writes += userDoc(uid).collection("payments").document(p[0] as String) to mapOf(
                    "userId" to uid,
                    "clientId" to (p[1] as String),
                    "monthYear" to (p[2] as String),
                    "monthLabel" to (p[3] as String),
                    "amountEur" to (p[4] as Double),
                    "paid" to true,
                    "paidAtMillis" to (p[5] as Long),
                    "note" to (p[6] as String),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Fidelizações
            val sampleFid = listOf(
                listOf("fid_1", "client_ana", 12, now - dayMs * 60, now + dayMs * 305, "Plano Anual 3x/sem"),
                listOf("fid_2", "client_bruno", 6, now - dayMs * 145, now + dayMs * 35, "Plano Semestral 2x/sem"),
                listOf("fid_3", "client_eva", 12, now - dayMs * 30, now + dayMs * 335, "Plano Anual + Nutrição")
            )
            sampleFid.forEach { f ->
                writes += userDoc(uid).collection("fidelizacoes").document(f[0] as String) to mapOf(
                    "userId" to uid,
                    "clientId" to (f[1] as String),
                    "durationMonths" to (f[2] as Int),
                    "startDateMillis" to (f[3] as Long),
                    "endDateMillis" to (f[4] as Long),
                    "notes" to (f[5] as String),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Workout Plan for Ana
            writes += userDoc(uid).collection("workout_plans").document("wp_ana_1") to mapOf(
                "userId" to uid,
                "clientId" to "client_ana",
                "title" to "Recomposição Corporal",
                "splitLabel" to "Treino A · Corpo Inteiro",
                "createdAtMillis" to now,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            val wpItems = listOf(
                listOf("wpi_1", "ex_15", "Agachamento Livre com Barra", "Pernas", 4, "8-10", "50 kg", 120, "Controlar descida 3s", 0),
                listOf("wpi_2", "ex_2", "Supino Inclinado com Halteres", "Peito", 3, "10-12", "14 kg", 90, "", 1),
                listOf("wpi_3", "ex_8", "Puxada à Frente (Lat Pulldown)", "Costas", 3, "10-12", "45 kg", 90, "", 2),
                listOf("wpi_4", "ex_26", "Elevações Laterais com Halteres", "Ombros", 3, "12-15", "6 kg", 60, "", 3),
                listOf("wpi_5", "ex_37", "Prancha Abdominal (Plank)", "Core", 3, "45s", "Corporal", 45, "", 4)
            )
            wpItems.forEach { wpi ->
                writes += userDoc(uid).collection("workout_plan_items").document(wpi[0] as String) to mapOf(
                    "userId" to uid,
                    "planId" to "wp_ana_1",
                    "exerciseId" to (wpi[1] as String),
                    "exerciseName" to (wpi[2] as String),
                    "muscleGroup" to (wpi[3] as String),
                    "sets" to (wpi[4] as Int),
                    "reps" to (wpi[5] as String),
                    "loadKg" to (wpi[6] as String),
                    "restSeconds" to (wpi[7] as Int),
                    "notes" to (wpi[8] as String),
                    "orderIndex" to (wpi[9] as Int),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Nutrition Entries for Ana
            val sampleNut = listOf(
                listOf("ne_1", MealType.PEQUENO_ALMOCO.name, "fd_20", "Flocos de Aveia", 60.0, 225.0, 8.1, 36.0, 4.2),
                listOf("ne_2", MealType.PEQUENO_ALMOCO.name, "fd_13", "Whey Protein Concentrada", 30.0, 120.0, 23.4, 2.4, 1.8),
                listOf("ne_3", MealType.ALMOCO.name, "fd_1", "Peito de Frango Grelhado", 150.0, 247.5, 46.5, 0.0, 5.4),
                listOf("ne_4", MealType.ALMOCO.name, "fd_15", "Arroz Basmati Cozido", 180.0, 234.0, 4.9, 50.4, 0.5),
                listOf("ne_5", MealType.LANCHE_TARDE.name, "fd_10", "Queijo Quark 0% MG", 150.0, 93.0, 18.0, 5.3, 0.3),
                listOf("ne_6", MealType.LANCHE_TARDE.name, "fd_25", "Banana", 100.0, 89.0, 1.1, 23.0, 0.3),
                listOf("ne_7", MealType.JANTAR.name, "fd_5", "Salmão Grelhado", 140.0, 291.2, 28.0, 0.0, 18.2),
                listOf("ne_8", MealType.JANTAR.name, "fd_17", "Batata Doce Cozida/Assada", 160.0, 144.0, 3.2, 33.6, 0.2)
            )
            sampleNut.forEach { n ->
                writes += userDoc(uid).collection("nutrition_entries").document(n[0] as String) to mapOf(
                    "userId" to uid,
                    "clientId" to "client_ana",
                    "mealType" to (n[1] as String),
                    "foodId" to (n[2] as String),
                    "foodName" to (n[3] as String),
                    "grams" to (n[4] as Double),
                    "kcal" to (n[5] as Double),
                    "protein" to (n[6] as Double),
                    "carbs" to (n[7] as Double),
                    "fat" to (n[8] as Double),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Chat Messages
            writes += userDoc(uid).collection("chat_messages").document("chat_1") to mapOf(
                "userId" to uid,
                "clientId" to "client_ana",
                "senderRole" to "STUDENT",
                "text" to "Olá! Posso aumentar 2.5kg no agachamento esta semana?",
                "timestampMillis" to now - 7_200_000,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            writes += userDoc(uid).collection("chat_messages").document("chat_2") to mapOf(
                "userId" to uid,
                "clientId" to "client_ana",
                "senderRole" to "PT",
                "text" to "Olá Ana! Sim, se fizeres as 8 repetições limpas na primeira série, sobe para 52.5 kg 💪",
                "timestampMillis" to now - 5_400_000,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            writes += userDoc(uid).collection("chat_messages").document("chat_3") to mapOf(
                "userId" to uid,
                "clientId" to "client_eva",
                "senderRole" to "STUDENT",
                "text" to "Já marquei os treinos desta semana na agenda!",
                "timestampMillis" to now - 3_600_000,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            // Sample Physical Assessments for Ana
            listOf(
                listOf("pa_ana_1", now - dayMs * 60, 68.5, 29, 166.0, "F", 26.8, 25.1, 6.0, "Avaliação inicial"),
                listOf("pa_ana_2", now - dayMs * 30, 66.8, 29, 166.0, "F", 24.9, 25.5, 5.5, "Boa evolução de força"),
                listOf("pa_ana_3", now - dayMs * 2, 65.4, 29, 166.0, "F", 23.2, 26.0, 5.0, "Recomposição corporal consistente")
            ).forEach { pa ->
                val w = pa[2] as Double
                val age = pa[3] as Int
                val h = pa[4] as Double
                val sex = pa[5] as String
                writes += userDoc(uid).collection("physical_assessments").document(pa[0] as String) to mapOf(
                    "userId" to uid,
                    "clientId" to "client_ana",
                    "dateMillis" to (pa[1] as Long),
                    "weightKg" to w,
                    "ageYears" to age,
                    "heightCm" to h,
                    "sex" to sex,
                    "bodyFatPct" to (pa[6] as Double),
                    "muscleMassKg" to (pa[7] as Double),
                    "visceralFat" to (pa[8] as Double),
                    "bmi" to PhysicalCalculations.calculateBmi(w, h),
                    "bmrKcal" to PhysicalCalculations.calculateBmrMifflinStJeor(w, h, age, sex),
                    "notes" to (pa[9] as String),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            }

            // Settings (marks seeded = true)
            writes += settingsRef to mapOf(
                "userId" to uid,
                "clientsCanEdit" to true,
                "cutoffHours" to 12,
                "whatsappWebMode" to false,
                "siteBaseUrl" to "https://newshape.vercel.app",
                "studentPortalCode" to generatePortalCode(),
                "seeded" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            // Commit in chunks of 400
            writes.chunked(400).forEach { chunk ->
                val batch = db.batch()
                chunk.forEach { (ref, payload) -> batch.set(ref, payload) }
                batch.commit().await()
            }
            Result.success(Unit)
        }
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uid/settings/studio")
        Result.failure(e)
    }

    // --- Clients ---
    fun normalizePortuguesePhone(input: String): String {
        var digits = input.filter { it.isDigit() }
        if (digits.startsWith("00351")) digits = digits.drop(5)
        else if (digits.startsWith("351") && digits.length > 9) digits = digits.drop(3)
        return digits.take(9)
    }

    suspend fun addClient(
        name: String,
        phone: String,
        notes: String,
        newClient: Boolean = false,
        monthlyFeeEur: Double = 0.0,
        fidelizacaoMonths: Int = 0,
        fidelizacaoStartMillis: Long = 0L
    ): Result<String> {
        var path = "users/unknown/clients"
        return try {
            val uid = requireUserId()
            val cleanName = name.trim().take(100)
            require(cleanName.isNotEmpty()) { "O nome do aluno é obrigatório." }
            val cleanPhone = normalizePortuguesePhone(phone)
            val docRef = userDoc(uid).collection("clients").document()
            path = docRef.path
            docRef.set(
                mapOf(
                    "userId" to uid,
                    "name" to cleanName,
                    "phone" to cleanPhone,
                    "notes" to notes.trim().take(500),
                    "active" to true,
                    "newClient" to newClient,
                    "monthlyFeeEur" to monthlyFeeEur.coerceIn(0.0, 100000.0),
                    "fidelizacaoMonths" to (if (fidelizacaoMonths in listOf(6, 12)) fidelizacaoMonths else 0),
                    "fidelizacaoStartMillis" to fidelizacaoStartMillis.coerceAtLeast(0L),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(docRef.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun updateClient(client: ClientRecord): Result<Unit> {
        var path = "users/unknown/clients/${client.id}"
        return try {
            val uid = requireUserId()
            require(client.id.isNotBlank())
            val docRef = userDoc(uid).collection("clients").document(client.id)
            path = docRef.path
            docRef.update(
                mapOf(
                    "name" to client.name.trim().take(100),
                    "phone" to normalizePortuguesePhone(client.phone),
                    "notes" to client.notes.trim().take(500),
                    "active" to client.active,
                    "newClient" to false,
                    "monthlyFeeEur" to client.monthlyFeeEur.coerceIn(0.0, 100000.0),
                    "fidelizacaoMonths" to (if (client.fidelizacaoMonths in listOf(6, 12)) client.fidelizacaoMonths else 0),
                    "fidelizacaoStartMillis" to client.fidelizacaoStartMillis.coerceAtLeast(0L),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun setClientActive(client: ClientRecord, active: Boolean): Result<Unit> {
        return updateClient(client.copy(active = active))
    }

    suspend fun importClientsCsv(rawText: String, existingClients: List<ClientRecord>): Result<ImportResult> = try {
        val uid = requireUserId()
        val existingPhones = existingClients.map { it.phone }.toMutableSet()
        var added = 0
        var ignored = 0
        val errors = mutableListOf<String>()
        val lines = rawText.lines().map { it.trim() }.filter { it.isNotEmpty() }
        val batch = db.batch()

        for ((index, line) in lines.withIndex()) {
            if (index == 0 && line.lowercase().contains("nome") && line.lowercase().contains("telem")) continue
            val delimiter = if (line.contains(';')) ';' else ','
            val parts = line.split(delimiter).map { it.trim() }
            if (parts.size < 2) {
                errors.add("Linha ${index + 1}: formato inválido")
                continue
            }
            val name = parts[0].take(100)
            val phone = normalizePortuguesePhone(parts[1])
            if (name.isBlank() || phone.length != 9 || (!phone.startsWith("9") && !phone.startsWith("2"))) {
                errors.add("Linha ${index + 1}: telemóvel inválido (${parts[1]})")
                continue
            }
            if (phone in existingPhones) {
                ignored++
                continue
            }
            existingPhones.add(phone)
            val docRef = userDoc(uid).collection("clients").document()
            batch.set(
                docRef,
                mapOf(
                    "userId" to uid,
                    "name" to name,
                    "phone" to phone,
                    "notes" to "",
                    "active" to true,
                    "newClient" to false,
                    "monthlyFeeEur" to 0.0,
                    "fidelizacaoMonths" to 0,
                    "fidelizacaoStartMillis" to 0L,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            added++
        }
        if (added > 0) batch.commit().await()
        Result.success(ImportResult(added, ignored, errors))
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/${auth.currentUser?.uid}/clients")
        Result.failure(e)
    }

    // --- Weeks & Sessions ---
    suspend fun ensureWeekExists(mondayMillis: Long): Result<TrainingWeekRecord> {
        var path = "users/unknown/weeks"
        return try {
            val uid = requireUserId()
            val cal = Calendar.getInstance().apply { timeInMillis = mondayMillis }
            val key = SeedCatalog.formatWeekKey(cal)
            val label = SeedCatalog.formatWeekRangeLabel(cal)
            val docRef = userDoc(uid).collection("weeks").document(key)
            path = docRef.path
            val snap = docRef.get().await()
            if (!snap.exists()) {
                docRef.set(
                    mapOf(
                        "userId" to uid,
                        "weekKey" to key,
                        "label" to label,
                        "startDateMillis" to mondayMillis,
                        "published" to false,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            Result.success(TrainingWeekRecord(id = key, userId = uid, weekKey = key, label = label, startDateMillis = mondayMillis, published = snap.getBoolean("published") ?: false))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, path)
            Result.failure(e)
        }
    }

    suspend fun setWeekPublished(week: TrainingWeekRecord, published: Boolean): Result<Unit> {
        var path = "users/unknown/weeks/${week.weekKey}"
        return try {
            val uid = requireUserId()
            val docRef = userDoc(uid).collection("weeks").document(week.weekKey)
            path = docRef.path
            docRef.update(mapOf("published" to published, "updatedAt" to FieldValue.serverTimestamp())).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun createSessions(
        week: TrainingWeekRecord,
        selectedDays: Set<Int>,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        capacity: Int,
        note: String
    ): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        selectedDays.sorted().forEach { day ->
            val s = SeedCatalog.createSession(uid, week.weekKey, week.startDateMillis, day, hour, minute, durationMinutes, capacity, note.trim().take(200))
            val docRef = userDoc(uid).collection("sessions").document()
            batch.set(
                docRef,
                mapOf(
                    "userId" to uid,
                    "weekKey" to s.weekKey,
                    "dayOfWeek" to s.dayOfWeek,
                    "dateLabel" to s.dateLabel,
                    "timeLabel" to s.timeLabel,
                    "durationMinutes" to s.durationMinutes,
                    "capacity" to s.capacity,
                    "note" to s.note,
                    "startMillis" to s.startMillis,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/sessions")
        Result.failure(e)
    }

    suspend fun updateSession(session: TrainingSessionRecord): Result<Unit> {
        var path = "users/unknown/sessions/${session.id}"
        return try {
            val uid = requireUserId()
            val docRef = userDoc(uid).collection("sessions").document(session.id)
            path = docRef.path
            docRef.update(
                mapOf(
                    "timeLabel" to session.timeLabel.take(20),
                    "durationMinutes" to session.durationMinutes.coerceIn(10, 300),
                    "capacity" to session.capacity.coerceIn(1, 100),
                    "note" to session.note.trim().take(200),
                    "startMillis" to session.startMillis,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun deleteSession(sessionId: String, relatedBookings: List<BookingRecord>): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        relatedBookings.filter { it.sessionId == sessionId }.forEach { b ->
            batch.delete(userDoc(uid).collection("bookings").document(b.id))
        }
        batch.delete(userDoc(uid).collection("sessions").document(sessionId))
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/sessions/$sessionId")
        Result.failure(e)
    }

    suspend fun duplicatePreviousWeek(
        targetWeek: TrainingWeekRecord,
        prevSessions: List<TrainingSessionRecord>,
        existingTargetSessions: List<TrainingSessionRecord>
    ): Result<Int> = try {
        val uid = requireUserId()
        val batch = db.batch()
        var count = 0
        prevSessions.forEach { prev ->
            val parts = prev.timeLabel.split(":")
            val h = parts.getOrNull(0)?.toIntOrNull() ?: 18
            val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
            val exists = existingTargetSessions.any { it.dayOfWeek == prev.dayOfWeek && it.timeLabel == prev.timeLabel }
            if (!exists) {
                val s = SeedCatalog.createSession(uid, targetWeek.weekKey, targetWeek.startDateMillis, prev.dayOfWeek, h, m, prev.durationMinutes, prev.capacity, prev.note)
                val ref = userDoc(uid).collection("sessions").document()
                batch.set(
                    ref,
                    mapOf(
                        "userId" to uid,
                        "weekKey" to s.weekKey,
                        "dayOfWeek" to s.dayOfWeek,
                        "dateLabel" to s.dateLabel,
                        "timeLabel" to s.timeLabel,
                        "durationMinutes" to s.durationMinutes,
                        "capacity" to s.capacity,
                        "note" to s.note,
                        "startMillis" to s.startMillis,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
                count++
            }
        }
        if (count > 0) batch.commit().await()
        Result.success(count)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/sessions")
        Result.failure(e)
    }

    // --- Bookings & Confirmations ---
    suspend fun addManualBooking(sessionId: String, weekKey: String, clientId: String): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        val respRef = userDoc(uid).collection("week_responses").document("${weekKey}_$clientId")
        batch.delete(respRef)
        val bkRef = userDoc(uid).collection("bookings").document()
        batch.set(
            bkRef,
            mapOf(
                "userId" to uid,
                "sessionId" to sessionId,
                "weekKey" to weekKey,
                "clientId" to clientId,
                "status" to BookingStatus.CONFIRMED.name,
                "requestedAtMillis" to System.currentTimeMillis(),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/bookings")
        Result.failure(e)
    }

    suspend fun removeBooking(bookingId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("bookings").document(bookingId).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/bookings/$bookingId")
        Result.failure(e)
    }

    suspend fun confirmClientBookings(bookings: List<BookingRecord>): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        bookings.forEach { b ->
            val ref = userDoc(uid).collection("bookings").document(b.id)
            if (b.status == BookingStatus.CANCELLED.name) {
                batch.delete(ref)
            } else {
                batch.update(ref, mapOf("status" to BookingStatus.CONFIRMED.name, "updatedAt" to FieldValue.serverTimestamp()))
            }
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.UPDATE, "users/$uidOrUnknown/bookings")
        Result.failure(e)
    }

    suspend fun restoreBookings(snapshots: List<BookingRecord>): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        snapshots.forEach { b ->
            val ref = userDoc(uid).collection("bookings").document(b.id.ifBlank { userDoc(uid).collection("bookings").document().id })
            if (b.status == BookingStatus.CANCELLED.name) {
                batch.set(
                    ref,
                    mapOf(
                        "userId" to uid,
                        "sessionId" to b.sessionId,
                        "weekKey" to b.weekKey,
                        "clientId" to b.clientId,
                        "status" to b.status,
                        "requestedAtMillis" to b.requestedAtMillis,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            } else {
                batch.update(ref, mapOf("status" to b.status, "updatedAt" to FieldValue.serverTimestamp()))
            }
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/bookings")
        Result.failure(e)
    }

    suspend fun moveBookingToSession(booking: BookingRecord, newSessionId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("bookings").document(booking.id)
            .update(
                mapOf(
                    "sessionId" to newSessionId,
                    "status" to BookingStatus.CONFIRMED.name,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.UPDATE, "users/$uidOrUnknown/bookings/${booking.id}")
        Result.failure(e)
    }

    suspend fun submitStudentBookings(
        weekKey: String,
        clientId: String,
        selectedSessionIds: Set<String>,
        existingBookings: List<BookingRecord>
    ): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        batch.delete(userDoc(uid).collection("week_responses").document("${weekKey}_$clientId"))
        val hadConfirmed = existingBookings.any { it.status == BookingStatus.CONFIRMED.name || it.status == BookingStatus.ALTERED.name }

        if (selectedSessionIds.isEmpty()) {
            if (hadConfirmed) {
                existingBookings.forEach { b ->
                    batch.update(
                        userDoc(uid).collection("bookings").document(b.id),
                        mapOf(
                            "status" to BookingStatus.CANCELLED.name,
                            "requestedAtMillis" to System.currentTimeMillis(),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            } else {
                existingBookings.forEach { b ->
                    batch.delete(userDoc(uid).collection("bookings").document(b.id))
                }
            }
        } else {
            val currentIds = existingBookings.map { it.sessionId }.toSet()
            existingBookings.filter { it.sessionId !in selectedSessionIds }.forEach { b ->
                batch.delete(userDoc(uid).collection("bookings").document(b.id))
            }
            val now = System.currentTimeMillis()
            val newStatus = if (hadConfirmed) BookingStatus.ALTERED.name else BookingStatus.PENDING.name
            if (hadConfirmed && currentIds != selectedSessionIds) {
                existingBookings.filter { it.sessionId in selectedSessionIds }.forEach { b ->
                    batch.update(
                        userDoc(uid).collection("bookings").document(b.id),
                        mapOf(
                            "status" to BookingStatus.ALTERED.name,
                            "requestedAtMillis" to now,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }
            selectedSessionIds.filter { it !in currentIds }.forEach { sessionId ->
                val ref = userDoc(uid).collection("bookings").document()
                batch.set(
                    ref,
                    mapOf(
                        "userId" to uid,
                        "sessionId" to sessionId,
                        "weekKey" to weekKey,
                        "clientId" to clientId,
                        "status" to newStatus,
                        "requestedAtMillis" to now,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/bookings")
        Result.failure(e)
    }

    suspend fun upsertWeekResponse(weekKey: String, clientId: String, status: String, existingBookings: List<BookingRecord> = emptyList()): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        if (status == "UNAVAILABLE") {
            existingBookings.forEach { b ->
                batch.delete(userDoc(uid).collection("bookings").document(b.id))
            }
        }
        val docId = "${weekKey}_$clientId"
        val ref = userDoc(uid).collection("week_responses").document(docId)
        val snap = ref.get().await()
        if (snap.exists()) {
            batch.update(ref, mapOf("status" to status, "updatedAt" to FieldValue.serverTimestamp()))
        } else {
            batch.set(
                ref,
                mapOf(
                    "userId" to uid,
                    "weekKey" to weekKey,
                    "clientId" to clientId,
                    "status" to status,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/week_responses")
        Result.failure(e)
    }

    // --- Payments ---
    suspend fun recordPayment(
        clientId: String,
        monthYear: String,
        monthLabel: String,
        amountEur: Double,
        note: String,
        durationMonths: Int = 1
    ): Result<Unit> = try {
        val uid = requireUserId()
        val validMethod = SeedCatalog.normalizePaymentMethod(note) ?: "MbWay"
        val monthsCount = if (durationMonths == 6 || durationMonths == 12) durationMonths else 1
        val totalClamped = amountEur.coerceIn(0.0, 100000.0)
        val perMonthAmount = kotlin.math.round((totalClamped / monthsCount) * 100.0) / 100.0
        val targetMonths = if (monthsCount == 1) {
            listOf(monthYear to monthLabel)
        } else {
            SeedCatalog.buildConsecutiveMonths(monthYear, monthsCount)
        }
        val now = System.currentTimeMillis()
        val batch = db.batch()
        targetMonths.forEach { (mYear, mLabel) ->
            val ref = userDoc(uid).collection("payments").document()
            batch.set(
                ref,
                mapOf(
                    "userId" to uid,
                    "clientId" to clientId,
                    "monthYear" to mYear,
                    "monthLabel" to mLabel,
                    "amountEur" to perMonthAmount,
                    "paid" to true,
                    "paidAtMillis" to now,
                    "note" to validMethod,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
        }
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/payments")
        Result.failure(e)
    }

    suspend fun deletePayment(paymentId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("payments").document(paymentId).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/payments/$paymentId")
        Result.failure(e)
    }

    // --- Fidelizações ---
    suspend fun saveFidelizacao(clientId: String, durationMonths: Int, startDateMillis: Long, notes: String, existingId: String = ""): Result<Unit> = try {
        val uid = requireUserId()
        val months = if (durationMonths == 12) 12 else 6
        val cal = Calendar.getInstance().apply {
            timeInMillis = startDateMillis
            add(Calendar.MONTH, months)
        }
        val endDateMillis = cal.timeInMillis
        if (existingId.isNotBlank()) {
            userDoc(uid).collection("fidelizacoes").document(existingId).update(
                mapOf(
                    "durationMonths" to months,
                    "startDateMillis" to startDateMillis,
                    "endDateMillis" to endDateMillis,
                    "notes" to notes.trim().take(300),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        } else {
            userDoc(uid).collection("fidelizacoes").document().set(
                mapOf(
                    "userId" to uid,
                    "clientId" to clientId,
                    "durationMonths" to months,
                    "startDateMillis" to startDateMillis,
                    "endDateMillis" to endDateMillis,
                    "notes" to notes.trim().take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/fidelizacoes")
        Result.failure(e)
    }

    suspend fun deleteFidelizacao(id: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("fidelizacoes").document(id).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/fidelizacoes/$id")
        Result.failure(e)
    }

    // --- Exercises & Workout Plans ---
    suspend fun addCustomExercise(name: String, muscleGroup: String, equipment: String, instructions: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("exercises").document().set(
            mapOf(
                "userId" to uid,
                "name" to name.trim().take(120),
                "muscleGroup" to muscleGroup.take(40),
                "equipment" to equipment.trim().take(60),
                "instructions" to instructions.trim().take(600),
                "custom" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/exercises")
        Result.failure(e)
    }

    suspend fun deleteExercise(id: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("exercises").document(id).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/exercises/$id")
        Result.failure(e)
    }

    suspend fun createWorkoutPlan(clientId: String, title: String, splitLabel: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("workout_plans").document().set(
            mapOf(
                "userId" to uid,
                "clientId" to clientId,
                "title" to title.trim().take(120),
                "splitLabel" to splitLabel.trim().take(120),
                "createdAtMillis" to System.currentTimeMillis(),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/workout_plans")
        Result.failure(e)
    }

    suspend fun deleteWorkoutPlan(planId: String, planItems: List<WorkoutPlanItemRecord>): Result<Unit> = try {
        val uid = requireUserId()
        val batch = db.batch()
        planItems.filter { it.planId == planId }.forEach { item ->
            batch.delete(userDoc(uid).collection("workout_plan_items").document(item.id))
        }
        batch.delete(userDoc(uid).collection("workout_plans").document(planId))
        batch.commit().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/workout_plans/$planId")
        Result.failure(e)
    }

    suspend fun addExerciseToPlan(
        planId: String,
        exercise: ExerciseRecord,
        sets: Int,
        reps: String,
        loadKg: String,
        restSeconds: Int,
        notes: String,
        orderIndex: Int
    ): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("workout_plan_items").document().set(
            mapOf(
                "userId" to uid,
                "planId" to planId,
                "exerciseId" to exercise.id,
                "exerciseName" to exercise.name.take(120),
                "muscleGroup" to exercise.muscleGroup.take(40),
                "sets" to sets.coerceIn(1, 30),
                "reps" to reps.trim().ifBlank { "10-12" }.take(40),
                "loadKg" to loadKg.trim().take(40),
                "restSeconds" to restSeconds.coerceIn(0, 600),
                "notes" to notes.trim().take(300),
                "orderIndex" to orderIndex.coerceIn(0, 200),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/workout_plan_items")
        Result.failure(e)
    }

    suspend fun removeExerciseFromPlan(itemId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("workout_plan_items").document(itemId).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/workout_plan_items/$itemId")
        Result.failure(e)
    }

    // --- Foods & Nutrition ---
    suspend fun addCustomFood(name: String, category: String, kcal: Double, protein: Double, carbs: Double, fat: Double): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("foods").document().set(
            mapOf(
                "userId" to uid,
                "name" to name.trim().take(120),
                "category" to category.take(40),
                "kcalPer100g" to kcal.coerceAtLeast(0.0),
                "proteinPer100g" to protein.coerceAtLeast(0.0),
                "carbsPer100g" to carbs.coerceAtLeast(0.0),
                "fatPer100g" to fat.coerceAtLeast(0.0),
                "custom" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/foods")
        Result.failure(e)
    }

    suspend fun addNutritionEntry(clientId: String, mealType: MealType, food: FoodItemRecord, grams: Double): Result<Unit> = try {
        val uid = requireUserId()
        val safeGrams = grams.coerceIn(1.0, 10000.0)
        val factor = safeGrams / 100.0
        userDoc(uid).collection("nutrition_entries").document().set(
            mapOf(
                "userId" to uid,
                "clientId" to clientId,
                "mealType" to mealType.name,
                "foodId" to food.id,
                "foodName" to food.name.take(120),
                "grams" to safeGrams,
                "kcal" to (food.kcalPer100g * factor),
                "protein" to (food.proteinPer100g * factor),
                "carbs" to (food.carbsPer100g * factor),
                "fat" to (food.fatPer100g * factor),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/nutrition_entries")
        Result.failure(e)
    }

    suspend fun removeNutritionEntry(entryId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("nutrition_entries").document(entryId).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/nutrition_entries/$entryId")
        Result.failure(e)
    }

    suspend fun importFoodsCsv(rawText: String, existingFoods: List<FoodItemRecord>): Result<ImportResult> = try {
        val uid = requireUserId()
        val existingNames = existingFoods.map { it.name.trim().lowercase() }.toMutableSet()
        var added = 0
        var ignored = 0
        val errors = mutableListOf<String>()
        val lines = rawText.lines().map { it.trim() }.filter { it.isNotEmpty() }
        val writes = mutableListOf<Pair<com.google.firebase.firestore.DocumentReference, Map<String, Any>>>()

        for ((index, line) in lines.withIndex()) {
            val delimiter = when {
                line.contains('\t') -> '\t'
                line.contains(';') -> ';'
                else -> ','
            }
            val parts = line.split(delimiter).map { it.trim() }
            if (index == 0 && (parts[0].lowercase().contains("nome") || parts[0].lowercase().contains("alimento"))) {
                continue
            }
            if (parts.size < 6) {
                errors.add("Linha ${index + 1}: são necessárias 6 colunas (Nome, Categoria, Kcal, Prot, HC, Gord)")
                continue
            }
            val name = parts[0].take(120)
            val category = parts[1].ifBlank { "Outros" }.take(40)
            fun parseNum(raw: String): Double? =
                raw.replace(',', '.').replace(Regex("[^0-9.]"), "").toDoubleOrNull()

            val kcal = parseNum(parts[2])
            val prot = parseNum(parts[3])
            val carbs = parseNum(parts[4])
            val fat = parseNum(parts[5])
            if (name.isBlank() || kcal == null || prot == null || carbs == null || fat == null) {
                errors.add("Linha ${index + 1}: valores numéricos inválidos")
                continue
            }
            val key = name.lowercase()
            if (key in existingNames) {
                ignored++
                continue
            }
            existingNames.add(key)
            val docRef = userDoc(uid).collection("foods").document()
            writes += docRef to mapOf(
                "userId" to uid,
                "name" to name,
                "category" to category,
                "kcalPer100g" to kcal.coerceAtLeast(0.0),
                "proteinPer100g" to prot.coerceAtLeast(0.0),
                "carbsPer100g" to carbs.coerceAtLeast(0.0),
                "fatPer100g" to fat.coerceAtLeast(0.0),
                "custom" to true,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            added++
        }
        writes.chunked(400).forEach { chunk ->
            val batch = db.batch()
            chunk.forEach { (ref, payload) -> batch.set(ref, payload) }
            batch.commit().await()
        }
        Result.success(ImportResult(added, ignored, errors))
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/$uidOrUnknown/foods")
        Result.failure(e)
    }

    // --- Physical Assessments ---
    suspend fun addPhysicalAssessment(
        clientId: String,
        dateMillis: Long,
        weightKg: Double,
        ageYears: Int,
        heightCm: Double,
        sex: String,
        bodyFatPct: Double,
        muscleMassKg: Double,
        visceralFat: Double,
        notes: String
    ): Result<Unit> = try {
        val uid = requireUserId()
        val safeWeight = weightKg.coerceIn(20.0, 500.0)
        val safeAge = ageYears.coerceIn(5, 120)
        val safeHeight = heightCm.coerceIn(50.0, 260.0)
        val safeSex = if (sex == "F") "F" else "M"
        val safeFat = bodyFatPct.coerceIn(0.0, 80.0)
        val safeMuscle = muscleMassKg.coerceIn(0.0, 200.0)
        val safeVisceral = visceralFat.coerceIn(0.0, 60.0)
        val bmi = PhysicalCalculations.calculateBmi(safeWeight, safeHeight).coerceIn(1.0, 150.0)
        val bmr = PhysicalCalculations.calculateBmrMifflinStJeor(safeWeight, safeHeight, safeAge, safeSex).coerceIn(0.0, 10000.0)

        userDoc(uid).collection("physical_assessments").document().set(
            mapOf(
                "userId" to uid,
                "clientId" to clientId,
                "dateMillis" to dateMillis.coerceAtLeast(0L),
                "weightKg" to safeWeight,
                "ageYears" to safeAge,
                "heightCm" to safeHeight,
                "sex" to safeSex,
                "bodyFatPct" to safeFat,
                "muscleMassKg" to safeMuscle,
                "visceralFat" to safeVisceral,
                "bmi" to bmi,
                "bmrKcal" to bmr,
                "notes" to notes.trim().take(500),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/physical_assessments")
        Result.failure(e)
    }

    suspend fun deletePhysicalAssessment(assessmentId: String): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("physical_assessments").document(assessmentId).delete().await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.DELETE, "users/$uidOrUnknown/physical_assessments/$assessmentId")
        Result.failure(e)
    }

    // --- Chat ---
    suspend fun sendChatMessage(clientId: String, senderRole: String, text: String): Result<Unit> = try {
        val uid = requireUserId()
        val cleanText = text.trim().take(2000)
        require(cleanText.isNotEmpty())
        userDoc(uid).collection("chat_messages").document().set(
            mapOf(
                "userId" to uid,
                "clientId" to clientId,
                "senderRole" to senderRole,
                "text" to cleanText,
                "timestampMillis" to System.currentTimeMillis(),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.CREATE, "users/$uidOrUnknown/chat_messages")
        Result.failure(e)
    }

    // --- Templates & Settings ---
    suspend fun saveTemplate(template: MessageTemplateRecord): Result<Unit> = try {
        val uid = requireUserId()
        userDoc(uid).collection("templates").document(template.templateKey).update(
            mapOf(
                "body" to template.body.take(1500),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.UPDATE, "users/$uidOrUnknown/templates/${template.templateKey}")
        Result.failure(e)
    }

    suspend fun resetTemplate(template: MessageTemplateRecord): Result<Unit> =
        saveTemplate(template.copy(body = template.defaultBody))

    suspend fun saveSettings(settings: StudioSettingsRecord): Result<Unit> = try {
        val uid = requireUserId()
        val code = settings.studentPortalCode.takeIf { it.length >= 8 } ?: generatePortalCode()
        userDoc(uid).collection("settings").document("studio").update(
            mapOf(
                "clientsCanEdit" to settings.clientsCanEdit,
                "cutoffHours" to settings.cutoffHours.coerceIn(0, 72),
                "whatsappWebMode" to settings.whatsappWebMode,
                "siteBaseUrl" to settings.siteBaseUrl.trim().ifBlank { "https://newshape.vercel.app" }.take(300),
                "studentPortalCode" to code.take(64),
                "seeded" to true,
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.UPDATE, "users/$uidOrUnknown/settings/studio")
        Result.failure(e)
    }

    suspend fun regenerateStudentPortalCode(): Result<String> = try {
        val uid = requireUserId()
        val newCode = generatePortalCode()
        userDoc(uid).collection("settings").document("studio").update(
            mapOf(
                "studentPortalCode" to newCode,
                "updatedAt" to FieldValue.serverTimestamp()
            )
        ).await()
        Result.success(newCode)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.UPDATE, "users/$uidOrUnknown/settings/studio")
        Result.failure(e)
    }

    fun buildStudentPortalLink(
        settings: StudioSettingsRecord,
        weekSlug: String? = null
    ): String {
        val baseUrl = settings.siteBaseUrl.trimEnd('/').ifBlank { "https://newshape.vercel.app" }
        val path = if (!weekSlug.isNullOrBlank()) "/s/${weekSlug.lowercase()}" else "/aluno"
        val ptUid = settings.userId.ifBlank { auth.currentUser?.uid.orEmpty() }
        val code = settings.studentPortalCode
        return if (ptUid.isNotBlank() && code.isNotBlank()) {
            "$baseUrl$path?pt=$ptUid&code=$code"
        } else if (ptUid.isNotBlank()) {
            "$baseUrl$path?pt=$ptUid"
        } else {
            "$baseUrl$path"
        }
    }

    fun formatMessage(
        templateBody: String,
        clientName: String = "",
        sessions: List<TrainingSessionRecord> = emptyList(),
        week: TrainingWeekRecord? = null,
        settings: StudioSettingsRecord = StudioSettingsRecord()
    ): String {
        val firstName = clientName.trim().split(" ").firstOrNull().orEmpty()
        val sessionsList = sessions.joinToString("\n") { "• ${it.dateLabel} – ${it.timeLabel.replace(":", "h")}" }
        val weekLink = if (week != null) {
            buildStudentPortalLink(settings, week.weekKey)
        } else {
            buildStudentPortalLink(settings)
        }
        return templateBody
            .replace("{nome}", firstName)
            .replace("{treinos}", sessionsList)
            .replace("{link}", weekLink)
            .replace("{semana}", week?.label.orEmpty())
    }

    private fun generatePortalCode(): String {
        val chars = "abcdefghjkmnpqrstuvwxyz23456789"
        return "ns_" + (1..14).map { chars.random() }.joinToString("")
    }

    private val uidOrUnknown: String
        get() = auth.currentUser?.uid ?: "unauthenticated"
}
