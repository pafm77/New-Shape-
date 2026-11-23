package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.*
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

private data class MarcacaoDayInfo(
    val dayOfWeek: Int,
    val shortLabel: String,
    val fullLabel: String,
    val dayNumber: Int?,
    val monthLabel: String,
    val isToday: Boolean,
    val sessions: List<TrainingSessionRecord>,
    val pendingCount: Int,
    val confirmedCount: Int
)

private data class ClientConfirmGroup(
    val client: ClientRecord,
    val sessions: List<TrainingSessionRecord>,
    val wasQueued: Boolean,
    val wasSent: Boolean,
    val message: String
)

private val MARCACOES_DAYS = listOf(
    Triple(1, "Seg", "Segunda"),
    Triple(2, "Ter", "Terça"),
    Triple(3, "Qua", "Quarta"),
    Triple(4, "Qui", "Quinta"),
    Triple(5, "Sex", "Sexta"),
    Triple(6, "Sáb", "Sábado"),
    Triple(7, "Dom", "Domingo")
)

private val MONTHS_SHORT_PT = arrayOf(
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
)

@Composable
fun PtMarcacoesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val activeWeek = state.activeWeek
    val weekKey = activeWeek?.weekKey.orEmpty()
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }

    val weekSessions = remember(state.sessions, weekKey) {
        if (weekKey.isBlank()) emptyList()
        else state.sessions
            .filter { it.weekKey == weekKey }
            .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
    }

    val weekBookings = remember(state.bookings, weekKey) {
        if (weekKey.isBlank()) emptyList()
        else state.bookings.filter { it.weekKey == weekKey }
    }

    val dayStats = remember(activeWeek?.startDateMillis, weekSessions, weekBookings) {
        val nowCal = Calendar.getInstance()
        val nowYear = nowCal.get(Calendar.YEAR)
        val nowDayOfYear = nowCal.get(Calendar.DAY_OF_YEAR)
        val mondayMs = activeWeek?.startDateMillis ?: 0L

        MARCACOES_DAYS.map { (dayNum, shortLbl, fullLbl) ->
            val cal = if (mondayMs > 0L) {
                Calendar.getInstance().apply {
                    timeInMillis = mondayMs
                    add(Calendar.DAY_OF_YEAR, dayNum - 1)
                }
            } else null

            val isToday = cal != null &&
                cal.get(Calendar.YEAR) == nowYear &&
                cal.get(Calendar.DAY_OF_YEAR) == nowDayOfYear

            val dSessions = weekSessions.filter { it.dayOfWeek == dayNum }
            val dSessionIds = dSessions.map { it.id }.toSet()
            val dBookings = weekBookings.filter {
                it.sessionId in dSessionIds && it.status != BookingStatus.CANCELLED.name
            }
            val pending = dBookings.count {
                it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
            }
            val confirmed = dBookings.count { it.status == BookingStatus.CONFIRMED.name }

            MarcacaoDayInfo(
                dayOfWeek = dayNum,
                shortLabel = shortLbl,
                fullLabel = fullLbl,
                dayNumber = cal?.get(Calendar.DAY_OF_MONTH),
                monthLabel = cal?.let { MONTHS_SHORT_PT[it.get(Calendar.MONTH)] }.orEmpty(),
                isToday = isToday,
                sessions = dSessions,
                pendingCount = pending,
                confirmedCount = confirmed
            )
        }
    }

    val defaultDay = remember(dayStats) {
        dayStats.firstOrNull { it.pendingCount > 0 }?.dayOfWeek
            ?: dayStats.firstOrNull { it.isToday }?.dayOfWeek
            ?: dayStats.firstOrNull { it.sessions.isNotEmpty() }?.dayOfWeek
            ?: 1
    }

    var selectedDay by remember(weekKey) { mutableIntStateOf(defaultDay) }
    var selectedSessionId by remember(weekKey, selectedDay) { mutableStateOf<String?>(null) }

    // Track clients accepted in this flow per weekKey so WhatsApp is sent ONLY at the end when PT decides
    var queuedByWeek by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) }
    var sentByWeek by remember { mutableStateOf<Map<String, Set<String>>>(emptyMap()) }
    var showSendDialog by remember { mutableStateOf(false) }
    var includeAllConfirmed by remember { mutableStateOf(false) }
    var showPrivateDialog by remember { mutableStateOf(false) }

    val allSessionMap = remember(state.sessions) { state.sessions.associateBy { it.id } }
    val monthlyPersonalGiven = remember(state.bookings, allSessionMap, clientMap) {
        val nowCal = Calendar.getInstance()
        val y = nowCal.get(Calendar.YEAR)
        val m = nowCal.get(Calendar.MONTH)
        val sCal = Calendar.getInstance()
        var given = 0
        state.bookings.forEach { b ->
            if (b.status != BookingStatus.CONFIRMED.name || b.attendanceStatus != "PRESENT") return@forEach
            val ses = allSessionMap[b.sessionId] ?: return@forEach
            if (ses.startMillis <= 0L) return@forEach
            sCal.timeInMillis = ses.startMillis
            if (sCal.get(Calendar.YEAR) != y || sCal.get(Calendar.MONTH) != m) return@forEach
            val c = clientMap[b.clientId]
            if (ses.ptPrivatePersonal || c?.trainingType == "PERSONALIZADO") given += 1
        }
        MONTHS_SHORT_PT[m] to given
    }

    val queuedIds = queuedByWeek[weekKey].orEmpty()
    val sentIds = sentByWeek[weekKey].orEmpty()

    fun enqueueClientForConfirm(clientId: String) {
        if (weekKey.isBlank()) return
        val current = queuedByWeek[weekKey].orEmpty()
        if (clientId !in current) {
            queuedByWeek = queuedByWeek + (weekKey to (current + clientId))
        }
        val currentSent = sentByWeek[weekKey].orEmpty()
        if (clientId in currentSent) {
            sentByWeek = sentByWeek + (weekKey to (currentSent - clientId))
        }
    }

    fun markClientSent(clientId: String) {
        if (weekKey.isBlank()) return
        val currentSent = sentByWeek[weekKey].orEmpty()
        sentByWeek = sentByWeek + (weekKey to (currentSent + clientId))
    }

    val totalWeekPending = remember(weekBookings) {
        weekBookings.count {
            it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
        }
    }

    val confirmedGroups = remember(activeWeek, weekSessions, weekBookings, clientMap, queuedIds, sentIds, state.messageTemplates, state.settings) {
        if (activeWeek == null) emptyList()
        else {
            val sessionMap = weekSessions.associateBy { it.id }
            val byClient = linkedMapOf<String, MutableList<TrainingSessionRecord>>()
            weekBookings
                .filter { it.status == BookingStatus.CONFIRMED.name }
                .forEach { b ->
                    val s = sessionMap[b.sessionId] ?: return@forEach
                    if (s.ptPrivatePersonal) return@forEach
                    val list = byClient.getOrPut(b.clientId) { mutableListOf() }
                    if (list.none { it.id == s.id }) list.add(s)
                }

            byClient.mapNotNull { (clientId, list) ->
                val client = clientMap[clientId] ?: return@mapNotNull null
                val sorted = list.sortedBy { it.startMillis }
                val msg = viewModel.buildMessage("CONFIRMACAO", client.name, sorted, activeWeek)
                ClientConfirmGroup(
                    client = client,
                    sessions = sorted,
                    wasQueued = clientId in queuedIds,
                    wasSent = clientId in sentIds,
                    message = msg
                )
            }.sortedWith(
                compareByDescending<ClientConfirmGroup> { it.wasQueued }
                    .thenBy { it.wasSent }
                    .thenBy { it.client.name }
            )
        }
    }

    val unsentQueuedCount = confirmedGroups.count { it.wasQueued && !it.wasSent }
    val currentDayInfo = dayStats.find { it.dayOfWeek == selectedDay } ?: dayStats.first()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Week selector & summary
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(
                        onClick = { viewModel.shiftWeek(-1) },
                        modifier = Modifier.testTag("marcacoes_prev_week_btn")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "Semana anterior",
                            tint = NewShapeGold
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "MARCAÇÕES POR DIA",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = activeWeek?.label ?: "Semana atual",
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimaryDark
                        )
                    }
                    IconButton(
                        onClick = { viewModel.shiftWeek(1) },
                        modifier = Modifier.testTag("marcacoes_next_week_btn")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = "Semana seguinte",
                            tint = NewShapeGold
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))
                HorizontalDivider(color = HairlineBorder)
                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        StatusPill(
                            text = if (totalWeekPending > 0) "$totalWeekPending por aceitar" else "Tudo aceite",
                            textColor = if (totalWeekPending > 0) PendingAmber else ConfirmedGreen,
                            containerColor = if (totalWeekPending > 0) PendingAmberContainer else ConfirmedGreenContainer
                        )
                        StatusPill(
                            text = "Pers. (${monthlyPersonalGiven.first}): ${monthlyPersonalGiven.second}✓",
                            textColor = NewShapeGoldBright,
                            containerColor = NewShapeGoldMuted
                        )
                    }
                    if (confirmedGroups.isNotEmpty()) {
                        TextButton(
                            onClick = {
                                includeAllConfirmed = queuedIds.isEmpty()
                                showSendDialog = true
                            },
                            modifier = Modifier.testTag("marcacoes_header_send_btn")
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Enviar confirmações",
                                tint = NewShapeGoldBright,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = if (unsentQueuedCount > 0) "Enviar ($unsentQueuedCount)" else "Mensagens (${confirmedGroups.size})",
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))
                GoldPrimaryButton(
                    text = "+ Personalizado (Oculto)",
                    icon = Icons.Default.VisibilityOff,
                    onClick = { showPrivateDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "marcacoes_add_private_personal_btn"
                )
            }
        }

        // 7-day weekly selector
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                dayStats.forEach { d ->
                    val isSelected = d.dayOfWeek == selectedDay
                    Box(modifier = Modifier.weight(1f)) {
                        Surface(
                            color = when {
                                isSelected -> NewShapeGold
                                d.isToday -> NewShapeGoldMuted
                                else -> CharcoalSurface
                            },
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(
                                width = if (isSelected || d.isToday) 1.5.dp else 1.dp,
                                color = when {
                                    isSelected -> NewShapeGold
                                    d.isToday -> NewShapeGold.copy(alpha = 0.65f)
                                    else -> HairlineBorder
                                }
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 66.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .clickable { selectedDay = d.dayOfWeek }
                                .testTag("marcacoes_day_${d.dayOfWeek}")
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = d.shortLabel,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) TextOnGold else TextSecondaryDark
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    text = d.dayNumber?.toString() ?: "—",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isSelected) TextOnGold else TextPrimaryDark
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    text = if (d.sessions.isNotEmpty()) "${d.sessions.size}h" else "—",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (isSelected) TextOnGold.copy(alpha = 0.8f) else if (d.sessions.isNotEmpty()) NewShapeGold else TextSecondaryDark.copy(alpha = 0.5f)
                                )
                            }
                        }

                        if (d.pendingCount > 0) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 2.dp, y = (-4).dp)
                                    .size(18.dp)
                                    .clip(CircleShape)
                                    .background(if (isSelected) ObsidianBg else PendingAmber)
                            ) {
                                Text(
                                    text = d.pendingCount.toString(),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isSelected) NewShapeGoldBright else ObsidianBg,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }
            }
        }

        // Day Title
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = buildString {
                            append(currentDayInfo.fullLabel)
                            if (currentDayInfo.dayNumber != null) {
                                append(", ${currentDayInfo.dayNumber} ${currentDayInfo.monthLabel}")
                            }
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimaryDark,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Toca num horário para ver os pedidos e aceitar um a um.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
                if (currentDayInfo.pendingCount > 0) {
                    StatusPill(
                        text = "${currentDayInfo.pendingCount} pendente(s)",
                        textColor = PendingAmber,
                        containerColor = PendingAmberContainer
                    )
                }
            }
        }

        // Time slots for the chosen day
        if (currentDayInfo.sessions.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.EventBusy,
                    title = "Sem horários neste dia",
                    subtitle = "Escolhe outro dia da semana acima ou cria horários na subaba Semanas."
                )
            }
        } else {
            items(currentDayInfo.sessions, key = { it.id }) { session ->
                val isOpen = selectedSessionId == session.id
                val slotBookings = weekBookings
                    .filter { it.sessionId == session.id && it.status != BookingStatus.CANCELLED.name }
                    .sortedWith(
                        compareByDescending<BookingRecord> {
                            it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
                        }.thenBy { it.requestedAtMillis }
                    )
                val pendingList = slotBookings.filter {
                    it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
                }
                val confirmedList = slotBookings.filter { it.status == BookingStatus.CONFIRMED.name }
                val slotWaitlist = state.waitlistEntries
                    .filter { it.sessionId == session.id }
                    .sortedBy { it.createdAtMillis }
                val isFull = confirmedList.size >= session.capacity

                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(
                        width = if (isOpen) 1.5.dp else 1.dp,
                        color = when {
                            isOpen -> NewShapeGold
                            pendingList.isNotEmpty() -> PendingAmber.copy(alpha = 0.6f)
                            else -> HairlineBorder
                        }
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        // Clickable Time Slot Header
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedSessionId = if (isOpen) null else session.id }
                                .padding(14.dp)
                                .testTag("marcacoes_slot_${session.id}"),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                color = if (isOpen) NewShapeGold else ElevatedCharcoal,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, if (isOpen) NewShapeGold else HairlineBorder)
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = session.timeLabel.replace(":", "h"),
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (isOpen) TextOnGold else NewShapeGoldBright
                                    )
                                    Text(
                                        text = "${session.durationMinutes}m",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (isOpen) TextOnGold.copy(alpha = 0.8f) else TextSecondaryDark
                                    )
                                }
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (slotBookings.isEmpty()) "Sem pedidos" else "${slotBookings.size} pessoa(s) neste horário",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = TextPrimaryDark
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.padding(top = 4.dp)
                                ) {
                                    if (session.ptPrivatePersonal) {
                                        StatusPill(
                                            text = "Personalizado · Oculto",
                                            textColor = NewShapeGoldBright,
                                            containerColor = NewShapeGoldMuted
                                        )
                                    }
                                    if (pendingList.isNotEmpty()) {
                                        StatusPill(
                                            text = "${pendingList.size} por aceitar",
                                            textColor = PendingAmber,
                                            containerColor = PendingAmberContainer
                                        )
                                    }
                                    if (slotWaitlist.isNotEmpty()) {
                                        StatusPill(
                                            text = "Espera: ${slotWaitlist.size}",
                                            textColor = InfoBlue,
                                            containerColor = InfoBlueContainer
                                        )
                                    }
                                }
                                if (session.note.isNotBlank()) {
                                    Text(
                                        text = session.note,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark,
                                        modifier = Modifier.padding(top = 2.dp)
                                    )
                                }
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                StatusPill(
                                    text = "${confirmedList.size}/${session.capacity}",
                                    textColor = if (isFull) DangerRed else NewShapeGoldBright,
                                    containerColor = if (isFull) DangerRedContainer else NewShapeGoldMuted
                                )
                                Icon(
                                    imageVector = if (isOpen) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = if (isOpen) "Fechar horário" else "Ver pedidos do horário",
                                    tint = if (isOpen) NewShapeGold else TextSecondaryDark
                                )
                            }
                        }

                        // Expanded People who requested this slot
                        AnimatedVisibility(visible = isOpen) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(ObsidianBg.copy(alpha = 0.65f))
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                HorizontalDivider(color = HairlineBorder)

                                if (pendingList.size > 1) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${pendingList.size} pedidos à espera",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = NewShapeGoldBright
                                        )
                                        TextButton(
                                            onClick = {
                                                viewModel.acceptBookingsSilently(pendingList)
                                                pendingList.forEach { enqueueClientForConfirm(it.clientId) }
                                            },
                                            modifier = Modifier.testTag("marcacoes_accept_all_${session.id}")
                                        ) {
                                            Icon(
                                                Icons.Default.DoneAll,
                                                contentDescription = "Aceitar todos",
                                                tint = NewShapeGold,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(Modifier.width(4.dp))
                                            Text("Aceitar todos", color = NewShapeGold, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }

                                if (session.ptPrivatePersonal) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Treino personalizado oculto dos alunos",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = NewShapeGoldBright
                                        )
                                        TextButton(
                                            onClick = {
                                                viewModel.deleteSession(session.id)
                                                selectedSessionId = null
                                            },
                                            modifier = Modifier.testTag("marcacoes_delete_private_${session.id}")
                                        ) {
                                            Icon(Icons.Default.Delete, contentDescription = "Apagar treino", tint = DangerRed, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Apagar", color = DangerRed, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }

                                if (slotBookings.isEmpty()) {
                                    Text(
                                        text = "Nenhum aluno pediu este horário ainda.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark,
                                        modifier = Modifier.padding(vertical = 8.dp)
                                    )
                                } else {
                                    slotBookings.forEach { b ->
                                        val client = clientMap[b.clientId]
                                        if (client != null) {
                                            val isConfirmed = b.status == BookingStatus.CONFIRMED.name
                                            val isAltered = b.status == BookingStatus.ALTERED.name
                                            val isPresent = b.attendanceStatus == "PRESENT"
                                            val isAbsent = b.attendanceStatus == "ABSENT"
                                            val isPersonal = client.trainingType == "PERSONALIZADO"

                                            Surface(
                                                color = if (isConfirmed) ConfirmedGreenContainer.copy(alpha = 0.45f) else ElevatedCharcoal,
                                                shape = RoundedCornerShape(12.dp),
                                                border = BorderStroke(
                                                    1.dp,
                                                    if (isConfirmed) ConfirmedGreen.copy(alpha = 0.45f) else HairlineBorder
                                                ),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Column(
                                                    modifier = Modifier.padding(12.dp),
                                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
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
                                                                Text(
                                                                    text = client.name,
                                                                    style = MaterialTheme.typography.titleSmall,
                                                                    color = TextPrimaryDark
                                                                )
                                                                StatusPill(
                                                                    text = if (isPersonal) "Pers." else "Grupo",
                                                                    textColor = if (isPersonal) NewShapeGoldBright else InfoBlue,
                                                                    containerColor = if (isPersonal) NewShapeGoldMuted else InfoBlueContainer
                                                                )
                                                            }
                                                            Text(
                                                                text = "${client.phone}${if (b.requestedAtMillis > 0L) " · ${formatTimeAgo(b.requestedAtMillis)}" else ""}",
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = TextSecondaryDark
                                                            )
                                                        }

                                                        StatusPill(
                                                            text = when {
                                                                isConfirmed -> "Aceite ✓"
                                                                isAltered -> "Alterado"
                                                                else -> "Pendente"
                                                            },
                                                            textColor = if (isConfirmed) ConfirmedGreen else PendingAmber,
                                                            containerColor = if (isConfirmed) ConfirmedGreenContainer else PendingAmberContainer
                                                        )
                                                    }

                                                    if (!isConfirmed) {
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                        ) {
                                                            OutlinedButton(
                                                                onClick = { viewModel.rejectBookingSilently(b, client.name) },
                                                                border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.7f)),
                                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed),
                                                                modifier = Modifier
                                                                    .weight(1f)
                                                                    .heightIn(min = 48.dp)
                                                                    .testTag("marcacoes_reject_${b.id}")
                                                            ) {
                                                                Icon(Icons.Default.Close, contentDescription = "Recusar", modifier = Modifier.size(16.dp))
                                                                Spacer(Modifier.width(4.dp))
                                                                Text("Recusar", fontWeight = FontWeight.Bold)
                                                            }
                                                            Button(
                                                                onClick = {
                                                                    viewModel.acceptBookingSilently(b, client.name)
                                                                    enqueueClientForConfirm(b.clientId)
                                                                },
                                                                colors = ButtonDefaults.buttonColors(
                                                                    containerColor = ConfirmedGreen,
                                                                    contentColor = ObsidianBg
                                                                ),
                                                                modifier = Modifier
                                                                    .weight(1f)
                                                                    .heightIn(min = 48.dp)
                                                                    .testTag("marcacoes_accept_${b.id}")
                                                            ) {
                                                                Icon(Icons.Default.Check, contentDescription = "Aceitar", modifier = Modifier.size(16.dp))
                                                                Spacer(Modifier.width(4.dp))
                                                                Text("Aceitar", fontWeight = FontWeight.ExtraBold)
                                                            }
                                                        }
                                                    } else {
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                        ) {
                                                            Button(
                                                                onClick = {
                                                                    viewModel.setBookingAttendance(
                                                                        b.id,
                                                                        if (isPresent) "" else "PRESENT"
                                                                    )
                                                                },
                                                                colors = ButtonDefaults.buttonColors(
                                                                    containerColor = if (isPresent) ConfirmedGreen else CharcoalSurface,
                                                                    contentColor = if (isPresent) ObsidianBg else TextPrimaryDark
                                                                ),
                                                                border = BorderStroke(
                                                                    1.dp,
                                                                    if (isPresent) ConfirmedGreen else HairlineBorder
                                                                ),
                                                                modifier = Modifier
                                                                    .weight(1f)
                                                                    .heightIn(min = 48.dp)
                                                                    .testTag("marcacoes_present_${b.id}")
                                                            ) {
                                                                Icon(Icons.Default.Check, contentDescription = "Presença", modifier = Modifier.size(16.dp))
                                                                Spacer(Modifier.width(4.dp))
                                                                Text(if (isPresent) "Veio ✓" else "Presença", fontWeight = FontWeight.ExtraBold)
                                                            }
                                                            Button(
                                                                onClick = {
                                                                    viewModel.setBookingAttendance(
                                                                        b.id,
                                                                        if (isAbsent) "" else "ABSENT"
                                                                    )
                                                                },
                                                                colors = ButtonDefaults.buttonColors(
                                                                    containerColor = if (isAbsent) DangerRed else CharcoalSurface,
                                                                    contentColor = if (isAbsent) TextPrimaryDark else TextSecondaryDark
                                                                ),
                                                                border = BorderStroke(
                                                                    1.dp,
                                                                    if (isAbsent) DangerRed else HairlineBorder
                                                                ),
                                                                modifier = Modifier
                                                                    .weight(1f)
                                                                    .heightIn(min = 48.dp)
                                                                    .testTag("marcacoes_absent_${b.id}")
                                                            ) {
                                                                Icon(Icons.Default.Close, contentDescription = "Falta", modifier = Modifier.size(16.dp))
                                                                Spacer(Modifier.width(4.dp))
                                                                Text(if (isAbsent) "Faltou ✕" else "Falta", fontWeight = FontWeight.Bold)
                                                            }
                                                        }
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.End
                                                        ) {
                                                            TextButton(
                                                                onClick = { viewModel.rejectBookingSilently(b, client.name) },
                                                                modifier = Modifier.testTag("marcacoes_remove_${b.id}")
                                                            ) {
                                                                Text("Remover", color = DangerRed, style = MaterialTheme.typography.labelMedium)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (slotWaitlist.isNotEmpty()) {
                                    HorizontalDivider(color = HairlineBorder)
                                    Text(
                                        text = "Lista de Espera (${slotWaitlist.size})",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = PendingAmber,
                                        fontWeight = FontWeight.Bold
                                    )
                                    slotWaitlist.forEachIndexed { idx, w ->
                                        val c = clientMap[w.clientId]
                                        if (c != null) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(PendingAmberContainer.copy(alpha = 0.4f))
                                                    .padding(10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text("#${idx + 1} · ${c.name}", style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                                    Text(c.phone, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                                                }
                                                Button(
                                                    onClick = {
                                                        viewModel.promoteWaitlistEntry(w)
                                                        enqueueClientForConfirm(w.clientId)
                                                    },
                                                    colors = ButtonDefaults.buttonColors(
                                                        containerColor = NewShapeGold,
                                                        contentColor = TextOnGold
                                                    ),
                                                    modifier = Modifier.heightIn(min = 40.dp)
                                                ) {
                                                    Text("Aceitar vaga", fontWeight = FontWeight.Bold)
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

        // Bottom Final Confirmation Bar (PT sends WhatsApp only when ready)
        if (confirmedGroups.isNotEmpty()) {
            item {
                BrandCard(highlightBorder = unsentQueuedCount > 0) {
                    Text(
                        text = if (unsentQueuedCount > 0) {
                            "$unsentQueuedCount aluno(s) aceites prontos para confirmar no WhatsApp"
                        } else {
                            "${confirmedGroups.size} aluno(s) com treinos confirmados esta semana"
                        },
                        style = MaterialTheme.typography.titleSmall,
                        color = NewShapeGoldBright
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Aceita primeiro todos os horários que quiseres. Quando terminares, toca abaixo para enviar as mensagens de confirmação.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                    Spacer(Modifier.height(10.dp))
                    GoldPrimaryButton(
                        text = if (unsentQueuedCount > 0) "Enviar confirmações ($unsentQueuedCount)" else "Enviar mensagens de confirmação",
                        icon = Icons.AutoMirrored.Filled.Send,
                        onClick = {
                            includeAllConfirmed = queuedIds.isEmpty()
                            showSendDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "marcacoes_send_confirmations_btn"
                    )
                }
            }
        }
    }

    if (showSendDialog) {
        val visibleGroups = if (includeAllConfirmed || queuedIds.isEmpty()) {
            confirmedGroups
        } else {
            confirmedGroups.filter { it.wasQueued }
        }

        AlertDialog(
            onDismissRequest = { showSendDialog = false },
            containerColor = CharcoalSurface,
            title = {
                Column {
                    Text("Enviar confirmações", color = TextPrimaryDark)
                    Text(
                        text = "Semana ${activeWeek?.label.orEmpty()} · Mensagem com todos os horários aceites",
                        style = MaterialTheme.typography.bodySmall,
                        color = NewShapeGold
                    )
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (queuedIds.isNotEmpty()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { includeAllConfirmed = !includeAllConfirmed }
                            ) {
                                Checkbox(
                                    checked = includeAllConfirmed,
                                    onCheckedChange = { includeAllConfirmed = it },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold
                                    )
                                )
                                Text(
                                    text = "Mostrar todos (${confirmedGroups.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = TextPrimaryDark
                                )
                            }
                            TextButton(
                                onClick = {
                                    if (weekKey.isNotBlank()) {
                                        queuedByWeek = queuedByWeek - weekKey
                                        sentByWeek = sentByWeek - weekKey
                                    }
                                }
                            ) {
                                Text("Limpar fila", color = TextSecondaryDark, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    if (visibleGroups.isEmpty()) {
                        Text(
                            text = "Nenhum aluno com marcações confirmadas nesta semana.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    } else {
                        visibleGroups.forEach { group ->
                            var showMsg by remember(group.client.id) { mutableStateOf(false) }
                            Surface(
                                color = if (group.wasSent) ConfirmedGreenContainer.copy(alpha = 0.4f) else ElevatedCharcoal,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(
                                    1.dp,
                                    if (group.wasSent) ConfirmedGreen.copy(alpha = 0.5f) else HairlineBorder
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
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
                                                Text(group.client.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                                if (group.wasSent) {
                                                    StatusPill("Enviado ✓", ConfirmedGreen, ConfirmedGreenContainer)
                                                }
                                            }
                                            Text(
                                                text = group.sessions.joinToString(" · ") {
                                                    "${it.dateLabel} ${it.timeLabel.replace(":", "h")}"
                                                },
                                                style = MaterialTheme.typography.labelSmall,
                                                color = NewShapeGoldBright
                                            )
                                        }
                                        TextButton(onClick = { showMsg = !showMsg }) {
                                            Text(
                                                if (showMsg) "Ocultar" else "Ver texto",
                                                color = TextSecondaryDark,
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    }

                                    AnimatedVisibility(visible = showMsg) {
                                        Surface(
                                            color = ObsidianBg,
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text(
                                                text = group.message,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = TextPrimaryDark,
                                                modifier = Modifier.padding(10.dp)
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        DarkSecondaryButton(
                                            text = "Copiar",
                                            icon = Icons.Default.ContentCopy,
                                            onClick = { copyToClipboard(context, group.message) },
                                            modifier = Modifier.weight(1f)
                                        )
                                        GoldPrimaryButton(
                                            text = if (group.wasSent) "Reenviar" else "WhatsApp",
                                            icon = Icons.AutoMirrored.Filled.Send,
                                            onClick = {
                                                markClientSent(group.client.id)
                                                openWhatsApp(context, group.client.phone, group.message, state.settings.whatsappWebMode)
                                            },
                                            modifier = Modifier.weight(1f),
                                            testTag = "marcacoes_send_wa_${group.client.id}"
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSendDialog = false }) {
                    Text("Fechar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    if (showPrivateDialog) {
        val initialDateMs = if (activeWeek != null && activeWeek.startDateMillis > 0L) {
            activeWeek.startDateMillis + (selectedDay - 1) * 86_400_000L
        } else {
            System.currentTimeMillis()
        }
        PrivatePersonalSessionDialog(
            clients = state.clients,
            initialClientId = null,
            initialDateMillis = initialDateMs,
            onDismiss = { showPrivateDialog = false },
            onConfirm = { clientId, clientName, dateMs, hour, minute, durationMinutes, note ->
                viewModel.createPrivatePersonalTraining(
                    clientId = clientId,
                    clientName = clientName,
                    dateMillis = dateMs,
                    hour = hour,
                    minute = minute,
                    durationMinutes = durationMinutes,
                    note = note
                )
            }
        )
    }
}
