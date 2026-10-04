// Alcool dans la saisie libre (T5, 04/10/2026) : makeEntry / alcoholGramsFor / prompt alcool_g.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { makeEntry, alcoholGramsFor, amounts, totals } from "../src/nutrition/foodStore.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { SCHEMES } from "../src/climbing.js";
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
  const base = { weight: [], sleep: [], training: [], knee: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodOverrides: {}, profile: "", journal: "", scheme: SCHEMES.gym, basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false, phase: "seche" };
  const macros = [{ date: d(1), protein: 200, carbs: 250, fat: 80, fiber: 30, water: 2000 }, { date: T0, protein: 100, carbs: 120, fat: 40, fiber: 15, water: 1000 }];
  const foodLog = [makeEntry({ date: d(1), meal: "extra", food: food({ kcal: 190, prot: 0, gluc: 16, lip: 0, fib: 0, alcool: 18 }), q: 100 })];
  const u = buildCoachPrompt({ ...base, macros, foodLog }, "").user;
  assert.match(u, /"macros_hier":\{[^}]*"alcool_g":18\}/);
  assert.doesNotMatch(u, /"macros_aujourdhui_en_cours":\{[^}]*alcool_g/);
  const u0 = buildCoachPrompt({ ...base, macros, foodLog: [] }, "").user;
  assert.ok(!u0.includes("alcool_g"));
});
