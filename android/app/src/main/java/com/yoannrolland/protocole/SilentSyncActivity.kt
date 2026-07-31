package com.yoannrolland.protocole

import android.os.Bundle
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
        DashboardWidgetProvider.startSpin(applicationContext)
    }
}
