// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 5 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { computeEnergyScore, computeSleepScore, scoreLabel } from "@rawcare/core/energy";
import { C, today, fmt, round, upsert, lastN, fmtHM, Card, Label, Body, Empty, Btn, Stepper, Field, DateField, Pills, chartAxis, tooltipStyle, tooltipItemStyle } from "../design/compat.jsx";
import { scoreColor, avg } from "../lib/helpers.js";
import { SyncedBanner } from "../components/SyncedBanner.jsx";

/** Carte "Score d'énergie" (05/09/2026) — reconstruction façon Samsung Health depuis FC
 * repos/sommeil/pas (Health Connect, natif seulement). Détail des 4 modules toujours
 * affiché, même si le total est indisponible : voir quel module manque plutôt qu'un simple
 * "pas assez de données" muet. */
function EnergyScoreCard({ energy }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <Label style={{ fontSize: 12, letterSpacing: 1.5 }}>Score d'énergie</Label>
        {energy.status === "ok" && (
          <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 800, color: scoreColor(energy.total) }}>{energy.total}<span style={{ fontSize: 12, color: C.muted }}>/100</span></span>
        )}
      </div>
      {energy.status !== "ok" && (
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
          Pas assez de données pour un score complet — détail des modules ci-dessous.
        </Body>
      )}
      {energy.modules.map((m) => (
        <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.divider}` }}>
          <div>
            <div style={{ fontSize: 13, color: C.text2 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{m.reason}</div>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: m.points == null ? C.dim : C.text, flexShrink: 0, marginLeft: 8 }}>
            {m.points == null ? "—" : m.points}<span style={{ fontSize: 12, color: C.muted }}>/{m.max}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function SleepTab({ sleep, rhr, steps, naps, save }) {
  const [date, setDate] = useState(today());
  const cur = sleep.find((s) => s.date === date);
  const initH = lastN(sleep, 1)[0]?.hours ?? 7.5;
  const [h, setH] = useState(Math.floor(initH));
  const [min, setMin] = useState(Math.round((initH - Math.floor(initH)) * 60));
  const [quality, setQuality] = useState(3);
  const [forceManual, setForceManual] = useState(false);
  const loadHM = (dec) => { setH(Math.floor(dec)); setMin(Math.round((dec - Math.floor(dec)) * 60)); };
  const pickDate = (d) => { setDate(d); const e = sleep.find((s) => s.date === d); if (e) { loadHM(e.hours); setQuality(e.quality ?? 3); } setForceManual(false); };
  const add = () => save.sleep(upsert(sleep, { date, hours: round(h + min / 60, 2), quality, source: "manual" }));
  const isSynced = cur?.source === "healthconnect" && !forceManual;

  const last7 = lastN(sleep, 7);
  const maxH = Math.max(9, ...last7.map((s) => s.hours));
  const avg7 = avg(last7.map((s) => s.hours));
  // Moyenne QUALITÉ 7j (13/09/2026, demande explicite) : jusqu'ici seule la durée avait une
  // moyenne — la qualité (1-4, saisie ou Health Connect) n'était visible que nuit par nuit.
  const quality7 = avg(last7.filter((s) => s.quality != null).map((s) => s.quality));
  const lastNight = lastN(sleep, 1)[0];
  const data = lastN(sleep, 21).map((s) => ({ date: fmt(s.date), hours: s.hours }));
  const energy = useMemo(() => computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }), [rhr, sleep, steps, naps]);
  const sleepScore = computeSleepScore(lastNight);
  // Score de sommeil dans le temps + répartition par palier (13/09/2026, demande explicite) :
  // jusqu'ici le score (0-100, combine durée+qualité) n'était visible QUE pour la dernière
  // nuit — aucun suivi de la QUALITÉ dans la durée, seule la durée brute avait un graphique.
  const last21 = lastN(sleep, 21);
  const scoreData = last21.map((s) => ({ date: fmt(s.date), score: computeSleepScore(s) }));
  const paliers = { Excellent: 0, Bon: 0, Correct: 0, Risque: 0 };
  last21.forEach((s) => { const sc = computeSleepScore(s); if (sc != null) paliers[scoreLabel(sc)]++; });
  const paliersTotal = Object.values(paliers).reduce((a, b) => a + b, 0);
  // Sieste du jour (23/09/2026) : affichée à titre informatif à côté du vrai sommeil, jamais
  // fusionnée dedans — voir le commentaire sur `naps` plus haut.
  const todayNap = naps.find((n) => n.date === today());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      <EnergyScoreCard energy={energy} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 12, letterSpacing: 1.5 }}>Dernière nuit</Label>
          {lastNight?.quality != null && (
            <span style={{ fontSize: 13, color: C.accent, letterSpacing: 1 }}>{"★".repeat(lastNight.quality)}<span style={{ color: C.dim }}>{"★".repeat(4 - lastNight.quality)}</span></span>
          )}
        </div>
        <div style={{ margin: "6px 0 14px", display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: C.mono, fontSize: 44, fontWeight: 800, color: C.text }}>
            {lastNight ? fmtHM(lastNight.hours) : "—"}
          </span>
          {sleepScore != null && (
            <span style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: scoreColor(sleepScore) }}>
              {sleepScore}<span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>/100</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 44 }}>
          {last7.length ? last7.map((s, i) => (
            <div key={i} title={`${fmt(s.date)} · ${fmtHM(s.hours)}`} style={{
              flex: 1, borderRadius: "3px 3px 0 0",
              background: i === last7.length - 1 ? C.accent : C.border,
              height: `${Math.max(8, (s.hours / maxH) * 100)}%`,
            }} />
          )) : <Body style={{ fontSize: 13, color: C.dim }}>Aucune nuit enregistrée.</Body>}
        </div>
        {todayNap && (
          <Body style={{ fontSize: 13, color: C.accent, marginTop: 10 }}>
            + sieste aujourd'hui : {fmtHM(todayNap.minutes / 60)}
          </Body>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <Label>Durée moy. 7j</Label>
          <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>{avg7 != null ? fmtHM(avg7) : "—"}</div>
        </div>
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <Label>Qualité moy. 7j</Label>
          <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>{quality7 != null ? `${round(quality7, 1)}/4` : "—"}</div>
        </div>
      </div>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Heures"><Stepper value={h} set={setH} step={1} min={0} max={16} int /></Field>
              <Field label="Minutes"><Stepper value={min} set={setMin} step={5} min={0} max={59} int /></Field>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: C.accent, marginTop: 8, fontWeight: 700, fontFamily: C.mono }}>soit {fmtHM(h + min / 60)}</div>
            <div style={{ marginTop: 12 }}>
              <Field label="Qualité">
                <Pills options={[1, 2, 3, 4].map((n) => ({ key: n, label: "★".repeat(n) }))} value={quality} onChange={setQuality} small />
              </Field>
              <Body style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>★ Attention requise · ★★ Correct · ★★★ Bon · ★★★★ Excellent</Body>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {sleep.some((s) => s.date === date) && (
                <Btn variant="danger" aria-label="Supprimer l'entrée de ce jour" onClick={() => save.sleep(sleep.filter((s) => s.date !== date))}><Trash2 size={18} aria-hidden="true" /></Btn>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Sommeil · 21 jours</Label>
        {data.length ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip formatter={(v) => [fmtHM(v), "Sommeil"]} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={7} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.hours >= 7 ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>

      {/* Score de sommeil dans le temps (13/09/2026, demande explicite) : durée seule ne dit
          rien de la QUALITÉ — deux nuits de 7h peuvent avoir une efficacité très différente.
          Même score que "Dernière nuit"/le score d'énergie, jamais un second calcul. */}
      <Card>
        <Label style={{ marginBottom: 8 }}>Score de sommeil · 21 jours</Label>
        {scoreData.some((d) => d.score != null) ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} domain={[0, 100]} />
                <Tooltip formatter={(v) => (v == null ? ["—", "score"] : [v, "score"])} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={75} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {scoreData.map((d, i) => <Cell key={i} fill={d.score == null ? "transparent" : scoreColor(d.score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>

      {/* Répartition par palier (13/09/2026) : vue d'ensemble rapide sur la période, sans
          avoir à relire 21 barres une par une. Mêmes paliers/couleurs que "Dernière nuit" et
          le score d'énergie (`scoreLabel`/`scoreColor`), jamais un second barème. */}
      <Card>
        <Label style={{ marginBottom: 8 }}>Répartition · 21 jours</Label>
        {paliersTotal ? (
          <div style={{ display: "flex", gap: 8 }}>
            {[["Excellent", 90], ["Bon", 80], ["Correct", 65], ["Risque", 30]].map(([label, sample]) => (
              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: scoreColor(sample) }}>{paliers[label]}</div>
                <div style={{ fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}
