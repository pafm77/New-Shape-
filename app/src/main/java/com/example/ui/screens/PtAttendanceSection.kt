package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.ClientRecord
import com.example.data.model.TrainingSessionRecord
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

private const val ATTENDANCE_DAY_MS = 86_400_000L

data class StudentAttendanceRow(
    val client: ClientRecord,
    val scheduledCount: Int,
    val presentCount: Int,
    val absentCount: Int,
    val attendanceRatePct: Int?,
    val lastWorkoutMillis: Long?,
    val daysSinceLastWorkout: Int?,
    val hasUpcomingBooking: Boolean,
    val isInactive: Boolean
)

fun countInactiveActiveStudents(
    clients: List<ClientRecord>,
    sessions: List<TrainingSessionRecord>,
    bookings: List<BookingRecord>,
    thresholdDays: Int = 7
): Int {
    val now = System.currentTimeMillis()
    val sessionMap = sessions.associateBy { it.id }
    val lastWorkout = mutableMapOf<String, Long>()
    bookings.forEach { b ->
        if (b.status != BookingStatus.CONFIRMED.name) return@forEach
        if (b.attendanceStatus == "ABSENT") return@forEach
        val s = sessionMap[b.sessionId] ?: return@forEach
        if (s.startMillis <= now) {
            val prev = lastWorkout[b.clientId] ?: 0L
            if (s.startMillis > prev) lastWorkout[b.clientId] = s.startMillis
        }
    }
    return clients
        .filter { it.active }
        .count { c ->
            val last = lastWorkout[c.id]
            if (last == null) true
            else ((now - last) / ATTENDANCE_DAY_MS).toInt() >= thresholdDays
        }
}

