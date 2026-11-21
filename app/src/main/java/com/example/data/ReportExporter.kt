package com.example.data

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.ClientRecord
import com.example.data.model.PaymentRecord
import com.example.data.model.PhysicalAssessmentRecord
import com.example.data.model.PhysicalCalculations
import com.example.data.model.WorkoutLoadLogRecord
import com.example.data.model.WorkoutPlanItemRecord
import com.example.data.model.WorkoutPlanRecord
import com.example.ui.components.parseNumericLoadKg
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class ExercisePrEntry(
    val exerciseKey: String,
    val exerciseName: String,
    val prKg: Double,
    val prLabel: String,
    val prDateMillis: Long,
    val latestKg: Double,
    val latestLabel: String,
    val entriesCount: Int
)

fun normalizeExercisePrKey(exerciseId: String, exerciseName: String): String {
    val cleanName = exerciseName.trim().lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")
    return cleanName.ifBlank { exerciseId.trim().lowercase(Locale.ROOT) }
}

/**
 * Computes Personal Records (PR) per exercise for a given student combining
 * `workout_load_logs` and current/previous `workout_plan_items`.
 */
fun computeClientExercisePrs(
    clientId: String,
    workoutLoadLogs: List<WorkoutLoadLogRecord>,
    workoutPlans: List<WorkoutPlanRecord>,
    workoutPlanItems: List<WorkoutPlanItemRecord>
): Map<String, ExercisePrEntry> {
    val map = linkedMapOf<String, ExercisePrEntry>()

    fun recordCandidate(
        exerciseId: String,
        exerciseName: String,
        loadLabel: String,
        numericKg: Double,
        dateMillis: Long
    ) {
        if (numericKg <= 0.0) return
        val key = normalizeExercisePrKey(exerciseId, exerciseName)
        if (key.isBlank()) return
        val cleanLabel = loadLabel.trim().ifBlank { formatKgClean(numericKg) }
        val existing = map[key]
        if (existing == null) {
            map[key] = ExercisePrEntry(
                exerciseKey = key,
                exerciseName = exerciseName.trim().ifBlank { "Exercício" },
                prKg = numericKg,
                prLabel = cleanLabel,
                prDateMillis = dateMillis,
                latestKg = numericKg,
                latestLabel = cleanLabel,
                entriesCount = 1
            )
        } else {
            val isNewPr = numericKg > existing.prKg
            map[key] = existing.copy(
                prKg = if (isNewPr) numericKg else existing.prKg,
                prLabel = if (isNewPr) cleanLabel else existing.prLabel,
                prDateMillis = if (isNewPr) dateMillis else existing.prDateMillis,
                latestKg = numericKg,
                latestLabel = cleanLabel,
                entriesCount = existing.entriesCount + 1
            )
        }
    }

    workoutLoadLogs
        .filter { it.clientId == clientId }
        .sortedBy { it.loggedAtMillis }
        .forEach { log ->
            val num = if (log.numericKg > 0.0) log.numericKg else (parseNumericLoadKg(log.loadKg) ?: 0.0)
            recordCandidate(log.exerciseId, log.exerciseName, log.loadKg, num, log.loggedAtMillis)
        }

    val clientPlanIds = workoutPlans.filter { it.clientId == clientId }.map { it.id }.toSet()
    workoutPlanItems
        .filter { it.planId in clientPlanIds }
        .forEach { item ->
            val key = normalizeExercisePrKey(item.exerciseId, item.exerciseName)
            val currentKg = parseNumericLoadKg(item.loadKg) ?: 0.0
            val lastKg = parseNumericLoadKg(item.lastLoadKg) ?: 0.0
            val existing = map[key]
            if (existing == null) {
                if (lastKg > 0.0) {
                    recordCandidate(
                        item.exerciseId,
                        item.exerciseName,
                        item.lastLoadKg,
                        lastKg,
                        item.lastLoggedAtMillis
                    )
                }
                if (currentKg > 0.0) {
                    recordCandidate(
                        item.exerciseId,
                        item.exerciseName,
                        item.loadKg,
                        currentKg,
                        if (item.lastLoggedAtMillis > 0L) item.lastLoggedAtMillis else System.currentTimeMillis()
                    )
                }
            } else if (currentKg > existing.prKg) {
                map[key] = existing.copy(
                    prKg = currentKg,
                    prLabel = item.loadKg.trim().ifBlank { formatKgClean(currentKg) },
                    prDateMillis = if (item.lastLoggedAtMillis > 0L) item.lastLoggedAtMillis else System.currentTimeMillis()
                )
            }
        }

    return map
}

