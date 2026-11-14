// Lecture de l'historique d'entraînement — extrait des closures de `buildPrompt` (App.jsx)
// à l'étape V3 (03/08/2026) pour être partagé entre le Coach IA et l'écran de progression.
//
// Deux consommateurs, deux fenêtres : le Coach IA passe les 14 derniers jours (le prompt
// doit rester identique au caractère près, c'est le test de non-régression de cette
// extraction), l'écran passe tout l'historique. D'où des fonctions qui reçoivent une liste
// de séances DÉJÀ filtrée plutôt qu'une fenêtre en paramètre : impossible de se tromper de
// périmètre, et la fonction reste pure.
//
// Aucune dépendance à React ni à `ui.jsx` : ce module doit rester testable seul en Node.

import { TEMPLATES } from "./session/templates.js";
import { daysBetween, today } from "./dateUtils.js";

const byDateAsc = (a, b) => a.date.localeCompare(b.date);

/**
 * Meilleure série d'un exercice sur une séance : la charge la plus lourde, puis le plus de
 * reps à charge égale. En mode « temps » (planche, iso) la charge vaut 0 partout, donc
 * c'est la tenue la plus longue qui ressort — le même code couvre les deux cas.
 * Ne compte que les séries cochées ET renseignées : une ligne préremplie jamais faite ne
 * doit pas passer pour une performance.
 */
/** Séries cochées ET renseignées d'un exercice (celles qui comptent comme performance). */
export const doneSets = (ex) => (ex.series || []).filter((s) => s.fait && (+s.poids > 0 || +s.val > 0));

export function bestSet(ex) {
  const done = doneSets(ex);
  if (!done.length) return null;
  const b = done.reduce((a, s) => (+s.poids > +a.poids || (+s.poids === +a.poids && +s.val > +a.val) ? s : a), done[0]);
  return { poids: +b.poids || 0, val: +b.val || 0 };
}

/**
 * Agrégat envoyé au Coach IA : meilleure série des 3 dernières séances de chaque exercice
 * + tendance de volume. Sortie volontairement figée (mêmes clés, même ordre) — c'est ce que
 * le prompt sérialise.
 * @param sessions séances déjà filtrées (le Coach IA passe les 14 derniers jours)
 *
 * Corrigé à V3 (03/08/2026) pour les exercices en mode « temps » : le volume charge × reps
 * y valait toujours 0 (la charge est nulle), donc TOUS les gainages étaient annoncés
 * « stable » au coach — une planche passée de 60 s à 55 s comprise. Ils sont désormais
 * comparés en secondes, et affichés « 60s » plutôt que « 0x60 » (que le modèle pouvait lire
 * comme une charge nulle). Seul le mode temps change ; la sortie des exercices en reps est
 * identique au caractère près à celle d'avant l'extraction (vérifié par diff sur un jeu de
 * séances synthétique).
 */
export function exoProgress(sessions) {
  const byExo = {};
  sessions.filter((s) => s.exercices).forEach((s) => {
    s.exercices.forEach((e) => {
      const b = bestSet(e);
      if (!b) return;
      (byExo[e.nom] ||= []).push({ d: s.date, mode: e.mode, rir: e.rir ?? null, ...b, series: doneSets(e) });
    });
  });
  return Object.entries(byExo).map(([nom, hist]) => {
    const h = hist.slice(-3); // 3 dernières séances suffisent pour lire une tendance
    const last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
    // Charge d'abord (progressive overload, 07/08/2026) — même hiérarchie que `beats()`
    // (records) : plus de poids l'emporte même avec moins de reps, à poids égal plus de
    // reps l'emporte. Avant ce correctif, le volume brut (poids × reps) pouvait annoncer
    // "baisse" sur une séance qui venait pourtant de battre un record de charge (ex.
    // 40kg×10 → 45kg×6 : volume en baisse, mais c'est une progression, pas un recul).
    // Baisse confirmée sur deux séances (09/11/2026, `trendOf`).
    // 14/11/2026 : comparaison à format égal (`sessionTrend`), sur toute la fenêtre reçue.
    const asSess = hist.map((x) => ({ best: { poids: x.poids, val: x.val }, series: x.series, rir: x.rir, mode: x.mode }));
    const tendance = { first: "1re fois", up: "hausse", down: "baisse", flat: "stable" }[sessionTrend(asSess, last.mode)];
    return {
      exo: nom,
      series_max: h.map((x) => `${x.d.slice(5)} ${isTimeMode(x.mode) ? `${x.val}s` : `${x.poids}x${x.val}`}`),
      tendance,
      // Reps en réserve (T4, 04/10/2026) : une par séance, dans le même ordre que `series_max`
      // (`null` = non renseigné). Clé omise si aucune séance n'en a — prompt identique à avant.
      ...(h.some((x) => x.rir != null) ? { rir: h.map((x) => x.rir ?? null) } : {}),
    };
  });
}

