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

test("Upper A/B après la spécialisation du 05/10 et le déménagement du core (07/10), épaules 3+2 (08/10) : 9 exercices chacun", () => {
  const A = Object.fromEntries(TEMPLATES["Upper A"].exos.map((e) => [e.n, e]));
  const B = Object.fromEntries(TEMPLATES["Upper B"].exos.map((e) => [e.n, e]));
  assert.equal(TEMPLATES["Upper A"].exos.length, 9);
  assert.equal(TEMPLATES["Upper B"].exos.length, 9);
  assert.equal(TEMPLATES["Upper A"].exos.map((e) => e.n).join("|"),
    "Développé incliné haltères|Tirage vertical prise neutre|Rowing barre ou machine|Écarté poulie basse|Élévations latérales poulie|Extension triceps poulie haute|Face pull|Élévations latérales haltères|Curl poignets pronation");
  assert.equal(TEMPLATES["Upper B"].exos.map((e) => e.n).join("|"),
    "Développé couché haltères|Développé militaire haltères|Tirage vertical prise neutre|Écarté poulie basse|Élévations latérales poulie|Rear delt machine (reverse pec deck)|Élévations latérales haltères|Curl marteau (prise neutre)|Curl poignets supination");
  assert.deepEqual([A["Tirage vertical prise neutre"].s, A["Rowing barre ou machine"].s, A["Élévations latérales haltères"].s, A["Élévations latérales poulie"].s, A["Élévations latérales haltères"].rest, A["Face pull"].s, A["Extension triceps poulie haute"].rest], [3, 3, 3, 2, 60, 2, 75]);
  assert.deepEqual([B["Développé militaire haltères"].s, B["Écarté poulie basse"].s, B["Élévations latérales poulie"].s, B["Élévations latérales haltères"].s, B["Élévations latérales poulie"].rest, B["Rear delt machine (reverse pec deck)"].s], [2, 2, 3, 2, 60, 2]);
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
    "Presse à cuisses (HSR)|Mollets à la presse|Soulevé de terre roumain|Hip thrust|Leg extension unilatérale|Développé incliné haltères|Tirage vertical prise neutre|Élévations latérales haltères");
  assert.equal(FB.exos.find((e) => e.n === "Élévations latérales haltères").s, 4);
});

test("Mobilité (07/10/2026) : aucune charge, core déménagé ici, iso genou + planche + crunch non optionnels", () => {
  const M = TEMPLATES["Mobilité"];
  assert.deepEqual(M.chargeTags, []);
  assert.ok(!M.knee && !M.climb);
  assert.equal(M.exos.map((e) => e.n).join("|"),
    "Iso leg extension unilatérale @60° (genou)|Hanche 90/90 avec transitions|Cheville : genou au mur|Rotation externe épaule poulie basse|Core — Planche|Core — Crunch machine|Iso flexion coude prise marteau + supination");
  assert.deepEqual(M.exos.filter((e) => !e.opt).map((e) => e.n), ["Iso leg extension unilatérale @60° (genou)", "Core — Planche", "Core — Crunch machine"]);
  assert.equal(M.exos.find((e) => e.n.startsWith("Iso leg")).s, 3);
  assert.equal(M.exos.find((e) => e.n === "Rotation externe épaule poulie basse").groupe, "coiffe", "jamais compté dans le volume prioritaire épaules");
});

test("core retiré des gabarits de muscu : plus aucune planche ni crunch hors Mobilité", () => {
  for (const t of ["Upper A", "Upper B", "Lower A", "Lower B", "Lower C", "Full Body"])
    assert.ok(!TEMPLATES[t].exos.some((e) => e.n.startsWith("Core — ")), `${t} contient encore du core`);
});

test("ordre des exercices (10/10/2026) : composés lourds d'abord, isolations ensuite, mollets collés à la presse, leg extension après le soulevé de terre", () => {
  const order = (t) => TEMPLATES[t].exos.map((e) => e.n);
  assert.deepEqual(order("Lower A"), ["Iso leg extension @60° (si genou raide)", "Presse à cuisses (HSR)", "Mollets à la presse", "Soulevé de terre roumain", "Leg extension unilatérale"]);
  assert.deepEqual(order("Lower B"), ["Presse à cuisses", "Mollets à la presse", "Hip thrust", "Leg extension unilatérale", "Leg curl unilatéral"]);
  assert.deepEqual(order("Lower C"), ["Iso leg extension @60° (si genou raide)", "Presse à cuisses (HSR)", "Mollets à la presse", "Soulevé de terre roumain", "Hip thrust", "Leg extension unilatérale"]);
  for (const t of ["Lower A", "Lower B", "Lower C", "Full Body"]) {
    const o = order(t), i = o.findIndex((n) => n.startsWith("Presse"));
    assert.equal(o[i + 1], "Mollets à la presse", `${t} : mollets juste après la presse (superset)`);
    const le = o.indexOf("Leg extension unilatérale");
    for (const hinge of ["Soulevé de terre roumain", "Hip thrust"]) if (o.includes(hinge)) assert.ok(o.indexOf(hinge) < le, `${t} : ${hinge} avant leg extension`);
  }
  // L'iso genou (échauffement antalgique) reste en tout premier quand elle existe.
  for (const t of ["Lower A", "Lower C"]) assert.ok(order(t)[0].startsWith("Iso leg extension"));
  // Upper A : élévations (épaules prioritaires) avant le triceps.
  const a = order("Upper A");
  assert.ok(a.indexOf("Élévations latérales poulie") < a.indexOf("Extension triceps poulie haute"));
});
