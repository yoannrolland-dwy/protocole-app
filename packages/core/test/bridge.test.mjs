// Pont privé PROTOCOLE → JEFFREY, étape G1 (lecture seule, 05/11/2026) : réponses de `lire`
// construites à partir des mêmes calculs que l'app (données synthétiques, horloge figée).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { buildCoachPrompt, buildBilanPrompt } from "../src/coach/prompt.js";
import { buildReading, bridgeRules, BRIDGE_SUBJECTS } from "../src/coach/bridge.js";
import { JEFFREY_PERSONA, JEFFREY_RULES, BRIEF_ORDER } from "../src/coach/jeffrey.js";
import { briefMissing } from "../src/coach/brief.js";
import { computeEnergyScore } from "../src/energy.js";
import { computeBilanFacts } from "../src/bilan.js";
import { nextSessions } from "../src/nextSession.js";
import { DEFAULT_TARGETS, targetsForDate, kcalFromMacros } from "../src/targets.js";
import { fixClock, T0, d, NOW, BS, planFor, session, exo } from "./_helpers.mjs";

before(() => fixClock());

const days = (n, f) => Array.from({ length: n }, (_, i) => f(d(i), i)).filter(Boolean);
const base = {
  weight: days(20, (date, i) => ({ date, kg: 94 + i * 0.05 })),
  sleep: days(10, (date, i) => ({ date, hours: 5.8, quality: i % 2 ? 3 : 4 })),
  knee: [{ date: d(1), pain: 2, baseline: true }],
  macros: days(10, (date, i) => (i === 0 ? { date, protein: 80, carbs: 100, fat: 30, fiber: 10, kcal: 1000, water: 750, source: "foodlog" } : { date, protein: 200, carbs: 250, fat: 80, fiber: 30, water: 2000 })),
  training: [session(d(1), "Upper A", [exo("Rowing", true, 60, 10)]), session(d(3), "Lower A", [exo("Presse à cuisses", true, 150, 15)])],
  steps: days(10, (date) => ({ date, count: 9000 })),
  rhr: days(10, (date) => ({ date, bpm: 52 })),
  notes: [{ date: d(2), text: "petite insomnie" }],
};
const targets = DEFAULT_TARGETS;

function ctxFor(data, extra = {}) {
  const energy = computeEnergyScore(T0, { rhrLog: data.rhr, sleepLog: data.sleep, stepsLog: data.steps, napLog: [] });
  const ns = nextSessions({ now: NOW, base: { training: data.training, knee: data.knee, sleep: data.sleep, targets, basketSchedule: BS, energy }, planFor });
  const coach = buildCoachPrompt({ ...data, targets, phase: "recomposition", foodLog: [], foodOverrides: {}, profile: "Contexte écrit par Yoann.", journal: "Carnet : RAS.", basketSchedule: BS, weeklyPlan: [], nextSession: ns, energy }, "");
  return {
    date: T0, heure: "10:00", coach, nextSession: ns, energy, napMinutes: null,
    missing: briefMissing({ today: T0, sleep: data.sleep, weight: data.weight, knee: data.knee }),
    reminders: [], ...extra,
  };
}

test("forme générale : { date, regles, faits, manque } pour chaque sujet, sans personnalité", () => {
  const ctx = ctxFor(base, { bilan: { faits: { fenetre_jours: 90 }, notes: "" } });
  for (const s of BRIDGE_SUBJECTS) {
    const r = buildReading(s, ctx);
    assert.deepEqual(Object.keys(r), ["date", "regles", "faits", "manque"], s);
    assert.equal(r.date, T0);
    assert.ok(r.regles.includes(JEFFREY_RULES), `${s} : règles de Jeffrey`);
    assert.ok(r.regles.includes("Contexte écrit par Yoann."), `${s} : contexte du coach`);
    assert.ok(!r.regles.includes(JEFFREY_PERSONA.slice(0, 60)), `${s} : jamais la personnalité`);
    assert.ok(!/apiKey|litellmKey|voiceKey|backupKey/.test(JSON.stringify(r)), `${s} : aucune clé`);
  }
  assert.throws(() => buildReading("agenda", ctx), (e) => e.code === "inconnu");
});

test("manque : genou non noté aujourd'hui (nuit et pesée présentes)", () => {
  assert.deepEqual(buildReading("forme", ctxFor(base)).manque, ["genou"]);
  const ok = { ...base, knee: [...base.knee, { date: T0, pain: 1, baseline: true }] };
  assert.deepEqual(buildReading("forme", ctxFor(ok)).manque, []);
});

test("macros : reste = cible − consommé, eau comprise ; cible = celle du jour", () => {
  const r = buildReading("macros", ctxFor(base)).faits;
  const at = targetsForDate(T0, targets);
  assert.equal(r.cible.kcal, Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber)));
  assert.equal(r.cible.eau_ml, targets.water);
  assert.deepEqual(r.consomme, { kcal: 1000, proteines: 80, glucides: 100, lipides: 30, fibres: 10, eau_ml: 750 });
  assert.equal(r.reste.kcal, r.cible.kcal - 1000);
  assert.equal(r.reste.proteines, at.protein - 80);
  assert.equal(r.reste.eau_ml, targets.water - 750);
  assert.equal(r.heure, "10:00");
  assert.ok(!("dessert" in r), "aucune règle dessert");
});

