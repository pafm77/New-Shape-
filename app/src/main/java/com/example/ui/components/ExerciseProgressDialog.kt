package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.WorkoutLoadLogRecord
import com.example.data.normalizeExercisePrKey
import com.example.ui.theme.*
import java.util.Locale

@Composable
fun ExerciseProgressDialog(
    clientId: String,
    clientName: String,
    exerciseId: String,
    exerciseName: String,
    workoutLoadLogs: List<WorkoutLoadLogRecord>,
    currentLoadKg: String = "",
    onDismiss: () -> Unit
) {
    val targetKey = remember(exerciseId, exerciseName) {
        normalizeExercisePrKey(exerciseId, exerciseName)
    }

    val matchingLogs = remember(workoutLoadLogs, clientId, exerciseId, targetKey) {
        workoutLoadLogs
            .filter { log ->
                log.clientId == clientId && (
                    (exerciseId.isNotBlank() && log.exerciseId == exerciseId) ||
                        normalizeExercisePrKey(log.exerciseId, log.exerciseName) == targetKey
                    )
            }
            .sortedBy { it.loggedAtMillis }
    }

    val numericPoints = remember(matchingLogs) {
        matchingLogs.mapNotNull { log ->
            val kg = if (log.numericKg > 0.0) log.numericKg else parseNumericLoadKg(log.loadKg)
            if (kg != null && kg > 0.0) log to kg else null
        }
    }

    val prPair = remember(numericPoints) {
        numericPoints.maxByOrNull { it.second }
    }
    val latestPair = remember(numericPoints) {
        numericPoints.lastOrNull()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Column {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.TrendingUp,
                        contentDescription = "Evolução de cargas",
                        tint = NewShapeGoldBright
                    )
                    Text(
                        text = exerciseName,
                        style = MaterialTheme.typography.titleLarge,
                        color = TextPrimaryDark
                    )
                }
                if (clientName.isNotBlank()) {
                    Text(
                        text = "Evolução de cargas & PR · $clientName",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // PR + Latest Summary Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        color = NewShapeGoldMuted,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, NewShapeGold),
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.EmojiEvents,
                                    contentDescription = "Recorde Pessoal",
                                    tint = NewShapeGoldBright,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "Recorde (PR)",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = NewShapeGoldBright
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = prPair?.first?.loadKg?.ifBlank { formatKgVal(prPair.second) }
                                    ?: currentLoadKg.ifBlank { "—" },
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                            if (prPair != null) {
                                Text(
                                    text = formatShortDate(prPair.first.loggedAtMillis),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = NewShapeGoldBright
                                )
                            }
                        }
                    }

                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "Última Carga",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = latestPair?.first?.loadKg?.ifBlank { formatKgVal(latestPair.second) }
                                    ?: currentLoadKg.ifBlank { "—" },
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                            Text(
                                text = "${matchingLogs.size} registo(s)",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                    }
                }

                // Native Compose Canvas Line Chart
                if (numericPoints.isEmpty()) {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Ainda não existem registos numéricos (kg) no histórico deste exercício. Assim que o aluno guardar a carga durante o treino, a evolução aparece aqui.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                } else {
                    Surface(
                        color = ObsidianBg,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("exercise_progress_chart")
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            val minKg = numericPoints.minOf { it.second }
                            val maxKg = numericPoints.maxOf { it.second }
                            val prKg = prPair?.second ?: maxKg

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Curva de Progressão (kg)",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Min ${formatKgVal(minKg)} · Máx ${formatKgVal(maxKg)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                            }
                            Spacer(Modifier.height(10.dp))

                            Canvas(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(150.dp)
                            ) {
                                val padLeft = 14f
                                val padRight = 14f
                                val padTop = 18f
                                val padBottom = 18f
                                val plotW = (size.width - padLeft - padRight).coerceAtLeast(1f)
                                val plotH = (size.height - padTop - padBottom).coerceAtLeast(1f)

                                // Subtle horizontal grid lines
                                for (i in 0..3) {
                                    val gy = padTop + (plotH * i / 3f)
                                    drawLine(
                                        color = Color(0xFF2E2E34),
                                        start = Offset(padLeft, gy),
                                        end = Offset(size.width - padRight, gy),
                                        strokeWidth = 1.5f
                                    )
                                }

                                val range = (maxKg - minKg).let { if (it < 1.0) 10.0 else it }
                                val baselineMin = if (maxKg - minKg < 1.0) (minKg - 5.0).coerceAtLeast(0.0) else minKg

                                val coords = numericPoints.mapIndexed { index, pair ->
                                    val x = if (numericPoints.size == 1) {
                                        padLeft + plotW / 2f
                                    } else {
                                        padLeft + (index.toFloat() / (numericPoints.size - 1)) * plotW
                                    }
                                    val normY = ((pair.second - baselineMin) / range).coerceIn(0.0, 1.0).toFloat()
                                    val y = padTop + plotH * (1f - normY)
                                    Triple(Offset(x, y), pair.second, pair.second >= prKg - 0.001)
                                }

                                if (coords.size >= 2) {
                                    val path = Path().apply {
                                        moveTo(coords.first().first.x, coords.first().first.y)
                                        for (i in 1 until coords.size) {
                                            lineTo(coords[i].first.x, coords[i].first.y)
                                        }
                                    }
                                    drawPath(
                                        path = path,
                                        color = NewShapeGold,
                                        style = Stroke(width = 5f, cap = StrokeCap.Round)
                                    )
                                }

                                coords.forEach { (pt, _, isPrPoint) ->
                                    if (isPrPoint) {
                                        drawCircle(
                                            color = NewShapeGoldBright.copy(alpha = 0.28f),
                                            radius = 15f,
                                            center = pt
                                        )
                                    }
                                    drawCircle(
                                        color = if (isPrPoint) NewShapeGoldBright else NewShapeGold,
                                        radius = if (isPrPoint) 8f else 6f,
                                        center = pt
                                    )
                                    drawCircle(
                                        color = ObsidianBg,
                                        radius = 3f,
                                        center = pt
                                    )
                                }
                            }

                            Spacer(Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = formatShortDate(numericPoints.first().first.loggedAtMillis),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                                if (numericPoints.size > 1) {
                                    Text(
                                        text = formatShortDate(numericPoints.last().first.loggedAtMillis),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark
                                    )
                                }
                            }
                        }
                    }

                    // Chronological Log History (newest first)
                    Text(
                        text = "Histórico de Registos",
                        style = MaterialTheme.typography.labelMedium,
                        color = NewShapeGoldBright
                    )
                    val prId = prPair?.first?.id
                    matchingLogs.reversed().take(12).forEach { log ->
                        val isPr = prId != null && log.id == prId
                        Surface(
                            color = if (isPr) NewShapeGoldMuted.copy(alpha = 0.45f) else ElevatedCharcoal,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, if (isPr) NewShapeGold else HairlineBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = log.loadKg.ifBlank { formatKgVal(log.numericKg) },
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isPr) NewShapeGoldBright else TextPrimaryDark
                                    )
                                    Text(
                                        text = formatShortDate(log.loggedAtMillis),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark
                                    )
                                }
                                if (isPr) {
                                    StatusPill(
                                        text = "🏆 PR",
                                        textColor = NewShapeGoldBright,
                                        containerColor = NewShapeGoldMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
            }
        }
    )
}

private fun formatKgVal(v: Double): String =
    if (v % 1.0 == 0.0) "${v.toInt()} kg" else String.format(Locale.US, "%.1f kg", v)
