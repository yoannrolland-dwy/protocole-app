// Fin de repos annoncée par Jeffrey (31/10/2026, demande de Yoann) : juste après le bip, une
// phrase qui dit ce qui vient — la série suivante du même exercice, sinon l'exercice suivant,
// sinon qu'il ne reste qu'à valider. Calculée au moment où la série est cochée (le réveil natif
// la joue, app fermée ou non) ; textes fixes du recueil, aucun appel à l'IA.
import { say } from "./jeffrey.js";
import { nextAfter } from "@rawcare/core/session/engine";

/** Nom d'exercice lisible à voix haute : sans parenthèses, « @60° » → « à 60° », tiret → virgule. */
export function spokenName(nom) {
  const s = String(nom || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/@\s*/g, "à ")
    .replace(/\s+[—–-]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** « de développé incliné » / « d'élévations latérales ». */
export const ofName = (nom) => {
  const x = spokenName(nom);
  return /^[aeiouyàâéèêëîïôûü]/i.test(x) ? `d'${x}` : `de ${x}`;
};

/** Ce qui vient après une série : `nextAfter` du moteur de séance (G4-C1), ré-exporté ici. */
export { nextAfter };

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
