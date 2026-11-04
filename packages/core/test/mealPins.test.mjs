// Favoris et masqués par repas (04/11/2026, demande de Yoann) : masquer ou épingler au goûter ne
// touche que le goûter ; une étoile suffit pour qu'un aliment apparaisse dans ce repas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestions, pinsForMeal, mutedForMeal, allMealPins, togglePinIn, muteIn, unmuteIn } from "../src/nutrition/foodStore.js";

const D = "2026-11-04";
const line = (ref, name, meal, date = "2026-11-03", q = 100) => ({ id: `${ref}-${meal}-${date}`, date, meal, ref, name, q, per100: { kcal: 100, prot: 10, gluc: 10, lip: 2, fib: 1 } });
const log = [
  line("ciqual:1", "Skyr", "gouter"), line("ciqual:1", "Skyr", "diner"),
  line("ciqual:2", "Riz", "dejeuner"), line("ciqual:2", "Riz", "diner"),
  line("recipe:r1", "Chili", "diner", "2026-11-02", 200),
];
const names = (meal, mealPins = {}, mealMuted = {}) =>
  suggestions(log, { meal, pins: pinsForMeal(mealPins, meal), muted: mutedForMeal(mealMuted, meal), date: D }).map((s) => s.name);

test("sans favori ni masqué : chaque repas ne montre que ce qui y a été mangé (recettes comprises)", () => {
  assert.deepEqual(names("gouter"), ["Skyr"]);
  assert.deepEqual(names("dejeuner"), ["Riz"]);
  assert.deepEqual(names("diner").sort(), ["Chili", "Riz", "Skyr"]);
  assert.deepEqual(names("petitdej"), []);
});

test("masquer au goûter ne masque rien au dîner, et retire l'étoile du goûter seulement", () => {
  const pins = togglePinIn(togglePinIn({}, "gouter", { ref: "ciqual:1", name: "Skyr" }), "diner", { ref: "ciqual:1", name: "Skyr" });
  const { muted, pins: p2 } = muteIn({}, pins, "gouter", "ciqual:1");
  assert.deepEqual(names("gouter", p2, muted), []);
  assert.ok(names("diner", p2, muted).includes("Skyr"));
  assert.equal(pinsForMeal(p2, "gouter").length, 0);
  assert.equal(pinsForMeal(p2, "diner").length, 1);
  assert.deepEqual(names("gouter", p2, unmuteIn(muted, "gouter", "ciqual:1")), ["Skyr"]);
});

test("une étoile au goûter fait apparaître l'aliment au goûter, même jamais mangé là, et nulle part ailleurs", () => {
  const pins = togglePinIn({}, "gouter", { ref: "ciqual:2", name: "Riz", per100: { kcal: 130 } });
  const g = suggestions(log, { meal: "gouter", pins: pinsForMeal(pins, "gouter"), date: D });
  assert.equal(g[0].name, "Riz");
  assert.equal(g[0].pinned, true);
  assert.equal(g[0].lastQ, 100, "dernière quantité prise dans le journal");
  assert.deepEqual(names("petitdej", pins), []);
});

test("favori jamais mangé nulle part : la copie de l'aliment suffit", () => {
  const pins = togglePinIn({}, "gouter", { ref: "ciqual:9", name: "Amandes", per100: { kcal: 600, prot: 21, gluc: 7, lip: 50, fib: 12 } });
  const g = suggestions(log, { meal: "gouter", pins: pinsForMeal(pins, "gouter"), date: D });
  assert.deepEqual(g.map((s) => s.name), ["Amandes", "Skyr"]);
  assert.equal(g[0].per100.kcal, 600);
  assert.deepEqual(togglePinIn(pins, "gouter", { ref: "ciqual:9" }).gouter, [], "second tap : retirée");
});

test("sans repas (ingrédients d'une recette) : tous les favoris une fois, rien de masqué", () => {
  const pins = togglePinIn(togglePinIn({}, "gouter", { ref: "ciqual:1", name: "Skyr" }), "diner", { ref: "ciqual:1", name: "Skyr" });
  assert.equal(allMealPins(pins).length, 1);
  const s = suggestions(log, { pins: allMealPins(pins), date: D });
  assert.equal(s[0].name, "Skyr");
  assert.equal(s.length, 3);
});
