// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { kcalFromMacros } from "@rawcare/core/targets";
import { C, fmt, Card, Label, Body, Btn } from "../../ui.jsx";

// « Palier de la semaine » (chantier R, R3, 02/10/2026) : la proposition figée de la semaine
// (voir l'effet dédié dans `App`), ses raisons chiffrées, et le bouton « Appliquer » — un tap
// écrit les cibles via `save.targets` (source "palier") et date `appliedAt`. Un `hold` n'a pas
// de bouton. Visible seulement en phase Recomposition (rendu conditionnel dans `Dashboard`).
const PALIER_COLOR = { up: C.accent, down: "#e8a33d", hold: C.muted };
export function PalierCard({ palier, targets, onApply }) {
  const r = palier?.result;
  if (!r) {
    return (
      <Card>
        <Label style={{ marginBottom: 6 }}>Palier de la semaine</Label>
        <Body style={{ fontSize: 11, color: C.dim }}>Première proposition dimanche à partir de 14 h.</Body>
      </Card>
    );
  }
  const cur = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fiber: targets.fiber, kcal: Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber)) };
  const p = r.proposed;
  const alreadyInPlace = p && ["protein", "carbs", "fat", "fiber"].every((k) => cur[k] === p[k]);
  const verdict = r.action === "up" ? `+${r.deltaKcal} kcal/j` : r.action === "down" ? `−${Math.abs(r.deltaKcal)} kcal/j` : "Maintenir";
  const macroLine = (t) => `${t.kcal} kcal · ${t.protein} P / ${t.carbs} G / ${t.fat} L / ${t.fiber} F`;
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Label>Palier de la semaine</Label>
        <span style={{ fontSize: 10, color: C.dim, fontFamily: C.mono }}>semaine du {fmt(palier.weekOf)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 800, color: PALIER_COLOR[r.action] }}>{verdict}</span>
        {r.blocked && <span style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1 }}>en attente</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
        {r.reasons.map((x, i) => (
          <Body key={i} style={{ fontSize: 10.5, color: i === 0 ? C.text2 : C.dim }}>· {x}</Body>
        ))}
      </div>
      {p && (
        <>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2, fontFamily: C.mono }}>
            <Body style={{ fontSize: 10.5, color: C.dim }}>Actuel&nbsp;&nbsp;: {macroLine(cur)}</Body>
            <Body style={{ fontSize: 10.5, color: C.text }}>Proposé : {macroLine(p)}</Body>
          </div>
          {palier.appliedAt ? (
            <Body style={{ fontSize: 11, color: C.accent, marginTop: 10, fontWeight: 700 }}>Appliqué ✓ le {fmt(palier.appliedAt)}</Body>
          ) : alreadyInPlace ? (
            <Body style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Déjà en place dans tes cibles.</Body>
          ) : (
            <Btn variant="primary" onClick={onApply} style={{ marginTop: 10, width: "100%" }}>Appliquer à partir de lundi</Btn>
          )}
        </>
      )}
    </Card>
  );
}
