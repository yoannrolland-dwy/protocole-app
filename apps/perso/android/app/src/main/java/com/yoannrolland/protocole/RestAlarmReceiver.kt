package com.yoannrolland.protocole

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat

/**
 * Reçoit le réveil programmé par RestTimerPlugin.scheduleAlarm() via AlarmManager.setAlarmClock().
 *
 * Ce n'est PAS une notification qui sonne : le bip est joué par l'app elle-même, sur le flux
 * ALARME, via MediaPlayer — indépendamment de tout pipeline de notification. C'est le seul
 * mécanisme constaté fiable téléphone en mode silencieux (voir RestTimerPlugin.kt). Depuis le
 * 01/11/2026, le bip est joué par RestAudioService, au premier plan. Depuis le 07/11/2026, plus
 * de phrase de Jeffrey ni de priorité audio : le bip seul (voir RestAudioService.kt).
 */
// Titres et texte de la fin de repos : RestNotif (une seule notification de repos, 23/11/2026).
class RestAlarmReceiver : BroadcastReceiver() {

    // Casque connecté : le bip va dans le casque seul (demande explicite, ne pas gêner toute la
    // salle). Règle dans Headset (JeffreyVoice.kt), appliquée par RestEndAudio (RestAudioService.kt).

    override fun onReceive(context: Context, intent: Intent) {
        val exercise = intent.getStringExtra("exercise") ?: ""

        // Le décompte n'est plus retiré ici (23/11/2026) : la fin de repos le remplace, sous le même
        // identifiant (RestNotif), affichée par le service du bip.

        // Le bip, dans un service au premier plan (01/11/2026) qui garde l'app en vie le temps du
        // son. Si Android refuse le service, on joue quand même ici (goAsync garde le réveil en
        // vie 10 s). Bip seul depuis le 07/11/2026 : ni phrase ni priorité audio.
        try {
            ContextCompat.startForegroundService(context, Intent(context, RestAudioService::class.java).putExtra("exercise", exercise))
        } catch (e: Exception) {
            android.util.Log.w(RestEndAudio.TAG, "service refusé, son joué par le réveil : ${e.javaClass.simpleName}")
            RestNotif.postEnd(context, exercise)
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

    }
}
