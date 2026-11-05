// Brouillon de la séance en cours (`trainingDraft`, hors DATA_KEYS) — G4-C2, 05/11/2026.
// Depuis C2, c'est LA séance en cours : chaque geste du carnet applique le moteur de séance
// (packages/core/src/session/engine.js) au brouillon STOCKÉ, l'enregistre aussitôt, puis l'écran
// l'affiche. Une autre page (l'appli JEFFREY par le pont, en C3) peut donc écrire une série pendant
// que le carnet est ouvert : le carnet la relit (événement DRAFT_EVENT) au lieu de l'écraser.
//
// Forme : { type, date, editingId, start, duration, rpe, exos, rev, rest? }.
// - `rev` augmente à chaque écriture ; `ownRev` = la dernière écrite par CETTE page, pour savoir
//   si le brouillon a changé ailleurs.
// - `rest` = minuteur de repos { secs, remaining, endAt, label, speech } (lib/restTimer.js).
import { getSync, store } from "../store.js";

export const DRAFT_KEY = "trainingDraft";
/** Le brouillon a peut-être été écrit par une autre page : relisez-le (envoyé par App.jsx). */
export const DRAFT_EVENT = "protocole:trainingDraft";

let ownRev = null;

export const readDraft = () => getSync(DRAFT_KEY, null);

/** Enregistre `next` comme brouillon (rev + 1). → le brouillon écrit. */
export function writeDraft(next) {
  const rev = (readDraft()?.rev ?? 0) + 1;
  const d = { ...next, rev };
  store.set(DRAFT_KEY, d);
  ownRev = rev;
  return d;
}

/** Modifie quelques champs du brouillon stocké ; rien s'il n'y en a pas. */
export function patchDraft(patch) {
  const cur = readDraft();
  return cur ? writeDraft({ ...cur, ...patch }) : null;
}

/** Le brouillon stocké vient-il d'une autre page (ou d'avant ce lancement) ? */
export const isForeign = (d) => !!d && d.rev !== ownRev;
/** Brouillon relu : il devient la référence de cette page. */
export const acknowledge = (d) => { if (d) ownRev = d.rev; };
