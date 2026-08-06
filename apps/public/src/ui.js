// Jetons du design system "Affirmée" (voir CLAUDE.md) — sous-ensemble minimal pour les
// premiers écrans d'auth de apps/public. Pas de composants ici, juste les couleurs/styles
// de base ; à étoffer au fur et à mesure des écrans réels (schéma/features décidés).
export const C = {
  bg: "#050505",
  card: "#121212",
  border: "#2a2a2a",
  accent: "#d7ff3f",
  danger: "#ff3b30",
  text: "#f5f5f0",
  secondary: "#8a8a84",
  muted: "#6b6b66",
  dim: "#4a4a46",
  mono: "ui-monospace, Menlo, Monaco, monospace",
};

export const inputStyle = {
  width: "100%",
  background: "#0a0a0a",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  color: C.text,
  fontFamily: C.mono,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

export const buttonPrimary = {
  width: "100%",
  background: C.accent,
  color: "#050505",
  border: "none",
  borderRadius: 8,
  padding: "12px 16px",
  fontWeight: 700,
  fontFamily: C.mono,
  fontSize: 14,
  cursor: "pointer",
};

export const labelStyle = {
  fontFamily: C.mono,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  color: C.muted,
  marginBottom: 6,
  display: "block",
};
