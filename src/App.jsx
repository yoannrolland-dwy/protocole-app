import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import {
  LayoutDashboard, Scale, Moon, Dumbbell, HeartPulse, Utensils, Footprints,
  Plus, AlertTriangle, CheckCircle2, Circle, Sparkles, Trash2,
  Play, Pause, SkipForward, RotateCcw, Timer, Droplet,
  ChevronRight, ChevronDown, Zap, Settings, Download, Upload, X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { store, exportData, importData } from "./store.js";
import { syncHealthConnect } from "./healthSync.js";
import { scheduleRestAlarm, cancelRestAlarm, hideRestCountdown } from "./timerNotify.js";

const APP_VERSION = "3.9.0";

/* ============================================================
   PROTOCOLE — console perso de suivi (Yoann) · PWA
   Design "Affirmée" : noir profond, accent citron vert, mono.
   Logique inchangée : carnet série par série, mémoire des
   charges, timer, stockage local persistant, coach IA.
   ============================================================ */

/* ---------- jetons de design ---------- */
const C = {
  bg: "#050505",
  card: "#121212",
  border: "#2a2a2a",
  borderDim: "#232323",
  divider: "#1c1c1c",
  accent: "#d7ff3f",
  accentRow: "#0d1000",
  text: "#f5f5f0",
  text2: "#8a8a84",
  muted: "#6b6b66",
  dim: "#4a4a46",
  danger: "#ff3b30",
  dangerBg: "#1a0e0c",
  dangerBorder: "#4a1c14",
  dangerText: "#cc9999",
  mono: "ui-monospace, Menlo, Monaco, monospace",
};

/* ---------- utilitaires ---------- */
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => { const p = d.split("-"); return `${p[2]}/${p[1]}`; };
const byDate = (a, b) => a.date.localeCompare(b.date);
const upsert = (arr, entry) => {
  const i = arr.findIndex((e) => e.date === entry.date);
  const next = [...arr];
  if (i >= 0) next[i] = { ...next[i], ...entry }; else next.push(entry);
  return next.sort(byDate);
};
const lastN = (arr, n) => arr.slice(-n);
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
// entrées comprises dans les n derniers jours (fenêtre glissante, aujourd'hui inclus)
const withinDays = (arr, n) => arr.filter((e) => {
  const d = daysBetween(e.date, today());
  return d >= 0 && d <= n - 1;
});
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// heures décimales (7.5) → "7h30"
const fmtHM = (dec) => {
  if (dec == null || isNaN(dec)) return "—";
  let h = Math.floor(dec + 1e-9);
  let m = Math.round((dec - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
};
const longDate = (d) => new Date(d + "T12:00:00")
  .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

/* ============================================================
   DONNÉES DE RÉFÉRENCE
   ============================================================ */
const PHASES = {
  seche:       { label: "Sèche",       target: 93, msg: "Déficit modéré. Protéines hautes (≥ 2,2 g/kg) pour préserver le muscle en descendant vers 93 kg." },
  maintenance: { label: "Maintenance", target: null, msg: "Équilibre calorique. Protéines hautes maintenues. Poids cible éditable." },
  prise:       { label: "Prise",       target: 95, msg: "Léger surplus (~+10 %). Protéines hautes. Gain propre vers 95 kg (plafond de phase)." },
};
const phaseTarget = (phase, targets) =>
  PHASES[phase].target != null ? PHASES[phase].target : (targets.weightMaintenance ?? 96);

const TEMPLATES = {
  "Upper A": { kind: "muscu", exos: [
    { n: "Développé incliné haltères", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs, priorité · 1-2 reps en réserve" },
    { n: "Rowing barre ou machine", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise pronation/neutre (coude)" },
    { n: "Écarté poulie basse", s: 3, r: "12-15", rest: 90, mode: "reps", c: "ligne ascendante (haut des pecs)" },
    { n: "Extension triceps poulie haute", s: 3, r: "10-12", rest: 90, mode: "reps", c: "" },
    { n: "Élévations latérales haltères", s: 3, r: "12-15", rest: 75, mode: "reps", c: "variante haltères" },
    { n: "Face pull", s: 3, r: "15", rest: 60, mode: "reps", c: "arrière d'épaule" },
    { n: "Curl poignets pronation", s: 3, r: "15-20", rest: 60, mode: "reps", c: "léger, avant-bras" },
    { n: "Core — Planche", s: 3, r: "45-60 s", rest: 60, mode: "temps", c: "finisher · anti-extension · progresser par difficulté" },
  ]},
  "Upper B": { kind: "muscu", exos: [
    { n: "Développé couché haltères", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs, priorité" },
    { n: "Tirage vertical prise neutre", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude)" },
    { n: "Développé militaire haltères", s: 3, r: "8-10", rest: 120, mode: "reps", c: "" },
    { n: "Rear delt machine (reverse pec deck)", s: 3, r: "12-15", rest: 75, mode: "reps", c: "arrière d'épaule" },
    { n: "Élévations latérales poulie", s: 3, r: "12-15", rest: 75, mode: "reps", c: "variante poulie" },
    { n: "Curl marteau (prise neutre)", s: 3, r: "10-12", rest: 75, mode: "reps", c: "prise neutre (coude)" },
    { n: "Curl poignets supination", s: 3, r: "15-20", rest: 60, mode: "reps", c: "léger, avant-bras" },
    { n: "Core — Crunch machine", s: 3, r: "12-15", rest: 60, mode: "reps", c: "finisher · contrôlé, 1-2 reps en réserve" },
  ]},
  "Lower A": { kind: "muscu", knee: true, hsr: true, exos: [
    { n: "Iso leg extension @60° (si genou raide)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %" },
    { n: "Presse à cuisses (HSR)", s: 3, r: "table HSR", rest: 180, mode: "reps", hsr: true, c: "tempo 6 s · amplitude 10-60°" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné" },
    { n: "Leg extension unilatérale", s: 3, r: "table HSR", rest: 120, mode: "reps", hsr: true, perLeg: true, c: "tempo 6 s · par jambe" },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 150, mode: "reps", c: "genou peu sollicité" },
    { n: "Core — Planche", s: 3, r: "45-60 s", rest: 60, mode: "temps", c: "finisher · pas de crunch le jour du RDL" },
  ]},
  "Lower B": { kind: "muscu", knee: true, exos: [
    { n: "Presse à cuisses", s: 4, r: "8-10", rest: 180, mode: "reps", c: "contrôlé, reps + hautes" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné" },
    { n: "Leg extension unilatérale", s: 3, r: "8-10", rest: 120, mode: "reps", perLeg: true, c: "tempo 6 s · par jambe" },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou-safe" },
    { n: "Leg curl bilatéral", s: 3, r: "10-12", rest: 90, mode: "reps", c: "" },
    { n: "Core — Crunch machine", s: 3, r: "12-15", rest: 60, mode: "reps", c: "finisher · contrôlé, 1-2 reps en réserve" },
  ]},
  "Basket":   { kind: "sport", knee: true, exos: [] },
  "Escalade": { kind: "sport", climb: true, exos: [] },
};
const TYPES = Object.keys(TEMPLATES);

// Poids par défaut (kg) — haltères = par haltère, machines = valeur de la pile.
const DEFAULT_WEIGHTS = {
  "Développé incliné haltères": 32,
  "Développé couché haltères": 34,
  "Développé militaire haltères": 28,
  "Écarté poulie basse": 12.5,
  "Extension triceps poulie haute": 30,
  "Élévations latérales haltères": 16,
  "Élévations latérales poulie": 5,
  "Face pull": 30,
  "Rear delt machine (reverse pec deck)": 76,
  "Curl marteau (prise neutre)": 18,
  "Curl poignets pronation": 6,
  "Curl poignets supination": 14,
  "Rowing barre ou machine": 55,
  "Tirage vertical prise neutre": 80,
  "Presse à cuisses (HSR)": 200,
  "Presse à cuisses": 200,
  "Leg extension unilatérale": 25,
  "Iso leg extension @60° (si genou raide)": 25,
  "Mollets à la presse": 200,
  "Soulevé de terre roumain": 120,
  "Hip thrust": 200,
  "Leg curl bilatéral": 35,
  "Core — Crunch machine": 40,
};

const HSR_TABLE = [
  { wk: "1", from: 1, to: 1, scheme: "3 × 15RM" },
  { wk: "2-3", from: 2, to: 3, scheme: "3 × 12RM" },
  { wk: "4-5", from: 4, to: 5, scheme: "4 × 10RM" },
  { wk: "6-8", from: 6, to: 8, scheme: "4 × 8RM" },
  { wk: "9-12", from: 9, to: 12, scheme: "4 × 6RM" },
];
const hsrForWeek = (w) => HSR_TABLE.find((r) => w >= r.from && w <= r.to) || HSR_TABLE[0];
const hsrParse = (scheme) => {
  const m = scheme.match(/(\d+)\s*×\s*(\d+)/);
  return m ? { series: +m[1], reps: +m[2] } : { series: 3, reps: 10 };
};
const parseSecs = (str) => {
  const nums = String(str).match(/\d+/g);
  return nums ? +nums[nums.length - 1] : 30;
};
const refSet = (ex) => (ex.series || []).reduce((a, b) => ((b.poids ?? 0) > (a?.poids ?? -1) ? b : a), null);
function lastPerf(training, nom) {
  for (let i = training.length - 1; i >= 0; i--) {
    const s = training[i];
    const ex = s.exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) {
      const ref = refSet(ex) || ex.series[ex.series.length - 1];
      return { poids: ref.poids ?? 0, val: ref.val ?? 0, mode: ex.mode, date: s.date };
    }
  }
  return null;
}
function perfHistory(training, nom, n = 6) {
  const out = [];
  for (const s of training) {
    const ex = s.exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) {
      const ref = refSet(ex) || ex.series[ex.series.length - 1];
      out.push({ date: s.date, poids: ref.poids ?? 0, val: ref.val ?? 0, mode: ex.mode });
    }
  }
  return out.slice(-n);
}
function lastExerciseSets(training, nom) {
  for (let i = training.length - 1; i >= 0; i--) {
    const ex = training[i].exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) return ex.series;
  }
  return null;
}
const medianTarget = (r) => {
  const nums = String(r).match(/\d+/g);
  if (!nums) return "";
  if (nums.length === 1) return +nums[0];
  return Math.round((+nums[0] + +nums[nums.length - 1]) / 2);
};

const ROUTINES = {
  reeduc: {
    title: "Rééduc autonome",
    sub: "hors Lower A/B · 3ᵉ exposition genou · antalgique",
    blocks: [
      { label: "Iso leg extension unilatérale @60°", work: 45, rest: 120, rounds: 5, note: "effort ~70 %, douleur ≤ 3/10, doser par genou" },
      { label: "Iso flexion coude (prise marteau) + supination", work: 45, rest: 60, rounds: 4, note: "prise neutre, supination résistée en fin de tenue" },
    ],
  },
  basket: {
    title: "Échauffement basket",
    sub: "~15-20 min · douleur > 3/10 → réduire, ne pas forcer",
    blocks: [
      { label: "Cardio léger (vélo ou trot)", work: 300, rest: 0, rounds: 1, note: "élever la température" },
      { label: "Mobilité dynamique", work: 300, rest: 0, rounds: 1, note: "fentes marchées, balancements, hanche, chevilles" },
      { label: "Primer iso genou (wall-sit @60°)", work: 40, rest: 20, rounds: 4, note: "sous le seuil de douleur — antalgie + activation" },
      { label: "Montée en charge (squats PDC → sauts)", work: 60, rest: 30, rounds: 2, note: "amplitude/hauteur ↑ seulement si indolore" },
      { label: "Spécifique basket (accél/décél, shoots)", work: 120, rest: 0, rounds: 1, note: "changements de direction 70-80 %" },
    ],
  },
};

const PERI = [
  { t: "Avant muscu seule (séance ≤ 1h)", d: "Whey 30 g étalée du réveil jusqu'au début de la séance. Pas de glucides rapides nécessaires : les réserves de glycogène du repas de la veille suffisent pour une séance ≤ 1h. Caféine 200 mg si utile." },
  { t: "Muscu + escalade enchaînées", d: "Pas de glucides avant la muscu (whey seule, comme ci-dessus). 25-30 g de glucides rapides entre les deux séances, avant l'escalade." },
  { t: "Avant basket (1h-1h15)", d: "30-40 g glucides selon l'intensité prévue." },
  { t: "Pendant basket", d: "800 ml-1 L d'eau. +20 g glucides à la mi-temps si coup de mou." },
  { t: "Après basket", d: "Repos le lendemain → whey + 35-40 g glucides. Entraînement le lendemain → 40-50 g glucides. Post tardif : ratio glucides/protéines ~1,4:1." },
  { t: "Après muscu", d: "Intégrer au total protéique du jour — le timing exact n'est pas critique (c'est le total journalier qui compte)." },
];

// Protocoles détaillés basket — timing macro avant/pendant/après selon l'heure de la séance
const BASKET_PROTOCOLS = {
  soir21h: {
    title: "Entraînement 21h",
    sub: "session soirée · attention au sommeil qui suit",
    blocks: [
      { h: "Avant", items: [
        "Repas normal 18h-18h30 si possible (protéines + glucides + légumes), 2h30-3h avant.",
        "Sinon collation 20h-20h15 (45-60 min avant) : 30-40 g glucides rapides (pain, fruit) + whey si peu de protéines depuis le repas de midi.",
        "Hydratation : 500 ml dans les 2h précédentes.",
        "Caféine : à éviter après 18h-19h — la séance finit tard (~22h30), risque de perturber l'endormissement.",
      ]},
      { h: "Pendant", items: [
        "21h-22h30 : eau 500-750 ml par petites gorgées aux pauses.",
        "Si séance intense >1h avec sprints/sauts répétés : 20 g glucides rapides à la pause si sensation de fatigue.",
      ]},
      { h: "Après", items: [
        "22h30+ : whey 30 g dans les 30 min (≈25 g protéines).",
        "Si dîner déjà pris avant la séance : 20-30 g glucides supplémentaires suffisent avec la whey.",
        "Si pas dîné avant : repas léger et digeste (protéines maigres + glucides + légumes), éviter l'excès de lipides/fibres qui ralentit la digestion en fin de soirée.",
        "Terminer le repas ~1h avant le coucher pour ne pas nuire à l'endormissement.",
        "Eau : compléter les pertes (repère : 1 kg perdu ≈ 1 L à boire en plus).",
      ]},
    ],
  },
  midi12h: {
    title: "Entraînement 12h",
    sub: "session midi · déjeuner décalé",
    blocks: [
      { h: "Avant", items: [
        "Petit-déj normal 7h-8h (glucides + protéines).",
        "Collation 11h15-11h30 (30-45 min avant) : 20-30 g glucides rapides (banane, pain, bonbons) + eau 300-400 ml. Whey si petit-déj léger en protéines.",
        "Caféine : 200 mg 30-45 min avant si utile — pas de souci pour le sommeil à cette heure.",
      ]},
      { h: "Pendant", items: [
        "12h-13h/13h30 : eau 500-750 ml.",
        "Si séance longue (>1h) ou intense : 20 g glucides à la pause.",
      ]},
      { h: "Après (vrai déjeuner décalé)", items: [
        "Si le déjeuner est retardé de plus de 30-45 min après la séance : whey 20-25 g immédiatement pour ne pas attendre à jeun.",
        "Déjeuner complet dès que possible : protéines 150 g + glucides 150-200 g + légumes + huile d'olive crue 10 g.",
        "Eau : compléter les pertes de la séance.",
      ]},
    ],
  },
  match10h: {
    title: "Match dimanche 10h30",
    sub: "échauffement 9h45 · protocole complet validé",
    blocks: [
      { h: "Au réveil (7h ou 8h selon la nuit)", items: [
        "500 ml d'eau immédiatement.",
        "Caféine : 1 cachet 200 mg.",
      ]},
      { h: "10-15 min après le réveil", items: [
        "Petit-déj pré-match : pain blanc 2-3 tranches + miel + whey.",
        "(Pas de banane → remplacer par 1 tranche de pain en plus, ou 20 g de bonbons.)",
      ]},
      { h: "20-40 min après le petit-déj", items: [
        "Marche 15-20 min, allure tranquille — active circulation et digestion.",
      ]},
      { h: "Ensuite", items: [
        "Douche chaude 5-8 min (jamais froide avant un match — réduit la performance neuromusculaire).",
        "Mobilité 8-10 min : cercles épaules/hanches, fentes alternées, squats poids du corps, sauts légers sur place.",
      ]},
      { h: "Jusqu'au départ (9h)", items: [
        "Hydratation continue : 400-500 ml d'eau par petites gorgées.",
      ]},
      { h: "9h20-9h25 (pré-match)", items: [
        "Bonbons 30 g + eau 250 ml.",
      ]},
      { h: "9h45 — Échauffement", items: [
        "Gorgées d'eau régulières.",
      ]},
      { h: "Pendant le match (10h30-12h)", items: [
        "Temps morts : 100-150 ml eau.",
        "Mi-temps (~11h15) : 250 ml eau + 20 g bonbons si creux.",
        "Q3/Q4 : 100-150 ml eau par pause.",
        "Total visé : 800 ml-1 L d'eau.",
      ]},
      { h: "12h-12h30 (récupération immédiate)", items: [
        "Whey 1 dose (35 g) → 25 g P / 2 g G / 1 g L / 130 kcal.",
        "Bonbons 40 g → 32 g G / 145 kcal.",
        "Eau 500 ml.",
        "Total : 25 g P / 34 g G / 1 g L / 275 kcal.",
      ]},
      { h: "13h30-14h (vrai déjeuner)", items: [
        "Protéines : poulet ou poisson 150 g.",
        "Glucides : riz blanc ou patate douce 200 g.",
        "Légumes : 250 g.",
        "Huile d'olive crue : 10 g.",
        "Total : 41 g P / 65 g G / 13 g L / ~600 kcal.",
      ]},
      { h: "⚠ Ajustements selon le contexte de la veille", items: [
        "Réveil spontané plus tôt → se lever tout de suite, ne pas lutter au lit.",
        "Transit fragile / selles liquides (stress pré-match) → petit-déj sans fibres, sans lipides, sans laitage lourd ; réduire ou sauter la caféine si ventre sensible.",
        "Gros repas/soirée la veille → déjà chargé en glycogène, réduire glucides du petit-déj à 35-40 g au lieu de 50-60 g.",
        "Lever à 8h au lieu de 7h → décaler la mobilité à la salle (9h15) plutôt qu'à la maison, timing trop serré sinon.",
      ]},
    ],
  },
};

/* ============================================================
   RECOMMANDEUR — historique des séances + état du genou
   Sort des suggestions classées ET des séances à éviter.
   ============================================================ */
function recommendSessions({ training, knee }) {
  const t0 = today();
  const isUpper = (t) => t.type === "Upper A" || t.type === "Upper B";
  const isLower = (t) => t.type === "Lower A" || t.type === "Lower B";
  const within = (arr, n) => arr.filter((e) => daysBetween(e.date, t0) <= n);
  const daysSince = (pred) => {
    const hits = training.filter(pred);
    return hits.length ? daysBetween(hits[hits.length - 1].date, t0) : Infinity;
  };
  const ago = (d) => (isFinite(d) ? (d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`) : "jamais fait");
  const cap = (d) => (isFinite(d) ? Math.min(d, 7) : 7);

  // volume des 7 derniers jours
  const w = within(training, 6);
  const upper7 = w.filter(isUpper).length;
  const lower7 = w.filter(isLower).length;
  const basket7 = w.filter((t) => t.type === "Basket").length;
  const climb7 = w.filter((t) => t.type === "Escalade").length;

  const dUpper = daysSince(isUpper);
  const dLower = daysSince(isLower);
  const dBasket = daysSince((t) => t.type === "Basket");
  const dClimb = daysSince((t) => t.type === "Escalade");
  const dKnee = daysSince((t) => TEMPLATES[t.type]?.knee); // Lower + Basket

  // état du genou
  const kLast = lastN(knee, 1)[0];
  const painLast = kLast?.pain ?? null;
  const flagged7 = within(knee, 6).filter((k) => k.baseline === false).length;
  const kneeRed = !!kLast && (kLast.baseline === false || kLast.pain >= 6);
  const kneeAmber = !kneeRed && (painLast >= 4 || flagged7 >= 1);

  // ce qui est déjà fait aujourd'hui
  const todayTypes = training.filter((t) => t.date === t0).map((t) => t.type);
  const upperToday = todayTypes.some((x) => x.startsWith("Upper"));
  const lowerToday = todayTypes.some((x) => x.startsWith("Lower"));
  const climbToday = todayTypes.includes("Escalade");
  const kneeToday = todayTypes.some((x) => TEMPLATES[x]?.knee);

  // variante la moins récente
  const variant = (a, b) => {
    const da = daysSince((t) => t.type === a), db = daysSince((t) => t.type === b);
    return da >= db ? a : b;
  };

  const sugg = [], avoid = [];
  const push = (arr, type, score, reason) => arr.push({ type, score, reason });

  // ---- HAUT DU CORPS : jamais bloqué par le genou ----
  const upV = variant("Upper A", "Upper B");
  if (climbToday) {
    push(avoid, "Upper A / B", 0, "Escalade déjà faite aujourd'hui — volume de tirage sur le coude, ne pas empiler un Upper.");
  } else {
    let upScore = 20 + (2 - upper7) * 12 + cap(dUpper);
    let upReason = `Upper ${upper7}/2 cette semaine · dernier ${ago(dUpper)}.`;
    if (kneeRed) { upScore += 18; upReason += " Genou à ménager → c'est l'option sûre, jambes au repos."; }
    if (dClimb <= 1) { upScore -= 8; upReason += " Escalade récente : allège le tirage (coude)."; }
    if (dUpper === 0) { upScore -= 32; upReason = `Haut du corps déjà fait aujourd'hui (${upper7}/2 cette semaine) — à reprendre après récupération.`; }
    push(sugg, upV, upScore, upReason);
  }

  // ---- BAS DU CORPS ----
  if (kneeRed) {
    push(avoid, "Lower A / B", 0, `Genou : ${kLast.baseline === false ? "pas revenu à la base sous 24 h" : `douleur ${painLast}/10`}. Attendre le retour à la base.`);
  } else if (kneeToday || dKnee === 0) {
    push(avoid, "Lower A / B", 0, "Exposition genou déjà faite aujourd'hui — ne pas empiler.");
  } else if (dKnee <= 1) {
    push(avoid, "Lower A / B", 0, "Expo genou hier (Lower ou basket) — laisser ~48 h au tendon.");
  } else {
    const loV = variant("Lower A", "Lower B");
    let loScore = 20 + (2 - lower7) * 12 + cap(dLower) - (kneeAmber ? 10 : 0);
    let loReason = `Lower ${lower7}/2 cette semaine · dernier ${ago(dLower)}.`;
    if (kneeAmber) loReason += ` Genou sensible (${painLast}/10${flagged7 ? `, ${flagged7} j hors base` : ""}) → charge prudente, tempo 6 s.`;
    push(sugg, loV, loScore, loReason);
  }

  // ---- BASKET ----
  if (kneeRed) {
    push(avoid, "Basket", 0, "Sauts et changements de direction : à proscrire tant que le genou n'est pas revenu à sa base.");
  } else if (dKnee === 0 || kneeToday) {
    push(avoid, "Basket", 0, "Expo genou déjà faite aujourd'hui — deuxième dose déconseillée.");
  } else if (upperToday) {
    push(avoid, "Basket", 0, "Musculation (Upper) déjà faite aujourd'hui — basket déconseillé le même jour (fatigue générale).");
  } else {
    let bScore = 10 + cap(dBasket) - (kneeAmber ? 8 : 0) - (dKnee <= 1 ? 6 : 0);
    let bReason = `${basket7}× cette semaine · dernier ${ago(dBasket)}. Passer par l'échauffement guidé.`;
    if (kneeAmber) bReason += " Genou sensible : réduire le volume de sauts.";
    push(sugg, "Basket", bScore, bReason);
  }

  // ---- ESCALADE ---- (pas de jour attitré : autorisée surtout jours Lower ou off, jamais un jour Upper)
  if (upperToday) {
    push(avoid, "Escalade", 0, "Upper déjà fait aujourd'hui — l'escalade ajoute du volume de tirage (coude).");
  } else {
    let cScore = 10 + cap(dClimb) - (dClimb <= 1 ? 8 : 0) + (lowerToday ? 6 : 0);
    let cReason = `${climb7}× cette semaine · dernière ${ago(dClimb)}. Compte comme volume tirage : à placer un jour Lower ou off.`;
    if (lowerToday) cReason += " Lower déjà fait aujourd'hui : bon jour pour l'escalade (pas de conflit coude).";
    push(sugg, "Escalade", cScore, cReason);
  }

  // ---- REPOS ----
  push(sugg, "Repos / mobilité", kneeRed ? 45 : (upper7 + lower7 + basket7 + climb7 >= 6 ? 22 : 5),
    kneeRed ? "Décharge : mobilité douce + routine de rééduc autonome."
            : `${upper7 + lower7 + basket7 + climb7} séances sur 7 j — une journée creuse consolide les adaptations.`);

  return {
    suggestions: sugg.sort((a, b) => b.score - a.score).slice(0, 3),
    avoid,
  };
}

/* ============================================================
   PRIMITIVES UI (design "Affirmée")
   ============================================================ */
const Card = ({ children, style = {}, accentLeft = false, danger = false, onClick }) => (
  <div onClick={onClick} style={{
    background: danger ? C.dangerBg : C.card,
    border: `1.5px solid ${danger ? C.dangerBorder : C.border}`,
    borderLeft: accentLeft ? `3px solid ${C.accent}` : danger ? `3px solid ${C.danger}` : undefined,
    borderRadius: 10, padding: 14, ...style,
  }}>{children}</div>
);

const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: C.muted, fontWeight: 700, ...style }}>{children}</div>
);

const Body = ({ children, style = {} }) => (
  <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.5, ...style }}>{children}</div>
);

