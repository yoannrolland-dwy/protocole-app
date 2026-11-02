package com.yoannrolland.protocole

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.util.concurrent.Executors

/**
 * Sauvegarde automatique sur le serveur Oracle de Yoann (02/11/2026). Le contrat du serveur
 * (`https://141.253.109.120/protocole-backup`, routes /v1/backup…) et la clé dédiée viennent de la
 * session Oracle ; toute la logique (export, validation, marqueur) reste en JavaScript
 * (src/lib/serverBackup.js). Ici : la requête HTTP (TLS vérifié normalement), les réveils de 14 h
 * et 23 h, et le pont pour l'app ouverte. Jamais la clé ni le contenu dans un journal.
 */
object BackupHttp {
    private const val TAG = "ProtocoleBackup"
    private val pool = Executors.newSingleThreadExecutor()

    /** → (code HTTP, corps de la réponse) ; -1 et le message en cas d'erreur réseau. */
    fun request(method: String, url: String, headers: JSONObject, body: String?): Pair<Int, String> = try {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 15_000; readTimeout = 40_000
            headers.keys().forEach { setRequestProperty(it, headers.getString(it)) }
            if (body != null) doOutput = true
        }
        if (body != null) {
            val bytes = body.toByteArray(Charsets.UTF_8)
            conn.setFixedLengthStreamingMode(bytes.size)
            conn.outputStream.use { it.write(bytes) }
        }
        val status = conn.responseCode
        val text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        Log.i(TAG, "$method ${URL(url).path} → $status")
        status to text
    } catch (e: Exception) {
        Log.w(TAG, "$method réseau : ${e.javaClass.simpleName}")
        -1 to (e.message ?: "erreur réseau")
    }

    fun async(method: String, url: String, headers: JSONObject, body: String?, done: (Int, String) -> Unit) {
        pool.execute { val (s, t) = request(method, url, headers, body); done(s, t) }
    }
}

/** Réveils de 14 h et 23 h. Actifs seulement quand une clé de sauvegarde est posée dans l'app
 *  (l'app le dit à chaque lancement, voir `Backup.setEnabled`). */
object BackupScheduler {
    private const val PREFS = "protocole_backup"
    private const val REQ = 5054
    private val SLOTS = listOf(LocalTime.of(14, 0) to "14h", LocalTime.of(23, 0) to "23h")

    fun enabled(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false)

    fun setEnabled(context: Context, on: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", on).apply()
        if (on) scheduleNext(context) else cancel(context)
    }

    /** Prochain créneau (14 h ou 23 h) après `now`, et son nom. */
    fun next(now: Long = System.currentTimeMillis()): Pair<Long, String> {
        val zone = ZoneId.systemDefault()
        val day = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        for (d in listOf(day, day.plusDays(1))) {
            for ((time, slot) in SLOTS) {
                val at = d.atTime(time).atZone(zone).toInstant().toEpochMilli()
                if (at > now + 30_000) return at to slot
            }
        }
        return day.plusDays(1).atTime(SLOTS[0].first).atZone(zone).toInstant().toEpochMilli() to SLOTS[0].second
    }

    private fun intent(context: Context, slot: String?, flags: Int): PendingIntent? = PendingIntent.getBroadcast(
        context, REQ, Intent(context, BackupAlarmReceiver::class.java).apply { if (slot != null) putExtra("slot", slot) },
        flags or PendingIntent.FLAG_IMMUTABLE,
    )

    fun scheduleNext(context: Context) {
        if (!enabled(context)) return
        val (at, slot) = next()
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = intent(context, slot, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAlarmClock(AlarmManager.AlarmClockInfo(at, null), pi)
        else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        Log.i("ProtocoleBackup", "prochaine sauvegarde : $slot, ${Instant.ofEpochMilli(at)}")
    }

    fun cancel(context: Context) {
        val pi = intent(context, null, PendingIntent.FLAG_NO_CREATE) ?: return
        context.getSystemService(AlarmManager::class.java).cancel(pi)
        pi.cancel()
    }
}

/** Réveil de 14 h ou 23 h : la page sans écran envoie la copie (BriefRunner.runBackup), puis le
 *  réveil suivant est programmé. Non exporté. */
class BackupAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!BackupScheduler.enabled(context)) return
        val slot = intent.getStringExtra("slot") ?: "manuel"
        val pending = goAsync()
        BriefRunner.runBackup(context, slot) {
            BackupScheduler.scheduleNext(context)
            pending.finish()
        }
    }
}

/** Pont de l'app ouverte : requêtes vers le serveur de sauvegarde, et activation des réveils. */
@CapacitorPlugin(name = "Backup")
class BackupPlugin : Plugin() {
    @PluginMethod
    fun request(call: PluginCall) {
        val method = call.getString("method") ?: "GET"
        val url = call.getString("url") ?: return call.reject("adresse manquante")
        val headers = call.getObject("headers") ?: JSObject()
        BackupHttp.async(method, url, headers, call.getString("body")) { status, text ->
            call.resolve(JSObject().put("status", status).put("text", text))
        }
    }

    @PluginMethod
    fun setEnabled(call: PluginCall) {
        BackupScheduler.setEnabled(context, call.getBoolean("enabled", false) == true)
        call.resolve()
    }
}
