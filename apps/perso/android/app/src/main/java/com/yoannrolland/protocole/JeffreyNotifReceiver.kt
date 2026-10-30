package com.yoannrolland.protocole

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * Boutons de la notification de Jeffrey (J4.3, 30/10/2026), app fermée ou non. Non exporté.
 * - Écouter : lit le dernier message (cache du téléphone, sinon serveur vocal) ; un second tap
 *   arrête la lecture.
 * - Répondre / réponse rapide : la réponse de Monsieur s'affiche aussitôt dans le fil, puis la
 *   page sans écran fait répondre Jeffrey (BriefRunner.runReply), qui met le fil à jour.
 * - Confirmer (ou Revenu à la base / Pas revenu) : la page écrit l'action, sans appel à l'IA.
 * Le service au premier plan (BriefService) garde l'app et le réseau le temps du travail ; un
 * bouton de notification permet de le démarrer depuis l'arrière-plan.
 */
class JeffreyNotifReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_LISTEN = "com.yoannrolland.protocole.JEFFREY_LISTEN"
        const val ACTION_REPLY = "com.yoannrolland.protocole.JEFFREY_REPLY"
        const val ACTION_QUICK = "com.yoannrolland.protocole.JEFFREY_QUICK"
        const val ACTION_CONFIRM = "com.yoannrolland.protocole.JEFFREY_CONFIRM"
        const val KEY_REPLY = "jeffrey_reply"
        private const val TAG = "JeffreyNotif"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_LISTEN -> listen(context)
            ACTION_REPLY -> {
                val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_REPLY)?.toString()?.trim().orEmpty()
                if (text.isNotEmpty()) reply(context, JSONObject().put("kind", "text").put("text", text), text)
            }
            ACTION_QUICK -> {
                val text = intent.getStringExtra("text").orEmpty()
                if (text.isNotEmpty()) reply(context, JSONObject().put("kind", "quick").put("text", text).put("quickFor", intent.getStringExtra("quickFor")), text)
            }
            ACTION_CONFIRM -> {
                val payload = JSONObject().put("kind", "confirm").put("ok", true)
                    .put("entryId", intent.getStringExtra("entryId")).put("actionId", intent.getStringExtra("actionId"))
                if (intent.hasExtra("baseline")) payload.put("baseline", intent.getBooleanExtra("baseline", false))
                reply(context, payload, null)
            }
        }
    }

    private fun keepAlive(context: Context, text: String) {
        try {
            ContextCompat.startForegroundService(context, Intent(context, BriefService::class.java).putExtra("text", text))
        } catch (e: Exception) {
            Log.w(TAG, "service au premier plan refusé", e)
        }
    }

    private fun stop(context: Context) = context.stopService(Intent(context, BriefService::class.java))

    private fun reply(context: Context, payload: JSONObject, userText: String?) {
        BriefRunner.postPending(context, userText)
        keepAlive(context, if (userText != null) "Jeffrey vous répond, Monsieur…" else "Un instant, Monsieur…")
        val pending = goAsync()
        BriefRunner.runReply(context, payload.toString()) { pending.finish() }
    }

    private fun listen(context: Context) {
        if (JeffreySpeech.busy()) { JeffreySpeech.stop(); stop(context); return }
        val v = BriefRunner.storedSpec(context)?.optJSONObject("listen") ?: return
        val arr = v.optJSONArray("chunks") ?: return
        val chunks = (0 until arr.length()).map { arr.getString(it) }
        if (chunks.isEmpty() || v.optString("url").isBlank() || v.optString("key").isBlank()) return
        keepAlive(context, "Jeffrey vous lit son message, Monsieur.")
        JeffreySpeech.begin(
            context, "notif-${System.currentTimeMillis()}",
            JeffreySpeech.Config(v.getString("url").trimEnd('/'), v.getString("key"), v.optDouble("speed", 1.2).toFloat()),
            true, v.optString("cacheKey").ifEmpty { null }, chunks, true,
        ) { stop(context) }
    }
}