const Big = ({ value, unit, color = C.text, size = 44 }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
    <span style={{ fontFamily: C.mono, fontSize: size, fontWeight: 800, color, letterSpacing: -1 }}>{value}</span>
    {unit && <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{unit}</span>}
  </div>
);

const Empty = ({ children }) => (
  <div style={{ textAlign: "center", color: C.dim, fontSize: 12, padding: "34px 0" }}>{children}</div>
);

function Btn({ children, onClick, variant = "outline", style = {}, disabled }) {
  const v = {
    primary: { background: C.accent, color: "#000", border: `1.5px solid ${C.accent}` },
    outline: { background: C.card, color: C.accent, border: `1.5px solid ${C.accent}` },
    plain:   { background: C.card, color: C.text2, border: `1.5px solid ${C.border}` },
    ghost:   { background: "transparent", color: C.muted, border: "1.5px solid transparent" },
    danger:  { background: "transparent", color: C.danger, border: `1.5px solid ${C.dangerBorder}` },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
      opacity: disabled ? 0.4 : 1, fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
}

// Bandeau affiché à la place de la saisie quand la donnée du jour vient de Health Connect —
// avec un accès de secours pour corriger manuellement (jour manquant, valeur fausse).
const SyncedBanner = ({ onCorrect }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
    <Body style={{ fontSize: 11, color: C.dim }}>
      <Zap size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} color={C.accent} />
      Synchronisé depuis Health Connect
    </Body>
    <Btn variant="ghost" onClick={onCorrect} style={{ padding: "4px 8px", fontSize: 10 }}>Corriger manuellement</Btn>
  </div>
);

