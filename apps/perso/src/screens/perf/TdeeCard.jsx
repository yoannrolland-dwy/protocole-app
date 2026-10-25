// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { MIN_WINDOW_DAYS as MIN_TDEE_DAYS } from "@rawcare/core/tdee";
import { C, fmt, Card, Label, Body, chartAxis, tooltipStyle, tooltipItemStyle } from "../../ui.jsx";
import { TDEE_RELIABILITY_COLOR, TDEE_RELIABILITY_LABEL, loggedPct } from "../../lib/helpers.js";

// Comparaison des fenêtres (24/09/2026) : une ligne par longueur fixe, sous l'estimation de
// référence. Le 7 j est gardé (demande explicite) mais toujours marqué "indicatif" — sur 7 j,
// une variation d'eau de 0,5 kg décale le résultat d'environ ±550 kcal/j.
function TdeeWindows({ windows }) {
  if (!windows?.length) return null;
  return (
    <>
      <Label style={{ marginTop: 12, marginBottom: 4 }}>Comparaison des fenêtres</Label>
      {windows.map((w) => (
        <div key={w.days} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 11, color: C.text2, fontFamily: C.mono }}>
            {w.days} j{w.days < MIN_TDEE_DAYS && <span style={{ color: C.muted }}> · indicatif</span>}
          </span>
          {w.status === "ok" ? (
            <span style={{ fontFamily: C.mono, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: C.text }}>{w.tdee}</span>
              {w.margin != null && <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>± {w.margin}</span>}
              <span style={{ fontSize: 10, color: TDEE_RELIABILITY_COLOR[w.reliability], marginLeft: 6 }}>{TDEE_RELIABILITY_LABEL[w.reliability]}</span>
              <span style={{ fontSize: 10, color: C.dim, marginLeft: 6 }}>{loggedPct(w)}%</span>
            </span>
          ) : (
            <span style={{ fontSize: 10, color: C.dim }}>{w.reason}</span>
          )}
        </div>
      ))}
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
        Si les fenêtres convergent, le chiffre est solide. Si la plus longue s'écarte, elle est
        sans doute polluée par un événement ancien (retour de vacances : l'eau repart, la dépense
        est surestimée). Le 7 j est très bruité : 0,5 kg d'eau ≈ ±550 kcal/j — à ne pas lire seul.
      </Body>
    </>
  );
}

// Zone de recomposition (chantier R, R2, 02/10/2026) : déficit RÉEL = apports moyens loggés −
// dépense estimée, sur 14 j ET 21 j (jamais le 7 j, trop bruité). Pas `realDeficit` (cible −
// dépense = le déficit PRÉVU, pas celui réalisé). Barème dans tdee.js (`recompZone`). Les
// deux fenêtres sont affichées côte à côte ; si elles ne tombent pas dans la même zone, on
// le dit plutôt que d'en choisir une. Visible seulement en phase Recomposition (`recomp` null
// sinon). Même fonction (`recompWindows`) que le Coach IA.
const RECOMP_ZONE_COLOR = { visee: C.accent, haut: "#e8a33d", sous: "#e8a33d", trop: C.danger, surplus: C.danger };
function RecompZone({ recomp }) {
  if (!recomp) return null;
  const rows = [["14 j", recomp.j14], ["21 j", recomp.j21]];
  const ok = rows.filter(([, r]) => r.status === "ok");
  const diverge = ok.length === 2 && ok[0][1].reading.zone !== ok[1][1].reading.zone;
  return (
    <>
      <Label style={{ marginTop: 12, marginBottom: 4 }}>Zone de recomposition</Label>
      {rows.map(([lbl, r]) => (
        <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 11, color: C.text2, fontFamily: C.mono, flexShrink: 0 }}>{lbl}</span>
          {r.status === "ok" ? (
            <span style={{ fontFamily: C.mono, fontSize: 12, textAlign: "right" }}>
              <span style={{ fontWeight: 800, color: C.text }}>{r.reading.deficit > 0 ? "−" : "+"}{Math.abs(r.reading.deficit)} kcal/j</span>
              <span style={{ fontSize: 10, color: RECOMP_ZONE_COLOR[r.reading.zone], marginLeft: 6 }}>{r.reading.label}</span>
            </span>
          ) : (
            <span style={{ fontSize: 10, color: C.dim }}>{r.reason}</span>
          )}
        </div>
      ))}
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
        {diverge ? "Les deux fenêtres ne tombent pas dans la même zone : attendre qu'elles convergent avant de conclure. " : ""}
        Déficit réel = apports moyens loggés − dépense estimée sur la fenêtre (pas la cible). Visée en recomposition : 100 à 300 kcal/j.
      </Body>
    </>
  );
}

