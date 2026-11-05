package com.yoannrolland.protocole

import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Brief du matin vu depuis l'app (J4.1) : poster la notification de Jeffrey, activer/désactiver
 * depuis les Réglages. Depuis le 01/11/2026 (v3.148.0), plus aucun réveil : le brief part dans
 * l'app quand Monsieur note son genou ; `cancelAlarm` retire un réveil laissé par une ancienne version.
 */
@CapacitorPlugin(name = "Brief")
class BriefPlugin : Plugin() {

    @PluginMethod
    fun cancelAlarm(call: PluginCall) {
        BriefScheduler.cancel(context)
        call.resolve()
    }

    /** Brief écrit par l'app ouverte (30/10/2026) : la notification part quand même, sans bruit
     *  (Monsieur a l'app sous les yeux). `spec` : conversation façon messagerie avec ses boutons
     *  (J4.3, BriefRunner.postThread) ; à défaut, `text` seul. Un tap ouvre la conversation. */
    @PluginMethod
    fun post(call: PluginCall) {
        val spec = call.getString("spec")
        if (spec != null) BriefRunner.postThread(context, spec, alert = false)
        else BriefRunner.post(context, call.getString("text") ?: return call.reject("texte manquant"), alert = false)
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

    /** G2 : prévient JEFFREY que le brief est prêt (`json` = { date, manque }) → { sent }. */
    @PluginMethod
    fun signalJeffrey(call: PluginCall) {
        val json = call.getString("json") ?: return call.reject("json manquant")
        call.resolve(JSObject().put("sent", JeffreySignal.send(context, json, check = true)))
    }

    @PluginMethod
    fun isEnabled(call: PluginCall) {
        call.resolve(JSObject().put("enabled", BriefScheduler.enabled(context)))
    }
}
