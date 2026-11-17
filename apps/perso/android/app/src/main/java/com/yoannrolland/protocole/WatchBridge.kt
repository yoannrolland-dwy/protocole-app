package com.yoannrolland.protocole

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Montre (Galaxy Watch, 17/11/2026) : le JS calcule l'instantané des trois écrans repris sur la
 * montre (src/lib/watchSnapshot.js) ; ce plugin le garde ici et le publie sur la couche de données
 * Wear OS (DataClient, chemin [WatchSync.PATH]), d'où l'appli de la montre (module `wear`) le lit.
 * La montre et le téléphone partagent le même identifiant d'appli et la même clé de signature :
 * c'est la condition pour que la couche de données les relie. Lecture seule : rien ne revient.
 */
@CapacitorPlugin(name = "WatchBridge")
class WatchBridgePlugin : Plugin() {

    /** Arme la relecture des pas toutes les 30 min dès que l'app tourne (et au redémarrage, voir BriefBootReceiver). */
    override fun load() {
        WatchSync.scheduleStepsRefresh(context)
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val json = call.getString("json")
        if (json.isNullOrEmpty()) {
            call.reject("instantané absent")
            return
        }
        WatchSync.publish(context, json)
        call.resolve()
    }
}

object WatchSync {
    private const val TAG = "WatchSync"
    const val PATH = "/protocole/snapshot"
    private const val PREFS = "watch_snapshot"
    private const val REQ = 7070
    private const val ACCENT = "#d7ff3f"
    private const val OVER = "#5ab4ff"
    private const val TEXT = "#f5f5f0"

    /** Garde le dernier instantané (pour la relecture des pas) et le publie pour la montre. */
    fun publish(context: Context, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("json", json).apply()
        val req = PutDataMapRequest.create(PATH).apply {
            dataMap.putString("json", json)
            // Toujours différent : la couche de données ne transmet pas un élément identique au précédent.
            dataMap.putLong("sentAt", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        Wearable.getDataClient(context).putDataItem(req)
            .addOnFailureListener { Log.w(TAG, "envoi à la montre impossible : ${it.message}") }
    }

    /**
     * Relecture des pas toutes les 30 min, app fermée (choix de Yoann, 17/11/2026) : réveil
     * inexact et non urgent (il attend que le téléphone soit éveillé), aucune batterie dépensée
     * pour rien. Le reste de l'instantané suit chaque saisie et chaque ouverture de l'app.
     */
    fun scheduleStepsRefresh(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(
            context, REQ, Intent(context, WatchStepsReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_HALF_HOUR,
            AlarmManager.INTERVAL_HALF_HOUR, pi
        )
    }

    /** Relit les pas dans Health Connect et republie l'instantané s'ils ont changé. */
    suspend fun refreshSteps(context: Context): Boolean {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("json", null) ?: return false
        val steps = WidgetStepsRefresher.readTodaySteps(context) ?: return false
        val patched = patchSteps(json, steps, LocalDate.now().toString(),
            LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))) ?: return false
        publish(context, patched)
        return true
    }

    /**
     * Remplace la tuile `id: "pas"` de l'instantané par le nouveau compte. null si l'instantané
     * date d'un autre jour (ses autres chiffres seraient ceux d'hier : la montre le signale et
     * attend l'ouverture de l'app) ou si rien n'a changé. Mêmes règles de couleur que le JS et
     * le widget (WidgetStepsRefresher) : citron en cours, bleu une fois l'objectif atteint.
     */
    fun patchSteps(json: String, steps: Int, today: String, at: String): String? {
        val o = JSONObject(json)
        if (o.optString("date") != today) return null
        val pages = o.optJSONArray("pages") ?: return null
        for (p in 0 until pages.length()) {
            val items = pages.getJSONObject(p).optJSONArray("items") ?: continue
            for (i in 0 until items.length()) {
                val it = items.getJSONObject(i)
                if (it.optString("id") != "pas") continue
                if (it.optInt("count", -1) == steps) return null
                val target = it.optInt("target", WidgetStepsRefresher.STEPS_TARGET)
                val reached = steps >= target
                it.put("count", steps)
                it.put("value", NumberFormat.getIntegerInstance(Locale.FRANCE).format(steps))
                it.put("pct", Math.round(steps * 100.0 / target).toInt().coerceIn(0, 100))
                it.put("barCol", if (reached) OVER else ACCENT)
                it.put("valueCol", if (reached) OVER else TEXT)
                o.put("stepsAt", at)
                return o.toString()
            }
        }
        return null
    }
}

/** Réveil des 30 min : relit les pas et met la montre à jour (voir [WatchSync.scheduleStepsRefresh]). */
class WatchStepsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                WatchSync.refreshSteps(app)
            } catch (e: Exception) {
                Log.w("WatchSync", "relecture des pas : ${e.message}")
            } finally {
                pending.finish()
            }
        }
    }
}
