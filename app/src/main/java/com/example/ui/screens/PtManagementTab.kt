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
import android.widget.Toast
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.data.model.PaymentRecord
import com.example.data.model.PtAccountRecord
import com.example.data.model.SUPER_ADMIN_EMAIL
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
    val subTabs = remember(state.isSuperAdmin, state.pendingPtApprovalsCount) {
        if (state.isSuperAdmin) {
            val teamTitle = if (state.pendingPtApprovalsCount > 0) "Equipa PT (${state.pendingPtApprovalsCount})" else "Equipa PT"
            listOf(
                "FINANCES" to "Finanças",
                "FIDELIZACOES" to "Fidelizações",
                "CHAT" to "Chat",
                "TEAM" to teamTitle,
                "GUIDE" to "Guia App (PDF)"
            )
        } else {
            listOf(
                "FIDELIZACOES" to "Fidelizações",
                "CHAT" to "Chat",
                "GUIDE" to "Guia App (PDF)"
            )
        }
    }

    var selectedSubTab by remember(initialSubTab, state.isSuperAdmin) {
        mutableIntStateOf(initialSubTab.coerceIn(0, subTabs.lastIndex))
    }
    var activeChatClientId by remember(initialChatClientId) { mutableStateOf(initialChatClientId) }

    val safeIndex = selectedSubTab.coerceIn(0, subTabs.lastIndex)
    val currentKey = subTabs[safeIndex].first

    Column(modifier = Modifier.fillMaxSize()) {
        if (subTabs.size > 3) {
            ScrollableTabRow(
                selectedTabIndex = safeIndex,
                containerColor = CharcoalSurface,
                contentColor = NewShapeGold,
                edgePadding = 12.dp,
                divider = { HorizontalDivider(color = HairlineBorder) }
            ) {
                subTabs.forEachIndexed { idx, (key, title) ->
                    Tab(
                        selected = safeIndex == idx,
                        onClick = {
                            selectedSubTab = idx
                            if (key != "CHAT") activeChatClientId = null
                        },
                        modifier = Modifier.testTag("pt_mgmt_subtab_$key"),
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (safeIndex == idx) FontWeight.Bold else FontWeight.Medium,
                                color = if (safeIndex == idx) NewShapeGold else TextSecondaryDark
                            )
                        }
                    )
                }
            }
        } else {
            TabRow(
                selectedTabIndex = safeIndex,
                containerColor = CharcoalSurface,
                contentColor = NewShapeGold,
                divider = { HorizontalDivider(color = HairlineBorder) }
            ) {
                subTabs.forEachIndexed { idx, (key, title) ->
                    Tab(
                        selected = safeIndex == idx,
                        onClick = {
                            selectedSubTab = idx
                            if (key != "CHAT") activeChatClientId = null
                        },
                        modifier = Modifier.testTag("pt_mgmt_subtab_$key"),
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (safeIndex == idx) FontWeight.Bold else FontWeight.Medium,
                                color = if (safeIndex == idx) NewShapeGold else TextSecondaryDark
                            )
                        }
                    )
                }
            }
        }

        when (currentKey) {
            "FINANCES" -> if (state.isSuperAdmin) FinancesSection(state = state, viewModel = viewModel)
            "FIDELIZACOES" -> FidelizacoesSection(state = state, viewModel = viewModel)
            "CHAT" -> PtChatSection(
                state = state,
                viewModel = viewModel,
                activeChatClientId = activeChatClientId,
                onSelectClient = { activeChatClientId = it }
            )
            "TEAM" -> if (state.isSuperAdmin) PtTeamApprovalsSection(state = state, viewModel = viewModel)
            "GUIDE" -> PtAppInstallGuideSection(state = state)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FinancesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }
    var showAddPaymentChooser by remember { mutableStateOf(false) }
    var chosenClient by remember { mutableStateOf<ClientRecord?>(null) }
    var methodFilter by remember { mutableStateOf("ALL") }
    var trainingFilter by remember { mutableStateOf("ALL") }

    val allPaidPayments = remember(state.payments) { state.payments.filter { it.paid } }
    val isPersonalizadoPayment: (PaymentRecord) -> Boolean = { p ->
        clientMap[p.clientId]?.trainingType == "PERSONALIZADO"
    }

    val personalizadoPayments = remember(allPaidPayments, clientMap) {
        allPaidPayments.filter(isPersonalizadoPayment)
    }
    val grupoPayments = remember(allPaidPayments, clientMap) {
        allPaidPayments.filter { !isPersonalizadoPayment(it) }
    }

    val paidPayments = remember(allPaidPayments, trainingFilter, clientMap) {
        when (trainingFilter) {
            "PERSONALIZADO" -> allPaidPayments.filter(isPersonalizadoPayment)
            "GRUPO" -> allPaidPayments.filter { !isPersonalizadoPayment(it) }
            else -> allPaidPayments
        }
    }

    val currentMonthRevenue = remember(paidPayments, state.currentMonthYear) {
        paidPayments.filter { it.monthYear == state.currentMonthYear }.sumOf { it.amountEur }
    }
    val currentMonthCount = remember(paidPayments, state.currentMonthYear) {
        paidPayments.count { it.monthYear == state.currentMonthYear }
    }
    val totalRevenue = remember(paidPayments) { paidPayments.sumOf { it.amountEur } }
    val monthlyAvg = remember(paidPayments, totalRevenue) {
        if (paidPayments.isEmpty()) 0.0
        else totalRevenue / paidPayments.map { it.monthYear }.distinct().size.coerceAtLeast(1)
    }
    val avgPerStudent = remember(paidPayments, totalRevenue) {
        if (paidPayments.isEmpty()) 0.0
        else totalRevenue / paidPayments.map { "${it.clientId}__${it.monthYear}" }.distinct().size.coerceAtLeast(1)
    }
    val curMonthUniqueStudents = remember(paidPayments, state.currentMonthYear) {
        paidPayments.filter { it.monthYear == state.currentMonthYear }.map { it.clientId }.distinct().size
    }
    val curMonthAvgPerStudent = if (curMonthUniqueStudents > 0) currentMonthRevenue / curMonthUniqueStudents else 0.0

    fun statsFor(list: List<PaymentRecord>): Triple<Double, Double, Double> {
        val total = list.sumOf { it.amountEur }
        val thisMonth = list.filter { it.monthYear == state.currentMonthYear }.sumOf { it.amountEur }
        val pairs = list.map { "${it.clientId}__${it.monthYear}" }.distinct().size
        val avg = if (pairs > 0) total / pairs else 0.0
        return Triple(total, thisMonth, avg)
    }
    val (persTotal, persMonth, persAvg) = remember(personalizadoPayments, state.currentMonthYear) { statsFor(personalizadoPayments) }
    val (grpTotal, grpMonth, grpAvg) = remember(grupoPayments, state.currentMonthYear) { statsFor(grupoPayments) }

    val groupedByMethod = remember(paidPayments) {
        val groups = linkedMapOf(
            "MbWay" to mutableListOf<PaymentRecord>(),
            "Dinheiro" to mutableListOf<PaymentRecord>(),
            "João" to mutableListOf<PaymentRecord>()
        )
        val other = mutableListOf<PaymentRecord>()
        paidPayments.forEach { p ->
            val m = SeedCatalog.normalizePaymentMethod(p.note)
            if (m != null) groups[m]?.add(p) else other.add(p)
        }
        groups to other
    }
    val methodGroups = groupedByMethod.first
    val otherMethodPayments = groupedByMethod.second

    val visibleMethods = remember(methodFilter) {
        if (methodFilter == "ALL") SeedCatalog.PAYMENT_METHODS else listOf(methodFilter)
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
                Column(modifier = Modifier.weight(1f)) {
                    Text("Finanças", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                    Text(
                        "Personalizado vs Grupo · Fidelizações divididas/mês",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
                GoldPrimaryButton(
                    text = "+ Pagamento",
                    onClick = { showAddPaymentChooser = true },
                    testTag = "finances_add_payment_btn"
                )
            }
        }

        // Training Type Filter Chips
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                listOf(
                    "ALL" to "Todos (${allPaidPayments.size})",
                    "PERSONALIZADO" to "Personalizado (${personalizadoPayments.size})",
                    "GRUPO" to "Grupo (${grupoPayments.size})"
                ).forEach { (key, label) ->
                    FilterChip(
                        selected = trainingFilter == key,
                        onClick = { trainingFilter = key },
                        label = { Text(label, maxLines = 1) },
                        modifier = Modifier.testTag("finance_type_filter_$key"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
            }
        }

        // Personalizado vs Grupo Comparison Card
        item {
            BrandCard {
                Text("Treino Personalizado vs Treino em Grupo", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        color = if (trainingFilter == "PERSONALIZADO") NewShapeGoldMuted else ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (trainingFilter == "PERSONALIZADO") NewShapeGold else HairlineBorder),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { trainingFilter = if (trainingFilter == "PERSONALIZADO") "ALL" else "PERSONALIZADO" }
                            .testTag("finance_card_personalizado")
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            StatusPill("Personalizado", NewShapeGoldBright, NewShapeGoldMuted)
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "€${String.format("%.2f", persTotal)}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = NewShapeGoldBright
                            )
                            Text(
                                "${state.currentMonthLabel}: €${String.format("%.2f", persMonth)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextPrimaryDark
                            )
                            Text(
                                "Média/aluno: €${String.format("%.2f", persAvg)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                    }
                    Surface(
                        color = if (trainingFilter == "GRUPO") InfoBlueContainer else ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (trainingFilter == "GRUPO") InfoBlue else HairlineBorder),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { trainingFilter = if (trainingFilter == "GRUPO") "ALL" else "GRUPO" }
                            .testTag("finance_card_grupo")
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            StatusPill("Grupo", InfoBlue, InfoBlueContainer)
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "€${String.format("%.2f", grpTotal)}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = InfoBlue
                            )
                            Text(
                                "${state.currentMonthLabel}: €${String.format("%.2f", grpMonth)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextPrimaryDark
                            )
                            Text(
                                "Média/aluno: €${String.format("%.2f", grpAvg)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                    }
                }
            }
        }

        // KPI Metric Cards (Filtered by Training Type)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    FinanceMetricCard(
                        title = "Faturação (${state.currentMonthLabel})",
                        value = "€${String.format("%.2f", currentMonthRevenue)}",
                        subtitle = "$currentMonthCount mensalidade(s)",
                        accent = NewShapeGoldBright,
                        modifier = Modifier.weight(1f)
                    )
                    FinanceMetricCard(
                        title = "Média Mensal",
                        value = "€${String.format("%.2f", monthlyAvg)}",
                        subtitle = "por mês com registo",
                        accent = InfoBlue,
                        modifier = Modifier.weight(1f)
                    )
                }
                FinanceMetricCard(
                    title = "Média Mensal / Aluno",
                    value = "€${String.format("%.2f", avgPerStudent)}",
                    subtitle = if (curMonthUniqueStudents > 0) {
                        "${state.currentMonthLabel}: €${String.format("%.2f", curMonthAvgPerStudent)} ($curMonthUniqueStudents alunos)"
                    } else {
                        "média por aluno / mês"
                    },
                    accent = NewShapeGoldBright,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    FinanceMetricCard(
                        title = "Mensalidades Pagas",
                        value = paidPayments.size.toString(),
                        subtitle = "1/mês na fidelização",
                        accent = ConfirmedGreen,
                        modifier = Modifier.weight(1f)
                    )
                    FinanceMetricCard(
                        title = "Total Faturação",
                        value = "€${String.format("%.2f", totalRevenue)}",
                        subtitle = "soma de todos os meses",
                        accent = NewShapeGold,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Admin-Only 6-Month Personalizado vs Grupo Finance Chart
        if (state.isSuperAdmin) {
            item(key = "finance_chart_6m") {
                FinanceChart(
                    payments = state.payments,
                    clients = state.clients,
                    isSuperAdmin = state.isSuperAdmin
                )
            }
            item(key = "finance_admin_tools") {
                FinanceAdminTools(
                    isSuperAdmin = state.isSuperAdmin,
                    currentMonthYear = state.currentMonthYear,
                    currentMonthLabel = state.currentMonthLabel,
                    clients = state.clients,
                    payments = state.payments,
                    fidelizacoes = state.fidelizacoes,
                    whatsappWebMode = state.settings.whatsappWebMode,
                    onQuickPayClient = { chosenClient = it },
                    onBanner = { msg -> Toast.makeText(context, msg, Toast.LENGTH_SHORT).show() }
                )
            }
        }

        // Summary by Method & Filter Chips
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Faturação por Método", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    SeedCatalog.PAYMENT_METHODS.forEach { method ->
                        val list = methodGroups[method].orEmpty()
                        val subtotal = list.sumOf { it.amountEur }
                        val selected = methodFilter == method
                        Surface(
                            color = if (selected) NewShapeGoldMuted else CharcoalSurface,
                            shape = MaterialTheme.shapes.medium,
                            border = BorderStroke(1.dp, if (selected) NewShapeGold else HairlineBorder),
                            modifier = Modifier
                                .weight(1f)
                                .clip(MaterialTheme.shapes.medium)
                                .clickable { methodFilter = if (selected) "ALL" else method }
                                .testTag("finance_method_summary_$method")
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(method, style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    "€${String.format("%.0f", subtotal)}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = NewShapeGoldBright
                                )
                                Text(
                                    "${list.size} reg.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    FilterChip(
                        selected = methodFilter == "ALL",
                        onClick = { methodFilter = "ALL" },
                        label = { Text("Todas (${paidPayments.size})") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                    SeedCatalog.PAYMENT_METHODS.forEach { method ->
                        FilterChip(
                            selected = methodFilter == method,
                            onClick = { methodFilter = method },
                            label = { Text("$method (${methodGroups[method]?.size ?: 0})") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
            }
        }

        if (paidPayments.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.AccountBalanceWallet,
                    title = "Sem pagamentos registados",
                    subtitle = "Aponta pagamentos na lista de alunos ou toca em '+ Pagamento'."
                )
            }
        } else {
            visibleMethods.forEach { methodName ->
                val methodList = methodGroups[methodName].orEmpty()
                val subtotal = methodList.sumOf { it.amountEur }
                val listTitle = if (methodName == "Dinheiro") {
                    "Pagamentos em Dinheiro"
                } else {
                    "Pagamentos por $methodName"
                }

                item(key = "header_$methodName") {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(listTitle, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                            Text(
                                "${methodList.size} mensalidade(s) registada(s)",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        StatusPill(
                            text = "€${String.format("%.2f", subtotal)}",
                            textColor = NewShapeGoldBright,
                            containerColor = NewShapeGoldMuted
                        )
                    }
                }

                if (methodList.isEmpty()) {
                    item(key = "empty_$methodName") {
                        Surface(
                            color = CharcoalSurface,
                            shape = MaterialTheme.shapes.medium,
                            border = BorderStroke(1.dp, HairlineBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Sem pagamentos registados por $methodName.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark,
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    }
                } else {
                    items(methodList, key = { "${methodName}_${it.id}" }) { payment ->
                        val clientObj = clientMap[payment.clientId]
                        PaymentRowCard(
                            clientName = clientObj?.name ?: "Aluno",
                            trainingType = clientObj?.trainingType ?: "GRUPO",
                            monthLabel = payment.monthLabel,
                            paidAtMillis = payment.paidAtMillis,
                            amountEur = payment.amountEur,
                            onDelete = { viewModel.deletePayment(payment.id) }
                        )
                    }
                }
            }

            if (methodFilter == "ALL" && otherMethodPayments.isNotEmpty()) {
                item(key = "header_other") {
                    Text(
                        "Outros Registos (histórico antigo)",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimaryDark,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                items(otherMethodPayments, key = { "other_${it.id}" }) { payment ->
                    val clientObj = clientMap[payment.clientId]
                    PaymentRowCard(
                        clientName = clientObj?.name ?: "Aluno",
                        trainingType = clientObj?.trainingType ?: "GRUPO",
                        monthLabel = "${payment.monthLabel}${if (payment.note.isNotBlank()) " · ${payment.note}" else ""}",
                        paidAtMillis = payment.paidAtMillis,
                        amountEur = payment.amountEur,
                        onDelete = { viewModel.deletePayment(payment.id) }
                    )
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
            defaultAmountEur = if (client.monthlyFeeEur > 0.0) client.monthlyFeeEur else 120.0,
            defaultDurationMonths = client.fidelizacaoMonths,
            onDismiss = { chosenClient = null },
            onConfirm = { my, ml, amt, method, durationMonths ->
                viewModel.recordPayment(client.id, my, ml, amt, method, durationMonths)
                chosenClient = null
            }
        )
    }
}

@Composable
private fun PaymentRowCard(
    clientName: String,
    trainingType: String,
    monthLabel: String,
    paidAtMillis: Long,
    amountEur: Double,
    onDelete: () -> Unit
) {
    val isPersonal = trainingType == "PERSONALIZADO"
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(clientName, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                    StatusPill(
                        text = if (isPersonal) "Personalizado" else "Grupo",
                        textColor = if (isPersonal) NewShapeGoldBright else InfoBlue,
                        containerColor = if (isPersonal) NewShapeGoldMuted else InfoBlueContainer
                    )
                }
                Text(
                    text = "$monthLabel · ${formatShortDate(paidAtMillis)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusPill(
                    text = "€${String.format("%.2f", amountEur)}",
                    textColor = ConfirmedGreen,
                    containerColor = ConfirmedGreenContainer
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar pagamento", tint = DangerRed)
                }
            }
        }
    }
}

@Composable
private fun FinanceMetricCard(
    title: String,
    value: String,
    subtitle: String? = null,
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
            if (subtitle != null) {
                Spacer(Modifier.height(2.dp))
                Text(subtitle, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            }
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

@Composable
private fun PtTeamApprovalsSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val pendingAccounts = remember(state.allPtAccounts) { state.allPtAccounts.filter { it.status == "PENDING" } }
    val reviewedAccounts = remember(state.allPtAccounts) { state.allPtAccounts.filter { it.status != "PENDING" } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard(highlightBorder = true) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.AdminPanelSettings, contentDescription = "Administrador", tint = NewShapeGoldBright)
                    Text("Gestão da Equipa PT (Admin)", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Apenas o administrador ($SUPER_ADMIN_EMAIL) tem acesso à faturação e pode confirmar novos Personal Trainers que se registem na aplicação.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
        }

        item {
            Text(
                text = "Pedidos pendentes (${pendingAccounts.size})",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimaryDark
            )
        }

        if (pendingAccounts.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.VerifiedUser,
                    title = "Sem pedidos pendentes",
                    subtitle = "Quando um novo PT se registar na aplicação, o pedido aparece aqui para aprovares."
                )
            }
        } else {
            items(pendingAccounts, key = { it.uid }) { pt ->
                PtAccountApprovalCard(
                    pt = pt,
                    onApprove = { viewModel.reviewPtAccount(pt.uid, "APPROVED") },
                    onReject = { viewModel.reviewPtAccount(pt.uid, "REJECTED") }
                )
            }
        }

        if (reviewedAccounts.isNotEmpty()) {
            item {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "PTs registados (${reviewedAccounts.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimaryDark
                )
            }
            items(reviewedAccounts, key = { it.uid }) { pt ->
                PtAccountApprovalCard(
                    pt = pt,
                    onApprove = { viewModel.reviewPtAccount(pt.uid, "APPROVED") },
                    onReject = { viewModel.reviewPtAccount(pt.uid, "REJECTED") }
                )
            }
        }
    }
}

@Composable
private fun PtAccountApprovalCard(
    pt: PtAccountRecord,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val isPending = pt.status == "PENDING"
    val isApproved = pt.status == "APPROVED"

    BrandCard(highlightBorder = isPending) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = pt.displayName.ifBlank { pt.email },
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimaryDark
                )
                Text(pt.email, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                if (pt.requestedAtMillis > 0L) {
                    Text(
                        text = "Pedido: ${formatShortDate(pt.requestedAtMillis)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }
            StatusPill(
                text = when {
                    pt.isAdmin -> "Admin"
                    isApproved -> "Aprovado ✓"
                    isPending -> "Pendente"
                    else -> "Recusado"
                },
                textColor = when {
                    pt.isAdmin -> TextOnGold
                    isApproved -> ConfirmedGreen
                    isPending -> PendingAmber
                    else -> DangerRed
                },
                containerColor = when {
                    pt.isAdmin -> NewShapeGold
                    isApproved -> ConfirmedGreenContainer
                    isPending -> PendingAmberContainer
                    else -> DangerRedContainer
                }
            )
        }

        if (!pt.isAdmin) {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                if (!isApproved) {
                    GoldPrimaryButton(
                        text = "Confirmar PT",
                        icon = Icons.Default.Check,
                        onClick = onApprove,
                        modifier = Modifier.weight(1f),
                        testTag = "approve_pt_${pt.uid}"
                    )
                }
                if (isPending || isApproved) {
                    DarkSecondaryButton(
                        text = if (isApproved) "Revogar acesso" else "Recusar",
                        icon = Icons.Default.Close,
                        onClick = onReject,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}
