package com.yoannrolland.protocole

import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Bundle
import android.view.Gravity
import android.view.View
import com.getcapacitor.BridgeActivity

/**
 * Activité invisible utilisée uniquement par le bouton Sync du widget : démarre l'app
 * en tâche de fond (thème translucide, aucune transition visible, voir Theme.Invisible)
 * pour exécuter la synchro Health Connect déjà existante côté JS (runHealthSync), puis
 * se referme d'elle-même une fois terminée (voir App.jsx / WidgetBridgePlugin.finishSilentSync).
 *
 * Une activité séparée de MainActivity plutôt qu'un simple extra d'intent : MainActivity
 * est en singleTask, donc si l'app est déjà ouverte, un intent silencieux la ramènerait
 * au premier plan (donc visible) au lieu de rester invisible. singleInstance + noHistory
 * (voir AndroidManifest.xml) garantissent que cette activité vit dans sa propre tâche,
 * indépendante de celle de MainActivity.
 */
class SilentSyncActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HealthNutritionPlugin::class.java)
        registerPlugin(RestTimerPlugin::class.java)
        registerPlugin(WidgetBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
        // En plus des options passées au PendingIntent (parfois ignorées par le launcher
        // qui déclenche le clic) : supprime aussi la transition d'entrée depuis ici.
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
        // La transparence (thème translucide, WebView transparente + rendu logiciel) ne
        // suffit pas : un flash gris d'environ 180 ms persistait quand même sur cet
        // appareil (confirmé par enregistrement vidéo image par image), probablement une
        // "starting window" ou une transition système qui ignore nos réglages de contenu.
        // Solution plus radicale et fiable : réduire la fenêtre elle-même à 1x1 pixel —
        // peu importe ce qui est dessiné dedans, il n'y a matériellement rien à voir.
        window.setFormat(PixelFormat.TRANSLUCENT)
        window.setGravity(Gravity.TOP or Gravity.START)
        window.setLayout(1, 1)
        val attrs = window.attributes
        attrs.x = 0
        attrs.y = 0
        window.attributes = attrs
        bridge.webView.setBackgroundColor(Color.TRANSPARENT)
        bridge.webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        DashboardWidgetProvider.startSpin(applicationContext)
        // Garde (audit du 10/11/2026, point 17) : si la synchro ne rend jamais la main (erreur,
        // Health Connect qui ne répond pas, app qui ne se charge pas), l'activité invisible restait
        // ouverte et la flèche du widget tournait sans fin. Au bout de 45 s, tout se referme.
        guard.postDelayed({ if (!isFinishing) { DashboardWidgetProvider.stopSpin(applicationContext); finish() } }, GUARD_MS)
    }

    override fun onDestroy() {
        guard.removeCallbacksAndMessages(null)
        // Fermée par Android ou par la garde : la flèche s'arrête dans tous les cas.
        DashboardWidgetProvider.stopSpin(applicationContext)
        super.onDestroy()
    }

    private val guard = android.os.Handler(android.os.Looper.getMainLooper())

    companion object {
        const val GUARD_MS = 45_000L
    }
}
