// Recettes (26/11/2026, demande de Yoann) : description libre, et ingrédients proposés en deux
// listes (favoris puis habituels), sans la recette elle-même. Données synthétiques.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileRecipe, recipeAsFood, ingredientChoices, allMealPins } from "../src/nutrition/foodStore.js";

const per100 = { kcal: 100, prot: 10, gluc: 10, lip: 2, fib: 1 };
const ings = [{ ref: "ciqual:1", name: "Riz", q: 200, per100 }];

test("description : gardée, reprise en modification, absente si vide, jamais dans le journal", () => {
  const r = compileRecipe("Chili", ings, null, 2, "  Mijoter 2 h.\nServir chaud.  ");
  assert.equal(r.description, "Mijoter 2 h.\nServir chaud.");
  // Modification sans toucher à la description (argument absent) : elle reste.
  const kept = compileRecipe("Chili maison", ings, r, 2);
  assert.equal(kept.description, r.description);
  assert.equal(kept.id, r.id);
  // Modification qui la vide : plus de champ du tout.
  const cleared = compileRecipe("Chili", ings, r, 2, "   ");
  assert.equal("description" in cleared, false);
  // Recette sans description : même forme qu'avant.
  assert.equal("description" in compileRecipe("Riz", ings, null, 1), false);
  // Copie (nouvelle recette préremplie) : la description passe, l'identifiant change.
  const copy = compileRecipe("Chili (copie)", ings, null, 2, r.description);
  assert.equal(copy.description, r.description);
  assert.notEqual(copy.id, r.id);
  // La forme « aliment » (celle copiée dans le journal) ne la reprend pas.
  assert.equal("description" in recipeAsFood(r), false);
});

const D = "2026-11-26";
const line = (ref, name, date, n = 1) => Array.from({ length: n }, (_, k) => ({
  id: `${ref}-${date}-${k}`, date, meal: "diner", ref, name, q: 100, per100,
}));
const log = [
  ...line("ciqual:1", "Riz", "2026-11-25", 3),
  ...line("ciqual:2", "Skyr", "2026-11-24", 2),
  ...line("recipe:r1", "Chili", "2026-11-23"),
];
const mealPins = { gouter: [{ ref: "ciqual:2", name: "Skyr", per100 }], petitdej: [{ ref: "ciqual:9", name: "Flocons d'avoine", per100 }] };

test("ingrédients : favoris de tous les repas d'abord, puis les habituels, sans doublon", () => {
  const c = ingredientChoices(log, { pins: allMealPins(mealPins), date: D });
  assert.deepEqual(c.favoris.map((f) => f.name).sort(), ["Flocons d'avoine", "Skyr"], "une étoile jamais mangée compte aussi");
  assert.ok(c.habituels.some((f) => f.name === "Riz"));
  assert.ok(!c.habituels.some((f) => f.name === "Skyr"), "un favori n'est pas répété dans les habituels");
});

test("ingrédients : une recette modifiée ne se propose pas comme son propre ingrédient", () => {
  const all = ingredientChoices(log, { pins: [], date: D });
  assert.ok(all.habituels.some((f) => f.ref === "recipe:r1"));
  const c = ingredientChoices(log, { pins: [], exclude: "recipe:r1", date: D });
  assert.ok(!c.habituels.some((f) => f.ref === "recipe:r1"));
  assert.ok(!c.favoris.some((f) => f.ref === "recipe:r1"));
});
