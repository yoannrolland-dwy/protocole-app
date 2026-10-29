import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numberToFrench, decimalToFrench, normalizeFrench, cleanForSpeech, createSentenceSplitter, speechChunks, speechKey,
} from "../src/coach/speechText.js";

test("nombres en toutes lettres", () => {
  const cases = {
    0: "zéro", 1: "un", 17: "dix-sept", 21: "vingt et un", 70: "soixante-dix", 71: "soixante et onze",
    77: "soixante-dix-sept", 80: "quatre-vingts", 81: "quatre-vingt-un", 91: "quatre-vingt-onze",
    100: "cent", 200: "deux cents", 201: "deux cent un", 1000: "mille", 2400: "deux mille quatre cents",
    80000: "quatre-vingt mille", 10000: "dix mille", 1000000: "un million",
  };
  for (const [n, w] of Object.entries(cases)) assert.equal(numberToFrench(Number(n)), w, n);
  assert.equal(decimalToFrench("93,8"), "quatre-vingt-treize virgule huit");
  assert.equal(decimalToFrench("1.05"), "un virgule zéro cinq");
  assert.equal(decimalToFrench("0,25"), "zéro virgule vingt-cinq");
});

test("unités, heures, notes, dates, signes", () => {
  assert.equal(normalizeFrench("93,8 kg"), "quatre-vingt-treize virgule huit kilos");
  assert.equal(normalizeFrench("2 400 kcal/j"), "deux mille quatre cents kilocalories par jour");
  assert.equal(normalizeFrench("1,5 kg"), "un virgule cinq kilo");
  assert.equal(normalizeFrench("−0,3 kg/sem"), "moins zéro virgule trois kilo par semaine");
  assert.equal(normalizeFrench("+150 kcal"), "plus cent cinquante kilocalories");
  assert.equal(normalizeFrench("réveil à 5h17"), "réveil à cinq heures dix-sept");
  assert.equal(normalizeFrench("21h"), "vingt et une heures");
  assert.equal(normalizeFrench("à 6h01"), "à six heures une");
  assert.equal(normalizeFrench("douleur 3/10"), "douleur trois sur dix");
  assert.equal(normalizeFrench("qualité 4/4"), "qualité quatre sur quatre");
  assert.equal(normalizeFrench("le 29/10"), "le vingt-neuf octobre");
  assert.equal(normalizeFrench("8-12 reps"), "huit à douze reps");
  assert.equal(normalizeFrench("20 %"), "vingt pour cent");
  assert.equal(normalizeFrench("60 kg × 8"), "soixante kilos fois huit");
  assert.equal(normalizeFrench("la 2e série et la 1re"), "la deuxième série et la première");
  assert.equal(normalizeFrench("45 min de marche, 60 s"), "quarante-cinq minutes de marche, soixante secondes");
  assert.equal(normalizeFrench("≈ 2 L"), "environ deux litres");
  // Pas d'unité inventée au début d'un mot.
  assert.equal(normalizeFrench("3 séances, 2 jours"), "trois séances, deux jours");
});

test("mise en forme retirée", () => {
  assert.equal(cleanForSpeech("**Bonjour** Monsieur 👋"), "Bonjour Monsieur");
  assert.equal(cleanForSpeech("## Titre\n- point un\n2. point deux"), "Titre\npoint un\npoint deux");
});

test("découpage au fil de l'eau, relance, carnet", () => {
  const out = [];
  const sp = createSentenceSplitter((s) => out.push(s));
  sp.feed("Bonjour Monsieur. Vous ");
  assert.deepEqual(out, []); // « Bonjour Monsieur. » est trop court : il attend la phrase suivante
  sp.feed("Bonjour Monsieur. Vous avez bien dormi cette nuit. Le genou");
  assert.deepEqual(out, ["Bonjour Monsieur. Vous avez bien dormi cette nuit."]);
  sp.feed("Bonjour Monsieur. Vous avez bien dormi cette nuit. Le genou tient bien, Monsieur. ");
  assert.equal(out.at(-1), "Le genou tient bien, Monsieur.");
  // Relance d'une réponse muette : un texte qui ne prolonge pas le précédent repart de zéro.
  sp.feed("Autre réponse complète, Monsieur.");
  sp.flush();
  assert.equal(out.at(-1), "Autre réponse complète, Monsieur.");
  // Rien après le marqueur du carnet.
  const c = speechChunks("Point du jour, Monsieur : tout va bien.\n---CARNET---\nprogression 93,8 kg");
  assert.deepEqual(c, ["Point du jour, Monsieur : tout va bien."]);
});

test("texte complet prêt à dire et clé de cache stable", () => {
  const chunks = speechChunks("Bonjour Monsieur. Pesée à 93,8 kg ce matin, nuit de 6h01.");
  assert.deepEqual(chunks, ["Bonjour Monsieur. Pesée à quatre-vingt-treize virgule huit kilos ce matin, nuit de six heures une."]);
  assert.equal(speechKey(chunks), speechKey([...chunks]));
  assert.notEqual(speechKey(chunks), speechKey(["autre"]));
  assert.match(speechKey(chunks), /^[0-9a-f]{16}$/);
  // Une longue phrase est coupée sous 240 caractères.
  const long = speechChunks(`${"mot ".repeat(50)}, ${"autre ".repeat(30)}fin.`);
  assert.ok(long.length >= 2 && long.every((s) => s.length <= 240));
});
