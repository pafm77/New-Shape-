package com.example.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TrainingReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Lembrete de treino · New Shape"
        val body = intent.getStringExtra(EXTRA_BODY) ?: "O teu treino está quase a começar!"
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 2001)
        val channelId = intent.getStringExtra(EXTRA_CHANNEL_ID) ?: WorkoutNotificationHelper.CHANNEL_REMINDERS

        WorkoutNotificationHelper.showImmediateNotification(
            context = context,
            channelId = channelId,
            title = title,
            body = body,
            notificationId = notificationId
        )
    }

    companion object {
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_BODY = "extra_body"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
        const val EXTRA_CHANNEL_ID = "extra_channel_id"
    }
}
