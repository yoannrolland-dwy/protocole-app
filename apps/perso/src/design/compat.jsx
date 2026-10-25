// Primitives v1 au rendu v2 (chantier U, U3 étape 5, 25/10/2026). Mêmes NOMS et mêmes
// signatures que ui.jsx (C, Card, Label, Body, Big, Empty, Btn, Stepper, Field, DateField,
// Pills, ScreenHeader, chartAxis…), mais valeurs du design system v2 : un écran migre en
// changeant sa ligne d'import, sans toucher à sa logique (Corps, puis Séances, Analyse,
// Réglages). Les couleurs de `C` sont des hex bruts, donc utilisables dans les attributs SVG
// de recharts (`var(--…)` n'y marche pas).
import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { COLORS, FONTS } from "./tokens.js";
import { today, round } from "../ui.jsx";

export { today, fmt, round, upsert, lastN, daysBetween, fmtHM, longDate, byDate, shiftDateKey } from "../ui.jsx";

// Mêmes clés que le `C` v1. `dim` (2,1:1 en v1) devient le gris discret lisible v2.
export const C = {
  bg: COLORS.bg, card: COLORS.card, border: COLORS.line, borderDim: COLORS.lineSoft, divider: COLORS.lineSoft,
  accent: COLORS.accent, accentRow: COLORS.accentRow, text: COLORS.text, text2: COLORS.text2,
  muted: COLORS.muted, dim: COLORS.muted, danger: COLORS.danger, dangerBg: COLORS.dangerBg,
  dangerBorder: COLORS.dangerLine, dangerText: COLORS.danger, warn: COLORS.warn, mono: FONTS.num,
};

// Avec `onClick`, la carte est un vrai bouton (cible tactile, focus, lecteur d'écran) — un
// <div> cliquable passait inaperçu des mesures d'U1/U4 (trouvé après U4).
export const Card = ({ children, style = {}, accentLeft = false, danger = false, onClick }) => {
  const cls = `p-card${danger ? " p-card--danger" : ""}`;
  const st = { borderLeft: accentLeft ? `3px solid ${C.accent}` : danger ? `3px solid ${C.danger}` : undefined, ...style };
  if (!onClick) return <div className={cls} style={st}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={`p-tap ${cls}`}
      style={{ display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", color: C.text, ...st }}>{children}</button>
  );
};

export const Label = ({ children, style = {} }) => <div className="p-label" style={style}>{children}</div>;

export const Body = ({ children, style = {} }) => (
  <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.45, ...style }}>{children}</div>
);

export const Big = ({ value, unit, color = C.text, size = 40 }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
    <span style={{ fontFamily: C.mono, fontVariantNumeric: "tabular-nums", fontSize: size, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{value}</span>
    {unit && <span style={{ fontSize: 14, color: C.text2, fontWeight: 600 }}>{unit}</span>}
  </div>
);

export const Empty = ({ children }) => (
  <div style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "28px 0" }}>{children}</div>
);

const BTN = { primary: "primary", outline: "outline", plain: "plain", ghost: "plain", danger: "danger" };
export function Btn({ children, onClick, variant = "outline", style = {}, disabled, ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`p-tap p-btn p-btn--${BTN[variant] ?? "plain"}`}
      style={style} {...rest}>{children}</button>
  );
}

export const inputStyle = () => ({
  background: COLORS.field, border: `1.5px solid ${C.border}`, borderRadius: 8,
  minHeight: 52, padding: "0 12px", fontFamily: C.mono, fontSize: 16, color: C.text, fontWeight: 700, width: "100%", outline: "none",
});

export function TextInput({ value, onChange, placeholder, type = "text", inputMode, style = {} }) {
  return (
    <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={onChange}
      className="p-field" style={{ fontFamily: FONTS.body, fontWeight: 600, ...style }} />
  );
}

// Même comportement que le Stepper v1 (frappe libre, validation et bornes à la sortie du
// champ ou sur Entrée), en 52 px.
export function Stepper({ value, set, step = 1, unit = "", min = 0, max = null, int = false }) {
  const clamp = (v) => {
    let x = int ? Math.round(v) : round(v, 2);
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);
  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(",", "."));
    if (isNaN(n)) { setTxt(String(value)); return; }
    const v = clamp(n); set(v); setTxt(String(v));
  };
  const bump = (d) => set(clamp((Number(value) || 0) + d));
  const sq = { width: 52, height: 52, flexShrink: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" className="p-tap p-iconbtn" aria-label={`Moins ${step}`} onClick={() => bump(-step)} style={sq}><Minus size={20} aria-hidden="true" /></button>
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <input type="text" inputMode="decimal" enterKeyHint="done" value={txt} className="p-field"
          onChange={(e) => setTxt(e.target.value.replace(",", "."))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ textAlign: "center", fontSize: 20, paddingRight: unit ? 40 : 12 }} />
        {unit && <span aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.muted, fontWeight: 700 }}>{unit}</span>}
      </div>
      <button type="button" className="p-tap p-iconbtn" aria-label={`Plus ${step}`} onClick={() => bump(step)} style={sq}><Plus size={20} aria-hidden="true" /></button>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div style={{ display: "grid", gap: 6 }}>
    <Label>{label}</Label>
    {children}
  </div>
);

// `future` lève le plafond à aujourd'hui (seulement la Nutrition en a besoin, voir ui.jsx).
export const DateField = ({ value, onChange, future = false }) => (
  <Field label="Date">
    <input type="date" className="p-field" value={value} max={future ? undefined : today()} onChange={(e) => onChange(e.target.value)}
      aria-label="Date" style={{ fontFamily: C.mono }} />
  </Field>
);

export function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={String(o.key)} type="button" className="p-tap p-chip" aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          style={value === o.key ? { background: C.accent, color: COLORS.onAccent, borderColor: C.accent } : undefined}>{o.label}</button>
      ))}
    </div>
  );
}

// Le nom de l'écran est déjà dans l'en-tête et les sous-onglets : `title` devient optionnel.
export const ScreenHeader = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
    <div>
      {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>{title}</h2>}
      {subtitle && <div style={{ fontSize: 14, color: C.text2, marginTop: title ? 2 : 0 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const chartAxis = { fontSize: 12, fill: COLORS.text2 };
export const tooltipStyle = { background: COLORS.raised, border: `1px solid ${COLORS.line}`, borderRadius: 10, fontSize: 13, color: COLORS.text };
export const tooltipItemStyle = { color: COLORS.text };
