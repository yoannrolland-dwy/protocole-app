// Onglet « Corps » (chantier U, U3 étape 1, 25/10/2026) : regroupe Poids, Énergie, Pas et
// Genou derrière des sous-onglets (arborescence A, U1). Les 4 écrans sont affichés tels
// quels en enfant ; ils seront refaits à l'étape 5 d'U3.
import { T } from "../design/tokens.js";

export const CORPS_SUBS = [
  { key: "weight", label: "Poids" },
  { key: "sleep", label: "Énergie" },
  { key: "steps", label: "Pas" },
  { key: "pain", label: "Genou" },
];

export function CorpsTab({ sub, onSub, children }) {
  return (
    // `minmax(0, 1fr)` (27/10/2026) : un sous-écran trop large ne peut plus élargir la page.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <div role="tablist" aria-label="Corps" style={{
        display: "flex", gap: 4, padding: 4, borderRadius: 14,
        background: T.c.card, border: `1px solid ${T.c.lineSoft}`, fontFamily: T.f.body,
      }}>
        {CORPS_SUBS.map(({ key, label }) => {
          const on = key === sub;
          return (
            <button key={key} type="button" role="tab" aria-selected={on} className="p-tap" onClick={() => onSub(key)}
              style={{
                flex: 1, minWidth: 0, minHeight: 48, borderRadius: 10, border: "none",
                background: on ? T.c.accent : "transparent", color: on ? T.c.onAccent : T.c.text2,
                fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              }}>{label}</button>
          );
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
