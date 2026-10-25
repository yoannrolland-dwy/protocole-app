// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; v2 à l'étape 4 d'U3 (pastilles 44 px).
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { today, upsert } from "../../ui.jsx";
import { T } from "../../design/tokens.js";
import { Chip, Button } from "../../design/primitives.jsx";

// Saisie rapide de la douleur genou depuis le Dashboard (T3, 04/10/2026) — remplace la ligne
// d'alerte « pas notée aujourd'hui ». Même règle que l'onglet Douleurs : AUCUNE valeur
// présélectionnée. Un 0 s'enregistre au tap (retour à la base implicite) ; un chiffre ≥ 1 fait
// apparaître la question « retour à la base ? », et c'est la réponse Oui/Non qui enregistre —
// pas de bouton Enregistrer supplémentaire, deux taps au plus. Écrit `kneeLog` via le même
// `save.knee`/`upsert` que PainTab, donc l'onglet Douleurs reflète la saisie immédiatement.
export function KneeQuickLog({ knee, saveKnee }) {
  const [pain, setPain] = useState(null);
  const write = (p, baseline) => saveKnee(upsert(knee, { date: today(), pain: p, baseline }));
  const pick = (p) => { if (p === 0) write(0, true); else setPain(p); };
  return (
    <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 12, border: `1px solid ${T.c.warn}`, background: T.c.field }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <AlertTriangle size={18} color={T.c.warn} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <span style={{ fontSize: 14, color: T.c.text, lineHeight: 1.4 }}>Douleur genou aujourd'hui ?</span>
      </div>
      <div role="group" aria-label="Douleur genou de 0 à 10" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <Chip key={i} on={pain === i} onClick={() => pick(i)} aria-label={`Douleur ${i} sur 10`}
            style={{ justifyContent: "center", padding: 0, fontFamily: T.f.num, fontSize: 16 }}>{i}</Chip>
        ))}
      </div>
      {pain != null && pain >= 1 && (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: T.c.text2 }}>Retour à la douleur de base sous 24 h ?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="plain" style={{ flex: 1 }} onClick={() => write(pain, true)}>Oui</Button>
            <Button variant="danger" style={{ flex: 1 }} onClick={() => write(pain, false)}>Non</Button>
          </div>
        </div>
      )}
    </div>
  );
}
