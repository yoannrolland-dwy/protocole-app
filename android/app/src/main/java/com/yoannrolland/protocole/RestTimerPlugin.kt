package com.yoannrolland.protocole

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Notifications du minuteur de repos.
 *
 * Deux besoins que le plugin @capacitor/local-notifications ne couvre pas :
 *
 * 1. **Sonner fort.** Un canal créé par le plugin joue son son sur le flux *notification*,
 *    volontairement discret. Ici le canal est créé avec des AudioAttributes en
 *    USAGE_ALARM : le son sort sur le volume *alarme*, celui d'un réveil — audible en
 *    salle de sport. Les réglages d'un canal étant figés à la création, cet id de canal
 *    ne doit jamais être réutilisé avec d'autres réglages (versionner l'id si besoin).
 *
 * 2. **Voir le décompte dans la barre d'état.** Une notification persistante avec
 *    chronomètre décroissant : c'est Android qui l'anime seconde par seconde, sans
 *    service de premier plan ni réveil du JS.
 */
@CapacitorPlugin(name = "RestTimer")
class RestTimerPlugin : Plugin() {

    companion object {
        // Suffixe de version : changer d'id est le seul moyen de modifier les réglages
        // d'un canal déjà créé sur l'appareil.
        const val CHANNEL_ALARM = "protocole-rest-alarm-v2"
        const val CHANNEL_COUNTDOWN = "protocole-rest-countdown-v2"
        const val NOTIF_COUNTDOWN = 4202
    }

    private fun manager() = context.getSystemService(NotificationManager::class.java)

    private fun ensureChannels() {
        val nm = manager() ?: return

        if (nm.getNotificationChannel(CHANNEL_ALARM) == null) {
            val sound = Uri.parse("android.resource://${context.packageName}/${R.raw.alarm}")
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)          // ← volume alarme, pas notification
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ALARM, "Fin de repos", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Sonnerie de fin du temps de repos entre les séries"
                    setSound(sound, attrs)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 600)
                    setBypassDnd(true)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
            )
        }

        if (nm.getNotificationChannel(CHANNEL_COUNTDOWN) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_COUNTDOWN, "Repos en cours", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Décompte du repos affiché dans la barre d'état"
                    setSound(null, null)       // silencieux : seule la fin doit sonner
                    enableVibration(false)
                    setShowBadge(false)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
            )
        }
    }

    @PluginMethod
    fun prepare(call: PluginCall) {
        ensureChannels()
        call.resolve(JSObject().put("channelId", CHANNEL_ALARM))
    }

    /** Affiche le décompte persistant. `endsAt` = timestamp epoch ms de fin du repos. */
    @PluginMethod
    fun showCountdown(call: PluginCall) {
        ensureChannels()
        val endsAt = call.getLong("endsAt") ?: run { call.reject("endsAt requis"); return }
        val exercise = call.getString("exercise") ?: ""

        val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            android.app.PendingIntent.getActivity(
                context, 0, it,
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        val n = NotificationCompat.Builder(context, CHANNEL_COUNTDOWN)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Repos en cours")
            .setContentText(if (exercise.isEmpty()) "Série suivante à la fin du décompte" else exercise)
            // Chronomètre décroissant animé par le système : pas de mise à jour à faire.
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(endsAt)
            .setShowWhen(true)
            .setOngoing(true)          // non balayable tant que le repos court
            // Sans ça, une notification `ongoing` resterait bloquée si le repos se termine
            // app fermée (aucun JS pour l'annuler) : Android la retire lui-même à échéance.
            .setTimeoutAfter(maxOf(1000L, endsAt - System.currentTimeMillis() + 500L))
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIF_COUNTDOWN, n)
            call.resolve()
        } catch (e: SecurityException) {
            call.reject("Notifications non autorisées : ${e.message}")
        }
    }

    @PluginMethod
    fun hideCountdown(call: PluginCall) {
        try { NotificationManagerCompat.from(context).cancel(NOTIF_COUNTDOWN) } catch (_: Exception) {}
        call.resolve()
    }
}
