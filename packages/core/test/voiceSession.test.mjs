// Séance à la voix (G4-C3, 05/11/2026) : règles pures sur le brouillon. Données synthétiques.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  newSessionDraft, readSession, logSet, undoLastSet, goToExercise, nextExercise, restAction,
  finishCheck, abandonCheck, findExercise, restText, kilos,
} from "../src/session/voiceSession.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());

const S = (poids, val, fait = true, leg = null) => ({ poids, val, fait, leg });
const training = [
  { id: "a", date: d(7), type: "Upper A", exercices: [{ nom: "Développé incliné haltères", mode: "reps", series: [S(30, 9), S(30, 8)] }] },
];
const ctx = (knee = []) => ({ training, knee, now: Date.UTC(2026, 9, 4, 8) });
const draft = () => newSessionDraft({ type: "Upper A", training, hsrWeek: 9, date: T0, start: "07:00" });

test("textes : repos, kilos", () => {
  assert.equal(restText(90), "1 min 30");
  assert.equal(restText(120), "2 minutes");
  assert.equal(restText(60), "1 minute");
  assert.equal(restText(45), "45 secondes");
  assert.equal(kilos(32.5), "32,5 kilos");
});

test("lire : série en cours dans l'ordre, prévu, record à battre", () => {
  const r = readSession(draft(), ctx()).seance;
  assert.equal(r.type, "Upper A");
  assert.deepEqual(r.courant.prevu, { kg: 30, reps: 9 });
  assert.deepEqual(r.courant.record_a_battre, { kg: 30, reps: 9 });
  assert.match(r.phrase, /^Développé incliné haltères, série 1 : 9 à 30 kilos prévus\.$/);
  assert.deepEqual(readSession(null, ctx()), { seance: null });
});

test("noter une série : tout de suite, confirmation, record battu, puis annule", () => {
  const r = logSet(draft(), { reps: 8, kg: 32 }, ctx());
  assert.equal(r.ok, true);
  assert.match(r.phrase, /^Développé incliné haltères, série 1 notée, 8 à 32 kilos, repos /);
  assert.equal(r.record, true);
  assert.match(r.phrase, /Record battu, Monsieur\.$/);
  assert.deepEqual(r.draft.exos[0].series[0], { poids: 32, val: 8, fait: true, leg: null });
  // Série suivante dans l'ordre, charge préremplie gardée si non dite.
  const r2 = logSet(r.draft, { reps: 7 }, ctx());
  assert.equal(r2.si, 1);
  assert.equal(r2.draft.exos[0].series[1].poids, 30);
  // « Annule » : la dernière série revient comme avant.
  const u = undoLastSet(r2.draft);
  assert.equal(u.draft.exos[0].series[1].fait, false);
  assert.match(u.phrase, /série 2 annulée/);
  assert.equal(undoLastSet(u.draft).ok, false, "une seule annulation");
});

test("pas de record annoncé genou hors base (V4)", () => {
  const r = logSet(draft(), { reps: 8, kg: 40 }, ctx([{ date: T0, pain: 7, baseline: false }]));
  assert.equal(r.record, false);
  assert.doesNotMatch(r.phrase, /Record/);
});

test("refus : reps manquantes, charge inconnue, séance absente", () => {
  assert.equal(logSet(draft(), {}, ctx()).besoin, "reps");
  const dr = draft();
  const ti = dr.exos.findIndex((e) => e.mode !== "temps" && e.series[0].poids === "");
  if (ti >= 0) assert.equal(logSet(dr, { exercice: dr.exos[ti].nom, reps: 8 }, ctx()).besoin, "kg");
  assert.equal(logSet(null, { reps: 8 }, ctx()).ok, false);
});

test("exercice nommé, exercice suivant, recherche ambiguë", () => {
  const dr = draft();
  const g = goToExercise(dr, { exercice: "rowing" }, ctx());
  assert.equal(g.ok, true);
  assert.equal(dr.exos[g.draft.courant].nom, "Rowing barre ou machine");
  const n = nextExercise(g.draft, ctx());
  assert.equal(n.draft.courant, g.draft.courant + 1);
  const amb = findExercise(dr.exos, "élévations");
  assert.equal(amb.ok, false);
  assert.equal(amb.choix.length, 2);
});

test("repos : lancer, +30 s, pause, reprendre, stop", () => {
  const now = 1_000_000;
  let r = restAction(draft(), "lancer", now);
  assert.equal(r.alarm.endAt, now + r.draft.rest.secs * 1000);
  r = restAction(r.draft, "plus30", now + 10_000);
  assert.match(r.phrase, /Trente secondes de plus/);
  r = restAction(r.draft, "pause", now + 20_000);
  assert.equal(r.alarm, null);
  r = restAction(r.draft, "reprendre", now + 30_000);
  assert.ok(r.alarm.endAt > now + 30_000);
  r = restAction(r.draft, "stop", now + 40_000);
  assert.equal(r.alarm, null);
  assert.equal(restAction(r.draft, "pause", now).ok, false);
});

test("fin : rien de fait refusé ; résumé et question ; Basket demande durée puis effort", () => {
  assert.equal(finishCheck(draft(), {}, { nowMs: 1 }).ok, false);
  const done = logSet(draft(), { reps: 8 }, ctx()).draft;
  const f = finishCheck(done, {}, { nowMs: 1 });
  assert.equal(f.resume, "Enregistrer la séance Upper A : 1 exercice, 1 série faite");
  assert.equal(f.question, "Dois-je enregistrer la séance Upper A, Monsieur ? 1 exercice, 1 série faite.");
  assert.equal(f.record.exercices[0].series[0].fait, true);
  const bk = newSessionDraft({ type: "Basket", training: [], hsrWeek: 9, date: T0, start: "19:00" });
  const bkDone = logSet(bk, { secondes: 200 }, ctx()).draft;
  assert.equal(finishCheck(bkDone, {}, { nowMs: 1 }).besoin, "duree");
  assert.equal(finishCheck(bkDone, { duree: 75 }, { nowMs: 1 }).besoin, "rpe");
  const ok = finishCheck(bkDone, { duree: 75, rpe: 7 }, { nowMs: 1 });
  assert.equal(ok.record.duration, 75);
  assert.match(ok.question, /75 min, effort 7 sur 10\.$/);
  assert.match(abandonCheck(done).question, /^Dois-je abandonner la séance Upper A sans l'enregistrer, Monsieur \? 1 série faite perdue\.$/);
});
