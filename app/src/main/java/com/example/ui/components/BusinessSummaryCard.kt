package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.BookingRecord
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.data.model.PaymentRecord
import com.example.ui.theme.*
import java.util.Calendar
import java.util.Locale

private val BIZ_MONTH_SHORT = listOf(
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
)

private val BIZ_MONTH_FULL = listOf(
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
)

private data class BizMonthBucket(
    val monthYear: String,
    val shortLabel: String,
    val fullLabel: String,
    val mensalidadesEur: Double,
    val extrasEur: Double,
    val personalizadoEur: Double,
    val grupoEur: Double,
    val payingStudents: Int,
    val newGrupoCount: Int,
    val newPersonalizadoCount: Int,
    val newClientNames: List<String>
) {
    val totalNewStudents: Int get() = newGrupoCount + newPersonalizadoCount
}

private data class LoyaltySlice(
    val key: String,
    val label: String,
    val count: Int,
    val pct: Int,
    val color: Color
)

private data class BusinessSummaryAnalytics(
    val buckets: List<BizMonthBucket>,
    val currentMonthMensalidades: Double,
    val avgMonthlyMensalidades: Double,
    val totalMensalidadesWindow: Double,
    val totalExtrasWindow: Double,
    val futurePrepaidEur: Double,
    val revenueDeltaPct: Int?,
    val totalNewStudentsWindow: Int,
    val currentMonthNewStudents: Int,
    val activeClientsCount: Int,
    val totalClientsCount: Int,
    val activeRetentionPct: Int,
    val fidelizedCount: Int,
    val loyaltyRatePct: Int,
    val expiringSoonCount: Int,
    val loyaltySlices: List<LoyaltySlice>,
    val grupoLoyaltyPct: Int,
    val persLoyaltyPct: Int,
    val grupoTotal: Int,
    val persTotal: Int
)

