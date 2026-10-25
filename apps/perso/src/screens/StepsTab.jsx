// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 5 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { C, today, fmt, upsert, lastN, Card, Label, Empty, Btn, Stepper, Field, DateField, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../design/compat.jsx";
import { avg, STEPS_TARGET } from "../lib/helpers.js";
import { progressColor } from "../lib/progress.js";
import { SyncedBanner } from "../components/SyncedBanner.jsx";

export function StepsTab({ steps, save }) {
  const [date, setDate] = useState(today());
  const cur = steps.find((s) => s.date === date);
  const [n, setN] = useState(cur?.count ?? 0);
  const [forceManual, setForceManual] = useState(false);
  const pickDate = (d) => { setDate(d); const e = steps.find((s) => s.date === d); setN(e?.count ?? 0); setForceManual(false); };
  const add = () => save.steps(upsert(steps, { date, count: Math.round(n), source: "manual" }));
  const isSynced = cur?.source === "healthconnect" && !forceManual;

  const last7 = lastN(steps, 7);
  const avg7 = avg(last7.map((s) => s.count));
  const data = lastN(steps, 21).map((s) => ({ date: fmt(s.date), count: s.count }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader subtitle="saisie manuelle · activité quotidienne" />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 12, letterSpacing: 1.5 }}>{date === today() ? "Aujourd'hui" : fmt(date)}</Label>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>cible {STEPS_TARGET.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 10px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 38, fontWeight: 800, color: n >= STEPS_TARGET ? C.over : C.text }}>{n.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ background: progressColor(n, STEPS_TARGET, "goal"), width: `${Math.min(100, (n / STEPS_TARGET) * 100)}%`, height: "100%" }} />
        </div>
      </Card>

      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
        <Label>Moy. 7j</Label>
        <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>
          {avg7 != null ? Math.round(avg7).toLocaleString("fr-FR") : "—"}
        </div>
      </div>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <>
            <Field label="Pas"><Stepper value={n} set={setN} step={500} min={0} int /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {steps.some((s) => s.date === date) && (
                <Btn variant="danger" aria-label="Supprimer l'entrée de ce jour" onClick={() => save.steps(steps.filter((s) => s.date !== date))}><Trash2 size={18} aria-hidden="true" /></Btn>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Pas · 21 jours</Label>
        {data.length ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip formatter={(v) => [v.toLocaleString("fr-FR"), "Pas"]} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={STEPS_TARGET} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {/* Bleu = cible atteinte (lib/progress.js, même règle que le tableau de bord). */}
                  {data.map((d, i) => <Cell key={i} fill={d.count >= STEPS_TARGET ? C.over : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
