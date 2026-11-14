// Score de force par groupe (14/11/2026) : 1RM estimé, base 100, brut et relatif au poids.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { e1rm, strengthGroup, strengthByGroup, weightAt } from "../src/strength.js";
import { fixClock, d, T0 } from "./_helpers.mjs";

before(() => fixClock());
const ex = (nom, sets, rir = 0, mode = "reps") => ({ nom, mode, rir, series: sets.map(([poids, val]) => ({ poids, val, fait: true })) });
const sess = (daysAgo, ...exos) => ({ date: d(daysAgo), type: "Upper A", exercices: exos });

test("1RM estimé : Epley sur reps + RIR, rien au-delà de 12, rien sans charge", () => {
  assert.equal(Math.round(e1rm(100, 10) * 10) / 10, 133.3);
  assert.equal(Math.round(e1rm(100, 8, 2) * 10) / 10, 133.3, "8 reps à 2 en réserve = 10 possibles");
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 12, 1), null);
  assert.equal(e1rm(0, 10), null);
});

test("groupes comptés : quadriceps, mobilité, coiffe et durées exclus", () => {
  assert.equal(strengthGroup("Développé incliné haltères"), "pecs");
  assert.equal(strengthGroup("Squat sur sécurités"), null);
  assert.equal(strengthGroup("Leg extension unilatérale"), null);
  assert.equal(strengthGroup("Rotation externe épaule poulie basse"), null);
  assert.equal(strengthGroup("Core — Planche"), null);
  assert.equal(strengthGroup("Exercice inconnu"), null);
});

test("indice : base 100 sur les 4 premières semaines, moyenne géométrique, relatif au poids^0,67", () => {
  const tr = [
    sess(60, ex("Développé incliné haltères", [[30, 10]]), ex("Développé couché haltères", [[30, 10]])),
    sess(5, ex("Développé incliné haltères", [[33, 10]]), ex("Développé couché haltères", [[30, 10]])),
  ];
  const w = [{ date: d(60), kg: 100 }, { date: d(2), kg: 90 }];
  const [pecs] = strengthByGroup(tr, w, { asOf: T0 });
  assert.equal(pecs.groupe, "pecs");
  assert.equal(pecs.index, Math.round(Math.sqrt(1.1) * 100), "+10 % et 0 % → racine de 1,1");
  assert.equal(pecs.rel, Math.round(Math.sqrt(1.1) * Math.pow(100 / 90, 0.67) * 100));
  assert.equal(pecs.exercices[0].nom, "Développé incliné haltères");
  assert.equal(pecs.exercices[0].pct, 10);
  assert.equal(pecs.exercices[0].materiel, "halteres");
});

test("un groupe sans séance depuis 4 semaines n'apparaît pas ; pas de poids = relatif absent", () => {
  const tr = [sess(60, ex("Curl marteau (prise neutre)", [[20, 10]]))];
  assert.deepEqual(strengthByGroup(tr, [], { asOf: T0 }), []);
  const [b] = strengthByGroup([sess(3, ex("Curl marteau (prise neutre)", [[20, 10]]))], [], { asOf: T0 });
  assert.equal(b.index, 100);
  assert.equal(b.rel, null);
});

test("poids : moyenne des 7 derniers jours, sinon la dernière pesée", () => {
  const w = [{ date: d(20), kg: 95 }, { date: d(3), kg: 92 }, { date: d(1), kg: 90 }];
  assert.equal(weightAt(w, T0), 91);
  assert.equal(weightAt(w, d(10)), 95);
  assert.equal(weightAt(w, d(30)), null);
});