const inputStyle = (focused = false) => ({
  background: C.bg, border: `1.5px solid ${focused ? C.accent : C.border}`,
  borderRadius: 6, padding: "8px 10px", fontFamily: C.mono, fontSize: 13,
  color: C.text, fontWeight: 700, width: "100%", outline: "none",
});

function TextInput({ value, onChange, placeholder, type = "text", inputMode, style = {} }) {
  const [foc, setFoc] = useState(false);
  return (
    <input type={type} inputMode={inputMode} value={value} placeholder={placeholder}
      onChange={onChange} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
      style={{ ...inputStyle(foc), ...style }} />
  );
}

function Stepper({ value, set, step = 1, unit = "", min = 0, max = null, int = false }) {
  const clamp = (v) => {
    let x = int ? Math.round(v) : round(v, 2);
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };
  const [txt, setTxt] = useState(String(value));
  const [foc, setFoc] = useState(false);
  useEffect(() => { setTxt(String(value)); }, [value]);
  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(",", "."));
    if (isNaN(n)) { setTxt(String(value)); return; }
    const v = clamp(n); set(v); setTxt(String(v));
  };
  const bump = (d) => set(clamp((Number(value) || 0) + d));
  const sq = { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 6,
    color: C.accent, width: 38, height: 36, fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => bump(-step)} style={sq}>–</button>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
        <input type="text" inputMode="decimal" value={txt}
          onChange={(e) => setTxt(e.target.value.replace(",", "."))}
          onFocus={() => setFoc(true)}
          onBlur={(e) => { setFoc(false); commit(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ ...inputStyle(foc), textAlign: "center", fontSize: 16 }} />
        {unit && <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{unit}</span>}
      </div>
      <button onClick={() => bump(step)} style={sq}>+</button>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label style={{ marginBottom: 5 }}>{label}</Label>
    {children}
  </div>
);

