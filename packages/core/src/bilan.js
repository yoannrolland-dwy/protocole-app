// Bilan long terme (JS pur) — chantier "4 points IA", point 4 (07/09/2026).
//
// Principe : "le JS calcule les faits, l'IA les juge" (déjà établi pour le Coach IA
// quotidien, voir coach/prompt.js) — étendu ici sur 3 mois plutôt que 14 jours. Ce module ne
// fait QUE calculer des chiffres réels ; c'est `buildBilanPrompt` (coach/prompt.js) qui les
// met en mots. Aucune dépendance React/DOM — testable seul en Node.
//
// Réutilise les briques du point 1 (insights.js) plutôt que de dupliquer leur logique,
// simplement avec une fenêtre plus large (90 j au lieu de 30/60) là où c'est pertinent.

import { shiftDateKey, daysBetween } from "./dateUtils.js";
import {
  recentRecordsRecap, weightTdeeInsight, cutProjection, mostNeglectedType,
  cutAdherence, sleepEnergyCorrelation,
} from "./insights.js";
import { climbLoad } from "./climbing.js";
import { weeklyWeekdayKcalTrend } from "./targets.js";

export const BILAN_WINDOW_DAYS = 90;

/* ============================================================
   Charge d'escalade vs douleur genou les jours suivants
   ============================================================ */

const CLIMB_PAIN_MIN_SAMPLES = 2;

/**
 * Douleur genou moyenne les 2 jours suivant une séance d'escalade, groupée par charge de
 * tirage (`climbLoad` — "grosse" vs "légère/normale"). `null` tant que les deux groupes n'ont
 * pas au moins `CLIMB_PAIN_MIN_SAMPLES` séances chacun (échantillon trop faible sinon).
 */
export function climbLoadPainCorrelation(training, kneeLog, scheme, todayDate, windowDays = BILAN_WINDOW_DAYS) {
  const windowStart = shiftDateKey(todayDate, -(windowDays - 1));
  const heavy = [], other = [];
  for (const s of training || []) {
    if (s.type !== "Escalade" || s.date < windowStart || s.date > todayDate) continue;
    const load = climbLoad(s, scheme);
    if (!load) continue;
    const pains = [1, 2]
      .map((n) => (kneeLog || []).find((k) => k.date === shiftDateKey(s.date, n)))
      .filter(Boolean).map((k) => k.pain).filter((p) => p != null);
    if (!pains.length) continue;
    const avgPain = pains.reduce((a, b) => a + b, 0) / pains.length;
    (load.level === "grosse" ? heavy : other).push(avgPain);
  }
  if (heavy.length < CLIMB_PAIN_MIN_SAMPLES || other.length < CLIMB_PAIN_MIN_SAMPLES) return null;
  const avg = (arr) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  return { heavyAvgPain: avg(heavy), otherAvgPain: avg(other), heavyN: heavy.length, otherN: other.length };
}

/* ============================================================
   Fibres vs stagnation de poids (semaine par semaine)
   ============================================================ */

const STAGNATION_THRESHOLD_KG = 0.15; // variation hebdo sous ce seuil = "stagnation"
const FIBER_STAGNATION_MIN_WEEKS = 3;
const FIBER_STAGNATION_MIN_LOGGED_DAYS = 3; // par semaine, pour qu'une moyenne de fibres compte

/**
 * Compare l'apport moyen en fibres des semaines où le poids a stagné (variation sous
 * `STAGNATION_THRESHOLD_KG`) à celui des semaines où il a baissé nettement. Semaine glissante
 * de 7 jours, poids lu directement dans `weightLog` (première/dernière pesée de la semaine,
 * pas de lissage EMA ici — la fenêtre est déjà courte, un lissage supplémentaire noierait le
 * signal). `null` tant que les deux groupes n'ont pas au moins 3 semaines chacun.
 */
export function fiberWeightStagnationCorrelation(weightLog, macros, todayDate, windowDays = BILAN_WINDOW_DAYS) {
  const weeks = Math.floor(windowDays / 7);
  const stagnant = [], dropping = [];
  for (let w = 0; w < weeks; w++) {
    const weekEnd = shiftDateKey(todayDate, -w * 7);
    const weekStart = shiftDateKey(weekEnd, -6);
    const wEnd = (weightLog || []).find((x) => x.date === weekEnd)?.kg;
    const wStart = (weightLog || []).find((x) => x.date === weekStart)?.kg;
    if (wEnd == null || wStart == null) continue;
    let sum = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      const d = shiftDateKey(weekStart, i);
      const m = (macros || []).find((x) => x.date === d);
      if (m && m.fiber != null) { sum += m.fiber; n++; }
    }
    if (n < FIBER_STAGNATION_MIN_LOGGED_DAYS) continue;
    const avgFiber = sum / n;
    (Math.abs(wEnd - wStart) < STAGNATION_THRESHOLD_KG ? stagnant : dropping).push(avgFiber);
  }
  if (stagnant.length < FIBER_STAGNATION_MIN_WEEKS || dropping.length < FIBER_STAGNATION_MIN_WEEKS) return null;
  const avg = (arr) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  return { stagnantWeeksAvgFiber: avg(stagnant), droppingWeeksAvgFiber: avg(dropping), stagnantWeeksN: stagnant.length, droppingWeeksN: dropping.length };
}

/* ============================================================
   Combinaison pour le bilan (bouton "Analyse approfondie" du Coach IA)
   ============================================================ */

/**
 * Rassemble tous les faits du bilan. `tdeeResult` doit être calculé par l'appelant
 * (`tdeeNow(...)`, comme la carte Macros et le point 1) — ce module reste pur, aucune lecture
 * I/O (`foodLog`/`overrides` frais nécessaires à `tdeeNow`).
 */
export function computeBilanFacts({ training, weight, macros, sleep, rhr, steps, knee, targets, scheme, tdeeResult, kcalTargetToday, todayDate, windowDays = BILAN_WINDOW_DAYS }) {
  return {
    fenetreJours: windowDays,
    records: recentRecordsRecap(training, knee, todayDate, windowDays),
    deficitReel: weightTdeeInsight(tdeeResult, kcalTargetToday),
    projectionFinSeche: cutProjection(weight, targets, tdeeResult, todayDate),
    typeDelaisse: mostNeglectedType(training, todayDate),
    regulariteSeche: cutAdherence(macros, targets, todayDate),
    sommeilVsEnergie: sleepEnergyCorrelation({ sleepLog: sleep, rhrLog: rhr, stepsLog: steps }, todayDate, windowDays),
    escaladeVsDouleurGenou: climbLoadPainCorrelation(training, knee, scheme, todayDate, windowDays),
    fibresVsStagnationPoids: fiberWeightStagnationCorrelation(weight, macros, todayDate, windowDays),
    kcalSemaineLunVen: weeklyWeekdayKcalTrend(macros, { weeks: Math.ceil(windowDays / 7), endDate: todayDate }),
  };
}
