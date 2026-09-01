import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import { kcalFromMacros, kcalOfEntry, tdeeNow, weeklyWeekdayKcalTrend } from "@rawcare/core/targets";
import { mergeTargets, targetsForDate } from "./defaultTargets.js";
import { realDeficit, MIN_WINDOW_DAYS } from "@rawcare/core/tdee";
import { PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { today, fmt } from "@rawcare/core/dateUtils";
import {
  C, Card, Label, Body, Empty, Pills, ScreenHeader,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";

// Onglet Performance — ex-onglet "Macros" (revue du 01/09/2026, port depuis apps/perso).
// La saisie manuelle quotidienne, les cibles P/G/L/Fib du jour et le graphique 14 jours ont
// été retirés : redondants avec l'onglet Macro (ex-Repas), qui les affiche déjà à partir de
// foodLog. Cet onglet garde uniquement ce qui n'est pas du suivi quotidien : dépense
// estimée, péri-training, protocole basket, et une nouvelle moyenne hebdo lundi-vendredi.
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

export default function PerformanceTab({ data, update, error: loadError }) {
  const macros = data?.macroLog || [];
  const weight = data?.weightLog || [];
  const targets = mergeTargets(data?.targets);

  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");

  // Dépense énergétique adaptative (V7) : `foodLog`/`foodOverrides` toujours vides côté
  // apps/public pour l'instant (mêmes limites que l'ancien MacroTab).
  const tdeeToday = tdeeNow({ foodLog: [], overrides: {}, macros, weight, targets });
  const atToday = targetsForDate(today(), targets);
  const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
  const deficitReel = tdeeToday.status === "ok" ? realDeficit(kcalTargetToday, tdeeToday.tdee) : null;

  // Moyenne hebdomadaire lundi-vendredi (revue du 01/09/2026, port depuis apps/perso) :
  // remplace l'ancien graphique 14 jours quotidien, redondant avec l'onglet Macro.
  const weeklyTrend = weeklyWeekdayKcalTrend(macros, { weeks: 8 }).map((w) => ({ ...w, label: fmt(w.weekStart) }));
  const weeksWithData = weeklyTrend.filter((w) => w.days > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="TDEE" />

      {loadError && <p style={{ color: C.danger, fontSize: 12 }}>{loadError}</p>}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Moyenne kcal · lun-ven</Label>
          <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>cible ~{kcalTargetToday} kcal</span>
        </div>
        {weeksWithData.length ? (
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="label" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                  formatter={(v) => (v == null ? ["—", "kcal"] : [v, "kcal"])} />
                <ReferenceLine y={kcalTargetToday} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="avgKcal" radius={[3, 3, 0, 0]}>
                  {weeklyTrend.map((d, i) => (
                    <Cell key={i} fill={d.avgKcal == null ? "transparent" : Math.abs(d.avgKcal - kcalTargetToday) <= kcalTargetToday * 0.1 ? C.accent : C.border} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          Semaine du lundi, moyenne sur les jours ouvrés réellement loggés — le week-end n'est
          jamais compté dans cette moyenne.
        </Body>
      </Card>

      <TdeeCard result={tdeeToday} deficitReel={deficitReel} />

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
