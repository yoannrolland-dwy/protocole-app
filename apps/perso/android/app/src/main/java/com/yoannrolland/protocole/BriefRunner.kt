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
    // Un réveil en arrière-plan dispose d'environ une minute (goAsync) : on rend la main avant.
    private const val TIMEOUT_MS = 55_000L
    private val pool = Executors.newCachedThreadPool()

    fun run(context: Context, done: () -> Unit) {
        val app = context.applicationContext
        CoroutineScope(Dispatchers.Main).launch {
            val health = withContext(Dispatchers.IO) { readHealth(app) }
            startPage(app, health, done)
        }
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
    private fun startPage(context: Context, health: String, done: () -> Unit) {
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
                    // réseau. Lu tout de suite seulement en séance (la page le dit), casque branché.
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
        web.addJavascriptInterface(Bridge(context, health, web, handler, finish), "BriefBridge")
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
        web.loadUrl("https://localhost/brief.html")
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

    /** Ce que la page rend : { notify: { kind, text, alert } | null, nextAt } ou { error, nextAt }. */
    private fun handleResult(context: Context, json: String) {
        val r = JSONObject(json)
        if (r.has("error")) Log.w(TAG, "page : ${r.optString("error")}")
        val n = r.optJSONObject("notify")
        if (n != null) post(context, n.optString("text"), n.optBoolean("alert"))
        else if (!r.has("error")) NotificationManagerCompat.from(context).cancel(NOTIF_ID)
        BriefScheduler.schedule(context, r.optLong("nextAt", System.currentTimeMillis() + 20 * 60_000))
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

    /** Pont exposé à la page sous `window.BriefBridge`. */
    private class Bridge(
        private val context: Context, private val health: String, private val web: WebView,
        private val handler: Handler, private val onFinish: (String) -> Unit,
    ) {
        @JavascriptInterface fun health(): String = health

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
