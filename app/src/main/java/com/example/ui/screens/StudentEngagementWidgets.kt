package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.*
import com.example.ui.components.BrandCard
import com.example.ui.components.StatusPill
import com.example.ui.components.formatShortDate
import com.example.ui.components.openWhatsApp
import com.example.ui.theme.*
import java.util.Calendar
import kotlin.math.abs
import kotlin.math.ceil

data class ParsedBirthDate(
    val year: Int,
    val month: Int,
    val day: Int
)

fun parseBirthDate(raw: String?): ParsedBirthDate? {
    if (raw.isNullOrBlank()) return null
    val match = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(raw.trim()) ?: return null
    val year = match.groupValues[1].toIntOrNull() ?: return null
    val month = match.groupValues[2].toIntOrNull() ?: return null
    val day = match.groupValues[3].toIntOrNull() ?: return null
    val currentYear = Calendar.getInstance().get(Calendar.YEAR)
    if (year !in 1920..currentYear || month !in 1..12 || day !in 1..31) return null
    return ParsedBirthDate(year, month, day)
}

fun formatBirthDatePt(raw: String?): String {
    val p = parseBirthDate(raw) ?: return ""
    return String.format("%02d/%02d/%04d", p.day, p.month, p.year)
}

fun getCurrentAge(raw: String?): Int? {
    val p = parseBirthDate(raw) ?: return null
    val now = Calendar.getInstance()
    var age = now.get(Calendar.YEAR) - p.year
    val curMonth = now.get(Calendar.MONTH) + 1
    val curDay = now.get(Calendar.DAY_OF_MONTH)
    if (curMonth < p.month || (curMonth == p.month && curDay < p.day)) {
        age -= 1
    }
    return age.takeIf { it >= 0 }
}

data class UpcomingBirthdayItem(
    val client: ClientRecord,
    val turningAge: Int,
    val daysUntil: Int,
    val isToday: Boolean,
    val isTomorrow: Boolean,
    val formattedDayMonth: String
)

