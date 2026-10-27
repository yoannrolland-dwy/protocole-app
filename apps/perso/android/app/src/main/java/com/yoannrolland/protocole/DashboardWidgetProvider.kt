package com.yoannrolland.protocole

import android.app.ActivityOptions
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.TypefaceSpan
import android.widget.RemoteViews

/**
 * Widget d'écran d'accueil : 5 tuiles du tableau de bord (Poids, Calories, Énergie,
 * Pas, Eau) en lecture seule, plus un bouton Sync. Tap sur une tuile de donnée = ouvre l'app
 * sur l'écran correspondant (TILE_TABS) ; tap sur le fond = ouvre l'app normalement. Le bouton Sync, lui, lance
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

        private const val TEXT = "#f5f5f0"

        private fun parse(hex: String?): Int? =
            if (hex.isNullOrEmpty()) null else try { Color.parseColor(hex) } catch (e: IllegalArgumentException) { null }

        // Couleurs (25/10/2026) : mêmes règles que le tableau de bord de l'app, calculées par le JS
        // (widgetSync.js). `color` colore le chiffre ; `labelColor` colore seulement ce qui suit le
        // premier espace (« 88 Excellent » → « Excellent »), le chiffre restant blanc comme dans l'app.
        private fun fillTile(views: RemoteViews, valueId: Int, noteId: Int, prefs: SharedPreferences, key: String) {
            val value = prefs.getString("${key}_value", "—") ?: "—"
            val labelColor = parse(prefs.getString("${key}_labelColor", ""))
            val space = value.indexOf(' ')
            if (labelColor != null && space > 0) {
                val span = SpannableString(value)
                span.setSpan(ForegroundColorSpan(labelColor), space + 1, value.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                // Libellé en police étroite : « 88 Excellent » ne tenait pas en monospace à 13 sp.
                span.setSpan(TypefaceSpan("sans-serif-condensed"), space + 1, value.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                views.setTextViewText(valueId, span)
            } else {
                views.setTextViewText(valueId, value)
            }
            views.setTextColor(valueId, parse(prefs.getString("${key}_color", "")) ?: Color.parseColor(TEXT))
            views.setTextViewText(noteId, prefs.getString("${key}_note", ""))
        }

        // Barre de progression (27/10/2026) : remplissage 0-100 et couleur calculés par le JS
        // (progressColor, comme les barres de l'app). La teinte n'est modifiable depuis un widget
        // qu'à partir d'Android 12 ; avant, la barre reste citron (widget_progress.xml).
        private fun fillBar(views: RemoteViews, barId: Int, prefs: SharedPreferences, key: String) {
            views.setProgressBar(barId, 100, prefs.getInt("${key}_bar", 0).coerceIn(0, 100), false)
            val color = parse(prefs.getString("${key}_barColor", ""))
            if (color != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setColorStateList(barId, "setProgressTintList", ColorStateList.valueOf(color))
            }
        }

        // Tap sur une tuile (27/10/2026) : ouvre l'app sur l'écran correspondant. L'écran voyage
        // dans l'extra EXTRA_OPEN_TAB, lu puis effacé par le JS (WidgetBridge.consumeOpenTab).
        // Un code de requête par tuile, sinon Android réutiliserait le même PendingIntent et ses extras.
        private val TILE_TABS = listOf(
            Triple(R.id.tile_poids, "weight", 10),
            Triple(R.id.tile_calories, "macro", 11),
            Triple(R.id.tile_energie, "sleep", 12),
            Triple(R.id.tile_pas, "steps", 13),
            Triple(R.id.tile_eau, "macro", 14),
        )

        private fun buildViews(context: Context, prefs: SharedPreferences, syncAngle: Float): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_dashboard)

            fillTile(views, R.id.tile_poids_value, R.id.tile_poids_note, prefs, "poids")
            fillTile(views, R.id.tile_pas_value, R.id.tile_pas_note, prefs, "pas")
            fillTile(views, R.id.tile_calories_value, R.id.tile_calories_note, prefs, "calories")
            fillTile(views, R.id.tile_eau_value, R.id.tile_eau_note, prefs, "eau")
            fillTile(views, R.id.tile_energie_value, R.id.tile_energie_note, prefs, "energie")
            fillBar(views, R.id.tile_pas_bar, prefs, "pas")
            fillBar(views, R.id.tile_calories_bar, prefs, "calories")
            fillBar(views, R.id.tile_eau_bar, prefs, "eau")
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
            for ((tileId, tab, requestCode) in TILE_TABS) {
                val tabIntent = Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_MAIN
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    putExtra(WidgetBridgePlugin.EXTRA_OPEN_TAB, tab)
                }
                val tabPending = PendingIntent.getActivity(
                    context, requestCode, tabIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(tileId, tabPending)
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
