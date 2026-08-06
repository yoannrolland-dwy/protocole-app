import { useState, useRef, useEffect, useMemo } from "react";
import { CheckCircle2, Circle, X, Timer, Play, Pause, RotateCcw, Plus } from "lucide-react";
import { TEMPLATES, hsrForWeek, hsrParse, parseSecs } from "@rawcare/core/session/templates";
import { lastPerf, lastExerciseSets, perfHistory, medianTarget } from "@rawcare/core/session/perf";
import { recordToBeat, beats, setLabel } from "@rawcare/core/training";
import { DEFAULT_WEIGHTS } from "@rawcare/core/session/templates";
import { fmt } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body, Btn, TextInput, Field, DateField } from "./ui.jsx";

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Port de MuscuLogger (apps/perso/src/App.jsx) — RawCare Phase 2, Séances (carnet complet).
// Simplification assumée (voir CLAUDE.md) : minuteur WEB-ONLY, bip Web Audio + vibration
// seulement — apps/public est un site web pur, pas de Capacitor, donc pas de branche
// scheduleRestAlarm/AlarmManager. C'est exactement le chemin déjà emprunté par apps/perso
// quand il tourne dans un navigateur (pas l'app native).
export default function MuscuLogger({ type, training, hsrWeek, date, onDate, onSave, onCancel, initial, painRed = false }) {
  const template = TEMPLATES[type];
  const hp = hsrParse(hsrForWeek(hsrWeek).scheme);

  const buildExos = () => template.exos.map((ex) => {
    const nSeries = ex.hsr ? hp.series : ex.s;
    const last = lastPerf(training, ex.n);
    const lastSets = lastExerciseSets(training, ex.n);
    const target = ex.hsr ? `${hp.reps}` : ex.r;
    const def = DEFAULT_WEIGHTS[ex.n];
    const medVal = medianTarget(target);

    const savedEx = initial?.exercices?.find((e) => e.nom === ex.n);
    if (savedEx) {
      return { nom: ex.n, mode: ex.mode, perLeg: !!ex.perLeg, opt: !!ex.opt, rest: ex.rest,
        target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${ex.s} × ${ex.r}`, consigne: ex.c, def, last,
        series: savedEx.series.map((s) => ({ poids: s.poids, val: s.val, fait: s.fait, leg: s.leg })) };
    }

    const pick = (leg, k) => {
      if (!lastSets) return null;
      const pool = leg == null ? lastSets : lastSets.filter((s) => s.leg === leg);
      return pool[k] || null;
    };
    const mk = (leg, k) => {
      const prev = pick(leg, k);
      return {
        poids: prev?.poids ?? last?.poids ?? def ?? "",
        val: prev?.val ?? (medVal === "" ? "" : medVal),
        fait: false, leg,
      };
    };
    const series = ex.perLeg
      ? [...Array(nSeries)].map((_, k) => mk("G", k)).concat([...Array(nSeries)].map((_, k) => mk("D", k)))
      : [...Array(nSeries)].map((_, k) => mk(null, k));
    return { nom: ex.n, mode: ex.mode, perLeg: !!ex.perLeg, opt: !!ex.opt, rest: ex.rest,
      target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${ex.s} × ${ex.r}`, consigne: ex.c, def, last, series };
  });

  const [start, setStart] = useState(() => initial?.start ?? new Date().toTimeString().slice(0, 5));
  const [exos, setExos] = useState(buildExos);
  const [open, setOpen] = useState(0);
  const [hist, setHist] = useState(null);

  // ---- timer (repos + maintien), web-only : bip Web Audio + vibration ----
  const [tSecs, setTSecs] = useState(120);
  const [tRem, setTRem] = useState(120);
  const [tRun, setTRun] = useState(false);
  const [lastTimerByExo, setLastTimerByExo] = useState({});
  const tRef = useRef();
  const audioRef = useRef();
  const prevRem = useRef(120);
  const ensureAudio = () => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioRef.current.state === "suspended") audioRef.current.resume();
    } catch { /* audio indispo */ }
  };
  const beep = () => {
    try {
      const ctx = audioRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        [0, 0.1, 0.2].forEach((t) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.value = 880;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.exponentialRampToValueAtTime(0.175, now + t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.08);
          o.start(now + t); o.stop(now + t + 0.085);
        });
      }
    } catch { /* ignore */ }
    try { navigator.vibrate?.([200, 90, 200]); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (!tRun) return;
    tRef.current = setInterval(() => setTRem((r) => { if (r <= 1) { clearInterval(tRef.current); setTRun(false); return 0; } return r - 1; }), 1000);
    return () => clearInterval(tRef.current);
  }, [tRun]);
  useEffect(() => {
    if (prevRem.current > 0 && tRem === 0) beep();
    prevRem.current = tRem;
  }, [tRem]);
  useEffect(() => () => clearInterval(tRef.current), []);

  const fireTimer = (s) => {
    ensureAudio(); clearInterval(tRef.current);
    setTSecs(s); setTRem(s); setTRun(true);
  };
  const setTimer = (s) => {
    clearInterval(tRef.current); setTRun(false); setTSecs(s); setTRem(s);
  };
  const toggleRun = () => {
    ensureAudio();
    setTRun((r) => !r);
  };
  const recordLast = (ei, s) => setLastTimerByExo((p) => ({ ...p, [ei]: s }));
  const openExo = (ei) => {
    const next = open === ei ? -1 : ei;
    setOpen(next);
    if (next !== -1 && next !== open) setTimer(lastTimerByExo[next] ?? exos[next].rest);
  };

  // ---- mutateurs ----
  const upd = (ei, si, field, value) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, [field]: value }) }));
  const toggle = (ei, si) => {
    setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, fait: !s.fait }) }));
    if (!exos[ei].series[si].fait) fireTimer(lastTimerByExo[ei] ?? exos[ei].rest);
  };
  const addSet = (ei, leg) => setExos((p) => p.map((e, i) => {
    if (i !== ei) return e;
    const sameLeg = e.series.filter((s) => s.leg === leg);
    const proto = sameLeg[sameLeg.length - 1] || {};
    return { ...e, series: [...e.series, { poids: proto.poids ?? "", val: proto.val ?? medianTarget(e.target), fait: false, leg }] };
  }));
  const rmSet = (ei, si) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.filter((_, j) => j !== si) }));

  const validate = () => {
    onSave({
      id: initial?.id ?? `${date}-${type}-${Date.now()}`,
      date, type, start,
      exercices: exos.map((e) => ({
        nom: e.nom, mode: e.mode, perLeg: e.perLeg,
        series: e.series
          .filter((s) => s.poids !== "" || s.val !== "" || s.fait)
          .map((s) => ({ poids: s.poids === "" ? 0 : +s.poids, val: s.val === "" ? 0 : +s.val, fait: s.fait, leg: s.leg })),
      })).filter((e) => e.series.length),
    });
  };

  const doneCount = exos.filter((e) => e.series.some((s) => s.fait)).length;
  const GRID = "30px 1fr 1fr 26px 18px";

  // ---- records (V4) ----
  const refRecords = useMemo(() => {
    const m = {};
    exos.forEach((e) => { m[e.nom] = recordToBeat(training, e.nom, initial); });
    return m;
  }, [training, initial, exos.map((e) => e.nom).join("|")]);
  const recordIdx = (e) => {
    let run = refRecords[e.nom];
    const out = new Set();
    if (!run) return out;
    e.series.forEach((s, i) => {
      if (!s.fait) return;
      const cur = { poids: +s.poids || 0, val: +s.val || 0 };
      if (!(cur.poids > 0 || cur.val > 0)) return;
      if (beats(cur, run, e.mode)) { run = cur; out.add(i); }
    });
    return out;
  };

  const renderRows = (e, ei, legFilter) => {
    const recs = painRed ? new Set() : recordIdx(e);
    return e.series
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => legFilter == null || s.leg === legFilter)
    .map(({ s, si }, n) => (
      <div key={si} style={{ display: "grid", gridTemplateColumns: GRID, gap: 7, alignItems: "center" }}>
        <span style={{ fontFamily: C.mono, fontSize: 13, color: recs.has(si) ? C.accent : C.muted, fontWeight: 700 }}>
          {n + 1}{recs.has(si) && <span style={{ fontSize: 11 }}>★</span>}
        </span>
        <TextInput value={s.val} inputMode="numeric" placeholder={e.mode === "temps" ? "sec" : e.target}
          onChange={(ev) => upd(ei, si, "val", ev.target.value)} style={{ padding: "7px 8px" }} />
        <TextInput value={s.poids} inputMode="decimal" placeholder="kg"
          onChange={(ev) => upd(ei, si, "poids", ev.target.value.replace(",", "."))} style={{ padding: "7px 8px" }} />
        <button onClick={() => toggle(ei, si)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: s.fait ? C.accent : C.dim, display: "flex", justifyContent: "center",
        }}>{s.fait ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <button onClick={() => rmSet(ei, si)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.dim }}>
          <X size={13} />
        </button>
      </div>
    ));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1.5px solid ${C.divider}` }}>
        <div>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 800, textTransform: "uppercase" }}>
            {type}{initial && <span style={{ color: C.accent, fontSize: 11, textTransform: "none", marginLeft: 6 }}>(modification)</span>}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>débuté {start} · {doneCount}/{exos.length} exos</div>
        </div>
        <div onClick={toggleRun} style={{
          background: C.card, border: `1.5px solid ${tRun ? C.accent : C.border}`, borderRadius: 8,
          padding: "6px 12px", textAlign: "center", cursor: "pointer", minWidth: 74,
        }}>
          <div style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: tRun ? C.accent : C.text2 }}>{mmss(tRem)}</div>
          <div style={{ fontSize: 8.5, color: C.muted, letterSpacing: 1, fontWeight: 700 }}>REPOS</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <DateField value={date} onChange={onDate} />
        <Field label="Début">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontFamily: C.mono, fontSize: 13, color: C.text, fontWeight: 700, width: "100%", outline: "none", boxSizing: "border-box" }} />
        </Field>
      </div>

      {exos.map((e, ei) => {
        const isOpen = open === ei;
        const done = e.series.filter((s) => s.fait).length;
        return (
          <div key={ei} style={{
            background: C.card, border: `1.5px solid ${isOpen ? C.border : C.borderDim}`,
            borderRadius: 10, padding: isOpen ? 14 : "12px 14px", opacity: isOpen ? 1 : 0.85,
          }}>
            <div onClick={() => openExo(ei)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: isOpen ? 14 : 13, color: C.text, fontWeight: isOpen ? 800 : 700 }}>
                  {e.nom}{e.opt && <span style={{ fontSize: 10, color: C.dim, marginLeft: 4 }}>(option)</span>}
                </span>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{e.scheme}</span>
              </div>
              <div style={{ fontSize: 11, color: C.accent, marginTop: 3, fontWeight: 700 }}>
                {e.last
                  ? `dernière fois : ${e.last.poids || "—"} kg × ${e.last.val || "—"}${e.mode === "temps" ? " s" : ""}`
                  : e.def != null ? `défaut : ${e.def} kg` : "première fois"}
                {done > 0 && <span style={{ color: C.muted }}> · {done} série{done > 1 ? "s" : ""} ✓</span>}
              </div>
            </div>

            {isOpen && (
              <>
                {e.consigne && <Body style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>{e.consigne}</Body>}
                {!painRed && refRecords[e.nom] && (
                  <Body style={{ fontSize: 10.5, color: C.muted, marginTop: 6, fontFamily: C.mono }}>
                    ★ record : {setLabel(refRecords[e.nom], e.mode)}
                  </Body>
                )}

                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 7, fontSize: 9,
                  color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 6px", fontWeight: 700 }}>
                  <span>Sér</span><span>{e.mode === "temps" ? "Sec" : "Reps"}</span><span>Poids</span><span /><span />
                </div>

                {e.perLeg ? ["G", "D"].map((leg) => (
                  <div key={leg} style={{ marginBottom: 8 }}>
                    <Label style={{ color: C.accent, marginBottom: 5 }}>{leg === "G" ? "Gauche" : "Droite"}</Label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{renderRows(e, ei, leg)}</div>
                    <div onClick={() => addSet(ei, leg)} style={{ textAlign: "center", marginTop: 8, fontSize: 11,
                      color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>
                      + série {leg}
                    </div>
                  </div>
                )) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{renderRows(e, ei, null)}</div>
                    <div onClick={() => addSet(ei, null)} style={{ textAlign: "center", marginTop: 10, fontSize: 11,
                      color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>
                      + ajouter une série
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
                  <button onClick={() => { const s = e.mode === "temps" ? parseSecs(e.target) : e.rest; fireTimer(s); recordLast(ei, s); }}
                    style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    <Timer size={12} style={{ display: "inline", marginRight: 4 }} />
                    {e.mode === "temps" ? `maintien ${parseSecs(e.target)} s` : `repos ${e.rest} s`}
                  </button>
                  <button onClick={() => setHist(hist === e.nom ? null : e.nom)}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    progression
                  </button>
                </div>

                {hist === e.nom && (
                  <div style={{ background: C.bg, borderRadius: 6, padding: 10, marginTop: 8 }}>
                    {perfHistory(training, e.nom).length
                      ? perfHistory(training, e.nom).map((hh, k) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 11, color: C.text2, padding: "2px 0" }}>
                            <span>{fmt(hh.date)}</span>
                            <span>{hh.poids || "—"} kg × {hh.val || "—"}{hh.mode === "temps" ? " s" : ""}</span>
                          </div>
                        ))
                      : <Body style={{ fontSize: 11, color: C.dim }}>aucun historique</Body>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <Card>
        <Label style={{ marginBottom: 8 }}>Minuteur</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[120, 90, 60, 45, 30].map((s) => (
            <button key={s} onClick={() => { setTimer(s); if (open !== -1) recordLast(open, s); }} style={{
              padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: tSecs === s ? C.accentRow : C.card, fontFamily: C.mono,
              color: tSecs === s ? C.accent : C.muted, border: `1.5px solid ${tSecs === s ? C.accent : C.border}`,
            }}>{mmss(s)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" onClick={toggleRun} style={{ flex: 1 }}>
            {tRun ? <><Pause size={14} style={{ display: "inline", marginRight: 4 }} />Pause</> : <><Play size={14} style={{ display: "inline", marginRight: 4 }} />Lancer</>}
          </Btn>
          <Btn variant="plain" onClick={() => setTimer(tSecs)}><RotateCcw size={14} /></Btn>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Bip + vibration en fin de décompte.</Body>
      </Card>

      {/* apps/public a sa nav en haut (pas de barre d'onglets en bas comme apps/perso) :
          décalage réduit à une simple marge de sécurité, pas de réservation d'espace nav. */}
      {tRun && (
        <button onClick={toggleRun} style={{
          position: "fixed", right: 12, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 40,
          display: "flex", alignItems: "center", gap: 7,
          background: C.accent, color: "#000", border: "none", borderRadius: 999,
          padding: "9px 14px", fontFamily: C.mono, fontSize: 14, fontWeight: 800,
          boxShadow: "0 4px 14px rgba(0,0,0,.5)", cursor: "pointer",
        }}><Pause size={14} />{mmss(tRem)}</button>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={validate} style={{ flex: 1 }}>
          <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />{initial ? "Enregistrer les modifications" : "Valider la séance"}
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
      </div>
    </div>
  );
}
