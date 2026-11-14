// Carte « Force par groupe » (14/11/2026, demande de Yoann), sous-onglet Progrès de Séance.
// Lecture seule : calcul dans `@rawcare/core/strength` (1RM estimé, base 100 = 4 premières
// semaines de chaque exercice, force relative = ramenée au poids de corps^0,67).
import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { strengthByGroup } from "@rawcare/core/strength";
import { C, Card, Label, Body, fmt, chartAxis, tooltipStyle, tooltipItemStyle } from "../../design/compat.jsx";
import { sayStable } from "../../lib/jeffrey.js";

const signed = (n) => (n > 0 ? `+${n}` : String(n));
const changeColor = (n) => (n > 0 ? C.accent : n < 0 ? C.warn : C.muted);
const kg = (v) => String(v).replace(".", ",");

export function StrengthCard({ training, weight }) {
  const groups = useMemo(() => strengthByGroup(training, weight), [training, weight]);
  const [open, setOpen] = useState(null);
  return (
    <Card style={{ padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <Label style={{ letterSpacing: 1.5 }}>Force par groupe</Label>
        <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>brut · relatif au poids</span>
      </div>
      {groups.length ? groups.map((g) => {
        const on = open === g.groupe;
        return (
          <div key={g.groupe} style={{ borderTop: `1px solid ${C.divider}` }}>
            <button type="button" className="p-tap" aria-expanded={on} onClick={() => setOpen(on ? null : g.groupe)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 52, padding: "6px 0",
                background: "none", border: "none", color: C.text, fontFamily: "inherit", textAlign: "left" }}>
              {on ? <ChevronDown size={16} aria-hidden="true" color={C.muted} /> : <ChevronRight size={16} aria-hidden="true" color={C.muted} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{g.label}</span>
              <span style={{ display: "grid", justifyItems: "end", gap: 1 }}>
                <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800 }}>{g.index}</span>
                {g.change4w != null && (
                  <span style={{ fontFamily: C.mono, fontSize: 12, color: changeColor(g.change4w) }}>{signed(g.change4w)} en 4 sem.</span>
                )}
              </span>
              <span style={{ display: "grid", justifyItems: "end", gap: 1, minWidth: 64 }}>
                <span style={{ fontFamily: C.mono, fontSize: 15, color: C.text2 }}>{g.rel ?? "—"}</span>
                <span style={{ fontSize: 12, color: C.dim }}>relatif</span>
              </span>
            </button>
            {on && (
              <div style={{ display: "grid", gap: 8, paddingBottom: 12 }}>
                {g.points.length > 1 && (
                  <div style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={g.points.map((p) => ({ ...p, d: fmt(p.date) }))} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke={C.divider} vertical={false} />
                        <XAxis dataKey="d" tick={chartAxis} interval="preserveEnd" />
                        <YAxis tick={chartAxis} domain={["dataMin - 3", "dataMax + 3"]} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                          formatter={(v, n) => [v, n === "index" ? "force brute" : "relative au poids"]} />
                        <Line type="monotone" dataKey="index" stroke={C.accent} strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="rel" stroke={C.text2} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {g.exercices.map((e) => (
                  <div key={e.nom} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span style={{ color: C.text2, minWidth: 0 }}>
                      {e.nom}
                      <span style={{ display: "block", fontSize: 12, color: C.dim }}>
                        1RM estimé {kg(e.e1rm)} kg{e.materiel === "halteres" ? " par haltère" : ""} · départ {kg(e.base)} kg le {fmt(e.since)}
                      </span>
                    </span>
                    <span style={{ fontFamily: C.mono, fontWeight: 800, color: changeColor(e.pct), whiteSpace: "nowrap" }}>{signed(e.pct)} %</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }) : <Body style={{ fontSize: 13, color: C.dim }}>{sayStable("noStrength")}</Body>}
      <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
        100 = vos 4 premières semaines sur chaque exercice. Force brute : 1RM estimé (Epley, reps + RIR, séries de 12 au plus),
        comparé à vous-même, donc taille et leviers s'annulent. Relatif : ramené à votre poids (poids^0,67) — il monte aussi
        quand vous séchez. Quadriceps non compté : ses exercices suivent le protocole du genou.
      </Body>
    </Card>
  );
}
