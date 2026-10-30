// Alcool dans la saisie libre (T5, 04/10/2026) : makeEntry / alcoholGramsFor / prompt alcool_g.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { makeEntry, alcoholGramsFor, amounts, totals, usageStats, isCorrection } from "../src/nutrition/foodStore.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());
const food = (per100) => ({ ref: "quick:test", name: "Mule", per100 });

test("makeEntry : per100.alcool porté seulement s'il est > 0 ; lignes sans alcool inchangées", () => {
  const withAlc = makeEntry({ date: T0, meal: "extra", food: food({ kcal: 190, prot: 0, gluc: 16, lip: 0, fib: 0, alcool: 18 }), q: 100 });
  assert.equal(withAlc.per100.alcool, 18);
  const without = makeEntry({ date: T0, meal: "extra", food: food({ kcal: 100, prot: 5, gluc: 10, lip: 2, fib: 1 }), q: 100 });
  assert.deepEqual(Object.keys(without.per100).sort(), ["fib", "gluc", "kcal", "lip", "prot"]);
  const zero = makeEntry({ date: T0, meal: "extra", food: food({ kcal: 100, prot: 5, gluc: 10, lip: 2, fib: 1, alcool: 0 }), q: 100 });
  assert.ok(!("alcool" in zero.per100));
});

test("alcoholGramsFor : somme par date au prorata de la quantité ; 0 sans alcool ; totaux/amounts ignorent l'alcool", () => {
  const log = [
    makeEntry({ date: T0, meal: "extra", food: food({ kcal: 190, prot: 0, gluc: 16, lip: 0, fib: 0, alcool: 18 }), q: 100 }),
    makeEntry({ date: T0, meal: "diner", food: food({ kcal: 80, prot: 0, gluc: 2, lip: 0, fib: 0, alcool: 10 }), q: 150 }),
    makeEntry({ date: d(1), meal: "diner", food: food({ kcal: 80, prot: 0, gluc: 2, lip: 0, fib: 0, alcool: 10 }), q: 100 }),
  ];
  assert.equal(alcoholGramsFor(log, T0), 33);
  assert.equal(alcoholGramsFor(log, d(1)), 10);
  assert.equal(alcoholGramsFor(log, d(2)), 0);
  assert.equal(alcoholGramsFor([], T0), 0);
  assert.ok(!("alcool" in amounts(log[0])), "amounts ne crée pas de colonne alcool");
  assert.ok(!("alcool" in totals(log)), "totals non plus : jamais une macro");
});

test("Coach IA : alcool_g dans macros_hier / macros_aujourdhui_en_cours seulement si > 0", () => {
  const base = { weight: [], sleep: [], training: [], knee: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodOverrides: {}, profile: "", journal: "", basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false, phase: "seche" };
  const macros = [{ date: d(1), protein: 200, carbs: 250, fat: 80, fiber: 30, water: 2000 }, { date: T0, protein: 100, carbs: 120, fat: 40, fiber: 15, water: 1000 }];
  const foodLog = [makeEntry({ date: d(1), meal: "extra", food: food({ kcal: 190, prot: 0, gluc: 16, lip: 0, fib: 0, alcool: 18 }), q: 100 })];
  const u = buildCoachPrompt({ ...base, macros, foodLog }, "").user;
  assert.match(u, /"macros_hier":\{[^}]*"alcool_g":18\}/);
  assert.doesNotMatch(u, /"macros_aujourdhui_en_cours":\{[^}]*alcool_g/);
  const u0 = buildCoachPrompt({ ...base, macros, foodLog: [] }, "").user;
  assert.ok(!u0.includes("alcool_g"));
});

test("correction (Retirer) : ligne négative soustraite des totaux, marquée, exclue des aliments habituels", () => {
  const plus = makeEntry({ date: T0, meal: "dejeuner", food: { ref: "quick:a", name: "Estimation", per100: { kcal: 600, prot: 40, gluc: 60, lip: 20, fib: 5 } }, q: 100 });
  const moins = makeEntry({ date: T0, meal: "dejeuner", food: { ref: "quick:b", name: "Correction (−150 kcal)", correction: true, per100: { kcal: -150, prot: -10, gluc: -15, lip: -5, fib: 0 } }, q: 100 });
  assert.ok(isCorrection(moins) && !isCorrection(plus));
  const tot = totals([plus, moins]);
  assert.deepEqual([tot.kcal, tot.prot, tot.gluc, tot.lip], [450, 30, 45, 15]);
  assert.equal(amounts(moins).kcal, -150);
  const stats = usageStats([plus, moins], { date: T0 });
  assert.ok(stats.has("quick:a") && !stats.has("quick:b"), "la correction ne remonte jamais dans les habituels");
});

test("recette en portions (30/10/2026) : 800 g en 4 → 1 portion = 200 g proposée, per100 inchangé", async () => {
  const { compileRecipe, recipeAsFood, recipePortionGrams } = await import("../src/nutrition/foodStore.js");
  const ings = [{ ref: "ciqual:1", name: "Riz", q: 500, per100: { kcal: 130, prot: 2.5, gluc: 28, lip: 0.3, fib: 0.4 } },
                { ref: "ciqual:2", name: "Poulet", q: 300, per100: { kcal: 120, prot: 23, gluc: 0, lip: 2.5, fib: 0 } }];
  const one = compileRecipe("Riz poulet", ings);
  const four = compileRecipe("Riz poulet", ings, null, 4);
  assert.equal(one.portions, 1);
  assert.deepEqual(four.per100, one.per100, "les valeurs pour 100 g ne dépendent pas des portions");
  assert.equal(recipePortionGrams(four), 200);
  const f = recipeAsFood(four);
  assert.equal(f.defaultQ, 200);
  assert.equal(f.portions, 4);
  assert.equal(f.totalWeight, 800);
  assert.match(f.grp, /4 portions/);
  // Recette d'avant (sans champ portions) : tout le lot, comme avant.
  const old = { ...one }; delete old.portions;
  assert.equal(recipeAsFood(old).defaultQ, 800);
  assert.equal(recipeAsFood(old).grp, "Recette · 800 g");
  // Modifier sans préciser garde le nombre de portions ; le préciser le remplace.
  assert.equal(compileRecipe("Riz poulet", ings, four).portions, 4);
  assert.equal(compileRecipe("Riz poulet", ings, four, 5).portions, 5);
  assert.equal(recipePortionGrams(compileRecipe("Riz poulet", ings, four, 5)), 160);
});
