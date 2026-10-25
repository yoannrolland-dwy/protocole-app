// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { C } from "../../ui.jsx";

/* ============================================================
   TAB — DASHBOARD
   ============================================================ */
// « Pourquoi pas les autres ? » (04/10/2026, demande de Yoann) : une phrase pour chaque type
// de séance non proposé (`notProposed`, nextSession.js). Replié par défaut — la carte est déjà
// longue sur téléphone. `stopPropagation` : la carte entière ouvre l'onglet Séances au tap.
export function WhyNot({ items }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={{
        background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
        fontSize: 10.5, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2,
      }}>{open ? "Masquer" : `Pourquoi pas les autres ? (${items.length})`}</button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((x) => (
            <div key={x.type} style={{ fontSize: 10.5, lineHeight: 1.4 }}>
              <span style={{ color: x.kind === "avoid" ? C.dangerText : C.text2, fontWeight: 700 }}>{x.type}</span>
              <span style={{ color: C.dim }}> — {x.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
