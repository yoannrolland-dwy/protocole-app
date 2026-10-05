// Gabarits de séance (templates.js) — porté de fb-test.mjs (04/10/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, TYPES, DEFAULT_WEIGHTS } from "../src/session/templates.js";

const maxRep = (r) => Math.max(...String(r).match(/\d+/g).map(Number));

test("Upper A/B et Lower B : plus aucune série au-delà de 12 reps (hors temps/HSR)", () => {
  for (const t of ["Upper A", "Upper B", "Lower B"])
    for (const e of TEMPLATES[t].exos)
      if (e.mode === "reps" && e.r !== "table HSR") assert.ok(maxRep(e.r) <= 12, `${t} · ${e.n} ${e.r}`);
});

test("Upper A/B après la spécialisation du 05/10/2026 : 9 exercices chacun, volumes et repos attendus", () => {
  const A = Object.fromEntries(TEMPLATES["Upper A"].exos.map((e) => [e.n, e]));
  const B = Object.fromEntries(TEMPLATES["Upper B"].exos.map((e) => [e.n, e]));
  assert.equal(TEMPLATES["Upper A"].exos.length, 9);
  assert.equal(TEMPLATES["Upper B"].exos.length, 9);
  assert.equal(TEMPLATES["Upper A"].exos.map((e) => e.n).join("|"),
    "Développé incliné haltères|Tirage vertical prise neutre|Rowing barre ou machine|Écarté poulie basse|Extension triceps poulie haute|Élévations latérales haltères|Face pull|Curl poignets pronation|Core — Planche");
  assert.equal(TEMPLATES["Upper B"].exos.map((e) => e.n).join("|"),
    "Développé couché haltères|Tirage vertical prise neutre|Développé militaire haltères|Écarté poulie basse|Élévations latérales poulie|Rear delt machine (reverse pec deck)|Curl marteau (prise neutre)|Curl poignets supination|Core — Crunch machine");
  assert.deepEqual([A["Tirage vertical prise neutre"].s, A["Rowing barre ou machine"].s, A["Élévations latérales haltères"].s, A["Élévations latérales haltères"].rest, A["Face pull"].s, A["Core — Planche"].s, A["Extension triceps poulie haute"].rest], [3, 3, 5, 60, 2, 2, 75]);
  assert.deepEqual([B["Développé militaire haltères"].s, B["Écarté poulie basse"].s, B["Élévations latérales poulie"].s, B["Élévations latérales poulie"].rest, B["Rear delt machine (reverse pec deck)"].s, B["Core — Crunch machine"].s], [2, 2, 5, 60, 2, 2]);
  // inchangés : développés, rééduc coude, curls poignets (poignet)
  assert.deepEqual([A["Développé incliné haltères"].s, A["Développé incliné haltères"].r, B["Tirage vertical prise neutre"].s, B["Curl marteau (prise neutre)"].s, A["Curl poignets pronation"].s, A["Curl poignets pronation"].r, B["Curl poignets supination"].s], [4, "8-10", 4, 3, 2, "10-12", 2]);
  assert.equal(DEFAULT_WEIGHTS["Tirage vertical prise neutre"], 85);
  assert.equal(DEFAULT_WEIGHTS["Écarté poulie basse"], 10);
});

test("volume hebdo Upper A + Upper B : épaules latérales 10, tirage vertical 7, haut des pecs 9, haut du dos 7", () => {
  const all = [...TEMPLATES["Upper A"].exos, ...TEMPLATES["Upper B"].exos];
  const sum = (names) => all.filter((e) => names.includes(e.n)).reduce((a, e) => a + e.s, 0);
  assert.equal(sum(["Élévations latérales haltères", "Élévations latérales poulie"]), 10);
  assert.equal(sum(["Tirage vertical prise neutre"]), 7);
  assert.equal(sum(["Développé incliné haltères", "Écarté poulie basse"]), 9);
  assert.equal(sum(["Rowing barre ou machine", "Face pull", "Rear delt machine (reverse pec deck)"]), 7);
});

test("Full Body : existe, HSR, tag genou, contenu et ordre figés", () => {
  const FB = TEMPLATES["Full Body"];
  assert.ok(TYPES.includes("Full Body"));
  assert.ok(FB.hsr && FB.chargeTags.includes("genou"));
  assert.equal(FB.exos.map((e) => e.n).join("|"),
    "Presse à cuisses (HSR)|Mollets à la presse|Leg extension unilatérale|Soulevé de terre roumain|Hip thrust|Développé incliné haltères|Tirage vertical prise neutre|Élévations latérales haltères");
  assert.equal(FB.exos.find((e) => e.n === "Élévations latérales haltères").s, 4);
});

test("Mobilité : aucune charge (chargeTags vide, pas de flag genou/escalade), tout optionnel", () => {
  const M = TEMPLATES["Mobilité"];
  assert.deepEqual(M.chargeTags, []);
  assert.ok(!M.knee && !M.climb);
  assert.ok(M.exos.every((e) => e.opt));
});
