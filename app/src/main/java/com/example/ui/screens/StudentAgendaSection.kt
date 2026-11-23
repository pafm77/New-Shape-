package com.example.ui.screens

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.SeedCatalog
import com.example.data.model.*
import com.example.notifications.WorkoutNotificationHelper
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

private val STUDENT_DAY_SHORT_PT = mapOf(
    1 to "Seg",
    2 to "Ter",
    3 to "Qua",
    4 to "Qui",
    5 to "Sex",
    6 to "Sáb",
    7 to "Dom"
)

private val STUDENT_DAY_FULL_PT = mapOf(
    1 to "Segunda",
    2 to "Terça",
    3 to "Quarta",
    4 to "Quinta",
    5 to "Sexta",
    6 to "Sábado",
    7 to "Domingo"
)

private val STUDENT_MONTHS_PT = listOf(
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
)

private fun studentComputeEndTime(timeLabel: String, durationMinutes: Int): String {
    val parts = timeLabel.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return ""
    val m = parts.getOrNull(1)?.toIntOrNull() ?: return ""
    val total = h * 60 + m + durationMinutes.coerceAtLeast(0)
    val endH = (total / 60) % 24
    val endM = total % 60
    return "%02d:%02d".format(endH, endM)
}

private fun studentWeekDayCalendar(weekStartMillis: Long, dayOfWeek: Int): Calendar {
    return Calendar.getInstance().apply {
        timeInMillis = weekStartMillis
        add(Calendar.DAY_OF_MONTH, dayOfWeek - 1)
    }
}