/* ============================================================
   Écran « Progression par exercice » (V3)
   ============================================================ */

/** Un exercice en mode « temps » se mesure en secondes, pas en charge × reps. */
export const isTimeMode = (mode) => mode === "temps";

/**
 * Grandeur tracée : le volume de la meilleure série (charge × reps), ou les secondes en
 * mode temps. Pas de 1RM estimé — les formules type Epley n'ont aucun sens sur un protocole
 * HSR à tempo 6 s et amplitude 10-60°, et pousser un 1RM sur un tendon en rééducation est
 * contre-indiqué (décision explicite de la roadmap, ne pas ajouter sans demande). Le score de force
 * par groupe (14/11/2026, demandé par Yoann, `strength.js`) en utilise un, quadriceps exclu.
 */
export const setScore = (best, mode) => (isTimeMode(mode) ? best.val : best.poids * best.val);

/** Série lisible pour le tooltip et les listes : « 60 kg × 8 » ou « 45 s ». */
export const setLabel = (best, mode) =>
  isTimeMode(mode) ? `${best.val} s` : `${best.poids} kg × ${best.val}`;

/**
 * Toutes les séances où l'exercice apparaît avec au moins une série faite, du plus ancien
 * au plus récent. Les séances où il a été ouvert mais rien coché sont écartées : elles ne
 * sont pas une performance à zéro, elles ne sont pas une performance du tout.
 */
export function exerciseSessions(training, nom) {
  return (training || [])
    .map((s) => {
      const e = s.exercices?.find((x) => x.nom === nom);
      if (!e) return null;
      const best = bestSet(e);
      if (!best) return null;
      return {
        date: s.date, type: s.type, mode: e.mode, perLeg: !!e.perLeg, rir: e.rir ?? null,
        best, score: setScore(best, e.mode),
        series: doneSets(e),
      };
    })
    .filter(Boolean)
    .sort(byDateAsc);
}

/**
 * Historique détaillé pour le carnet (14/11/2026, demande de Yoann) : les `n` dernières séances
 * de l'exercice, la plus récente en tête, avec TOUTES les séries cochées et le RIR. La séance
 * passée en `exclude` (celle qu'on modifie) n'y figure pas.
 */
export function recentSessionsDetail(training, nom, { exclude = null, n = 5 } = {}) {
  const list = (training || []).filter((s) => !(exclude && (s === exclude || (exclude.id && s.id === exclude.id))));
  return exerciseSessions(list, nom).slice(-n).reverse();
}

/** Une série lisible pour l'historique : « 34×10 », « G 20×10 », « 60 s ». */
export const setShort = (s, mode) =>
  `${s.leg ? `${s.leg} ` : ""}${isTimeMode(mode) ? `${+s.val || 0} s` : `${+s.poids || 0}×${+s.val || 0}`}`;

/**
 * Liste des exercices déjà réalisés (au moins une série cochée), le plus récent en tête.
 * Un exercice jamais fait n'y figure pas : l'écran de détail n'est donc jamais ouvert sur
 * un historique vide.
 */
export function exerciseList(training) {
  const byExo = {};
  (training || []).forEach((s) => {
    (s.exercices || []).forEach((e) => {
      if (!bestSet(e)) return;
      const cur = (byExo[e.nom] ||= { nom: e.nom, mode: e.mode, count: 0, last: "" });
      cur.count += 1;
      if (s.date > cur.last) { cur.last = s.date; cur.mode = e.mode; }
    });
  });
  return Object.values(byExo).sort((a, b) => b.last.localeCompare(a.last) || a.nom.localeCompare(b.nom));
}

