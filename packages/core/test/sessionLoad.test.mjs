// Charge-séance RPE × durée + gêne articulaire (08/10/2026) — remplace le suivi des blocs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionLoad, loadLabel, sessionGene, geneLabel, LOAD_LIGHT, LOAD_HEAVY } from "../src/sessionLoad.js";
import { recommendSessions } from "../src/recommender.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { weighTimeAnalysis } from "../src/weighTime.js";
import { fixClock, T0, d, session, kneeOk } from "./_helpers.mjs";

fixClock();

test("sessionLoad : RPE × minutes, seuils 300/540, null sans durée ou RPE", () => {
  assert.deepEqual(sessionLoad({ duration: 60, rpe: 7 }), { load: 420, level: "normale", duration: 60, rpe: 7 });
  assert.equal(sessionLoad({ duration: 50, rpe: 6 }).level, "legere");
  assert.equal(sessionLoad({ duration: 60, rpe: 9 }).level, "grosse");
  assert.equal(sessionLoad({ duration: 90, rpe: 6 }).level, "grosse");
  assert.equal(sessionLoad({ duration: LOAD_LIGHT / 5, rpe: 5 }).level, "legere");
  assert.equal(sessionLoad({ duration: LOAD_HEAVY / 6, rpe: 6 }).level, "grosse");
  assert.equal(sessionLoad({ duration: 60 }), null);
  assert.equal(sessionLoad({ rpe: 7 }), null);
  assert.equal(sessionLoad(undefined), null);
  assert.equal(loadLabel({ duration: 60, rpe: 7 }), "charge 420 (normale)");
});

test("sessionGene : null sans zone ou sous 1, libellé", () => {
  assert.equal(sessionGene({}), null);
  assert.equal(sessionGene({ gene: { zone: "coudes", pain: 0 } }), null);
  assert.deepEqual(sessionGene({ gene: { zone: "coudes", pain: 5 } }), { zone: "coudes", pain: 5 });
  assert.equal(geneLabel({ gene: { zone: "poignets", pain: 3 } }), "gêne poignets 3/10");
});

const base = (o = {}) => ({ training: [], knee: kneeOk(), sleep: [], targets: DEFAULT_TARGETS, ...o });
const score = (r, type) => r.suggestions.find((s) => s.type === type)?.score;

test("recommandeur : la pénalité du lendemain suit la charge-séance (légère 4 / normale 8 / grosse 14), forfait 8 sans RPE", () => {
  const withClimb = (extra) => recommendSessions(base({ training: [{ date: d(1), type: "Escalade", ...extra }] }));
  const ref = recommendSessions(base({ training: [{ date: d(5), type: "Escalade", duration: 60, rpe: 7 }] }));
  const up = (r) => r.suggestions.find((s) => s.type.startsWith("Upper"));
  const legere = up(withClimb({ duration: 40, rpe: 6 })), grosse = up(withClimb({ duration: 90, rpe: 8 })), sans = up(withClimb({}));
  assert.ok(legere.reason.includes("charge 240") && legere.reason.includes("session légère"));
  assert.ok(grosse.reason.includes("charge 720") && grosse.reason.includes("grosse session"));
  assert.ok(sans.reason.includes("Escalade récente : allège le tirage"));
  // Ordre des pénalités : légère < forfait < grosse.
  assert.ok(legere.score > sans.score && sans.score > grosse.score);
  assert.ok(up(ref).score > legere.score);
});

test("recommandeur : gêne ≥ 4 à la dernière escalade pénalise Escalade (−12) et Upper (−8) le lendemain, pas sous 4", () => {
  const run = (pain) => recommendSessions(base({ limit: 10, training: [{ date: d(1), type: "Escalade", duration: 60, rpe: 7, ...(pain != null ? { gene: { zone: "coudes", pain } } : {}) }] }));
  const none = run(null), low = run(3), hot = run(6);
  const up = (r) => r.suggestions.find((s) => s.type.startsWith("Upper"));
  assert.equal(up(low).score, up(none).score);
  assert.equal(up(hot).score, up(none).score - 8);
  assert.ok(up(hot).reason.includes("Gêne coudes 6/10"));
  assert.equal(score(hot, "Escalade"), score(none, "Escalade") - 12);
});

test("prompt : charge/niveau et gêne dans les séances sans séries, légende gêne conditionnelle", () => {
  const empty = { weight: [], sleep: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, phase: "seche", foodLog: [], foodOverrides: {}, profile: "", journal: "" };
  const a = buildCoachPrompt({ ...empty, training: [{ date: d(1), type: "Escalade", duration: 60, rpe: 7 }] }, "").user;
  assert.ok(a.includes('"charge":420') && a.includes('"niveau":"normale"') && a.includes('"charge" = RPE × minutes'));
  assert.ok(!a.includes('"gene" = gêne'));
  const b = buildCoachPrompt({ ...empty, training: [{ date: d(1), type: "Escalade", duration: 60, rpe: 7, gene: { zone: "doigts", pain: 4 } }] }, "").user;
  assert.ok(b.includes('"gene":"doigts 4/10"') && b.includes('"gene" = gêne'));
  assert.ok(!a.includes("blocs") && !a.includes("cotation"));
});

test("weighTimeAnalysis : écart à la tendance par groupe d'heure, prêt dès 3 et 3, pesée sans heure ignorée", () => {
  const log = [];
  for (let i = 30; i >= 0; i--) log.push({ date: d(i), kg: 94, time: i % 5 === 0 ? "05:30" : "08:00" });
  log.find((w) => w.date === d(10)).kg = 94.4; // une pesée précoce plus haute
  log.push({ date: d(3), kg: 93, time: undefined }); // doublon sans heure : ignoré (upsert pas appliqué ici, mais l'entrée sans time n'entre dans aucun groupe)
  const r = weighTimeAnalysis(log);
  assert.ok(r.ready && r.early.n >= 3 && r.late.n >= 3);
  assert.ok(r.early.meanDelta > r.late.meanDelta);
  assert.equal(r.cutoffHour, 7);
  assert.equal(weighTimeAnalysis([{ date: d(1), kg: 94 }]).ready, false);
});

test("prompt : `poids.heure_pesee` et sa consigne seulement avec 3 pesées horodatées de chaque côté", () => {
  const empty = { sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, phase: "seche", foodLog: [], foodOverrides: {}, profile: "", journal: "" };
  const noTime = Array.from({ length: 20 }, (_, i) => ({ date: d(i), kg: 94 }));
  const a = buildCoachPrompt({ ...empty, weight: noTime }, "").user;
  assert.ok(!a.includes("heure_pesee"));
  const withTime = noTime.map((w, i) => ({ ...w, time: i % 4 === 0 ? "05:30" : "08:10" }));
  const b = buildCoachPrompt({ ...empty, weight: withTime }, "").user;
  assert.ok(b.includes('"heure_pesee":{"avant_7h":{"n":5') && b.includes("Pour information seulement"));
});
