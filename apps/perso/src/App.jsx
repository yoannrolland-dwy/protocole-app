import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import {
  LayoutDashboard, Scale, Moon, Dumbbell, HeartPulse, Utensils, Footprints, Apple,
  Plus, AlertTriangle, CheckCircle2, Circle, Sparkles, Trash2,
  Play, Pause, SkipForward, RotateCcw, Timer, Droplet,
  ChevronRight, ChevronDown, Zap, Settings, Download, Upload, X, Copy,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { store, getSync, exportData, importData } from "./store.js";
import { isBackupStale, daysSinceBackup, scheduleBackupReminder } from "./cloudBackup.js";
import { exoProgress, exerciseList, exerciseSessions, exerciseTrend, isTimeMode, setLabel,
         beats, recordToBeat, recordsBySession, painOutOfBase } from "@rawcare/core/training";
import { SCHEMES, gradeIndex, ISSUES, climbSummary, climbLabel } from "@rawcare/core/climbing";
import { realDeficit, MIN_WINDOW_DAYS as MIN_TDEE_DAYS } from "@rawcare/core/tdee";
import { TEMPLATES, TYPES, DEFAULT_WEIGHTS, HSR_TABLE, hsrForWeek, hsrParse, parseSecs,
         ROUTINES, PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { refSet, lastPerf, perfHistory, lastExerciseSets, medianTarget } from "@rawcare/core/session/perf";
import { recommendSessions } from "@rawcare/core/recommender";
import { PHASES, phaseTarget as phaseTargetCore, DEFAULT_TARGETS, isCutWindow, targetsForDate,
         kcalFromMacros, kcalOfEntry, tdeeNow } from "@rawcare/core/targets";
import { buildCoachPrompt, buildCoachBriefing, splitCarnet, SEED_COACH_PROFILE } from "@rawcare/core/coach/prompt";
import { syncHealthConnect } from "./healthSync.js";
import { scheduleRestAlarm, cancelRestAlarm, hideRestCountdown } from "./timerNotify.js";
import { updateDashboardWidget } from "./widgetSync.js";
import { runAutoBackup } from "./autoBackup.js";
// Design system "Affirmée" : jetons + primitives, extraits de ce fichier le 01/08/2026
// pour être partageables avec src/nutrition/ (un import depuis App.jsx aurait été circulaire).
import {
  C, today, shiftDateKey, fmt, round, longDate, byDate, upsert, lastN, daysBetween, fmtHM,
  Card, Label, Body, Big, Empty, Btn, inputStyle, TextInput, Stepper,
  Field, DateField, Pills, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";
// Module Nutrition interne (chantier du 01/08/2026). Volontairement isolé : il gère sa
// propre clé `foodLog` et ne reçoit d'ici que les cibles, en lecture. Ni `macroLog` ni
// healthSync.js ne sont concernés tant que la bascule (M6) n'est pas décidée.
import NutritionTab from "./nutrition/NutritionTab.jsx";
import { isSilentSync, finishSilentSync } from "./silentSync.js";
import { PRICING, costCents, SUPPORTS_EFFORT, FALLBACK_MODEL, callClaude } from "./claudeApi.js";

const APP_VERSION = "3.59.0";

// Poids cible Sèche/Prise rendus éditables (07/08/2026) — packages/core/src/targets.js garde
// 93/95 en dur (décision figée, ce sont des valeurs personnelles) : la surcouche vit ici.
// `targets.weightCutTarget`/`weightBulkTarget` prennent le dessus s'ils sont définis, sinon
// repli sur les constantes du core — comportement inchangé tant que rien n'est édité. Même
// principe que `weightMaintenance`, déjà éditable côté core pour la phase Maintenance.
const phaseTarget = (phase, targets) => {
  if (phase === "seche" && targets.weightCutTarget != null) return targets.weightCutTarget;
  if (phase === "prise" && targets.weightBulkTarget != null) return targets.weightBulkTarget;
  return phaseTargetCore(phase, targets);
};

/* ============================================================
   PROTOCOLE — console perso de suivi (Yoann) · PWA
   Design "Affirmée" : noir profond, accent citron vert, mono.
   Logique inchangée : carnet série par série, mémoire des
   charges, timer, stockage local persistant, coach IA.
   ============================================================ */


/* ---------- utilitaires ---------- */
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
// entrées comprises dans les n derniers jours (fenêtre glissante, aujourd'hui inclus)
const withinDays = (arr, n) => arr.filter((e) => {
  const d = daysBetween(e.date, today());
  return d >= 0 && d <= n - 1;
});
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Bandeau affiché à la place de la saisie quand la donnée du jour vient d'ailleurs.
// `onCorrect` optionnel : pour Health Connect, corriger localement reste utile jusqu'à
// la prochaine synchro. Pour `foodLog` (bascule M6), corriger ici serait futile — l'effet
// de dérivation dans NutritionTab.jsx réécrase le jour au prochain changement du journal,
// où qu'il ait lieu — donc pas de bouton, juste l'information.
const SyncedBanner = ({ onCorrect, label = "Synchronisé depuis Health Connect" }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
    <Body style={{ fontSize: 11, color: C.dim }}>
      <Zap size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} color={C.accent} />
      {label}
    </Body>
    {onCorrect && <Btn variant="ghost" onClick={onCorrect} style={{ padding: "4px 8px", fontSize: 10 }}>Corriger manuellement</Btn>}
  </div>
);


/* ============================================================
   ROUTINE PLAYER
   ============================================================ */
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

function RoutinePlayer({ routine, onClose }) {
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

/* ============================================================
   COACH IA
   ============================================================ */
/* ------------------------------------------------------------
   Coach IA — appel API : tarifs, reprise sur saturation, coût réel
   ------------------------------------------------------------ */


function CoachIA({ coach, todayNote, saveNote, saveJournal }) {
  const [state, setState] = useState("idle");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState(todayNote || "");
  const [openNote, setOpenNote] = useState(false);
  const [progress, setProgress] = useState("");   // « réessai 1/2… », « bascule Haiku… »
  const [meta, setMeta] = useState(null);         // { model, usage, cents } de la dernière analyse

  const run = async () => {
    if (!coach.apiKey) {
      setErr("Ajoute ta clé API Anthropic dans Réglages pour activer l'analyse.");
      setState("error"); return;
    }
    saveNote(note);
    setState("loading"); setErr(""); setProgress(""); setMeta(null);
    try {
      const { system, user } = coach.buildPrompt(note);
      const askedModel = coach.model || "claude-sonnet-5";
      const { data, usedModel } = await callClaude({
        apiKey: coach.apiKey,
        model: askedModel,
        system,
        user,
        // « medium » plutôt que le défaut « high » : Sonnet 5 active la réflexion adaptative
        // dès qu'on ne précise rien, et cette réflexion est facturée au tarif de sortie tout
        // en consommant max_tokens — c'est la cause des réponses vides/tronquées observées
        // (budget monté 1000 → 1800 → 4096 → 6000). À « medium » la qualité reste au niveau
        // de Sonnet 4.6 en « high » pour une fraction du coût.
        effort: "medium",
        maxTokens: 6000,
        onRetry: setProgress,
      });
      setProgress("");
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      const { advice, journal } = splitCarnet(raw);
      if (journal) saveJournal(journal);
      const out = advice;
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: data.usage, cents: costCents(usedModel, data.usage), carnet: !!journal });
      if (!out) {
        console.warn("CoachIA — réponse vide, réponse brute :", data);
        const hasThinking = (data.content || []).some((b) => b.type === "thinking" || b.type === "redacted_thinking");
        setErr(
          data.stop_reason === "max_tokens"
            ? (hasThinking
                ? "Le modèle a épuisé son budget en réflexion interne avant de répondre. Réessaie (limite déjà augmentée) ; si ça persiste, signale-le-moi."
                : "Réponse coupée avant la fin (budget de tokens atteint). Réessaie.")
            : `Réponse vide (stop_reason: ${data.stop_reason || "inconnu"}). Signale ce message pour diagnostic.`
        );
        setState("error");
        return;
      }
      setText(out); setState("done");
    } catch (e) {
      console.error("CoachIA", e);
      setProgress("");
      setErr(e?.message || "Erreur inconnue"); setState("error");
    }
  };

  const ta = { ...inputStyle(false), fontFamily: "inherit", fontSize: 12, fontWeight: 400, resize: "vertical" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} color={C.accent} />
          <Label style={{ fontSize: 10 }}>Coach IA</Label>
        </div>
        <Btn variant="outline" onClick={run} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 11 }}>
          {state === "loading" ? "Analyse…" : "Analyser"}
        </Btn>
      </div>

      {state === "loading" && progress && (
        <Body style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono, marginBottom: 6 }}>{progress}</Body>
      )}

      <div onClick={() => setOpenNote((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", marginBottom: openNote ? 8 : 0 }}>
        {openNote ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
        <span style={{ fontSize: 11, color: C.muted }}>
          Note du jour{note ? <span style={{ color: C.accent }}> · remplie</span> : " (contexte)"}
        </span>
      </div>
      {openNote && (
        <div style={{ marginBottom: 10 }}>
          <textarea rows={2} value={note} placeholder="ex. j'ai bu de l'alcool hier soir, insomnie de 2h, cheville qui tire…"
            onChange={(e) => setNote(e.target.value)} onBlur={() => saveNote(note)} style={ta} />
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
            Contexte hors données chiffrées (alcool, blessure, stress…), pris en compte dans l'analyse d'aujourd'hui.
          </Body>
        </div>
      )}

      {state === "error" && (
        <div style={{ fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
          {/rate limit|429/i.test(err)
            ? <>Limite de débit atteinte. Attends ~1 min puis <button onClick={run} style={{ background: "none", border: "none", color: C.danger, textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>réessaie</button>.</>
            : <>{err}</>}
        </div>
      )}
      {state === "done" && <Body style={{ whiteSpace: "pre-wrap" }}>{text}</Body>}
      {state === "done" && meta?.usage && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>
            {(meta.usage.input_tokens ?? 0).toLocaleString("fr-FR")} tok entrée · {(meta.usage.output_tokens ?? 0).toLocaleString("fr-FR")} tok sortie
            {meta.fellBack && <span style={{ color: C.accent }}> · {meta.model}</span>}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent, fontWeight: 700 }}>
            ≈ {meta.cents < 1 ? meta.cents.toFixed(2) : meta.cents.toFixed(1)} ¢
          </span>
        </div>
      )}
      {state === "idle" && <Body style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Analyse tes 14 derniers jours (poids, macros, eau, séances, sommeil, douleurs genou/coude), au jour le jour et sur la semaine glissante. Nécessite ta clé API (Réglages).</Body>}
    </Card>
  );
}

/* ============================================================
   TAB — DASHBOARD
   ============================================================ */
function Dashboard({ weight, sleep, knee, elbow, macros, steps, targets, training, phase, coach, todayNote, saveNote, saveJournal, setTab, lastCloudBackup, openSettings, scheme }) {
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(weight, 1)[0];
  const wDelta = wLast ? round(wLast.kg - tgtW) : null;

  const lastNightDash = lastN(sleep, 1)[0];

  const kToday = knee.find((k) => k.date === today());
  const eToday = elbow.find((k) => k.date === today());
  const mToday = macros.find((m) => m.date === today());
  const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;

  const { suggestions, avoid } = useMemo(() => recommendSessions({ training, knee, elbow, sleep, targets, scheme }), [training, knee, elbow, sleep, targets, scheme]);

  const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
  const waterTgt = targets.water + (basketToday ? 1000 : 0);
  const kcalTgt = (() => { const a = targetsForDate(today(), targets); return Math.round(kcalFromMacros(a.protein, a.carbs, a.fat, a.fiber)); })();

  // 3 paires, toutes cliquables vers l'onglet correspondant.
  const tiles = [
    { label: "Poids", tab: "weight", val: wLast ? wLast.kg : "—", unit: "kg",
      note: `cible ${tgtW}`, color: C.text,
      extra: wDelta != null ? { txt: `${wDelta > 0 ? "▲" : "▼"}${Math.abs(wDelta)}`, col: wDelta > 0 ? C.danger : C.accent } : null },
    { label: "Pas", tab: "steps", val: stepsToday.toLocaleString("fr-FR"), unit: "",
      note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}`, color: C.text,
      bar: Math.min(100, (stepsToday / STEPS_TARGET) * 100) },
    { label: "Calories", tab: "macro", val: kcalToday ?? "—", unit: "",
      note: `/ ${kcalTgt} kcal`, color: C.text,
      bar: kcalToday != null ? Math.min(100, (kcalToday / kcalTgt) * 100) : null },
    { label: "Eau", tab: "macro", val: (waterToday / 1000).toFixed(2), unit: "L",
      note: `/ ${(waterTgt / 1000).toFixed(1)} L${basketToday ? " · basket" : ""}`, color: C.text,
      bar: Math.min(100, (waterToday / waterTgt) * 100) },
    { label: "Sommeil", tab: "sleep", val: lastNightDash ? fmtHM(lastNightDash.hours) : "—", unit: "",
      note: lastNightDash ? `${fmt(lastNightDash.date)}${lastNightDash.quality != null ? " · " + "★".repeat(lastNightDash.quality) : ""}` : "—",
      color: C.text },
    // Deux tendinopathies actives : la tuile en montre deux valeurs plutôt qu'une seule.
    // `pair` déclenche un rendu spécifique plus bas (val/unit/bar ne s'appliquent pas ici).
    { label: "Douleurs", tab: "pain", note: "aujourd'hui",
      pair: [
        { k: "Genou", val: kToday ? kToday.pain : "—",
          col: kToday && (kToday.baseline === false || kToday.pain >= 6) ? C.danger : kToday ? C.accent : C.muted },
        { k: "Coude", val: eToday ? eToday.pain : "—",
          col: eToday && (eToday.baseline === false || eToday.pain >= 6) ? C.danger : eToday ? C.accent : C.muted },
      ] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Sauvegarde externe périmée : le rappel doit être là où l'app s'ouvre, pas seulement
          enterré dans les Réglages — c'est lui qui fait que la sauvegarde a lieu. */}
      {isBackupStale(lastCloudBackup) && (
        <Card danger onClick={openSettings} style={{ padding: "11px 13px", cursor: "pointer" }}>
          <div style={{ fontSize: 11, color: C.danger, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ⚠ Sauvegarde hors du téléphone
          </div>
          <Body style={{ color: C.dangerText, fontSize: 11, marginTop: 3 }}>
            {lastCloudBackup
              ? `Dernière il y a ${daysSinceBackup(lastCloudBackup)} jours (${fmt(lastCloudBackup)}).`
              : "Jamais faite."} Toucher ici pour sauvegarder (Réglages).
          </Body>
        </Card>
      )}

      {/* Tuiles : poids/pas · calories/eau · sommeil/douleurs — toutes cliquables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.label} onClick={() => setTab(t.tab)} style={{
            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: 11, cursor: "pointer",
          }}>
            <Label>{t.label}</Label>
            {t.pair ? (
              <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                {t.pair.map((p) => (
                  <div key={p.k} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: p.col }}>
                      {p.val}<span style={{ fontSize: 11, color: C.muted }}>/10</span>
                    </div>
                    <div style={{ fontSize: 8.5, color: C.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.k}</div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: t.color }}>
                {t.val}<span style={{ fontSize: 11, color: C.muted }}>{t.unit}</span>
              </span>
              {t.extra && (
                <span style={{ fontSize: 11, color: t.extra.col, fontWeight: 700, marginLeft: "auto" }}>{t.extra.txt}</span>
              )}
            </div>
            )}
            <div style={{ fontSize: 8.5, color: C.dim, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.note}</div>
            {t.bar != null && (
              <div style={{ background: C.bg, borderRadius: 6, height: 4, overflow: "hidden", marginTop: 5 }}>
                <div style={{ background: C.accent, width: `${t.bar}%`, height: "100%" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prochaine séance */}
      <Card accentLeft onClick={() => setTab("train")} style={{ padding: "13px 14px", cursor: "pointer" }}>
        <Label style={{ letterSpacing: 1.5, marginBottom: 5 }}>Prochaine séance</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 800 }}>{suggestions[0]?.type}</div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>{suggestions[0]?.score}</div>
        </div>
        <Body>{suggestions[0]?.reason}</Body>
        {suggestions.slice(1).map((r) => (
          <div key={r.type} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: 12, color: C.text2, fontWeight: 700 }}>{r.type}</div>
              <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.dim }}>{r.score}</div>
            </div>
            <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.4, marginTop: 1 }}>{r.reason}</div>
          </div>
        ))}
        {avoid.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
            <Label style={{ color: C.danger, marginBottom: 6 }}>À éviter aujourd'hui</Label>
            {avoid.map((a) => (
              <div key={a.type} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 5 }}>
                <AlertTriangle size={12} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 11.5, color: C.dangerText, fontWeight: 700 }}>{a.type}</span>
                  <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.4 }}>{a.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Coach IA */}
      <CoachIA coach={coach} todayNote={todayNote} saveNote={saveNote} saveJournal={saveJournal} />

      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", padding: "0 8px" }}>
        Outil de suivi personnel, pas un avis médical. Douleur aiguë ou persistante → kiné.
      </Body>
    </div>
  );
}

/* ============================================================
   TAB — POIDS
   ============================================================ */
function WeightTab({ weight, targets, save, phase }) {
  const tgtW = phaseTarget(phase, targets);
  const [date, setDate] = useState(today());
  const cur = weight.find((w) => w.date === date);
  const [kg, setKg] = useState(lastN(weight, 1)[0]?.kg ?? 95);
  const [forceManual, setForceManual] = useState(false);
  const pickDate = (d) => { setDate(d); const e = weight.find((w) => w.date === d); if (e) setKg(e.kg); setForceManual(false); };
  const wLast = lastN(weight, 1)[0];
  const data = lastN(weight, 60).map((w) => ({ date: fmt(w.date), kg: w.kg }));
  const add = () => save.weight(upsert(weight, { date, kg: round(kg), source: "manual" }));
  const isSynced = cur?.source === "healthconnect" && !forceManual;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Poids" subtitle={`${PHASES[phase].label} · cible ${tgtW} kg`} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Actuel</Label>
          <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>cible {tgtW} kg</span>
        </div>
        <div style={{ margin: "6px 0 12px" }}><Big value={wLast ? wLast.kg : "—"} unit="kg" /></div>
        {data.length > 1 ? (
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={tgtW} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Line type="monotone" dataKey="kg" stroke={C.text} strokeWidth={2} dot={{ r: 2, fill: C.text }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune pesée enregistrée.</Empty>}
      </Card>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <>
            <Field label="Poids (kg)"><Stepper value={kg} set={setKg} step={0.1} unit="kg" min={40} /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {weight.some((w) => w.date === date) && (
                <Btn variant="danger" onClick={() => save.weight(weight.filter((w) => w.date !== date))}><Trash2 size={14} /></Btn>
              )}
            </div>
          </>
        )}
      </Card>

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Historique</Label>
        {weight.length ? lastN(weight, 10).reverse().map((w) => (
          <div key={w.date} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.divider}`, fontFamily: C.mono, fontSize: 13 }}>
            <span style={{ color: C.text2 }}>{fmt(w.date)}</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{w.kg}</span>
          </div>
        )) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}

