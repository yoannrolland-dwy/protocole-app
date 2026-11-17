// Fin d'exercice et compte rendu dits par JEFFREY (17/11/2026). Données synthétiques.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { exerciseEnd, exerciseEndPhrase, sessionReport, elapsedMinutes, trendWithToday } from "../src/session/exerciseEnd.js";
import { newSessionDraft, logSet, finishCheck, undoLastSet } from "../src/session/voiceSession.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());
const NOM = "Développé incliné haltères";
const S = (poids, val, fait = true) => ({ poids, val, fait, leg: null });
const past = (daysAgo, sets) => ({ id: `p${daysAgo}`, date: d(daysAgo), type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: sets }] });
const training = [past(7, [S(34, 10), S(34, 10), S(34, 9), S(34, 9)])];
const ex = (sets) => ({ nom: NOM, mode: "reps", series: sets });
const first = () => 0; // première tournure, pour des phrases stables

test("fin d'exercice : seulement quand toutes les séries sont faites", () => {
  const exos = [ex([S(34, 10), S(34, 10), S(34, 10), S(34, 9, false)])];
  assert.equal(exerciseEnd({ exos, ei: 0, si: 2, training, date: T0, rand: first }), null);
  const done = [ex([S(34, 10), S(34, 10), S(34, 10), S(34, 9)])];
  const r = exerciseEnd({ exos: done, ei: 0, si: 3, training, date: T0, rand: first });
  assert.equal(r.tendance, "hausse", "39 répétitions après 38, même format");
  assert.equal(r.phrase, "Fin de développé incliné haltères : en hausse par rapport à la dernière fois.");
  assert.ok(!r.record);
});

test("fin d'exercice : stable, première fois ; jamais genou hors base (scénario 15)", () => {
  const same = [ex([S(34, 10), S(34, 10), S(34, 9), S(34, 9)])];
  assert.equal(exerciseEnd({ exos: same, ei: 0, si: 3, training, date: T0 }).tendance, "stable");
  assert.equal(exerciseEnd({ exos: same, ei: 0, si: 3, training: [], date: T0 }).tendance, "premiere");
  assert.equal(exerciseEnd({ exos: same, ei: 0, si: 3, training, date: T0, painRed: true }), null);
});

// ---------- Retour d'essai de Yoann (17/11/2026) : scénarios du cadrage §12 où PROTOCOLE décide
const full = (last = S(34, 9)) => [ex([S(34, 10), S(34, 10), S(34, 10), last])];

test("scénarios 4 et 5 : dernière série décochée = silence ; recochée = phrase de nouveau", () => {
  const unchecked = full(S(34, 9, false));
  assert.equal(exerciseEnd({ exos: unchecked, ei: 0, si: 3, training, date: T0 }), null, "4 : décochée");
  const a = exerciseEnd({ exos: full(), ei: 0, si: 3, training, date: T0 });
  const b = exerciseEnd({ exos: full(), ei: 0, si: 3, training, date: T0 });
  assert.ok(a && b, "5 : redite à chaque fois que l'exercice redevient complet");
});

test("scénario 6 : valeurs changées entre les deux, la phrase est recalculée", () => {
  assert.equal(exerciseEnd({ exos: [ex([S(34, 10), S(34, 10), S(34, 9), S(34, 9)])], ei: 0, si: 3, training, date: T0 }).tendance, "stable");
  assert.equal(exerciseEnd({ exos: full(S(34, 10)), ei: 0, si: 3, training, date: T0 }).tendance, "hausse");
});

test("scénarios 7 et 8 : série ajoutée après la fin puis cochée = phrase ; exercice quitté avant la fin = silence", () => {
  const added = [ex([S(34, 10), S(34, 10), S(34, 10), S(34, 9), S(34, 8)])];
  assert.ok(exerciseEnd({ exos: added, ei: 0, si: 4, training, date: T0 }), "7");
  const left = [ex([S(34, 10), S(34, 10), S(34, 10, false), S(34, 9, false)])];
  assert.equal(exerciseEnd({ exos: left, ei: 0, si: 1, training, date: T0 }), null, "8");
});

