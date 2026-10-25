// Primitives v2 (chantier U, U3 étape 2, 25/10/2026) : construites sur design/tokens.js et
// les classes p-* de design/theme.css. Les écrans refaits en U3 les utilisent ; les écrans
// pas encore migrés gardent les primitives v1 de ui.jsx (Card, Label, Btn, Stepper…).
import { useRef } from "react";
import { X, Minus, Plus } from "lucide-react";
import { T } from "./tokens.js";

export function Panel({ tone, className = "", style, children, ...rest }) {
  const cls = `p-card${tone === "key" ? " p-card--key" : ""}${tone === "danger" ? " p-card--danger" : ""} ${className}`;
  return <section className={cls} style={{ display: "grid", gap: 12, ...style }} {...rest}>{children}</section>;
}

export const Eyebrow = ({ children, style }) => <div className="p-label" style={style}>{children}</div>;

export function Button({ variant = "plain", block = false, className = "", style, children, ...rest }) {
  return (
    <button type="button" className={`p-tap p-btn p-btn--${variant}${block ? " p-btn--block" : ""} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}

// Bouton icône : toujours un nom accessible (`label`), jamais un bouton muet.
export function IconButton({ label, tone = "default", size = 48, style, children, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`p-tap p-iconbtn${tone === "accent" ? " p-iconbtn--accent" : ""}${tone === "danger" ? " p-iconbtn--danger" : ""}`}
      style={{ width: size, height: size, ...style }} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ on = false, children, ...rest }) {
  return <button type="button" className="p-tap p-chip" aria-pressed={on} {...rest}>{children}</button>;
}

// Bouton × qui vide un champ d'un coup (décision 7 du chantier U). `onMouseDown`
// empêche le champ de perdre le focus : le clavier reste ouvert pour retaper.
function ClearButton({ onClear, label }) {
  return (
    <button type="button" className="p-tap p-clear" aria-label={label}
      onMouseDown={(e) => e.preventDefault()} onClick={onClear}>
      <X size={18} aria-hidden="true" />
    </button>
  );
}

/**
 * Champ numérique v2 : clavier numérique, Entrée = `onEnter` (valider), × pour vider,
 * unité à droite, boutons −/+ optionnels (`step`). La valeur reste une CHAÎNE tant qu'on
 * tape (« 1, » ou « » sont des états normaux de saisie) ; à l'appelant de la convertir.
 */
export function NumberField({
  value, onChange, unit, onEnter, step, min = 0, inputMode = "decimal", label,
  enterKeyHint = "done", autoFocus = false, inputRef, big = false, style,
}) {
  // `inputRef` peut être un objet ref ou une fonction (liste de champs) : on garde toujours
  // notre propre ref pour le × qui refocalise le champ, et on transmet à l'appelant.
  const own = useRef(null);
  const ref = own;
  const setRef = (el) => {
    own.current = el;
    if (typeof inputRef === "function") inputRef(el); else if (inputRef) inputRef.current = el;
  };
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const bump = (d) => {
    const next = Math.max(min, Math.round((num(value) + d) * 100) / 100);
    onChange(String(next));
  };
  const field = (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input ref={setRef} type="text" inputMode={inputMode} enterKeyHint={enterKeyHint} autoFocus={autoFocus}
        aria-label={label} value={value} placeholder="0" className="p-field"
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter ? onEnter() : e.currentTarget.blur(); } }}
        onFocus={(e) => e.currentTarget.select()}
        style={{ textAlign: "center", paddingRight: unit ? 84 : 48, paddingLeft: 48, fontSize: big ? 22 : undefined, ...style }} />
      {unit && <span aria-hidden="true" style={{ position: "absolute", right: 48, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: T.c.muted, pointerEvents: "none" }}>{unit}</span>}
      {String(value) !== "" && <ClearButton label={`Vider ${label || "le champ"}`} onClear={() => { onChange(""); ref.current?.focus(); }} />}
    </div>
  );
  if (!step) return field;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <IconButton label={`Moins ${step}`} size={52} onClick={() => bump(-step)}><Minus size={20} aria-hidden="true" /></IconButton>
      {field}
      <IconButton label={`Plus ${step}`} size={52} onClick={() => bump(step)}><Plus size={20} aria-hidden="true" /></IconButton>
    </div>
  );
}

// Champ texte v2 avec × (recherche, nom libre). `icon` : petite icône à gauche.
export function TextField({ value, onChange, placeholder, label, icon: Icon, inputRef, autoFocus = false, enterKeyHint, onEnter }) {
  const own = useRef(null);
  const ref = inputRef || own;
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {Icon && <Icon size={18} aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.c.muted, pointerEvents: "none" }} />}
      <input ref={ref} type="text" value={value} placeholder={placeholder} aria-label={label || placeholder}
        autoFocus={autoFocus} enterKeyHint={enterKeyHint} className="p-field"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
        style={{ fontFamily: T.f.body, fontWeight: 600, paddingLeft: Icon ? 42 : 14, paddingRight: 48 }} />
      {value !== "" && <ClearButton label={`Vider ${label || "le champ"}`} onClear={() => { onChange(""); ref.current?.focus(); }} />}
    </div>
  );
}