export function TdeeCard({ result, deficitReel, trend, windows, recomp }) {
  if (result.status !== "ok") {
    return (
      <Card>
        <Label style={{ marginBottom: 6 }}>Dépense estimée</Label>
        <Body style={{ fontSize: 11, color: C.dim }}>
          Pas encore assez de données ({result.reason}). Il faut au moins {MIN_TDEE_DAYS} jours
          de pesées et d'apports enregistrés, avec au moins 70 % des jours loggés.
        </Body>
        <RecompZone recomp={recomp} />
        <TdeeWindows windows={windows} />
      </Card>
    );
  }
  const col = TDEE_RELIABILITY_COLOR[result.reliability];
  // Détails de fenêtre/complétude/tendance de poids (13/09/2026, demande explicite) : tout
  // était déjà calculé par `computeTDEE`, juste pas affiché — aucun nouveau calcul ici.
  const trendPoints = (trend || []).filter((p) => p.tdee != null);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Label>Dépense estimée</Label>
        <span style={{ fontSize: 10, fontFamily: C.mono, fontWeight: 800, color: col, textTransform: "uppercase" }}>
          confiance {TDEE_RELIABILITY_LABEL[result.reliability]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 800, color: C.text }}>{result.tdee}</span>
        {result.margin != null && <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted, fontWeight: 700 }}>± {result.margin}</span>}
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>kcal/j · sur {result.days} j</span>
      </div>
      <Body style={{ fontSize: 11, marginTop: 6 }}>
        Déficit réel actuel : <span style={{ color: deficitReel < 0 ? C.accent : C.danger, fontFamily: C.mono, fontWeight: 800 }}>
          {deficitReel > 0 ? "+" : ""}{deficitReel} kcal/j
        </span> contre la cible affichée.
      </Body>
      <RecompZone recomp={recomp} />
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: C.mono }}>
        Fenêtre : {fmt(result.windowStart)} → {fmt(result.windowEnd)} · {loggedPct(result)}% des jours loggés · {Math.round(result.weighRate * 100)}% pesés
      </Body>
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 2, fontFamily: C.mono }}>
        Tendance de poids sur la fenêtre : {result.deltaKg > 0 ? "+" : ""}{result.deltaKg} kg
      </Body>
      {result.overlapsWater && (
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          Fenêtre chevauchant la perte d'eau/glycogène du début de sèche (~21 premiers jours) —
          la dépense réelle est probablement plus proche de la fourchette basse.
        </Body>
      )}
      <TdeeWindows windows={windows} />
      {trendPoints.length >= 2 && (
        <>
          <Label style={{ marginTop: 12, marginBottom: 6 }}>Tendance · 8 semaines</Label>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.map((p) => ({ ...p, label: fmt(p.date) }))} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="label" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} domain={["dataMin - 50", "dataMax + 50"]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                  formatter={(v) => (v == null ? ["—", "kcal/j"] : [v, "kcal/j"])} />
                <Line type="monotone" dataKey="tdee" stroke={C.accent} strokeWidth={2} dot={{ r: 2, fill: C.text }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