/* ============================================================
   TAB — SOMMEIL
   ============================================================ */
function SleepTab({ sleep, save }) {
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
  const lastNight = lastN(sleep, 1)[0];
  const data = lastN(sleep, 21).map((s) => ({ date: fmt(s.date), hours: s.hours }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Sommeil" subtitle="récupération tendon & muscle" />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Dernière nuit</Label>
          {lastNight?.quality != null && (
            <span style={{ fontSize: 13, color: C.accent, letterSpacing: 1 }}>{"★".repeat(lastNight.quality)}<span style={{ color: C.dim }}>{"★".repeat(4 - lastNight.quality)}</span></span>
          )}
        </div>
        <div style={{ margin: "6px 0 14px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 44, fontWeight: 800, color: C.text }}>
            {lastNight ? fmtHM(lastNight.hours) : "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 44 }}>
          {last7.length ? last7.map((s, i) => (
            <div key={i} title={`${fmt(s.date)} · ${fmtHM(s.hours)}`} style={{
              flex: 1, borderRadius: "3px 3px 0 0",
              background: i === last7.length - 1 ? C.accent : C.border,
              height: `${Math.max(8, (s.hours / maxH) * 100)}%`,
            }} />
          )) : <Body style={{ fontSize: 11, color: C.dim }}>Aucune nuit enregistrée.</Body>}
        </div>
      </Card>

      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
        <Label>Moy. 7j</Label>
        <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>{avg7 != null ? fmtHM(avg7) : "—"}</div>
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
              <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 4 }}>★ Attention requise · ★★ Correct · ★★★ Bon · ★★★★ Excellent</Body>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {sleep.some((s) => s.date === date) && (
                <Btn variant="danger" onClick={() => save.sleep(sleep.filter((s) => s.date !== date))}><Trash2 size={14} /></Btn>
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
    </div>
  );
}

/* ============================================================
   TAB — PAS
   ============================================================ */
const STEPS_TARGET = 10000;
function StepsTab({ steps, save }) {
  const [date, setDate] = useState(today());
  const cur = steps.find((s) => s.date === date);
  const [n, setN] = useState(cur?.count ?? 0);
  const [forceManual, setForceManual] = useState(false);
  const pickDate = (d) => { setDate(d); const e = steps.find((s) => s.date === d); setN(e?.count ?? 0); setForceManual(false); };
  const add = () => save.steps(upsert(steps, { date, count: Math.round(n), source: "manual" }));
  const isSynced = cur?.source === "healthconnect" && !forceManual;

  const last7 = lastN(steps, 7);
  const avg7 = avg(last7.map((s) => s.count));
  const data = lastN(steps, 21).map((s) => ({ date: fmt(s.date), count: s.count }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Pas" subtitle="saisie manuelle · activité quotidienne" />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>{date === today() ? "Aujourd'hui" : fmt(date)}</Label>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>cible {STEPS_TARGET.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 10px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 38, fontWeight: 800, color: C.text }}>{n.toLocaleString("fr-FR")}</span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ background: C.accent, width: `${Math.min(100, (n / STEPS_TARGET) * 100)}%`, height: "100%" }} />
        </div>
      </Card>

      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
        <Label>Moy. 7j</Label>
        <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>
          {avg7 != null ? Math.round(avg7).toLocaleString("fr-FR") : "—"}
        </div>
      </div>

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <>
            <Field label="Pas"><Stepper value={n} set={setN} step={500} min={0} int /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {steps.some((s) => s.date === date) && (
                <Btn variant="danger" onClick={() => save.steps(steps.filter((s) => s.date !== date))}><Trash2 size={14} /></Btn>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Pas · 21 jours</Label>
        {data.length ? (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip formatter={(v) => [v.toLocaleString("fr-FR"), "Pas"]} contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={STEPS_TARGET} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.count >= STEPS_TARGET ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>
    </div>
  );
}

/* ============================================================
   CARNET DE MUSCU — série par série
   ============================================================ */
function MuscuLogger({ type, training, hsrWeek, date, onDate, onSave, onCancel, initial, painRed = false }) {
  const template = TEMPLATES[type];
  const hp = hsrParse(hsrForWeek(hsrWeek).scheme);

  const buildExos = () => template.exos.map((ex) => {
    const nSeries = ex.hsr ? hp.series : ex.s;
    const last = lastPerf(training, ex.n);
    const lastSets = lastExerciseSets(training, ex.n);
    const target = ex.hsr ? `${hp.reps}` : ex.r;
    const def = DEFAULT_WEIGHTS[ex.n];
    const medVal = medianTarget(target);

    // Édition d'une séance déjà enregistrée : on réaffiche les séries telles
    // qu'elles ont été sauvegardées (valeurs réelles), pas des suggestions
    // basées sur l'historique.
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
  useEffect(() => {
    if (!tRun) return;
    tRef.current = setInterval(() => setTRem((r) => { if (r <= 1) { clearInterval(tRef.current); setTRun(false); return 0; } return r - 1; }), 1000);
    return () => clearInterval(tRef.current);
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
    if (next !== -1 && next !== open) setTimer(lastTimerByExo[next] ?? exos[next].rest);
  };

  // ---- mutateurs ----
  const upd = (ei, si, field, value) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, [field]: value }) }));
  const toggle = (ei, si) => {
    setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : { ...s, fait: !s.fait }) }));
    // coche = fin de série → relance le minuteur sur le dernier temps utilisé pour cet exercice (fin de série uniquement, pas décoche)
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
  // Référence à battre = meilleure série de TOUT l'historique hors séance en cours (une
  // séance en modification ne doit pas être son propre record à battre). Calculée une fois
  // par exercice, pas à chaque frappe.
  const refRecords = useMemo(() => {
    const m = {};
    exos.forEach((e) => { m[e.nom] = recordToBeat(training, e.nom, initial); });
    return m;
  }, [training, initial, exos.map((e) => e.nom).join("|")]);
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
        <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
      </div>
    </div>
  );
}

/* ============================================================
   TAB — SÉANCES
   ============================================================ */
/* ============================================================
   ÉCRAN — PROGRESSION PAR EXERCICE (V3)
   `exoProgress` était calculé pour le Coach IA et n'apparaissait nulle part à l'écran :
   l'app avait des courbes pour le poids, le sommeil, les pas, la douleur et les calories,
   mais aucune pour l'entraînement, qui est pourtant son cœur.
   ============================================================ */
const trendColor = (key) => (key === "up" ? C.accent : key === "down" ? C.danger : C.muted);

function ExerciseDetail({ training, nom, onBack }) {
  const sessions = useMemo(() => exerciseSessions(training, nom), [training, nom]);
  const mode = sessions[sessions.length - 1]?.mode;
  const temps = isTimeMode(mode);
  const trend = exerciseTrend(sessions);
  // Grandeur tracée : les secondes en gainage, le volume (charge × reps) sinon — voir
  // `setScore`. Pas de 1RM estimé, décision explicite (tendinopathie en rééducation).
  const data = sessions.map((s) => ({ date: fmt(s.date), v: s.score, label: setLabel(s.best, s.mode) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={nom} subtitle={`${sessions.length} séance${sessions.length > 1 ? "s" : ""} · ${temps ? "tenue la plus longue" : "meilleure série"}`}
        right={<Btn variant="ghost" onClick={onBack}><X size={16} /></Btn>} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>{temps ? "Tenue · secondes" : "Volume · charge × reps"}</Label>
          <span style={{ fontSize: 11, fontFamily: C.mono, fontWeight: 800, color: trendColor(trend.key) }}>{trend.label}</span>
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

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Séance par séance</Label>
        {sessions.slice().reverse().map((s, i) => (
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
        ))}
      </Card>
    </div>
  );
}

function ProgressScreen({ training, onBack }) {
  const [sel, setSel] = useState(null);
  const list = useMemo(() => exerciseList(training), [training]);
  if (sel) return <ExerciseDetail training={training} nom={sel} onBack={() => setSel(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Progression" subtitle="par exercice · meilleure série de chaque séance"
        right={<Btn variant="ghost" onClick={onBack}><X size={16} /></Btn>} />
      <Card style={{ padding: "6px 14px" }}>
        {list.length ? list.map((e) => {
          // Tendance calculée par exercice : c'est l'information qu'on vient chercher, la
          // liste seule ne dirait pas si ça monte ou si ça stagne.
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

/* ============================================================
   SAISIE DES BLOCS D'ESCALADE (V5)
   Doit rester rapide au doigt EN SALLE : une grille de cotations à taper, jamais un champ
   texte libre, et un moyen d'ajouter plusieurs blocs de même cotation d'un coup.
   ============================================================ */
function BlocsField({ blocs, setBlocs, scheme }) {
  // Issue « armée » : on choisit une fois, puis on tape les cotations. Défaut « après
  // essais », le cas le plus fréquent — flash et échec sont les exceptions.
  const [issue, setIssue] = useState("essais");

  const add = (cotation, n = 1) => setBlocs([...blocs, ...Array.from({ length: n }, () => ({ cotation, issue }))]);
  // Retire UN bloc de ce couple (cotation, issue) — le dernier ajouté.
  const rm = (cotation, iss) => {
    const i = blocs.map((b) => b.cotation === cotation && b.issue === iss).lastIndexOf(true);
    if (i >= 0) setBlocs(blocs.filter((_, j) => j !== i));
  };

  // Récapitulatif groupé par (cotation, issue), trié par difficulté croissante : c'est la
  // lecture utile en fin de séance, pas la liste chronologique des 20 blocs.
  const groupes = [];
  blocs.forEach((b) => {
    const g = groupes.find((x) => x.cotation === b.cotation && x.issue === b.issue);
    if (g) g.n += 1; else groupes.push({ cotation: b.cotation, issue: b.issue, n: 1 });
  });
  groupes.sort((a, b) => gradeIndex(scheme, a.cotation) - gradeIndex(scheme, b.cotation)
    || ISSUES.findIndex((x) => x.key === a.issue) - ISSUES.findIndex((x) => x.key === b.issue));

  const s = climbSummary(blocs, scheme);
  // Compte par cotation, toutes issues confondues : affiché dans la grille pour savoir où
  // on en est sans lire le récapitulatif.
  const parCotation = {};
  blocs.forEach((b) => { parCotation[b.cotation] = (parCotation[b.cotation] || 0) + 1; });

  // Deux modes de saisie selon le schéma actif (RawCare Phase 1, 06/08/2026) : "gym" reste
  // une grille couleur × niveau (la lecture du mur) ; un schéma sans colors/levels (ex.
  // Fontainebleau) devient une liste plate de puces, une par cotation.
  const isGrid = !!(scheme.colors && scheme.levels);

  return (
    <div style={{ marginTop: 12 }}>
      <Label style={{ marginBottom: 6 }}>Blocs · issue à enregistrer</Label>
      <Pills options={ISSUES.map((i) => ({ key: i.key, label: i.label }))} value={issue} onChange={setIssue} small />

      <Label style={{ margin: "10px 0 6px" }}>Taper un niveau pour l'ajouter</Label>
      {isGrid ? (
        /* Une ligne par couleur de piste, du plus facile au plus dur — la lecture du mur.
           La pastille de couleur est la seule entorse admise au « accent citron uniquement » :
           ici la couleur EST la donnée, pas une décoration. */
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {scheme.colors.map((col) => (
            <div key={col.key} style={{ display: "grid", gridTemplateColumns: `62px repeat(${scheme.levels.length}, 1fr)`, gap: 5, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: col.hex, flexShrink: 0,
                  border: col.key === "noir" ? `1px solid ${C.border}` : "none" }} />
                <span style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 }}>{col.label}</span>
              </span>
              {scheme.levels.map((lv) => {
                const g = scheme.makeGrade(col.key, lv);
                const n = parCotation[g] || 0;
                return (
                  <button key={lv} onClick={() => add(g)} style={{
                    padding: "8px 2px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
                    fontSize: 12, fontWeight: 800,
                    background: n ? C.accentRow : C.card, color: n ? C.accent : C.muted,
                    border: `1.5px solid ${n ? C.accent : C.border}`,
                  }}>
                    {lv}{n > 0 && <span style={{ fontSize: 9, marginLeft: 1 }}>×{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* Schéma sans grille (ex. Fontainebleau) : une puce par cotation, ordre croissant. */
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {scheme.grades.map((g) => {
            const n = parCotation[g] || 0;
            return (
              <button key={g} onClick={() => add(g)} style={{
                padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
                fontSize: 12, fontWeight: 800,
                background: n ? C.accentRow : C.card, color: n ? C.accent : C.muted,
                border: `1.5px solid ${n ? C.accent : C.border}`,
              }}>
                {g}{n > 0 && <span style={{ fontSize: 9, marginLeft: 2 }}>×{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {groupes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {groupes.map((g) => (
            <div key={`${g.cotation}-${g.issue}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 0", borderTop: `1px solid ${C.divider}`,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: C.mono, fontSize: 12, color: C.text, fontWeight: 700 }}>
                {isGrid && <span style={{ width: 9, height: 9, borderRadius: 3, background: scheme.gradeColor(g.cotation) || C.dim,
                  border: g.cotation.startsWith("noir") ? `1px solid ${C.border}` : "none" }} />}
                {scheme.gradeLabel(g.cotation)}
                <span style={{ color: g.issue === "echec" ? C.danger : C.muted, fontWeight: 400, marginLeft: 2, fontFamily: "inherit" }}>
                  {ISSUES.find((i) => i.key === g.issue)?.label}
                </span>
              </span>
              {/* −/+ collés : ajuster une quantité d'un pouce, sans repasser par la grille */}
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => rm(g.cotation, g.issue)} style={blocStep}>−</button>
                <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.accent, minWidth: 16, textAlign: "center" }}>{g.n}</span>
                <button onClick={() => setBlocs([...blocs, { cotation: g.cotation, issue: g.issue }])} style={blocStep}>+</button>
              </span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono, marginTop: 8 }}>
            {s.n} bloc{s.n > 1 ? "s" : ""}
            {s.max ? ` · max ${scheme.gradeLabel(s.max)} · médiane ${scheme.gradeLabel(s.mediane)}` : " · aucun réussi"}
            {` · ${s.flash} flash / ${s.essais} essais / ${s.echec} échec${s.echec > 1 ? "s" : ""}`}
          </div>
        </div>
      )}
    </div>
  );
}
const blocStep = {
  width: 28, height: 28, borderRadius: 6, background: C.card, color: C.accent,
  border: `1.5px solid ${C.border}`, cursor: "pointer", fontSize: 15, fontWeight: 800,
  fontFamily: "inherit", lineHeight: 1,
};

function TrainTab({ training, save, hsrWeek, setHsrWeek, knee, elbow, scheme }) {
  const [open, setOpen] = useState(null);
  const [progress, setProgress] = useState(false);
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(60);
  const [rpe, setRpe] = useState(7);
  const [blocs, setBlocs] = useState([]);
  // Séance déjà enregistrée en cours de modification (référence exacte de l'objet
  // dans `training`) — null quand on démarre une nouvelle séance à blanc.
  const [editing, setEditing] = useState(null);

  const pickType = (type) => {
    const sel = open === type;
    setEditing(null);
    setDate(today());
    setStartTime(new Date().toTimeString().slice(0, 5));
    setDuration(60);
    setRpe(7);
    setBlocs([]);
    setOpen(sel ? null : type);
  };

  const editSession = (t) => {
    setEditing(t);
    setDate(t.date);
    setStartTime(t.start ?? new Date().toTimeString().slice(0, 5));
    setDuration(t.duration ?? 60);
    setRpe(t.rpe ?? 7);
    setBlocs(t.blocs ?? []);
    setOpen(t.type);
  };

  const logSession = (type) => {
    const rec = { id: editing?.id ?? `${date}-${type}-${Date.now()}`, date, type, start: startTime, duration: round(duration), rpe,
      // Champ omis quand il n'y a rien à dire : une séance sans blocs saisis reste
      // exactement la même entrée qu'avant V5 (et le recommandeur le voit).
      ...(type === "Escalade" && blocs.length ? { blocs } : {}) };
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };
  const saveMuscu = (rec) => {
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };

  const vol = {};
  training.filter((t) => daysBetween(t.date, today()) <= 14).forEach((t) => { vol[t.type] = (vol[t.type] || 0) + 1; });
  const exoCount = useMemo(() => exerciseList(training).length, [training]);
  // Records rejoués sur tout l'historique (V4) : quelles séances contenaient un record au
  // moment où elles ont eu lieu. Clé par référence d'objet, comme la suppression.
  const records = useMemo(() => recordsBySession(training), [training]);
  const painRed = painOutOfBase([knee, elbow], date);

  if (open && TEMPLATES[open]?.kind === "muscu") {
    return (
      <MuscuLogger key={editing?.id || `new-${open}`} type={open} training={training} hsrWeek={hsrWeek} date={date} onDate={setDate}
        onSave={saveMuscu} onCancel={() => { setOpen(null); setEditing(null); }} initial={editing} painRed={painRed} />
    );
  }
  if (progress) return <ProgressScreen training={training} onBack={() => setProgress(false)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Séances" subtitle="carnet · progressive overload" />

      {/* Choix du type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TYPES.map((type) => {
          const sel = open === type;
          return (
            <button key={type} onClick={() => pickType(type)} style={{
              background: sel ? C.accentRow : C.card, textAlign: "left", cursor: "pointer",
              border: `1.5px solid ${sel ? C.accent : C.border}`, borderRadius: 10, padding: "13px 14px", fontFamily: "inherit",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: sel ? C.accent : C.text, textTransform: "uppercase" }}>{type}</span>
                <ChevronRight size={13} color={sel ? C.accent : C.dim} />
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: C.mono }}>
                {vol[type] ? `${vol[type]}× / 14j` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Séance non-muscu */}
      {open && TEMPLATES[open].kind !== "muscu" && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, color: C.accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>
            {open}{editing && <span style={{ fontSize: 11, textTransform: "none", marginLeft: 6 }}>(modification)</span>}
          </div>
          <Body style={{ marginBottom: 12 }}>
            {open === "Escalade"
              ? "Compte comme volume tirage — jamais un jour Upper, pour protéger le coude."
              : "Passer par l'échauffement basket sécurisé (onglet Genou)."}
          </Body>
          <div style={{ marginBottom: 10 }}><DateField value={date} onChange={setDate} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Début">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle(false)} />
            </Field>
            <Field label="Durée (min)"><Stepper value={duration} set={setDuration} step={5} min={0} int /></Field>
          </div>
          <Field label="RPE"><Stepper value={rpe} set={setRpe} step={1} min={1} max={10} int /></Field>
          {open === "Escalade" && <BlocsField blocs={blocs} setBlocs={setBlocs} scheme={scheme} />}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={() => logSession(open)} style={{ flex: 1 }}>
              <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />{editing ? "Enregistrer les modifications" : "Enregistrer"}
            </Btn>
            <Btn variant="ghost" onClick={() => { setOpen(null); setEditing(null); }}>Annuler</Btn>
          </div>
        </Card>
      )}

      {/* Progression par exercice */}
      <Card accentLeft onClick={() => setProgress(true)} style={{ padding: "13px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label style={{ letterSpacing: 1.5 }}>Progression par exercice</Label>
            <Body style={{ marginTop: 3 }}>
              {exoCount ? `${exoCount} exercice${exoCount > 1 ? "s" : ""} suivi${exoCount > 1 ? "s" : ""} · courbe et tendance` : "Aucune séance de muscu enregistrée pour l'instant."}
            </Body>
          </div>
          <ChevronRight size={15} color={C.accent} />
        </div>
      </Card>

      {/* Semaine HSR */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Semaine HSR</Label>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, fontWeight: 800 }}>{hsrForWeek(hsrWeek).scheme}</span>
        </div>
        <Stepper value={hsrWeek} set={setHsrWeek} step={1} min={1} max={12} int unit="/12" />
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Pilote presse à cuisses + leg extension en Lower A. Tempo 6 s · repos 2-3 min.</Body>
      </Card>

      {/* Historique */}
      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Dernières séances</Label>
        {training.length ? lastN(training, 10).reverse().map((t, i) => {
          // Marqueur record : la séance contenait au moins une meilleure série de tous les
          // temps AU MOMENT où elle a eu lieu, et aucun tendon n'était hors base ce jour-là.
          const rec = records.get(t);
          const recShown = rec && !painOutOfBase([knee, elbow], t.date);
          return (
          <div key={i} onClick={() => editSession(t)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.divider}`, cursor: "pointer" }}>
            <div>
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{t.type}</span>
              {recShown && (
                <span title={rec.join(" · ")} style={{ fontSize: 10, color: C.accent, fontWeight: 800, marginLeft: 6, fontFamily: C.mono }}>
                  ★{rec.length > 1 ? rec.length : ""}
                </span>
              )}
              <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 8, fontFamily: C.mono }}>{fmt(t.date)}{t.start ? ` · ${t.start}` : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>
                {t.exercices
                  ? `${t.exercices.length} exos · ${t.exercices.reduce((a, e) => a + (e.series?.length || 0), 0)} séries`
                  : `${t.duration != null ? t.duration + "′" : ""}${t.rpe != null ? ` · RPE ${t.rpe}` : ""}${climbLabel(t.blocs, scheme) ? ` · ${climbLabel(t.blocs, scheme)}` : ""}`}
              </span>
              <button onClick={(ev) => { ev.stopPropagation(); save.training(training.filter((x) => x !== t)); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          );
        }) : <Empty>Aucune séance enregistrée.</Empty>}
      </Card>
    </div>
  );
}

/* ============================================================
   TAB — DOULEURS (genou + coude)
   ============================================================ */
// Une zone = un journal (clé localStorage distincte, même forme `{date, pain, baseline}`)
// et son habillage. Ajouter une 3e zone un jour ne coûte qu'une entrée ici + une clé dans
// `DATA_KEYS` + une ligne dans `save` — c'est le but de cette table.
const PAIN_ZONES = [
  {
    key: "knee", label: "Genou",
    title: "Genou · réhab", sub: "tendon quadricipital · HSR · Silbernagel",
    // La table HSR et les routines guidées sont propres au quadricipital : elles ne
    // doivent pas s'afficher sous la zone Coude, où elles n'ont aucun sens.
    hsr: true, routines: true,
    alertText: "Décharge : pas de basket ni de Lower tant que la douleur n'est pas revenue à sa base. Réduire charge ou amplitude à la prochaine exposition.",
  },
  {
    key: "elbow", label: "Coude",
    title: "Coude · réhab", sub: "tendon distal du biceps · prises neutres · Silbernagel",
    hsr: false, routines: false,
    alertText: "Décharge du tirage : pas d'escalade ni d'Upper tant que la douleur n'est pas revenue à sa base. Prises neutres/pronation, supination (chin-ups) à éviter.",
  },
];

function PainTab({ knee, elbow, save, hsrWeek }) {
  const logs = { knee, elbow };
  const [zoneKey, setZoneKey] = useState("knee");
  const zone = PAIN_ZONES.find((z) => z.key === zoneKey);
  const log = logs[zoneKey];
  const entryOf = (zk, d) => (logs[zk] || []).find((e) => e.date === d);

  const [date, setDate] = useState(today());
  // Aucune valeur par défaut (ni 4 ni 5) : rien n'est présélectionné à l'ouverture, et
  // l'enregistrement reste bloqué tant qu'un chiffre n'a pas été touché. Demandé
  // explicitement pour forcer une vraie évaluation de la sensation plutôt qu'un
  // enregistrement réflexe — une entrée « par défaut » fausserait l'historique et la
  // règle de Silbernagel. Vaut pour les deux zones.
  // ...mais si le jour affiché a DÉJÀ une entrée, on la recharge (exigence explicite) :
  // sinon l'écran afficherait « rien de noté » alors que la donnée existe, et on risquerait
  // de croire la journée non renseignée. Les onglets ne sont montés qu'une fois le
  // localStorage lu (voir le garde `loading` du composant App), donc les journaux sont
  // déjà peuplés ici, et rouvrir l'onglet relance cette initialisation.
  const existingToday = (knee || []).find((k) => k.date === today());
  const [pain, setPain] = useState(existingToday ? existingToday.pain : null);
  const [baseline, setBaseline] = useState(existingToday ? existingToday.baseline !== false : true);
  const [routine, setRoutine] = useState(null);
  // Changer de date OU de zone recharge l'entrée existante, ou remet à vide si la
  // combinaison visée n'a rien — sans ce reset, la douleur d'une autre date (ou de l'autre
  // tendon) resterait affichée et pourrait être enregistrée par erreur.
  const pick = (zk, d) => {
    setZoneKey(zk); setDate(d);
    const e = entryOf(zk, d);
    setPain(e ? e.pain : null);
    setBaseline(e ? e.baseline !== false : true);
    if (zk !== zoneKey) setRoutine(null);
  };
  const pickDate = (d) => pick(zoneKey, d);
  const add = () => { if (pain == null) return; save[zoneKey](upsert(log, { date, pain, baseline })); };

  const kLast = lastN(log, 1)[0];
  // Même logique de péremption que le recommandeur : une alerte vieille de dix jours
  // n'est plus un signal, c'est une donnée périmée — on affiche son âge pour le dire.
  const kLastAge = kLast ? daysBetween(kLast.date, today()) : null;
  const alert = kLast && (kLast.baseline === false || kLast.pain >= 6);
  const alertStale = alert && kLastAge > 3;
  const data = lastN(log, 30).map((k) => ({ date: fmt(k.date), pain: k.pain, flag: k.baseline === false }));
  const curRow = hsrForWeek(hsrWeek);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={zone.title} subtitle={zone.sub} />

      <Pills options={PAIN_ZONES.map((z) => ({ key: z.key, label: z.label }))} value={zoneKey} onChange={(k) => pick(k, date)} />

      <Card>
        <Label style={{ marginBottom: 8 }}>Douleur · 30 jours</Label>
        {data.length ? (
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis domain={[0, 10]} tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={5} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1} />
                <Line type="monotone" dataKey="pain" stroke={C.danger} strokeWidth={2.5}
                  dot={(p) => {
                    const { cx, cy, payload, index } = p;
                    return payload.flag
                      ? <circle key={index} cx={cx} cy={cy} r={5} fill={C.danger} stroke={C.text} strokeWidth={2} />
                      : <circle key={index} cx={cx} cy={cy} r={3} fill={C.text} />;
                  }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucun relevé.</Empty>}
        <Body style={{ fontSize: 11, marginTop: 6 }}>Point cerclé = douleur non revenue à la base sous 24 h (surcharge).</Body>
      </Card>

      {alert && (
        <Card danger style={{ padding: "13px 14px" }}>
          <div style={{ fontSize: 12, color: C.danger, fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>
            ⚠ Signal de surcharge{alertStale ? ` · relevé il y a ${kLastAge} j` : ""}
          </div>
          <Body style={{ color: C.dangerText }}>
            {alertStale
              ? "Ce signal date : note ta douleur du jour pour savoir où tu en es vraiment."
              : zone.alertText}
          </Body>
        </Card>
      )}

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <Label>Douleur (0-10)</Label>
          {pain == null && <span style={{ fontSize: 10, color: C.dim }}>choisis un chiffre pour enregistrer</span>}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
            const on = pain === n;
            const col = n >= 6 ? C.danger : n >= 4 ? "#e8a33d" : C.accent;
            return (
              <button key={n} onClick={() => setPain(n)} style={{
                width: 30, height: 32, borderRadius: 6, fontFamily: C.mono, fontSize: 13, fontWeight: 800, cursor: "pointer",
                background: on ? col : C.card, color: on ? "#000" : C.muted,
                border: `1.5px solid ${on ? col : C.border}`,
              }}>{n}</button>
            );
          })}
        </div>
        <Label style={{ marginBottom: 6 }}>Retour à la base sous 24 h ?</Label>
        <Pills options={[{ key: true, label: "Oui" }, { key: false, label: "Non" }]} value={baseline} onChange={setBaseline} small />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn variant="primary" onClick={add} disabled={pain == null} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
          {log.some((k) => k.date === date) && (
            <Btn variant="danger" onClick={() => save[zoneKey](log.filter((k) => k.date !== date))}><Trash2 size={14} /></Btn>
          )}
        </div>
      </Card>

      {/* Table HSR — genou uniquement */}
      {zone.hsr && (
      <Card style={{ padding: "10px 14px" }}>
        <Label style={{ padding: "4px 0" }}>Table HSR · presse &amp; leg ext</Label>
        {HSR_TABLE.map((row) => {
          const cur = row.wk === curRow.wk;
          return (
            <div key={row.wk} style={{
              display: "flex", justifyContent: "space-between", padding: "7px 0",
              borderTop: `1px solid ${C.divider}`, fontSize: 12,
              background: cur ? C.accentRow : "transparent", fontWeight: cur ? 800 : 400,
            }}>
              <span style={{ color: cur ? C.accent : C.muted }}>Sem {row.wk}{cur ? " (en cours)" : ""}</span>
              <span style={{ color: cur ? C.accent : C.muted, fontFamily: C.mono }}>{row.scheme}</span>
            </div>
          );
        })}
      </Card>
      )}

      {/* Routines guidées — genou uniquement */}
      {zone.routines && (routine ? (
        <RoutinePlayer routine={ROUTINES[routine]} onClose={() => setRoutine(null)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(ROUTINES).map(([key, r]) => (
            <div key={key} onClick={() => setRoutine(key)} style={{
              background: C.card, border: `1.5px solid ${C.accent}`, borderRadius: 10,
              padding: "13px 14px", textAlign: "center", cursor: "pointer",
            }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, textTransform: "uppercase" }}>
                <Play size={12} style={{ display: "inline", marginRight: 5 }} />{r.title}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Couleur par palier de fiabilité — mêmes seuils visuels que la douleur (accent = bon,
// ambre = à nuancer, danger = à prendre avec de grosses pincettes). "Faible" n'utilise pas
// le rouge : ce n'est pas une alerte, juste une estimation à ne pas trop croire.
const TDEE_RELIABILITY_COLOR = { fiable: C.accent, moyenne: "#e8a33d", faible: C.muted };
const TDEE_RELIABILITY_LABEL = { fiable: "fiable", moyenne: "moyenne", faible: "faible" };

/**
 * Carte "Dépense estimée" (V7). Jamais un chiffre non fiable : tant qu'il n'y a pas assez
 * de recul (14 j mini, 70 % des apports loggés), affiche pourquoi plutôt qu'un nombre.
 */
function TdeeCard({ result, deficitReel }) {
  if (result.status !== "ok") {
    return (
      <Card>
        <Label style={{ marginBottom: 6 }}>Dépense estimée</Label>
        <Body style={{ fontSize: 11, color: C.dim }}>
          Pas encore assez de données ({result.reason}). Il faut au moins {MIN_TDEE_DAYS} jours
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

/* ============================================================
   TAB — MACROS
   ============================================================ */
function MacroTab({ macros, targets, save, training, weight }) {
  const [date, setDate] = useState(today());
  const at = targetsForDate(date, targets);
  const cur = macros.find((m) => m.date === date) || {};
  // Sur l'app native, un jour sans entrée signifie "pas encore synchronisé", pas "cible
  // atteinte" — démarrer les compteurs à la cible y afficherait une journée à 100% qui n'a
  // pourtant aucune donnée réelle. Sur la PWA (saisie 100% manuelle), la cible reste un
  // point de départ pratique pour ne pas taper depuis zéro.
  const emptyMacro = (v) => (Capacitor.isNativePlatform() ? 0 : v);
  const [p, setP] = useState(cur.protein ?? emptyMacro(at.protein));
  const [c, setC] = useState(cur.carbs ?? emptyMacro(at.carbs));
  const [f, setF] = useState(cur.fat ?? emptyMacro(at.fat));
  const [fib, setFib] = useState(cur.fiber ?? emptyMacro(at.fiber));
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  const [forceManual, setForceManual] = useState(false);
  const water = cur.water ?? 0;
  const basketDay = training.some((t) => t.type === "Basket" && t.date === date);
  const waterTgt = targets.water + (basketDay ? 1000 : 0);
  // "foodlog" (bascule M6) : ce jour vient du journal de l'onglet Repas, comme
  // "healthconnect" venait de Health Connect — même traitement lecture seule.
  const fromFoodLog = cur.source === "foodlog";
  const isSynced = (cur.source === "healthconnect" || fromFoodLog) && !forceManual;
  const pickDate = (d) => {
    setDate(d);
    const atd = targetsForDate(d, targets);
    const e = macros.find((m) => m.date === d);
    setP(e?.protein ?? emptyMacro(atd.protein)); setC(e?.carbs ?? emptyMacro(atd.carbs));
    setF(e?.fat ?? emptyMacro(atd.fat)); setFib(e?.fiber ?? emptyMacro(atd.fiber));
    setForceManual(false);
  };
  // Vraie valeur mesurée (jour alimenté par foodLog) si elle existe, sinon estimation à
  // partir des macros affichées — jamais la resommer en 4/4/9 quand la vraie valeur est là,
  // pour que ce chiffre ne diverge jamais de celui de l'onglet Repas (05/08/2026).
  const kcal = cur.kcal ?? kcalFromMacros(p, c, f, fib);
  const saveMacros = () => save.macros(upsert(macros, { date, protein: round(p), carbs: round(c), fat: round(f), fiber: round(fib), water, source: "manual" }));
  const addWater = (ml) => {
    const next = Math.max(0, (macros.find((m) => m.date === date)?.water ?? 0) + ml);
    save.macros(upsert(macros, { date, water: next, source: "manual" }));
  };
  const kcalTrend = lastN(macros, 14).map((m) => ({
    date: fmt(m.date),
    kcal: Math.round(kcalOfEntry(m)),
  }));
  const kcalTarget = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));
  const kcalPct = Math.min(100, (kcal / kcalTarget) * 100);

  // Dépense énergétique adaptative (V7). Calculée à chaque montage de l'onglet — le journal
  // Repas et ses corrections vivent dans un autre onglet (un seul monté à la fois), donc un
  // remount suffit à rester à jour, sans mémoïsation ni dépendance fragile sur `foodLog`.
  // Toujours ancrée sur AUJOURD'HUI (l'estimation porte sur la dépense réelle actuelle),
  // jamais sur la date parcourue dans le sélecteur ci-dessous.
  const tdeeToday = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
  const atToday = targetsForDate(today(), targets);
  const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
  const deficitReel = tdeeToday.status === "ok" ? realDeficit(kcalTargetToday, tdeeToday.tdee) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Macros" subtitle={date === today() ? "aujourd'hui" : fmt(date)} />

      {/* Calories + Eau — héros côte à côte */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Card style={{ padding: 14 }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Calories</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "6px 0 8px" }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.text }}>{Math.round(kcal)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>/{kcalTarget}</span>
          </div>
          <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
            <div style={{ background: C.accent, width: `${kcalPct}%`, height: "100%" }} />
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Droplet size={12} color={C.accent} />
            <Label style={{ fontSize: 10 }}>Eau</Label>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "6px 0 8px" }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.text }}>{(water / 1000).toFixed(2)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>/{(waterTgt / 1000).toFixed(1)} L</span>
          </div>
          <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
            <div style={{ background: C.accent, width: `${Math.min(100, (water / waterTgt) * 100)}%`, height: "100%" }} />
          </div>
          {basketDay && <span style={{ display: "inline-block", fontSize: 8.5, color: "#000", background: C.accent, padding: "2px 5px", borderRadius: 4, fontWeight: 800, marginTop: 6 }}>+1 L BASKET</span>}
        </Card>
      </div>

      {/* Protéines / glucides / lipides / fibres */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[{ l: "Protéines", v: p, t: at.protein }, { l: "Glucides", v: c, t: at.carbs }, { l: "Lipides", v: f, t: at.fat }, { l: "Fibres", v: fib, t: at.fiber }].map((x) => (
          <div key={x.l} style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <Label>{x.l}</Label>
            <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: C.text, marginTop: 3 }}>{x.v}g</div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1, fontFamily: C.mono }}>/ {x.t}g</div>
          </div>
        ))}
      </div>

      {/* Tendance calories — remontée à la place de l'ancienne tuile Eau */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Calories · 14 jours</Label>
          <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>cible ~{kcalTarget} kcal</span>
        </div>
        {kcalTrend.length ? (
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kcalTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={kcalTarget} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1.5} />
                <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
                  {kcalTrend.map((d, i) => <Cell key={i} fill={Math.abs(d.kcal - kcalTarget) <= kcalTarget * 0.1 ? C.accent : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucune donnée.</Empty>}
      </Card>

      {/* Dépense énergétique adaptative (V7) */}
      <TdeeCard result={tdeeToday} deficitReel={deficitReel} />

      {/* Saisie */}
      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner
            label={fromFoodLog ? "Synchronisé depuis l'onglet Repas" : "Synchronisé depuis Health Connect"}
            onCorrect={fromFoodLog ? undefined : () => setForceManual(true)}
          />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Protéines (g)"><Stepper value={p} set={setP} step={5} int /></Field>
              <Field label="Glucides (g)"><Stepper value={c} set={setC} step={5} int /></Field>
              <Field label="Lipides (g)"><Stepper value={f} set={setF} step={5} int /></Field>
              <Field label="Fibres (g)"><Stepper value={fib} set={setFib} step={1} int /></Field>
            </div>
            <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Tracker les grammes de macros, pas le total kcal de l'app (décalage fibres).</Body>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="primary" onClick={saveMacros} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
              {macros.some((m) => m.date === date) && (
                <Btn variant="danger" onClick={() => { save.macros(macros.filter((m) => m.date !== date)); setP(emptyMacro(at.protein)); setC(emptyMacro(at.carbs)); setF(emptyMacro(at.fat)); setFib(emptyMacro(at.fiber)); }}>
                  <Trash2 size={14} />
                </Btn>
              )}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
              <Label style={{ marginBottom: 8 }}>Eau</Label>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="plain" onClick={() => addWater(250)} style={{ flex: 1 }}>+250 ml</Btn>
                <Btn variant="plain" onClick={() => addWater(500)} style={{ flex: 1 }}>+500 ml</Btn>
                <Btn variant="ghost" onClick={() => addWater(-250)}>−250</Btn>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Péri-training */}
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

      {/* Protocoles basket détaillés (avant/pendant/après selon l'horaire) */}
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

/* ============================================================
   RÉGLAGES
   ============================================================ */
function SettingsPanel({ apiKey, setApiKey, model, setModel, onClose, healthSync, onHealthSync,
                         coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, saveTargets, buildBriefing,
                         lastAutoBackup, lastCloudBackup, onCloudBackupDone, climbScheme, setClimbScheme, phase, setPhase }) {
  const [k, setK] = useState(apiKey);
  const [m, setM] = useState(model);
  const [msg, setMsg] = useState("");
  const [prof, setProf] = useState(coachProfile);
  const [jour, setJour] = useState(coachJournal);
  const [briefing, setBriefing] = useState("");   // rempli seulement si la copie auto échoue

  // navigator.clipboard existe dans la WebView Capacitor (origine sécurisée), mais peut
  // échouer selon le contexte : on affiche alors le texte pour une copie manuelle plutôt
  // que de laisser l'utilisateur devant un bouton qui n'a rien fait.
  const doBriefing = async () => {
    const txt = buildBriefing();
    try {
      await navigator.clipboard.writeText(txt);
      setBriefing("");
      setMsg("Contexte copié — colle-le dans une conversation Claude.");
    } catch {
      setBriefing(txt);
      setMsg("");
    }
  };
  const cut = targets.cut || {};
  // saveTargets (et non le setter brut) : il écrit AUSSI dans le localStorage. Passer
  // setTargets ici perdrait silencieusement les réglages au redémarrage.
  const setCut = (patch) => saveTargets({ ...targets, cut: { ...cut, ...patch } });
  const doExport = async () => {
    const json = JSON.stringify(exportData(), null, 2);
    const name = `protocole-${today()}.json`;
    // Le téléchargement via <a download> ne fonctionne pas dans la WebView native :
    // on écrit le fichier puis on ouvre le partage Android (Drive, mail, Fichiers…).
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
        // `Share.share` ne résout QUE si une destination a été choisie (annuler la feuille
        // rejette la promesse) : c'est le seul signal disponible côté app pour dire que la
        // sauvegarde est partie. On ne peut évidemment pas vérifier qu'elle est bien
        // arrivée sur Drive — on date une intention aboutie, pas une réception.
        await Share.share({ title: name, files: [uri] });
        onCloudBackupDone?.();
        setMsg("Sauvegarde envoyée — vérifie qu'elle est bien arrivée à destination.");
      } catch (e) {
        const txt = String(e?.message || e);
        setMsg(/cancel/i.test(txt) ? "Sauvegarde annulée — rien n'a été envoyé." : `Sauvegarde impossible : ${txt}`);
      }
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    // Sur la PWA le fichier atterrit dans les téléchargements de la machine qui affiche
    // l'app — donc hors du téléphone aussi, du point de vue du risque couvert.
    onCloudBackupDone?.();
  };
  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importData(JSON.parse(reader.result)); setMsg("Données importées. Rechargement…"); setTimeout(() => window.location.reload(), 800); }
      catch { setMsg("Fichier invalide."); }
    };
    reader.readAsText(file);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Réglages" right={<Btn variant="ghost" onClick={onClose}><X size={16} /></Btn>} />

      <Card>
        <Label style={{ marginBottom: 8 }}>Coach IA · clé API Anthropic</Label>
        <TextInput type="password" value={k} onChange={(e) => setK(e.target.value)} placeholder="sk-ant-..." style={{ marginBottom: 10 }} />
        <Label style={{ marginBottom: 6 }}>Modèle</Label>
        <TextInput value={m} onChange={(e) => setM(e.target.value)} placeholder="claude-sonnet-5" style={{ marginBottom: 12 }} />
        <Btn variant="primary" onClick={() => { setApiKey(k.trim()); setModel(m.trim() || "claude-sonnet-5"); setMsg("Réglages enregistrés."); }} style={{ width: "100%" }}>
          Enregistrer
        </Btn>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          Clé stockée uniquement sur cet appareil, envoyée directement à l'API Anthropic. Chaque analyse consomme des crédits.
        </Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Coach IA · contexte permanent</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Envoyé à chaque analyse comme une contrainte. C'est ici que vit ton objectif en cours —
          après tes vacances, remplace-le par le suivant.
        </Body>
        <textarea rows={10} value={prof} onChange={(e) => setProf(e.target.value)}
          onBlur={() => setCoachProfile(prof)}
          style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 11.5, fontWeight: 400, resize: "vertical", lineHeight: 1.45 }} />
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Coach IA · carnet de bord</Label>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>{(jour || "").length} car.</span>
        </div>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Écrit par le coach à la fin de chaque analyse : c'est sa mémoire d'une fois sur l'autre.
          Corrige-le s'il note une bêtise, vide-le pour repartir de zéro.
        </Body>
        {(jour || "").trim() ? (
          <>
            <textarea rows={8} value={jour} onChange={(e) => setJour(e.target.value)}
              onBlur={() => setCoachJournal(jour)}
              style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 11.5, fontWeight: 400, resize: "vertical", lineHeight: 1.45 }} />
            <Btn variant="danger" onClick={() => { setJour(""); setCoachJournal(""); }} style={{ marginTop: 8, width: "100%" }}>
              Vider le carnet
            </Btn>
          </>
        ) : (
          <Body style={{ fontSize: 11, color: C.muted }}>Vide — il se remplira à ta prochaine analyse.</Body>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Système de cotation escalade</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          "Couleur de salle" reste la valeur par défaut. Changer de système n'efface rien :
          les blocs déjà enregistrés dans l'ancien système restent comptés dans le volume de
          la séance, juste hors échelle pour le classement par niveau.
        </Body>
        <Pills options={[{ key: "gym", label: "Couleur de salle" }, { key: "fontainebleau", label: "Fontainebleau" }]}
          value={climbScheme} onChange={setClimbScheme} />
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 11 }}>{PHASES[phase].msg}</Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cibles macro de base</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Cibles quotidiennes hors fenêtre d'objectif temporaire (ci-dessous). S'appliquent
          partout dans l'app dès que la fenêtre est inactive ou hors période.
        </Body>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field label="Protéines (g)"><Stepper value={targets.protein ?? 0} set={(v) => saveTargets({ ...targets, protein: v })} step={5} min={0} int /></Field>
          <Field label="Glucides (g)"><Stepper value={targets.carbs ?? 0} set={(v) => saveTargets({ ...targets, carbs: v })} step={5} min={0} int /></Field>
          <Field label="Lipides (g)"><Stepper value={targets.fat ?? 0} set={(v) => saveTargets({ ...targets, fat: v })} step={5} min={0} int /></Field>
          <Field label="Fibres (g)"><Stepper value={targets.fiber ?? 0} set={(v) => saveTargets({ ...targets, fiber: v })} step={1} min={0} int /></Field>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: -2, marginBottom: 8, fontFamily: C.mono }}>
          ≈ {Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber))} kcal
        </Body>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Poids cible par phase — pilote la tuile Poids et le sous-titre de l'onglet Poids
          selon la phase active ci-dessus.
        </Body>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Sèche (kg)">
            <Stepper value={targets.weightCutTarget ?? PHASES.seche.target} set={(v) => saveTargets({ ...targets, weightCutTarget: v })} step={0.5} min={0} />
          </Field>
          <Field label="Maintenance (kg)">
            <Stepper value={targets.weightMaintenance ?? 96} set={(v) => saveTargets({ ...targets, weightMaintenance: v })} step={0.5} min={0} />
          </Field>
          <Field label="Prise (kg)">
            <Stepper value={targets.weightBulkTarget ?? PHASES.prise.target} set={(v) => saveTargets({ ...targets, weightBulkTarget: v })} step={0.5} min={0} />
          </Field>
        </div>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cible eau de base</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Cible quotidienne hors basket. +1 L automatique les jours où une séance Basket est loggée.
        </Body>
        <Field label="Eau (mL)"><Stepper value={targets.water ?? 0} set={(v) => saveTargets({ ...targets, water: v })} step={100} min={0} int /></Field>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Objectif temporaire · cibles macros</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Sur cette période, ces cibles remplacent les cibles de base partout dans l'app. En dehors,
          tout revient automatiquement à la normale.
        </Body>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Pills options={[{ key: true, label: "Actif" }, { key: false, label: "Inactif" }]}
            value={cut.enabled !== false} onChange={(v) => setCut({ enabled: v })} small />
          {isCutWindow(today(), targets)
            ? <span style={{ fontSize: 10.5, color: C.accent, fontFamily: C.mono }}>en cours</span>
            : <span style={{ fontSize: 10.5, color: C.dim, fontFamily: C.mono }}>hors période</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field label="Début"><input type="date" value={cut.start || ""} onChange={(e) => setCut({ start: e.target.value })} style={inputStyle(false)} /></Field>
          <Field label="Fin"><input type="date" value={cut.end || ""} onChange={(e) => setCut({ end: e.target.value })} style={inputStyle(false)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Protéines (g)"><Stepper value={cut.protein ?? 0} set={(v) => setCut({ protein: v })} step={5} min={0} int /></Field>
          <Field label="Glucides (g)"><Stepper value={cut.carbs ?? 0} set={(v) => setCut({ carbs: v })} step={5} min={0} int /></Field>
          <Field label="Lipides (g)"><Stepper value={cut.fat ?? 0} set={(v) => setCut({ fat: v })} step={5} min={0} int /></Field>
          <Field label="Fibres (g)"><Stepper value={cut.fiber ?? 0} set={(v) => setCut({ fiber: v })} step={1} min={0} int /></Field>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: C.mono }}>
          ≈ {Math.round(kcalFromMacros(cut.protein, cut.carbs, cut.fat, cut.fiber))} kcal
        </Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Revue de fond dans claude.ai</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Copie tout ton contexte (profil, carnet, 14 jours de données, séries brutes) pour le coller
          dans une conversation Claude. Plus complet que l'analyse de l'app, et sans consommer de crédits API.
        </Body>
        <Btn variant="outline" onClick={doBriefing} style={{ width: "100%" }}>
          <Copy size={14} style={{ display: "inline", marginRight: 4 }} />Copier le contexte
        </Btn>
        {briefing && (
          <>
            <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
              Copie automatique refusée par le système : sélectionne tout le texte ci-dessous et copie-le à la main.
            </Body>
            <textarea rows={6} readOnly value={briefing}
              style={{ ...inputStyle(false), fontFamily: C.mono, fontSize: 9.5, fontWeight: 400, resize: "vertical", marginTop: 6 }} />
          </>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Sauvegarde des données</Label>
        {/* Bandeau d'alerte : c'est lui, pas le bouton, qui fait que la sauvegarde a lieu. */}
        {isBackupStale(lastCloudBackup) && (
          <div style={{
            background: C.dangerBg, border: `1.5px solid ${C.danger}`, borderRadius: 8,
            padding: "9px 11px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, color: C.danger, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ⚠ Sauvegarde hors du téléphone
            </div>
            <Body style={{ color: C.dangerText, fontSize: 11, marginTop: 3 }}>
              {lastCloudBackup
                ? `Dernière il y a ${daysSinceBackup(lastCloudBackup)} jours (${fmt(lastCloudBackup)}).`
                : "Jamais faite."} Perdre ou casser le téléphone effacerait tout l'historique.
            </Body>
          </div>
        )}
        <Btn variant="primary" onClick={doExport} style={{ width: "100%" }}>
          <Download size={14} style={{ display: "inline", marginRight: 4 }} />Sauvegarder hors du téléphone
        </Btn>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          {Capacitor.isNativePlatform()
            ? "Ouvre le partage Android : envoie le fichier vers Drive, un mail ou Fichiers. Rappel automatique au bout d'une semaine sans sauvegarde."
            : "Télécharge le fichier JSON complet. Vider les données du navigateur effacerait l'app."}
          {lastCloudBackup && !isBackupStale(lastCloudBackup) ? ` Dernière : ${fmt(lastCloudBackup)}.` : ""}
        </Body>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
          <label>
            <span style={{
              display: "block", textAlign: "center", background: C.card, color: C.accent,
              border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: "9px 12px",
              fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
            }}><Upload size={14} style={{ display: "inline", marginRight: 4 }} />Restaurer un fichier</span>
            <input type="file" accept="application/json" onChange={doImport} style={{ display: "none" }} />
          </label>
        </div>
        {Capacitor.isNativePlatform() && (
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
            Sauvegarde auto locale (dossier Documents/Protocole) : {lastAutoBackup ? `dernière le ${fmt(lastAutoBackup)}` : "pas encore faite"}.
            Ne remplace pas celle ci-dessus : elle reste sur le téléphone, donc elle disparaît avec lui.
          </Body>
        )}
      </Card>

      {Capacitor.isNativePlatform() && (
        <Card>
          <Label style={{ marginBottom: 8 }}>Health Connect · pas, sommeil & macros</Label>
          <Body style={{ fontSize: 12, color: C.text2, marginBottom: 10 }}>
            {healthSync.status === "running" && "Synchronisation en cours…"}
            {healthSync.status === "ok" && `À jour · dernière synchro ${new Date(healthSync.at).toLocaleTimeString("fr-FR")}`}
            {healthSync.status === "unavailable" && "Health Connect indisponible sur cet appareil."}
            {healthSync.status === "denied" && "Accès refusé — autorise pas, sommeil, nutrition et hydratation dans Health Connect."}
            {healthSync.status === "error" && `Erreur : ${healthSync.message}`}
            {healthSync.status === "idle" && "Pas encore synchronisé."}
          </Body>
          <Btn variant="outline" onClick={onHealthSync} style={{ width: "100%" }} disabled={healthSync.status === "running"}>
            Synchroniser maintenant
          </Btn>
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
            Synchronise automatiquement au lancement et à chaque retour au premier plan. Écrase toujours la valeur locale du jour concerné.
          </Body>
        </Card>
      )}

      {msg && <Body style={{ color: C.accent, fontSize: 12 }}>{msg}</Body>}
      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", fontFamily: C.mono }}>Protocole v{APP_VERSION}</Body>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

export default function App({ silent = false } = {}) {
  const [tab, setTab] = useState("dash");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  const [weight, setWeight] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [training, setTraining] = useState([]);
  const [knee, setKnee] = useState([]);
  const [elbow, setElbow] = useState([]);
  const [macros, setMacros] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [phase, setPhaseState] = useState("seche");
  const [hsrWeek, setHsrWeekState] = useState(1);
  const [climbScheme, setClimbSchemeState] = useState("gym");
  const [apiKey, setApiKeyState] = useState("");
  const [model, setModelState] = useState("claude-sonnet-5");
  const [coachProfile, setCoachProfileState] = useState("");
  const [coachJournal, setCoachJournalState] = useState("");
  const [lastAutoBackup, setLastAutoBackup] = useState(null);
  const [lastCloudBackup, setLastCloudBackup] = useState(null);

  useEffect(() => {
    (async () => {
      setWeight(await store.get("weightLog", []));
      setSleep(await store.get("sleepLog", []));
      setTraining(await store.get("trainingLog", []));
      setKnee(await store.get("kneeLog", []));
      setElbow(await store.get("elbowLog", []));
      setMacros(await store.get("macroLog", []));
      setSteps(await store.get("stepsLog", []));
      setNotes(await store.get("noteLog", []));
      // Fusion avec les défauts : un `targets` déjà stocké (sans le sous-objet `cut`, qui
      // n'existait pas avant le 30/07/2026) écraserait sinon entièrement les défauts et
      // laisserait `cut` absent. La fusion comble les champs manquants sans toucher aux
      // valeurs que l'utilisateur a réglées, et couvrira aussi les champs futurs.
      const storedTargets = await store.get("targets", {});
      setTargets({ ...DEFAULT_TARGETS, ...storedTargets, cut: { ...DEFAULT_TARGETS.cut, ...(storedTargets.cut || {}) } });
      setPhaseState(await store.get("phase", "seche"));
      setHsrWeekState(await store.get("hsrWeek", 1));
      setClimbSchemeState(await store.get("climbScheme", "gym"));
      setApiKeyState(await store.get("apiKey", ""));
      setModelState(await store.get("model", "claude-sonnet-5"));
      // Profil : amorcé une seule fois avec les règles auparavant codées en dur, pour que
      // rien ne soit perdu au passage. `null` = jamais initialisé ; une chaîne vide est un
      // choix délibéré de l'utilisateur et n'est donc jamais réamorcée.
      const storedProfile = await store.get("coachProfile", null);
      if (storedProfile == null) {
        setCoachProfileState(SEED_COACH_PROFILE);
        store.set("coachProfile", SEED_COACH_PROFILE);
      } else {
        setCoachProfileState(storedProfile);
      }
      setCoachJournalState(await store.get("coachJournal", ""));
      setLastAutoBackup(await store.get("lastAutoBackupDate", null));
      // Hors de DATA_KEYS volontairement (voir cloudBackup.js) : restaurer une vieille
      // sauvegarde ne doit pas faire croire à l'app qu'elle vient d'être sauvegardée.
      setLastCloudBackup(await store.get("lastCloudBackup", null));
      setLoading(false);
    })();
  }, []);

  // Synchro Health Connect (app native uniquement, no-op sur la PWA) — pas + sommeil,
  // 14 derniers jours, écrase toujours la valeur locale du jour concerné.
  const [healthSync, setHealthSync] = useState({ status: "idle", at: null });
  const runHealthSync = async () => {
    setHealthSync((s) => ({ ...s, status: "running" }));
    const result = await syncHealthConnect();
    if (result.status !== "ok") {
      setHealthSync({ status: result.status, message: result.message || result.reason, at: new Date().toISOString() });
      return;
    }
    if (Object.keys(result.stepsByDate).length) {
      setSteps((prev) => {
        let next = prev;
        Object.entries(result.stepsByDate).forEach(([date, count]) => { next = upsert(next, { date, count, source: "healthconnect" }); });
        store.set("stepsLog", next);
        return next;
      });
    }
    if (Object.keys(result.sleepByDate).length) {
      setSleep((prev) => {
        let next = prev;
        // quality n'est présent que les nuits où Health Connect a le détail par phase
        // (voir HealthNutritionPlugin.readSleep) — absent, on ne touche pas à une note
        // saisie à la main pour ce jour-là.
        Object.entries(result.sleepByDate).forEach(([date, d]) => {
          next = upsert(next, { date, hours: round(d.hours, 2), ...(d.quality != null ? { quality: d.quality } : {}), source: "healthconnect" });
        });
        store.set("sleepLog", next);
        return next;
      });
    }
    // Nutrition/eau : plus lues depuis Health Connect (bascule M6, 02/08/2026) — foodLog
    // est l'unique écrivain de macroLog désormais, voir la dérivation dans NutritionTab.jsx.
    if (Object.keys(result.weightByDate || {}).length) {
      setWeight((prev) => {
        let next = prev;
        Object.entries(result.weightByDate).forEach(([date, kg]) => { next = upsert(next, { date, kg, source: "healthconnect" }); });
        store.set("weightLog", next);
        return next;
      });
    }
    setHealthSync({ status: "ok", at: new Date().toISOString() });
  };

  useEffect(() => {
    if (loading) return;
    (async () => {
      await runHealthSync();
      // Lancé par le bouton Sync du widget (activité invisible, voir SilentSyncActivity.kt) :
      // laisser React committer les setState de runHealthSync (donc l'effet qui pousse
      // l'instantané au widget, plus bas) avant de refermer l'activité.
      if (await isSilentSync()) {
        setTimeout(finishSilentSync, 150);
      }
    })();
  }, [loading]);

  // Sauvegarde locale auto (une fois par jour, voir autoBackup.js) : un ref pour lire la
  // dernière date à jour depuis le listener "resume" (monté une seule fois, sinon il
  // resterait bloqué sur la valeur de `lastAutoBackup` au premier rendu).
  const lastAutoBackupRef = useRef(lastAutoBackup);
  useEffect(() => { lastAutoBackupRef.current = lastAutoBackup; }, [lastAutoBackup]);
  const doAutoBackup = () => {
    runAutoBackup(lastAutoBackupRef.current, (date) => {
      lastAutoBackupRef.current = date;
      setLastAutoBackup(date);
      store.set("lastAutoBackupDate", date);
    });
  };
  useEffect(() => {
    if (loading) return;
    doAutoBackup();
  }, [loading]);

  // Rappel de sauvegarde externe : reprogrammé au démarrage ET après chaque sauvegarde
  // (la date change ⇒ l'échéance recule). Sans la dépendance à `lastCloudBackup`, un export
  // fait aujourd'hui laisserait le rappel de la semaine dernière sonner quand même.
  useEffect(() => {
    if (loading) return;
    scheduleBackupReminder(lastCloudBackup);
  }, [loading, lastCloudBackup]);
  const markCloudBackup = () => {
    const d = today();
    setLastCloudBackup(d);
    store.set("lastCloudBackup", d);
  };

  // Resynchro à chaque retour au premier plan (pas seulement au lancement à froid)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener("resume", () => { runHealthSync(); doAutoBackup(); });
    return () => { handle.then((h) => h.remove()); };
  }, []);

  // Widget d'écran d'accueil (Android) : 5 valeurs des tuiles du tableau de bord
  // (Poids, Calories, Sommeil, Pas, Eau), reformatées pour l'affichage natif — la 6e
  // tuile du widget est un bouton Sync, pas une donnée (voir widgetSync.js /
  // DashboardWidgetProvider.kt).
  useEffect(() => {
    if (loading || !Capacitor.isNativePlatform()) return;
    const wLast = lastN(weight, 1)[0];
    const lastNightDash = lastN(sleep, 1)[0];
    const mToday = macros.find((m) => m.date === today());
    const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;
    const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
    const waterToday = mToday?.water ?? 0;
    const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
    const waterTgt = targets.water + (basketToday ? 1000 : 0);
    const at = targetsForDate(today(), targets);
    const kcalTgt = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));

    updateDashboardWidget({
      poids: { value: wLast ? `${wLast.kg} kg` : "—", note: wLast ? fmt(wLast.date) : "—" },
      pas: { value: stepsToday.toLocaleString("fr-FR"), note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}` },
      calories: { value: kcalToday != null ? `${kcalToday}` : "—", note: `/ ${kcalTgt} kcal` },
      eau: { value: `${(waterToday / 1000).toFixed(2)} L`, note: `/ ${(waterTgt / 1000).toFixed(1)} L` },
      sommeil: {
        value: lastNightDash ? fmtHM(lastNightDash.hours) : "—",
        note: lastNightDash?.quality != null ? "★".repeat(lastNightDash.quality) : "—",
      },
      // Pas de "value" affichée pour ce tile (juste l'icône Sync) — seule la note sert,
      // horodatage du dernier instantané poussé au widget (peu importe si déclenché par
      // l'ouverture normale de l'app ou par le bouton Sync lui-même).
      // "À jour · dernière synchro : HH:MM:SS" tient sur 4 lignes et écrase l'icône dans
      // une tuile aussi étroite — condensé pour rester sur une ligne comme les autres notes.
      sync: { value: "", note: `MAJ ${new Date().toLocaleTimeString("fr-FR")}` },
    });
  }, [loading, weight, sleep, macros, steps, training, targets]);

  const save = {
    weight: (v) => { setWeight(v); store.set("weightLog", v); },
    sleep: (v) => { setSleep(v); store.set("sleepLog", v); },
    training: (v) => { setTraining(v); store.set("trainingLog", v); },
    knee: (v) => { setKnee(v); store.set("kneeLog", v); },
    elbow: (v) => { setElbow(v); store.set("elbowLog", v); },
    macros: (v) => { setMacros(v); store.set("macroLog", v); },
    steps: (v) => { setSteps(v); store.set("stepsLog", v); },
    notes: (v) => { setNotes(v); store.set("noteLog", v); },
    targets: (v) => { setTargets(v); store.set("targets", v); },
  };
  const setPhase = (v) => { setPhaseState(v); store.set("phase", v); };
  const setHsrWeek = (v) => { setHsrWeekState(v); store.set("hsrWeek", v); };
  const setClimbScheme = (v) => { setClimbSchemeState(v); store.set("climbScheme", v); };
  // Objet schéma dérivé, recalculé seulement quand le réglage change — passé partout où
  // packages/core/src/climbing.js est consommé (BlocsField, historique, recommandeur, Coach
  // IA). Repli sur "gym" si une valeur invalide traînait dans le stockage.
  const scheme = SCHEMES[climbScheme] || SCHEMES.gym;
  const setApiKey = (v) => { setApiKeyState(v); store.set("apiKey", v); };
  const setModel = (v) => { setModelState(v); store.set("model", v); };
  const setCoachProfile = (v) => { setCoachProfileState(v); store.set("coachProfile", v); };
  const setCoachJournal = (v) => { setCoachJournalState(v); store.set("coachJournal", v); };

  const todayNote = notes.find((n) => n.date === today())?.text || "";
  const saveNote = (text) => {
    const t = (text || "").trim();
    const rest = notes.filter((n) => n.date !== today());
    save.notes(t ? [...rest, { date: today(), text: t }].sort(byDate) : rest);
  };
  // Écrit par le modèle en fin d'analyse (voir splitCarnet), relisible et corrigeable dans
  // les Réglages : c'est la mémoire du coach, elle ne doit pas être une boîte noire.
  const saveJournal = (text) => setCoachJournal((text || "").trim());

  // Assemble le "sac de données" pour @rawcare/core/coach/prompt. `foodLog`/`foodOverrides`
  // sont lus fraîchement (getSync, jamais mis en cache) au moment précis de l'appel — un
  // repas ajouté dans l'onglet Repas pendant la session en cours doit être vu immédiatement.
  const coach = {
    buildPrompt: (note, { profile = coachProfile, journal = coachJournal } = {}) =>
      buildCoachPrompt({
        weight, sleep, training, knee, elbow, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile, journal, scheme,
      }, note),
    buildBriefing: () =>
      buildCoachBriefing({
        weight, sleep, training, knee, elbow, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile: coachProfile, journal: coachJournal, scheme,
      }),
    apiKey, model,
  };

  const NAV = [
    { key: "dash", label: "Bord", icon: LayoutDashboard },
    { key: "weight", label: "Poids", icon: Scale },
    { key: "sleep", label: "Sommeil", icon: Moon },
    { key: "steps", label: "Pas", icon: Footprints },
    { key: "train", label: "Séances", icon: Dumbbell },
    { key: "pain", label: "Douleurs", icon: HeartPulse },
    { key: "macro", label: "Macros", icon: Utensils },
    { key: "food", label: "Repas", icon: Apple },
  ];

  // Lancé par le bouton Sync du widget (SilentSyncActivity, voir main.jsx) : tous les
  // effets ci-dessus (chargement, runHealthSync, mise à jour du widget) tournent
  // normalement, mais rien ne doit jamais s'afficher à l'écran.
  if (silent) return null;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: C.bg, color: C.text,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* En-tête */}
      <header style={{
        flexShrink: 0, padding: "14px 16px 12px",
        paddingTop: "calc(14px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
        borderBottom: `1.5px solid ${C.divider}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, letterSpacing: 3, color: C.accent }}>Protocole</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{longDate(today())}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10, color: "#000", background: C.accent, padding: "4px 9px",
            borderRadius: 5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1,
          }}>{PHASES[phase].label}</span>
          <button onClick={() => setShowSettings((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: showSettings ? C.accent : C.dim, padding: 0 }}>
            <Settings size={19} />
          </button>
        </div>
      </header>

      {/* Contenu */}
      <main style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        {loading ? <Empty>Chargement…</Empty> : showSettings ? (
          <SettingsPanel {...{ apiKey, setApiKey, model, setModel, healthSync, coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, lastAutoBackup, lastCloudBackup, climbScheme, setClimbScheme, phase, setPhase }} onCloudBackupDone={markCloudBackup} saveTargets={save.targets} buildBriefing={coach.buildBriefing} onHealthSync={runHealthSync} onClose={() => setShowSettings(false)} />
        ) : (
          <>
            {tab === "dash" && <Dashboard {...{ weight, sleep, knee, elbow, macros, steps, targets, training, phase, coach, todayNote, saveNote, saveJournal, setTab, lastCloudBackup, scheme }} openSettings={() => setShowSettings(true)} />}
            {tab === "weight" && <WeightTab {...{ weight, targets, save, phase }} />}
            {tab === "sleep" && <SleepTab {...{ sleep, save }} />}
            {tab === "steps" && <StepsTab {...{ steps, save }} />}
            {tab === "train" && <TrainTab {...{ training, save, hsrWeek, setHsrWeek, knee, elbow, scheme }} />}
            {tab === "pain" && <PainTab {...{ knee, elbow, save, hsrWeek }} />}
            {tab === "macro" && <MacroTab {...{ macros, targets, save, training, weight }} />}
            {tab === "food" && <NutritionTab targetsFor={(d) => targetsForDate(d, targets)} macros={macros} save={save} training={training} apiKey={apiKey} model={model} />}
          </>
        )}
      </main>

      {/* Navigation */}
      <nav style={{
        flexShrink: 0, display: "flex", justifyContent: "space-around",
        padding: "9px 4px 12px", paddingBottom: "calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
        borderTop: `1.5px solid ${C.divider}`, background: C.bg,
      }}>
        {NAV.map(({ key, label, icon: Icon }) => {
          const on = tab === key && !showSettings;
          return (
            <button key={key} onClick={() => { setTab(key); setShowSettings(false); }} style={{
              // 8 onglets depuis l'ajout de « Repas » : le padding horizontal passe de 6 à 3
              // pour que les libellés les plus longs (« Sommeil », « Séances ») tiennent
              // encore sur une ligne à 360 px de large.
              background: "none", border: "none", cursor: "pointer", padding: "2px 3px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: on ? C.accent : C.dim, fontFamily: "inherit",
            }}>
              <Icon size={19} />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
