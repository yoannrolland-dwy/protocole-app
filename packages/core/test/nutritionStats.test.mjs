// Sous-onglet Calories d'Analyse (30/10/2026) : moyennes 7 j, kcal jour par jour, répartition par
// repas, régularité. Jours terminés seulement (sauf le graphique jour par jour), jour sans repas ignoré.
import { test } from "node:test";
import assert from "node:assert/strict";
import { macroAverages, dailyKcal, mealBreakdown, regularity, kcalTargetFor } from "../src/nutritionStats.js";
import { shiftDateKey } from "../src/dateUtils.js";

const T0 = "2026-10-30";
const d = (n) => shiftDateKey(T0, -n);
const targets = { protein: 200, carbs: 280, fat: 85, fiber: 35, water: 2000 };
const TARGET = kcalTargetFor(T0, targets); // 200*4 + 280*4 + 85*9 + 35*2 = 2755
const day = (n, kcal, protein = 200) => ({ date: d(n), kcal, protein, carbs: 250, fat: 80, fiber: 30 });

test("moyennes 7 j : aujourd'hui exclu, ligne d'eau seule ignorée, 7 j précédents comparés", () => {
  const macros = [
    day(0, 400, 20), // aujourd'hui, en cours : exclu
    { date: d(1), water: 1500 }, // eau seule : pas un jour saisi
    day(2, 2600, 190), day(3, 2800, 210),
    day(9, 2400, 180),
  ];
  const { cur, prev } = macroAverages(macros, { asOf: T0 });
  assert.equal(cur.days, 2);
  assert.equal(cur.kcal, 2700);
  assert.equal(cur.protein, 200);
  assert.equal(prev.days, 1);
  assert.equal(prev.kcal, 2400);
  assert.equal(macroAverages([], { asOf: T0 }).cur, null);
});

test("kcal jour par jour : 14 dates finissant aujourd'hui, aujourd'hui marqué en cours, jour vide à null", () => {
  assert.equal(TARGET, 2755);
  const rows = dailyKcal([day(0, 400), day(3, 2800)], targets, { asOf: T0 });
  assert.equal(rows.length, 14);
  assert.equal(rows[13].date, T0);
  assert.equal(rows[13].partial, true);
  assert.equal(rows[13].kcal, 400);
  assert.equal(rows[10].kcal, 2800);
  assert.equal(rows[12].kcal, null);
  assert.equal(rows[0].date, d(13));
  assert.equal(rows[0].target, TARGET);
});

test("répartition par repas : moyenne par jour saisi, correction soustraite, aujourd'hui et repas vides exclus", () => {
  const line = (n, meal, kcal, prot, extra = {}) => ({ date: d(n), meal, q: 100, per100: { kcal, prot, gluc: 0, lip: 0, fib: 0 }, ...extra });
  const foodLog = [
    line(1, "petitdej", 500, 40), line(2, "petitdej", 300, 20),
    line(1, "diner", 900, 60), line(1, "diner", -100, -10, { correction: true }),
    line(0, "diner", 5000, 0), // aujourd'hui : exclu
  ];
  const r = mealBreakdown(foodLog, {}, { asOf: T0 });
  assert.equal(r.days, 2);
  assert.deepEqual(r.meals.map((m) => [m.key, m.kcal, m.prot]), [["petitdej", 400, 30], ["diner", 400, 25]]);
  assert.equal(r.total, 800);
  assert.equal(r.meals[0].share, 0.5);
  // Correction V6 appliquée à la lecture
  const ov = mealBreakdown([{ ...line(1, "gouter", 100, 0), ref: "x" }], { x: { kcal: 300 } }, { asOf: T0 });
  assert.equal(ov.meals[0].kcal, 300);
  assert.deepEqual(mealBreakdown([], {}, { asOf: T0 }), { days: 0, total: 0, meals: [] });
});

test("régularité 28 j : jours saisis, ±10 % de la cible, alcool 7 j / 28 j", () => {
  const macros = [day(0, 9999), day(1, TARGET), day(2, Math.round(TARGET * 1.09)), day(3, Math.round(TARGET * 1.2)), day(28, TARGET), day(29, TARGET)];
  const beer = (n, g) => ({ date: d(n), meal: "autre", q: 100, per100: { kcal: g * 7, prot: 0, gluc: 0, lip: 0, fib: 0, alcool: g } });
  const r = regularity({ macros, foodLog: [beer(1, 18), beer(10, 20), beer(40, 50)], targets, asOf: T0 });
  assert.deepEqual(r, { days: 28, logged: 4, inRange: 3, alcohol7: 18, alcohol28: 38 });
});