test("macros : rien de saisi aujourd'hui → consommé à 0, reste = cible entière ; dépassement négatif", () => {
  const empty = buildReading("macros", ctxFor({ ...base, macros: base.macros.filter((m) => m.date !== T0) })).faits;
  assert.equal(empty.consomme.kcal, 0);
  assert.equal(empty.reste.kcal, empty.cible.kcal);
  const over = { ...base, macros: [{ date: T0, protein: 300, carbs: 400, fat: 120, fiber: 40, kcal: 4000, water: 3000 }] };
  const o = buildReading("macros", ctxFor(over)).faits;
  assert.ok(o.reste.kcal < 0 && o.reste.eau_ml < 0);
});

test("sport du jour : même verdict que nextSessions, sans score, séances autorisées", () => {
  const ctx = ctxFor(base);
  const f = buildReading("sport_du_jour", ctx).faits;
  assert.deepEqual(f.aujourdhui.propositions.map((p) => p.type), ctx.nextSession.today.suggestions.map((s) => s.type));
  assert.ok(f.aujourdhui.propositions.every((p) => !("score" in p) && p.raison));
  assert.equal(f.demain.date, ctx.nextSession.tomorrow.date);
  assert.ok(Array.isArray(f.seances_autorisees.aujourdhui) && Array.isArray(f.seances_autorisees.demain));
  assert.deepEqual(f.seances_faites.hier, ["Upper A"]);
  // « pas_proposees » ne redit pas ce qui est déjà à éviter.
  const avoided = new Set(f.aujourdhui.a_eviter.map((a) => a.type));
  assert.ok(f.aujourdhui.pas_proposees.every((p) => !avoided.has(p.type)));
});

test("forme : nuit avec score, énergie, FC repos, poids, pas", () => {
  const f = buildReading("forme", ctxFor(base)).faits;
  assert.equal(f.nuit.heures, 5.8);
  assert.equal(typeof f.nuit.score, "number");
  assert.equal(f.fc_repos.aujourdhui, 52);
  assert.ok(f.energie && f.energie.modules.length >= 4);
  assert.equal(f.poids.aujourdhui, 94);
  assert.equal(f.poids.phase, "Recomposition");
  assert.equal(f.pas.aujourdhui, 9000);
});

test("brief : forme + séance + rappels, ordre du brief dans les règles", () => {
  const r = buildReading("brief", ctxFor(base, { reminders: ["sauvegarde hors du téléphone : dernière il y a 20 jours"] }));
  assert.ok(r.regles.includes(BRIEF_ORDER));
  assert.ok(!bridgeRules("x", "macros").includes(BRIEF_ORDER));
  assert.ok(r.faits.nuit && r.faits.seance.aujourdhui && r.faits.seance.seances_autorisees);
  assert.equal(r.faits.rappels.length, 1);
});

test("point : bloc complet (temps réel, résumé 14 j, progression, notes, carnet)", () => {
  const ctx = ctxFor(base);
  const f = buildReading("point", ctx).faits;
  assert.deepEqual(f.temps_reel, ctx.coach.facts.realtime);
  assert.deepEqual(f.resume_14j, ctx.coach.facts.summary);
  assert.ok(f.notes_14j.includes("petite insomnie"));
  assert.equal(f.carnet, "Carnet : RAS.");
});

test("bilan : faits de buildBilanPrompt (mêmes calculs que le bilan 3 mois), sans consignes de rédaction", () => {
  const bf = computeBilanFacts({ training: base.training, weight: base.weight, macros: base.macros, sleep: base.sleep, rhr: base.rhr, steps: base.steps, knee: base.knee, targets, tdeeResult: { status: "insufficient" }, kcalTargetToday: 2500, todayDate: T0 });
  const bilan = buildBilanPrompt({ facts: bf, phase: "recomposition", targets, profile: "", notes: base.notes });
  const f = buildReading("bilan", ctxFor(base, { bilan })).faits;
  assert.equal(f.fenetre_jours, bf.fenetreJours);
  assert.ok(f.notes.includes("petite insomnie"));
  assert.ok(!JSON.stringify(f).includes("Rédige"));
});

test("prompt : `cibles_du_jour` et `faits` du bilan sont des ajouts (system/user inchangés ailleurs)", () => {
  const c = buildCoachPrompt({ ...base, targets, phase: "seche", foodLog: [], foodOverrides: {}, profile: "", journal: "", basketSchedule: BS, weeklyPlan: [] }, "");
  assert.ok(c.facts.cibles_du_jour && !c.user.includes("cibles_du_jour") && !c.system.includes("cibles_du_jour"));
});
