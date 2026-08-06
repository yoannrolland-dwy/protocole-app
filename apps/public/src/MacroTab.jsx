import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Droplet, ChevronDown, ChevronRight, Zap, Plus, Trash2 } from "lucide-react";
import { DEFAULT_TARGETS, targetsForDate, kcalFromMacros, kcalOfEntry, tdeeNow } from "@rawcare/core/targets";
import { realDeficit, MIN_WINDOW_DAYS } from "@rawcare/core/tdee";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { today, fmt, round, upsert, lastN } from "@rawcare/core/dateUtils";
import {
  C, Card, Label, Body, Empty, Btn, Field, DateField, Stepper, Pills, ScreenHeader,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";

// Écran Macros — RawCare Phase 2, septième écran de données, dans l'ordre d'apps/perso.
// Simplifications assumées (apps/public n'a ni synchro Health Connect ni module Repas —
// Repas est le prochain jalon) : pas de `Capacitor.isNativePlatform()` (toujours le
// comportement PWA : les compteurs démarrent à la cible plutôt qu'à zéro), pas de
// `SyncedBanner`/bandeau lecture seule (`source` vaut toujours "manual" pour l'instant — le
// champ existe déjà pour rester compatible avec le futur jour où `foodLog` alimentera ce
// journal, comme le fait `apps/perso` depuis M6). `kcalOfEntry` préfère déjà `m.kcal` quand
// il existe, donc l'écran affichera automatiquement la vraie valeur mesurée dès que Repas
// sera livré, sans aucun changement de code ici.
const TDEE_RELIABILITY_COLOR = { fiable: C.accent, moyenne: "#e8a33d", faible: C.muted };
const TDEE_RELIABILITY_LABEL = { fiable: "fiable", moyenne: "moyenne", faible: "faible" };

function TdeeCard({ result, deficitReel }) {
  if (result.status !== "ok") {
    return (
      <Card>
        <Label style={{ marginBottom: 6 }}>Dépense estimée</Label>
        <Body style={{ fontSize: 11, color: C.dim }}>
          Pas encore assez de données ({result.reason}). Il faut au moins {MIN_WINDOW_DAYS} jours
          de pesées et d'apports enregistrés, avec au moins 70 % des jours loggés.
        </Body>
      </Card>
    );
  }
  const col = TDEE_RELIABILITY_COLOR[result.reliability];
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Label>Dépense estimée</Label>
        <span style={{ fontSize: 10, fontFamily: C.mono, fontWeight: 800, color: col, textTransform: "uppercase" }}>
          fiabilité {TDEE_RELIABILITY_LABEL[result.reliability]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 800, color: C.text }}>{result.tdee}</span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>kcal/j · sur {result.days} j</span>
      </div>
      <Body style={{ fontSize: 11, marginTop: 6 }}>
        Déficit réel actuel : <span style={{ color: deficitReel < 0 ? C.accent : C.danger, fontFamily: C.mono, fontWeight: 800 }}>
          {deficitReel > 0 ? "+" : ""}{deficitReel} kcal/j
        </span> contre la cible affichée.
      </Body>
      {result.overlapsWater && (
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          Fenêtre chevauchant la perte d'eau/glycogène du début de sèche (~21 premiers jours) —
          la dépense réelle est probablement plus proche de la fourchette basse.
        </Body>
      )}
    </Card>
  );
}

