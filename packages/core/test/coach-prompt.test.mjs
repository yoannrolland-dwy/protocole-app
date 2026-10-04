// Prompt Coach IA (coach/prompt.js) — porté de r1-baseline, r2, r3, r3b, r4, s2 + la
// régression du 07/09/2026 (notes absentes du Bilan 3 mois).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { buildCoachPrompt, buildBilanPrompt } from "../src/coach/prompt.js";
import { DEFAULT_TARGETS, PHASES } from "../src/targets.js";
import { SCHEMES } from "../src/climbing.js";
import { nextSessions } from "../src/nextSession.js";
import { recommendTargets } from "../src/palier.js";
import { recompZone } from "../src/tdee.js";
import { fixClock, T0, d, session, summaryOf, snapshot } from "./_helpers.mjs";

before(() => fixClock());
const empty = { weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "", journal: "", scheme: SCHEMES.gym, basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false };

// Jeu de données réaliste (r1-baseline) : 28 j de poids, 14 j de sommeil/macros/pas, 1 séance.
const rich = () => ({
  ...empty,
  weight: Array.from({ length: 28 }, (_, i) => ({ date: d(i), kg: 95 + Math.sin(i) * 0.3 - i * 0.03 })),
  sleep: Array.from({ length: 14 }, (_, i) => ({ date: d(i), hours: 6 + (i % 3) * 0.4, quality: 2 + (i % 3) })),
  macros: Array.from({ length: 14 }, (_, i) => ({ date: d(i), protein: 200 + i, carbs: 250, fat: 85, fiber: 35, water: 2000, kcal: 2700 })),
  steps: Array.from({ length: 14 }, (_, i) => ({ date: d(i), count: 8000 + i * 100 })),
  training: [{ id: "a", date: d(1), type: "Upper A", exercices: [{ nom: "Développé couché haltères", series: [{ poids: 32, val: 9, done: true }] }] }],
  knee: [{ date: T0, pain: 2, baseline: true }],
  profile: "profil test",
  basketSchedule: { weekly: [3, 5], matchDates: [] },
});

// ---------- Capture datée (r1-baseline étendue aux 4 phases) : texte complet, pas seulement un hash,
// pour qu'un écart se lise en diff. Horloge figée au 04/10/2026 10:00.
test("capture datée : system/user quotidien + bilan pour les 4 phases (snapshots/coach-prompt.json)", () => {
  const out = {};
  for (const phase of Object.keys(PHASES)) {
    const p = buildCoachPrompt({ ...rich(), phase }, "note test");
    const b = buildBilanPrompt({ facts: { fenetreJours: 90, test: 1 }, phase, targets: DEFAULT_TARGETS, profile: "profil test", notes: [] });
    out[phase] = { system: p.system, user: p.user, bilanSystem: b.system, bilanUser: b.user };
  }
  snapshot("coach-prompt", out);
});

// ---------- Régression du 07/09/2026 (v3.77.1) : notes de contexte absentes du Bilan 3 mois
test("régression 07/09 : le bilan inclut les notes de sa fenêtre (90 j), exclut les plus anciennes, aucun bloc sans note", () => {
  const notes = [{ date: d(2), text: "insomnie après le match" }, { date: d(60), text: "deux verres de vin" }, { date: d(120), text: "note trop ancienne" }];
  const b = buildBilanPrompt({ facts: { fenetreJours: 90 }, phase: "seche", targets: DEFAULT_TARGETS, profile: "", notes });
  assert.ok(b.user.includes("insomnie après le match"), "note récente présente");
  assert.ok(b.user.includes("deux verres de vin"), "note à J−60 présente (fenêtre 90 j, pas 14)");
  assert.ok(!b.user.includes("note trop ancienne"), "note à J−120 exclue");
  const b0 = buildBilanPrompt({ facts: { fenetreJours: 90 }, phase: "seche", targets: DEFAULT_TARGETS, profile: "", notes: [] });
  assert.ok(!/NOTES/i.test(b0.user), "aucun bloc de notes si la liste est vide");
});

// ---------- R2 : recomposition + paliers
test("recomposition : summary.depense_estimee.recomposition + paliers < 90 j + consignes", () => {
  const data = rich();
  const hist = [{ date: d(5), kcal: 2800, prevKcal: 2700, protein: 210, carbs: 270, fat: 90, fiber: 35, source: "manual" }, { date: d(120), kcal: 2600, protein: 210, carbs: 230, fat: 85, fiber: 35, source: "manual" }];
  const pr = buildCoachPrompt({ ...data, phase: "recomposition", targetHistory: hist }, "");
  const s = summaryOf(pr.user);
  assert.ok(s.depense_estimee.recomposition?.j14, JSON.stringify(s.depense_estimee));
  assert.equal(s.paliers?.length, 1);
  assert.equal(s.paliers[0].kcal, 2800);
  assert.ok(pr.user.includes("PALIERS DE CIBLES") && pr.user.includes("depense_estimee.recomposition"));
  const pr2 = buildCoachPrompt({ ...data, phase: "seche", targetHistory: [] }, "");
  assert.ok(!pr2.user.includes("PALIERS") && !pr2.user.includes("recomposition"), "sèche sans historique : aucun bloc");
  const pr3 = buildCoachPrompt({ ...data, phase: "seche", targetHistory: hist }, "");
  assert.ok(pr3.user.includes("PALIERS DE CIBLES") && !pr3.user.includes("depense_estimee.recomposition"), "sèche avec historique : paliers oui, zone non");
});

