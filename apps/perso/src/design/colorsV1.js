// Jetons de couleur v1 (« Affirmée » d'avant le design system v2), sortis de ui.jsx le
// 17/11/2026 SANS AUCUN CHANGEMENT de valeur : ui.jsx et lib/helpers.js les importent d'ici, ce
// qui rend helpers.js lisible par les tests Node (ui.jsx contient du JSX) — besoin de
// l'instantané envoyé à la montre (lib/watchSnapshot.js), qui doit reprendre les mêmes couleurs.
export const C = {
  bg: "#050505",
  card: "#121212",
  border: "#2a2a2a",
  borderDim: "#232323",
  divider: "#1c1c1c",
  accent: "#d7ff3f",
  accentRow: "#0d1000",
  text: "#f5f5f0",
  text2: "#8a8a84",
  muted: "#6b6b66",
  dim: "#4a4a46",
  danger: "#ff3b30",
  dangerBg: "#1a0e0c",
  dangerBorder: "#4a1c14",
  dangerText: "#cc9999",
  mono: "ui-monospace, Menlo, Monaco, monospace",
};
