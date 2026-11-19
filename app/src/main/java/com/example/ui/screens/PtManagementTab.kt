package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun PtManagementTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    initialSubTab: Int = 0,
    initialChatClientId: String? = null
) {
    var selectedSubTab by remember(initialSubTab) { mutableIntStateOf(initialSubTab) }
    var activeChatClientId by remember(initialChatClientId) { mutableStateOf(initialChatClientId) }

    val subTabs = listOf("Finanças", "Fidelizações", "Chat")

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                Tab(
                    selected = selectedSubTab == idx,
                    onClick = {
                        selectedSubTab = idx
                        if (idx != 2) activeChatClientId = null
                    },
                    modifier = Modifier.testTag("pt_mgmt_subtab_$idx"),
                    text = {
                        Text(
                            text = title,
                            fontWeight = if (selectedSubTab == idx) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedSubTab == idx) NewShapeGold else TextSecondaryDark
                        )
                    }
                )
            }
        }

        when (selectedSubTab) {
            0 -> FinancesSection(state = state, viewModel = viewModel)
            1 -> FidelizacoesSection(state = state, viewModel = viewModel)
            2 -> PtChatSection(
                state = state,
                viewModel = viewModel,
                activeChatClientId = activeChatClientId,
                onSelectClient = { activeChatClientId = it }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FinancesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }
    var showAddPaymentChooser by remember { mutableStateOf(false) }
    var chosenClient by remember { mutableStateOf<ClientRecord?>(null) }

    val monthlyTotals = remember(state.payments) {
        state.payments
            .filter { it.paid }
            .groupBy { it.monthYear to it.monthLabel }
            .map { (key, list) -> Triple(key.first, key.second, list.sumOf { it.amountEur }) }
            .sortedBy { it.first }
            .takeLast(6)
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
                Text("Finanças", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                GoldPrimaryButton(
                    text = "+ Pagamento",
                    onClick = { showAddPaymentChooser = true },
                    testTag = "finances_add_payment_btn"
                )
            }
        }

        // 3 KPI Metric Cards requested by user
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                FinanceMetricCard(
                    title = "Total Faturação",
                    value = "€${String.format("%.2f", state.totalRevenueEur)}",
                    accent = NewShapeGoldBright,
                    modifier = Modifier.weight(1f)
                )
                FinanceMetricCard(
                    title = "Mensalidades Pagas",
                    value = state.paidPaymentsCount.toString(),
                    accent = ConfirmedGreen,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            FinanceMetricCard(
                title = "Média Mensal de Faturação",
                value = "€${String.format("%.2f", state.monthlyAverageRevenueEur)} / mês",
                accent = InfoBlue,
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Native Compose Canvas Bar Chart
        if (monthlyTotals.isNotEmpty()) {
            item {
                BrandCard {
                    Text("Evolução Mensal (€)", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                    Spacer(Modifier.height(12.dp))
                    val maxVal = (monthlyTotals.maxOfOrNull { it.third } ?: 1.0).coerceAtLeast(1.0)
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp)
                    ) {
                        val barCount = monthlyTotals.size
                        val slotWidth = size.width / barCount
                        val barWidth = (slotWidth * 0.52f).coerceAtMost(48.dp.toPx())
                        monthlyTotals.forEachIndexed { idx, (_, _, amount) ->
                            val ratio = (amount / maxVal).toFloat().coerceIn(0.05f, 1f)
                            val barHeight = size.height * ratio
                            val left = idx * slotWidth + (slotWidth - barWidth) / 2f
                            drawRoundRect(
                                color = NewShapeGold,
                                topLeft = Offset(left, size.height - barHeight),
                                size = Size(barWidth, barHeight),
                                cornerRadius = CornerRadius(8.dp.toPx(), 8.dp.toPx())
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                        monthlyTotals.forEach { (_, label, amount) ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("€${amount.toInt()}", style = MaterialTheme.typography.labelSmall, color = NewShapeGoldBright)
                                Text(label.take(3), style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                            }
                        }
                    }
                }
            }
        }

        item {
            Text("Registo de Mensalidades (${state.payments.size})", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
        }

        if (state.payments.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.AccountBalanceWallet,
                    title = "Sem pagamentos registados",
                    subtitle = "Aponta pagamentos na lista de alunos ou toca em '+ Pagamento'."
                )
            }
        } else {
            items(state.payments, key = { it.id }) { payment ->
                val clientName = clientMap[payment.clientId]?.name ?: "Aluno"
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
                            Text(clientName, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                            Text(
                                text = "${payment.monthLabel} · ${formatShortDate(payment.paidAtMillis)}${if (payment.note.isNotBlank()) " · ${payment.note}" else ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            StatusPill(
                                text = "€${String.format("%.2f", payment.amountEur)}",
                                textColor = ConfirmedGreen,
                                containerColor = ConfirmedGreenContainer
                            )
                            IconButton(onClick = { viewModel.deletePayment(payment.id) }) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar pagamento", tint = DangerRed)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddPaymentChooser) {
        val activeClients = state.clients.filter { it.active }
        var selected by remember { mutableStateOf(activeClients.firstOrNull()) }
        var expanded by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showAddPaymentChooser = false },
            containerColor = CharcoalSurface,
            title = { Text("Escolher Aluno", color = TextPrimaryDark) },
            text = {
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                    OutlinedTextField(
                        value = selected?.name ?: "Sem alunos ativos",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = darkFieldColors()
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        activeClients.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.name) },
                                onClick = {
                                    selected = c
                                    expanded = false
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                GoldPrimaryButton(
                    text = "Continuar",
                    enabled = selected != null,
                    onClick = {
                        chosenClient = selected
                        showAddPaymentChooser = false
                    }
                )
            },
            dismissButton = {
                TextButton(onClick = { showAddPaymentChooser = false }) { Text("Cancelar", color = TextSecondaryDark) }
            }
        )
    }

    chosenClient?.let { client ->
        RegisterPaymentDialog(
            clientName = client.name,
            defaultMonthYear = state.currentMonthYear,
            defaultMonthLabel = state.currentMonthLabel,
            onDismiss = { chosenClient = null },
            onConfirm = { my, ml, amt, note ->
                viewModel.recordPayment(client.id, my, ml, amt, note)
                chosenClient = null
            }
        )
    }
}

@Composable
private fun FinanceMetricCard(
    title: String,
    value: String,
    accent: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = CharcoalSurface,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            Spacer(Modifier.height(6.dp))
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = accent)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FidelizacoesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }
    var showCreateChooser by remember { mutableStateOf(false) }
    var targetClientForCreate by remember { mutableStateOf<ClientRecord?>(null) }
    var editingFid by remember { mutableStateOf<FidelizacaoRecord?>(null) }

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
                    Text("Fidelizações", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                    Text("Contratos de 6 e 12 meses", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                }
                GoldPrimaryButton(
                    text = "+ Fidelização",
                    onClick = { showCreateChooser = true },
                    testTag = "add_fidelizacao_btn"
                )
            }
        }

        if (state.fidelizacoes.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.EventRepeat,
                    title = "Sem fidelizações registadas",
                    subtitle = "Aponta quando começa e termina o período de 6 ou 12 meses de cada aluno."
                )
            }
        } else {
            items(state.fidelizacoes, key = { it.id }) { fid ->
                val clientName = clientMap[fid.clientId]?.name ?: "Aluno"
                val now = System.currentTimeMillis()
                val totalMs = (fid.endDateMillis - fid.startDateMillis).coerceAtLeast(1L)
                val elapsedMs = (now - fid.startDateMillis).coerceIn(0L, totalMs)
                val progress = (elapsedMs.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
                val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()

                BrandCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(clientName, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                            Text("${fid.durationMonths} Meses", style = MaterialTheme.typography.labelMedium, color = NewShapeGoldBright)
                        }
                        StatusPill(
                            text = if (daysLeft < 0) "Expirada" else "$daysLeft dias rest.",
                            textColor = if (daysLeft < 0) DangerRed else if (daysLeft < 30) PendingAmber else ConfirmedGreen,
                            containerColor = if (daysLeft < 0) DangerRedContainer else if (daysLeft < 30) PendingAmberContainer else ConfirmedGreenContainer
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Início: ${formatShortDate(fid.startDateMillis)}  ·  Fim: ${formatShortDate(fid.endDateMillis)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimaryDark
                    )
                    if (fid.notes.isNotBlank()) {
                        Text(fid.notes, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { progress },
                        color = NewShapeGold,
                        trackColor = ElevatedCharcoal,
                        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(999.dp))
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                        TextButton(onClick = { editingFid = fid }) {
                            Text("Editar", color = NewShapeGold)
                        }
                        TextButton(onClick = { viewModel.deleteFidelizacao(fid.id) }) {
                            Text("Apagar", color = DangerRed)
                        }
                    }
                }
            }
        }
    }

    if (showCreateChooser) {
        val activeClients = state.clients.filter { it.active }
        var selected by remember { mutableStateOf(activeClients.firstOrNull()) }
        var expanded by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showCreateChooser = false },
            containerColor = CharcoalSurface,
            title = { Text("Escolher Aluno", color = TextPrimaryDark) },
            text = {
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                    OutlinedTextField(
                        value = selected?.name ?: "Sem alunos ativos",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = darkFieldColors()
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        activeClients.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.name) },
                                onClick = {
                                    selected = c
                                    expanded = false
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                GoldPrimaryButton(
                    text = "Definir Datas",
                    enabled = selected != null,
                    onClick = {
                        targetClientForCreate = selected
                        showCreateChooser = false
                    }
                )
            },
            dismissButton = {
                TextButton(onClick = { showCreateChooser = false }) { Text("Cancelar", color = TextSecondaryDark) }
            }
        )
    }

    val dialogClient = targetClientForCreate ?: editingFid?.let { f -> clientMap[f.clientId] }
    if (dialogClient != null && (targetClientForCreate != null || editingFid != null)) {
        FidelizacaoDialog(
            clientName = dialogClient.name,
            existing = editingFid,
            onDismiss = {
                targetClientForCreate = null
                editingFid = null
            },
            onSave = { months, startMillis, notes ->
                viewModel.saveFidelizacao(dialogClient.id, months, startMillis, notes, editingFid?.id.orEmpty())
                targetClientForCreate = null
                editingFid = null
            }
        )
    }
}

