// Cartes de référence déplacées hors de l'onglet Analyse (chantier U, U3 étape 7, 25/10/2026),
// contenu inchangé : le planning idéal va dans Séance, la fiche péri-training et les protocoles
// basket dans Nutrition (arborescence A, U1). Affichage seul, jamais lus par le recommandeur.
import { useState } from "react";
import { ChevronRight, ChevronDown, Zap } from "lucide-react";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { C, Card, Label, Body, Pills } from "../../design/compat.jsx";
import { WEEKLY_PLAN } from "../../lib/plan.js";

export function PlanCard() {
  const [planVariant, setPlanVariant] = useState("sansMatch");
  // Planning hebdomadaire idéal — référence affichée, jamais appliquée automatiquement.
  return (
    <Card>
    <Label style={{ marginBottom: 8 }}>Planning idéal</Label>
    <Pills
      options={[{ key: "sansMatch", label: "Sans match" }, { key: "avecMatch", label: "Avec match" }]}
      value={planVariant} onChange={setPlanVariant} small
    />
    <div style={{ marginTop: 10 }}>
      {WEEKLY_PLAN[planVariant].map((d) => (
        <div key={d.jour} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ width: 66, flexShrink: 0, fontSize: 13, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{d.jour}</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.4 }}>{d.texte}</div>
        </div>
      ))}
    </div>
  </Card>
  );
}

export function PeriCard() {
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  return (
    <>
      {/* Péri-training */}
      <Card>
        <button type="button" className="p-tap" onClick={() => setShowPeri((s) => !s)} aria-expanded={showPeri} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 48, padding: 0, background: "none", border: "none", fontFamily: "inherit", color: C.text }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={13} color={C.accent} />
            <Label style={{ fontSize: 12 }}>Fiche péri-training</Label>
          </div>
          {showPeri ? <ChevronDown size={18} color={C.muted} aria-hidden="true" /> : <ChevronRight size={18} color={C.muted} aria-hidden="true" />}
        </button>
        {showPeri && (
          <div style={{ marginTop: 12 }}>
            {PERI.map((row, i) => (
              <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: i < PERI.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{row.t}</div>
                <Body style={{ fontSize: 13, marginTop: 3 }}>{row.d}</Body>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Protocoles basket détaillés (avant/pendant/après selon l'horaire) */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Zap size={13} color={C.accent} />
          <Label style={{ fontSize: 12 }}>Protocoles basket</Label>
        </div>
        <Pills
          options={Object.entries(BASKET_PROTOCOLS).map(([k, v]) => ({ key: k, label: v.title }))}
          value={basketProto} onChange={setBasketProto} small
        />
        <Body style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>{BASKET_PROTOCOLS[basketProto].sub}</Body>
        <div style={{ marginTop: 10 }}>
          {BASKET_PROTOCOLS[basketProto].blocks.map((b, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <Label style={{ color: C.accent, marginBottom: 4 }}>{b.h}</Label>
              {b.items.map((it, j) => (
                <div key={j} style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, paddingLeft: 10, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: C.dim }}>–</span>{it}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
