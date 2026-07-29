package com.yoannrolland.protocole

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Reçoit le réveil programmé par RestTimerPlugin.scheduleAlarm() via AlarmManager.setAlarmClock().
 *
 * Ce n'est PAS une notification qui sonne : c'est ce receiver qui joue le son lui-même, sur le
 * flux ALARME, via MediaPlayer — indépendamment de tout pipeline de notification. C'est le seul
 * mécanisme constaté fiable téléphone en mode silencieux (voir RestTimerPlugin.kt).
 */
class RestAlarmReceiver : BroadcastReceiver() {

    /**
     * Cherche un casque filaire ou Bluetooth déjà connecté, pour y forcer le son au lieu du
     * haut-parleur — demandé explicitement : sonner à pleine intensité dans toute la salle de
     * sport gênait tout le monde autour. Reste sur le flux ALARME (voir plus bas) : seule la
     * destination physique change, pas le mécanisme qui garantit le son en mode silencieux.
     *
     * Limite assumée : ceci détecte un appareil CONNECTÉ, pas porté aux oreilles. Un casque
     * Bluetooth resté connecté mais posé sur un banc rend l'alarme silencieuse pour la pièce —
     * exactement le compromis demandé (priorité à ne pas déranger, plutôt qu'à être entendu
     * coûte que coûte).
     */
    private fun connectedHeadset(context: Context): AudioDeviceInfo? {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return null
        val headsetTypes = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        )
        return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.type in headsetTypes }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val exercise = intent.getStringExtra("exercise") ?: ""

        // Le repos est terminé quel que soit l'état de l'app JS : on retire le décompte
        // persistant nous-mêmes plutôt que de compter sur un rappel JS à temps.
        try { NotificationManagerCompat.from(context).cancel(RestTimerPlugin.NOTIF_COUNTDOWN) } catch (_: Exception) { }

        try {
            val player = MediaPlayer()
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            // Casque connecté → le son y est envoyé exclusivement. Sinon, comportement inchangé
            // (haut-parleur, routage par défaut du flux ALARME).
            connectedHeadset(context)?.let { player.setPreferredDevice(it) }
            val afd = context.resources.openRawResourceFd(R.raw.alarm)
            player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            player.setOnCompletionListener { it.release() }
            player.prepare()
            player.start()
        } catch (_: Exception) {
            // La notification et la vibration ci-dessous fonctionnent même si le son échoue.
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
                .setContentTitle("Repos terminé")
                .setContentText(if (exercise.isEmpty()) "Série suivante." else "$exercise — série suivante.")
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
