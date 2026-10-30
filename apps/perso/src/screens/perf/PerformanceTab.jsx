// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; onglet Analyse en v2 à l'étape 7 d'U3
// (design/compat.jsx). Planning idéal → onglet Séance, péri-training et protocoles basket →
// Nutrition (arborescence A, U1) : voir ReferenceCards.jsx.
import { useState } from "react";
import { ResponsiveContainer, Line, Bar, BarChart, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { ChevronRight, ChevronDown, Zap } from "lucide-react";
import { getSync } from "../../store.js";
import { realDeficit, tdeeTrend, tdeeOverWindow } from "@rawcare/core/tdee";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { PHASES, targetsForDate, kcalFromMacros, tdeeNow, weeklyKcalTrend, weeklyProteinTrend, buildKcalByDate, recompWindows } from "@rawcare/core/targets";
import { C, today, fmt, Card, Label, Empty, Pills, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../../design/compat.jsx";
import { PROT_LINE } from "../../lib/helpers.js";
import { progressColor, MACRO_KIND } from "../../lib/progress.js";
import { macroAverages, dailyKcal, mealBreakdown, regularity } from "@rawcare/core/nutritionStats";
import { TdeeCard } from "./TdeeCard.jsx";
import { WEEKLY_PLAN } from "../../lib/plan.js";
// Jeffrey (chantier J, J1.2, 29/10/2026) : la conversation remplace la carte Coach IA, à la même
// place (« Faites-moi le point » remplace « Analyser », le bilan 3 mois passe dans sa voix).
import { JeffreyChat } from "./JeffreyChat.jsx";
import { sayStable } from "../../lib/jeffrey.js";
import { SubTabs } from "../../components/SubTabs.jsx";

// Sous-onglets (30/10/2026, retour de Yoann : la conversation prenait toute la place). Jeffrey
// s'ouvre d'abord ; le dernier sous-onglet ouvert est retenu pendant la session, comme Corps et
// les Réglages. Chaque sous-onglet ne calcule que ce qu'il affiche.
const ANALYSE_TABS = [
  { key: "jeffrey", label: "Jeffrey" },
  { key: "calories", label: "Calories" },
  { key: "depense", label: "Dépense" },
];
let lastAnalyseTab = "jeffrey";

/* ============================================================
   TAB — PERFORMANCE
   ============================================================ */
export function PerformanceTab({ macros, targets, training, weight, phase, coach, jeffrey }) {
  const [sub, setSub] = useState(lastAnalyseTab);
  const pick = (k) => { lastAnalyseTab = k; setSub(k); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <SubTabs label="Sections de l'analyse" tabs={ANALYSE_TABS} value={sub} onChange={pick} sticky />
      {sub === "jeffrey" && jeffrey && <JeffreyChat {...jeffrey} />}
      {sub === "calories" && <CaloriesView macros={macros} targets={targets} />}
      {sub === "depense" && <DepenseView macros={macros} targets={targets} weight={weight} phase={phase} />}
    </div>
  );
}

/** Cible kcal et protéines du jour (mêmes calculs que la carte et le TDEE). */
function todayTargets(targets) {
  const atToday = targetsForDate(today(), targets);
  return { atToday, kcalTargetToday: Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber)) };
}

/* Moyenne hebdo kcal + protéines par semaine, puis (30/10/2026, choix de Yoann) moyennes 7 j
   des macros, kcal jour par jour, répartition par repas et régularité (core/nutritionStats.js). */
function CaloriesView({ macros, targets }) {
  const foodLog = getSync("foodLog", []);
  const overrides = getSync("foodOverrides", {});
  return (
    <>
      <WeeklyCard macros={macros} targets={targets} />
      <AveragesCard macros={macros} targets={targets} />
      <DailyCard macros={macros} targets={targets} />
      <MealsCard foodLog={foodLog} overrides={overrides} />
      <RegularityCard macros={macros} foodLog={foodLog} targets={targets} />
    </>
  );
}

/** Couleur d'une barre de kcal : au-delà de la cible orange puis rouge, jusqu'à −10 % citron, plus bas gris. */
const kcalBarColor = (kcal, target) =>
  kcal == null ? "transparent" : kcal > target ? progressColor(kcal, target, "limit") : kcal >= target * 0.9 ? C.accent : C.border;

