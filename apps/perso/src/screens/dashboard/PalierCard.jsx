// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; v2 à l'étape 4 d'U3.
import { fmt } from "../../ui.jsx";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button } from "../../design/primitives.jsx";
import { palierView, palierMacroLine } from "../../lib/bordView.js";

// « Palier de la semaine » (chantier R, R3, 02/10/2026) : la proposition figée de la semaine
// (voir l'effet dédié dans `App`), ses raisons chiffrées, et le bouton « Appliquer » — un tap
// écrit les cibles via `save.targets` (source "palier") et date `appliedAt`. Un `hold` n'a pas
// de bouton. Visible seulement en phase Recomposition ET s'il y a une proposition (U3 étape 4 :
// l'attente « première proposition dimanche » n'occupe plus le tableau de bord).
const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
export function PalierCard({ palier, targets, onApply }) {
  // Verdict, couleurs et macros calculés dans lib/bordView.js (17/11/2026), partagés avec la montre.
  const v = palierView(palier, targets);
  if (!v) return null;
  const r = palier.result;
  const { cur, alreadyInPlace, verdict } = v;
  const p = v.proposed;
  const macroLine = palierMacroLine;
  return (
    <Panel aria-label="Palier de la semaine">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <Eyebrow>Palier de la semaine</Eyebrow>
        <span style={{ ...mono, fontSize: 13, color: T.c.text2 }}>semaine du {fmt(palier.weekOf)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...mono, fontSize: 24, fontWeight: 700, color: v.color }}>{verdict}</span>
        {r.blocked && <span className="p-label">en attente</span>}
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {r.reasons.map((x, i) => (
          <div key={i} style={{ fontSize: 13, color: i === 0 ? T.c.text : T.c.text2, lineHeight: 1.4 }}>· {x}</div>
        ))}
      </div>
      {p && (
        <>
          <div style={{ ...mono, display: "grid", gap: 2, fontSize: 13 }}>
            <div style={{ color: T.c.text2 }}>Actuel&nbsp;&nbsp;: {macroLine(cur)}</div>
            <div style={{ color: T.c.text }}>Proposé : {macroLine(p)}</div>
          </div>
          {palier.appliedAt ? (
            <div style={{ fontSize: 14, color: T.c.accent, fontWeight: 700 }}>Appliqué ✓ le {fmt(palier.appliedAt)}</div>
          ) : alreadyInPlace ? (
            <div className="p-sec">Déjà en place dans tes cibles.</div>
          ) : (
            <Button variant="primary" block onClick={onApply}>Appliquer à partir de lundi</Button>
          )}
        </>
      )}
    </Panel>
  );
}
