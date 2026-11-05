// Moteur de séance (G4-C1, 05/11/2026) : la logique du carnet sortie de MuscuLogger.jsx.
// Données synthétiques, horloge figée.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  buildExercises, makeAddedExercise, updateSet, toggleSet, addSet, removeLastSet, lastRemovable, setRir,
  appendExercise, removeExercise, substitutionCandidates, substituteExercise, nextAfter, currentSet,
  doneExercises, sessionRecord,
} from "../src/session/engine.js";
import { TEMPLATES, hsrForWeek, hsrParse, exoSeriesCount, DEFAULT_WEIGHTS } from "../src/session/templates.js";
import { catalogEntry } from "../src/session/exoCatalog.js";
import { fixClock, d } from "./_helpers.mjs";

before(() => fixClock());

const S = (poids, val, fait = true, leg = null) => ({ poids, val, fait, leg });
const history = [
  { date: d(10), type: "Lower B", exercices: [{ nom: "Leg extension unilatérale", mode: "reps", perLeg: true, series: [S(20, 10, true, "G"), S(21, 9, true, "D")] }] },
  { date: d(7), type: "Upper A", exercices: [
    { nom: "Développé incliné haltères", mode: "reps", series: [S(30, 9), S(30, 8), S(28, 8)] },
    { nom: "Rowing poulie basse", mode: "reps", origine: "Rowing barre ou machine", rir: 1, series: [S(50, 10)] },
    { nom: "Core — Crunch machine", mode: "reps", series: [S(40, 12)] },
  ] },
  { date: d(3), type: "Lower C", exercices: [{ nom: "Presse à cuisses (HSR)", mode: "reps", series: [S(140, 6), S(140, 6)] }] },
];

test("construction : prérempli série par série, poids par défaut, HSR et superset", () => {
  const up = buildExercises({ type: "Upper A", training: history, hsrWeek: 9 });
  assert.equal(up.length, TEMPLATES["Upper A"].exos.length);
  // Les séries de la dernière fois, dans l'ordre ; au-delà, la dernière perf et la médiane.
  assert.deepEqual(up[0].series.slice(0, 3).map((s) => [s.poids, s.val, s.fait]), [[30, 9, false], [30, 8, false], [28, 8, false]]);
  const tirage = up.find((e) => e.nom === "Tirage vertical prise neutre");
  assert.equal(tirage.series[0].poids, DEFAULT_WEIGHTS["Tirage vertical prise neutre"]);
  assert.equal(tirage.series[0].val, 9); // médiane de 8-10
  const lc = buildExercises({ type: "Lower C", training: history, hsrWeek: 9 });
  const presse = lc.find((e) => e.nom === "Presse à cuisses (HSR)");
  const hp = hsrParse(hsrForWeek(9).scheme);
  assert.equal(presse.target, `${hp.reps}`);
  assert.equal(presse.scheme, hsrForWeek(9).scheme);
  // Une série sans précédent reprend la dernière perf.
  assert.deepEqual(presse.series.map((s) => s.poids), Array(presse.series.length).fill(140));
  const mollets = lc.find((e) => e.nom === "Mollets à la presse");
  const tpl = TEMPLATES["Lower C"];
  assert.equal(mollets.series.length, exoSeriesCount(tpl, tpl.exos.find((x) => x.n === "Mollets à la presse"), 9));
  assert.equal(mollets.series.length, presse.series.length); // superset
});

test("réouverture : séries réelles, substitution retrouvée par origine, ajout remis à la fin, jambe par jambe", () => {
  const exos = buildExercises({ type: "Upper A", training: history, hsrWeek: 9, initial: history[1] });
  const row = exos.find((e) => e.nom === "Rowing poulie basse");
  assert.equal(row.origine, "Rowing barre ou machine");
  assert.equal(row.rir, 1);
  assert.deepEqual(row.series, [S(50, 10)]);
  assert.equal(exos.at(-1).nom, "Core — Crunch machine");
  assert.equal(exos.at(-1).added, true);
  const lb = buildExercises({ type: "Lower B", training: history, hsrWeek: 9, initial: history[0] });
  const le = lb.find((e) => e.nom === "Leg extension unilatérale");
  assert.equal(le.perLeg, true);
  assert.deepEqual(le.series.map((s) => s.leg), ["G", "D"]);
});

test("opérations : saisie, coche, + série, − série jamais sur une série faite, RIR", () => {
  let exos = buildExercises({ type: "Upper A", training: history, hsrWeek: 9 });
  const first = exos;
  const snapshot = JSON.stringify(first);
  exos = updateSet(exos, 0, 0, "val", "10");
  exos = toggleSet(exos, 0, 0);
  assert.equal(JSON.stringify(first), snapshot, "rien n'est modifié en place");
  assert.deepEqual(exos[0].series[0], { poids: 30, val: "10", fait: true, leg: null });
  const n0 = exos[0].series.length;
  const lastOne = exos[0].series.at(-1);
  exos = addSet(exos, 0, null);
  assert.deepEqual(exos[0].series.at(-1), { ...lastOne, fait: false });
  exos = removeLastSet(exos, 0, null);
  assert.equal(exos[0].series.length, n0);
  for (let j = 1; j < n0; j++) exos = toggleSet(exos, 0, j);
  assert.equal(lastRemovable(exos[0], null), -1);
  assert.equal(removeLastSet(exos, 0, null)[0].series.length, n0, "une série faite n'est jamais retirée");
  exos = setRir(exos, 0, 2);
  assert.equal(exos[0].rir, 2);
  assert.equal(setRir(exos, 0, 2)[0].rir, null);
  assert.equal(doneExercises(exos), 1);
});

