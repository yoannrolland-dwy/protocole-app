// Fin de repos annoncée par Jeffrey (31/10/2026, demande de Yoann) : juste après le bip, une
// phrase qui dit ce qui vient — la série suivante du même exercice, sinon l'exercice suivant,
// sinon qu'il ne reste qu'à valider. Calculée au moment où la série est cochée (le réveil natif
// la joue, app fermée ou non) ; textes fixes du recueil, aucun appel à l'IA.
import { say } from "./jeffrey.js";

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

/**
 * Ce qui vient après la série `si` de l'exercice `ei` (considérée comme faite).
 * → { kind: "set", nom, n, leg } | { kind: "exercise", nom } | { kind: "done" }
 */
export function nextAfter(exos, ei, si) {
  const done = (e, i, j) => e.series[j].fait || (i === ei && j === si);
  const e = exos[ei];
  if (e) {
    const j = e.series.findIndex((s, k) => !done(e, ei, k));
    if (j >= 0) {
      const leg = e.series[j].leg ?? null;
      const n = e.series.slice(0, j + 1).filter((s) => (s.leg ?? null) === leg).length;
      return { kind: "set", nom: e.nom, n, leg };
    }
  }
  // Exercice suivant : le premier, après celui-ci, qui reste à faire (une option pas encore
  // commencée est sautée), en repartant du début si besoin.
  for (let k = 1; k < exos.length; k++) {
    const i = (ei + k) % exos.length;
    const x = exos[i];
    const started = x.series.some((s, j) => done(x, i, j));
    if (x.opt && !started) continue;
    if (x.series.some((s, j) => !done(x, i, j))) return { kind: "exercise", nom: x.nom };
  }
  return { kind: "done" };
}

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
