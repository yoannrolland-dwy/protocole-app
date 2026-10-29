package com.yoannrolland.protocole

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.PlaybackParams
import android.os.Bundle
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/** Casque connecté (filaire USB-C, jack, Bluetooth) — règle unique pour le minuteur de repos
 *  (RestAlarmReceiver) et la voix de Jeffrey. Détecte un casque CONNECTÉ, pas porté. */
object Headset {
    private val TYPES = setOf(
        // Pas de prise jack sur ce téléphone : un casque filaire y est vu en USB (constaté le 29/07/2026).
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    )

    fun connected(context: Context): AudioDeviceInfo? {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return null
        return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.type in TYPES }
    }
}

/**
 * Voix de Jeffrey (29/10/2026) : Pocket TTS français sur la VM Oracle, via LiteLLM
 * (`POST {url}/v1/audio/speech`, modèle `protocole/jeffrey`, voix `jeffrey`). Remplace la synthèse
 * d'Android (J3). Le serveur rend du PCM signé 16 bits, 24 kHz, mono, en flux, à vitesse 1,00 ;
 * le lecteur (AudioTrack en flux) applique la vitesse choisie (1,20) sans changer la hauteur.
 *
 * Une seule session à la fois, une seule synthèse active : les phrases d'une session partent l'une
 * après l'autre, l'audio de la suivante s'empile dans le tampon du lecteur pendant que la
 * précédente se joue. Arrêter = couper la requête HTTP, vider le lecteur, attendre la fin du fil.
 * Sortie : flux « assistant », donc casque s'il est branché, sinon haut-parleur ; la musique baisse
 * le temps qu'il parle. Cache : le PCM d'un texte entièrement reçu est gardé (filesDir), relu sans
 * réseau ; un son incomplet n'est jamais gardé. La clé n'apparaît dans aucun journal.
 */
object JeffreySpeech {
    private const val TAG = "JeffreySpeech"
    private const val MODEL = "protocole/jeffrey"
    private const val VOICE = "jeffrey"
    private const val RATE = 24_000
    private const val CACHE_DIR = "jeffrey-voice"
    private const val CACHE_MAX_BYTES = 60L * 1024 * 1024
    private const val END = "\u0000fin"
    // Son reçu avant de lancer la lecture. Adaptatif : +200 ms après une session qui a manqué de
    // son, −50 ms après une session sans manque (entre 300 ms et 1,5 s).
    @Volatile private var prebufferMs = 300

    private val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    private var focus: AudioFocusRequest? = null

    class Config(val url: String, val key: String, val speed: Float)

    private class Session(val id: String, val config: Config, val play: Boolean, val cacheKey: String?, val onDone: (JSONObject) -> Unit) {
        val queue = LinkedBlockingQueue<String>()
        @Volatile var cancelled = false
        @Volatile var done = false
        @Volatile var conn: HttpURLConnection? = null
        @Volatile var track: AudioTrack? = null
        var thread: Thread? = null
    }

    @Volatile private var current: Session? = null