private fun millisToMonthYear(ms: Long): String {
    if (ms <= 0L) return ""
    val cal = Calendar.getInstance().apply { timeInMillis = ms }
    return String.format(Locale.US, "%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
}

/**
 * Admin-only executive "Resumo de Negócio" card with interactive native Compose Canvas charts:
 * 1) Evolução de Mensalidades Recebidas (Area + Line curve)
 * 2) Novos Alunos por Mês (Stacked Bars: Grupo + Personalizado)
 * 3) Taxa de Fidelização (Multi-segment Donut + Breakdown)
 */
@Composable
fun BusinessSummaryCard(
    clients: List<ClientRecord>,
    payments: List<PaymentRecord>,
    fidelizacoes: List<FidelizacaoRecord>,
    bookings: List<BookingRecord>,
    isSuperAdmin: Boolean,
    onJumpToFinance: () -> Unit = {},
    onJumpToFidelizacoes: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (!isSuperAdmin) return

    var periodMonths by remember { mutableIntStateOf(6) }
    var selectedChartTab by remember { mutableIntStateOf(0) } // 0=Mensalidades, 1=Novos, 2=Fidelização
    var expanded by remember { mutableStateOf(true) }

    val analytics = remember(clients, payments, fidelizacoes, bookings, periodMonths) {
        val cal = Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, 1) }
        val monthDefs = ((periodMonths - 1) downTo 0).map { offset ->
            val c = (cal.clone() as Calendar).apply { add(Calendar.MONTH, -offset) }
            val y = c.get(Calendar.YEAR)
            val mIdx = c.get(Calendar.MONTH)
            val key = String.format(Locale.US, "%04d-%02d", y, mIdx + 1)
            val shortLbl = BIZ_MONTH_SHORT[mIdx]
            val fullLbl = "${BIZ_MONTH_FULL[mIdx]} $y"
            Triple(key, shortLbl, fullLbl)
        }
        val currentMonthYear = monthDefs.lastOrNull()?.first.orEmpty()
        val prevMonthYear = monthDefs.getOrNull(monthDefs.lastIndex - 1)?.first.orEmpty()
        val clientMap = clients.associateBy { it.id }

        val mensalMap = mutableMapOf<String, Double>()
        val extraMap = mutableMapOf<String, Double>()
        val persMap = mutableMapOf<String, Double>()
        val grpMap = mutableMapOf<String, Double>()
        val payersMap = mutableMapOf<String, MutableSet<String>>()

        var futurePrepaid = 0.0
        payments.filter { it.paid && it.monthYear.isNotBlank() }.forEach { p ->
            if (currentMonthYear.isNotBlank() && p.monthYear > currentMonthYear) {
                futurePrepaid += p.amountEur
            } else {
                val extra = SeedCatalog.isExtraFeePayment(p.note)
                val isPers = clientMap[p.clientId]?.trainingType == "PERSONALIZADO"
                if (extra) {
                    extraMap[p.monthYear] = (extraMap[p.monthYear] ?: 0.0) + p.amountEur
                } else {
                    mensalMap[p.monthYear] = (mensalMap[p.monthYear] ?: 0.0) + p.amountEur
                    if (isPers) {
                        persMap[p.monthYear] = (persMap[p.monthYear] ?: 0.0) + p.amountEur
                    } else {
                        grpMap[p.monthYear] = (grpMap[p.monthYear] ?: 0.0) + p.amountEur
                    }
                    if (p.clientId.isNotBlank()) {
                        payersMap.getOrPut(p.monthYear) { mutableSetOf() }.add(p.clientId)
                    }
                }
            }
        }

        val earliestFidByClient = mutableMapOf<String, Long>()
        fidelizacoes.forEach { f ->
            if (f.startDateMillis > 0L) {
                val cur = earliestFidByClient[f.clientId]
                if (cur == null || f.startDateMillis < cur) earliestFidByClient[f.clientId] = f.startDateMillis
            }
        }
        val earliestPayByClient = mutableMapOf<String, String>()
        payments.forEach { p ->
            if (p.paid && p.monthYear.isNotBlank()) {
                val cur = earliestPayByClient[p.clientId]
                if (cur == null || p.monthYear < cur) earliestPayByClient[p.clientId] = p.monthYear
            }
        }
        val earliestBookingByClient = mutableMapOf<String, Long>()
        bookings.forEach { b ->
            if (b.requestedAtMillis > 0L) {
                val cur = earliestBookingByClient[b.clientId]
                if (cur == null || b.requestedAtMillis < cur) earliestBookingByClient[b.clientId] = b.requestedAtMillis
            }
        }

        val newGrpMap = mutableMapOf<String, Int>()
        val newPersMap = mutableMapOf<String, Int>()
        val newNamesMap = mutableMapOf<String, MutableList<String>>()

        clients.forEach { c ->
            val createdMs = c.createdAt?.toDate()?.time ?: 0L
            val joinYm = when {
                createdMs > 0L -> millisToMonthYear(createdMs)
                c.fidelizacaoStartMillis > 0L -> {
                    val fidMs = earliestFidByClient[c.id]?.let { minOf(it, c.fidelizacaoStartMillis) }
                        ?: c.fidelizacaoStartMillis
                    millisToMonthYear(fidMs)
                }
                earliestFidByClient[c.id] != null -> millisToMonthYear(earliestFidByClient[c.id]!!)
                earliestPayByClient[c.id] != null -> earliestPayByClient[c.id]!!
                earliestBookingByClient[c.id] != null -> millisToMonthYear(earliestBookingByClient[c.id]!!)
                else -> ""
            }
            if (joinYm.isNotBlank()) {
                if (c.trainingType == "PERSONALIZADO") {
                    newPersMap[joinYm] = (newPersMap[joinYm] ?: 0) + 1
                } else {
                    newGrpMap[joinYm] = (newGrpMap[joinYm] ?: 0) + 1
                }
                newNamesMap.getOrPut(joinYm) { mutableListOf() }.add(c.name)
            }
        }

        val buckets = monthDefs.map { (key, shortLbl, fullLbl) ->
            BizMonthBucket(
                monthYear = key,
                shortLabel = shortLbl,
                fullLabel = fullLbl,
                mensalidadesEur = mensalMap[key] ?: 0.0,
                extrasEur = extraMap[key] ?: 0.0,
                personalizadoEur = persMap[key] ?: 0.0,
                grupoEur = grpMap[key] ?: 0.0,
                payingStudents = payersMap[key]?.size ?: 0,
                newGrupoCount = newGrpMap[key] ?: 0,
                newPersonalizadoCount = newPersMap[key] ?: 0,
                newClientNames = newNamesMap[key].orEmpty()
            )
        }

        val totalMensal = buckets.sumOf { it.mensalidadesEur }
        val totalExtras = buckets.sumOf { it.extrasEur }
        val curMensal = buckets.lastOrNull { it.monthYear == currentMonthYear }?.mensalidadesEur ?: 0.0
        val prevMensal = buckets.firstOrNull { it.monthYear == prevMonthYear }?.mensalidadesEur ?: 0.0
        val revDeltaPct = if (prevMensal > 0.0) {
            kotlin.math.round(((curMensal - prevMensal) / prevMensal) * 100.0).toInt()
        } else null

        val activeClients = clients.filter { it.active }
        val activeCount = activeClients.size
        val totalCount = clients.size
        val activeRetPct = if (totalCount > 0) ((activeCount * 100.0) / totalCount).toInt() else 0

        var c12 = 0
        var c6 = 0
        var cMensal = 0
        var persFid = 0
        var persTot = 0
        var grpFid = 0
        var grpTot = 0

        activeClients.forEach { c ->
            val eff = SeedCatalog.getEffectiveClientFidelizacaoMonths(c, fidelizacoes)
            when (eff) {
                12 -> c12++
                6 -> c6++
                else -> cMensal++
            }
            val hasFid = eff >= 6
            if (c.trainingType == "PERSONALIZADO") {
                persTot++
                if (hasFid) persFid++
            } else {
                grpTot++
                if (hasFid) grpFid++
            }
        }
        val fidelized = c12 + c6
        val loyaltyPct = if (activeCount > 0) kotlin.math.round((fidelized * 100.0) / activeCount).toInt() else 0

        val now = System.currentTimeMillis()
        val expiringSoon = fidelizacoes.count { f ->
            val d = ((f.endDateMillis - now) / 86_400_000L).toInt()
            d in 0..30
        }

        val slices = listOf(
            LoyaltySlice(
                key = "12m",
                label = "Fidelização 12 meses",
                count = c12,
                pct = if (activeCount > 0) kotlin.math.round((c12 * 100.0) / activeCount).toInt() else 0,
                color = NewShapeGold
            ),
            LoyaltySlice(
                key = "6m",
                label = "Fidelização 6 meses",
                count = c6,
                pct = if (activeCount > 0) kotlin.math.round((c6 * 100.0) / activeCount).toInt() else 0,
                color = InfoBlue
            ),
            LoyaltySlice(
                key = "mensal",
                label = "Sem fidelização (Mensal)",
                count = cMensal,
                pct = if (activeCount > 0) kotlin.math.round((cMensal * 100.0) / activeCount).toInt() else 0,
                color = HairlineBorder
            )
        )

        BusinessSummaryAnalytics(
            buckets = buckets,
            currentMonthMensalidades = curMensal,
            avgMonthlyMensalidades = totalMensal / periodMonths.coerceAtLeast(1),
            totalMensalidadesWindow = totalMensal,
            totalExtrasWindow = totalExtras,
            futurePrepaidEur = futurePrepaid,
            revenueDeltaPct = revDeltaPct,
            totalNewStudentsWindow = buckets.sumOf { it.totalNewStudents },
            currentMonthNewStudents = buckets.lastOrNull()?.totalNewStudents ?: 0,
            activeClientsCount = activeCount,
            totalClientsCount = totalCount,
            activeRetentionPct = activeRetPct,
            fidelizedCount = fidelized,
            loyaltyRatePct = loyaltyPct,
            expiringSoonCount = expiringSoon,
            loyaltySlices = slices,
            grupoLoyaltyPct = if (grpTot > 0) kotlin.math.round((grpFid * 100.0) / grpTot).toInt() else 0,
            persLoyaltyPct = if (persTot > 0) kotlin.math.round((persFid * 100.0) / persTot).toInt() else 0,
            grupoTotal = grpTot,
            persTotal = persTot
        )
    }

    var selectedMonthIndex by remember(analytics.buckets, selectedChartTab) {
        val lastIdx = when (selectedChartTab) {
            0 -> analytics.buckets.indexOfLast { it.mensalidadesEur > 0.0 }
            1 -> analytics.buckets.indexOfLast { it.totalNewStudents > 0 }
            else -> analytics.buckets.lastIndex
        }
        mutableIntStateOf(if (lastIdx >= 0) lastIdx else analytics.buckets.lastIndex.coerceAtLeast(0))
    }

    BrandCard(
        highlightBorder = true,
        modifier = modifier.testTag("business_summary_card")
    ) {
        // Header Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Surface(
                    color = NewShapeGoldMuted,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.45f))
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                        contentDescription = "Resumo de Negócio",
                        tint = NewShapeGoldBright,
                        modifier = Modifier.padding(8.dp).size(18.dp)
                    )
                }
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Resumo de Negócio",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                        StatusPill(
                            text = "Admin",
                            textColor = NewShapeGoldBright,
                            containerColor = NewShapeGoldMuted
                        )
                    }
                    Text(
                        text = "Mensalidades, novos alunos e fidelização",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }

            IconButton(
                onClick = { expanded = !expanded },
                modifier = Modifier
                    .size(48.dp)
                    .testTag("business_summary_toggle_btn")
            ) {
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Minimizar resumo de negócio" else "Expandir resumo de negócio",
                    tint = NewShapeGoldBright
                )
            }
        }

        Spacer(Modifier.height(10.dp))

        // 3 KPI Summary Pills
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            BizKpiTile(
                title = "Mês Atual",
                value = "€${analytics.currentMonthMensalidades.toInt()}",
                sub = analytics.revenueDeltaPct?.let { d ->
                    "${if (d >= 0) "+" else ""}$d% vs ant."
                } ?: "Média €${analytics.avgMonthlyMensalidades.toInt()}",
                accent = NewShapeGoldBright,
                selected = expanded && selectedChartTab == 0,
                onClick = {
                    expanded = true
                    selectedChartTab = 0
                },
                modifier = Modifier.weight(1f).testTag("biz_kpi_revenue")
            )
            BizKpiTile(
                title = "Novos (${periodMonths}m)",
                value = "+${analytics.totalNewStudentsWindow}",
                sub = "+${analytics.currentMonthNewStudents} este mês",
                accent = ConfirmedGreen,
                selected = expanded && selectedChartTab == 1,
                onClick = {
                    expanded = true
                    selectedChartTab = 1
                },
                modifier = Modifier.weight(1f).testTag("biz_kpi_students")
            )
            BizKpiTile(
                title = "Fidelização",
                value = "${analytics.loyaltyRatePct}%",
                sub = "${analytics.fidelizedCount}/${analytics.activeClientsCount} ativos",
                accent = InfoBlue,
                selected = expanded && selectedChartTab == 2,
                onClick = {
                    expanded = true
                    selectedChartTab = 2
                },
                modifier = Modifier.weight(1f).testTag("biz_kpi_loyalty")
            )
        }

        AnimatedVisibility(visible = expanded) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Spacer(Modifier.height(12.dp))

                // Chart switcher + 6M/12M toggle
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("Mensalidades", "Novos", "Fidelização").forEachIndexed { idx, label ->
                            FilterChip(
                                selected = selectedChartTab == idx,
                                onClick = { selectedChartTab = idx },
                                label = {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = NewShapeGold,
                                    selectedLabelColor = TextOnGold,
                                    containerColor = ElevatedCharcoal,
                                    labelColor = TextSecondaryDark
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = selectedChartTab == idx,
                                    borderColor = HairlineBorder,
                                    selectedBorderColor = NewShapeGold
                                ),
                                modifier = Modifier.testTag("biz_chart_tab_$idx")
                            )
                        }
                    }

                    if (selectedChartTab != 2) {
                        Surface(
                            color = ObsidianBg,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, HairlineBorder)
                        ) {
                            Row(modifier = Modifier.padding(2.dp)) {
                                listOf(6, 12).forEach { months ->
                                    val isSel = periodMonths == months
                                    Surface(
                                        color = if (isSel) NewShapeGold else Color.Transparent,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .clickable { periodMonths = months }
                                            .testTag("biz_period_${months}m")
                                    ) {
                                        Text(
                                            text = "${months}M",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isSel) TextOnGold else TextSecondaryDark,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))

                when (selectedChartTab) {
                    0 -> RevenueEvolutionChartSection(
                        analytics = analytics,
                        periodMonths = periodMonths,
                        selectedIndex = selectedMonthIndex,
                        onSelectIndex = { selectedMonthIndex = it },
                        onJumpToFinance = onJumpToFinance
                    )
                    1 -> NewStudentsChartSection(
                        analytics = analytics,
                        periodMonths = periodMonths,
                        selectedIndex = selectedMonthIndex,
                        onSelectIndex = { selectedMonthIndex = it }
                    )
                    2 -> LoyaltyRateChartSection(
                        analytics = analytics,
                        onJumpToFidelizacoes = onJumpToFidelizacoes
                    )
                }
            }
        }
    }
}

