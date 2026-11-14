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

// ---------- 14/11/2026 : comparaison à format égal (même nombre de séries)
import { recentSessionsDetail, setShort } from "../src/training.js";
const multi = (daysAgo, reps, poids = 34, rir = 0, type = "Upper A") => ({ date: d(daysAgo), type,
  exercices: [{ nom: NOM, mode: "reps", rir, series: reps.map((v) => ({ poids, val: v, fait: true })) }] });

test("régression 14/11 : plus de répétitions sur les séries suivantes = progression, pas un plateau", () => {
  // Historique réel du développé incliné (34 kg) : Full Body à 3 séries entre des Upper A à 4 séries.
  const tr = [multi(35, [10, 9, 9], 34, 0, "Full Body"), multi(32, [10, 9, 9, 9]), multi(27, [10, 9, 9, 9]),
    multi(22, [10, 10, 9, 9]), multi(15, [10, 10, 9, 9]), multi(9, [10, 10, 9, 9]), multi(7, [10, 9, 9], 34, 0, "Full Body")];
  const before = progressiveOverloadSuggestion(exerciseSessions(tr, NOM), NOM);
  assert.equal(before?.sessions, 4, "10-10-9-9 trois fois puis une Full Body : 4 séances sans progrès");
  const today = [...tr, multi(0, [10, 10, 10, 9])];
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(today, NOM), NOM), null, "39 répétitions après 38 : plus de plateau");
  assert.equal(exerciseTrend(exerciseSessions(today, NOM)).key, "up", "comparée à la dernière séance à 4 séries");
});

test("format égal : une séance à 3 séries ne se compare pas à une séance à 4 ; la charge prime toujours", () => {
  const tr = [multi(10, [10, 10, 10, 10]), multi(5, [10, 10, 10])];
  assert.equal(exerciseTrend(exerciseSessions(tr, NOM)).key, "flat", "moins de séries n'est pas une baisse");
  const heavier = [multi(10, [10, 10, 10, 10]), multi(5, [8, 8, 8], 36)];
  assert.equal(exerciseTrend(exerciseSessions(heavier, NOM)).key, "up", "plus lourd = hausse, quel que soit le format");
  // Une séance d'un format jamais vu ne fait pas progresser le plateau si la charge ne monte pas
  const seq = [multi(20, [10, 10, 10, 10]), multi(15, [10, 10, 10, 10]), multi(10, [10, 10]), multi(5, [10, 10, 10, 10])];
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(seq, NOM), NOM)?.sessions, 4);
});

test("format égal : une baisse nette d'au moins une rep par série coupe le plateau", () => {
  const seq = [multi(20, [10, 10, 10, 10]), multi(15, [10, 10, 10, 10]), multi(10, [9, 9, 9, 9]), multi(5, [9, 9, 9, 9])];
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(seq, NOM), NOM), null, "recul, pas plateau");
  const small = [multi(20, [10, 10, 10, 10]), multi(15, [10, 10, 10, 9]), multi(10, [10, 10, 10, 10]), multi(5, [10, 10, 9, 9])];
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(small, NOM), NOM)?.sessions, 4, "une ou deux reps de moins sur 4 séries : plateau");
});

test("historique du carnet : 5 dernières séances, la plus récente en tête, toutes les séries et le RIR ; séance modifiée exclue", () => {
  const tr = [1, 2, 3, 4, 5, 6].map((k) => multi(30 - k * 4, [10, 9], 34, k % 2));
  const out = recentSessionsDetail(tr, NOM);
  assert.equal(out.length, 5);
  assert.equal(out[0].date, tr[5].date);
  assert.deepEqual(out[0].series.map((x) => setShort(x, "reps")), ["34×10", "34×9"]);
  assert.equal(out[0].rir, 0);
  assert.equal(recentSessionsDetail(tr, NOM, { exclude: tr[5] })[0].date, tr[4].date);
  assert.equal(setShort({ poids: 20, val: 10, leg: "G" }, "reps"), "G 20×10");
  assert.equal(setShort({ poids: 0, val: 60 }, "temps"), "60 s");
});
