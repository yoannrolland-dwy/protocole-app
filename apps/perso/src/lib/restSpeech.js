// Fin de repos annoncée par Jeffrey (31/10/2026, demande de Yoann) : juste après le bip, une
// phrase qui dit ce qui vient — la série suivante du même exercice, sinon l'exercice suivant,
// sinon qu'il ne reste qu'à valider. Calculée au moment où la série est cochée (le réveil natif
// la joue, app fermée ou non) ; textes fixes du recueil, aucun appel à l'IA.
import { say } from "./jeffrey.js";
import { nextAfter, spokenName, ofName } from "@rawcare/core/session/engine";

/** Ce qui vient après une série : `nextAfter` du moteur de séance (G4-C1), ré-exporté ici. */
export { nextAfter, spokenName, ofName };

const SIDE = { G: "côté gauche", D: "côté droit" };

/** Phrase de fin de repos après la série `si` de l'exercice `ei`. */
export function restAnnouncement(exos, ei, si) {
  const next = nextAfter(exos, ei, si);
  if (next.kind === "set") {
    return say("restEndSet", { n: next.n, dx: ofName(next.nom) + (next.leg ? `, ${SIDE[next.leg]}` : "") });
  }
  if (next.kind === "exercise") return say("restEndNext", { x: spokenName(next.nom) });
  return say("restEndLast");
}

export const holdAnnouncement = () => say("holdEnd");
export const genericAnnouncement = () => say("restEnd");
