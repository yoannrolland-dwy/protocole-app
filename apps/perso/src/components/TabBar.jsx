// Barre d'onglets v2 (chantier U, U3 étape 1, 25/10/2026) : 5 onglets de l'arborescence A
// retenue en U1, au lieu de 8 onglets de 26-62 px de large en 9 px.
import { Sun, Dumbbell, Flame, PersonStanding, TrendingUp } from "lucide-react";
import { T } from "../design/tokens.js";

export const TABS = [
  { key: "dash", label: "Aujourd'hui", icon: Sun },
  { key: "train", label: "Séance", icon: Dumbbell },
  { key: "macro", label: "Nutrition", icon: Flame },
  { key: "corps", label: "Corps", icon: PersonStanding },
  { key: "perf", label: "Analyse", icon: TrendingUp },
];

export function TabBar({ tab, onSelect, dimmed = false }) {
  return (
    <nav aria-label="Navigation principale" style={{
      flexShrink: 0, display: "flex", background: T.c.bg,
      borderTop: `1px solid ${T.c.lineSoft}`,
      paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
    }}>
      {TABS.map(({ key, label, icon: Icon }) => {
        const on = tab === key && !dimmed;
        return (
          <button key={key} type="button" className="p-tap" onClick={() => onSelect(key)}
            aria-current={on ? "page" : undefined}
            style={{
              flex: 1, minWidth: 0, minHeight: 62, padding: "8px 2px 6px",
              background: "none", border: "none",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              color: on ? T.c.accent : T.c.text2, fontFamily: T.f.body,
            }}>
            <Icon size={22} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: on ? 700 : 600, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
