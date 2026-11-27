package com.example.data

import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.ClientRecord
import com.example.data.model.MakeupCreditRecord
import com.example.data.model.TrainingSessionRecord
import com.example.data.model.TrainingWeekRecord
import com.example.data.model.WeekResponseRecord
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.ceil

const val MAKEUP_VALIDITY_DAYS: Int = 30
const val DAY_MILLIS: Long = 86_400_000L
const val MAKEUP_VALIDITY_MILLIS: Long = MAKEUP_VALIDITY_DAYS.toLong() * DAY_MILLIS

enum class ComputedMakeupStatus {
    AVAILABLE,
    USED,
    EXPIRED
}

data class ComputedMakeupCredit(
    val id: String,
    val reason: String, // ABSENT | REMOVED | MISSED_WEEK | MANUAL
    val weekKey: String,
    val sourceLabel: String,
    val occurredAtMillis: Long,
    val expiresAtMillis: Long,
    val daysLeft: Int,
    val status: ComputedMakeupStatus,
    val dismissibleCreditDocId: String? = null,
    val usedByBookingId: String? = null
)

data class ClientMakeupSummary(
    val clientId: String,
    val availableCount: Int,
    val usedCount: Int,
    val expiredCount: Int,
    val activeMakeupBookingsCount: Int,
    val absentCount30d: Int,
    val removedCount30d: Int,
    val missedWeekCount30d: Int,
    val manualCount30d: Int,
    val totalAbsencesAllTime: Int,
    val nearestExpiryDays: Int?,
    val credits: List<ComputedMakeupCredit>
)

private data class RawMakeupCredit(
    val id: String,
    val reason: String,
    val weekKey: String,
    val sourceLabel: String,
    val occurredAtMillis: Long,
    val expiresAtMillis: Long,
    val dismissibleCreditDocId: String? = null
)

object MakeupCreditCalculator {

    fun reasonLabel(reason: String): String = when (reason) {
        "ABSENT" -> "Falta"
        "REMOVED" -> "Treino removido"
        "MISSED_WEEK" -> "Não marcou treino"
        "MANUAL" -> "Atribuída pelo PT"
        else -> "Compensação"
    }

    fun formatShortDate(millis: Long): String {
        if (millis <= 0L) return "—"
        return SimpleDateFormat("dd/MM", Locale("pt", "PT")).format(Date(millis))
    }

    /**
     * Returns all clientIds that have at least one active (non-CANCELLED) makeup booking
     * in the given weekKey (or in any week if weekKey is blank).
     * Used so ALL bookings of that student in that week render in violet/purple for the PT.
     */
    fun getMakeupClientIdsForWeek(
        bookings: List<BookingRecord>,
        weekKey: String
    ): Set<String> {
        return bookings
            .asSequence()
            .filter { b ->
                b.makeup &&
                    b.status != BookingStatus.CANCELLED.name &&
                    (weekKey.isBlank() || b.weekKey == weekKey)
            }
            .map { it.clientId }
            .toSet()
    }

