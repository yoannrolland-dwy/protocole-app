// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; onglet Analyse en v2 à l'étape 7 d'U3
// (design/compat.jsx). Planning idéal → onglet Séance, péri-training et protocoles basket →
// Nutrition (arborescence A, U1) : voir ReferenceCards.jsx.
import { useState } from "react";
import { ResponsiveContainer, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { ChevronRight, ChevronDown, Zap } from "lucide-react";
import { getSync } from "../../store.js";
import { realDeficit, tdeeTrend, tdeeOverWindow } from "@rawcare/core/tdee";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { PHASES, targetsForDate, kcalFromMacros, tdeeNow, weeklyKcalTrend, weeklyProteinTrend, buildKcalByDate, recompWindows } from "@rawcare/core/targets";
import { C, today, fmt, Card, Label, Empty, Pills, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../../design/compat.jsx";
import { PROT_LINE } from "../../lib/helpers.js";
import { progressColor } from "../../lib/progress.js";
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
      <SubTabs label="Sections de l'analyse" tabs={ANALYSE_TABS} value={sub} onChange={pick} />
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

/* Moyenne hebdo kcal + protéines, 7 jours glissants. */
function CaloriesView({ macros, targets }) {
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
