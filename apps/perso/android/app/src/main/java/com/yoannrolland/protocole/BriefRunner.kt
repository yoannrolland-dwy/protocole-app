package com.yoannrolland.protocole

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Brief du matin de Jeffrey, app fermée (chantier J, J4.1, 29/10/2026 ; architecture validée par
 * J0, voir ROADMAP.md). À chaque réveil : lecture Health Connect (nuit, pesée, FC repos) ici en
 * Kotlin, puis chargement de la page `brief.html` de l'app dans une WebView jamais affichée, à la
 * même origine que l'app (https://localhost, donc même stockage). La page décide et écrit le
 * brief (packages/core/src/coach/brief.js, src/briefPage.js) ; elle rend la main par `finish` avec
 * la notification à afficher et l'heure du prochain réveil. Toute la logique reste en JavaScript.
 */
object BriefRunner {
    private const val TAG = "JeffreyBrief"
    const val CHANNEL = "jeffrey"
    const val NOTIF_ID = 5050
    // Service au premier plan (BriefService) : identifiant à part, pour que son arrêt n'efface
    // jamais la notification de la conversation (J4.3).
    const val SERVICE_NOTIF_ID = 5052
    private const val THREAD_PREFS = "jeffrey_thread"
    // Un réveil en arrière-plan dispose d'environ une minute (goAsync) : on rend la main avant.
    private const val TIMEOUT_MS = 55_000L
    private val pool = Executors.newCachedThreadPool()

    fun run(context: Context, done: () -> Unit) {
        val app = context.applicationContext
        CoroutineScope(Dispatchers.Main).launch {
            val health = withContext(Dispatchers.IO) { readHealth(app) }
            startPage(app, health, null, done)
        }
    }

    /** Réponse de Monsieur depuis la notification (J4.3) : la page répond (`?mode=reply`) avec
     *  `payload` ({ kind: text | quick | confirm, … }), puis rend le fil à afficher. */
    fun runReply(context: Context, payload: String, done: () -> Unit) {
        val app = context.applicationContext
        CoroutineScope(Dispatchers.Main).launch { startPage(app, "{}", payload, done) }
    }