/** Un exercice pas fait depuis plus de 60 jours sort de la liste « Progression » et du constat
 * « Plateaux en cours » (25/10/2026, demande de Yoann) : sa tendance ne dit plus rien d'utile.
 * Il n'est PAS supprimé — historique, records, « dernière fois » lisent tout le journal, et
 * l'exercice revient dans la liste dès qu'il est refait. */
export const STALE_EXERCISE_DAYS = 60;
/** Au-delà de 8 semaines entre deux séances d'un exercice, la série « stable » est coupée : après
 * une longue pause le niveau a baissé, « stable » ne veut plus dire « plateau ». */
export const PLATEAU_GAP_DAYS = 56;

/** `exerciseList` scindée en { active, stale } selon `asOf` (défaut : aujourd'hui). */
export function splitExerciseList(training, asOf = today()) {
  const active = [], stale = [];
  exerciseList(training).forEach((e) => (daysBetween(e.last, asOf) > STALE_EXERCISE_DAYS ? stale : active).push(e));
  return { active, stale };
}

/* ============================================================
   RECORDS (V4)
   ============================================================ */

/**
 * `a` bat-il `b` ? Charge la plus lourde, puis le plus de reps à charge égale ; secondes en
 * mode temps. Même hiérarchie que `bestSet`, pour qu'un record soit toujours la série que
 * l'app affiche déjà comme la meilleure.
 * `b` absent = premier passage sur l'exercice : ce n'est PAS un record, c'est une référence
 * (voir `recordsBySession` / `recordToBeat`, qui renvoient `null` dans ce cas).
 */
export function beats(a, b, mode) {
  if (!a) return false;
  if (!b) return false;
  if (isTimeMode(mode)) return +a.val > +b.val;
  return +a.poids > +b.poids || (+a.poids === +b.poids && +a.val > +b.val);
}

/**
 * `a` est-elle NETTEMENT en dessous de `b` ? (09/11/2026, demande de Yoann : une rep de moins
 * n'est pas une baisse.) Même charge avec au moins `DROP_REPS` reps de moins, ou charge plus
 * légère sans plus de reps. Moins lourd mais plus de reps (45×6 → 40×10) n'est pas une baisse.
 * Mode temps : au moins `DROP_TIME_RATIO` de secondes en moins (60 s → 54 s).
 */
export const DROP_REPS = 2;
export const DROP_TIME_RATIO = 0.1;
export function clearDrop(a, b, mode) {
  if (!a || !b) return false;
  if (isTimeMode(mode)) return +a.val <= +b.val * (1 - DROP_TIME_RATIO);
  if (+a.poids === +b.poids) return +a.val <= +b.val - DROP_REPS;
  return +a.poids < +b.poids && +a.val <= +b.val;
}

/**
 * Tendance entre séances (09/11/2026) : `h` = meilleures séries dans l'ordre, la dernière en
 * dernier. « hausse » = la dernière bat l'avant-dernière (charge d'abord, règle du 13/08/2026).
 * « baisse » = les DEUX dernières séances sont nettement en dessous (`clearDrop`) de celle
 * d'avant : un seul mauvais jour reste « stable ». Sinon « stable ».
 */
function trendOf(h, mode) {
  const n = h.length;
  if (n < 2) return "first";
  if (beats(h[n - 1], h[n - 2], mode)) return "up";
  if (n >= 3 && clearDrop(h[n - 1], h[n - 3], mode) && clearDrop(h[n - 2], h[n - 3], mode)) return "down";
  return "flat";
}

/* ------------------------------------------------------------
   Comparaison À FORMAT ÉGAL (14/11/2026, demande de Yoann)
   ------------------------------------------------------------
   Avant, plateau et tendance ne regardaient que la MEILLEURE série : 34×10·10·9·9 puis
   34×10·10·10·9 était « stable », et le garde-fou du volume comparait une Full Body à 3 séries
   à une autre Full Body à 3 séries en ignorant les Upper A à 4 séries entre les deux (« plateau
   depuis 7 séances » le 14/11 alors que les répétitions montaient). Désormais une séance se
   compare à une séance du MÊME FORMAT (même nombre de séries) : plus de charge, ou plus de
   répétitions au total à la même charge, c'est une progression. Le mode « temps » garde la
   règle de la meilleure série (`trendOf`). */

