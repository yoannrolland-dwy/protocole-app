// Stockage local persistant (localStorage) + export/import JSON.
// Même API async (get/set) que la version artefact, pour ne rien changer dans App.jsx.

const PREFIX = "protocole:";

// Variante synchrone de `get` — même lecture, sans le `Promise` inutile. Sert au Coach IA
// (buildPrompt/buildBriefing, tous deux synchrones) pour lire `foodLog` au moment exact du
// clic sur "Analyser" plutôt qu'une copie chargée au montage de l'app, qui pourrait être
// périmée si un repas a été ajouté dans l'onglet Repas pendant la session en cours.
export function getSync(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

// Écriture qui échoue (audit du 10/11/2026, lot 1, point 3) : jusqu'ici un simple
// `console.error`, donc une saisie perdue sans que personne le sache (stockage plein, surtout).
// Désormais l'échec est retenu (`storageError`) et annoncé par cet événement, que l'app affiche
// en bandeau. `set` rend `true` si la valeur est bien écrite, `false` sinon.
export const STORAGE_ERROR_EVENT = "protocole:storage-error";
let lastError = null;
// Après une restauration (`importData`), plus rien n'est écrit jusqu'au rechargement de la page :
// l'état React encore en mémoire (synchro Health Connect, effets d'enregistrement) réécrirait
// sinon l'état d'avant par-dessus la sauvegarde restaurée (audit, point 4).
let frozen = false;

const isQuota = (e) => e?.name === "QuotaExceededError" || e?.code === 22 || e?.code === 1014;

function writeRaw(key, raw) {
  try {
    localStorage.setItem(PREFIX + key, raw);
    return true;
  } catch (e) {
    lastError = { key, at: new Date().toISOString(), quota: isQuota(e), chars: raw.length };
    console.error("storage", key, e?.name || e);
    try {
      if (typeof window !== "undefined" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: lastError }));
      }
    } catch { /* l'annonce ne doit jamais faire échouer l'appelant */ }
    return false;
  }
}

/** Dernière écriture qui a échoué pendant cette session : `{ key, at, quota, chars }` ou `null`. */
export function storageError() { return lastError; }

