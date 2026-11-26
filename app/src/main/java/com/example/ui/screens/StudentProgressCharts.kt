package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import java.util.Calendar
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.TrainingSessionRecord
import com.example.data.model.WorkoutLoadLogRecord
import com.example.data.model.WorkoutPlanItemRecord
import com.example.data.model.WorkoutPlanRecord
import com.example.ui.components.BrandCard
import com.example.ui.components.StatusPill
import com.example.ui.components.formatShortDate
import com.example.ui.theme.*
import kotlin.math.abs

private data class StrengthPoint(
    val dateMillis: Long,
    val loadKg: Double,
    val label: String
)

private data class StrengthSeries(
    val exerciseName: String,
    val points: List<StrengthPoint>,
    val prKg: Double,
    val latestKg: Double,
    val deltaKg: Double
)

private fun parseLoadKgValue(raw: String?): Double? {
    if (raw.isNullOrBlank()) return null
    val match = Regex("(\\d+(?:[.,]\\d+)?)").find(raw) ?: return null
    val num = match.groupValues[1].replace(',', '.').toDoubleOrNull() ?: return null
    return if (num > 0.0) num else null
}

private fun formatKgLabel(v: Double): String {
    return if (abs(v - v.toInt().toDouble()) < 0.05) "${v.toInt()} kg"
    else "${String.format("%.1f", v)} kg"
}

@Composable
fun StudentConsistencyCard(
    clientId: String,
    bookings: List<BookingRecord>,
    sessions: List<TrainingSessionRecord>
) {
    val stats = remember(clientId, bookings, sessions) {
        val now = System.currentTimeMillis()
        val thirtyDaysAgo = now - 30L * 86_400_000L
        val sevenDaysAgo = now - 7L * 86_400_000L
        val sessionMap = sessions.associateBy { it.id }

        var weekCount = 0
        var monthCount = 0
        var totalAll = 0
        var presentCount = 0
        var absentCount = 0

        bookings.forEach { b ->
            if (b.clientId != clientId || b.status != BookingStatus.CONFIRMED.name) return@forEach
            val s = sessionMap[b.sessionId] ?: return@forEach
            if (s.startMillis > now) return@forEach
            if (b.attendanceStatus != "ABSENT") totalAll++
            if (s.startMillis >= thirtyDaysAgo) {
                if (b.attendanceStatus == "PRESENT") presentCount++
                if (b.attendanceStatus == "ABSENT") absentCount++
                if (b.attendanceStatus != "ABSENT") monthCount++
            }
            if (s.startMillis >= sevenDaysAgo && b.attendanceStatus != "ABSENT") {
                weekCount++
            }
        }
        val marked = presentCount + absentCount
        val ratePct = when {
            marked > 0 -> ((presentCount * 100.0) / marked).toInt()
            monthCount > 0 -> 100
            else -> null
        }
        QuadStats(weekCount, monthCount, totalAll, ratePct)
    }

    val monthNamesShort = remember { arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez") }
    val monthlyBars = remember(clientId, bookings, sessions) {
        val now = System.currentTimeMillis()
        val sessionMap = sessions.associateBy { it.id }
        val countsByYM = mutableMapOf<String, Int>()
        val cal = Calendar.getInstance()
        bookings.forEach { b ->
            if (b.clientId != clientId || b.status != BookingStatus.CONFIRMED.name) return@forEach
            if (b.attendanceStatus == "ABSENT") return@forEach
            val s = sessionMap[b.sessionId] ?: return@forEach
            if (s.startMillis <= 0L || s.startMillis > now) return@forEach
            cal.timeInMillis = s.startMillis
            val key = "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.MONTH)}"
            countsByYM[key] = (countsByYM[key] ?: 0) + 1
        }
        (5 downTo 0).map { offset ->
            val mCal = Calendar.getInstance().apply {
                set(Calendar.DAY_OF_MONTH, 1)
                add(Calendar.MONTH, -offset)
            }
            val key = "${mCal.get(Calendar.YEAR)}-${mCal.get(Calendar.MONTH)}"
            Triple(monthNamesShort[mCal.get(Calendar.MONTH)], countsByYM[key] ?: 0, offset == 0)
        }
    }

    BrandCard {
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
                    Icons.Default.LocalFireDepartment,
                    contentDescription = "Consistência de treino",
                    tint = NewShapeGoldBright,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    "Consistência de Treino",
                    style = MaterialTheme.typography.titleSmall,
                    color = TextPrimaryDark,
                    fontWeight = FontWeight.Bold
                )
            }
            stats.ratePct?.let { pct ->
                StatusPill(
                    text = "$pct% (30d)",
                    textColor = if (pct >= 80) ConfirmedGreen else if (pct >= 55) PendingAmber else DangerRed,
                    containerColor = if (pct >= 80) ConfirmedGreenContainer else if (pct >= 55) PendingAmberContainer else DangerRedContainer
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            ConsistencyMiniTile("Últimos 7d", stats.weekCount.toString(), NewShapeGoldBright, Modifier.weight(1f))
            ConsistencyMiniTile("Últimos 30d", stats.monthCount.toString(), ConfirmedGreen, Modifier.weight(1f))
            ConsistencyMiniTile("Total", stats.totalAll.toString(), TextPrimaryDark, Modifier.weight(1f))
        }

        Spacer(Modifier.height(12.dp))
        Text(
            text = "Frequência mensal (últimos 6 meses)",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondaryDark
        )
        Spacer(Modifier.height(8.dp))
        val maxBar = (monthlyBars.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(82.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            monthlyBars.forEach { (monthLbl, count, isCurrent) ->
                val barFraction = if (count > 0) (count.toFloat() / maxBar.toFloat()).coerceIn(0.18f, 1f) else 0.08f
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom
                ) {
                    Text(
                        text = count.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isCurrent) NewShapeGoldBright else if (count > 0) TextPrimaryDark else TextSecondaryDark
                    )
                    Spacer(Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height((44.dp * barFraction).coerceAtLeast(4.dp))
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(
                                when {
                                    count == 0 -> ElevatedCharcoal
                                    isCurrent -> NewShapeGold
                                    else -> ConfirmedGreen.copy(alpha = 0.75f)
                                }
                            )
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = monthLbl,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isCurrent) NewShapeGoldBright else TextSecondaryDark
                    )
                }
            }
        }
    }
}

