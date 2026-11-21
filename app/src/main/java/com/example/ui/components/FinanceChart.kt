package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.ClientRecord
import com.example.data.model.PaymentRecord
import com.example.ui.theme.*
import java.util.Calendar
import java.util.Locale

private val PT_MONTH_SHORT = listOf(
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
)

private val PT_MONTH_FULL = listOf(
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
)

private data class MonthlyFinanceBucket(
    val monthYear: String,
    val shortLabel: String,
    val fullLabel: String,
    val personalizadoEur: Double,
    val grupoEur: Double,
    val personalizadoCount: Int,
    val grupoCount: Int
) {
    val totalEur: Double get() = personalizadoEur + grupoEur
}

/**
 * Admin-only 6-month received revenue bar chart distinguishing Treino Personalizado vs Treino em Grupo.
 * Strictly gated by [isSuperAdmin] (pafm77pedrinho77@gmail.com).
 */
@Composable
fun FinanceChart(
    payments: List<PaymentRecord>,
    clients: List<ClientRecord>,
    isSuperAdmin: Boolean,
    modifier: Modifier = Modifier
) {
    if (!isSuperAdmin) return

    val buckets = remember(payments, clients) {
        val clientMap = clients.associateBy { it.id }
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)

        val monthKeys = (5 downTo 0).map { offset ->
            val c = (cal.clone() as Calendar).apply { add(Calendar.MONTH, -offset) }
            val year = c.get(Calendar.YEAR)
            val monthIdx = c.get(Calendar.MONTH)
            val key = String.format(Locale.US, "%04d-%02d", year, monthIdx + 1)
            Triple(key, PT_MONTH_SHORT[monthIdx], "${PT_MONTH_FULL[monthIdx]} $year")
        }

        val paidByMonth = payments.filter { it.paid && it.monthYear.isNotBlank() }
            .groupBy { it.monthYear }

        monthKeys.map { (key, shortLbl, fullLbl) ->
            val monthList = paidByMonth[key].orEmpty()
            var persSum = 0.0
            var grpSum = 0.0
            var persCount = 0
            var grpCount = 0
            monthList.forEach { p ->
                val isPers = clientMap[p.clientId]?.trainingType == "PERSONALIZADO"
                if (isPers) {
                    persSum += p.amountEur
                    persCount++
                } else {
                    grpSum += p.amountEur
                    grpCount++
                }
            }
            MonthlyFinanceBucket(
                monthYear = key,
                shortLabel = shortLbl,
                fullLabel = fullLbl,
                personalizadoEur = persSum,
                grupoEur = grpSum,
                personalizadoCount = persCount,
                grupoCount = grpCount
            )
        }
    }

    val totalPers = remember(buckets) { buckets.sumOf { it.personalizadoEur } }
    val totalGrp = remember(buckets) { buckets.sumOf { it.grupoEur } }
    val grandTotal = totalPers + totalGrp

    var selectedIndex by remember(buckets) {
        val lastNonEmpty = buckets.indexOfLast { it.totalEur > 0.0 }
        mutableIntStateOf(if (lastNonEmpty >= 0) lastNonEmpty else buckets.lastIndex)
    }

    val selectedBucket = buckets.getOrNull(selectedIndex.coerceIn(0, buckets.lastIndex))

    BrandCard(highlightBorder = true, modifier = modifier.testTag("finance_chart_card")) {
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
                Icon(
                    imageVector = Icons.Default.BarChart,
                    contentDescription = "Gráfico financeiro dos últimos 6 meses",
                    tint = NewShapeGoldBright,
                    modifier = Modifier.size(20.dp)
                )
                Column {
                    Text(
                        text = "Mensalidades — Últimos 6 Meses",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "Personalizado vs Grupo (recebidas)",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }
            StatusPill(
                text = "Admin",
                textColor = NewShapeGoldBright,
                containerColor = NewShapeGoldMuted
            )
        }

        Spacer(Modifier.height(10.dp))

        // 6-month summary strip
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ChartSummaryPill(
                label = "Personalizado",
                value = "€${String.format(Locale.US, "%.0f", totalPers)}",
                dotColor = NewShapeGold,
                modifier = Modifier.weight(1f)
            )
            ChartSummaryPill(
                label = "Grupo",
                value = "€${String.format(Locale.US, "%.0f", totalGrp)}",
                dotColor = InfoBlue,
                modifier = Modifier.weight(1f)
            )
            ChartSummaryPill(
                label = "Total 6m",
                value = "€${String.format(Locale.US, "%.0f", grandTotal)}",
                dotColor = ConfirmedGreen,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(14.dp))

        if (grandTotal <= 0.0) {
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.VerifiedUser,
                        contentDescription = "Sem dados financeiros recentes",
                        tint = NewShapeGold,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "Sem mensalidades recebidas nos últimos 6 meses",
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "Regista pagamentos de alunos personalizados ou de grupo para ver a evolução aqui.",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }
        } else {
            val maxBarValue = remember(buckets) {
                buckets.maxOf { maxOf(it.personalizadoEur, it.grupoEur) }.coerceAtLeast(10.0)
            }

            // Grouped bar chart Canvas
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(152.dp)
            ) {
                val slotCount = buckets.size.coerceAtLeast(1)
                val slotWidth = size.width / slotCount
                val pairGap = 4.dp.toPx()
                val barWidth = ((slotWidth * 0.68f - pairGap) / 2f).coerceIn(8.dp.toPx(), 20.dp.toPx())
                val topPad = 8.dp.toPx()
                val usableHeight = (size.height - topPad).coerceAtLeast(1f)
                val dashEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)

                // Horizontal gridlines
                for (step in 0..3) {
                    val y = topPad + usableHeight * (step / 3f)
                    drawLine(
                        color = HairlineBorder.copy(alpha = 0.65f),
                        start = Offset(0f, y),
                        end = Offset(size.width, y),
                        strokeWidth = 1.dp.toPx(),
                        pathEffect = if (step < 3) dashEffect else null
                    )
                }

                buckets.forEachIndexed { idx, bucket ->
                    val slotLeft = idx * slotWidth

                    // Subtle highlight behind selected month
                    if (idx == selectedIndex) {
                        drawRoundRect(
                            color = NewShapeGold.copy(alpha = 0.10f),
                            topLeft = Offset(slotLeft + 3.dp.toPx(), 0f),
                            size = Size((slotWidth - 6.dp.toPx()).coerceAtLeast(1f), size.height),
                            cornerRadius = CornerRadius(10.dp.toPx(), 10.dp.toPx())
                        )
                    }

                    val pairTotalW = barWidth * 2 + pairGap
                    val pairStartX = slotLeft + (slotWidth - pairTotalW) / 2f

                    // Personalizado bar (Gold)
                    val persHeight = if (bucket.personalizadoEur > 0.0) {
                        ((bucket.personalizadoEur / maxBarValue).toFloat().coerceIn(0.06f, 1f)) * usableHeight
                    } else {
                        3.dp.toPx()
                    }
                    drawRoundRect(
                        color = if (bucket.personalizadoEur > 0.0) NewShapeGold else HairlineBorder,
                        topLeft = Offset(pairStartX, size.height - persHeight),
                        size = Size(barWidth, persHeight),
                        cornerRadius = CornerRadius(5.dp.toPx(), 5.dp.toPx())
                    )

                    // Grupo bar (InfoBlue)
                    val grpHeight = if (bucket.grupoEur > 0.0) {
                        ((bucket.grupoEur / maxBarValue).toFloat().coerceIn(0.06f, 1f)) * usableHeight
                    } else {
                        3.dp.toPx()
                    }
                    drawRoundRect(
                        color = if (bucket.grupoEur > 0.0) InfoBlue else HairlineBorder,
                        topLeft = Offset(pairStartX + barWidth + pairGap, size.height - grpHeight),
                        size = Size(barWidth, grpHeight),
                        cornerRadius = CornerRadius(5.dp.toPx(), 5.dp.toPx())
                    )
                }
            }

            Spacer(Modifier.height(6.dp))

            // Interactive Month Selector Row (48dp min touch height)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                buckets.forEachIndexed { idx, bucket ->
                    val isSelected = idx == selectedIndex
                    Surface(
                        color = if (isSelected) NewShapeGoldMuted else Color.Transparent,
                        shape = RoundedCornerShape(10.dp),
                        border = if (isSelected) BorderStroke(1.dp, NewShapeGold) else null,
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { selectedIndex = idx }
                            .testTag("finance_chart_month_${bucket.monthYear}")
                    ) {
                        Column(
                            modifier = Modifier.padding(vertical = 6.dp, horizontal = 2.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = bucket.shortLabel,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) NewShapeGoldBright else TextSecondaryDark
                            )
                            Text(
                                text = if (bucket.totalEur > 0.0) "€${bucket.totalEur.toInt()}" else "—",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isSelected) TextPrimaryDark else TextSecondaryDark
                            )
                        }
                    }
                }
            }

            // Selected Month Interactive Tooltip Card
            selectedBucket?.let { bucket ->
                Spacer(Modifier.height(10.dp))
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.45f)),
                    modifier = Modifier.fillMaxWidth()
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
                                text = bucket.fullLabel,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = NewShapeGoldBright
                            )
                            Text(
                                text = "Total: €${String.format(Locale.US, "%.2f", bucket.totalEur)}",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "● Personalizado (${bucket.personalizadoCount}): €${String.format(Locale.US, "%.2f", bucket.personalizadoEur)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = NewShapeGoldBright
                            )
                            Text(
                                text = "● Grupo (${bucket.grupoCount}): €${String.format(Locale.US, "%.2f", bucket.grupoEur)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = InfoBlue
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartSummaryPill(
    label: String,
    value: String,
    dotColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = ElevatedCharcoal,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(dotColor)
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondaryDark,
                    maxLines = 1
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark
            )
        }
    }
}
