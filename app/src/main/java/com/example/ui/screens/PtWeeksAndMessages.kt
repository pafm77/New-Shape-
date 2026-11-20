package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.*
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun SemanasSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val activeWeek = state.activeWeek
    val weekSessions = remember(state.sessions, activeWeek?.weekKey) {
        if (activeWeek == null) emptyList()
        else state.sessions.filter { it.weekKey == activeWeek.weekKey }.sortedBy { it.startMillis }
    }

    var showNewSessionDialog by remember { mutableStateOf(false) }
    var selectedSessionDetail by remember { mutableStateOf<TrainingSessionRecord?>(null) }
    var sessionToEdit by remember { mutableStateOf<TrainingSessionRecord?>(null) }
    var sessionToDelete by remember { mutableStateOf<TrainingSessionRecord?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(
                        onClick = { viewModel.shiftWeek(-1) },
                        modifier = Modifier.testTag("week_prev_btn")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Semana anterior", tint = NewShapeGold)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = activeWeek?.label ?: "Semana",
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = if (activeWeek?.published == true) "Publicada · Visível para alunos" else "Rascunho · Oculta dos alunos",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (activeWeek?.published == true) ConfirmedGreen else PendingAmber
                        )
                    }
                    IconButton(
                        onClick = { viewModel.shiftWeek(1) },
                        modifier = Modifier.testTag("week_next_btn")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Semana seguinte", tint = NewShapeGold)
                    }
                }

                Spacer(Modifier.height(12.dp))

                if (activeWeek != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        GoldPrimaryButton(
                            text = "+ Novo treino",
                            onClick = { showNewSessionDialog = true },
                            modifier = Modifier.weight(1f),
                            testTag = "new_session_button"
                        )
                        DarkSecondaryButton(
                            text = if (activeWeek.published) "Despublicar" else "Publicar semana",
                            onClick = { viewModel.toggleWeekPublished(activeWeek) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        DarkSecondaryButton(
                            text = "Duplicar anterior",
                            icon = Icons.Default.ContentCopy,
                            onClick = { viewModel.duplicatePreviousWeek(activeWeek) },
                            modifier = Modifier.weight(1f)
                        )
                        DarkSecondaryButton(
                            text = "Exportar CSV",
                            icon = Icons.Default.Download,
                            onClick = {
                                val csv = viewModel.buildWeekCsv(activeWeek)
                                sharePlainText(context, "New Shape · Treinos ${activeWeek.label}", csv)
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        if (activeWeek != null && activeWeek.published) {
            val inviteMsg = viewModel.buildMessage("CONVITE", week = activeWeek)
            item {
                BrandCard(highlightBorder = true) {
                    Text("Convite da semana", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                    Spacer(Modifier.height(6.dp))
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = inviteMsg,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextPrimaryDark,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        DarkSecondaryButton(
                            text = "Copiar mensagem",
                            icon = Icons.Default.ContentCopy,
                            onClick = { copyToClipboard(context, inviteMsg) },
                            modifier = Modifier.weight(1f)
                        )
                        GoldPrimaryButton(
                            text = "Partilhar WhatsApp",
                            icon = Icons.Default.Share,
                            onClick = {
                                openWhatsApp(context, null, inviteMsg, state.settings.whatsappWebMode)
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = "Treinos (${weekSessions.size})",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimaryDark
            )
        }

        if (weekSessions.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.CalendarMonth,
                    title = "Sem treinos nesta semana",
                    subtitle = "Toca em '+ Novo treino' ou 'Duplicar anterior' para criar os horários."
                )
            }
        } else {
            items(weekSessions, key = { it.id }) { session ->
                val sessionBookings = state.bookings.filter {
                    it.sessionId == session.id && it.status != BookingStatus.CANCELLED.name
                }
                val pendingCount = sessionBookings.count {
                    it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
                }
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(MaterialTheme.shapes.medium)
                        .clickable { selectedSessionDetail = session }
                        .testTag("session_card_${session.id}")
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
                                color = TextPrimaryDark
                            )
                            Text(
                                text = "${session.durationMinutes} min" + if (session.note.isNotBlank()) " · ${session.note}" else "",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                            if (pendingCount > 0) {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "$pendingCount por confirmar",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PendingAmber
                                )
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val confirmedCount = sessionBookings.count { it.status == BookingStatus.CONFIRMED.name }
                            val isFull = confirmedCount >= session.capacity
                            StatusPill(
                                text = "$confirmedCount/${session.capacity}",
                                textColor = if (isFull) DangerRed else NewShapeGoldBright,
                                containerColor = if (isFull) DangerRedContainer else NewShapeGoldMuted
                            )
                            IconButton(onClick = { sessionToEdit = session }) {
                                Icon(Icons.Default.Edit, contentDescription = "Editar treino", tint = TextSecondaryDark)
                            }
                            IconButton(onClick = { sessionToDelete = session }) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar treino", tint = DangerRed)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showNewSessionDialog && activeWeek != null) {
        NewSessionDialog(
            onDismiss = { showNewSessionDialog = false },
            onCreate = { days, h, m, dur, cap, note ->
                viewModel.createSessions(activeWeek, days, h, m, dur, cap, note)
                showNewSessionDialog = false
            }
        )
    }

    selectedSessionDetail?.let { session ->
        val freshSession = state.sessions.find { it.id == session.id } ?: session
        SessionDetailDialog(
            session = freshSession,
            bookings = state.bookings.filter { it.sessionId == freshSession.id && it.status != BookingStatus.CANCELLED.name },
            clients = state.clients,
            onDismiss = { selectedSessionDetail = null },
            onAddClient = { clientId ->
                viewModel.addManualClientToSession(freshSession.id, freshSession.weekKey, clientId)
            },
            onRemoveBooking = { bookingId -> viewModel.removeBooking(bookingId) },
            onEdit = {
                selectedSessionDetail = null
                sessionToEdit = freshSession
            }
        )
    }

    sessionToEdit?.let { session ->
        EditSessionDialog(
            session = session,
            onDismiss = { sessionToEdit = null },
            onSave = { updated ->
                viewModel.updateSession(updated)
                sessionToEdit = null
            }
        )
    }

    sessionToDelete?.let { session ->
        AlertDialog(
            onDismissRequest = { sessionToDelete = null },
            containerColor = CharcoalSurface,
            title = { Text("Apagar treino?", color = TextPrimaryDark) },
            text = {
                Text(
                    "Isto vai apagar \"${session.dateLabel} às ${session.timeLabel}\" e todas as reservas associadas.",
                    color = TextSecondaryDark
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteSession(session.id)
                        sessionToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) { Text("Apagar") }
            },
            dismissButton = {
                TextButton(onClick = { sessionToDelete = null }) { Text("Cancelar", color = TextSecondaryDark) }
            }
        )
    }
}

@Composable
private fun NewSessionDialog(
    onDismiss: () -> Unit,
    onCreate: (Set<Int>, Int, Int, Int, Int, String) -> Unit
) {
    var selectedDays by remember { mutableStateOf(setOf(1, 3)) }
    var hourText by remember { mutableStateOf("18") }
    var minuteText by remember { mutableStateOf("00") }
    var duration by remember { mutableIntStateOf(60) }
    var capacityText by remember { mutableStateOf("6") }
    var note by remember { mutableStateOf("") }

    val dayLabels = listOf(1 to "Seg", 2 to "Ter", 3 to "Qua", 4 to "Qui", 5 to "Sex", 6 to "Sáb", 7 to "Dom")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Novo treino", color = TextPrimaryDark) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Dias (podes escolher vários)", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Spacer(Modifier.height(8.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    dayLabels.forEach { (dayInt, label) ->
                        val active = dayInt in selectedDays
                        Surface(
                            color = if (active) NewShapeGold else ElevatedCharcoal,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, if (active) NewShapeGold else HairlineBorder),
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    selectedDays = if (active) selectedDays - dayInt else selectedDays + dayInt
                                }
                        ) {
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(vertical = 10.dp)) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (active) TextOnGold else TextPrimaryDark
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = hourText,
                        onValueChange = { hourText = it.filter { c -> c.isDigit() }.take(2) },
                        label = { Text("Hora") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = minuteText,
                        onValueChange = { minuteText = it.filter { c -> c.isDigit() }.take(2) },
                        label = { Text("Min") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = capacityText,
                        onValueChange = { capacityText = it.filter { c -> c.isDigit() }.take(2) },
                        label = { Text("Vagas") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text("Duração", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(45, 60, 75, 90).forEach { dur ->
                        FilterChip(
                            selected = duration == dur,
                            onClick = { duration = dur },
                            label = { Text("${dur}m") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Nota (opcional, ex: ao ar livre)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Criar treino",
                enabled = selectedDays.isNotEmpty(),
                onClick = {
                    val h = (hourText.toIntOrNull() ?: 18).coerceIn(0, 23)
                    val m = (minuteText.toIntOrNull() ?: 0).coerceIn(0, 59)
                    val cap = (capacityText.toIntOrNull() ?: 6).coerceIn(1, 50)
                    onCreate(selectedDays, h, m, duration, cap, note)
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun EditSessionDialog(
    session: TrainingSessionRecord,
    onDismiss: () -> Unit,
    onSave: (TrainingSessionRecord) -> Unit
) {
    var timeLabel by remember { mutableStateOf(session.timeLabel) }
    var capacityText by remember { mutableStateOf(session.capacity.toString()) }
    var durationText by remember { mutableStateOf(session.durationMinutes.toString()) }
    var note by remember { mutableStateOf(session.note) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Editar treino", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(session.dateLabel, style = MaterialTheme.typography.titleSmall, color = NewShapeGold)
                OutlinedTextField(
                    value = timeLabel,
                    onValueChange = { timeLabel = it },
                    label = { Text("Hora (HH:mm)") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = durationText,
                        onValueChange = { durationText = it.filter { c -> c.isDigit() } },
                        label = { Text("Duração (min)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = capacityText,
                        onValueChange = { capacityText = it.filter { c -> c.isDigit() } },
                        label = { Text("Vagas") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Nota opcional") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar",
                onClick = {
                    onSave(
                        session.copy(
                            timeLabel = timeLabel.ifBlank { session.timeLabel },
                            durationMinutes = durationText.toIntOrNull()?.coerceIn(15, 180) ?: session.durationMinutes,
                            capacity = capacityText.toIntOrNull()?.coerceIn(1, 50) ?: session.capacity,
                            note = note.trim()
                        )
                    )
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionDetailDialog(
    session: TrainingSessionRecord,
    bookings: List<BookingRecord>,
    clients: List<ClientRecord>,
    onDismiss: () -> Unit,
    onAddClient: (String) -> Unit,
    onRemoveBooking: (String) -> Unit,
    onEdit: () -> Unit
) {
    val clientMap = clients.associateBy { it.id }
    val enrolledIds = bookings.map { it.clientId }.toSet()
    val availableClients = clients.filter { it.active && it.id !in enrolledIds }
    var selectedAddClient by remember { mutableStateOf(availableClients.firstOrNull()) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            val confirmedCount = bookings.count { it.status == BookingStatus.CONFIRMED.name }
            Column {
                Text("${session.dateLabel} · ${session.timeLabel.replace(":", "h")}", color = TextPrimaryDark)
                Text(
                    "$confirmedCount/${session.capacity} vagas preenchidas (${bookings.size} pedidos) · ${session.durationMinutes} min",
                    style = MaterialTheme.typography.bodySmall,
                    color = NewShapeGold
                )
            }
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Inscritos", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Spacer(Modifier.height(8.dp))
                if (bookings.isEmpty()) {
                    Text("Ainda não há inscritos neste treino.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                } else {
                    bookings.forEach { b ->
                        val c = clientMap[b.clientId]
                        if (c != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(c.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                    Text(c.phone, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                                }
                                val confirmed = b.status == BookingStatus.CONFIRMED.name
                                StatusPill(
                                    text = if (confirmed) "Confirmado" else "Pendente",
                                    textColor = if (confirmed) ConfirmedGreen else PendingAmber,
                                    containerColor = if (confirmed) ConfirmedGreenContainer else PendingAmberContainer
                                )
                                TextButton(onClick = { onRemoveBooking(b.id) }) {
                                    Text("Remover", color = DangerRed, style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }

                if (availableClients.isNotEmpty()) {
                    Spacer(Modifier.height(14.dp))
                    HorizontalDivider(color = HairlineBorder)
                    Spacer(Modifier.height(12.dp))
                    Text("Adicionar cliente à mão", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                    Spacer(Modifier.height(6.dp))
                    ExposedDropdownMenuBox(
                        expanded = dropdownExpanded,
                        onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                    ) {
                        OutlinedTextField(
                            value = selectedAddClient?.name ?: "Escolhe...",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = darkFieldColors()
                        )
                        ExposedDropdownMenu(
                            expanded = dropdownExpanded,
                            onDismissRequest = { dropdownExpanded = false }
                        ) {
                            availableClients.forEach { client ->
                                DropdownMenuItem(
                                    text = { Text(client.name) },
                                    onClick = {
                                        selectedAddClient = client
                                        dropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    GoldPrimaryButton(
                        text = "Adicionar (Confirmado)",
                        onClick = { selectedAddClient?.let { onAddClient(it.id) } },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onEdit) { Text("Editar treino", color = NewShapeGold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Fechar", color = TextSecondaryDark) }
        }
    )
}

@Composable
fun RespostasSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val activeWeek = state.activeWeek

    val activeClients = state.clients.filter { it.active }
    val bookedIds = if (activeWeek != null) {
        state.bookings.filter { it.weekKey == activeWeek.weekKey && it.status != BookingStatus.CANCELLED.name }
            .map { it.clientId }.toSet()
    } else emptySet()
    val unavailableIds = if (activeWeek != null) {
        state.weekResponses.filter { it.weekKey == activeWeek.weekKey && it.status == "UNAVAILABLE" }
            .map { it.clientId }.toSet()
    } else emptySet()
    val remindedIds = if (activeWeek != null) {
        state.weekResponses.filter { it.weekKey == activeWeek.weekKey && it.status == "REMINDED" }
            .map { it.clientId }.toSet()
    } else emptySet()

    val missingClients = activeClients.filter { it.id !in bookedIds && it.id !in unavailableIds }
    val unavailableClients = activeClients.filter { it.id in unavailableIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(onClick = { viewModel.shiftWeek(-1) }) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Anterior", tint = NewShapeGold)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Ainda não responderam", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                        Text(activeWeek?.label ?: "", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                    }
                    IconButton(onClick = { viewModel.shiftWeek(1) }) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Seguinte", tint = NewShapeGold)
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "${missingClients.size} clientes ativos ainda não responderam. Envia um lembrete de cada vez.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
        }

        if (missingClients.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.MarkChatRead,
                    title = "Todos responderam!",
                    subtitle = "Todos os clientes ativos já marcaram ou avisaram esta semana."
                )
            }
        } else {
            items(missingClients, key = { it.id }) { client ->
                val isReminded = client.id in remindedIds
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(client.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                            Text(client.phone, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                        }
                        if (isReminded) {
                            StatusPill("Enviado ✓", ConfirmedGreen, ConfirmedGreenContainer)
                        } else if (activeWeek != null) {
                            DarkSecondaryButton(
                                text = "Lembrete",
                                onClick = {
                                    val msg = viewModel.buildMessage("LEMBRETE", client.name, week = activeWeek)
                                    viewModel.markClientReminded(activeWeek.weekKey, client.id)
                                    openWhatsApp(context, client.phone, msg, state.settings.whatsappWebMode)
                                }
                            )
                        }
                    }
                }
            }
        }

        if (unavailableClients.isNotEmpty()) {
            item {
                Spacer(Modifier.height(8.dp))
                Text("Disseram \"Esta semana não posso\" (${unavailableClients.size})", style = MaterialTheme.typography.titleSmall, color = TextSecondaryDark)
            }
            items(unavailableClients, key = { "unavail_${it.id}" }) { client ->
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.small,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(client.name, style = MaterialTheme.typography.bodyMedium, color = TextPrimaryDark)
                        StatusPill("Não pode", TextSecondaryDark, ElevatedCharcoal)
                    }
                }
            }
        }
    }
}

@Composable
fun MensagensSettingsSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    var clientsCanEdit by remember(state.settings) { mutableStateOf(state.settings.clientsCanEdit) }
    var cutoffMinutesText by remember(state.settings) { mutableStateOf(state.settings.effectiveCutoffMinutes().toString()) }
    var whatsappWeb by remember(state.settings) { mutableStateOf(state.settings.whatsappWebMode) }
    var siteBaseUrl by remember(state.settings) { mutableStateOf(state.settings.siteBaseUrl) }

    val cleanBaseUrl = state.settings.siteBaseUrl.trimEnd('/').ifBlank { "https://newshape.vercel.app" }
    val ptLink = "$cleanBaseUrl/painel"
    val studentLink = remember(state.settings, state.currentUserId) {
        val ptUid = state.settings.userId.ifBlank { state.currentUserId }
        val code = state.settings.studentPortalCode
        if (ptUid.isNotBlank() && code.isNotBlank()) "$cleanBaseUrl/aluno?pt=$ptUid&code=$code"
        else if (ptUid.isNotBlank()) "$cleanBaseUrl/aluno?pt=$ptUid"
        else "$cleanBaseUrl/aluno"
    }
    val studentInviteText = "Olá! 💪 Já podes aceder ao teu Portal de Aluno New Shape (marcações, treinos, nutrição e avaliações) através deste link:\n$studentLink\n\nEntras apenas com o teu número de telemóvel!"

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard(highlightBorder = true) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        "Links de Acesso (PT e Aluno)",
                        style = MaterialTheme.typography.titleMedium,
                        color = NewShapeGoldBright,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = { viewModel.regenerateStudentPortalCode() }) {
                        Text("Renovar código", color = TextSecondaryDark, style = MaterialTheme.typography.labelSmall)
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text("Link do PT (Painel Web)", style = MaterialTheme.typography.labelMedium, color = TextPrimaryDark)
                Text(ptLink, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                Spacer(Modifier.height(6.dp))
                DarkSecondaryButton(
                    text = "Copiar Link do PT",
                    onClick = { copyToClipboard(context, ptLink, "Link do PT copiado!") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(12.dp))
                Text("Link do Aluno (só telemóvel)", style = MaterialTheme.typography.labelMedium, color = NewShapeGoldBright)
                Text(studentLink, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DarkSecondaryButton(
                        text = "Copiar Aluno",
                        onClick = { copyToClipboard(context, studentLink, "Link do Aluno copiado!") },
                        modifier = Modifier.weight(1f)
                    )
                    GoldPrimaryButton(
                        text = "WhatsApp",
                        onClick = { openWhatsApp(context, null, studentInviteText, state.settings.whatsappWebMode) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        item {
            Text("Mensagens WhatsApp", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text(
                "Edita os textos enviados aos clientes. Usa {nome}, {treinos}, {link} e {semana}.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryDark
            )
        }

        items(state.messageTemplates, key = { it.templateKey }) { template ->
            var bodyText by remember(template.body) { mutableStateOf(template.body) }
            BrandCard {
                Text(template.title, style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                Text(template.description, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = bodyText,
                    onValueChange = { bodyText = it },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("{nome}", "{treinos}", "{link}", "{semana}").forEach { tag ->
                        AssistChip(
                            onClick = { bodyText += " $tag" },
                            label = { Text(tag, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text("Pré-visualização", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                ) {
                    val ptUid = state.settings.userId.ifBlank { state.currentUserId }
                    val previewLink = if (ptUid.isNotBlank() && state.settings.studentPortalCode.isNotBlank()) {
                        "$cleanBaseUrl/s/2026-w47?pt=$ptUid&code=${state.settings.studentPortalCode}"
                    } else {
                        "$cleanBaseUrl/s/2026-w47"
                    }
                    val samplePreview = bodyText
                        .replace("{nome}", "Ana")
                        .replace("{treinos}", "• Segunda, 16 Nov – 18h00\n• Quarta, 18 Nov – 19h00")
                        .replace("{link}", previewLink)
                        .replace("{semana}", state.activeWeek?.label ?: "16–22 Nov")
                    Text(samplePreview, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark, modifier = Modifier.padding(10.dp))
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { viewModel.resetTemplate(template) }) {
                        Text("Repor original", color = TextSecondaryDark)
                    }
                    Spacer(Modifier.weight(1f))
                    GoldPrimaryButton(
                        text = "Guardar",
                        onClick = { viewModel.saveTemplate(template.copy(body = bodyText)) }
                    )
                }
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text("Definições", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
        }

        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Clientes podem alterar o pedido", style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                        Text(
                            "Mesmo depois de confirmado. A alteração volta à fila como \"Alterado\".",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                    Switch(
                        checked = clientsCanEdit,
                        onCheckedChange = { clientsCanEdit = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = TextOnGold, checkedTrackColor = NewShapeGold)
                    )
                }
                Spacer(Modifier.height(12.dp))
                val parsedCutoffMins = (cutoffMinutesText.toIntOrNull() ?: 15).coerceIn(0, 4320)
                val previewLabel = when {
                    parsedCutoffMins <= 0 -> "sem limite"
                    parsedCutoffMins >= 60 && parsedCutoffMins % 60 == 0 -> "${parsedCutoffMins / 60}h"
                    else -> "$parsedCutoffMins min"
                }
                OutlinedTextField(
                    value = cutoffMinutesText,
                    onValueChange = { cutoffMinutesText = it.filter { c -> c.isDigit() }.take(4) },
                    label = { Text("Antecedência mínima antes do treino (minutos)") },
                    supportingText = {
                        Text(
                            "Atual: $previewLabel antes do treino",
                            color = NewShapeGoldBright
                        )
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("cutoff_minutes_input"),
                    colors = darkFieldColors()
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        15 to "15 min",
                        30 to "30 min",
                        60 to "1h",
                        120 to "2h",
                        720 to "12h",
                        0 to "Sem limite"
                    ).forEach { (mins, label) ->
                        FilterChip(
                            selected = parsedCutoffMins == mins,
                            onClick = { cutoffMinutesText = mins.toString() },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Usar web.whatsapp.com", style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                        Text("Útil se usares no computador e a app não abrir.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    }
                    Switch(
                        checked = whatsappWeb,
                        onCheckedChange = { whatsappWeb = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = TextOnGold, checkedTrackColor = NewShapeGold)
                    )
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = siteBaseUrl,
                    onValueChange = { siteBaseUrl = it },
                    label = { Text("Endereço do site nos links") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
                Spacer(Modifier.height(16.dp))
                GoldPrimaryButton(
                    text = "Guardar definições",
                    onClick = {
                        val mins = (cutoffMinutesText.toIntOrNull() ?: 15).coerceIn(0, 4320)
                        viewModel.saveSettings(
                            state.settings.copy(
                                clientsCanEdit = clientsCanEdit,
                                cutoffHours = mins / 60,
                                cutoffMinutes = mins,
                                whatsappWebMode = whatsappWeb,
                                siteBaseUrl = siteBaseUrl.trim().ifBlank { "https://newshape.vercel.app" },
                                seeded = true
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