private data class QuadStats(
    val weekCount: Int,
    val monthCount: Int,
    val totalAll: Int,
    val ratePct: Int?
)

@Composable
private fun ConsistencyMiniTile(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = ElevatedCharcoal,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            Spacer(Modifier.height(2.dp))
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = accent)
        }
    }
}

@Composable
fun StrengthEvolutionChartCard(
    clientId: String,
    workoutLoadLogs: List<WorkoutLoadLogRecord>,
    workoutPlans: List<WorkoutPlanRecord>,
    workoutPlanItems: List<WorkoutPlanItemRecord>
) {
    val seriesList = remember(clientId, workoutLoadLogs, workoutPlans, workoutPlanItems) {
        val grouped = mutableMapOf<String, Pair<String, MutableList<StrengthPoint>>>()

        workoutLoadLogs
            .filter { it.clientId == clientId }
            .forEach { log ->
                val kg = parseLoadKgValue(log.loadKg) ?: return@forEach
                val name = log.exerciseName.trim()
                if (name.isEmpty()) return@forEach
                val key = name.lowercase()
                val pair = grouped.getOrPut(key) { name to mutableListOf() }
                val ts = if (log.loggedAtMillis > 0L) log.loggedAtMillis else System.currentTimeMillis()
                pair.second.add(StrengthPoint(ts, kg, formatShortDate(ts)))
            }

        val planIds = workoutPlans.filter { it.clientId == clientId }.map { it.id }.toSet()
        workoutPlanItems
            .filter { it.planId in planIds }
            .forEach { item ->
                val name = item.exerciseName.trim()
                if (name.isEmpty()) return@forEach
                val key = name.lowercase()
                val existing = grouped[key]
                if (existing == null || existing.second.isEmpty()) {
                    val prevKg = parseLoadKgValue(item.lastLoadKg)
                    val currKg = parseLoadKgValue(item.loadKg)
                    val pts = mutableListOf<StrengthPoint>()
                    val now = System.currentTimeMillis()
                    if (prevKg != null && currKg != null && abs(prevKg - currKg) > 0.01) {
                        pts.add(StrengthPoint(now - 7L * 86_400_000L, prevKg, "Anterior"))
                        pts.add(StrengthPoint(now, currKg, "Atual"))
                    } else if (currKg != null) {
                        pts.add(StrengthPoint(now, currKg, "Atual"))
                    }
                    if (pts.isNotEmpty()) {
                        grouped[key] = name to pts
                    }
                }
            }

        grouped.values
            .mapNotNull { (displayName, pts) ->
                val sorted = pts.sortedBy { it.dateMillis }
                if (sorted.isEmpty()) return@mapNotNull null
                val pr = sorted.maxOf { it.loadKg }
                val first = sorted.first().loadKg
                val latest = sorted.last().loadKg
                StrengthSeries(displayName, sorted, pr, latest, latest - first)
            }
            .sortedWith(
                compareByDescending<StrengthSeries> { it.points.size }
                    .thenByDescending { it.prKg }
            )
    }

    var selectedExercise by remember(seriesList) { mutableStateOf(seriesList.firstOrNull()?.exerciseName.orEmpty()) }
    var showAllPrs by remember { mutableStateOf(false) }
    val activeSeries = seriesList.find { it.exerciseName == selectedExercise } ?: seriesList.firstOrNull()
    val nowMs = System.currentTimeMillis()
    val recentPrThresholdMs = nowMs - 14L * 86_400_000L

    if (activeSeries == null) {
        BrandCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.FitnessCenter, contentDescription = "Cargas", tint = NewShapeGold, modifier = Modifier.size(18.dp))
                Text("Recordes Pessoais (PR) & Evolução", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Regista cargas nos exercícios do teu plano de treino para veres o mural de recordes (PR) e o gráfico de progressão.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryDark
            )
        }
        return
    }

    val prSortedList = remember(seriesList) {
        seriesList.sortedWith(compareByDescending<StrengthSeries> { it.prKg }.thenByDescending { it.deltaKg })
    }
    val visiblePrs = if (showAllPrs) prSortedList else prSortedList.take(5)
    val pts = activeSeries.points
    val values = pts.map { it.loadKg }
    val minVal = values.minOrNull() ?: 0.0
    val maxVal = values.maxOrNull() ?: 1.0

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Mural de Recordes Pessoais (Hall of PRs)
        BrandCard(highlightBorder = true) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.EmojiEvents, contentDescription = "Mural de Recordes", tint = NewShapeGoldBright, modifier = Modifier.size(20.dp))
                    Column {
                        Text("Mural de Recordes Pessoais (PR)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = TextPrimaryDark)
                        Text("Toca num exercício para ver a curva de evolução", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    }
                }
                StatusPill(
                    text = "${prSortedList.size} PR(s)",
                    textColor = TextOnGold,
                    containerColor = NewShapeGold
                )
            }

            Spacer(Modifier.height(10.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                visiblePrs.forEachIndexed { idx, series ->
                    val prPoint = series.points.maxByOrNull { it.loadKg }
                    val isRecent = (prPoint?.dateMillis ?: 0L) >= recentPrThresholdMs && series.points.size >= 2
                    val isSelected = series.exerciseName == activeSeries.exerciseName
                    Surface(
                        color = if (isSelected) NewShapeGoldMuted.copy(alpha = 0.55f) else ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(
                            1.dp,
                            if (isSelected) NewShapeGold else HairlineBorder
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { selectedExercise = series.exerciseName }
                            .testTag("pr_hall_row_$idx")
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "#${idx + 1}",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = NewShapeGoldBright
                                    )
                                    Text(
                                        text = series.exerciseName,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimaryDark,
                                        maxLines = 1
                                    )
                                    if (isRecent) {
                                        StatusPill("🔥 Novo", ConfirmedGreen, ConfirmedGreenContainer)
                                    }
                                }
                                Text(
                                    text = buildString {
                                        append(prPoint?.label ?: "Atual")
                                        if (series.deltaKg > 0.05) {
                                            append(" · +${formatKgLabel(series.deltaKg)} desde início")
                                        }
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (series.deltaKg > 0.05) ConfirmedGreen else TextSecondaryDark
                                )
                            }
                            StatusPill(
                                text = formatKgLabel(series.prKg),
                                textColor = if (isSelected) TextOnGold else NewShapeGoldBright,
                                containerColor = if (isSelected) NewShapeGold else CharcoalSurface
                            )
                        }
                    }
                }
            }

            if (prSortedList.size > 5) {
                Spacer(Modifier.height(6.dp))
                TextButton(
                    onClick = { showAllPrs = !showAllPrs },
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(
                        text = if (showAllPrs) "Mostrar menos" else "Ver todos (${prSortedList.size})",
                        color = NewShapeGoldBright,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        BrandCard(highlightBorder = true) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.TrendingUp, contentDescription = "Evolução de cargas", tint = NewShapeGoldBright, modifier = Modifier.size(18.dp))
                    Column {
                        Text("Evolução de Cargas (Força)", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                        Text("${seriesList.size} exercício(s) com registo", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    }
                }
                StatusPill(
                    text = "PR: ${formatKgLabel(activeSeries.prKg)}",
                    textColor = TextOnGold,
                    containerColor = NewShapeGold
                )
            }

            Spacer(Modifier.height(10.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(seriesList, key = { it.exerciseName }) { s ->
                FilterChip(
                    selected = s.exerciseName == activeSeries.exerciseName,
                    onClick = { selectedExercise = s.exerciseName },
                    label = { Text("${s.exerciseName} (${formatKgLabel(s.prKg)})", maxLines = 1) },
                    modifier = Modifier.testTag("strength_chip_${s.exerciseName.lowercase().replace(" ", "_")}"),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = NewShapeGold,
                        selectedLabelColor = TextOnGold
                    )
                )
            }
        }

        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            ConsistencyMiniTile("Recorde (PR)", formatKgLabel(activeSeries.prKg), NewShapeGoldBright, Modifier.weight(1f))
            ConsistencyMiniTile("Última", formatKgLabel(activeSeries.latestKg), TextPrimaryDark, Modifier.weight(1f))
            val deltaSign = if (activeSeries.deltaKg > 0) "+" else ""
            val deltaColor = when {
                activeSeries.deltaKg > 0.05 -> ConfirmedGreen
                activeSeries.deltaKg < -0.05 -> DangerRed
                else -> TextSecondaryDark
            }
            ConsistencyMiniTile(
                "Evolução",
                "$deltaSign${formatKgLabel(activeSeries.deltaKg)}",
                deltaColor,
                Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(12.dp))

        if (pts.size < 2) {
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "${formatKgLabel(pts.first().loadKg)} (${pts.first().label})",
                        style = MaterialTheme.typography.titleSmall,
                        color = NewShapeGoldBright,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Regista mais uma sessão deste exercício para desenhar a linha de evolução.",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(155.dp)
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val span = (maxVal - minVal).coerceAtLeast(2.0)
                    val padMin = (minVal - span * 0.15).coerceAtLeast(0.0)
                    val padMax = maxVal + span * 0.15
                    val padRange = (padMax - padMin).coerceAtLeast(1.0)

                    val padX = 16.dp.toPx()
                    val padY = 14.dp.toPx()
                    val usableW = (size.width - padX * 2).coerceAtLeast(1f)
                    val usableH = (size.height - padY * 2).coerceAtLeast(1f)

                    // Grid lines
                    listOf(0f, 0.5f, 1f).forEach { frac ->
                        val y = padY + usableH * frac
                        drawLine(
                            color = HairlineBorder,
                            start = Offset(padX, y),
                            end = Offset(size.width - padX, y),
                            strokeWidth = 1.dp.toPx()
                        )
                    }

                    val offsets = pts.mapIndexed { idx, p ->
                        val x = padX + (idx.toFloat() / (pts.size - 1).coerceAtLeast(1)) * usableW
                        val norm = ((p.loadKg - padMin) / padRange).toFloat().coerceIn(0f, 1f)
                        val y = padY + usableH - norm * usableH
                        Offset(x, y)
                    }

                    val linePath = Path().apply {
                        offsets.forEachIndexed { idx, pt ->
                            if (idx == 0) moveTo(pt.x, pt.y) else lineTo(pt.x, pt.y)
                        }
                    }
                    val fillPath = Path().apply {
                        addPath(linePath)
                        lineTo(offsets.last().x, padY + usableH)
                        lineTo(offsets.first().x, padY + usableH)
                        close()
                    }
                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(NewShapeGold.copy(alpha = 0.35f), Color.Transparent),
                            startY = padY,
                            endY = padY + usableH
                        )
                    )
                    drawPath(
                        path = linePath,
                        color = NewShapeGoldBright,
                        style = Stroke(
                            width = 3.dp.toPx(),
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                    offsets.forEach { pt ->
                        drawCircle(color = NewShapeGoldBright, radius = 5.dp.toPx(), center = pt)
                        drawCircle(color = ObsidianBg, radius = 2.5.dp.toPx(), center = pt)
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(pts.first().label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                Text(
                    "Mín ${formatKgLabel(minVal)} · Máx ${formatKgLabel(maxVal)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = NewShapeGold
                )
                Text(pts.last().label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            }
        }
        }
    }
}