test("remplacement : candidats de la même famille, retour à l'original", () => {
  let exos = buildExercises({ type: "Upper A", training: history, hsrWeek: 9 });
  const ri = exos.findIndex((e) => e.nom === "Rowing barre ou machine");
  const cands = substitutionCandidates(exos[ri], TEMPLATES["Upper A"]);
  assert.ok(cands.some((c) => c.n === "Rowing poulie basse"));
  exos = substituteExercise(exos, ri, cands.find((c) => c.n === "Rowing poulie basse"), { training: history });
  assert.equal(exos[ri].nom, "Rowing poulie basse");
  assert.equal(exos[ri].origine, "Rowing barre ou machine");
  assert.equal(exos[ri].series[0].poids, 50);
  assert.equal(exos[ri].rest, TEMPLATES["Upper A"].exos.find((x) => x.n === "Rowing barre ou machine").rest);
  const back = substitutionCandidates(exos[ri], TEMPLATES["Upper A"]).find((c) => c.isOriginal);
  exos = substituteExercise(exos, ri, back, { training: history });
  assert.equal(exos[ri].nom, "Rowing barre ou machine");
  assert.equal(exos[ri].origine, undefined);
});

test("ajout et retrait d'un exercice", () => {
  let exos = buildExercises({ type: "Mobilité", training: [], hsrWeek: 9 });
  const n = exos.length;
  exos = appendExercise(exos, makeAddedExercise(catalogEntry("Hip thrust"), { training: [], hsrWeek: 9 }));
  assert.equal(exos.at(-1).added, true);
  assert.equal(exos.at(-1).opt, false);
  assert.equal(removeExercise(exos, n).length, n);
});

test("où en est la séance : série suivante, exercice suivant, série en cours", () => {
  let exos = buildExercises({ type: "Upper A", training: history, hsrWeek: 9 });
  assert.deepEqual(currentSet(exos), { ei: 0, si: 0, nom: "Développé incliné haltères", n: 1, leg: null });
  exos = toggleSet(exos, 0, 0);
  assert.deepEqual(nextAfter(exos, 0, 1), { kind: "set", nom: "Développé incliné haltères", n: 3, leg: null });
  assert.equal(currentSet(exos).si, 1);
  for (let j = 1; j < exos[0].series.length; j++) exos = toggleSet(exos, 0, j);
  assert.equal(currentSet(exos).ei, 1);
  assert.deepEqual(nextAfter(exos, 0, -1), { kind: "exercise", nom: exos[1].nom });
  // « Toujours dans l'ordre » (choix de Yoann) : un exercice plus loin commencé ne change rien…
  const ahead = toggleSet(exos, 3, 0);
  assert.equal(currentSet(ahead).ei, 1);
  // … sauf s'il est nommé (« passe au… ») tant qu'il lui reste une série.
  assert.deepEqual(currentSet(ahead, { ei: 3 }), { ei: 3, si: 1, nom: exos[3].nom, n: 2, leg: null });
  assert.equal(currentSet(exos, { ei: 0 }).ei, 1, "exercice nommé déjà fini → ordre de la liste");
  // Mobilité : exercices en option sautés tant qu'ils ne sont pas commencés.
  const mob = buildExercises({ type: "Mobilité", training: [], hsrWeek: 9 });
  const firstReq = mob.findIndex((e) => !e.opt);
  assert.equal(currentSet(mob)?.ei ?? -1, firstReq);
});

test("ligne enregistrée : séries vides retirées, RIR et origine si présents, durée et RPE pour Basket", () => {
  let exos = buildExercises({ type: "Basket", training: [], hsrWeek: 9 });
  exos = updateSet(updateSet(exos, 0, 0, "poids", ""), 0, 0, "val", "");
  exos = toggleSet(exos, 1, 0);
  const rec = sessionRecord({ id: "x", date: "2026-10-04", type: "Basket", start: "19:00", duration: "45", rpe: "6", exos });
  assert.equal(rec.duration, 45);
  assert.equal(rec.rpe, 6);
  const kept = exos[0].series.filter((s) => s.poids !== "" || s.val !== "" || s.fait).length;
  const first = rec.exercices.find((e) => e.nom === exos[0].nom);
  assert.equal(first?.series.length ?? 0, kept, "série vide retirée, exercice vide retiré");
  assert.ok(rec.exercices.find((e) => e.nom === exos[1].nom).series[0].fait);
  const up = sessionRecord({ id: "y", date: "2026-10-04", type: "Upper A", start: "07:00", duration: 60, rpe: 7, exos: setRir(buildExercises({ type: "Upper A", training: history, hsrWeek: 9 }), 0, 2) });
  assert.equal(up.duration, undefined);
  assert.equal(up.exercices[0].rir, 2);
  assert.equal("rir" in up.exercices[1], false);
  assert.deepEqual(Object.keys(up.exercices[0]), ["nom", "mode", "perLeg", "origine", "rir", "series"]);
});
