import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import {
  C, today, fmt, fmtHM, round, upsert, lastN,
  Card, Label, Body, Btn, Stepper, DateField, Pills, ScreenHeader, Empty,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

// Écran Sommeil à parité avec apps/perso (Phase A) : mini-barres 7 nuits, moyenne 7j,
// graphique 21 jours, saisie heures + minutes (jamais décimal — décision documentée dans
// CLAUDE.md, pas une préférence à retrancher). `data.sleepLog` même forme qu'apps/perso
// sur les champs qui font sens ici ({date, hours, quality}, pas de `source` : apps/public
// n'a pas de synchro Health Connect).
export default function SleepTab({ data, update, error: loadError }) {
  const sleep = data?.sleepLog || [];
  const [date, setDate] = useState(today());
  const cur = sleep.find((s) => s.date === date);
  const initH = lastN(sleep, 1)[0]?.hours ?? 7.5;
  const [h, setH] = useState(Math.floor(initH));
  const [min, setMin] = useState(Math.round((initH - Math.floor(initH)) * 60));
  const [quality, setQuality] = useState(cur?.quality ?? 3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadHM = (dec) => { setH(Math.floor(dec)); setMin(Math.round((dec - Math.floor(dec)) * 60)); };
  const pickDate = (d) => {
    setDate(d);
    const e = sleep.find((s) => s.date === d);
    if (e) { loadHM(e.hours); setQuality(e.quality ?? 3); }
    setSaveError("");
  };

  const last7 = lastN(sleep, 7);
  const maxH = Math.max(9, ...last7.map((s) => s.hours));
  const avg7 = avg(last7.map((s) => s.hours));
  const lastNight = lastN(sleep, 1)[0];
  const chartData = lastN(sleep, 21).map((s) => ({ date: fmt(s.date), hours: s.hours }));

  const add = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ sleepLog: upsert(sleep, { date, hours: round(h + min / 60, 2), quality }) });
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
      await update({ sleepLog: sleep.filter((s) => s.date !== date) });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Sommeil" subtitle="récupération tendon & muscle" />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Dernière nuit</Label>
          {lastNight?.quality != null && (
            <span style={{ fontSize: 13, color: C.accent, letterSpacing: 1 }}>{"★".repeat(lastNight.quality)}<span style={{ color: C.dim }}>{"★".repeat(4 - lastNight.quality)}</span></span>
          )}
        </div>
        <div style={{ margin: "6px 0 14px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 44, fontWeight: 800, color: C.text }}>
            {lastNight ? fmtHM(lastNight.hours) : "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 44 }}>
          {last7.length ? last7.map((s, i) => (
            <div key={i} title={`${fmt(s.date)} · ${fmtHM(s.hours)}`} style={{
              flex: 1, borderRadius: "3px 3px 0 0",
              background: i === last7.length - 1 ? C.accent : C.border,
              height: `${Math.max(8, (s.hours / maxH) * 100)}%`,
            }} />
          )) : <Body style={{ fontSize: 11, color: C.dim }}>Aucune nuit enregistrée.</Body>}
        </div>
      </Card>

      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
        <Label>Moy. 7j</Label>
        <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>{avg7 != null ? fmtHM(avg7) : "—"}</div>
      </div>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><Body style={{ marginBottom: 6 }}>Heures</Body><Stepper value={h} set={setH} step={1} min={0} max={16} int /></div>
          <div><Body style={{ marginBottom: 6 }}>Minutes</Body><Stepper value={min} set={setMin} step={5} min={0} max={59} int /></div>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: C.accent, marginTop: 8, fontWeight: 700, fontFamily: C.mono }}>soit {fmtHM(h + min / 60)}</div>
        <div style={{ marginTop: 12 }}>
          <Body style={{ marginBottom: 6 }}>Qualité</Body>
          <Pills options={[1, 2, 3, 4].map((n) => ({ key: n, label: "★".repeat(n) }))} value={quality} onChange={setQuality} small />
          <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 4 }}>★ Attention requise · ★★ Correct · ★★★ Bon · ★★★★ Excellent</Body>
        </div>
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
        <Label style={{ marginBottom: 8 }}>Sommeil · 21 jours</Label>
        {chartData.length ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip formatter={(v) => [fmtHM(v), "Sommeil"]} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={7} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.hours >= 7 ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
