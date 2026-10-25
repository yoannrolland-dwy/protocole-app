// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, today, upsert } from "../../ui.jsx";

// Saisie rapide de la douleur genou depuis le Dashboard (T3, 04/10/2026) — remplace la ligne
// d'alerte « pas notée aujourd'hui ». Même règle que l'onglet Douleurs : AUCUNE valeur
// présélectionnée. Un 0 s'enregistre au tap (retour à la base implicite) ; un chiffre ≥ 1 fait
// apparaître la question « retour à la base ? », et c'est la réponse Oui/Non qui enregistre —
// pas de bouton Enregistrer supplémentaire, deux taps au plus. Écrit `kneeLog` via le même
// `save.knee`/`upsert` que PainTab, donc l'onglet Douleurs reflète la saisie immédiatement.
export function KneeQuickLog({ knee, saveKnee }) {
  const [pain, setPain] = useState(null);
  const AMBER = "#e8a33d";
  const write = (p, baseline) => saveKnee(upsert(knee, { date: today(), pain: p, baseline }));
  const pick = (p) => { if (p === 0) write(0, true); else setPain(p); };
  const chip = (on, extra = {}) => ({
    minWidth: 26, height: 28, padding: "0 6px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono, fontSize: 12, fontWeight: 800,
    background: on ? C.accent : C.card, color: on ? "#000" : C.muted, border: `1.5px solid ${on ? C.accent : C.border}`, ...extra,
  });
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${AMBER}55`, background: `${AMBER}12` }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <AlertTriangle size={12} color={AMBER} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: AMBER, lineHeight: 1.4 }}>Douleur genou aujourd'hui ? Sans cette info, le recommandeur reste prudent par défaut.</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} onClick={() => pick(i)} style={chip(pain === i)}>{i}</button>
        ))}
      </div>
      {pain != null && pain >= 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C.text2 }}>Retour à la douleur de base sous 24 h ?</span>
          <button onClick={() => write(pain, true)} style={chip(false, { fontFamily: "inherit", fontSize: 11, padding: "0 10px" })}>Oui</button>
          <button onClick={() => write(pain, false)} style={chip(false, { fontFamily: "inherit", fontSize: 11, padding: "0 10px", color: C.dangerText, borderColor: C.dangerBorder })}>Non</button>
        </div>
      )}
    </div>
  );
}