const cardHead = (title, note) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
    <Label>{title}</Label>
    {note && <span style={{ fontSize: 12, color: C.muted, fontFamily: C.mono }}>{note}</span>}
  </div>
);

const signed = (d) => (d > 0 ? `+${d}` : d === 0 ? "±0" : `${d}`);

function AvgRow({ label, value, prev, target, unit, kind }) {
  const color = progressColor(value, target, kind);
  const pct = value != null && target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "4px 8px", padding: "7px 0", borderTop: `1px solid ${C.divider}` }}>
      <span style={{ fontSize: 13, color: C.text2 }}>
        {label}
        {value != null && prev != null && <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted, marginLeft: 8 }}>{signed(value - prev)}</span>}
      </span>
      <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: value == null ? C.muted : color }}>
        {value ?? "—"}<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> / {target} {unit}</span>
      </span>
      <div style={{ gridColumn: "1 / -1", height: 4, borderRadius: 2, background: C.borderDim }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 2, background: color }} />
      </div>
    </div>
  );
}

/* Moyennes des 7 derniers jours terminés, écart avec les 7 jours d'avant. */
function AveragesCard({ macros, targets }) {
  const { atToday, kcalTargetToday } = todayTargets(targets);
  const { cur, prev } = macroAverages(macros);
  return (
    <Card>
      {cardHead("Moyenne · 7 jours", cur ? `${cur.days} j saisis · écart vs 7 j préc.` : null)}
      {cur ? (
        <div>
          <AvgRow label="Calories" value={cur.kcal} prev={prev?.kcal} target={kcalTargetToday} unit="kcal" kind={MACRO_KIND.kcal} />
          <AvgRow label="Protéines" value={cur.protein} prev={prev?.protein} target={atToday.protein} unit="g" kind={MACRO_KIND.prot} />
          <AvgRow label="Glucides" value={cur.carbs} prev={prev?.carbs} target={atToday.carbs} unit="g" kind={MACRO_KIND.gluc} />
          <AvgRow label="Lipides" value={cur.fat} prev={prev?.fat} target={atToday.fat} unit="g" kind={MACRO_KIND.lip} />
          <AvgRow label="Fibres" value={cur.fiber} prev={prev?.fiber} target={atToday.fiber} unit="g" kind={MACRO_KIND.fib} />
        </div>
      ) : <Empty>{sayStable("noData")}</Empty>}
    </Card>
  );
}

/* Kcal jour par jour sur 14 jours : les écarts ponctuels que la moyenne de la semaine lisse. */
function DailyCard({ macros, targets }) {
  const { kcalTargetToday } = todayTargets(targets);
  const data = dailyKcal(macros, targets).map((d) => ({ ...d, label: d.date.slice(8) }));
  const any = data.some((d) => d.kcal != null);
  return (
    <Card>
      {cardHead("Kcal · 14 jours", `cible ~${kcalTargetToday} · aujourd'hui en cours`)}
      {any ? (
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={C.divider} vertical={false} />
              <XAxis dataKey="label" tick={chartAxis} interval={1} />
              <YAxis tick={chartAxis} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} cursor={{ fill: "rgba(255,255,255,.04)" }}
                labelFormatter={(_, p) => (p?.[0] ? `${fmt(p[0].payload.date)}${p[0].payload.partial ? " · en cours" : ""}` : "")}
                formatter={(v) => [v == null ? "—" : v, "kcal"]} />
              <ReferenceLine y={kcalTargetToday} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
              <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.partial && d.kcal != null ? C.muted : kcalBarColor(d.kcal, d.target)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty>{sayStable("noData")}</Empty>}
    </Card>
  );
}

