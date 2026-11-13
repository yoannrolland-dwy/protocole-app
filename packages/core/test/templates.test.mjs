// Gabarits de séance (templates.js) — porté de fb-test.mjs (04/10/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, MOBILITY_ZONES, TYPES, DEFAULT_WEIGHTS } from "../src/session/templates.js";
import { catalogEntry } from "../src/session/exoCatalog.js";
import { metaFor } from "../src/session/exoMeta.js";

const maxRep = (r) => Math.max(...String(r).match(/\d+/g).map(Number));

test("Upper A/B et Lower B : plus aucune série au-delà de 12 reps (hors temps/HSR)", () => {
  for (const t of ["Upper A", "Upper B", "Lower B"])
    for (const e of TEMPLATES[t].exos)
      if (e.mode === "reps" && e.r !== "table HSR") assert.ok(maxRep(e.r) <= 12, `${t} · ${e.n} ${e.r}`);
});

test("Upper A/B après la spécialisation du 05/10 et le déménagement du core (07/10), épaules 3+2 (08/10), sans curls poignets (13/11) : 8 exercices chacun", () => {
  const A = Object.fromEntries(TEMPLATES["Upper A"].exos.map((e) => [e.n, e]));
  const B = Object.fromEntries(TEMPLATES["Upper B"].exos.map((e) => [e.n, e]));
  // 13/11/2026 : curls poignets retirés (douleur aux poignets), 8 exercices chacun.
  assert.equal(TEMPLATES["Upper A"].exos.length, 8);
  assert.equal(TEMPLATES["Upper B"].exos.length, 8);
  assert.equal(TEMPLATES["Upper A"].exos.map((e) => e.n).join("|"),
    "Développé incliné haltères|Tirage vertical prise neutre|Rowing barre ou machine|Écarté poulie basse|Élévations latérales poulie|Extension triceps poulie haute|Face pull|Élévations latérales haltères");
  assert.equal(TEMPLATES["Upper B"].exos.map((e) => e.n).join("|"),
    "Développé couché haltères|Développé militaire haltères|Tirage vertical prise neutre|Écarté poulie basse|Élévations latérales poulie|Rear delt machine (reverse pec deck)|Élévations latérales haltères|Curl marteau (prise neutre)");
  assert.deepEqual([A["Tirage vertical prise neutre"].s, A["Rowing barre ou machine"].s, A["Élévations latérales haltères"].s, A["Élévations latérales poulie"].s, A["Élévations latérales haltères"].rest, A["Face pull"].s, A["Extension triceps poulie haute"].rest], [3, 3, 3, 2, 60, 2, 75]);
  assert.deepEqual([B["Développé militaire haltères"].s, B["Écarté poulie basse"].s, B["Élévations latérales poulie"].s, B["Élévations latérales haltères"].s, B["Élévations latérales poulie"].rest, B["Rear delt machine (reverse pec deck)"].s], [2, 2, 3, 2, 60, 2]);
  // inchangés : développés, rééduc coude
  assert.deepEqual([A["Développé incliné haltères"].s, A["Développé incliné haltères"].r, B["Tirage vertical prise neutre"].s, B["Curl marteau (prise neutre)"].s], [4, "8-10", 4, 3]);
  // Curls poignets : plus prescrits nulle part, mais gardés (nom, historique, « Ajouter un exercice »).
  for (const t of Object.keys(TEMPLATES)) assert.ok(!TEMPLATES[t].exos.some((e) => /Curl poignets/.test(e.n)), t);
  for (const n of ["Curl poignets pronation", "Curl poignets supination"]) {
    assert.deepEqual([catalogEntry(n).groupe, catalogEntry(n).ex.s, catalogEntry(n).ex.r, catalogEntry(n).type], ["avant-bras", 2, "10-12", null]);
    assert.equal(metaFor(n).groupe, "avant-bras");
    assert.ok(DEFAULT_WEIGHTS[n] > 0);
  }
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
    "Squat sur sécurités|Mollets debout à la barre|Soulevé de terre roumain|Hip thrust|Leg extension unilatérale|Développé incliné haltères|Tirage vertical prise neutre|Élévations latérales haltères");
  assert.equal(FB.exos.find((e) => e.n === "Élévations latérales haltères").s, 4);
});

