// Note par exercice (09/11/2026) : attachée au nom, une note vide disparaît de la clé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withExoNote, notePreview } from "../src/lib/exoNotes.js";
import { DATA_KEYS } from "../src/store.js";

test("note par exercice : écrite, remplacée, retirée si vide, autres notes intactes", () => {
  let n = withExoNote({}, "Squat sur sécurités", "sécurités au trou 7");
  n = withExoNote(n, "Leg extension unilatérale", "siège 4\ndossier 2");
  assert.deepEqual(n, { "Squat sur sécurités": "sécurités au trou 7", "Leg extension unilatérale": "siège 4\ndossier 2" });
  n = withExoNote(n, "Squat sur sécurités", "   ");
  assert.deepEqual(Object.keys(n), ["Leg extension unilatérale"]);
  assert.equal(notePreview(n["Leg extension unilatérale"]), "siège 4");
  assert.equal(notePreview(""), "");
  assert.ok(DATA_KEYS.includes("exoNotes"), "exportée avec les autres données");
});
