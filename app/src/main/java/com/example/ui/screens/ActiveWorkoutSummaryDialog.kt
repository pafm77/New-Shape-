package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.ui.components.BrandCard
import com.example.ui.components.DarkSecondaryButton
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.theme.*
import kotlin.math.abs
import kotlin.math.roundToInt

data class BrokenPrRecord(
    val exerciseName: String,
    val previousKg: Double?,
    val newKg: Double
)

data class ActiveWorkoutSummaryData(
    val planId: String,
    val planTitle: String,
    val durationSeconds: Int,
    val completedSets: Int,
    val totalSets: Int,
    val completedExercises: Int,
    val totalExercises: Int,
    val totalVolumeKg: Double,
    val brokenPrs: List<BrokenPrRecord>
)

fun formatWorkoutDuration(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val hrs = safe / 3600
    val mins = (safe % 3600) / 60
    val secs = safe % 60
    return if (hrs > 0) String.format("%d:%02d:%02d", hrs, mins, secs)
    else String.format("%02d:%02d", mins, secs)
}

fun parseRepAverage(reps: String): Double {
    val matches = Regex("\\d+").findAll(reps).mapNotNull { it.value.toDoubleOrNull() }.toList()
    if (matches.isEmpty()) return 10.0
    return if (matches.size >= 2) (matches[0] + matches[1]) / 2.0 else matches[0]
}

fun formatKgCompact(kg: Double): String {
    return if (abs(kg - kg.roundToInt().toDouble()) < 0.05) "${kg.roundToInt()} kg"
    else "${String.format("%.1f", kg)} kg"
}

fun buildWorkoutSummaryShareText(
    studentName: String,
    summary: ActiveWorkoutSummaryData
): String = buildString {
    appendLine("💪 Treino Concluído — New Shape")
    appendLine("🏋️ ${summary.planTitle}")
    appendLine("⏱ Duração: ${formatWorkoutDuration(summary.durationSeconds)}")
    appendLine("✅ Séries: ${summary.completedSets}/${summary.totalSets} (${summary.completedExercises}/${summary.totalExercises} exercícios)")
    if (summary.totalVolumeKg > 0.0) {
        appendLine("🔥 Volume total: ${summary.totalVolumeKg.roundToInt()} kg")
    }
    if (summary.brokenPrs.isNotEmpty()) {
        appendLine("🏆 Novos Recordes (PR):")
        summary.brokenPrs.forEach { pr ->
            val prevPart = pr.previousKg?.let { " (antes ${formatKgCompact(it)})" }.orEmpty()
            appendLine("  • ${pr.exerciseName}: ${formatKgCompact(pr.newKg)}$prevPart")
        }
    }
    append("Atleta: $studentName · #NewShape")
}

@Composable
fun ActiveWorkoutHudCard(
    planTitle: String,
    elapsedSeconds: Int,
    completedSets: Int,
    totalSets: Int,
    completedExercises: Int,
    totalExercises: Int,
    totalVolumeKg: Double,
    brokenPrCount: Int,
    onFinish: () -> Unit
) {
    val setProgress = if (totalSets > 0) (completedSets.toFloat() / totalSets.toFloat()).coerceIn(0f, 1f) else 0f

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
                Icon(Icons.Default.Bolt, contentDescription = "Treino ativo", tint = NewShapeGoldBright, modifier = Modifier.size(20.dp))
                Column {
                    Text(
                        text = "Treino Ativo · ${formatWorkoutDuration(elapsedSeconds)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = NewShapeGoldBright
                    )
                    Text(
                        text = planTitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark,
                        maxLines = 1
                    )
                }
            }
            if (brokenPrCount > 0) {
                StatusPill(
                    text = "🏆 $brokenPrCount PR",
                    textColor = TextOnGold,
                    containerColor = NewShapeGold
                )
            } else {
                StatusPill(
                    text = "$completedSets/$totalSets séries",
                    textColor = ConfirmedGreen,
                    containerColor = ConfirmedGreenContainer
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { setProgress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = if (setProgress >= 1f) ConfirmedGreen else NewShapeGold,
            trackColor = ElevatedCharcoal
        )

        Spacer(Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            HudKpiPill("Exercícios", "$completedExercises/$totalExercises", TextPrimaryDark, Modifier.weight(1f))
            HudKpiPill("Séries", "$completedSets/$totalSets", ConfirmedGreen, Modifier.weight(1f))
            HudKpiPill(
                "Volume",
                if (totalVolumeKg > 0.0) "${totalVolumeKg.roundToInt()} kg" else "—",
                NewShapeGoldBright,
                Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(10.dp))
        GoldPrimaryButton(
            text = "Terminar & Ver Resumo",
            icon = Icons.Default.EmojiEvents,
            onClick = onFinish,
            modifier = Modifier.fillMaxWidth(),
            testTag = "active_workout_finish_summary_btn"
        )
    }
}

@Composable
private fun HudKpiPill(
    label: String,
    value: String,
    valueColor: Color,
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
            Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            Spacer(Modifier.height(2.dp))
            Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = valueColor)
        }
    }
}

@Composable
fun ActiveWorkoutSummaryDialog(
    summary: ActiveWorkoutSummaryData,
    onShare: () -> Unit,
    onSendFeedback: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = NewShapeGoldMuted,
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.EmojiEvents,
                            contentDescription = "Treino concluído",
                            tint = NewShapeGoldBright,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }
                Column {
                    Text("Treino Concluído! 💪", fontWeight = FontWeight.ExtraBold, color = NewShapeGoldBright)
                    Text(summary.planTitle, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    HudKpiPill("Duração", formatWorkoutDuration(summary.durationSeconds), NewShapeGoldBright, Modifier.weight(1f))
                    HudKpiPill("Séries", "${summary.completedSets}/${summary.totalSets}", ConfirmedGreen, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    HudKpiPill("Exercícios", "${summary.completedExercises}/${summary.totalExercises}", TextPrimaryDark, Modifier.weight(1f))
                    HudKpiPill(
                        "Volume Total",
                        if (summary.totalVolumeKg > 0.0) "${summary.totalVolumeKg.roundToInt()} kg" else "Peso corporal",
                        NewShapeGoldBright,
                        Modifier.weight(1f)
                    )
                }

                if (summary.brokenPrs.isNotEmpty()) {
                    Surface(
                        color = NewShapeGoldMuted.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.75f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "🏆 ${summary.brokenPrs.size} Novo(s) Recorde(s) Pessoal(is)!",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = NewShapeGoldBright
                            )
                            summary.brokenPrs.forEach { pr ->
                                val deltaText = pr.previousKg?.let { prev ->
                                    val d = pr.newKg - prev
                                    if (d > 0.05) " (+${formatKgCompact(d)})" else ""
                                }.orEmpty()
                                Text(
                                    text = "• ${pr.exerciseName}: ${formatKgCompact(pr.newKg)}$deltaText",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                            }
                        }
                    }
                } else {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Excelente consistência! Cada treino conta para a tua sequência e evolução.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                DarkSecondaryButton(
                    text = "Partilhar / Copiar Resumo",
                    icon = Icons.Default.Share,
                    onClick = onShare,
                    modifier = Modifier.fillMaxWidth().testTag("workout_summary_share_btn")
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Enviar Feedback ao PT",
                icon = Icons.Default.Star,
                onClick = onSendFeedback,
                testTag = "workout_summary_feedback_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar", color = TextSecondaryDark)
            }
        }
    )
}
