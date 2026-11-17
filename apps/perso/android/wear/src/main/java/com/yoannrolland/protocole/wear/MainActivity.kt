package com.yoannrolland.protocole.wear

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

/**
 * Seul écran de l'appli montre. Lit le dernier instantané publié par le téléphone sur la couche de
 * données Wear OS (chemin [PATH]) : à l'ouverture, puis en direct tant que l'écran est affiché.
 * Le dernier instantané reçu est aussi gardé ici pour s'afficher tout de suite au lancement.
 */
class MainActivity : ComponentActivity(), DataClient.OnDataChangedListener {

    companion object {
        const val PATH = SnapshotStore.PATH
        /** Page à ouvrir (« bord », « journal », « depense ») : posé par un toucher sur une carte. */
        const val EXTRA_PAGE = "page"
    }

    private val snapshot = mutableStateOf<Snapshot?>(null)
    // Page demandée par une carte, et un compteur pour que deux touchers de suite sur la même carte comptent.
    private val wantedPage = mutableStateOf<Pair<String, Int>?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        snapshot.value = SnapshotStore.load(this)
        readWantedPage(intent)
        setContent { WatchApp(snapshot.value, wantedPage.value) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readWantedPage(intent)
    }

    private fun readWantedPage(intent: Intent?) {
        val key = intent?.getStringExtra(EXTRA_PAGE) ?: return
        wantedPage.value = key to ((wantedPage.value?.second ?: 0) + 1)
    }

    override fun onResume() {
        super.onResume()
        val client = Wearable.getDataClient(this)
        client.addListener(this)
        // Élément publié par le téléphone, quel que soit le nœud (« wear:// » sans hôte = tous).
        val uri = Uri.Builder().scheme("wear").path(PATH).build()
        client.getDataItems(uri).addOnSuccessListener { buffer ->
            var best: Pair<Long, String>? = null
            for (item in buffer) {
                val map = DataMapItem.fromDataItem(item).dataMap
                val json = map.getString("json") ?: continue
                val sentAt = map.getLong("sentAt")
                if (best == null || sentAt > best.first) best = sentAt to json
            }
            buffer.release()
            best?.let { accept(it.second) }
        }
    }

    override fun onPause() {
        super.onPause()
        Wearable.getDataClient(this).removeListener(this)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (e in events) {
            if (e.type != DataEvent.TYPE_CHANGED || e.dataItem.uri.path != PATH) continue
            DataMapItem.fromDataItem(e.dataItem).dataMap.getString("json")?.let { accept(it) }
        }
        events.release()
    }

    private fun accept(json: String) {
        SnapshotStore.save(this, json)?.let { snapshot.value = it }
    }
}
