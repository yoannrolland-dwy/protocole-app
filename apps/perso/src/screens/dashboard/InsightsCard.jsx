// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; v2 et replié à l'étape 4 d'U3 :
// Yoann ne regarde pas les constats le matin (moments d'usage U1), la carte montre la première
// ligne et « Voir les N constats ».
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow } from "../../design/primitives.jsx";
import { insightRows } from "../../lib/bordView.js";

/** Carte "Constats" (07/09/2026, point 1 du chantier IA) : aucun appel API, tout est calculé
 * en JS pur à partir de données déjà en mémoire (records V4, TDEE V7, score d'énergie...).
 * Chaque ligne n'apparaît que si le constat correspondant a assez de données ; la carte
 * entière disparaît s'il n'y en a aucune (rien à montrer plutôt qu'une carte vide). */
export function InsightsCard({ insights }) {
  const [open, setOpen] = useState(false);
  // Lignes calculées dans lib/bordView.js (17/11/2026), partagées avec la montre.
  const rows = insightRows(insights);

  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, 1);

  return (
    <Panel aria-label="Constats" style={{ gap: 4 }}>
      <Eyebrow>Constats</Eyebrow>
      {shown.map((r, i) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${T.c.lineSoft}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, color: T.c.text, fontWeight: 600 }}>{r.label}</div>
            <div style={{ fontSize: 13, color: T.c.text2, marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>
          </div>
          <div style={{ fontFamily: T.f.num, fontVariantNumeric: "tabular-nums", fontSize: 16, fontWeight: 700, color: T.c.text, flexShrink: 0, textAlign: "right" }}>{r.value}</div>
        </div>
      ))}
      {rows.length > 1 && (
        <button type="button" className="p-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{
          display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: 0,
          background: "none", border: "none", fontFamily: "inherit", fontSize: 14, color: T.c.text2,
        }}>
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          {open ? "Réduire" : `Voir les ${rows.length} constats`}
        </button>
      )}
    </Panel>
  );
}
