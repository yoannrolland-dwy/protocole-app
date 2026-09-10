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
import { daysBetween } from "./dateUtils.js";

const byDateAsc = (a, b) => a.date.localeCompare(b.date);

/**
 * Meilleure série d'un exercice sur une séance : la charge la plus lourde, puis le plus de
 * reps à charge égale. En mode « temps » (planche, iso) la charge vaut 0 partout, donc
 * c'est la tenue la plus longue qui ressort — le même code couvre les deux cas.
 * Ne compte que les séries cochées ET renseignées : une ligne préremplie jamais faite ne
 * doit pas passer pour une performance.
 */
export function bestSet(ex) {
  const done = (ex.series || []).filter((s) => s.fait && (+s.poids > 0 || +s.val > 0));
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
      (byExo[e.nom] ||= []).push({ d: s.date, mode: e.mode, ...b });
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
    const tendance = !prev ? "1re fois"
      : beats(last, prev, last.mode) ? "hausse"
      : beats(prev, last, last.mode) ? "baisse" : "stable";
    return {
      exo: nom,
      series_max: h.map((x) => `${x.d.slice(5)} ${isTimeMode(x.mode) ? `${x.val}s` : `${x.poids}x${x.val}`}`),
      tendance,
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
 * contre-indiqué (décision explicite de la roadmap, ne pas ajouter sans demande).
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
        date: s.date, type: s.type, mode: e.mode, perLeg: !!e.perLeg,
        best, score: setScore(best, e.mode),
        series: (e.series || []).filter((x) => x.fait && (+x.poids > 0 || +x.val > 0)),
      };
    })
    .filter(Boolean)
    .sort(byDateAsc);
}

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
  if (beats(last.best, prev.best, last.mode)) return { key: "up", label: "hausse", delta };
  if (beats(prev.best, last.best, last.mode)) return { key: "down", label: "baisse", delta };
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

/** Volume total d'une séance pour cet exercice (somme poids × reps de TOUTES les séries
 * cochées, pas seulement la meilleure) — signal secondaire pour ne pas déclarer un plateau
 * à tort quand la meilleure série stagne mais que les séries suivantes tiennent mieux la
 * charge (ex. 60×8/60×7/60×5 → 60×8/60×8/60×6 : même meilleure série, vraie progression). */
function sessionVolume(session) {
  return (session.series || []).reduce((sum, s) => sum + (+s.poids || 0) * (+s.val || 0), 0);
}

/**
 * Suggestion de progressive overload (viser le haut de la fourchette de reps, puis passer à
 * la charge supérieure) une fois qu'un plateau est détecté. Un plateau, c'est la plus longue
 * série de séances consécutives "stable" sur la meilleure série (même définition que
 * `exerciseTrend`, rejouée pas à pas) qui se termine à la dernière séance — pas juste les
 * `PLATEAU_STABLE_STREAK` dernières : ça sert aussi à dire DEPUIS QUAND (`weeks`), pour
 * l'afficher directement dans le carnet pendant la séance (demande du 10/09/2026), pas
 * seulement sur la fiche Progression. Un plateau nécessite en plus que le volume total
 * n'ait pas non plus progressé sur cette même fenêtre (voir `sessionVolume` — décidé avec
 * Yoann le 10/09/2026 : la charge reste prioritaire pour dire hausse/baisse — historique du
 * 13/08/2026, ne pas rouvrir —, mais un plateau nécessite qu'AUCUN des deux signaux ne bouge).
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
export function progressiveOverloadSuggestion(sessions, nom) {
  if (!sessions || sessions.length < PLATEAU_STABLE_STREAK) return null;
  const last = sessions[sessions.length - 1];
  if (isTimeMode(last.mode)) return null;

  const defs = templateDefsFor(nom);
  if (!defs.length || defs.some((d) => d.hsr)) return null;
  const range = parseRepRange(defs[0].r);
  if (!range) return null;

  // Étend la fenêtre en remontant tant que chaque paire consécutive reste "stable" — pas
  // figée à PLATEAU_STABLE_STREAK, pour connaître la vraie durée du plateau.
  let start = sessions.length - 1;
  while (start > 0
    && !beats(sessions[start].best, sessions[start - 1].best, last.mode)
    && !beats(sessions[start - 1].best, sessions[start].best, last.mode)) {
    start--;
  }
  const streak = sessions.slice(start);
  if (streak.length < PLATEAU_STABLE_STREAK) return null;
  if (sessionVolume(streak[streak.length - 1]) > sessionVolume(streak[0])) return null; // volume total en hausse → vraie progression, pas un plateau

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
