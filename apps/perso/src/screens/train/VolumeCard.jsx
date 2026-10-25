// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 6 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useMemo } from "react";
import { weeklyVolumeByGroup, VOLUME_TARGET } from "@rawcare/core/volume";
import { C, Card, Label, Body } from "../../design/compat.jsx";

// Carte « Volume · 7 jours » (onglet Séances, chantier T2). Lecture seule, dérivée de
// `trainingLog` — aucune donnée nouvelle. Les groupes prioritaires affichent leur position
// par rapport à la zone cible (accent = dans la zone, ambre = sous, danger = au-dessus) ; les
// autres n'affichent que le compte, sans jugement.
export function VolumeCard({ training }) {
  const { groups } = useMemo(() => weeklyVolumeByGroup(training), [training]);
  const AMBER = C.warn;
  const statusColor = (st) => (st === "dans" ? C.accent : st === "sous" ? AMBER : C.danger);
  const statusLabel = (st) => (st === "dans" ? "dans la zone" : st === "sous" ? "sous la zone" : "au-dessus");
  const any = groups.some((g) => g.series > 0);
  return (
    <Card style={{ padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: any ? 8 : 4 }}>
        <Label style={{ letterSpacing: 1.5 }}>Volume · 7 jours</Label>
        <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>séries cochées · cible {VOLUME_TARGET.min}-{VOLUME_TARGET.max}</span>
      </div>
      {groups.map((g) => (
        <div key={g.groupe} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.divider}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <Body style={{ fontSize: 12, color: g.priority ? C.text : C.muted }}>{g.label}</Body>
            {g.priority && g.series > 0 && (
              <span style={{ fontSize: 12, color: statusColor(g.status) }}>{statusLabel(g.status)}</span>
            )}
          </div>
          <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: g.priority ? statusColor(g.status) : C.muted }}>
            {g.series}{g.priority ? <span style={{ fontSize: 12, fontWeight: 400, color: C.dim }}> / {VOLUME_TARGET.min}-{VOLUME_TARGET.max}</span> : null}
          </span>
        </div>
      ))}
      <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
        {any ? "Gainage et isométries non comptés. Pecs et épaules : groupes prioritaires, zone 10-20 séries/semaine." : "Aucune série de musculation cochée sur les 7 derniers jours."}
      </Body>
    </Card>
  );
}