// Les pages sans écran (pont JEFFREY, réponse depuis la notification, sauvegarde de 14 h / 23 h)
// partagent ce stockage mais pas ce module : le gel leur est signalé par un marqueur daté
// (`restoreLock`, hors DATA_KEYS, jamais exporté), valable RESTORE_LOCK_MS. L'app le retire au
// démarrage suivant (`releaseRestoreLock`, main.jsx), avant tout rendu.
const LOCK_KEY = "restoreLock";
export const RESTORE_LOCK_MS = 15_000;
function lockedByOtherPage() {
  try {
    const t = Number(localStorage.getItem(PREFIX + LOCK_KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < RESTORE_LOCK_MS;
  } catch { return false; }
}
/** Retire le marqueur de restauration. Appelé par la page principale au démarrage seulement. */
export function releaseRestoreLock() {
  try { localStorage.removeItem(PREFIX + LOCK_KEY); } catch { /* rien à faire */ }
}

/** Vrai après une restauration, jusqu'au rechargement (cette page, ou une autre page de l'app). */
export function storageFrozen() { return frozen || lockedByOtherPage(); }

export const store = {
  async get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    if (storageFrozen()) return false;
    let raw;
    try { raw = JSON.stringify(value); } catch (e) { console.error("storage", key, e); return false; }
    // `undefined` n'est pas du JSON : avant, la chaîne "undefined" était écrite, illisible, donc
    // relue comme la valeur par défaut. Même effet, en propre : la clé est retirée.
    if (raw === undefined) {
      try { localStorage.removeItem(PREFIX + key); return true; } catch { return false; }
    }
    return writeRaw(key, raw);
  },
  async del(key) {
    if (storageFrozen()) return false;
    try { localStorage.removeItem(PREFIX + key); return true; } catch { return false; }
  },
};

// Clés de données (hors clé API, qui n'est pas exportée par sécurité).
// Toute nouvelle clé doit être ajoutée ici, sinon elle serait absente de l'export et
// silencieusement perdue à la prochaine restauration.
// `coachProfile` (contexte permanent écrit par l'utilisateur) et `coachJournal` (carnet de
// bord tenu par le modèle) sont du texte libre, ajoutés le 30/07/2026.
// `foodLog` / `foodPins` / `foodMuted` : module Nutrition interne (chantier du
// 01/08/2026, voir src/nutrition/). Déclarés ici DÈS l'étape 1 alors que le module est
// encore isolé de `macroLog` — un journal alimentaire absent de l'export serait perdu à
// la première restauration, et c'est précisément le genre d'oubli que cette liste existe
// pour éviter. `foodMuted` (02/08/2026) : refs retirés de "Vos aliments habituels" (pas de
// l'historique réel — voir suggestions() dans foodStore.js). `foodPortions` / `foodRecipes`
// (M4, 02/08/2026) : portions nommées par aliment et recettes composées. `foodOverrides`
// (V6, 03/08/2026) : corrections de valeurs par `ref`, appliquées À LA LECTURE (donc
// rétroactivement) — perdre cette clé rendrait tout l'historique corrigé silencieusement
// faux, elle est encore moins optionnelle que les autres.
// `elbowLog` (V1, 03/08/2026) : douleur du tendon distal du biceps, MÊME forme que
// `kneeLog` (`{ date, pain, baseline }`). Clé séparée volontairement plutôt qu'un
// `painLog` unique avec un champ `zone` : fusionner aurait imposé de migrer l'historique
// de douleur réel du genou, pour un gain purement esthétique. L'UI et le recommandeur
// sont écrits génériquement (PAIN_ZONES / zoneState dans App.jsx) pour qu'une 3e zone ne
// coûte qu'une ligne — l'élégance de la clé unique sans son risque.
// `climbScheme` (RawCare Phase 1, 06/08/2026 → retiré le 08/10/2026 avec le suivi des blocs
// d'escalade) : plus aucun code ne le lit ni ne l'écrit, la clé reste listée ici uniquement
// pour ne pas casser un export/import existant (même cas qu'`elbowLog`).
export const DATA_KEYS = [
  // "elbowLog" reste ici uniquement pour ne pas perdre l'historique déjà exporté (le coude a
  // été retiré le 05/09/2026, plus aucun code ne le lit ni ne l'écrit — voir CLAUDE.md).
  "weightLog", "sleepLog", "trainingLog", "kneeLog", "elbowLog", "rhrLog", "napLog", "macroLog", "noteLog", "stepsLog",
  "targets", "phase", "hsrWeek", "model", "climbScheme", "basketSchedule",
  // Note par exercice (09/11/2026) : réglages des machines, `{ [nom de l'exercice]: texte }`.
  "exoNotes",
  // Fournisseur IA (26/10/2026). La clé LiteLLM, comme la clé Anthropic, reste hors export.
  "aiProvider", "litellmUrl", "litellmModel",
  // Adresse du serveur de sauvegarde (02/11/2026, vide = adresse par défaut). Sa clé, `backupKey`,
  // reste hors export comme les autres clés secrètes ; le marqueur `serverBackup` aussi.
  "backupUrl",
  // Historique des paliers de cibles (chantier R, R2, 02/10/2026) : le Coach IA et le
  // "Palier de la semaine" (R3) ont besoin de savoir QUAND les kcal ont changé.
  "targetHistory",
  // Proposition hebdomadaire figée du "Palier de la semaine" (R3) : { weekOf, computedAt,
  // result, appliedAt } — recalculée seulement quand la semaine change.
  "palierWeekly",
  "coachProfile", "coachJournal",
  // Jeffrey (chantier J, J1.2, 29/10/2026) : conversations par jour (30 j glissants) et sa
  // personnalité, éditable dans les Réglages.
  "jeffreyLog", "jeffreyPersona",
  // Voix de Jeffrey : { speed, url } depuis le 29/10/2026 (serveur Oracle ; avant : { voice, rate,
  // pitch } de la voix Android, ignorés). Sa clé `voiceKey` reste hors export, comme les autres.
  "jeffreyVoice",
  // Coût de l'IA du mois en cours (J1.3) : { month: "AAAA-MM", cents }.
  "aiSpend",
  "foodLog", "foodPins", "foodMuted", "foodPortions", "foodRecipes", "foodOverrides",
  // Favoris et masqués PAR REPAS (04/11/2026) : { [repas]: [{ ref, name, per100 }] } et
  // { [repas]: [ref] }. Remplacent `foodPins`/`foodMuted` (plus lus, gardés ici pour ne pas
  // perdre ce qu'un ancien export contient, comme `elbowLog`).
  "foodMealPins", "foodMealMuted",
];

export function exportData() {
  const data = {};
  DATA_KEYS.forEach((k) => {
    const v = localStorage.getItem(PREFIX + k);
    if (v != null) { try { data[k] = JSON.parse(v); } catch { /* ignore */ } }
  });
  return { app: "PROTOCOLE", schema: 1, exportedAt: new Date().toISOString(), data };
}

// Place occupée (audit, point 3). Compte les caractères des clés `protocole:` (nom + valeur), ce
// que la WebView limite. Le plafond n'a PAS été mesuré sur le téléphone : 5 millions est la valeur
// habituelle d'une WebView, donnée comme repère seulement.
export const STORAGE_USUAL_LIMIT_CHARS = 5_000_000;
export function storageUsage(top = 3) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      keys.push({ key: k.slice(PREFIX.length), chars: k.length + (localStorage.getItem(k) || "").length });
    }
  } catch { /* lecture impossible : on rend ce qu'on a */ }
  keys.sort((a, b) => b.chars - a.chars);
  return { chars: keys.reduce((s, x) => s + x.chars, 0), top: keys.slice(0, top) };
}

