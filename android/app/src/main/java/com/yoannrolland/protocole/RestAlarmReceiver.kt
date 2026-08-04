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
     * Cherche un casque filaire ou Bluetooth déjà connecté, pour y envoyer le son au lieu du
     * haut-parleur — demandé explicitement : sonner à pleine intensité dans toute la salle de
     * sport gênait tout le monde autour.
     *
     * Limite assumée : ceci détecte un appareil CONNECTÉ, pas porté aux oreilles. Un casque
     * Bluetooth resté connecté mais posé sur un banc rend l'alarme silencieuse pour la pièce —
     * exactement le compromis demandé (priorité à ne pas déranger, plutôt qu'à être entendu
     * coûte que coûte).
     */
    private fun connectedHeadset(context: Context): AudioDeviceInfo? {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return null
        val headsetTypes = setOf(
            // TYPE_WIRED_HEADSET/HEADPHONES ne concernent que la prise jack 3,5mm analogique —
            // absente sur ce téléphone (pas de jack). Un casque filaire y est forcément branché
            // en USB-C, donc vu par Android comme TYPE_USB_HEADSET (voire TYPE_USB_DEVICE selon
            // le DAC intégré au câble) — constaté le 29/07/2026 : le filtre précédent ne
            // reconnaissait aucun de ces deux types, d'où le son resté sur haut-parleur malgré
            // le casque branché.
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_DEVICE,
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
            val headset = connectedHeadset(context)
            if (headset != null) {
                // Constaté sur appareil le 29/07/2026, casque filaire USB-C ET Bluetooth : le
                // flux ALARME force TOUJOURS une diffusion simultanée sur le haut-parleur ET
                // l'appareil connecté (politique de sécurité d'Android pour les alarmes,
                // au niveau du gestionnaire audio natif) — setPreferredDevice() n'a aucun effet
                // dessus, quel que soit le casque. Le flux média, lui, respecte le device
                // préféré et n'est routé QUE vers lui. Le mode silencieux ne coupe ni l'un ni
                // l'autre flux (vérifié : ni STREAM_MUSIC ni STREAM_ALARM ne figurent parmi les
                // flux mis en sourdine par le mode sonnerie) — le contournement du silencieux
                // n'a donc pas besoin du flux ALARME pour fonctionner ici. Revers assumé :
                // si le volume média du téléphone est baissé à zéro indépendamment du volume
                // alarme, ce cas précis serait silencieux.
                player.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                player.setPreferredDevice(headset)
            } else {
                player.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }
            // Volume divisé par deux (04/08/2026, demande explicite) : le son à pleine
            // intensité était trop fort en salle. Reste au-dessus du volume alarme/média du
            // téléphone (ce setVolume() n'est qu'une atténuation relative sur ce flux-là).
            player.setVolume(0.5f, 0.5f)
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
