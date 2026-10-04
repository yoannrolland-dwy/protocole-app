// Moteur « Palier de la semaine » (palier.js) — porté de r3-test.mjs et r3b-test.mjs.
// r3b (v3.88.1) a remplacé le pas ±150/±200 par un pas fixe ±100 : les attentes de r3 qui
// portaient sur l'ancien barème sont alignées sur le comportement actuel.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { recommendTargets, palierWeekOf, splitDelta, loggedRateLastDays, isPalierEntry, lastPalier, PALIER } from "../src/palier.js";
import { recompZone } from "../src/tdee.js";
import { shiftDateKey } from "../src/dateUtils.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());
const reading = (deficit) => ({ status: "ok", reading: { deficit, ...recompZone(deficit) } });
const recomp = (a, b = a) => ({ j14: reading(a), j21: reading(b) });
const trend = (d1, d2) => ({ deltaWeek: d1, deltaWeekPrev: d2 });
const now = new Date(2026, 9, 1, 10, 0); // jeudi 1er octobre 2026
const T = { protein: 210, carbs: 270, fat: 90, fiber: 35 };
const run = (o, targets = T) => recommendTargets({ now, targets, targetHistory: [], loggedRate7: 1, ...o });

test("constantes : pas fixe ±100 (décision 10 amendée), observation 14 j, 70 % loggé", () => {
  assert.equal(PALIER.MAX_STEP, 100);
  assert.equal(PALIER.STEP_UP, 100);
  assert.equal(PALIER.STEP_DOWN, 100);
  assert.equal(PALIER.MIN_CHANGE_KCAL, 100);
});

test("hausse : perte > 0,3 kg/sem × 2 → +100 ; déficit 600 → +100 ; déficit 400 → +100", () => {
  assert.equal(run({ recomp: recomp(250), trend: trend(-0.4, -0.45) }).deltaKcal, 100);
  let r = run({ recomp: recomp(600, 580), trend: trend(-0.2, -0.1) });
  assert.equal(r.action, "up");
  assert.equal(r.deltaKcal, 100);
  assert.equal(run({ recomp: recomp(400), trend: trend(-0.2, -0.1) }).deltaKcal, 100);
});

test("baisse : poids en hausse 2 semaines → −100 (G 250 / L 85) ; surplus → −100", () => {
  const r = run({ recomp: recomp(150), trend: trend(0.2, 0.15) });
  assert.equal(r.action, "down");
  assert.equal(r.deltaKcal, -100);
  assert.equal(r.proposed.carbs, 250);
  assert.equal(r.proposed.fat, 85);
  assert.equal(run({ recomp: recomp(-80), trend: trend(0.1, -0.1) }).action, "down");
});

test("observation : palier J−9 bloque même avec un déficit 600, fin à J+14", () => {
  const r = run({ recomp: recomp(600), trend: trend(-0.5, -0.5), targetHistory: [{ date: shiftDateKey("2026-10-01", -9), kcal: 2900, prevKcal: 2800 }] });
  assert.equal(r.action, "hold");
  assert.match(r.blocked, /Observation.*J\+9\/14/);
  assert.equal(r.observation.until, shiftDateKey("2026-10-01", 5));
});

test("données : 60 % loggé bloque ; 14 j visée / 21 j trop → désaccord bloque ; zones adjacentes → moyenne décide", () => {
  let r = run({ recomp: recomp(600), trend: trend(-0.5, -0.5), loggedRate7: 0.6 });
  assert.ok(r.action === "hold" && /60 %/.test(r.blocked), r.blocked);
  r = run({ recomp: recomp(200, 650), trend: trend(-0.2, -0.2) });
  assert.ok(r.action === "hold" && /désaccord/.test(r.blocked), r.blocked);
  r = run({ recomp: recomp(280, 340), trend: trend(-0.2, -0.2) });
  assert.ok(r.action === "up" && r.deltaKcal === 100, "visée/haut adjacentes, moyenne 310 → +100");
});

test("hold non bloquant : zone visée → maintenir ; sous la zone → maintenir", () => {
  const r = run({ recomp: recomp(200), trend: trend(-0.15, -0.1) });
  assert.equal(r.action, "hold");
  assert.equal(r.blocked, null);
  assert.match(r.reasons.at(-1), /maintenir/i);
  assert.equal(run({ recomp: recomp(50), trend: trend(-0.1, -0.1) }).action, "hold");
});

