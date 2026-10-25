// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { ResponsiveContainer, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { ChevronRight, ChevronDown, Zap } from "lucide-react";
import { getSync } from "../../store.js";
import { realDeficit, tdeeTrend, tdeeOverWindow } from "@rawcare/core/tdee";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { PHASES, targetsForDate, kcalFromMacros, tdeeNow, weeklyKcalTrend, weeklyProteinTrend, buildKcalByDate, recompWindows } from "@rawcare/core/targets";
import { C, today, fmt, Card, Label, Body, Empty, Pills, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../../ui.jsx";
import { PROT_LINE } from "../../lib/helpers.js";
import { TdeeCard } from "./TdeeCard.jsx";
import { WEEKLY_PLAN } from "../../lib/plan.js";
// Coach IA (U3 étape 4, 25/10/2026) : quitte le tableau de bord pour l'onglet Analyse
// (décision 4 du chantier U). Style v1 jusqu'à l'étape 7 (Analyse).
import { CoachIA } from "../dashboard/CoachIA.jsx";

/* ============================================================
   TAB — PERFORMANCE
   ============================================================ */
export function PerformanceTab({ macros, targets, training, weight, phase, coach, todayNote, saveNote, saveJournal }) {
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  const [planVariant, setPlanVariant] = useState("sansMatch");

  // Dépense énergétique adaptative (V7). Calculée à chaque montage de l'onglet — le journal
  // Repas et ses corrections vivent dans un autre onglet (un seul monté à la fois), donc un
  // remount suffit à rester à jour, sans mémoïsation ni dépendance fragile sur `foodLog`.
  // Toujours ancrée sur AUJOURD'HUI (l'estimation porte sur la dépense réelle actuelle).
  const tdeeToday = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
  const atToday = targetsForDate(today(), targets);
  const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
  const deficitReel = tdeeToday.status === "ok" ? realDeficit(kcalTargetToday, tdeeToday.tdee) : null;
  // Historique du TDEE semaine par semaine (13/09/2026, demande explicite) : même donnée que
  // `tdeeToday` (kcal réelles fusionnées), juste rejouée à des dates passées.
  const tdeeKcalByDate = buildKcalByDate({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, today: today() });
  const tdeeCutStart = targets.cut?.enabled !== false && targets.cut?.start ? targets.cut.start : null;
  const tdeeHistory = tdeeTrend({ weightLog: weight, kcalByDate: tdeeKcalByDate, cutStart: tdeeCutStart, todayDate: today(), weeks: 8 });
  // Comparaison des fenêtres 7/14/21/28 j (24/09/2026, demande explicite) — hors fenêtre déjà
  // retenue par l'estimation de référence, pour ne pas l'afficher deux fois.
  const tdeeWindows = [7, 14, 21, 28]
    .filter((d) => tdeeToday.status !== "ok" || d !== tdeeToday.days)
    .map((d) => tdeeOverWindow({ weightLog: weight, kcalByDate: tdeeKcalByDate, today: today(), days: d, cutStart: tdeeCutStart }));
  // Zone de recomposition (R2) : seulement en phase Recomposition, même fonction que le Coach IA.
  const recomp = PHASES[phase]?.noTarget
    ? recompWindows({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets })
    : null;

  // Moyenne hebdomadaire glissante, 7 jours (13/09/2026 — remplace l'ancienne moyenne lun-ven :
  // les cheat meals de Yoann ne suivent pas un jour fixe, exclure le week-end n'avait donc pas
  // de sens pour lui). Une vraie moyenne glissante absorbe un écart ponctuel quel que soit le
  // jour où il tombe, sans avoir à deviner lequel exclure.
  const protByWeek = new Map(weeklyProteinTrend(macros, { weeks: 8 }).map((w) => [w.weekStart, w.avgProtein]));
  const weeklyTrend = weeklyKcalTrend(macros, { weeks: 8 }).map((w) => ({ ...w, label: fmt(w.weekStart), avgProtein: protByWeek.get(w.weekStart) ?? null }));
  const weeksWithData = weeklyTrend.filter((w) => w.days > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="TDEE" />
      {coach && <CoachIA coach={coach} todayNote={todayNote} saveNote={saveNote} saveJournal={saveJournal} />}

      {/* Moyenne hebdo kcal, 7 jours glissants */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Moyenne kcal · semaine (lun-dim)</Label>
          <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>cible ~{kcalTargetToday} kcal · <span style={{ color: PROT_LINE }}>{atToday.protein} g prot.</span></span>
        </div>
        {weeksWithData.length ? (
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyTrend} margin={{ top: 4, right: -14, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="label" tick={chartAxis} interval="preserveEnd" />
                <YAxis yAxisId="kcal" tick={chartAxis} />
                <YAxis yAxisId="prot" orientation="right" tick={{ ...chartAxis, fill: PROT_LINE }} domain={["dataMin - 15", "dataMax + 15"]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                  formatter={(v, name) => (v == null ? ["—", name === "avgProtein" ? "g/j prot." : "kcal"] : [v, name === "avgProtein" ? "g/j prot." : "kcal"])} />
                <ReferenceLine yAxisId="kcal" y={kcalTargetToday} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar yAxisId="kcal" dataKey="avgKcal" radius={[3, 3, 0, 0]}>
                  {weeklyTrend.map((d, i) => (
                    <Cell key={i} fill={d.avgKcal == null ? "transparent" : Math.abs(d.avgKcal - kcalTargetToday) <= kcalTargetToday * 0.1 ? C.accent : C.border} />
                  ))}
                </Bar>
                <Line yAxisId="prot" type="monotone" dataKey="avgProtein" stroke={PROT_LINE} strokeWidth={2} dot={{ r: 3, fill: PROT_LINE, strokeWidth: 0 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          Barres : kcal, moyenne des jours réellement loggés (axe gauche). Courbe : protéines g/j, jours terminés seulement (axe droit).
        </Body>
      </Card>

      {/* Dépense énergétique adaptative (V7) */}
      <TdeeCard result={tdeeToday} deficitReel={deficitReel} trend={tdeeHistory} windows={tdeeWindows} recomp={recomp} />

      {/* Planning hebdomadaire idéal — référence affichée, jamais appliquée automatiquement */}
      <Card>
        <Label style={{ marginBottom: 8 }}>Planning idéal</Label>
        <Pills
          options={[{ key: "sansMatch", label: "Sans match" }, { key: "avecMatch", label: "Avec match" }]}
          value={planVariant} onChange={setPlanVariant} small
        />
        <div style={{ marginTop: 10 }}>
          {WEEKLY_PLAN[planVariant].map((d) => (
            <div key={d.jour} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.divider}` }}>
              <div style={{ width: 66, flexShrink: 0, fontSize: 10.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{d.jour}</div>
              <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.4 }}>{d.texte}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Péri-training */}
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

      {/* Protocoles basket détaillés (avant/pendant/après selon l'horaire) */}
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
