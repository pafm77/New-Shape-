package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
    val inactiveCount = remember(state.clients, state.sessions, state.bookings) {
        countInactiveActiveStudents(state.clients, state.sessions, state.bookings, 7)
    }
    val expiringFidCount = remember(state.fidelizacoes) {
        val now = System.currentTimeMillis()
        state.fidelizacoes.count { fid ->
            val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
            daysLeft <= 30
        }
    }

    val activeAnnouncementsCount = remember(state.studioAnnouncements) {
        val now = System.currentTimeMillis()
        state.studioAnnouncements.count { it.active && it.expiresAtMillis > now }
    }

    val subTabs = remember(state.isSuperAdmin, state.pendingPtApprovalsCount, state.unreadPtChatCount) {
        if (state.isSuperAdmin) {
            val teamTitle = if (state.pendingPtApprovalsCount > 0) "Equipa PT (${state.pendingPtApprovalsCount})" else "Equipa PT"
            listOf(
                "FINANCES" to "Finanças",
                "ATTENDANCE" to "Assiduidade",
                "FIDELIZACOES" to "Fidelizações",
                "CHAT" to "Chat",
                "TEAM" to teamTitle,
                "ANNOUNCEMENTS" to "Avisos",
                "GUIDE" to "Guia App (PDF)"
            )
        } else {
            listOf(
                "ATTENDANCE" to "Assiduidade",
                "FIDELIZACOES" to "Fidelizações",
                "CHAT" to "Chat",
                "ANNOUNCEMENTS" to "Avisos",
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
        ScrollableTabRow(
            selectedTabIndex = safeIndex,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            edgePadding = 12.dp,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, (key, title) ->
                val badgeNum = when (key) {
                    "CHAT" -> state.unreadPtChatCount
                    "ATTENDANCE" -> inactiveCount
                    "FIDELIZACOES" -> expiringFidCount
                    "ANNOUNCEMENTS" -> activeAnnouncementsCount
                    else -> 0
                }
                Tab(
                    selected = safeIndex == idx,
                    onClick = {
                        selectedSubTab = idx
                        if (key != "CHAT") activeChatClientId = null
                    },
                    modifier = Modifier.testTag("pt_mgmt_subtab_$key"),
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = title,
                                fontWeight = if (safeIndex == idx) FontWeight.Bold else FontWeight.Medium,
                                color = if (safeIndex == idx) NewShapeGold else TextSecondaryDark
                            )
                            if (badgeNum > 0) {
                                Badge(
                                    containerColor = if (key == "CHAT") DangerRed else PendingAmber,
                                    contentColor = if (key == "CHAT") TextPrimaryDark else TextOnGold
                                ) {
                                    Text(badgeNum.toString())
                                }
                            }
                        }
                    }
                )
            }
        }

        when (currentKey) {
            "FINANCES" -> if (state.isSuperAdmin) FinancesSection(state = state, viewModel = viewModel)
            "ATTENDANCE" -> PtAttendanceSection(state = state)
            "FIDELIZACOES" -> FidelizacoesSection(state = state, viewModel = viewModel)
            "CHAT" -> PtChatSection(
                state = state,
                viewModel = viewModel,
                activeChatClientId = activeChatClientId,
                onSelectClient = { activeChatClientId = it }
            )
            "TEAM" -> if (state.isSuperAdmin) PtTeamApprovalsSection(state = state, viewModel = viewModel)
            "ANNOUNCEMENTS" -> PtAnnouncementsSection(state = state, viewModel = viewModel)
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
    var splitTargetPayment by remember { mutableStateOf<PaymentRecord?>(null) }
    var methodFilter by remember { mutableStateOf("ALL") }
    var trainingFilter by remember { mutableStateOf("ALL") }
    var periodScope by remember { mutableStateOf("REALIZED") }

    val allPaidPayments = remember(state.payments) { state.payments.filter { it.paid } }
    val futurePrepaidPayments = remember(allPaidPayments, state.currentMonthYear) {
        allPaidPayments.filter { it.monthYear > state.currentMonthYear }
    }
    val futurePrepaidTotal = remember(futurePrepaidPayments) {
        futurePrepaidPayments.sumOf { it.amountEur }
    }
    val scopedAllPaidPayments = remember(allPaidPayments, periodScope, state.currentMonthYear) {
        when (periodScope) {
            "CURRENT_MONTH" -> allPaidPayments.filter { it.monthYear == state.currentMonthYear }
            "REALIZED" -> allPaidPayments.filter { it.monthYear <= state.currentMonthYear }
            else -> allPaidPayments
        }
    }

    val isPersonalizadoPayment: (PaymentRecord) -> Boolean = { p ->
        clientMap[p.clientId]?.trainingType == "PERSONALIZADO"
    }

    val personalizadoPayments = remember(scopedAllPaidPayments, clientMap) {
        scopedAllPaidPayments.filter(isPersonalizadoPayment)
    }
    val grupoPayments = remember(scopedAllPaidPayments, clientMap) {
        scopedAllPaidPayments.filter { !isPersonalizadoPayment(it) }
    }

    val paidPayments = remember(scopedAllPaidPayments, trainingFilter, clientMap) {
        when (trainingFilter) {
            "PERSONALIZADO" -> scopedAllPaidPayments.filter(isPersonalizadoPayment)
            "GRUPO" -> scopedAllPaidPayments.filter { !isPersonalizadoPayment(it) }
            else -> scopedAllPaidPayments
        }
    }

    val monthlyFeePayments = remember(paidPayments) {
        paidPayments.filter { !SeedCatalog.isExtraFeePayment(it.note) }
    }
    val extraFeePayments = remember(paidPayments) {
        paidPayments.filter { SeedCatalog.isExtraFeePayment(it.note) }
    }
    val extraFeeTotal = remember(extraFeePayments) {
        extraFeePayments.sumOf { it.amountEur }
    }

    val currentMonthPayments = remember(paidPayments, state.currentMonthYear) {
        paidPayments.filter { it.monthYear == state.currentMonthYear }
    }
    val currentMonthMonthlyPayments = remember(currentMonthPayments) {
        currentMonthPayments.filter { !SeedCatalog.isExtraFeePayment(it.note) }
    }
    val currentMonthExtraTotal = remember(currentMonthPayments) {
        currentMonthPayments.filter { SeedCatalog.isExtraFeePayment(it.note) }.sumOf { it.amountEur }
    }

    val currentMonthRevenue = remember(currentMonthPayments) {
        currentMonthPayments.sumOf { it.amountEur }
    }
    val currentMonthMonthlyRevenue = remember(currentMonthMonthlyPayments) {
        currentMonthMonthlyPayments.sumOf { it.amountEur }
    }
    val currentMonthMonthlyCount = currentMonthMonthlyPayments.size
    val totalRevenue = remember(paidPayments) { paidPayments.sumOf { it.amountEur } }
    val monthlyFeeTotal = remember(monthlyFeePayments) { monthlyFeePayments.sumOf { it.amountEur } }

    val monthlyAvg = remember(monthlyFeePayments, monthlyFeeTotal) {
        if (monthlyFeePayments.isEmpty()) 0.0
        else monthlyFeeTotal / monthlyFeePayments.map { it.monthYear }.distinct().size.coerceAtLeast(1)
    }
    val avgPerStudent = remember(monthlyFeePayments, monthlyFeeTotal) {
        if (monthlyFeePayments.isEmpty()) 0.0
        else monthlyFeeTotal / monthlyFeePayments.map { "${it.clientId}__${it.monthYear}" }.distinct().size.coerceAtLeast(1)
    }
    val curMonthUniqueStudents = remember(currentMonthMonthlyPayments) {
        currentMonthMonthlyPayments.map { it.clientId }.distinct().size
    }
    val curMonthAvgPerStudent = if (curMonthUniqueStudents > 0) currentMonthMonthlyRevenue / curMonthUniqueStudents else 0.0

    fun statsFor(list: List<PaymentRecord>): Triple<Double, Double, Double> {
        val total = list.sumOf { it.amountEur }
        val thisMonth = list.filter { it.monthYear == state.currentMonthYear }.sumOf { it.amountEur }
        val monthlyOnly = list.filter { !SeedCatalog.isExtraFeePayment(it.note) }
        val monthlySum = monthlyOnly.sumOf { it.amountEur }
        val pairs = monthlyOnly.map { "${it.clientId}__${it.monthYear}" }.distinct().size
        val avg = if (pairs > 0) monthlySum / pairs else 0.0
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

        // Period Scope Chips (Realized vs Current Month vs Include Future Prepaid)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                ) {
                    val futureLabel = if (futurePrepaidPayments.isNotEmpty()) {
                        "Incluir futuros (+${futurePrepaidPayments.size})"
                    } else {
                        "Incluir futuros"
                    }
                    listOf(
                        "REALIZED" to "Até este mês",
                        "CURRENT_MONTH" to "Só ${state.currentMonthLabel}",
                        "ALL_FUTURE" to futureLabel
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = periodScope == key,
                            onClick = { periodScope = key },
                            label = { Text(label, maxLines = 1) },
                            modifier = Modifier.testTag("finance_period_scope_$key"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }

                if (futurePrepaidPayments.isNotEmpty()) {
                    Surface(
                        color = NewShapeGoldMuted,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.45f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Fidelizações pré-pagas (meses futuros): ${futurePrepaidPayments.size} mensalidade(s) · €${String.format("%.2f", futurePrepaidTotal)} — contabilizadas automaticamente 1 por mês.",
                            style = MaterialTheme.typography.bodySmall,
                            color = NewShapeGoldBright,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }
        }

        // Training Type Filter Chips
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                listOf(
                    "ALL" to "Todos (${scopedAllPaidPayments.size})",
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
                        subtitle = if (currentMonthExtraTotal > 0.0) {
                            "$currentMonthMonthlyCount mens. + €${String.format("%.2f", currentMonthExtraTotal)} seguro/jóia"
                        } else {
                            "$currentMonthMonthlyCount mensalidade(s)"
                        },
                        accent = NewShapeGoldBright,
                        modifier = Modifier.weight(1f)
                    )
                    FinanceMetricCard(
                        title = "Média Mensal",
                        value = "€${String.format("%.2f", monthlyAvg)}",
                        subtitle = "só mensalidades (excl. seguro/jóia)",
                        accent = InfoBlue,
                        modifier = Modifier.weight(1f)
                    )
                }
                FinanceMetricCard(
                    title = "Média Mensal / Aluno",
                    value = "€${String.format("%.2f", avgPerStudent)}",
                    subtitle = if (curMonthUniqueStudents > 0) {
                        "${state.currentMonthLabel}: €${String.format("%.2f", curMonthAvgPerStudent)} ($curMonthUniqueStudents alunos · excl. seguro/jóia)"
                    } else {
                        "só mensalidades (excl. seguro/jóia)"
                    },
                    accent = NewShapeGoldBright,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    FinanceMetricCard(
                        title = "Mensalidades Pagas",
                        value = monthlyFeePayments.size.toString(),
                        subtitle = if (extraFeePayments.isNotEmpty()) {
                            "+ ${extraFeePayments.size} seguro/jóia (€${String.format("%.2f", extraFeeTotal)})"
                        } else {
                            "1/mês na fidelização"
                        },
                        accent = ConfirmedGreen,
                        modifier = Modifier.weight(1f)
                    )
                    FinanceMetricCard(
                        title = when (periodScope) {
                            "CURRENT_MONTH" -> "Total (${state.currentMonthLabel})"
                            "ALL_FUTURE" -> "Total (c/ futuros)"
                            else -> "Total Realizado"
                        },
                        value = "€${String.format("%.2f", totalRevenue)}",
                        subtitle = if (extraFeeTotal > 0.0) {
                            "inclui €${String.format("%.2f", extraFeeTotal)} seguro/jóia"
                        } else when (periodScope) {
                            "CURRENT_MONTH" -> "apenas mês atual"
                            "ALL_FUTURE" -> "inclui pré-pagos"
                            else -> "até este mês (1/mês)"
                        },
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
                        val isFuture = payment.monthYear > state.currentMonthYear
                        val isFid = payment.note.contains("fideliza", ignoreCase = true)
                        val category = SeedCatalog.getPaymentCategory(payment.note)
                        val isExtra = category != "MENSALIDADE"
                        val fidDetail = if (isFid) payment.note.split("·").drop(1).joinToString("·").trim().ifBlank { null } else null
                        PaymentRowCard(
                            clientName = clientObj?.name ?: "Aluno",
                            trainingType = clientObj?.trainingType ?: "GRUPO",
                            monthLabel = payment.monthLabel,
                            paidAtMillis = payment.paidAtMillis,
                            amountEur = payment.amountEur,
                            isFuture = isFuture,
                            category = category,
                            fidelizacaoDetail = fidDetail,
                            onSplit = if (!isFid && !isExtra && payment.amountEur > 0.0) { { splitTargetPayment = payment } } else null,
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
                    val isFuture = payment.monthYear > state.currentMonthYear
                    val isFid = payment.note.contains("fideliza", ignoreCase = true)
                    val category = SeedCatalog.getPaymentCategory(payment.note)
                    val isExtra = category != "MENSALIDADE"
                    PaymentRowCard(
                        clientName = clientObj?.name ?: "Aluno",
                        trainingType = clientObj?.trainingType ?: "GRUPO",
                        monthLabel = "${payment.monthLabel}${if (payment.note.isNotBlank()) " · ${payment.note}" else ""}",
                        paidAtMillis = payment.paidAtMillis,
                        amountEur = payment.amountEur,
                        isFuture = isFuture,
                        category = category,
                        fidelizacaoDetail = null,
                        onSplit = if (!isFid && !isExtra && payment.amountEur > 0.0) { { splitTargetPayment = payment } } else null,
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
            defaultDurationMonths = SeedCatalog.getEffectiveClientFidelizacaoMonths(client, state.fidelizacoes),
            onDismiss = { chosenClient = null },
            onConfirm = { my, ml, amt, method, durationMonths, seguroEur, joiaEur ->
                viewModel.recordPayment(
                    clientId = client.id,
                    monthYear = my,
                    monthLabel = ml,
                    amountEur = amt,
                    note = method,
                    durationMonths = durationMonths,
                    seguroEur = seguroEur,
                    joiaEur = joiaEur
                )
                chosenClient = null
            }
        )
    }

    splitTargetPayment?.let { payment ->
        val clientObj = clientMap[payment.clientId]
        SplitPaymentFidelizacaoDialog(
            clientName = clientObj?.name ?: "Aluno",
            payment = payment,
            defaultMonths = if (SeedCatalog.getEffectiveClientFidelizacaoMonths(clientObj, state.fidelizacoes) == 12) 12 else 6,
            onDismiss = { splitTargetPayment = null },
            onConfirm = { months ->
                viewModel.splitPaymentIntoFidelizacao(payment, months)
                splitTargetPayment = null
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
    isFuture: Boolean = false,
    category: String = "MENSALIDADE",
    fidelizacaoDetail: String? = null,
    onSplit: (() -> Unit)? = null,
    onDelete: () -> Unit
) {
    val isPersonal = trainingType == "PERSONALIZADO"
    Surface(
        color = CharcoalSurface,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                        text = "$monthLabel · ${formatShortDate(paidAtMillis)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                    if (!fidelizacaoDetail.isNullOrBlank()) {
                        Text(
                            text = fidelizacaoDetail,
                            style = MaterialTheme.typography.labelSmall,
                            color = NewShapeGoldBright
                        )
                    }
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
            if (onSplit != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(
                        onClick = onSplit,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                    ) {
                        Text(
                            text = "Dividir por 6 / 12 meses (Fidelização)",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = NewShapeGoldBright
                        )
                    }
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
    val context = LocalContext.current
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }
    var showCreateChooser by remember { mutableStateOf(false) }
    var targetClientForCreate by remember { mutableStateOf<ClientRecord?>(null) }
    var editingFid by remember { mutableStateOf<FidelizacaoRecord?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("ALL") } // ALL, EXPIRING, EXPIRED

    val now = remember(state.fidelizacoes) { System.currentTimeMillis() }

    fun renewalMessage(fid: FidelizacaoRecord, client: ClientRecord?): String {
        val rawName = client?.name ?: "aluno"
        val firstName = rawName.trim().split(" ").firstOrNull().orEmpty().ifBlank { rawName }
        val endLabel = formatShortDate(fid.endDateMillis)
        val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
        return if (daysLeft < 0) {
            "Olá $firstName! A tua fidelização de ${fid.durationMonths} meses na New Shape terminou em $endLabel. Vamos combinar a renovação para continuares a evoluir connosco? 💪"
        } else {
            "Olá $firstName! A tua fidelização de ${fid.durationMonths} meses na New Shape termina em $endLabel (faltam $daysLeft dias). Vamos combinar a renovação para manteres o teu ritmo? 💪"
        }
    }

    val expiringSoon = remember(state.fidelizacoes, now) {
        state.fidelizacoes
            .filter {
                val d = ((it.endDateMillis - now) / 86_400_000L).toInt()
                d in 0..30
            }
            .sortedBy { it.endDateMillis }
    }
    val expiredList = remember(state.fidelizacoes, now) {
        state.fidelizacoes
            .filter { ((it.endDateMillis - now) / 86_400_000L).toInt() < 0 }
            .sortedByDescending { it.endDateMillis }
    }
    val urgentAlerts = remember(expiringSoon, expiredList) { expiringSoon + expiredList }

    val filteredFidelizacoes = remember(state.fidelizacoes, clientMap, searchQuery, statusFilter, now) {
        val q = searchQuery.trim().lowercase()
        state.fidelizacoes
            .filter { fid ->
                val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
                when (statusFilter) {
                    "EXPIRING" -> daysLeft in 0..30
                    "EXPIRED" -> daysLeft < 0
                    else -> true
                }
            }
            .filter { fid ->
                if (q.isEmpty()) true
                else {
                    val c = clientMap[fid.clientId]
                    val haystack = "${c?.name.orEmpty()} ${c?.phone.orEmpty()} ${fid.notes} ${fid.durationMonths} meses".lowercase()
                    haystack.contains(q)
                }
            }
            .sortedBy { it.endDateMillis }
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
                    Text("Fidelizações", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                    Text("Contratos, alertas ≤30 dias e renovação WhatsApp", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                }
                GoldPrimaryButton(
                    text = "+ Fidelização",
                    onClick = { showCreateChooser = true },
                    testTag = "add_fidelizacao_btn"
                )
            }
        }

        if (urgentAlerts.isNotEmpty()) {
            item {
                BrandCard(highlightBorder = true) {
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
                                Icons.Default.WarningAmber,
                                contentDescription = "Renovações prioritárias",
                                tint = PendingAmber,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "Renovações Prioritárias (${urgentAlerts.size})",
                                style = MaterialTheme.typography.titleSmall,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        urgentAlerts.take(5).forEach { fid ->
                            val c = clientMap[fid.clientId]
                            val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
                            Surface(
                                color = ElevatedCharcoal,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, (if (daysLeft < 0) DangerRed else PendingAmber).copy(alpha = 0.55f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(c?.name ?: "Aluno", style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                        Text(
                                            text = if (daysLeft < 0) "Expirada · Fim ${formatShortDate(fid.endDateMillis)}"
                                            else "Termina em $daysLeft dias (${formatShortDate(fid.endDateMillis)})",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (daysLeft < 0) DangerRed else PendingAmber
                                        )
                                    }
                                    TextButton(
                                        onClick = {
                                            openWhatsApp(
                                                context,
                                                c?.phone?.ifBlank { null },
                                                renewalMessage(fid, c),
                                                state.settings.whatsappWebMode
                                            )
                                        },
                                        modifier = Modifier.testTag("fid_alert_wa_${fid.id}")
                                    ) {
                                        Text("Renovar", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (state.fidelizacoes.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Pesquisar aluno por nome, telemóvel ou notas...") },
                        singleLine = true,
                        leadingIcon = {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = "Pesquisar aluno",
                                tint = TextSecondaryDark
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Limpar pesquisa",
                                        tint = TextSecondaryDark
                                    )
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("fidelizacoes_search_input"),
                        colors = darkFieldColors()
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            "ALL" to "Todas (${state.fidelizacoes.size})",
                            "EXPIRING" to "≤30 dias (${expiringSoon.size})",
                            "EXPIRED" to "Expiradas (${expiredList.size})"
                        ).forEach { (key, label) ->
                            FilterChip(
                                selected = statusFilter == key,
                                onClick = { statusFilter = key },
                                label = { Text(label, fontWeight = FontWeight.Bold) },
                                modifier = Modifier.testTag("fid_filter_${key.lowercase()}"),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = NewShapeGold,
                                    selectedLabelColor = TextOnGold
                                )
                            )
                        }
                    }
                }
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
        } else if (filteredFidelizacoes.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.Search,
                    title = "Nenhum aluno encontrado",
                    subtitle = if (searchQuery.isNotBlank()) {
                        "Sem fidelizações correspondentes a \"${searchQuery.trim()}\"."
                    } else {
                        "Sem fidelizações neste filtro."
                    }
                )
            }
        } else {
            items(filteredFidelizacoes, key = { it.id }) { fid ->
                val client = clientMap[fid.clientId]
                val clientName = client?.name ?: "Aluno"
                val totalMs = (fid.endDateMillis - fid.startDateMillis).coerceAtLeast(1L)
                val elapsedMs = (now - fid.startDateMillis).coerceIn(0L, totalMs)
                val progress = (elapsedMs.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
                val daysLeft = ((fid.endDateMillis - now) / 86_400_000L).toInt()
                val isUrgent = daysLeft <= 30

                BrandCard(highlightBorder = isUrgent) {
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
                            textColor = if (daysLeft < 0) DangerRed else if (daysLeft <= 30) PendingAmber else ConfirmedGreen,
                            containerColor = if (daysLeft < 0) DangerRedContainer else if (daysLeft <= 30) PendingAmberContainer else ConfirmedGreenContainer
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
                        color = if (daysLeft < 0) DangerRed else if (daysLeft <= 30) PendingAmber else NewShapeGold,
                        trackColor = ElevatedCharcoal,
                        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(999.dp))
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        TextButton(
                            onClick = {
                                openWhatsApp(
                                    context,
                                    client?.phone?.ifBlank { null },
                                    renewalMessage(fid, client),
                                    state.settings.whatsappWebMode
                                )
                            },
                            modifier = Modifier.testTag("fid_wa_renew_${fid.id}")
                        ) {
                            Text("WhatsApp Renovação", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                        }
                        Row {
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
            isSuperAdmin = state.isSuperAdmin,
            defaultMonthlyFeeEur = dialogClient.monthlyFeeEur,
            onDismiss = {
                targetClientForCreate = null
                editingFid = null
            },
            onSave = { months, startMillis, endMillis, notes ->
                viewModel.saveFidelizacao(
                    clientId = dialogClient.id,
                    durationMonths = months,
                    startDateMillis = startMillis,
                    notes = notes,
                    existingId = editingFid?.id.orEmpty(),
                    customEndDateMillis = if (state.isSuperAdmin) endMillis else null
                )
                targetClientForCreate = null
                editingFid = null
            },
            onSaveWithPayment = { months, startMillis, endMillis, notes, totalPaidEur, method ->
                viewModel.saveFidelizacao(
                    clientId = dialogClient.id,
                    durationMonths = months,
                    startDateMillis = startMillis,
                    notes = notes,
                    existingId = "",
                    customEndDateMillis = if (state.isSuperAdmin) endMillis else null
                )
                val startCal = java.util.Calendar.getInstance().apply { timeInMillis = startMillis }
                val monthsPt = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
                val my = String.format("%04d-%02d", startCal.get(java.util.Calendar.YEAR), startCal.get(java.util.Calendar.MONTH) + 1)
                val ml = "${monthsPt[startCal.get(java.util.Calendar.MONTH)]} ${startCal.get(java.util.Calendar.YEAR)}"
                viewModel.recordPayment(
                    clientId = dialogClient.id,
                    monthYear = my,
                    monthLabel = ml,
                    amountEur = totalPaidEur,
                    note = method,
                    durationMonths = months,
                    skipAutoFidelizacao = true
                )
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
            onMarkRead = { viewModel.markChatThreadRead(activeClient.id, "PT") },
            onBack = { onSelectClient(null) }
        )
        return
    }

    val sortedThreads = remember(state.clients, state.chatMessages) {
        val activeClients = state.clients.filter { it.active }
        val msgsByClient = state.chatMessages.groupBy { it.clientId }
        activeClients
            .map { client ->
                val msgs = msgsByClient[client.id].orEmpty()
                val unreadMsgs = msgs.filter { it.senderRole == "STUDENT" && it.readAtMillis == 0L }
                val lastMsg = msgs.lastOrNull()
                val latestUnreadTs = unreadMsgs.lastOrNull()?.timestampMillis ?: 0L
                val latestMsgTs = lastMsg?.timestampMillis ?: 0L
                Triple(client, unreadMsgs.size, Triple(lastMsg, latestUnreadTs, latestMsgTs))
            }
            .sortedWith(
                compareByDescending<Triple<ClientRecord, Int, Triple<com.example.data.model.ChatMessageRecord?, Long, Long>>> {
                    if (it.second > 0) 1 else 0
                }
                    .thenByDescending { it.third.second }
                    .thenByDescending { it.third.third }
                    .thenBy { it.first.name.lowercase() }
            )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Chat Privado com Alunos", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                    Text("Mensagens por ler aparecem automaticamente no topo.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                }
                if (state.unreadPtChatCount > 0) {
                    StatusPill(
                        text = "${state.unreadPtChatCount} por ler",
                        textColor = DangerRed,
                        containerColor = DangerRedContainer
                    )
                }
            }
        }

        if (sortedThreads.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.AutoMirrored.Filled.Chat,
                    title = "Sem alunos ativos",
                    subtitle = "Adiciona alunos para iniciar conversas privadas."
                )
            }
        } else {
            items(sortedThreads, key = { it.first.id }) { (client, unreadCount, meta) ->
                val lastMsg = meta.first
                val hasUnread = unreadCount > 0
                Surface(
                    color = if (hasUnread) ElevatedCharcoal else CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, if (hasUnread) NewShapeGold else HairlineBorder),
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
                            Text(
                                text = client.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.SemiBold,
                                color = TextPrimaryDark
                            )
                            Spacer(Modifier.height(2.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                if (lastMsg != null && lastMsg.senderRole == "PT") {
                                    ChatReceiptStatusIcon(message = lastMsg, onGoldBubble = false)
                                }
                                Text(
                                    text = when {
                                        lastMsg == null -> "Tocar para enviar mensagem..."
                                        lastMsg.senderRole == "PT" -> "Tu: ${lastMsg.text}"
                                        else -> lastMsg.text
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Normal,
                                    color = when {
                                        hasUnread -> TextPrimaryDark
                                        lastMsg != null -> TextSecondaryDark
                                        else -> NewShapeGold
                                    },
                                    maxLines = 1
                                )
                            }
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(
                            horizontalAlignment = Alignment.End,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (lastMsg != null) {
                                Text(
                                    text = formatTimeAgo(lastMsg.timestampMillis),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (hasUnread) NewShapeGoldBright else TextSecondaryDark
                                )
                            }
                            if (hasUnread) {
                                Badge(
                                    containerColor = DangerRed,
                                    contentColor = TextPrimaryDark
                                ) {
                                    Text(unreadCount.toString())
                                }
                            }
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
