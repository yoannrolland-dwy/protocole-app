// Fin de repos dite par Jeffrey (31/10/2026) : la série qui vient, sinon l'exercice suivant,
// sinon la fin de la séance. Nom lisible à voix haute, élision « d' ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAfter, restAnnouncement, spokenName, ofName } from "../src/lib/restSpeech.js";

const ex = (nom, faits, extra = {}) => ({ nom, series: faits.map((f) => ({ fait: f, leg: null })), ...extra });

test("série suivante du même exercice, puis exercice suivant, puis fin", () => {
  const exos = [ex("Développé incliné haltères", [true, false, false]), ex("Face pull", [false, false])];
  assert.deepEqual(nextAfter(exos, 0, 1), { kind: "set", nom: "Développé incliné haltères", n: 3, leg: null });
  assert.deepEqual(nextAfter([ex("A", [true, true]), ex("B", [false])], 0, 1), { kind: "exercise", nom: "B" });
  assert.deepEqual(nextAfter([ex("A", [true, false])], 0, 1), { kind: "done" });
  // -1 : bouton « Repos » sans série cochée → prochaine série non faite.
  assert.equal(nextAfter(exos, 0, -1).n, 2);
  // Une option pas commencée est sautée ; on repart du début si besoin.
  const opt = [ex("Iso", [false], { opt: true }), ex("Presse", [false, false]), ex("Leg ext", [true])];
  assert.deepEqual(nextAfter(opt, 2, 0), { kind: "exercise", nom: "Presse" });
});

test("phrase dite : série en chiffres, nom sans parenthèses, élision", () => {
  assert.equal(spokenName("Presse à cuisses (HSR)"), "presse à cuisses");
  assert.equal(spokenName("Iso leg extension @60° (si genou raide)"), "iso leg extension à 60°");
  assert.equal(spokenName("Core — Planche"), "core, Planche");
  assert.equal(ofName("Élévations latérales poulie"), "d'élévations latérales poulie");
  assert.equal(ofName("Hip thrust"), "de hip thrust");
  const s = restAnnouncement([ex("Développé incliné haltères", [true, false])], 0, 0);
  assert.match(s, /Monsieur/);
  assert.match(s, /série 2 de développé incliné haltères/i);
  assert.doesNotMatch(s, /\{/);
  assert.match(restAnnouncement([ex("A", [true])], 0, 0), /valider la séance/);
});
