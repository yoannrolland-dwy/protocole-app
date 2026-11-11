package com.yoannrolland.protocole

import com.yoannrolland.protocole.bridge.BridgeCaller
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Audit du 10/11/2026, lot 3 : règles pures côté Android, données fictives. */
class Lot3UnitTest {

    // Point 16 : l'arrêt du service par un usage ne coupe plus un autre usage en cours.
    @Test fun serviceArreteSeulementAuDernierUsage() {
        val c = LeaseCounter()
        val voixPrecedente = c.acquire()   // réponse lue à voix haute (arrêt différé de 150 s)
        val nouvelleReponse = c.acquire()  // réponse suivante depuis la notification
        assertFalse(c.release(voixPrecedente)) // l'arrêt différé arrive en plein appel : service gardé
        assertEquals(1, c.count())
        assertTrue(c.release(nouvelleReponse)) // dernier usage rendu : le service peut s'arrêter
        assertFalse(c.release(nouvelleReponse)) // ticket rendu deux fois : rien
        assertFalse(c.release(999L))            // ticket inconnu : rien
    }

    @Test fun troisUsagesEnParallele() {
        val c = LeaseCounter()
        val page = c.acquire(); val ecouter = c.acquire(); val analyse = c.acquire()
        assertFalse(c.release(ecouter))
        assertFalse(c.release(page))
        assertTrue(c.release(analyse))
        c.acquire(); c.clear() // délai du service atteint : tout est oublié
        assertEquals(0, c.count())
    }

    // Point 18 : seule l'appli JEFFREY, signée comme PROTOCOLE, appelle le pont.
    @Test fun appelantDuPont() {
        assertTrue(BridgeCaller.allowed(arrayOf("fr.yrolland.jeffrey"), sameSignature = true))
        assertFalse(BridgeCaller.allowed(arrayOf("fr.exemple.autre"), sameSignature = true))  // autre appli de dév
        assertFalse(BridgeCaller.allowed(arrayOf("fr.yrolland.jeffrey"), sameSignature = false))
        assertFalse(BridgeCaller.allowed(null, sameSignature = true))
        assertFalse(BridgeCaller.allowed(emptyArray(), sameSignature = true))
    }
}
