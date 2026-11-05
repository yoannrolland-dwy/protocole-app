package com.yoannrolland.protocole

import android.util.Log
import com.getcapacitor.BridgeActivity
import java.lang.ref.WeakReference

/**
 * Pont JEFFREY, G3 (05/11/2026) : une page sans écran (bridge.html, brief.html) vient peut-être
 * d'écrire dans le stockage partagé pendant que l'app est ouverte. On prévient la WebView de l'app
 * (événement `protocole:external` sur `window`) pour qu'elle relise ses données avant tout nouvel
 * enregistrement ; sinon l'enregistrement suivant écraserait ce que JEFFREY vient d'écrire.
 * Deuxième filet derrière l'événement `storage` du navigateur ; le retour au premier plan relit
 * aussi tout. Aucun contenu ne passe : l'app relit elle-même le stockage.
 */
object ExternalWrites {
    private var activity: WeakReference<BridgeActivity>? = null

    @JvmStatic fun attach(a: BridgeActivity) { activity = WeakReference(a) }

    fun notifyApp() {
        val a = activity?.get() ?: return
        if (a.isFinishing || a.isDestroyed) return
        a.runOnUiThread {
            try {
                a.bridge?.triggerWindowJSEvent("protocole:external")
            } catch (e: Exception) {
                Log.w("ExternalWrites", "app non prévenue : ${e.javaClass.simpleName}")
            }
        }
    }
}
