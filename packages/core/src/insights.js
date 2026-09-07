// Constats gratuits (JS pur, zéro appel API) — chantier "4 points IA", point 1 (07/09/2026).
//
// Objectif : donner une impression de suivi actif sans le moindre coût, en réutilisant des
// calculs déjà présents ailleurs (records V4, TDEE V7, score d'énergie) plutôt qu'en
// dupliquant de la logique. Aucune dépendance React/DOM — testable seul en Node, même
// convention que le reste de packages/core ("le JS calcule les faits").
//
// Chaque fonction renvoie `null` quand la donnée est insuffisante plutôt qu'une valeur
// inventée ou trompeuse — même principe que `computeTDEE`/`computeEnergyScore` : un constat
// absent vaut mieux qu'un constat faux.

import { shiftDateKey, daysBetween } from "./dateUtils.js";
import { recordsBySession, painOutOfBase } from "./training.js";
import { smoothedWeightSeries, trendAt } from "./tdee.js";
import { kcalOfEntry, targetsForDate, kcalFromMacros } from "./targets.js";
import { computeEnergyScore } from "./energy.js";
import { TYPES } from "./session/templates.js";

const round1 = (x) => Math.round(x * 10) / 10;

/* ============================================================
   Streaks
   ============================================================ */

/**
 * Compte les jours d'affilée présents dans `dateSet`, en partant d'aujourd'hui. Si
 * aujourd'hui n'a rien, on tolère un jour de battement (le streak n'est pas "cassé" tant
 * qu'un jour complet n'a pas été sauté, même logique que les streaks type Duolingo) : on
 * part alors d'hier.
 */
function countStreak(dateSet, todayDate) {
  let anchor = todayDate;
  if (!dateSet.has(anchor)) {
    anchor = shiftDateKey(todayDate, -1);
    if (!dateSet.has(anchor)) return 0;
  }
  let n = 0, cursor = anchor;
  while (dateSet.has(cursor)) { n++; cursor = shiftDateKey(cursor, -1); }
  return n;
}

/** Deux streaks distincts : jours d'affilée entraînés (tout type confondu, Mobilité compris
 * — ici c'est une célébration de régularité, pas un signal de charge/fatigue comme dans le
 * recommandeur) et jours d'affilée avec des macros loggées. */
export function computeStreaks(training, macros, todayDate) {
  const trainedDates = new Set((training || []).map((t) => t.date));
  const loggedDates = new Set(
    (macros || []).filter((m) => m.protein != null || m.carbs != null || m.fat != null).map((m) => m.date)
  );
  return { training: countStreak(trainedDates, todayDate), logging: countStreak(loggedDates, todayDate) };
}

/* ============================================================
   Récap des records récents
   ============================================================ */

const RECORDS_WINDOW_DAYS = 30;

/**
 * Résumé des records battus sur les `windowDays` derniers jours (`recordsBySession` rejoue
 * tout l'historique, voir training.js). Un record posé un jour où le genou est hors base est
 * exclu du compte — même garde-fou que l'affichage individuel du carnet (V4) : pas question
 * de mettre en avant une charge record le jour où le tendon a flambé.
 */
export function recentRecordsRecap(training, kneeLog, todayDate, windowDays = RECORDS_WINDOW_DAYS) {
  const windowStart = shiftDateKey(todayDate, -(windowDays - 1));
  const bySession = recordsBySession(training);
  const items = [];
  for (const [session, exos] of bySession) {
    if (session.date < windowStart || session.date > todayDate) continue;
    if (painOutOfBase([kneeLog], session.date)) continue;
    items.push({ date: session.date, exos });
  }
  if (!items.length) return null;
  const count = items.reduce((n, it) => n + it.exos.length, 0);
  return { count, sessions: items.length, windowDays, items: items.sort((a, b) => b.date.localeCompare(a.date)) };
}

/* ============================================================
   Corrélation poids / TDEE réel
   ============================================================ */