// Vérification d'une sauvegarde avant de l'écrire (audit, point 4). Une valeur `null` ou d'un
// mauvais type (une liste attendue, un objet reçu…) faisait planter le chargement de l'app, bloquée
// sur « Chargement… », sans accès aux Réglages pour réimporter. Les formes viennent des valeurs par
// défaut lues au chargement (App.jsx et les écrans). Les clés que plus aucun code ne lit (`elbowLog`,
// `climbScheme`, `foodPins`, `foodMuted`) sont acceptées telles quelles.
const LISTS = ["weightLog", "sleepLog", "trainingLog", "kneeLog", "rhrLog", "napLog", "macroLog", "noteLog",
  "stepsLog", "targetHistory", "foodLog", "foodRecipes"];
const OBJECTS = ["targets", "basketSchedule", "exoNotes", "jeffreyLog", "jeffreyVoice", "foodPortions",
  "foodOverrides", "foodMealPins", "foodMealMuted"];
const OBJECTS_OR_NULL = ["palierWeekly", "aiSpend"];
const STRINGS = ["phase", "model", "aiProvider", "litellmUrl", "litellmModel", "backupUrl", "coachJournal"];
const STRINGS_OR_NULL = ["coachProfile", "jeffreyPersona"];
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function shapeProblem(k, v) {
  if (LISTS.includes(k)) {
    if (!Array.isArray(v)) return `${k} n'est pas une liste`;
    if (v.some((x) => !isPlain(x))) return `${k} contient une ligne illisible`;
    return null;
  }
  if (OBJECTS.includes(k)) return isPlain(v) ? null : `${k} n'est pas un objet`;
  if (OBJECTS_OR_NULL.includes(k)) return v === null || isPlain(v) ? null : `${k} n'est pas un objet`;
  if (STRINGS.includes(k)) return typeof v === "string" ? null : `${k} n'est pas un texte`;
  if (STRINGS_OR_NULL.includes(k)) return v === null || typeof v === "string" ? null : `${k} n'est pas un texte`;
  if (k === "hsrWeek") return Number.isFinite(Number(v)) && v !== null && v !== "" ? null : "hsrWeek n'est pas un nombre";
  return null;
}

/** `{ data, keys, problems }` : les clés reconnues du fichier et ce qui empêche de le restaurer. */
export function validateImport(obj) {
  const data = isPlain(obj) && isPlain(obj.data) ? obj.data : obj;
  if (!isPlain(data)) return { data: null, keys: [], problems: ["ce n'est pas une sauvegarde PROTOCOLE"] };
  const keys = DATA_KEYS.filter((k) => data[k] !== undefined);
  if (!keys.length) return { data, keys, problems: ["aucune donnée PROTOCOLE reconnue"] };
  const problems = keys.map((k) => shapeProblem(k, data[k])).filter(Boolean);
  if (isPlain(data.basketSchedule)) {
    const b = data.basketSchedule;
    if ((b.weekly !== undefined && !Array.isArray(b.weekly)) || (b.matchDates !== undefined && !Array.isArray(b.matchDates))) {
      problems.push("basketSchedule est mal formé");
    }
  }
  return { data, keys, problems };
}

