// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; refait en design system v2 à
// l'étape 3 d'U3 (25/10/2026) : cases de série et champs de 52 px, « − série » à la place du
// × collé à la case, minuteur partagé (lib/restTimer.js) qui continue hors de l'onglet et se
// fixe en haut du carnet SEULEMENT pendant le décompte (choix de Yoann — en juillet, une
// pastille épinglée en permanence gênait le défilement).
import { useState, useEffect, useMemo, useRef } from "react";
import { Check, Play, Pause, RotateCcw, Timer, Repeat, Plus, Minus, TrendingUp, Search, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { store } from "../../store.js";
import { exerciseSessions, setLabel, recordToBeat, progressiveOverloadSuggestion } from "@rawcare/core/training";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { TEMPLATES, parseSecs } from "@rawcare/core/session/templates";
import { perfHistory } from "@rawcare/core/session/perf";
import { catalogGroups } from "@rawcare/core/session/exoCatalog";
import {
  makeAddedExercise, buildExercises, updateSet, toggleSet, addSet, lastRemovable, removeLastSet, setRir,
  appendExercise, removeExercise, substitutionCandidates, substituteExercise, doneExercises, sessionRecord, recordSetIndexes,
} from "@rawcare/core/session/engine";
import { fmt, today } from "../../ui.jsx";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button, IconButton, Chip, NumberField, TextField } from "../../design/primitives.jsx";
import { mmss } from "../../lib/helpers.js";
import { restTimer, useRestTimer, syncRestFromDraft, restState } from "../../lib/restTimer.js";
import { readDraft, writeDraft, patchDraft, isForeign, acknowledge, DRAFT_EVENT } from "../../lib/sessionDraft.js";
import { sayStable } from "../../lib/jeffrey.js";
import { restAnnouncement, holdAnnouncement, genericAnnouncement } from "../../lib/restSpeech.js";

const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
const WARN = T.c.warn;

// Champ d'une série : 52 px, gros chiffres, clavier numérique, unité discrète à droite.
function SetField({ value, onChange, unit, inputMode, placeholder, label, inputRef, onEnter, done }) {
  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <input ref={inputRef} type="text" inputMode={inputMode} enterKeyHint={onEnter ? "next" : "done"} value={value}
        placeholder={placeholder} aria-label={label} className="p-field"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter ? onEnter() : e.currentTarget.blur(); } }}
        style={{ textAlign: "center", fontSize: 20, paddingRight: 30, paddingLeft: 8,
          ...(done ? { background: "transparent", borderStyle: "dashed" } : {}) }} />
      <span aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.c.muted, pointerEvents: "none" }}>{unit}</span>
    </div>
  );
}

/* ============================================================
   CARNET DE MUSCU — série par série
   ============================================================ */
