// Conversation avec Jeffrey par-dessus l'écran courant (chantier J, J1.3, 29/10/2026) : ouverte
// par la bulle ou par la carte du tableau de bord. Même conversation que l'onglet Analyse (même
// `jeffreyLog`). Fermeture par la croix : l'app n'a pas de gestion du bouton retour d'Android, et
// en ajouter une changerait son comportement partout.
import { X } from "lucide-react";
import { T } from "../design/tokens.js";
import { IconButton } from "../design/primitives.jsx";
import { JeffreyChat } from "../screens/perf/JeffreyChat.jsx";

export function JeffreyOverlay({ onClose, initialAsk, chat }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Conversation avec Jeffrey" style={{
      position: "fixed", inset: 0, zIndex: 60, background: T.c.bg, display: "flex", flexDirection: "column",
      paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
      paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 8px 16px", borderBottom: `1px solid ${T.c.lineSoft}` }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: T.c.text, fontFamily: T.f.body }}>Jeffrey</span>
        <IconButton label="Fermer la conversation" onClick={onClose}><X size={22} aria-hidden="true" /></IconButton>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <JeffreyChat {...chat} initialAsk={initialAsk} />
      </div>
    </div>
  );
}