    /** Nuit, pesée et FC repos des deux derniers jours, au format de healthSync.js. "{}" si
     *  Health Connect est indisponible ou si la lecture en arrière-plan n'est pas accordée. */
    private suspend fun readHealth(context: Context): String = try {
        val hc = WidgetStepsRefresher.client(context)
        if (hc == null || !WidgetStepsRefresher.backgroundSupported(hc) ||
            WidgetStepsRefresher.BACKGROUND_PERMISSION !in hc.permissionController.getGrantedPermissions()) "{}"
        else {
            val zone = ZoneId.systemDefault()
            val range = TimeRangeFilter.between(LocalDate.now(zone).minusDays(2).atStartOfDay(zone).toInstant(), Instant.now())
            val out = JSONObject()
            runCatching { out.put("sleep", HealthReads.sleep(hc, range)) }.onFailure { Log.w(TAG, "nuit", it) }
            runCatching { out.put("weight", HealthReads.weight(hc, range)) }.onFailure { Log.w(TAG, "pesée", it) }
            runCatching { out.put("rhr", HealthReads.restingHr(hc, range)) }.onFailure { Log.w(TAG, "FC repos", it) }
            out.toString()
        }
    } catch (e: Exception) {
        Log.w(TAG, "Health Connect", e); "{}"
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun startPage(context: Context, health: String, payload: String?, done: () -> Unit) {
        val handler = Handler(Looper.getMainLooper())
        val finished = AtomicBoolean(false)
        val web = WebView(context)
        val finish: (String) -> Unit = { json ->
            if (finished.compareAndSet(false, true)) {
                handler.post {
                    val stop = { context.stopService(Intent(context, BriefService::class.java)) }
                    runCatching { handleResult(context, json) }.onFailure {
                        Log.e(TAG, "résultat", it)
                        BriefScheduler.schedule(context, System.currentTimeMillis() + 20 * 60_000)
                    }
                    web.destroy()
                    // Voix (29/10/2026) : le brief est préparé en audio juste après sa notification
                    // (serveur Oracle), gardé sur le téléphone pour être écouté sans attendre ni
                    // réseau. Lu tout de suite si un casque est branché (31/10/2026 : casque = Jeffrey parle).
                    // Le service au premier plan garde l'app (et le réseau) le temps de la synthèse.
                    val voice = runCatching { voiceOf(json) }.getOrNull()
                    if (voice != null) {
                        handler.postDelayed({ stop() }, 150_000)
                        val arr = voice.getJSONArray("chunks")
                        val chunks = (0 until arr.length()).map { arr.getString(it) }
                        val play = voice.optBoolean("play") && Headset.connected(context) != null
                        JeffreySpeech.begin(
                            context, "brief-${System.currentTimeMillis()}",
                            JeffreySpeech.Config(voice.getString("url").trimEnd('/'), voice.getString("key"), voice.optDouble("speed", 1.2).toFloat()),
                            play, voice.optString("cacheKey").ifEmpty { null }, chunks, true,
                        ) { handler.post { stop() } }
                    } else stop()
                    done()
                }
            }
        }
        handler.postDelayed({ finish("{\"error\":\"délai dépassé\",\"nextAt\":${System.currentTimeMillis() + 5 * 60_000}}") }, TIMEOUT_MS)

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.addJavascriptInterface(Bridge(context, health, payload ?: "{}", web, handler, finish), "BriefBridge")
        web.webViewClient = object : WebViewClient() {
            // Fichiers de l'app servis depuis assets/public (comme Capacitor), à la même origine.
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
        web.loadUrl(if (payload != null) "https://localhost/brief.html?mode=reply" else "https://localhost/brief.html")
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

    /** Voix du brief préparée par la page : { url, key, speed, chunks, cacheKey, play } ou null. */
    private fun voiceOf(json: String): JSONObject? {
        val v = JSONObject(json).optJSONObject("notify")?.optJSONObject("voice") ?: return null
        if (v.optString("url").isBlank() || v.optString("key").isBlank() || (v.optJSONArray("chunks")?.length() ?: 0) == 0) return null
        return v
    }

    /** Ce que la page rend : { notify: { kind, text, alert, spec?, voice? } | null, nextAt? } ou
     *  { error, nextAt? }. `spec` : notification de conversation (J4.3, voir postThread). */
    private fun handleResult(context: Context, json: String) {
        val r = JSONObject(json)
        if (r.has("error")) Log.w(TAG, "page : ${r.optString("error")}")
        val n = r.optJSONObject("notify")
        val spec = n?.optJSONObject("spec")
        if (spec != null) postThread(context, spec.toString(), n.optBoolean("alert"))
        else if (n != null) post(context, n.optString("text"), n.optBoolean("alert"))
        else if (!r.has("error")) NotificationManagerCompat.from(context).cancel(NOTIF_ID)
        // Une réponse depuis la notification ne touche pas aux réveils du brief.
        if (r.has("nextAt")) BriefScheduler.schedule(context, r.optLong("nextAt"))
    }

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Jeffrey", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Brief du matin et messages de Jeffrey"
            })
        }
    }

    /** Une seule notification Jeffrey, mise à jour sur place. `alert` : sonne (relance de 9 h,
     *  brief) ; sinon mise à jour silencieuse. Un tap ouvre la conversation dans l'app. */
    fun post(context: Context, text: String, alert: Boolean, ongoing: Boolean = false) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        ensureChannel(context)
        val open = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("open_tab", "jeffrey")
        val pi = PendingIntent.getActivity(context, NOTIF_ID, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Jeffrey")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(!ongoing)
            .setOngoing(ongoing)
            .setSilent(!alert)
            .build()
        try { NotificationManagerCompat.from(context).notify(NOTIF_ID, n) } catch (e: SecurityException) { Log.w(TAG, "notification", e) }
    }

    fun storedSpec(context: Context): JSONObject? =
        context.getSharedPreferences(THREAD_PREFS, Context.MODE_PRIVATE).getString("spec", null)
            ?.let { runCatching { JSONObject(it) }.getOrNull() }

    private fun openIntent(context: Context): PendingIntent {
        val open = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("open_tab", "jeffrey")
        return PendingIntent.getActivity(context, NOTIF_ID, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun actionIntent(context: Context, action: String, req: Int, mutable: Boolean = false, fill: Intent.() -> Unit = {}): PendingIntent {
        val i = Intent(context, JeffreyNotifReceiver::class.java).setAction(action).apply(fill)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (mutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE)
        return PendingIntent.getBroadcast(context, req, i, flags)
    }

    /**
     * Notification de conversation de Jeffrey (J4.3, choix de Yoann) : le fil du jour façon
     * messagerie, et trois boutons au plus (limite d'Android) — Écouter (dernier message, depuis le
     * cache), Répondre (champ de réponse), puis la réponse rapide proposée par Jeffrey ou
     * « Confirmer » quand une action attend. Douleur au genou sans réponse sur la base : Répondre,
     * « Revenu à la base », « Pas revenu ». `spec` vient de notificationSpec (jeffreyNotify.js) ;
     * il est gardé pour Écouter et pour afficher la réponse de Monsieur pendant que Jeffrey écrit.
     */
    fun postThread(context: Context, specJson: String, alert: Boolean, pending: Boolean = false) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        if (!pending) context.getSharedPreferences(THREAD_PREFS, Context.MODE_PRIVATE).edit().putString("spec", specJson).apply()
        ensureChannel(context)
        val spec = JSONObject(specJson)
        val me = Person.Builder().setName("Monsieur").setKey("monsieur").build()
        val jeffrey = Person.Builder().setName("Jeffrey").setKey("jeffrey").build()
        val style = NotificationCompat.MessagingStyle(me)
        val msgs = spec.optJSONArray("messages")
        val now = System.currentTimeMillis()
        val count = msgs?.length() ?: 0
        for (i in 0 until count) {
            val m = msgs!!.getJSONObject(i)
            style.addMessage(m.optString("text"), now - (count - i) * 1_000L, if (m.optBoolean("me")) me else jeffrey)
        }
        if (count == 0 && spec.optString("text").isNotBlank()) style.addMessage(spec.optString("text"), now, jeffrey)
        val confirm = spec.optJSONObject("confirm")
        if (pending) style.addMessage("…", now, jeffrey)
        else if (confirm != null) style.addMessage("À confirmer : ${confirm.optString("label")}", now, jeffrey)
        val b = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(style)
            .setContentIntent(openIntent(context))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSilent(!alert)
        if (!pending) {
            val icon = R.drawable.ic_jeffrey_bell
            val reply = NotificationCompat.Action.Builder(icon, "Répondre",
                actionIntent(context, JeffreyNotifReceiver.ACTION_REPLY, 5060, mutable = true))
                .addRemoteInput(RemoteInput.Builder(JeffreyNotifReceiver.KEY_REPLY).setLabel("Répondre à Jeffrey").build())
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .setAllowGeneratedReplies(false)
                .build()
            fun confirmAction(label: String, req: Int, baseline: Boolean?) = NotificationCompat.Action.Builder(icon, label,
                actionIntent(context, JeffreyNotifReceiver.ACTION_CONFIRM, req) {
                    putExtra("entryId", confirm!!.optString("entryId")); putExtra("actionId", confirm.optString("actionId"))
                    if (baseline != null) putExtra("baseline", baseline)
                }).build()
            if (confirm?.optBoolean("needsBaseline") == true) {
                b.addAction(reply)
                b.addAction(confirmAction("Revenu à la base", 5062, true))
                b.addAction(confirmAction("Pas revenu", 5063, false))
            } else {
                if (spec.optJSONObject("listen") != null) {
                    b.addAction(NotificationCompat.Action.Builder(icon, "Écouter", actionIntent(context, JeffreyNotifReceiver.ACTION_LISTEN, 5061)).build())
                }
                b.addAction(reply)
                val quick = spec.optJSONObject("quick")
                if (confirm != null) b.addAction(confirmAction("Confirmer", 5062, null))
                else if (quick != null) b.addAction(NotificationCompat.Action.Builder(icon, quick.optString("label"),
                    actionIntent(context, JeffreyNotifReceiver.ACTION_QUICK, 5064) {
                        putExtra("text", quick.optString("label")); putExtra("quickFor", quick.optString("quickFor"))
                    }).build())
            }
        }
        try { NotificationManagerCompat.from(context).notify(NOTIF_ID, b.build()) } catch (e: SecurityException) { Log.w(TAG, "notification", e) }
    }

    /** Pendant que Jeffrey répond : la réponse de Monsieur s'ajoute au fil, sans boutons (Android
     *  attend aussi cette mise à jour pour arrêter l'indicateur du champ de réponse). */
    fun postPending(context: Context, userText: String?) {
        val spec = storedSpec(context) ?: JSONObject()
        if (!userText.isNullOrBlank()) {
            val msgs = spec.optJSONArray("messages") ?: org.json.JSONArray()
            msgs.put(JSONObject().put("me", true).put("text", userText))
            spec.put("messages", msgs)
        }
        postThread(context, spec.toString(), alert = false, pending = true)
    }

    /** Pont exposé à la page sous `window.BriefBridge`. */
    private class Bridge(
        private val context: Context, private val health: String, private val payload: String, private val web: WebView,
        private val handler: Handler, private val onFinish: (String) -> Unit,
    ) {
        @JavascriptInterface fun health(): String = health

        /** Réponse de Monsieur depuis la notification (J4.3), "{}" pour le brief. */
        @JavascriptInterface fun payload(): String = payload

        // Service au premier plan le temps de l'appel (BriefService : rend le réseau quand
        // l'économie d'énergie le coupe aux apps en arrière-plan). Repli : simple notification.
        @JavascriptInterface fun preparing(text: String) {
            try {
                androidx.core.content.ContextCompat.startForegroundService(context, Intent(context, BriefService::class.java).putExtra("text", text))
            } catch (e: Exception) {
                Log.w(TAG, "service au premier plan refusé", e)
                post(context, text, alert = false, ongoing = true)
            }
        }

        @JavascriptInterface fun finish(json: String) = onFinish(json)

        /** POST relayé (LiteLLM ne répond pas au CORS) ; la réponse revient entière à la page. */
        @JavascriptInterface fun http(id: String, url: String, headersJson: String, body: String) {
            pool.execute {
                var status = -1
                var text = ""
                try {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"; doOutput = true; connectTimeout = 15_000; readTimeout = 50_000
                        val h = JSONObject(headersJson)
                        h.keys().forEach { setRequestProperty(it, h.getString(it)) }
                    }
                    conn.outputStream.use { it.write(body.toByteArray()) }
                    status = conn.responseCode
                    text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "http", e)
                    text = e.message ?: "erreur réseau"
                }
                handler.post {
                    web.evaluateJavascript("window.__briefHttpDone(${JSONObject.quote(id)}, $status, ${JSONObject.quote(text)})", null)
                }
            }
        }
    }
}