private fun studentRelativeDayTag(startMillis: Long): String? {
    if (startMillis <= 0L) return null
    val today = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val target = Calendar.getInstance().apply {
        timeInMillis = startMillis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val diffDays = ((target.timeInMillis - today.timeInMillis) / 86_400_000L).toInt()
    return when (diffDays) {
        0 -> "Hoje"
        1 -> "Amanhã"
        else -> null
    }
}

@Composable
internal fun StudentAgendaSection(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val firstName = student.name.trim().split(" ").firstOrNull().orEmpty()
    val publishedWeeks = remember(state.weeks) { state.weeks.filter { it.published } }
    var subTab by remember { mutableIntStateOf(0) } // 0 = Horários (Marcar), 1 = Marcações (Confirmados)
    var weekIndex by remember(publishedWeeks.size) { mutableIntStateOf(0) }
    val currentWeek = publishedWeeks.getOrNull(weekIndex.coerceIn(0, (publishedWeeks.size - 1).coerceAtLeast(0)))

    val studioDefaultLeadMinutes = state.settings.effectiveReminderLeadMinutes()
    var hasNotifPerm by remember { mutableStateOf(WorkoutNotificationHelper.hasNotificationPermission(context)) }
    var remindersEnabled by remember { mutableStateOf(WorkoutNotificationHelper.isStudentRemindersEnabled(context)) }
    var hasCustomLead by remember { mutableStateOf(WorkoutNotificationHelper.hasStudentCustomReminderLead(context)) }
    var leadMinutes by remember(studioDefaultLeadMinutes, hasCustomLead) {
        mutableIntStateOf(
            if (hasCustomLead) WorkoutNotificationHelper.getStudentReminderLeadMinutes(context, studioDefaultLeadMinutes)
            else studioDefaultLeadMinutes
        )
    }
    var scheduledCount by remember { mutableIntStateOf(0) }

    val notifPermLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasNotifPerm = granted
        if (granted) {
            remindersEnabled = true
            WorkoutNotificationHelper.setStudentRemindersEnabled(context, true)
        }
    }

    LaunchedEffect(remindersEnabled, hasNotifPerm, leadMinutes, student.id, state.bookings, state.sessions) {
        if (remindersEnabled && hasNotifPerm) {
            scheduledCount = WorkoutNotificationHelper.scheduleConfirmedWorkoutReminders(
                context = context,
                clientId = student.id,
                bookings = state.bookings,
                sessions = state.sessions.filter { !it.ptPrivatePersonal },
                leadMinutes = leadMinutes
            )
        } else {
            WorkoutNotificationHelper.cancelScheduledReminders(context)
            scheduledCount = 0
        }
    }

    val visibleSessions = remember(state.sessions) {
        state.sessions.filter { !it.ptPrivatePersonal }
    }
    val visibleSessionIds = remember(visibleSessions) {
        visibleSessions.map { it.id }.toSet()
    }

    val weekSessions = remember(visibleSessions, currentWeek?.weekKey) {
        if (currentWeek == null) emptyList()
        else visibleSessions
            .filter { it.weekKey == currentWeek.weekKey }
            .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
    }

    var selectedDay by remember(currentWeek?.weekKey) { mutableIntStateOf(1) }

    LaunchedEffect(currentWeek?.weekKey, weekSessions.size) {
        if (currentWeek == null) return@LaunchedEffect
        val nowCal = Calendar.getInstance()
        val jsDay = nowCal.get(Calendar.DAY_OF_WEEK)
        val todayIsoDay = if (jsDay == Calendar.SUNDAY) 7 else jsDay - 1
        nowCal.set(Calendar.HOUR_OF_DAY, 0)
        nowCal.set(Calendar.MINUTE, 0)
        nowCal.set(Calendar.SECOND, 0)
        nowCal.set(Calendar.MILLISECOND, 0)
        val todayMs = nowCal.timeInMillis
        val isCurrentWeek = todayMs >= currentWeek.startDateMillis && todayMs < currentWeek.startDateMillis + 7 * 86_400_000L
        val daysWithSessions = weekSessions.map { it.dayOfWeek }.distinct().sorted()
        selectedDay = when {
            isCurrentWeek && todayIsoDay in daysWithSessions -> todayIsoDay
            daysWithSessions.isNotEmpty() -> daysWithSessions.first()
            else -> 1
        }
    }

    val daySessions = remember(weekSessions, selectedDay) {
        weekSessions.filter { it.dayOfWeek == selectedDay }
    }

    val existingBookings = remember(state.bookings, currentWeek?.weekKey, student.id, visibleSessionIds) {
        if (currentWeek == null) emptyList()
        else state.bookings.filter {
            it.weekKey == currentWeek.weekKey &&
                it.clientId == student.id &&
                it.status != BookingStatus.CANCELLED.name &&
                it.sessionId in visibleSessionIds
        }
    }
    val existingIds = remember(existingBookings) { existingBookings.map { it.sessionId }.toSet() }
    var selectedSessionIds by remember(currentWeek?.weekKey, existingIds) { mutableStateOf(existingIds) }

    val unavailableThisWeek = currentWeek != null && state.weekResponses.any {
        it.weekKey == currentWeek.weekKey && it.clientId == student.id && it.status == "UNAVAILABLE"
    }

    val cutoffMs = state.settings.effectiveCutoffMinutes() * 60_000L
    val nowMs = System.currentTimeMillis()
    val hasConfirmedInWeek = existingBookings.any { it.status == BookingStatus.CONFIRMED.name }
    val canEditExisting = existingBookings.isEmpty() || !hasConfirmedInWeek || state.settings.clientsCanEdit
    val weeklyLimit = student.weeklySessionLimit.coerceAtLeast(0)

    // Data for "Marcações" sub-tab across all weeks
    val sessionMap = remember(visibleSessions) { visibleSessions.associateBy { it.id } }
    val weekMap = remember(state.weeks) { state.weeks.associateBy { it.weekKey } }

    val myConfirmedAll = remember(state.bookings, sessionMap, student.id) {
        state.bookings
            .filter { it.clientId == student.id && it.status == BookingStatus.CONFIRMED.name }
            .mapNotNull { booking -> sessionMap[booking.sessionId]?.let { booking to it } }
            .sortedBy { it.second.startMillis }
    }
    val myPendingAll = remember(state.bookings, sessionMap, student.id) {
        state.bookings
            .filter {
                it.clientId == student.id &&
                    (it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name)
            }
            .mapNotNull { booking -> sessionMap[booking.sessionId]?.let { booking to it } }
            .sortedBy { it.second.startMillis }
    }

    val upcomingConfirmed = remember(myConfirmedAll, nowMs) {
        myConfirmedAll.filter { (_, s) ->
            s.startMillis + s.durationMinutes.coerceAtLeast(30) * 60_000L >= nowMs
        }
    }
    val pastConfirmed = remember(myConfirmedAll, nowMs) {
        myConfirmedAll
            .filter { (_, s) ->
                s.startMillis + s.durationMinutes.coerceAtLeast(30) * 60_000L < nowMs
            }
            .reversed()
    }
    var showPastConfirmed by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column {
                Text("Olá, $firstName! 👋", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                Text(
                    if (subTab == 0) "Escolhe o dia e a hora do teu treino"
                    else "Consulta os dias e horários confirmados pelo teu PT",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
        }

        // Sub-tab Switcher: Horários | Marcações
        item {
            Surface(
                color = CharcoalSurface,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(5.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val isHorarios = subTab == 0
                    Surface(
                        color = if (isHorarios) NewShapeGold else CharcoalSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { subTab = 0 }
                            .testTag("student_agenda_subtab_horarios")
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                Icons.Default.CalendarMonth,
                                contentDescription = "Horários",
                                tint = if (isHorarios) TextOnGold else TextSecondaryDark,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Horários",
                                fontWeight = FontWeight.Bold,
                                color = if (isHorarios) TextOnGold else TextSecondaryDark,
                                maxLines = 1
                            )
                        }
                    }

                    val isMarcacoes = subTab == 1
                    Surface(
                        color = if (isMarcacoes) NewShapeGold else CharcoalSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { subTab = 1 }
                            .testTag("student_agenda_subtab_marcacoes")
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                Icons.Default.EventAvailable,
                                contentDescription = "Marcações",
                                tint = if (isMarcacoes) TextOnGold else TextSecondaryDark,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Marcações",
                                fontWeight = FontWeight.Bold,
                                color = if (isMarcacoes) TextOnGold else TextSecondaryDark,
                                maxLines = 1
                            )
                            if (upcomingConfirmed.isNotEmpty()) {
                                Spacer(Modifier.width(6.dp))
                                Surface(
                                    color = if (isMarcacoes) ObsidianBg else ConfirmedGreenContainer,
                                    shape = CircleShape
                                ) {
                                    Text(
                                        text = "${upcomingConfirmed.size}",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = ConfirmedGreen,
                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (subTab == 0) {
            // ================= SUB-TAB 1: HORÁRIOS (DIA A DIA / HORA A HORA) =================
            if (student.fixedSlots.isNotEmpty()) {
                val fixedSummary = SeedCatalog.formatFixedSlotsSummary(student.fixedSlots)
                item {
                    Surface(
                        color = NewShapeGoldMuted,
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                StatusPill("Horário Fixo", NewShapeGoldBright, ElevatedCharcoal)
                                Text(
                                    text = fixedSummary,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = NewShapeGoldBright
                                )
                            }
                            Text(
                                text = "Os teus dias fixos são marcados automaticamente todas as semanas e ficam a aguardar confirmação do teu PT. Podes sempre alterar ou cancelar se precisares.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark
                            )
                        }
                    }
                }
            }
            if (publishedWeeks.isEmpty()) {
                item {
                    EmptyStateBox(
                        icon = Icons.Default.EventBusy,
                        title = "Sem semanas publicadas",
                        subtitle = "O teu PT ainda está a preparar os horários desta semana."
                    )
                }
                return@LazyColumn
            }

            // Week Switcher + 7-Day Selector Strip
            item {
                BrandCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        IconButton(
                            enabled = weekIndex > 0,
                            onClick = { weekIndex = (weekIndex - 1).coerceAtLeast(0) },
                            modifier = Modifier.testTag("student_week_prev_btn")
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "Semana anterior",
                                tint = if (weekIndex > 0) NewShapeGold else TextSecondaryDark
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Semana", style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                            Text(currentWeek?.label ?: "", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                            if (weeklyLimit > 0) {
                                Spacer(Modifier.height(4.dp))
                                val atLimit = selectedSessionIds.size >= weeklyLimit
                                StatusPill(
                                    text = "Pacote: ${selectedSessionIds.size} / $weeklyLimit treinos esta semana",
                                    textColor = if (atLimit) PendingAmber else NewShapeGoldBright,
                                    containerColor = if (atLimit) PendingAmberContainer else NewShapeGoldMuted
                                )
                            }
                        }
                        IconButton(
                            enabled = weekIndex < publishedWeeks.lastIndex,
                            onClick = { weekIndex = (weekIndex + 1).coerceAtMost(publishedWeeks.lastIndex) },
                            modifier = Modifier.testTag("student_week_next_btn")
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "Próxima semana",
                                tint = if (weekIndex < publishedWeeks.lastIndex) NewShapeGold else TextSecondaryDark
                            )
                        }
                    }

                    if (currentWeek != null) {
                        Spacer(Modifier.height(12.dp))
                        HorizontalDivider(color = HairlineBorder.copy(alpha = 0.7f))
                        Spacer(Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            (1..7).forEach { dayNum ->
                                val dayCal = studentWeekDayCalendar(currentWeek.startDateMillis, dayNum)
                                val dayNumber = dayCal.get(Calendar.DAY_OF_MONTH)
                                val sessionsOnDay = weekSessions.filter { it.dayOfWeek == dayNum }
                                val selectedOnDay = sessionsOnDay.count { it.id in selectedSessionIds }
                                val confirmedOnDay = sessionsOnDay.count { s ->
                                    existingBookings.any { it.sessionId == s.id && it.status == BookingStatus.CONFIRMED.name }
                                }
                                val isSelDay = selectedDay == dayNum
                                val hasSessions = sessionsOnDay.isNotEmpty()

                                Surface(
                                    color = when {
                                        isSelDay -> NewShapeGold
                                        confirmedOnDay > 0 -> ConfirmedGreenContainer.copy(alpha = 0.65f)
                                        selectedOnDay > 0 -> NewShapeGoldMuted
                                        hasSessions -> ElevatedCharcoal
                                        else -> ObsidianBg.copy(alpha = 0.6f)
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(
                                        width = if (isSelDay) 1.5.dp else 1.dp,
                                        color = when {
                                            isSelDay -> NewShapeGoldBright
                                            confirmedOnDay > 0 -> ConfirmedGreen
                                            selectedOnDay > 0 -> NewShapeGold
                                            hasSessions -> HairlineBorder
                                            else -> HairlineBorder.copy(alpha = 0.35f)
                                        }
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 66.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable { selectedDay = dayNum }
                                        .testTag("student_day_pill_$dayNum")
                                ) {
                                    Column(
                                        modifier = Modifier.padding(vertical = 7.dp, horizontal = 2.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = STUDENT_DAY_SHORT_PT[dayNum] ?: "",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelDay) TextOnGold else TextSecondaryDark,
                                            maxLines = 1
                                        )
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            text = "$dayNumber",
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = when {
                                                isSelDay -> TextOnGold
                                                hasSessions -> TextPrimaryDark
                                                else -> TextSecondaryDark.copy(alpha = 0.55f)
                                            }
                                        )
                                        Spacer(Modifier.height(4.dp))
                                        when {
                                            confirmedOnDay > 0 -> Box(
                                                modifier = Modifier
                                                    .size(7.dp)
                                                    .clip(CircleShape)
                                                    .background(if (isSelDay) TextOnGold else ConfirmedGreen)
                                            )
                                            selectedOnDay > 0 -> Box(
                                                modifier = Modifier
                                                    .size(7.dp)
                                                    .clip(CircleShape)
                                                    .background(if (isSelDay) TextOnGold else NewShapeGoldBright)
                                            )
                                            hasSessions -> Text(
                                                text = "${sessionsOnDay.size}h",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isSelDay) TextOnGold.copy(alpha = 0.8f) else TextSecondaryDark
                                            )
                                            else -> Text(
                                                text = "—",
                                                fontSize = 9.sp,
                                                color = TextSecondaryDark.copy(alpha = 0.45f)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Current Status Banner
            if (unavailableThisWeek) {
                item {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Avisaste que esta semana não podes treinar. Se mudares de ideias, seleciona os horários abaixo!",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextPrimaryDark,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }
            } else if (existingBookings.isNotEmpty()) {
                item {
                    val anyPending = existingBookings.any {
                        it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
                    }
                    Surface(
                        color = if (anyPending) PendingAmberContainer else ConfirmedGreenContainer,
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(1.dp, if (anyPending) PendingAmber else ConfirmedGreen),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (anyPending) "Pedido recebido! 🙌" else "Treinos confirmados ✓",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = if (anyPending) PendingAmber else ConfirmedGreen
                                )
                                Text(
                                    text = if (anyPending) "Vais receber a confirmação do PT no WhatsApp."
                                    else "Consulta os teus horários na subaba Marcações.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimaryDark
                                )
                            }
                            if (!anyPending) {
                                TextButton(
                                    onClick = { subTab = 1 },
                                    modifier = Modifier.testTag("student_jump_to_marcacoes_btn")
                                ) {
                                    Text("Ver →", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                StatusPill(
                                    text = "Por confirmar",
                                    textColor = PendingAmber,
                                    containerColor = ObsidianBg.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }
                }
            }

            // Selected Day Header (< Day, Date >)
            if (currentWeek != null) {
                item {
                    val dayCal = studentWeekDayCalendar(currentWeek.startDateMillis, selectedDay)
                    val dayTitle = "${STUDENT_DAY_FULL_PT[selectedDay]}, ${dayCal.get(Calendar.DAY_OF_MONTH)} ${STUDENT_MONTHS_PT[dayCal.get(Calendar.MONTH)]}"
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        IconButton(
                            enabled = selectedDay > 1,
                            onClick = { selectedDay = (selectedDay - 1).coerceAtLeast(1) },
                            modifier = Modifier.testTag("student_day_prev_btn")
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "Dia anterior",
                                tint = if (selectedDay > 1) NewShapeGold else TextSecondaryDark
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = dayTitle,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimaryDark
                            )
                            Text(
                                text = if (daySessions.isEmpty()) "Sem horários publicados neste dia"
                                else "${daySessions.size} horário(s) disponível(is)",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                        IconButton(
                            enabled = selectedDay < 7,
                            onClick = { selectedDay = (selectedDay + 1).coerceAtMost(7) },
                            modifier = Modifier.testTag("student_day_next_btn")
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "Dia seguinte",
                                tint = if (selectedDay < 7) NewShapeGold else TextSecondaryDark
                            )
                        }
                    }
                }
            }

            // Hour-by-Hour Slots for Selected Day
            if (daySessions.isEmpty()) {
                item {
                    EmptyStateBox(
                        icon = Icons.Default.Schedule,
                        title = "Sem treinos em ${STUDENT_DAY_FULL_PT[selectedDay]}",
                        subtitle = "Seleciona outro dia na barra acima para ver os horários disponíveis."
                    )
                }
            } else {
                items(daySessions, key = { it.id }) { session ->
                    val confirmedCount = state.bookings.count {
                        it.sessionId == session.id && it.status == BookingStatus.CONFIRMED.name
                    }
                    val isFull = confirmedCount >= session.capacity
                    val isSelected = session.id in selectedSessionIds
                    val isPastCutoff = cutoffMs > 0L && session.startMillis > 0 && (session.startMillis - nowMs) < cutoffMs
                    val existingForSession = existingBookings.find { it.sessionId == session.id }
                    val isFullForNew = isFull && !isSelected
                    val canToggle = canEditExisting && !isPastCutoff && !isFullForNew
                    val endTime = studentComputeEndTime(session.timeLabel, session.durationMinutes)

                    val sessionWaitlist = state.waitlistEntries
                        .filter { it.sessionId == session.id }
                        .sortedBy { it.createdAtMillis }
                    val myWaitlistIdx = sessionWaitlist.indexOfFirst { it.clientId == student.id }
                    val myWaitlistEntry = sessionWaitlist.getOrNull(myWaitlistIdx)

                    Surface(
                        color = when {
                            existingForSession?.status == BookingStatus.CONFIRMED.name && isSelected ->
                                ConfirmedGreenContainer.copy(alpha = 0.55f)
                            isSelected -> NewShapeGoldMuted
                            myWaitlistEntry != null -> PendingAmberContainer.copy(alpha = 0.4f)
                            else -> CharcoalSurface
                        },
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(
                            width = if (isSelected) 2.dp else 1.dp,
                            color = when {
                                existingForSession?.status == BookingStatus.CONFIRMED.name && isSelected -> ConfirmedGreen
                                isSelected -> NewShapeGold
                                myWaitlistEntry != null -> PendingAmber
                                else -> HairlineBorder
                            }
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(MaterialTheme.shapes.medium)
                            .clickable(enabled = canToggle) {
                                if (!isSelected && weeklyLimit > 0 && selectedSessionIds.size >= weeklyLimit) {
                                    Toast.makeText(
                                        context,
                                        "Atingiste o limite semanal do teu pacote ($weeklyLimit treino(s)/semana).",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                } else {
                                    selectedSessionIds =
                                        if (isSelected) selectedSessionIds - session.id
                                        else selectedSessionIds + session.id
                                }
                            }
                            .testTag("student_session_${session.id}")
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                // Time Pill
                                Surface(
                                    color = if (isSelected) NewShapeGold else ElevatedCharcoal,
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(
                                        1.dp,
                                        if (isSelected) NewShapeGoldBright else HairlineBorder
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .widthIn(min = 68.dp)
                                            .padding(horizontal = 10.dp, vertical = 8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(
                                            text = session.timeLabel,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isSelected) TextOnGold else NewShapeGoldBright
                                        )
                                        if (endTime.isNotBlank()) {
                                            Text(
                                                text = "até $endTime",
                                                fontSize = 10.sp,
                                                color = if (isSelected) TextOnGold.copy(alpha = 0.8f) else TextSecondaryDark
                                            )
                                        }
                                    }
                                }

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Treino · ${session.durationMinutes} min",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = if (isSelected) NewShapeGoldBright else TextPrimaryDark
                                    )
                                    Text(
                                        text = session.note.ifBlank {
                                            if (isSelected) "Toca para desmarcar"
                                            else if (isFull) "Horário completo"
                                            else "Toca para selecionar"
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (isPastCutoff) {
                                        Text(
                                            text = "Fechado (menos de ${state.settings.formatCutoffLabel()})",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = DangerRed
                                        )
                                    }
                                }

                                Column(
                                    horizontalAlignment = Alignment.End,
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    if (existingForSession != null) {
                                        val conf = existingForSession.status == BookingStatus.CONFIRMED.name
                                        StatusPill(
                                            text = if (conf) "Confirmado" else "Por confirmar",
                                            textColor = if (conf) ConfirmedGreen else PendingAmber,
                                            containerColor = if (conf) ConfirmedGreenContainer else PendingAmberContainer
                                        )
                                    } else if (myWaitlistEntry != null) {
                                        StatusPill(
                                            text = "Espera #${myWaitlistIdx + 1}",
                                            textColor = PendingAmber,
                                            containerColor = PendingAmberContainer
                                        )
                                    } else {
                                        StatusPill(
                                            text = if (isFull) "Esgotado" else if (isSelected) "Selecionado" else "Disponível",
                                            textColor = if (isFull) DangerRed else if (isSelected) NewShapeGoldBright else ConfirmedGreen,
                                            containerColor = if (isFull) DangerRedContainer else if (isSelected) NewShapeGoldMuted else ConfirmedGreenContainer
                                        )
                                    }
                                    Icon(
                                        imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                        contentDescription = if (isSelected) "Selecionado" else "Selecionar",
                                        tint = if (isSelected) NewShapeGold else TextSecondaryDark,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }

                            if (isFullForNew && !isPastCutoff && canEditExisting && currentWeek != null) {
                                Spacer(Modifier.height(10.dp))
                                HorizontalDivider(color = HairlineBorder.copy(alpha = 0.6f))
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = when {
                                            myWaitlistEntry != null -> "Estás em #${myWaitlistIdx + 1} na lista de espera"
                                            sessionWaitlist.isNotEmpty() -> "${sessionWaitlist.size} aluno(s) em lista de espera"
                                            else -> "Turma completa"
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark,
                                        modifier = Modifier.weight(1f)
                                    )
                                    if (myWaitlistEntry != null) {
                                        TextButton(
                                            onClick = { viewModel.leaveWaitlist(myWaitlistEntry.id) },
                                            modifier = Modifier.testTag("student_leave_waitlist_${session.id}")
                                        ) {
                                            Text("Sair da espera", color = DangerRed, fontWeight = FontWeight.Bold)
                                        }
                                    } else {
                                        TextButton(
                                            onClick = { viewModel.joinWaitlist(session.id, currentWeek.weekKey, student.id) },
                                            modifier = Modifier.testTag("student_join_waitlist_${session.id}")
                                        ) {
                                            Text("Lista de espera", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Summary of all selected sessions across the active week
            val selectedAcrossWeek = weekSessions.filter { it.id in selectedSessionIds }
            if (selectedAcrossWeek.isNotEmpty()) {
                item {
                    Surface(
                        color = CharcoalSurface,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "Selecionados nesta semana (${selectedAcrossWeek.size}):",
                                style = MaterialTheme.typography.labelMedium,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                selectedAcrossWeek.forEach { s ->
                                    FilterChip(
                                        selected = s.dayOfWeek == selectedDay,
                                        onClick = { selectedDay = s.dayOfWeek },
                                        label = { Text("${STUDENT_DAY_SHORT_PT[s.dayOfWeek]} · ${s.timeLabel}") },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = NewShapeGold,
                                            selectedLabelColor = TextOnGold,
                                            containerColor = NewShapeGoldMuted,
                                            labelColor = NewShapeGoldBright
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Actions
            if (currentWeek != null) {
                item {
                    Spacer(Modifier.height(4.dp))
                    GoldPrimaryButton(
                        text = if (existingBookings.isEmpty()) "Marcar treinos (${selectedSessionIds.size})"
                        else "Guardar alterações (${selectedSessionIds.size})",
                        icon = Icons.Default.Check,
                        enabled = canEditExisting && (selectedSessionIds.isNotEmpty() || existingBookings.isNotEmpty()),
                        onClick = {
                            if (weeklyLimit > 0 && selectedSessionIds.size > weeklyLimit) {
                                Toast.makeText(
                                    context,
                                    "O teu pacote permite até $weeklyLimit treino(s) por semana.",
                                    Toast.LENGTH_SHORT
                                ).show()
                            } else {
                                viewModel.submitStudentBookings(currentWeek.weekKey, student.id, selectedSessionIds)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "student_submit_bookings_btn"
                    )
                    Spacer(Modifier.height(8.dp))
                    DarkSecondaryButton(
                        text = "Esta semana não posso",
                        onClick = { viewModel.markStudentUnavailable(currentWeek.weekKey, student.id) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        } else {
            // ================= SUB-TAB 2: MARCAÇÕES (TREINOS CONFIRMADOS PELO PT) =================
            item {
                BrandCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Confirmados pelo PT", style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                            Text("Os Teus Próximos Treinos", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                        }
                        StatusPill(
                            text = "${upcomingConfirmed.size} confirmado(s)",
                            textColor = if (upcomingConfirmed.isNotEmpty()) ConfirmedGreen else TextSecondaryDark,
                            containerColor = if (upcomingConfirmed.isNotEmpty()) ConfirmedGreenContainer else ElevatedCharcoal
                        )
                    }
                }
            }

            if (upcomingConfirmed.isEmpty()) {
                item {
                    BrandCard {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.EventAvailable,
                                contentDescription = "Sem treinos confirmados",
                                tint = NewShapeGold,
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(Modifier.height(10.dp))
                            Text(
                                text = "Ainda não tens treinos confirmados",
                                style = MaterialTheme.typography.titleSmall,
                                color = TextPrimaryDark,
                                textAlign = TextAlign.Center
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = if (myPendingAll.isNotEmpty())
                                    "Tens pedidos enviados a aguardar confirmação do teu PT."
                                else
                                    "Escolhe os teus dias e horários na subaba Horários.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark,
                                textAlign = TextAlign.Center
                            )
                            Spacer(Modifier.height(14.dp))
                            GoldPrimaryButton(
                                text = "Escolher horários",
                                icon = Icons.Default.CalendarMonth,
                                onClick = { subTab = 0 },
                                testTag = "student_empty_marcacoes_cta"
                            )
                        }
                    }
                }
            } else {
                itemsIndexed(upcomingConfirmed, key = { _, pair -> pair.first.id }) { idx, (booking, session) ->
                    val endTime = studentComputeEndTime(session.timeLabel, session.durationMinutes)
                    val relTag = studentRelativeDayTag(session.startMillis)
                    val week = weekMap[booking.weekKey]
                    val isNextUp = idx == 0

                    Surface(
                        color = if (isNextUp) ConfirmedGreenContainer.copy(alpha = 0.65f) else CharcoalSurface,
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(
                            width = if (isNextUp) 1.5.dp else 1.dp,
                            color = if (isNextUp) ConfirmedGreen else ConfirmedGreen.copy(alpha = 0.45f)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("student_confirmed_booking_${booking.id}")
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                color = ConfirmedGreenContainer,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, ConfirmedGreen.copy(alpha = 0.65f))
                            ) {
                                Column(
                                    modifier = Modifier
                                        .widthIn(min = 70.dp)
                                        .padding(horizontal = 10.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = session.timeLabel,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = ConfirmedGreen
                                    )
                                    if (endTime.isNotBlank()) {
                                        Text(
                                            text = endTime,
                                            fontSize = 10.sp,
                                            color = ConfirmedGreen.copy(alpha = 0.8f)
                                        )
                                    }
                                }
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    if (isNextUp) {
                                        StatusPill(
                                            text = "Próximo",
                                            textColor = TextOnGold,
                                            containerColor = NewShapeGold
                                        )
                                    }
                                    if (relTag != null) {
                                        StatusPill(
                                            text = relTag,
                                            textColor = NewShapeGoldBright,
                                            containerColor = NewShapeGoldMuted
                                        )
                                    }
                                }
                                if (isNextUp || relTag != null) Spacer(Modifier.height(4.dp))
                                Text(
                                    text = session.dateLabel,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = TextPrimaryDark
                                )
                                Text(
                                    text = "${session.timeLabel.replace(":", "h")}" +
                                        (if (endTime.isNotBlank()) " – ${endTime.replace(":", "h")}" else "") +
                                        " · ${session.durationMinutes} min" +
                                        (if (week != null) " · Sem. ${week.label}" else ""),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                                if (session.note.isNotBlank()) {
                                    Text(
                                        text = session.note,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = NewShapeGoldBright
                                    )
                                }
                            }

                            Column(
                                horizontalAlignment = Alignment.End,
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                StatusPill(
                                    text = "Confirmado ✓",
                                    textColor = ConfirmedGreen,
                                    containerColor = ConfirmedGreenContainer
                                )
                                when (booking.attendanceStatus) {
                                    "PRESENT" -> Text(
                                        text = "Presença ✓",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = ConfirmedGreen,
                                        fontWeight = FontWeight.Bold
                                    )
                                    "ABSENT" -> Text(
                                        text = "Falta",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DangerRed,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Pending Requests awaiting PT confirmation
            if (myPendingAll.isNotEmpty()) {
                item {
                    BrandCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "A aguardar confirmação do PT (${myPendingAll.size})",
                                style = MaterialTheme.typography.titleSmall,
                                color = PendingAmber
                            )
                            StatusPill(
                                text = "Pendente",
                                textColor = PendingAmber,
                                containerColor = PendingAmberContainer
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            myPendingAll.forEach { (_, session) ->
                                Surface(
                                    color = PendingAmberContainer.copy(alpha = 0.35f),
                                    shape = RoundedCornerShape(10.dp),
                                    border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.45f)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(session.dateLabel, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
                                            Text(
                                                "${session.timeLabel.replace(":", "h")} · ${session.durationMinutes} min",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = NewShapeGoldBright
                                            )
                                        }
                                        StatusPill(
                                            text = "Por confirmar",
                                            textColor = PendingAmber,
                                            containerColor = ObsidianBg.copy(alpha = 0.5f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Push Training Reminder Card (belongs right with confirmed workouts!)
            item {
                BrandCard {
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
                                Icon(
                                    Icons.Default.NotificationsActive,
                                    contentDescription = "Lembretes de treino",
                                    tint = NewShapeGoldBright,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text("Lembretes de Treino", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                            }
                            Text(
                                text = if (remindersEnabled && hasNotifPerm) {
                                    if (scheduledCount > 0) "$scheduledCount lembrete(s) agendado(s) para os teus treinos confirmados"
                                    else "Ativo · Agenda automaticamente os teus próximos treinos confirmados"
                                } else {
                                    "Recebe uma notificação antes de cada treino confirmado"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        Switch(
                            checked = remindersEnabled && hasNotifPerm,
                            onCheckedChange = { enable ->
                                if (enable && !hasNotifPerm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    remindersEnabled = enable
                                    WorkoutNotificationHelper.setStudentRemindersEnabled(context, enable)
                                }
                            },
                            modifier = Modifier.testTag("student_reminders_switch"),
                            colors = SwitchDefaults.colors(checkedThumbColor = TextOnGold, checkedTrackColor = NewShapeGold)
                        )
                    }

                    if (remindersEnabled && hasNotifPerm) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = "Avisar ${formatReminderLeadLabel(leadMinutes)} antes do treino:",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                        Spacer(Modifier.height(6.dp))
                        val presetOptions = remember(studioDefaultLeadMinutes) {
                            val base = listOf(15, 30, 60, 120)
                            if (studioDefaultLeadMinutes in base) base
                            else (listOf(studioDefaultLeadMinutes) + base).distinct().sorted()
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            presetOptions.forEach { mins ->
                                val isStudioDefault = mins == studioDefaultLeadMinutes
                                val chipLabel = if (isStudioDefault) {
                                    "${formatReminderLeadLabel(mins)} (PT)"
                                } else {
                                    formatReminderLeadLabel(mins)
                                }
                                FilterChip(
                                    selected = leadMinutes == mins,
                                    onClick = {
                                        leadMinutes = mins
                                        if (isStudioDefault) {
                                            hasCustomLead = false
                                            WorkoutNotificationHelper.clearStudentCustomReminderLead(context)
                                        } else {
                                            hasCustomLead = true
                                            WorkoutNotificationHelper.setStudentReminderLeadMinutes(context, mins)
                                        }
                                    },
                                    label = { Text(chipLabel) },
                                    modifier = Modifier.testTag("student_reminder_lead_$mins"),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NewShapeGold,
                                        selectedLabelColor = TextOnGold
                                    )
                                )
                            }
                            TextButton(
                                onClick = {
                                    WorkoutNotificationHelper.showImmediateNotification(
                                        context = context,
                                        channelId = WorkoutNotificationHelper.CHANNEL_REMINDERS,
                                        title = "Lembrete de treino · New Shape",
                                        body = "Os teus lembretes de treino estão ativos (${formatReminderLeadLabel(leadMinutes)} antes de cada sessão confirmada).",
                                        notificationId = 8001
                                    )
                                },
                                modifier = Modifier.testTag("student_test_reminder_btn")
                            ) {
                                Text("Testar", color = NewShapeGoldBright)
                            }
                        }
                    }
                }
            }

            // Past Confirmed History (Collapsible)
            if (pastConfirmed.isNotEmpty()) {
                item {
                    BrandCard {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showPastConfirmed = !showPastConfirmed }
                                .padding(vertical = 4.dp)
                                .testTag("student_toggle_past_confirmed_btn"),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Treinos confirmados anteriores (${pastConfirmed.size})",
                                style = MaterialTheme.typography.labelLarge,
                                color = TextSecondaryDark
                            )
                            Text(
                                text = if (showPastConfirmed) "Ocultar" else "Ver histórico",
                                style = MaterialTheme.typography.labelMedium,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (showPastConfirmed) {
                            Spacer(Modifier.height(10.dp))
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                pastConfirmed.forEach { (booking, session) ->
                                    Surface(
                                        color = ElevatedCharcoal,
                                        shape = RoundedCornerShape(10.dp),
                                        border = BorderStroke(1.dp, HairlineBorder),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(session.dateLabel, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
                                                Text(
                                                    "${session.timeLabel.replace(":", "h")} · ${session.durationMinutes} min",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = TextSecondaryDark
                                                )
                                            }
                                            when (booking.attendanceStatus) {
                                                "PRESENT" -> StatusPill("Realizado ✓", ConfirmedGreen, ConfirmedGreenContainer)
                                                "ABSENT" -> StatusPill("Faltou", DangerRed, DangerRedContainer)
                                                else -> StatusPill("Concluído", TextSecondaryDark, CharcoalSurface)
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