fun getUpcomingBirthdays(
    clients: List<ClientRecord>,
    windowDays: Int = 30
): List<UpcomingBirthdayItem> {
    val nowCal = Calendar.getInstance()
    val currentYear = nowCal.get(Calendar.YEAR)
    val todayMidnight = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    fun birthdayMillisForYear(year: Int, month: Int, day: Int): Long {
        val isLeap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
        val safeDay = if (month == 2 && day == 29 && !isLeap) 28 else day
        return Calendar.getInstance().apply {
            set(year, month - 1, safeDay, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val list = mutableListOf<UpcomingBirthdayItem>()
    for (client in clients) {
        if (!client.active) continue
        val p = parseBirthDate(client.birthDate) ?: continue
        var targetYear = currentYear
        var nextMillis = birthdayMillisForYear(targetYear, p.month, p.day)
        if (nextMillis < todayMidnight) {
            targetYear += 1
            nextMillis = birthdayMillisForYear(targetYear, p.month, p.day)
        }
        val daysUntil = ((nextMillis - todayMidnight) / 86_400_000L).toInt()
        if (daysUntil in 0..windowDays) {
            val turningAge = targetYear - p.year
            if (turningAge in 1..120) {
                list.add(
                    UpcomingBirthdayItem(
                        client = client,
                        turningAge = turningAge,
                        daysUntil = daysUntil,
                        isToday = daysUntil == 0,
                        isTomorrow = daysUntil == 1,
                        formattedDayMonth = String.format("%02d/%02d", p.day, p.month)
                    )
                )
            }
        }
    }
    return list.sortedWith(compareBy<UpcomingBirthdayItem> { it.daysUntil }.thenBy { it.client.name.lowercase() })
}

private fun getMondayMidnightMillis(timeMillis: Long): Long {
    val cal = Calendar.getInstance().apply {
        timeInMillis = timeMillis
        firstDayOfWeek = Calendar.MONDAY
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        val dow = get(Calendar.DAY_OF_WEEK)
        val diffToMonday = if (dow == Calendar.SUNDAY) -6 else Calendar.MONDAY - dow
        add(Calendar.DAY_OF_YEAR, diffToMonday)
    }
    return cal.timeInMillis
}

// --- 1. Student Portal: Active Studio Announcements Banner ---
@Composable
fun StudioAnnouncementsBanner(
    announcements: List<StudioAnnouncementRecord>,
    reads: List<AnnouncementReadRecord>,
    client: ClientRecord,
    onMarkRead: (String) -> Unit
) {
    val now = System.currentTimeMillis()
    val unreadActive = remember(announcements, reads, client.id) {
        val readIds = reads.filter { it.clientId == client.id }.map { it.announcementId }.toSet()
        announcements.filter { it.active && it.expiresAtMillis > now && it.id !in readIds }
    }
    if (unreadActive.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        unreadActive.forEach { ann ->
            val daysLeft = ceil((ann.expiresAtMillis - now).coerceAtLeast(1L) / 86_400_000.0).toInt().coerceAtLeast(1)
            BrandCard(highlightBorder = true) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    StatusPill(
                        text = "Aviso do Estúdio",
                        textColor = NewShapeGoldBright,
                        containerColor = NewShapeGoldMuted
                    )
                    Text(
                        text = "Válido +${daysLeft}d · até ${formatShortDate(ann.expiresAtMillis)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = ann.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimaryDark
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = ann.message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimaryDark.copy(alpha = 0.9f)
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onMarkRead(ann.id) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .testTag("announcement_mark_read_${ann.id}"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NewShapeGold,
                        contentColor = TextOnGold
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Lido", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// --- 2. Student Portal: 30-Day Birth Date Reminder Banner ---
@Composable
fun BirthDateReminderBanner(
    client: ClientRecord,
    reminderUntilMillis: Long,
    onSaveBirthDate: (String) -> Unit
) {
    val now = System.currentTimeMillis()
    val hasBirthDate = parseBirthDate(client.birthDate) != null
    val windowActive = reminderUntilMillis <= 0L || now <= reminderUntilMillis
    if (hasBirthDate || !windowActive) return

    val daysRemaining = if (reminderUntilMillis > 0L) {
        ceil((reminderUntilMillis - now).coerceAtLeast(1L) / 86_400_000.0).toInt().coerceAtLeast(1)
    } else 30

    var dayText by remember { mutableStateOf("") }
    var monthText by remember { mutableStateOf("") }
    var yearText by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf<String?>(null) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = InfoBlueContainer.copy(alpha = 0.55f),
        border = BorderStroke(1.dp, InfoBlue.copy(alpha = 0.55f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusPill(
                    text = "Completa o teu perfil",
                    textColor = InfoBlue,
                    containerColor = InfoBlueContainer
                )
                Text(
                    text = "${daysRemaining}d restantes",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondaryDark
                )
            }
            Text(
                text = "Adiciona a tua data de nascimento 🎂",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimaryDark
            )
            Text(
                text = "Assim a equipa New Shape assinala o teu aniversário e personaliza o teu acompanhamento.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryDark
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = dayText,
                    onValueChange = {
                        dayText = it.filter(Char::isDigit).take(2)
                        errorText = null
                    },
                    label = { Text("Dia") },
                    placeholder = { Text("DD") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f).testTag("birthdate_day_input")
                )
                OutlinedTextField(
                    value = monthText,
                    onValueChange = {
                        monthText = it.filter(Char::isDigit).take(2)
                        errorText = null
                    },
                    label = { Text("Mês") },
                    placeholder = { Text("MM") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f).testTag("birthdate_month_input")
                )
                OutlinedTextField(
                    value = yearText,
                    onValueChange = {
                        yearText = it.filter(Char::isDigit).take(4)
                        errorText = null
                    },
                    label = { Text("Ano") },
                    placeholder = { Text("AAAA") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1.4f).testTag("birthdate_year_input")
                )
            }

            if (errorText != null) {
                Text(
                    text = errorText!!,
                    style = MaterialTheme.typography.labelSmall,
                    color = DangerRed
                )
            }

            Button(
                onClick = {
                    val d = dayText.toIntOrNull()
                    val m = monthText.toIntOrNull()
                    val y = yearText.toIntOrNull()
                    val formatted = if (d != null && m != null && y != null) {
                        String.format("%04d-%02d-%02d", y, m, d)
                    } else ""
                    if (parseBirthDate(formatted) == null) {
                        errorText = "Insere uma data válida (ex.: 14 / 05 / 1995)."
                    } else {
                        onSaveBirthDate(formatted)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .testTag("save_birthdate_banner_button"),
                colors = ButtonDefaults.buttonColors(
                    containerColor = NewShapeGold,
                    contentColor = TextOnGold
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Guardar data de nascimento", fontWeight = FontWeight.Bold)
            }
        }
    }
}

// --- 3. Student Portal: Weekly Training Goal & Streak Card ---
@Composable
fun WeeklyGoalStreakCard(
    client: ClientRecord,
    bookings: List<BookingRecord>,
    sessions: List<TrainingSessionRecord>
) {
    val goal = remember(client.weeklyGoalSessions, client.weeklySessionLimit) {
        when {
            client.weeklyGoalSessions > 0 -> client.weeklyGoalSessions
            client.weeklySessionLimit > 0 -> client.weeklySessionLimit
            else -> 2
        }
    }

    data class StreakWeekSlot(val label: String, val count: Int, val met: Boolean, val isCurrent: Boolean)
    data class WeeklyStreakResult(
        val currentCount: Int,
        val streakWeeks: Int,
        val bestStreak: Int,
        val recentSlots: List<StreakWeekSlot>
    )

    val streakData = remember(client.id, bookings, sessions, goal) {
        val sessionMap = sessions.associateBy { it.id }
        val countByWeek = mutableMapOf<Long, Int>()
        val currentWeekStart = getMondayMidnightMillis(System.currentTimeMillis())

        bookings.forEach { b ->
            if (b.clientId != client.id) return@forEach
            if (b.status != BookingStatus.CONFIRMED.name) return@forEach
            if (b.attendanceStatus == "ABSENT") return@forEach
            val s = sessionMap[b.sessionId] ?: return@forEach
            if (s.startMillis <= 0L) return@forEach
            val wk = getMondayMidnightMillis(s.startMillis)
            countByWeek[wk] = (countByWeek[wk] ?: 0) + 1
        }

        val current = countByWeek[currentWeekStart] ?: 0
        val weekMs = 7L * 86_400_000L
        var streak = 0
        var cursor = if (current >= goal) currentWeekStart else currentWeekStart - weekMs
        for (i in 0 until 52) {
            if ((countByWeek[cursor] ?: 0) >= goal) {
                streak++
                cursor -= weekMs
            } else {
                break
            }
        }

        val metWeeks = countByWeek.filterValues { it >= goal }.keys.sorted()
        var best = 0
        var run = 0
        var prev = -1L
        metWeeks.forEach { wk ->
            if (prev >= 0L && abs((wk - prev) - weekMs) < 4L * 3_600_000L) {
                run++
            } else {
                run = 1
            }
            if (run > best) best = run
            prev = wk
        }

        val slots = (5 downTo 0).map { offset ->
            val wk = currentWeekStart - offset * weekMs
            val c = countByWeek[wk] ?: 0
            val cal = Calendar.getInstance().apply { timeInMillis = wk }
            val lbl = if (offset == 0) "Atual" else "${cal.get(Calendar.DAY_OF_MONTH)}/${cal.get(Calendar.MONTH) + 1}"
            StreakWeekSlot(label = lbl, count = c, met = c >= goal, isCurrent = offset == 0)
        }
        WeeklyStreakResult(current, streak, maxOf(best, streak), slots)
    }

    val currentCount = streakData.currentCount
    val streakWeeks = streakData.streakWeeks
    val bestStreak = streakData.bestStreak
    val progress = (currentCount.toFloat() / goal.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
    val goalMet = currentCount >= goal

    BrandCard(highlightBorder = goalMet) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = NewShapeGoldMuted,
                    modifier = Modifier.size(38.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Flag,
                            contentDescription = "Meta semanal",
                            tint = NewShapeGold,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
                Column {
                    Text(
                        "Meta Semanal & Sequência",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimaryDark
                    )
                    Text(
                        "$currentCount de $goal treino${if (goal == 1) "" else "s"} esta semana",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
            }
            StatusPill(
                text = if (goalMet) "Meta cumprida!" else "Falta ${goal - currentCount}",
                textColor = if (goalMet) ConfirmedGreen else NewShapeGoldBright,
                containerColor = if (goalMet) ConfirmedGreenContainer else NewShapeGoldMuted
            )
        }

        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = if (goalMet) ConfirmedGreen else NewShapeGold,
            trackColor = ElevatedCharcoal
        )

        Spacer(Modifier.height(10.dp))
        // 6-Week Visual Streak Strip
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            streakData.recentSlots.forEach { slot ->
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = when {
                        slot.met -> ConfirmedGreenContainer.copy(alpha = 0.7f)
                        slot.isCurrent -> NewShapeGoldMuted.copy(alpha = 0.45f)
                        else -> ElevatedCharcoal
                    },
                    border = BorderStroke(
                        1.dp,
                        when {
                            slot.met -> ConfirmedGreen.copy(alpha = 0.65f)
                            slot.isCurrent -> NewShapeGold.copy(alpha = 0.65f)
                            else -> HairlineBorder
                        }
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 6.dp, horizontal = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = if (slot.met) "✓" else "${slot.count}/$goal",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = when {
                                slot.met -> ConfirmedGreen
                                slot.isCurrent -> NewShapeGoldBright
                                else -> TextSecondaryDark
                            }
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = slot.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (slot.isCurrent) TextPrimaryDark else TextSecondaryDark,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (streakWeeks > 0) {
                    "🔥 $streakWeeks semana${if (streakWeeks == 1) "" else "s"} seguida${if (streakWeeks == 1) "" else "s"}!"
                } else if (goalMet) {
                    "Objetivo concluído! Mantém o ritmo na próxima semana."
                } else {
                    "Confirma os teus treinos para ativar a sequência."
                },
                style = MaterialTheme.typography.labelSmall,
                color = if (streakWeeks > 0) PendingAmber else TextSecondaryDark,
                fontWeight = if (streakWeeks > 0) FontWeight.Bold else FontWeight.Normal
            )
            if (bestStreak > 1) {
                Text(
                    "Recorde: ${bestStreak}s",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = NewShapeGoldBright
                )
            }
        }
    }
}

private data class StudentBadgeItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val unlocked: Boolean,
    val progressText: String
)

// --- 3B. Student Portal: Streaks & Achievements (Conquistas) Card ---
@Composable
fun StudentAchievementsCard(
    client: ClientRecord,
    bookings: List<BookingRecord>,
    sessions: List<TrainingSessionRecord>,
    workoutLoadLogs: List<WorkoutLoadLogRecord>,
    assessments: List<PhysicalAssessmentRecord>,
    feedbackItems: List<WorkoutFeedbackRecord>
) {
    val goal = remember(client.weeklyGoalSessions, client.weeklySessionLimit) {
        when {
            client.weeklyGoalSessions > 0 -> client.weeklyGoalSessions
            client.weeklySessionLimit > 0 -> client.weeklySessionLimit
            else -> 2
        }
    }

    val badges = remember(client.id, bookings, sessions, workoutLoadLogs, assessments, feedbackItems, goal) {
        val now = System.currentTimeMillis()
        val sessionMap = sessions.associateBy { it.id }
        var totalWorkouts = 0
        val countByWeek = mutableMapOf<Long, Int>()

        bookings.forEach { b ->
            if (b.clientId != client.id) return@forEach
            if (b.status != BookingStatus.CONFIRMED.name) return@forEach
            if (b.attendanceStatus == "ABSENT") return@forEach
            val s = sessionMap[b.sessionId] ?: return@forEach
            if (s.startMillis <= 0L) return@forEach
            if (s.startMillis <= now) totalWorkouts++
            val wk = getMondayMidnightMillis(s.startMillis)
            countByWeek[wk] = (countByWeek[wk] ?: 0) + 1
        }

        val weekMs = 7L * 86_400_000L
        val metWeeks = countByWeek.filterValues { it >= goal }.keys.sorted()
        var bestStreak = 0
        var run = 0
        var prev = -1L
        metWeeks.forEach { wk ->
            if (prev >= 0L && abs((wk - prev) - weekMs) < 4L * 3_600_000L) run++ else run = 1
            if (run > bestStreak) bestStreak = run
            prev = wk
        }

        val clientLogs = workoutLoadLogs.filter { it.clientId == client.id && it.numericKg > 0.0 }
        val prProgressionCount = clientLogs
            .groupBy { it.exerciseName.trim().lowercase() }
            .values
            .count { list ->
                val sorted = list.sortedBy { it.loggedAtMillis }
                sorted.size >= 2 && sorted.maxOf { it.numericKg } > sorted.first().numericKg + 0.05
            }
        val loggedExercisesCount = clientLogs.map { it.exerciseName.trim().lowercase() }.distinct().size
        val prMetric = maxOf(prProgressionCount, if (loggedExercisesCount >= 3) 1 else 0)
        val assessCount = assessments.count { it.clientId == client.id }
        val fbCount = feedbackItems.count { it.clientId == client.id }
        val trackingUnlocked = assessCount >= 2 || fbCount >= 3

        listOf(
            StudentBadgeItem(
                id = "first_workout",
                title = "Primeiro Passo",
                subtitle = "1º treino concluído",
                icon = Icons.Default.DirectionsRun,
                unlocked = totalWorkouts >= 1,
                progressText = "${totalWorkouts.coerceAtMost(1)}/1"
            ),
            StudentBadgeItem(
                id = "ten_workouts",
                title = "Em Ritmo",
                subtitle = "10 treinos feitos",
                icon = Icons.Default.LocalFireDepartment,
                unlocked = totalWorkouts >= 10,
                progressText = "${totalWorkouts.coerceAtMost(10)}/10"
            ),
            StudentBadgeItem(
                id = "twentyfive_workouts",
                title = "Dedicação Total",
                subtitle = "25 treinos feitos",
                icon = Icons.Default.FitnessCenter,
                unlocked = totalWorkouts >= 25,
                progressText = "${totalWorkouts.coerceAtMost(25)}/25"
            ),
            StudentBadgeItem(
                id = "fifty_workouts",
                title = "Lenda New Shape",
                subtitle = "50 treinos feitos",
                icon = Icons.Default.EmojiEvents,
                unlocked = totalWorkouts >= 50,
                progressText = "${totalWorkouts.coerceAtMost(50)}/50"
            ),
            StudentBadgeItem(
                id = "streak_2w",
                title = "Ritmo Certo",
                subtitle = "2 semanas seguidas",
                icon = Icons.Default.Bolt,
                unlocked = bestStreak >= 2,
                progressText = "${bestStreak.coerceAtMost(2)}/2 sem."
            ),
            StudentBadgeItem(
                id = "streak_4w",
                title = "Mês Perfeito",
                subtitle = "4 semanas seguidas",
                icon = Icons.Default.WorkspacePremium,
                unlocked = bestStreak >= 4,
                progressText = "${bestStreak.coerceAtMost(4)}/4 sem."
            ),
            StudentBadgeItem(
                id = "pr_breaker",
                title = "Quebra-Recordes",
                subtitle = "Subiu carga / PR",
                icon = Icons.Default.TrendingUp,
                unlocked = prMetric >= 1,
                progressText = if (prProgressionCount > 0) "$prProgressionCount PR(s)" else "${loggedExercisesCount.coerceAtMost(3)}/3 ex."
            ),
            StudentBadgeItem(
                id = "tracker",
                title = "Foco & Evolução",
                subtitle = "2 avaliações ou 3 feedbacks",
                icon = Icons.Default.Star,
                unlocked = trackingUnlocked,
                progressText = if (trackingUnlocked) "Ativo ✓" else "${assessCount}/2 aval."
            )
        )
    }

    val unlockedCount = badges.count { it.unlocked }
    val pct = unlockedCount.toFloat() / badges.size.coerceAtLeast(1).toFloat()

    BrandCard(highlightBorder = unlockedCount >= 4) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.EmojiEvents, contentDescription = "Conquistas", tint = NewShapeGoldBright, modifier = Modifier.size(20.dp))
                Column {
                    Text("Conquistas & Medalhas", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = TextPrimaryDark)
                    Text("Desbloqueia medalhas com a tua consistência e recordes", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                }
            }
            StatusPill(
                text = "$unlockedCount/${badges.size}",
                textColor = TextOnGold,
                containerColor = NewShapeGold
            )
        }

        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { pct },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = NewShapeGold,
            trackColor = ElevatedCharcoal
        )

        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            badges.chunked(2).forEach { pair ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    pair.forEach { badge ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (badge.unlocked) NewShapeGoldMuted.copy(alpha = 0.5f) else ElevatedCharcoal,
                            border = BorderStroke(
                                1.dp,
                                if (badge.unlocked) NewShapeGold.copy(alpha = 0.7f) else HairlineBorder
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("student_badge_${badge.id}")
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(if (badge.unlocked) NewShapeGold else CharcoalSurface),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = badge.icon,
                                        contentDescription = badge.title,
                                        tint = if (badge.unlocked) TextOnGold else TextSecondaryDark.copy(alpha = 0.6f),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = badge.title,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = if (badge.unlocked) NewShapeGoldBright else TextSecondaryDark,
                                        maxLines = 1
                                    )
                                    Text(
                                        text = badge.subtitle,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark,
                                        maxLines = 1
                                    )
                                    Text(
                                        text = if (badge.unlocked) "Desbloqueada ✓" else badge.progressText,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (badge.unlocked) ConfirmedGreen else TextSecondaryDark.copy(alpha = 0.8f)
                                    )
                                }
                            }
                        }
                    }
                    if (pair.size == 1) {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

// --- 4. Student Portal: Post-Workout Quick Feedback Dialog ---
@Composable
fun PostWorkoutFeedbackDialog(
    planTitle: String,
    onDismiss: () -> Unit,
    onSubmit: (rpe: Int, feeling: String, note: String) -> Unit
) {
    var feeling by remember { mutableStateOf("IDEAL") }
    var rpe by remember { mutableIntStateOf(7) }
    var note by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Column {
                Text("Como correu o treino?", fontWeight = FontWeight.ExtraBold, color = TextPrimaryDark)
                if (planTitle.isNotBlank()) {
                    Text(planTitle, style = MaterialTheme.typography.labelMedium, color = NewShapeGold)
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Sensação geral", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        Triple("LEVE", "Leve", 5),
                        Triple("IDEAL", "Ideal", 7),
                        Triple("PESADO", "Pesado", 9)
                    ).forEach { (key, label, defaultRpe) ->
                        val selected = feeling == key
                        FilterChip(
                            selected = selected,
                            onClick = {
                                feeling = key
                                rpe = defaultRpe
                            },
                            label = { Text(label, fontWeight = FontWeight.Bold) },
                            modifier = Modifier.weight(1f).testTag("feedback_feeling_$key")
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Esforço (RPE 1–10)", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                    StatusPill(
                        text = "RPE $rpe/10",
                        textColor = if (rpe >= 9) DangerRed else if (rpe >= 6) NewShapeGoldBright else ConfirmedGreen,
                        containerColor = if (rpe >= 9) DangerRedContainer else if (rpe >= 6) NewShapeGoldMuted else ConfirmedGreenContainer
                    )
                }

                Slider(
                    value = rpe.toFloat(),
                    onValueChange = { rpe = it.toInt().coerceIn(1, 10) },
                    valueRange = 1f..10f,
                    steps = 8,
                    colors = SliderDefaults.colors(
                        thumbColor = NewShapeGold,
                        activeTrackColor = NewShapeGold
                    ),
                    modifier = Modifier.testTag("feedback_rpe_slider")
                )

                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it.take(400) },
                    label = { Text("Nota rápida para o PT (opcional)") },
                    placeholder = { Text("Ex.: Senti ótima evolução ou ligeiro cansaço...") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth().testTag("feedback_note_input")
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmit(rpe, feeling, note.trim()) },
                colors = ButtonDefaults.buttonColors(containerColor = NewShapeGold, contentColor = TextOnGold),
                modifier = Modifier.testTag("feedback_submit_button")
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Enviar", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Agora não", color = TextSecondaryDark)
            }
        }
    )
}

// --- 5. PT/Admin Home: Upcoming Birthdays & Exact Age Card ---
@Composable
fun UpcomingBirthdaysCard(
    clients: List<ClientRecord>,
    whatsappWebMode: Boolean,
    reminderUntilMillis: Long,
    onRenewReminder: () -> Unit
) {
    val context = LocalContext.current
    val upcoming = remember(clients) { getUpcomingBirthdays(clients, windowDays = 30) }
    val missingCount = remember(clients) {
        clients.count { it.active && parseBirthDate(it.birthDate) == null }
    }
    if (upcoming.isEmpty() && missingCount == 0) return

    val now = System.currentTimeMillis()
    val reminderActive = reminderUntilMillis > now
    val reminderDaysLeft = if (reminderActive) {
        ceil((reminderUntilMillis - now) / 86_400_000.0).toInt().coerceAtLeast(1)
    } else 0

    BrandCard(highlightBorder = upcoming.any { it.isToday }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = NewShapeGoldMuted,
                    modifier = Modifier.size(38.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Cake, contentDescription = "Aniversários", tint = NewShapeGold, modifier = Modifier.size(20.dp))
                    }
                }
                Column {
                    Text("Aniversários dos Alunos", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = TextPrimaryDark)
                    Text(
                        if (upcoming.isNotEmpty()) "${upcoming.size} nos próximos 30 dias" else "Sem aniversários nos próximos 30 dias",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
            }
            if (upcoming.any { it.isToday }) {
                StatusPill(text = "🎂 Hoje!", textColor = NewShapeGoldBright, containerColor = NewShapeGoldMuted)
            }
        }

        if (upcoming.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                upcoming.forEach { item ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (item.isToday) NewShapeGoldMuted.copy(alpha = 0.45f) else ElevatedCharcoal,
                        border = BorderStroke(1.dp, if (item.isToday) NewShapeGold.copy(alpha = 0.7f) else HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        item.client.name,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimaryDark
                                    )
                                    StatusPill(
                                        text = when {
                                            item.isToday -> "Hoje! 🎉"
                                            item.isTomorrow -> "Amanhã"
                                            else -> "${item.formattedDayMonth} (${item.daysUntil}d)"
                                        },
                                        textColor = if (item.isToday) NewShapeGoldBright else if (item.daysUntil <= 7) PendingAmber else InfoBlue,
                                        containerColor = if (item.isToday) NewShapeGoldMuted else if (item.daysUntil <= 7) PendingAmberContainer else InfoBlueContainer
                                    )
                                }
                                Text(
                                    "Faz ${item.turningAge} anos · ${formatBirthDatePt(item.client.birthDate)}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            if (item.client.phone.isNotBlank()) {
                                FilledTonalButton(
                                    onClick = {
                                        val firstName = item.client.name.trim().split(" ").firstOrNull().orEmpty()
                                        val msg = if (item.isToday) {
                                            "Parabéns $firstName! 🎉🎂 Toda a equipa New Shape deseja-te um excelente ${item.turningAge}º aniversário, cheio de saúde, energia e grandes treinos! 💪"
                                        } else {
                                            "Olá $firstName! 🎂 Vimos que o teu ${item.turningAge}º aniversário está quase a chegar (${item.formattedDayMonth}). Muitos parabéns antecipados da equipa New Shape! 💪"
                                        }
                                        openWhatsApp(context, item.client.phone, msg, whatsappWebMode)
                                    },
                                    colors = ButtonDefaults.filledTonalButtonColors(
                                        containerColor = ConfirmedGreenContainer,
                                        contentColor = ConfirmedGreen
                                    ),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                    modifier = Modifier.heightIn(min = 40.dp).testTag("birthday_whatsapp_${item.client.id}")
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Parabéns", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }

        if (missingCount > 0) {
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "$missingCount aluno${if (missingCount == 1) "" else "s"} sem data · " +
                        if (reminderActive) "lembrete ativo (${reminderDaysLeft}d)" else "lembrete 30d expirado",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondaryDark,
                    modifier = Modifier.weight(1f)
                )
                if (!reminderActive) {
                    TextButton(
                        onClick = onRenewReminder,
                        modifier = Modifier.testTag("renew_birthdate_reminder_button")
                    ) {
                        Text("Renovar +30d", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// --- 6. PT Training Tab: Recent Post-Workout Feedback List ---
@Composable
fun PtRecentFeedbackCard(
    clientName: String,
    feedbackItems: List<WorkoutFeedbackRecord>,
    onDelete: ((String) -> Unit)? = null
) {
    if (feedbackItems.isEmpty()) return

    BrandCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Feedback Pós-Treino — $clientName",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimaryDark
            )
            StatusPill(
                text = "${feedbackItems.size}",
                textColor = TextSecondaryDark,
                containerColor = ElevatedCharcoal
            )
        }
        Spacer(Modifier.height(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            feedbackItems.take(6).forEach { fb ->
                val (feelLabel, feelBg, feelFg) = when (fb.feeling) {
                    "LEVE" -> Triple("Leve", ConfirmedGreenContainer, ConfirmedGreen)
                    "PESADO" -> Triple("Pesado", DangerRedContainer, DangerRed)
                    else -> Triple("Ideal", NewShapeGoldMuted, NewShapeGoldBright)
                }
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = ElevatedCharcoal,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                StatusPill(text = feelLabel, textColor = feelFg, containerColor = feelBg)
                                StatusPill(
                                    text = "RPE ${fb.rpe}/10",
                                    textColor = if (fb.rpe >= 9) DangerRed else NewShapeGoldBright,
                                    containerColor = if (fb.rpe >= 9) DangerRedContainer else NewShapeGoldMuted
                                )
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    formatShortDate(fb.timestampMillis),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                                if (onDelete != null) {
                                    IconButton(
                                        onClick = { onDelete(fb.id) },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.DeleteOutline,
                                            contentDescription = "Apagar feedback",
                                            tint = TextSecondaryDark,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                        Text(
                            fb.planTitle,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )
                        if (fb.note.isNotBlank()) {
                            Text(
                                "“${fb.note}”",
                                style = MaterialTheme.typography.bodySmall,
                                fontStyle = FontStyle.Italic,
                                color = TextSecondaryDark
                            )
                        }
                    }
                }
            }
        }
    }
}
