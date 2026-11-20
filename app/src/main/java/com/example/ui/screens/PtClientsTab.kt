package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

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
    var showNewClientDialog by remember { mutableStateOf(false) }
    var showImportDialog by remember { mutableStateOf(false) }
    var paymentTargetClient by remember { mutableStateOf<ClientRecord?>(null) }

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

    val filteredClients = remember(state.clients, searchQuery, showInactive) {
        state.clients.filter { client ->
            (showInactive || client.active) &&
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Mensalidade atual: ${state.currentMonthLabel}",
                    style = MaterialTheme.typography.labelMedium,
                    color = NewShapeGold
                )
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
                    it.clientId == client.id && it.monthYear == state.currentMonthYear && it.paid
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
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(client.name, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                                    if (client.newClient) {
                                        StatusPill("Novo", InfoBlue, InfoBlueContainer)
                                    }
                                    if (!client.active) {
                                        StatusPill("Inativo", TextSecondaryDark, ElevatedCharcoal)
                                    }
                                }
                                Text(client.phone, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                                if (client.monthlyFeeEur > 0.0 || client.fidelizacaoMonths > 0) {
                                    val feeStr = if (client.monthlyFeeEur > 0.0) "€${String.format("%.0f", client.monthlyFeeEur)}/mês" else ""
                                    val fidStr = if (client.fidelizacaoMonths > 0) "Fidelização ${client.fidelizacaoMonths}m" else ""
                                    val info = listOf(feeStr, fidStr).filter { it.isNotBlank() }.joinToString(" · ")
                                    Text(info, style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                                }
                            }
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

                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
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
                            Text("Ver perfil →", style = MaterialTheme.typography.labelLarge, color = TextSecondaryDark)
                        }
                    }
                }
            }
        }
    }

    if (showNewClientDialog) {
        NewClientDialog(
            onDismiss = { showNewClientDialog = false },
            onSave = { name, phone, notes ->
                viewModel.addClient(name, phone, notes)
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

    paymentTargetClient?.let { client ->
        RegisterPaymentDialog(
            clientName = client.name,
            defaultMonthYear = state.currentMonthYear,
            defaultMonthLabel = state.currentMonthLabel,
            defaultAmountEur = if (client.monthlyFeeEur > 0.0) client.monthlyFeeEur else 120.0,
            defaultDurationMonths = client.fidelizacaoMonths,
            onDismiss = { paymentTargetClient = null },
            onConfirm = { monthYear, monthLabel, amount, method, durationMonths ->
                viewModel.recordPayment(client.id, monthYear, monthLabel, amount, method, durationMonths)
                paymentTargetClient = null
            }
        )
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

    var name by remember(client.id) { mutableStateOf(client.name) }
    var phone by remember(client.id) { mutableStateOf(client.phone) }
    var notes by remember(client.id) { mutableStateOf(client.notes) }
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
    var showPayDialog by remember { mutableStateOf(false) }
    var editingFid by remember { mutableStateOf<FidelizacaoRecord?>(null) }
    var showNewFidDialog by remember { mutableStateOf(false) }

    val clientPayments = remember(state.payments, client.id) {
        state.payments.filter { it.clientId == client.id }
    }
    val clientFids = remember(state.fidelizacoes, client.id) {
        state.fidelizacoes.filter { it.clientId == client.id }
    }
    val currentMonthPayment = clientPayments.find { it.monthYear == state.currentMonthYear && it.paid }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, modifier = Modifier.testTag("client_profile_back")) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar aos alunos", tint = NewShapeGold)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(client.name, style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                        if (client.notes.contains("rgpd aceite", ignoreCase = true)) {
                            StatusPill("RGPD ✓", ConfirmedGreen, ConfirmedGreenContainer)
                        }
                    }
                    Text(
                        text = if (client.active) "Aluno ativo" else "Aluno inativo",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (client.active) ConfirmedGreen else TextSecondaryDark
                    )
                }
                TextButton(onClick = { viewModel.setClientActive(client, !client.active) }) {
                    Text(
                        text = if (client.active) "Desativar" else "Reativar",
                        color = if (client.active) DangerRed else ConfirmedGreen
                    )
                }
            }
        }

        // Quick navigation pills
        item {
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
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it.filter { c -> c.isDigit() }.take(9) },
                        label = { Text("Telemóvel WhatsApp") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
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
                        val parsedFee = monthlyFeeText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
                        viewModel.updateClient(
                            client.copy(
                                name = name,
                                phone = phone,
                                notes = notes,
                                monthlyFeeEur = parsedFee,
                                fidelizacaoMonths = fidelizacaoMonths,
                                fidelizacaoStartMillis = if (fidelizacaoMonths > 0) fidelizacaoStartMillis else 0L
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "profile_save_changes_btn"
                )
            }
        }

        // Mensalidade Card
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
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("${p.monthLabel} · €${String.format("%.2f", p.amountEur)}", style = MaterialTheme.typography.bodyMedium, color = TextPrimaryDark)
                                Text(
                                    text = "${formatShortDate(p.paidAtMillis)}${if (p.note.isNotBlank()) " · ${p.note}" else ""}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                            }
                            IconButton(onClick = { viewModel.deletePayment(p.id) }) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar pagamento", tint = DangerRed)
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
    }

    if (showPayDialog) {
        RegisterPaymentDialog(
            clientName = client.name,
            defaultMonthYear = state.currentMonthYear,
            defaultMonthLabel = state.currentMonthLabel,
            defaultAmountEur = if (client.monthlyFeeEur > 0.0) client.monthlyFeeEur else 120.0,
            defaultDurationMonths = client.fidelizacaoMonths,
            onDismiss = { showPayDialog = false },
            onConfirm = { monthYear, monthLabel, amount, method, durationMonths ->
                viewModel.recordPayment(client.id, monthYear, monthLabel, amount, method, durationMonths)
                showPayDialog = false
            }
        )
    }

    if (showNewFidDialog || editingFid != null) {
        FidelizacaoDialog(
            clientName = client.name,
            existing = editingFid,
            onDismiss = {
                showNewFidDialog = false
                editingFid = null
            },
            onSave = { months, startMillis, fidNotes ->
                viewModel.saveFidelizacao(client.id, months, startMillis, fidNotes, editingFid?.id.orEmpty())
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
    onSave: (String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var rgpdAccepted by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Novo Cliente", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
                    label = { Text("Telemóvel (9 dígitos)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    colors = darkFieldColors()
                )
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
                    onSave(name, phone, combinedNotes)
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
    var rawText by remember { mutableStateOf("Nome;Telemovel\nSofia Mendes;914555111\nDiogo Nunes;918222333") }
    var resultText by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Importar lista ou CSV", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Cola uma lista no formato Nome;912345678 (uma pessoa por linha).",
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
    onConfirm: (String, String, Double, String, Int) -> Unit
) {
    val initialDuration = if (defaultDurationMonths == 6 || defaultDurationMonths == 12) defaultDurationMonths else 1
    var durationMonths by remember(defaultDurationMonths) { mutableIntStateOf(initialDuration) }
    fun formatAmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)

    var amountText by remember(defaultAmountEur, initialDuration) {
        mutableStateOf(formatAmt(defaultAmountEur * initialDuration))
    }
    var selectedMethod by remember { mutableStateOf("MbWay") }
    val paymentMethods = SeedCatalog.PAYMENT_METHODS
    val monthOptions = remember(defaultMonthYear) { buildRecentMonthOptions() }
    var selectedMonth by remember { mutableStateOf(monthOptions.firstOrNull() ?: (defaultMonthYear to defaultMonthLabel)) }

    val numericAmount = amountText.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
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
                            if (durationMonths > 1) "Valor total pago ($durationMonths meses) (€)"
                            else "Valor (€)"
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
                                text = "Conta 1 mensalidade/mês (${coveredMonths.firstOrNull()?.second.orEmpty()} → ${coveredMonths.lastOrNull()?.second.orEmpty()})",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
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
                onClick = {
                    onConfirm(selectedMonth.first, selectedMonth.second, numericAmount, selectedMethod, durationMonths)
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
fun FidelizacaoDialog(
    clientName: String,
    existing: FidelizacaoRecord?,
    onDismiss: () -> Unit,
    onSave: (Int, Long, String) -> Unit
) {
    var durationMonths by remember { mutableIntStateOf(existing?.durationMonths ?: 6) }
    var startOffsetMonths by remember { mutableIntStateOf(0) }
    var notes by remember { mutableStateOf(existing?.notes ?: "Plano $durationMonths meses") }

    val startMillis = remember(startOffsetMonths, existing) {
        if (existing != null && startOffsetMonths == 0) existing.startDateMillis
        else Calendar.getInstance().apply { add(Calendar.MONTH, startOffsetMonths) }.timeInMillis
    }
    val previewEndMillis = remember(startMillis, durationMonths) {
        Calendar.getInstance().apply {
            timeInMillis = startMillis
            add(Calendar.MONTH, durationMonths)
        }.timeInMillis
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Fidelização · $clientName", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Período de fidelização", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(6, 12).forEach { m ->
                        FilterChip(
                            selected = durationMonths == m,
                            onClick = { durationMonths = m },
                            label = { Text("$m Meses") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Text("Data de início", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(0 to "Hoje", -1 to "-1 mês", 1 to "+1 mês").forEach { (off, lbl) ->
                        FilterChip(
                            selected = startOffsetMonths == off,
                            onClick = { startOffsetMonths = off },
                            label = { Text(lbl) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Text(
                    text = "Início: ${formatShortDate(startMillis)} → Fim: ${formatShortDate(previewEndMillis)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = NewShapeGoldBright
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas do contrato") },
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar Fidelização",
                onClick = { onSave(durationMonths, startMillis, notes) }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
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
