package com.yoannrolland.protocole

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Relais HTTP en flux pour Jeffrey (chantier J, J1.1, 29/10/2026). Le serveur LiteLLM ne répond
 * pas au CORS (les appels depuis la WebView échouent) et CapacitorHttp rend la réponse entière :
 * ce plugin fait la requête lui-même et relit la réponse SSE au fil de l'eau, en émettant un
 * événement `jeffreyStream` par événement SSE ({ id, event, data } — `data` en texte brut, le JS
 * le décode). L'appel se résout à la fin avec le nombre d'événements émis, pour que le JS
 * attende d'avoir tout reçu avant de clore. Le JS (`lib/jeffreyHttp.js`) fait le reste
 * (accumulation du message, coût) avec le code partagé de packages/core.
 */
@CapacitorPlugin(name = "JeffreyHttp")
class JeffreyHttpPlugin : Plugin() {

    private val pool = Executors.newCachedThreadPool()
    private val open = ConcurrentHashMap<String, HttpURLConnection>()

    @PluginMethod
    fun stream(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id manquant")
        val url = call.getString("url") ?: return call.reject("url manquante")
        val headers = call.getObject("headers") ?: JSObject()
        val body = call.getString("body") ?: ""
        pool.execute {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 15_000
                    readTimeout = 180_000 // Opus peut réfléchir longtemps avant le premier mot
                    headers.keys().forEach { k -> setRequestProperty(k, headers.getString(k)) }
                    setRequestProperty("accept", "text/event-stream")
                }
                open[id] = conn
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val status = conn.responseCode
                val cost = conn.getHeaderField("x-litellm-response-cost")
                if (status !in 200..299) {
                    val err = (conn.errorStream ?: conn.inputStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                    call.resolve(JSObject().put("status", status).put("errorBody", err).put("events", 0))
                    return@execute
                }
                var count = 0
                var event = "message"
                val data = StringBuilder()
                fun emit() {
                    if (data.isNotEmpty()) {
                        notifyListeners("jeffreyStream", JSObject().put("id", id).put("event", event).put("data", data.toString()))
                        count++
                    }
                    event = "message"
                    data.setLength(0)
                }
                conn.inputStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                    lines.forEach { line ->
                        when {
                            line.isEmpty() -> emit()
                            line.startsWith(":") -> Unit // battement de cœur
                            line.startsWith("event:") -> event = line.substring(6).trim()
                            line.startsWith("data:") -> {
                                if (data.isNotEmpty()) data.append('\n')
                                data.append(line.substring(5).removePrefix(" "))
                            }
                        }
                    }
                }
                emit()
                call.resolve(JSObject().put("status", status).put("events", count).put("cost", cost))
            } catch (e: Exception) {
                call.reject(e.message ?: "Erreur réseau", "NETWORK")
            } finally {
                open.remove(id)
                conn?.disconnect()
            }
        }
    }

    /** Interrompt une réponse en cours (Monsieur ferme la conversation, par exemple). */
    @PluginMethod
    fun cancel(call: PluginCall) {
        call.getString("id")?.let { open.remove(it)?.disconnect() }
        call.resolve()
    }
}
