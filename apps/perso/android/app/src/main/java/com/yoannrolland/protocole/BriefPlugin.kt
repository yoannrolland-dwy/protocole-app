package com.yoannrolland.protocole

import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Brief du matin vu depuis l'app (J4.1) : programmer le prochain réveil (l'heure est calculée en
 * JS par nextBriefAlarm), retirer la notification quand l'app prend la main, activer/désactiver
 * depuis les Réglages, et lancer un essai dans quelques secondes.
 */
@CapacitorPlugin(name = "Brief")
class BriefPlugin : Plugin() {

    @PluginMethod
    fun schedule(call: PluginCall) {
        val at = call.getLong("at") ?: return call.reject("at manquant")
        BriefScheduler.schedule(context, at)
        call.resolve()
    }

    @PluginMethod
    fun cancelNotification(call: PluginCall) {
        NotificationManagerCompat.from(context).cancel(BriefRunner.NOTIF_ID)
        call.resolve()
    }

    @PluginMethod
    fun setEnabled(call: PluginCall) {
        BriefScheduler.setEnabled(context, call.getBoolean("enabled", true) == true)
        call.resolve()
    }

    @PluginMethod
    fun isEnabled(call: PluginCall) {
        call.resolve(JSObject().put("enabled", BriefScheduler.enabled(context)))
    }

    /** Essai : réveil dans `seconds` secondes (l'app peut être fermée entre-temps). */
    @PluginMethod
    fun testIn(call: PluginCall) {
        val s = call.getInt("seconds", 10) ?: 10
        BriefScheduler.schedule(context, System.currentTimeMillis() + s * 1000L)
        call.resolve()
    }
}
