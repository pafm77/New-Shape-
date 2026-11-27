package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.MakeupCreditCalculator
import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.TrainingSessionRecord
import com.example.ui.*
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun PtHomeTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    requestedSubTab: Pair<Int, Int>? = null,
    onJumpToPtApprovals: () -> Unit = {},
    onJumpToFinance: () -> Unit = {},
    onJumpToFidelizacoes: () -> Unit = {},
    onJumpToAttendance: () -> Unit = {},
    onJumpToAssessment: (String) -> Unit = {}
) {
    var selectedSubTab by remember { mutableIntStateOf(0) }
    val subTabs = listOf("Por confirmar", "Marcações", "Semanas", "Respostas", "Mensagens", "Definições")

    LaunchedEffect(requestedSubTab) {
        requestedSubTab?.let { (tabIdx, _) ->
            selectedSubTab = tabIdx.coerceIn(0, subTabs.lastIndex)
        }
    }

    LaunchedEffect(state.settings.birthDateReminderUntilMillis, state.clients.size) {
        if (state.clients.isNotEmpty() && state.settings.birthDateReminderUntilMillis <= 0L) {
            viewModel.ensureBirthDateReminderWindowIfUnset()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        ScrollableTabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            edgePadding = 16.dp,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                val countSuffix = if (idx == 0 && state.pendingQueue.isNotEmpty()) " (${state.pendingQueue.size})" else ""
                Tab(
                    selected = selectedSubTab == idx,
                    onClick = { selectedSubTab = idx },
                    modifier = Modifier.testTag("pt_home_subtab_$idx"),
                    text = {
                        Text(
                            text = "$title$countSuffix",
                            fontWeight = if (selectedSubTab == idx) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedSubTab == idx) NewShapeGold else TextSecondaryDark
                        )
                    }
                )
            }
        }

        when (selectedSubTab) {
            0 -> PorConfirmarSection(
                state = state,
                viewModel = viewModel,
                onJumpToResponses = { selectedSubTab = 3 },
                onJumpToPtApprovals = onJumpToPtApprovals,
                onJumpToFinance = onJumpToFinance,
                onJumpToFidelizacoes = onJumpToFidelizacoes,
                onJumpToAttendance = onJumpToAttendance,
                onJumpToAssessment = onJumpToAssessment
            )
            1 -> PtMarcacoesSection(state = state, viewModel = viewModel)
            2 -> SemanasSection(state = state, viewModel = viewModel)
            3 -> RespostasSection(state = state, viewModel = viewModel)
            4 -> MensagensOnlySection(state = state, viewModel = viewModel)
            5 -> PtSettingsSection(state = state, viewModel = viewModel)
        }
    }
}

