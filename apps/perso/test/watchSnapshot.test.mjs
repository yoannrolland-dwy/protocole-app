// Instantané envoyé à la montre (17/11/2026) : forme stable, mêmes chiffres que les écrans, petit
// assez pour la couche de données Wear OS (100 Ko par élément), et le Journal montre aujourd'hui
// puis demain (choix de Yoann). Données inventées, datées relativement à aujourd'hui.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWatchSnapshot, WATCH_SNAPSHOT_VERSION } from "../src/lib/watchSnapshot.js";
import { DEFAULT_TARGETS, targetsForDate, kcalFromMacros } from "@rawcare/core/targets";
import { today, shiftDateKey } from "@rawcare/core/dateUtils";
import { STEPS_TARGET } from "../src/lib/helpers.js";
import { COLORS } from "../src/design/tokens.js";

const T0 = today();
const day = (n) => shiftDateKey(T0, n);
const per100 = { kcal: 200, prot: 20, gluc: 10, lip: 8, fib: 2 };

function data(extra = {}) {
  const weight = [], sleep = [], macros = [], steps = [], foodLog = [];
  for (let i = 30; i >= 0; i--) {
    weight.push({ date: day(-i), kg: 90 - i * 0.01 });
    sleep.push({ date: day(-i), hours: 5.5, quality: 3 });
    steps.push({ date: day(-i), count: 8000 });
    if (i > 0) macros.push({ date: day(-i), kcal: 2400, protein: 180, carbs: 220, fat: 80, fiber: 30, water: 2500 });
  }
  macros.push({ date: T0, kcal: 400, protein: 40, carbs: 20, fat: 16, fiber: 4, water: 1250 });
  steps[steps.length - 1] = { date: T0, count: 12345 };
  foodLog.push({ id: "a", date: T0, meal: "dejeuner", ref: "ciqual:1", name: "Poulet", q: 200, per100 });
  foodLog.push({ id: "b", date: day(1), meal: "diner", ref: "ciqual:2", name: "Riz prévu", q: 100, per100 });
  foodLog.push({ id: "c", date: day(2), meal: "diner", ref: "ciqual:3", name: "Après-demain", q: 100, per100 });
  return {
    weight, sleep, macros, steps, foodLog, overrides: {}, knee: [], rhr: [], naps: [], training: [],
    targets: DEFAULT_TARGETS, phase: "recomposition", basketSchedule: { weekly: [], matchDates: [] }, palier: null,
    backup: { stale: false }, ...extra,
  };
}

const page = (s, key) => s.pages.find((p) => p.key === key);

test("forme : version, date du jour, heure et trois pages dans l'ordre Bord, Journal, Dépense", () => {
  const s = buildWatchSnapshot(data(), new Date());
  assert.equal(s.v, WATCH_SNAPSHOT_VERSION);
  assert.equal(s.date, T0);
  assert.match(s.at, /^\d\d:\d\d$/);
  assert.deepEqual(s.pages.map((p) => p.key), ["bord", "journal", "depense"]);
  for (const p of s.pages) for (const it of p.items) assert.ok(typeof it.t === "string", "chaque bloc a un type");
});

test("Bord : mêmes chiffres que les tuiles (kcal mesurées, cible, pas, eau)", () => {
  const s = buildWatchSnapshot(data(), new Date());
  const items = page(s, "bord").items;
  const tile = (label) => items.find((i) => i.t === "tile" && i.label === label);
  const at = targetsForDate(T0, DEFAULT_TARGETS);
  assert.equal(tile("Kcal").value, "400");
  assert.equal(tile("Kcal").note, `/ ${Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber))}`);
  const pas = items.find((i) => i.id === "pas");
  assert.equal(pas.count, 12345);
  assert.equal(pas.target, STEPS_TARGET);
  assert.equal(pas.barCol, COLORS.over, "objectif de pas dépassé : bleu, comme sur le téléphone");
  assert.equal(tile("Eau").value, "1.25");
  assert.ok(items.some((i) => i.t === "head" && i.text === "Prochaine séance"));
  assert.ok(!items.some((i) => i.t === "alert"), "pas de rappel de sauvegarde quand elle est à jour");
});

test("Bord : rappel de sauvegarde périmée, sans bouton", () => {
  const s = buildWatchSnapshot(data({ backup: { stale: true, days: 9, last: day(-9) } }), new Date());
  const a = page(s, "bord").items.find((i) => i.t === "alert");
  assert.match(a.text, /il y a 9 jours/);
});

test("Journal : aujourd'hui puis demain, jamais après-demain", () => {
  const s = buildWatchSnapshot(data(), new Date());
  const items = page(s, "journal").items;
  const heads = items.filter((i) => i.t === "head").map((i) => i.text);
  assert.equal(heads.length, 2);
  assert.match(heads[0], /^Aujourd'hui/);
  assert.match(heads[1], /^Demain/);
  const foods = items.filter((i) => i.t === "food").map((i) => i.name);
  assert.deepEqual(foods, ["Poulet", "Riz prévu"]);
  assert.equal(items.find((i) => i.t === "food").kcal, "400");
  const cal = items.find((i) => i.t === "tile" && i.label === "Calories");
  assert.equal(cal.value, "400");
  assert.match(cal.extra.txt, /^Il reste \d+$/);
});

test("Journal : demain sans rien de prévu le dit", () => {
  const d = data();
  d.foodLog = d.foodLog.filter((e) => e.date !== day(1));
  const items = page(buildWatchSnapshot(d, new Date()), "journal").items;
  assert.ok(items.some((i) => i.t === "text" && i.text === "Rien de prévu pour l'instant."));
});

test("Dépense : estimation ou raison, comparaison des fenêtres, jamais de nombre inventé", () => {
  const items = page(buildWatchSnapshot(data(), new Date()), "depense").items;
  assert.equal(items[0].text, "Dépense estimée");
  assert.ok(items.some((i) => i.t === "head" && i.text === "Comparaison des fenêtres"));
  assert.ok(items.some((i) => i.t === "head" && i.text === "Zone de recomposition"), "phase Recomposition");
});

test("taille : un mois de données tient très largement sous 100 Ko", () => {
  const json = JSON.stringify(buildWatchSnapshot(data(), new Date()));
  assert.ok(json.length < 30_000, `${json.length} caractères`);
});
