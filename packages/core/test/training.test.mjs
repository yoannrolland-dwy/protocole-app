// Reps en réserve (T4, 04/10/2026) : exerciseSessions / exoProgress / progressiveOverloadSuggestion.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { exerciseSessions, exoProgress, progressiveOverloadSuggestion } from "../src/training.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { fixClock, d } from "./_helpers.mjs";

before(() => fixClock());
const NOM = "Développé incliné haltères"; // 4 × 8-10, pas HSR
const sess = (daysAgo, poids, val, rir) => ({
  date: d(daysAgo), type: "Upper A",
  exercices: [{ nom: NOM, mode: "reps", ...(rir != null ? { rir } : {}), series: [{ poids, val, fait: true }, { poids, val: val - 1, fait: true }] }],
});
// 6 séances stables (même meilleure série, même volume), espacées de 5 jours
const stable = (rirs = []) => [5, 4, 3, 2, 1, 0].map((i) => sess(i * 5, 30, 8, rirs[5 - i]));

test("exerciseSessions porte le RIR de chaque séance (null si absent)", () => {
  const s = exerciseSessions([sess(2, 30, 8, 2), sess(0, 30, 8)], NOM);
  assert.deepEqual(s.map((x) => x.rir), [2, null]);
});

test("plateau : 6 séances stables sans RIR → plateau (comportement inchangé)", () => {
  const r = progressiveOverloadSuggestion(exerciseSessions(stable(), NOM), NOM);
  assert.ok(r && r.kind === "reps" && r.sessions === 6, JSON.stringify(r));
});

test("plateau : un RIR qui AUGMENTE sur une paire stable casse la série (effort qui baisse = progression)", () => {
  // RIR 1,1,1,1 puis 2 sur l'avant-dernière → la série stable ne remonte plus que sur 2 séances
  const r = progressiveOverloadSuggestion(exerciseSessions(stable([1, 1, 1, 1, 2, 2]), NOM), NOM);
  assert.equal(r, null);
});

test("plateau : RIR constant ou qui baisse ne change rien ; RIR partiellement renseigné ignoré sur la paire", () => {
  assert.ok(progressiveOverloadSuggestion(exerciseSessions(stable([2, 2, 2, 2, 2, 2]), NOM), NOM), "RIR constant → plateau");
  assert.ok(progressiveOverloadSuggestion(exerciseSessions(stable([3, 3, 2, 2, 1, 1]), NOM), NOM), "RIR qui baisse → plateau (effort qui monte à charge égale)");
  assert.ok(progressiveOverloadSuggestion(exerciseSessions(stable([null, 2, null, 2, null, 3]), NOM), NOM), "RIR absent sur une des deux séances de chaque paire → règle d'avant");
});

test("exoProgress : clé rir seulement si au moins une séance en a, dans l'ordre de series_max", () => {
  const withRir = exoProgress([sess(2, 30, 8, 1), sess(0, 32, 8, 2)]);
  assert.deepEqual(withRir[0].rir, [1, 2]);
  assert.equal(withRir[0].tendance, "hausse");
  const without = exoProgress([sess(2, 30, 8), sess(0, 32, 8)]);
  assert.ok(!("rir" in without[0]));
});

test("Coach IA : légende RIR dans le prompt seulement quand une séance en porte", () => {
  const empty = { weight: [], sleep: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "", journal: "", basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false, phase: "seche" };
  const u1 = buildCoachPrompt({ ...empty, training: [sess(1, 30, 8, 2)] }, "").user;
  assert.match(u1, /"rir" = reps en réserve/);
  assert.match(u1, /"rir":\[2\]/);
  const u0 = buildCoachPrompt({ ...empty, training: [sess(1, 30, 8)] }, "").user;
  assert.ok(!u0.includes("reps en réserve"));
});
