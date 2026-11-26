// Recette sans macros (26/11/2026, Honey Cornbread de Yoann) : un miel scanné dont la fiche Open
// Food Facts est vide (énergie 0, aucune macro) comptait pour 0 kcal et vidait P/G/L/Fib de la
// recette sans dire pourquoi. Fiches OFF réelles relevées le 26/11/2026, réseau simulé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getOFFByBarcode } from "../src/nutrition/off.js";
import { recipeMissing, compileRecipe } from "../src/nutrition/foodStore.js";

async function scanned(code, nutriments) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 1, product: { code, product_name: "Produit", nutriments } }) });
  try { return (await getOFFByBarcode(code, { retryDelays: [] })).item; } finally { globalThis.fetch = realFetch; }
}

test("Open Food Facts : fiche vide (énergie 0, aucune macro) = calories inconnues, pas 0", async () => {
  const honey = await scanned("3560070220731", { "energy-kcal_100g": 0, "energy-kj_100g": 0, energy_100g: 0, "added-sugars_100g": 0 });
  assert.deepEqual(honey.per100, { kcal: null, prot: null, gluc: null, lip: null, fib: null });
  // Un vrai 0 kcal avec ses macros (eau, sel) reste 0.
  const water = await scanned("3000000000031", { "energy-kcal_100g": 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 });
  assert.equal(water.per100.kcal, 0);
  // Fiche remplie sans fibres (yaourt nature) : inchangée, fibres inconnues.
  const yog = await scanned("3560071016944", { "energy-kcal_100g": 43, proteins_100g: 4, carbohydrates_100g: 4.2, fat_100g: 1.1 });
  assert.deepEqual(yog.per100, { kcal: 43, prot: 4, gluc: 4.2, lip: 1.1, fib: null });
});

test("recette : l'ingrédient qui vide une valeur est nommé", () => {
  const ing = [
    { ref: "off:3560071016944", name: "Yaourt nature", q: 250, per100: { kcal: 43, prot: 4, gluc: 4.2, lip: 1.1, fib: null } },
    { ref: "off:3560070220731", name: "Miel de fleurs", q: 120, per100: { kcal: null, prot: null, gluc: null, lip: null, fib: null } },
    { ref: "ciqual:22000", name: "Oeuf, cru", q: 240, per100: { kcal: 140, prot: 12.7, gluc: 0.3, lip: 9.8, fib: 0 } },
    { ref: "off:1", name: "Retiré", q: 0, per100: { kcal: null, prot: null, gluc: null, lip: null, fib: null } },
  ];
  assert.deepEqual(recipeMissing(ing), [
    { name: "Yaourt nature", macros: ["fib"] },
    { name: "Miel de fleurs", macros: ["kcal", "prot", "gluc", "lip", "fib"] },
  ]);
  assert.equal(compileRecipe("Test", ing).per100.kcal, null, "kcal inconnues : plus de total sous-estimé");
  assert.deepEqual(recipeMissing([ing[2]]), []);
  assert.deepEqual(recipeMissing(undefined), []);
});