test("Mobilité (13/11/2026) : 18 exercices rangés par zone, aucune charge, mise en garde genou sur trois mouvements", () => {
  const M = TEMPLATES["Mobilité"];
  assert.deepEqual(M.chargeTags, []);
  assert.ok(!M.knee && !M.climb);
  assert.deepEqual(M.exos.map((e) => e.n), [
    "Iso leg extension unilatérale @60° (genou)",
    "Chat-vache", "Rotation thoracique à quatre pattes",
    "Bascule vers les talons", "Fente basse (ouverture de hanche)", "Hanche 90/90 avec transitions",
    "Essuie-glaces de hanches", "Pont fessier", "Squat profond assisté",
    "Levée de jambe tendue, allongé", "Charnière de hanche",
    "Grands cercles de bras", "Anges au mur", "Rotation externe épaule poulie basse",
    "Cheville : genou au mur",
    "Iso flexion coude prise marteau + supination",
    "Core — Crunch machine", "Core — Planche",
  ]);
  // Zones : chacune a un libellé, et une zone n'apparaît qu'en un seul bloc (pas d'aller-retour).
  const zones = M.exos.map((e) => e.zone);
  for (const z of zones) assert.ok(MOBILITY_ZONES[z], `zone sans libellé : ${z}`);
  const blocs = zones.filter((z, i) => z !== zones[i - 1]);
  assert.deepEqual(blocs, ["genou", "colonne", "hanches", "ischios", "epaules", "chevilles", "coude", "abdos"]);
  // Les quatre exercices déjà en option le restent ; aucun des onze nouveaux ne l'est (choix de Yoann).
  assert.deepEqual(M.exos.filter((e) => e.opt).map((e) => e.n), ["Hanche 90/90 avec transitions",
    "Rotation externe épaule poulie basse", "Cheville : genou au mur", "Iso flexion coude prise marteau + supination"]);
  assert.equal(M.exos.find((e) => e.n.startsWith("Iso leg")).s, 3);
  assert.equal(M.exos.find((e) => e.n === "Rotation externe épaule poulie basse").groupe, "coiffe", "jamais compté dans le volume prioritaire épaules");
  // Mise en garde : seulement les trois mouvements en flexion profonde du genou.
  assert.deepEqual(M.exos.filter((e) => e.alerte).map((e) => e.n),
    ["Bascule vers les talons", "Fente basse (ouverture de hanche)", "Squat profond assisté"]);
  for (const e of M.exos.filter((x) => x.alerte)) assert.match(e.alerte, /3\/10.*24 h.*kiné/);
  // Les onze nouveaux : groupe « mobilite », donc hors volume et hors suggestions de surcharge.
  const anciens = new Set(["Iso leg extension unilatérale @60° (genou)", "Hanche 90/90 avec transitions", "Cheville : genou au mur",
    "Rotation externe épaule poulie basse", "Iso flexion coude prise marteau + supination", "Core — Crunch machine", "Core — Planche"]);
  const nouveaux = M.exos.filter((e) => !anciens.has(e.n));
  assert.equal(nouveaux.length, 11);
  for (const e of nouveaux) assert.equal(e.groupe, "mobilite", e.n);
});

test("core retiré des gabarits de muscu : plus aucune planche ni crunch hors Mobilité", () => {
  for (const t of ["Upper A", "Upper B", "Lower A", "Lower B", "Lower C", "Full Body"])
    assert.ok(!TEMPLATES[t].exos.some((e) => e.n.startsWith("Core — ")), `${t} contient encore du core`);
});

test("ordre des exercices (10/10/2026) : composés lourds d'abord, isolations ensuite, mollets collés à la presse, leg extension après le soulevé de terre", () => {
  const order = (t) => TEMPLATES[t].exos.map((e) => e.n);
  assert.deepEqual(order("Lower A"), ["Iso leg extension @60° (si genou raide)", "Squat sur sécurités", "Mollets debout à la barre", "Soulevé de terre roumain", "Leg extension unilatérale"]);
  assert.deepEqual(order("Lower B"), ["Squat sur sécurités", "Mollets debout à la barre", "Hip thrust", "Leg extension unilatérale", "Leg curl unilatéral"]);
  assert.deepEqual(order("Lower C"), ["Iso leg extension @60° (si genou raide)", "Squat sur sécurités", "Mollets debout à la barre", "Soulevé de terre roumain", "Hip thrust", "Leg extension unilatérale"]);
  for (const t of ["Lower A", "Lower B", "Lower C", "Full Body"]) {
    const o = order(t), i = o.indexOf("Squat sur sécurités");
    assert.ok(i >= 0, `${t} : squat sur sécurités`);
    assert.equal(o[i + 1], "Mollets debout à la barre", `${t} : mollets juste après le squat (superset)`);
    const le = o.indexOf("Leg extension unilatérale");
    for (const hinge of ["Soulevé de terre roumain", "Hip thrust"]) if (o.includes(hinge)) assert.ok(o.indexOf(hinge) < le, `${t} : ${hinge} avant leg extension`);
  }
  // L'iso genou (échauffement antalgique) reste en tout premier quand elle existe.
  for (const t of ["Lower A", "Lower C"]) assert.ok(order(t)[0].startsWith("Iso leg extension"));
  // Upper A : élévations (épaules prioritaires) avant le triceps.
  const a = order("Upper A");
  assert.ok(a.indexOf("Élévations latérales poulie") < a.indexOf("Extension triceps poulie haute"));
});
