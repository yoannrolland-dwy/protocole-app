import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import {
  C, today, fmt, upsert, lastN,
  Card, Label, Btn, Stepper, DateField, ScreenHeader, Empty,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const STEPS_TARGET = 10000;

// Écran Pas à parité avec apps/perso (Phase A) : moyenne 7j, graphique 21 jours. Cible fixe
// 10 000 pas/jour reprise telle quelle de STEPS_TARGET (apps/perso) — pas une donnée à
// configurer. `data.stepsLog` même forme qu'apps/perso sur les champs pertinents
// ({date, count}, pas de `source` : apps/public n'a pas de synchro Health Connect).
export default function StepsTab({ data, update, error: loadError }) {
  const steps = data?.stepsLog || [];
  const [date, setDate] = useState(today());
  const cur = steps.find((s) => s.date === date);
  const [n, setN] = useState(cur?.count ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const pickDate = (d) => {
    setDate(d);
    const e = steps.find((s) => s.date === d);
    setN(e?.count ?? 0);
    setSaveError("");
  };

  const last7 = lastN(steps, 7);
  const avg7 = avg(last7.map((s) => s.count));
  const chartData = lastN(steps, 21).map((s) => ({ date: fmt(s.date), count: s.count }));

  const add = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ stepsLog: upsert(steps, { date, count: Math.round(n) }) });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ stepsLog: steps.filter((s) => s.date !== date) });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Pas" subtitle="saisie manuelle · activité quotidienne" />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>{date === today() ? "Aujourd'hui" : fmt(date)}</Label>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>cible {STEPS_TARGET.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 10px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 38, fontWeight: 800, color: C.text }}>{n.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ background: C.accent, width: `${Math.min(100, (n / STEPS_TARGET) * 100)}%`, height: "100%" }} />
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
        <Stepper value={n} set={setN} step={500} min={0} int />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn variant="primary" onClick={add} disabled={saving} style={{ flex: 1 }}>
            <Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer
          </Btn>
          {cur && (
            <Btn variant="danger" onClick={remove} disabled={saving}><Trash2 size={14} /></Btn>
          )}
        </div>
        {(saveError || loadError) && <p style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>{saveError || loadError}</p>}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Pas · 21 jours</Label>
        {chartData.length ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip formatter={(v) => [v.toLocaleString("fr-FR"), "Pas"]} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={STEPS_TARGET} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.count >= STEPS_TARGET ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