const DateField = ({ value, onChange }) => (
  <Field label="Date">
    <input type="date" value={value} max={today()} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle(false), fontSize: 13 }} />
  </Field>
);

function Pills({ options, value, onChange, small = false }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={String(o.key)} onClick={() => onChange(o.key)} style={{
            padding: small ? "5px 10px" : "7px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: small ? 11 : 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
            background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
            border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

const ScreenHeader = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 16, color: C.text, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

const chartAxis = { fontSize: 10, fill: C.muted };
const tooltipStyle = { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text };
// recharts met la valeur en noir par défaut (invisible sur fond sombre) sans itemStyle explicite
const tooltipItemStyle = { color: C.text, fontWeight: 700 };

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
function CoachIA({ coach, todayNote, saveNote }) {
  const [state, setState] = useState("idle");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState(todayNote || "");
  const [openNote, setOpenNote] = useState(false);

  const run = async () => {
    if (!coach.apiKey) {
      setErr("Ajoute ta clé API Anthropic dans Réglages pour activer l'analyse.");
      setState("error"); return;
    }
    saveNote(note);
    setState("loading"); setErr("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": coach.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: coach.model || "claude-sonnet-5",
          max_tokens: 6000,
          messages: [{ role: "user", content: coach.buildPrompt(note) }],
        }),
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok || !data || data.type === "error") {
        throw new Error(data?.error?.message || `HTTP ${res.status} ${res.statusText}`.trim());
      }
      const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
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
      {state === "idle" && <Body style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Analyse tes 14 derniers jours (poids, macros, eau, séances, sommeil, genou), au jour le jour et sur la semaine glissante. Nécessite ta clé API (Réglages).</Body>}
    </Card>
  );
}

/* ============================================================
   TAB — DASHBOARD
   ============================================================ */
function Dashboard({ weight, sleep, knee, macros, steps, targets, training, phase, setPhase, coach, todayNote, saveNote, setTab }) {
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(weight, 1)[0];
  const wDelta = wLast ? round(wLast.kg - tgtW) : null;

  // sommeil : vraie fenêtre glissante de 7 jours
  const sleep7arr = withinDays(sleep, 7);
  const sleep7 = avg(sleep7arr.map((s) => s.hours));

  const kLast = lastN(knee, 1)[0];
  const mToday = macros.find((m) => m.date === today());
  const kcalToday = mToday
    ? Math.round((mToday.protein ?? 0) * 4 + (mToday.carbs ?? 0) * 4 + (mToday.fat ?? 0) * 9)
    : null;

  const { suggestions, avoid } = useMemo(() => recommendSessions({ training, knee }), [training, knee]);

  const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
  const waterTgt = targets.water + (basketToday ? 1000 : 0);
  const kcalTgt = (() => { const a = targetsForDate(today(), targets); return Math.round(a.protein * 4 + a.carbs * 4 + a.fat * 9); })();

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
    { label: "Sommeil", tab: "sleep", val: sleep7 != null ? fmtHM(sleep7) : "—", unit: "",
      note: `7j · ${sleep7arr.length} nuit${sleep7arr.length > 1 ? "s" : ""}`, color: C.text },
    { label: "Genou", tab: "knee", val: kLast ? kLast.pain : "—", unit: "/10", note: kLast ? fmt(kLast.date) : "—",
      color: kLast && (kLast.baseline === false || kLast.pain >= 6) ? C.danger : C.accent },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Tuiles : poids/pas · calories/eau · sommeil/genou — toutes cliquables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.label} onClick={() => setTab(t.tab)} style={{
            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: 11, cursor: "pointer",
          }}>
            <Label>{t.label}</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: t.color }}>
                {t.val}<span style={{ fontSize: 11, color: C.muted }}>{t.unit}</span>
              </span>
              {t.extra && (
                <span style={{ fontSize: 11, color: t.extra.col, fontWeight: 700, marginLeft: "auto" }}>{t.extra.txt}</span>
              )}
            </div>
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
        <div style={{ fontSize: 16, color: C.text, fontWeight: 800, marginBottom: 3 }}>{suggestions[0]?.type}</div>
        <Body>{suggestions[0]?.reason}</Body>
        {suggestions.slice(1).map((r) => (
          <div key={r.type} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ fontSize: 12, color: C.text2, fontWeight: 700 }}>{r.type}</div>
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
      <CoachIA coach={coach} todayNote={todayNote} saveNote={saveNote} />

      {/* Phase */}
      <Card>
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 11 }}>{PHASES[phase].msg}</Body>
      </Card>

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
  const [kg, setKg] = useState(lastN(weight, 1)[0]?.kg ?? 95);
  const pickDate = (d) => { setDate(d); const e = weight.find((w) => w.date === d); if (e) setKg(e.kg); };
  const wLast = lastN(weight, 1)[0];
  const data = lastN(weight, 60).map((w) => ({ date: fmt(w.date), kg: w.kg }));
  const add = () => save.weight(upsert(weight, { date, kg: round(kg) }));

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
        <Field label="Poids (kg)"><Stepper value={kg} set={setKg} step={0.1} unit="kg" min={40} /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
          {weight.some((w) => w.date === date) && (
            <Btn variant="danger" onClick={() => save.weight(weight.filter((w) => w.date !== date))}><Trash2 size={14} /></Btn>
          )}
        </div>
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
        <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Dernière nuit</Label>
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

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <Label>Moy. 7j</Label>
          <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 3 }}>{avg7 != null ? fmtHM(avg7) : "—"}</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <Label>Cible</Label>
          <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.accent, marginTop: 3 }}>8h</div>
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
                <Pills options={[1, 2, 3, 4, 5].map((n) => ({ key: n, label: "★".repeat(n) }))} value={quality} onChange={setQuality} small />
              </Field>
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
function MuscuLogger({ type, training, hsrWeek, date, onDate, onSave, onCancel }) {
  const template = TEMPLATES[type];
  const hp = hsrParse(hsrForWeek(hsrWeek).scheme);

  const buildExos = () => template.exos.map((ex) => {
    const nSeries = ex.hsr ? hp.series : ex.s;
    const last = lastPerf(training, ex.n);
    const lastSets = lastExerciseSets(training, ex.n);
    const target = ex.hsr ? `${hp.reps}` : ex.r;
    const def = DEFAULT_WEIGHTS[ex.n];
    const medVal = medianTarget(target);
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

  const [start, setStart] = useState(() => new Date().toTimeString().slice(0, 5));
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
  const beep = () => {
    try {
      const ctx = audioRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        [0, 0.2, 0.4].forEach((t) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.value = 880;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
          o.start(now + t); o.stop(now + t + 0.17);
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
    if (prevRem.current > 0 && tRem === 0) { beep(); hideRestCountdown(); }
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
      id: `${date}-${type}-${Date.now()}`,
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
  const GRID = "20px 1fr 1fr 26px 18px";

  const renderRows = (e, ei, legFilter) => e.series
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => legFilter == null || s.leg === legFilter)
    .map(({ s, si }, n) => (
      <div key={si} style={{ display: "grid", gridTemplateColumns: GRID, gap: 7, alignItems: "center" }}>
        <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted, fontWeight: 700 }}>{n + 1}</span>
        <TextInput value={s.poids} inputMode="decimal" placeholder="kg"
          onChange={(ev) => upd(ei, si, "poids", ev.target.value.replace(",", "."))} style={{ padding: "7px 8px" }} />
        <TextInput value={s.val} inputMode="numeric" placeholder={e.mode === "temps" ? "sec" : e.target}
          onChange={(ev) => upd(ei, si, "val", ev.target.value)} style={{ padding: "7px 8px" }} />
        <button onClick={() => toggle(ei, si)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: s.fait ? C.accent : C.dim, display: "flex", justifyContent: "center",
        }}>{s.fait ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <button onClick={() => rmSet(ei, si)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.dim }}>
          <X size={13} />
        </button>
      </div>
    ));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* En-tête séance + timer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1.5px solid ${C.divider}` }}>
        <div>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 800, textTransform: "uppercase" }}>{type}</div>
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

                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 7, fontSize: 9,
                  color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 6px", fontWeight: 700 }}>
                  <span>Sér</span><span>Poids</span><span>{e.mode === "temps" ? "Sec" : "Reps"}</span><span /><span />
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
          <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />Valider la séance
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
      </div>
    </div>
  );
}

/* ============================================================
   TAB — SÉANCES
   ============================================================ */
function TrainTab({ training, save, hsrWeek, setHsrWeek }) {
  const [open, setOpen] = useState(null);
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(60);
  const [rpe, setRpe] = useState(7);

  const logSession = (type) => {
    save.training([...training, { date, type, start: startTime, duration: round(duration), rpe }].sort(byDate));
    setOpen(null);
  };
  const saveMuscu = (rec) => { save.training([...training, rec].sort(byDate)); setOpen(null); };

  const vol = {};
  training.filter((t) => daysBetween(t.date, today()) <= 14).forEach((t) => { vol[t.type] = (vol[t.type] || 0) + 1; });

  if (open && TEMPLATES[open]?.kind === "muscu") {
    return (
      <MuscuLogger type={open} training={training} hsrWeek={hsrWeek} date={date} onDate={setDate}
        onSave={saveMuscu} onCancel={() => setOpen(null)} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Séances" subtitle="carnet · progressive overload" />

      {/* Choix du type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TYPES.map((type) => {
          const sel = open === type;
          return (
            <button key={type} onClick={() => setOpen(sel ? null : type)} style={{
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
          <div style={{ fontSize: 14, color: C.accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>{open}</div>
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
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={() => logSession(open)} style={{ flex: 1 }}>
              <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer
            </Btn>
            <Btn variant="ghost" onClick={() => setOpen(null)}>Annuler</Btn>
          </div>
        </Card>
      )}

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
        {training.length ? lastN(training, 10).reverse().map((t, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.divider}` }}>
            <div>
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{t.type}</span>
              <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 8, fontFamily: C.mono }}>{fmt(t.date)}{t.start ? ` · ${t.start}` : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>
                {t.exercices
                  ? `${t.exercices.length} exos · ${t.exercices.reduce((a, e) => a + (e.series?.length || 0), 0)} séries`
                  : `${t.duration != null ? t.duration + "′" : ""}${t.rpe != null ? ` · RPE ${t.rpe}` : ""}`}
              </span>
              <button onClick={() => save.training(training.filter((x) => x !== t))}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )) : <Empty>Aucune séance enregistrée.</Empty>}
      </Card>
    </div>
  );
}

