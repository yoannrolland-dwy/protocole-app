// Score de sommeil (0-100) et score d'énergie façon "Samsung Energy Score" (05/09/2026).
//
// Samsung Health calcule un "score d'énergie" propriétaire, jamais exposé par Health
// Connect (confirmé en explorant l'API — seul le Samsung Health Data SDK y a accès, écarté
// comme trop complexe pour ce projet, voir CLAUDE.md). Ce module le RECONSTRUIT à partir de
// données déjà lisibles via Health Connect (FC repos, sommeil, pas) — c'est une
// approximation maison, pas une lecture du vrai score Samsung, avec sa propre grille de
// calcul (spécifiée par Yoann le 05/09/2026).
//
// Purs, testables en Node, aucune dépendance React/DOM.

import { shiftDateKey } from "./dateUtils.js";

// ---------- Score de sommeil (0-100) ----------
//
// Remis à l'échelle depuis la qualité 1-4 déjà calculée nativement (efficacité + temps
// endormi combinés, voir HealthNutritionPlugin.kt côté apps/perso) plutôt que recalculé
// depuis zéro — Health Connect n'expose aucune efficacité brute côté JS, seulement le
// résultat 1-4 déjà agrégé nativement. Paliers fournis par Yoann : 85-100 excellent
// (qualité 4), 75-84 bon (qualité 3), 60-74 correct (qualité 2), 0-59 risque (qualité 1).
// La durée de la nuit place le score À L'INTÉRIEUR de son palier (un palier à lui seul n'a
// qu'une résolution de 4 valeurs, la durée lui donne un vrai score continu).
const SLEEP_SCORE_BAND_BY_QUALITY = { 4: [85, 100], 3: [75, 84], 2: [60, 74], 1: [0, 59] };
// Position 0..1 dans le palier selon la durée : 5h = bas de palier, 8h+ = haut de palier.
const durationPosition = (hours) => Math.max(0, Math.min(1, (hours - 5) / 3));
const scoreInBand = ([lo, hi], hours) => Math.round(lo + durationPosition(hours) * (hi - lo));

/**
 * @param night entrée de `sleepLog` pour LA nuit à noter : `{ hours, quality? }`.
 * @returns un score 0-100, ou `null` si aucune durée connue pour cette nuit.
 */
export function computeSleepScore(night) {
  if (!night || night.hours == null) return null;
  if (night.quality != null) return scoreInBand(SLEEP_SCORE_BAND_BY_QUALITY[night.quality] ?? SLEEP_SCORE_BAND_BY_QUALITY[2], night.hours);
  // Pas de qualité native (saisie manuelle sur la PWA, ou nuit Health Connect sans détail
  // par phase) : on ne peut estimer QUE depuis la durée — jamais "excellent" (85+) sans une
  // vraie mesure d'efficacité, c'est le prix de l'incertitude sur une donnée qu'on n'a pas.
  if (night.hours >= 7) return scoreInBand([75, 82], night.hours);
  if (night.hours >= 6) return scoreInBand([60, 74], night.hours);
  if (night.hours >= 5) return scoreInBand([40, 59], night.hours);
  return Math.max(10, Math.round((night.hours / 5) * 40));
}

// ---------- Score d'énergie (4 modules, 100 pts) ----------

