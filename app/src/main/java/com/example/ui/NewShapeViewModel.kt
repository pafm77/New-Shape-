package com.example.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.FirestoreStudioRepository
import com.example.data.ImportResult
import com.example.data.SeedCatalog
import com.example.data.model.*
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.Calendar

enum class AppRole {
    ROLE_SELECTOR, PT, STUDENT
}

data class BookingWithSession(
    val booking: BookingRecord,
    val session: TrainingSessionRecord
)

data class PendingConfirmationCard(
    val client: ClientRecord,
    val week: TrainingWeekRecord,
    val items: List<BookingWithSession>,
    val requestedAtMillis: Long,
    val isCancelledAll: Boolean,
    val isAltered: Boolean
)

data class UndoConfirmationSnapshot(
    val clientName: String,
    val bookings: List<BookingRecord>
)

sealed interface StudioStreamState {
    data object Loading : StudioStreamState
    data class Ready(val data: StudioUiState) : StudioStreamState
    data class Error(val message: String) : StudioStreamState
}

data class StudioUiState(
    val currentUserId: String = "",
    val role: AppRole = AppRole.ROLE_SELECTOR,
    val activeStudentId: String? = null,
    val selectedWeekKey: String = "",
    val clients: List<ClientRecord> = emptyList(),
    val weeks: List<TrainingWeekRecord> = emptyList(),
    val sessions: List<TrainingSessionRecord> = emptyList(),
    val bookings: List<BookingRecord> = emptyList(),
    val weekResponses: List<WeekResponseRecord> = emptyList(),
    val payments: List<PaymentRecord> = emptyList(),
    val fidelizacoes: List<FidelizacaoRecord> = emptyList(),
    val exercises: List<ExerciseRecord> = emptyList(),
    val workoutPlans: List<WorkoutPlanRecord> = emptyList(),
    val workoutPlanItems: List<WorkoutPlanItemRecord> = emptyList(),
    val foodItems: List<FoodItemRecord> = emptyList(),
    val nutritionEntries: List<NutritionEntryRecord> = emptyList(),
    val physicalAssessments: List<PhysicalAssessmentRecord> = emptyList(),
    val chatMessages: List<ChatMessageRecord> = emptyList(),
    val messageTemplates: List<MessageTemplateRecord> = emptyList(),
    val settings: StudioSettingsRecord = StudioSettingsRecord(),
    val waitingWhatsAppReturn: Boolean = false,
    val undoSnapshot: UndoConfirmationSnapshot? = null,
    val statusBannerMessage: String? = null
) {
    val activeWeek: TrainingWeekRecord?
        get() = weeks.find { it.weekKey == selectedWeekKey } ?: weeks.firstOrNull()

    val activeStudent: ClientRecord?
        get() = clients.find { it.id == activeStudentId } ?: clients.firstOrNull { it.active }

    val pendingQueue: List<PendingConfirmationCard>
        get() {
            val pendingStatuses = setOf(
                BookingStatus.PENDING.name,
                BookingStatus.ALTERED.name,
                BookingStatus.CANCELLED.name
            )
            val sessionMap = sessions.associateBy { it.id }
            val clientMap = clients.associateBy { it.id }
            val weekMap = weeks.associateBy { it.weekKey }

            return bookings
                .filter { it.status in pendingStatuses }
                .groupBy { it.clientId to it.weekKey }
                .mapNotNull { (key, list) ->
                    val client = clientMap[key.first] ?: return@mapNotNull null
                    val week = weekMap[key.second] ?: return@mapNotNull null
                    val items = list.mapNotNull { b ->
                        val s = sessionMap[b.sessionId] ?: return@mapNotNull null
                        BookingWithSession(b, s)
                    }.sortedBy { it.session.startMillis }
                    if (items.isEmpty()) return@mapNotNull null
                    val isCancelledAll = list.all { it.status == BookingStatus.CANCELLED.name }
                    val isAltered = !isCancelledAll && list.any { it.status == BookingStatus.ALTERED.name }
                    PendingConfirmationCard(
                        client = client,
                        week = week,
                        items = items,
                        requestedAtMillis = list.minOf { it.requestedAtMillis },
                        isCancelledAll = isCancelledAll,
                        isAltered = isAltered
                    )
                }
                .sortedBy { it.requestedAtMillis }
        }

    val currentMonthYear: String
        get() {
            val cal = Calendar.getInstance()
            return String.format("%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
        }

    val currentMonthLabel: String
        get() {
            val cal = Calendar.getInstance()
            val months = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
            return "${months[cal.get(Calendar.MONTH)]} ${cal.get(Calendar.YEAR)}"
        }

    val currentMonthRevenueEur: Double
        get() = payments.filter { it.paid && it.monthYear == currentMonthYear }.sumOf { it.amountEur }

    val currentMonthPaymentsCount: Int
        get() = payments.count { it.paid && it.monthYear == currentMonthYear }

    val totalRevenueEur: Double
        get() = payments.filter { it.paid }.sumOf { it.amountEur }

    val paidPaymentsCount: Int
        get() = payments.count { it.paid }

    val monthlyAverageRevenueEur: Double
        get() {
            val paid = payments.filter { it.paid }
            if (paid.isEmpty()) return 0.0
            val distinctMonths = paid.map { it.monthYear }.distinct().size.coerceAtLeast(1)
            return totalRevenueEur / distinctMonths
        }

    val avgMonthlyPerStudentEur: Double
        get() {
            val paid = payments.filter { it.paid }
            if (paid.isEmpty()) return 0.0
            val studentMonthPairs = paid.map { "${it.clientId}__${it.monthYear}" }.distinct().size.coerceAtLeast(1)
            return totalRevenueEur / studentMonthPairs
        }

    val currentMonthUniqueStudentsCount: Int
        get() = payments.filter { it.paid && it.monthYear == currentMonthYear }
            .map { it.clientId }
            .distinct()
            .size

    val currentMonthAvgPerStudentEur: Double
        get() = if (currentMonthUniqueStudentsCount > 0) {
            currentMonthRevenueEur / currentMonthUniqueStudentsCount
        } else 0.0
}

class NewShapeViewModel(
    private val repository: FirestoreStudioRepository,
    private val currentUserId: String
) : ViewModel() {

    private val _role = MutableStateFlow(AppRole.ROLE_SELECTOR)
    private val _activeStudentId = MutableStateFlow<String?>(null)
    private val _selectedWeekKey = MutableStateFlow("")
    private val _waitingWhatsApp = MutableStateFlow(false)
    private val _undoSnapshot = MutableStateFlow<UndoConfirmationSnapshot?>(null)
    private val _statusBanner = MutableStateFlow<String?>(null)

    private var undoTimerJob: Job? = null

    init {
        viewModelScope.launch {
            val res = repository.ensureSeeded(currentUserId)
            res.onFailure { e ->
                _statusBanner.value = e.localizedMessage ?: "Erro ao inicializar dados no Firestore."
            }
            val cal = Calendar.getInstance().apply {
                firstDayOfWeek = Calendar.MONDAY
                set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            _selectedWeekKey.value = SeedCatalog.formatWeekKey(cal)
        }
    }

    private val baseDataFlow = combine(
        repository.observeClients(currentUserId),
        repository.observeWeeks(currentUserId),
        repository.observeSessions(currentUserId),
        repository.observeBookings(currentUserId),
        repository.observeWeekResponses(currentUserId)
    ) { clients, weeks, sessions, bookings, responses ->
        BaseSlice(clients, weeks, sessions, bookings, responses)
    }

    private val mgmtDataFlow = combine(
        repository.observePayments(currentUserId),
        repository.observeFidelizacoes(currentUserId),
        repository.observeExercises(currentUserId),
        repository.observeWorkoutPlans(currentUserId),
        repository.observeWorkoutPlanItems(currentUserId)
    ) { payments, fidelizacoes, exercises, plans, items ->
        MgmtSlice(payments, fidelizacoes, exercises, plans, items)
    }

    private val extraDataFlow = combine(
        combine(
            repository.observeFoods(currentUserId),
            repository.observeNutritionEntries(currentUserId),
            repository.observePhysicalAssessments(currentUserId)
        ) { foods, nutrition, assessments -> Triple(foods, nutrition, assessments) },
        repository.observeChatMessages(currentUserId),
        repository.observeTemplates(currentUserId),
        repository.observeSettings(currentUserId)
    ) { (foods, nutrition, assessments), chats, templates, settings ->
        ExtraSlice(foods, nutrition, assessments, chats, templates, settings ?: StudioSettingsRecord())
    }

    private val controlFlow = combine(
        _role,
        _activeStudentId,
        _selectedWeekKey,
        _waitingWhatsApp,
        _undoSnapshot
    ) { role, studentId, weekKey, waitingWa, undo ->
        ControlSlice(role, studentId, weekKey, waitingWa, undo)
    }

    val streamState: StateFlow<StudioStreamState> = combine(
        baseDataFlow,
        mgmtDataFlow,
        extraDataFlow,
        controlFlow,
        _statusBanner
    ) { base, mgmt, extra, ctrl, banner ->
        val uiState = StudioUiState(
            currentUserId = currentUserId,
            role = ctrl.role,
            activeStudentId = ctrl.activeStudentId ?: base.clients.firstOrNull { it.active }?.id,
            selectedWeekKey = ctrl.selectedWeekKey.ifBlank { base.weeks.firstOrNull()?.weekKey.orEmpty() },
            clients = base.clients,
            weeks = base.weeks,
            sessions = base.sessions,
            bookings = base.bookings,
            weekResponses = base.weekResponses,
            payments = mgmt.payments,
            fidelizacoes = mgmt.fidelizacoes,
            exercises = mgmt.exercises,
            workoutPlans = mgmt.workoutPlans,
            workoutPlanItems = mgmt.workoutPlanItems,
            foodItems = extra.foodItems,
            nutritionEntries = extra.nutritionEntries,
            physicalAssessments = extra.physicalAssessments,
            chatMessages = extra.chatMessages,
            messageTemplates = extra.messageTemplates,
            settings = extra.settings,
            waitingWhatsAppReturn = ctrl.waitingWhatsAppReturn,
            undoSnapshot = ctrl.undoSnapshot,
            statusBannerMessage = banner
        )
        StudioStreamState.Ready(uiState) as StudioStreamState
    }
        .catch { error ->
            val firestoreError = generateSequence(error) { it.cause }
                .filterIsInstance<FirebaseFirestoreException>()
                .firstOrNull()
            if (firestoreError == null && error is CancellationException) throw error
            val rootError = firestoreError ?: error
            Log.w(TAG, "Error observing Firestore studio streams", rootError)
            emit(StudioStreamState.Error(rootError.localizedMessage ?: "Erro ao sincronizar dados com o Firestore."))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000L),
            initialValue = StudioStreamState.Loading
        )

    private val currentData: StudioUiState?
        get() = (streamState.value as? StudioStreamState.Ready)?.data

    // --- Role Switching ---
    fun enterPtMode() {
        _role.value = AppRole.PT
    }

    fun enterStudentMode(studentId: String? = null) {
        if (studentId != null) _activeStudentId.value = studentId
        _role.value = AppRole.STUDENT
    }

    fun registerAndEnterStudentMode(name: String, phone: String, rgpdConsentNote: String = "") {
        val existing = currentData?.clients?.find { it.phone == repository.normalizePortuguesePhone(phone) }
        if (existing != null) {
            _activeStudentId.value = existing.id
            _role.value = AppRole.STUDENT
            return
        }
        val combinedNotes = listOf("Registado pelo aluno", rgpdConsentNote.trim())
            .filter { it.isNotBlank() }
            .joinToString(" · ")
        viewModelScope.launch {
            repository.addClient(name, phone, combinedNotes, newClient = true)
                .onSuccess { newId ->
                    _activeStudentId.value = newId
                    _role.value = AppRole.STUDENT
                }
                .onFailure { _statusBanner.value = it.localizedMessage ?: "Erro ao registar aluno." }
        }
    }

    fun selectStudentProfile(studentId: String) {
        _activeStudentId.value = studentId
    }

    fun backToRoleSelector() {
        _role.value = AppRole.ROLE_SELECTOR
    }

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun confirmReturnedFromWhatsApp() {
        _waitingWhatsApp.value = false
    }

    // --- Week Navigation ---
    fun shiftWeek(deltaWeeks: Int) {
        val data = currentData ?: return
        val currentWeek = data.activeWeek ?: return
        viewModelScope.launch {
            val cal = Calendar.getInstance().apply {
                timeInMillis = currentWeek.startDateMillis
                add(Calendar.DAY_OF_YEAR, deltaWeeks * 7)
            }
            val targetKey = SeedCatalog.formatWeekKey(cal)
            if (data.weeks.none { it.weekKey == targetKey }) {
                repository.ensureWeekExists(cal.timeInMillis)
                    .onFailure { _statusBanner.value = it.localizedMessage }
            }
            _selectedWeekKey.value = targetKey
        }
    }

    fun toggleWeekPublished(week: TrainingWeekRecord) {
        viewModelScope.launch {
            repository.setWeekPublished(week, !week.published)
                .onSuccess {
                    _statusBanner.value = if (!week.published) "Semana publicada para os alunos!" else "Semana despublicada."
                }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun createSessions(
        week: TrainingWeekRecord,
        selectedDays: Set<Int>,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        capacity: Int,
        note: String
    ) {
        if (selectedDays.isEmpty()) return
        viewModelScope.launch {
            repository.createSessions(week, selectedDays, hour, minute, durationMinutes, capacity, note)
                .onSuccess { _statusBanner.value = "Treino(s) criado(s) com sucesso." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun updateSession(session: TrainingSessionRecord) {
        viewModelScope.launch {
            repository.updateSession(session)
                .onSuccess { _statusBanner.value = "Treino atualizado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deleteSession(sessionId: String) {
        val bookings = currentData?.bookings.orEmpty()
        viewModelScope.launch {
            repository.deleteSession(sessionId, bookings)
                .onSuccess { _statusBanner.value = "Treino apagado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun duplicatePreviousWeek(targetWeek: TrainingWeekRecord) {
        val data = currentData ?: return
        viewModelScope.launch {
            val cal = Calendar.getInstance().apply {
                timeInMillis = targetWeek.startDateMillis
                add(Calendar.DAY_OF_YEAR, -7)
            }
            val prevKey = SeedCatalog.formatWeekKey(cal)
            val prevSessions = data.sessions.filter { it.weekKey == prevKey }
            val existingTarget = data.sessions.filter { it.weekKey == targetWeek.weekKey }
            repository.duplicatePreviousWeek(targetWeek, prevSessions, existingTarget)
                .onSuccess { count ->
                    _statusBanner.value = if (count > 0) "$count treinos copiados da semana anterior." else "Sem novos treinos para copiar."
                }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Bookings & Confirmations ---
    fun confirmCardAndNotify(card: PendingConfirmationCard) {
        viewModelScope.launch {
            val snapshots = card.items.map { it.booking }
            repository.confirmClientBookings(snapshots)
                .onSuccess {
                    _waitingWhatsApp.value = true
                    _undoSnapshot.value = UndoConfirmationSnapshot(card.client.name, snapshots)
                    undoTimerJob?.cancel()
                    undoTimerJob = viewModelScope.launch {
                        delay(10_000L)
                        _undoSnapshot.value = null
                    }
                }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun undoLastConfirmation() {
        val snapshot = _undoSnapshot.value ?: return
        undoTimerJob?.cancel()
        _undoSnapshot.value = null
        viewModelScope.launch {
            repository.restoreBookings(snapshot.bookings)
                .onSuccess { _statusBanner.value = "${snapshot.clientName} voltou para a fila." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun rejectBooking(booking: BookingRecord) {
        viewModelScope.launch {
            repository.removeBooking(booking.id)
                .onSuccess { _waitingWhatsApp.value = true }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun moveBooking(booking: BookingRecord, newSessionId: String) {
        viewModelScope.launch {
            repository.moveBookingToSession(booking, newSessionId)
                .onSuccess { _waitingWhatsApp.value = true }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun addManualClientToSession(sessionId: String, weekKey: String, clientId: String) {
        viewModelScope.launch {
            repository.addManualBooking(sessionId, weekKey, clientId)
                .onSuccess { _statusBanner.value = "Cliente adicionado como Confirmado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun removeBooking(bookingId: String) {
        viewModelScope.launch {
            repository.removeBooking(bookingId)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun markClientReminded(weekKey: String, clientId: String) {
        viewModelScope.launch {
            repository.upsertWeekResponse(weekKey, clientId, "REMINDED")
                .onSuccess { _waitingWhatsApp.value = true }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun submitStudentBookings(weekKey: String, clientId: String, selectedSessionIds: Set<String>) {
        val existing = currentData?.bookings?.filter { it.weekKey == weekKey && it.clientId == clientId }.orEmpty()
        viewModelScope.launch {
            repository.submitStudentBookings(weekKey, clientId, selectedSessionIds, existing)
                .onSuccess { _statusBanner.value = "Pedido recebido! Vais receber a confirmação no WhatsApp." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun markStudentUnavailable(weekKey: String, clientId: String) {
        val existing = currentData?.bookings?.filter { it.weekKey == weekKey && it.clientId == clientId }.orEmpty()
        viewModelScope.launch {
            repository.upsertWeekResponse(weekKey, clientId, "UNAVAILABLE", existing)
                .onSuccess { _statusBanner.value = "Registado: esta semana não podes treinar." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Clients ---
    fun addClient(name: String, phone: String, notes: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            repository.addClient(name, phone, notes)
                .onSuccess { _statusBanner.value = "Cliente adicionado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun updateClient(client: ClientRecord) {
        viewModelScope.launch {
            repository.updateClient(client)
                .onSuccess { _statusBanner.value = "Dados do aluno guardados." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun setClientActive(client: ClientRecord, active: Boolean) {
        viewModelScope.launch {
            repository.setClientActive(client, active)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun importClientsCsv(rawText: String, onResult: (ImportResult) -> Unit) {
        val existing = currentData?.clients.orEmpty()
        viewModelScope.launch {
            repository.importClientsCsv(rawText, existing)
                .onSuccess { onResult(it) }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Payments & Finances ---
    fun recordPayment(
        clientId: String,
        monthYear: String,
        monthLabel: String,
        amountEur: Double,
        note: String,
        durationMonths: Int = 1
    ) {
        val months = if (durationMonths == 6 || durationMonths == 12) durationMonths else 1
        viewModelScope.launch {
            repository.recordPayment(clientId, monthYear, monthLabel, amountEur, note, months)
                .onSuccess {
                    _statusBanner.value = if (months > 1) {
                        val perMonth = amountEur / months
                        "Pagamento de $months meses registado (€${String.format("%.2f", perMonth)}/mês)!"
                    } else {
                        "Mensalidade de €${String.format("%.2f", amountEur)} registada!"
                    }
                }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deletePayment(paymentId: String) {
        viewModelScope.launch {
            repository.deletePayment(paymentId)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Fidelizações ---
    fun saveFidelizacao(clientId: String, durationMonths: Int, startDateMillis: Long, notes: String, existingId: String = "") {
        viewModelScope.launch {
            repository.saveFidelizacao(clientId, durationMonths, startDateMillis, notes, existingId)
                .onSuccess { _statusBanner.value = "Fidelização de $durationMonths meses guardada." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deleteFidelizacao(id: String) {
        viewModelScope.launch {
            repository.deleteFidelizacao(id)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Exercises & Plans ---
    fun addCustomExercise(name: String, muscleGroup: String, equipment: String, instructions: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            repository.addCustomExercise(name, muscleGroup, equipment, instructions)
                .onSuccess { _statusBanner.value = "Exercício \"$name\" adicionado à biblioteca." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deleteExercise(id: String) {
        viewModelScope.launch {
            repository.deleteExercise(id)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun createWorkoutPlan(clientId: String, title: String, splitLabel: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            repository.createWorkoutPlan(clientId, title, splitLabel)
                .onSuccess { _statusBanner.value = "Plano de treino criado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deleteWorkoutPlan(planId: String) {
        val items = currentData?.workoutPlanItems.orEmpty()
        viewModelScope.launch {
            repository.deleteWorkoutPlan(planId, items)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun addExerciseToPlan(
        planId: String,
        exercise: ExerciseRecord,
        sets: Int,
        reps: String,
        loadKg: String,
        restSeconds: Int,
        notes: String
    ) {
        val count = currentData?.workoutPlanItems?.count { it.planId == planId } ?: 0
        viewModelScope.launch {
            repository.addExerciseToPlan(planId, exercise, sets, reps, loadKg, restSeconds, notes, count)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun removeExerciseFromPlan(itemId: String) {
        viewModelScope.launch {
            repository.removeExerciseFromPlan(itemId)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Nutrition ---
    fun addNutritionEntry(clientId: String, mealType: MealType, food: FoodItemRecord, grams: Double) {
        if (grams <= 0.0) return
        viewModelScope.launch {
            repository.addNutritionEntry(clientId, mealType, food, grams)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun removeNutritionEntry(entryId: String) {
        viewModelScope.launch {
            repository.removeNutritionEntry(entryId)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun addCustomFood(name: String, category: String, kcal: Double, protein: Double, carbs: Double, fat: Double) {
        if (name.isBlank()) return
        viewModelScope.launch {
            repository.addCustomFood(name, category, kcal, protein, carbs, fat)
                .onSuccess { _statusBanner.value = "Alimento \"$name\" adicionado." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun importFoodsCsv(rawText: String, onResult: (ImportResult) -> Unit) {
        val existing = currentData?.foodItems.orEmpty()
        viewModelScope.launch {
            repository.importFoodsCsv(rawText, existing)
                .onSuccess { res ->
                    if (res.added > 0) _statusBanner.value = "${res.added} alimentos importados com sucesso."
                    onResult(res)
                }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Physical Assessments ---
    fun addPhysicalAssessment(
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
    ) {
        if (clientId.isBlank() || weightKg <= 0.0 || heightCm <= 0.0) return
        viewModelScope.launch {
            repository.addPhysicalAssessment(
                clientId = clientId,
                dateMillis = dateMillis,
                weightKg = weightKg,
                ageYears = ageYears,
                heightCm = heightCm,
                sex = sex,
                bodyFatPct = bodyFatPct,
                muscleMassKg = muscleMassKg,
                visceralFat = visceralFat,
                notes = notes
            )
                .onSuccess { _statusBanner.value = "Avaliação física registada (IMC e TMB calculados)." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun deletePhysicalAssessment(assessmentId: String) {
        viewModelScope.launch {
            repository.deletePhysicalAssessment(assessmentId)
                .onSuccess { _statusBanner.value = "Avaliação removida." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Chat ---
    fun sendChatMessage(clientId: String, senderRole: String, text: String) {
        viewModelScope.launch {
            repository.sendChatMessage(clientId, senderRole, text)
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Templates & Settings ---
    fun saveTemplate(template: MessageTemplateRecord) {
        viewModelScope.launch {
            repository.saveTemplate(template)
                .onSuccess { _statusBanner.value = "Mensagem \"${template.title}\" guardada." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun resetTemplate(template: MessageTemplateRecord) {
        viewModelScope.launch {
            repository.resetTemplate(template)
                .onSuccess { _statusBanner.value = "Mensagem reposta ao original." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun saveSettings(settings: StudioSettingsRecord) {
        viewModelScope.launch {
            repository.saveSettings(settings)
                .onSuccess { _statusBanner.value = "Definições guardadas." }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    fun regenerateStudentPortalCode() {
        viewModelScope.launch {
            repository.regenerateStudentPortalCode()
                .onSuccess { _statusBanner.value = "Novo código do Link do Aluno gerado!" }
                .onFailure { _statusBanner.value = it.localizedMessage }
        }
    }

    // --- Formatters ---
    fun buildMessage(
        templateKey: String,
        clientName: String = "",
        sessions: List<TrainingSessionRecord> = emptyList(),
        week: TrainingWeekRecord? = currentData?.activeWeek
    ): String {
        val data = currentData ?: return ""
        val template = data.messageTemplates.find { it.templateKey == templateKey }
        return repository.formatMessage(template?.body.orEmpty(), clientName, sessions, week, data.settings)
    }

    fun buildWeekCsv(week: TrainingWeekRecord): String {
        val data = currentData ?: return ""
        val weekSessions = data.sessions.filter { it.weekKey == week.weekKey }
        val clientMap = data.clients.associateBy { it.id }
        val sb = StringBuilder("Dia,Hora,Duração,Vagas,Aluno,Telemóvel,Estado\n")
        for (session in weekSessions) {
            val sessionBookings = data.bookings.filter { it.sessionId == session.id && it.status != BookingStatus.CANCELLED.name }
            val confirmedCount = sessionBookings.count { it.status == BookingStatus.CONFIRMED.name }
            if (sessionBookings.isEmpty()) {
                sb.append("\"${session.dateLabel}\",${session.timeLabel},${session.durationMinutes}m,0/${session.capacity},\"(Sem inscritos)\",,\n")
            } else {
                for (b in sessionBookings) {
                    val c = clientMap[b.clientId]
                    val statusLabel = if (b.status == BookingStatus.CONFIRMED.name) "Confirmado" else "Pendente"
                    sb.append("\"${session.dateLabel}\",${session.timeLabel},${session.durationMinutes}m,${confirmedCount}/${session.capacity},\"${c?.name.orEmpty()}\",${c?.phone.orEmpty()},$statusLabel\n")
                }
            }
        }
        return sb.toString()
    }

    private companion object {
        const val TAG = "NewShapeVM"
    }
}

private data class BaseSlice(
    val clients: List<ClientRecord>,
    val weeks: List<TrainingWeekRecord>,
    val sessions: List<TrainingSessionRecord>,
    val bookings: List<BookingRecord>,
    val weekResponses: List<WeekResponseRecord>
)

private data class MgmtSlice(
    val payments: List<PaymentRecord>,
    val fidelizacoes: List<FidelizacaoRecord>,
    val exercises: List<ExerciseRecord>,
    val workoutPlans: List<WorkoutPlanRecord>,
    val workoutPlanItems: List<WorkoutPlanItemRecord>
)

private data class ExtraSlice(
    val foodItems: List<FoodItemRecord>,
    val nutritionEntries: List<NutritionEntryRecord>,
    val physicalAssessments: List<PhysicalAssessmentRecord>,
    val chatMessages: List<ChatMessageRecord>,
    val messageTemplates: List<MessageTemplateRecord>,
    val settings: StudioSettingsRecord
)

private data class ControlSlice(
    val role: AppRole,
    val activeStudentId: String?,
    val selectedWeekKey: String,
    val waitingWhatsAppReturn: Boolean,
    val undoSnapshot: UndoConfirmationSnapshot?
)
