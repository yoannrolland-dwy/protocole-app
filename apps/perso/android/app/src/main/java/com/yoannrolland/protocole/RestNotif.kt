package com.yoannrolland.protocole

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * UNE seule notification de repos (23/11/2026, demande de Yoann : « il faut qu'il n'y ait qu'une
 * seule notification protocole active »). Avant, jusqu'à trois s'empilaient pendant une séance :
 * le décompte « Repos en cours » (4202), « Jeffrey · Fin du repos » pendant le bip (5053) et
 * « Repos terminé » (4201, restée jusqu'au toucher). Désormais tout passe par l'identifiant
 * [ID] : le décompte, puis la fin de repos qui le remplace (portée par le service du bip le temps
 * du son, puis détachée pour rester affichée), puis le décompte suivant qui la remplace.
 *
 * À la validation ou à l'abandon d'une séance, [clearAll] retire toutes les notifications de
 * PROTOCOLE (demande du même jour).
 */
object RestNotif {
    const val ID = 4202
    /** Ancienne « Repos terminé » (jusqu'à la v3.176.0), effacée si elle traîne après la mise à jour. */
    const val LEGACY_END_ID = 4201
    /** Ancienne notification du service du bip (jusqu'à la v3.176.0). */
    const val LEGACY_AUDIO_ID = 5053

    /** La fin de repos est affichée (et pas le décompte) : « masquer le décompte » n'y touche pas. */
    @Volatile var showingEnd = false

    /** Fin de repos dans la voix de Jeffrey (lot JT, 29/10/2026) : très court, lu entre deux séries. */
    val END_TITLES = listOf(
        "Repos terminé, Monsieur.",
        "À vous, Monsieur.",
        "La barre vous attend, Monsieur.",
        "Fin de la récréation, Monsieur.",
    )

    /** Texte sous le titre de fin de repos. */
    fun endText(exercise: String): String =
        if (exercise.isEmpty()) "Série suivante, Monsieur." else "$exercise — série suivante."

    private fun openApp(context: Context): PendingIntent? =
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

    /** La notification de fin de repos (même contenu qu'avant le 23/11/2026, même canal). */
    fun endNotification(context: Context, exercise: String): Notification {
        RestTimerPlugin.ensureChannels(context)
        return NotificationCompat.Builder(context, RestTimerPlugin.CHANNEL_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(END_TITLES.random())
            .setContentText(endText(exercise))
            .setAutoCancel(true)
            .setSilent(true) // le son est joué à part (RestEndAudio), pas de doublon
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(openApp(context))
            .build()
    }

    /** Affiche la fin de repos à la place du décompte (sans passer par le service du bip). */
    fun postEnd(context: Context, exercise: String) {
        runCatching { NotificationManagerCompat.from(context).notify(ID, endNotification(context, exercise)) }
        showingEnd = true
    }

    /** Le décompte va s'afficher : il remplace la fin de repos précédente. */
    fun countdownShown(context: Context) {
        showingEnd = false
        runCatching { NotificationManagerCompat.from(context).cancel(LEGACY_END_ID) }
    }

    /** Masque le décompte (pause, arrêt, fin vue app ouverte), jamais une fin de repos affichée. */
    fun hideCountdown(context: Context) {
        if (showingEnd) return
        runCatching { NotificationManagerCompat.from(context).cancel(ID) }
    }

    /**
     * Séance validée ou abandonnée : plus de réveil de repos, plus de bip, et TOUTES les
     * notifications de PROTOCOLE retirées (repos, brief de Jeffrey, rappel de sauvegarde). Un rappel
     * programmé reviendra à sa date ; un service encore au premier plan garde la sienne.
     */
    fun clearAll(context: Context) {
        RestTimerPlugin.cancelFromBridge(context)
        showingEnd = false
        runCatching { NotificationManagerCompat.from(context).cancelAll() }
    }
}
