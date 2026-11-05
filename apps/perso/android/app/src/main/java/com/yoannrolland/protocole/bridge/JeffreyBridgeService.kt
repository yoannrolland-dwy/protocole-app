package com.yoannrolland.protocole.bridge

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.RemoteException
import android.os.SystemClock
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.yoannrolland.protocole.BriefService
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Pont privé PROTOCOLE → JEFFREY, étape G1 (lecture seule, 05/11/2026). Cadrage et contrat :
 * jeffrey-app, docs/cadrage/ETAPE_G_PONT_PROTOCOLE.md (§6).
 *
 * Service lié, exporté, protégé par la permission `JEFFREY_BRIDGE` (niveau signature : seule une
 * appli signée par la même clé peut se lier). Échange par `Messenger` :
 * - question (`what` = 1) : Bundle { op, id, json } ; `replyTo` obligatoire ;
 * - réponse (`what` = 2) : Bundle { id, ok, json } ou { id, ok = false, erreur } — un code court
 *   (occupe, inconnu, delai, ia_absente, ia_echec, interne, trop_long), jamais un texte technique
 *   ni une donnée. Réponse de 200 000 caractères au plus (sinon `trop_long`).
 * Opérations : `version`, `lire` (20 s), `analyse` (90 s) — G1 ; `brief_fait` (20 s) — G2 ; `agir` (20 s) — G3.
 * Une seule requête à la fois
 * (sinon `occupe`). Tout le calcul se fait en JavaScript, dans la page sans écran `bridge.html`
 * (même origine que l'app, donc même stockage, même code `packages/core`).
 */
class JeffreyBridgeService : Service() {
    companion object {
        const val MSG_QUESTION = 1
        const val MSG_REPONSE = 2
        private const val TAG = "JeffreyBridge"
        private val OPS = setOf("version", "lire", "analyse", "brief_fait", "agir")
        private const val LIRE_MS = 20_000L
        private const val ANALYSE_MS = 90_000L
        // Limite du Binder : au-delà, `trop_long` plutôt qu'une transaction qui échoue.
        private const val MAX_CHARS = 200_000
    }

    private var busy = false // fil principal seulement

    private val messenger = Messenger(object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(msg: Message) = onQuestion(msg)
    })

    override fun onBind(intent: Intent?): IBinder = messenger.binder

    private fun onQuestion(msg: Message) {
        val to = msg.replyTo ?: return
        // Deuxième verrou après la permission signature : l'appelant doit être signé comme nous.
        if (packageManager.checkSignatures(msg.sendingUid, android.os.Process.myUid()) != PackageManager.SIGNATURE_MATCH) {
            Log.w(TAG, "appelant refusé")
            return
        }
        val data = msg.data
        val id = data.getString("id") ?: ""
        val op = data.getString("op") ?: ""
        val json = data.getString("json") ?: "{}"
        if (msg.what != MSG_QUESTION || op !in OPS) return reply(to, id, null, "inconnu")
        if (busy) return reply(to, id, null, "occupe")
        busy = true
        val t0 = SystemClock.elapsedRealtime()
        BridgePage.run(applicationContext, op, json, if (op == "analyse") ANALYSE_MS else LIRE_MS) { result ->
            busy = false
            // G3 : la page a pu écrire (agir, analyse, brief_fait) ; l'app ouverte relit ses données.
            com.yoannrolland.protocole.ExternalWrites.notifyApp()
            val r = runCatching { JSONObject(result) }.getOrNull()
            val ok = r?.optBoolean("ok") == true
            val code = if (ok) null else (r?.optString("erreur")?.ifEmpty { null } ?: "interne")
            // Journal : opération, issue, durée. Jamais le contenu.
            Log.i(TAG, "$op → ${code ?: "ok"} en ${SystemClock.elapsedRealtime() - t0} ms")
            val out = if (ok) r?.opt("json")?.toString() ?: "{}" else null
            if (out != null && out.length > MAX_CHARS) reply(to, id, null, "trop_long") else reply(to, id, out, code)
        }
    }

    private fun reply(to: Messenger, id: String, json: String?, erreur: String?) {
        val m = Message.obtain(null, MSG_REPONSE)
        m.data = Bundle().apply {
            putString("id", id)
            putBoolean("ok", erreur == null)
            if (erreur == null) putString("json", json ?: "{}") else putString("erreur", erreur)
        }
        try { to.send(m) } catch (e: RemoteException) { Log.w(TAG, "client parti avant la réponse") }
    }
}

/**
 * Page sans écran `bridge.html`, une requête à la fois (même mécanisme que BriefRunner : WebView
 * jamais affichée, fichiers de l'app servis depuis assets/public à l'origine https://localhost).
 * `done` reçoit le JSON rendu par la page ({ ok, json } / { ok: false, erreur }), sur le fil
 * principal, une seule fois (délai dépassé = `delai`).
 */
