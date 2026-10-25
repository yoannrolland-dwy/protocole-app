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

// ---------- 25/10/2026 : exercices inactifs > 60 j repliés, plateau coupé après une pause > 8 semaines
import { splitExerciseList, STALE_EXERCISE_DAYS } from "../src/training.js";
import { T0 } from "./_helpers.mjs";

test("exercices inactifs : > 60 j → anciens (borne à 60 j incluse dans les actifs), rien n'est supprimé", () => {
  const log = [sess(61, 30, 8), { ...sess(60, 30, 8), exercices: [{ nom: "Rowing", mode: "reps", series: [{ poids: 50, val: 8, fait: true }] }] }];
  const { active, stale } = splitExerciseList(log, T0);
  assert.equal(STALE_EXERCISE_DAYS, 60);
  assert.deepEqual(stale.map((e) => e.nom), [NOM], "dernière séance il y a 61 j → ancien");
  assert.deepEqual(active.map((e) => e.nom), ["Rowing"], "il y a 60 j → encore actif");
  assert.equal(stale[0].count, 1, "l'historique de l'exercice ancien reste lisible");
  // Il revient dans les actifs dès qu'il est refait
  assert.deepEqual(splitExerciseList([...log, sess(1, 30, 8)], T0).active.map((e) => e.nom).sort(), [NOM, "Rowing"].sort());
});

test("plateau : une pause de plus de 8 semaines coupe la série (avant la pause = autre période)", () => {
  // 4 séances stables il y a ~7 mois, puis 2 séances stables récentes : 6 séances « stables » au total
  const before = [215, 210, 205, 200].map((i) => sess(i, 30, 8));
  const after = [5, 0].map((i) => sess(i, 30, 8));
  assert.equal(progressiveOverloadSuggestion(exerciseSessions([...before, ...after], NOM), NOM), null, "série coupée → 2 séances seulement");
  // Même historique SANS pause : plateau de 6 séances
  const noGap = [25, 20, 15, 10, 5, 0].map((i) => sess(i, 30, 8));
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(noGap, NOM), NOM).sessions, 6);
  // Une pause de 8 semaines pile (56 j) ne coupe pas
  const edge = [56 * 3, 56 * 2, 56, 0].map((i) => sess(i, 30, 8));
  assert.equal(progressiveOverloadSuggestion(exerciseSessions(edge, NOM), NOM).sessions, 4);
});
