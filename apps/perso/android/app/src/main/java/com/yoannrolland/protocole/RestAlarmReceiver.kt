package com.yoannrolland.protocole

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Reçoit le réveil programmé par RestTimerPlugin.scheduleAlarm() via AlarmManager.setAlarmClock().
 *
 * Ce n'est PAS une notification qui sonne : le bip est joué par l'app elle-même, sur le flux
 * ALARME, via MediaPlayer — indépendamment de tout pipeline de notification. C'est le seul
 * mécanisme constaté fiable téléphone en mode silencieux (voir RestTimerPlugin.kt). Depuis le
 * 01/11/2026, le bip et la phrase de Jeffrey sont joués par RestAudioService, au premier plan,
 * pour que la priorité audio soit vraiment accordée (voir RestAudioService.kt).
 */
/** Fin de repos dans la voix de Jeffrey (lot JT, 29/10/2026) : très court, lu entre deux séries. */
private val END_TITLES = listOf(
    "Repos terminé, Monsieur.",
    "À vous, Monsieur.",
    "La barre vous attend, Monsieur.",
    "Fin de la récréation, Monsieur.",
)

class RestAlarmReceiver : BroadcastReceiver() {

    // Casque connecté : le bip va dans le casque seul (demande explicite, ne pas gêner toute la
    // salle). Règle dans Headset (JeffreyVoice.kt), appliquée par RestEndAudio (RestAudioService.kt).

    override fun onReceive(context: Context, intent: Intent) {
        val exercise = intent.getStringExtra("exercise") ?: ""

        // Le repos est terminé quel que soit l'état de l'app JS : on retire le décompte
        // persistant nous-mêmes plutôt que de compter sur un rappel JS à temps.
        try { NotificationManagerCompat.from(context).cancel(RestTimerPlugin.NOTIF_COUNTDOWN) } catch (_: Exception) { }

        // Bip puis phrase de Jeffrey, dans un service au premier plan (01/11/2026) : sans lui,
        // Android 16 ignore la demande de priorité audio dès qu'une autre app est à l'écran, et
        // la musique ou Instagram continuent par-dessus. Si Android refuse le service, on joue
        // quand même ici (goAsync garde le réveil en vie 10 s), sans garantie de priorité.
        try {
            ContextCompat.startForegroundService(context, Intent(context, RestAudioService::class.java))
        } catch (e: Exception) {
            android.util.Log.w(RestEndAudio.TAG, "service refusé, son joué par le réveil : ${e.javaClass.simpleName}")
            val pending = goAsync()
            RestEndAudio.play(context) { pending.finish() }
        }

        try {
            // Amplitude maximale explicite (255) sur chaque impulsion — demandé plus fort que le
            // réglage par défaut. Ignoré proprement sur les appareils sans contrôle d'amplitude
            // (Vibrator.hasAmplitudeControl() == false) : ils vibrent alors à leur intensité fixe.
            val pattern = longArrayOf(0, 400, 200, 400, 200, 600)
            val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                v.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
            }
        } catch (_: Exception) { }

        try {
            RestTimerPlugin.ensureChannels(context)
            val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pi = open?.let {
                PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            }
            val n = NotificationCompat.Builder(context, RestTimerPlugin.CHANNEL_ALARM)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                // Jeffrey (lot JT) : titre court, lu entre deux séries ; une variante au hasard.
                .setContentTitle(END_TITLES.random())
                .setContentText(if (exercise.isEmpty()) "Série suivante, Monsieur." else "$exercise — série suivante.")
                .setAutoCancel(true)
                .setSilent(true) // le son est déjà joué explicitement ci-dessus, pas de doublon
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(pi)
                .build()
            NotificationManagerCompat.from(context).notify(RestTimerPlugin.NOTIF_ALARM, n)
        } catch (_: Exception) { }
    }
}
