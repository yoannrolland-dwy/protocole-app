// Bulle « Parler à Jeffrey » (chantier J, J1.3, 29/10/2026) : en bas à droite de la zone de
// contenu, au-dessus de la barre « Séance en cours » et de la barre d'onglets (elle est posée
// dans la zone de contenu, pas sur l'écran). Elle remonte quand le bandeau « Annuler » de
// Nutrition est là (`--undo-bar-h`), pour ne jamais le cacher. App décide où elle s'affiche.
import { ConciergeBell } from "lucide-react";
import { T } from "../design/tokens.js";

export function JeffreyBubble({ onOpen }) {
  return (
    <button type="button" className="p-tap" onClick={onOpen} aria-label="Parler à Jeffrey" title="Parler à Jeffrey"
      style={{
        position: "absolute", right: 16, bottom: "calc(16px + var(--undo-bar-h, 0px))", zIndex: 30,
        width: 56, height: 56, borderRadius: 28, border: "none", display: "grid", placeItems: "center",
        background: T.c.accent, color: T.c.onAccent, boxShadow: "0 6px 20px rgba(0,0,0,.55)",
      }}>
      <ConciergeBell size={24} aria-hidden="true" />
    </button>
  );
}