/** Résumé d'une séance d'un exercice : nombre de séries faites, charge la plus lourde,
 *  répétitions totales, volume (charge × reps), RIR. */
export function sessionShape(x) {
  const s = x.series || [];
  return {
    n: s.length,
    top: s.reduce((m, r) => Math.max(m, +r.poids || 0), 0),
    reps: s.reduce((m, r) => m + (+r.val || 0), 0),
    vol: s.reduce((m, r) => m + (+r.poids || 0) * (+r.val || 0), 0),
    rir: x.rir ?? null,
    best: x.best || null,
  };
}

/** `a` progresse-t-elle sur `b` ? Charge plus lourde toujours ; sinon même charge, même nombre de
 *  séries et plus de volume (= plus de répétitions) ; à volume égal, un RIR plus élevé (T4). */
export function shapeBetter(a, b) {
  if (!a || !b) return false;
  if (a.top !== b.top) return a.top > b.top;
  if (a.n !== b.n) return false;
  if (a.vol !== b.vol) return a.vol > b.vol;
  return a.rir != null && b.rir != null && a.rir > b.rir;
}

/** `a` est-elle NETTEMENT en dessous de `b` ? Même format : à même charge, au moins une rep de
 *  moins par série en moyenne (2 au minimum, règle du 09/11/2026) ; plus léger sans plus de
 *  répétitions. Formats différents : règle de la meilleure série (`clearDrop`). */
export function shapeDrop(a, b, mode) {
  if (!a || !b) return false;
  if (a.n !== b.n) return clearDrop(a.best, b.best, mode);
  if (a.top === b.top) return a.reps <= b.reps - Math.max(DROP_REPS, a.n);
  return a.top < b.top && a.reps <= b.reps;
}

/** Tendance d'une liste de séances (la dernière en dernier) : « hausse » si la dernière progresse
 *  sur la précédente du même format (sans séance du même format : seulement si la charge monte),
 *  « baisse » si les deux dernières sont nettement en dessous de celle d'avant. */
export function sessionTrend(list, mode) {
  const n = list.length;
  if (n < 2) return "first";
  if (isTimeMode(mode)) return trendOf(list.map((x) => x.best), mode);
  const sh = list.map(sessionShape);
  const last = sh[n - 1];
  const ref = sh.slice(0, n - 1).reverse().find((x) => x.n === last.n);
  if (ref ? shapeBetter(last, ref) : last.top > sh[n - 2].top) return "up";
  if (n >= 3 && shapeDrop(sh[n - 1], sh[n - 3], mode) && shapeDrop(sh[n - 2], sh[n - 3], mode)) return "down";
  return "flat";
}

/**
 * Meilleure série jamais réalisée sur cet exercice, toutes séances confondues SAUF celle
 * passée en `exclude` (la séance en cours d'écriture ou de modification : elle ne doit pas
 * être son propre record à battre). `null` si l'exercice n'a jamais été fait.
 *
 * Calculé sur TOUT l'historique, jamais sur 14 jours : sinon tout redeviendrait un record
 * tous les quinze jours.
 *
 * Les exercices par jambe sont traités globalement (comme `bestSet`) : le record est la
 * meilleure série, peu importe le côté.
 */
export function recordToBeat(training, nom, exclude = null) {
  let best = null;
  (training || []).forEach((s) => {
    if (s === exclude || (exclude?.id && s.id === exclude.id)) return;
    const e = s.exercices?.find((x) => x.nom === nom);
    if (!e) return;
    const b = bestSet(e);
    if (b && (!best || beats(b, best, e.mode))) best = b;
  });
  return best;
}

/**
 * Records **au moment où ils ont eu lieu** : rejoue l'historique dans l'ordre chronologique
 * et retient, pour chaque séance, les exercices dont la meilleure série a battu tout ce qui
 * précédait.
 *
 * C'est la réponse au piège du premier lancement : on ne déclare pas un record sur chaque
 * exercice de la prochaine séance, on relit l'historique existant pour savoir où en étaient
 * les records à chaque date.
 *
 * @returns Map (objet séance → liste des exercices ayant battu un record ce jour-là). Clé
 *   par référence d'objet, comme la suppression et la modification de séance ailleurs dans
 *   l'app — pas par `id`, que les séances les plus anciennes n'ont pas toutes.
 */