// Moyenne d'un champ sur les `days` jours précédant (mais JAMAIS incluant) `t0` — baseline
// délibérément exclusive du jour noté : comparer une valeur à une moyenne qui la contient
// déjà biaiserait la comparaison vers "dans la norme". Retourne `null` sous `minPoints`
// valeurs trouvées (pas assez de recul pour une moyenne significative).
function trailingAvg(log, key, t0, { days = 7, minPoints = 3 } = {}) {
  const vals = [];
  for (let k = 1; k <= days; k++) {
    const e = (log || []).find((x) => x.date === shiftDateKey(t0, -k));
    if (e && e[key] != null) vals.push(e[key]);
  }
  if (vals.length < minPoints) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const MODULE_MAX = { rhr: 30, sleep: 30, steps: 25, regularity: 15 };

function scoreRhrModule(rhrLog, t0) {
  const today = (rhrLog || []).find((e) => e.date === t0);
  if (!today || today.bpm == null) return { key: "rhr", label: "FC repos", max: MODULE_MAX.rhr, points: null, reason: "FC repos du jour indisponible." };
  const avg7 = trailingAvg(rhrLog, "bpm", t0);
  if (avg7 == null) return { key: "rhr", label: "FC repos", max: MODULE_MAX.rhr, points: null, reason: "Pas assez d'historique FC repos (7 j) pour une moyenne fiable." };
  const diff = Math.round(today.bpm - avg7);
  let points;
  if (diff <= -2) points = 30;
  else if (diff <= 0) points = 27;
  else if (diff === 1) points = 22;
  else if (diff <= 3) points = 15;
  else if (diff <= 5) points = 8;
  else points = 0;
  return { key: "rhr", label: "FC repos", max: MODULE_MAX.rhr, points, bpm: today.bpm, avg7: Math.round(avg7 * 10) / 10,
    reason: `${today.bpm} bpm vs moyenne 7 j ${Math.round(avg7 * 10) / 10} (${diff >= 0 ? "+" : ""}${diff}).` };
}

function scoreSleepDurationModule(sleepLog, t0) {
  const night = (sleepLog || []).find((e) => e.date === t0);
  if (!night || night.hours == null) return { key: "sleepDuration", label: "Sommeil (nuit précédente)", max: MODULE_MAX.sleep, points: null, reason: "Nuit précédente non renseignée." };
  const h = night.hours;
  let points;
  if (h >= 8) points = 30;
  else if (h >= 7) points = 25;
  else if (h >= 6) points = 18;
  else if (h >= 5) points = 10;
  else points = 5;
  return { key: "sleepDuration", label: "Sommeil (nuit précédente)", max: MODULE_MAX.sleep, points, hours: h, reason: `${h.toFixed(1)} h.` };
}

function scoreStepsModule(stepsLog, t0) {
  const yesterday = shiftDateKey(t0, -1);
  const entry = (stepsLog || []).find((e) => e.date === yesterday);
  if (!entry || entry.count == null) return { key: "steps", label: "Activité (veille)", max: MODULE_MAX.steps, points: null, reason: "Pas de la veille non renseignés." };
  const c = entry.count;
  let points;
  if (c > 18000) points = 15;
  else if (c >= 15001) points = 20;
  else if (c >= 10000) points = 25;
  else if (c >= 7500) points = 18;
  else if (c >= 5000) points = 10;
  else points = 5;
  return { key: "steps", label: "Activité (veille)", max: MODULE_MAX.steps, points, count: c, reason: `${c.toLocaleString("fr-FR")} pas hier.` };
}

function scoreRegularityModule(sleepLog, t0) {
  const night = (sleepLog || []).find((e) => e.date === t0);
  if (!night || night.hours == null) return { key: "regularity", label: "Régularité sommeil", max: MODULE_MAX.regularity, points: null, reason: "Nuit précédente non renseignée." };
  const avg7 = trailingAvg(sleepLog, "hours", t0);
  if (avg7 == null) return { key: "regularity", label: "Régularité sommeil", max: MODULE_MAX.regularity, points: null, reason: "Pas assez d'historique sommeil (7 j) pour une moyenne fiable." };
  const diffMin = Math.round((night.hours - avg7) * 60);
  let points;
  if (diffMin >= -15 && diffMin <= 60) points = 15;
  else if ((diffMin >= -45 && diffMin < -15) || (diffMin > 60 && diffMin <= 120)) points = 10;
  else points = 5;
  return { key: "regularity", label: "Régularité sommeil", max: MODULE_MAX.regularity, points, diffMin,
    reason: `${diffMin >= 0 ? "+" : ""}${diffMin} min vs moyenne 7 j.` };
}

/**
 * @param t0       date (yyyy-MM-dd) du matin noté — "hier" pour les pas, "cette nuit" pour
 *                 le sommeil, sont dérivés de `t0`.
 * @param rhrLog   journal FC repos `{ date, bpm }` (Health Connect, natif seulement).
 * @param sleepLog journal sommeil `{ date, hours, quality? }` (déjà existant).
 * @param stepsLog journal pas `{ date, count }` (déjà existant).
 * @returns `{ status: "ok", total, modules }` ou `{ status: "insufficient", modules }` —
 *          jamais un total inventé si un module manque de donnée : mieux vaut un motif
 *          honnête qu'un chiffre sur 100 qui ne veut rien dire pour 1/4 de sa base.
 */
export function computeEnergyScore(t0, { rhrLog, sleepLog, stepsLog } = {}) {
  const modules = [
    scoreRhrModule(rhrLog, t0),
    scoreSleepDurationModule(sleepLog, t0),
    scoreStepsModule(stepsLog, t0),
    scoreRegularityModule(sleepLog, t0),
  ];
  const allOk = modules.every((m) => m.points != null);
  if (!allOk) return { status: "insufficient", modules };
  return { status: "ok", total: modules.reduce((a, m) => a + m.points, 0), modules };
}