test("scénarios 9 et 10 : séance rouverte (du jour ou d'un autre jour) = phrase ; tendance jusqu'à sa date, elle exclue", () => {
  const today = { id: "t", date: T0, type: "Upper A", exercices: [{ nom: NOM, mode: "reps", series: [S(34, 10), S(34, 10), S(34, 10), S(34, 10)] }] };
  const r9 = exerciseEnd({ exos: full(), ei: 0, si: 3, training: [...training, today], date: T0, exclude: today });
  assert.equal(r9.tendance, "hausse", "9 : comparée à la séance d'il y a 7 jours, pas à sa propre version enregistrée");
  const old = { id: "o", date: d(7), type: "Upper A", exercices: training[0].exercices };
  const before = past(14, [S(32, 10), S(32, 10), S(32, 10), S(32, 10)]);
  const after = past(2, [S(40, 10), S(40, 10), S(40, 10), S(40, 10)]);
  const r10 = exerciseEnd({ exos: [ex([S(34, 10), S(34, 10), S(34, 9), S(34, 9)])], ei: 0, si: 3, training: [before, old, after], date: d(7), exclude: old });
  assert.equal(r10.tendance, "hausse", "10 : 34 kg contre 32 kg avant sa date ; la séance d'après (40 kg) est ignorée");
});

test("scénario 11 : record dans une séance rouverte, comparé à tout l'historique (comme l'étoile)", () => {
  const old = { id: "o", date: d(7), type: "Upper A", exercices: training[0].exercices };
  const r = exerciseEnd({ exos: full(S(36, 8)), ei: 0, si: 3, ref: { poids: 34, val: 10 }, training: [old], date: d(7), exclude: old, rand: first });
  assert.deepEqual(r.record, { kg: 36, reps: 8 });
  assert.match(r.phrase, /^Nouveau record/);
});

test("scénarios 12 et 13 : compte rendu pour la séance du jour et pour une séance rouverte (sans durée)", () => {
  const old = { id: "o", date: d(7), type: "Upper A", exercices: training[0].exercices };
  const r = sessionReport({ type: "Upper A", exos: full(), training: [old], exclude: old, date: d(7), minutes: null, rand: first });
  assert.equal(r.hausse, 0, "la séance rouverte ne se compare pas à elle-même");
  assert.equal(r.premiere, 1);
  assert.equal(r.phrase, "Séance Upper A enregistrée, Monsieur : un exercice, quatre séries. Aucun exercice en hausse, aucun stable, aucun en baisse, un fait pour la première fois.");
});

test("record sur la dernière série : une seule phrase avec le record et la tendance", () => {
  const exos = [ex([S(34, 10), S(34, 10), S(34, 10), S(36, 8)])];
  const r = exerciseEnd({ exos, ei: 0, si: 3, ref: { poids: 34, val: 10 }, training, date: T0, rand: first });
  assert.deepEqual(r.record, { kg: 36, reps: 8 });
  assert.equal(r.phrase, "Nouveau record de développé incliné haltères, Monsieur : 36 kilos, 8 répétitions, et l'exercice est en hausse.");
  assert.equal((r.phrase.match(/\./g) || []).length, 1, "une seule phrase");
  // Record sur une AUTRE série : la fin d'exercice ne porte pas de record
  const other = [ex([S(36, 8), S(34, 10), S(34, 10), S(34, 10)])];
  assert.ok(!exerciseEnd({ exos: other, ei: 0, si: 3, ref: { poids: 34, val: 10 }, training, date: T0 }).record);
});

test("phrases : plusieurs tournures, toutes avec le nom et sans tutoiement", () => {
  for (const t of ["hausse", "stable", "baisse", "premiere"]) {
    const set = new Set([0, 0.5, 0.99].map((x) => exerciseEndPhrase({ nom: "Rowing barre ou machine", tendance: t, rand: () => x })));
    assert.equal(set.size, 3, t);
    for (const p of set) { assert.match(p, /rowing barre ou machine/i); assert.ok(!/\b(tu|ton|ta|tes)\b/.test(p)); }
  }
});

test("compte rendu : chiffres, record, tendances, exercices en baisse nommés, non terminés à part", () => {
  const hist = [
    past(14, [S(34, 10), S(34, 10), S(34, 10), S(34, 10)]),
    { id: "r1", date: d(14), type: "Upper A", exercices: [{ nom: "Tirage vertical prise neutre", mode: "reps", series: [S(96, 10), S(96, 10), S(96, 10)] }] },
    { id: "r2", date: d(7), type: "Upper A", exercices: [{ nom: "Tirage vertical prise neutre", mode: "reps", series: [S(96, 6), S(96, 6), S(96, 6)] }] },
  ];
  const exos = [
    ex([S(36, 8), S(34, 10), S(34, 10), S(34, 10)]),
    { nom: "Tirage vertical prise neutre", mode: "reps", series: [S(96, 6), S(96, 6), S(96, 6)] },
    { nom: "Face pull", mode: "reps", series: [S(30, 12), S(30, 12, false)] },
    { nom: "Curl marteau (prise neutre)", mode: "reps", series: [S(20, 10, false)] },
  ];
  const r = sessionReport({ type: "Upper A", exos, training: hist, date: T0, minutes: 52, rand: first });
  assert.equal(r.exercices, 3);
  assert.equal(r.series, 8);
  assert.deepEqual(r.records, [NOM]);
  assert.equal(r.hausse, 1);
  assert.deepEqual(r.baisse, ["Tirage vertical prise neutre"]);
  assert.equal(r.non_termines, 1);
  assert.equal(r.phrase, "Séance Upper A enregistrée, Monsieur : trois exercices, huit séries, 52 minutes. "
    + "Un record, sur développé incliné haltères. "
    + "Un exercice en hausse, aucun stable, un en baisse : tirage vertical prise neutre, un exercice non terminé.");
  const knee = sessionReport({ type: "Upper A", exos, training: hist, date: T0, painRed: true, minutes: null, rand: first });
  assert.equal(knee.phrase, "Séance Upper A enregistrée, Monsieur : trois exercices, huit séries.", "genou hors base : ni records ni tendances");
});

