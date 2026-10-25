// Garde-fous du design system v2 (chantier U, U2, 25/10/2026) : un jeton qui ferait
// retomber un texte sous le contraste lisible bloque le commit (hook pre-commit).
import test from "node:test";
import assert from "node:assert/strict";
import { COLORS, TEXT_PAIRS, TYPE, TOUCH, cssVars, T } from "../src/design/tokens.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hex(c).map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("chaque paire texte/fond atteint 4,5:1", () => {
  for (const [fg, bg] of TEXT_PAIRS) {
    assert.ok(COLORS[fg] && COLORS[bg], `jeton inconnu : ${fg} / ${bg}`);
    const r = ratio(COLORS[fg], COLORS[bg]);
    assert.ok(r >= 4.5, `${fg} sur ${bg} : ${r.toFixed(2)}:1 (< 4,5:1)`);
  }
});

test("les anciens gris illisibles ne reviennent pas comme couleur de texte", () => {
  const texts = new Set(TEXT_PAIRS.map(([fg]) => COLORS[fg]));
  for (const old of ["#6b6b66", "#4a4a46", "#8a8a84"]) assert.ok(!texts.has(old), old);
});

test("plancher typographique 12 px et cible tactile 48 px", () => {
  for (const [k, v] of Object.entries(TYPE)) assert.ok(v >= 12, `${k} = ${v}px`);
  assert.ok(TYPE.bodyL >= 16, "saisie à 16 px minimum (sinon Android zoome sur le champ)");
  assert.ok(TOUCH >= 48);
});

test("variables CSS et jetons en ligne pointent les mêmes noms", () => {
  const css = cssVars();
  assert.match(css, /--c-text2: #bdbdb4;/);
  assert.match(css, /--c-on-accent: #0a0a0a;/);
  assert.match(css, /--t-label: 12px;/);
  assert.equal(T.c.onAccent, "var(--c-on-accent)");
  for (const name of Object.values(T.c)) {
    const v = name.slice(4, -1);
    assert.ok(css.includes(`${v}:`), `${v} absent de cssVars()`);
  }
});