@Composable
private fun PtChatSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    activeChatClientId: String?,
    onSelectClient: (String?) -> Unit
) {
    val activeClient = activeChatClientId?.let { id -> state.clients.find { it.id == id } }
    if (activeClient != null) {
        val threadMessages = state.chatMessages.filter { it.clientId == activeClient.id }
        PrivateChatScreen(
            client = activeClient,
            messages = threadMessages,
            viewerRole = "PT",
            onSendMessage = { text -> viewModel.sendChatMessage(activeClient.id, "PT", text) },
            onBack = { onSelectClient(null) }
        )
        return
    }

    val activeClients = remember(state.clients) { state.clients.filter { it.active } }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Chat Privado com Alunos", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text("Seleciona um aluno para abrir a conversa privada.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }

        if (activeClients.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.AutoMirrored.Filled.Chat,
                    title = "Sem alunos ativos",
                    subtitle = "Adiciona alunos para iniciar conversas privadas."
                )
            }
        } else {
            items(activeClients, key = { it.id }) { client ->
                val clientMsgs = state.chatMessages.filter { it.clientId == client.id }
                val lastMsg = clientMsgs.lastOrNull()
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(MaterialTheme.shapes.medium)
                        .clickable { onSelectClient(client.id) }
                        .testTag("chat_thread_${client.id}")
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(client.name, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                            Text(
                                text = lastMsg?.text ?: "Tocar para enviar mensagem...",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (lastMsg != null) TextSecondaryDark else NewShapeGold,
                                maxLines = 1
                            )
                        }
                        if (clientMsgs.isNotEmpty()) {
                            StatusPill("${clientMsgs.size}", NewShapeGoldBright, NewShapeGoldMuted)
                        }
                    }
                }
            }
        }
    }
}
