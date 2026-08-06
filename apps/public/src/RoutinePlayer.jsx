import { useState, useRef, useEffect, useMemo } from "react";
import { X, CheckCircle2, RotateCcw, Play, Pause, SkipForward } from "lucide-react";
import { C, Card, Label, Body, Btn } from "./ui.jsx";

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function flatten(blocks) {
  const steps = [];
  blocks.forEach((b) => {
    for (let i = 1; i <= b.rounds; i++) {
      steps.push({ label: b.label, note: b.note, kind: "work", sec: b.work, round: i, rounds: b.rounds });
      if (b.rest > 0 && i < b.rounds) steps.push({ label: "Repos", note: "", kind: "rest", sec: b.rest, round: i, rounds: b.rounds });
    }
  });
  return steps;
}

// Port verbatim de RoutinePlayer (apps/perso/src/App.jsx) — RawCare Phase 2, Douleurs.
// Purement visuel (pas de Web Audio/vibration côté apps/perso non plus), donc rien à
// simplifier pour la version web.
export default function RoutinePlayer({ routine, onClose }) {
  const steps = useMemo(() => flatten(routine.blocks), [routine]);
  const [idx, setIdx] = useState(0);
  const [rem, setRem] = useState(steps[0]?.sec ?? 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tick = useRef();

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setRem((r) => {
        if (r > 1) return r - 1;
        clearInterval(tick.current);
        setIdx((i) => {
          const next = i + 1;
          if (next >= steps.length) { setRunning(false); setDone(true); return i; }
          setRem(steps[next].sec);
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [running, idx, steps]);

  const cur = steps[idx];
  const skip = () => {
    clearInterval(tick.current);
    const next = idx + 1;
    if (next >= steps.length) { setRunning(false); setDone(true); return; }
    setIdx(next); setRem(steps[next].sec);
  };
  const reset = () => { clearInterval(tick.current); setRunning(false); setDone(false); setIdx(0); setRem(steps[0].sec); };

  return (
    <Card style={{ borderColor: C.accent }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, textTransform: "uppercase" }}>{routine.title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={16} /></button>
      </div>
      {done ? (
        <div style={{ textAlign: "center", padding: "18px 0" }}>
          <CheckCircle2 size={30} color={C.accent} style={{ margin: "0 auto 8px" }} />
          <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Routine terminée.</div>
          <Btn variant="plain" onClick={reset} style={{ marginTop: 12 }}><RotateCcw size={13} style={{ display: "inline", marginRight: 5 }} />Recommencer</Btn>
        </div>
      ) : (
        <>
          <div style={{
            background: cur.kind === "rest" ? C.bg : C.accentRow,
            border: `1.5px solid ${cur.kind === "rest" ? C.border : C.accent}`,
            borderRadius: 8, padding: 18, textAlign: "center", marginBottom: 12,
          }}>
            <Label>{cur.kind === "rest" ? "Repos" : `Bloc ${cur.round}/${cur.rounds}`}</Label>
            <div style={{ fontFamily: C.mono, fontSize: 46, fontWeight: 800, color: cur.kind === "rest" ? C.text : C.accent, margin: "6px 0" }}>{mmss(rem)}</div>
            <div style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{cur.label}</div>
            {cur.note && <Body style={{ fontSize: 11, marginTop: 4 }}>{cur.note}</Body>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => setRunning((r) => !r)} style={{ flex: 1 }}>
              {running ? <><Pause size={14} style={{ display: "inline", marginRight: 5 }} />Pause</> : <><Play size={14} style={{ display: "inline", marginRight: 5 }} />Démarrer</>}
            </Btn>
            <Btn variant="plain" onClick={skip}><SkipForward size={14} /></Btn>
            <Btn variant="plain" onClick={reset}><RotateCcw size={14} /></Btn>
          </div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 8, textAlign: "center", fontFamily: C.mono }}>Étape {idx + 1}/{steps.length}</div>
        </>
      )}
    </Card>
  );
}
