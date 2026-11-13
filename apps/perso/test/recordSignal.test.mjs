// Record coché à l'écran → signal vers JEFFREY (13/11/2026, choix de Yoann : « le mélange des
// deux, seulement casque branché »). Règles pures : quand le signal part, ce qu'il porte, une
// seule fois par série. Le casque est vérifié côté natif (JeffreySignal.sendRecord).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { recordPayload, recordDetail, firstTime, resetRecordSignals } from "../src/lib/recordSignal.js";

const S = (poids, val, fait = true, leg = null) => ({ poids, val, fait, leg });
const exo = (series, extra = {}) => ({ nom: "Développé incliné haltères", mode: "reps", series, ...extra });
const ref = { poids: 30, val: 9 };
const date = "2026-11-13";

beforeEach(() => resetRecordSignals());

test("série cochée qui bat le record : charge utile complète, phrase de détail", () => {
  const after = [exo([S(32, 8), S(30, 8, false)])];
  const p = recordPayload({ after, ei: 0, si: 0, ref, date });
  assert.deepEqual(p, {
    date, exercice: "Développé incliné haltères", kg: 32, reps: 8,
    ancien: { kg: 30, reps: 9 },
    detail: "Nouveau record de développé incliné haltères : 32 kilos, 8 répétitions.",
  });
});

test("pas de signal : égalité, série plus faible, série non cochée, sans record connu, genou hors base", () => {
  assert.equal(recordPayload({ after: [exo([S(30, 9)])], ei: 0, si: 0, ref, date }), null, "égaler n'est pas battre");
  assert.equal(recordPayload({ after: [exo([S(28, 10)])], ei: 0, si: 0, ref, date }), null);
  assert.equal(recordPayload({ after: [exo([S(40, 8, false)])], ei: 0, si: 0, ref, date }), null);
  assert.equal(recordPayload({ after: [exo([S(40, 8)])], ei: 0, si: 0, ref: null, date }), null, "première fois = référence");
  assert.equal(recordPayload({ after: [exo([S(40, 8)])], ei: 0, si: 0, ref, painRed: true, date }), null);
});

test("deuxième record dans la même séance : l'ancien record est la série précédente", () => {
  const p = recordPayload({ after: [exo([S(32, 8), S(32, 10)])], ei: 0, si: 1, ref, date });
  assert.deepEqual(p.ancien, { kg: 32, reps: 8 });
  assert.equal(recordPayload({ after: [exo([S(32, 8), S(32, 7)])], ei: 0, si: 1, ref, date }), null, "ne bat pas la 1re série");
});

test("exercice en durée, au poids du corps, jambe par jambe, demi-kilo", () => {
  const t = recordPayload({ after: [{ nom: "Core — Planche", mode: "temps", series: [S(0, 75)] }], ei: 0, si: 0, ref: { poids: 0, val: 60 }, date });
  assert.equal(t.secondes, 75);
  assert.deepEqual(t.ancien, { secondes: 60 });
  assert.equal(t.detail, "Nouveau record de core, Planche : 75 secondes.");
  assert.equal(recordDetail({ nom: "Squat", mode: "reps" }, S(0, 12)), "Nouveau record de squat : 12 répétitions.");
  const l = recordPayload({ after: [{ nom: "Leg extension unilatérale", mode: "reps", series: [S(40, 10, true, "G")] }], ei: 0, si: 0, ref: { poids: 35, val: 10 }, date });
  assert.equal(l.jambe, "G");
  assert.equal(l.detail, "Nouveau record de leg extension unilatérale, jambe gauche : 40 kilos, 10 répétitions.");
  assert.equal(recordDetail(exo([]), S(32.5, 1)), "Nouveau record de développé incliné haltères : 32,5 kilos, 1 répétition.");
});

test("une seule fois par série et par valeurs : décocher puis recocher ne répète pas", () => {
  const p = recordPayload({ after: [exo([S(32, 8)])], ei: 0, si: 0, ref, date });
  assert.equal(firstTime(p), true);
  assert.equal(firstTime({ ...p }), false);
  assert.equal(firstTime({ ...p, reps: 9 }), true, "autres valeurs : nouveau record");
});
