// Écriture de la conversation de Jeffrey par les pages sans écran (réponse depuis la notification,
// brief, point ou bilan demandé par le pont), sortie de brief.js le 11/11/2026 pour être testée.
// Audit du 10/11/2026, point 13 : un tour réécrivait le jour entier avec la copie prise au départ.
import { getSync, store } from "../store.js";
import { today, shiftDateKey } from "@rawcare/core/dateUtils";
import { mergeTurn, unionDay } from "./jeffreyTurn.js";

/** Enregistre la conversation du jour (élagage à 30 jours, comme App.jsx). */
export function saveDay(date, entries) {
  const oldest = shiftDateKey(today(), -30);
  const log = { ...getSync("jeffreyLog", {}), [date]: entries };
  return store.set("jeffreyLog", Object.fromEntries(Object.entries(log).filter(([d]) => d >= oldest)));
}

/**
 * Range le résultat d'un tour dans la conversation relue À L'INSTANT dans le stockage : l'app
 * ouverte a pu y écrire pendant la réponse (carte confirmée, autre message). `base` : la
 * conversation lue au départ ; `patch` : retouche d'une entrée existante (réponse rapide touchée).
 */
export function saveTurn(date, base, result, patch) {
  const current = getSync("jeffreyLog", {})[date] || [];
  const merged = mergeTurn(current, base, result);
  return saveDay(date, patch ? merged.map(patch) : merged);
}

/**
 * Applique `next` (une version complète du jour calculée sur une copie) sans effacer ce qui a été
 * écrit ailleurs entre-temps : `next` fait foi, les entrées et décisions qu'il ignore sont gardées.
 */
export function saveDayMerged(date, next) {
  const current = getSync("jeffreyLog", {})[date] || [];
  return saveDay(date, unionDay(next, current));
}
