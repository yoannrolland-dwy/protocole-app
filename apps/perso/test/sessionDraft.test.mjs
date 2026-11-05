// G4-C2 (05/11/2026) : le brouillon de séance est la source de vérité ; une écriture d'une autre
// page se reconnaît à son numéro (`rev`).
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const { readDraft, writeDraft, patchDraft, isForeign, acknowledge } = await import("../src/lib/sessionDraft.js");
const raw = () => JSON.parse(localStorage.getItem("protocole:trainingDraft"));

test("écriture : rev augmente, les champs sont gardés dans le même ordre", () => {
  const d = writeDraft({ type: "Upper A", date: "2026-11-05", editingId: null, start: "07:00", duration: 60, rpe: 7, exos: [] });
  assert.equal(d.rev, 1);
  assert.deepEqual(Object.keys(raw()), ["type", "date", "editingId", "start", "duration", "rpe", "exos", "rev"]);
  assert.equal(patchDraft({ start: "07:05" }).rev, 2);
  assert.equal(readDraft().start, "07:05");
  assert.equal(isForeign(readDraft()), false, "écrit par cette page");
});

test("écriture d'une autre page : reconnue, puis acquittée", () => {
  const other = { ...readDraft(), rev: readDraft().rev + 1, exos: [{ nom: "X", series: [{ poids: 32, val: 8, fait: true, leg: null }] }] };
  localStorage.setItem("protocole:trainingDraft", JSON.stringify(other));
  assert.equal(isForeign(readDraft()), true);
  acknowledge(readDraft());
  assert.equal(isForeign(readDraft()), false);
  // L'écriture suivante de cette page part du brouillon stocké (rev suivant, série gardée).
  const next = patchDraft({ rpe: 8 });
  assert.equal(next.rev, other.rev + 1);
  assert.equal(next.exos[0].series[0].fait, true);
});

test("sans brouillon : patch sans effet", () => {
  localStorage.removeItem("protocole:trainingDraft");
  assert.equal(patchDraft({ rpe: 5 }), null);
  assert.equal(readDraft(), null);
  assert.equal(isForeign(null), false);
});