// Retour arrière d'une restauration interrompue. D'abord retirer TOUTES les clés déjà écrites (la
// place prise par les nouvelles valeurs est libérée), ensuite remettre les anciennes valeurs, enfin
// relire chaque clé. Remettre clé par clé dans l'ordre d'écriture échouait : une ancienne valeur
// plus grosse ne retrouvait pas sa place, prise entre-temps par une autre clé (cas reproduit le
// 11/11/2026). L'état d'avant tenait dans le stockage, il y retient donc en principe ; ce n'est
// PAS garanti (autre page qui écrit au même moment, plafond qui change). Rend les clés qui n'ont
// pas retrouvé leur valeur d'avant : liste vide = état d'avant vérifié, clé par clé.
function rollback(keys, before) {
  keys.forEach((k) => { try { localStorage.removeItem(PREFIX + k); } catch { /* relu plus bas */ } });
  keys.forEach((k) => {
    const prev = before.get(k);
    if (prev != null) { try { localStorage.setItem(PREFIX + k, prev); } catch { /* relu plus bas */ } }
  });
  return keys.filter((k) => {
    try { return localStorage.getItem(PREFIX + k) !== before.get(k); } catch { return true; }
  });
}

/**
 * Restaure une sauvegarde. Le fichier est d'abord vérifié : refusé, rien n'est écrit
 * (`code: "invalid"`). Une écriture qui échoue en route (stockage plein) déclenche le retour
 * arrière, vérifié clé par clé :
 * - tout est revenu → `code: "write"` (rien n'a changé) ;
 * - il reste des clés → `code: "rollback"`, `unrestored` les nomme : leur valeur d'avant n'est plus
 *   sur le téléphone, il faut la reprendre depuis une sauvegarde. Signalé aussi par
 *   STORAGE_ERROR_EVENT.
 * Les clés absentes du fichier ne sont pas touchées (comme avant). En cas de succès, le stockage
 * est figé jusqu'au rechargement, pour cette page et les pages sans écran.
 */
export function importData(obj) {
  if (storageFrozen()) throw new Error("restauration déjà faite, rechargement en cours");
  const { data, keys, problems } = validateImport(obj);
  if (problems.length) {
    const err = new Error(problems.join(", "));
    err.code = "invalid";
    throw err;
  }
  const before = new Map(keys.map((k) => [k, localStorage.getItem(PREFIX + k)]));
  const touched = [];
  for (const k of keys) {
    touched.push(k); // la clé qui échoue est relue aussi : une écriture refusée ne doit rien changer
    if (writeRaw(k, JSON.stringify(data[k]))) continue;
    const quota = !!lastError?.quota;
    const unrestored = rollback(touched, before);
    const cause = quota ? "stockage plein" : "écriture impossible";
    const err = new Error(unrestored.length
      ? `${cause} ; retour arrière incomplet pour : ${unrestored.join(", ")} (valeur d'avant à reprendre depuis une sauvegarde)`
      : `${cause} ; rien n'a été modifié`);
    err.code = unrestored.length ? "rollback" : "write";
    err.unrestored = unrestored;
    if (unrestored.length) {
      lastError = { key: unrestored[0], at: new Date().toISOString(), quota, chars: 0, unrestored };
      try {
        if (typeof window !== "undefined" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: lastError }));
        }
      } catch { /* l'annonce ne doit jamais faire échouer l'appelant */ }
    }
    throw err;
  }
  frozen = true;
  // Marqueur pour les autres pages. S'il ne s'écrit pas (stockage plein), seule cette page est figée.
  let lockShared = true;
  try { localStorage.setItem(PREFIX + LOCK_KEY, String(Date.now())); } catch { lockShared = false; }
  return { keys, lockShared };
}
