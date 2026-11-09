// Note par exercice (09/11/2026, demande de Yoann) : réglages des machines (siège, dossier,
// cran des sécurités…). Attachée au NOM de l'exercice, comme son historique : la même note
// revient à chaque séance, dans tous les gabarits. Clé `exoNotes` = { [nom]: texte }, dans
// DATA_KEYS (exportée). Une note vide est retirée de la clé.
import { getSync, store } from "../store.js";

export const NOTES_KEY = "exoNotes";

export function readExoNotes() {
  const v = getSync(NOTES_KEY, {});
  return v && typeof v === "object" ? v : {};
}

/** Pur : nouvelles notes après saisie de `text` pour `nom` (vide = retirée). */
export function withExoNote(notes, nom, text) {
  const next = { ...(notes || {}) };
  if (String(text ?? "").trim()) next[nom] = String(text);
  else delete next[nom];
  return next;
}

/** Écrit la note de `nom` en relisant le stockage (une autre page a pu écrire entre-temps). */
export function saveExoNote(nom, text) {
  const next = withExoNote(readExoNotes(), nom, text);
  store.set(NOTES_KEY, next);
  return next;
}

/** Première ligne, pour l'aperçu replié. */
export const notePreview = (text) => String(text || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