/**
 * Ne recalcule rien : `tdeeResult` est le retour de `tdeeNow(...)` (déjà utilisé par la carte
 * Macros), passé tel quel par l'appelant pour ne jamais afficher deux chiffres différents
 * pour la même réalité — ce module reste pur et ne lit rien lui-même (`tdeeNow` a besoin de
 * `foodLog`/`overrides` frais, donc une lecture I/O que ce module n'a pas à faire).
 */
export function weightTdeeInsight(tdeeResult, kcalTargetToday) {
  if (!tdeeResult || tdeeResult.status !== "ok") return null;
  return {
    tdee: tdeeResult.tdee,
    deficit: Math.round(kcalTargetToday - tdeeResult.tdee),
    deltaKg: tdeeResult.deltaKg,
    days: tdeeResult.days,
    reliability: tdeeResult.reliability,
  };
}

/* ============================================================
   Projection réaliste de fin de sèche
   ============================================================ */

/**
 * Projette le poids à la date de fin de la fenêtre de sèche en cours, en extrapolant la
 * tendance de poids lissée (EMA) au rythme mesuré par `tdeeResult` (deltaKg / days = kg/jour
 * réel sur la fenêtre TDEE, pas une hypothèse). `null` si aucune fenêtre de sèche active, si
 * elle est déjà terminée, ou si le TDEE n'est pas assez fiable pour en tirer un rythme.
 */
export function cutProjection(weightLog, targets, tdeeResult, todayDate) {
  const cut = targets?.cut;
  if (!cut?.enabled || !cut.start || !cut.end) return null;
  if (todayDate > cut.end) return null;
  if (!tdeeResult || tdeeResult.status !== "ok") return null;
  const smoothed = smoothedWeightSeries(weightLog);
  const currentKg = trendAt(smoothed, todayDate);
  if (currentKg == null) return null;
  const ratePerDay = tdeeResult.deltaKg / tdeeResult.days;
  const daysLeft = daysBetween(todayDate, cut.end);
  return {
    projectedKg: round1(currentKg + ratePerDay * daysLeft),
    endDate: cut.end,
    daysLeft,
    reliability: tdeeResult.reliability,
  };
}

/* ============================================================
   Équilibre du volume d'entraînement par type
   ============================================================ */

// "Mobilité" n'est pas une charge d'entraînement (même exclusion que `isLoadBearing` dans le
// recommandeur, voir CLAUDE.md) — la signaler comme "délaissée" n'aurait pas de sens.
const NON_LOAD_TYPES = new Set(["Mobilité"]);
const NEGLECT_THRESHOLD_DAYS = 14;

/**
 * Type de séance le plus délaissé : celui dont la dernière occurrence est la plus ancienne
 * (ou jamais loggé, prioritaire sur "loggé il y a longtemps"). `null` si l'historique est
 * vide ou si même le plus délaissé reste sous le seuil (rien à signaler).
 */
export function mostNeglectedType(training, todayDate) {
  if (!training?.length) return null;
  const lastByType = {};
  for (const t of training) {
    if (NON_LOAD_TYPES.has(t.type)) continue;
    if (!lastByType[t.type] || t.date > lastByType[t.type]) lastByType[t.type] = t.date;
  }
  const candidates = TYPES.filter((t) => !NON_LOAD_TYPES.has(t)).map((type) => {
    const last = lastByType[type] || null;
    return { type, last, daysSince: last ? daysBetween(last, todayDate) : null };
  });
  candidates.sort((a, b) => {
    if (a.daysSince == null && b.daysSince == null) return 0;
    if (a.daysSince == null) return -1;
    if (b.daysSince == null) return 1;
    return b.daysSince - a.daysSince;
  });
  const top = candidates[0];
  if (!top || (top.daysSince != null && top.daysSince < NEGLECT_THRESHOLD_DAYS)) return null;
  return top;
}

/* ============================================================
   Régularité de la sèche
   ============================================================ */

const CUT_ADHERENCE_TOLERANCE = 0.10; // ±10 % autour de la cible du jour
const CUT_ADHERENCE_MIN_DAYS = 3;

