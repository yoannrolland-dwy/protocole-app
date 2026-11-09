// Tendance hausse / stable / baisse (09/11/2026, demande de Yoann) : une rep de moins n'est pas
// une baisse, et une baisse doit être confirmée sur deux séances d'affilée.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { exerciseSessions, exerciseTrend, exoProgress, clearDrop, progressiveOverloadSuggestion } from "../src/training.js";
import { fixClock, d } from "./_helpers.mjs";

before(() => fixClock());
const NOM = "Développé incliné haltères";
const one = (daysAgo, poids, val, mode = "reps") => ({ date: d(daysAgo), type: "Upper A",
  exercices: [{ nom: NOM, mode, series: [{ poids, val, fait: true }] }] });
const trend = (...sets) => {
  const tr = sets.map(([p, v, mode], i) => one((sets.length - 1 - i) * 4, p, v, mode));
  return exerciseTrend(exerciseSessions(tr, NOM)).key;
};

test("clearDrop : 2 reps de moins à même charge, ou plus léger sans plus de reps ; temps −10 %", () => {
  assert.equal(clearDrop({ poids: 60, val: 7 }, { poids: 60, val: 8 }), false, "une rep de moins");
  assert.equal(clearDrop({ poids: 60, val: 6 }, { poids: 60, val: 8 }), true);
  assert.equal(clearDrop({ poids: 40, val: 10 }, { poids: 45, val: 6 }), false, "moins lourd mais plus de reps");
  assert.equal(clearDrop({ poids: 55, val: 8 }, { poids: 60, val: 8 }), true);
  assert.equal(clearDrop({ poids: 0, val: 55 }, { poids: 0, val: 60 }, "temps"), false);
  assert.equal(clearDrop({ poids: 0, val: 54 }, { poids: 0, val: 60 }, "temps"), true);
});

test("tendance : une rep de moins ou 45×6 → 40×10 = stable ; hausse inchangée (charge d'abord)", () => {
  assert.equal(trend([60, 8], [60, 7]), "flat");
  assert.equal(trend([45, 6], [40, 10]), "flat");
  assert.equal(trend([40, 10], [45, 6]), "up");
  assert.equal(trend([60, 8], [60, 9]), "up");
  assert.equal(trend([60, 8]), "first");
});

test("tendance : une seule séance nettement en dessous = stable, deux d'affilée = baisse", () => {
  assert.equal(trend([60, 8], [60, 6]), "flat", "deux séances seulement : rien à confirmer");
  assert.equal(trend([60, 8], [60, 8], [60, 6]), "flat", "un mauvais jour");
  assert.equal(trend([60, 8], [60, 6], [60, 6]), "down");
  assert.equal(trend([60, 8], [55, 8], [55, 7]), "down", "plus léger deux fois");
  assert.equal(trend([60, 8], [60, 6], [60, 7]), "up", "la dernière bat l'avant-dernière");
  assert.equal(trend([0, 60, "temps"], [0, 50, "temps"], [0, 50, "temps"]), "down");
});

test("Coach IA : exoProgress suit la même règle", () => {
  const tr = [one(8, 60, 8), one(4, 60, 8), one(0, 60, 7)];
  assert.equal(exoProgress(tr)[0].tendance, "stable");
  const tr2 = [one(8, 60, 8), one(4, 60, 6), one(0, 60, 6)];
  assert.equal(exoProgress(tr2)[0].tendance, "baisse");
});

test("plateau : 8, 7, 8, 7 reps à la même charge reste un plateau ; une vraie baisse le coupe", () => {
  const seq = (vals) => vals.map((v, i) => one((vals.length - 1 - i) * 5, 30, v));
  const r = progressiveOverloadSuggestion(exerciseSessions(seq([8, 7, 8, 7]), NOM), NOM);
  assert.ok(r && r.sessions === 4, JSON.stringify(r));
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(seq([8, 8, 6, 6]), NOM), NOM), null);
});