private fun formatKgClean(v: Double): String =
    if (v % 1.0 == 0.0) "${v.toInt()} kg" else String.format(Locale.US, "%.1f kg", v)

enum class AccountingExportPeriod(val label: String, val fileSlug: String) {
    CURRENT_MONTH("Este mês", "mes_atual"),
    LAST_6_MONTHS("Últimos 6 meses", "ultimos_6_meses"),
    ALL("Todo o histórico", "historico_completo")
}

object ReportExporter {

    private fun reportsDir(context: Context): File =
        File(context.cacheDir, "reports").apply { mkdirs() }

    private fun formatDate(millis: Long): String {
        if (millis <= 0L) return "—"
        return SimpleDateFormat("dd/MM/yyyy", Locale("pt", "PT")).format(Date(millis))
    }

    private fun sanitizeFileName(raw: String): String =
        raw.lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9]+"), "_")
            .trim('_')
            .ifBlank { "aluno" }

    private fun shareFile(context: Context, file: File, mimeType: String, chooserTitle: String): Boolean {
        return try {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, chooserTitle)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, chooserTitle).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Generates a branded A4 PDF Evolution Report for a student (Physical Assessments,
     * Attendance Rate, and Exercise Personal Records) and opens the Android share sheet.
     */
    fun shareStudentEvolutionPdf(
        context: Context,
        client: ClientRecord,
        assessments: List<PhysicalAssessmentRecord>,
        bookings: List<BookingRecord>,
        workoutPlans: List<WorkoutPlanRecord>,
        workoutPlanItems: List<WorkoutPlanItemRecord>,
        workoutLoadLogs: List<WorkoutLoadLogRecord>
    ): Boolean {
        val pageWidth = 595
        val pageHeight = 842
        val margin = 36f
        val doc = PdfDocument()
        var pageNum = 1
        var page = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNum).create())
        var canvas: Canvas = page.canvas
        var y = 0f

        val goldColor = Color.parseColor("#EAB308")
        val darkHeaderBg = Color.parseColor("#121214")
        val cardBg = Color.parseColor("#F4F4F5")
        val borderColor = Color.parseColor("#D4D4D8")
        val textDark = Color.parseColor("#18181B")
        val textMuted = Color.parseColor("#52525B")
        val greenColor = Color.parseColor("#16A34A")
        val redColor = Color.parseColor("#DC2626")

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 20f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = goldColor
            textSize = 11f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val sectionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textDark
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textDark
            textSize = 10f
        }
        val bodyBoldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textDark
            textSize = 10f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val mutedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 9f
        }
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = borderColor
            strokeWidth = 1f
        }

        fun ensureSpace(neededHeight: Float) {
            if (y + neededHeight > pageHeight - 48f) {
                doc.finishPage(page)
                pageNum += 1
                page = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNum).create())
                canvas = page.canvas
                y = 42f
            }
        }

        // Branded Dark/Gold Header Banner
        bgPaint.color = darkHeaderBg
        canvas.drawRect(0f, 0f, pageWidth.toFloat(), 96f, bgPaint)
        bgPaint.color = goldColor
        canvas.drawRect(0f, 92f, pageWidth.toFloat(), 96f, bgPaint)

        canvas.drawText("NEW SHAPE STUDIO", margin, 36f, titlePaint)
        canvas.drawText("RELATÓRIO DE EVOLUÇÃO DO ALUNO", margin, 56f, subtitlePaint)
        val dateText = "Emitido em ${formatDate(System.currentTimeMillis())}"
        val headerSubPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#D4D4D8")
            textSize = 9.5f
        }
        canvas.drawText(dateText, margin, 74f, headerSubPaint)

        y = 118f

        // Student Info Card
        val modalityLabel = if (client.trainingType == "PERSONALIZADO") "Treino Personalizado" else "Treino em Grupo"
        val limitLabel = if (client.weeklySessionLimit > 0) "${client.weeklySessionLimit}x / semana" else "Sem limite semanal"
        bgPaint.color = cardBg
        canvas.drawRoundRect(margin, y, pageWidth - margin, y + 54f, 8f, 8f, bgPaint)
        canvas.drawText(client.name, margin + 12f, y + 22f, sectionPaint)
        canvas.drawText(
            "$modalityLabel  ·  Pacote: $limitLabel  ·  Telemóvel: ${client.phone.ifBlank { "—" }}",
            margin + 12f,
            y + 40f,
            mutedPaint
        )
        y += 72f

        // Section 1: Assiduidade
        val confirmedBookings = bookings.filter {
            it.clientId == client.id && it.status == BookingStatus.CONFIRMED.name
        }
        val presentCount = confirmedBookings.count { it.attendanceStatus == "PRESENT" }
        val absentCount = confirmedBookings.count { it.attendanceStatus == "ABSENT" }
        val markedCount = presentCount + absentCount
        val ratePct = if (markedCount > 0) (presentCount * 100.0 / markedCount) else 0.0

        canvas.drawText("1. Assiduidade nos Treinos", margin, y, sectionPaint)
        y += 10f
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 18f

        val attText = if (markedCount > 0) {
            "Taxa de assiduidade: ${String.format(Locale.US, "%.0f%%", ratePct)}   |   Presenças: $presentCount   |   Faltas: $absentCount   |   Total confirmados: ${confirmedBookings.size}"
        } else {
            "Ainda sem presenças/faltas registadas (Total confirmados: ${confirmedBookings.size})."
        }
        canvas.drawText(attText, margin, y, bodyBoldPaint)
        y += 28f

        // Section 2: Avaliações Físicas (Antes vs Depois)
        val clientAssessments = assessments
            .filter { it.clientId == client.id }
            .sortedBy { it.dateMillis }

        canvas.drawText("2. Evolução Física (Avaliações)", margin, y, sectionPaint)
        y += 10f
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 18f

        if (clientAssessments.isEmpty()) {
            canvas.drawText("Sem avaliações físicas registadas para este aluno.", margin, y, mutedPaint)
            y += 24f
        } else {
            val first = clientAssessments.first()
            val latest = clientAssessments.last()

            fun fmtVal(v: Double, suffix: String = ""): String =
                if (v <= 0.0) "—" else String.format(Locale.US, "%.1f%s", v, suffix)

            fun fmtDelta(a: Double, b: Double, suffix: String = ""): String {
                if (a <= 0.0 || b <= 0.0 || clientAssessments.size < 2) return "—"
                val diff = b - a
                val sign = if (diff > 0) "+" else ""
                return String.format(Locale.US, "%s%.1f%s", sign, diff, suffix)
            }

            // Table Header
            bgPaint.color = darkHeaderBg
            canvas.drawRect(margin, y - 12f, pageWidth - margin, y + 6f, bgPaint)
            val thPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = goldColor
                textSize = 9f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            canvas.drawText("Métrica", margin + 8f, y, thPaint)
            canvas.drawText("Inicial (${formatDate(first.dateMillis)})", margin + 170f, y, thPaint)
            canvas.drawText("Atual (${formatDate(latest.dateMillis)})", margin + 310f, y, thPaint)
            canvas.drawText("Evolução", margin + 445f, y, thPaint)
            y += 20f

            data class MetricRow(val label: String, val initial: String, val current: String, val delta: String, val positiveIsGood: Boolean?)
            val rows = listOf(
                MetricRow("Peso (kg)", fmtVal(first.weightKg, " kg"), fmtVal(latest.weightKg, " kg"), fmtDelta(first.weightKg, latest.weightKg, " kg"), null),
                MetricRow("Massa Gorda (%)", fmtVal(first.bodyFatPct, "%"), fmtVal(latest.bodyFatPct, "%"), fmtDelta(first.bodyFatPct, latest.bodyFatPct, "%"), false),
                MetricRow("Massa Muscular (%)", fmtVal(first.muscleMassKg, "%"), fmtVal(latest.muscleMassKg, "%"), fmtDelta(first.muscleMassKg, latest.muscleMassKg, "%"), true),
                MetricRow("Gordura Visceral", fmtVal(first.visceralFat), fmtVal(latest.visceralFat), fmtDelta(first.visceralFat, latest.visceralFat), false),
                MetricRow(
                    "IMC (${PhysicalCalculations.bmiClassification(latest.bmi)})",
                    fmtVal(first.bmi),
                    fmtVal(latest.bmi),
                    fmtDelta(first.bmi, latest.bmi),
                    null
                ),
                MetricRow("TMB (kcal/dia)", fmtVal(first.bmrKcal, " kcal"), fmtVal(latest.bmrKcal, " kcal"), fmtDelta(first.bmrKcal, latest.bmrKcal, " kcal"), true)
            )

            rows.forEachIndexed { idx, r ->
                ensureSpace(22f)
                if (idx % 2 == 0) {
                    bgPaint.color = cardBg
                    canvas.drawRect(margin, y - 12f, pageWidth - margin, y + 6f, bgPaint)
                }
                canvas.drawText(r.label, margin + 8f, y, bodyBoldPaint)
                canvas.drawText(r.initial, margin + 170f, y, bodyPaint)
                canvas.drawText(r.current, margin + 310f, y, bodyBoldPaint)
                val deltaPaint = Paint(bodyBoldPaint).apply {
                    color = when {
                        r.delta == "—" || r.positiveIsGood == null -> textDark
                        r.delta.startsWith("+") -> if (r.positiveIsGood) greenColor else redColor
                        r.delta.startsWith("-") -> if (r.positiveIsGood) redColor else greenColor
                        else -> textDark
                    }
                }
                canvas.drawText(r.delta, margin + 445f, y, deltaPaint)
                y += 19f
            }
            y += 14f
        }

        // Section 3: Recordes Pessoais (PR) por Exercício
        ensureSpace(70f)
        val prs = computeClientExercisePrs(
            clientId = client.id,
            workoutLoadLogs = workoutLoadLogs,
            workoutPlans = workoutPlans,
            workoutPlanItems = workoutPlanItems
        ).values.sortedByDescending { it.prKg }

        canvas.drawText("3. Recordes Pessoais (PR) & Cargas de Treino", margin, y, sectionPaint)
        y += 10f
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 18f

        if (prs.isEmpty()) {
            canvas.drawText("Ainda sem cargas registadas nos exercícios do plano.", margin, y, mutedPaint)
            y += 20f
        } else {
            bgPaint.color = darkHeaderBg
            canvas.drawRect(margin, y - 12f, pageWidth - margin, y + 6f, bgPaint)
            val thPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = goldColor
                textSize = 9f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            canvas.drawText("Exercício", margin + 8f, y, thPaint)
            canvas.drawText("Recorde (PR)", margin + 270f, y, thPaint)
            canvas.drawText("Última Carga", margin + 365f, y, thPaint)
            canvas.drawText("Data PR", margin + 455f, y, thPaint)
            y += 20f

            prs.forEachIndexed { idx, pr ->
                ensureSpace(22f)
                if (idx % 2 == 0) {
                    bgPaint.color = cardBg
                    canvas.drawRect(margin, y - 12f, pageWidth - margin, y + 6f, bgPaint)
                }
                val exTitle = if (pr.exerciseName.length > 38) pr.exerciseName.take(36) + "…" else pr.exerciseName
                canvas.drawText(exTitle, margin + 8f, y, bodyBoldPaint)
                val prPaint = Paint(bodyBoldPaint).apply { color = Color.parseColor("#B45309") }
                canvas.drawText(pr.prLabel, margin + 270f, y, prPaint)
                canvas.drawText(pr.latestLabel, margin + 365f, y, bodyPaint)
                canvas.drawText(formatDate(pr.prDateMillis), margin + 455f, y, mutedPaint)
                y += 19f
            }
        }

        // Footer
        canvas.drawText(
            "New Shape · Relatório gerado automaticamente · Página $pageNum",
            margin,
            pageHeight - 20f,
            mutedPaint
        )

        doc.finishPage(page)

        val file = File(reportsDir(context), "newshape_evolucao_${sanitizeFileName(client.name)}.pdf")
        return try {
            FileOutputStream(file).use { out -> doc.writeTo(out) }
            doc.close()
            shareFile(context, file, "application/pdf", "Relatório de Evolução · ${client.name}")
        } catch (_: Exception) {
            doc.close()
            false
        }
    }

    /**
     * Admin-only CSV / Excel accounting export (UTF-8 with BOM + `;` delimiter).
     */
    fun shareFinanceAccountingCsv(
        context: Context,
        isSuperAdmin: Boolean,
        period: AccountingExportPeriod,
        currentMonthYear: String,
        payments: List<PaymentRecord>,
        clients: List<ClientRecord>
    ): Boolean {
        if (!isSuperAdmin) return false
        val clientMap = clients.associateBy { it.id }

        val allowedMonths = when (period) {
            AccountingExportPeriod.CURRENT_MONTH -> setOf(currentMonthYear)
            AccountingExportPeriod.LAST_6_MONTHS -> {
                val set = mutableSetOf<String>()
                for (offset in 0 downTo -5) {
                    val cal = Calendar.getInstance().apply { add(Calendar.MONTH, offset) }
                    set.add(String.format(Locale.US, "%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1))
                }
                set
            }
            AccountingExportPeriod.ALL -> null
        }

        val filtered = payments
            .filter { it.paid && (allowedMonths == null || it.monthYear in allowedMonths) }
            .sortedWith(compareByDescending<PaymentRecord> { it.monthYear }.thenByDescending { it.paidAtMillis })

        fun csvCell(value: String): String {
            val cleaned = value.replace("\r", " ").replace("\n", " ").replace("\"", "\"\"")
            return if (cleaned.contains(';') || cleaned.contains('"')) "\"$cleaned\"" else cleaned
        }

        val sb = StringBuilder()
        sb.append('\uFEFF') // UTF-8 BOM for PT Excel
        sb.appendLine("Mes;Data Pagamento;Aluno;Modalidade;Metodo;Valor (EUR);Estado")

        var totalAll = 0.0
        var totalPersonal = 0.0
        var totalGroup = 0.0
        val methodTotals = linkedMapOf("MbWay" to 0.0, "Dinheiro" to 0.0, "João" to 0.0, "Outro" to 0.0)

        filtered.forEach { p ->
            val client = clientMap[p.clientId]
            val clientName = client?.name ?: "Aluno"
            val isPersonal = client?.trainingType == "PERSONALIZADO"
            val modality = if (isPersonal) "Personalizado" else "Grupo"
            val method = SeedCatalog.normalizePaymentMethod(p.note) ?: p.note.ifBlank { "Outro" }

            totalAll += p.amountEur
            if (isPersonal) totalPersonal += p.amountEur else totalGroup += p.amountEur
            val methodKey = if (method in methodTotals) method else "Outro"
            methodTotals[methodKey] = (methodTotals[methodKey] ?: 0.0) + p.amountEur

            sb.appendLine(
                listOf(
                    csvCell(p.monthLabel.ifBlank { p.monthYear }),
                    csvCell(formatDate(p.paidAtMillis)),
                    csvCell(clientName),
                    csvCell(modality),
                    csvCell(method),
                    String.format(Locale.US, "%.2f", p.amountEur).replace('.', ','),
                    "Pago"
                ).joinToString(";")
            )
        }

        sb.appendLine()
        sb.appendLine("RESUMO CONTABILIDADE;;;;;;")
        sb.appendLine("Total Geral;;;;;${String.format(Locale.US, "%.2f", totalAll).replace('.', ',')};")
        sb.appendLine("Total Treino Personalizado;;;;;${String.format(Locale.US, "%.2f", totalPersonal).replace('.', ',')};")
        sb.appendLine("Total Treino em Grupo;;;;;${String.format(Locale.US, "%.2f", totalGroup).replace('.', ',')};")
        methodTotals.forEach { (method, amt) ->
            if (amt > 0.0 || method != "Outro") {
                sb.appendLine("Total $method;;;;;${String.format(Locale.US, "%.2f", amt).replace('.', ',')};")
            }
        }

        val file = File(reportsDir(context), "newshape_faturacao_${period.fileSlug}.csv")
        return try {
            file.writeText(sb.toString(), Charsets.UTF_8)
            shareFile(context, file, "text/csv", "Faturação New Shape (${period.label})")
        } catch (_: Exception) {
            false
        }
    }
}
