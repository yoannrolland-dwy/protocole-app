package com.yoannrolland.protocole

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Montre (17/11/2026) : relecture des pas toutes les 30 min, données fictives. */
class WatchSyncUnitTest {

    private fun snapshot(date: String, count: Int) = JSONObject()
        .put("v", 1).put("date", date).put("at", "14:32")
        .put("pages", org.json.JSONArray().put(JSONObject().put("key", "bord").put("items", org.json.JSONArray()
            .put(JSONObject().put("t", "tile").put("label", "Kcal").put("value", "400"))
            .put(JSONObject().put("t", "tile").put("id", "pas").put("count", count).put("target", 10000)
                .put("value", "x").put("pct", 0).put("barCol", "#d7ff3f").put("valueCol", "#f5f5f0")))))
        .toString()

    private fun pas(json: String) = JSONObject(json).getJSONArray("pages").getJSONObject(0).getJSONArray("items").getJSONObject(1)

    @Test fun nouveauComptePatcheLaTuileEtNoteLHeure() {
        val out = WatchSync.patchSteps(snapshot("2026-11-17", 4000), 6543, "2026-11-17", "15:02")!!
        val p = pas(out)
        assertEquals(6543, p.getInt("count"))
        assertEquals(65, p.getInt("pct"))
        assertEquals("#d7ff3f", p.getString("barCol"))
        assertEquals("15:02", JSONObject(out).getString("stepsAt"))
        assertEquals("14:32", JSONObject(out).getString("at")) // l'heure du calcul complet ne bouge pas
    }

    @Test fun objectifAtteintPasseEnBleu() {
        val p = pas(WatchSync.patchSteps(snapshot("2026-11-17", 9000), 10200, "2026-11-17", "15:02")!!)
        assertEquals("#5ab4ff", p.getString("barCol"))
        assertEquals("#5ab4ff", p.getString("valueCol"))
        assertEquals(100, p.getInt("pct"))
    }

    @Test fun instantaneDUnAutreJourOuInchangeNestPasRepublie() {
        assertNull(WatchSync.patchSteps(snapshot("2026-11-16", 4000), 6543, "2026-11-17", "00:30"))
        assertNull(WatchSync.patchSteps(snapshot("2026-11-17", 6543), 6543, "2026-11-17", "15:02"))
    }
}
