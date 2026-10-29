// Jeffrey (lot JT) : chaque phrase vouvoie, dit « Monsieur », et ne laisse aucun trou.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PHRASES, say, sayError, sayStable } from "../src/lib/jeffrey.js";

test("une erreur déjà dite par Jeffrey n'est pas emballée deux fois", () => {
  const missing = say("aiMissingKey");
  assert.equal(sayError(missing), missing);
  assert.equal(sayError("HTTP 500"), "Je crains un contretemps, Monsieur : HTTP 500");
  assert.match(sayError(""), /cause inconnue/);
});

const NO_MONSIEUR = new Set(["backupReminderTitle"]);

test("chaque phrase s'adresse à Monsieur, sans tutoyer", () => {
  for (const [key, list] of Object.entries(PHRASES)) {
    assert.ok(list.length > 0, key);
    for (const p of list) {
      if (!NO_MONSIEUR.has(key)) assert.match(p, /Monsieur/, `${key} : « ${p} »`);
      // Bornes de mot qui connaissent les accents (\b seul couperait « répè|te »).
      assert.doesNotMatch(p, /(?<!\p{L})(tu|te|ton|ta|tes|toi|ajoute|renseigne|réessaie|essaie|vérifie|attends|colle)(?!\p{L})/iu, `${key} : « ${p} »`);
    }
  }
});

test("les valeurs remplacent les trous, rien ne reste entre accolades", () => {
  const s = say("added", { x: "Skyr · 150 g" });
  assert.ok(s.startsWith("Skyr · 150 g"), s);
  assert.doesNotMatch(say("hcOk", { t: "07:12" }), /\{/);
  assert.equal(say("inconnu"), "inconnu");
});

test("une variante stable reste la même dans la journée", () => {
  const a = sayStable("noData");
  for (let i = 0; i < 20; i++) assert.equal(sayStable("noData"), a);
  assert.ok(PHRASES.noData.includes(a));
});
