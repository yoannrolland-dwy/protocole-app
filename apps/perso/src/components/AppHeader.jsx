// En-tête v2 (chantier U, U3 étape 1, 25/10/2026) : nom de l'écran + date, pastille de
// phase, engrenage des Réglages en vraie cible de 48 px avec un nom accessible (il n'en
// avait aucun : échec Lighthouse « button-name »).
import { Settings, X } from "lucide-react";
import { T } from "../design/tokens.js";
import { longDate, today } from "../ui.jsx";

export function AppHeader({ title, phaseLabel, settingsOpen, onToggleSettings }) {
  return (
    <header style={{
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "10px 12px 10px 16px",
      paddingTop: "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
      borderBottom: `1px solid ${T.c.lineSoft}`, background: T.c.bg, fontFamily: T.f.body,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: T.c.text, lineHeight: 1.15 }}>{title}</h1>
        <div style={{ fontSize: 13, color: T.c.text2, marginTop: 2 }}>{longDate(today())}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: T.c.onAccent, background: T.c.accent, padding: "6px 10px", borderRadius: 999,
        }}>{phaseLabel}</span>
        <button type="button" className="p-tap" onClick={onToggleSettings}
          aria-label={settingsOpen ? "Fermer les réglages" : "Ouvrir les réglages"} aria-pressed={settingsOpen}
          style={{
            width: 48, height: 48, borderRadius: 12, display: "grid", placeItems: "center",
            background: settingsOpen ? T.c.raised : "transparent",
            border: `1px solid ${settingsOpen ? T.c.accent : T.c.line}`,
            color: settingsOpen ? T.c.accent : T.c.text2,
          }}>
          {settingsOpen ? <X size={22} aria-hidden="true" /> : <Settings size={22} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
