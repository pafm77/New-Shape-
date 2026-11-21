package com.example.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.R
import com.example.data.model.BookingRecord
import com.example.data.model.BookingStatus
import com.example.data.model.TrainingSessionRecord

object WorkoutNotificationHelper {
    const val CHANNEL_REMINDERS = "newshape_training_reminders"
    const val CHANNEL_PT_ALERTS = "newshape_pt_alerts"

    private const val PREFS_NAME = "newshape_notification_prefs"
    private const val KEY_STUDENT_ENABLED = "student_reminders_enabled"
    private const val KEY_STUDENT_LEAD_MINUTES = "student_reminder_lead_minutes"
    private const val KEY_PT_ALERTS_ENABLED = "pt_alerts_enabled"
    private const val KEY_SCHEDULED_CODES = "scheduled_request_codes"

    fun ensureNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val reminderChannel = NotificationChannel(
            CHANNEL_REMINDERS,
            "Lembretes de Treino",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notificações antes da hora dos teus treinos confirmados."
        }

        val ptAlertsChannel = NotificationChannel(
            CHANNEL_PT_ALERTS,
            "Alertas de Agenda (PT)",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Avisos imediatos quando um aluno cancela ou altera o horário."
        }

        manager.createNotificationChannel(reminderChannel)
        manager.createNotificationChannel(ptAlertsChannel)
    }

    fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun isStudentRemindersEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_STUDENT_ENABLED, false)
    }

    fun setStudentRemindersEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_STUDENT_ENABLED, enabled)
            .apply()
    }

    fun hasStudentCustomReminderLead(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.contains(KEY_STUDENT_LEAD_MINUTES)
    }

    fun getStudentReminderLeadMinutes(context: Context, defaultMinutes: Int = 60): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val fallback = defaultMinutes.coerceIn(5, 1440)
        if (!prefs.contains(KEY_STUDENT_LEAD_MINUTES)) return fallback
        return prefs.getInt(KEY_STUDENT_LEAD_MINUTES, fallback).coerceIn(5, 1440)
    }

    fun setStudentReminderLeadMinutes(context: Context, leadMinutes: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_STUDENT_LEAD_MINUTES, leadMinutes.coerceIn(5, 1440))
            .apply()
    }

    fun clearStudentCustomReminderLead(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_STUDENT_LEAD_MINUTES)
            .apply()
    }

    fun isPtAlertsEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_PT_ALERTS_ENABLED, true)
    }

    fun setPtAlertsEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_PT_ALERTS_ENABLED, enabled)
            .apply()
    }

    fun showImmediateNotification(
        context: Context,
        channelId: String,
        title: String,
        body: String,
        notificationId: Int
    ): Boolean {
        ensureNotificationChannels(context)
        if (!hasNotificationPermission(context)) return false

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }

    fun cancelScheduledReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val codes = prefs.getStringSet(KEY_SCHEDULED_CODES, emptySet()).orEmpty()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        codes.forEach { codeStr ->
            val code = codeStr.toIntOrNull() ?: return@forEach
            val intent = Intent(context, TrainingReminderReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                context,
                code,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
            )
            if (pi != null) {
                alarmManager.cancel(pi)
                pi.cancel()
            }
        }
        prefs.edit().putStringSet(KEY_SCHEDULED_CODES, emptySet()).apply()
    }

    fun scheduleConfirmedWorkoutReminders(
        context: Context,
        clientId: String,
        bookings: List<BookingRecord>,
        sessions: List<TrainingSessionRecord>,
        leadMinutes: Int
    ): Int {
        ensureNotificationChannels(context)
        cancelScheduledReminders(context)
        if (!hasNotificationPermission(context) || !isStudentRemindersEnabled(context)) return 0

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return 0
        val sessionMap = sessions.associateBy { it.id }
        val nowMs = System.currentTimeMillis()
        val safeLead = leadMinutes.coerceIn(5, 1440)
        val leadMs = safeLead * 60_000L
        val leadLabel = when {
            safeLead >= 60 && safeLead % 60 == 0 -> "${safeLead / 60}h"
            safeLead > 60 -> "${safeLead / 60}h ${safeLead % 60} min"
            else -> "$safeLead min"
        }

        val scheduledCodes = mutableSetOf<String>()

        bookings
            .filter { it.clientId == clientId && it.status == BookingStatus.CONFIRMED.name }
            .forEach { booking ->
                val session = sessionMap[booking.sessionId] ?: return@forEach
                if (session.startMillis <= nowMs) return@forEach

                val triggerAt = (session.startMillis - leadMs).coerceAtLeast(nowMs + 5_000L)
                val requestCode = ("rem_${booking.id}_${session.id}").hashCode() and 0x7FFFFFFF
                val intent = Intent(context, TrainingReminderReceiver::class.java).apply {
                    putExtra(TrainingReminderReceiver.EXTRA_TITLE, "Treino daqui a $leadLabel · New Shape")
                    putExtra(
                        TrainingReminderReceiver.EXTRA_BODY,
                        "${session.dateLabel} às ${session.timeLabel.replace(":", "h")} (${session.durationMinutes} min). Prepara o equipamento!"
                    )
                    putExtra(TrainingReminderReceiver.EXTRA_NOTIFICATION_ID, requestCode)
                    putExtra(TrainingReminderReceiver.EXTRA_CHANNEL_ID, CHANNEL_REMINDERS)
                }
                val pi = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )

                // Standard inexact alarm (Play-policy compliant; avoids restricted SCHEDULE_EXACT_ALARM)
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                scheduledCodes.add(requestCode.toString())
            }

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_SCHEDULED_CODES, scheduledCodes)
            .apply()

        return scheduledCodes.size
    }
}
