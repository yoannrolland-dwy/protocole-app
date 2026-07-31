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
        val KEYS = listOf("poids", "pas", "calories", "eau", "sommeil", "genou")
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
                if (key == "genou") editor.putBoolean("genou_alert", tile.optBoolean("alert", false))
            }
        }
        editor.apply()

        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, DashboardWidgetProvider::class.java))
        if (ids.isNotEmpty()) DashboardWidgetProvider.updateAll(context, manager, ids)

        call.resolve()
    }
}
