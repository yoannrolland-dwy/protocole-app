// Alcool d'une boisson (26/11/2026, demande de Yoann) : grammes et kcal affichés sur la ligne du
// Journal, seulement s'il y en a ; degré lu sur Open Food Facts. Valeurs OFF réelles relevées le
// 26/11/2026 (Heineken 5 % vol / 42 kcal, Leffe Blonde 6,6 / 58, Johnnie Walker Red 40 / 221).
import { test } from "node:test";
import assert from "node:assert/strict";
import { offAlcohol } from "../src/nutrition/off.js";
import { alcoholOf, makeEntry, alcoholGramsFor } from "../src/nutrition/foodStore.js";

test("Open Food Facts : degré (% vol) → grammes pour 100 g (× 0,789)", () => {
  assert.equal(offAlcohol({ alcohol_100g: 5, alcohol_unit: "% vol" }, 42), 3.9);
  assert.equal(offAlcohol({ alcohol_100g: 6.6, alcohol_unit: "% vol" }, 58), 5.2);
  assert.equal(offAlcohol({ alcohol_100g: 40, alcohol_unit: "% vol" }, 221), 31.6);
  assert.equal(offAlcohol({ alcohol_100g: 5 }, 42), 3.9, "unité absente : degré");
});

test("Open Food Facts : rien d'affiché si absent, autre unité ou incohérent", () => {
  assert.equal(offAlcohol({}, 42), null);
  assert.equal(offAlcohol({ alcohol_100g: 0 }, 42), null);
  assert.equal(offAlcohol({ alcohol_100g: 5, alcohol_unit: "g" }, 42), null);
  assert.equal(offAlcohol({ alcohol_100g: 40, alcohol_unit: "% vol" }, 100), null, "221 kcal d'alcool dans 100 kcal : faux");
  assert.equal(offAlcohol({ alcohol_100g: 150 }, 500), null);
});

const p = (alcool) => ({ kcal: 42, prot: 0.4, gluc: 3.2, lip: 0, fib: 0, ...(alcool != null ? { alcool } : {}) });

test("ligne du journal : grammes et kcal (7 kcal/g), rien sans alcool", () => {
  assert.deepEqual(alcoholOf({ q: 500, per100: p(3.9) }), { g: 19.5, kcal: 137 });
  assert.equal(alcoholOf({ q: 500, per100: p() }), null);
  assert.equal(alcoholOf({ q: 500, per100: p(0) }), null);
  assert.equal(alcoholOf({ q: 0, per100: p(3.9) }), null);
});

test("un produit scanné avec degré garde son alcool dans le journal (Coach, Analyse)", () => {
  const e = makeEntry({ date: "2026-11-26", meal: "diner", food: { ref: "off:8712000900045", name: "Heineken", per100: p(3.9) }, q: 330 });
  assert.equal(e.per100.alcool, 3.9);
  assert.equal(alcoholGramsFor([e], "2026-11-26"), 12.9);
  const water = makeEntry({ date: "2026-11-26", meal: "diner", food: { ref: "off:1", name: "Eau", per100: p() }, q: 330 });
  assert.equal("alcool" in water.per100, false, "sans alcool : pas de champ");
});
