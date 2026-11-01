package com.yoannrolland.protocole

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Ancien réveil du brief du matin (J4.1). Depuis le 01/11/2026 (v3.148.0), le brief part dans
 *  l'app quand Monsieur note son genou : un réveil resté programmé par une version précédente ne
 *  fait plus rien, il se retire. Gardé pour que ce réveil trouve encore son destinataire. */
class BriefAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BriefScheduler.cancel(context)
    }
}

/** Mise à jour de l'app ou redémarrage : retire un ancien réveil du brief s'il en reste un.
 *  Exporté pour recevoir ces diffusions du système (seul le système peut les envoyer). */
class BriefBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            BriefScheduler.cancel(context)
        }
    }
}