test("paliers : une retouche à total constant n'est pas un palier pour le coach ; un vrai palier l'est", () => {
  const fake = [{ date: "2026-10-02", kcal: 2800, prevKcal: 2800, source: "manual" }];
  const real = [{ date: "2026-09-29", kcal: 2900, prevKcal: 2800, source: "palier" }, ...fake];
  const s = summaryOf(buildCoachPrompt({ ...empty, phase: "recomposition", targetHistory: real }, "").user);
  assert.equal(s.paliers?.length, 1);
  assert.equal(s.paliers[0].source, "palier");
  assert.ok(!buildCoachPrompt({ ...empty, phase: "seche", targetHistory: fake }, "").user.includes("PALIERS"));
});

// ---------- R3 : palier_semaine
test("palier_semaine + consigne « ne propose JAMAIS un autre palier » en recomposition ; rien en sèche", () => {
  const reading = (x) => ({ status: "ok", reading: { deficit: x, ...recompZone(x) } });
  const result = recommendTargets({ now: new Date(2026, 9, 1, 10), targets: { protein: 210, carbs: 270, fat: 90, fiber: 35 }, targetHistory: [], loggedRate7: 1, recomp: { j14: reading(600), j21: reading(600) }, trend: { deltaWeek: -0.2, deltaWeekPrev: -0.1 } });
  const pr = buildCoachPrompt({ ...empty, phase: "recomposition", palier: { weekOf: "2026-09-28", result, appliedAt: null } }, "");
  assert.ok(pr.user.includes('"palier_semaine"') && pr.user.includes("ne propose JAMAIS un autre palier"));
  assert.ok(!buildCoachPrompt({ ...empty, phase: "seche" }, "").user.includes("palier"));
});

// ---------- R4 : bloc de règles attaché à la phase
test("recomposition : bloc de règles dans le system quotidien ET bilan, renvoi aux champs côté quotidien seulement", () => {
  const dq = buildCoachPrompt({ ...empty, phase: "recomposition" }, "");
  const b = buildBilanPrompt({ facts: { fenetreJours: 90 }, phase: "recomposition", targets: DEFAULT_TARGETS, profile: "", notes: [] });
  assert.ok(dq.system.includes(PHASES.recomposition.coach));
  assert.ok(b.system.includes(PHASES.recomposition.coach));
  assert.ok(dq.system.includes("Appuie-toi sur `palier_semaine`"));
  assert.ok(!b.system.includes("palier_semaine"));
  for (const w of ["poids stable n'est JAMAIS un échec", "Murphy & Koehler 2022", "14 jours (eau/glycogène)", "protocole HSR", "moyenne hebdomadaire contre la cible", "jamais sur la durée (short sleeper)"])
    assert.ok(dq.system.includes(w), `règle : ${w}`);
  assert.ok(!buildCoachPrompt({ ...empty, phase: "seche" }, "").system.includes("Recomposition corporelle"));
});

// ---------- S2 : journee / demain
test("nextSession fourni : recommandeur.journee « terminée », demain Full Body, consigne ; absent → pas de champ journee", () => {
  const bs = { weekly: [3, 5], matchDates: ["2026-10-04"] };
  const planFor = (k) => ({ weeklyPlan: k === "2026-10-05" ? ["Full Body"] : ["Basket"], matchWeek: k === "2026-10-04", postMatch: k === "2026-10-05" });
  const training = [session("2026-10-04", "Basket")];
  const ns = nextSessions({ now: new Date(2026, 9, 4, 21, 10), base: { training, knee: [{ date: "2026-10-04", pain: 2, baseline: true }], sleep: [], targets: DEFAULT_TARGETS, scheme: SCHEMES.gym, basketSchedule: bs }, planFor });
  const u = buildCoachPrompt({ ...empty, training, basketSchedule: bs, phase: "recomposition", nextSession: ns }, "").user;
  const s = summaryOf(u);
  assert.match(s.recommandeur.journee, /^terminée/);
  assert.equal(s.recommandeur.demain.type, "Full Body");
  assert.ok(u.includes("ne propose AUCUNE séance pour aujourd'hui"));
  const s0 = summaryOf(buildCoachPrompt({ ...empty, phase: "seche" }, "").user);
  assert.equal(s0.recommandeur.journee, undefined);
});
