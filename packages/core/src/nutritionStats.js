// Sous-onglet Calories d'Analyse (30/10/2026, retour de Yoann : « un peu vide »). Quatre lectures
// du journal, choisies par Yoann : moyennes 7 j des macros, kcal jour par jour sur 14 j,
// répartition par repas, régularité sur 28 j. Fonctions pures (testables en Node), aucune donnée
// nouvelle : `macroLog` (totaux du jour, mêmes kcal que Nutrition via `kcalOfEntry`) et `foodLog`
// résolu (corrections V6 appliquées).
//
// Règle commune : les moyennes ne portent que sur les jours TERMINÉS (aujourd'hui exclu, journée
// incomplète — même raison que le TDEE du 13/09/2026), et un jour sans repas saisi est ignoré,
// jamais compté à 0. Seul le graphique jour par jour montre aujourd'hui, marqué « en cours ».
import { today, shiftDateKey } from "./dateUtils.js";
import { kcalOfEntry, kcalFromMacros, targetsForDate } from "./targets.js";
import { MEALS, amounts, resolveLog, alcoholGramsFor } from "./nutrition/foodStore.js";

/** Les `days` dates qui finissent à `end` (incluse), de la plus ancienne à la plus récente. */
const windowEnding = (end, days) => Array.from({ length: days }, (_, i) => shiftDateKey(end, i - days + 1));

/** Un jour de macroLog qui porte des repas (une ligne d'eau seule ne compte pas comme jour saisi). */
const hasFood = (m) => m && (m.kcal != null || m.protein != null || m.carbs != null || m.fat != null);

/** Cible kcal d'une date (fenêtre de sèche comprise), même formule que l'onglet Nutrition. */
export const kcalTargetFor = (date, targets) => {
  const t = targetsForDate(date, targets);
  return Math.round(kcalFromMacros(t.protein, t.carbs, t.fat, t.fiber));
};

const byDateMap = (macros) => new Map((macros || []).filter(hasFood).map((m) => [m.date, m]));

/**
 * Moyennes des 7 derniers jours terminés et des 7 jours d'avant.
 * → { cur, prev }, chacun { days, kcal, protein, carbs, fat, fiber } ou null sans aucun jour saisi.
 */
export function macroAverages(macros, { asOf = today(), days = 7 } = {}) {
  const map = byDateMap(macros);
  const avg = (end) => {
    const entries = windowEnding(end, days).map((k) => map.get(k)).filter(Boolean);
    if (!entries.length) return null;
    const mean = (f) => {
      const vals = entries.map(f).filter((v) => v != null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    return {
      days: entries.length,
      kcal: mean(kcalOfEntry),
      protein: mean((m) => m.protein),
      carbs: mean((m) => m.carbs),
      fat: mean((m) => m.fat),
      fiber: mean((m) => m.fiber),
    };
  };
  const yesterday = shiftDateKey(asOf, -1);
  return { cur: avg(yesterday), prev: avg(shiftDateKey(yesterday, -days)) };
}

/** Kcal jour par jour, `days` jours finissant aujourd'hui. → [{ date, kcal|null, target, partial }]. */
export function dailyKcal(macros, targets, { asOf = today(), days = 14 } = {}) {
  const map = byDateMap(macros);
  return windowEnding(asOf, days).map((date) => {
    const m = map.get(date);
    return { date, kcal: m ? kcalOfEntry(m) : null, target: kcalTargetFor(date, targets), partial: date === asOf };
  });
}

/**
 * Kcal et protéines moyennes par repas, par jour saisi, sur les `days` derniers jours terminés.
 * Les lignes de correction (« Retirer », négatives) se soustraient de leur repas. Les repas
 * vides sur toute la période sont omis. → { days, total, meals: [{ key, label, kcal, prot, share }] }.
 */
export function mealBreakdown(foodLog, overrides, { asOf = today(), days = 14 } = {}) {
  const dates = new Set(windowEnding(shiftDateKey(asOf, -1), days));
  const entries = resolveLog(foodLog || [], overrides).filter((e) => dates.has(e.date));
  const logged = new Set(entries.map((e) => e.date)).size;
  if (!logged) return { days: 0, total: 0, meals: [] };
  const sums = new Map(MEALS.map((m) => [m.key, { kcal: 0, prot: 0, n: 0 }]));
  for (const e of entries) {
    const s = sums.get(e.meal) || sums.get("autre");
    const a = amounts(e);
    s.kcal += a.kcal ?? 0;
    s.prot += a.prot ?? 0;
    s.n++;
  }
  const meals = MEALS.map((m) => ({ ...m, ...sums.get(m.key) }))
    .filter((m) => m.n > 0)
    .map(({ key, label, kcal, prot }) => ({ key, label, kcal: Math.round(kcal / logged), prot: Math.round(prot / logged) }));
  const total = meals.reduce((a, m) => a + m.kcal, 0);
  return { days: logged, total, meals: meals.map((m) => ({ ...m, share: total > 0 ? m.kcal / total : 0 })) };
}

/**
 * Régularité sur les `days` derniers jours terminés : jours saisis, jours dans ±10 % de la cible
 * kcal du jour, et alcool sur 7 et 28 jours (grammes, saisie libre).
 */
export function regularity({ macros, foodLog, targets, asOf = today(), days = 28 }) {
  const map = byDateMap(macros);
  const keys = windowEnding(shiftDateKey(asOf, -1), days);
  let logged = 0, inRange = 0;
  for (const d of keys) {
    const m = map.get(d);
    if (!m) continue;
    logged++;
    const target = kcalTargetFor(d, targets);
    if (target > 0 && Math.abs(kcalOfEntry(m) - target) / target <= 0.10) inRange++;
  }
  const alcohol = (n) => Math.round(keys.slice(-n).reduce((a, d) => a + alcoholGramsFor(foodLog || [], d), 0));
  return { days, logged, inRange, alcohol7: alcohol(7), alcohol28: alcohol(days) };
}
