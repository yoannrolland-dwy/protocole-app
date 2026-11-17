package com.yoannrolland.protocole.wear

import org.json.JSONObject

/**
 * Instantané publié par le téléphone (src/lib/watchSnapshot.js, forme documentée en tête de ce
 * fichier) : trois pages de blocs déjà calculés et mis en forme. La montre ne fait que les lire.
 */
data class Page(val key: String, val title: String, val items: List<JSONObject>)

data class Snapshot(val version: Int, val date: String, val at: String, val stepsAt: String?, val pages: List<Page>)

/** Version de la forme que cette montre sait lire (WATCH_SNAPSHOT_VERSION côté téléphone). */
const val SNAPSHOT_VERSION = 1

fun parseSnapshot(json: String): Snapshot? = try {
    val o = JSONObject(json)
    val pagesJson = o.getJSONArray("pages")
    val pages = (0 until pagesJson.length()).map { i ->
        val p = pagesJson.getJSONObject(i)
        val items = p.optJSONArray("items")
        Page(
            key = p.optString("key"),
            title = p.optString("title"),
            items = if (items == null) emptyList() else (0 until items.length()).map { items.getJSONObject(it) },
        )
    }
    Snapshot(
        version = o.optInt("v", 0),
        date = o.optString("date"),
        at = o.optString("at"),
        stepsAt = o.optString("stepsAt").ifEmpty { null },
        pages = pages,
    )
} catch (e: Exception) {
    null
}

/**
 * Ligne d'état en haut de chaque page : heure du dernier calcul (et de la dernière relecture des
 * pas), ou un avertissement si les chiffres sont ceux d'un autre jour (le téléphone ne recalcule
 * tout qu'à l'ouverture de PROTOCOLE ou à une saisie). Second élément : vrai = avertissement.
 */
fun statusLine(date: String, at: String, stepsAt: String?, today: String, version: Int = SNAPSHOT_VERSION): Pair<String, Boolean> {
    if (version > SNAPSHOT_VERSION) return "Appli montre à mettre à jour" to true
    if (date != today) {
        val p = date.split("-")
        val d = if (p.size == 3) "${p[2]}/${p[1]}" else date
        return "Chiffres du $d · ouvre PROTOCOLE" to true
    }
    return ("MAJ $at" + (stepsAt?.let { " · pas $it" } ?: "")) to false
}
