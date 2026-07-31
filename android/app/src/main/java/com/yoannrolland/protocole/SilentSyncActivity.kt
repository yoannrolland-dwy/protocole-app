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
    }
}