/** Réveils du brief : exacts sans icône de réveil dans la barre d'état (USE_EXACT_ALARM est
 *  déclaré), repli sur setAlarmClock si Android refuse l'exact. */
object BriefScheduler {
    private const val PREFS = "jeffrey_brief"
    private const val REQ = 5051

    fun enabled(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", true)

    fun setEnabled(context: Context, on: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", on).apply()
        if (on) schedule(context, nextStart()) else cancel(context)
    }

    private fun intent(context: Context) = PendingIntent.getBroadcast(
        context, REQ, Intent(context, BriefAlarmReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun schedule(context: Context, atMillis: Long) {
        if (!enabled(context)) return
        val am = context.getSystemService(AlarmManager::class.java)
        val at = maxOf(atMillis, System.currentTimeMillis() + 1_000)
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAlarmClock(AlarmManager.AlarmClockInfo(at, null), intent(context))
        else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(context))
        Log.i("JeffreyBrief", "prochain réveil : ${Instant.ofEpochMilli(at)}")
    }

    fun cancel(context: Context) = context.getSystemService(AlarmManager::class.java).cancel(intent(context))

    /** Après un redémarrage : avant 5 h 17 → 5 h 17 ; entre 5 h 17 et 10 h → dans une minute (la
     *  page décide, un brief déjà fait est ignoré) ; après → demain 5 h 17. Mêmes heures que BRIEF
     *  (packages/core/src/coach/brief.js). */
    fun nextStart(): Long {
        val zone = ZoneId.systemDefault()
        val day = LocalDate.now(zone)
        val start = day.atTime(LocalTime.of(5, 17)).atZone(zone).toInstant().toEpochMilli()
        val deadline = day.atTime(LocalTime.of(10, 0)).atZone(zone).toInstant().toEpochMilli()
        val now = System.currentTimeMillis()
        return when {
            now < start -> start
            now < deadline -> now + 60_000
            else -> start + 86_400_000L
        }
    }
}