export function MuscuLogger({ type, training, hsrWeek, date, onDate, onSave, onCancel, initial, painRed = false }) {
  const template = TEMPLATES[type];

  // Moteur de séance (G4-C1, 05/11/2026) : construction des exercices et opérations sur les
  // séries dans packages/core/src/session/engine.js, à l'identique de ce qui vivait ici.
  const engineCtx = { training, hsrWeek };
  const makeAdded = (c) => makeAddedExercise(c, engineCtx);
  const buildExos = () => buildExercises({ type, training, hsrWeek, initial });

  // Brouillon auto-sauvegardé (localStorage, hors DATA_KEYS — voir Règles absolues #1) :
  // capture la séance en cours dès qu'une série est cochée, pour survivre à un changement
  // d'onglet ou une fermeture de l'app (TrainTab démonte tout son état à chaque changement
  // d'onglet, ce qui effaçait la séance en cours avant ce correctif). Calculé une seule fois
  // au montage (`useState` paresseux) : ne matche que si type/date/séance éditée coïncident,
  // sinon on reconstruit normalement depuis l'historique.
  // G4-C2 (05/11/2026) : le brouillon stocké EST la séance en cours (lib/sessionDraft.js).
  const matches = (d) => !!d && d.type === type && d.date === date && (d.editingId ?? null) === (initial?.id ?? null) && Array.isArray(d.exos);
  const [savedDraft] = useState(() => {
    const d = readDraft();
    if (!matches(d)) return null;
    acknowledge(d);
    return d;
  });
  const [start, setStart] = useState(() => savedDraft?.start ?? initial?.start ?? new Date().toTimeString().slice(0, 5));
  // Durée + RPE (04/09/2026) : seuls les types marqués `withMeta` (Basket, désormais un
  // carnet d'exercices comme Upper/Lower) les capturent — sans ça, le passage de Basket en
  // "muscu" aurait fait perdre ces deux champs déjà lus par le Coach IA et "Dernières
  // séances", jusque-là propres aux séances non-muscu (voir TrainTab).
  const [duration, setDuration] = useState(() => String(savedDraft?.duration ?? initial?.duration ?? 60));
  const [rpe, setRpe] = useState(() => String(savedDraft?.rpe ?? initial?.rpe ?? 7));
  const [exos, setExos] = useState(() => savedDraft?.exos ?? buildExos());
  const [open, setOpen] = useState(0);
  const [hist, setHist] = useState(null);
  // Substitution (bibliothèque d'exercices, 01/09/2026) : index de l'exercice dont le
  // panneau "remplacer" est ouvert, ou null. Purement une affaire de CETTE séance — Upper/
  // Lower ne sont jamais modifiés, le remplacement se logue sous son propre nom.
  const [subOpen, setSubOpen] = useState(null);
  // « Ajouter un exercice » (31/10/2026) : panneau ouvert et recherche.
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  // Séance neuve : le brouillon est écrit dès l'ouverture (avant le réglage du minuteur, qui y
  // range son état).
  useEffect(() => {
    if (!matches(readDraft())) writeDraft({ type, date, editingId: initial?.id ?? null, start, duration: Number(duration) || 0, rpe: Number(rpe) || 0, exos });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chaque geste part du brouillon STOCKÉ (pas de l'état affiché), l'enregistre, puis l'affiche :
  // une série écrite par une autre page n'est jamais écrasée.
  const exosRef = useRef(exos);
  exosRef.current = exos;
  const currentExos = () => { const d = readDraft(); return matches(d) ? d.exos : exosRef.current; };
  const mutate = (op) => {
    const next = op(currentExos());
    const d = readDraft();
    writeDraft(matches(d) ? { ...d, exos: next }
      : { type, date, editingId: initial?.id ?? null, start, duration: Number(duration) || 0, rpe: Number(rpe) || 0, exos: next });
    setExos(next);
    return next;
  };
  const setStartW = (v) => { setStart(v); patchDraft({ start: v }); };
  const setDurationW = (v) => { setDuration(v); patchDraft({ duration: Number(v) || 0 }); };
  const setRpeW = (v) => { setRpe(v); patchDraft({ rpe: Number(v) || 0 }); };
  // La date peut changer en cours de séance (champ Date) : le brouillon la suit.
  const firstDate = useRef(true);
  useEffect(() => { if (firstDate.current) { firstDate.current = false; return; } patchDraft({ date }); }, [date]);
  // Écrit ailleurs (l'appli JEFFREY par le pont, en C3) : relu, affiché tel quel.
  useEffect(() => {
    const onDraft = () => {
      const d = readDraft();
      // G4-C3 : séance enregistrée ou abandonnée à la voix → le carnet se ferme.
      if (!d) { onCancel(); return; }
      if (!matches(d) || !isForeign(d)) return;
      acknowledge(d);
      setExos(d.exos); setStart(d.start); setDuration(String(d.duration)); setRpe(String(d.rpe));
    };
    window.addEventListener(DRAFT_EVENT, onDraft);
    return () => window.removeEventListener(DRAFT_EVENT, onDraft);
  }, [type, date, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- minuteur (repos + maintien), partagé avec la barre « Séance en cours » ----
  const timer = useRestTimer();
  const [lastTimerByExo, setLastTimerByExo] = useState({});
  // Au premier affichage d'une séance neuve, le minuteur se règle sur le repos du premier
  // exercice — sauf s'il tourne déjà (on revient sur l'onglet pendant un repos).
  // G4-C3 : un repos déjà rangé dans le brouillon (lancé à la voix, app fermée) est repris tel quel.
  useEffect(() => {
    syncRestFromDraft();
    const st = restState();
    if (!readDraft()?.rest && !st.endAt && st.remaining === st.secs) restTimer.set(exos[0]?.rest ?? 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Les notifications système doublent le décompte JS : elles seules sont fiables
  // écran verrouillé. `openName` sert à afficher l'exercice concerné dans la notif.
  const openName = () => (open >= 0 ? exos[open]?.nom ?? "" : "");
  const recordLast = (ei, s) => setLastTimerByExo((p) => ({ ...p, [ei]: s }));
  // Changement d'exercice → minuteur réglé sur le dernier temps utilisé pour cet exercice, ou
  // son repos par défaut. Plus jamais pendant un décompte (U3, 25/10/2026) : ouvrir l'exercice
  // suivant pendant le repos coupait le minuteur ET le réveil natif.
  const openExo = (ei) => {
    const next = open === ei ? -1 : ei;
    setOpen(next);
    setSubOpen(null);
    if (next !== -1 && next !== open && !timer.running) restTimer.set(lastTimerByExo[next] ?? exos[next].rest);
  };

  // ---- mutateurs ----
  const upd = (ei, si, field, value) => mutate((p) => updateSet(p, ei, si, field, value));
  const toggle = (ei, si) => {
    const base = currentExos();
    mutate(() => toggleSet(base, ei, si));
    // coche = fin de série → relance le minuteur sur le dernier temps utilisé pour cet exercice (fin de série uniquement, pas décoche)
    if (!base[ei].series[si].fait) {
      // Fin de repos dite par Jeffrey (31/10/2026) : la série ou l'exercice qui vient.
      restTimer.start(lastTimerByExo[ei] ?? base[ei].rest, base[ei].nom, restAnnouncement(base, ei, si));
      // Haptique (T5, 04/10/2026) : impulsion brève au cochage, natif seulement — jamais
      // bloquant, une erreur du plugin est ignorée.
      if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  };
  const addSetTo = (ei, leg) => mutate((p) => addSet(p, ei, leg));
  // « − série » (U3, choix de Yoann) remplace le × collé à la case de validation : retire la
  // DERNIÈRE série non cochée de la jambe/liste — jamais une série déjà faite.
  const rmLastSet = (ei, leg) => mutate((p) => removeLastSet(p, ei, leg));
  // Ajout d'un exercice déjà dans l'application (31/10/2026) : prescription de sa définition
  // d'origine, ouvert tout de suite. Retrait possible tant qu'aucune série n'est cochée.
  const addExercise = (c) => {
    const item = makeAdded(c);
    const at = currentExos().length;
    mutate((p) => appendExercise(p, item));
    setOpen(at);
    setSubOpen(null);
    setAddOpen(false);
    setAddQuery("");
    if (!timer.running) restTimer.set(item.rest);
  };
  // (Nom distinct de `removeExercise` du moteur : en C1 la fonction locale s'appelait elle-même.)
  const dropExercise = (ei) => {
    mutate((p) => removeExercise(p, ei));
    setLastTimerByExo((m) => Object.fromEntries(Object.entries(m).filter(([k]) => +k !== ei).map(([k, v]) => [+k > ei ? +k - 1 : +k, v])));
    setOpen(-1);
  };
  const addGroups = useMemo(() => (addOpen ? catalogGroups({ exclude: exos.map((e) => e.nom), query: addQuery }) : []), [addOpen, addQuery, exos]);

  // T4 : RIR par exercice (0/1/2/3+ → 0/1/2/3), re-tap = désélection (optionnel, jamais imposé).
  const setRirOf = (ei, v) => mutate((p) => setRir(p, ei, v));

  // Substitue un exercice par une alternative de la bibliothèque (même groupe/mouvement,
  // donc même sollicitation tendon — voir CLAUDE.md). Le NOM/materiel/tendon/consigne
  // viennent de l'alternative choisie, mais le PROTOCOLE (mode/perLeg/opt/rest/nombre de
  // séries/cible HSR) reste celui prescrit par le gabarit : changer de machine ne doit
  // jamais changer le tempo ni le nombre de séries d'un exercice HSR. Nouvelle recherche
  // d'historique/poids par défaut sous le nouveau nom — série toutes remises à zéro (les
  // valeurs cochées de l'ancien exercice n'ont aucun sens sous le nouveau nom).
  const substitute = (ei, lib) => {
    mutate((p) => substituteExercise(p, ei, lib, engineCtx));
    setSubOpen(null);
  };

  const validate = () => {
    const final = currentExos();
    store.set("trainingDraft", null);
    restTimer.stop();
    onSave(sessionRecord({ id: initial?.id ?? `${date}-${type}-${Date.now()}`, date, type, start, duration, rpe, exos: final }));
  };
  const cancel = () => { store.set("trainingDraft", null); restTimer.stop(); onCancel(); };

  const doneCount = doneExercises(exos);
  const GRID = "28px minmax(0, 1fr) minmax(0, 1fr) 52px";

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
  const recordIdx = (e) => recordSetIndexes(e, refRecords[e.nom]);

  // Entrée sur les reps → champ poids de la même série.
  const poidsRefs = useRef({});

  const renderRows = (e, ei, legFilter) => {
    // Douleur hors base aujourd'hui : le record est calculé et enregistré normalement, il
    // n'est simplement pas mis en avant (voir painOutOfBase dans training.js).
    const recs = painRed ? new Set() : recordIdx(e);
    return e.series
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => legFilter == null || s.leg === legFilter)
    .map(({ s, si }, n) => (
      <div key={si} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center" }}>
        <span style={{ ...mono, fontSize: 15, textAlign: "center", color: recs.has(si) ? T.c.accent : T.c.text2, fontWeight: 700 }}>
          {n + 1}{recs.has(si) && <span style={{ fontSize: 12 }}>★</span>}
        </span>
        <SetField value={s.val} inputMode="numeric" placeholder={e.mode === "temps" ? "sec" : e.target}
          unit={e.mode === "temps" ? "s" : "reps"} label={`Série ${n + 1}, ${e.mode === "temps" ? "secondes" : "répétitions"}`}
          done={s.fait} onChange={(v) => upd(ei, si, "val", v)} onEnter={() => poidsRefs.current[`${ei}-${si}`]?.focus()} />
        <SetField value={s.poids} inputMode="decimal" placeholder="kg" unit="kg" label={`Série ${n + 1}, poids`}
          done={s.fait} inputRef={(el) => { poidsRefs.current[`${ei}-${si}`] = el; }}
          onChange={(v) => upd(ei, si, "poids", v)} />
        <button type="button" className="p-tap" onClick={() => toggle(ei, si)} aria-pressed={s.fait}
          aria-label={s.fait ? `Série ${n + 1} faite, décocher` : `Valider la série ${n + 1}`}
          style={{
            width: 52, height: 52, borderRadius: 10, display: "grid", placeItems: "center",
            background: s.fait ? T.c.accent : "transparent", color: s.fait ? T.c.onAccent : T.c.text2,
            border: `2px solid ${s.fait ? T.c.accent : T.c.line}`,
          }}><Check size={24} strokeWidth={3} aria-hidden="true" /></button>
      </div>
    ));
  };

  // « + Série / − Série » plus discrets (27/10/2026, retour de Yoann : trop gros) : 44 px de haut
  // (cible tactile minimale) au lieu de 52, texte 14 px, simple contour, largeur du contenu.
  const setBtnStyle = {
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: 10,
    background: "transparent", border: `1px solid ${T.c.line}`, color: T.c.text2, fontSize: 14, fontWeight: 600, fontFamily: "inherit",
  };
  const setButtons = (e, ei, leg) => (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <button type="button" className="p-tap" style={setBtnStyle} onClick={() => addSetTo(ei, leg)}>
        <Plus size={16} aria-hidden="true" />Série{leg ? ` ${leg}` : ""}
      </button>
      <button type="button" className="p-tap" style={setBtnStyle} disabled={lastRemovable(e, leg) < 0} onClick={() => rmLastSet(ei, leg)}
        aria-label={`Retirer la dernière série${leg ? ` ${leg === "G" ? "gauche" : "droite"}` : ""} non cochée`}>
        <Minus size={16} aria-hidden="true" />Série{leg ? ` ${leg}` : ""}
      </button>
    </div>
  );

  // Bandeau du minuteur : à sa place (défile avec la page) au repos, fixé en haut du carnet
  // pendant le décompte seulement, avec gros chiffres, Pause et +30 s.
  const timerBand = timer.running ? (
    <div style={{
      position: "sticky", top: -14, zIndex: 6, margin: "0 -16px", padding: "8px 16px",
      display: "flex", alignItems: "center", gap: 8, background: T.c.accentRow, borderBottom: `1px solid ${T.c.accentLine}`,
    }} role="timer" aria-live="off">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="p-label" style={{ color: T.c.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Repos{timer.label ? ` · ${timer.label}` : ""}</div>
        <div style={{ ...mono, fontSize: 40, fontWeight: 800, lineHeight: 1.05, color: T.c.accent }}>{mmss(timer.remaining)}</div>
      </div>
      <Button variant="plain" onClick={() => restTimer.add(30)} aria-label="Ajouter 30 secondes">+30 s</Button>
      <IconButton label="Mettre le minuteur en pause" tone="accent" size={52} onClick={() => restTimer.toggle()}>
        <Pause size={22} aria-hidden="true" />
      </IconButton>
    </div>
  ) : null;

  const field = (label, input) => (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}><Eyebrow>{label}</Eyebrow>{input}</div>
  );

  return (
    // `minmax(0, 1fr)` (27/10/2026) : une ligne trop large reste dans sa carte au lieu d'élargir tout
    // le carnet (défilement horizontal constaté avec la police d'Android agrandie).
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, fontFamily: T.f.body, color: T.c.text }}>
      {timerBand}

      {/* En-tête séance */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {type}{initial && <span style={{ color: T.c.accent, fontSize: 14, fontWeight: 600, marginLeft: 8 }}>modification</span>}
        </h2>
        <div className="p-sec" style={{ marginTop: 2 }}>débuté {start} · {doneCount}/{exos.length} exos</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {field("Date", <input type="date" className="p-field" value={date} max={today()}
          onChange={(e) => e.target.value && onDate(e.target.value)} aria-label="Date de la séance" style={{ fontFamily: T.f.num }} />)}
        {field("Début", <input type="time" className="p-field" value={start} onChange={(e) => setStartW(e.target.value)} aria-label="Heure de début" />)}
      </div>

      {template.withMeta && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {field("Durée", <NumberField value={duration} onChange={setDurationW} unit="min" inputMode="numeric" label="Durée en minutes" />)}
          {field("RPE", <NumberField value={rpe} onChange={setRpeW} inputMode="numeric" label="RPE sur 10" />)}
        </div>
      )}

      {/* Minuteur au repos : à sa place, avec les durées (PAS de 2:30, retiré exprès). */}
      {!timer.running && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ ...mono, fontSize: 28, fontWeight: 700, flex: 1, minWidth: 0 }}>{mmss(timer.remaining)}</span>
            <IconButton label="Remettre le minuteur à zéro" onClick={() => restTimer.set(timer.secs)}><RotateCcw size={20} aria-hidden="true" /></IconButton>
            <Button variant="primary" onClick={() => restTimer.toggle(openName(), open >= 0 ? restAnnouncement(exos, open, -1) : genericAnnouncement())}><Play size={18} aria-hidden="true" />Lancer</Button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[120, 90, 60, 45, 30].map((s) => (
              <Chip key={s} on={timer.secs === s} onClick={() => { restTimer.set(s); if (open !== -1) recordLast(open, s); }}
                // minWidth 0 (27/10/2026) : sans ça, 5 × 48 px ne rétrécissaient pas et, avec la
                // police d'Android agrandie, élargissaient tout le carnet (défilement horizontal).
                style={{ flex: 1, minWidth: 0, justifyContent: "center", padding: 0 }}>
                <span style={mono}>{mmss(s)}</span>
              </Chip>
            ))}
          </div>
        </Panel>
      )}

      {/* Exercices */}
      {exos.map((e, ei) => {
        const isOpen = open === ei;
        const done = e.series.filter((s) => s.fait).length;
        return (
          <Panel key={ei} tone={isOpen ? "key" : undefined} style={{ gap: 10, padding: isOpen ? 16 : 0 }}>
            <button type="button" className="p-tap" onClick={() => openExo(ei)} aria-expanded={isOpen} style={{
              display: "grid", gap: 4, width: "100%", minHeight: 64, padding: isOpen ? 0 : "12px 16px",
              background: "none", border: "none", textAlign: "left", color: T.c.text, fontFamily: "inherit",
            }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: isOpen ? 18 : 16, fontWeight: 700, lineHeight: 1.25 }}>
                  {e.nom}{e.opt && <span style={{ fontSize: 13, color: T.c.muted, fontWeight: 500, marginLeft: 6 }}>(option)</span>}
                  {e.added && <span style={{ fontSize: 13, color: T.c.accent, fontWeight: 500, marginLeft: 6 }}>(ajouté)</span>}
                </span>
                <span style={{ ...mono, fontSize: 13, color: T.c.text2, whiteSpace: "nowrap" }}>{e.scheme}</span>
              </span>
              <span style={{ fontSize: 14, color: T.c.accent, fontWeight: 600 }}>
                {e.last
                  ? `Dernière fois ${e.last.poids || "—"} kg × ${e.last.val || "—"}${e.mode === "temps" ? " s" : ""}`
                  : e.def != null ? `Défaut ${e.def} kg` : "Première fois"}
                {done > 0 && <span style={{ color: T.c.text2, fontWeight: 500 }}> · {done} série{done > 1 ? "s" : ""} ✓</span>}
              </span>
            </button>

            {isOpen && (
              <>
                {e.consigne && <div className="p-sec">{e.consigne}</div>}
                {/* Le record à battre est affiché comme un fait, pas comme un objectif à
                    forcer — et il disparaît les jours où un tendon est hors base. */}
                {!painRed && refRecords[e.nom] && (
                  <div style={{ ...mono, fontSize: 13, color: T.c.text2 }}>★ record {setLabel(refRecords[e.nom], e.mode)}</div>
                )}
                {!painRed && plateauByExo[e.nom] && (
                  <div style={{ ...mono, fontSize: 13, color: WARN }}>⏸ plateau depuis {plateauByExo[e.nom].sessions} séances</div>
                )}

                {/* Substitution (bibliothèque d'exercices, 01/09/2026) : "cette machine est
                    prise, ou j'ai envie de varier" — cette séance seulement, jamais le
                    gabarit. Candidats = même `famille` (mouvement précis, équipement
                    différent) — PAS groupe/mouvement seuls : bug trouvé au test, "Presse à
                    cuisses" et "Iso leg extension" partagent groupe+mouvement mais sont des
                    exercices mécaniquement différents. Invisible si aucun candidat. */}
                {(() => {
                  // Retour à l'exercice d'origine compris (engine.js).
                  const candidates = substitutionCandidates(e, template);
                  if (!candidates.length) return null;
                  return subOpen === ei ? (
                    <div style={{ background: T.c.field, border: `1px solid ${T.c.line}`, borderRadius: 12, padding: 12, display: "grid", gap: 2 }}>
                      <Eyebrow>Remplacer par</Eyebrow>
                      {candidates.map((c) => (
                        <button key={c.n} type="button" className="p-tap" onClick={() => substitute(ei, c)} style={{
                          minHeight: 52, padding: "8px 2px", background: "none", border: "none", borderBottom: `1px solid ${T.c.lineSoft}`,
                          textAlign: "left", color: T.c.text, fontFamily: "inherit",
                        }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{c.n}{c.isOriginal && <span style={{ color: T.c.accent }}> · exercice d'origine</span>}</div>
                          {c.c && <div className="p-muted" style={{ marginTop: 2 }}>{c.c}</div>}
                        </button>
                      ))}
                      <Button variant="plain" block onClick={() => setSubOpen(null)} style={{ marginTop: 8 }}>Annuler</Button>
                    </div>
                  ) : (
                    <button type="button" className="p-tap" onClick={() => setSubOpen(ei)} style={{
                      display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: 0,
                      background: "none", border: "none", color: T.c.text2, fontSize: 14, fontFamily: "inherit", textDecoration: "underline",
                    }}>
                      <Repeat size={16} aria-hidden="true" />Remplacer cet exercice
                    </button>
                  );
                })()}

                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, marginTop: 2 }}>
                  <span className="p-label" style={{ textAlign: "center" }}>N°</span>
                  <span className="p-label" style={{ textAlign: "center" }}>{e.mode === "temps" ? "Sec" : "Reps"}</span>
                  <span className="p-label" style={{ textAlign: "center" }}>Poids</span>
                  <span className="p-label" style={{ textAlign: "center" }}>Fait</span>
                </div>

                {e.perLeg ? ["G", "D"].map((leg) => (
                  <div key={leg} style={{ display: "grid", gap: 8 }}>
                    <Eyebrow style={{ color: T.c.accent }}>{leg === "G" ? "Gauche" : "Droite"}</Eyebrow>
                    {renderRows(e, ei, leg)}
                    {setButtons(e, ei, leg)}
                  </div>
                )) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {renderRows(e, ei, null)}
                    {setButtons(e, ei, null)}
                  </div>
                )}

                {/* Reps en réserve (T4, 04/10/2026) : un choix par EXERCICE, pas par série ;
                    optionnel — rien de présélectionné, re-tap pour effacer. Pas en mode temps. */}
                {e.mode !== "temps" && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <Eyebrow>Reps en réserve</Eyebrow>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[0, 1, 2, 3].map((v) => (
                        <Chip key={v} on={e.rir === v} onClick={() => setRirOf(ei, v)} style={{ flex: 1, justifyContent: "center" }}>
                          <span style={mono}>{v === 3 ? "3+" : v}</span>
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="outline" style={{ flex: 1 }}
                    onClick={() => {
                      const s = e.mode === "temps" ? parseSecs(e.target) : e.rest;
                      restTimer.start(s, e.nom, e.mode === "temps" ? holdAnnouncement() : restAnnouncement(exos, ei, -1)); recordLast(ei, s);
                    }}>
                    <Timer size={18} aria-hidden="true" />
                    {e.mode === "temps" ? `Maintien ${parseSecs(e.target)} s` : `Repos ${e.rest} s`}
                  </Button>
                  <IconButton label={hist === e.nom ? "Masquer la progression" : "Voir la progression"} aria-pressed={hist === e.nom} size={52}
                    onClick={() => setHist(hist === e.nom ? null : e.nom)}>
                    <TrendingUp size={20} aria-hidden="true" />
                  </IconButton>
                </div>

                {hist === e.nom && (
                  <div style={{ background: T.c.field, borderRadius: 10, padding: 12, display: "grid", gap: 4 }}>
                    {perfHistory(training, e.nom).length
                      ? perfHistory(training, e.nom).map((hh, k) => (
                          <div key={k} style={{ ...mono, display: "flex", justifyContent: "space-between", fontSize: 13, color: T.c.text2 }}>
                            <span>{fmt(hh.date)}</span>
                            <span>{hh.poids || "—"} kg × {hh.val || "—"}{hh.mode === "temps" ? " s" : ""}</span>
                          </div>
                        ))
                      : <div className="p-sec">{sayStable("firstTime")}</div>}
                  </div>
                )}

                {e.added && !e.series.some((s) => s.fait) && (
                  <button type="button" className="p-tap" onClick={() => dropExercise(ei)} style={{
                    display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: 0,
                    background: "none", border: "none", color: T.c.text2, fontSize: 14, fontFamily: "inherit", textDecoration: "underline",
                  }}>
                    <X size={16} aria-hidden="true" />Retirer cet exercice de la séance
                  </button>
                )}
              </>
            )}
          </Panel>
        );
      })}

      {/* Ajouter un exercice déjà dans l'application (31/10/2026), classé par muscle. */}
      {addOpen ? (
        <Panel style={{ gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow style={{ flex: 1 }}>Ajouter un exercice</Eyebrow>
            <IconButton label="Fermer l'ajout d'exercice" size={44} onClick={() => { setAddOpen(false); setAddQuery(""); }}>
              <X size={18} aria-hidden="true" />
            </IconButton>
          </div>
          <TextField value={addQuery} onChange={setAddQuery} placeholder="Chercher un exercice ou un muscle" label="Chercher un exercice" icon={Search} />
          {addGroups.length ? addGroups.map((g) => (
            <div key={g.groupe} style={{ display: "grid" }}>
              <Eyebrow style={{ color: T.c.accent, padding: "6px 0 2px" }}>{g.label}</Eyebrow>
              {g.items.map((c) => (
                <button key={c.n} type="button" className="p-tap" onClick={() => addExercise(c)} style={{
                  display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "6px 2px",
                  background: "none", border: "none", borderBottom: `1px solid ${T.c.lineSoft}`, textAlign: "left", color: T.c.text, fontFamily: "inherit",
                }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{c.n}</span>
                  <span style={{ ...mono, fontSize: 13, color: T.c.text2, whiteSpace: "nowrap" }}>{c.ex.hsr ? "HSR" : `${c.ex.s} × ${c.ex.r}`}</span>
                  <Plus size={18} aria-hidden="true" color={T.c.accent} />
                </button>
              ))}
            </div>
          )) : <div className="p-sec">{sayStable("noExerciseMatch")}</div>}
        </Panel>
      ) : (
        <Button variant="outline" block onClick={() => setAddOpen(true)}>
          <Plus size={18} aria-hidden="true" />Ajouter un exercice
        </Button>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Button variant="primary" style={{ flex: 1 }} onClick={validate}>
          <Check size={20} aria-hidden="true" />{initial ? "Enregistrer les modifications" : "Valider la séance"}
        </Button>
        <Button variant="plain" onClick={cancel}>Annuler</Button>
      </div>
    </div>
  );
}