object BridgePage {
    private const val TAG = "JeffreyBridge"
    private val pool = Executors.newCachedThreadPool()

    fun run(context: Context, op: String, json: String, timeoutMs: Long, done: (String) -> Unit) {
        val handler = Handler(Looper.getMainLooper())
        handler.post { start(context, handler, op, json, timeoutMs, done) }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun start(context: Context, handler: Handler, op: String, json: String, timeoutMs: Long, done: (String) -> Unit) {
        val finished = AtomicBoolean(false)
        val web = WebView(context)
        val keepAlive = AtomicBoolean(false)
        val complete: (String) -> Unit = { result ->
            if (finished.compareAndSet(false, true)) {
                handler.post {
                    web.destroy()
                    if (keepAlive.get()) context.stopService(Intent(context, BriefService::class.java))
                    done(result)
                }
            }
        }
        handler.postDelayed({ complete("{\"ok\":false,\"erreur\":\"delai\"}") }, timeoutMs)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.addJavascriptInterface(PageInterface(context, handler, web, op, json, finished, keepAlive, complete), "JeffreyBridgePage")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host != "localhost") return null
                val path = url.path?.trimStart('/')?.ifEmpty { "index.html" } ?: "index.html"
                return try {
                    WebResourceResponse(mime(path), "utf-8", context.assets.open("public/$path"))
                } catch (e: Exception) {
                    WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
            }
        }
        web.loadUrl("https://localhost/bridge.html")
    }

    private fun mime(path: String) = when (path.substringAfterLast('.', "")) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "woff2" -> "font/woff2"
        else -> "application/octet-stream"
    }

    /** Ce que la page voit sous `window.JeffreyBridgePage`. */
    private class PageInterface(
        private val context: Context, private val handler: Handler, private val web: WebView,
        private val op: String, private val json: String, private val finished: AtomicBoolean,
        private val keepAlive: AtomicBoolean, private val complete: (String) -> Unit,
    ) {
        @JavascriptInterface fun request(): String = JSONObject().put("op", op).put("json", json).toString()

        @JavascriptInterface fun finish(result: String) = complete(result)

        /** G4-C3 : repos lancé à la voix. `json` = { endAt, label, voice? } ; endAt null = arrêter. */
        @JavascriptInterface fun restAlarm(json: String) {
            try {
                val o = JSONObject(json)
                if (o.isNull("endAt")) com.yoannrolland.protocole.RestTimerPlugin.cancelFromBridge(context)
                else com.yoannrolland.protocole.RestTimerPlugin.scheduleFromBridge(
                    context, o.getLong("endAt"), o.optString("label"), if (o.isNull("voice")) null else o.optJSONObject("voice")?.toString(),
                )
            } catch (e: Exception) {
                Log.w(TAG, "repos non programmé : ${e.javaClass.simpleName}")
            }
        }

        /** G3 : réglage « brief du matin » Activé / Désactivé (genou noté par JEFFREY). */
        @JavascriptInterface fun briefEnabled(): Boolean = com.yoannrolland.protocole.BriefScheduler.enabled(context)

        /** Analyse : service au premier plan le temps de l'appel (réseau en économie
         *  d'énergie). Refusé par Android : on continue sans, l'appli JEFFREY est au premier plan. */
        @JavascriptInterface fun keepAlive() {
            try {
                androidx.core.content.ContextCompat.startForegroundService(
                    context, Intent(context, BriefService::class.java).putExtra("text", "Jeffrey prépare votre analyse, Monsieur."),
                )
                keepAlive.set(true)
            } catch (e: Exception) {
                Log.w(TAG, "service au premier plan refusé")
            }
        }

        /** POST relayé (LiteLLM ne répond pas au CORS) ; la réponse revient entière à la page. */
        @JavascriptInterface fun http(id: String, url: String, headersJson: String, body: String) {
            pool.execute {
                var status = -1
                var text = ""
                try {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"; doOutput = true; connectTimeout = 15_000; readTimeout = 85_000
                        val h = JSONObject(headersJson)
                        h.keys().forEach { setRequestProperty(it, h.getString(it)) }
                    }
                    conn.outputStream.use { it.write(body.toByteArray()) }
                    status = conn.responseCode
                    text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "http : ${e.javaClass.simpleName}")
                    text = "erreur réseau"
                }
                handler.post {
                    if (!finished.get()) web.evaluateJavascript("window.__briefHttpDone(${JSONObject.quote(id)}, $status, ${JSONObject.quote(text)})", null)
                }
            }
        }
    }
}
