// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 5 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { PHASES, weightTrend7 } from "@rawcare/core/targets";
import { C, today, fmt, round, upsert, lastN, Card, Label, Big, Empty, Btn, Stepper, Field, DateField, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../design/compat.jsx";
import { phaseTarget, recompTrendColor } from "../lib/helpers.js";
import { SyncedBanner } from "../components/SyncedBanner.jsx";

/* ============================================================
   TAB — POIDS
   ============================================================ */
export function WeightTab({ weight, targets, save, phase }) {
  const tgtW = phaseTarget(phase, targets);
  // Recomposition (chantier R) : pas de cible, sous-titre et badge affichent la tendance 7 j.
  const wTrend = tgtW == null ? weightTrend7(weight, today()) : null;
  const trendLabel = wTrend?.avg7 != null
    ? `moy. 7 j ${wTrend.avg7} kg${wTrend.deltaWeek != null ? ` · ${wTrend.deltaWeek > 0 ? "+" : ""}${wTrend.deltaWeek} kg/sem` : ""}`
    : "moy. 7 j —";
  const [date, setDate] = useState(today());
  const cur = weight.find((w) => w.date === date);
  const [kg, setKg] = useState(lastN(weight, 1)[0]?.kg ?? 95);
  const [forceManual, setForceManual] = useState(false);
  const pickDate = (d) => { setDate(d); const e = weight.find((w) => w.date === d); if (e) setKg(e.kg); setForceManual(false); };
  const wLast = lastN(weight, 1)[0];
  const data = lastN(weight, 60).map((w) => ({ date: fmt(w.date), kg: w.kg }));
  const add = () => save.weight(upsert(weight, { date, kg: round(kg), source: "manual" }));
  const isSynced = cur?.source === "healthconnect" && !forceManual;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader subtitle={`${PHASES[phase].label} · ${tgtW != null ? `cible ${tgtW} kg` : trendLabel}`} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 12, letterSpacing: 1.5 }}>Actuel</Label>
          <span style={{ fontSize: 13, color: tgtW != null ? C.accent : recompTrendColor(wTrend?.deltaWeek ?? 0), fontWeight: 700 }}>{tgtW != null ? `cible ${tgtW} kg` : trendLabel}</span>
        </div>
        <div style={{ margin: "6px 0 12px" }}><Big value={wLast ? wLast.kg : "—"} unit="kg" /></div>
        {data.length > 1 ? (
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                {tgtW != null && <ReferenceLine y={tgtW} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />}
                <Line type="monotone" dataKey="kg" stroke={C.text} strokeWidth={2} dot={{ r: 2, fill: C.text }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune pesée enregistrée.</Empty>}
      </Card>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <>
            <Field label="Poids (kg)"><Stepper value={kg} set={setKg} step={0.1} unit="kg" min={40} /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {weight.some((w) => w.date === date) && (
                <Btn variant="danger" aria-label="Supprimer l'entrée de ce jour" onClick={() => save.weight(weight.filter((w) => w.date !== date))}><Trash2 size={18} aria-hidden="true" /></Btn>
              )}
            </div>
          </>
        )}
      </Card>

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Historique</Label>
        {weight.length ? lastN(weight, 10).reverse().map((w) => (
          <div key={w.date} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.divider}`, fontFamily: C.mono, fontSize: 13 }}>
            <span style={{ color: C.text2 }}>{fmt(w.date)}{w.time ? <span style={{ color: C.dim, fontSize: 13 }}> · {w.time}</span> : null}</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{w.kg}</span>
          </div>
        )) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
