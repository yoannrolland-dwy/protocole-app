package com.yoannrolland.protocole

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

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
        if (Build.VERSION.SDK_INT >= 34) startForeground(BriefRunner.SERVICE_NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
        else startForeground(BriefRunner.SERVICE_NOTIF_ID, n)
        return START_NOT_STICKY
    }

    // Délai du type shortService atteint : on s'arrête, BriefRunner a de toute façon rendu la main.
    override fun onTimeout(startId: Int) = stopSelf()
}
