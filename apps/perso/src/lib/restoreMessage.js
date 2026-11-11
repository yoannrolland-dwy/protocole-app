// Message d'une restauration qui n'a pas abouti (fichier ou serveur), selon ce que `importData`
// a constaté (store.js) :
// - `invalid`  : sauvegarde refusée avant toute écriture ;
// - `rollback` : écriture interrompue ET retour arrière incomplet, clés nommées : alerte ;
// - autre      : écriture interrompue, état d'avant relu et retrouvé (le message le dit).
import { say } from "./jeffrey.js";

export function restoreErrorText(err) {
  const x = String(err?.message || err || "cause inconnue");
  if (err?.code === "invalid") return say("importRefused", { x });
  if (err?.code === "rollback") return say("restorePartial", { x });
  return say("restoreFailed", { x });
}
