// Barre de sous-onglets (Corps, Réglages) : boutons de 48 px, citron plein sur l'onglet actif.
import { T } from "../design/tokens.js";

export function SubTabs({ label, tabs, value, onChange }) {
  return (
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
}
