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
        const val EXTRA_OPEN_TAB = "open_tab"
        // "sync" n'a pas de tuile de valeur affichée (seulement une note, l'heure de la
        // dernière synchro) : sa clé "value" est stockée mais jamais lue. "energie" (ex-
        // "sommeil", 05/09/2026) : score d'énergie en valeur, durée de sommeil réelle en note.
        // Plus de "poids" depuis le 30/10/2026 : sa tuile est devenue un raccourci vers le Bord.
        val KEYS = listOf("pas", "calories", "eau", "energie", "sync")
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
                // Couleurs (25/10/2026) : toujours réécrites, "" = blanc, pour qu'une couleur de
                // dépassement ne reste pas affichée le lendemain.
                editor.putString("${key}_color", tile.getString("color", ""))
                editor.putString("${key}_labelColor", tile.getString("labelColor", ""))
                // Barre de progression (27/10/2026) : 0-100 et couleur, absentes = barre vide.
                editor.putInt("${key}_bar", tile.getInteger("bar", 0) ?: 0)
                editor.putString("${key}_barColor", tile.getString("barColor", ""))
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

    /** Écran demandé par un tap sur une tuile du widget ("weight", "macro"…), ou "" si aucun.
     *  L'extra est effacé après lecture : revenir dans l'app plus tard ne rouvre pas cet écran. */
    @PluginMethod
    fun consumeOpenTab(call: PluginCall) {
        val intent = activity?.intent
        val tab = intent?.getStringExtra(EXTRA_OPEN_TAB) ?: ""
        intent?.removeExtra(EXTRA_OPEN_TAB)
        call.resolve(JSObject().put("tab", tab))
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
