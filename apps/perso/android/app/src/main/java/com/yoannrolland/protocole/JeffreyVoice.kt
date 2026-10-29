package com.yoannrolland.protocole

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.Locale

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
 * Voix de Jeffrey (chantier J, J3, 29/10/2026) : synthèse vocale d'Android, gratuite et hors ligne.
 * Un seul moteur pour l'app (plugin) et pour le brief lu app fermée (BriefRunner). Le son part sur
 * le flux « assistant » : dans le casque s'il est branché, sinon par le haut-parleur.
 */
object JeffreyTts {
    private var tts: TextToSpeech? = null
    private var ready = false
    private val waiting = mutableListOf<() -> Unit>()
    private val doneCallbacks = mutableMapOf<String, () -> Unit>()
    private val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    // La musique de la séance baisse le temps qu'il parle, puis reprend.
    private var focus: AudioFocusRequest? = null

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

    private fun withEngine(context: Context, block: (TextToSpeech) -> Unit) {
        val t = tts
        if (t != null && ready) return block(t)
        waiting += { tts?.let(block) }
        if (t != null) return
        tts = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            tts?.setAudioAttributes(attrs)
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String) {}
                override fun onDone(id: String) { doneCallbacks.remove(id)?.invoke() }
                @Deprecated("Deprecated in Java")
                override fun onError(id: String) { doneCallbacks.remove(id)?.invoke() }
                override fun onStop(id: String, interrupted: Boolean) { doneCallbacks.remove(id)?.invoke() }
            })
            val pending = waiting.toList()
            waiting.clear()
            if (ready) pending.forEach { it() } else { tts = null }
        }
    }

    /** Voix françaises installées, hors ligne seulement (celles « réseau » doublent les locales et
     *  se taisent sans connexion, à la salle par exemple), France d'abord : (name, label, local). */
    fun voices(context: Context, result: (List<Triple<String, String, Boolean>>) -> Unit) = withEngine(context) { t ->
        val fr = (t.voices ?: emptySet()).filter { it.locale.language == "fr" && !it.isNetworkConnectionRequired }
            .sortedWith(compareBy({ it.locale.country != "FR" }, { it.name }))
        result(fr.map { v -> Triple(v.name, "${v.locale.getDisplayCountry(Locale.FRENCH)} · ${nice(v.name)}", true) })
    }

    /** « fr-fr-x-frb-local » → « voix B », « fr-fr-x-star02-local » → « voix 2 ». */
    private fun nice(name: String): String {
        Regex("-x-[a-z]{2}([a-z])-").find(name)?.let { return "voix " + it.groupValues[1].uppercase() }
        Regex("star(\\d+)").find(name)?.let { return "voix " + it.groupValues[1].trimStart('0') }
        if (name.endsWith("-language")) return "standard"
        return name
    }

    /** Lit `text` par paragraphes ; `onDone` à la fin (ou si la lecture est interrompue). */
    fun speak(context: Context, text: String, voice: String?, rate: Float, pitch: Float, onDone: () -> Unit = {}) = withEngine(context) { t ->
        t.stop()
        val chosen = (t.voices ?: emptySet()).firstOrNull { it.name == voice }
        if (chosen != null) t.voice = chosen else t.language = Locale.FRANCE
        t.setSpeechRate(rate)
        t.setPitch(pitch)
        val max = TextToSpeech.getMaxSpeechInputLength() - 1
        val parts = text.split(Regex("\\n+")).map { it.trim() }.filter { it.isNotEmpty() }.flatMap { it.chunked(max) }
        if (parts.isEmpty()) return@withEngine onDone()
        val stamp = System.currentTimeMillis()
        val last = "jeffrey-$stamp-${parts.size - 1}"
        duck(context)
        // Une lecture interrompue rappelle aussi son onDone (onStop) ; le son ne remonte qu'une
        // fois la dernière lecture en cours terminée.
        doneCallbacks[last] = { onDone(); if (doneCallbacks.isEmpty()) release(context) }
        parts.forEachIndexed { i, p ->
            t.speak(p, if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, Bundle(), "jeffrey-$stamp-$i")
        }
    }

    fun stop() { tts?.stop() }
}

/**
 * Pont JS « JeffreyVoice » (J3) : dictée (reconnaissance vocale d'Android, français, résultats
 * partiels en direct par l'événement `voicePartial`), lecture à voix haute, voix installées,
 * casque connecté. Permission micro demandée à la première dictée.
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
            JeffreyTts.stop()
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

    @PluginMethod
    fun voices(call: PluginCall) {
        JeffreyTts.voices(context) { list ->
            val arr = JSArray()
            list.forEach { (name, label, local) -> arr.put(JSObject().put("name", name).put("label", label).put("local", local)) }
            call.resolve(JSObject().put("voices", arr))
        }
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text") ?: return call.reject("texte manquant")
        JeffreyTts.speak(context, text, call.getString("voice"), call.getFloat("rate", 1f) ?: 1f, call.getFloat("pitch", 1f) ?: 1f) {
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        JeffreyTts.stop()
        call.resolve()
    }

    @PluginMethod
    fun headset(call: PluginCall) {
        call.resolve(JSObject().put("connected", Headset.connected(context) != null))
    }
}
