// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 6 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChevronRight, X } from "lucide-react";
import { splitExerciseList, exerciseSessions, exerciseTrend, isTimeMode, setLabel, painOutOfBase, progressiveOverloadSuggestion } from "@rawcare/core/training";
import { C, today, fmt, Card, Label, Body, Empty, Btn, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../../design/compat.jsx";
import { trendColor } from "../../lib/helpers.js";

function ExerciseDetail({ training, knee, nom, onBack }) {
  const sessions = useMemo(() => exerciseSessions(training, nom), [training, nom]);
  const mode = sessions[sessions.length - 1]?.mode;
  const temps = isTimeMode(mode);
  const trend = exerciseTrend(sessions);
  // Coach de programmation (point 3 du chantier IA, 07/09/2026) : détection JS pure du
  // plateau + suggestion de progressive overload — voir training.js pour les exclusions
  // (HSR, mode temps). Pas de suggestion un jour où le genou est hors base, même garde-fou
  // que l'affichage des records (V4) : encourager une surcharge le jour où le tendon a
  // flambé irait contre la règle de Silbernagel.
  const overload = useMemo(() => progressiveOverloadSuggestion(sessions, nom), [sessions, nom]);
  const showOverload = overload && !painOutOfBase([knee], today());
  // Grandeur tracée : les secondes en gainage, le volume (charge × reps) sinon — voir
  // `setScore`. Pas de 1RM estimé, décision explicite (tendinopathie en rééducation).
  const data = sessions.map((s) => ({ date: fmt(s.date), v: s.score, label: setLabel(s.best, s.mode) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={nom} subtitle={`${sessions.length} séance${sessions.length > 1 ? "s" : ""} · ${temps ? "tenue la plus longue" : "meilleure série"}`}
        right={<Btn variant="ghost" onClick={onBack} aria-label="Fermer" style={{ width: 52, padding: 0 }}><X size={20} aria-hidden="true" /></Btn>} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>{temps ? "Tenue · secondes" : "Volume · charge × reps"}</Label>
          <span style={{ fontSize: 13, fontFamily: C.mono, fontWeight: 800, color: trendColor(trend.key) }}>{trend.label}</span>
        </div>
        {data.length > 1 ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                {/* Le tooltip montre la série lisible (« 60 kg × 8 »), pas le volume brut :
                    c'est le chiffre qu'on reconnaît, le volume n'est qu'une échelle. */}
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                  formatter={(v, n, item) => [item.payload.label, temps ? "tenue" : "meilleure série"]} />
                <Line type="monotone" dataKey="v" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.text }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Une seule séance — la courbe apparaîtra à la deuxième.</Empty>}
      </Card>

      {showOverload && (
        <Card accentLeft style={{ padding: "13px 14px" }}>
          <Label style={{ marginBottom: 5 }}>Plateau détecté</Label>
          {overload.kind === "reps" ? (
            <Body>
              {overload.sessions} séances stables d'affilée sur{" "}
              {overload.poids} kg × {overload.from}. Vise{" "}
              <strong style={{ color: C.text }}>{overload.target} reps</strong> à {overload.poids} kg la prochaine fois
              (fourchette {overload.range.min}-{overload.range.max}).
            </Body>
          ) : (
            <Body>
              {overload.sessions} séances stables d'affilée en haut
              de la fourchette ({overload.range.min}-{overload.range.max} reps) à {overload.from} kg. Passe à la charge
              supérieure disponible et repars en bas de la fourchette.
            </Body>
          )}
        </Card>
      )}

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Séance par séance</Label>
        {sessions.slice().reverse().map((s, i) => (
          <div key={i} style={{ padding: "9px 0", borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 700, fontFamily: C.mono }}>{fmt(s.date)}</span>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 800, fontFamily: C.mono }}>
                {setLabel(s.best, s.mode)}{s.rir != null && <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}> · RIR {s.rir === 3 ? "3+" : s.rir}</span>}
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, fontFamily: C.mono, marginTop: 3 }}>
              {s.series.map((x, j) => (
                <span key={j}>{j > 0 ? " · " : ""}{isTimeMode(s.mode) ? `${x.val}s` : `${x.poids}×${x.val}`}{x.leg ? ` ${x.leg}` : ""}</span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ProgressScreen({ training, knee, onBack }) {
  const [sel, setSel] = useState(null);
  // Les exercices pas faits depuis plus de 60 j sont repliés dans « Anciens exercices » (25/10/2026,
  // demande de Yoann) : toujours consultables, jamais supprimés.
  const { active: list, stale } = useMemo(() => splitExerciseList(training), [training]);
  const [showOld, setShowOld] = useState(false);
  if (sel) return <ExerciseDetail training={training} knee={knee} nom={sel} onBack={() => setSel(null)} />;

  const oldRow = (e) => (
    <button type="button" className="p-tap" key={e.nom} onClick={() => setSel(e.nom)} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 60,
      padding: "11px 0", borderTop: `1px solid ${C.divider}`, gap: 10,
      background: "none", border: "none", borderTopStyle: "solid", textAlign: "left", fontFamily: "inherit", color: C.text,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text2, fontWeight: 700 }}>{e.nom}</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono, marginTop: 2 }}>
          {e.count} séance{e.count > 1 ? "s" : ""} · dernière {fmt(e.last)}
        </div>
      </div>
      <ChevronRight size={18} color={C.text2} aria-hidden="true" />
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Progression"
        right={<Btn variant="ghost" onClick={onBack} aria-label="Fermer" style={{ width: 52, padding: 0 }}><X size={20} aria-hidden="true" /></Btn>} />
      <Card style={{ padding: "6px 14px" }}>
        {list.length ? list.map((e) => {
          // Tendance calculée par exercice : c'est l'information qu'on vient chercher, la
          // liste seule ne dirait pas si ça monte ou si ça stagne.
          const sessions = exerciseSessions(training, e.nom);
          const t = exerciseTrend(sessions);
          // Plateau visible directement dans la liste (10/09/2026, demande explicite), pas
          // seulement en ouvrant la fiche détail — même garde-fou douleur que la fiche
          // (ExerciseDetail) et les records (V4) : pas de nudge de surcharge affiché un jour
          // où le genou est hors base.
          const overload = progressiveOverloadSuggestion(sessions, e.nom);
          const showPlateau = overload && !painOutOfBase([knee], today());
          return (
            <button type="button" className="p-tap" key={e.nom} onClick={() => setSel(e.nom)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 60,
              padding: "11px 0", borderTop: `1px solid ${C.divider}`, gap: 10,
              background: "none", border: "none", borderTopStyle: "solid", textAlign: "left", fontFamily: "inherit", color: C.text,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{e.nom}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono, marginTop: 2 }}>
                  {e.count} séance{e.count > 1 ? "s" : ""} · dernière {fmt(e.last)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {showPlateau && (
                  <span style={{ fontSize: 12, fontFamily: C.mono, fontWeight: 800, color: C.warn, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Plateau
                  </span>
                )}
                <span style={{ fontSize: 12, fontFamily: C.mono, fontWeight: 800, color: trendColor(t.key) }}>{t.label}</span>
                <ChevronRight size={18} color={C.text2} aria-hidden="true" />
              </div>
            </button>
          );
        }) : <Empty>{stale.length
          ? "Aucun exercice fait ces 60 derniers jours."
          : "Aucun exercice enregistré pour l'instant — valide une séance de muscu et il apparaîtra ici."}</Empty>}
      </Card>
      {stale.length > 0 && (
        <Card style={{ padding: "6px 14px" }}>
          <button type="button" className="p-tap" onClick={() => setShowOld((v) => !v)} aria-expanded={showOld} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", minHeight: 52, padding: "4px 0",
            background: "none", border: "none", textAlign: "left", fontFamily: "inherit",
          }}>
            <Label style={{ margin: 0 }}>Anciens exercices ({stale.length}) · pas faits depuis plus de 60 j</Label>
            <ChevronRight size={18} color={C.text2} aria-hidden="true" style={{ transform: showOld ? "rotate(90deg)" : "none", flexShrink: 0 }} />
          </button>
          {showOld && stale.map(oldRow)}
        </Card>
      )}
    </div>
  );
}