/**
 * % de jours loggés, depuis le début de la fenêtre de sèche jusqu'à aujourd'hui (ou sa fin
 * si elle est passée), où les calories réelles restent dans ±10 % de la cible du jour
 * (`targetsForDate`, qui gère déjà la bascule base/fenêtre). Un jour sans macro loggée est
 * ignoré plutôt que compté comme un échec — l'absence de saisie n'est pas un manquement.
 */
export function cutAdherence(macros, targets, todayDate) {
  const cut = targets?.cut;
  if (!cut?.enabled || !cut.start) return null;
  const start = cut.start > todayDate ? todayDate : cut.start;
  const end = cut.end && cut.end < todayDate ? cut.end : todayDate;
  const totalDays = daysBetween(start, end) + 1;
  let logged = 0, within = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = shiftDateKey(start, i);
    const m = (macros || []).find((x) => x.date === d);
    if (!m) continue;
    const kcal = kcalOfEntry(m);
    const t = targetsForDate(d, targets);
    const tgt = kcalFromMacros(t.protein, t.carbs, t.fat, t.fiber);
    logged++;
    if (Math.abs(kcal - tgt) <= tgt * CUT_ADHERENCE_TOLERANCE) within++;
  }
  if (logged < CUT_ADHERENCE_MIN_DAYS) return null;
  return { pct: Math.round((within / logged) * 100), loggedDays: logged, totalDays };
}

/* ============================================================
   Sommeil vs score d'énergie
   ============================================================ */

const SLEEP_ENERGY_WINDOW_DAYS = 60;
const SLEEP_ENERGY_MIN_SAMPLES = 3;

/**
 * Compare le score d'énergie moyen des matins qui suivent une nuit de qualité 4 à celui des
 * matins qui suivent une nuit de qualité ≤2, sur les 60 derniers jours — une corrélation
 * chiffrée plutôt qu'un ressenti. `null` tant que les deux groupes n'ont pas au moins 3
 * points chacun (pas de moyenne peu fiable affichée).
 */
export function sleepEnergyCorrelation({ sleepLog, rhrLog, stepsLog }, todayDate, windowDays = SLEEP_ENERGY_WINDOW_DAYS) {
  const good = [], poor = [];
  for (let i = 1; i <= windowDays; i++) {
    const d = shiftDateKey(todayDate, -i);
    const night = (sleepLog || []).find((s) => s.date === d);
    if (!night || night.quality == null) continue;
    const energy = computeEnergyScore(d, { rhrLog, sleepLog, stepsLog });
    if (!energy || energy.status !== "ok") continue;
    if (night.quality === 4) good.push(energy.total);
    else if (night.quality <= 2) poor.push(energy.total);
  }
  if (good.length < SLEEP_ENERGY_MIN_SAMPLES || poor.length < SLEEP_ENERGY_MIN_SAMPLES) return null;
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { goodAvg: avg(good), poorAvg: avg(poor), goodN: good.length, poorN: poor.length };
}

/* ============================================================
   Combinaison pour la carte Dashboard
   ============================================================ */

/**
 * Rassemble les 7 constats. `tdeeResult` doit être calculé par l'appelant (`tdeeNow(...)`,
 * comme la carte Macros) : il dépend de `foodLog`/`overrides` lus fraîchement (getSync), une
 * lecture I/O que ce module ne fait pas — il reste pur, comme le reste de packages/core.
 */
export function computeFreeInsights({ training, weight, macros, sleep, rhr, steps, knee, targets, tdeeResult, kcalTargetToday, todayDate }) {
  return {
    streaks: computeStreaks(training, macros, todayDate),
    records: recentRecordsRecap(training, knee, todayDate),
    weightTdee: weightTdeeInsight(tdeeResult, kcalTargetToday),
    cutProjection: cutProjection(weight, targets, tdeeResult, todayDate),
    neglected: mostNeglectedType(training, todayDate),
    cutAdherence: cutAdherence(macros, targets, todayDate),
    sleepEnergy: sleepEnergyCorrelation({ sleepLog: sleep, rhrLog: rhr, stepsLog: steps }, todayDate),
  };
}
