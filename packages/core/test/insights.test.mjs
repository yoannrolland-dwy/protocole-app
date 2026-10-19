// Constats gratuits (insights.js) — « type délaissé » restreint à escalade / basket / mobilité (05/10/2026).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mostNeglectedType } from "../src/insights.js";
import { fixClock, T0, d, session } from "./_helpers.mjs";

before(() => fixClock());

test("un Upper/Lower/Full Body jamais fait n'est plus signalé : seuls escalade, basket et mobilité comptent", () => {
  const training = [session(d(1), "Escalade"), session(d(2), "Basket"), session(d(3), "Mobilité")];
  assert.equal(mostNeglectedType(training, T0), null, "Upper/Lower absents du journal mais pas signalés");
});

test("escalade pas faite depuis 20 j → signalée ; jamais loggée → prioritaire", () => {
  const r = mostNeglectedType([session(d(20), "Escalade"), session(d(1), "Basket"), session(d(1), "Mobilité")], T0);
  assert.equal(r.type, "Escalade");
  assert.equal(r.daysSince, 20);
  const r2 = mostNeglectedType([session(d(1), "Basket"), session(d(1), "Mobilité"), session(d(30), "Upper A")], T0);
  assert.equal(r2.type, "Escalade");
  assert.equal(r2.daysSince, null, "jamais loggée");
});

test("mobilité (récupération active) est bien surveillée ; sous 14 j rien à signaler", () => {
  assert.equal(mostNeglectedType([session(d(1), "Escalade"), session(d(1), "Basket"), session(d(16), "Mobilité")], T0).type, "Mobilité");
  assert.equal(mostNeglectedType([session(d(5), "Escalade"), session(d(6), "Basket"), session(d(7), "Mobilité")], T0), null);
});

import { activePlateaus, priorityVolumeShortfall, computeStreaks } from "../src/insights.js";

test("plateau : un exercice sauté pendant des semaines ne fait pas avancer le compteur (séances consécutives de CET exercice)", () => {
  const plateau = [60, 40, 20, 0].map(stableSess); // 4 séances espacées de 20 j
  const r = activePlateaus(plateau, [], T0);
  assert.equal(r[0].sessions, 4);
});

test("streak d'entraînement (19/10/2026) : une journée de Mobilité seule est un jour de repos, elle ne prolonge pas le streak", () => {
  const s = computeStreaks([session(d(1), "Upper A"), session(d(2), "Lower A"), session(T0, "Mobilité")], [], T0);
  assert.equal(s.training, 2, "Upper hier + Lower avant-hier ; la Mobilité d'aujourd'hui ne compte pas");
  const onlyMob = computeStreaks([session(T0, "Mobilité"), session(d(1), "Mobilité")], [], T0);
  assert.equal(onlyMob.training, 0);
  const both = computeStreaks([session(T0, "Mobilité"), session(T0, "Upper A")], [], T0);
  assert.equal(both.training, 1, "Mobilité + vraie séance le même jour = jour d'entraînement");
});
import { kneeRed } from "./_helpers.mjs";
const NOM = "Développé incliné haltères";
const stableSess = (daysAgo) => ({ date: d(daysAgo), type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: [{ poids: 30, val: 8, fait: true }] }] });

test("plateaux en cours : listés avec leur durée ; null sans plateau ; masqués si genou hors base", () => {
  const plateau = [25, 20, 15, 10, 5, 0].map(stableSess);
  const r = activePlateaus(plateau, [], T0);
  assert.equal(r.length, 1);
  assert.equal(r[0].nom, NOM);
  assert.equal(r[0].weeks, 4);
  assert.equal(r[0].sessions, 6, "durée affichée en séances consécutives (19/10/2026), pas en semaines");
  assert.equal(activePlateaus([stableSess(5), { date: T0, type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: [{ poids: 32, val: 8, fait: true }] }] }], [], T0), null, "progression → pas de plateau");
  assert.equal(activePlateaus(plateau, kneeRed(), T0), null, "genou hors base → rien");
});

test("volume prioritaire sous la zone : seulement ven/sam/dim, groupes prioritaires sous 10 séries", () => {
  const sets = (n) => Array.from({ length: n }, () => ({ poids: 30, val: 10, fait: true }));
  const training = [{ date: T0, type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: sets(6) }, { nom: "Élévations latérales haltères", mode: "reps", series: sets(12) }] }];
  const sunday = priorityVolumeShortfall(training, T0); // 04/10/2026 = dimanche
  assert.deepEqual(sunday.map((g) => [g.groupe, g.series]), [["pecs", 6]]);
  assert.equal(priorityVolumeShortfall(training, "2026-10-06"), null, "mardi : pas encore le moment");
  const full = [{ date: T0, type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: sets(12) }, { nom: "Élévations latérales haltères", mode: "reps", series: sets(12) }] }];
  assert.equal(priorityVolumeShortfall(full, T0), null, "tout dans la zone");
});
