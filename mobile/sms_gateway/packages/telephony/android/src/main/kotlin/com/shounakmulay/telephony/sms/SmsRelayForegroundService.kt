package com.shounakmulay.telephony.sms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Brief foreground service so Android 12+ keeps the process alive long enough for the
 * headless Flutter isolate to POST to the webhook and call [SmsManager] while the device
 * is locked or dozing. Stops automatically after a debounced quiet period.
 */
class SmsRelayForegroundService : Service() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val stopAfterQuiet = Runnable { stopGracefully() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "startForeground failed (relay may still use wake lock only)", e)
        }

        mainHandler.removeCallbacks(stopAfterQuiet)
        mainHandler.postDelayed(stopAfterQuiet, DEBOUNCE_STOP_MS)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(stopAfterQuiet)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    private fun stopGracefully() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (_: Exception) {
        }
        stopSelf()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val existing = mgr.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            "SMS relay",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_SECRET
        }
        mgr.createNotificationChannel(ch)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("WaterWise SMS relay")
            .setContentText("Finishing webhook and reply…")
            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "SmsRelayFg"
        private const val CHANNEL_ID = "waterwise_sms_relay_hold"
        private const val NOTIFICATION_ID = 71001
        /** Matches extended broadcast / wake lock budget in [IncomingSmsReceiver]. */
        private const val DEBOUNCE_STOP_MS = 195_000L

        /**
         * Extend relay execution window while locked. Safe to call on every inbound SMS;
         * debounces shutdown so bursts of segments share one hold.
         */
        fun extendHold(context: Context) {
            val app = context.applicationContext
            val intent = Intent(app, SmsRelayForegroundService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    app.startForegroundService(intent)
                } else {
                    @Suppress("DEPRECATION")
                    app.startService(intent)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not start SMS relay hold service", e)
            }
        }
    }
}