test("splitDelta : 75 % glucides / 25 % lipides arrondis à 5 g, protéines/fibres intactes (+100 → +20 G / +5 L)", () => {
  const s = splitDelta(100, T);
  assert.deepEqual([s.carbs, s.fat, s.protein, s.fiber], [290, 95, 210, 35]);
});

test("cibles réelles 200/280/90/35 (2800) : +100 → 200 P / 300 G / 95 L = 2925 kcal affichés (arrondi à 5 g assumé)", () => {
  const T2 = { protein: 200, carbs: 280, fat: 90, fiber: 35 };
  const r = recommendTargets({ now: new Date(2026, 9, 2, 10), targets: T2, targetHistory: [], loggedRate7: 1, recomp: recomp(600), trend: trend(-0.2, -0.1) });
  assert.deepEqual([r.action, r.deltaKcal, r.proposed.protein, r.proposed.carbs, r.proposed.fat, r.proposed.kcal], ["up", 100, 200, 300, 95, 2925]);
  const b = recommendTargets({ now: new Date(2026, 9, 2, 10), targets: T2, targetHistory: [], loggedRate7: 1, recomp: recomp(-50), trend: trend(0.1, 0.2) });
  assert.deepEqual([b.deltaKcal, b.proposed.carbs, b.proposed.fat], [-100, 260, 85]);
});

test("palierWeekOf : dimanche 13h59 → lundi en cours ; 14h01 → lundi suivant ; jeudi / lundi", () => {
  assert.equal(palierWeekOf(new Date(2026, 9, 4, 13, 59)), "2026-09-28");
  assert.equal(palierWeekOf(new Date(2026, 9, 4, 14, 1)), "2026-10-05");
  assert.equal(palierWeekOf(now), "2026-09-28");
  assert.equal(palierWeekOf(new Date(2026, 9, 5, 8)), "2026-10-05");
});

test("loggedRateLastDays : 5 des 7 jours terminés → 5/7, jour en cours ignoré", () => {
  const kb = {}; [1, 2, 3, 5, 7].forEach((i) => { kb[d(i)] = 2000; }); kb[T0] = 500;
  assert.ok(Math.abs(loggedRateLastDays(kb, T0) - 5 / 7) < 1e-9);
});

test("isPalierEntry : net ≥ 100 ou source palier ; entrée isolée sans repère ou net < 100 → pas un palier", () => {
  assert.ok(!isPalierEntry({ date: "2026-10-02", kcal: 2800 }, undefined), "ancienne entrée isolée sans repère");
  assert.ok(!isPalierEntry({ date: "2026-10-02", kcal: 2800, prevKcal: 2800 }), "net 0");
  assert.ok(!isPalierEntry({ date: "2026-10-02", kcal: 2860, prevKcal: 2800 }), "net +60");
  assert.ok(isPalierEntry({ date: "2026-10-02", kcal: 2900, prevKcal: 2800 }), "net +100");
  assert.ok(isPalierEntry({ date: "2026-10-02", kcal: 2900, source: "palier" }), "appliqué depuis la carte");
  assert.ok(isPalierEntry({ date: "2026-10-02", kcal: 2950 }, { date: "2026-09-20", kcal: 2800 }), "delta vs entrée précédente ≥ 100");
});

test("retouche à total constant → pas d'observation ; vrai palier J−3 → observation", () => {
  const now2 = new Date(2026, 9, 2, 10);
  const T2 = { protein: 200, carbs: 280, fat: 90, fiber: 35 };
  const fake = [{ date: "2026-10-02", kcal: 2800, prevKcal: 2800, source: "manual" }];
  assert.equal(lastPalier(fake), null);
  assert.equal(recommendTargets({ now: now2, targets: T2, loggedRate7: 1, recomp: recomp(600), trend: trend(-0.2, -0.1), targetHistory: fake }).action, "up");
  const real = [{ date: shiftDateKey("2026-10-02", -3), kcal: 2900, prevKcal: 2800, source: "palier" }, ...fake];
  const r = recommendTargets({ now: now2, targets: T2, loggedRate7: 1, recomp: recomp(600), trend: trend(-0.2, -0.1), targetHistory: real });
  assert.ok(r.action === "hold" && /J\+3\/14/.test(r.blocked), r.blocked);
});
