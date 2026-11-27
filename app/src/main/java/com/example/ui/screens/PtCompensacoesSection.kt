package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ClientMakeupSummary
import com.example.data.ComputedMakeupStatus
import com.example.data.MakeupCreditCalculator
import com.example.data.model.ClientRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
internal fun PtCompensacoesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    var filterMode by remember { mutableStateOf("ELIGIBLE") } // ELIGIBLE | BOOKED | ABSENT | ALL
    var searchQuery by remember { mutableStateOf("") }
    var expandedClientIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var manualCreditTarget by remember { mutableStateOf<ClientRecord?>(null) }

    val activeClients = remember(state.clients) {
        state.clients.filter { it.active }.sortedBy { it.name.lowercase() }
    }
    val activeWeekKey = state.activeWeek?.weekKey.orEmpty()
    val makeupClientIdsThisWeek = remember(state.bookings, activeWeekKey) {
        MakeupCreditCalculator.getMakeupClientIdsForWeek(state.bookings, activeWeekKey)
    }

    val summariesByClient = remember(
        activeClients,
        state.weeks,
        state.sessions,
        state.bookings,
        state.weekResponses,
        state.makeupCredits
    ) {
        MakeupCreditCalculator.computeAllClients(
            clients = activeClients,
            weeks = state.weeks,
            sessions = state.sessions,
            bookings = state.bookings,
            weekResponses = state.weekResponses,
            makeupCredits = state.makeupCredits
        )
    }

    val rows = remember(activeClients, summariesByClient, makeupClientIdsThisWeek) {
        activeClients.map { client ->
            val summary = summariesByClient[client.id] ?: ClientMakeupSummary(
                clientId = client.id,
                availableCount = 0,
                usedCount = 0,
                expiredCount = 0,
                activeMakeupBookingsCount = 0,
                absentCount30d = 0,
                removedCount30d = 0,
                missedWeekCount30d = 0,
                manualCount30d = 0,
                totalAbsencesAllTime = 0,
                nearestExpiryDays = null,
                credits = emptyList()
            )
            Triple(client, summary, client.id in makeupClientIdsThisWeek)
        }.sortedWith(
            compareByDescending<Triple<ClientRecord, ClientMakeupSummary, Boolean>> { it.second.availableCount }
                .thenByDescending { it.third }
                .thenByDescending { it.second.totalAbsencesAllTime }
                .thenBy { it.first.name.lowercase() }
        )
    }

    val eligibleCount = remember(rows) { rows.count { it.second.availableCount > 0 } }
    val totalAvailableCredits = remember(rows) { rows.sumOf { it.second.availableCount } }
    val activeMakeupStudentsCount = remember(rows) { rows.count { it.third } }
    val totalAbsences30d = remember(rows) { rows.sumOf { it.second.absentCount30d } }

    val filteredRows = remember(rows, filterMode, searchQuery) {
        val q = searchQuery.trim().lowercase()
        rows.filter { (client, summary, inMakeupWeek) ->
            val matchesFilter = when (filterMode) {
                "ELIGIBLE" -> summary.availableCount > 0
                "BOOKED" -> inMakeupWeek || summary.activeMakeupBookingsCount > 0
                "ABSENT" -> summary.totalAbsencesAllTime > 0 || summary.absentCount30d > 0
                else -> true
            }
            val matchesSearch = q.isBlank() ||
                client.name.lowercase().contains(q) ||
                client.phone.contains(q)
            matchesFilter && matchesSearch
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header & KPIs
        item {
            BrandCard(highlightBorder = eligibleCount > 0) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Compensações de Treinos",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = MakeupPurpleBright
                        )
                        Text(
                            text = "Validade de 30 dias · Direito por falta, treino removido ou semana sem marcar. Quando o aluno marca compensação, todos os treinos dele nessa semana aparecem a roxo.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CompensacaoKpiBox("Elegíveis", "$eligibleCount", MakeupPurpleBright, Modifier.weight(1f))
                    CompensacaoKpiBox("Créditos 30d", "$totalAvailableCredits", NewShapeGoldBright, Modifier.weight(1f))
                    CompensacaoKpiBox("A compensar", "$activeMakeupStudentsCount", ConfirmedGreen, Modifier.weight(1f))
                    CompensacaoKpiBox("Faltas 30d", "$totalAbsences30d", DangerRed, Modifier.weight(1f))
                }
            }
        }

        // Filter Chips + Search
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "ELIGIBLE" to "Podem compensar ($eligibleCount)",
                        "BOOKED" to "Em compensação ($activeMakeupStudentsCount)",
                        "ABSENT" to "Com faltas",
                        "ALL" to "Todos (${rows.size})"
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = filterMode == key,
                            onClick = { filterMode = key },
                            label = { Text(label, maxLines = 1, fontWeight = FontWeight.Bold) },
                            modifier = Modifier.testTag("pt_compensacoes_filter_$key"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MakeupPurple,
                                selectedLabelColor = TextPrimaryDark,
                                containerColor = CharcoalSurface,
                                labelColor = TextSecondaryDark
                            )
                        )
                    }
                }

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Pesquisar aluno...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Pesquisar aluno") },
                    trailingIcon = {
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Limpar pesquisa")
                            }
                        }
                    },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("pt_compensacoes_search"),
                    colors = darkFieldColors()
                )
            }
        }

        if (filteredRows.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.EventRepeat,
                    title = when (filterMode) {
                        "ELIGIBLE" -> "Nenhum aluno com compensação pendente"
                        "BOOKED" -> "Nenhum aluno em compensação esta semana"
                        "ABSENT" -> "Sem alunos com faltas registadas"
                        else -> "Nenhum aluno encontrado"
                    },
                    subtitle = "As compensações são calculadas automaticamente com validade de 30 dias."
                )
            }
        } else {
            items(filteredRows, key = { it.first.id }) { (client, summary, inMakeupWeek) ->
                val isExpanded = client.id in expandedClientIds
                val hasCredits = summary.availableCount > 0

                Surface(
                    color = if (inMakeupWeek) MakeupPurpleContainer.copy(alpha = 0.42f) else CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(
                        width = if (inMakeupWeek || hasCredits) 1.5.dp else 1.dp,
                        color = when {
                            inMakeupWeek -> MakeupPurple
                            hasCredits -> MakeupPurple.copy(alpha = 0.65f)
                            else -> HairlineBorder
                        }
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("pt_compensacoes_card_${client.id}")
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    expandedClientIds = if (isExpanded) {
                                        expandedClientIds - client.id
                                    } else {
                                        expandedClientIds + client.id
                                    }
                                },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = client.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimaryDark
                                    )
                                    if (inMakeupWeek) {
                                        StatusPill(
                                            text = "Em compensação",
                                            textColor = MakeupPurpleBright,
                                            containerColor = MakeupPurpleContainer
                                        )
                                    }
                                }
                                Text(
                                    text = buildString {
                                        append(client.phone.ifBlank { "Sem telemóvel" })
                                        if (summary.nearestExpiryDays != null) {
                                            append(" · Expira em ${summary.nearestExpiryDays} dia(s)")
                                        }
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (summary.nearestExpiryDays != null && summary.nearestExpiryDays <= 5) {
                                        PendingAmber
                                    } else {
                                        TextSecondaryDark
                                    }
                                )
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                StatusPill(
                                    text = if (hasCredits) "${summary.availableCount} por compensar" else "0 disp.",
                                    textColor = if (hasCredits) MakeupPurpleBright else TextSecondaryDark,
                                    containerColor = if (hasCredits) MakeupPurpleContainer else ElevatedCharcoal
                                )
                                Icon(
                                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = if (isExpanded) "Ocultar detalhes" else "Ver detalhes",
                                    tint = TextSecondaryDark
                                )
                            }
                        }

                        // Breakdown Pills
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            StatusPill(
                                text = "Faltas (30d): ${summary.absentCount30d}",
                                textColor = if (summary.absentCount30d > 0) DangerRed else TextSecondaryDark,
                                containerColor = if (summary.absentCount30d > 0) DangerRedContainer else ElevatedCharcoal
                            )
                            StatusPill(
                                text = "Removidos: ${summary.removedCount30d}",
                                textColor = if (summary.removedCount30d > 0) PendingAmber else TextSecondaryDark,
                                containerColor = if (summary.removedCount30d > 0) PendingAmberContainer else ElevatedCharcoal
                            )
                            StatusPill(
                                text = "Não marcou: ${summary.missedWeekCount30d}",
                                textColor = if (summary.missedWeekCount30d > 0) MakeupPurpleBright else TextSecondaryDark,
                                containerColor = if (summary.missedWeekCount30d > 0) MakeupPurpleContainer else ElevatedCharcoal
                            )
                            if (summary.manualCount30d > 0) {
                                StatusPill(
                                    text = "PT: ${summary.manualCount30d}",
                                    textColor = NewShapeGoldBright,
                                    containerColor = NewShapeGoldMuted
                                )
                            }
                            StatusPill(
                                text = "Total faltas: ${summary.totalAbsencesAllTime}",
                                textColor = TextSecondaryDark,
                                containerColor = ObsidianBg
                            )
                        }

                        // Action Buttons Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { manualCreditTarget = client },
                                border = BorderStroke(1.dp, MakeupPurple.copy(alpha = 0.7f)),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = MakeupPurpleContainer.copy(alpha = 0.5f),
                                    contentColor = MakeupPurpleBright
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 44.dp)
                                    .testTag("pt_compensacoes_add_manual_${client.id}")
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("+1 Comp. (30d)", fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                            }
                            if (client.phone.isNotBlank() && hasCredits) {
                                OutlinedButton(
                                    onClick = {
                                        val firstName = client.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { client.name }
                                        val expiryTxt = summary.nearestExpiryDays?.let { " (o mais antigo expira em $it dia(s))" }.orEmpty()
                                        val msg = "Olá $firstName! Tens ${summary.availableCount} treino(s) de compensação disponível(is) na app New Shape$expiryTxt. Podes marcar diretamente na tua Agenda! 💪"
                                        openWhatsApp(context, client.phone, msg, state.settings.whatsappWebMode)
                                    },
                                    border = BorderStroke(1.dp, ConfirmedGreen.copy(alpha = 0.7f)),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = ConfirmedGreenContainer.copy(alpha = 0.45f),
                                        contentColor = ConfirmedGreen
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 44.dp)
                                        .testTag("pt_compensacoes_whatsapp_${client.id}")
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Avisar WhatsApp", fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                }
                            }
                        }

                        // Expanded credit list
                        if (isExpanded) {
                            HorizontalDivider(color = HairlineBorder)
                            if (summary.credits.isEmpty()) {
                                Text(
                                    text = "Sem registos de compensação para este aluno.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    summary.credits.take(12).forEach { credit ->
                                        val isAvail = credit.status == ComputedMakeupStatus.AVAILABLE
                                        val isUsed = credit.status == ComputedMakeupStatus.USED
                                        Surface(
                                            color = ObsidianBg.copy(alpha = 0.7f),
                                            shape = RoundedCornerShape(10.dp),
                                            border = BorderStroke(
                                                1.dp,
                                                if (isAvail) MakeupPurple.copy(alpha = 0.55f) else HairlineBorder
                                            ),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(
                                                        text = "${MakeupCreditCalculator.reasonLabel(credit.reason)} · ${MakeupCreditCalculator.formatShortDate(credit.occurredAtMillis)}",
                                                        style = MaterialTheme.typography.labelMedium,
                                                        fontWeight = FontWeight.Bold,
                                                        color = if (isAvail) MakeupPurpleBright else TextPrimaryDark
                                                    )
                                                    Text(
                                                        text = credit.sourceLabel,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = TextSecondaryDark,
                                                        maxLines = 2,
                                                        overflow = TextOverflow.Ellipsis
                                                    )
                                                }
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    StatusPill(
                                                        text = when {
                                                            isAvail -> "${credit.daysLeft}d"
                                                            isUsed -> "Usado"
                                                            else -> "Expirado"
                                                        },
                                                        textColor = when {
                                                            isAvail -> MakeupPurpleBright
                                                            isUsed -> ConfirmedGreen
                                                            else -> TextSecondaryDark
                                                        },
                                                        containerColor = when {
                                                            isAvail -> MakeupPurpleContainer
                                                            isUsed -> ConfirmedGreenContainer
                                                            else -> ElevatedCharcoal
                                                        }
                                                    )
                                                    if (isAvail && credit.dismissibleCreditDocId != null) {
                                                        IconButton(
                                                            onClick = { viewModel.dismissMakeupCredit(credit.dismissibleCreditDocId) },
                                                            modifier = Modifier
                                                                .size(32.dp)
                                                                .testTag("pt_dismiss_credit_${credit.dismissibleCreditDocId}")
                                                        ) {
                                                            Icon(
                                                                Icons.Default.Close,
                                                                contentDescription = "Anular crédito",
                                                                tint = DangerRed,
                                                                modifier = Modifier.size(16.dp)
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    manualCreditTarget?.let { target ->
        ManualMakeupCreditDialog(
            clientName = target.name,
            onDismiss = { manualCreditTarget = null },
            onConfirm = { note ->
                viewModel.addManualMakeupCredit(target.id, note)
                manualCreditTarget = null
            }
        )
    }
}

@Composable
internal fun ManualMakeupCreditDialog(
    clientName: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Text(
                "Atribuir Compensação (30 dias)",
                color = MakeupPurpleBright,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Atribuir +1 crédito de compensação válido por 30 dias a $clientName.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Motivo / nota (opcional)") },
                    placeholder = { Text("Ex.: Feriado, reagendamento...") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("manual_makeup_note_input"),
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Atribuir +1",
                onClick = { onConfirm(note.trim()) },
                testTag = "manual_makeup_confirm_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = TextSecondaryDark)
            }
        }
    )
}

@Composable
private fun CompensacaoKpiBox(
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = ElevatedCharcoal,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = valueColor,
                maxLines = 1
            )
            Text(
                text = label,
                fontSize = 10.sp,
                color = TextSecondaryDark,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