/* ============================================================
   TAB — GENOU
   ============================================================ */
function KneeTab({ knee, save, hsrWeek }) {
  const [date, setDate] = useState(today());
  const [pain, setPain] = useState(4);
  const [baseline, setBaseline] = useState(true);
  const [routine, setRoutine] = useState(null);
  const pickDate = (d) => { setDate(d); const e = knee.find((k) => k.date === d); if (e) { setPain(e.pain); setBaseline(e.baseline !== false); } };
  const add = () => save.knee(upsert(knee, { date, pain, baseline }));

  const kLast = lastN(knee, 1)[0];
  const alert = kLast && (kLast.baseline === false || kLast.pain >= 6);
  const data = lastN(knee, 30).map((k) => ({ date: fmt(k.date), pain: k.pain, flag: k.baseline === false }));
  const curRow = hsrForWeek(hsrWeek);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Genou · réhab" subtitle="tendon quadricipital · HSR · Silbernagel" />

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
          <div style={{ fontSize: 12, color: C.danger, fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>⚠ Signal de surcharge</div>
          <Body style={{ color: C.dangerText }}>Décharge : pas de basket ni de Lower tant que la douleur n'est pas revenue à sa base. Réduire charge ou amplitude à la prochaine exposition.</Body>
        </Card>
      )}

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <Label style={{ marginBottom: 6 }}>Douleur (0-10)</Label>
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
          <Btn variant="primary" onClick={add} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
          {knee.some((k) => k.date === date) && (
            <Btn variant="danger" onClick={() => save.knee(knee.filter((k) => k.date !== date))}><Trash2 size={14} /></Btn>
          )}
        </div>
      </Card>

      {/* Table HSR */}
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

      {/* Routines guidées */}
      {routine ? (
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
      )}
    </div>
  );
}