    fun computeForClient(
        client: ClientRecord,
        weeks: List<TrainingWeekRecord>,
        sessions: List<TrainingSessionRecord>,
        bookings: List<BookingRecord>,
        weekResponses: List<WeekResponseRecord>,
        makeupCredits: List<MakeupCreditRecord>,
        nowMillis: Long = System.currentTimeMillis()
    ): ClientMakeupSummary {
        val sessionsById = sessions.associateBy { it.id }
        val clientBookings = bookings.filter { it.clientId == client.id }
        val clientPersistedCredits = makeupCredits.filter { it.clientId == client.id }
        val clientResponsesByWeek = weekResponses
            .filter { it.clientId == client.id }
            .associateBy { it.weekKey }

        val totalAbsencesAllTime = clientBookings.count { it.attendanceStatus == "ABSENT" }

        val rawCredits = mutableListOf<RawMakeupCredit>()

        // 1. Persisted credits (REMOVED bookings/sessions, MANUAL PT credits, etc.)
        clientPersistedCredits
            .filter { !it.dismissed }
            .forEach { c ->
                val occurred = c.occurredAtMillis.takeIf { it > 0L } ?: nowMillis
                val expires = c.expiresAtMillis.takeIf { it > 0L } ?: (occurred + MAKEUP_VALIDITY_MILLIS)
                rawCredits += RawMakeupCredit(
                    id = "doc_${c.id}",
                    reason = c.reason,
                    weekKey = c.weekKey,
                    sourceLabel = c.sourceLabel.ifBlank { reasonLabel(c.reason) },
                    occurredAtMillis = occurred,
                    expiresAtMillis = expires,
                    dismissibleCreditDocId = c.id
                )
            }

        // 2. ABSENT bookings (non-makeup)
        clientBookings
            .filter { !it.makeup && it.attendanceStatus == "ABSENT" }
            .forEach { b ->
                val sess = sessionsById[b.sessionId]
                val occurred = sess?.startMillis?.takeIf { it > 0L }
                    ?: b.requestedAtMillis.takeIf { it > 0L }
                    ?: nowMillis
                val expires = occurred + MAKEUP_VALIDITY_MILLIS
                val label = if (sess != null) {
                    "Falta · ${sess.dateLabel} ${sess.timeLabel}"
                } else {
                    "Falta em treino (${b.weekKey})"
                }
                rawCredits += RawMakeupCredit(
                    id = "absent_${b.id}",
                    reason = "ABSENT",
                    weekKey = b.weekKey,
                    sourceLabel = label,
                    occurredAtMillis = occurred,
                    expiresAtMillis = expires
                )
            }

        // 3. Active CANCELLED bookings (awaiting PT confirmation, non-makeup)
        clientBookings
            .filter { !it.makeup && it.status == BookingStatus.CANCELLED.name }
            .forEach { b ->
                val sess = sessionsById[b.sessionId]
                val occurred = sess?.startMillis?.takeIf { it > 0L }
                    ?: b.requestedAtMillis.takeIf { it > 0L }
                    ?: nowMillis
                val expires = occurred + MAKEUP_VALIDITY_MILLIS
                val label = if (sess != null) {
                    "Treino cancelado · ${sess.dateLabel} ${sess.timeLabel}"
                } else {
                    "Treino cancelado (${b.weekKey})"
                }
                rawCredits += RawMakeupCredit(
                    id = "cancelled_${b.id}",
                    reason = "REMOVED",
                    weekKey = b.weekKey,
                    sourceLabel = label,
                    occurredAtMillis = occurred,
                    expiresAtMillis = expires
                )
            }

        // 4. MISSED_WEEK ("Não marcou treino") for active clients on published weeks within 30d window
        if (client.active) {
            val clientCreatedMillis = client.createdAt?.toDate()?.time ?: 0L
            val nonMakeupBookingsByWeek = clientBookings
                .filter { !it.makeup }
                .groupBy { it.weekKey }
            val removedCreditsByWeek = clientPersistedCredits
                .filter { it.reason == "REMOVED" }
                .groupBy { it.weekKey }

            weeks
                .filter { it.published && it.startDateMillis > 0L }
                .forEach { week ->
                    val weekEndMillis = week.startDateMillis + 7L * DAY_MILLIS
                    val weekHasEnded = weekEndMillis <= nowMillis
                    val isUnavailable = clientResponsesByWeek[week.weekKey]?.status == "UNAVAILABLE"

                    // Skip weeks that ended before this client existed
                    if (clientCreatedMillis > 0L && weekEndMillis < clientCreatedMillis && !isUnavailable) {
                        return@forEach
                    }

                    // Only relevant if week already ended OR student explicitly marked unavailable
                    if (!weekHasEnded && !isUnavailable) return@forEach

                    val occurred = if (weekHasEnded) {
                        weekEndMillis
                    } else {
                        minOf(nowMillis, week.startDateMillis.takeIf { it > 0L } ?: nowMillis)
                            .takeIf { it > 0L } ?: nowMillis
                    }
                    val expires = occurred + MAKEUP_VALIDITY_MILLIS

                    // Skip very old expired weeks (older than 45 days) to keep list focused
                    if (expires + 15L * DAY_MILLIS < nowMillis) return@forEach

                    val accountedInWeek = (nonMakeupBookingsByWeek[week.weekKey]?.size ?: 0) +
                        (removedCreditsByWeek[week.weekKey]?.size ?: 0)

                    val missingSlots = if (client.weeklySessionLimit > 0) {
                        (client.weeklySessionLimit - accountedInWeek).coerceAtLeast(0)
                    } else if (isUnavailable && accountedInWeek == 0) {
                        1
                    } else {
                        0
                    }

                    repeat(missingSlots) { idx ->
                        val label = if (isUnavailable) {
                            "Não treinou (indisponível) · ${week.label}"
                        } else {
                            "Não marcou treino · ${week.label}"
                        }
                        rawCredits += RawMakeupCredit(
                            id = "missed_${week.weekKey}_$idx",
                            reason = "MISSED_WEEK",
                            weekKey = week.weekKey,
                            sourceLabel = label,
                            occurredAtMillis = occurred,
                            expiresAtMillis = expires
                        )
                    }
                }
        }

        // 5. FIFO consumption by active makeup bookings (oldest-expiring credit consumed first)
        val sortedRaw = rawCredits.sortedBy { it.expiresAtMillis }
        val activeMakeupBookings = clientBookings
            .filter {
                it.makeup &&
                    it.status != BookingStatus.CANCELLED.name &&
                    it.attendanceStatus != "ABSENT"
            }
            .sortedBy { it.requestedAtMillis }

        val consumedCreditIds = mutableMapOf<String, String>() // rawCredit.id -> booking.id
        for (mb in activeMakeupBookings) {
            val refTime = mb.requestedAtMillis.takeIf { it > 0L } ?: nowMillis
            val match = sortedRaw.firstOrNull { rc ->
                rc.id !in consumedCreditIds && rc.expiresAtMillis >= refTime
            } ?: sortedRaw.firstOrNull { rc ->
                rc.id !in consumedCreditIds && rc.expiresAtMillis > nowMillis
            }
            if (match != null) {
                consumedCreditIds[match.id] = mb.id
            }
        }

        val computed = sortedRaw.map { rc ->
            val usedBy = consumedCreditIds[rc.id]
            val remainingMillis = rc.expiresAtMillis - nowMillis
            val status = when {
                usedBy != null -> ComputedMakeupStatus.USED
                remainingMillis <= 0L -> ComputedMakeupStatus.EXPIRED
                else -> ComputedMakeupStatus.AVAILABLE
            }
            val daysLeft = if (remainingMillis > 0L) {
                ceil(remainingMillis.toDouble() / DAY_MILLIS.toDouble()).toInt().coerceAtLeast(1)
            } else {
                0
            }
            ComputedMakeupCredit(
                id = rc.id,
                reason = rc.reason,
                weekKey = rc.weekKey,
                sourceLabel = rc.sourceLabel,
                occurredAtMillis = rc.occurredAtMillis,
                expiresAtMillis = rc.expiresAtMillis,
                daysLeft = daysLeft,
                status = status,
                dismissibleCreditDocId = rc.dismissibleCreditDocId,
                usedByBookingId = usedBy
            )
        }

        val available = computed.filter { it.status == ComputedMakeupStatus.AVAILABLE }
        val used = computed.filter { it.status == ComputedMakeupStatus.USED }
        val expired = computed.filter { it.status == ComputedMakeupStatus.EXPIRED }

        val within30d = computed.filter { it.status != ComputedMakeupStatus.EXPIRED }
        val visibleCredits = (
            available.sortedBy { it.expiresAtMillis } +
                used.sortedByDescending { it.occurredAtMillis } +
                expired.filter { nowMillis - it.expiresAtMillis <= 15L * DAY_MILLIS }
                    .sortedByDescending { it.expiresAtMillis }
            )

        return ClientMakeupSummary(
            clientId = client.id,
            availableCount = available.size,
            usedCount = used.size,
            expiredCount = expired.size,
            activeMakeupBookingsCount = activeMakeupBookings.size,
            absentCount30d = within30d.count { it.reason == "ABSENT" },
            removedCount30d = within30d.count { it.reason == "REMOVED" },
            missedWeekCount30d = within30d.count { it.reason == "MISSED_WEEK" },
            manualCount30d = within30d.count { it.reason == "MANUAL" },
            totalAbsencesAllTime = totalAbsencesAllTime,
            nearestExpiryDays = available.minOfOrNull { it.daysLeft },
            credits = visibleCredits
        )
    }

    fun computeAllClients(
        clients: List<ClientRecord>,
        weeks: List<TrainingWeekRecord>,
        sessions: List<TrainingSessionRecord>,
        bookings: List<BookingRecord>,
        weekResponses: List<WeekResponseRecord>,
        makeupCredits: List<MakeupCreditRecord>,
        nowMillis: Long = System.currentTimeMillis()
    ): Map<String, ClientMakeupSummary> {
        return clients.associate { client ->
            client.id to computeForClient(
                client = client,
                weeks = weeks,
                sessions = sessions,
                bookings = bookings,
                weekResponses = weekResponses,
                makeupCredits = makeupCredits,
                nowMillis = nowMillis
            )
        }
    }
}
