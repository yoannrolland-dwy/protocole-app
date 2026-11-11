package com.yoannrolland.protocole

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Service au premier plan court du brief du matin (J4.1, 29/10/2026). Essai réel du 29/10 : avec
 * l'économie d'énergie activée, Android coupe le réseau d'une app en arrière-plan
 * (`blocked=BATTERY_SAVER|APP_BACKGROUND`) — le réveil et la page sans écran tournaient, mais l'appel
 * à l'IA n'obtenait aucune réponse. Démarré seulement quand le brief s'écrit (BriefRunner, pont
 * `preparing`), il fait passer l'app au premier plan pour Android le temps de l'appel, ce qui lui
 * rend le réseau. Il ne fait rien d'autre que porter la notification « Je prépare votre brief ».
 * J4.3 (30/10/2026) : aussi pendant une réponse depuis la notification et la lecture d'un message.
 * Sa notification a son propre identifiant, pour ne jamais effacer le fil de la conversation
 * (la notification de Jeffrey) quand le service s'arrête.
 * Type `shortService` : pas de permission particulière, arrêté par Android après ~3 min au plus.
 */
class BriefService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        BriefRunner.ensureChannel(this)
        val text = intent?.getStringExtra("text") ?: "Je prépare votre brief, Monsieur."
        val n = NotificationCompat.Builder(this, BriefRunner.CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Jeffrey")
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .build()
        // Premier plan refusé par Android (audit du 10/11/2026, points 20-21) : arrêt immédiat. Sans
        // lui, Android fait planter l'app quelques secondes plus tard (service demandé au premier
        // plan qui ne l'a jamais été). L'appel en cours continue sans service, comme avant.
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(BriefRunner.SERVICE_NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
            else startForeground(BriefRunner.SERVICE_NOTIF_ID, n)
        } catch (e: Exception) {
            Log.w("JeffreyBrief", "premier plan refusé : ${e.javaClass.simpleName}")
            BriefServiceLease.reset()
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    // Délai du type shortService atteint : on s'arrête, BriefRunner a de toute façon rendu la main.
    // Les usages encore notés sont oubliés : le prochain repart d'un service neuf.
    override fun onTimeout(startId: Int) { BriefServiceLease.reset(); stopSelf() }
}

/**
 * Usages en cours du service (audit du 10/11/2026, point 16). Quatre usages se le partagent : la
 * page sans écran (brief, réponse depuis la notification, sauvegarde), le bouton Écouter et
 * l'analyse demandée par le pont. Chacun arrêtait le service pour tout le monde : l'arrêt différé
 * de 150 s d'une réponse lue à voix haute coupait la réponse suivante en plein appel. Désormais,
 * chaque usage prend un ticket et rend le sien ; le service ne s'arrête qu'au dernier. Pur.
 */
class LeaseCounter {
    private val held = HashSet<Long>()
    private var next = 1L
    @Synchronized fun acquire(): Long { val id = next++; held.add(id); return id }
    /** Rend le ticket `id`. Vrai si plus aucun usage n'est en cours (le service peut s'arrêter).
     *  Un ticket inconnu ou déjà rendu ne fait rien : faux. */
    @Synchronized fun release(id: Long): Boolean = held.remove(id) && held.isEmpty()
    @Synchronized fun clear() = held.clear()
    @Synchronized fun count(): Int = held.size
}

object BriefServiceLease {
    private val counter = LeaseCounter()

    /** Démarre le service (ou met à jour son texte) et rend un ticket ; `null` si Android refuse. */
    fun acquire(context: Context, text: String): Long? = if (update(context, text)) counter.acquire() else null

    /** Met à jour le texte du service déjà demandé, sans nouveau ticket. */
    fun update(context: Context, text: String): Boolean = try {
        ContextCompat.startForegroundService(context, Intent(context, BriefService::class.java).putExtra("text", text))
        true
    } catch (e: Exception) {
        Log.w("JeffreyBrief", "service au premier plan refusé : ${e.javaClass.simpleName}")
        false
    }

    /** Rend le ticket ; arrête le service s'il était le dernier. Sans ticket : rien. */
    fun release(context: Context, id: Long?) {
        if (id != null && counter.release(id)) context.stopService(Intent(context, BriefService::class.java))
    }

    fun reset() = counter.clear()
}
