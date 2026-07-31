package com.yoannrolland.protocole

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews

/**
 * Widget d'écran d'accueil : les 6 tuiles du tableau de bord (Poids, Pas, Calories,
 * Eau, Sommeil, Genou), en lecture seule — aucune action par tuile, un tap n'importe
 * où sur le widget ouvre l'app. Les valeurs viennent des SharedPreferences écrites par
 * WidgetBridgePlugin (le JS calcule et formate, le widget se contente d'afficher).
 */
class DashboardWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACCENT = 0xFFD7FF3F.toInt()
        private const val DANGER = 0xFFFF3B30.toInt()

        fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE)
            for (id in ids) manager.updateAppWidget(id, buildViews(context, prefs))
        }

        private fun fillTile(views: RemoteViews, valueId: Int, noteId: Int, prefs: SharedPreferences, key: String) {
            views.setTextViewText(valueId, prefs.getString("${key}_value", "—"))
            views.setTextViewText(noteId, prefs.getString("${key}_note", ""))
        }

        private fun buildViews(context: Context, prefs: SharedPreferences): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_dashboard)

            fillTile(views, R.id.tile_poids_value, R.id.tile_poids_note, prefs, "poids")
            fillTile(views, R.id.tile_pas_value, R.id.tile_pas_note, prefs, "pas")
            fillTile(views, R.id.tile_calories_value, R.id.tile_calories_note, prefs, "calories")
            fillTile(views, R.id.tile_eau_value, R.id.tile_eau_note, prefs, "eau")
            fillTile(views, R.id.tile_sommeil_value, R.id.tile_sommeil_note, prefs, "sommeil")
            fillTile(views, R.id.tile_genou_value, R.id.tile_genou_note, prefs, "genou")

            val genouAlert = prefs.getBoolean("genou_alert", false)
            views.setTextColor(R.id.tile_genou_value, if (genouAlert) DANGER else ACCENT)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                val pending = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_root, pending)
            }

            return views
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateAll(context, appWidgetManager, appWidgetIds)
    }
}
