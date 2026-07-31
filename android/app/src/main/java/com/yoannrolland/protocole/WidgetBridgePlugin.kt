package com.yoannrolland.protocole

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Pont entre le JS et le widget d'écran d'accueil (RemoteViews, ne peut pas lire le
 * localStorage de la WebView). Le JS envoie un instantané déjà mis en forme (mêmes
 * valeurs que les tuiles du tableau de bord — voir widgetSync.js) ; ce plugin le stocke
 * dans des SharedPreferences que DashboardWidgetProvider relit pour se dessiner, et
 * force un rafraîchissement immédiat plutôt que d'attendre le cycle périodique Android.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    companion object {
        const val PREFS = "widget_dashboard"
        const val EXTRA_SILENT_SYNC = "silent_sync"
        // "sync" n'a pas de tuile de valeur affichée (seulement une note, l'heure de la
        // dernière synchro) : sa clé "value" est stockée mais jamais lue.
        val KEYS = listOf("poids", "pas", "calories", "eau", "sommeil", "sync")
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val editor = prefs.edit()

        KEYS.forEach { key ->
            val tile: JSObject? = call.getObject(key)
            if (tile != null) {
                editor.putString("${key}_value", tile.getString("value", "—"))
                editor.putString("${key}_note", tile.getString("note", ""))
            }
        }
        editor.apply()

        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, DashboardWidgetProvider::class.java))
        if (ids.isNotEmpty()) DashboardWidgetProvider.updateAll(context, manager, ids)

        call.resolve()
    }

    /** Vrai si cette instance de l'app a été lancée par le bouton Sync du widget (voir SilentSyncActivity). */
    @PluginMethod
    fun isSilentSync(call: PluginCall) {
        val silent = activity?.intent?.getBooleanExtra(EXTRA_SILENT_SYNC, false) ?: false
        call.resolve(JSObject().put("silent", silent))
    }

    /** Appelé par le JS une fois la synchro (et la mise à jour du widget) terminées : arrête
     *  l'animation de la flèche et referme l'activité invisible sans transition visible. */
    @PluginMethod
    fun finishSilentSync(call: PluginCall) {
        DashboardWidgetProvider.stopSpin(context)
        call.resolve()
        activity?.let {
            it.overridePendingTransition(0, 0)
            it.finish()
        }
    }
}
