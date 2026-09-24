import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import {
  LayoutDashboard, Scale, Moon, Dumbbell, HeartPulse, Flame, TrendingUp, Footprints,
  Plus, AlertTriangle, CheckCircle2, Circle, Sparkles, Trash2,
  Play, Pause, RotateCcw, Timer, Droplet,
  ChevronRight, ChevronDown, Zap, Settings, Download, Upload, X, Copy, Repeat,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { store, getSync, exportData, importData } from "./store.js";
import { isBackupStale, daysSinceBackup, scheduleBackupReminder } from "./cloudBackup.js";
import { exoProgress, exerciseList, exerciseSessions, exerciseTrend, isTimeMode, setLabel,
         beats, recordToBeat, recordsBySession, painOutOfBase, progressiveOverloadSuggestion } from "@rawcare/core/training";
import { SCHEMES, gradeIndex, ISSUES, climbSummary, climbLabel } from "@rawcare/core/climbing";
import { realDeficit, MIN_WINDOW_DAYS as MIN_TDEE_DAYS, tdeeTrend, tdeeOverWindow } from "@rawcare/core/tdee";
import { TEMPLATES, TYPES, DEFAULT_WEIGHTS, HSR_TABLE, hsrForWeek, hsrParse, parseSecs,
         PERI, BASKET_PROTOCOLS } from "@rawcare/core/session/templates";
import { refSet, lastPerf, perfHistory, lastExerciseSets, medianTarget } from "@rawcare/core/session/perf";
import { EXERCISE_LIBRARY } from "@rawcare/core/session/exercises";
import { recommendSessions } from "@rawcare/core/recommender";
import { computeEnergyScore, computeSleepScore, scoreLabel } from "@rawcare/core/energy";
import { computeFreeInsights } from "@rawcare/core/insights";
import { computeBilanFacts } from "@rawcare/core/bilan";
import { PHASES, phaseTarget as phaseTargetCore, DEFAULT_TARGETS, targetsForDate,
         kcalFromMacros, kcalOfEntry, tdeeNow, weeklyKcalTrend, buildKcalByDate } from "@rawcare/core/targets";
import { buildCoachPrompt, buildCoachBriefing, buildBilanPrompt, splitCarnet, SEED_COACH_PROFILE } from "@rawcare/core/coach/prompt";
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

const APP_VERSION = "3.84.0";

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
  // Point 4 du chantier IA (07/09/2026) : quel type de dernière analyse est affiché — "jour"
  // (habituelle, 14j + carnet de bord) ou "bilan" (approfondie, 90j, pas de carnet).
  const [kind, setKind] = useState("jour");

  const run = async (which = "jour") => {
    if (!coach.apiKey) {
      setErr("Ajoute ta clé API Anthropic dans Réglages pour activer l'analyse.");
      setState("error"); return;
    }
    if (which === "jour") saveNote(note);
    setState("loading"); setErr(""); setProgress(""); setMeta(null); setKind(which);
    try {
      const { system, user } = which === "bilan" ? coach.buildBilan() : coach.buildPrompt(note);
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
        // de Sonnet 4.6 en « high » pour une fraction du coût. Le bilan (moins de données en
        // entrée, mais 600 mots demandés au lieu de 500) garde une marge un peu plus large.
        effort: "medium",
        maxTokens: which === "bilan" ? 8000 : 6000,
        onRetry: setProgress,
      });
      setProgress("");
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      // Le bilan n'a pas de carnet de bord (ce n'est pas l'analyse quotidienne, voir
      // buildBilanPrompt) : `splitCarnet` ne s'applique qu'à "jour".
      let out = raw, journal = null;
      if (which === "jour") ({ advice: out, journal } = splitCarnet(raw));
      if (journal) saveJournal(journal);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} color={C.accent} />
          <Label style={{ fontSize: 10 }}>Coach IA</Label>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="outline" onClick={() => run("jour")} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 11 }}>
            {state === "loading" && kind === "jour" ? "Analyse…" : "Analyser"}
          </Btn>
          <Btn variant="outline" onClick={() => run("bilan")} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 11 }}>
            {state === "loading" && kind === "bilan" ? "Analyse…" : "Bilan 3 mois"}
          </Btn>
        </div>
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
      {state === "done" && kind === "bilan" && <Label style={{ marginBottom: 6 }}>Bilan — 90 derniers jours</Label>}
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
      {state === "idle" && <Body style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>« Analyser » : tes 14 derniers jours (poids, macros, eau, séances, sommeil, douleur genou), au jour le jour et sur la semaine glissante. « Bilan 3 mois » : corrélations calculées sur 90 jours (records, sommeil vs énergie, escalade vs genou, fibres vs stagnation, sèche). Nécessite ta clé API (Réglages).</Body>}
    </Card>
  );
}

/* ============================================================
   TAB — DASHBOARD
   ============================================================ */
function Dashboard({ weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, coach, todayNote, saveNote, saveJournal, setTab, lastCloudBackup, openSettings, scheme, basketSchedule, weeklyPlan, matchWeek }) {
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(weight, 1)[0];
  const wDelta = wLast ? round(wLast.kg - tgtW) : null;

  const lastNightDash = lastN(sleep, 1)[0];
  const energy = useMemo(() => computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }), [rhr, sleep, steps, naps]);

  const mToday = macros.find((m) => m.date === today());
  const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;

  const { suggestions, avoid } = useMemo(() => recommendSessions({ training, knee, sleep, targets, scheme, basketSchedule, weeklyPlan, energy, matchWeek }), [training, knee, sleep, targets, scheme, basketSchedule, weeklyPlan, energy, matchWeek]);

  const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
  const waterTgt = targets.water + (basketToday ? 1000 : 0);
  const kcalTgt = (() => { const a = targetsForDate(today(), targets); return Math.round(kcalFromMacros(a.protein, a.carbs, a.fat, a.fiber)); })();

  // Constats gratuits (07/09/2026, point 1 du chantier IA) : réutilise le même calcul TDEE
  // que la carte Macros (lecture fraîche de foodLog/overrides via getSync, jamais mise en
  // cache) pour ne jamais afficher un chiffre différent de celui de l'onglet Macro.
  const tdeeForInsights = useMemo(
    () => tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets }),
    [macros, weight, targets]
  );
  const insights = useMemo(
    () => computeFreeInsights({ training, weight, macros, sleep, rhr, steps, knee, targets, tdeeResult: tdeeForInsights, kcalTargetToday: kcalTgt, todayDate: today() }),
    [training, weight, macros, sleep, rhr, steps, knee, targets, tdeeForInsights, kcalTgt]
  );

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
    // Remplace la tuile "Douleurs" (05/09/2026, demande explicite de Yoann — le coude est
    // retiré, le genou reste suivi mais n'a plus besoin de sa propre tuile ici). Score
    // d'énergie façon Samsung Health, reconstruit depuis FC repos/sommeil/pas — "pas assez
    // de données" tant que la FC repos n'a jamais été synchronisée (natif uniquement).
    { label: "Score d'énergie", tab: "sleep", val: energy.status === "ok" ? energy.total : "—", unit: energy.status === "ok" ? "/100" : "",
      note: energy.status === "ok" ? "aujourd'hui" : "pas assez de données", color: C.text,
      bar: energy.status === "ok" ? energy.total : null },
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
        {!knee.some((k) => k.date === today()) && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 }}>
            <AlertTriangle size={12} color="#e8a33d" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: "#e8a33d", lineHeight: 1.4 }}>Douleur genou pas notée aujourd'hui — le recommandeur reste prudent par défaut sans cette info.</span>
          </div>
        )}
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

      {/* Constats gratuits */}
      <InsightsCard insights={insights} />

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
// Couleur par palier de score (0-100) — mêmes seuils que ceux donnés par Yoann pour le
// score de sommeil (85+ excellent, 75-84 bon, 60-74 correct, <60 risque), réutilisés tels
// quels pour le score d'énergie (même échelle, même lecture).
function scoreColor(v) {
  if (v == null) return C.muted;
  if (v >= 75) return C.accent;
  if (v >= 60) return "#e8a33d";
  return C.danger;
}

