package com.yoannrolland.protocole

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Réveil du brief du matin (J4.1) : relance la page sans écran (BriefRunner). Non exporté. */
class BriefAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!BriefScheduler.enabled(context)) return
        val pending = goAsync()
        BriefRunner.run(context) { pending.finish() }
    }
}

/** Redémarrage du téléphone ou mise à jour de l'app : Android efface les réveils, on les remet.
 *  Exporté pour recevoir ces diffusions du système (seul le système peut les envoyer). */
class BriefBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            BriefScheduler.schedule(context, BriefScheduler.nextStart())
        }
    }
}