export function recordsBySession(training) {
  const best = {};
  const out = new Map();
  [...(training || [])].sort(byDateAsc).forEach((s) => {
    (s.exercices || []).forEach((e) => {
      const b = bestSet(e);
      if (!b) return;
      const prev = best[e.nom];
      if (!prev) { best[e.nom] = b; return; } // premier passage = référence, pas un record
      if (beats(b, prev, e.mode)) {
        best[e.nom] = b;
        out.set(s, [...(out.get(s) || []), e.nom]);
      }
    });
  });
  return out;
}

/**
 * Douleur hors base ce jour-là, sur l'une ou l'autre des deux zones (V1).
 * Sert de garde-fou d'AFFICHAGE des records : féliciter une charge record le jour où le
 * tendon a flambé, c'est encourager exactement ce que la règle de Silbernagel cherche à
 * éviter. Le record reste calculé et enregistré, il n'est simplement pas mis en avant.
 * Pas de relevé ce jour-là = pas de suppression du badge : une absence de saisie n'est pas
 * une alerte (même principe que le coude dans le recommandeur).
 */
export function painOutOfBase(logs, date) {
  return (logs || []).some((log) => {
    const e = (log || []).find((x) => x.date === date);
    return !!e && (e.baseline === false || e.pain >= 6);
  });
}

/**
 * Tendance sur les 3 dernières séances, même définition que celle envoyée au Coach IA
 * (dernière vs précédente) — l'écran et le coach ne doivent jamais dire deux choses
 * différentes du même historique.
 *
 * Charge d'abord (progressive overload, 07/08/2026) — même hiérarchie que `beats()`
 * (records) : plus de poids l'emporte même avec moins de reps, à poids égal plus de reps
 * l'emporte. Avant ce correctif, le volume brut (poids × reps) pouvait annoncer "baisse"
 * sur une séance qui venait pourtant de battre un record de charge (ex. 40kg×10 → 45kg×6 :
 * volume en baisse, mais c'est une progression, pas un recul) — deux verdicts contradictoires
 * pour le même changement. `delta` reste le volume brut, purement informatif.
 */
export function exerciseTrend(sessions) {
  const h = sessions.slice(-3);
  if (h.length < 2) return { key: "first", label: "1re fois", delta: null };
  const last = h[h.length - 1], prev = h[h.length - 2];
  const delta = last.score - prev.score;
  const key = sessionTrend(sessions, last.mode);
  if (key === "up") return { key: "up", label: "hausse", delta };
  if (key === "down") return { key: "down", label: "baisse", delta };
  return { key: "flat", label: "stable", delta: 0 };
}

/* ============================================================
   Suggestion de progressive overload sur plateau (chantier "4 points IA", point 3, 07/09/2026)
   ============================================================ */

const PLATEAU_STABLE_STREAK = 4; // séances d'affilée "stable" avant de considérer un plateau

/** Toutes les définitions de gabarit pour un exercice donné — un même nom peut apparaître
 * dans plusieurs types (ex. "Leg extension unilatérale" en Lower A/B/C, HSR dans A/C, pas
 * dans B). */
function templateDefsFor(nom) {
  const defs = [];
  for (const t of Object.values(TEMPLATES)) {
    for (const e of t.exos || []) if (e.n === nom) defs.push(e);
  }
  return defs;
}

/** "8-10" → {min:8,max:10} ; "15" → {min:15,max:15} ; sinon `null` (ex. "table HSR"). */
function parseRepRange(r) {
  const m = String(r).match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const min = +m[1];
  return { min, max: m[2] ? +m[2] : min };
}

