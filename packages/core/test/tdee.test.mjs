// Zone de recomposition et fenêtres TDEE (tdee.js / targets.js) — porté de r2-test.mjs.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { recompZone, recompReading } from "../src/tdee.js";
import { recompWindows, DEFAULT_TARGETS } from "../src/targets.js";
import { fixClock, d } from "./_helpers.mjs";

before(() => fixClock());
const z = (x) => recompZone(x)?.zone;

test("recompZone : bornes exactes du barème (≤0 surplus · <100 sous · 100-300 visée · 300-500 haut · >500 trop)", () => {
  assert.ok(z(-50) === "surplus" && z(0) === "surplus");
  assert.ok(z(1) === "sous" && z(99) === "sous");
  assert.ok(z(100) === "visee" && z(200) === "visee" && z(300) === "visee");
  assert.ok(z(301) === "haut" && z(500) === "haut");
  assert.ok(z(501) === "trop" && z(900) === "trop");
});

test("recompZone/recompReading : null sans chiffre ; déficit = dépense − apports loggés", () => {
  assert.equal(recompZone(null), null);
  assert.equal(recompReading({ status: "insufficient" }), null);
  assert.equal(recompReading({ status: "ok", tdee: 2800, meanIntake: 2590 }).deficit, 210);
});

test("recompWindows : 14 et 21 j calculés sur 30 j synthétiques, lecture cohérente", () => {
  const weight = Array.from({ length: 30 }, (_, i) => ({ date: d(i), kg: 94 + i * 0.043 }));
  const macros = Array.from({ length: 30 }, (_, i) => ({ date: d(i), protein: 200, carbs: 260, fat: 80, fiber: 35, kcal: 2500 }));
  const rw = recompWindows({ foodLog: [], overrides: {}, macros, weight, targets: DEFAULT_TARGETS });
  assert.equal(rw.j14.status, "ok");
  assert.equal(rw.j21.status, "ok");
  assert.equal(rw.j14.reading.deficit, rw.j14.tdee - rw.j14.meanIntake);
  assert.ok(["visee", "haut"].includes(rw.j14.reading.zone), `${rw.j14.reading.zone} (${rw.j14.reading.deficit})`);
  // Dates sans `foodLog` (historique antérieur au module Repas) : repli 4/4/9 sur les macros de
  // `macroLog` (200×4 + 260×4 + 80×9 = 2560), le champ `kcal` n'y est pas lu — comportement V7.
  assert.equal(rw.j14.meanIntake, 2560);
  assert.equal(rw.j21.meanIntake, 2560);
});
