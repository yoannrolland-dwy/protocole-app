import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { PHASES, phaseTarget, DEFAULT_TARGETS } from "@rawcare/core/targets";
import {
  C, today, fmt, round, upsert, lastN,
  Card, Label, Body, Big, Empty, Btn, Stepper, DateField, Pills, ScreenHeader,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";

// Écran Poids à parité avec apps/perso (Phase A, RawCare Phase 2) : graphique 60 jours,
// cible par Phase, sélecteur de date/poids en Stepper. `data.phase`/`data.targets` sont de
// nouveaux champs (défauts alignés sur apps/perso : phase "seche", DEFAULT_TARGETS fusionné
// à la lecture pour rester compatible avec de futurs champs de cibles, ex. Macros).
// apps/perso place le sélecteur de Phase sur le Dashboard, qui n'existe pas encore côté
// apps/public — la carte Phase est donc affichée ici, là où elle sert concrètement (calcul
// de la cible juste en dessous).
export default function WeightTab({ data, update, error: loadError }) {
  const weight = data?.weightLog || [];
  const phase = data?.phase || "seche";
  const targets = { ...DEFAULT_TARGETS, ...(data?.targets || {}) };
  const tgtW = phaseTarget(phase, targets);

  const [date, setDate] = useState(today());
  const cur = weight.find((w) => w.date === date);
  const [kg, setKg] = useState(lastN(weight, 1)[0]?.kg ?? 90);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const wLast = lastN(weight, 1)[0];
  const chartData = lastN(weight, 60).map((w) => ({ date: fmt(w.date), kg: w.kg }));

  const setPhase = async (p) => {
    try { await update({ phase: p }); } catch (e) { setSaveError(String(e.message || e)); }
  };

  const pickDate = (d) => {
    setDate(d);
    const e = weight.find((w) => w.date === d);
    if (e) setKg(e.kg);
    setSaveError("");
  };

  const add = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ weightLog: upsert(weight, { date, kg: round(kg) }) });
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
      await update({ weightLog: weight.filter((w) => w.date !== date) });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Poids" subtitle={`${PHASES[phase].label} · cible ${tgtW} kg`} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Actuel</Label>
          <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>cible {tgtW} kg</span>
        </div>
        <div style={{ margin: "6px 0 12px" }}><Big value={wLast ? wLast.kg : "—"} unit="kg" /></div>
        {chartData.length > 1 ? (
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={tgtW} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Line type="monotone" dataKey="kg" stroke={C.text} strokeWidth={2} dot={{ r: 2, fill: C.text }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune pesée enregistrée.</Empty>}
      </Card>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <Body style={{ marginBottom: 6 }}>Poids (kg)</Body>
        <Stepper value={kg} set={setKg} step={0.1} unit="kg" min={40} />
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
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 11 }}>{PHASES[phase].msg}</Body>
      </Card>

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Historique</Label>
        {weight.length ? lastN(weight, 10).reverse().map((w) => (
          <div key={w.date} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.divider}`, fontFamily: C.mono, fontSize: 13 }}>
            <span style={{ color: C.text2 }}>{fmt(w.date)}</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{w.kg}</span>
          </div>
        )) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
