import { useMemo, useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { exerciseList, exerciseSessions, exerciseTrend, setLabel, isTimeMode } from "@rawcare/core/training";
import { fmt } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body, Empty, Btn, ScreenHeader } from "./ui.jsx";

// Port simplifié de ProgressScreen + ExerciseDetail (apps/perso) — RawCare Phase 2, Séances.
// Simplification assumée (voir CLAUDE.md) : pas de LineChart recharts ici, contrairement à
// Poids/Sommeil/Pas — une liste "séance par séance" avec la tendance calculée suffit à lire
// une progression, et ça n'a pas été demandé explicitement pour cet écran précis.
const trendColor = (key) => (key === "up" ? C.accent : key === "down" ? C.danger : C.muted);

function ExerciseDetail({ training, nom, onBack }) {
  const sessions = useMemo(() => exerciseSessions(training, nom), [training, nom]);
  const mode = sessions[sessions.length - 1]?.mode;
  const temps = isTimeMode(mode);
  const trend = exerciseTrend(sessions);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={nom} subtitle={`${sessions.length} séance${sessions.length > 1 ? "s" : ""} · ${temps ? "tenue la plus longue" : "meilleure série"}`}
        right={<Btn variant="ghost" onClick={onBack}><X size={16} /></Btn>} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label>{temps ? "Tenue · secondes" : "Volume · charge × reps"}</Label>
          <span style={{ fontSize: 11, fontFamily: C.mono, fontWeight: 800, color: trendColor(trend.key) }}>{trend.label}</span>
        </div>
      </Card>

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Séance par séance</Label>
        {sessions.length ? sessions.slice().reverse().map((s, i) => (
          <div key={i} style={{ padding: "9px 0", borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 700, fontFamily: C.mono }}>{fmt(s.date)}</span>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 800, fontFamily: C.mono }}>{setLabel(s.best, s.mode)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono, marginTop: 3 }}>
              {s.series.map((x, j) => (
                <span key={j}>{j > 0 ? " · " : ""}{isTimeMode(s.mode) ? `${x.val}s` : `${x.poids}×${x.val}`}{x.leg ? ` ${x.leg}` : ""}</span>
              ))}
            </div>
          </div>
        )) : <Empty>Aucune séance.</Empty>}
      </Card>
    </div>
  );
}

export default function ProgressScreen({ training, onBack }) {
  const [sel, setSel] = useState(null);
  const list = useMemo(() => exerciseList(training), [training]);
  if (sel) return <ExerciseDetail training={training} nom={sel} onBack={() => setSel(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Progression" subtitle="par exercice · meilleure série de chaque séance"
        right={<Btn variant="ghost" onClick={onBack}><X size={16} /></Btn>} />
      <Card style={{ padding: "6px 14px" }}>
        {list.length ? list.map((e) => {
          const t = exerciseTrend(exerciseSessions(training, e.nom));
          return (
            <div key={e.nom} onClick={() => setSel(e.nom)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 0", borderTop: `1px solid ${C.divider}`, cursor: "pointer", gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{e.nom}</div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, marginTop: 2 }}>
                  {e.count} séance{e.count > 1 ? "s" : ""} · dernière {fmt(e.last)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontFamily: C.mono, fontWeight: 800, color: trendColor(t.key) }}>{t.label}</span>
                <ChevronRight size={13} color={C.dim} />
              </div>
            </div>
          );
        }) : <Empty>Aucun exercice enregistré pour l'instant — valide une séance de muscu et il apparaîtra ici.</Empty>}
      </Card>
    </div>
  );
}
