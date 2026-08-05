package com.yoannrolland.protocole

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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
 * 1. **Sonner en toutes circonstances, y compris téléphone en silencieux.** Constaté sur
 *    appareil réel le 28/07/2026 : une notification classique, même avec un canal en
 *    AudioAttributes USAGE_ALARM, reste soupise au filtre son de Samsung quand le mode
 *    silencieux est actif — elle ne sonne tout simplement pas. Seul le mécanisme d'un
 *    vrai réveil (celui qu'utilise l'appli Horloge) traverse le silencieux de façon fiable.
 *    On programme donc un `AlarmManager.setAlarmClock()` (déclenchement système, pas une
 *    notification) dont le `BroadcastReceiver` (voir RestAlarmReceiver.kt) joue le son
 *    lui-même sur le flux ALARME via MediaPlayer, indépendamment de tout pipeline de
 *    notification.
 *
 * 2. **Voir le décompte dans la barre d'état.** Une notification persistante avec
 *    chronomètre décroissant : c'est Android qui l'anime seconde par seconde, sans
 *    service de premier plan ni réveil du JS.
 */
@CapacitorPlugin(name = "RestTimer")
class RestTimerPlugin : Plugin() {

    companion object {
        // Suffixe de version : changer d'id est le seul moyen de modifier les réglages
        // d'un canal déjà créé sur l'appareil. v3 : le canal alarme ne porte plus de son
        // lui-même (MediaPlayer s'en charge dans RestAlarmReceiver, pour garantir le flux
        // ALARME) — l'ancien son de canal aurait fait doublon.
        const val CHANNEL_ALARM = "protocole-rest-alarm-v3"
        const val CHANNEL_COUNTDOWN = "protocole-rest-countdown-v2"
        const val NOTIF_COUNTDOWN = 4202
        const val NOTIF_ALARM = 4201
        private const val ALARM_REQUEST_CODE = 4201

        /** Partagé avec RestAlarmReceiver, qui n'a pas d'instance de Plugin. */
        fun ensureChannels(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return

            if (nm.getNotificationChannel(CHANNEL_ALARM) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ALARM, "Fin de repos", NotificationManager.IMPORTANCE_HIGH).apply {
                        description = "Repos terminé (le son est joué séparément, ce canal est visuel)"
                        setSound(null, null)
                        enableVibration(false) // la vibration est aussi déclenchée à la main dans le receiver
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

        fun alarmPendingIntent(context: Context, exercise: String): PendingIntent {
            val intent = Intent(context, RestAlarmReceiver::class.java).putExtra("exercise", exercise)
            return PendingIntent.getBroadcast(
                context, ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }

    @PluginMethod
    fun prepare(call: PluginCall) {
        ensureChannels(context)
        call.resolve(JSObject().put("channelId", CHANNEL_ALARM))
    }

    /**
     * Programme la sonnerie de fin de repos via un vrai réveil système (AlarmManager),
     * pas une notification — voir la doc de la classe pour le pourquoi.
     * `endsAt` = timestamp epoch ms de fin du repos.
     */
    @PluginMethod
    fun scheduleAlarm(call: PluginCall) {
        val endsAt = call.getLong("endsAt") ?: run { call.reject("endsAt requis"); return }
        val exercise = call.getString("exercise") ?: ""
        ensureChannels(context)

        val am = context.getSystemService(AlarmManager::class.java)
        val showIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        try {
            am.setAlarmClock(
                AlarmManager.AlarmClockInfo(endsAt, showIntent),
                alarmPendingIntent(context, exercise)
            )
            call.resolve()
        } catch (e: Exception) {
            call.reject("Programmation de l'alarme impossible : ${e.message}")
        }
    }

    @PluginMethod
    fun cancelAlarm(call: PluginCall) {
        try {
            val am = context.getSystemService(AlarmManager::class.java)
            am.cancel(alarmPendingIntent(context, ""))
        } catch (_: Exception) { /* rien à annuler */ }
        call.resolve()
    }

    /** Affiche le décompte persistant. `endsAt` = timestamp epoch ms de fin du repos. */
    @PluginMethod
    fun showCountdown(call: PluginCall) {
        ensureChannels(context)
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