/* ============================================================
   TAB — MACROS
   ============================================================ */
function MacroTab({ macros, targets, save, training }) {
  const [date, setDate] = useState(today());
  const at = targetsForDate(date, targets);
  const cur = macros.find((m) => m.date === date) || {};
  const [p, setP] = useState(cur.protein ?? at.protein);
  const [c, setC] = useState(cur.carbs ?? at.carbs);
  const [f, setF] = useState(cur.fat ?? at.fat);
  const [fib, setFib] = useState(cur.fiber ?? at.fiber);
  const [showPeri, setShowPeri] = useState(false);
  const [basketProto, setBasketProto] = useState("soir21h");
  const [forceManual, setForceManual] = useState(false);
  const water = cur.water ?? 0;
  const basketDay = training.some((t) => t.type === "Basket" && t.date === date);
  const waterTgt = targets.water + (basketDay ? 1000 : 0);
  const isSynced = cur.source === "healthconnect" && !forceManual;
  const pickDate = (d) => {
    setDate(d);
    const atd = targetsForDate(d, targets);
    const e = macros.find((m) => m.date === d);
    setP(e?.protein ?? atd.protein); setC(e?.carbs ?? atd.carbs);
    setF(e?.fat ?? atd.fat); setFib(e?.fiber ?? atd.fiber);
    setForceManual(false);
  };
  const kcal = p * 4 + c * 4 + f * 9;
  const saveMacros = () => save.macros(upsert(macros, { date, protein: round(p), carbs: round(c), fat: round(f), fiber: round(fib), water, source: "manual" }));
  const addWater = (ml) => {
    const next = Math.max(0, (macros.find((m) => m.date === date)?.water ?? 0) + ml);
    save.macros(upsert(macros, { date, water: next, source: "manual" }));
  };
  const kcalTrend = lastN(macros, 14).map((m) => ({
    date: fmt(m.date),
    kcal: Math.round((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fat ?? 0) * 9),
  }));
  const kcalTarget = Math.round(at.protein * 4 + at.carbs * 4 + at.fat * 9);
  const kcalPct = Math.min(100, (kcal / kcalTarget) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Macros" subtitle={date === today() ? "aujourd'hui" : fmt(date)} />

      {/* Calories — héro */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label style={{ fontSize: 10, letterSpacing: 1.5 }}>Calories</Label>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>cible {kcalTarget} kcal</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 10px" }}>
          <span style={{ fontFamily: C.mono, fontSize: 38, fontWeight: 800, color: C.text }}>{Math.round(kcal)}</span>
          <span style={{ fontSize: 15, color: C.muted, fontWeight: 700 }}>/{kcalTarget} kcal</span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ background: C.accent, width: `${kcalPct}%`, height: "100%" }} />
        </div>
      </Card>

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

      {/* Eau */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Droplet size={13} color={C.accent} />
            <Label style={{ fontSize: 10 }}>Eau</Label>
            {basketDay && <span style={{ fontSize: 9, color: "#000", background: C.accent, padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>+1 L BASKET</span>}
          </div>
          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.accent, fontWeight: 800 }}>
            {(water / 1000).toFixed(2)} / {(waterTgt / 1000).toFixed(1)} L
          </span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ background: C.accent, width: `${Math.min(100, (water / waterTgt) * 100)}%`, height: "100%" }} />
        </div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="plain" onClick={() => addWater(250)} style={{ flex: 1 }}>+250 ml</Btn>
            <Btn variant="plain" onClick={() => addWater(500)} style={{ flex: 1 }}>+500 ml</Btn>
            <Btn variant="ghost" onClick={() => addWater(-250)}>−250</Btn>
          </div>
        )}
      </Card>

      {/* Saisie */}
      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        {isSynced ? (
          <SyncedBanner onCorrect={() => setForceManual(true)} />
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
                <Btn variant="danger" onClick={() => { save.macros(macros.filter((m) => m.date !== date)); setP(at.protein); setC(at.carbs); setF(at.fat); setFib(at.fiber); }}>
                  <Trash2 size={14} />
                </Btn>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Tendance calories */}
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
function SettingsPanel({ apiKey, setApiKey, model, setModel, onClose, healthSync, onHealthSync }) {
  const [k, setK] = useState(apiKey);
  const [m, setM] = useState(model);
  const [msg, setMsg] = useState("");
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
        await Share.share({ title: name, files: [uri] });
        setMsg("Export prêt — choisis où l'enregistrer.");
      } catch (e) {
        setMsg(`Export impossible : ${e?.message || e}`);
      }
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
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
        <Label style={{ marginBottom: 8 }}>Sauvegarde des données</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" onClick={doExport} style={{ flex: 1 }}>
            <Download size={14} style={{ display: "inline", marginRight: 4 }} />Exporter
          </Btn>
          <label style={{ flex: 1 }}>
            <span style={{
              display: "block", textAlign: "center", background: C.card, color: C.accent,
              border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: "9px 12px",
              fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
            }}><Upload size={14} style={{ display: "inline", marginRight: 4 }} />Importer</span>
            <input type="file" accept="application/json" onChange={doImport} style={{ display: "none" }} />
          </label>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          Exporte régulièrement : c'est ta seule sauvegarde. Vider les données du navigateur effacerait l'app.
        </Body>
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
      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", fontFamily: C.mono }}>PROTOCOLE v{APP_VERSION}</Body>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
const DEFAULT_TARGETS = { protein: 215, carbs: 205, fat: 80, fiber: 30, water: 3000, weightMaintenance: 96 };

// Sèche intensive avant vacances — cibles macro temporaires, réactivation auto de DEFAULT_TARGETS après le 18/08.
const TEMP_MACROS_WINDOW = { start: "2026-07-27", end: "2026-08-18" };
const TEMP_MACROS = { protein: 220, carbs: 185, fat: 65, fiber: 30 };
const isTempMacrosWindow = (d) => d >= TEMP_MACROS_WINDOW.start && d <= TEMP_MACROS_WINDOW.end;
// eau non concernée : la base + le bonus dynamique basket restent inchangés
const targetsForDate = (d, base) => (isTempMacrosWindow(d) ? { ...base, ...TEMP_MACROS } : base);

export default function App() {
  const [tab, setTab] = useState("dash");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  const [weight, setWeight] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [training, setTraining] = useState([]);
  const [knee, setKnee] = useState([]);
  const [macros, setMacros] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [phase, setPhaseState] = useState("seche");
  const [hsrWeek, setHsrWeekState] = useState(1);
  const [apiKey, setApiKeyState] = useState("");
  const [model, setModelState] = useState("claude-sonnet-5");

  useEffect(() => {
    (async () => {
      setWeight(await store.get("weightLog", []));
      setSleep(await store.get("sleepLog", []));
      setTraining(await store.get("trainingLog", []));
      setKnee(await store.get("kneeLog", []));
      setMacros(await store.get("macroLog", []));
      setSteps(await store.get("stepsLog", []));
      setNotes(await store.get("noteLog", []));
      setTargets(await store.get("targets", DEFAULT_TARGETS));
      setPhaseState(await store.get("phase", "seche"));
      setHsrWeekState(await store.get("hsrWeek", 1));
      setApiKeyState(await store.get("apiKey", ""));
      setModelState(await store.get("model", "claude-sonnet-5"));
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
        Object.entries(result.sleepByDate).forEach(([date, hours]) => { next = upsert(next, { date, hours: round(hours, 2), source: "healthconnect" }); });
        store.set("sleepLog", next);
        return next;
      });
    }
    if (Object.keys(result.macrosByDate || {}).length) {
      setMacros((prev) => {
        let next = prev;
        // upsert fusionne : les champs absents (jour sans eau, p. ex.) gardent leur valeur locale.
        Object.entries(result.macrosByDate).forEach(([date, m]) => { next = upsert(next, { date, ...m, source: "healthconnect" }); });
        store.set("macroLog", next);
        return next;
      });
    }
    setHealthSync({ status: "ok", at: new Date().toISOString() });
  };

  useEffect(() => {
    if (loading) return;
    runHealthSync();
  }, [loading]);

  // Resynchro à chaque retour au premier plan (pas seulement au lancement à froid)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener("resume", () => runHealthSync());
    return () => { handle.then((h) => h.remove()); };
  }, []);

  const save = {
    weight: (v) => { setWeight(v); store.set("weightLog", v); },
    sleep: (v) => { setSleep(v); store.set("sleepLog", v); },
    training: (v) => { setTraining(v); store.set("trainingLog", v); },
    knee: (v) => { setKnee(v); store.set("kneeLog", v); },
    macros: (v) => { setMacros(v); store.set("macroLog", v); },
    steps: (v) => { setSteps(v); store.set("stepsLog", v); },
    notes: (v) => { setNotes(v); store.set("noteLog", v); },
    targets: (v) => { setTargets(v); store.set("targets", v); },
  };
  const setPhase = (v) => { setPhaseState(v); store.set("phase", v); };
  const setHsrWeek = (v) => { setHsrWeekState(v); store.set("hsrWeek", v); };
  const setApiKey = (v) => { setApiKeyState(v); store.set("apiKey", v); };
  const setModel = (v) => { setModelState(v); store.set("model", v); };

  const todayNote = notes.find((n) => n.date === today())?.text || "";
  const saveNote = (text) => {
    const t = (text || "").trim();
    const rest = notes.filter((n) => n.date !== today());
    save.notes(t ? [...rest, { date: today(), text: t }].sort(byDate) : rest);
  };

  const coach = {
    buildPrompt: (note) => {
      const tgtW = phaseTarget(phase, targets);
      const win = (arr, a, b) => arr.filter((e) => { const d = daysBetween(e.date, today()); return d >= a && d <= b; });
      const last14 = (arr) => arr.filter((e) => daysBetween(e.date, today()) <= 14).sort(byDate);
      const avgKey = (arr, k) => { const v = arr.map((e) => e[k]).filter((x) => x != null); return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
      const w7 = avgKey(win(weight, 0, 6), "kg"), w14 = avgKey(win(weight, 7, 13), "kg");
      const m7 = win(macros, 0, 6);
      const sessCount = (a, b) => { const o = {}; win(training, a, b).forEach((t) => { o[t.type] = (o[t.type] || 0) + 1; }); return o; };
      const kLast = lastN(knee, 1)[0] ?? null;
      const compact = (s) => s.exercices
        ? { d: s.date, t: s.type, ex: s.exercices.map((e) => ({ n: e.nom, s: e.series.map((x) => `${x.poids || 0}x${x.val || 0}${x.leg ? "/" + x.leg : ""}`) })) }
        : { d: s.date, t: s.type, ...(s.duration != null ? { min: s.duration } : {}), ...(s.rpe != null ? { rpe: s.rpe } : {}) };

      // --- temps réel : hier vs aujourd'hui, avec deltas explicites ---
      const findDay = (arr, d) => arr.find((e) => e.date === d);
      const y = (() => { const t = new Date(today()); t.setDate(t.getDate() - 1); return t.toISOString().slice(0, 10); })();
      const wToday = findDay(weight, today()), wYest = findDay(weight, y);
      const mToday = findDay(macros, today()), mYest = findDay(macros, y);
      const sToday = findDay(sleep, today()), sYest = findDay(sleep, y);
      const kToday = findDay(knee, today()), kYest = findDay(knee, y);
      const trToday = training.filter((t) => t.date === today());
      const trYest = training.filter((t) => t.date === y);
      const basketTodayFlag = trToday.some((t) => t.type === "Basket");
      const waterTgtToday = targets.water + (basketTodayFlag ? 1000 : 0);
      const atToday = targetsForDate(today(), targets);
      const sToday_steps = findDay(steps, today()), sYest_steps = findDay(steps, y);
      const steps7 = avgKey(win(steps, 0, 6), "count");

      const realtime = {
        hier: y, aujourdhui: today(),
        poids: { hier: wYest?.kg ?? null, aujourdhui: wToday?.kg ?? null,
          delta: (wYest?.kg != null && wToday?.kg != null) ? round(wToday.kg - wYest.kg) : null },
        sommeil_nuit_derniere: sToday ? { heures: round(sToday.hours, 2), qualite: sToday.quality ?? null } : null,
        sommeil_avant_hier: sYest ? { heures: round(sYest.hours, 2), qualite: sYest.quality ?? null } : null,
        macros_hier: mYest ? { proteines: mYest.protein, glucides: mYest.carbs, lipides: mYest.fat, fibres: mYest.fiber, eau_ml: mYest.water } : null,
        macros_aujourdhui_en_cours: mToday ? { proteines: mToday.protein, glucides: mToday.carbs, lipides: mToday.fat, fibres: mToday.fiber, eau_ml: mToday.water, cible_eau_ml: waterTgtToday } : null,
        pas_hier: sYest_steps?.count ?? null, pas_aujourdhui: sToday_steps?.count ?? null,
        seances_hier: trYest.map((t) => t.type),
        seances_aujourdhui: trToday.map((t) => t.type),
        douleur_genou_hier: kYest ? { pain: kYest.pain, base_ok: kYest.baseline !== false } : null,
        douleur_genou_aujourdhui: kToday ? { pain: kToday.pain, base_ok: kToday.baseline !== false } : null,
      };

      const summary = {
        phase: PHASES[phase].label, poids_cible: tgtW,
        poids: { dernier: lastN(weight, 1)[0]?.kg ?? null, moy_7j: w7, moy_7j_precedents: w14, tendance_kg_sur_semaine: (w7 != null && w14 != null) ? round(w7 - w14) : null },
        macros_moy_7j: { proteines: avgKey(m7, "protein"), glucides: avgKey(m7, "carbs"), lipides: avgKey(m7, "fat"), fibres: avgKey(m7, "fiber"), eau_ml: avgKey(m7, "water") },
        cibles: { proteines: atToday.protein, glucides: atToday.carbs, lipides: atToday.fat, fibres: atToday.fiber, eau_ml: targets.water },
        sommeil: { heures_moy_7j: avgKey(win(sleep, 0, 6), "hours"), qualite_moy_7j: avgKey(win(sleep, 0, 6), "quality") },
        pas_moy_7j: steps7 != null ? Math.round(steps7) : null,
        seances_7j: sessCount(0, 6), seances_14j: sessCount(0, 13),
        genou: { derniere_douleur: kLast?.pain ?? null, base_ok: kLast ? kLast.baseline !== false : null, jours_hors_base_14j: win(knee, 0, 13).filter((k) => k.baseline === false).length },
      };

      const notesTxt = last14(notes).map((n) => `${n.date} : ${n.text}`).join("\n")
        + ((note || "").trim() && !notes.some((n) => n.date === today() && n.text === note.trim())
            ? `${last14(notes).length ? "\n" : ""}${today()} : ${note.trim()}` : "");

      // dataset fusionné jour par jour (pour corrélation poids ↔ macros/eau/fibres/pas) — remplace les tableaux bruts séparés
      const days14 = [...new Set([...last14(weight), ...last14(macros), ...last14(steps)].map((e) => e.date))].sort();
      const merged = days14.map((d) => {
        const w = weight.find((e) => e.date === d);
        const m = macros.find((e) => e.date === d);
        const st = steps.find((e) => e.date === d);
        const kcal = m ? Math.round((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fat ?? 0) * 9) : null;
        return { date: d, poids: w?.kg ?? null, kcal, proteines: m?.protein ?? null, glucides: m?.carbs ?? null, lipides: m?.fat ?? null, fibres: m?.fiber ?? null, eau_ml: m?.water ?? null, pas: st?.count ?? null, cible_kcal: Math.round(targetsForDate(d, targets).protein * 4 + targetsForDate(d, targets).carbs * 4 + targetsForDate(d, targets).fat * 9) };
      });

      const inTempWindow = isTempMacrosWindow(today());
      const tempBlock = inTempWindow ? `

CONTEXTE SPÉCIAL — SÈCHE INTENSIVE AVANT VACANCES (27/07 → 18/08/2026, départ le 18/08) :
Point de départ 101 kg le 27/07. Projection réaliste : 96-97,5 kg au 18/08 (pas 93 kg — l'objectif est de s'en rapprocher visuellement, pas de l'atteindre sur la balance). Décomposition attendue : environ 3-3,5 kg d'eau/glycogène perdus rapidement sur les 10-14 premiers jours, le reste est de la vraie perte de gras à un rythme plus lent. Règle de lecture stricte : NE PAS commenter la tendance de poids avant le 05/08/2026 (avant cette date les chiffres sont pollués par la perte d'eau/glycogène, pas représentatifs) — au-delà de cette date, utilise toujours la moyenne glissante 7j, jamais un poids isolé. Cibles macros actives pour cette période : ${atToday.protein}P/${atToday.carbs}G/${atToday.fat}L/${atToday.fiber}fibres (~${Math.round(atToday.protein * 4 + atToday.carbs * 4 + atToday.fat * 9)} kcal). Volume d'entraînement : NE JAMAIS suggérer d'ajouter une séance ou du cardio à impact supplémentaire par rapport au basket habituel — contre-indication explicite pour cette période (risque tendineux genou/coude). Escalade : pas de jour attitré, à privilégier les jours Lower ou off, jamais un jour Upper. Prends en compte les pas quotidiens dans l'analyse de tendance (corrélation activité/résultat).` : "";

      return `Tu es le coach personnel tout-en-un de Yoann, 43 ans, athlète (muscu/basket/escalade) : à la fois coach sportif, kinésithérapeute, nutritionniste et coach de vie. Phase ${PHASES[phase].label}, poids cible ${tgtW} kg. Deux tendinopathies en rééduc : tendon quadricipital (HSR, tempo 6 s, règle de Silbernagel : douleur ≤ 3-5/10 tolérée si retour à la base sous 24 h) et distale du biceps (prises neutres/pronation privilégiées, supination limitée). Protéines hautes prioritaires. Escalade = volume tirage, jamais empilée le jour d'un Upper ; ne pas cumuler les expositions genou.${tempBlock}

TEMPS RÉEL — hier vs aujourd'hui (regarde d'abord ça, c'est le plus actionnable) :
${JSON.stringify(realtime)}

RÉSUMÉ 14 JOURS (moyennes fiables, tendance de fond) :
${JSON.stringify(summary)}

JOUR PAR JOUR — poids/kcal/macros/fibres/eau/pas, pour corréler (repère les liens entre apports et variations de poids : rétention d'eau via sodium/glucides vs vraie perte de masse grasse) :
${JSON.stringify(merged)}

DONNÉES BRUTES 14 jours (JSON, du plus ancien au plus récent). Séances : "s" liste les séries au format "poidsXreps" (suffixe /G ou /D = jambe) :
Séances: ${JSON.stringify(last14(training).map(compact))}
Sommeil: ${JSON.stringify(last14(sleep))}
Genou: ${JSON.stringify(last14(knee))}
${notesTxt ? `\nNOTES DE CONTEXTE écrites par Yoann (14 j, ex. alcool, insomnie, petite blessure) — à prendre en compte activement dans l'analyse :\n${notesTxt}\n` : ""}
Structure ta réponse en deux temps :
1. **Aujourd'hui / les prochaines 24h** : à partir du bloc TEMPS RÉEL, dis-lui concrètement quoi faire (ou éviter) MAINTENANT — séance, nutrition, hydratation, récupération, genou — en te basant sur ce qui s'est passé hier et sur les notes de contexte.
2. **Tendance de fond (14 jours)** : ce qui se dessine sur la durée et ce qu'il faut ajuster pour la semaine à venir, EN CORRÉLANT explicitement poids, kcal, macros, fibres et eau à partir du dataset JOUR PAR JOUR (ex. un pic de poids coïncide-t-il avec un pic de glucides/sodium la veille plutôt qu'un vrai surplus calorique ? un manque de fibres ou d'eau coïncide-t-il avec une stagnation ?).
Traite explicitement CHAQUE domaine : poids (bruit quotidien vs moyenne glissante), macros (protéines jour le jour, reste en moyenne 7j), eau (jours de basket +1L), sommeil (impact récup), pas quotidiens (corrélation activité/résultat), séances (équilibre Upper/Lower, progressive overload exercice par exercice, respect coude/escalade), genou/douleur (Silbernagel, priorité absolue si ça a flambé).
Sois direct, concret, chiffré, sans préambule ni rappel du contexte, sans reciter les données brutes (cite seulement les chiffres qui appuient un conseil) : va droit aux conseils, en bullet points courts. Limite stricte : 500 mots maximum au total — écourte les détails plutôt que de laisser une section inachevée, et termine toujours par une phrase de conclusion complète. Ce n'est pas un avis médical.`;
    },
    apiKey, model,
  };

  const NAV = [
    { key: "dash", label: "Bord", icon: LayoutDashboard },
    { key: "weight", label: "Poids", icon: Scale },
    { key: "sleep", label: "Sommeil", icon: Moon },
    { key: "steps", label: "Pas", icon: Footprints },
    { key: "train", label: "Séances", icon: Dumbbell },
    { key: "knee", label: "Genou", icon: HeartPulse },
    { key: "macro", label: "Macros", icon: Utensils },
  ];

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
          <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, letterSpacing: 3, color: C.accent }}>PROTOCOLE</div>
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
          <SettingsPanel {...{ apiKey, setApiKey, model, setModel, healthSync }} onHealthSync={runHealthSync} onClose={() => setShowSettings(false)} />
        ) : (
          <>
            {tab === "dash" && <Dashboard {...{ weight, sleep, knee, macros, steps, targets, training, phase, setPhase, coach, todayNote, saveNote, setTab }} />}
            {tab === "weight" && <WeightTab {...{ weight, targets, save, phase }} />}
            {tab === "sleep" && <SleepTab {...{ sleep, save }} />}
            {tab === "steps" && <StepsTab {...{ steps, save }} />}
            {tab === "train" && <TrainTab {...{ training, save, hsrWeek, setHsrWeek }} />}
            {tab === "knee" && <KneeTab {...{ knee, save, hsrWeek }} />}
            {tab === "macro" && <MacroTab {...{ macros, targets, save, training }} />}
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
              background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
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