    private fun duck(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val req = focus ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attrs).build().also { focus = it }
        am.requestAudioFocus(req)
    }

    private fun release(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        focus?.let { am.abandonAudioFocusRequest(it) }
    }

    fun cacheFile(context: Context, key: String) = File(File(context.filesDir, CACHE_DIR), "$key.pcm")
    fun hasCache(context: Context, key: String) = cacheFile(context, key).length() > 0

    /** Une session joue ou prépare déjà quelque chose. */
    fun busy() = current?.let { !it.done && !it.cancelled } == true

    /**
     * Nouvelle session (arrête la précédente). `chunks` : premières phrases ; `final` : rien
     * d'autre à venir. `play` faux : préparer le cache sans rien jouer. Si `cacheKey` est déjà en
     * cache, le fichier est joué et les phrases ignorées.
     */
    @Synchronized
    fun begin(context: Context, id: String, config: Config, play: Boolean, cacheKey: String?, chunks: List<String>, final: Boolean, onDone: (JSONObject) -> Unit) {
        stopCurrent()
        val s = Session(id, config, play, cacheKey, onDone)
        chunks.forEach { s.queue.offer(it) }
        if (final) s.queue.offer(END)
        current = s
        val app = context.applicationContext
        s.thread = Thread({ run(app, s) }, "jeffrey-speech").also { it.start() }
    }

    fun push(id: String, chunks: List<String>) {
        current?.takeIf { it.id == id && !it.cancelled }?.let { s -> chunks.forEach { s.queue.offer(it) } }
    }

    fun finish(id: String) {
        current?.takeIf { it.id == id }?.queue?.offer(END)
    }

    @Synchronized
    fun stop() = stopCurrent()

    private fun stopCurrent() {
        val s = current ?: return
        current = null
        s.cancelled = true
        s.queue.clear()
        s.queue.offer(END)
        runCatching { s.conn?.disconnect() }
        runCatching { s.track?.let { it.pause(); it.flush() } }
        runCatching { s.thread?.join(1_500) }
    }

    private fun buildTrack(speed: Float): AudioTrack {
        val fmt = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build()
        val min = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        // Deux secondes de son : de quoi garder la phrase suivante d'avance sans bloquer la requête.
        val size = maxOf(min, RATE * 2 * 2)
        val t = AudioTrack.Builder()
            .setAudioAttributes(attrs)
            .setAudioFormat(fmt)
            .setBufferSizeInBytes(size)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        // Tempo sans changer la hauteur de la voix.
        t.playbackParams = PlaybackParams().setSpeed(speed).setPitch(1f)
        return t
    }

    private fun run(context: Context, s: Session) {
        val t0 = SystemClock.elapsedRealtime()
        var firstByte = -1L
        var firstAudio = -1L
        var frames = 0L
        var playing = false
        var underruns = 0
        var error: String? = null
        var track: AudioTrack? = null
        val cache = s.cacheKey?.let { cacheFile(context, it) }
        val fromCache = cache != null && cache.length() > 0
        val part = if (cache != null && !fromCache) File(cache.parentFile, "${cache.name}.part") else null
        var out: OutputStream? = null
        val prebufferFrames = RATE * prebufferMs / 1000
        try {
            if (s.play) {
                track = buildTrack(s.config.speed)
                s.track = track
                duck(context)
            }
            if (part != null) {
                part.parentFile?.mkdirs()
                out = BufferedOutputStream(FileOutputStream(part))
            }
            val sink: (ByteArray, Int) -> Unit = { buf, len ->
                if (firstByte < 0) firstByte = SystemClock.elapsedRealtime() - t0
                out?.write(buf, 0, len)
                frames += len / 2
                val t = track
                if (t != null) {
                    var off = 0
                    while (off < len && !s.cancelled) {
                        val w = t.write(buf, off, len - off)
                        if (w < 0) throw IOException("lecteur audio ($w)")
                        off += w
                    }
                    if (!playing && !s.cancelled && frames >= prebufferFrames) {
                        t.play(); playing = true; firstAudio = SystemClock.elapsedRealtime() - t0
                    }
                }
            }
            if (fromCache) readFile(cache!!, s, sink)
            else while (!s.cancelled) {
                val text = s.queue.poll(90, TimeUnit.SECONDS) ?: throw IOException("aucune phrase reçue")
                if (text == END) break
                synthesize(s, text, sink)
            }
            if (!s.cancelled) {
                out?.close(); out = null
                if (part != null && cache != null && frames > 0 && part.renameTo(cache)) prune(cache.parentFile!!)
                val t = track
                if (t != null && frames > 0) {
                    if (!playing) { t.play(); playing = true; firstAudio = SystemClock.elapsedRealtime() - t0 }
                    drain(t, frames, s)
                }
            }
        } catch (e: Exception) {
            if (!s.cancelled) error = e.message ?: e.javaClass.simpleName
        } finally {
            runCatching { out?.close() }
            if (part != null && part.exists()) part.delete()
            track?.let { t ->
                underruns = runCatching { t.underrunCount }.getOrDefault(0)
                runCatching { t.pause(); t.flush(); t.stop() }
                runCatching { t.release() }
            }
            s.track = null
            if (s.play) release(context)
            s.done = true
            if (s.play && !s.cancelled && error == null) {
                prebufferMs = if (underruns > 0) minOf(1_500, prebufferMs + 200) else maxOf(300, prebufferMs - 50)
            }
            val res = JSONObject()
                .put("id", s.id).put("ok", error == null && !s.cancelled).put("cancelled", s.cancelled)
                .put("cached", fromCache).put("firstByteMs", firstByte).put("firstAudioMs", firstAudio)
                .put("underruns", underruns).put("seconds", frames.toDouble() / RATE).put("prebufferMs", prebufferFrames * 1000 / RATE)
            if (error != null) res.put("error", error)
            Log.i(TAG, "session ${s.id} : ok=${error == null && !s.cancelled} annulée=${s.cancelled} cache=$fromCache " +
                "premier octet=${firstByte} ms premier son=${firstAudio} ms coupures=$underruns durée=${"%.1f".format(frames.toDouble() / RATE)} s" +
                (error?.let { " erreur=$it" } ?: ""))
            runCatching { s.onDone(res) }
        }
    }

    /** Une phrase : requête HTTP, PCM lu au fil de l'eau. Une seule reprise, sur 429 seulement. */
    private fun synthesize(s: Session, text: String, sink: (ByteArray, Int) -> Unit) {
        var attempt = 0
        while (!s.cancelled) {
            val conn = (URL("${s.config.url}/v1/audio/speech").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 30_000 // le serveur rend 429 au-delà de 20 s d'attente
                setRequestProperty("Authorization", "Bearer ${s.config.key}")
                setRequestProperty("Content-Type", "application/json")
            }
            s.conn = conn
            try {
                val body = JSONObject().put("model", MODEL).put("voice", VOICE).put("input", text)
                    .put("response_format", "pcm").put("speed", 1.0)
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val status = conn.responseCode
                if (status == 429 && attempt == 0) {
                    val wait = conn.getHeaderField("Retry-After")?.toLongOrNull()?.coerceIn(1, 5) ?: 2
                    runCatching { conn.errorStream?.close() }
                    attempt++
                    Thread.sleep(wait * 1_000)
                    continue
                }
                if (status !in 200..299) throw IOException("serveur vocal HTTP $status")
                val input = conn.inputStream
                val raw = ByteArray(8_192)
                val buf = ByteArray(8_194)
                var carry = -1 // octet isolé : les blocs réseau ne tombent pas sur des échantillons entiers
                while (!s.cancelled) {
                    val n = input.read(raw)
                    if (n < 0) break
                    var len = 0
                    if (carry >= 0) { buf[0] = carry.toByte(); len = 1; carry = -1 }
                    System.arraycopy(raw, 0, buf, len, n)
                    len += n
                    if (len % 2 == 1) { carry = buf[len - 1].toInt() and 0xff; len-- }
                    if (len > 0) sink(buf, len)
                }
                return
            } finally {
                s.conn = null
                conn.disconnect()
            }
        }
    }

    private fun readFile(file: File, s: Session, sink: (ByteArray, Int) -> Unit) {
        FileInputStream(file).use { input ->
            val buf = ByteArray(8_192)
            while (!s.cancelled) {
                val n = input.read(buf)
                if (n < 0) break
                val even = n - (n % 2)
                if (even > 0) sink(buf, even)
            }
        }
    }

    /** Attend la fin de la lecture (tête de lecture au bout du son écrit), avec un plafond. */
    private fun drain(t: AudioTrack, frames: Long, s: Session) {
        val deadline = SystemClock.elapsedRealtime() + (frames * 1000 / RATE / s.config.speed).toLong() + 3_000
        while (!s.cancelled && SystemClock.elapsedRealtime() < deadline) {
            val head = t.playbackHeadPosition.toLong() and 0xffffffffL
            if (head >= frames - RATE / 50) break
            Thread.sleep(30)
        }
    }

    /** Garde le cache sous 60 Mo : les fichiers les plus anciens partent d'abord. */
    private fun prune(dir: File) {
        val files = dir.listFiles { f -> f.name.endsWith(".pcm") }?.sortedByDescending { it.lastModified() } ?: return
        var total = 0L
        files.forEach { f -> total += f.length(); if (total > CACHE_MAX_BYTES) f.delete() }
    }
}

