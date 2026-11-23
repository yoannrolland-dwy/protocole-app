package com.yoannrolland.protocole

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Une seule notification de repos (23/11/2026) : décompte et fin de repos partagent un identifiant. */
class RestNotifUnitTest {

    @Test fun decompteEtFinDeReposOntLeMemeIdentifiant() {
        assertEquals(RestNotif.ID, RestTimerPlugin.NOTIF_COUNTDOWN)
        assertTrue(RestNotif.ID != RestNotif.LEGACY_END_ID && RestNotif.ID != RestNotif.LEGACY_AUDIO_ID)
    }

    @Test fun texteDeFinDeRepos() {
        assertEquals("Série suivante, Monsieur.", RestNotif.endText(""))
        assertEquals("Hip thrust — série suivante.", RestNotif.endText("Hip thrust"))
        assertTrue(RestNotif.END_TITLES.all { it.endsWith("Monsieur.") })
    }
}
