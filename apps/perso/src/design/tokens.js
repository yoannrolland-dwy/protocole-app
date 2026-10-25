// Design system v2, direction A « Affirmée mûrie » (chantier U, étape U2, 25/10/2026).
// Source UNIQUE des jetons : `applyTheme()` les pose en variables CSS au démarrage
// (main.jsx), `T` (ui.jsx) les expose en `var(--…)` pour le style en ligne, et
// apps/perso/test/tokens.test.mjs vérifie les contrastes. Fichier JS pur (aucun JSX,
// aucun import) pour rester lisible par Node.
//
// L'ancien objet `C` (ui.jsx) reste en place tant que les écrans n'ont pas migré (U3).

export const COLORS = {
  bg: "#050505",        // fond de l'app
  card: "#131312",      // cartes
  raised: "#22221f",    // boutons « plain », pistes de barres
  field: "#0b0b0a",     // fond des champs de saisie
  line: "#34342f",      // bordures de champs, séparateurs
  lineSoft: "#262623",  // bordures de cartes
  text: "#f5f5f0",
  text2: "#bdbdb4",     // texte secondaire (9,8:1 sur carte, contre 3,5:1 avant)
  muted: "#96968d",     // texte discret (6,2:1 sur carte, contre 2,1:1 pour l'ancien dim)
  accent: "#d7ff3f",    // citron : actions et ce qui compte aujourd'hui, jamais décoratif
  onAccent: "#0a0a0a",  // texte posé sur le citron
  accentLine: "#4a5a12", // bordure d'une carte mise en avant
  accentRow: "#0d1000", // fond d'une ligne sélectionnée
  warn: "#f2a33a",
  over: "#5ab4ff",      // objectif atteint/dépassé (pas, eau, protéines, fibres) — 25/10/2026
  danger: "#ff5a4f",
  dangerBg: "#1a0e0c",
  dangerLine: "#5a2218",
};

// Paires texte/fond réellement utilisées : le test exige 4,5:1 pour chacune.
export const TEXT_PAIRS = [
  ["text", "bg"], ["text", "card"], ["text", "raised"], ["text", "field"],
  ["text2", "bg"], ["text2", "card"], ["text2", "raised"],
  ["muted", "bg"], ["muted", "card"],
  ["accent", "bg"], ["accent", "card"], ["onAccent", "accent"],
  ["warn", "card"], ["danger", "card"], ["danger", "dangerBg"],
  ["over", "card"], ["over", "bg"], ["over", "raised"],
];

export const FONTS = {
  body: '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  num: '"JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
};

// Échelle typographique en px. Plancher 12 px (audit U1 : 57-94 % du texte sous 12 px).
export const TYPE = {
  label: 12,   // libellés en capitales, letter-spacing large
  small: 13,   // texte secondaire
  body: 15,
  bodyL: 16,   // boutons, saisie (16 px : Android ne zoome pas sur le champ)
  title: 20,
  h1: 22,
  numM: 22,
  numL: 34,
  numXL: 40,   // minuteur de repos
};

export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 };
export const RADIUS = { sm: 8, md: 12, lg: 14, pill: 999 };
export const TOUCH = 48; // cible tactile minimale (px)

// "camelCase" -> "camel-case" pour les noms de variables CSS.
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

export function cssVars() {
  const lines = [];
  for (const [k, v] of Object.entries(COLORS)) lines.push(`--c-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(FONTS)) lines.push(`--f-${k}: ${v};`);
  for (const [k, v] of Object.entries(TYPE)) lines.push(`--t-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(SPACE)) lines.push(`--s-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(RADIUS)) lines.push(`--r-${k}: ${v}px;`);
  lines.push(`--touch: ${TOUCH}px;`);
  return `:root {\n  ${lines.join("\n  ")}\n}`;
}

// Jetons en `var(--…)` pour le style en ligne. Attention : pas utilisables dans un
// ATTRIBUT SVG (fill/stroke de recharts) — y passer `COLORS.x` directement.
export const T = {
  c: Object.fromEntries(Object.keys(COLORS).map((k) => [k, `var(--c-${kebab(k)})`])),
  f: Object.fromEntries(Object.keys(FONTS).map((k) => [k, `var(--f-${k})`])),
};

export function applyTheme(doc = document) {
  const el = doc.createElement("style");
  el.id = "protocole-tokens";
  el.textContent = cssVars();
  doc.head.appendChild(el);
}
