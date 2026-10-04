// Gabarits de séance (templates.js) — porté de fb-test.mjs (04/10/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, TYPES } from "../src/session/templates.js";

const maxRep = (r) => Math.max(...String(r).match(/\d+/g).map(Number));

test("Upper A/B et Lower B : plus aucune série au-delà de 12 reps (hors temps/HSR)", () => {
  for (const t of ["Upper A", "Upper B", "Lower B"])
    for (const e of TEMPLATES[t].exos)
      if (e.mode === "reps" && e.r !== "table HSR") assert.ok(maxRep(e.r) <= 12, `${t} · ${e.n} ${e.r}`);
});

test("Upper : 8 exercices chacun, développés 8-10, dos 4 séries, curls poignets 2 séries", () => {
  assert.equal(TEMPLATES["Upper A"].exos.length, 8);
  assert.equal(TEMPLATES["Upper B"].exos.length, 8);
  assert.equal(TEMPLATES["Upper A"].exos.find((e) => e.n === "Développé incliné haltères").r, "8-10");
  assert.equal(TEMPLATES["Upper A"].exos.find((e) => e.n === "Rowing barre ou machine").s, 4);
  assert.equal(TEMPLATES["Upper A"].exos.find((e) => e.n.startsWith("Curl poignets")).s, 2);
});

test("Full Body : existe, HSR, tag genou, contenu et ordre figés", () => {
  const FB = TEMPLATES["Full Body"];
  assert.ok(TYPES.includes("Full Body"));
  assert.ok(FB.hsr && FB.chargeTags.includes("genou"));
  assert.equal(FB.exos.map((e) => e.n).join("|"),
    "Presse à cuisses (HSR)|Mollets à la presse|Leg extension unilatérale|Soulevé de terre roumain|Hip thrust|Développé incliné haltères|Rowing barre ou machine|Élévations latérales haltères");
});

test("Mobilité : aucune charge (chargeTags vide, pas de flag genou/escalade), tout optionnel", () => {
  const M = TEMPLATES["Mobilité"];
  assert.deepEqual(M.chargeTags, []);
  assert.ok(!M.knee && !M.climb);
  assert.ok(M.exos.every((e) => e.opt));
});