@Composable
fun PtAttendanceSection(state: StudioUiState) {
    val context = LocalContext.current
    var periodDays by remember { mutableIntStateOf(30) } // 7 or 30
    var inactivityThreshold by remember { mutableIntStateOf(7) } // 7, 10, 14
    var filterMode by remember { mutableStateOf("ALL") } // ALL, INACTIVE, ABSENCES
    var searchQuery by remember { mutableStateOf("") }

    val summary = remember(state.clients, state.sessions, state.bookings, periodDays, inactivityThreshold) {
        val now = System.currentTimeMillis()
        val periodStart = now - periodDays * ATTENDANCE_DAY_MS
        val sessionMap = state.sessions.associateBy { it.id }
        val activeClients = state.clients.filter { it.active }.sortedBy { it.name.lowercase() }

        val lastWorkoutByClient = mutableMapOf<String, Long>()
        val upcomingClients = mutableSetOf<String>()
        val periodBookingsByClient = mutableMapOf<String, MutableList<BookingRecord>>()

        state.bookings.forEach { b ->
            if (b.status != BookingStatus.CONFIRMED.name) return@forEach
            val s = sessionMap[b.sessionId] ?: return@forEach
            if (s.startMillis > now) {
                upcomingClients.add(b.clientId)
            } else if (b.attendanceStatus != "ABSENT") {
                val prev = lastWorkoutByClient[b.clientId] ?: 0L
                if (s.startMillis > prev) lastWorkoutByClient[b.clientId] = s.startMillis
            }
            if (s.startMillis in periodStart..now) {
                periodBookingsByClient.getOrPut(b.clientId) { mutableListOf() }.add(b)
            }
        }

        var sumPresent = 0
        var sumAbsent = 0
        val rows = activeClients.map { client ->
            val pBookings = periodBookingsByClient[client.id].orEmpty()
            val scheduled = pBookings.size
            val present = pBookings.count { it.attendanceStatus == "PRESENT" }
            val absent = pBookings.count { it.attendanceStatus == "ABSENT" }
            val marked = present + absent
            val ratePct = when {
                marked > 0 -> ((present * 100.0) / marked).toInt()
                scheduled > 0 -> 100
                else -> null
            }
            sumPresent += present
            sumAbsent += absent

            val lastMs = lastWorkoutByClient[client.id]
            val daysSince = lastMs?.let { ((now - it) / ATTENDANCE_DAY_MS).toInt().coerceAtLeast(0) }
            val isInactive = daysSince == null || daysSince >= inactivityThreshold

            StudentAttendanceRow(
                client = client,
                scheduledCount = scheduled,
                presentCount = present,
                absentCount = absent,
                attendanceRatePct = ratePct,
                lastWorkoutMillis = lastMs,
                daysSinceLastWorkout = daysSince,
                hasUpcomingBooking = client.id in upcomingClients,
                isInactive = isInactive
            )
        }

        val totalMarked = sumPresent + sumAbsent
        val avgRate = when {
            totalMarked > 0 -> ((sumPresent * 100.0) / totalMarked).toInt()
            rows.any { it.scheduledCount > 0 } -> 100
            else -> null
        }
        val inactiveList = rows.filter { it.isInactive }.sortedWith(
            compareByDescending<StudentAttendanceRow> { it.daysSinceLastWorkout ?: -1 }
                .thenBy { it.client.name.lowercase() }
        )

        AttendanceSummaryData(rows, inactiveList, avgRate, sumPresent, sumAbsent)
    }

    val filteredRows = remember(summary.rows, filterMode, searchQuery) {
        val q = searchQuery.trim().lowercase()
        summary.rows
            .filter { r ->
                when (filterMode) {
                    "INACTIVE" -> r.isInactive
                    "ABSENCES" -> r.absentCount > 0
                    else -> true
                }
            }
            .filter { r ->
                if (q.isEmpty()) true
                else "${r.client.name} ${r.client.phone}".lowercase().contains(q)
            }
            .sortedWith(
                compareByDescending<StudentAttendanceRow> { it.isInactive }
                    .thenByDescending { it.scheduledCount }
            )
    }

    fun checkInMessage(row: StudentAttendanceRow): String {
        val firstName = row.client.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { row.client.name }
        return if (row.daysSinceLastWorkout != null) {
            "Olá $firstName! Já faz ${row.daysSinceLastWorkout} dias desde o teu último treino na New Shape 💪 Está tudo bem contigo? Quando voltamos a treinar?"
        } else {
            "Olá $firstName! Sentimos a tua falta na New Shape 💪 Vamos agendar o teu próximo treino esta semana?"
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Assiduidade & Inatividade", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                Text(
                    "Resumo semanal e mensal de presenças, faltas e alunos inativos",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = periodDays == 7,
                        onClick = { periodDays = 7 },
                        label = { Text("Últimos 7 dias", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.testTag("attendance_period_week"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                    FilterChip(
                        selected = periodDays == 30,
                        onClick = { periodDays = 30 },
                        label = { Text("Últimos 30 dias", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.testTag("attendance_period_month"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
            }
        }

        // KPI Row
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    AttendanceStatTile(
                        label = "Taxa Média",
                        value = summary.avgRatePct?.let { "$it%" } ?: "—",
                        accent = NewShapeGoldBright,
                        modifier = Modifier.weight(1f)
                    )
                    AttendanceStatTile(
                        label = "Inativos (≥${inactivityThreshold}d)",
                        value = summary.inactiveRows.size.toString(),
                        accent = if (summary.inactiveRows.isNotEmpty()) PendingAmber else ConfirmedGreen,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    AttendanceStatTile(
                        label = "Presenças",
                        value = summary.totalPresent.toString(),
                        accent = ConfirmedGreen,
                        modifier = Modifier.weight(1f)
                    )
                    AttendanceStatTile(
                        label = "Faltas",
                        value = summary.totalAbsent.toString(),
                        accent = DangerRed,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Inactivity Alert Card
        item {
            BrandCard(highlightBorder = summary.inactiveRows.isNotEmpty()) {
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
                            imageVector = if (summary.inactiveRows.isNotEmpty()) Icons.Default.WarningAmber else Icons.Default.CheckCircle,
                            contentDescription = "Alerta de inatividade",
                            tint = if (summary.inactiveRows.isNotEmpty()) PendingAmber else ConfirmedGreen,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            "Alerta de Inatividade (${summary.inactiveRows.size})",
                            style = MaterialTheme.typography.titleSmall,
                            color = TextPrimaryDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Avisar após:", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    listOf(7, 10, 14).forEach { days ->
                        FilterChip(
                            selected = inactivityThreshold == days,
                            onClick = { inactivityThreshold = days },
                            label = { Text("${days}d") },
                            modifier = Modifier.testTag("inactivity_threshold_$days"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                if (summary.inactiveRows.isEmpty()) {
                    Text(
                        "Excelente! Todos os alunos ativos treinaram nos últimos $inactivityThreshold dias.",
                        style = MaterialTheme.typography.bodySmall,
                        color = ConfirmedGreen
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        summary.inactiveRows.take(5).forEach { row ->
                            Surface(
                                color = ElevatedCharcoal,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.5f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(row.client.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                        Text(
                                            text = row.daysSinceLastWorkout?.let { "Há $it dias sem treinar" }
                                                ?: "Sem treinos registados",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = PendingAmber
                                        )
                                    }
                                    TextButton(
                                        onClick = {
                                            openWhatsApp(
                                                context,
                                                row.client.phone.ifBlank { null },
                                                checkInMessage(row),
                                                state.settings.whatsappWebMode
                                            )
                                        },
                                        modifier = Modifier.testTag("inactive_wa_${row.client.id}")
                                    ) {
                                        Text("WhatsApp", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                        if (summary.inactiveRows.size > 5) {
                            TextButton(
                                onClick = { filterMode = "INACTIVE" },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text(
                                    "Ver todos os ${summary.inactiveRows.size} inativos ↓",
                                    color = NewShapeGoldBright,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }
            }
        }

        // Search & Filter
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Pesquisar aluno...") },
                    singleLine = true,
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Pesquisar aluno", tint = TextSecondaryDark)
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Limpar pesquisa", tint = TextSecondaryDark)
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("attendance_search_input"),
                    colors = darkFieldColors()
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "ALL" to "Todos (${summary.rows.size})",
                        "INACTIVE" to "Inativos (${summary.inactiveRows.size})",
                        "ABSENCES" to "Com faltas (${summary.rows.count { it.absentCount > 0 }})"
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = filterMode == key,
                            onClick = { filterMode = key },
                            label = { Text(label, fontWeight = FontWeight.Bold) },
                            modifier = Modifier.testTag("attendance_filter_${key.lowercase()}"),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
            }
        }

        if (filteredRows.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.Search,
                    title = "Sem resultados",
                    subtitle = "Nenhum aluno corresponde aos filtros selecionados."
                )
            }
        } else {
            items(filteredRows, key = { it.client.id }) { row ->
                val pct = row.attendanceRatePct
                val rateColor = when {
                    pct == null -> TextSecondaryDark
                    pct >= 80 -> ConfirmedGreen
                    pct >= 55 -> PendingAmber
                    else -> DangerRed
                }
                val rateBg = when {
                    pct == null -> ElevatedCharcoal
                    pct >= 80 -> ConfirmedGreenContainer
                    pct >= 55 -> PendingAmberContainer
                    else -> DangerRedContainer
                }
                BrandCard(highlightBorder = row.isInactive) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(row.client.name, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                            Text(
                                text = row.lastWorkoutMillis?.let { "Último treino: ${formatShortDate(it)}" }
                                    ?: "Sem treinos passados",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        StatusPill(
                            text = pct?.let { "$it%" } ?: "Sem registo",
                            textColor = rateColor,
                            containerColor = rateBg
                        )
                    }
                    if (row.isInactive) {
                        Spacer(Modifier.height(6.dp))
                        StatusPill(
                            text = row.daysSinceLastWorkout?.let { "Há $it dias sem treinar" } ?: "Sem treinos registados",
                            textColor = PendingAmber,
                            containerColor = PendingAmberContainer
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { ((pct ?: 0) / 100f).coerceIn(0f, 1f) },
                        color = rateColor,
                        trackColor = ElevatedCharcoal,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(999.dp))
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Realizados: ${row.scheduledCount} · Presenças: ${row.presentCount} · Faltas: ${row.absentCount}",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(
                            onClick = {
                                openWhatsApp(
                                    context,
                                    row.client.phone.ifBlank { null },
                                    checkInMessage(row),
                                    state.settings.whatsappWebMode
                                )
                            },
                            modifier = Modifier.testTag("attendance_wa_${row.client.id}")
                        ) {
                            Text("Contactar", color = ConfirmedGreen, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

private data class AttendanceSummaryData(
    val rows: List<StudentAttendanceRow>,
    val inactiveRows: List<StudentAttendanceRow>,
    val avgRatePct: Int?,
    val totalPresent: Int,
    val totalAbsent: Int
)

@Composable
private fun AttendanceStatTile(
    label: String,
    value: String,
    accent: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = CharcoalSurface,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = accent)
        }
    }
}
