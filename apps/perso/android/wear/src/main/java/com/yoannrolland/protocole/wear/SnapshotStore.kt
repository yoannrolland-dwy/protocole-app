package com.yoannrolland.protocole.wear

import android.content.Context
import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/** Dernier instantané reçu du téléphone, gardé sur la montre : lu par l'appli et par les cartes. */
object SnapshotStore {
    const val PATH = "/protocole/snapshot"
    private const val PREFS = "snapshot"

    fun load(context: Context): Snapshot? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("json", null)?.let { parseSnapshot(it) }

    /** Garde l'instantané s'il est lisible, puis fait redessiner les trois cartes. */
    fun save(context: Context, json: String): Snapshot? {
        val s = parseSnapshot(json) ?: return null
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("json", json).apply()
        val updater = TileService.getUpdater(context)
        for (c in listOf(BordTileService::class.java, JournalTileService::class.java, DepenseTileService::class.java)) {
            updater.requestUpdate(c)
        }
        return s
    }
}

/**
 * Reçoit l'instantané publié par le téléphone même quand l'appli de la montre est fermée
 * (17/11/2026, pour les cartes) : Wear OS réveille ce service à chaque changement de l'élément
 * [SnapshotStore.PATH] (filtre déclaré dans le manifeste).
 */
class SnapshotListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (e in events) {
            if (e.type != DataEvent.TYPE_CHANGED || e.dataItem.uri.path != SnapshotStore.PATH) continue
            DataMapItem.fromDataItem(e.dataItem).dataMap.getString("json")?.let { SnapshotStore.save(this, it) }
        }
    }
}
