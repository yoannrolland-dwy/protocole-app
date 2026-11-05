// Brief du matin de Jeffrey (chantier J, J4.1, 29/10/2026) : quand le lancer. Pur et testé.
//
// 01/11/2026 (v3.148.0, demande de Yoann) : le brief part dans l'app, au moment où Monsieur note
// son genou. C'est toujours sa dernière saisie du matin, et elle ne se fait que dans l'app : la nuit
// et la pesée sont déjà arrivées. Plus aucun réveil en arrière-plan (5 h 17, boucle de 5 min,
// relance de 9 h, brief forcé de 10 h) : il ne pouvait pas écrire le brief puisque le genou manquait
// toujours, et l'app ouverte prenait la main. S'il manque la nuit ou la pesée à ce moment-là, le
// brief part quand même et Jeffrey le dit. « Le brief tout de suite » (carte du Bord) le lance sans
// genou. Une seule fenêtre : le matin, de 5 h à midi.

export const BRIEF = {
  start: [5, 0],
  end: [12, 0],
};

const minutes = (d) => d.getHours() * 60 + d.getMinutes();
const mins = ([h, m]) => h * 60 + m;

/** Ce qui manque encore aujourd'hui, dans l'ordre où Jeffrey l'énumère. */
export function briefMissing({ today, sleep, weight, knee }) {
  const has = (log) => (log || []).some((e) => e.date === today);
  return [!has(sleep) && "nuit", !has(weight) && "pesée", !has(knee) && "genou"].filter(Boolean);
}

/**
 * Brief de l'app, à chaque changement (genou noté, synchro, bouton). `state` = { doneDate }.
 * - done : brief déjà écrit aujourd'hui ;
 * - off : hors de la fenêtre du matin (avant 5 h, à partir de midi) ;
 * - brief : genou du jour noté, ou « Le brief tout de suite » (`force`) ;
 * - wait : le matin, genou pas encore noté (la carte du Bord dit ce qui manque).
 */
export function briefInApp({ now, today, knee, state = {}, force = false }) {
  if (state.doneDate === today) return "done";
  const m = minutes(now);
  if (m < mins(BRIEF.start) || m >= mins(BRIEF.end)) return "off";
  if (force || (knee || []).some((e) => e.date === today)) return "brief";
  return "wait";
}

/**
 * Pont JEFFREY, G3 (05/11/2026, demande de Yoann) : genou noté par JEFFREY (`agir`), app peut-être
 * fermée. Même règle que l'app (`briefInApp`) : si elle lancerait le brief maintenant, on le dit à
 * JEFFREY, qui enchaîne (`brief_fait` d'abord, comme en G2). Rien si le brief est désactivé dans
 * les Réglages, déjà fait, ou déjà réservé par PROTOCOLE aujourd'hui (`brief_fait` répondrait
 * « deja »). → "a_faire" ou null.
 */
export function briefAfterKnee({ now, today, knee, state = {}, enabled = true }) {
  if (enabled === false) return null;
  if (state.claimDate === today) return null;
  return briefInApp({ now, today, knee, state }) === "brief" ? "a_faire" : null;
}

// ── Étape G2 du pont JEFFREY (05/11/2026, décision de Yoann : « secours seulement ») ──────────
// Quand la règle ci-dessus lance le brief, PROTOCOLE prévient d'abord l'appli JEFFREY (diffusion
// PROTOCOLE_BRIEF_READY). JEFFREY confirme par l'opération `brief_fait` du pont AVANT de parler.
// Sans confirmation dans la minute (JEFFREY absent, permission refusée, appli muette), PROTOCOLE
// fait son brief exactement comme avant. Jamais deux briefs : PROTOCOLE « réserve » le brief du
// jour (claimDate) juste avant de l'écrire, et `brief_fait` refuse un jour réservé ou fait.
// État (clé jeffreyBrief, hors DATA_KEYS) : { doneDate, by, claimDate, claimAt, signal: { date, at,
// sent }, backupDate }.

export const SIGNAL_WAIT_MS = 60_000;
// Une réservation en cours bloque une seconde tentative pendant ce temps (un brief tient en moins
// d'une minute) ; au-delà, ou après un échec (claimAt remis à 0), PROTOCOLE peut réessayer.
export const CLAIM_HOLD_MS = 90_000;

/**
 * Brief à lancer (briefInApp a dit « brief ») : que faire de JEFFREY ?
 * - { step: "done" } : brief du jour déjà fait (par l'un ou l'autre) ;
 * - { step: "signal" } : prévenir JEFFREY (pas encore fait aujourd'hui) ;
 * - { step: "wait", leftMs } : JEFFREY prévenu, il a encore `leftMs` pour confirmer ;
 * - { step: "fallback" } : brief de PROTOCOLE (bouton forcé, JEFFREY injoignable, minute passée,
 *   ou brief déjà réservé par PROTOCOLE et à réessayer).
 */
export function briefHandoff({ nowMs, today, state = {}, force = false }) {
  if (state.doneDate === today) return { step: "done" };
  if (force || state.claimDate === today) return { step: "fallback" };
  const s = state.signal;
  if (!s || s.date !== today) return { step: "signal" };
  if (!s.sent) return { step: "fallback" };
  const leftMs = SIGNAL_WAIT_MS - (nowMs - (s.at || 0));
  return leftMs > 0 ? { step: "wait", leftMs } : { step: "fallback" };
}

/** Réserver le brief du jour pour PROTOCOLE → patch à écrire, ou null (déjà fait, ou une
 *  tentative est en cours). À lire et écrire dans la même tâche synchrone. */
export function claimPatch({ nowMs, today, state = {} }) {
  if (state.doneDate === today) return null;
  if (state.claimDate === today && state.claimAt && nowMs - state.claimAt < CLAIM_HOLD_MS) return null;
  return { claimDate: today, claimAt: nowMs };
}

/**
 * Opération `brief_fait` du pont, appelée par JEFFREY avant de parler ou de notifier.
 * → { result, patch } : `patch` à écrire dans l'état (null = rien).
 * - autre date que le jour : { fait: false } ;
 * - essai (`essai: true`, signal envoyé par la commande de test) : { fait: true, essai: true }, rien
 *   n'est marqué ;
 * - brief déjà fait ou réservé par PROTOCOLE : { fait: false, deja: true } ;
 * - sinon : { fait: true }, brief du jour marqué fait par JEFFREY.
 */
export function briefDoneByJeffrey({ date, essai = false }, { today, state = {} }) {
  if (date !== today) return { result: { fait: false }, patch: null };
  if (essai) return { result: { fait: true, essai: true }, patch: null };
  if (state.doneDate === today || state.claimDate === today) return { result: { fait: false, deja: true }, patch: null };
  return { result: { fait: true }, patch: { doneDate: today, by: "jeffrey" } };
}

/** Copie du matin sur le serveur après un brief dit par JEFFREY (PROTOCOLE l'envoie déjà juste
 *  après son propre brief) : une seule fois par jour. */
export const jeffreyBackupDue = ({ today, state = {} }) => state.doneDate === today && state.by === "jeffrey" && state.backupDate !== today;
