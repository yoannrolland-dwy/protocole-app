package com.yoannrolland.protocole

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fin de repos : le bip, au premier plan (01/11/2026 ; bip seul depuis le 07/11/2026, plus de phrase
 * ni de priorité audio, voir RestEndAudio.play).
 *
 * Constaté sur le téléphone (dumpsys audio, séance du 01/11 de 7 h 54 à 8 h 13) : Android 16 jette
 * les demandes de priorité audio d'une app qui n'est ni à l'écran ni dans un service au premier
 * plan (« AudioHardening focus request … ignored for com.yoannrolland.protocole »). Dès qu'Instagram
 * ou une autre app était devant, la musique et les vidéos continuaient donc par-dessus Jeffrey ;
 * avec PROTOCOLE à l'écran, ça marchait. D'où le côté aléatoire remonté par Yoann.
 *
 * Ce service, démarré par le réveil de fin de repos (setAlarmClock : Android autorise alors un
 * service au premier plan depuis l'arrière-plan), garde l'app en vie le temps du bip. Jusqu'au
 * 06/11/2026 il prenait aussi la priorité audio et jouait une phrase de Jeffrey : retiré le
 * 07/11/2026 (le bip coupait JEFFREY et la musique). Type mediaPlayback : le seul accepté pour
 * l'audio à partir d'Android 17.
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
        var foreground = true
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(NOTIF_ID, n)
        } catch (e: Exception) {
            Log.w(RestEndAudio.TAG, "service au premier plan refusé : ${e.javaClass.simpleName}")
            foreground = false
        }
        RestEndAudio.play(this) { stopSelf(startId) }
        // Premier plan refusé (audit du 10/11/2026, point 20) : le service s'arrête tout de suite,
        // sinon Android fait planter l'app quelques secondes plus tard (service demandé au premier
        // plan qui ne l'a jamais été). Le bip, lancé juste avant, joue quand même.
        if (!foreground) stopSelf(startId)
        return START_NOT_STICKY
    }

    companion object {
        const val NOTIF_ID = 5053
    }
}

/** Le bip seul. Utilisé par le service, et par le réveil lui-même si Android refuse le service. */
object RestEndAudio {
    const val TAG = "RestEndAudio"
    private const val SAFETY_MS = 9_500L // le réveil garde la main 10 s au plus (goAsync)

    /** Bip en cours, pour l'arrêter : `stop()`. */
    @Volatile private var stopCurrent: (() -> Unit)? = null

    /** Séance terminée ou abandonnée par JEFFREY (06/11/2026) : le bip en cours se tait. */
    fun stop() {
        val s = stopCurrent ?: return
        Handler(Looper.getMainLooper()).post { s() }
    }

    /**
     * Fin de repos = le bip seul, quelle que soit l'origine du repos (07/11/2026, demande de Yoann :
     * « Je ne veux plus que Jeffrey me parle à la fin du minuteur », « le bip se suffit à lui-même »,
     * « quand le bip sonne ça ne doit pas arrêter Jeffrey s'il est actif »). Aucune phrase, et AUCUNE
     * priorité audio : le bip se mêle au son en cours (JEFFREY, musique, vidéo) sans le couper.
     */
    fun play(context: Context, onFinished: () -> Unit) {
        val app = context.applicationContext
        val main = Handler(Looper.getMainLooper())
        val finished = AtomicBoolean(false)
        var player: MediaPlayer? = null
        // Le lecteur est toujours libéré, quelle que soit la fin (point 21) : fin du son, arrêt
        // demandé, garde de 9,5 s, ou erreur à la préparation.
        val end = {
            if (finished.compareAndSet(false, true)) {
                stopCurrent = null
                player?.let { p -> runCatching { if (p.isPlaying) p.stop() }; runCatching { p.release() } }
                player = null
                main.post { onFinished() }
            }
        }
        main.postDelayed({ end() }, SAFETY_MS)

        stopCurrent = { end() }

        try {
            val mp = MediaPlayer()
            player = mp
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
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                mp.setPreferredDevice(headset)
            } else {
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }
            // Volume divisé par deux (04/08/2026, demande explicite) : le son à pleine
            // intensité était trop fort en salle. Reste au-dessus du volume alarme/média du
            // téléphone (ce setVolume() n'est qu'une atténuation relative sur ce flux-là).
            mp.setVolume(0.5f, 0.5f)
            val afd = app.resources.openRawResourceFd(R.raw.alarm)
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.setOnCompletionListener { end() }
            mp.prepare()
            mp.start()
        } catch (_: Exception) {
            end()
        }
    }
}