/**
 * Pont JS « JeffreyVoice » (J3) : dictée (reconnaissance vocale d'Android, français, résultats
 * partiels en direct par l'événement `voicePartial`), voix de Jeffrey (JeffreySpeech, serveur
 * Oracle), casque connecté. Permission micro demandée à la première dictée.
 */
@CapacitorPlugin(
    name = "JeffreyVoice",
    permissions = [Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO])],
)
class JeffreyVoicePlugin : Plugin() {
    private var recognizer: SpeechRecognizer? = null

    @PluginMethod
    fun listen(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermission")
            return
        }
        startListening(call)
    }

    @PermissionCallback
    private fun micPermission(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) startListening(call)
        else call.reject("micro refusé", "denied")
    }

    private fun startListening(call: PluginCall) {
        activity.runOnUiThread {
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                call.reject("reconnaissance vocale indisponible", "unavailable")
                return@runOnUiThread
            }
            JeffreySpeech.stop()
            recognizer?.destroy()
            val r = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer = r
            var finished = false
            val end: (JSObject?, String?) -> Unit = { ok, err ->
                if (!finished) {
                    finished = true
                    if (ok != null) call.resolve(ok) else call.reject(err ?: "erreur")
                    r.destroy()
                    if (recognizer === r) recognizer = null
                }
            }
            r.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { notifyListeners("voiceState", JSObject().put("state", "listening")) }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { notifyListeners("voiceState", JSObject().put("state", "processing")) }
                override fun onEvent(eventType: Int, params: Bundle?) {}
                override fun onPartialResults(partial: Bundle?) {
                    val t = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    notifyListeners("voicePartial", JSObject().put("text", t))
                }
                override fun onResults(results: Bundle?) {
                    end(JSObject().put("text", results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""), null)
                }
                override fun onError(error: Int) {
                    // Rien entendu : pas une erreur à afficher, juste une dictée vide.
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) end(JSObject().put("text", ""), null)
                    else end(null, "dictée impossible (code $error)")
                }
            })
            r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            })
        }
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        activity.runOnUiThread { recognizer?.stopListening() }
        call.resolve()
    }

    /** Démarre une session de voix : { id, url, key, speed, play, final, chunks, cacheKey }.
     *  Fin signalée par l'événement `speechDone` ({ id, ok, cancelled, cached, firstByteMs,
     *  firstAudioMs, underruns, seconds, error }). Une préparation (play: false) est ignorée si une
     *  voix joue déjà : elle ne doit jamais couper Monsieur. */
    @PluginMethod
    fun speechBegin(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id manquant")
        val url = call.getString("url")?.trimEnd('/') ?: return call.reject("adresse manquante")
        val key = call.getString("key") ?: return call.reject("clé manquante")
        val play = call.getBoolean("play", true) ?: true
        if (!play && JeffreySpeech.busy()) return call.resolve(JSObject().put("skipped", true))
        val chunks = runCatching { call.getArray("chunks")?.toList<String>() }.getOrNull() ?: emptyList()
        JeffreySpeech.begin(
            context, id, JeffreySpeech.Config(url, key, call.getFloat("speed", 1.2f) ?: 1.2f), play,
            call.getString("cacheKey"), chunks, call.getBoolean("final", true) ?: true,
        ) { res -> notifyListeners("speechDone", JSObject(res.toString())) }
        call.resolve()
    }

    /** Phrases suivantes d'une session en cours (réponse qui s'écrit). */
    @PluginMethod
    fun speechPush(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id manquant")
        JeffreySpeech.push(id, runCatching { call.getArray("chunks")?.toList<String>() }.getOrNull() ?: emptyList())
        call.resolve()
    }

    /** Plus de phrases à venir : la session se termine quand tout est dit. */
    @PluginMethod
    fun speechFinish(call: PluginCall) {
        call.getString("id")?.let { JeffreySpeech.finish(it) }
        call.resolve()
    }

    @PluginMethod
    fun speechStop(call: PluginCall) {
        JeffreySpeech.stop()
        call.resolve()
    }

    @PluginMethod
    fun speechCached(call: PluginCall) {
        val key = call.getString("key") ?: return call.resolve(JSObject().put("exists", false))
        call.resolve(JSObject().put("exists", JeffreySpeech.hasCache(context, key)))
    }

    @PluginMethod
    fun headset(call: PluginCall) {
        call.resolve(JSObject().put("connected", Headset.connected(context) != null))
    }
}