/** Carte "Score d'énergie" (05/09/2026) — reconstruction façon Samsung Health depuis FC
 * repos/sommeil/pas (Health Connect, natif seulement). Détail des 4 modules toujours
 * affiché, même si le total est indisponible : voir quel module manque plutôt qu'un simple
 * "pas assez de données" muet. */
function EnergyScoreCard({ energy }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Score d'énergie</Label>
        {energy.status === "ok" && (
          <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 800, color: scoreColor(energy.total) }}>{energy.total}<span style={{ fontSize: 12, color: C.muted }}>/100</span></span>
        )}
      </div>
      {energy.status !== "ok" && (
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Pas assez de données pour un score complet — détail des modules ci-dessous.
        </Body>
      )}
      {energy.modules.map((m) => (
        <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.divider}` }}>
          <div>
            <div style={{ fontSize: 11, color: C.text2 }}>{m.label}</div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1 }}>{m.reason}</div>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: m.points == null ? C.dim : C.text, flexShrink: 0, marginLeft: 8 }}>
            {m.points == null ? "—" : m.points}<span style={{ fontSize: 10, color: C.muted }}>/{m.max}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Carte "Constats" (07/09/2026, point 1 du chantier IA) : aucun appel API, tout est calculé
 * en JS pur à partir de données déjà en mémoire (records V4, TDEE V7, score d'énergie...).
 * Chaque ligne n'apparaît que si le constat correspondant a assez de données ; la carte
 * entière disparaît s'il n'y en a aucune (rien à montrer plutôt qu'une carte vide). */
function InsightsCard({ insights }) {
  const rows = [];
  if (insights.streaks.training > 0) {
    rows.push({ label: "Streak entraînement", value: `${insights.streaks.training} j`, note: "jours d'affilée entraînés" });
  }
  if (insights.streaks.logging > 0) {
    rows.push({ label: "Streak apports loggés", value: `${insights.streaks.logging} j`, note: "jours d'affilée avec macros loggées" });
  }
  if (insights.records) {
    const r = insights.records;
    rows.push({ label: "Records récents", value: `${r.count}`, note: `sur ${r.sessions} séance${r.sessions > 1 ? "s" : ""} · ${r.windowDays} derniers jours` });
  }
  if (insights.weightTdee) {
    const w = insights.weightTdee;
    rows.push({
      label: "Déficit réel", value: `${w.deficit > 0 ? "+" : ""}${w.deficit} kcal/j`,
      note: `${w.deltaKg > 0 ? "+" : ""}${w.deltaKg} kg sur ${w.days} j · fiabilité ${w.reliability}`,
    });
  }
  if (insights.cutProjection) {
    const p = insights.cutProjection;
    rows.push({ label: "Projection fin de sèche", value: `${p.projectedKg} kg`, note: `au ${fmt(p.endDate)} (dans ${p.daysLeft} j)` });
  }
  if (insights.neglected) {
    const n = insights.neglected;
    rows.push({ label: "Type délaissé", value: n.type, note: n.daysSince == null ? "jamais loggé" : `pas fait depuis ${n.daysSince} j` });
  }
  if (insights.cutAdherence) {
    const a = insights.cutAdherence;
    rows.push({ label: "Régularité de la sèche", value: `${a.pct}%`, note: `des jours dans la cible (${a.loggedDays} jours loggés)` });
  }
  if (insights.sleepEnergy) {
    const s = insights.sleepEnergy;
    rows.push({ label: "Sommeil vs énergie", value: `${s.goodAvg} vs ${s.poorAvg}`, note: `score moyen après bonne nuit vs mauvaise (n=${s.goodN}/${s.poorN})` });
  }

  if (!rows.length) return null;

  return (
    <Card style={{ padding: 16 }}>
      <Label style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>Constats</Label>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${C.divider}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.text2 }}>{r.label}</div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1 }}>{r.note}</div>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.text, flexShrink: 0, marginLeft: 8, textAlign: "right" }}>{r.value}</div>
        </div>
      ))}
    </Card>
  );
}

function SleepTab({ sleep, rhr, steps, naps, save }) {
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
      <ScreenHeader title="Énergie" subtitle="récupération tendon & muscle" />

      <EnergyScoreCard energy={energy} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Dernière nuit</Label>
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
              {sleepScore}<span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>/100</span>
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
          )) : <Body style={{ fontSize: 11, color: C.dim }}>Aucune nuit enregistrée.</Body>}
        </div>
        {todayNap && (
          <Body style={{ fontSize: 11, color: C.accent, marginTop: 10 }}>
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
                <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
              </div>
            ))}
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
        target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${ex.s} × ${ex.r}`,
        consigne: lib ? lib.c : ex.c, def: savedDef, last: savedLast,
        groupe: lib ? lib.groupe : ex.groupe, mouvement: lib ? lib.mouvement : ex.mouvement,
        materiel: lib ? lib.materiel : ex.materiel, tendon: lib ? lib.tendon : ex.tendon,
        famille: ex.famille, origine: wasSubstituted ? ex.n : undefined,
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
      target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${ex.s} × ${ex.r}`, consigne: ex.c, def, last,
      groupe: ex.groupe, mouvement: ex.mouvement, materiel: ex.materiel, tendon: ex.tendon, famille: ex.famille, series };
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
    if (!exos[ei].series[si].fait) fireTimer(lastTimerByExo[ei] ?? exos[ei].rest);
  };
  const addSet = (ei, leg) => setExos((p) => p.map((e, i) => {
    if (i !== ei) return e;
    const sameLeg = e.series.filter((s) => s.leg === leg);
    const proto = sameLeg[sameLeg.length - 1] || {};
    return { ...e, series: [...e.series, { poids: proto.poids ?? "", val: proto.val ?? medianTarget(e.target), fait: false, leg }] };
  }));
  const rmSet = (ei, si) => setExos((p) => p.map((e, i) => i !== ei ? e : { ...e, series: e.series.filter((_, j) => j !== si) }));

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
      return { ...e, nom: lib.n, consigne: lib.c, groupe: lib.groupe, mouvement: lib.mouvement,
        materiel: lib.materiel, tendon: lib.tendon, famille: lib.famille, def, last, series,
        origine: e.origine ?? e.nom };
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
                    ⏸ plateau depuis {plateauByExo[e.nom].weeks} semaine{plateauByExo[e.nom].weeks > 1 ? "s" : ""}
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
                    ? EXERCISE_LIBRARY.filter((l) => l.famille === e.famille && l.n !== e.nom)
                    : [];
                  if (!candidates.length) return null;
                  return subOpen === ei ? (
                    <div style={{ marginTop: 8, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
                      <Label style={{ marginBottom: 6 }}>Remplacer par</Label>
                      {candidates.map((c) => (
                        <div key={c.n} onClick={() => substitute(ei, c)} style={{ padding: "7px 2px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer" }}>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{c.n}</div>
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

      {showOverload && (
        <Card accentLeft style={{ padding: "13px 14px" }}>
          <Label style={{ marginBottom: 5 }}>Plateau détecté</Label>
          {overload.kind === "reps" ? (
            <Body>
              {overload.sessions} séances stables d'affilée (depuis {overload.weeks} semaine{overload.weeks > 1 ? "s" : ""}) sur{" "}
              {overload.poids} kg × {overload.from}. Vise{" "}
              <strong style={{ color: C.text }}>{overload.target} reps</strong> à {overload.poids} kg la prochaine fois
              (fourchette {overload.range.min}-{overload.range.max}).
            </Body>
          ) : (
            <Body>
              {overload.sessions} séances stables d'affilée (depuis {overload.weeks} semaine{overload.weeks > 1 ? "s" : ""}) en haut
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

function ProgressScreen({ training, knee, onBack }) {
  const [sel, setSel] = useState(null);
  const list = useMemo(() => exerciseList(training), [training]);
  if (sel) return <ExerciseDetail training={training} knee={knee} nom={sel} onBack={() => setSel(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Progression" subtitle="par exercice · meilleure série de chaque séance"
        right={<Btn variant="ghost" onClick={onBack}><X size={16} /></Btn>} />
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
                {showPlateau && (
                  <span style={{ fontSize: 9, fontFamily: C.mono, fontWeight: 800, color: "#e8a33d", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Plateau
                  </span>
                )}
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

function TrainTab({ training, save, hsrWeek, setHsrWeek, knee, scheme }) {
  // Brouillon auto-sauvegardé (localStorage, hors DATA_KEYS — voir Règles absolues #1) :
  // restaure au montage la séance laissée en cours (TrainTab démonte tout son état à
  // chaque changement d'onglet, ce qui effaçait la séance avant ce correctif). Lu une
  // seule fois (`useState` paresseux). `TEMPLATES[d.type]` vérifié pour ne jamais rouvrir
  // sur un type devenu invalide.
  const [draft0] = useState(() => getSync("trainingDraft", null));
  const [open, setOpen] = useState(() => (draft0?.type && TEMPLATES[draft0.type]) ? draft0.type : null);
  const [progress, setProgress] = useState(false);
  const [date, setDate] = useState(() => draft0?.date ?? today());
  const [startTime, setStartTime] = useState(() => draft0?.start ?? new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(() => draft0?.duration ?? 60);
  const [rpe, setRpe] = useState(() => draft0?.rpe ?? 7);
  const [blocs, setBlocs] = useState(() => draft0?.blocs ?? []);
  // Séance déjà enregistrée en cours de modification (référence exacte de l'objet
  // dans `training`) — null quand on démarre une nouvelle séance à blanc.
  const [editing, setEditing] = useState(() => {
    const id = draft0?.editingId;
    return id ? (training.find((t) => t.id === id) ?? null) : null;
  });

  const pickType = (type) => {
    const sel = open === type;
    store.set("trainingDraft", null);
    setEditing(null);
    setDate(today());
    setStartTime(new Date().toTimeString().slice(0, 5));
    setDuration(60);
    setRpe(7);
    setBlocs([]);
    setOpen(sel ? null : type);
  };

  const editSession = (t) => {
    store.set("trainingDraft", null);
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
    store.set("trainingDraft", null);
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };
  const saveMuscu = (rec) => {
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };

  // Brouillon Escalade (blocs saisis via BlocsField) — même protection que le carnet muscu,
  // gérée ici puisque Escalade reste rendue directement par TrainTab (kind "sport", pas de
  // MuscuLogger). Ignoré tant qu'un autre type est ouvert.
  useEffect(() => {
    if (open !== "Escalade") return;
    store.set("trainingDraft", { type: "Escalade", date, editingId: editing?.id ?? null, start: startTime, duration, rpe, blocs });
  }, [open, date, editing, startTime, duration, rpe, blocs]);

  const vol = {};
  training.filter((t) => daysBetween(t.date, today()) <= 14).forEach((t) => { vol[t.type] = (vol[t.type] || 0) + 1; });
  const exoCount = useMemo(() => exerciseList(training).length, [training]);
  // Records rejoués sur tout l'historique (V4) : quelles séances contenaient un record au
  // moment où elles ont eu lieu. Clé par référence d'objet, comme la suppression.
  const records = useMemo(() => recordsBySession(training), [training]);
  const painRed = painOutOfBase([knee], date);

  if (open && TEMPLATES[open]?.kind === "muscu") {
    return (
      <MuscuLogger key={editing?.id || `new-${open}`} type={open} training={training} hsrWeek={hsrWeek} date={date} onDate={setDate}
        onSave={saveMuscu} onCancel={() => { setOpen(null); setEditing(null); }} initial={editing} painRed={painRed} />
    );
  }
  if (progress) return <ProgressScreen training={training} knee={knee} onBack={() => setProgress(false)} />;

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
          {/* Basket est passé en carnet d'exercices (04/09/2026, kind:"muscu") : cette carte
              ne sert plus qu'à Escalade, seul type "sport" restant. */}
          <Body style={{ marginBottom: 12 }}>Compte comme volume tirage — jamais un jour Upper, pour protéger le coude.</Body>
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
            <Btn variant="ghost" onClick={() => { store.set("trainingDraft", null); setOpen(null); setEditing(null); }}>Annuler</Btn>
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
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Pilote presse à cuisses + leg extension en Lower A et Lower C. Tempo 6 s · repos 2-3 min.</Body>
      </Card>

      {/* Historique */}
      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Dernières séances</Label>
        {training.length ? lastN(training, 10).reverse().map((t, i) => {
          // Marqueur record : la séance contenait au moins une meilleure série de tous les
          // temps AU MOMENT où elle a eu lieu, et aucun tendon n'était hors base ce jour-là.
          const rec = records.get(t);
          const recShown = rec && !painOutOfBase([knee], t.date);
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
                {/* Basket (04/09/2026) porte désormais exercices ET durée/RPE à la fois — les
                    deux se combinent, au lieu de l'ancien "soit l'un soit l'autre". */}
                {[
                  t.exercices?.length ? `${t.exercices.length} exos · ${t.exercices.reduce((a, e) => a + (e.series?.length || 0), 0)} séries` : null,
                  t.duration != null ? `${t.duration}′` : null,
                  t.rpe != null ? `RPE ${t.rpe}` : null,
                  climbLabel(t.blocs, scheme) || null,
                ].filter(Boolean).join(" · ")}
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
   TAB — DOULEURS (genou — le coude a été retiré le 05/09/2026)
   ============================================================ */
// Une zone = un journal (clé localStorage distincte, même forme `{date, pain, baseline}`)
// et son habillage. Ajouter une 3e zone un jour ne coûte qu'une entrée ici + une clé dans
// `DATA_KEYS` + une ligne dans `save` — c'est le but de cette table.
//
// Le coude (tendon distal du biceps) a été retiré le 05/09/2026 : plus aucune douleur
// depuis le retour de vacances de Yoann (confirmé par lui). `elbowLog` reste dans
// `DATA_KEYS` (store.js) pour ne pas perdre l'historique déjà exporté, mais plus aucun
// code ne le lit ni ne l'écrit — si le coude redevient un jour un problème, il suffira de
// rajouter une entrée ici.
const PAIN_ZONES = [
  {
    key: "knee", label: "Genou",
    title: "Genou · réhab", sub: "tendon quadricipital · HSR · Silbernagel",
    // Les routines guidées (rééduc/échauffement basket) ont déménagé dans l'onglet Séances
    // le 04/09/2026 (voir CLAUDE.md) — loguées comme de vraies séances ("Mobilité",
    // "Basket") plutôt que jouées ici hors historique.
    hsr: true,
    alertText: "Décharge : pas de basket ni de Lower tant que la douleur n'est pas revenue à sa base. Réduire charge ou amplitude à la prochaine exposition.",
  },
];

function PainTab({ knee, save, hsrWeek }) {
  // Une seule zone désormais (genou) : plus de sélecteur de zone, `zone`/`log` sont fixes.
  const zone = PAIN_ZONES[0];
  const log = knee;

  const [date, setDate] = useState(today());
  // Aucune valeur par défaut (ni 4 ni 5) : rien n'est présélectionné à l'ouverture, et
  // l'enregistrement reste bloqué tant qu'un chiffre n'a pas été touché. Demandé
  // explicitement pour forcer une vraie évaluation de la sensation plutôt qu'un
  // enregistrement réflexe — une entrée « par défaut » fausserait l'historique et la
  // règle de Silbernagel.
  // ...mais si le jour affiché a DÉJÀ une entrée, on la recharge (exigence explicite) :
  // sinon l'écran afficherait « rien de noté » alors que la donnée existe, et on risquerait
  // de croire la journée non renseignée. Les onglets ne sont montés qu'une fois le
  // localStorage lu (voir le garde `loading` du composant App), donc les journaux sont
  // déjà peuplés ici, et rouvrir l'onglet relance cette initialisation.
  const existingToday = (knee || []).find((k) => k.date === today());
  const [pain, setPain] = useState(existingToday ? existingToday.pain : null);
  const [baseline, setBaseline] = useState(existingToday ? existingToday.baseline !== false : true);
  // Changer de date recharge l'entrée existante, ou remet à vide si le jour visé n'a rien —
  // sans ce reset, la douleur d'une autre date resterait affichée et pourrait être
  // enregistrée par erreur.
  const pickDate = (d) => {
    setDate(d);
    const e = (log || []).find((x) => x.date === d);
    setPain(e ? e.pain : null);
    setBaseline(e ? e.baseline !== false : true);
  };
  const add = () => { if (pain == null) return; save.knee(upsert(log, { date, pain, baseline })); };

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
            <Btn variant="danger" onClick={() => save.knee(log.filter((k) => k.date !== date))}><Trash2 size={14} /></Btn>
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
// Comparaison des fenêtres (24/09/2026) : une ligne par longueur fixe, sous l'estimation de
// référence. Le 7 j est gardé (demande explicite) mais toujours marqué "indicatif" — sur 7 j,
// une variation d'eau de 0,5 kg décale le résultat d'environ ±550 kcal/j.
function TdeeWindows({ windows }) {
  if (!windows?.length) return null;
  return (
    <>
      <Label style={{ marginTop: 12, marginBottom: 4 }}>Comparaison des fenêtres</Label>
      {windows.map((w) => (
        <div key={w.days} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 11, color: C.text2, fontFamily: C.mono }}>
            {w.days} j{w.days < MIN_TDEE_DAYS && <span style={{ color: C.muted }}> · indicatif</span>}
          </span>
          {w.status === "ok" ? (
            <span style={{ fontFamily: C.mono, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: C.text }}>{w.tdee}</span>
              <span style={{ fontSize: 10, color: TDEE_RELIABILITY_COLOR[w.reliability], marginLeft: 6 }}>{TDEE_RELIABILITY_LABEL[w.reliability]}</span>
              <span style={{ fontSize: 10, color: C.dim, marginLeft: 6 }}>{Math.round(w.loggedRate * 100)}%</span>
            </span>
          ) : (
            <span style={{ fontSize: 10, color: C.dim }}>{w.reason}</span>
          )}
        </div>
      ))}
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
        Si les fenêtres convergent, le chiffre est solide. Si la plus longue s'écarte, elle est
        sans doute polluée par un événement ancien (retour de vacances : l'eau repart, la dépense
        est surestimée). Le 7 j est très bruité : 0,5 kg d'eau ≈ ±550 kcal/j — à ne pas lire seul.
      </Body>
    </>
  );
}

function TdeeCard({ result, deficitReel, trend, windows }) {
  if (result.status !== "ok") {
    return (
      <Card>
        <Label style={{ marginBottom: 6 }}>Dépense estimée</Label>
        <Body style={{ fontSize: 11, color: C.dim }}>
          Pas encore assez de données ({result.reason}). Il faut au moins {MIN_TDEE_DAYS} jours
          de pesées et d'apports enregistrés, avec au moins 70 % des jours loggés.
        </Body>
        <TdeeWindows windows={windows} />
      </Card>
    );
  }
  const col = TDEE_RELIABILITY_COLOR[result.reliability];
  // Détails de fenêtre/complétude/tendance de poids (13/09/2026, demande explicite) : tout
  // était déjà calculé par `computeTDEE`, juste pas affiché — aucun nouveau calcul ici.
  const trendPoints = (trend || []).filter((p) => p.tdee != null);
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
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: C.mono }}>
        Fenêtre : {fmt(result.windowStart)} → {fmt(result.windowEnd)} · {Math.round(result.loggedRate * 100)}% des jours loggés · {Math.round(result.weighRate * 100)}% pesés
      </Body>
      <Body style={{ fontSize: 10, color: C.dim, marginTop: 2, fontFamily: C.mono }}>
        Tendance de poids sur la fenêtre : {result.deltaKg > 0 ? "+" : ""}{result.deltaKg} kg
      </Body>
      {result.overlapsWater && (
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          Fenêtre chevauchant la perte d'eau/glycogène du début de sèche (~21 premiers jours) —
          la dépense réelle est probablement plus proche de la fourchette basse.
        </Body>
      )}
      <TdeeWindows windows={windows} />
      {trendPoints.length >= 2 && (
        <>
          <Label style={{ marginTop: 12, marginBottom: 6 }}>Tendance · 8 semaines</Label>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.map((p) => ({ ...p, label: fmt(p.date) }))} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="label" tick={chartAxis} interval="preserveEnd" />
                <YAxis tick={chartAxis} domain={["dataMin - 50", "dataMax + 50"]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle}
                  formatter={(v) => (v == null ? ["—", "kcal/j"] : [v, "kcal/j"])} />
                <Line type="monotone" dataKey="tdee" stroke={C.accent} strokeWidth={2} dot={{ r: 2, fill: C.text }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

// Planning hebdomadaire idéal (01/09/2026) — affiché à titre de référence dans l'onglet TDEE,
// jamais lu par le recommandeur ni le Coach IA : c'est un repère pour Yoann, pas une règle
// appliquée automatiquement. Deux variantes selon qu'il y a match ou non dans la semaine.
// Mardi/Jeudi inversés le 05/09/2026 (demande explicite de Yoann) : Upper passe au jeudi,
// le repos actif remonte au mardi. `WEEKLY_PLAN_FAMILIES` ci-dessous DOIT rester en phase
// avec ce texte (même inversion) — voir `familiesForToday`, qui couple ce planning au
// recommandeur ("Prochaine séance").
const WEEKLY_PLAN = {
  sansMatch: [
    { jour: "Lundi", texte: "Lower A (HSR lourd)" },
    { jour: "Mardi", texte: "Repos actif — 10k pas, mobilité douce ; iso genou et/ou escalade légère en option selon ressenti" },
    { jour: "Mercredi", texte: "Mobilité (matin) · Basket (soir)" },
    { jour: "Jeudi", texte: "Upper A" },
    { jour: "Vendredi", texte: "Mobilité (matin) · Basket (midi)" },
    { jour: "Samedi", texte: "Lower B (HSR)" },
    { jour: "Dimanche", texte: "Upper B" },
  ],
  avecMatch: [
    { jour: "Lundi", texte: "Lower C (HSR lourd)" },
    { jour: "Mardi", texte: "Repos actif — même logique que la semaine sans match" },
    { jour: "Mercredi", texte: "Mobilité (matin) · Basket (soir)" },
    { jour: "Jeudi", texte: "Upper A" },
    { jour: "Vendredi", texte: "Mobilité (matin) · Basket (midi)" },
    { jour: "Samedi", texte: "Upper B + routine iso quad autonome" },
    { jour: "Dimanche", texte: "Match" },
  ],
};

// Version machine-lisible du planning ci-dessus, couplée au recommandeur (05/09/2026) :
// pour chaque jour de la semaine (index `Date#getDay()`, 0=dimanche...6=samedi), la ou les
// "familles" de séance prévues. Une famille est un préfixe de type reconnu par
// `recommendSessions` (packages/core/src/recommender.js) — "Upper" matche "Upper A"/"Upper
// B", "Lower" matche "Lower A/B/C", "Repos" matche "Repos / mobilité". "Mobilité" ne matche
// aucun type suggéré automatiquement (c'est un choix manuel, jamais suggéré) : gardée ici
// à titre documentaire, sans effet sur le score.
const WEEKLY_PLAN_FAMILIES = {
  sansMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Lower"], 0: ["Upper"] },
  avecMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Upper"], 0: ["Basket"] },
};

/**
 * Vrai si un match est prévu ce dimanche (fin de la semaine en cours, lundi-dimanche) —
 * détecté AUTOMATIQUEMENT depuis `basketSchedule.matchDates`. Décision explicite de Yoann
 * (05/09/2026) plutôt qu'un réglage manuel à rebasculer chaque semaine. Extrait de
 * `familiesForToday` le 14/09/2026 pour être réutilisé aussi par `recommendSessions`
 * (`matchWeek`, packages/core/src/recommender.js) : jusque-là le recommandeur ne pouvait
 * jamais suggérer Lower C, même un lundi de semaine avec match où la carte "Planning idéal"
 * l'annonce explicitement — retour de Yoann après l'avoir constaté en usage réel.
 */
function isMatchWeek(basketSchedule) {
  const dow = new Date().getDay(); // 0=dimanche...6=samedi
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  const sundayKey = shiftDateKey(today(), daysUntilSunday);
  return !!basketSchedule?.matchDates?.includes(sundayKey);
}

/**
 * Familles du planning idéal pour AUJOURD'HUI, à passer telles quelles à `recommendSessions`
 * (`weeklyPlan`) — le recommandeur ne sait rien du planning lui-même, juste matcher une
 * famille à un type suggéré (bonus modéré, jamais un remplacement, voir recommender.js).
 */
function familiesForToday(basketSchedule) {
  const dow = new Date().getDay(); // 0=dimanche...6=samedi
  const variant = isMatchWeek(basketSchedule) ? "avecMatch" : "sansMatch";
  return WEEKLY_PLAN_FAMILIES[variant][dow] || [];
}

/* ============================================================
   TAB — PERFORMANCE
   ============================================================ */
function PerformanceTab({ macros, targets, training, weight }) {
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  const [planVariant, setPlanVariant] = useState("sansMatch");

  // Dépense énergétique adaptative (V7). Calculée à chaque montage de l'onglet — le journal
  // Repas et ses corrections vivent dans un autre onglet (un seul monté à la fois), donc un
  // remount suffit à rester à jour, sans mémoïsation ni dépendance fragile sur `foodLog`.
  // Toujours ancrée sur AUJOURD'HUI (l'estimation porte sur la dépense réelle actuelle).
  const tdeeToday = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
  const atToday = targetsForDate(today(), targets);
  const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
  const deficitReel = tdeeToday.status === "ok" ? realDeficit(kcalTargetToday, tdeeToday.tdee) : null;
  // Historique du TDEE semaine par semaine (13/09/2026, demande explicite) : même donnée que
  // `tdeeToday` (kcal réelles fusionnées), juste rejouée à des dates passées.
  const tdeeKcalByDate = buildKcalByDate({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, today: today() });
  const tdeeCutStart = targets.cut?.enabled !== false && targets.cut?.start ? targets.cut.start : null;
  const tdeeHistory = tdeeTrend({ weightLog: weight, kcalByDate: tdeeKcalByDate, cutStart: tdeeCutStart, todayDate: today(), weeks: 8 });
  // Comparaison des fenêtres 7/14/21/28 j (24/09/2026, demande explicite) — hors fenêtre déjà
  // retenue par l'estimation de référence, pour ne pas l'afficher deux fois.
  const tdeeWindows = [7, 14, 21, 28]
    .filter((d) => tdeeToday.status !== "ok" || d !== tdeeToday.days)
    .map((d) => tdeeOverWindow({ weightLog: weight, kcalByDate: tdeeKcalByDate, today: today(), days: d, cutStart: tdeeCutStart }));

  // Moyenne hebdomadaire glissante, 7 jours (13/09/2026 — remplace l'ancienne moyenne lun-ven :
  // les cheat meals de Yoann ne suivent pas un jour fixe, exclure le week-end n'avait donc pas
  // de sens pour lui). Une vraie moyenne glissante absorbe un écart ponctuel quel que soit le
  // jour où il tombe, sans avoir à deviner lequel exclure.
  const weeklyTrend = weeklyKcalTrend(macros, { weeks: 8 }).map((w) => ({ ...w, label: fmt(w.weekStart) }));
  const weeksWithData = weeklyTrend.filter((w) => w.days > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="TDEE" />

      {/* Moyenne hebdo kcal, 7 jours glissants */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Moyenne kcal · semaine (lun-dim)</Label>
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
          Semaine du lundi, moyenne glissante sur les 7 jours réellement loggés.
        </Body>
      </Card>

      {/* Dépense énergétique adaptative (V7) */}
      <TdeeCard result={tdeeToday} deficitReel={deficitReel} trend={tdeeHistory} windows={tdeeWindows} />

      {/* Planning hebdomadaire idéal — référence affichée, jamais appliquée automatiquement */}
      <Card>
        <Label style={{ marginBottom: 8 }}>Planning idéal</Label>
        <Pills
          options={[{ key: "sansMatch", label: "Sans match" }, { key: "avecMatch", label: "Avec match" }]}
          value={planVariant} onChange={setPlanVariant} small
        />
        <div style={{ marginTop: 10 }}>
          {WEEKLY_PLAN[planVariant].map((d) => (
            <div key={d.jour} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.divider}` }}>
              <div style={{ width: 66, flexShrink: 0, fontSize: 10.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{d.jour}</div>
              <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.4 }}>{d.texte}</div>
            </div>
          ))}
        </div>
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

// Planning Basket fixe (01/09/2026) : jours de semaine récurrents (entraînement hebdo,
// 0=dimanche...6=samedi comme Date#getDay()) + dates de matchs ponctuelles (calendrier de
// saison, irrégulier — 22 dimanches sur les ~34 possibles entre octobre et mai, donc jamais
// "tous les dimanches"). Deux mécanismes distincts pour deux réalités distinctes : un jour
// fixe se répète indéfiniment, une date de match ne se répète jamais toute seule.
const WEEKDAYS = [
  { key: 1, label: "Lun" }, { key: 2, label: "Mar" }, { key: 3, label: "Mer" },
  { key: 4, label: "Jeu" }, { key: 5, label: "Ven" }, { key: 6, label: "Sam" }, { key: 0, label: "Dim" },
];

function BasketScheduleCard({ basketSchedule, setBasketSchedule }) {
  const [newDate, setNewDate] = useState("");
  const weekly = basketSchedule.weekly || [];
  const matchDates = basketSchedule.matchDates || [];
  const toggleDay = (d) => {
    const next = weekly.includes(d) ? weekly.filter((x) => x !== d) : [...weekly, d].sort();
    setBasketSchedule({ ...basketSchedule, weekly: next });
  };
  const addMatch = () => {
    if (!newDate || matchDates.includes(newDate)) return;
    setBasketSchedule({ ...basketSchedule, matchDates: [...matchDates, newDate].sort() });
    setNewDate("");
  };
  const removeMatch = (d) => setBasketSchedule({ ...basketSchedule, matchDates: matchDates.filter((x) => x !== d) });

  return (
    <Card>
      <Label style={{ marginBottom: 8 }}>Planning Basket fixe</Label>
      <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
        Le recommandeur sait qu'un Basket est prévu avant même que tu l'aies loggé : il évite
        de proposer un Lower le même jour, applique déjà le repos de 48 h le lendemain, et le
        propose en priorité ("c'est le jour de l'entraînement") le jour même.
      </Body>

      <Label style={{ marginBottom: 6 }}>Entraînement hebdomadaire</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {WEEKDAYS.map((d) => {
          const on = weekly.includes(d.key);
          return (
            <button key={d.key} onClick={() => toggleDay(d.key)} style={{
              padding: "7px 12px", borderRadius: 6, cursor: "pointer",
              fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
              background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
              border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
            }}>{d.label}</button>
          );
        })}
      </div>

      <Label style={{ marginBottom: 6 }}>Dates de matchs (saison)</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...inputStyle(false), flex: 1 }} />
        <Btn variant="primary" disabled={!newDate} onClick={addMatch} style={{ padding: "0 16px" }}>Ajouter</Btn>
      </div>
      {matchDates.length === 0 ? (
        <Body style={{ fontSize: 11, color: C.dim }}>Aucune date de match enregistrée.</Body>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {matchDates.map((d) => (
            <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px", borderBottom: `1px solid ${C.divider}` }}>
              <span style={{ fontSize: 12, color: C.text, fontFamily: C.mono }}>{fmt(d)}</span>
              <button onClick={() => removeMatch(d)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   RÉGLAGES
   ============================================================ */
function SettingsPanel({ apiKey, setApiKey, model, setModel, onClose, healthSync, onHealthSync,
                         coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, saveTargets, buildBriefing,
                         lastAutoBackup, lastCloudBackup, onCloudBackupDone, climbScheme, setClimbScheme, phase, setPhase,
                         basketSchedule, setBasketSchedule }) {
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

      {/* Réordonné le 14/09/2026 (retour de Yoann : "c'est un peu le bordel"), puis affiné le
          même jour après un premier essai trop grossier ("mettre un rappel actif en tête" ≠
          "utilisé souvent" — Sauvegarde n'est en fait PAS un réglage fréquent malgré son
          bandeau/sa notification). Ordre final confirmé par Yoann réglage par réglage : du
          plus fréquemment utilisé au moins fréquent, sans regrouper "Coach IA" comme un seul
          bloc — contexte permanent/carnet de bord/revue de fond sont utilisés souvent, clé
          API/modèle quasi jamais, donc les deux moitiés ne sont plus adjacentes. "Objectif
          temporaire" reste retiré de l'écran (jugé inutile) — `targets.cut` reste intact en
          interne, juste plus affiché nulle part. */}

      <BasketScheduleCard basketSchedule={basketSchedule} setBasketSchedule={setBasketSchedule} />

      <Card>
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 11 }}>{PHASES[phase].msg}</Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cibles macro de base</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Cibles quotidiennes, appliquées partout dans l'app.
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
        {/* Empilé verticalement (07/08/2026, retour de Yoann) : 3 Stepper (chacun déjà
            −/champ/+) sur une seule ligne ne tenaient pas dans la largeur d'une Card,
            débordaient du cadre et laissaient le champ de saisie trop étroit pour taper
            dedans. Une ligne par phase, comme suggéré. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <Label style={{ marginBottom: 8 }}>Système de cotation escalade</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          "Couleur de salle" reste la valeur par défaut. Changer de système n'efface rien :
          les blocs déjà enregistrés dans l'ancien système restent comptés dans le volume de
          la séance, juste hors échelle pour le classement par niveau.
        </Body>
        <Pills options={[{ key: "gym", label: "Couleur de salle" }, { key: "fontainebleau", label: "Fontainebleau" }]}
          value={climbScheme} onChange={setClimbScheme} />
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
  // FC repos (Health Connect, natif seulement — 05/09/2026, score d'énergie) : `{date, bpm}`,
  // même famille que weightLog/stepsLog. Vide sur la PWA (jamais synchronisée), le score
  // d'énergie affiche alors "pas assez de données" plutôt qu'un chiffre inventé.
  const [rhr, setRhr] = useState([]);
  // Siestes détectées par la montre (Health Connect, natif seulement — 23/09/2026, gestion
  // des siestes) : `{date, minutes}`. Jamais de saisie manuelle (comme rhrLog), pas de champ
  // "source" à arbitrer. Affichées à titre informatif dans l'onglet Énergie, à côté du vrai
  // sommeil — volontairement PAS intégrées au score d'énergie/de sommeil pour l'instant (la
  // science ne les rattache ni à la nuit d'avant ni à celle d'après, voir la discussion).
  const [naps, setNaps] = useState([]);
  const [macros, setMacros] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [phase, setPhaseState] = useState("seche");
  const [hsrWeek, setHsrWeekState] = useState(1);
  const [climbScheme, setClimbSchemeState] = useState("gym");
  // Planning Basket fixe (01/09/2026) : `weekly` = jours de semaine récurrents (entraînement
  // hebdo, 0=dimanche...6=samedi comme Date#getDay()), `matchDates` = dates ponctuelles
  // (calendrier de matchs, irrégulier — pas un simple jour de semaine). Défaut vide : aucun
  // effet sur le recommandeur tant que rien n'est configuré dans les Réglages.
  const [basketSchedule, setBasketScheduleState] = useState({ weekly: [], matchDates: [] });
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
      // Migration (01/09/2026) : "Leg curl bilatéral" était une erreur de nom, l'exercice
      // réel est unilatéral — le gabarit Lower B a été corrigé, mais le nom d'un exercice
      // est aussi sa clé d'historique (lastPerf/records/progression matchent par `nom`).
      // Sans renommer aussi les séances déjà enregistrées, l'historique de cet exercice
      // repartirait de zéro. Idempotent : sans occurrence à corriger, c'est un no-op.
      const rawTraining = await store.get("trainingLog", []);
      let trainingMigrated = false;
      const migratedTraining = rawTraining.map((s) => {
        if (!s.exercices?.some((e) => e.nom === "Leg curl bilatéral")) return s;
        trainingMigrated = true;
        return { ...s, exercices: s.exercices.map((e) => (e.nom === "Leg curl bilatéral" ? { ...e, nom: "Leg curl unilatéral" } : e)) };
      });
      if (trainingMigrated) store.set("trainingLog", migratedTraining);
      setTraining(migratedTraining);
      setKnee(await store.get("kneeLog", []));
      setRhr(await store.get("rhrLog", []));
      setNaps(await store.get("napLog", []));
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
      setBasketScheduleState(await store.get("basketSchedule", { weekly: [], matchDates: [] }));
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
    // FC repos (05/09/2026, score d'énergie) — pas de note "source" ici : contrairement au
    // poids/sommeil/pas, il n'existe aucune saisie manuelle de la FC repos dans l'app, donc
    // pas de conflit "manuel vs synchronisé" à arbitrer.
    if (Object.keys(result.rhrByDate || {}).length) {
      setRhr((prev) => {
        let next = prev;
        Object.entries(result.rhrByDate).forEach(([date, bpm]) => { next = upsert(next, { date, bpm }); });
        store.set("rhrLog", next);
        return next;
      });
    }
    if (Object.keys(result.napsByDate || {}).length) {
      setNaps((prev) => {
        let next = prev;
        Object.entries(result.napsByDate).forEach(([date, minutes]) => { next = upsert(next, { date, minutes }); });
        store.set("napLog", next);
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
  // (Poids, Calories, Énergie, Pas, Eau), reformatées pour l'affichage natif — la 6e
  // tuile du widget est un bouton Sync, pas une donnée (voir widgetSync.js /
  // DashboardWidgetProvider.kt). La tuile "Sommeil" est devenue "Énergie" le 05/09/2026 :
  // valeur = score d'énergie, note = durée de sommeil réelle (demande explicite de Yoann,
  // qui préfère la durée brute au score de sommeil sur cette tuile).
  useEffect(() => {
    if (loading || !Capacitor.isNativePlatform()) return;
    const wLast = lastN(weight, 1)[0];
    const lastNightDash = lastN(sleep, 1)[0];
    const energyDash = computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps });
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
      energie: {
        value: energyDash.status === "ok" ? `${energyDash.total} ${scoreLabel(energyDash.total)}` : "—",
        note: lastNightDash ? `Sommeil ${fmtHM(lastNightDash.hours)}` : "—",
      },
      // Pas de "value" affichée pour ce tile (juste l'icône Sync) — seule la note sert,
      // horodatage du dernier instantané poussé au widget (peu importe si déclenché par
      // l'ouverture normale de l'app ou par le bouton Sync lui-même).
      // "À jour · dernière synchro : HH:MM:SS" tient sur 4 lignes et écrase l'icône dans
      // une tuile aussi étroite — condensé pour rester sur une ligne comme les autres notes.
      sync: { value: "", note: `MAJ ${new Date().toLocaleTimeString("fr-FR")}` },
    });
  }, [loading, weight, sleep, macros, steps, training, targets, naps]);

  const save = {
    weight: (v) => { setWeight(v); store.set("weightLog", v); },
    sleep: (v) => { setSleep(v); store.set("sleepLog", v); },
    training: (v) => { setTraining(v); store.set("trainingLog", v); },
    knee: (v) => { setKnee(v); store.set("kneeLog", v); },
    rhr: (v) => { setRhr(v); store.set("rhrLog", v); },
    naps: (v) => { setNaps(v); store.set("napLog", v); },
    macros: (v) => { setMacros(v); store.set("macroLog", v); },
    steps: (v) => { setSteps(v); store.set("stepsLog", v); },
    notes: (v) => { setNotes(v); store.set("noteLog", v); },
    targets: (v) => { setTargets(v); store.set("targets", v); },
  };
  const setPhase = (v) => { setPhaseState(v); store.set("phase", v); };
  const setHsrWeek = (v) => { setHsrWeekState(v); store.set("hsrWeek", v); };
  const setClimbScheme = (v) => { setClimbSchemeState(v); store.set("climbScheme", v); };
  const setBasketSchedule = (v) => { setBasketScheduleState(v); store.set("basketSchedule", v); };
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
        weight, sleep, training, knee, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile, journal, scheme, basketSchedule, weeklyPlan: familiesForToday(basketSchedule),
        matchWeek: isMatchWeek(basketSchedule),
        energy: computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }),
      }, note),
    buildBriefing: () =>
      buildCoachBriefing({
        weight, sleep, training, knee, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile: coachProfile, journal: coachJournal, scheme,
      }),
    // Bilan long terme (point 4 du chantier IA, 07/09/2026) : mêmes données que l'analyse
    // quotidienne, mais résumées sur 90 jours par `computeBilanFacts` (packages/core/src/
    // bilan.js) — le JS calcule les corrélations, `buildBilanPrompt` ne fait que les mettre
    // en mots. Même calcul TDEE que la carte Macros/point 1 (lecture fraîche foodLog/
    // overrides), jamais un chiffre différent pour la même réalité.
    buildBilan: () => {
      const tdeeResult = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
      const atToday = targetsForDate(today(), targets);
      const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
      const facts = computeBilanFacts({ training, weight, macros, sleep, rhr, steps, knee, targets, scheme, tdeeResult, kcalTargetToday, todayDate: today() });
      return buildBilanPrompt({ facts, phase, targets, profile: coachProfile, notes });
    },
    apiKey, model,
  };

  // Retour en haut au changement d'onglet (07/08/2026, retour de Yoann) : `<main>` est un
  // conteneur scrollable UNIQUE dont le contenu change avec `tab` — React ne le démonte pas
  // entre deux onglets, donc le navigateur conservait le scroll de l'onglet précédent au
  // lieu de repartir du haut.
  const mainRef = useRef(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [tab, showSettings]);

  const NAV = [
    { key: "dash", label: "Bord", icon: LayoutDashboard },
    { key: "weight", label: "Poids", icon: Scale },
    { key: "sleep", label: "Énergie", icon: Moon },
    { key: "steps", label: "Pas", icon: Footprints },
    { key: "train", label: "Séances", icon: Dumbbell },
    { key: "pain", label: "Douleurs", icon: HeartPulse },
    { key: "perf", label: "TDEE", icon: TrendingUp },
    { key: "macro", label: "Macro", icon: Flame },
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
      <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        {loading ? <Empty>Chargement…</Empty> : showSettings ? (
          <SettingsPanel {...{ apiKey, setApiKey, model, setModel, healthSync, coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, lastAutoBackup, lastCloudBackup, climbScheme, setClimbScheme, phase, setPhase, basketSchedule, setBasketSchedule }} onCloudBackupDone={markCloudBackup} saveTargets={save.targets} buildBriefing={coach.buildBriefing} onHealthSync={runHealthSync} onClose={() => setShowSettings(false)} />
        ) : (
          <>
            {tab === "dash" && <Dashboard {...{ weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, coach, todayNote, saveNote, saveJournal, setTab, lastCloudBackup, scheme, basketSchedule, weeklyPlan: familiesForToday(basketSchedule), matchWeek: isMatchWeek(basketSchedule) }} openSettings={() => setShowSettings(true)} />}
            {tab === "weight" && <WeightTab {...{ weight, targets, save, phase }} />}
            {tab === "sleep" && <SleepTab {...{ sleep, rhr, steps, naps, save }} />}
            {tab === "steps" && <StepsTab {...{ steps, save }} />}
            {tab === "train" && <TrainTab {...{ training, save, hsrWeek, setHsrWeek, knee, scheme }} />}
            {tab === "pain" && <PainTab {...{ knee, save, hsrWeek }} />}
            {tab === "perf" && <PerformanceTab {...{ macros, targets, training, weight }} />}
            {tab === "macro" && <NutritionTab targetsFor={(d) => targetsForDate(d, targets)} macros={macros} save={save} training={training} apiKey={apiKey} model={model} />}
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
