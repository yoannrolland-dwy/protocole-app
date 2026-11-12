// Gestes de la séance à la voix (G4-C3, 05/11/2026), sortis de lib/bridge.js le 12/11/2026 (sans
// changement de comportement) pour y ajouter le jeton des gestes et le tester sous Node.
// Règles pures : packages/core/src/session/voiceSession.js ; ici, l'écriture du brouillon et le
// réveil de fin de repos (natif, par la page du pont).
//
// Jeton des gestes (12/11/2026, plan jeffrey-app/docs/cadrage/PLAN_JETON_GESTES_SEANCE.md) :
// - sans `jeton` : inchangé, le geste est écrit tout de suite (choix G4-C3) ;
// - relecture (`verifier: true`) : rien n'est écrit dans la séance ; la réponse porte un jeton qui
//   lie l'action, les paramètres et la CIBLE du geste (séance, exercice, série, minuteur) ;
// - écriture AVEC un `jeton` (même vide, nul, périmé ou déjà utilisé) : jamais de repli vers le
//   geste immédiat. Le jeton est retiré d'abord (usage unique), puis le geste est recalculé sur la
//   séance du moment et écrit seulement si sa cible est identique.
// La cible ne contient ni `rev` ni l'état du décompte : un repos qui s'écoule, démarre ou s'arrête
// ne fait pas refuser une série inchangée.
import { getSync, store } from "../store.js";
import { readDraft, writeDraft } from "./sessionDraft.js";
import { restAnnouncement } from "./restSpeech.js";
import { nativeRest, markJeffreyRest, restAfterSet } from "./bridgeRest.js";
import { logSet, undoLastSet, goToExercise, nextExercise, restAction } from "@rawcare/core/session/voiceSession";
import { currentSet } from "@rawcare/core/session/engine";
import { paramsKey } from "@rawcare/core/coach/bridgeActions";
import { AGIR_KEY, AGIR_TTL_MS, pendingAgir, newJeton, keptAgir } from "./agirTokens.js";

export const SESSION_NOW = new Set(["noter_serie", "annuler_serie", "aller_a", "exercice_suivant", "repos"]);

export function sessionCtx(now) {
  return { training: getSync("trainingLog", []), knee: getSync("kneeLog", []), now };
}

export const NOT_READ_BACK = "rien n'a été relu à Monsieur pour ce geste (jeton vide, inconnu, périmé, déjà utilisé ou paramètres différents) : rien n'a été écrit ; relisez-le d'abord";
export const SESSION_CHANGED = "la séance a changé depuis la relecture";

/** JSON à clés triées : deux cibles égales donnent le même texte, quel que soit l'ordre des champs. */
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

const exo = (d, ei) => (Number.isInteger(ei) && d.exos[ei] ? { ei, nom: d.exos[ei].nom } : null);

/**
 * Cible d'un geste : ce qu'il va toucher, calculé sur le brouillon AVANT le geste (`d`) et le
 * résultat de la règle (`r`). Toujours l'identité de la séance (type, date, début, séance modifiée).
 * - noter_serie : exercice (index, nom), série (index), jambe, série encore non faite, et les
 *   valeurs qui seront écrites (répétitions ou secondes, kilos) ;
 * - annuler_serie : la série notée à la voix visée (index, nom), son état actuel et son état d'avant ;
 * - aller_a, exercice_suivant : exercice de départ (série en cours) et exercice d'arrivée ;
 * - repos « lancer » : l'exercice dont le repos est lancé et sa durée (l'effet ne dépend pas d'un
 *   minuteur déjà en cours) ; autres actions : le minuteur visé (en cours ou non, heure de fin s'il
 *   tourne, reste s'il est arrêté, durée, exercice). Un minuteur remplacé a une autre heure de fin.
 */
export function gestureTarget(action, d, r, p, now) {
  const seance = { type: d.type, date: d.date, start: d.start ?? null, editingId: d.editingId ?? null };
  if (action === "noter_serie") {
    const before = d.exos[r.ei].series[r.si];
    const after = r.draft.exos[r.ei].series[r.si];
    return { seance, exercice: exo(d, r.ei), si: r.si, jambe: before.leg ?? null, faite: !!before.fait, ecrit: { val: after.val, poids: after.poids } };
  }
  if (action === "annuler_serie") {
    const last = d.voix.last;
    return { seance, exercice: exo(d, last.ei), si: last.si, serie: d.exos[last.ei].series[last.si], avant: last.before };
  }
  if (action === "aller_a" || action === "exercice_suivant") {
    const from = currentSet(d.exos, { ei: d.courant });
    return { seance, de: exo(d, from?.ei), vers: exo(d, r.draft.courant) };
  }
  if (p?.action === "lancer") {
    const cur = currentSet(d.exos, { ei: d.courant });
    return { seance, repos: "lancer", exercice: exo(d, cur?.ei ?? 0), secs: r.draft.rest.secs };
  }
  const t = d.rest;
  const enCours = !!t?.endAt && t.endAt > now;
  const minuteur = t ? { enCours, endAt: enCours ? t.endAt : null, restant: enCours ? null : t.remaining ?? null, secs: t.secs ?? null, label: t.label ?? "" } : null;
  return { seance, repos: p?.action ?? null, minuteur };
}