/**
 * Suggestion de progressive overload (viser le haut de la fourchette de reps, puis passer à
 * la charge supérieure) une fois qu'un plateau est détecté. Un plateau = au moins 4 séances
 * depuis la dernière qui a progressé à format égal (voir le calcul plus bas, 14/11/2026). La
 * durée réelle (`sessions`) est affichée dans le carnet pendant la séance (10/09/2026) et sur
 * la fiche Progression. La charge reste prioritaire (13/08/2026, ne pas rouvrir).
 *
 * Exclusions volontaires (décidées avec Yoann le 07/09/2026, pas des oublis) : les exercices
 * HSR — leur charge est déjà pilotée par la table HSR (semaine 1-12, `hsrForWeek`), une
 * suggestion en plus créerait un conflit avec le protocole de rééduc — et le mode "temps"
 * (gainage/tenues), hors scope pour l'instant.
 *
 * `null` si pas de plateau, si l'exercice est exclu (HSR/temps), ou si sa fourchette de reps
 * n'est pas résolue dans les gabarits (ex. un exercice substitué via la bibliothèque — voir
 * `EXERCISE_LIBRARY` —, jamais catalogué avec sa propre fourchette).
 */
const NO_OVERLOAD_GROUPS = ["mobilite", "coiffe"];
export function progressiveOverloadSuggestion(sessions, nom) {
  if (!sessions || sessions.length < PLATEAU_STABLE_STREAK) return null;
  const last = sessions[sessions.length - 1];
  if (isTimeMode(last.mode)) return null;

  const defs = templateDefsFor(nom);
  if (!defs.length || defs.some((d) => d.hsr)) return null;
  // Mobilité et coiffe des rotateurs (audit du 10/11/2026, point 11) : la consigne y est « léger »
  // ou une amplitude, jamais une charge à pousser. Un plateau n'y veut rien dire, et « passez à la
  // charge supérieure » y serait un mauvais conseil. Le squat sur sécurités n'est PAS concerné :
  // sa règle reste celle de tout exercice en reps (question ouverte, non tranchée).
  if (defs.every((d) => NO_OVERLOAD_GROUPS.includes(d.groupe))) return null;
  const range = parseRepRange(defs[0].r);
  if (!range) return null;

  // 14/11/2026 (demande de Yoann) : la fenêtre du plateau commence à la dernière séance qui a
  // PROGRESSÉ, comparée à la meilleure séance précédente du même format (même nombre de séries,
  // `shapeBetter` : charge plus lourde, ou plus de répétitions au total à charge égale, ou RIR
  // plus élevé à volume égal). Plus de charge compte quel que soit le format. Une séance d'un
  // format jamais vu ne progresse que si la charge monte. Un plateau = 4 séances (la meilleure,
  // puis 3 qui ne la dépassent pas).
  // Une séance NETTEMENT en dessous de la meilleure du même format (`shapeDrop`) est un recul,
  // pas un plateau : elle repart comme nouvelle référence (8, 8, 6, 6 n'est pas un plateau).
  // 8, 7, 8, 7 à la même charge en reste un (09/11/2026). Une pause de plus de 8 semaines
  // repart de zéro (25/10/2026).
  let start = 0, bestByN = {}, maxTop = -Infinity;
  sessions.forEach((cur, i) => {
    const sh = sessionShape(cur);
    if (i > 0 && daysBetween(sessions[i - 1].date, cur.date) > PLATEAU_GAP_DAYS) { bestByN = {}; maxTop = -Infinity; start = i; }
    const ref = bestByN[sh.n];
    const progress = sh.top > maxTop || shapeBetter(sh, ref);
    const drop = !progress && shapeDrop(sh, ref, last.mode);
    if (progress || drop || !ref) bestByN[sh.n] = sh;
    if (progress || drop) start = i;
    maxTop = Math.max(maxTop, sh.top);
  });
  const streak = sessions.slice(start);
  if (streak.length < PLATEAU_STABLE_STREAK) return null;

  const { poids, val } = last.best;
  const weeks = Math.max(1, Math.round(daysBetween(streak[0].date, last.date) / 7));
  const base = { sessions: streak.length, weeks, since: streak[0].date };
  if (val < range.max) {
    return { ...base, kind: "reps", poids, from: val, target: Math.min(range.max, val + 2), range };
  }
  // Déjà en haut de fourchette : pas d'incrément inventé (les paliers réels dépendent du
  // matériel — haltères, machine, barre — que l'app ne connaît pas assez finement), juste la
  // consigne de passer à la charge supérieure disponible.
  return { ...base, kind: "poids", from: poids, range };
}
