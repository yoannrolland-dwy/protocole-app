package com.yoannrolland.protocole

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fin de repos : le bip puis la phrase de Jeffrey, au premier plan (01/11/2026).
 *
 * Constaté sur le téléphone (dumpsys audio, séance du 01/11 de 7 h 54 à 8 h 13) : Android 16 jette
 * les demandes de priorité audio d'une app qui n'est ni à l'écran ni dans un service au premier
 * plan (« AudioHardening focus request … ignored for com.yoannrolland.protocole »). Dès qu'Instagram
 * ou une autre app était devant, la musique et les vidéos continuaient donc par-dessus Jeffrey ;
 * avec PROTOCOLE à l'écran, ça marchait. D'où le côté aléatoire remonté par Yoann.
 *
 * Ce service, démarré par le réveil de fin de repos (setAlarmClock : Android autorise alors un
 * service au premier plan depuis l'arrière-plan), met l'app au premier plan le temps du bip et de la
 * phrase. La priorité audio est prise AVANT le bip (les autres apps se mettent en pause) et rendue
 * après la phrase (elles reprennent). Type mediaPlayback : le seul accepté pour l'audio à partir
 * d'Android 17, où shortService ne suffira plus.
 */
class RestAudioService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        BriefRunner.ensureChannel(this)
        val n = NotificationCompat.Builder(this, BriefRunner.CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Jeffrey")
            .setContentText("Fin du repos, Monsieur.")
            .setOngoing(true)
            .setSilent(true)
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(NOTIF_ID, n)
        } catch (e: Exception) {
            Log.w(RestEndAudio.TAG, "service au premier plan refusé : ${e.javaClass.simpleName}")
        }
        RestEndAudio.play(this) { stopSelf(startId) }
        return START_NOT_STICKY
    }

    companion object {
        const val NOTIF_ID = 5053
    }
}

/** Le bip et la phrase, encadrés par la priorité audio. Utilisé par le service, et par le réveil
 *  lui-même si Android refuse le service (sans garantie de priorité dans ce cas). */
object RestEndAudio {
    const val TAG = "RestEndAudio"
    private const val SAFETY_MS = 9_500L // le réveil garde la main 10 s au plus (goAsync)

    private val focusAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    fun play(context: Context, onFinished: () -> Unit) {
        val app = context.applicationContext
        val am = app.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(focusAttrs).build()
        val granted = am?.requestAudioFocus(focus)
        Log.i(TAG, "priorité audio : ${if (granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) "obtenue" else "refusée ($granted)"}")

        val main = Handler(Looper.getMainLooper())
        val finished = AtomicBoolean(false)
        val end = {
            if (finished.compareAndSet(false, true)) {
                // Petite marge : la fin de la phrase sort du haut-parleur avant que les autres reprennent.
                main.postDelayed({
                    runCatching { am?.abandonAudioFocusRequest(focus) }
                    onFinished()
                }, 300)
            }
        }
        main.postDelayed({ end() }, SAFETY_MS)

        // Annonce de Jeffrey juste après le bip (31/10/2026, choix de Yoann : toujours, casque ou
        // haut-parleur). Le son est en général déjà sur le téléphone (préparé au lancement du
        // repos) ; sinon il est demandé au serveur. Jamais par-dessus Jeffrey s'il parle déjà.
        val voice = RestTimerPlugin.storedVoice(app)
        val spoken = AtomicBoolean(false)
        val speakNow = speakNow@{
            if (!spoken.compareAndSet(false, true)) return@speakNow
            if (voice == null || JeffreySpeech.playing()) { end(); return@speakNow }
            try {
                val arr = voice.getJSONArray("chunks")
                JeffreySpeech.begin(
                    app, "rest-${System.currentTimeMillis()}",
                    JeffreySpeech.Config(voice.getString("url").trimEnd('/'), voice.getString("key"), voice.optDouble("speed", 1.2).toFloat()),
                    true, voice.optString("cacheKey").ifEmpty { null }, (0 until arr.length()).map { arr.getString(it) }, true,
                ) { end() }
            } catch (_: Exception) { end() }
        }

        try {
            val player = MediaPlayer()
            val headset = Headset.connected(app)
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
            val afd = app.resources.openRawResourceFd(R.raw.alarm)
            player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            player.setOnCompletionListener { it.release(); speakNow() }
            player.prepare()
            player.start()
        } catch (_: Exception) {
            speakNow()
        }
    }
}
