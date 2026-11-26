package com.example.data.model

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

const val SUPER_ADMIN_EMAIL = "pafm77pedrinho77@gmail.com"

fun isSuperAdminEmail(email: String?): Boolean =
    email?.trim()?.lowercase() == SUPER_ADMIN_EMAIL

@Keep
@IgnoreExtraProperties
data class ClientRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val phone: String = "",
    val notes: String = "",
    val active: Boolean = true,
    val newClient: Boolean = false,
    val trainingType: String = "GRUPO",
    val monthlyFeeEur: Double = 0.0,
    val fidelizacaoMonths: Int = 0,
    val fidelizacaoStartMillis: Long = 0L,
    val weeklySessionLimit: Int = 0,
    val fixedSlots: List<String> = emptyList(),
    val loginPinHash: String = "",
    val birthDate: String = "",
    val weeklyGoalSessions: Int = 0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class TrainingWeekRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val weekKey: String = "",
    val label: String = "",
    val startDateMillis: Long = 0L,
    val published: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class TrainingSessionRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val weekKey: String = "",
    val dayOfWeek: Int = 1,
    val dateLabel: String = "",
    val timeLabel: String = "18:00",
    val durationMinutes: Int = 60,
    val capacity: Int = 6,
    val note: String = "",
    val startMillis: Long = 0L,
    val ptPrivatePersonal: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

enum class BookingStatus {
    PENDING, CONFIRMED, ALTERED, CANCELLED
}

@Keep
@IgnoreExtraProperties
data class BookingRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val sessionId: String = "",
    val weekKey: String = "",
    val clientId: String = "",
    val status: String = BookingStatus.PENDING.name,
    val attendanceStatus: String = "",
    val requestedAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class WeekResponseRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val weekKey: String = "",
    val clientId: String = "",
    val status: String = "UNAVAILABLE",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class PaymentRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val monthYear: String = "",
    val monthLabel: String = "",
    val amountEur: Double = 0.0,
    val paid: Boolean = true,
    val paidAtMillis: Long = 0L,
    val note: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class FidelizacaoRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val durationMonths: Int = 6,
    val startDateMillis: Long = 0L,
    val endDateMillis: Long = 0L,
    val notes: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class ExerciseRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val muscleGroup: String = "",
    val equipment: String = "Peso Livre",
    val instructions: String = "",
    val custom: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class WorkoutPlanRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val title: String = "",
    val splitLabel: String = "",
    val availableFromDate: String = "",
    val createdAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

fun currentLocalIsoDate(): String {
    val cal = java.util.Calendar.getInstance()
    return String.format(
        java.util.Locale.US,
        "%04d-%02d-%02d",
        cal.get(java.util.Calendar.YEAR),
        cal.get(java.util.Calendar.MONTH) + 1,
        cal.get(java.util.Calendar.DAY_OF_MONTH)
    )
}

fun formatIsoDatePt(iso: String): String {
    val clean = iso.trim()
    val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").matchEntire(clean) ?: return clean
    return "${m.groupValues[3]}/${m.groupValues[2]}/${m.groupValues[1]}"
}

fun WorkoutPlanRecord.isUnassignedDraft(): Boolean = clientId.isBlank()

fun WorkoutPlanRecord.isScheduledForFuture(todayIso: String = currentLocalIsoDate()): Boolean {
    val d = availableFromDate.trim()
    return d.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$")) && d > todayIso
}

fun WorkoutPlanRecord.isAvailableToStudent(todayIso: String = currentLocalIsoDate()): Boolean =
    !isUnassignedDraft() && !isScheduledForFuture(todayIso)

@Keep
@IgnoreExtraProperties
data class WorkoutPlanItemRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val planId: String = "",
    val exerciseId: String = "",
    val exerciseName: String = "",
    val muscleGroup: String = "",
    val sets: Int = 3,
    val reps: String = "10-12",
    val loadKg: String = "",
    val lastLoadKg: String = "",
    val lastLoggedAtMillis: Long = 0L,
    val restSeconds: Int = 90,
    val notes: String = "",
    val orderIndex: Int = 0,
    val supersetGroup: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

data class WorkoutExerciseBlock(
    val blockNumber: Int,
    val supersetGroup: String,
    val items: List<WorkoutPlanItemRecord>
) {
    val isGrouped: Boolean
        get() = supersetGroup.isNotBlank() && items.size >= 2

    val groupLabel: String
        get() = when {
            items.size == 2 -> "Bi-set · Sem descanso entre eles"
            items.size == 3 -> "Tri-set · Sem descanso entre eles"
            else -> "Circuito (${items.size}) · Sem descanso entre eles"
        }

    fun itemLabel(indexInBlock: Int): String =
        if (isGrouped) "${blockNumber}${('A' + indexInBlock)}" else "$blockNumber"
}

fun groupWorkoutPlanItems(sortedItems: List<WorkoutPlanItemRecord>): List<WorkoutExerciseBlock> {
    if (sortedItems.isEmpty()) return emptyList()
    val blocks = mutableListOf<WorkoutExerciseBlock>()
    var idx = 0
    var blockNum = 1
    while (idx < sortedItems.size) {
        val current = sortedItems[idx]
        val group = current.supersetGroup.trim()
        if (group.isNotBlank()) {
            val grouped = mutableListOf(current)
            var nextIdx = idx + 1
            while (nextIdx < sortedItems.size && sortedItems[nextIdx].supersetGroup.trim() == group) {
                grouped += sortedItems[nextIdx]
                nextIdx++
            }
            if (grouped.size >= 2) {
                blocks += WorkoutExerciseBlock(blockNumber = blockNum++, supersetGroup = group, items = grouped)
                idx = nextIdx
                continue
            }
        }
        blocks += WorkoutExerciseBlock(blockNumber = blockNum++, supersetGroup = "", items = listOf(current))
        idx++
    }
    return blocks
}

