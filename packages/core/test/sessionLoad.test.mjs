// Charge-séance RPE × durée + gêne articulaire (08/10/2026) — remplace le suivi des blocs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionLoad, loadLabel, sessionGene, sessionGenes, geneLabel, LOAD_LIGHT, LOAD_HEAVY } from "../src/sessionLoad.js";
import { recommendSessions } from "../src/recommender.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
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
  // Forme multi-zones : la pire pilote, le libellé les liste toutes dans l'ordre doigts/poignets/coudes.
  assert.deepEqual(sessionGenes({ gene: { coudes: 3, doigts: 5 } }), [{ zone: "doigts", pain: 5 }, { zone: "coudes", pain: 3 }]);
  assert.deepEqual(sessionGene({ gene: { coudes: 3, doigts: 5 } }), { zone: "doigts", pain: 5 });
  assert.equal(geneLabel({ gene: { coudes: 3, doigts: 5 } }), "gêne doigts 5/10 · coudes 3/10");
  assert.equal(sessionGenes({ gene: { coudes: 0 } }), null);
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
  const c = buildCoachPrompt({ ...empty, training: [{ date: d(1), type: "Escalade", duration: 60, rpe: 7, gene: { doigts: 4, coudes: 2 } }] }, "").user;
  assert.ok(c.includes('"gene":"doigts 4/10, coudes 2/10"'));
  assert.ok(!a.includes("blocs") && !a.includes("cotation"));
});
