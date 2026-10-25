// Règle de couleur d'avancement partagée (25/10/2026) : voir src/lib/progress.js.
import test from "node:test";
import assert from "node:assert/strict";
import { progressState, progressColor, MACRO_KIND } from "../src/lib/progress.js";
import { COLORS } from "../src/design/tokens.js";

test("limite (calories, glucides, lipides) : citron ≤ cible, orange jusqu'à +10 %, rouge au-delà", () => {
  assert.equal(progressState(2470, 2470, "limit"), "under");
  assert.equal(progressState(2471, 2470, "limit"), "over-light");
  assert.equal(progressState(2717, 2470, "limit"), "over-light"); // +10 % pile
  assert.equal(progressState(2718, 2470, "limit"), "over-heavy");
  assert.equal(progressColor(2600, 2470, "limit"), COLORS.warn);
  assert.equal(progressColor(3000, 2470, "limit"), COLORS.danger);
  assert.equal(progressColor(1200, 2470, "limit"), COLORS.accent);
});

test("objectif (pas, eau, protéines, fibres) : citron avant la cible, bleu dès qu'elle est atteinte", () => {
  assert.equal(progressColor(9999, 10000, "goal"), COLORS.accent);
  assert.equal(progressColor(10000, 10000, "goal"), COLORS.over);
  assert.equal(progressColor(25000, 10000, "goal"), COLORS.over); // jamais rouge
  assert.equal(MACRO_KIND.prot, "goal"); assert.equal(MACRO_KIND.fib, "goal");
  assert.equal(MACRO_KIND.gluc, "limit"); assert.equal(MACRO_KIND.lip, "limit");
});

test("valeur ou cible absente : pas de couleur d'alerte", () => {
  assert.equal(progressState(null, 2470, "limit"), "under");
  assert.equal(progressState(3000, 0, "limit"), "under");
});
