package com.yoannrolland.protocole

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * Pont JEFFREY, étape G2 (05/11/2026, décision de Yoann : « secours seulement »). Cadrage :
 * jeffrey-app, docs/cadrage/ETAPE_G_PONT_PROTOCOLE.md.
 *
 * Au moment du brief (genou noté le matin), l'app prévient l'appli JEFFREY par une diffusion
 * explicite, protégée par la permission `PROTOCOLE_SIGNAL` que JEFFREY déclare (niveau signature).
 * JEFFREY confirme par l'opération `brief_fait` du pont (JeffreyBridgeService) avant de parler.
 * Sans confirmation dans la minute, PROTOCOLE fait son brief : l'app s'en charge si elle est à
 * l'écran, sinon le contrôle de la minute (réveil exact, BriefSignalCheckReceiver) lance la page
 * sans écran (`brief.html?mode=signal`). Toute la décision reste en JavaScript (core/coach/brief.js).
 * Le signal ne porte que la date et les noms des données manquantes, jamais une valeur.
 */
object JeffreySignal {
    private const val TAG = "JeffreySignal"
    const val JEFFREY = "fr.yrolland.jeffrey"
    const val PERMISSION = "fr.yrolland.jeffrey.permission.PROTOCOLE_SIGNAL"
    const val ACTION = "fr.yrolland.jeffrey.action.PROTOCOLE_BRIEF_READY"
    private const val RECEIVER = "fr.yrolland.jeffrey.protocole.BriefSignalReceiver"
    private const val REQ = 5056
    // Une minute pour JEFFREY, plus une marge : la page relit l'état et ne fait rien s'il a confirmé.
    private const val CHECK_DELAY_MS = 62_000L

    private fun intent(json: String) = Intent(ACTION)
        .setPackage(JEFFREY)
        .setComponent(ComponentName(JEFFREY, RECEIVER))
        .putExtra("json", json)

    /** JEFFREY installé, avec son récepteur, et la permission accordée à PROTOCOLE. */
    fun available(context: Context): Boolean {
        val pm = context.packageManager
        val installed = try { pm.getPackageInfo(JEFFREY, 0); true } catch (e: PackageManager.NameNotFoundException) { false }
        if (!installed) return false
        if (context.checkSelfPermission(PERMISSION) != PackageManager.PERMISSION_GRANTED) return false
        return pm.queryBroadcastReceivers(intent("{}"), 0).isNotEmpty()
    }

    /** Envoie le signal → true s'il est parti. `check` : programme le contrôle de la minute. */
    fun send(context: Context, json: String, check: Boolean): Boolean {
        if (!available(context)) {
            Log.i(TAG, "JEFFREY injoignable : brief de PROTOCOLE")
            return false
        }
        return try {
            // Composant explicite ; c'est le récepteur de JEFFREY qui exige PROTOCOLE_SIGNAL de l'expéditeur.
            context.sendBroadcast(intent(json))
            if (check) scheduleCheck(context)
            Log.i(TAG, if (check) "signal envoyé, contrôle dans une minute" else "signal d'essai envoyé")
            true
        } catch (e: Exception) {
            Log.w(TAG, "signal refusé : ${e.javaClass.simpleName}")
            false
        }
    }

    private fun checkIntent(context: Context, flags: Int) = PendingIntent.getBroadcast(
        context, REQ, Intent(context, BriefSignalCheckReceiver::class.java), flags or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun scheduleCheck(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = checkIntent(context, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
        val at = SystemClock.elapsedRealtime() + CHECK_DELAY_MS
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
        else am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
    }

    /** Signal d'essai (BriefSignalTestReceiver) : date du jour, `essai: true` ; `brief_fait` le
     *  confirme sans rien marquer, et aucun contrôle de la minute n'est programmé. */
    fun testJson(manque: String?): String {
        val list = runCatching { JSONArray(manque ?: "[]") }.getOrDefault(JSONArray())
        return JSONObject().put("date", LocalDate.now().toString()).put("manque", list).put("essai", true).toString()
    }
}

/** L'app est-elle à l'écran ? (MainActivity, onResume / onPause.) À l'écran, l'app gère elle-même
 *  la minute d'attente et le brief de secours. */
object AppVisibility {
    @JvmStatic @Volatile var resumed = false
}

/** Contrôle de la minute après le signal (non exporté) : app à l'écran → rien (elle s'en charge) ;
 *  sinon la page sans écran décide (JEFFREY a confirmé → copie du matin ; sinon brief de secours). */
class BriefSignalCheckReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (AppVisibility.resumed) return
        val pending = goAsync()
        BriefRunner.runSignalCheck(context) { pending.finish() }
    }
}

/**
 * Essai du signal sans toucher au vrai brief (05/11/2026, pour la session JEFFREY) :
 *   adb shell am broadcast -n com.yoannrolland.protocole/.BriefSignalTestReceiver [--es manque '["pesée"]']
 * Exporté mais réservé au shell d'adb (permission DUMP, que seuls le système et adb détiennent).
 * Envoie le signal avec `essai: true` ; aucun contrôle de la minute, aucun brief de secours.
 */
class BriefSignalTestReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        JeffreySignal.send(context, JeffreySignal.testJson(intent.getStringExtra("manque")), check = false)
    }
}
