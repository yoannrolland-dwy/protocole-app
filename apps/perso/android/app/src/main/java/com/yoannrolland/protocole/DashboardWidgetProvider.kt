package com.yoannrolland.protocole

import android.app.ActivityOptions
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews

/**
 * Widget d'écran d'accueil : 5 tuiles du tableau de bord (Poids, Calories, Sommeil,
 * Pas, Eau) en lecture seule, plus un bouton Sync. Tap sur une tuile de donnée ou sur
 * le fond du widget = ouvre l'app normalement. Le bouton Sync, lui, lance
 * SilentSyncActivity (invisible) qui exécute la synchro Health Connect sans jamais
 * afficher l'UI, pendant que l'icône tourne ici (startSpin/stopSpin). Les valeurs
 * viennent des SharedPreferences écrites par WidgetBridgePlugin (le JS calcule et
 * formate, le widget se contente d'afficher).
 */
class DashboardWidgetProvider : AppWidgetProvider() {

    companion object {
        private var spinHandler: Handler? = null
        private var spinAngle = 0f

        fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE)
            for (id in ids) manager.updateAppWidget(id, buildViews(context, prefs, spinAngle))
        }

        private fun widgetIds(context: Context): IntArray {
            val manager = AppWidgetManager.getInstance(context)
            return manager.getAppWidgetIds(ComponentName(context, DashboardWidgetProvider::class.java))
        }

        /** Démarre la rotation de l'icône Sync (appelé par SilentSyncActivity au lancement). */
        fun startSpin(context: Context) {
            stopSpin(context) // jamais deux boucles en parallèle
            val ids = widgetIds(context)
            if (ids.isEmpty()) return
            val manager = AppWidgetManager.getInstance(context)
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE)
            val handler = Handler(Looper.getMainLooper())
            spinHandler = handler
            val tick = object : Runnable {
                override fun run() {
                    spinAngle = (spinAngle + 45f) % 360f
                    for (id in ids) manager.updateAppWidget(id, buildViews(context, prefs, spinAngle))
                    spinHandler?.postDelayed(this, 120)
                }
            }
            handler.post(tick)
        }

        /** Arrête la rotation et remet l'icône à plat (appelé une fois la synchro terminée). */
        fun stopSpin(context: Context) {
            spinHandler?.removeCallbacksAndMessages(null)
            spinHandler = null
            spinAngle = 0f
            val ids = widgetIds(context)
            if (ids.isNotEmpty()) updateAll(context, AppWidgetManager.getInstance(context), ids)
        }

        private fun fillTile(views: RemoteViews, valueId: Int, noteId: Int, prefs: SharedPreferences, key: String) {
            views.setTextViewText(valueId, prefs.getString("${key}_value", "—"))
            views.setTextViewText(noteId, prefs.getString("${key}_note", ""))
        }

        private fun buildViews(context: Context, prefs: SharedPreferences, syncAngle: Float): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_dashboard)

            fillTile(views, R.id.tile_poids_value, R.id.tile_poids_note, prefs, "poids")
            fillTile(views, R.id.tile_pas_value, R.id.tile_pas_note, prefs, "pas")
            fillTile(views, R.id.tile_calories_value, R.id.tile_calories_note, prefs, "calories")
            fillTile(views, R.id.tile_eau_value, R.id.tile_eau_note, prefs, "eau")
            fillTile(views, R.id.tile_sommeil_value, R.id.tile_sommeil_note, prefs, "sommeil")
            views.setTextViewText(R.id.tile_sync_note, prefs.getString("sync_note", ""))
            views.setFloat(R.id.tile_sync_icon, "setRotation", syncAngle)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                val pending = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_root, pending)
            }

            // Bouton Sync : lance l'activité invisible plutôt que l'app normale, sans
            // aucune animation d'ouverture (ActivityOptions + FLAG_ACTIVITY_NO_ANIMATION).
            val syncIntent = Intent(context, SilentSyncActivity::class.java).apply {
                putExtra(WidgetBridgePlugin.EXTRA_SILENT_SYNC, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            }
            val syncOptions = ActivityOptions.makeCustomAnimation(context, 0, 0).toBundle()
            val syncPending = PendingIntent.getActivity(
                context, 1, syncIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                syncOptions
            )
            views.setOnClickPendingIntent(R.id.tile_sync, syncPending)

            return views
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateAll(context, appWidgetManager, appWidgetIds)
    }
}