@Composable
private fun BizKpiTile(
    title: String,
    value: String,
    sub: String,
    accent: Color,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (selected) accent.copy(alpha = 0.14f) else ElevatedCharcoal,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (selected) accent else HairlineBorder),
        modifier = modifier
            .heightIn(min = 72.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = accent,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimaryDark,
                maxLines = 1
            )
            Text(
                text = sub,
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondaryDark,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun RevenueEvolutionChartSection(
    analytics: BusinessSummaryAnalytics,
    periodMonths: Int,
    selectedIndex: Int,
    onSelectIndex: (Int) -> Unit,
    onJumpToFinance: () -> Unit
) {
    val buckets = analytics.buckets
    val safeIdx = selectedIndex.coerceIn(0, (buckets.lastIndex).coerceAtLeast(0))
    val selected = buckets.getOrNull(safeIdx)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Total ${periodMonths}m: €${String.format(Locale.US, "%.0f", analytics.totalMensalidadesWindow)}",
                style = MaterialTheme.typography.labelMedium,
                color = NewShapeGoldBright,
                fontWeight = FontWeight.Bold
            )
            TextButton(
                onClick = onJumpToFinance,
                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                modifier = Modifier.testTag("biz_jump_finance_btn")
            ) {
                Text(
                    text = "Abrir Finanças →",
                    style = MaterialTheme.typography.labelSmall,
                    color = NewShapeGoldBright,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (analytics.totalMensalidadesWindow <= 0.0) {
            ChartEmptyPlaceholder(
                title = "Sem mensalidades recebidas neste período",
                subtitle = "Assim que registares pagamentos, a evolução aparece aqui."
            )
            return
        }

        val maxVal = remember(buckets) {
            buckets.maxOf { it.mensalidadesEur }.coerceAtLeast(10.0)
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(152.dp)
        ) {
            val topPad = 14.dp.toPx()
            val bottomPad = 8.dp.toPx()
            val leftPad = 8.dp.toPx()
            val rightPad = 8.dp.toPx()
            val usableW = (size.width - leftPad - rightPad).coerceAtLeast(1f)
            val usableH = (size.height - topPad - bottomPad).coerceAtLeast(1f)
            val dash = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)

            for (step in 0..3) {
                val y = topPad + usableH * (step / 3f)
                drawLine(
                    color = HairlineBorder.copy(alpha = 0.6f),
                    start = Offset(leftPad, y),
                    end = Offset(size.width - rightPad, y),
                    strokeWidth = 1.dp.toPx(),
                    pathEffect = if (step < 3) dash else null
                )
            }

            // Average dashed reference line
            if (analytics.avgMonthlyMensalidades > 0.0) {
                val avgY = topPad + usableH * (1f - (analytics.avgMonthlyMensalidades / maxVal).toFloat().coerceIn(0f, 1f))
                drawLine(
                    color = InfoBlue.copy(alpha = 0.7f),
                    start = Offset(leftPad, avgY),
                    end = Offset(size.width - rightPad, avgY),
                    strokeWidth = 1.3.dp.toPx(),
                    pathEffect = dash
                )
            }

            val count = buckets.size.coerceAtLeast(1)
            val stepX = if (count > 1) usableW / (count - 1) else 0f
            val points = buckets.mapIndexed { idx, b ->
                val x = leftPad + idx * stepX
                val ratio = (b.mensalidadesEur / maxVal).toFloat().coerceIn(0f, 1f)
                val y = topPad + usableH * (1f - ratio)
                Offset(x, y)
            }

            if (points.size >= 2) {
                val linePath = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    for (i in 1 until points.size) {
                        val prev = points[i - 1]
                        val curr = points[i]
                        val midX = (prev.x + curr.x) / 2f
                        cubicTo(midX, prev.y, midX, curr.y, curr.x, curr.y)
                    }
                }
                val areaPath = Path().apply {
                    addPath(linePath)
                    lineTo(points.last().x, topPad + usableH)
                    lineTo(points.first().x, topPad + usableH)
                    close()
                }
                drawPath(
                    path = areaPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(NewShapeGold.copy(alpha = 0.38f), Color.Transparent),
                        startY = topPad,
                        endY = topPad + usableH
                    )
                )
                drawPath(
                    path = linePath,
                    color = NewShapeGold,
                    style = Stroke(width = 2.6.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            points.forEachIndexed { idx, pt ->
                val isSel = idx == safeIdx
                if (isSel) {
                    drawLine(
                        color = NewShapeGold.copy(alpha = 0.35f),
                        start = Offset(pt.x, topPad),
                        end = Offset(pt.x, topPad + usableH),
                        strokeWidth = 1.dp.toPx()
                    )
                }
                drawCircle(
                    color = if (isSel) NewShapeGoldBright else NewShapeGold,
                    radius = if (isSel) 5.5.dp.toPx() else 3.5.dp.toPx(),
                    center = pt
                )
                drawCircle(
                    color = ObsidianBg,
                    radius = if (isSel) 2.2.dp.toPx() else 1.4.dp.toPx(),
                    center = pt
                )
            }
        }

        MonthSelectorStrip(
            buckets = buckets,
            selectedIndex = safeIdx,
            valueFormatter = { b -> if (b.mensalidadesEur > 0.0) "€${b.mensalidadesEur.toInt()}" else "—" },
            accent = NewShapeGoldBright,
            onSelect = onSelectIndex
        )

        selected?.let { b ->
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
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = b.fullLabel,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = NewShapeGoldBright
                        )
                        Text(
                            text = "€${String.format(Locale.US, "%.2f", b.mensalidadesEur)}",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Person.: €${String.format(Locale.US, "%.0f", b.personalizadoEur)} · Grupo: €${String.format(Locale.US, "%.0f", b.grupoEur)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                        Text(
                            text = "${b.payingStudents} pagante(s)",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextPrimaryDark,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    if (b.extrasEur > 0.0) {
                        Text(
                            text = "Extras (Seguro/Jóia): +€${String.format(Locale.US, "%.2f", b.extrasEur)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = InfoBlue
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NewStudentsChartSection(
    analytics: BusinessSummaryAnalytics,
    periodMonths: Int,
    selectedIndex: Int,
    onSelectIndex: (Int) -> Unit
) {
    val buckets = analytics.buckets
    val safeIdx = selectedIndex.coerceIn(0, (buckets.lastIndex).coerceAtLeast(0))
    val selected = buckets.getOrNull(safeIdx)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "+${analytics.totalNewStudentsWindow} aluno(s) nos últimos ${periodMonths}m",
                style = MaterialTheme.typography.labelMedium,
                color = ConfirmedGreen,
                fontWeight = FontWeight.Bold
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LegendDotLabel("Grupo", ConfirmedGreen)
                LegendDotLabel("Person.", NewShapeGold)
            }
        }

        if (analytics.totalNewStudentsWindow <= 0) {
            ChartEmptyPlaceholder(
                title = "Sem novos alunos neste período",
                subtitle = "Novas inscrições aparecem agrupadas automaticamente por mês."
            )
            return
        }

        val maxCount = remember(buckets) {
            buckets.maxOf { it.totalNewStudents }.coerceAtLeast(1)
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(148.dp)
        ) {
            val slotCount = buckets.size.coerceAtLeast(1)
            val slotW = size.width / slotCount
            val barW = (slotW * 0.56f).coerceIn(8.dp.toPx(), 26.dp.toPx())
            val topPad = 10.dp.toPx()
            val usableH = (size.height - topPad).coerceAtLeast(1f)
            val dash = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)

            for (step in 0..3) {
                val y = topPad + usableH * (step / 3f)
                drawLine(
                    color = HairlineBorder.copy(alpha = 0.6f),
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1.dp.toPx(),
                    pathEffect = if (step < 3) dash else null
                )
            }

            buckets.forEachIndexed { idx, b ->
                val slotLeft = idx * slotW
                if (idx == safeIdx) {
                    drawRoundRect(
                        color = ConfirmedGreen.copy(alpha = 0.12f),
                        topLeft = Offset(slotLeft + 2.dp.toPx(), 0f),
                        size = Size((slotW - 4.dp.toPx()).coerceAtLeast(1f), size.height),
                        cornerRadius = CornerRadius(10.dp.toPx(), 10.dp.toPx())
                    )
                }

                val barLeft = slotLeft + (slotW - barW) / 2f
                val totalH = if (b.totalNewStudents > 0) {
                    ((b.totalNewStudents.toFloat() / maxCount.toFloat()).coerceIn(0.10f, 1f)) * usableH
                } else {
                    3.dp.toPx()
                }

                if (b.totalNewStudents == 0) {
                    drawRoundRect(
                        color = HairlineBorder,
                        topLeft = Offset(barLeft, size.height - totalH),
                        size = Size(barW, totalH),
                        cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                    )
                } else {
                    val grpH = totalH * (b.newGrupoCount.toFloat() / b.totalNewStudents.toFloat())
                    val persH = totalH - grpH
                    if (grpH > 0f) {
                        drawRoundRect(
                            color = ConfirmedGreen,
                            topLeft = Offset(barLeft, size.height - grpH),
                            size = Size(barW, grpH),
                            cornerRadius = CornerRadius(if (persH <= 0f) 5.dp.toPx() else 2.dp.toPx(), if (persH <= 0f) 5.dp.toPx() else 2.dp.toPx())
                        )
                    }
                    if (persH > 0f) {
                        drawRoundRect(
                            color = NewShapeGold,
                            topLeft = Offset(barLeft, size.height - totalH),
                            size = Size(barW, persH),
                            cornerRadius = CornerRadius(5.dp.toPx(), 5.dp.toPx())
                        )
                    }
                }
            }
        }

        MonthSelectorStrip(
            buckets = buckets,
            selectedIndex = safeIdx,
            valueFormatter = { b -> if (b.totalNewStudents > 0) "+${b.totalNewStudents}" else "0" },
            accent = ConfirmedGreen,
            onSelect = onSelectIndex
        )

        selected?.let { b ->
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, ConfirmedGreen.copy(alpha = 0.45f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = b.fullLabel,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = ConfirmedGreen
                        )
                        Text(
                            text = "${b.totalNewStudents} novo(s)",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                    }
                    Text(
                        text = "Grupo: ${b.newGrupoCount} · Personalizado: ${b.newPersonalizadoCount}",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                    if (b.newClientNames.isNotEmpty()) {
                        val preview = b.newClientNames.take(4).joinToString(", ") +
                            if (b.newClientNames.size > 4) " +${b.newClientNames.size - 4}" else ""
                        Text(
                            text = "Entradas: $preview",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextPrimaryDark
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LoyaltyRateChartSection(
    analytics: BusinessSummaryAnalytics,
    onJumpToFidelizacoes: () -> Unit
) {
    if (analytics.activeClientsCount == 0) {
        ChartEmptyPlaceholder(
            title = "Sem alunos ativos registados",
            subtitle = "Adiciona alunos para calcular a taxa de fidelização."
        )
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Donut Chart Canvas
            Box(
                modifier = Modifier.size(126.dp),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                    val strokeW = 16.dp.toPx()
                    val diameter = size.minDimension
                    val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
                    val arcSize = Size(diameter, diameter)

                    // Track background
                    drawArc(
                        color = ElevatedCharcoal,
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokeW)
                    )

                    val activeSlices = analytics.loyaltySlices.filter { it.count > 0 }
                    val gapAngle = if (activeSlices.size > 1) 4f else 0f
                    var startAngle = -90f
                    activeSlices.forEach { slice ->
                        val rawSweep = (slice.count.toFloat() / analytics.activeClientsCount.toFloat()) * 360f
                        val sweep = (rawSweep - gapAngle).coerceAtLeast(2f)
                        drawArc(
                            color = slice.color,
                            startAngle = startAngle,
                            sweepAngle = sweep,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokeW, cap = StrokeCap.Butt)
                        )
                        startAngle += rawSweep
                    }
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${analytics.loyaltyRatePct}%",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "Fidelizados",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
            }

            // Breakdown Progress Bars
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                analytics.loyaltySlices.forEach { s ->
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            LegendDotLabel(s.label, s.color)
                            Text(
                                text = "${s.count} (${s.pct}%)",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                        }
                        LinearProgressIndicator(
                            progress = { (s.pct / 100f).coerceIn(0f, 1f) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = s.color,
                            trackColor = ElevatedCharcoal
                        )
                    }
                }
            }
        }

        // Bottom metrics + Jump CTA
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("Ativos / Total", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    Text(
                        "${analytics.activeRetentionPct}% (${analytics.activeClientsCount}/${analytics.totalClientsCount})",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = ConfirmedGreen
                    )
                }
            }
            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("Grupo · Person.", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    Text(
                        "${if (analytics.grupoTotal > 0) "${analytics.grupoLoyaltyPct}%" else "—"} · ${if (analytics.persTotal > 0) "${analytics.persLoyaltyPct}%" else "—"}",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = NewShapeGoldBright
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (analytics.expiringSoonCount > 0) {
                StatusPill(
                    text = "${analytics.expiringSoonCount} a terminar ≤30d",
                    textColor = NewShapeGoldBright,
                    containerColor = PendingAmberContainer
                )
            } else {
                Spacer(Modifier.width(1.dp))
            }
            TextButton(
                onClick = onJumpToFidelizacoes,
                modifier = Modifier.testTag("biz_jump_fidelizacoes_btn")
            ) {
                Text(
                    text = "Gerir Fidelizações →",
                    style = MaterialTheme.typography.labelSmall,
                    color = InfoBlue,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun MonthSelectorStrip(
    buckets: List<BizMonthBucket>,
    selectedIndex: Int,
    valueFormatter: (BizMonthBucket) -> String,
    accent: Color,
    onSelect: (Int) -> Unit
) {
    // Show compact interactive buttons; for 12M show every label cleanly with horizontal weight
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        buckets.forEachIndexed { idx, bucket ->
            val isSel = idx == selectedIndex
            Surface(
                color = if (isSel) accent.copy(alpha = 0.16f) else Color.Transparent,
                shape = RoundedCornerShape(8.dp),
                border = if (isSel) BorderStroke(1.dp, accent) else null,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onSelect(idx) }
                    .testTag("biz_month_${bucket.monthYear}")
            ) {
                Column(
                    modifier = Modifier.padding(vertical = 4.dp, horizontal = 1.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = if (buckets.size > 6) bucket.shortLabel.take(1) else bucket.shortLabel,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (isSel) FontWeight.ExtraBold else FontWeight.Medium,
                        color = if (isSel) accent else TextSecondaryDark,
                        maxLines = 1
                    )
                    if (buckets.size <= 6) {
                        Text(
                            text = valueFormatter(bucket),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSel) TextPrimaryDark else TextSecondaryDark,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LegendDotLabel(label: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondaryDark,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun ChartEmptyPlaceholder(
    title: String,
    subtitle: String
) {
    Surface(
        color = ElevatedCharcoal,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Insights,
                contentDescription = title,
                tint = NewShapeGold,
                modifier = Modifier.size(22.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = TextPrimaryDark
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondaryDark
            )
        }
    }
}