/** La règle du geste sur le brouillon `d` → résultat de voiceSession (refus compris). */
function applyRule(action, d, p, now) {
  const ctx = sessionCtx(now);
  if (action === "noter_serie") return logSet(d, p, ctx);
  if (action === "annuler_serie") return undoLastSet(d);
  if (action === "aller_a") return goToExercise(d, p, ctx);
  if (action === "exercice_suivant") return nextExercise(d, ctx);
  return restAction(d, p?.action, now);
}

const refusal = (r) => {
  const out = { fait: false, raison: r.raison };
  if (r.choix) out.choix = r.choix;
  if (r.besoin) out.besoin = r.besoin;
  return out;
};

/** Écrit le geste (brouillon, repos, réveil) → { fait: true, resume, record?, plateau? }. */
function writeGesture(action, p, r, now) {
  let draft = r.draft;
  // Série notée : repos de l'exercice lancé, avec la phrase de fin de repos du carnet.
  if (action === "noter_serie") {
    // Sans repos prévu : aucun minuteur, le repos en cours s'arrête, pas de bip (`restAfterSet`).
    draft = restAfterSet(draft, { secs: r.restSecs, label: draft.exos[r.ei].nom, speech: restAnnouncement(draft.exos, r.ei, r.si), now });
  }
  if (action === "annuler_serie" && draft.rest?.endAt) draft = { ...draft, rest: { ...draft.rest, endAt: null, remaining: draft.rest.secs } };
  if (action === "repos" && p?.action === "lancer") {
    const cur = currentSet(draft.exos, { ei: draft.courant });
    if (cur) draft = { ...draft, rest: { ...draft.rest, speech: restAnnouncement(draft.exos, cur.ei, -1) } };
  }
  const out = { fait: true, resume: r.phrase };
  if (r.record) out.record = true;
  if (r.plateau) out.plateau = r.plateau;
  draft = markJeffreyRest(draft, action);
  writeDraft(draft);
  if (action === "noter_serie" || action === "annuler_serie" || action === "repos") nativeRest(draft.rest);
  return out;
}

/**
 * Geste de séance. `write: false` : relecture (rien n'est écrit dans la séance) → { ok, resume,
 * immediat: true, jeton } ou un refus. `write: true` sans option `jeton` : écrit tout de suite,
 * comme avant. `write: true` avec l'option `jeton` (présente, quelle que soit sa valeur) : écrit
 * seulement si le jeton est valable et la cible inchangée, sinon { fait: false, raison }.
 */
export async function runSessionNow(action, p, opts = {}) {
  const { now = Date.now(), write = true } = opts;
  const withToken = write && Object.prototype.hasOwnProperty.call(opts, "jeton");
  const key = paramsKey(action, p && typeof p === "object" ? p : {});
  let entry = null;
  if (withToken) {
    // Usage unique : le jeton fourni est retiré avant tout, qu'il soit valable ou non.
    const pending = pendingAgir(now);
    const id = typeof opts.jeton === "string" && opts.jeton ? opts.jeton : null;
    entry = id ? pending[id] ?? null : null;
    if (entry) {
      delete pending[id];
      // Si le retrait ne peut pas être enregistré, le jeton resterait réutilisable : on n'écrit rien.
      if (!(await store.set(AGIR_KEY, pending))) return { fait: false, raison: "le jeton n'a pas pu être retiré (stockage) : rien n'a été écrit" };
    }
    if (!entry || entry.key !== key || typeof entry.cible !== "string") return { fait: false, raison: NOT_READ_BACK };
  }
  const d = readDraft();
  const r = applyRule(action, d, p, now);
  // Après un « oui », un refus est définitif (sans `choix` ni `besoin`) : il faut relire à nouveau.
  if (!r.ok) return withToken ? { fait: false, raison: `${SESSION_CHANGED} : ${r.raison} ; rien n'a été écrit` } : refusal(r);
  if (!write) {
    const jeton = newJeton();
    const cible = canon(gestureTarget(action, d, r, p, now));
    const saved = await store.set(AGIR_KEY, Object.fromEntries([...keptAgir(now), [jeton, { key, resume: r.phrase, exp: now + AGIR_TTL_MS, cible }]]));
    // Sans jeton enregistré, la confirmation serait refusée : on le dit tout de suite.
    if (!saved) return { fait: false, raison: "la relecture n'a pas pu être gardée (stockage) : rien n'a été écrit" };
    return { ok: true, resume: r.phrase, immediat: true, jeton };
  }
  if (withToken && canon(gestureTarget(action, d, r, p, now)) !== entry.cible) {
    return { fait: false, raison: `${SESSION_CHANGED} (autre séance, autre exercice, autre série ou autre minuteur) : rien n'a été écrit ; relisez à Monsieur : ${r.phrase}` };
  }
  return writeGesture(action, p, r, now);
}
