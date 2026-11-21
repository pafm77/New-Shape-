package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.WorkoutPlanItemRecord
import com.example.data.model.WorkoutPlanRecord
import com.example.ui.theme.*
import java.util.Locale
import kotlin.math.round

data class ExerciseLastLoadInfo(
    val load: String,
    val loggedAtMillis: Long,
    val sourceLabel: String,
    val deltaKg: Double?
)

private fun normalizeExerciseKey(name: String): String =
    name.trim().lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")

fun parseNumericLoadKg(raw: String): Double? {
    val match = Regex("(\\d+(?:[.,]\\d+)?)").find(raw) ?: return null
    return match.value.replace(',', '.').toDoubleOrNull()
}

/**
 * Resolves the load used in the student's last workout for a specific exercise,
 * searching both this plan item and historical workout plan items for the same student.
 */
fun resolveLastExerciseLoad(
    item: WorkoutPlanItemRecord,
    clientId: String,
    workoutPlans: List<WorkoutPlanRecord>,
    workoutPlanItems: List<WorkoutPlanItemRecord>
): ExerciseLastLoadInfo {
    val currentLoadNum = parseNumericLoadKg(item.loadKg)
    fun computeDelta(prevLoad: String): Double? {
        val prevNum = parseNumericLoadKg(prevLoad) ?: return null
        val curr = currentLoadNum ?: return null
        return round((curr - prevNum) * 10.0) / 10.0
    }

    // 1. Direct lastLoadKg stored on this item
    val directLast = item.lastLoadKg.trim()
    if (directLast.isNotBlank()) {
        return ExerciseLastLoadInfo(
            load = directLast,
            loggedAtMillis = item.lastLoggedAtMillis,
            sourceLabel = "Último treino neste plano",
            deltaKg = computeDelta(directLast)
        )
    }

    // 2. Historical lookup across all plans of this same student for the same exercise
    val clientPlansById = workoutPlans.filter { it.clientId == clientId }.associateBy { it.id }
    val targetName = normalizeExerciseKey(item.exerciseName)

    data class HistoricalCandidate(
        val load: String,
        val sortTs: Long,
        val loggedAtMillis: Long,
        val planTitle: String
    )

    val bestHistory = workoutPlanItems
        .asSequence()
        .filter { it.id != item.id }
        .mapNotNull { other ->
            val plan = clientPlansById[other.planId] ?: return@mapNotNull null
            val sameEx = (item.exerciseId.isNotBlank() && other.exerciseId == item.exerciseId) ||
                normalizeExerciseKey(other.exerciseName) == targetName
            if (!sameEx) return@mapNotNull null
            val candidateLoad = other.lastLoadKg.ifBlank { other.loadKg }.trim()
            if (candidateLoad.isBlank()) return@mapNotNull null
            val ts = if (other.lastLoggedAtMillis > 0L) other.lastLoggedAtMillis else plan.createdAtMillis
            HistoricalCandidate(
                load = candidateLoad,
                sortTs = ts,
                loggedAtMillis = other.lastLoggedAtMillis,
                planTitle = plan.title
            )
        }
        .maxByOrNull { it.sortTs }

    if (bestHistory != null) {
        return ExerciseLastLoadInfo(
            load = bestHistory.load,
            loggedAtMillis = bestHistory.loggedAtMillis,
            sourceLabel = "Histórico · ${bestHistory.planTitle}",
            deltaKg = computeDelta(bestHistory.load)
        )
    }

    // 3. Fallback to current loadKg defined on this plan item
    val fallback = item.loadKg.trim()
    if (fallback.isNotBlank()) {
        return ExerciseLastLoadInfo(
            load = fallback,
            loggedAtMillis = item.lastLoggedAtMillis,
            sourceLabel = if (item.lastLoggedAtMillis > 0L) "Último registo do aluno" else "Carga atual definida no plano",
            deltaKg = 0.0
        )
    }

    return ExerciseLastLoadInfo(
        load = "",
        loggedAtMillis = 0L,
        sourceLabel = "Ainda sem histórico registado",
        deltaKg = null
    )
}

@Composable
fun ExerciseLastLoadBadge(
    item: WorkoutPlanItemRecord,
    clientId: String,
    workoutPlans: List<WorkoutPlanRecord>,
    workoutPlanItems: List<WorkoutPlanItemRecord>,
    emphasize: Boolean = false,
    modifier: Modifier = Modifier
) {
    val info = remember(item, clientId, workoutPlans, workoutPlanItems) {
        resolveLastExerciseLoad(
            item = item,
            clientId = clientId,
            workoutPlans = workoutPlans,
            workoutPlanItems = workoutPlanItems
        )
    }
    var expanded by remember(item.id) { mutableStateOf(false) }
    val hasLoad = info.load.isNotBlank()

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Surface(
            color = when {
                hasLoad && emphasize -> NewShapeGoldMuted
                hasLoad -> NewShapeGoldMuted.copy(alpha = 0.65f)
                else -> ElevatedCharcoal
            },
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(
                1.dp,
                if (hasLoad) NewShapeGold.copy(alpha = if (emphasize) 0.9f else 0.5f) else HairlineBorder
            ),
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .clickable { expanded = !expanded }
                .testTag("last_load_badge_${item.id}")
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.History,
                    contentDescription = "Carga do último treino",
                    tint = if (hasLoad) NewShapeGoldBright else TextSecondaryDark,
                    modifier = Modifier.size(14.dp)
                )
                Text(
                    text = if (hasLoad) "Últ. treino: ${info.load}" else "Últ. treino: —",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (hasLoad) NewShapeGoldBright else TextSecondaryDark
                )
                val delta = info.deltaKg
                if (delta != null && delta != 0.0) {
                    val positive = delta > 0.0
                    val deltaText = if (positive) "+${formatDelta(delta)} kg" else "${formatDelta(delta)} kg"
                    Text(
                        text = deltaText,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (positive) ConfirmedGreen else PendingAmber
                    )
                }
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = "Ver detalhes do histórico de carga",
                    tint = if (hasLoad) NewShapeGoldBright.copy(alpha = 0.8f) else TextSecondaryDark,
                    modifier = Modifier.size(13.dp)
                )
            }
        }

        AnimatedVisibility(visible = expanded) {
            Surface(
                color = ObsidianBg,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.55f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("last_load_tooltip_${item.id}")
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Histórico · ${item.exerciseName}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = NewShapeGoldBright,
                            modifier = Modifier.weight(1f)
                        )
                        if (info.loggedAtMillis > 0L) {
                            Text(
                                text = formatShortDate(info.loggedAtMillis),
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Carga último treino:", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                        Text(
                            text = if (hasLoad) info.load else "Sem registo",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = NewShapeGoldBright
                        )
                    }
                    if (item.loadKg.isNotBlank()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Carga atual:", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                            Text(
                                text = item.loadKg,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimaryDark
                            )
                        }
                    }
                    val delta = info.deltaKg
                    if (delta != null && delta != 0.0) {
                        val positive = delta > 0.0
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Evolução:", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(3.dp)
                            ) {
                                Icon(
                                    imageVector = if (positive) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                                    contentDescription = "Evolução de carga",
                                    tint = if (positive) ConfirmedGreen else PendingAmber,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = if (positive) "+${formatDelta(delta)} kg" else "${formatDelta(delta)} kg",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (positive) ConfirmedGreen else PendingAmber
                                )
                            }
                        }
                    }
                    Text(
                        text = info.sourceLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }
        }
    }
}

private fun formatDelta(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toInt().toString()
    } else {
        String.format(Locale.US, "%.1f", value)
    }
}