export default function MacroTab({ data, update, error: loadError }) {
  const macros = data?.macroLog || [];
  const training = data?.trainingLog || [];
  const weight = data?.weightLog || [];
  const targets = { ...DEFAULT_TARGETS, ...(data?.targets || {}) };

  const [date, setDate] = useState(today());
  const at = targetsForDate(date, targets);
  const cur = macros.find((m) => m.date === date) || {};
  const [p, setP] = useState(cur.protein ?? at.protein);
  const [c, setC] = useState(cur.carbs ?? at.carbs);
  const [f, setF] = useState(cur.fat ?? at.fat);
  const [fib, setFib] = useState(cur.fiber ?? at.fiber);
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const water = cur.water ?? 0;
  const basketDay = training.some((t) => t.type === "Basket" && t.date === date);
  const waterTgt = targets.water + (basketDay ? 1000 : 0);

  const pickDate = (d) => {
    setDate(d);
    const atd = targetsForDate(d, targets);
    const e = macros.find((m) => m.date === d);
    setP(e?.protein ?? atd.protein); setC(e?.carbs ?? atd.carbs);
    setF(e?.fat ?? atd.fat); setFib(e?.fiber ?? atd.fiber);
    setSaveError("");
  };

  const kcal = cur.kcal ?? kcalFromMacros(p, c, f, fib);

  const persistMacros = async (next) => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ macroLog: next });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };
  const saveMacros = () => persistMacros(upsert(macros, { date, protein: round(p), carbs: round(c), fat: round(f), fiber: round(fib), water, source: "manual" }));
  const removeMacros = () => {
    persistMacros(macros.filter((m) => m.date !== date));
    setP(at.protein); setC(at.carbs); setF(at.fat); setFib(at.fiber);
  };
  const addWater = (ml) => {
    const next = Math.max(0, (macros.find((m) => m.date === date)?.water ?? 0) + ml);
    persistMacros(upsert(macros, { date, water: next, source: "manual" }));
  };

  const kcalTrend = lastN(macros, 14).map((m) => ({ date: fmt(m.date), kcal: Math.round(kcalOfEntry(m)) }));
  const kcalTarget = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));
  const kcalPct = Math.min(100, (kcal / kcalTarget) * 100);

  // Dépense énergétique adaptative (V7) : `foodLog`/`foodOverrides` toujours vides côté
  // apps/public pour l'instant (module Repas pas encore livré) — `tdeeNow` se rabat alors
  // entièrement sur le 4/4/9 de `macroLog`, exactement le même repli qu'apps/perso utilise
  // pour tout historique antérieur à son propre module Repas.
  const tdeeToday = tdeeNow({ foodLog: [], overrides: {}, macros, weight, targets });
  const atToday = targetsForDate(today(), targets);
  const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
  const deficitReel = tdeeToday.status === "ok" ? realDeficit(kcalTargetToday, tdeeToday.tdee) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Macros" subtitle={date === today() ? "aujourd'hui" : fmt(date)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Card style={{ padding: 14 }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Calories</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "6px 0 8px" }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.text }}>{Math.round(kcal)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>/{kcalTarget}</span>
          </div>
          <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
            <div style={{ background: C.accent, width: `${kcalPct}%`, height: "100%" }} />
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Droplet size={12} color={C.accent} />
            <Label style={{ fontSize: 10 }}>Eau</Label>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "6px 0 8px" }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.text }}>{(water / 1000).toFixed(2)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>/{(waterTgt / 1000).toFixed(1)} L</span>
          </div>
          <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
            <div style={{ background: C.accent, width: `${Math.min(100, (water / waterTgt) * 100)}%`, height: "100%" }} />
          </div>
          {basketDay && <span style={{ display: "inline-block", fontSize: 8.5, color: "#000", background: C.accent, padding: "2px 5px", borderRadius: 4, fontWeight: 800, marginTop: 6 }}>+1 L BASKET</span>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[{ l: "Protéines", v: p, t: at.protein }, { l: "Glucides", v: c, t: at.carbs }, { l: "Lipides", v: f, t: at.fat }, { l: "Fibres", v: fib, t: at.fiber }].map((x) => (
          <div key={x.l} style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <Label>{x.l}</Label>
            <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: C.text, marginTop: 3 }}>{x.v}g</div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1, fontFamily: C.mono }}>/ {x.t}g</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Calories · 14 jours</Label>
          <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>cible ~{kcalTarget} kcal</span>
        </div>
        {kcalTrend.length ? (
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kcalTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={kcalTarget} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
                  {kcalTrend.map((d, i) => <Cell key={i} fill={Math.abs(d.kcal - kcalTarget) <= kcalTarget * 0.1 ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>

      <TdeeCard result={tdeeToday} deficitReel={deficitReel} />

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Protéines (g)"><Stepper value={p} set={setP} step={5} int /></Field>
          <Field label="Glucides (g)"><Stepper value={c} set={setC} step={5} int /></Field>
          <Field label="Lipides (g)"><Stepper value={f} set={setF} step={5} int /></Field>
          <Field label="Fibres (g)"><Stepper value={fib} set={setFib} step={1} int /></Field>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Tracker les grammes de macros, pas le total kcal de l'app (décalage fibres).</Body>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn variant="primary" onClick={saveMacros} disabled={saving} style={{ flex: 1 }}>
            <Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer
          </Btn>
          {macros.some((m) => m.date === date) && (
            <Btn variant="danger" onClick={removeMacros} disabled={saving}><Trash2 size={14} /></Btn>
          )}
        </div>
        {(saveError || loadError) && <p style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>{saveError || loadError}</p>}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
          <Label style={{ marginBottom: 8 }}>Eau</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="plain" onClick={() => addWater(250)} disabled={saving} style={{ flex: 1 }}>+250 ml</Btn>
            <Btn variant="plain" onClick={() => addWater(500)} disabled={saving} style={{ flex: 1 }}>+500 ml</Btn>
            <Btn variant="ghost" onClick={() => addWater(-250)} disabled={saving}>−250</Btn>
          </div>
        </div>
      </Card>

      <Card>
        <div onClick={() => setShowPeri((s) => !s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={13} color={C.accent} />
            <Label style={{ fontSize: 10 }}>Fiche péri-training</Label>
          </div>
          {showPeri ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />}
        </div>
        {showPeri && (
          <div style={{ marginTop: 12 }}>
            {PERI.map((row, i) => (
              <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: i < PERI.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{row.t}</div>
                <Body style={{ fontSize: 11, marginTop: 3 }}>{row.d}</Body>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Zap size={13} color={C.accent} />
          <Label style={{ fontSize: 10 }}>Protocoles basket</Label>
        </div>
        <Pills
          options={Object.entries(BASKET_PROTOCOLS).map(([k, v]) => ({ key: k, label: v.title }))}
          value={basketProto} onChange={setBasketProto} small
        />
        <Body style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>{BASKET_PROTOCOLS[basketProto].sub}</Body>
        <div style={{ marginTop: 10 }}>
          {BASKET_PROTOCOLS[basketProto].blocks.map((b, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <Label style={{ color: C.accent, marginBottom: 4 }}>{b.h}</Label>
              {b.items.map((it, j) => (
                <div key={j} style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.5, paddingLeft: 10, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: C.dim }}>–</span>{it}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
