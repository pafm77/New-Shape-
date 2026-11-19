package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.*
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

@Composable
fun StudentMainScaffold(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onSignOut: () -> Unit
) {
    val student = state.activeStudent
    if (student == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(ObsidianBg),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                Text("Nenhum perfil de aluno selecionado", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                Spacer(Modifier.height(12.dp))
                GoldPrimaryButton(text = "Escolher Perfil", onClick = { viewModel.backToRoleSelector() })
            }
        }
        return
    }

    var selectedTab by remember { mutableIntStateOf(0) }
    val firstName = student.name.trim().split(" ").firstOrNull().orEmpty()

    val navItems = listOf(
        Triple("Agenda", Icons.Default.CalendarMonth, "student_nav_agenda"),
        Triple("Treino", Icons.Default.FitnessCenter, "student_nav_workout"),
        Triple("Nutrição", Icons.Default.Restaurant, "student_nav_nutrition"),
        Triple("Avaliação", Icons.Default.MonitorWeight, "student_nav_assessment"),
        Triple("Mensal.", Icons.Default.Payments, "student_nav_billing"),
        Triple("Chat", Icons.AutoMirrored.Filled.Chat, "student_nav_chat")
    )

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBg)
    ) {
        val isWide = maxWidth >= 600.dp

        Scaffold(
            containerColor = ObsidianBg,
            contentWindowInsets = WindowInsets.safeDrawing,
            topBar = {
                Surface(color = CharcoalSurface, tonalElevation = 2.dp) {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                NewShapeLogo(compact = true)
                                Column {
                                    Text("Olá, $firstName! 👋", style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                    Text(
                                        text = "Não és tu?",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = NewShapeGold,
                                        modifier = Modifier.clickable { viewModel.backToRoleSelector() }
                                    )
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                TextButton(
                                    onClick = { viewModel.enterPtMode() },
                                    modifier = Modifier.testTag("switch_to_pt_btn")
                                ) {
                                    Icon(Icons.Default.SwapHoriz, contentDescription = "Vista PT", tint = NewShapeGold, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("PT", color = NewShapeGold, fontWeight = FontWeight.Bold)
                                }
                                IconButton(onClick = onSignOut) {
                                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Terminar sessão Google", tint = TextSecondaryDark)
                                }
                            }
                        }

                        state.statusBannerMessage?.let { msg ->
                            Surface(
                                color = ConfirmedGreenContainer,
                                border = BorderStroke(1.dp, ConfirmedGreen),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(msg, style = MaterialTheme.typography.bodySmall, color = ConfirmedGreen, modifier = Modifier.weight(1f))
                                    IconButton(onClick = { viewModel.clearBanner() }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = ConfirmedGreen, modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            },
            bottomBar = {
                if (!isWide) {
                    NavigationBar(containerColor = CharcoalSurface, tonalElevation = 4.dp) {
                        navItems.forEachIndexed { idx, (label, icon, tag) ->
                            NavigationBarItem(
                                selected = selectedTab == idx,
                                onClick = { selectedTab = idx },
                                modifier = Modifier.testTag(tag),
                                icon = { Icon(icon, contentDescription = label) },
                                label = { Text(label, fontSize = 10.sp, maxLines = 1, softWrap = false) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = NewShapeGold,
                                    selectedTextColor = NewShapeGold,
                                    indicatorColor = NewShapeGoldMuted,
                                    unselectedIconColor = TextSecondaryDark,
                                    unselectedTextColor = TextSecondaryDark
                                )
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (isWide) {
                    NavigationRail(containerColor = CharcoalSurface) {
                        Spacer(Modifier.height(12.dp))
                        navItems.forEachIndexed { idx, (label, icon, tag) ->
                            NavigationRailItem(
                                selected = selectedTab == idx,
                                onClick = { selectedTab = idx },
                                modifier = Modifier.testTag(tag),
                                icon = { Icon(icon, contentDescription = label) },
                                label = { Text(label) },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = NewShapeGold,
                                    selectedTextColor = NewShapeGold,
                                    indicatorColor = NewShapeGoldMuted,
                                    unselectedIconColor = TextSecondaryDark,
                                    unselectedTextColor = TextSecondaryDark
                                )
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Box(modifier = Modifier.fillMaxSize().widthIn(max = 840.dp)) {
                        when (selectedTab) {
                            0 -> StudentBookingScreen(student = student, state = state, viewModel = viewModel)
                            1 -> StudentWorkoutScreen(student = student, state = state)
                            2 -> StudentNutritionScreen(student = student, state = state)
                            3 -> StudentAssessmentScreen(student = student, state = state)
                            4 -> StudentBillingScreen(student = student, state = state)
                            5 -> PrivateChatScreen(
                                client = student,
                                messages = state.chatMessages.filter { it.clientId == student.id },
                                viewerRole = "STUDENT",
                                onSendMessage = { text -> viewModel.sendChatMessage(student.id, "STUDENT", text) },
                                onBack = null
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StudentBookingScreen(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val publishedWeeks = remember(state.weeks) { state.weeks.filter { it.published } }
    var weekIndex by remember(publishedWeeks.size) { mutableIntStateOf(0) }
    val currentWeek = publishedWeeks.getOrNull(weekIndex.coerceIn(0, (publishedWeeks.size - 1).coerceAtLeast(0)))

    val weekSessions = remember(state.sessions, currentWeek?.weekKey) {
        if (currentWeek == null) emptyList()
        else state.sessions.filter { it.weekKey == currentWeek.weekKey }.sortedBy { it.startMillis }
    }

    val existingBookings = remember(state.bookings, currentWeek?.weekKey, student.id) {
        if (currentWeek == null) emptyList()
        else state.bookings.filter {
            it.weekKey == currentWeek.weekKey && it.clientId == student.id && it.status != BookingStatus.CANCELLED.name
        }
    }
    val existingIds = remember(existingBookings) { existingBookings.map { it.sessionId }.toSet() }
    var selectedSessionIds by remember(currentWeek?.weekKey, existingIds) { mutableStateOf(existingIds) }

    val unavailableThisWeek = currentWeek != null && state.weekResponses.any {
        it.weekKey == currentWeek.weekKey && it.clientId == student.id && it.status == "UNAVAILABLE"
    }

    val cutoffMs = state.settings.cutoffHours * 3_600_000L
    val nowMs = System.currentTimeMillis()
    val hasConfirmed = existingBookings.any { it.status == BookingStatus.CONFIRMED.name }
    val canEditExisting = existingBookings.isEmpty() || !hasConfirmed || state.settings.clientsCanEdit

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (publishedWeeks.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.EventBusy,
                    title = "Sem semanas publicadas",
                    subtitle = "O teu PT ainda está a preparar os horários desta semana."
                )
            }
            return@LazyColumn
        }

        // Week Switcher
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(
                        enabled = weekIndex > 0,
                        onClick = { weekIndex = (weekIndex - 1).coerceAtLeast(0) }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Semana anterior", tint = if (weekIndex > 0) NewShapeGold else TextSecondaryDark)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Escolhe os teus treinos", style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                        Text(currentWeek?.label ?: "", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                    }
                    IconButton(
                        enabled = weekIndex < publishedWeeks.lastIndex,
                        onClick = { weekIndex = (weekIndex + 1).coerceAtMost(publishedWeeks.lastIndex) }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Próxima semana", tint = if (weekIndex < publishedWeeks.lastIndex) NewShapeGold else TextSecondaryDark)
                    }
                }
            }
        }

        // Current Status Banner
        if (unavailableThisWeek) {
            item {
                Surface(
                    color = ElevatedCharcoal,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Avisaste que esta semana não podes treinar. Se mudares de ideias, seleciona os horários abaixo!",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimaryDark,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        } else if (existingBookings.isNotEmpty()) {
            item {
                val anyPending = existingBookings.any { it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name }
                Surface(
                    color = if (anyPending) PendingAmberContainer else ConfirmedGreenContainer,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, if (anyPending) PendingAmber else ConfirmedGreen),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (anyPending) "Pedido recebido! 🙌" else "Treinos confirmados ✓",
                                style = MaterialTheme.typography.titleSmall,
                                color = if (anyPending) PendingAmber else ConfirmedGreen
                            )
                            Text(
                                text = if (anyPending) "Vais receber a confirmação do PT no WhatsApp." else "Os teus horários estão confirmados.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                        StatusPill(
                            text = if (anyPending) "Pendente" else "Confirmado",
                            textColor = if (anyPending) PendingAmber else ConfirmedGreen,
                            containerColor = ObsidianBg.copy(alpha = 0.5f)
                        )
                    }
                }
            }
        }

        // Session Cards
        items(weekSessions, key = { it.id }) { session ->
            val sessionBookings = state.bookings.filter {
                it.sessionId == session.id && it.status != BookingStatus.CANCELLED.name
            }
            val spotsLeft = (session.capacity - sessionBookings.size).coerceAtLeast(0)
            val isSelected = session.id in selectedSessionIds
            val isPastCutoff = session.startMillis > 0 && (session.startMillis - nowMs) < cutoffMs
            val existingForSession = existingBookings.find { it.sessionId == session.id }
            val isFullForNew = spotsLeft <= 0 && !isSelected
            val canToggle = canEditExisting && !isPastCutoff && !isFullForNew

            Surface(
                color = if (isSelected) NewShapeGoldMuted else CharcoalSurface,
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) NewShapeGold else HairlineBorder
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .clickable(enabled = canToggle) {
                        selectedSessionIds = if (isSelected) selectedSessionIds - session.id else selectedSessionIds + session.id
                    }
                    .testTag("student_session_${session.id}")
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${session.dateLabel} · ${session.timeLabel.replace(":", "h")}",
                            style = MaterialTheme.typography.titleSmall,
                            color = if (isSelected) NewShapeGoldBright else TextPrimaryDark
                        )
                        Text(
                            text = "${session.durationMinutes} min" + if (session.note.isNotBlank()) " · ${session.note}" else "",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                        if (isPastCutoff) {
                            Text(
                                text = "Fechado (menos de ${state.settings.cutoffHours}h)",
                                style = MaterialTheme.typography.labelSmall,
                                color = DangerRed
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (existingForSession != null) {
                            val conf = existingForSession.status == BookingStatus.CONFIRMED.name
                            StatusPill(
                                text = if (conf) "Confirmado" else "Pendente",
                                textColor = if (conf) ConfirmedGreen else PendingAmber,
                                containerColor = if (conf) ConfirmedGreenContainer else PendingAmberContainer
                            )
                        } else {
                            StatusPill(
                                text = if (spotsLeft == 0) "Lotado" else "$spotsLeft vagas",
                                textColor = if (spotsLeft == 0) DangerRed else TextPrimaryDark,
                                containerColor = ElevatedCharcoal
                            )
                        }
                        Icon(
                            imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                            contentDescription = if (isSelected) "Selecionado" else "Selecionar",
                            tint = if (isSelected) NewShapeGold else TextSecondaryDark
                        )
                    }
                }
            }
        }

        // Actions
        if (currentWeek != null) {
            item {
                Spacer(Modifier.height(4.dp))
                GoldPrimaryButton(
                    text = if (existingBookings.isEmpty()) "Marcar treinos (${selectedSessionIds.size})" else "Guardar alterações",
                    icon = Icons.Default.Check,
                    enabled = canEditExisting && (selectedSessionIds.isNotEmpty() || existingBookings.isNotEmpty()),
                    onClick = { viewModel.submitStudentBookings(currentWeek.weekKey, student.id, selectedSessionIds) },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "student_submit_bookings_btn"
                )
                Spacer(Modifier.height(8.dp))
                DarkSecondaryButton(
                    text = "Esta semana não posso",
                    onClick = { viewModel.markStudentUnavailable(currentWeek.weekKey, student.id) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun StudentWorkoutScreen(
    student: ClientRecord,
    state: StudioUiState
) {
    val plans = remember(state.workoutPlans, student.id) {
        state.workoutPlans.filter { it.clientId == student.id }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Os Meus Planos de Treino", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text("Prescritos pelo teu Personal Trainer", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }

        if (plans.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.FitnessCenter,
                    title = "Sem plano de treino ainda",
                    subtitle = "Assim que o teu PT adicionar um plano, vai aparecer aqui."
                )
            }
        } else {
            items(plans, key = { it.id }) { plan ->
                val items = state.workoutPlanItems.filter { it.planId == plan.id }.sortedBy { it.orderIndex }
                BrandCard(highlightBorder = true) {
                    Text(plan.title, style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                    if (plan.splitLabel.isNotBlank()) {
                        Text(plan.splitLabel, style = MaterialTheme.typography.bodySmall, color = NewShapeGoldBright)
                    }
                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = HairlineBorder)
                    if (items.isEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Plano sem exercícios ainda.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    } else {
                        items.forEachIndexed { idx, exItem ->
                            WorkoutPlanExerciseRow(index = idx + 1, item = exItem, onRemove = null)
                            if (idx < items.lastIndex) HorizontalDivider(color = HairlineBorder.copy(alpha = 0.5f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StudentNutritionScreen(
    student: ClientRecord,
    state: StudioUiState
) {
    val entries = remember(state.nutritionEntries, student.id) {
        state.nutritionEntries.filter { it.clientId == student.id }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("A Minha Nutrição", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text("Plano alimentar e macros diárias", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }
        item {
            DailyMacrosSummaryCard(entries = entries)
        }
        items(MealType.entries.toList(), key = { it.name }) { meal ->
            MealCard(
                meal = meal,
                entries = entries.filter { it.mealType == meal.name },
                onAddFood = null,
                onRemoveEntry = null
            )
        }
    }
}

@Composable
private fun StudentAssessmentScreen(
    student: ClientRecord,
    state: StudioUiState
) {
    val assessments = remember(state.physicalAssessments, student.id) {
        state.physicalAssessments
            .filter { it.clientId == student.id }
            .sortedBy { it.dateMillis }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("A Minha Avaliação Física", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text("Peso, composição corporal, IMC, TMB e evolução", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }
        assessmentDashboardItems(
            assessments = assessments,
            onDelete = null
        )
    }
}

@Composable
private fun StudentBillingScreen(
    student: ClientRecord,
    state: StudioUiState
) {
    val payments = remember(state.payments, student.id) {
        state.payments.filter { it.clientId == student.id }
    }
    val fids = remember(state.fidelizacoes, student.id) {
        state.fidelizacoes.filter { it.clientId == student.id }
    }
    val currentPayment = payments.find { it.monthYear == state.currentMonthYear && it.paid }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Mensalidade & Fidelização", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
        }

        if (student.monthlyFeeEur > 0.0 || student.fidelizacaoMonths > 0) {
            item {
                BrandCard {
                    Text("Plano Contratado", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                    Spacer(Modifier.height(4.dp))
                    if (student.monthlyFeeEur > 0.0) {
                        Text(
                            text = "Valor da mensalidade: €${String.format("%.2f", student.monthlyFeeEur)} / mês",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimaryDark
                        )
                    }
                    if (student.fidelizacaoMonths > 0 && student.fidelizacaoStartMillis > 0L) {
                        val endCal = Calendar.getInstance().apply {
                            timeInMillis = student.fidelizacaoStartMillis
                            add(Calendar.MONTH, student.fidelizacaoMonths)
                        }
                        Text(
                            text = "Fidelização ${student.fidelizacaoMonths} meses: ${formatShortDate(student.fidelizacaoStartMillis)} → ${formatShortDate(endCal.timeInMillis)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }
            }
        }

        item {
            BrandCard(highlightBorder = currentPayment != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Estado (${state.currentMonthLabel})", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                        Text(
                            text = if (currentPayment != null) {
                                "Mensalidade paga (€${String.format("%.2f", currentPayment.amountEur)}) em ${formatShortDate(currentPayment.paidAtMillis)}"
                            } else {
                                "Pagamento ainda não registado este mês"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = if (currentPayment != null) ConfirmedGreen else PendingAmber
                        )
                    }
                    StatusPill(
                        text = if (currentPayment != null) "Pago ✓" else "Pendente",
                        textColor = if (currentPayment != null) ConfirmedGreen else PendingAmber,
                        containerColor = if (currentPayment != null) ConfirmedGreenContainer else PendingAmberContainer
                    )
                }
            }
        }

        if (fids.isNotEmpty()) {
            item {
                Text("Fidelização Ativa", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
            }
            items(fids, key = { it.id }) { fid ->
                val daysLeft = ((fid.endDateMillis - System.currentTimeMillis()) / 86_400_000L).toInt()
                BrandCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Plano ${fid.durationMonths} Meses", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                        StatusPill(
                            text = if (daysLeft < 0) "Expirada" else "$daysLeft dias rest.",
                            textColor = if (daysLeft < 0) DangerRed else ConfirmedGreen,
                            containerColor = if (daysLeft < 0) DangerRedContainer else ConfirmedGreenContainer
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Início: ${formatShortDate(fid.startDateMillis)}  ·  Fim: ${formatShortDate(fid.endDateMillis)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimaryDark
                    )
                    if (fid.notes.isNotBlank()) {
                        Text(fid.notes, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    }
                }
            }
        }

        item {
            Text("Histórico de Mensalidades", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
        }

        if (payments.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.AutoMirrored.Filled.ReceiptLong,
                    title = "Sem recibos ainda",
                    subtitle = "Quando o PT registar os teus pagamentos, ficam listados aqui."
                )
            }
        } else {
            items(payments, key = { it.id }) { p ->
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(p.monthLabel, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                            Text(
                                text = "${formatShortDate(p.paidAtMillis)}${if (p.note.isNotBlank()) " · ${p.note}" else ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        StatusPill(
                            text = "Pago €${String.format("%.2f", p.amountEur)}",
                            textColor = ConfirmedGreen,
                            containerColor = ConfirmedGreenContainer
                        )
                    }
                }
            }
        }
    }
}
