package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.*
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

private val PT_BOOK_DAYS = listOf(
    Triple(1, "Seg", "Segunda"),
    Triple(2, "Ter", "Terça"),
    Triple(3, "Qua", "Quarta"),
    Triple(4, "Qui", "Quinta"),
    Triple(5, "Sex", "Sexta"),
    Triple(6, "Sáb", "Sábado"),
    Triple(7, "Dom", "Domingo")
)

private val PT_BOOK_MONTHS = arrayOf(
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
)

private fun ptBookEndTime(timeLabel: String, durationMinutes: Int): String {
    val parts = timeLabel.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return ""
    val m = parts.getOrNull(1)?.toIntOrNull() ?: return ""
    val total = h * 60 + m + durationMinutes.coerceAtLeast(0)
    return "%02d:%02d".format((total / 60) % 24, total % 60)
}

private data class PtMessageDraft(
    val title: String,
    val subtitle: String,
    val client: ClientRecord,
    val message: String,
    val alternateMessage: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PtTrainingMarcacoesSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    selectedClientId: String,
    onSelectClient: (String) -> Unit
) {
    val context = LocalContext.current
    val activeClients = remember(state.clients) {
        state.clients.filter { it.active }.sortedBy { it.name.lowercase() }
    }
    var searchQuery by remember { mutableStateOf("") }
    val filteredClients = remember(activeClients, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) activeClients
        else activeClients.filter {
            it.name.lowercase().contains(q) ||
                it.phone.filter(Char::isDigit).contains(q.filter(Char::isDigit))
        }
    }
    val selectedClient = activeClients.find { it.id == selectedClientId }
        ?: filteredClients.firstOrNull()
        ?: activeClients.firstOrNull()

    var clientMenuExpanded by remember { mutableStateOf(false) }

    val activeWeek = state.activeWeek
    val weekKey = activeWeek?.weekKey.orEmpty()
    val sessionMap = remember(state.sessions) { state.sessions.associateBy { it.id } }
    val weekMap = remember(state.weeks) { state.weeks.associateBy { it.weekKey } }

    val weekSessions = remember(state.sessions, weekKey) {
        if (weekKey.isBlank()) emptyList()
        else state.sessions
            .filter { it.weekKey == weekKey }
            .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
    }

    val studentWeekBookings = remember(state.bookings, selectedClient?.id, weekKey, sessionMap) {
        if (selectedClient == null || weekKey.isBlank()) emptyList()
        else state.bookings
            .filter {
                it.clientId == selectedClient.id &&
                    it.weekKey == weekKey &&
                    it.status != BookingStatus.CANCELLED.name
            }
            .mapNotNull { b -> sessionMap[b.sessionId]?.let { b to it } }
            .sortedWith(compareBy<Pair<BookingRecord, TrainingSessionRecord>> { it.second.startMillis }.thenBy { it.second.timeLabel })
    }

    val studentBookedBySessionId = remember(studentWeekBookings) {
        studentWeekBookings.associate { (b, _) -> b.sessionId to b }
    }

    val confirmedCountInWeek = remember(studentWeekBookings) {
        studentWeekBookings.count { (b, _) -> b.status == BookingStatus.CONFIRMED.name }
    }

    // Per-day metadata for the 7-day strip
    val dayStats = remember(activeWeek?.startDateMillis, weekSessions, studentBookedBySessionId) {
        val nowCal = Calendar.getInstance()
        val nowYear = nowCal.get(Calendar.YEAR)
        val nowDayOfYear = nowCal.get(Calendar.DAY_OF_YEAR)
        val mondayMs = activeWeek?.startDateMillis ?: 0L
        PT_BOOK_DAYS.map { (dayNum, shortLbl, fullLbl) ->
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
            val hasStudent = dSessions.any { it.id in studentBookedBySessionId }
            Triple(
                Triple(dayNum, shortLbl, fullLbl),
                Triple(cal?.get(Calendar.DAY_OF_MONTH), cal?.let { PT_BOOK_MONTHS[it.get(Calendar.MONTH)] }.orEmpty(), isToday),
                dSessions to hasStudent
            )
        }
    }

    val defaultDay = remember(dayStats) {
        dayStats.firstOrNull { it.second.third && it.third.first.isNotEmpty() }?.first?.first
            ?: dayStats.firstOrNull { it.third.first.isNotEmpty() }?.first?.first
            ?: 1
    }

    var selectedDay by remember(weekKey) { mutableIntStateOf(defaultDay) }
    var swappingTarget by remember(selectedClient?.id) {
        mutableStateOf<Pair<BookingRecord, TrainingSessionRecord>?>(null)
    }
    var messageDraft by remember { mutableStateOf<PtMessageDraft?>(null) }

    val currentDayStat = dayStats.find { it.first.first == selectedDay } ?: dayStats.first()
    val currentDaySessions = currentDayStat.third.first

    fun buildConfirmMessage(
        client: ClientRecord,
        targetSessions: List<TrainingSessionRecord>,
        targetWeek: TrainingWeekRecord?
    ): String {
        val built = viewModel.buildMessage("CONFIRMACAO", client.name, targetSessions, targetWeek)
        if (built.isNotBlank()) return built
        val firstName = client.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { client.name }
        val lines = targetSessions.joinToString("\n") { s ->
            "• ${s.dateLabel} às ${s.timeLabel.replace(":", "h")}"
        }
        return "Olá $firstName! ✅ Treino confirmado:\n$lines\nAté já! 💪 New Shape"
    }

    fun buildSwapMessage(
        client: ClientRecord,
        oldSession: TrainingSessionRecord,
        newSession: TrainingSessionRecord,
        targetSessions: List<TrainingSessionRecord>,
        targetWeek: TrainingWeekRecord?
    ): String {
        val oldEnd = ptBookEndTime(oldSession.timeLabel, oldSession.durationMinutes)
        val newEnd = ptBookEndTime(newSession.timeLabel, newSession.durationMinutes)
        val oldStr = "${oldSession.dateLabel} às ${oldSession.timeLabel.replace(":", "h")}${if (oldEnd.isNotEmpty()) "–${oldEnd.replace(":", "h")}" else ""}"
        val newStr = "${newSession.dateLabel} às ${newSession.timeLabel.replace(":", "h")}${if (newEnd.isNotEmpty()) "–${newEnd.replace(":", "h")}" else ""}"
        val base = viewModel.buildMessage("ALTERACAO", client.name, targetSessions, targetWeek)
        if (base.isNotBlank()) {
            return "$base\n\n🔄 Troca efetuada:\n• Antes: $oldStr\n• Novo horário: $newStr"
        }
        val firstName = client.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { client.name }
        return "Olá $firstName! 🔄 Trocámos o teu treino:\n• Antes: $oldStr\n• Novo horário: $newStr\n\nConfirmado! 💪 New Shape"
    }

    if (activeClients.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            EmptyStateBox(
                icon = Icons.Default.People,
                title = "Sem alunos ativos",
                subtitle = "Adiciona alunos na aba Alunos para poderes marcar ou trocar horários por eles."
            )
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Step 1: Select Student
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Marcar ou Trocar Treino pelo Aluno",
                            style = MaterialTheme.typography.titleSmall,
                            color = NewShapeGoldBright,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Escolhe o aluno, marca ou troca o horário e envia a mensagem.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                    if (selectedClient != null) {
                        val isPersonal = selectedClient.trainingType == "PERSONALIZADO"
                        StatusPill(
                            text = if (isPersonal) "Personalizado" else "Grupo",
                            textColor = if (isPersonal) TextOnGold else ConfirmedGreen,
                            containerColor = if (isPersonal) NewShapeGold else ConfirmedGreenContainer
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Pesquisar aluno ou telemóvel...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Pesquisar aluno") },
                    trailingIcon = {
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Limpar pesquisa")
                            }
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("pt_training_marcacoes_search"),
                    colors = darkFieldColors()
                )

                Spacer(Modifier.height(8.dp))

                ExposedDropdownMenuBox(
                    expanded = clientMenuExpanded,
                    onExpandedChange = { clientMenuExpanded = !clientMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedClient?.let {
                            if (it.phone.isNotBlank()) "${it.name} · ${it.phone}" else it.name
                        } ?: "Nenhum aluno encontrado",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Aluno (${filteredClients.size})") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = clientMenuExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                            .testTag("pt_training_marcacoes_client_dropdown"),
                        colors = darkFieldColors()
                    )
                    ExposedDropdownMenu(
                        expanded = clientMenuExpanded,
                        onDismissRequest = { clientMenuExpanded = false }
                    ) {
                        filteredClients.forEach { client ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(client.name, fontWeight = FontWeight.Bold)
                                        if (client.phone.isNotBlank()) {
                                            Text(client.phone, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                                        }
                                    }
                                },
                                onClick = {
                                    onSelectClient(client.id)
                                    clientMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                if (selectedClient != null) {
                    Spacer(Modifier.height(10.dp))
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(selectedClient.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
                                val limitStr = if (selectedClient.weeklySessionLimit > 0) " · Pacote ${selectedClient.weeklySessionLimit}×/semana" else ""
                                Text(
                                    text = "${selectedClient.phone.ifBlank { "Sem telemóvel" }}$limitStr",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                            }
                            val countLabel = if (selectedClient.weeklySessionLimit > 0) {
                                "$confirmedCountInWeek/${selectedClient.weeklySessionLimit} confirmados"
                            } else {
                                "$confirmedCountInWeek confirmado(s)"
                            }
                            StatusPill(
                                text = countLabel,
                                textColor = if (confirmedCountInWeek > 0) ConfirmedGreen else TextSecondaryDark,
                                containerColor = if (confirmedCountInWeek > 0) ConfirmedGreenContainer else CharcoalSurface
                            )
                        }
                    }
                }
            }
        }

        // Week Switcher + Current Student Bookings in this Week
        item {
            BrandCard(highlightBorder = swappingTarget != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { viewModel.shiftWeek(-1) },
                        modifier = Modifier.testTag("pt_training_marcacoes_prev_week")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "Semana anterior",
                            tint = NewShapeGoldBright
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("SEMANA", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                        Text(
                            text = activeWeek?.label ?: "Sem semana criada",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                    }
                    IconButton(
                        onClick = { viewModel.shiftWeek(1) },
                        modifier = Modifier.testTag("pt_training_marcacoes_next_week")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = "Semana seguinte",
                            tint = NewShapeGoldBright
                        )
                    }
                }

                // Active Swap Banner
                val activeSwap = swappingTarget
                if (activeSwap != null && selectedClient != null) {
                    Spacer(Modifier.height(8.dp))
                    Surface(
                        color = NewShapeGoldMuted,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.5.dp, NewShapeGold),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Modo Troca Ativo · ${selectedClient.name}",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                TextButton(
                                    onClick = { swappingTarget = null },
                                    modifier = Modifier.testTag("pt_training_marcacoes_cancel_swap")
                                ) {
                                    Text("Cancelar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                                }
                            }
                            Text(
                                text = "A trocar ${activeSwap.second.dateLabel} às ${activeSwap.second.timeLabel}. Escolhe abaixo o novo dia e horário (nesta ou noutra semana).",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                    }
                }

                if (selectedClient != null) {
                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = HairlineBorder)
                    Spacer(Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val firstName = selectedClient.name.trim().split(" ").firstOrNull().orEmpty()
                        Text(
                            text = "Horários de $firstName (${studentWeekBookings.size})",
                            style = MaterialTheme.typography.titleSmall,
                            color = TextPrimaryDark,
                            fontWeight = FontWeight.Bold
                        )
                        if (confirmedCountInWeek > 0) {
                            FilledTonalButton(
                                onClick = {
                                    val confirmedSessions = studentWeekBookings
                                        .filter { it.first.status == BookingStatus.CONFIRMED.name }
                                        .map { it.second }
                                    val msg = buildConfirmMessage(selectedClient, confirmedSessions, activeWeek)
                                    messageDraft = PtMessageDraft(
                                        title = "Enviar confirmação da semana",
                                        subtitle = "${selectedClient.name} · ${confirmedSessions.size} treino(s) confirmado(s)",
                                        client = selectedClient,
                                        message = msg
                                    )
                                },
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = NewShapeGold,
                                    contentColor = TextOnGold
                                ),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.testTag("pt_training_marcacoes_send_week_msg")
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(15.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Enviar ($confirmedCountInWeek)", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    if (studentWeekBookings.isEmpty()) {
                        Text(
                            text = "Ainda sem treinos marcados nesta semana. Escolhe um dia e horário abaixo para marcar.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            studentWeekBookings.forEach { (booking, session) ->
                                val isConfirmed = booking.status == BookingStatus.CONFIRMED.name
                                val isSwappingThis = swappingTarget?.first?.id == booking.id
                                val endTime = ptBookEndTime(session.timeLabel, session.durationMinutes)
                                Surface(
                                    color = when {
                                        isSwappingThis -> NewShapeGoldMuted.copy(alpha = 0.65f)
                                        isConfirmed -> ConfirmedGreenContainer.copy(alpha = 0.45f)
                                        else -> PendingAmberContainer.copy(alpha = 0.45f)
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(
                                        1.dp,
                                        when {
                                            isSwappingThis -> NewShapeGold
                                            isConfirmed -> ConfirmedGreen.copy(alpha = 0.5f)
                                            else -> PendingAmber.copy(alpha = 0.5f)
                                        }
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = session.dateLabel,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimaryDark
                                                )
                                                Text(
                                                    text = "${session.timeLabel}${if (endTime.isNotEmpty()) " – $endTime" else ""} · ${session.durationMinutes} min",
                                                    style = MaterialTheme.typography.labelMedium,
                                                    color = NewShapeGoldBright,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                            }
                                            StatusPill(
                                                text = if (isConfirmed) "Confirmado ✓" else "Por confirmar",
                                                textColor = if (isConfirmed) ConfirmedGreen else PendingAmber,
                                                containerColor = if (isConfirmed) ConfirmedGreenContainer else PendingAmberContainer
                                            )
                                        }

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            if (!isConfirmed) {
                                                FilledTonalButton(
                                                    onClick = {
                                                        viewModel.acceptBookingSilently(booking, selectedClient.name)
                                                        val msg = buildConfirmMessage(selectedClient, listOf(session), weekMap[session.weekKey] ?: activeWeek)
                                                        messageDraft = PtMessageDraft(
                                                            title = "Marcação confirmada · Enviar mensagem",
                                                            subtitle = "${selectedClient.name} · ${session.dateLabel} às ${session.timeLabel}",
                                                            client = selectedClient,
                                                            message = msg
                                                        )
                                                    },
                                                    colors = ButtonDefaults.filledTonalButtonColors(
                                                        containerColor = ConfirmedGreen,
                                                        contentColor = ObsidianBg
                                                    ),
                                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                                    Spacer(Modifier.width(4.dp))
                                                    Text("Confirmar", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                                }
                                            }

                                            OutlinedButton(
                                                onClick = {
                                                    swappingTarget = if (isSwappingThis) null else (booking to session)
                                                },
                                                border = BorderStroke(1.dp, NewShapeGold),
                                                colors = ButtonDefaults.outlinedButtonColors(
                                                    containerColor = if (isSwappingThis) NewShapeGold else CharcoalSurface,
                                                    contentColor = if (isSwappingThis) TextOnGold else NewShapeGoldBright
                                                ),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .testTag("pt_training_swap_btn_${booking.id}")
                                            ) {
                                                Icon(Icons.Default.SwapHoriz, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(Modifier.width(4.dp))
                                                Text(
                                                    text = if (isSwappingThis) "A trocar..." else "Trocar horário",
                                                    style = MaterialTheme.typography.labelMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }

                                            IconButton(
                                                onClick = {
                                                    viewModel.removeBooking(booking.id)
                                                    if (isSwappingThis) swappingTarget = null
                                                    val first = selectedClient.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { selectedClient.name }
                                                    messageDraft = PtMessageDraft(
                                                        title = "Treino desmarcado · Avisar aluno",
                                                        subtitle = "${selectedClient.name} · ${session.dateLabel} às ${session.timeLabel}",
                                                        client = selectedClient,
                                                        message = "Olá $first, o teu treino de ${session.dateLabel} às ${session.timeLabel.replace(":", "h")} foi desmarcado. Diz-me quando preferes reagendar! 💪 New Shape"
                                                    )
                                                },
                                                modifier = Modifier.testTag("pt_training_remove_btn_${booking.id}")
                                            ) {
                                                Icon(Icons.Default.Delete, contentDescription = "Desmarcar treino", tint = DangerRed)
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

        // Day-by-Day, Hour-by-Hour Picker
        if (weekSessions.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.CalendarMonth,
                    title = "Sem horários nesta semana",
                    subtitle = "Cria os horários em Início → Semanas ou muda para outra semana acima."
                )
            }
        } else {
            // 7-day strip
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    dayStats.forEach { stat ->
                        val (dayNum, shortLbl, _) = stat.first
                        val (dayOfMonth, _, _) = stat.second
                        val (dSessions, hasStudent) = stat.third
                        val isSelected = dayNum == selectedDay
                        Surface(
                            color = when {
                                isSelected -> NewShapeGold
                                dSessions.isNotEmpty() -> CharcoalSurface
                                else -> ObsidianBg
                            },
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                when {
                                    isSelected -> NewShapeGold
                                    dSessions.isNotEmpty() -> HairlineBorder
                                    else -> HairlineBorder.copy(alpha = 0.5f)
                                }
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { selectedDay = dayNum }
                                .testTag("pt_training_marcacoes_day_$dayNum")
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = shortLbl.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) TextOnGold else TextSecondaryDark
                                )
                                if (dayOfMonth != null) {
                                    Text(
                                        text = dayOfMonth.toString(),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (isSelected) TextOnGold else TextPrimaryDark
                                    )
                                }
                                Spacer(Modifier.height(2.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    if (hasStudent) {
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .clip(CircleShape)
                                                .background(if (isSelected) TextOnGold else ConfirmedGreen)
                                        )
                                    }
                                    Text(
                                        text = "${dSessions.size}h",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) TextOnGold.copy(alpha = 0.85f) else TextSecondaryDark
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Day Navigator Header
            item {
                val (dayNum, _, fullLbl) = currentDayStat.first
                val (dayOfMonth, monthLbl, _) = currentDayStat.second
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { selectedDay = if (dayNum <= 1) 7 else dayNum - 1 }) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "Dia anterior",
                            tint = NewShapeGoldBright
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = if (dayOfMonth != null) "$fullLbl, $dayOfMonth $monthLbl" else fullLbl,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = "${currentDaySessions.size} horário(s) disponível(is)",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                    }
                    IconButton(onClick = { selectedDay = if (dayNum >= 7) 1 else dayNum + 1 }) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = "Dia seguinte",
                            tint = NewShapeGoldBright
                        )
                    }
                }
            }

            if (currentDaySessions.isEmpty()) {
                item {
                    BrandCard {
                        Text(
                            text = "Sem horários neste dia. Seleciona outro dia da semana acima.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                        )
                    }
                }
            } else {
                items(currentDaySessions, key = { it.id }) { session ->
                    val confirmedInSlot = state.bookings.count {
                        it.sessionId == session.id && it.status == BookingStatus.CONFIRMED.name
                    }
                    val isFull = confirmedInSlot >= session.capacity
                    val existingBooking = studentBookedBySessionId[session.id]
                    val isOriginalSwapSlot = swappingTarget?.second?.id == session.id
                    val endTime = ptBookEndTime(session.timeLabel, session.durationMinutes)

                    BrandCard(highlightBorder = existingBooking != null || isOriginalSwapSlot) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                color = ElevatedCharcoal,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, HairlineBorder),
                                modifier = Modifier.width(74.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = session.timeLabel,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = NewShapeGoldBright
                                    )
                                    if (endTime.isNotEmpty()) {
                                        Text(
                                            text = "até $endTime",
                                            fontSize = 10.sp,
                                            color = TextSecondaryDark
                                        )
                                    }
                                }
                            }

                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "${session.durationMinutes} min",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                                StatusPill(
                                    text = "$confirmedInSlot/${session.capacity} confirmados",
                                    textColor = if (isFull) DangerRed else TextSecondaryDark,
                                    containerColor = if (isFull) DangerRedContainer else ElevatedCharcoal
                                )
                                if (session.note.isNotBlank()) {
                                    Text(
                                        text = session.note,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = NewShapeGoldBright
                                    )
                                }
                            }

                            val activeSwap = swappingTarget
                            if (selectedClient != null) {
                                when {
                                    activeSwap != null && isOriginalSwapSlot -> {
                                        StatusPill("Atual", TextOnGold, NewShapeGold)
                                    }
                                    activeSwap != null && existingBooking != null -> {
                                        StatusPill("Já marcado", ConfirmedGreen, ConfirmedGreenContainer)
                                    }
                                    activeSwap != null -> {
                                        Button(
                                            onClick = {
                                                val (oldBooking, oldSession) = activeSwap
                                                viewModel.swapStudentBooking(oldBooking, session, selectedClient.name)
                                                val targetWeek = weekMap[session.weekKey] ?: activeWeek
                                                val otherConfirmed = state.bookings
                                                    .filter {
                                                        it.clientId == selectedClient.id &&
                                                            it.weekKey == session.weekKey &&
                                                            it.status == BookingStatus.CONFIRMED.name &&
                                                            it.id != oldBooking.id
                                                    }
                                                    .mapNotNull { sessionMap[it.sessionId] }
                                                val allUpdated = (otherConfirmed.filter { it.id != session.id } + session)
                                                    .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
                                                val singleMsg = buildSwapMessage(selectedClient, oldSession, session, listOf(session), targetWeek)
                                                val weekMsg = if (allUpdated.size > 1) {
                                                    buildSwapMessage(selectedClient, oldSession, session, allUpdated, targetWeek)
                                                } else null
                                                swappingTarget = null
                                                messageDraft = PtMessageDraft(
                                                    title = "Horário trocado · Enviar mensagem",
                                                    subtitle = "${selectedClient.name} · Novo: ${session.dateLabel} às ${session.timeLabel}",
                                                    client = selectedClient,
                                                    message = singleMsg,
                                                    alternateMessage = weekMsg
                                                )
                                            },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = NewShapeGold,
                                                contentColor = TextOnGold
                                            ),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                                            modifier = Modifier.testTag("pt_training_swap_target_${session.id}")
                                        ) {
                                            Text("Trocar", fontWeight = FontWeight.Bold)
                                        }
                                    }
                                    existingBooking != null -> {
                                        Column(
                                            horizontalAlignment = Alignment.End,
                                            verticalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            StatusPill(
                                                text = if (existingBooking.status == BookingStatus.CONFIRMED.name) "Marcado ✓" else "Pendente",
                                                textColor = if (existingBooking.status == BookingStatus.CONFIRMED.name) ConfirmedGreen else PendingAmber,
                                                containerColor = if (existingBooking.status == BookingStatus.CONFIRMED.name) ConfirmedGreenContainer else PendingAmberContainer
                                            )
                                            TextButton(
                                                onClick = { swappingTarget = existingBooking to session },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                            ) {
                                                Text("Trocar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                                            }
                                        }
                                    }
                                    else -> {
                                        Button(
                                            onClick = {
                                                viewModel.addManualClientToSession(session.id, session.weekKey, selectedClient.id)
                                                val targetWeek = weekMap[session.weekKey] ?: activeWeek
                                                val singleMsg = buildConfirmMessage(selectedClient, listOf(session), targetWeek)
                                                val allWeek = (studentWeekBookings
                                                    .filter { it.first.status == BookingStatus.CONFIRMED.name && it.second.id != session.id }
                                                    .map { it.second } + session)
                                                    .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
                                                val weekMsg = if (allWeek.size > 1) {
                                                    buildConfirmMessage(selectedClient, allWeek, targetWeek)
                                                } else null
                                                messageDraft = PtMessageDraft(
                                                    title = "Treino marcado · Enviar mensagem",
                                                    subtitle = "${selectedClient.name} · ${session.dateLabel} às ${session.timeLabel}",
                                                    client = selectedClient,
                                                    message = singleMsg,
                                                    alternateMessage = weekMsg
                                                )
                                            },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = NewShapeGold,
                                                contentColor = TextOnGold
                                            ),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                                            modifier = Modifier.testTag("pt_training_book_slot_${session.id}")
                                        ) {
                                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text(if (isFull) "Extra" else "Marcar", fontWeight = FontWeight.Bold)
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

    // Send Message Dialog after Booking / Swapping / Cancelling
    val draft = messageDraft
    if (draft != null) {
        var editableText by remember(draft) { mutableStateOf(draft.message) }
        var altText by remember(draft) { mutableStateOf(draft.alternateMessage) }

        AlertDialog(
            onDismissRequest = { messageDraft = null },
            containerColor = CharcoalSurface,
            title = {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(draft.title, color = NewShapeGoldBright, style = MaterialTheme.typography.titleMedium)
                    Text(draft.subtitle, color = TextSecondaryDark, style = MaterialTheme.typography.bodySmall)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (altText != null) {
                        OutlinedButton(
                            onClick = {
                                val next = altText ?: return@OutlinedButton
                                altText = editableText
                                editableText = next
                            },
                            border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.7f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.SwapHoriz, contentDescription = null, tint = NewShapeGoldBright, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Alternar: só este treino / semana toda", color = NewShapeGoldBright, style = MaterialTheme.typography.labelMedium)
                        }
                    }

                    OutlinedTextField(
                        value = editableText,
                        onValueChange = { editableText = it },
                        label = { Text("Mensagem para ${draft.client.name}") },
                        minLines = 4,
                        maxLines = 8,
                        modifier = Modifier.fillMaxWidth().testTag("pt_training_msg_input"),
                        colors = darkFieldColors()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                viewModel.sendChatMessage(draft.client.id, "PT", editableText)
                                Toast.makeText(context, "Mensagem enviada no Chat da app.", Toast.LENGTH_SHORT).show()
                            },
                            border = BorderStroke(1.dp, HairlineBorder),
                            modifier = Modifier.weight(1f).testTag("pt_training_msg_chat_btn")
                        ) {
                            Icon(Icons.Default.Chat, contentDescription = null, tint = NewShapeGoldBright, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Chat App", color = TextPrimaryDark, style = MaterialTheme.typography.labelMedium)
                        }
                        OutlinedButton(
                            onClick = {
                                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                cm?.setPrimaryClip(ClipData.newPlainText("Mensagem New Shape", editableText))
                                Toast.makeText(context, "Mensagem copiada.", Toast.LENGTH_SHORT).show()
                            },
                            border = BorderStroke(1.dp, HairlineBorder),
                            modifier = Modifier.weight(1f).testTag("pt_training_msg_copy_btn")
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, tint = NewShapeGoldBright, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Copiar", color = TextPrimaryDark, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        openWhatsApp(context, draft.client.phone.ifBlank { null }, editableText, state.settings.whatsappWebMode)
                        messageDraft = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NewShapeGold, contentColor = TextOnGold),
                    modifier = Modifier.testTag("pt_training_msg_whatsapp_btn")
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("WhatsApp", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { messageDraft = null }) {
                    Text("Fechar", color = TextSecondaryDark)
                }
            }
        )
    }
}