/* Moyenne par repas et par jour saisi, 14 derniers jours terminés. */
function MealsCard({ foodLog, overrides }) {
  const { days, meals } = mealBreakdown(foodLog, overrides);
  return (
    <Card>
      {cardHead("Par repas · 14 jours", days ? `moyenne par jour · ${days} j saisis` : null)}
      {meals.length ? (
        <div>
          {meals.map((m) => (
            <div key={m.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "baseline", gap: "4px 12px", padding: "7px 0", borderTop: `1px solid ${C.divider}` }}>
              <span style={{ fontSize: 13, color: C.text2, minWidth: 0 }}>{m.label}</span>
              <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.text, textAlign: "right" }}>{m.kcal}<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> kcal</span></span>
              <span style={{ fontFamily: C.mono, fontSize: 13, color: PROT_LINE, textAlign: "right", minWidth: 44 }}>{m.prot} g</span>
              <div style={{ gridColumn: "1 / -1", height: 4, borderRadius: 2, background: C.borderDim }}>
                <div style={{ width: `${Math.max(0, m.share) * 100}%`, height: "100%", borderRadius: 2, background: C.accent, opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>{sayStable("noData")}</Empty>}
    </Card>
  );
}

/* Régularité sur 28 jours terminés : saisie, respect de la cible, alcool. */
function RegularityCard({ macros, foodLog, targets }) {
  const r = regularity({ macros, foodLog, targets });
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "7px 0", borderTop: `1px solid ${C.divider}` }}>
      <span style={{ fontSize: 13, color: C.text2 }}>{label}</span>
      <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.text }}>{value}</span>
    </div>
  );
  return (
    <Card>
      {cardHead(`Régularité · ${r.days} jours`, null)}
      {row("Jours saisis", <>{r.logged}<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> / {r.days}</span></>)}
      {row("Dans ±10 % de la cible", <>{r.inRange}<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> / {r.logged}</span></>)}
      {row("Alcool", <>{r.alcohol7} g<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> sur 7 j · {r.alcohol28} g sur {r.days} j</span></>)}
    </Card>
  );
}

/* Moyenne hebdo kcal + protéines, semaine par semaine. */
function WeeklyCard({ macros, targets }) {
  const { atToday, kcalTargetToday } = todayTargets(targets);
  // Moyenne hebdomadaire glissante, 7 jours (13/09/2026 — remplace l'ancienne moyenne lun-ven :
  // les cheat meals de Yoann ne suivent pas un jour fixe, exclure le week-end n'avait donc pas
  // de sens pour lui). Une vraie moyenne glissante absorbe un écart ponctuel quel que soit le
  // jour où il tombe, sans avoir à deviner lequel exclure.
  const protByWeek = new Map(weeklyProteinTrend(macros, { weeks: 8 }).map((w) => [w.weekStart, w.avgProtein]));
  const weeklyTrend = weeklyKcalTrend(macros, { weeks: 8 }).map((w) => ({ ...w, label: fmt(w.weekStart), avgProtein: protByWeek.get(w.weekStart) ?? null }));
  const weeksWithData = weeklyTrend.filter((w) => w.days > 0);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
        <Label>Moyenne kcal · semaine (lun-dim)</Label>
        <span style={{ fontSize: 13, color: C.muted, fontFamily: C.mono }}>cible ~{kcalTargetToday} kcal · <span style={{ color: PROT_LINE }}>{atToday.protein} g prot.</span></span>
      </div>
      {weeksWithData.length ? (
        <div style={{ height: 160 }}>
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
                  // Au-delà de la cible : orange puis rouge (lib/progress.js) ; jusqu'à 10 % sous la
                  // cible : citron ; plus bas : gris.
                  <Cell key={i} fill={d.avgKcal == null ? "transparent" : d.avgKcal > kcalTargetToday ? progressColor(d.avgKcal, kcalTargetToday, "limit") : d.avgKcal >= kcalTargetToday * 0.9 ? C.accent : C.border} />
                ))}
              </Bar>
              <Line yAxisId="prot" type="monotone" dataKey="avgProtein" stroke={PROT_LINE} strokeWidth={2} dot={{ r: 3, fill: PROT_LINE, strokeWidth: 0 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty>{sayStable("noData")}</Empty>}
    </Card>
  );
}

/* Dépense énergétique adaptative (V7), zone de recomposition (R2), comparaison des fenêtres. */
function DepenseView({ macros, targets, weight, phase }) {
  const { kcalTargetToday } = todayTargets(targets);
  // Calculée à chaque ouverture du sous-onglet — le journal Repas et ses corrections vivent dans
  // un autre onglet, donc un nouvel affichage suffit à rester à jour, sans mémoïsation ni
  // dépendance fragile sur `foodLog`. Toujours ancrée sur AUJOURD'HUI (dépense réelle actuelle).
  const tdeeToday = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
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
  return <TdeeCard result={tdeeToday} deficitReel={deficitReel} trend={tdeeHistory} windows={tdeeWindows} recomp={recomp} />;
}
