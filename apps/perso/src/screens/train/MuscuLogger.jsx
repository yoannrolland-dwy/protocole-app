// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Circle, Play, Pause, RotateCcw, Timer, X, Repeat } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { store, getSync } from "../../store.js";
import { exerciseSessions, setLabel, beats, recordToBeat, progressiveOverloadSuggestion } from "@rawcare/core/training";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { TEMPLATES, DEFAULT_WEIGHTS, hsrForWeek, hsrParse, parseSecs, exoSeriesCount } from "@rawcare/core/session/templates";
import { lastPerf, perfHistory, lastExerciseSets, medianTarget } from "@rawcare/core/session/perf";
import { EXERCISE_LIBRARY } from "@rawcare/core/session/exercises";
import { scheduleRestAlarm, cancelRestAlarm, hideRestCountdown } from "../../timerNotify.js";
import { C, fmt, round, Card, Label, Body, Btn, inputStyle, TextInput, Stepper, Field, DateField } from "../../ui.jsx";
import { mmss } from "../../lib/helpers.js";

/* ============================================================
   CARNET DE MUSCU — série par série
   ============================================================ */
export function MuscuLogger({ type, training, hsrWeek, date, onDate, onSave, onCancel, initial, painRed = false }) {
  const template = TEMPLATES[type];
  const hp = hsrParse(hsrForWeek(hsrWeek).scheme);

  const buildExos = () => template.exos.map((ex) => {
    const nSeries = exoSeriesCount(template, ex, hsrWeek);
    const last = lastPerf(training, ex.n);
    const lastSets = lastExerciseSets(training, ex.n);
    const target = ex.hsr ? `${hp.reps}` : ex.r;
    const def = DEFAULT_WEIGHTS[ex.n];
    const medVal = medianTarget(target);

    // Édition d'une séance déjà enregistrée : on réaffiche les séries telles
    // qu'elles ont été sauvegardées (valeurs réelles), pas des suggestions
    // basées sur l'historique. Un exercice substitué (bibliothèque, 01/09/2026) est
    // enregistré sous un AUTRE nom que celui du gabarit — sans `origine`, ce match par
    // nom échouait silencieusement et la substitution disparaissait à la réouverture
    // (bug trouvé et corrigé le 01/09/2026). `e.origine` porte le nom d'origine du
    // gabarit posé par `substitute()` au moment de la sauvegarde.
    const savedEx = initial?.exercices?.find((e) => e.nom === ex.n || e.origine === ex.n);
    if (savedEx) {
      const wasSubstituted = savedEx.nom !== ex.n;
      const lib = wasSubstituted ? EXERCISE_LIBRARY.find((l) => l.n === savedEx.nom) : null;
      const savedLast = wasSubstituted ? lastPerf(training, savedEx.nom) : last;
      const savedDef = wasSubstituted ? DEFAULT_WEIGHTS[savedEx.nom] : def;
      return { nom: savedEx.nom, mode: savedEx.mode ?? ex.mode, perLeg: !!savedEx.perLeg, opt: !!ex.opt, rest: ex.rest,
        target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${exoSeriesCount(template, ex, hsrWeek)} × ${ex.r}`,
        consigne: lib ? lib.c : ex.c, def: savedDef, last: savedLast,
        groupe: lib ? lib.groupe : ex.groupe, mouvement: lib ? lib.mouvement : ex.mouvement,
        materiel: lib ? lib.materiel : ex.materiel, tendon: lib ? lib.tendon : ex.tendon,
        famille: ex.famille, origine: wasSubstituted ? ex.n : undefined, rir: savedEx.rir ?? null,
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
      target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${exoSeriesCount(template, ex, hsrWeek)} × ${ex.r}`, consigne: ex.c, def, last,
      groupe: ex.groupe, mouvement: ex.mouvement, materiel: ex.materiel, tendon: ex.tendon, famille: ex.famille, rir: null, series };
  });

  // Brouillon auto-sauvegardé (localStorage, hors DATA_KEYS — voir Règles absolues #1) :
  // capture la séance en cours dès qu'une série est cochée, pour survivre à un changement
  // d'onglet ou une fermeture de l'app (TrainTab démonte tout son état à chaque changement
  // d'onglet, ce qui effaçait la séance en cours avant ce correctif). Calculé une seule fois
  // au montage (`useState` paresseux) : ne matche que si type/date/séance éditée coïncident,
  // sinon on reconstruit normalement depuis l'historique.
  const [savedDraft] = useState(() => {
    const d = getSync("trainingDraft", null);
    const match = d && d.type === type && d.date === date && (d.editingId ?? null) === (initial?.id ?? null) && Array.isArray(d.exos);
    return match ? d : null;
  });
  const [start, setStart] = useState(() => savedDraft?.start ?? initial?.start ?? new Date().toTimeString().slice(0, 5));
  // Durée + RPE (04/09/2026) : seuls les types marqués `withMeta` (Basket, désormais un
  // carnet d'exercices comme Upper/Lower) les capturent — sans ça, le passage de Basket en
  // "muscu" aurait fait perdre ces deux champs déjà lus par le Coach IA et "Dernières
  // séances", jusque-là propres aux séances non-muscu (voir TrainTab).
  const [duration, setDuration] = useState(() => savedDraft?.duration ?? initial?.duration ?? 60);
  const [rpe, setRpe] = useState(() => savedDraft?.rpe ?? initial?.rpe ?? 7);
  const [exos, setExos] = useState(() => savedDraft?.exos ?? buildExos());
  const [open, setOpen] = useState(0);
  const [hist, setHist] = useState(null);
  // Substitution (bibliothèque d'exercices, 01/09/2026) : index de l'exercice dont le
  // panneau "remplacer" est ouvert, ou null. Purement une affaire de CETTE séance — Upper/
  // Lower ne sont jamais modifiés, le remplacement se logue sous son propre nom.
  const [subOpen, setSubOpen] = useState(null);

  // ---- timer (repos + maintien) ----
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
  // Volume et durée divisés par deux (04/08/2026, demande explicite, même changement que
  // l'alarme native) : gain de crête 0,35 -> 0,175, espacement et durée des 3 impulsions
  // réduits de moitié (~0,57 s -> ~0,29 s au total).
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
  // Décompte calé sur l'heure de fin, pas sur le nombre de tics : Android ralentit les
  // `setInterval` quand l'app passe en arrière-plan, et l'ancien `r - 1` prenait du retard
  // sur la notification (25/10/2026). Recalcul immédiat au retour au premier plan.
  useEffect(() => {
    if (!tRun) return;
    const end = Date.now() + tRem * 1000; // tRem lu au lancement / à la reprise seulement
    const tick = () => {
      const r = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTRem(r);
      if (r === 0) { clearInterval(tRef.current); setTRun(false); }
    };
    tRef.current = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(tRef.current); document.removeEventListener("visibilitychange", tick); };
  }, [tRun]);
  useEffect(() => {
    // Sur l'app native, la notification système sonne déjà (plus fort, écran verrouillé
    // compris) : le bip Web Audio ferait doublon et brouillerait ce qu'on entend vraiment.
    // Sur la PWA, sans notification système, il reste la seule alarme disponible.
    if (prevRem.current > 0 && tRem === 0) { if (!Capacitor.isNativePlatform()) beep(); hideRestCountdown(); }
    prevRem.current = tRem;
  }, [tRem]);
  // Filet de sécurité : pas d'alarme fantôme si on quitte le carnet minuteur en route.
  useEffect(() => () => { clearInterval(tRef.current); cancelRestAlarm(); }, []);

  // Écrit le brouillon à chaque changement (série cochée, poids/reps modifiés, minuteur
  // réglé...) — pas seulement à la validation finale. `type`/`date`/`initial` sont stables
  // pour la durée de vie de ce composant (remonté via `key` par TrainTab si l'un d'eux
  // change vraiment), sauf `date` qui peut changer en cours de séance (DateField) : inclus
  // pour que le brouillon reste rattaché à la bonne date.
  useEffect(() => {
    store.set("trainingDraft", { type, date, editingId: initial?.id ?? null, start, duration, rpe, exos });
  }, [type, date, initial, start, duration, rpe, exos]);

  // Les notifications système doublent le décompte JS : elles seules sont fiables
  // écran verrouillé. `openName` sert à afficher l'exercice concerné dans la notif.
  const openName = () => (open >= 0 ? exos[open]?.nom ?? "" : "");
  const fireTimer = (s) => {
    ensureAudio(); clearInterval(tRef.current);
    setTSecs(s); setTRem(s); setTRun(true);
    scheduleRestAlarm(s, openName());
  };
  const setTimer = (s) => {
    clearInterval(tRef.current); setTRun(false); setTSecs(s); setTRem(s);
    cancelRestAlarm();
  };
  const toggleRun = () => {
    ensureAudio();
    setTRun((r) => {
      const next = !r;
      if (next) scheduleRestAlarm(tRem, openName()); else cancelRestAlarm();
      return next;
    });
  };
  const recordLast = (ei, s) => setLastTimerByExo((p) => ({ ...p, [ei]: s }));
  // changement d'exercice → minuteur réinitialisé sur le dernier temps utilisé pour cet exercice, ou son repos par défaut
  const openExo = (ei) => {
    const next = open === ei ? -1 : ei;
    setOpen(next);
    setSubOpen(null);
    if (next !== -1 && next !== open) setTimer(lastTimerByExo[next] ?? exos[next].rest);
  };

  // ---- mutateurs ----
  const upd = (ei, si, field, value) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, [field]: value }) }));
  const toggle = (ei, si) => {
    setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, fait: !s.fait }) }));
    // coche = fin de série → relance le minuteur sur le dernier temps utilisé pour cet exercice (fin de série uniquement, pas décoche)
    if (!exos[ei].series[si].fait) {
      fireTimer(lastTimerByExo[ei] ?? exos[ei].rest);
      // Haptique (T5, 04/10/2026) : impulsion brève au cochage, natif seulement — jamais
      // bloquant, une erreur du plugin est ignorée.
      if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  };
  const addSet = (ei, leg) => setExos((p) => p.map((e, i) => {
    if (i !== ei) return e;
    const sameLeg = e.series.filter((s) => s.leg === leg);
    const proto = sameLeg[sameLeg.length - 1] || {};
    return { ...e, series: [...e.series, { poids: proto.poids ?? "", val: proto.val ?? medianTarget(e.target), fait: false, leg }] };
  }));
  const rmSet = (ei, si) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.filter((_, j) => j !== si) }));
  // T4 : RIR par exercice (0/1/2/3+ → 0/1/2/3), re-tap = désélection (optionnel, jamais imposé).
  const setRir = (ei, v) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, rir: e.rir === v ? null : v }));

  // Substitue un exercice par une alternative de la bibliothèque (même groupe/mouvement,
  // donc même sollicitation tendon — voir CLAUDE.md). Le NOM/materiel/tendon/consigne
  // viennent de l'alternative choisie, mais le PROTOCOLE (mode/perLeg/opt/rest/nombre de
  // séries/cible HSR) reste celui prescrit par le gabarit : changer de machine ne doit
  // jamais changer le tempo ni le nombre de séries d'un exercice HSR. Nouvelle recherche
  // d'historique/poids par défaut sous le nouveau nom — série toutes remises à zéro (les
  // valeurs cochées de l'ancien exercice n'ont aucun sens sous le nouveau nom).
  const substitute = (ei, lib) => {
    setExos((p) => p.map((e, i) => {
      if (i !== ei) return e;
      const last = lastPerf(training, lib.n);
      const lastSets = lastExerciseSets(training, lib.n);
      const def = DEFAULT_WEIGHTS[lib.n];
      const medVal = medianTarget(e.target);
      const nSeries = e.perLeg ? e.series.filter((s) => s.leg === "G").length : e.series.length;
      const mk = (leg, k) => {
        const pool = lastSets ? (leg == null ? lastSets : lastSets.filter((s) => s.leg === leg)) : null;
        const prev = pool?.[k] || null;
        return { poids: prev?.poids ?? last?.poids ?? def ?? "", val: prev?.val ?? (medVal === "" ? "" : medVal), fait: false, leg };
      };
      const series = e.perLeg
        ? [...Array(nSeries)].map((_, k) => mk("G", k)).concat([...Array(nSeries)].map((_, k) => mk("D", k)))
        : [...Array(nSeries)].map((_, k) => mk(null, k));
      // `origine` garde le nom du gabarit d'ORIGINE (pas le précédent remplacement) à
      // travers plusieurs substitutions successives — c'est lui qui permet de
      // retrouver le bon exercice à la réouverture de la séance (voir buildExos).
      // Retour à l'exercice d'origine (17/10/2026) : `lib` est alors l'exercice du gabarit
      // lui-même, et `origine` redevient absent (plus de substitution).
      const origin = e.origine ?? e.nom;
      return { ...e, rir: null, nom: lib.n, consigne: lib.c, groupe: lib.groupe, mouvement: lib.mouvement,
        materiel: lib.materiel, tendon: lib.tendon, famille: lib.famille, def, last, series,
        origine: lib.n === origin ? undefined : origin };
    }));
    setSubOpen(null);
  };

  const validate = () => {
    store.set("trainingDraft", null);
    onSave({
      id: initial?.id ?? `${date}-${type}-${Date.now()}`,
      date, type, start,
      ...(template.withMeta ? { duration: round(duration), rpe } : {}),
      exercices: exos.map((e) => ({
        nom: e.nom, mode: e.mode, perLeg: e.perLeg, origine: e.origine,
        // T4 : reps en réserve par exercice, optionnel — clé absente si non renseigné (additif).
        ...(e.rir != null ? { rir: e.rir } : {}),
        series: e.series
          .filter((s) => s.poids !== "" || s.val !== "" || s.fait)
          .map((s) => ({ poids: s.poids === "" ? 0 : +s.poids, val: s.val === "" ? 0 : +s.val, fait: s.fait, leg: s.leg })),
      })).filter((e) => e.series.length),
    });
  };

  const doneCount = exos.filter((e) => e.series.some((s) => s.fait)).length;
  const GRID = "30px 1fr 1fr 26px 18px";

  // ---- records (V4) ----
  // Référence à battre = meilleure série de TOUT l'historique hors séance en cours (une
  // séance en modification ne doit pas être son propre record à battre). Calculée une fois
  // par exercice, pas à chaque frappe.
  const refRecords = useMemo(() => {
    const m = {};
    exos.forEach((e) => { m[e.nom] = recordToBeat(training, e.nom, initial); });
    return m;
  }, [training, initial, exos.map((e) => e.nom).join("|")]);
  // Plateau visible directement dans le carnet pendant la séance (10/09/2026, demande
  // explicite) — même calcul que Progression, pas de nouvelle logique. Une ligne discrète,
  // affichée uniquement à l'ouverture d'un exercice, comme le record.
  const plateauByExo = useMemo(() => {
    const m = {};
    exos.forEach((e) => { m[e.nom] = progressiveOverloadSuggestion(exerciseSessions(training, e.nom), e.nom); });
    return m;
  }, [training, exos.map((e) => e.nom).join("|")]);
  // Indices des séries qui battent le record au moment où elles sont cochées : la référence
  // avance au fil des séries, donc seules les vraies améliorations successives ressortent.
  const recordIdx = (e) => {
    let run = refRecords[e.nom];
    const out = new Set();
    if (!run) return out; // 1re fois sur cet exercice : une référence, pas un record
    e.series.forEach((s, i) => {
      if (!s.fait) return;
      const cur = { poids: +s.poids || 0, val: +s.val || 0 };
      if (!(cur.poids > 0 || cur.val > 0)) return;
      if (beats(cur, run, e.mode)) { run = cur; out.add(i); }
    });
    return out;
  };

  const renderRows = (e, ei, legFilter) => {
    // Douleur hors base aujourd'hui : le record est calculé et enregistré normalement, il
    // n'est simplement pas mis en avant (voir painOutOfBase dans training.js).
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
      {/* En-tête séance + timer */}
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
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle(false)} />
        </Field>
      </div>

      {template.withMeta && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Durée (min)"><Stepper value={duration} set={setDuration} step={5} min={0} int /></Field>
          <Field label="RPE"><Stepper value={rpe} set={setRpe} step={1} min={1} max={10} int /></Field>
        </div>
      )}

      {/* Exercices */}
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
                {/* Le record à battre est affiché comme un fait, pas comme un objectif à
                    forcer — et il disparaît les jours où un tendon est hors base. */}
                {!painRed && refRecords[e.nom] && (
                  <Body style={{ fontSize: 10.5, color: C.muted, marginTop: 6, fontFamily: C.mono }}>
                    ★ record : {setLabel(refRecords[e.nom], e.mode)}
                  </Body>
                )}
                {!painRed && plateauByExo[e.nom] && (
                  <Body style={{ fontSize: 10.5, color: "#e8a33d", marginTop: 6, fontFamily: C.mono }}>
                    ⏸ plateau depuis {plateauByExo[e.nom].sessions} séances
                  </Body>
                )}

                {/* Substitution (bibliothèque d'exercices, 01/09/2026) : "cette machine est
                    prise, ou j'ai envie de varier" — cette séance seulement, jamais le
                    gabarit. Candidats = même `famille` (mouvement précis, équipement
                    différent) — PAS groupe/mouvement seuls : bug trouvé au test, "Presse à
                    cuisses" et "Iso leg extension" partagent groupe+mouvement mais sont des
                    exercices mécaniquement différents. Invisible si aucun candidat. */}
                {(() => {
                  const candidates = e.famille
                    ? EXERCISE_LIBRARY.filter((l) => l.famille === e.famille && l.n !== e.nom && l.n !== e.origine)
                    : [];
                  // Retour à l'exercice d'origine : l'exercice du gabarit n'est pas forcément
                  // dans la bibliothèque, on le prend donc directement dans le gabarit.
                  const original = e.origine ? template.exos.find((x) => x.n === e.origine) : null;
                  if (original) candidates.unshift({ ...original, isOriginal: true });
                  if (!candidates.length) return null;
                  return subOpen === ei ? (
                    <div style={{ marginTop: 8, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
                      <Label style={{ marginBottom: 6 }}>Remplacer par</Label>
                      {candidates.map((c) => (
                        <div key={c.n} onClick={() => substitute(ei, c)} style={{ padding: "7px 2px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer" }}>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{c.n}{c.isOriginal && <span style={{ color: C.accent }}> · exercice d'origine</span>}</div>
                          {c.c && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{c.c}</div>}
                        </div>
                      ))}
                      <Btn variant="ghost" onClick={() => setSubOpen(null)} style={{ width: "100%", marginTop: 8, padding: "6px 0", fontSize: 10.5 }}>Annuler</Btn>
                    </div>
                  ) : (
                    <div onClick={() => setSubOpen(ei)} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, cursor: "pointer" }}>
                      <Repeat size={11} color={C.muted} />
                      <span style={{ fontSize: 10.5, color: C.muted, textDecoration: "underline" }}>Remplacer cet exercice</span>
                    </div>
                  );
                })()}

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

                {/* Reps en réserve (T4, 04/10/2026) : un choix par EXERCICE, pas par série ;
                    optionnel — rien de présélectionné, re-tap pour effacer. Pas en mode temps. */}
                {e.mode !== "temps" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginRight: 2 }}>Reps en réserve</span>
                    {[0, 1, 2, 3].map((v) => {
                      const on = e.rir === v;
                      return (
                        <button key={v} onClick={() => setRir(ei, v)} style={{
                          minWidth: 30, height: 26, padding: "0 8px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono, fontSize: 11, fontWeight: 800,
                          background: on ? C.accent : C.bg, color: on ? "#000" : C.muted, border: `1.5px solid ${on ? C.accent : C.border}`,
                        }}>{v === 3 ? "3+" : v}</button>
                      );
                    })}
                  </div>
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

      {/* Réglage du minuteur */}
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

      {/* Pastille flottante pendant le décompte */}
      {tRun && (
        <button onClick={toggleRun} style={{
          position: "fixed", right: 12, bottom: "calc(76px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))", zIndex: 40,
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
        <Btn variant="ghost" onClick={() => { store.set("trainingDraft", null); onCancel(); }}>Annuler</Btn>
      </div>
    </div>
  );
}
