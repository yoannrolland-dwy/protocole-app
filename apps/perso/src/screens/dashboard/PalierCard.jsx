// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; v2 à l'étape 4 d'U3.
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button } from "../../design/primitives.jsx";
import { palierView } from "../../lib/bordView.js";

// « Palier de la semaine » (chantier R, R3, 02/10/2026) : la proposition figée de la semaine
// (voir l'effet dédié dans `App`) et le bouton « Appliquer » — un tap écrit les cibles via
// `save.targets` (source "palier") et date `appliedAt`. Un maintien n'a pas de bouton. Visible
// seulement en phase Recomposition ET s'il y a une proposition (U3 étape 4 : l'attente de la
// première proposition n'occupe plus le tableau de bord). La proposition se calcule le samedi à
// partir de 10 h depuis le 19/11/2026 (avant : le dimanche à 14 h).
// En clair depuis le 19/11/2026 (demande de Yoann, la carte parlait en abréviations) : d'abord
// quoi faire, puis pourquoi en phrases entières, le compteur des jours d'observation (recalculé
// chaque jour), et un tableau Aujourd'hui / Proposé. Textes dans lib/bordView.js, partagés avec
// la montre.
const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
const cell = { ...mono, fontSize: 15, textAlign: "right" };
export function PalierCard({ palier, targets, onApply }) {
  const v = palierView(palier, targets);
  if (!v) return null;
  return (
    <Panel aria-label="Palier de la semaine">
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <Eyebrow>Palier de la semaine</Eyebrow>
          <span style={{ ...mono, fontSize: 13, color: T.c.text2 }}>{v.weekLabel}</span>
        </div>
        <div style={{ fontSize: 13, color: T.c.muted, lineHeight: 1.4 }}>{v.intro}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: v.color, lineHeight: 1.25 }}>{v.title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {v.lines.map((x, i) => (
          <div key={i} style={{ fontSize: 14, color: i === 0 ? T.c.text : T.c.text2, lineHeight: 1.45 }}>{x}</div>
        ))}
      </div>
      {v.progress && (
        <div style={{ display: "grid", gap: 6 }}>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={v.progress.total} aria-valuenow={v.progress.day}
            aria-label="Jours d'observation" style={{ height: 6, borderRadius: 3, background: T.c.raised, overflow: "hidden" }}>
            <div style={{ width: `${v.progress.pct}%`, height: "100%", background: T.c.text2 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
            <span style={{ ...mono, color: T.c.text, fontWeight: 700 }}>{v.progress.text}</span>
            <span style={{ color: T.c.text2 }}>{v.progress.next}</span>
          </div>
        </div>
      )}
      {v.rows && (
        <div style={{ display: "grid", gap: 6 }}>
          <div role="table" aria-label="Cibles d'aujourd'hui et cibles proposées"
            style={{ display: "grid", gridTemplateColumns: "1fr auto auto", columnGap: 18, rowGap: 6, alignItems: "baseline" }}>
            <div role="row" style={{ display: "contents" }}>
              <span role="columnheader" />
              <span role="columnheader" className="p-label" style={{ textAlign: "right" }}>Aujourd'hui</span>
              <span role="columnheader" className="p-label" style={{ textAlign: "right" }}>Proposé</span>
            </div>
            {v.rows.map((x) => (
              <div role="row" key={x.label} style={{ display: "contents" }}>
                <span role="rowheader" style={{ fontSize: 14, color: T.c.text2 }}>{x.label}</span>
                <span role="cell" style={{ ...cell, color: T.c.text2 }}>{x.cur}</span>
                <span role="cell" style={{ ...cell, color: T.c.text, fontWeight: 700 }}>{x.next}</span>
              </div>
            ))}
          </div>
          {v.unchanged && <div className="p-sec">{v.unchanged}</div>}
        </div>
      )}
      {v.targetsLine && <div style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.45 }}>{v.targetsLine}</div>}
      {v.proposed && (v.appliedAt
        ? <div style={{ fontSize: 14, color: T.c.accent, fontWeight: 700 }}>{v.status}</div>
        : v.alreadyInPlace
          ? <div className="p-sec">{v.status}</div>
          : <Button variant="primary" block onClick={onApply}>Appliquer à partir d'aujourd'hui</Button>)}
    </Panel>
  );
}
