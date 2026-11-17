package com.yoannrolland.protocole.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class StatusLineTest {
    @Test
    fun aujourdHui_heureDuCalcul() {
        assertEquals("MAJ 14:32" to false, statusLine("2026-11-17", "14:32", null, "2026-11-17"))
    }

    @Test
    fun aujourdHui_avecRelectureDesPas() {
        assertEquals("MAJ 14:32 · pas 15:02" to false, statusLine("2026-11-17", "14:32", "15:02", "2026-11-17"))
    }

    @Test
    fun autreJour_avertit() {
        assertEquals("Chiffres du 16/11 · ouvre PROTOCOLE" to true, statusLine("2026-11-16", "22:10", null, "2026-11-17"))
    }

    @Test
    fun formePlusRecente_demandeUneMiseAJourDeLaMontre() {
        assertEquals(true, statusLine("2026-11-17", "14:32", null, "2026-11-17", version = 2).second)
    }
}