@Composable
private fun PorConfirmarSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onJumpToResponses: () -> Unit,
    onJumpToPtApprovals: () -> Unit,
    onJumpToFinance: () -> Unit,
    onJumpToFidelizacoes: () -> Unit,
    onJumpToAttendance: () -> Unit,
    onJumpToAssessment: (String) -> Unit
) {
    val context = LocalContext.current
    val activeWeek = state.activeWeek

    val activeClients = state.clients.filter { it.active }
    val weekBookedClientIds = if (activeWeek != null) {
        state.bookings.filter { it.weekKey == activeWeek.weekKey && it.status != BookingStatus.CANCELLED.name }
            .map { it.clientId }.toSet()
    } else emptySet()
    val unavailableClientIds = if (activeWeek != null) {
        state.weekResponses.filter { it.weekKey == activeWeek.weekKey && it.status == "UNAVAILABLE" }
            .map { it.clientId }.toSet()
    } else emptySet()
    val notRespondedCount = activeClients.count { it.id !in weekBookedClientIds && it.id !in unavailableClientIds }

    val unreadAlerts = remember(state.ptNotifications) {
        state.ptNotifications.filter { !it.read }
    }
    val expiringFidsCount = remember(state.fidelizacoes) {
        val now = System.currentTimeMillis()
        state.fidelizacoes.count { ((it.endDateMillis - now) / 86_400_000L).toInt() <= 30 }
    }
    val inactiveStudentsCount = remember(state.clients, state.sessions, state.bookings) {
        countInactiveActiveStudents(state.clients, state.sessions, state.bookings, 7)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.isSuperAdmin && state.pendingPtApprovalsCount > 0) {
            item {
                Surface(
                    color = NewShapeGoldMuted,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.5.dp, NewShapeGold),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Novos PTs por confirmar (${state.pendingPtApprovalsCount})",
                                style = MaterialTheme.typography.titleSmall,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Existem registos de Personal Trainers à espera da tua aprovação.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                        TextButton(
                            onClick = onJumpToPtApprovals,
                            modifier = Modifier.testTag("home_jump_pt_approvals_btn")
                        ) {
                            Text("Gerir", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (state.isSuperAdmin) {
            item(key = "admin_business_summary_card") {
                BusinessSummaryCard(
                    clients = state.clients,
                    payments = state.payments,
                    fidelizacoes = state.fidelizacoes,
                    bookings = state.bookings,
                    isSuperAdmin = state.isSuperAdmin,
                    onJumpToFinance = onJumpToFinance,
                    onJumpToFidelizacoes = onJumpToFidelizacoes
                )
            }
        }

        if (expiringFidsCount > 0) {
            item {
                Surface(
                    color = PendingAmberContainer,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.7f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "$expiringFidsCount fidelização(ões) a terminar (≤30d)",
                                style = MaterialTheme.typography.titleSmall,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Envia mensagem de renovação pelo WhatsApp.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                        TextButton(
                            onClick = onJumpToFidelizacoes,
                            modifier = Modifier.testTag("home_jump_fidelizacoes_btn")
                        ) {
                            Text("Ver", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (inactiveStudentsCount > 0) {
            item {
                Surface(
                    color = ElevatedCharcoal,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "$inactiveStudentsCount aluno(s) inativo(s) (≥7 dias)",
                                style = MaterialTheme.typography.titleSmall,
                                color = TextPrimaryDark,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Consulta a assiduidade e faz check-in rápido.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        TextButton(
                            onClick = onJumpToAttendance,
                            modifier = Modifier.testTag("home_jump_attendance_btn")
                        ) {
                            Text("Assiduidade", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (unreadAlerts.isNotEmpty()) {
            item {
                Surface(
                    color = DangerRedContainer,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.7f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    Icons.Default.NotificationsActive,
                                    contentDescription = "Alertas de alterações",
                                    tint = DangerRed,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Notificações Recentes (${unreadAlerts.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = TextPrimaryDark,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(
                                onClick = { viewModel.markAllPtNotificationsRead() },
                                modifier = Modifier.testTag("home_clear_alerts_btn")
                            ) {
                                Text("Marcar lidas", color = NewShapeGoldBright, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        unreadAlerts.take(3).forEach { alert ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "${alert.clientName} · ${formatTimeAgo(alert.timestampMillis)}",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = NewShapeGoldBright
                                        )
                                        if (alert.type == "ASSESSMENT") {
                                            StatusPill(
                                                text = "Nova avaliação",
                                                textColor = ConfirmedGreen,
                                                containerColor = ConfirmedGreenContainer
                                            )
                                        } else if (alert.type == "FEEDBACK") {
                                            StatusPill(
                                                text = "Feedback treino",
                                                textColor = NewShapeGoldBright,
                                                containerColor = NewShapeGoldMuted
                                            )
                                        }
                                    }
                                    Text(
                                        text = alert.summary,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextPrimaryDark
                                    )
                                    if (alert.type == "ASSESSMENT" && alert.clientId.isNotBlank()) {
                                        TextButton(
                                            onClick = {
                                                viewModel.markPtNotificationRead(alert.id)
                                                onJumpToAssessment(alert.clientId)
                                            },
                                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                                            modifier = Modifier.testTag("home_view_assessment_${alert.id}")
                                        ) {
                                            Text(
                                                "Ver avaliação →",
                                                color = ConfirmedGreen,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                                IconButton(
                                    onClick = { viewModel.markPtNotificationRead(alert.id) },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Check, contentDescription = "Marcar alerta como lido", tint = ConfirmedGreen, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        item(key = "upcoming_birthdays_card") {
            UpcomingBirthdaysCard(
                clients = state.clients,
                whatsappWebMode = state.settings.whatsappWebMode,
                reminderUntilMillis = state.settings.birthDateReminderUntilMillis,
                onRenewReminder = { viewModel.renewBirthDateReminder30Days() }
            )
        }

        if (activeWeek != null) {
            item {
                Surface(
                    color = NewShapeGoldMuted,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Semana ${activeWeek.label}",
                                style = MaterialTheme.typography.titleSmall,
                                color = NewShapeGoldBright
                            )
                            Text(
                                text = "$notRespondedCount aluno(s) por responder",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                        TextButton(onClick = onJumpToResponses) {
                            Text("Ver respostas", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Por confirmar",
                    style = MaterialTheme.typography.headlineMedium,
                    color = TextPrimaryDark
                )
                if (state.pendingQueue.isNotEmpty()) {
                    StatusPill(
                        text = state.pendingQueue.size.toString(),
                        textColor = TextOnGold,
                        containerColor = NewShapeGold
                    )
                }
            }
        }

        if (state.pendingQueue.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.DoneAll,
                    title = "Fila vazia!",
                    subtitle = "Todos os pedidos de marcação estão confirmados."
                )
            }
        } else {
            itemsIndexed(state.pendingQueue, key = { _, card -> "${card.client.id}_${card.week.weekKey}" }) { index, card ->
                PendingConfirmationCardView(
                    card = card,
                    isFirst = index == 0,
                    isLockedByWhatsApp = state.waitingWhatsAppReturn,
                    allWeekSessions = state.sessions.filter { it.weekKey == card.week.weekKey },
                    allBookings = state.bookings,
                    buildMessage = { key, sessions ->
                        viewModel.buildMessage(key, card.client.name, sessions, card.week)
                    },
                    onConfirmAll = {
                        val templateKey = if (card.isCancelledAll) "CANCELAMENTO" else "CONFIRMACAO"
                        val msg = viewModel.buildMessage(
                            templateKey = templateKey,
                            clientName = card.client.name,
                            sessions = card.items.map { it.session },
                            week = card.week
                        )
                        viewModel.confirmCardAndNotify(card)
                        openWhatsApp(context, card.client.phone, msg, state.settings.whatsappWebMode)
                    },
                    onConfirmSilently = {
                        viewModel.confirmCardSilently(card)
                    },
                    onRejectItem = { item ->
                        val msg = viewModel.buildMessage(
                            templateKey = "RECUSA",
                            clientName = card.client.name,
                            sessions = listOf(item.session),
                            week = card.week
                        )
                        viewModel.rejectBooking(item.booking)
                        openWhatsApp(context, card.client.phone, msg, state.settings.whatsappWebMode)
                    },
                    onMoveItem = { item, newSession ->
                        val msg = viewModel.buildMessage(
                            templateKey = "ALTERACAO",
                            clientName = card.client.name,
                            sessions = listOf(newSession),
                            week = card.week
                        )
                        viewModel.moveBooking(item.booking, newSession.id)
                        openWhatsApp(context, card.client.phone, msg, state.settings.whatsappWebMode)
                    }
                )
            }
        }
    }
}

@Composable
private fun PendingConfirmationCardView(
    card: PendingConfirmationCard,
    isFirst: Boolean,
    isLockedByWhatsApp: Boolean,
    allWeekSessions: List<TrainingSessionRecord>,
    allBookings: List<BookingRecord>,
    buildMessage: (String, List<TrainingSessionRecord>) -> String,
    onConfirmAll: () -> Unit,
    onConfirmSilently: () -> Unit,
    onRejectItem: (BookingWithSession) -> Unit,
    onMoveItem: (BookingWithSession, TrainingSessionRecord) -> Unit
) {
    var showMessagePreview by remember { mutableStateOf(false) }
    val hasMakeupInWeek = remember(allBookings, card.client.id, card.week.weekKey, card.items) {
        card.items.any { it.booking.makeup } ||
            card.client.id in MakeupCreditCalculator.getMakeupClientIdsForWeek(allBookings, card.week.weekKey)
    }

    Surface(
        color = if (hasMakeupInWeek) MakeupPurpleContainer.copy(alpha = 0.45f) else CharcoalSurface,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(
            width = if (hasMakeupInWeek || isFirst) 1.5.dp else 1.dp,
            color = when {
                hasMakeupInWeek -> MakeupPurple
                isFirst -> NewShapeGold
                else -> HairlineBorder
            }
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = card.client.name,
                        style = MaterialTheme.typography.titleLarge,
                        color = if (hasMakeupInWeek) MakeupPurpleBright else TextPrimaryDark
                    )
                    if (hasMakeupInWeek) {
                        StatusPill("Em compensação", MakeupPurpleBright, MakeupPurpleContainer)
                    }
                    if (card.client.fixedSlots.isNotEmpty()) {
                        StatusPill("Horário Fixo", NewShapeGoldBright, NewShapeGoldMuted)
                    }
                    if (card.isAltered) {
                        StatusPill("Alterado", PendingAmber, PendingAmberContainer)
                    }
                    if (card.isCancelledAll) {
                        StatusPill("Cancelou", DangerRed, DangerRedContainer)
                    }
                    if (card.client.newClient) {
                        StatusPill("Novo", InfoBlue, InfoBlueContainer)
                    }
                }
                Text(
                    text = card.client.phone.ifBlank { "Sem telemóvel" },
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatTimeAgo(card.requestedAtMillis),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondaryDark
                )
                Text(
                    text = card.week.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (hasMakeupInWeek) MakeupPurpleBright else NewShapeGold
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        HorizontalDivider(color = if (hasMakeupInWeek) MakeupPurple.copy(alpha = 0.4f) else HairlineBorder)
        Spacer(Modifier.height(10.dp))

        card.items.forEach { item ->
            var showMovePicker by remember { mutableStateOf(false) }
            var selectedMoveTarget by remember { mutableStateOf<TrainingSessionRecord?>(null) }

            val availableTargets = remember(allWeekSessions, allBookings, item.session.id) {
                allWeekSessions.filter { s ->
                    if (s.id == item.session.id) return@filter false
                    val confirmedCount = allBookings.count {
                        it.sessionId == s.id && it.status == BookingStatus.CONFIRMED.name
                    }
                    s.capacity - confirmedCount > 0
                }
            }

            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "${item.session.dateLabel} – ${item.session.timeLabel.replace(":", "h")}",
                        style = MaterialTheme.typography.titleSmall,
                        color = if (hasMakeupInWeek) MakeupPurpleBright else TextPrimaryDark
                    )
                    if (hasMakeupInWeek) {
                        StatusPill(
                            text = if (item.booking.makeup) "Compensação" else "Em compensação",
                            textColor = MakeupPurpleBright,
                            containerColor = MakeupPurpleContainer
                        )
                    }
                }
                if (!card.isCancelledAll) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Text(
                            text = "Recusar",
                            style = MaterialTheme.typography.labelMedium,
                            color = DangerRed,
                            modifier = Modifier
                                .clickable(enabled = !isLockedByWhatsApp) { onRejectItem(item) }
                                .padding(vertical = 6.dp)
                        )
                        Text(
                            text = if (showMovePicker) "Fechar mover" else "Mover para...",
                            style = MaterialTheme.typography.labelMedium,
                            color = NewShapeGold,
                            modifier = Modifier
                                .clickable(enabled = !isLockedByWhatsApp) {
                                    showMovePicker = !showMovePicker
                                    selectedMoveTarget = availableTargets.firstOrNull()
                                }
                                .padding(vertical = 6.dp)
                        )
                    }
                }

                AnimatedVisibility(visible = showMovePicker) {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            if (availableTargets.isEmpty()) {
                                Text(
                                    "Sem outros treinos com vagas esta semana.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                            } else {
                                availableTargets.forEach { target ->
                                    val confirmedCount = allBookings.count {
                                        it.sessionId == target.id && it.status == BookingStatus.CONFIRMED.name
                                    }
                                    val spots = (target.capacity - confirmedCount).coerceAtLeast(0)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { selectedMoveTarget = target }
                                            .padding(vertical = 4.dp)
                                    ) {
                                        RadioButton(
                                            selected = selectedMoveTarget?.id == target.id,
                                            onClick = { selectedMoveTarget = target },
                                            colors = RadioButtonDefaults.colors(selectedColor = NewShapeGold)
                                        )
                                        Text(
                                            text = "${target.dateLabel} – ${target.timeLabel.replace(":", "h")} ($spots vagas)",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextPrimaryDark
                                        )
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                DarkSecondaryButton(
                                    text = "Mover, confirmar e abrir WhatsApp",
                                    onClick = {
                                        selectedMoveTarget?.let { target ->
                                            showMovePicker = false
                                            onMoveItem(item, target)
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clickable { showMessagePreview = !showMessagePreview }
                .padding(vertical = 6.dp)
        ) {
            Icon(
                imageVector = if (showMessagePreview) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = TextSecondaryDark,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(4.dp))
            Text(
                text = "Ver mensagem",
                style = MaterialTheme.typography.labelMedium,
                color = TextSecondaryDark
            )
        }

        AnimatedVisibility(visible = showMessagePreview) {
            val previewKey = if (card.isCancelledAll) "CANCELAMENTO" else "CONFIRMACAO"
            val previewText = buildMessage(previewKey, card.items.map { it.session })
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            ) {
                Text(
                    text = previewText,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextPrimaryDark,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }

        Spacer(Modifier.height(6.dp))
        val hasPhone = card.client.phone.isNotBlank()
        if (!hasPhone) {
            val silentLabel = if (card.isCancelledAll) "Concluir sem mensagem" else "Confirmar sem mensagem"
            if (isFirst) {
                GoldPrimaryButton(
                    text = silentLabel,
                    icon = Icons.Default.Check,
                    onClick = onConfirmSilently,
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "confirm_first_card_silent_button"
                )
            } else {
                DarkSecondaryButton(
                    text = silentLabel,
                    icon = Icons.Default.Check,
                    onClick = onConfirmSilently,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        } else {
            val ctaLabel = if (card.isCancelledAll) "Responder e abrir WhatsApp" else "Confirmar e abrir WhatsApp"
            if (isFirst) {
                GoldPrimaryButton(
                    text = ctaLabel,
                    icon = Icons.Default.Check,
                    enabled = !isLockedByWhatsApp,
                    onClick = onConfirmAll,
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "confirm_first_card_button"
                )
            } else {
                DarkSecondaryButton(
                    text = ctaLabel,
                    icon = Icons.Default.Check,
                    onClick = { if (!isLockedByWhatsApp) onConfirmAll() },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(
                onClick = onConfirmSilently,
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("confirm_card_silent_${card.client.id}")
            ) {
                Icon(Icons.Default.Done, contentDescription = null, tint = TextSecondaryDark, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    text = if (card.isCancelledAll) "Concluir sem enviar mensagem" else "Confirmar sem enviar mensagem",
                    color = TextSecondaryDark,
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }
        }
    }
}
