// Photo d'un plat : détail de l'estimation (13/11/2026). Réponses d'IA inventées, aucun réseau.
import test from "node:test";
import assert from "node:assert/strict";
import { DISH_PROMPT, buildDishUserText, extractJson, readDishEstimate, DISH_MAX_LINES } from "../src/nutrition/dishEstimate.js";

const line = (aliment, grammes, kcal, prot, gluc, lip, fib) => ({ aliment, grammes, kcal, prot, gluc, lip, fib });
const full = {
  lisible: true, nom: "Poulet rôti, riz, brocolis",
  kcal: 640, prot: 52, gluc: 62, lip: 19, fib: 6,
  detail: [
    line("Poulet rôti sans peau", 150, 248, 46, 0, 6.5, 0),
    line("Riz basmati cuit", 180, 234, 4.9, 51.5, 0.5, 0.7),
    line("Brocolis vapeur", 120, 42, 3.4, 5, 0.5, 3.1),
    line("Huile d'olive (cuisson)", 10, 90, 0, 0, 10, 0),
  ],
  explication: "Carte de fidélité utilisée comme échelle.\nAssiette d'environ 26 cm.   L'huile de cuisson est le point le plus incertain.",
};

test("la consigne demande le détail ligne par ligne et l'explication, plus « ne détaille pas »", () => {
  assert.match(DISH_PROMPT, /"detail":\[\{"aliment":string,"grammes":number/);
  assert.match(DISH_PROMPT, /"explication":string/);
  assert.match(DISH_PROMPT, /somme des lignes/);
  assert.doesNotMatch(DISH_PROMPT, /ne détaille pas ton raisonnement/);
  // Ce qui existait reste : carte comme échelle, priorité à la note, plat illisible.
  assert.match(DISH_PROMPT, /85,6 × 54 mm/);
  assert.match(DISH_PROMPT, /PRIORISE/);
  assert.match(DISH_PROMPT, /"lisible" à false/);
  assert.match(buildDishUserText("  riz 150 g "), /Note complémentaire de l'utilisateur : riz 150 g$/);
  assert.doesNotMatch(buildDishUserText(""), /Note complémentaire/);
});

test("détail complet : le total est la somme des lignes, l'explication tient sur une ligne", () => {
  const e = readDishEstimate(full);
  assert.equal(e.fromDetail, true);
  assert.equal(e.detail.length, 4);
  // Somme des lignes (614), pas le total annoncé (640) : ce qui est lu s'additionne.
  assert.deepEqual([e.kcal, e.prot, e.gluc, e.lip, e.fib], [614, 54.3, 56.5, 17.5, 3.8]);
  assert.equal(e.nom, "Poulet rôti, riz, brocolis");
  assert.equal(e.explication, "Carte de fidélité utilisée comme échelle. Assiette d'environ 26 cm. L'huile de cuisson est le point le plus incertain.");
  assert.deepEqual(e.detail[1], { aliment: "Riz basmati cuit", grammes: 180, kcal: 234, prot: 4.9, gluc: 51.5, lip: 0.5, fib: 0.7 });
});

test("réponse à l'ancien format (sans détail) : total annoncé gardé, rien à afficher en plus", () => {
  const e = readDishEstimate({ lisible: true, nom: "Salade", kcal: 320, prot: 12, gluc: 20, lip: 21, fib: 5 });
  assert.equal(e.fromDetail, false);
  assert.deepEqual(e.detail, []);
  assert.equal(e.explication, "");
  assert.deepEqual([e.kcal, e.prot, e.gluc, e.lip, e.fib], [320, 12, 20, 21, 5]);
});

test("détail abîmé : la somme ne remplace pas le total annoncé", () => {
  // Une macro manque sur une ligne.
  const partial = readDishEstimate({ ...full, detail: [full.detail[0], { aliment: "Riz", grammes: 180, kcal: 234 }] });
  assert.equal(partial.fromDetail, false);
  assert.equal(partial.kcal, 640);
  assert.equal(partial.detail.length, 2);
  assert.equal(partial.detail[1].prot, null);
  // Une ligne sans nom ou sans kcal est écartée : somme incomplète, total annoncé gardé.
  const dropped = readDishEstimate({ ...full, detail: [...full.detail, { aliment: "", kcal: 50 }, { aliment: "Sauce" }, null, "pain"] });
  assert.equal(dropped.detail.length, 4);
  assert.equal(dropped.fromDetail, false);
  assert.equal(dropped.kcal, 640);
  // Valeurs négatives ou textes : écartés, jamais additionnés.
  const bad = readDishEstimate({ ...full, detail: [line("Riz", "beaucoup", -5, 1, 1, 1, 1)] });
  assert.deepEqual(bad.detail, []);
  // Trop de lignes : coupées à l'affichage, donc pas de somme.
  const many = readDishEstimate({ ...full, detail: Array.from({ length: DISH_MAX_LINES + 3 }, (_, i) => line(`Aliment ${i}`, 10, 10, 1, 1, 0, 0)) });
  assert.equal(many.detail.length, DISH_MAX_LINES);
  assert.equal(many.fromDetail, false);
  // Chiffres donnés en texte : lus quand même.
  const strings = readDishEstimate({ lisible: true, nom: "Bol", detail: [line("Skyr", "150", "95", "16", "6", "0", "0")] });
  assert.equal(strings.fromDetail, true);
  assert.equal(strings.kcal, 95);
});

test("plat illisible ou réponse vide : rien ; JSON entouré de texte lu quand même", () => {
  assert.equal(readDishEstimate({ lisible: false, nom: "", kcal: 0 }), null);
  assert.equal(readDishEstimate(null), null);
  assert.equal(readDishEstimate("texte"), null);
  assert.equal(readDishEstimate({ lisible: true }).nom, "Plat");
  const raw = "Voici :\n```json\n" + JSON.stringify(full) + "\n```";
  assert.equal(readDishEstimate(extractJson(raw)).kcal, 614);
  assert.throws(() => extractJson("pas de json"));
});
