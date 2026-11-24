// Séance Mobilité simplifiée (24/11/2026, demande de Yoann) : ni reps en réserve, ni records, ni
// plateau, ni JEFFREY au cochage ; poids gardé seulement sur l'iso leg extension, la rotation
// externe épaule, l'iso flexion coude et le crunch machine. Données synthétiques.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES } from "../src/session/templates.js";
import { isLightSession, showsWeight } from "../src/session/engine.js";
import { newSessionDraft, readSession, logSet, finishCheck } from "../src/session/voiceSession.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());

const S = (poids, val, fait = true, leg = null) => ({ poids, val, fait, leg });
const WEIGHTED = [
  "Iso leg extension unilatérale @60° (genou)",
  "Rotation externe épaule poulie basse",
  "Iso flexion coude prise marteau + supination",
  "Core — Crunch machine",
];

test("seule la Mobilité est une séance simple", () => {
  assert.equal(isLightSession("Mobilité"), true);
  for (const t of Object.keys(TEMPLATES).filter((k) => k !== "Mobilité")) assert.equal(isLightSession(t), false, t);
  assert.equal(isLightSession("Inconnue"), false);
});

test("Mobilité : poids seulement sur les quatre exercices choisis", () => {
  const withKg = TEMPLATES["Mobilité"].exos.filter((x) => showsWeight("Mobilité", { nom: x.n })).map((x) => x.n);
  assert.deepEqual(withKg.sort(), [...WEIGHTED].sort());
  assert.equal(showsWeight("Mobilité", { nom: "Chat-vache" }), false);
  // Exercice ajouté en cours de séance : poids gardé ; substitution retrouvée par `origine`.
  assert.equal(showsWeight("Mobilité", { nom: "Curl marteau", added: true }), true);
  assert.equal(showsWeight("Mobilité", { nom: "Rotation externe élastique", origine: "Rotation externe épaule poulie basse" }), true);
  // Les autres séances ne changent pas.
  assert.equal(showsWeight("Full Body", { nom: "Squat sur sécurités" }), true);
  assert.ok(!/réserve/.test(TEMPLATES["Mobilité"].exos.map((x) => x.c).join(" ")), "plus de reps en réserve dans les consignes");
});

const training = [
  { id: "m1", date: d(7), type: "Mobilité", exercices: [
    { nom: "Chat-vache", mode: "reps", series: [S(0, 10)] },
    { nom: "Core — Crunch machine", mode: "reps", series: [S(40, 10), S(40, 10)] },
  ] },
];
const ctx = { training, knee: [], now: Date.UTC(2026, 9, 4, 8) };
const draft = () => newSessionDraft({ type: "Mobilité", training, hsrWeek: 9, date: T0, start: "07:00" });

test("à la voix : série notée sans record, plateau ni fin d'exercice", () => {
  const r = logSet(draft(), { exercice: "Chat-vache", reps: 15 }, ctx);
  assert.equal(r.ok, true);
  assert.equal(r.record, false, "15 reps battent 10, mais pas de record en Mobilité");
  assert.equal(r.plateau, null);
  assert.equal(r.finExercice, undefined, "Jeffrey ne dit rien de plus au cochage");
  assert.doesNotMatch(r.phrase, /[Rr]ecord/);
  const c = logSet(draft(), { exercice: "Crunch machine", reps: 12, kg: 50 }, ctx);
  assert.equal(c.ok, true);
  assert.equal(c.record, false);
  assert.equal(c.draft.exos.find((e) => e.nom === "Core — Crunch machine").series[0].poids, 50, "le poids est gardé");
});

test("à la voix : ni record à battre ni plateau à la lecture", () => {
  const r = readSession(draft(), ctx).seance;
  assert.equal(r.courant.record_a_battre, undefined);
  assert.equal(r.courant.plateau, undefined);
});

test("compte rendu : les chiffres seulement, ni record ni tendance", () => {
  const r = logSet(draft(), { exercice: "Chat-vache", reps: 15 }, ctx);
  const f = finishCheck(r.draft, {}, { nowMs: Date.UTC(2026, 9, 4, 8), training });
  assert.equal(f.ok, true);
  assert.deepEqual(f.compteRendu.records, []);
  assert.equal(f.compteRendu.hausse, 0);
  assert.doesNotMatch(f.compteRendu.phrase, /record|hausse/i);
});