test("durée : depuis l'heure de début, null si absurde", () => {
  assert.equal(elapsedMinutes("07:00", new Date(2026, 9, 4, 7, 52).getTime()), 52);
  assert.equal(elapsedMinutes("", Date.now()), null);
  assert.equal(elapsedMinutes("07:00", new Date(2026, 9, 4, 7, 0).getTime()), null);
});

test("voix (scénarios 19 à 21) : fin_exercice à la dernière série, redite après « annule » ; record dit une seule fois", () => {
  const tr = [past(7, [S(30, 9), S(30, 8), S(30, 8), S(30, 8)])];
  const c = { training: tr, knee: [], now: Date.UTC(2026, 9, 4, 8), rand: first };
  let dr = newSessionDraft({ type: "Upper A", training: tr, hsrWeek: 9, date: T0, start: "07:00" });
  const n = dr.exos[0].series.length;
  for (let i = 0; i < n - 1; i++) {
    const r = logSet(dr, { reps: 9, kg: 30 }, c);
    assert.ok(!r.finExercice);
    dr = r.draft;
  }
  const last = logSet(dr, { reps: 10, kg: 30 }, c);
  assert.equal(last.finExercice.tendance, "hausse");
  assert.deepEqual(last.finExercice.record, { kg: 30, reps: 10 });
  assert.ok(!last.phrase.includes("Record battu"), "le record n'est dit qu'une fois, dans fin_exercice");
  // Scénario 20 : série annulée puis notée de nouveau → phrase de nouveau, recalculée
  const undone = undoLastSet(last.draft);
  const again = logSet(undone.draft, { reps: 9, kg: 30 }, c);
  assert.ok(again.finExercice, "redite après « annule »");
  assert.ok(!again.finExercice.record, "recalculée : 30 × 9 n'est plus un record");
  // compte rendu à la fin de séance
  const f = finishCheck(last.draft, {}, { nowMs: new Date(2026, 9, 4, 7, 40).getTime(), training: tr, knee: [], rand: first });
  assert.match(f.compteRendu.phrase, /^Séance Upper A enregistrée, Monsieur : un exercice, \w+ séries, 40 minutes\./);
  // séance rouverte : compte rendu aussi, sans durée
  const reopened = finishCheck({ ...last.draft, editingId: "p7" }, {}, { nowMs: new Date(2026, 9, 4, 7, 40).getTime(), training: tr, rand: first });
  assert.ok(reopened.compteRendu && reopened.compteRendu.minutes === null);
  assert.ok(!/minutes/.test(reopened.compteRendu.phrase));
});

test("voix, séance rouverte : la dernière série notée porte aussi fin_exercice", () => {
  const tr = [past(7, [S(30, 9), S(30, 8), S(30, 8), S(30, 8)])];
  const c = { training: tr, knee: [], now: Date.UTC(2026, 9, 4, 8), rand: first };
  let dr = { ...newSessionDraft({ type: "Upper A", training: tr, hsrWeek: 9, date: d(7), start: "07:00" }), editingId: "p7" };
  const n = dr.exos[0].series.length;
  let r;
  for (let i = 0; i < n; i++) { r = logSet(dr, { reps: 9, kg: 30 }, c); dr = r.draft; }
  assert.equal(r.finExercice.tendance, "premiere", "la séance rouverte est exclue de sa propre comparaison");
});

test("tendance avec la séance du jour : même règle que l'écran Progrès", () => {
  assert.equal(trendWithToday(ex([S(34, 10), S(34, 10), S(34, 9), S(34, 9)]), { training, date: T0 }), "stable");
});
