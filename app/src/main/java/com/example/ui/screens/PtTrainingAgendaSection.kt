package com.example.ui.screens

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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.SeedCatalog
import com.example.data.model.BookingStatus
import com.example.data.model.TrainingSessionRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar

private val AGENDA_DAYS_SHORT = listOf("Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom")

private fun startOfDayMillis(ts: Long = System.currentTimeMillis()): Long {
    val c = Calendar.getInstance().apply {
        timeInMillis = ts
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    return c.timeInMillis
}

private fun isSameDay(calA: Calendar, calB: Calendar): Boolean =
    calA.get(Calendar.YEAR) == calB.get(Calendar.YEAR) &&
        calA.get(Calendar.DAY_OF_YEAR) == calB.get(Calendar.DAY_OF_YEAR)

private fun mondayOf(cal: Calendar): Calendar {
    val c = cal.clone() as Calendar
    val dow = c.get(Calendar.DAY_OF_WEEK)
    val diff = if (dow == Calendar.SUNDAY) -6 else Calendar.MONDAY - dow
    c.add(Calendar.DAY_OF_YEAR, diff)
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    return c
}

private fun sessionMatchesDay(session: TrainingSessionRecord, targetCal: Calendar): Boolean {
    if (session.startMillis > 0L) {
        val sCal = Calendar.getInstance().apply { timeInMillis = session.startMillis }
        return isSameDay(sCal, targetCal)
    }
    val targetWeekKey = SeedCatalog.formatWeekKey(mondayOf(targetCal))
    val dow = targetCal.get(Calendar.DAY_OF_WEEK)
    val isoDay = if (dow == Calendar.SUNDAY) 7 else dow - 1
    return session.weekKey == targetWeekKey && session.dayOfWeek == isoDay
}

@Composable
fun PtTrainingAgendaSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onOpenClientPlan: (String) -> Unit
) {
    val todayMillis = remember { startOfDayMillis() }
    var selectedDateMillis by remember { mutableLongStateOf(todayMillis) }

    val todayCal = remember(todayMillis) { Calendar.getInstance().apply { timeInMillis = todayMillis } }
    val selectedCal = remember(selectedDateMillis) { Calendar.getInstance().apply { timeInMillis = selectedDateMillis } }
    val isSelectedToday = isSameDay(selectedCal, todayCal)
    val clientMap = remember(state.clients) { state.clients.associateBy { it.id } }

    fun shiftDay(delta: Int) {
        val next = (selectedCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, delta) }
        selectedDateMillis = startOfDayMillis(next.timeInMillis)
    }

    val weekStrip = remember(selectedDateMillis, state.sessions) {
        val mon = mondayOf(selectedCal)
        (0..6).map { offset ->
            val dCal = (mon.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
            val count = state.sessions.count { sessionMatchesDay(it, dCal) }
            Triple(dCal, AGENDA_DAYS_SHORT[offset], count)
        }
    }

    val daySessions = remember(selectedDateMillis, state.sessions) {
        state.sessions
            .filter { sessionMatchesDay(it, selectedCal) }
            .sortedWith(compareBy<TrainingSessionRecord> { it.startMillis }.thenBy { it.timeLabel })
    }

    val daySummary = remember(daySessions, state.bookings) {
        val ids = daySessions.map { it.id }.toSet()
        val confirmed = state.bookings.filter {
            it.sessionId in ids && it.status == BookingStatus.CONFIRMED.name
        }
        val present = confirmed.count { it.attendanceStatus == "PRESENT" }
        val absent = confirmed.count { it.attendanceStatus == "ABSENT" }
        Triple(confirmed.size, present, absent)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Day-by-Day Header & 7-Day Strip
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(
                        onClick = { shiftDay(-1) },
                        modifier = Modifier.testTag("training_agenda_prev_day_btn")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "Dia anterior",
                            tint = NewShapeGold
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = SeedCatalog.formatDayDate(selectedCal),
                                style = MaterialTheme.typography.titleLarge,
                                color = TextPrimaryDark
                            )
                            if (isSelectedToday) {
                                StatusPill("Hoje", TextOnGold, NewShapeGold)
                            }
                        }
                        Text(
                            text = "Agenda de treinos · Confirma presenças",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                    IconButton(
                        onClick = { shiftDay(1) },
                        modifier = Modifier.testTag("training_agenda_next_day_btn")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = "Dia seguinte",
                            tint = NewShapeGold
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // 7-day strip
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    weekStrip.forEachIndexed { idx, (dCal, shortLbl, sessionCount) ->
                        val isSel = isSameDay(dCal, selectedCal)
                        val isTod = isSameDay(dCal, todayCal)
                        Surface(
                            color = when {
                                isSel -> NewShapeGold
                                isTod -> NewShapeGoldMuted
                                else -> ElevatedCharcoal
                            },
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                width = if (isSel || isTod) 1.5.dp else 1.dp,
                                color = when {
                                    isSel -> NewShapeGold
                                    isTod -> NewShapeGold.copy(alpha = 0.65f)
                                    else -> HairlineBorder
                                }
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 58.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { selectedDateMillis = startOfDayMillis(dCal.timeInMillis) }
                                .testTag("training_agenda_day_$idx")
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 6.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = shortLbl,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSel) TextOnGold else TextSecondaryDark
                                )
                                Text(
                                    text = dCal.get(Calendar.DAY_OF_MONTH).toString(),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isSel) TextOnGold else TextPrimaryDark
                                )
                                Spacer(Modifier.height(3.dp))
                                Box(
                                    modifier = Modifier
                                        .size(5.dp)
                                        .clip(CircleShape)
                                        .background(
                                            if (sessionCount > 0) {
                                                if (isSel) ObsidianBg else NewShapeGold
                                            } else {
                                                ObsidianBg.copy(alpha = 0f)
                                            }
                                        )
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                HorizontalDivider(color = HairlineBorder)
                Spacer(Modifier.height(10.dp))

                // KPI Summary
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AgendaKpiBox("Horários", daySessions.size.toString(), TextPrimaryDark, Modifier.weight(1f))
                    AgendaKpiBox("Marcados", daySummary.first.toString(), NewShapeGoldBright, Modifier.weight(1f))
                    AgendaKpiBox(
                        label = "Presenças",
                        value = if (daySummary.third > 0) "${daySummary.second}✓ · ${daySummary.third}✕" else "${daySummary.second}✓",
                        valueColor = ConfirmedGreen,
                        modifier = Modifier.weight(1f)
                    )
                }

                if (!isSelectedToday) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        TextButton(
                            onClick = { selectedDateMillis = todayMillis },
                            modifier = Modifier.testTag("training_agenda_today_btn")
                        ) {
                            Icon(Icons.Default.Today, contentDescription = "Ir para hoje", tint = NewShapeGold, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Voltar a Hoje", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Hour-by-Hour Cards
        if (daySessions.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.CalendarMonth,
                    title = "Sem treinos marcados neste dia",
                    subtitle = "Usa as setas ou os dias da semana acima para consultar os outros dias."
                )
            }
        } else {
            items(daySessions, key = { it.id }) { session ->
                val allActive = state.bookings.filter {
                    it.sessionId == session.id && it.status != BookingStatus.CANCELLED.name
                }
                val confirmed = allActive
                    .filter { it.status == BookingStatus.CONFIRMED.name }
                    .sortedBy { clientMap[it.clientId]?.name.orEmpty() }
                val pending = allActive.filter {
                    it.status == BookingStatus.PENDING.name || it.status == BookingStatus.ALTERED.name
                }
                val presentCount = confirmed.count { it.attendanceStatus == "PRESENT" }
                val absentCount = confirmed.count { it.attendanceStatus == "ABSENT" }
                val allPresent = confirmed.isNotEmpty() && presentCount == confirmed.size

                BrandCard(highlightBorder = isSelectedToday) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Surface(
                                color = NewShapeGoldMuted,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.6f))
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = session.timeLabel.replace(":", "h"),
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = NewShapeGoldBright
                                    )
                                    Text(
                                        text = "${session.durationMinutes}m",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextPrimaryDark
                                    )
                                }
                            }
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    StatusPill(
                                        text = "${confirmed.size}/${session.capacity}",
                                        textColor = if (confirmed.size >= session.capacity) DangerRed else NewShapeGoldBright,
                                        containerColor = if (confirmed.size >= session.capacity) DangerRedContainer else NewShapeGoldMuted
                                    )
                                    if (presentCount > 0 || absentCount > 0) {
                                        StatusPill(
                                            text = "${presentCount}✓${if (absentCount > 0) " · ${absentCount}✕" else ""}",
                                            textColor = ConfirmedGreen,
                                            containerColor = ConfirmedGreenContainer
                                        )
                                    }
                                }
                                if (session.note.isNotBlank()) {
                                    Text(
                                        text = session.note,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                            }
                        }

                        if (confirmed.size > 1 && !allPresent) {
                            TextButton(
                                onClick = {
                                    confirmed
                                        .filter { it.attendanceStatus != "PRESENT" }
                                        .forEach { viewModel.setBookingAttendance(it.id, "PRESENT") }
                                },
                                modifier = Modifier.testTag("agenda_all_present_${session.id}")
                            ) {
                                Text("Todos ✓", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = HairlineBorder)
                    Spacer(Modifier.height(10.dp))

                    if (confirmed.isEmpty()) {
                        Text(
                            text = "Sem alunos confirmados neste horário.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            confirmed.forEach { booking ->
                                val client = clientMap[booking.clientId]
                                if (client != null) {
                                    val isPresent = booking.attendanceStatus == "PRESENT"
                                    val isAbsent = booking.attendanceStatus == "ABSENT"
                                    val isPersonal = client.trainingType == "PERSONALIZADO"

                                    Surface(
                                        color = when {
                                            isPresent -> ConfirmedGreenContainer.copy(alpha = 0.45f)
                                            isAbsent -> DangerRedContainer.copy(alpha = 0.45f)
                                            else -> ElevatedCharcoal
                                        },
                                        shape = RoundedCornerShape(12.dp),
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
                                                        text = client.phone,
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = TextSecondaryDark
                                                    )
                                                }
                                                TextButton(
                                                    onClick = { onOpenClientPlan(client.id) },
                                                    modifier = Modifier.testTag("agenda_open_plan_${booking.id}")
                                                ) {
                                                    Icon(
                                                        Icons.Default.FitnessCenter,
                                                        contentDescription = "Ver plano de treino",
                                                        tint = NewShapeGold,
                                                        modifier = Modifier.size(15.dp)
                                                    )
                                                    Spacer(Modifier.width(4.dp))
                                                    Text("Plano", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                                                }
                                            }

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Button(
                                                    onClick = {
                                                        viewModel.setBookingAttendance(
                                                            booking.id,
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
                                                        .testTag("agenda_present_${booking.id}")
                                                ) {
                                                    Icon(Icons.Default.Check, contentDescription = "Veio ao treino", modifier = Modifier.size(16.dp))
                                                    Spacer(Modifier.width(4.dp))
                                                    Text(
                                                        text = if (isPresent) "Veio ✓" else "Veio",
                                                        fontWeight = FontWeight.ExtraBold
                                                    )
                                                }
                                                Button(
                                                    onClick = {
                                                        viewModel.setBookingAttendance(
                                                            booking.id,
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
                                                        .testTag("agenda_absent_${booking.id}")
                                                ) {
                                                    Icon(Icons.Default.Close, contentDescription = "Faltou", modifier = Modifier.size(16.dp))
                                                    Spacer(Modifier.width(4.dp))
                                                    Text(
                                                        text = if (isAbsent) "Faltou ✕" else "Faltou",
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (pending.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Surface(
                            color = PendingAmberContainer.copy(alpha = 0.45f),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.45f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "${pending.size} pedido(s) por aceitar neste horário (${pending.mapNotNull { clientMap[it.clientId]?.name }.joinToString(", ")}). Aceita em Início → Marcações.",
                                style = MaterialTheme.typography.labelSmall,
                                color = PendingAmber,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AgendaKpiBox(
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
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = TextSecondaryDark
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = valueColor
            )
        }
    }
}
