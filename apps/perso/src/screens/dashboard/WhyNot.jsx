// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; v2 à l'étape 4 d'U3.
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../../design/tokens.js";

// « Pourquoi pas les autres ? » (04/10/2026, demande de Yoann) : une phrase pour chaque type
// de séance non proposé (`notProposed`, nextSession.js). Replié par défaut — la carte est déjà
// longue sur téléphone.
export function WhyNot({ items }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div>
      <button type="button" className="p-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{
        display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: 0,
        background: "none", border: "none", fontFamily: "inherit", fontSize: 14, color: T.c.text2,
      }}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        {open ? "Masquer" : `Pourquoi pas les autres ? (${items.length})`}
      </button>
      {open && (
        <div style={{ display: "grid", gap: 6, paddingBottom: 4 }}>
          {items.map((x) => (
            <div key={x.type} style={{ fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ color: x.kind === "avoid" ? T.c.danger : T.c.text, fontWeight: 700 }}>{x.type}</span>
              <span style={{ color: T.c.text2 }}> — {x.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
