package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.PhysicalAssessmentRecord
import com.example.data.model.PhysicalCalculations
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import kotlin.math.abs

enum class AssessmentMetric(val label: String, val unit: String, val decimals: Int) {
    WEIGHT("Peso", "kg", 1),
    BMI("IMC", "", 1),
    BODY_FAT("MG", "%", 1),
    MUSCLE_MASS("MM", "kg", 1),
    VISCERAL_FAT("GV", "", 1),
    BMR("TMB", "kcal", 0);

    fun extract(record: PhysicalAssessmentRecord): Double = when (this) {
        WEIGHT -> record.weightKg
        BMI -> record.bmi
        BODY_FAT -> record.bodyFatPct
        MUSCLE_MASS -> record.muscleMassKg
        VISCERAL_FAT -> record.visceralFat
        BMR -> record.bmrKcal
    }

    fun formatValue(value: Double): String {
        val formatted = if (decimals == 0) String.format("%.0f", value) else String.format("%.1f", value)
        return if (unit.isEmpty()) formatted else "$formatted $unit"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PtAssessmentTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    initialClientId: String? = null
) {
    val activeClients = remember(state.clients) { state.clients.filter { it.active } }
    var selectedClientId by remember(activeClients, initialClientId) {
        mutableStateOf(
            initialClientId?.takeIf { id -> activeClients.any { it.id == id } }
                ?: activeClients.firstOrNull()?.id.orEmpty()
        )
    }
    val selectedClient = activeClients.find { it.id == selectedClientId } ?: activeClients.firstOrNull()
    var dropdownExpanded by remember { mutableStateOf(false) }

    val clientAssessments = remember(state.physicalAssessments, selectedClient?.id) {
        if (selectedClient == null) emptyList()
        else state.physicalAssessments
            .filter { it.clientId == selectedClient.id }
            .sortedBy { it.dateMillis }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column {
                Text("Avaliação Física", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                Text("Apenas leitura · Preenchido pelo aluno", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
            }
        }

        item {
            BrandCard {
                Text("Aluno", style = MaterialTheme.typography.labelMedium, color = NewShapeGold)
                Spacer(Modifier.height(6.dp))
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedClient?.name ?: "Sem alunos ativos",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = darkFieldColors()
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        activeClients.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.name) },
                                onClick = {
                                    selectedClientId = c.id
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        assessmentDashboardItems(
            assessments = clientAssessments,
            onDelete = null
        )
    }
}

fun androidx.compose.foundation.lazy.LazyListScope.assessmentDashboardItems(
    assessments: List<PhysicalAssessmentRecord>,
    onDelete: ((String) -> Unit)?
) {
    if (assessments.isEmpty()) {
        item {
            EmptyStateBox(
                icon = Icons.Default.MonitorWeight,
                title = "Sem avaliações físicas ainda",
                subtitle = "Regista a primeira avaliação para calcular IMC, TMB e gerar o gráfico de evolução."
            )
        }
        return
    }

    val latest = assessments.last()
    val previous = assessments.dropLast(1).lastOrNull()

    // Latest Summary KPI Card (all 8 metrics)
    item {
        BrandCard(highlightBorder = true) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Última Avaliação", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
                    Text("Data: ${formatShortDate(latest.dateMillis)}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                }
                StatusPill(
                    text = PhysicalCalculations.bmiClassification(latest.bmi),
                    textColor = NewShapeGoldBright,
                    containerColor = NewShapeGoldMuted
                )
            }
            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                MetricTile("Peso", "${String.format("%.1f", latest.weightKg)} kg", deltaText(latest.weightKg, previous?.weightKg, "kg"), Modifier.weight(1f))
                MetricTile("Idade", "${latest.ageYears} anos", null, Modifier.weight(1f))
                MetricTile("Altura", "${String.format("%.0f", latest.heightCm)} cm", null, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                MetricTile("Massa Gorda (MG)", "${String.format("%.1f", latest.bodyFatPct)}%", deltaText(latest.bodyFatPct, previous?.bodyFatPct, "%"), Modifier.weight(1f))
                MetricTile("Massa Muscular (MM)", "${String.format("%.1f", latest.muscleMassKg)} kg", deltaText(latest.muscleMassKg, previous?.muscleMassKg, "kg"), Modifier.weight(1f))
                MetricTile("Gord. Visceral (GV)", String.format("%.1f", latest.visceralFat), deltaText(latest.visceralFat, previous?.visceralFat, ""), Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                MetricTile("IMC (Auto)", String.format("%.1f", latest.bmi), deltaText(latest.bmi, previous?.bmi, ""), Modifier.weight(1f), highlight = true)
                MetricTile("TMB (Auto)", "${String.format("%.0f", latest.bmrKcal)} kcal", deltaText(latest.bmrKcal, previous?.bmrKcal, "kcal", 0), Modifier.weight(1f), highlight = true)
            }
        }
    }

    // Evolution Chart Card
    item {
        AssessmentEvolutionChartCard(assessments = assessments)
    }

    item {
        Text("Histórico (${assessments.size})", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
    }

    items(assessments.reversed(), key = { it.id }) { item ->
        BrandCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(formatShortDate(item.dateMillis), style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                    Text(
                        text = "${String.format("%.1f", item.weightKg)} kg · IMC ${String.format("%.1f", item.bmi)} · TMB ${String.format("%.0f", item.bmrKcal)} kcal",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimaryDark
                    )
                }
                if (onDelete != null) {
                    IconButton(onClick = { onDelete(item.id) }) {
                        Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar avaliação", tint = DangerRed)
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = "MG ${String.format("%.1f", item.bodyFatPct)}% · MM ${String.format("%.1f", item.muscleMassKg)} kg · GV ${String.format("%.1f", item.visceralFat)} · ${item.ageYears}a / ${String.format("%.0f", item.heightCm)} cm",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryDark
            )
            if (item.notes.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(item.notes, style = MaterialTheme.typography.labelSmall, color = TextPrimaryDark)
            }
        }
    }
}

@Composable
private fun AssessmentEvolutionChartCard(assessments: List<PhysicalAssessmentRecord>) {
    var selectedMetric by remember { mutableStateOf(AssessmentMetric.WEIGHT) }
    val values = remember(assessments, selectedMetric) {
        assessments.map { selectedMetric.extract(it) }
    }
    val firstVal = values.firstOrNull() ?: 0.0
    val lastVal = values.lastOrNull() ?: 0.0
    val diff = lastVal - firstVal

    BrandCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Gráfico de Evolução", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
            if (assessments.size >= 2) {
                val sign = if (diff > 0) "+" else ""
                val diffStr = if (selectedMetric.decimals == 0) String.format("%.0f", diff) else String.format("%.1f", diff)
                StatusPill(
                    text = "$sign$diffStr ${selectedMetric.unit}".trim(),
                    textColor = NewShapeGoldBright,
                    containerColor = NewShapeGoldMuted
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(AssessmentMetric.entries) { metric ->
                FilterChip(
                    selected = selectedMetric == metric,
                    onClick = { selectedMetric = metric },
                    label = { Text(metric.label) },
                    modifier = Modifier.testTag("chart_metric_${metric.name}"),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = NewShapeGold,
                        selectedLabelColor = TextOnGold
                    )
                )
            }
        }
        Spacer(Modifier.height(12.dp))

        val minVal = (values.minOrNull() ?: 0.0)
        val maxVal = (values.maxOrNull() ?: 1.0)
        val padding = ((maxVal - minVal) * 0.15).coerceAtLeast(1.0)
        val yMin = (minVal - padding).coerceAtLeast(0.0)
        val yMax = maxVal + padding
        val span = (yMax - yMin).coerceAtLeast(0.1)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Máx: ${selectedMetric.formatValue(maxVal)}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            Text("Mín: ${selectedMetric.formatValue(minVal)}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
        }
        Spacer(Modifier.height(6.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .testTag("assessment_evolution_chart")
        ) {
            val leftPad = 14.dp.toPx()
            val rightPad = 14.dp.toPx()
            val topPad = 14.dp.toPx()
            val bottomPad = 14.dp.toPx()
            val w = (size.width - leftPad - rightPad).coerceAtLeast(1f)
            val h = (size.height - topPad - bottomPad).coerceAtLeast(1f)

            // Horizontal reference grid
            for (i in 0..2) {
                val y = topPad + (h / 2f) * i
                drawLine(
                    color = HairlineBorder,
                    start = Offset(leftPad, y),
                    end = Offset(leftPad + w, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            val points = values.mapIndexed { idx, v ->
                val x = if (values.size == 1) leftPad + w / 2f else leftPad + w * (idx.toFloat() / (values.size - 1))
                val normY = ((v - yMin) / span).toFloat().coerceIn(0f, 1f)
                val y = topPad + h * (1f - normY)
                Offset(x, y)
            }

            if (points.size >= 2) {
                val fillPath = Path().apply {
                    moveTo(points.first().x, topPad + h)
                    points.forEach { lineTo(it.x, it.y) }
                    lineTo(points.last().x, topPad + h)
                    close()
                }
                drawPath(
                    path = fillPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(NewShapeGold.copy(alpha = 0.35f), Color.Transparent),
                        startY = topPad,
                        endY = topPad + h
                    )
                )

                val linePath = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(
                    path = linePath,
                    color = NewShapeGold,
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                )
            }

            points.forEachIndexed { idx, pt ->
                val isLast = idx == points.lastIndex
                drawCircle(color = ObsidianBg, radius = if (isLast) 7.dp.toPx() else 5.dp.toPx(), center = pt)
                drawCircle(
                    color = if (isLast) NewShapeGoldBright else NewShapeGold,
                    radius = if (isLast) 5.dp.toPx() else 3.5.dp.toPx(),
                    center = pt
                )
            }
        }

        Spacer(Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "${formatShortDate(assessments.first().dateMillis)}: ${selectedMetric.formatValue(firstVal)}",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondaryDark
            )
            Text(
                text = "Atual (${formatShortDate(assessments.last().dateMillis)}): ${selectedMetric.formatValue(lastVal)}",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = NewShapeGoldBright
            )
        }
    }
}

@Composable
private fun MetricTile(
    label: String,
    value: String,
    delta: String?,
    modifier: Modifier = Modifier,
    highlight: Boolean = false
) {
    Surface(
        color = if (highlight) NewShapeGoldMuted else ElevatedCharcoal,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (highlight) NewShapeGold else HairlineBorder),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = if (highlight) NewShapeGoldBright else TextSecondaryDark, maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
            if (delta != null) {
                Text(delta, style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
            }
        }
    }
}

private fun deltaText(current: Double, previous: Double?, unit: String, decimals: Int = 1): String? {
    if (previous == null) return null
    val diff = current - previous
    if (abs(diff) < 0.05) return "="
    val sign = if (diff > 0) "+" else ""
    val num = if (decimals == 0) String.format("%.0f", diff) else String.format("%.1f", diff)
    return if (unit.isEmpty()) "$sign$num" else "$sign$num $unit"
}

@Composable
fun NewAssessmentDialog(
    clientName: String,
    latest: PhysicalAssessmentRecord?,
    onDismiss: () -> Unit,
    onSave: (Double, Int, Double, String, Double, Double, Double, String) -> Unit
) {
    var sex by remember { mutableStateOf(latest?.sex ?: "M") }
    var weightText by remember { mutableStateOf(latest?.weightKg?.let { String.format("%.1f", it) } ?: "70.0") }
    var ageText by remember { mutableStateOf(latest?.ageYears?.toString() ?: "28") }
    var heightText by remember { mutableStateOf(latest?.heightCm?.let { String.format("%.0f", it) } ?: "175") }
    var bodyFatText by remember { mutableStateOf(latest?.bodyFatPct?.let { String.format("%.1f", it) } ?: "18.0") }
    var muscleMassText by remember { mutableStateOf(latest?.muscleMassKg?.let { String.format("%.1f", it) } ?: "32.0") }
    var visceralFatText by remember { mutableStateOf(latest?.visceralFat?.let { String.format("%.1f", it) } ?: "5.0") }
    var notes by remember { mutableStateOf("") }

    val w = weightText.replace(',', '.').toDoubleOrNull() ?: 0.0
    val age = ageText.toIntOrNull() ?: 0
    val h = heightText.replace(',', '.').toDoubleOrNull() ?: 0.0
    val fat = bodyFatText.replace(',', '.').toDoubleOrNull() ?: 0.0
    val muscle = muscleMassText.replace(',', '.').toDoubleOrNull() ?: 0.0
    val visceral = visceralFatText.replace(',', '.').toDoubleOrNull() ?: 0.0

    val liveBmi = PhysicalCalculations.calculateBmi(w, h)
    val liveBmr = PhysicalCalculations.calculateBmrMifflinStJeor(w, h, age, sex)
    val canSave = w in 20.0..500.0 && age in 5..120 && h in 50.0..260.0

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Nova Avaliação · $clientName", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Sexo (para cálculo automático do TMB)", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("M" to "Masculino", "F" to "Feminino").forEach { (code, lbl) ->
                        FilterChip(
                            selected = sex == code,
                            onClick = { sex = code },
                            label = { Text(lbl) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = weightText,
                        onValueChange = { weightText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Peso (kg)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f).testTag("assessment_weight_input"),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = ageText,
                        onValueChange = { ageText = it.filter { c -> c.isDigit() }.take(3) },
                        label = { Text("Idade") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f).testTag("assessment_age_input"),
                        colors = darkFieldColors()
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = heightText,
                        onValueChange = { heightText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Altura (cm)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f).testTag("assessment_height_input"),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = bodyFatText,
                        onValueChange = { bodyFatText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("MG (%)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f).testTag("assessment_fat_input"),
                        colors = darkFieldColors()
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = muscleMassText,
                        onValueChange = { muscleMassText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("MM (kg)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f).testTag("assessment_muscle_input"),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = visceralFatText,
                        onValueChange = { visceralFatText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Gord. Visceral (GV)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f).testTag("assessment_visceral_input"),
                        colors = darkFieldColors()
                    )
                }

                // Auto-calculated preview box for IMC and TMB
                Surface(
                    color = NewShapeGoldMuted,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, NewShapeGold),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "Calculado automaticamente",
                            style = MaterialTheme.typography.labelSmall,
                            color = NewShapeGoldBright
                        )
                        Spacer(Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "IMC: ${if (liveBmi > 0) String.format("%.1f", liveBmi) else "—"} (${PhysicalCalculations.bmiClassification(liveBmi)})",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                            Text(
                                text = "TMB: ${if (liveBmr > 0) String.format("%.0f kcal", liveBmr) else "—"}",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = NewShapeGoldBright
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas / Observações (opcional)") },
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar Avaliação",
                enabled = canSave,
                onClick = { onSave(w, age, h, sex, fat, muscle, visceral, notes) },
                testTag = "save_assessment_button"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}
