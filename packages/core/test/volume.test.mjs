// Volume hebdomadaire par groupe musculaire (volume.js) — chantier T2, 04/10/2026.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { weeklyVolumeByGroup, volumeForCoach, groupOf, zoneStatus, PRIORITY_GROUPS, VOLUME_TARGET } from "../src/volume.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { fixClock, T0, d, summaryOf } from "./_helpers.mjs";

before(() => fixClock());
const sets = (n, fait = true) => Array.from({ length: n }, () => ({ poids: 30, val: 10, fait }));
const ex = (nom, n, extra = {}) => ({ nom, mode: "reps", series: sets(n), ...extra });
const byG = (r) => Object.fromEntries(r.groups.map((g) => [g.groupe, g.series]));

test("séries cochées des 7 derniers jours, sommées par groupe ; hors fenêtre ignoré", () => {
  const training = [
    { date: T0, type: "Upper A", exercices: [ex("Développé incliné haltères", 3), ex("Élévations latérales haltères", 3), ex("Rowing barre ou machine", 4)] },
    { date: d(6), type: "Upper B", exercices: [ex("Développé couché haltères", 3), ex("Élévations latérales poulie", 3)] },
    { date: d(7), type: "Upper A", exercices: [ex("Développé incliné haltères", 3)] }, // J−7 : hors fenêtre de 7 jours
  ];
  const r = weeklyVolumeByGroup(training);
  assert.equal(r.from, d(6));
  assert.equal(r.to, T0);
  const g = byG(r);
  assert.equal(g.pecs, 6);
  assert.equal(g.epaules, 6);
  assert.equal(g.dos, 4);
});

test("seules les séries COCHÉES comptent ; un exercice sans série cochée n'apparaît pas", () => {
  const training = [{ date: T0, type: "Upper A", exercices: [{ nom: "Développé incliné haltères", mode: "reps", series: [...sets(2, true), ...sets(2, false)] }, ex("Rowing barre ou machine", 3, { series: sets(3, false) })] }];
  const r = weeklyVolumeByGroup(training);
  assert.equal(byG(r).pecs, 2);
  assert.equal(byG(r).dos, undefined);
});

test("mode « temps » exclu (gainage, isométries) et contenu Basket/Mobilité entièrement exclu de fait", () => {
  const training = [
    { date: T0, type: "Upper A", exercices: [{ nom: "Core — Planche", mode: "temps", series: sets(3) }] },
    { date: T0, type: "Basket", exercices: [{ nom: "Primer iso genou (wall-sit @60°)", mode: "temps", series: sets(4) }, { nom: "Montée en charge : squats", mode: "temps", series: sets(2) }] },
    { date: T0, type: "Mobilité", exercices: [{ nom: "Iso flexion coude prise marteau + supination", mode: "temps", series: sets(3) }, { nom: "Mobilité épaules (coiffe des rotateurs)", mode: "temps", series: sets(2) }] },
  ];
  const r = weeklyVolumeByGroup(training);
  assert.deepEqual(r.groups.filter((g) => g.series > 0), []);
  // le mode se lit aussi depuis le gabarit si l'entrée ne le porte pas
  assert.equal(groupOf({ nom: "Core — Planche", series: sets(1) }), null);
  assert.equal(groupOf({ nom: "Cardio léger (vélo ou trot)", mode: "reps", series: sets(1) }), null, "groupe cardio exclu même en reps");
});

test("exercice substitué : compte pour le groupe de l'exercice réellement fait, repli sur l'origine si nom inconnu", () => {
  assert.equal(groupOf({ nom: "Rowing poulie basse", origine: "Rowing barre ou machine", mode: "reps" }), "dos");
  assert.equal(groupOf({ nom: "Machine inconnue XYZ", origine: "Développé couché haltères", mode: "reps" }), "pecs");
  assert.equal(groupOf({ nom: "Machine inconnue XYZ", mode: "reps" }), null);
});

test("groupes prioritaires (pecs, épaules) toujours présents avec leur statut, même à 0 ; les autres omis à 0", () => {
  const r = weeklyVolumeByGroup([]);
  assert.deepEqual(r.groups.map((g) => g.groupe), PRIORITY_GROUPS);
  assert.ok(r.groups.every((g) => g.series === 0 && g.status === "sous" && g.priority));
  const r2 = weeklyVolumeByGroup([{ date: T0, type: "Lower A", exercices: [ex("Presse à cuisses (HSR)", 3)] }]);
  const quad = r2.groups.find((g) => g.groupe === "quadriceps");
  assert.equal(quad.series, 3);
  assert.equal(quad.status, null, "groupe non prioritaire : pas de statut de zone");
});

test("zoneStatus : 9 sous, 10 et 20 dans, 21 au-dessus", () => {
  assert.deepEqual(VOLUME_TARGET, { min: 10, max: 20 });
  assert.equal(zoneStatus(9), "sous");
  assert.equal(zoneStatus(10), "dans");
  assert.equal(zoneStatus(20), "dans");
  assert.equal(zoneStatus(21), "au-dessus");
});

test("Coach IA : volume_hebdo_series dans le résumé + consigne quand il y a des séries ; rien sinon", () => {
  const empty = { weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "", journal: "", basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false };
  const training = [{ date: d(1), type: "Upper A", exercices: [ex("Développé incliné haltères", 3), ex("Rowing barre ou machine", 4)] }];
  const u = buildCoachPrompt({ ...empty, training, phase: "seche" }, "").user;
  const s = summaryOf(u);
  assert.deepEqual(s.volume_hebdo_series, { pecs: 3, epaules: 0, dos: 4 });
  assert.deepEqual(volumeForCoach(training), s.volume_hebdo_series);
  assert.match(u, /volume_hebdo_series.*zone cible 10-20 séries\/semaine pour pecs\/epaules/);
  const u0 = buildCoachPrompt({ ...empty, phase: "seche" }, "").user;
  assert.ok(!u0.includes("volume_hebdo"), "aucune série : prompt sans ce champ ni cette consigne");
});
