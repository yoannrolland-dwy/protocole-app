// Réponses à Jeffrey depuis la notification (chantier J, J4.3, 30/10/2026). Partagé par la page
// sans écran (briefPage.js, app fermée) et l'app ouverte (App.jsx) : ce que la notification de
// Jeffrey affiche, et l'écriture d'une action confirmée sans passer par les écrans.
//
// Choix de Yoann : trois boutons au plus (limite d'Android) — « Écouter » (le dernier message,
// depuis le cache, sans réseau), « Répondre » (réponse écrite dans la notification, Jeffrey
// répond en arrière-plan et sa réponse s'affiche dans la même notification), et une réponse
// rapide proposée par Jeffrey. Une action en attente prend la place de la réponse rapide
// (« Confirmer ») ; une douleur au genou sans réponse sur la base donne « Base » / « Pas la base ».
import { applyWater, applyKnee, appendNote, foodEntriesFor } from "@rawcare/core/coach/jeffrey";
import { deriveMacroLog, resolveLog, syncMacroLog } from "@rawcare/core/nutrition/foodStore";
import { editedFoodLog, withoutDay, waterTotal } from "@rawcare/core/coach/bridgeEdits";
import { today, upsert, byDate } from "@rawcare/core/dateUtils";
import { getSync, store } from "../store.js";
import { TEMPLATES } from "@rawcare/core/session/templates";
import { newSessionDraft } from "@rawcare/core/session/voiceSession";
import { writeDraft } from "./sessionDraft.js";
import { voiceServer, speechPlan } from "./voiceConfig.js";

const MAX_MESSAGES = 6;

/** G4-A : séance que JEFFREY a demandé de démarrer, prise en charge par l'app à son prochain
 *  passage au premier plan (hors DATA_KEYS, valable `JEFFREY_START_MS`). */
export const JEFFREY_START_KEY = "jeffreyStart";
export const JEFFREY_START_MS = 10 * 60_000;

/**
 * Contenu de la notification d'après la conversation du jour. Le fil commence au brief du jour
 * (son message de demande n'est pas montré). → { messages: [{ me, text }], text, quick, confirm,
 * listen } — `quick` : { label, quickFor } ; `confirm` : { entryId, actionId, label,
 * needsBaseline } ; `listen` : voix du dernier message ({ url, key, speed, chunks, cacheKey }).
 */
export function notificationSpec(entries) {
  const list = entries || [];
  let start = -1;
  list.forEach((e, i) => { if (e.role === "user" && e.mode === "brief") start = i; });
  const messages = list.slice(start + 1)
    .filter((e) => !e.hidden && e.text)
    .slice(-MAX_MESSAGES)
    .map((e) => ({ me: e.role === "user", text: e.text }));
  const lastA = [...list].reverse().find((e) => e.role === "assistant" && (e.text || e.actions?.length));
  const pending = lastA?.actions?.find((a) => a.status === "pending");
  const confirm = pending
    ? { entryId: lastA.id, actionId: pending.id, label: pending.label, needsBaseline: pending.kind === "genou" && pending.baseline == null }
    : null;
  const quick = !confirm && lastA?.quick?.options?.length ? { label: lastA.quick.options[0], quickFor: lastA.quick.id } : null;
  const server = voiceServer();
  const plan = lastA?.text ? speechPlan(lastA.text) : null;
  return { messages, text: lastA?.text || "", quick, confirm, listen: server && plan ? { ...server, ...plan } : null };
}

/**
 * Écrit une action confirmée depuis la notification (app fermée) ou demandée par l'appli JEFFREY
 * (pont, G3) : mêmes écritures que les écrans et que `onAction` d'App.jsx, directement dans le
 * stockage. `act.date` : jour visé (aujourd'hui par défaut ; demain pour un repas, G3). Kinds :
 * eau, genou, note, repas, habituel, et pour le pont poids (saisie manuelle de l'onglet Poids)
 * et aliment (aliment nommé). → changement d'eau { before, after } ou null.
 */
export function applyActionStored(act) {
  const date = act.date || today();
  const macros = getSync("macroLog", []);
  if (act.kind === "eau") {
    const before = macros.find((m) => m.date === date)?.water ?? 0;
    const next = applyWater(macros, date, act.ml);
    store.set("macroLog", next);
    return { before, after: next.find((m) => m.date === date).water };
  }
  if (act.kind === "genou") store.set("kneeLog", applyKnee(getSync("kneeLog", []), date, act.pain, act.baseline));
  if (act.kind === "poids") store.set("weightLog", upsert(getSync("weightLog", []), { date, kg: act.kg, source: "manual" }));
  // G4-A : séance faite sans carnet (même ligne que la séance « sport » de l'onglet Séance) ;
  // séance à démarrer : l'app ouverte la prend en charge (consumeJeffreyStart, App.jsx).
  if (act.kind === "seance") store.set("trainingLog", [...getSync("trainingLog", []), act.row].sort(byDate));
  // G4-C3 : une séance de carnet démarrée à la voix existe tout de suite (brouillon), même app
  // fermée ; l'app l'ouvre ensuite telle quelle (`resume`).
  if (act.kind === "demarrer") {
    const carnet = TEMPLATES[act.type]?.kind === "muscu";
    if (carnet) {
      writeDraft(newSessionDraft({
        type: act.type, training: getSync("trainingLog", []), hsrWeek: getSync("hsrWeek", 1),
        date, start: new Date().toTimeString().slice(0, 5),
      }));
    }
    store.set(JEFFREY_START_KEY, { type: act.type, at: Date.now(), ...(carnet ? { resume: true } : {}) });
  }
  if (act.kind === "note") {
    const notes = getSync("noteLog", []);
    const text = appendNote(notes.find((n) => n.date === date)?.text || "", act.text);
    store.set("noteLog", [...notes.filter((n) => n.date !== date), { date, text }].sort(byDate));
  }
  // Modifier à la voix, lots 2 et 3 (25/11/2026) : mêmes écritures que les écrans (Nutrition, Poids,
  // Genou, eau, note du jour) ; les totaux du jour sont refaits par syncMacroLog, qui garde l'eau et
  // vide un jour devenu sans aliment.
  if (act.kind === "aliment_modif" || act.kind === "aliment_retrait") {
    const next = editedFoodLog(getSync("foodLog", []), act);
    store.set("foodLog", next);
    const { macros: synced } = syncMacroLog(macros, resolveLog(next, getSync("foodOverrides", {})), [date]);
    store.set("macroLog", synced);
    return null;
  }
  if (act.kind === "poids_efface") store.set("weightLog", withoutDay(getSync("weightLog", []), date));
  if (act.kind === "genou_efface") store.set("kneeLog", withoutDay(getSync("kneeLog", []), date));
  if (act.kind === "eau_total") store.set("macroLog", waterTotal(macros, date, act.ml));
  if (act.kind === "note_remplace") {
    const notes = getSync("noteLog", []).filter((n) => n.date !== date);
    store.set("noteLog", (act.text ? [...notes, { date, text: act.text }] : notes).sort(byDate));
  }
  if (act.kind === "repas" || act.kind === "habituel" || act.kind === "aliment") {
    const raw = getSync("foodLog", []);
    const added = foodEntriesFor(act, raw, date);
    if (!added.length) return null;
    const next = [...raw, ...added];
    store.set("foodLog", next);
    const derived = deriveMacroLog(resolveLog(next, getSync("foodOverrides", {}))).find((d) => d.date === date);
    if (derived) store.set("macroLog", upsert(macros, derived));
  }
  return null;
}
