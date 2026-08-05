// Design system "Affirmée" — jetons et primitives partagés.
//
// Extrait de App.jsx le 01/08/2026, au démarrage du module Nutrition : ces primitives
// étaient locales au fichier unique, donc inutilisables depuis src/nutrition/ sans créer
// un import circulaire. Le code est repris À L'IDENTIQUE, aucun changement visuel.
//
// Règles à tenir (voir CLAUDE.md) : styles en `style={{}}` inline, jamais de classes
// Tailwind dans les composants ; police mono pour TOUS les chiffres ; libellés en
// majuscules, petite taille, letter-spacing large ; accent citron vert et rien d'autre.

import React, { useState, useEffect } from "react";

// Utilitaires de date/format : extraits vers @rawcare/core/dateUtils le 05/08/2026 (chantier
// RawCare Phase 0, purs, zéro dépendance React) — importés ET ré-exportés ici (certaines
// primitives ci-dessous, comme Stepper/DateField, les utilisent aussi localement) pour que
// tout le reste de l'app continue de les importer depuis "./ui.jsx" / "../ui.jsx" sans
// aucun changement.
import { localDateKey, today, shiftDateKey, fmt, round, longDate, byDate, upsert } from "@rawcare/core/dateUtils";
export { localDateKey, today, shiftDateKey, fmt, round, longDate, byDate, upsert };
// lastN/daysBetween/fmtHM : ui.jsx ne les utilise pas lui-même, simple ré-export pour que
// App.jsx puisse continuer à tout importer depuis un seul endroit.
export { lastN, daysBetween, fmtHM } from "@rawcare/core/dateUtils";

/* ---------- jetons de design ---------- */
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

/* ============================================================
   PRIMITIVES UI (design "Affirmée")
   ============================================================ */
export const Card = ({ children, style = {}, accentLeft = false, danger = false, onClick }) => (
  <div onClick={onClick} style={{
    background: danger ? C.dangerBg : C.card,
    border: `1.5px solid ${danger ? C.dangerBorder : C.border}`,
    borderLeft: accentLeft ? `3px solid ${C.accent}` : danger ? `3px solid ${C.danger}` : undefined,
    borderRadius: 10, padding: 14, ...style,
  }}>{children}</div>
);

export const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: C.muted, fontWeight: 700, ...style }}>{children}</div>
);

export const Body = ({ children, style = {} }) => (
  <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.5, ...style }}>{children}</div>
);

export const Big = ({ value, unit, color = C.text, size = 44 }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
    <span style={{ fontFamily: C.mono, fontSize: size, fontWeight: 800, color, letterSpacing: -1 }}>{value}</span>
    {unit && <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{unit}</span>}
  </div>
);

export const Empty = ({ children }) => (
  <div style={{ textAlign: "center", color: C.dim, fontSize: 12, padding: "34px 0" }}>{children}</div>
);

export function Btn({ children, onClick, variant = "outline", style = {}, disabled }) {
  const v = {
    primary: { background: C.accent, color: "#000", border: `1.5px solid ${C.accent}` },
    outline: { background: C.card, color: C.accent, border: `1.5px solid ${C.accent}` },
    plain:   { background: C.card, color: C.text2, border: `1.5px solid ${C.border}` },
    ghost:   { background: "transparent", color: C.muted, border: "1.5px solid transparent" },
    danger:  { background: "transparent", color: C.danger, border: `1.5px solid ${C.dangerBorder}` },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
      opacity: disabled ? 0.4 : 1, fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
}

export const inputStyle = (focused = false) => ({
  background: C.bg, border: `1.5px solid ${focused ? C.accent : C.border}`,
  borderRadius: 6, padding: "8px 10px", fontFamily: C.mono, fontSize: 13,
  color: C.text, fontWeight: 700, width: "100%", outline: "none",
});

export function TextInput({ value, onChange, placeholder, type = "text", inputMode, style = {} }) {
  const [foc, setFoc] = useState(false);
  return (
    <input type={type} inputMode={inputMode} value={value} placeholder={placeholder}
      onChange={onChange} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
      style={{ ...inputStyle(foc), ...style }} />
  );
}

export function Stepper({ value, set, step = 1, unit = "", min = 0, max = null, int = false }) {
  const clamp = (v) => {
    let x = int ? Math.round(v) : round(v, 2);
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };
  const [txt, setTxt] = useState(String(value));
  const [foc, setFoc] = useState(false);
  useEffect(() => { setTxt(String(value)); }, [value]);
  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(",", "."));
    if (isNaN(n)) { setTxt(String(value)); return; }
    const v = clamp(n); set(v); setTxt(String(v));
  };
  const bump = (d) => set(clamp((Number(value) || 0) + d));
  const sq = { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 6,
    color: C.accent, width: 38, height: 36, fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => bump(-step)} style={sq}>–</button>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
        <input type="text" inputMode="decimal" value={txt}
          onChange={(e) => setTxt(e.target.value.replace(",", "."))}
          onFocus={() => setFoc(true)}
          onBlur={(e) => { setFoc(false); commit(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ ...inputStyle(foc), textAlign: "center", fontSize: 16 }} />
        {unit && <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{unit}</span>}
      </div>
      <button onClick={() => bump(step)} style={sq}>+</button>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div>
    <Label style={{ marginBottom: 5 }}>{label}</Label>
    {children}
  </div>
);

// `future` lève le plafond à aujourd'hui : nécessaire pour planifier des repas à venir
// (module Nutrition), mais volontairement PAS le comportement par défaut — sur les autres
// onglets (Poids, Sommeil, Pas, Séances, Genou, Macros), une date future n'a aucun sens,
// ce sont des mesures de ce qui s'est passé, pas des plans.
export const DateField = ({ value, onChange, future = false }) => (
  <Field label="Date">
    <input type="date" value={value} max={future ? undefined : today()} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle(false), fontSize: 13 }} />
  </Field>
);

export function Pills({ options, value, onChange, small = false }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={String(o.key)} onClick={() => onChange(o.key)} style={{
            padding: small ? "5px 10px" : "7px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: small ? 11 : 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
            background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
            border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export const ScreenHeader = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 16, color: C.text, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const chartAxis = { fontSize: 10, fill: C.muted };
export const tooltipStyle = { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text };
// recharts met la valeur en noir par défaut (invisible sur fond sombre) sans itemStyle explicite
export const tooltipItemStyle = { color: C.text, fontWeight: 700 };
