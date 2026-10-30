// Barre de sous-onglets (Corps, Réglages, Analyse) : boutons de 48 px, citron plein sur l'onglet
// actif. `sticky` (Analyse, 30/10/2026) la garde collée en haut de l'écran quand on fait défiler :
// même procédé que la barre du jour de Nutrition (marges négatives = padding de <main>, fond de
// l'app derrière pour que le contenu passe dessous proprement).
import { T } from "../design/tokens.js";

export function SubTabs({ label, tabs, value, onChange, sticky = false }) {
  const bar = (
    <div role="tablist" aria-label={label} style={{
      display: "flex", gap: 4, padding: 4, borderRadius: 14,
      background: T.c.card, border: `1px solid ${T.c.lineSoft}`, fontFamily: T.f.body,
    }}>
      {tabs.map(({ key, label: text }) => {
        const on = key === value;
        return (
          <button key={key} type="button" role="tab" aria-selected={on} className="p-tap" onClick={() => onChange(key)}
            style={{
              flex: 1, minWidth: 0, minHeight: 48, borderRadius: 10, border: "none",
              background: on ? T.c.accent : "transparent", color: on ? T.c.onAccent : T.c.text2,
              fontSize: 15, fontWeight: 700, fontFamily: "inherit",
            }}>{text}</button>
        );
      })}
    </div>
  );
  if (!sticky) return bar;
  return (
    <div style={{ position: "sticky", top: -14, zIndex: 5, margin: "-14px -16px 0", padding: "14px 16px 8px", background: T.c.bg }}>
      {bar}
    </div>
  );
}
