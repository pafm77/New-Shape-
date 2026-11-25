package com.example.ui.screens

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.ReportExporter
import com.example.data.SeedCatalog
import com.example.data.model.BookingStatus
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.data.model.PaymentRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar
import java.util.TimeZone

private data class ClientUpcomingBookingInfo(
    val confirmed: Int,
    val pending: Int,
    val nextLabel: String
)

@Composable
fun PtClientsTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onJumpToWorkout: () -> Unit,
    onJumpToNutrition: () -> Unit,
    onJumpToChat: (String) -> Unit
) {
    var selectedClientId by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var showInactive by remember { mutableStateOf(false) }
    var typeFilter by remember { mutableStateOf("ALL") }
    var fidelizacaoFilter by remember { mutableStateOf("ALL") }
    var fixedOnlyFilter by remember { mutableStateOf(false) }
    var showNewClientDialog by remember { mutableStateOf(false) }
    var showImportDialog by remember { mutableStateOf(false) }
    var paymentTargetClient by remember { mutableStateOf<ClientRecord?>(null) }
    var deleteTargetClient by remember { mutableStateOf<ClientRecord?>(null) }

    val selectedClient = selectedClientId?.let { id -> state.clients.find { it.id == id } }
    if (selectedClient != null) {
        PtClientProfileScreen(
            client = selectedClient,
            state = state,
            viewModel = viewModel,
            onBack = { selectedClientId = null },
            onJumpToWorkout = onJumpToWorkout,
            onJumpToNutrition = onJumpToNutrition,
            onJumpToChat = { onJumpToChat(selectedClient.id) }
        )
        return
    }

    val baseVisibleClients = remember(state.clients, showInactive) {
        state.clients.filter { showInactive || it.active }
    }
    val clientFidMonthsMap = remember(state.clients, state.fidelizacoes) {
        state.clients.associate { client ->
            val eff = SeedCatalog.getEffectiveClientFidelizacaoMonths(client, state.fidelizacoes)
            client.id to if (eff == 6 || eff == 12) eff else 0
        }
    }
    val clientUpcomingBookingsMap = remember(state.bookings, state.sessions) {
        val startOfToday = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val sessionById = state.sessions.associateBy { it.id }
        val grouped = mutableMapOf<String, MutableList<Pair<com.example.data.model.BookingRecord, com.example.data.model.TrainingSessionRecord>>>()
        state.bookings.forEach { b ->
            if (b.status == BookingStatus.CANCELLED.name) return@forEach
            val s = sessionById[b.sessionId] ?: return@forEach
            if (s.startMillis < startOfToday) return@forEach
            grouped.getOrPut(b.clientId) { mutableListOf() }.add(b to s)
        }
        grouped.mapValues { (_, list) ->
            val sorted = list.sortedWith(compareBy<Pair<com.example.data.model.BookingRecord, com.example.data.model.TrainingSessionRecord>> { it.second.startMillis }.thenBy { it.second.timeLabel })
            val confirmed = sorted.count { it.first.status == BookingStatus.CONFIRMED.name }
            val pending = sorted.count { it.first.status != BookingStatus.CONFIRMED.name }
            val next = sorted.firstOrNull()?.second
            val nextLabel = if (next != null) "${next.dateLabel} · ${next.timeLabel}" else ""
            ClientUpcomingBookingInfo(confirmed = confirmed, pending = pending, nextLabel = nextLabel)
        }
    }
    val personalizadoCount = remember(baseVisibleClients) {
        baseVisibleClients.count { it.trainingType == "PERSONALIZADO" }
    }
    val grupoCount = remember(baseVisibleClients) {
        baseVisibleClients.count { it.trainingType != "PERSONALIZADO" }
    }
    val fid6Count = remember(baseVisibleClients, clientFidMonthsMap) {
        baseVisibleClients.count { clientFidMonthsMap[it.id] == 6 }
    }
    val fid12Count = remember(baseVisibleClients, clientFidMonthsMap) {
        baseVisibleClients.count { clientFidMonthsMap[it.id] == 12 }
    }
    val fixedClientsCount = remember(baseVisibleClients) {
        baseVisibleClients.count { it.fixedSlots.isNotEmpty() }
    }
    val fidAnyCount = fid6Count + fid12Count
    val noFidCount = baseVisibleClients.size - fidAnyCount

    val filteredClients = remember(baseVisibleClients, searchQuery, typeFilter, fidelizacaoFilter, fixedOnlyFilter, clientFidMonthsMap) {
        baseVisibleClients.filter { client ->
            val isPersonal = client.trainingType == "PERSONALIZADO"
            val matchesType = when (typeFilter) {
                "PERSONALIZADO" -> isPersonal
                "GRUPO" -> !isPersonal
                else -> true
            }
            val matchesFixed = !fixedOnlyFilter || client.fixedSlots.isNotEmpty()
            val effFid = clientFidMonthsMap[client.id] ?: 0
            val matchesFid = when (fidelizacaoFilter) {
                "ANY_FID" -> effFid == 6 || effFid == 12
                "6" -> effFid == 6
                "12" -> effFid == 12
                "NONE" -> effFid != 6 && effFid != 12
                else -> true
            }
            matchesType &&
                matchesFixed &&
                matchesFid &&
                (searchQuery.isBlank() ||
                    client.name.contains(searchQuery, ignoreCase = true) ||
                    client.phone.contains(searchQuery))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Alunos", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                    Text(
                        text = "${state.clients.count { it.active }} ativos · ${state.clients.size} total",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
                GoldPrimaryButton(
                    text = "+ Novo Cliente",
                    onClick = { showNewClientDialog = true },
                    testTag = "add_client_button"
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Procurar nome ou telemóvel...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondaryDark) },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    colors = darkFieldColors()
                )
                DarkSecondaryButton(
                    text = "Importar",
                    icon = Icons.Default.UploadFile,
                    onClick = { showImportDialog = true }
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                ) {
                    listOf(
                        "ALL" to "Todos (${baseVisibleClients.size})",
                        "PERSONALIZADO" to "Personalizado ($personalizadoCount)",
                        "GRUPO" to "Grupo ($grupoCount)"
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = typeFilter == key,
                            onClick = { typeFilter = key },
                            label = { Text(label, maxLines = 1) },
                            modifier = Modifier.testTag("clients_filter_$key"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                    FilterChip(
                        selected = fixedOnlyFilter,
                        onClick = { fixedOnlyFilter = !fixedOnlyFilter },
                        label = { Text("Dias fixos ($fixedClientsCount)", maxLines = 1) },
                        modifier = Modifier.testTag("clients_filter_fixed"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                ) {
                    Text(
                        text = "Fidelização:",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                    listOf(
                        "ALL" to "Todas",
                        "ANY_FID" to "6 ou 12m ($fidAnyCount)",
                        "6" to "6 Meses ($fid6Count)",
                        "12" to "12 Meses ($fid12Count)",
                        "NONE" to "Sem fidel. ($noFidCount)"
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = fidelizacaoFilter == key,
                            onClick = { fidelizacaoFilter = key },
                            label = { Text(label, maxLines = 1) },
                            modifier = Modifier.testTag("clients_fid_filter_$key"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (state.isSuperAdmin) {
                    Text(
                        text = "Mensalidade atual: ${state.currentMonthLabel}",
                        style = MaterialTheme.typography.labelMedium,
                        color = NewShapeGold
                    )
                } else {
                    Spacer(Modifier.width(1.dp))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Mostrar inativos", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    Spacer(Modifier.width(8.dp))
                    Switch(
                        checked = showInactive,
                        onCheckedChange = { showInactive = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = TextOnGold, checkedTrackColor = NewShapeGold)
                    )
                }
            }
        }

        if (filteredClients.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.PeopleOutline,
                    title = "Nenhum aluno encontrado",
                    subtitle = "Adiciona um novo cliente ou importa uma lista CSV."
                )
            }
        } else {
            items(filteredClients, key = { it.id }) { client ->
                val monthPayment = state.payments.find {
                    it.clientId == client.id &&
                        it.monthYear == state.currentMonthYear &&
                        it.paid &&
                        !SeedCatalog.isExtraFeePayment(it.note)
                }
                val isPaidThisMonth = monthPayment != null

                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(MaterialTheme.shapes.medium)
                        .clickable { selectedClientId = client.id }
                        .testTag("client_card_${client.id}")
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(client.name, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                                    val isPersonal = client.trainingType == "PERSONALIZADO"
                                    StatusPill(
                                        text = if (isPersonal) "Personalizado" else "Grupo",
                                        textColor = if (isPersonal) NewShapeGoldBright else InfoBlue,
                                        containerColor = if (isPersonal) NewShapeGoldMuted else InfoBlueContainer
                                    )
                                    if (client.newClient) {
                                        StatusPill("Novo", InfoBlue, InfoBlueContainer)
                                    }
                                    if (!client.active) {
                                        StatusPill("Inativo", TextSecondaryDark, ElevatedCharcoal)
                                    }
                                }
                                val upcomingInfo = clientUpcomingBookingsMap[client.id]
                                val phoneDisplay = client.phone.ifBlank { "Sem telemóvel" }
                                val nextSuffix = if (!upcomingInfo?.nextLabel.isNullOrBlank()) " · Próx.: ${upcomingInfo!!.nextLabel}" else ""
                                Text(
                                    text = "$phoneDisplay$nextSuffix",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                                Spacer(Modifier.height(4.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    when {
                                        (upcomingInfo?.confirmed ?: 0) > 0 -> {
                                            StatusPill(
                                                text = "✓ ${upcomingInfo!!.confirmed} marcado(s)",
                                                textColor = ConfirmedGreen,
                                                containerColor = ConfirmedGreenContainer
                                            )
                                        }
                                        (upcomingInfo?.pending ?: 0) > 0 -> {
                                            StatusPill(
                                                text = "${upcomingInfo!!.pending} por confirmar",
                                                textColor = PendingAmber,
                                                containerColor = PendingAmberContainer
                                            )
                                        }
                                        else -> {
                                            StatusPill(
                                                text = "Por marcar",
                                                textColor = TextSecondaryDark,
                                                containerColor = ElevatedCharcoal
                                            )
                                        }
                                    }
                                    if ((upcomingInfo?.confirmed ?: 0) > 0 && (upcomingInfo?.pending ?: 0) > 0) {
                                        StatusPill(
                                            text = "+${upcomingInfo!!.pending} pendente",
                                            textColor = PendingAmber,
                                            containerColor = PendingAmberContainer
                                        )
                                    }
                                }
                                if (client.fixedSlots.isNotEmpty()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        text = "Fixo: ${SeedCatalog.formatFixedSlotsSummary(client.fixedSlots)}",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = NewShapeGoldBright
                                    )
                                }
                                val effectiveFid = clientFidMonthsMap[client.id] ?: 0
                                if ((state.isSuperAdmin && client.monthlyFeeEur > 0.0) || effectiveFid > 0 || client.weeklySessionLimit > 0) {
                                    Spacer(Modifier.height(4.dp))
                                    val feeStr = if (state.isSuperAdmin && client.monthlyFeeEur > 0.0) "€${String.format("%.0f", client.monthlyFeeEur)}/mês" else ""
                                    val fidStr = if (effectiveFid > 0) "Fidelização ${effectiveFid}m" else ""
                                    val limitStr = if (client.weeklySessionLimit > 0) "${client.weeklySessionLimit}x/sem" else ""
                                    val info = listOf(feeStr, fidStr, limitStr).filter { it.isNotBlank() }.joinToString(" · ")
                                    Text(info, style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                                }
                            }
                            if (state.isSuperAdmin) {
                                if (isPaidThisMonth) {
                                    StatusPill(
                                        text = "Pago €${String.format("%.0f", monthPayment.amountEur)}",
                                        textColor = ConfirmedGreen,
                                        containerColor = ConfirmedGreenContainer
                                    )
                                } else {
                                    StatusPill(
                                        text = "Por pagar",
                                        textColor = PendingAmber,
                                        containerColor = PendingAmberContainer
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = if (state.isSuperAdmin) Arrangement.SpaceBetween else Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (state.isSuperAdmin) {
                                TextButton(
                                    onClick = { paymentTargetClient = client },
                                    modifier = Modifier.testTag("quick_pay_${client.id}")
                                ) {
                                    Icon(Icons.Default.Payments, contentDescription = null, tint = NewShapeGold, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = if (isPaidThisMonth) "Registar outro pagamento" else "Apontar pagamento",
                                        color = NewShapeGold,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (state.isSuperAdmin) {
                                    TextButton(
                                        onClick = { deleteTargetClient = client },
                                        modifier = Modifier.testTag("delete_client_${client.id}")
                                    ) {
                                        Icon(Icons.Default.DeleteOutline, contentDescription = "Eliminar conta", tint = DangerRed, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Eliminar", color = DangerRed, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Text("Ver perfil →", style = MaterialTheme.typography.labelLarge, color = TextSecondaryDark)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showNewClientDialog) {
        NewClientDialog(
            onDismiss = { showNewClientDialog = false },
            onSave = { name, phone, notes, trainingType, weeklyLimit ->
                viewModel.addClient(name, phone, notes, trainingType, weeklyLimit)
                showNewClientDialog = false
            }
        )
    }

    if (showImportDialog) {
        ImportClientsDialog(
            onDismiss = { showImportDialog = false },
            onImport = { raw, onDone ->
                viewModel.importClientsCsv(raw, onDone)
            }
        )
    }

    if (state.isSuperAdmin) {
        paymentTargetClient?.let { client ->
            RegisterPaymentDialog(
                clientName = client.name,
                defaultMonthYear = state.currentMonthYear,
                defaultMonthLabel = state.currentMonthLabel,
                defaultAmountEur = if (client.monthlyFeeEur > 0.0) client.monthlyFeeEur else 120.0,
                defaultDurationMonths = SeedCatalog.getEffectiveClientFidelizacaoMonths(client, state.fidelizacoes),
                onDismiss = { paymentTargetClient = null },
                onConfirm = { monthYear, monthLabel, amount, method, durationMonths, seguroEur, joiaEur ->
                    viewModel.recordPayment(
                        clientId = client.id,
                        monthYear = monthYear,
                        monthLabel = monthLabel,
                        amountEur = amount,
                        note = method,
                        durationMonths = durationMonths,
                        seguroEur = seguroEur,
                        joiaEur = joiaEur
                    )
                    paymentTargetClient = null
                }
            )
        }
        deleteTargetClient?.let { target ->
            DeleteClientConfirmDialog(
                client = target,
                onDismiss = { deleteTargetClient = null },
                onConfirm = {
                    viewModel.deleteClientAccount(target) { ok ->
                        if (ok) {
                            if (selectedClientId == target.id) selectedClientId = null
                            deleteTargetClient = null
                        }
                    }
                }
            )
        }
    }
}

@Composable
fun PtClientProfileScreen(
    client: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onBack: () -> Unit,
    onJumpToWorkout: () -> Unit,
    onJumpToNutrition: () -> Unit,
    onJumpToChat: () -> Unit
) {
    BackHandler(onBack = onBack)
    val context = LocalContext.current

    var name by remember(client.id) { mutableStateOf(client.name) }
    var phone by remember(client.id) { mutableStateOf(client.phone) }
    var notes by remember(client.id) { mutableStateOf(client.notes) }
    var trainingType by remember(client.id, client.trainingType) {
        mutableStateOf(if (client.trainingType == "PERSONALIZADO") "PERSONALIZADO" else "GRUPO")
    }
    var weeklySessionLimit by remember(client.id, client.weeklySessionLimit) {
        mutableIntStateOf(client.weeklySessionLimit.coerceIn(0, 21))
    }
    var monthlyFeeText by remember(client.id, client.monthlyFeeEur) {
        mutableStateOf(
            if (client.monthlyFeeEur > 0.0) {
                if (client.monthlyFeeEur % 1.0 == 0.0) client.monthlyFeeEur.toInt().toString()
                else String.format("%.2f", client.monthlyFeeEur)
            } else ""
        )
    }
    var fidelizacaoMonths by remember(client.id, client.fidelizacaoMonths) { mutableIntStateOf(client.fidelizacaoMonths) }
    var fidelizacaoStartMillis by remember(client.id, client.fidelizacaoStartMillis) {
        mutableLongStateOf(
            if (client.fidelizacaoStartMillis > 0L) client.fidelizacaoStartMillis else System.currentTimeMillis()
        )
    }
    var fixedSlotsDraft by remember(client.id, client.fixedSlots) {
        mutableStateOf(SeedCatalog.normalizeFixedSlots(client.fixedSlots))
    }
    var newFixedDay by remember { mutableIntStateOf(1) }
    var newFixedHour by remember { mutableStateOf("09") }
    var newFixedMinute by remember { mutableStateOf("00") }
    var profileTab by remember(client.id) { mutableIntStateOf(0) }
    var showPayDialog by remember { mutableStateOf(false) }
    var splitTargetPayment by remember { mutableStateOf<PaymentRecord?>(null) }
    var editingFid by remember { mutableStateOf<FidelizacaoRecord?>(null) }
    var showNewFidDialog by remember { mutableStateOf(false) }

    val clientPayments = remember(state.payments, client.id) {
        state.payments.filter { it.clientId == client.id }
    }
    val clientFids = remember(state.fidelizacoes, client.id) {
        state.fidelizacoes.filter { it.clientId == client.id }
    }
    val currentMonthPayment = clientPayments.find {
        it.monthYear == state.currentMonthYear && it.paid && !SeedCatalog.isExtraFeePayment(it.note)
    }

    val sessionMap = remember(state.sessions) { state.sessions.associateBy { it.id } }
    val confirmedBookings = remember(state.bookings, sessionMap, client.id) {
        state.bookings
            .filter { it.clientId == client.id && it.status == BookingStatus.CONFIRMED.name }
            .mapNotNull { b -> sessionMap[b.sessionId]?.let { s -> b to s } }
            .sortedByDescending { it.second.startMillis }
    }
    val upcomingBookings = remember(state.bookings, sessionMap, client.id) {
        val startOfToday = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        state.bookings
            .filter { it.clientId == client.id && it.status != BookingStatus.CANCELLED.name }
            .mapNotNull { b -> sessionMap[b.sessionId]?.let { s -> b to s } }
            .filter { (_, s) -> s.startMillis >= startOfToday }
            .sortedWith(compareBy<Pair<com.example.data.model.BookingRecord, com.example.data.model.TrainingSessionRecord>> { it.second.startMillis }.thenBy { it.second.timeLabel })
    }
    val presentCount = confirmedBookings.count { it.first.attendanceStatus == "PRESENT" }
    val absentCount = confirmedBookings.count { it.first.attendanceStatus == "ABSENT" }
    val markedCount = presentCount + absentCount
    val pendingCount = confirmedBookings.size - markedCount
    val donePct = if (markedCount > 0) (presentCount * 100.0 / markedCount) else 0.0
    val absentPct = if (markedCount > 0) (absentCount * 100.0 / markedCount) else 0.0
    var showResetPinConfirm by remember { mutableStateOf(false) }
    var showDeleteClientConfirm by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Header + Profile Tabs
        Surface(color = CharcoalSurface) {
            Column {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("client_profile_back")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar aos alunos", tint = NewShapeGold)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(client.name, style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                            val isPersonal = client.trainingType == "PERSONALIZADO"
                            StatusPill(
                                text = if (isPersonal) "Personalizado" else "Grupo",
                                textColor = if (isPersonal) NewShapeGoldBright else InfoBlue,
                                containerColor = if (isPersonal) NewShapeGoldMuted else InfoBlueContainer
                            )
                            if (client.notes.contains("rgpd aceite", ignoreCase = true)) {
                                StatusPill("RGPD ✓", ConfirmedGreen, ConfirmedGreenContainer)
                            }
                            if (client.loginPinHash.isNotBlank()) {
                                StatusPill("PIN 🔒", NewShapeGoldBright, NewShapeGoldMuted)
                            }
                        }
                        Text(
                            text = if (client.active) "Aluno ativo" else "Aluno inativo",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (client.active) ConfirmedGreen else TextSecondaryDark
                        )
                    }
                    if (client.loginPinHash.isNotBlank()) {
                        TextButton(
                            onClick = { showResetPinConfirm = true },
                            modifier = Modifier.testTag("pt_reset_client_pin_btn")
                        ) {
                            Text("Repor PIN", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                    TextButton(onClick = { viewModel.setClientActive(client, !client.active) }) {
                        Text(
                            text = if (client.active) "Desativar" else "Reativar",
                            color = if (client.active) DangerRed else ConfirmedGreen
                        )
                    }
                }
                if (showResetPinConfirm) {
                    AlertDialog(
                        onDismissRequest = { showResetPinConfirm = false },
                        containerColor = CharcoalSurface,
                        title = { Text("Repor PIN do aluno?", color = TextPrimaryDark, fontWeight = FontWeight.Bold) },
                        text = {
                            Text(
                                "O PIN de 4 dígitos de ${client.name} será removido. O aluno poderá entrar só com o telemóvel e definir um novo PIN.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        },
                        confirmButton = {
                            GoldPrimaryButton(
                                text = "Repor PIN",
                                onClick = {
                                    showResetPinConfirm = false
                                    viewModel.updateClientPinHash(
                                        clientId = client.id,
                                        loginPinHash = "",
                                        successMessage = "PIN reposto! O aluno pode entrar sem PIN e criar um novo."
                                    )
                                },
                                testTag = "pt_confirm_reset_client_pin_btn"
                            )
                        },
                        dismissButton = {
                            TextButton(onClick = { showResetPinConfirm = false }) {
                                Text("Cancelar", color = TextSecondaryDark)
                            }
                        }
                    )
                }
                TabRow(
                    selectedTabIndex = profileTab,
                    containerColor = CharcoalSurface,
                    contentColor = NewShapeGold,
                    divider = { HorizontalDivider(color = HairlineBorder) }
                ) {
                    listOf("Perfil & Plano", "Assiduidade (${confirmedBookings.size})").forEachIndexed { idx, title ->
                        Tab(
                            selected = profileTab == idx,
                            onClick = { profileTab = idx },
                            modifier = Modifier.testTag("client_profile_tab_$idx"),
                            text = {
                                Text(
                                    text = title,
                                    fontWeight = if (profileTab == idx) FontWeight.Bold else FontWeight.Medium,
                                    color = if (profileTab == idx) NewShapeGold else TextSecondaryDark
                                )
                            }
                        )
                    }
                }
            }
        }

        if (profileTab == 0) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Quick navigation pills + Evolution PDF Report
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            DarkSecondaryButton(
                                text = "Treino",
                                icon = Icons.Default.FitnessCenter,
                                onClick = onJumpToWorkout,
                                modifier = Modifier.weight(1f)
                            )
                            DarkSecondaryButton(
                                text = "Nutrição",
                                icon = Icons.Default.Restaurant,
                                onClick = onJumpToNutrition,
                                modifier = Modifier.weight(1f)
                            )
                            DarkSecondaryButton(
                                text = "Chat",
                                icon = Icons.AutoMirrored.Filled.Chat,
                                onClick = onJumpToChat,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        DarkSecondaryButton(
                            text = "Exportar Relatório PDF de Evolução",
                            icon = Icons.Default.PictureAsPdf,
                            onClick = {
                                val ok = ReportExporter.shareStudentEvolutionPdf(
                                    context = context,
                                    client = client,
                                    assessments = state.physicalAssessments,
                                    bookings = state.bookings,
                                    workoutPlans = state.workoutPlans,
                                    workoutPlanItems = state.workoutPlanItems,
                                    workoutLoadLogs = state.workoutLoadLogs
                                )
                                if (!ok) {
                                    Toast.makeText(context, "Erro ao gerar relatório PDF.", Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("profile_export_pdf_btn")
                        )
                    }
                }

                // Upcoming Booked Trainings Card
                item {
                    BrandCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Próximos Treinos Marcados",
                                style = MaterialTheme.typography.titleMedium,
                                color = NewShapeGoldBright
                            )
                            val confirmedUp = upcomingBookings.count { it.first.status == BookingStatus.CONFIRMED.name }
                            StatusPill(
                                text = if (upcomingBookings.isNotEmpty()) "$confirmedUp confirmado(s)" else "Por marcar",
                                textColor = if (confirmedUp > 0) ConfirmedGreen else TextSecondaryDark,
                                containerColor = if (confirmedUp > 0) ConfirmedGreenContainer else ElevatedCharcoal
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        if (upcomingBookings.isEmpty()) {
                            Text(
                                text = "Sem treinos marcados para hoje ou próximos dias. Podes marcar diretamente em Treino → Marcações sem precisar de enviar mensagem.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                upcomingBookings.take(6).forEach { (booking, session) ->
                                    val isConfirmed = booking.status == BookingStatus.CONFIRMED.name
                                    Surface(
                                        color = ElevatedCharcoal,
                                        shape = RoundedCornerShape(10.dp),
                                        border = BorderStroke(1.dp, HairlineBorder),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = "${session.dateLabel} · ${session.timeLabel}",
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimaryDark
                                                )
                                                if (session.note.isNotBlank()) {
                                                    Text(
                                                        text = session.note,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = TextSecondaryDark
                                                    )
                                                }
                                            }
                                            StatusPill(
                                                text = if (isConfirmed) "Marcado ✓" else "Por confirmar",
                                                textColor = if (isConfirmed) ConfirmedGreen else PendingAmber,
                                                containerColor = if (isConfirmed) ConfirmedGreenContainer else PendingAmberContainer
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Admin Fixed Weekly Schedule Card
                if (state.isSuperAdmin || client.fixedSlots.isNotEmpty()) {
                    item {
                        BrandCard(highlightBorder = client.fixedSlots.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Dias Fixos Semanais",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = NewShapeGoldBright
                                )
                                StatusPill(
                                    text = if (fixedSlotsDraft.isNotEmpty()) "${fixedSlotsDraft.size} horário(s)" else "Sem dias fixos",
                                    textColor = if (fixedSlotsDraft.isNotEmpty()) NewShapeGoldBright else TextSecondaryDark,
                                    containerColor = if (fixedSlotsDraft.isNotEmpty()) NewShapeGoldMuted else ElevatedCharcoal
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "Marcações geradas automaticamente todas as semanas como Por confirmar para aprovação do PT.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                            Spacer(Modifier.height(8.dp))

                            if (fixedSlotsDraft.isEmpty()) {
                                Text(
                                    text = "Este aluno ainda não tem dias fixos definidos.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    fixedSlotsDraft.forEach { slot ->
                                        Surface(
                                            color = NewShapeGoldMuted,
                                            shape = RoundedCornerShape(10.dp),
                                            border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.45f)),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = SeedCatalog.formatFixedSlot(slot),
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = NewShapeGoldBright
                                                )
                                                if (state.isSuperAdmin) {
                                                    IconButton(
                                                        onClick = { fixedSlotsDraft = fixedSlotsDraft.filterNot { it == slot } },
                                                        modifier = Modifier.size(32.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.Close,
                                                            contentDescription = "Remover ${SeedCatalog.formatFixedSlot(slot)}",
                                                            tint = NewShapeGoldBright,
                                                            modifier = Modifier.size(16.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if (state.isSuperAdmin) {
                                Spacer(Modifier.height(10.dp))
                                HorizontalDivider(color = HairlineBorder)
                                Spacer(Modifier.height(10.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState())
                                ) {
                                    SeedCatalog.FIXED_DAY_OPTIONS.forEach { day ->
                                        FilterChip(
                                            selected = newFixedDay == day.dayOfWeek,
                                            onClick = { newFixedDay = day.dayOfWeek },
                                            label = { Text(day.shortLabel) },
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = NewShapeGold,
                                                selectedLabelColor = TextOnGold
                                            )
                                        )
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    OutlinedTextField(
                                        value = newFixedHour,
                                        onValueChange = { newFixedHour = it.filter(Char::isDigit).take(2) },
                                        label = { Text("Hora") },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        colors = darkFieldColors()
                                    )
                                    OutlinedTextField(
                                        value = newFixedMinute,
                                        onValueChange = { newFixedMinute = it.filter(Char::isDigit).take(2) },
                                        label = { Text("Min") },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        colors = darkFieldColors()
                                    )
                                    DarkSecondaryButton(
                                        text = "+ Add",
                                        onClick = {
                                            val h = (newFixedHour.toIntOrNull() ?: 9).coerceIn(0, 23)
                                            val m = (newFixedMinute.toIntOrNull() ?: 0).coerceIn(0, 59)
                                            val slotKey = "$newFixedDay|${String.format("%02d:%02d", h, m)}"
                                            fixedSlotsDraft = SeedCatalog.normalizeFixedSlots(fixedSlotsDraft + slotKey)
                                        },
                                        modifier = Modifier.testTag("profile_add_fixed_slot_btn")
                                    )
                                }
                                Spacer(Modifier.height(10.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    GoldPrimaryButton(
                                        text = "Guardar Dias Fixos",
                                        icon = Icons.Default.Check,
                                        onClick = {
                                            viewModel.updateClientFixedSlots(
                                                client = client,
                                                fixedSlots = fixedSlotsDraft,
                                                applyToActiveWeek = true
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                        testTag = "profile_save_fixed_slots_btn"
                                    )
                                    if (fixedSlotsDraft.isNotEmpty()) {
                                        DarkSecondaryButton(
                                            text = "Limpar",
                                            onClick = { fixedSlotsDraft = emptyList() },
                                            modifier = Modifier.testTag("profile_clear_fixed_slots_btn")
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Personal Details & Agreed Monthly Plan Card
                item {
                    BrandCard {
                        Text("Dados do Perfil & Plano", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nome") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = darkFieldColors()
                        )
                        Spacer(Modifier.height(10.dp))
                        Text("Modalidade / Tipo de Treino", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            listOf("PERSONALIZADO" to "Personalizado", "GRUPO" to "Grupo").forEach { (key, label) ->
                                FilterChip(
                                    selected = trainingType == key,
                                    onClick = { trainingType = key },
                                    label = { Text(label) },
                                    modifier = Modifier.weight(1f).testTag("profile_training_type_$key"),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NewShapeGold,
                                        selectedLabelColor = TextOnGold
                                    )
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = phone,
                                onValueChange = { phone = it.filter { c -> c.isDigit() }.take(9) },
                                label = { Text("Telemóvel (opcional)") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                modifier = Modifier.weight(1f),
                                colors = darkFieldColors()
                            )
                            if (state.isSuperAdmin) {
                                OutlinedTextField(
                                    value = monthlyFeeText,
                                    onValueChange = { monthlyFeeText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                                    label = { Text("Valor Mensalidade (€)") },
                                    placeholder = { Text("120") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    modifier = Modifier.weight(1f).testTag("profile_monthly_fee_input"),
                                    colors = darkFieldColors()
                                )
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Text("Limite Semanal do Pacote (treinos/semana)", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                        Spacer(Modifier.height(6.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        ) {
                            listOf(0 to "Sem limite", 1 to "1x", 2 to "2x", 3 to "3x", 4 to "4x", 5 to "5x", 6 to "6x").forEach { (lim, lbl) ->
                                FilterChip(
                                    selected = weeklySessionLimit == lim,
                                    onClick = { weeklySessionLimit = lim },
                                    label = { Text(lbl) },
                                    modifier = Modifier.testTag("profile_weekly_limit_$lim"),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NewShapeGold,
                                        selectedLabelColor = TextOnGold
                                    )
                                )
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Text("Período de Fidelização (se aplicável)", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            listOf(0 to "Sem fidel.", 6 to "6 Meses", 12 to "12 Meses").forEach { (months, label) ->
                                FilterChip(
                                    selected = fidelizacaoMonths == months,
                                    onClick = {
                                        fidelizacaoMonths = months
                                        if (months > 0 && fidelizacaoStartMillis <= 0L) {
                                            fidelizacaoStartMillis = System.currentTimeMillis()
                                        }
                                    },
                                    label = { Text(label) },
                                    modifier = Modifier.testTag("profile_fid_$months"),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NewShapeGold,
                                        selectedLabelColor = TextOnGold
                                    )
                                )
                            }
                        }
                        if (fidelizacaoMonths in listOf(6, 12)) {
                            val endCal = Calendar.getInstance().apply {
                                timeInMillis = fidelizacaoStartMillis
                                add(Calendar.MONTH, fidelizacaoMonths)
                            }
                            Spacer(Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Início: ${formatShortDate(fidelizacaoStartMillis)} → Fim: ${formatShortDate(endCal.timeInMillis)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = NewShapeGoldBright
                                )
                                TextButton(onClick = { fidelizacaoStartMillis = System.currentTimeMillis() }) {
                                    Text("Reiniciar hoje", color = NewShapeGold, style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Notas / Lesões / Objetivos") },
                            minLines = 2,
                            modifier = Modifier.fillMaxWidth(),
                            colors = darkFieldColors()
                        )
                        Spacer(Modifier.height(12.dp))
                        GoldPrimaryButton(
                            text = "Guardar alterações",
                            onClick = {
                                val parsedFee = if (state.isSuperAdmin) {
                                    monthlyFeeText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
                                } else {
                                    client.monthlyFeeEur
                                }
                                viewModel.updateClient(
                                    client.copy(
                                        name = name,
                                        phone = phone,
                                        notes = notes,
                                        trainingType = trainingType,
                                        monthlyFeeEur = parsedFee,
                                        fidelizacaoMonths = fidelizacaoMonths,
                                        fidelizacaoStartMillis = if (fidelizacaoMonths > 0) fidelizacaoStartMillis else 0L,
                                        weeklySessionLimit = weeklySessionLimit
                                    )
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "profile_save_changes_btn"
                        )
                    }
                }

                // Mensalidade Card (Admin Only)
                if (state.isSuperAdmin) {
                    item {
                        BrandCard(highlightBorder = currentMonthPayment == null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("Mensalidade (${state.currentMonthLabel})", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                                    if (currentMonthPayment != null) {
                                        Text(
                                            text = "Pago €${String.format("%.2f", currentMonthPayment.amountEur)} em ${formatShortDate(currentMonthPayment.paidAtMillis)}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = ConfirmedGreen
                                        )
                                    } else {
                                        Text("Sem registo de pagamento este mês", style = MaterialTheme.typography.bodySmall, color = PendingAmber)
                                    }
                                }
                                StatusPill(
                                    text = if (currentMonthPayment != null) "Pago ✓" else "Pendente",
                                    textColor = if (currentMonthPayment != null) ConfirmedGreen else PendingAmber,
                                    containerColor = if (currentMonthPayment != null) ConfirmedGreenContainer else PendingAmberContainer
                                )
                            }
                            Spacer(Modifier.height(12.dp))
                            GoldPrimaryButton(
                                text = "Registar Pagamento de Mensalidade",
                                icon = Icons.Default.Payments,
                                onClick = { showPayDialog = true },
                                modifier = Modifier.fillMaxWidth(),
                                testTag = "profile_register_payment_btn"
                            )
                            if (clientPayments.isNotEmpty()) {
                                Spacer(Modifier.height(14.dp))
                                HorizontalDivider(color = HairlineBorder)
                                Spacer(Modifier.height(10.dp))
                                Text("Histórico de pagamentos", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                                Spacer(Modifier.height(6.dp))
                                clientPayments.forEach { p ->
                                    val isFuture = p.monthYear > state.currentMonthYear
                                    val isAlreadyFid = p.note.contains("fideliza", ignoreCase = true)
                                    val category = SeedCatalog.getPaymentCategory(p.note)
                                    val isExtra = category != "MENSALIDADE"
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Text(
                                                    "${p.monthLabel} · €${String.format("%.2f", p.amountEur)}",
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    color = TextPrimaryDark
                                                )
                                                if (category == "SEGURO") {
                                                    StatusPill("Seguro", InfoBlue, InfoBlueContainer)
                                                } else if (category == "JOIA") {
                                                    StatusPill("Jóia", PendingAmber, PendingAmberContainer)
                                                }
                                                if (isFuture) {
                                                    StatusPill("Futuro", PendingAmber, PendingAmberContainer)
                                                }
                                            }
                                            Text(
                                                text = "${formatShortDate(p.paidAtMillis)}${if (p.note.isNotBlank()) " · ${p.note}" else ""}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = TextSecondaryDark
                                            )
                                        }
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            if (!isAlreadyFid && !isExtra && p.amountEur > 0.0) {
                                                TextButton(
                                                    onClick = { splitTargetPayment = p },
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                                ) {
                                                    Text(
                                                        "Dividir 6/12m",
                                                        color = NewShapeGoldBright,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                }
                                            }
                                            IconButton(onClick = { viewModel.deletePayment(p.id) }) {
                                                Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar pagamento", tint = DangerRed)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Fidelização Card
                item {
                    BrandCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Fidelizações (6 / 12 meses)", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                            TextButton(onClick = { showNewFidDialog = true }) {
                                Text("+ Adicionar", color = NewShapeGold, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (clientFids.isEmpty()) {
                            Text(
                                "Sem contrato de fidelização registado.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        } else {
                            clientFids.forEach { fid ->
                                Spacer(Modifier.height(8.dp))
                                FidelizacaoCompactRow(
                                    fid = fid,
                                    onEdit = { editingFid = fid },
                                    onDelete = { viewModel.deleteFidelizacao(fid.id) }
                                )
                            }
                        }
                    }
                }

                // Zona de Administrador · Eliminar Conta
                if (state.isSuperAdmin) {
                    item {
                        Surface(
                            color = DangerRedContainer.copy(alpha = 0.55f),
                            shape = MaterialTheme.shapes.medium,
                            border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Zona de Administrador · Eliminar Conta",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = DangerRed,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Remove permanentemente a conta de ${client.name} e todos os dados associados (marcações, planos de treino, nutrição, avaliações, mensalidades, fidelizações e chat).",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                                OutlinedButton(
                                    onClick = { showDeleteClientConfirm = true },
                                    border = BorderStroke(1.dp, DangerRed),
                                    modifier = Modifier.fillMaxWidth().testTag("profile_delete_client_btn")
                                ) {
                                    Icon(
                                        Icons.Default.DeleteOutline,
                                        contentDescription = "Eliminar conta do aluno",
                                        tint = DangerRed,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text("Eliminar conta permanentemente", color = DangerRed, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Tab 1: Assiduidade
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    BrandCard(highlightBorder = true) {
                        Text("Assiduidade nos Treinos", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                        Text(
                            text = if (markedCount > 0) {
                                "Baseado em $markedCount treino(s) com presença/falta registada ($pendingCount por marcar)"
                            } else {
                                "Ainda sem presenças confirmadas pelo PT nos dias de treino"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            Surface(
                                color = ConfirmedGreenContainer,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, ConfirmedGreen.copy(alpha = 0.5f)),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Treinos Feitos", style = MaterialTheme.typography.labelSmall, color = ConfirmedGreen)
                                    Text(
                                        text = if (markedCount > 0) "${String.format("%.0f", donePct)}%" else "—",
                                        style = MaterialTheme.typography.headlineSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = ConfirmedGreen
                                    )
                                    Text("$presentCount presença(s)", style = MaterialTheme.typography.labelSmall, color = TextPrimaryDark)
                                }
                            }
                            Surface(
                                color = DangerRedContainer,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.5f)),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Faltas", style = MaterialTheme.typography.labelSmall, color = DangerRed)
                                    Text(
                                        text = if (markedCount > 0) "${String.format("%.0f", absentPct)}%" else "—",
                                        style = MaterialTheme.typography.headlineSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = DangerRed
                                    )
                                    Text("$absentCount falta(s)", style = MaterialTheme.typography.labelSmall, color = TextPrimaryDark)
                                }
                            }
                        }
                        if (markedCount > 0) {
                            Spacer(Modifier.height(10.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(ElevatedCharcoal)
                            ) {
                                if (presentCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .weight(presentCount.toFloat())
                                            .fillMaxHeight()
                                            .background(ConfirmedGreen)
                                    )
                                }
                                if (absentCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .weight(absentCount.toFloat())
                                            .fillMaxHeight()
                                            .background(DangerRed)
                                    )
                                }
                            }
                        }
                    }
                }

                item {
                    Text(
                        "Histórico de Treinos Confirmados (${confirmedBookings.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimaryDark
                    )
                }

                if (confirmedBookings.isEmpty()) {
                    item {
                        EmptyStateBox(
                            icon = Icons.Default.EventAvailable,
                            title = "Sem treinos confirmados ainda",
                            subtitle = "Quando o aluno tiver treinos confirmados na agenda, podes registar presenças e faltas aqui ou na aba Semanas."
                        )
                    }
                } else {
                    items(confirmedBookings, key = { it.first.id }) { (booking, session) ->
                        val isPresent = booking.attendanceStatus == "PRESENT"
                        val isAbsent = booking.attendanceStatus == "ABSENT"
                        Surface(
                            color = CharcoalSurface,
                            shape = MaterialTheme.shapes.medium,
                            border = BorderStroke(
                                1.dp,
                                when {
                                    isPresent -> ConfirmedGreen.copy(alpha = 0.6f)
                                    isAbsent -> DangerRed.copy(alpha = 0.6f)
                                    else -> HairlineBorder
                                }
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "${session.dateLabel} · ${session.timeLabel.replace(":", "h")}",
                                            style = MaterialTheme.typography.titleSmall,
                                            color = TextPrimaryDark
                                        )
                                        Text(
                                            text = "${session.durationMinutes} min${if (session.note.isNotBlank()) " · ${session.note}" else ""}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondaryDark
                                        )
                                    }
                                    StatusPill(
                                        text = when {
                                            isPresent -> "Presente ✓"
                                            isAbsent -> "Falta ✕"
                                            else -> "Por marcar"
                                        },
                                        textColor = when {
                                            isPresent -> ConfirmedGreen
                                            isAbsent -> DangerRed
                                            else -> TextSecondaryDark
                                        },
                                        containerColor = when {
                                            isPresent -> ConfirmedGreenContainer
                                            isAbsent -> DangerRedContainer
                                            else -> ElevatedCharcoal
                                        }
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    FilterChip(
                                        selected = isPresent,
                                        onClick = {
                                            viewModel.setBookingAttendance(booking.id, if (isPresent) "" else "PRESENT")
                                        },
                                        label = { Text("Presente ✓") },
                                        modifier = Modifier.weight(1f).testTag("profile_present_${booking.id}"),
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = ConfirmedGreen,
                                            selectedLabelColor = ObsidianBg
                                        )
                                    )
                                    FilterChip(
                                        selected = isAbsent,
                                        onClick = {
                                            viewModel.setBookingAttendance(booking.id, if (isAbsent) "" else "ABSENT")
                                        },
                                        label = { Text("Falta ✕") },
                                        modifier = Modifier.weight(1f).testTag("profile_absent_${booking.id}"),
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = DangerRed,
                                            selectedLabelColor = TextPrimaryDark
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.isSuperAdmin && showDeleteClientConfirm) {
        DeleteClientConfirmDialog(
            client = client,
            onDismiss = { showDeleteClientConfirm = false },
            onConfirm = {
                viewModel.deleteClientAccount(client) { ok ->
                    if (ok) {
                        showDeleteClientConfirm = false
                        onBack()
                    }
                }
            }
        )
    }

    if (state.isSuperAdmin && showPayDialog) {
        RegisterPaymentDialog(
            clientName = client.name,
            defaultMonthYear = state.currentMonthYear,
            defaultMonthLabel = state.currentMonthLabel,
            defaultAmountEur = if (client.monthlyFeeEur > 0.0) client.monthlyFeeEur else 120.0,
            defaultDurationMonths = SeedCatalog.getEffectiveClientFidelizacaoMonths(client, clientFids),
            onDismiss = { showPayDialog = false },
            onConfirm = { monthYear, monthLabel, amount, method, durationMonths, seguroEur, joiaEur ->
                viewModel.recordPayment(
                    clientId = client.id,
                    monthYear = monthYear,
                    monthLabel = monthLabel,
                    amountEur = amount,
                    note = method,
                    durationMonths = durationMonths,
                    seguroEur = seguroEur,
                    joiaEur = joiaEur
                )
                showPayDialog = false
            }
        )
    }

    if (state.isSuperAdmin && splitTargetPayment != null) {
        val target = splitTargetPayment!!
        SplitPaymentFidelizacaoDialog(
            clientName = client.name,
            payment = target,
            defaultMonths = if (SeedCatalog.getEffectiveClientFidelizacaoMonths(client, clientFids) == 12) 12 else 6,
            onDismiss = { splitTargetPayment = null },
            onConfirm = { months ->
                viewModel.splitPaymentIntoFidelizacao(target, months)
                splitTargetPayment = null
            }
        )
    }

    if (showNewFidDialog || editingFid != null) {
        FidelizacaoDialog(
            clientName = client.name,
            existing = editingFid,
            isSuperAdmin = state.isSuperAdmin,
            defaultMonthlyFeeEur = client.monthlyFeeEur,
            onDismiss = {
                showNewFidDialog = false
                editingFid = null
            },
            onSave = { months, startMillis, endMillis, fidNotes ->
                viewModel.saveFidelizacao(
                    clientId = client.id,
                    durationMonths = months,
                    startDateMillis = startMillis,
                    notes = fidNotes,
                    existingId = editingFid?.id.orEmpty(),
                    customEndDateMillis = if (state.isSuperAdmin) endMillis else null
                )
                showNewFidDialog = false
                editingFid = null
            },
            onSaveWithPayment = { months, startMillis, endMillis, fidNotes, totalPaidEur, method ->
                viewModel.saveFidelizacao(
                    clientId = client.id,
                    durationMonths = months,
                    startDateMillis = startMillis,
                    notes = fidNotes,
                    existingId = "",
                    customEndDateMillis = if (state.isSuperAdmin) endMillis else null
                )
                val startCal = Calendar.getInstance().apply { timeInMillis = startMillis }
                val monthsPt = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
                val my = String.format("%04d-%02d", startCal.get(Calendar.YEAR), startCal.get(Calendar.MONTH) + 1)
                val ml = "${monthsPt[startCal.get(Calendar.MONTH)]} ${startCal.get(Calendar.YEAR)}"
                viewModel.recordPayment(
                    clientId = client.id,
                    monthYear = my,
                    monthLabel = ml,
                    amountEur = totalPaidEur,
                    note = method,
                    durationMonths = months,
                    skipAutoFidelizacao = true
                )
                showNewFidDialog = false
                editingFid = null
            }
        )
    }
}

@Composable
private fun FidelizacaoCompactRow(
    fid: FidelizacaoRecord,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val now = System.currentTimeMillis()
    val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
    Surface(
        color = ElevatedCharcoal,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("${fid.durationMonths} Meses", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                Text(
                    "Início: ${formatShortDate(fid.startDateMillis)} → Fim: ${formatShortDate(fid.endDateMillis)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextPrimaryDark
                )
                Text(
                    text = if (daysLeft < 0) "Expirada" else "Faltam $daysLeft dias",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (daysLeft < 0) DangerRed else if (daysLeft < 30) PendingAmber else ConfirmedGreen
                )
            }
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Editar fidelização", tint = TextSecondaryDark)
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar fidelização", tint = DangerRed)
                }
            }
        }
    }
}

@Composable
private fun NewClientDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var trainingType by remember { mutableStateOf("GRUPO") }
    var weeklySessionLimit by remember { mutableIntStateOf(0) }
    var rgpdAccepted by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Novo Cliente", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome completo") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it.filter { c -> c.isDigit() }.take(9) },
                    label = { Text("Telemóvel (opcional · 9 dígitos)") },
                    supportingText = { Text("Podes adicionar apenas com o nome.", color = TextSecondaryDark) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.testTag("new_client_phone_input"),
                    colors = darkFieldColors()
                )
                Text("Tipo de Treino", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    listOf("PERSONALIZADO" to "Personalizado", "GRUPO" to "Grupo").forEach { (key, label) ->
                        FilterChip(
                            selected = trainingType == key,
                            onClick = { trainingType = key },
                            label = { Text(label) },
                            modifier = Modifier.weight(1f).testTag("new_client_type_$key"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Text("Limite semanal do pacote", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                ) {
                    listOf(0 to "Sem limite", 1 to "1x", 2 to "2x", 3 to "3x", 4 to "4x", 5 to "5x").forEach { (lim, lbl) ->
                        FilterChip(
                            selected = weeklySessionLimit == lim,
                            onClick = { weeklySessionLimit = lim },
                            label = { Text(lbl) },
                            modifier = Modifier.testTag("new_client_limit_$lim"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas (opcional)") },
                    colors = darkFieldColors()
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { rgpdAccepted = !rgpdAccepted }
                        .padding(vertical = 4.dp)
                ) {
                    Checkbox(
                        checked = rgpdAccepted,
                        onCheckedChange = { rgpdAccepted = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = NewShapeGold,
                            checkmarkColor = TextOnGold,
                            uncheckedColor = TextSecondaryDark
                        )
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "Consentimento RGPD obtido do aluno",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimaryDark
                    )
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Adicionar",
                enabled = name.isNotBlank(),
                onClick = {
                    val rgpdStamp = if (rgpdAccepted) SeedCatalog.formatRgpdConsentStamp() else ""
                    val combinedNotes = listOf(notes.trim(), rgpdStamp)
                        .filter { it.isNotBlank() }
                        .joinToString(" · ")
                    onSave(name, phone, combinedNotes, trainingType, weeklySessionLimit)
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun ImportClientsDialog(
    onDismiss: () -> Unit,
    onImport: (String, (com.example.data.ImportResult) -> Unit) -> Unit
) {
    var rawText by remember { mutableStateOf("Nome;Telemovel\nSofia Mendes;914555111\nDiogo Nunes") }
    var resultText by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Importar lista ou CSV", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Cola uma lista no formato Nome;912345678 ou apenas Nome (o telemóvel é opcional).",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                OutlinedTextField(
                    value = rawText,
                    onValueChange = { rawText = it },
                    minLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
                if (resultText != null) {
                    Text(resultText!!, style = MaterialTheme.typography.bodySmall, color = NewShapeGoldBright)
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Importar",
                onClick = {
                    onImport(rawText) { res ->
                        resultText = "Adicionados: ${res.added} · Ignorados: ${res.ignored} · Erros: ${res.errors.size}"
                    }
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Fechar", color = TextSecondaryDark) }
        }
    )
}

@Composable
fun RegisterPaymentDialog(
    clientName: String,
    defaultMonthYear: String,
    defaultMonthLabel: String,
    defaultAmountEur: Double = 120.0,
    defaultDurationMonths: Int = 1,
    onDismiss: () -> Unit,
    onConfirm: (String, String, Double, String, Int, Double, Double) -> Unit
) {
    val initialDuration = if (defaultDurationMonths == 6 || defaultDurationMonths == 12) defaultDurationMonths else 1
    var durationMonths by remember(defaultDurationMonths) { mutableIntStateOf(initialDuration) }
    fun formatAmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)

    var amountText by remember(defaultAmountEur, initialDuration) {
        mutableStateOf(formatAmt(defaultAmountEur * initialDuration))
    }
    var includeSeguro by remember { mutableStateOf(false) }
    var seguroText by remember { mutableStateOf("") }
    var includeJoia by remember { mutableStateOf(false) }
    var joiaText by remember { mutableStateOf(formatAmt(SeedCatalog.DEFAULT_JOIA_EUR)) }

    var selectedMethod by remember { mutableStateOf("MbWay") }
    val paymentMethods = SeedCatalog.PAYMENT_METHODS
    val monthOptions = remember(defaultMonthYear) { buildRecentMonthOptions() }
    var selectedMonth by remember { mutableStateOf(monthOptions.firstOrNull() ?: (defaultMonthYear to defaultMonthLabel)) }

    val numericAmount = amountText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
    val numericSeguro = if (includeSeguro) (seguroText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0) else 0.0
    val numericJoia = if (includeJoia) (joiaText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0) else 0.0
    val grandTotal = numericAmount + numericSeguro + numericJoia
    val perMonthAmount = numericAmount / durationMonths
    val coveredMonths = remember(selectedMonth, durationMonths) {
        SeedCatalog.buildConsecutiveMonths(selectedMonth.first, durationMonths)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Registar Mensalidade", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Aluno: $clientName", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                Text(
                    text = if (durationMonths > 1) "Mês inicial da fidelização" else "Mês",
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondaryDark
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    monthOptions.take(3).forEach { opt ->
                        FilterChip(
                            selected = selectedMonth.first == opt.first,
                            onClick = { selectedMonth = opt },
                            label = { Text(opt.second) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Text("Período / Fidelização paga", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    listOf(1 to "1 Mês", 6 to "6 Meses", 12 to "12 Meses").forEach { (m, label) ->
                        FilterChip(
                            selected = durationMonths == m,
                            onClick = {
                                val prevAuto = defaultAmountEur * durationMonths
                                if (kotlin.math.abs(numericAmount - prevAuto) < 0.01) {
                                    amountText = formatAmt(defaultAmountEur * m)
                                }
                                durationMonths = m
                            },
                            label = { Text(label) },
                            modifier = Modifier.weight(1f).testTag("payment_duration_$m"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
                    label = {
                        Text(
                            if (durationMonths > 1) "Valor total da mensalidade ($durationMonths meses) (€)"
                            else "Valor da mensalidade (€)"
                        )
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
                if (durationMonths > 1) {
                    Surface(
                        color = NewShapeGoldMuted,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                text = "€${String.format("%.2f", numericAmount)} ÷ $durationMonths meses = €${String.format("%.2f", perMonthAmount)}/mês",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = NewShapeGoldBright
                            )
                            Text(
                                text = "Conta 1 mensalidade/mês (${coveredMonths.firstOrNull()?.second.orEmpty()} → ${coveredMonths.lastOrNull()?.second.orEmpty()}) e adiciona automaticamente às Fidelizações (datas editáveis pelo admin).",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                    }
                }

                // Seguro & Jóia de Inscrição (30€)
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Taxas adicionais (opcional)",
                            style = MaterialTheme.typography.labelMedium,
                            color = NewShapeGoldBright,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Incluídos na faturação total, mas excluídos da média de mensalidades.",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { includeSeguro = !includeSeguro }
                            ) {
                                Checkbox(
                                    checked = includeSeguro,
                                    onCheckedChange = { includeSeguro = it },
                                    modifier = Modifier.testTag("payment_seguro_checkbox"),
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold,
                                        uncheckedColor = TextSecondaryDark
                                    )
                                )
                                Text("Seguro", style = MaterialTheme.typography.bodyMedium, color = TextPrimaryDark)
                            }
                            OutlinedTextField(
                                value = seguroText,
                                onValueChange = { seguroText = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
                                enabled = includeSeguro,
                                placeholder = { Text("€") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.width(104.dp).testTag("payment_seguro_input"),
                                colors = darkFieldColors()
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        includeJoia = !includeJoia
                                        if (includeJoia && joiaText.isBlank()) {
                                            joiaText = formatAmt(SeedCatalog.DEFAULT_JOIA_EUR)
                                        }
                                    }
                            ) {
                                Checkbox(
                                    checked = includeJoia,
                                    onCheckedChange = { checked ->
                                        includeJoia = checked
                                        if (checked && joiaText.isBlank()) {
                                            joiaText = formatAmt(SeedCatalog.DEFAULT_JOIA_EUR)
                                        }
                                    },
                                    modifier = Modifier.testTag("payment_joia_checkbox"),
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold,
                                        uncheckedColor = TextSecondaryDark
                                    )
                                )
                                Text("Jóia (30€)", style = MaterialTheme.typography.bodyMedium, color = TextPrimaryDark)
                            }
                            OutlinedTextField(
                                value = joiaText,
                                onValueChange = { joiaText = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
                                enabled = includeJoia,
                                placeholder = { Text("30") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.width(104.dp).testTag("payment_joia_input"),
                                colors = darkFieldColors()
                            )
                        }

                        if (numericSeguro > 0.0 || numericJoia > 0.0) {
                            HorizontalDivider(color = HairlineBorder)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Total a faturar", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                                Text(
                                    text = "€${String.format("%.2f", grandTotal)}",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = NewShapeGoldBright
                                )
                            }
                        }
                    }
                }

                Text("Método de pagamento", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    paymentMethods.forEach { method ->
                        FilterChip(
                            selected = selectedMethod == method,
                            onClick = { selectedMethod = method },
                            label = { Text(method) },
                            modifier = Modifier.weight(1f).testTag("payment_method_$method"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Marcar como Pago",
                enabled = grandTotal > 0.0,
                onClick = {
                    onConfirm(
                        selectedMonth.first,
                        selectedMonth.second,
                        numericAmount,
                        selectedMethod,
                        durationMonths,
                        numericSeguro,
                        numericJoia
                    )
                },
                testTag = "confirm_payment_dialog_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
fun SplitPaymentFidelizacaoDialog(
    clientName: String,
    payment: PaymentRecord,
    defaultMonths: Int = 6,
    onDismiss: () -> Unit,
    onConfirm: (Int) -> Unit
) {
    var months by remember(defaultMonths) { mutableIntStateOf(if (defaultMonths == 12) 12 else 6) }
    val splitValues = remember(payment.amountEur, months) {
        SeedCatalog.splitAmountAcrossMonths(payment.amountEur, months)
    }
    val covered = remember(payment.monthYear, months) {
        SeedCatalog.buildConsecutiveMonths(payment.monthYear, months)
    }
    val perMonth = splitValues.firstOrNull() ?: 0.0

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Dividir Pagamento por Fidelização", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "$clientName · €${String.format("%.2f", payment.amountEur)} (${payment.monthLabel})",
                    style = MaterialTheme.typography.titleSmall,
                    color = NewShapeGoldBright
                )
                Text(
                    text = "Divide este valor pelos meses da fidelização para contabilizar apenas 1 mensalidade por mês.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    listOf(6, 12).forEach { m ->
                        FilterChip(
                            selected = months == m,
                            onClick = { months = m },
                            label = { Text("$m Meses") },
                            modifier = Modifier.weight(1f),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Surface(
                    color = NewShapeGoldMuted,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "€${String.format("%.2f", payment.amountEur)} ÷ $months meses = €${String.format("%.2f", perMonth)}/mês",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = NewShapeGoldBright
                        )
                        Text(
                            text = "Período: ${covered.firstOrNull()?.second.orEmpty()} → ${covered.lastOrNull()?.second.orEmpty()} (1 mensalidade/mês)",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextPrimaryDark
                        )
                    }
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Dividir por $months meses",
                onClick = { onConfirm(months) },
                testTag = "confirm_split_fidelizacao_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

private fun computeAutoEndMillis(startMillis: Long, durationMonths: Int): Long =
    Calendar.getInstance().apply {
        timeInMillis = startMillis
        add(Calendar.MONTH, durationMonths)
    }.timeInMillis

private fun localMillisToUtcPickerMillis(localMillis: Long): Long {
    val local = Calendar.getInstance().apply { timeInMillis = localMillis }
    return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
        clear()
        set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH), 0, 0, 0)
    }.timeInMillis
}

private fun utcPickerMillisToLocalMillis(utcMillis: Long): Long {
    val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = utcMillis }
    return Calendar.getInstance().apply {
        set(utc.get(Calendar.YEAR), utc.get(Calendar.MONTH), utc.get(Calendar.DAY_OF_MONTH), 9, 0, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FidelizacaoDialog(
    clientName: String,
    existing: FidelizacaoRecord?,
    isSuperAdmin: Boolean = false,
    defaultMonthlyFeeEur: Double = 0.0,
    onDismiss: () -> Unit,
    onSave: (Int, Long, Long, String) -> Unit,
    onSaveWithPayment: ((Int, Long, Long, String, Double, String) -> Unit)? = null
) {
    var durationMonths by remember(existing?.id) { mutableIntStateOf(existing?.durationMonths ?: 6) }
    var startMillis by remember(existing?.id) {
        mutableLongStateOf(existing?.startDateMillis?.takeIf { it > 0L } ?: System.currentTimeMillis())
    }
    var endMillis by remember(existing?.id) {
        mutableLongStateOf(
            existing?.endDateMillis?.takeIf { it > 0L }
                ?: computeAutoEndMillis(existing?.startDateMillis?.takeIf { it > 0L } ?: System.currentTimeMillis(), existing?.durationMonths ?: 6)
        )
    }
    var endDateCustomized by remember(existing?.id) {
        val initStart = existing?.startDateMillis?.takeIf { it > 0L } ?: System.currentTimeMillis()
        val autoEnd = computeAutoEndMillis(initStart, existing?.durationMonths ?: 6)
        val customized = existing != null && kotlin.math.abs(existing.endDateMillis - autoEnd) > 86_400_000L
        mutableStateOf(customized)
    }
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }

    var notes by remember(existing?.id) { mutableStateOf(existing?.notes ?: "Plano $durationMonths meses") }
    var recordPaymentNow by remember { mutableStateOf(false) }
    val baseMonthly = if (defaultMonthlyFeeEur > 0.0) defaultMonthlyFeeEur else 100.0
    fun fmt(v: Double) = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
    var totalPaidText by remember(defaultMonthlyFeeEur) { mutableStateOf(fmt(baseMonthly * (existing?.durationMonths ?: 6))) }
    var payMethod by remember { mutableStateOf("MbWay") }

    val numericTotalPaid = totalPaidText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
    val previewPerMonth = numericTotalPaid / durationMonths
    val invalidRange = endMillis <= startMillis

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Fidelização · $clientName", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Período de fidelização", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(6, 12).forEach { m ->
                        FilterChip(
                            selected = durationMonths == m,
                            onClick = {
                                val prevAuto = baseMonthly * durationMonths
                                if (kotlin.math.abs(numericTotalPaid - prevAuto) < 0.01) {
                                    totalPaidText = fmt(baseMonthly * m)
                                }
                                durationMonths = m
                                endMillis = computeAutoEndMillis(startMillis, m)
                                endDateCustomized = false
                            },
                            label = { Text("$m Meses") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }

                Text("Datas do período", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { showStartPicker = true }
                            .testTag("fid_start_date_btn")
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Data de início", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                            Spacer(Modifier.height(2.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(Icons.Default.CalendarToday, contentDescription = null, tint = NewShapeGold, modifier = Modifier.size(14.dp))
                                Text(
                                    text = formatShortDate(startMillis),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                            }
                        }
                    }

                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
                            1.dp,
                            if (invalidRange) DangerRed else if (isSuperAdmin) NewShapeGold.copy(alpha = 0.5f) else HairlineBorder
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable(enabled = isSuperAdmin) { showEndPicker = true }
                            .testTag("fid_end_date_btn")
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Data de fim", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                            Spacer(Modifier.height(2.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Event,
                                    contentDescription = null,
                                    tint = if (isSuperAdmin) NewShapeGold else TextSecondaryDark,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = formatShortDate(endMillis),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (invalidRange) DangerRed else TextPrimaryDark
                                )
                            }
                        }
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                ) {
                    listOf(0 to "Hoje", -1 to "-1 mês", 1 to "+1 mês").forEach { (off, lbl) ->
                        FilterChip(
                            selected = false,
                            onClick = {
                                val nextStart = Calendar.getInstance().apply { add(Calendar.MONTH, off) }.timeInMillis
                                startMillis = nextStart
                                endMillis = computeAutoEndMillis(nextStart, durationMonths)
                                endDateCustomized = false
                            },
                            label = { Text(lbl) }
                        )
                    }
                    if (isSuperAdmin && endDateCustomized) {
                        TextButton(
                            onClick = {
                                endMillis = computeAutoEndMillis(startMillis, durationMonths)
                                endDateCustomized = false
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Text("Auto (+${durationMonths}m)", color = NewShapeGoldBright, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                Text(
                    text = if (isSuperAdmin) {
                        "Fim calculado automaticamente (+${durationMonths}m). Toca nas datas acima para adaptar início ou fim."
                    } else {
                        "Data de fim calculada automaticamente a partir da data de início."
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondaryDark
                )

                if (invalidRange) {
                    Text(
                        text = "A data de fim deve ser posterior à data de início.",
                        style = MaterialTheme.typography.labelSmall,
                        color = DangerRed
                    )
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas do contrato") },
                    colors = darkFieldColors()
                )
                if (existing == null && isSuperAdmin && onSaveWithPayment != null) {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { recordPaymentNow = !recordPaymentNow }
                            ) {
                                Checkbox(
                                    checked = recordPaymentNow,
                                    onCheckedChange = { recordPaymentNow = it },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold,
                                        uncheckedColor = TextSecondaryDark
                                    )
                                )
                                Text(
                                    text = "Registar pagamento da fidelização (dividido pelos $durationMonths meses)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimaryDark
                                )
                            }
                            if (recordPaymentNow) {
                                OutlinedTextField(
                                    value = totalPaidText,
                                    onValueChange = { totalPaidText = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
                                    label = { Text("Valor total pago ($durationMonths meses) (€)") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = darkFieldColors()
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                                    SeedCatalog.PAYMENT_METHODS.forEach { method ->
                                        FilterChip(
                                            selected = payMethod == method,
                                            onClick = { payMethod = method },
                                            label = { Text(method) },
                                            modifier = Modifier.weight(1f),
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = NewShapeGold,
                                                selectedLabelColor = TextOnGold
                                            )
                                        )
                                    }
                                }
                                Text(
                                    text = "€${String.format("%.2f", numericTotalPaid)} ÷ $durationMonths = €${String.format("%.2f", previewPerMonth)}/mês (conta 1 mensalidade/mês)",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = NewShapeGoldBright
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar Fidelização",
                enabled = !invalidRange,
                onClick = {
                    val safeEnd = if (isSuperAdmin && endMillis > startMillis) endMillis else computeAutoEndMillis(startMillis, durationMonths)
                    if (existing == null && isSuperAdmin && recordPaymentNow && numericTotalPaid > 0.0 && onSaveWithPayment != null) {
                        onSaveWithPayment(durationMonths, startMillis, safeEnd, notes, numericTotalPaid, payMethod)
                    } else {
                        onSave(durationMonths, startMillis, safeEnd, notes)
                    }
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )

    if (showStartPicker) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = localMillisToUtcPickerMillis(startMillis)
        )
        DatePickerDialog(
            onDismissRequest = { showStartPicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        pickerState.selectedDateMillis?.let { pickedUtc ->
                            val nextStart = utcPickerMillisToLocalMillis(pickedUtc)
                            startMillis = nextStart
                            endMillis = computeAutoEndMillis(nextStart, durationMonths)
                            endDateCustomized = false
                        }
                        showStartPicker = false
                    }
                ) {
                    Text("Confirmar", color = NewShapeGold, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showStartPicker = false }) {
                    Text("Cancelar", color = TextSecondaryDark)
                }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showEndPicker && isSuperAdmin) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = localMillisToUtcPickerMillis(endMillis)
        )
        DatePickerDialog(
            onDismissRequest = { showEndPicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        pickerState.selectedDateMillis?.let { pickedUtc ->
                            endMillis = utcPickerMillisToLocalMillis(pickedUtc)
                            endDateCustomized = true
                        }
                        showEndPicker = false
                    }
                ) {
                    Text("Confirmar", color = NewShapeGold, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEndPicker = false }) {
                    Text("Cancelar", color = TextSecondaryDark)
                }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }
}

fun buildRecentMonthOptions(): List<Pair<String, String>> {
    val months = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
    return (0 downTo -3).map { offset ->
        val c = Calendar.getInstance().apply { add(Calendar.MONTH, offset) }
        val key = String.format("%04d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1)
        val lbl = "${months[c.get(Calendar.MONTH)]} ${c.get(Calendar.YEAR)}"
        key to lbl
    }
}

@Composable
private fun DeleteClientConfirmDialog(
    client: ClientRecord,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    var deleting by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!deleting) onDismiss() },
        containerColor = CharcoalSurface,
        icon = {
            Icon(
                imageVector = Icons.Default.DeleteOutline,
                contentDescription = "Eliminar conta",
                tint = DangerRed,
                modifier = Modifier.size(28.dp)
            )
        },
        title = {
            Text("Eliminar conta do aluno?", color = TextPrimaryDark, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = buildString {
                        append(client.name)
                        if (client.phone.isNotBlank()) append(" · ${client.phone}")
                    },
                    style = MaterialTheme.typography.titleSmall,
                    color = DangerRed,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Esta ação é permanente e não pode ser anulada. Serão eliminados o perfil do aluno, marcações, planos de treino, cargas, nutrição, avaliações físicas, mensalidades, fidelizações e mensagens de chat.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
        },
        confirmButton = {
            Button(
                enabled = !deleting,
                onClick = {
                    deleting = true
                    onConfirm()
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = DangerRed,
                    contentColor = TextPrimaryDark
                ),
                modifier = Modifier.testTag("confirm_delete_client_btn")
            ) {
                Text(
                    if (deleting) "A eliminar..." else "Eliminar permanentemente",
                    fontWeight = FontWeight.Bold
                )
            }
        },
        dismissButton = {
            TextButton(
                enabled = !deleting,
                onClick = onDismiss,
                modifier = Modifier.testTag("cancel_delete_client_btn")
            ) {
                Text("Cancelar", color = TextSecondaryDark)
            }
        }
    )
}