@Keep
@IgnoreExtraProperties
data class WorkoutLoadLogRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val planId: String = "",
    val planItemId: String = "",
    val exerciseId: String = "",
    val exerciseName: String = "",
    val loadKg: String = "",
    val numericKg: Double = 0.0,
    val loggedAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class WaitlistEntryRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val sessionId: String = "",
    val weekKey: String = "",
    val clientId: String = "",
    val createdAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class FoodItemRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val category: String = "",
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
    val custom: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

enum class MealType(val label: String) {
    PEQUENO_ALMOCO("Pequeno-almoço"),
    LANCHE_MANHA("Lanche da Manhã"),
    ALMOCO("Almoço"),
    LANCHE_TARDE("Lanche da Tarde"),
    JANTAR("Jantar"),
    CEIA("Ceia")
}

@Keep
@IgnoreExtraProperties
data class NutritionEntryRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val mealType: String = MealType.ALMOCO.name,
    val foodId: String = "",
    val foodName: String = "",
    val grams: Double = 0.0,
    val kcal: Double = 0.0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fat: Double = 0.0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class ChatMessageRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val senderRole: String = "PT",
    val text: String = "",
    val timestampMillis: Long = 0L,
    val deliveredAtMillis: Long = 0L,
    val readAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class MessageTemplateRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val templateKey: String = "",
    val title: String = "",
    val description: String = "",
    val body: String = "",
    val defaultBody: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class StudioSettingsRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientsCanEdit: Boolean = true,
    val cutoffHours: Int = 0,
    val cutoffMinutes: Int? = null,
    val reminderLeadMinutes: Int? = null,
    val whatsappWebMode: Boolean = false,
    val siteBaseUrl: String = "https://newshape.vercel.app",
    val studentPortalCode: String = "",
    val ptWhatsappPhone: String = "",
    val birthDateReminderUntilMillis: Long = 0L,
    val seeded: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class PtAccountRecord(
    @DocumentId val id: String = "",
    val uid: String = "",
    val email: String = "",
    val displayName: String = "",
    val status: String = "PENDING",
    val isAdmin: Boolean = false,
    val requestedAtMillis: Long = 0L,
    val reviewedAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class PtNotificationRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val clientName: String = "",
    val type: String = "ALTERED",
    val summary: String = "",
    val weekKey: String = "",
    val read: Boolean = false,
    val timestampMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

data class StudentWhatsAppAlertPrompt(
    val type: String,
    val title: String,
    val detail: String,
    val whatsappMessage: String
)

fun StudioSettingsRecord.effectiveCutoffMinutes(): Int =
    (cutoffMinutes ?: (cutoffHours * 60)).coerceIn(0, 4320)

fun StudioSettingsRecord.formatCutoffLabel(): String {
    val m = effectiveCutoffMinutes()
    return when {
        m <= 0 -> "sem limite"
        m >= 60 && m % 60 == 0 -> "${m / 60}h"
        else -> "$m min"
    }
}

fun StudioSettingsRecord.effectiveReminderLeadMinutes(): Int =
    (reminderLeadMinutes ?: 60).coerceIn(5, 1440)

fun formatReminderLeadLabel(minutes: Int): String {
    val m = minutes.coerceIn(5, 1440)
    return when {
        m >= 60 && m % 60 == 0 -> "${m / 60}h"
        m > 60 -> "${m / 60}h ${m % 60} min"
        else -> "$m min"
    }
}

@Keep
@IgnoreExtraProperties
data class PhysicalAssessmentRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val dateMillis: Long = 0L,
    val weightKg: Double = 0.0,
    val ageYears: Int = 25,
    val heightCm: Double = 170.0,
    val sex: String = "M",
    val bodyFatPct: Double = 0.0,
    val muscleMassKg: Double = 0.0,
    val visceralFat: Double = 0.0,
    val bmi: Double = 0.0,
    val bmrKcal: Double = 0.0,
    val notes: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

object PhysicalCalculations {
    fun calculateBmi(weightKg: Double, heightCm: Double): Double {
        if (weightKg <= 0.0 || heightCm <= 0.0) return 0.0
        val heightM = heightCm / 100.0
        return weightKg / (heightM * heightM)
    }

    fun calculateBmrMifflinStJeor(
        weightKg: Double,
        heightCm: Double,
        ageYears: Int,
        sex: String
    ): Double {
        if (weightKg <= 0.0 || heightCm <= 0.0 || ageYears <= 0) return 0.0
        val base = (10.0 * weightKg) + (6.25 * heightCm) - (5.0 * ageYears)
        return (if (sex == "F") base - 161.0 else base + 5.0).coerceAtLeast(0.0)
    }

    fun bmiClassification(bmi: Double): String = when {
        bmi <= 0.0 -> "—"
        bmi < 18.5 -> "Abaixo do peso"
        bmi < 25.0 -> "Peso normal"
        bmi < 30.0 -> "Excesso de peso"
        else -> "Obesidade"
    }
}

@Keep
@IgnoreExtraProperties
data class StudioAnnouncementRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val title: String = "",
    val message: String = "",
    val durationDays: Int = 7,
    val createdAtMillis: Long = 0L,
    val expiresAtMillis: Long = 0L,
    val active: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class AnnouncementReadRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val announcementId: String = "",
    val clientId: String = "",
    val clientName: String = "",
    val readAtMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class WorkoutFeedbackRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val clientId: String = "",
    val clientName: String = "",
    val planId: String = "",
    val planTitle: String = "",
    val rpe: Int = 7,
    val feeling: String = "IDEAL",
    val note: String = "",
    val timestampMillis: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)


