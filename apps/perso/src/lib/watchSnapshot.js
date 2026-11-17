// Instantané de la montre (Galaxy Watch, chantier du 17/11/2026) : les trois écrans repris sur la
// montre — Bord, Nutrition › Journal, Analyse › Dépense — déjà calculés ET mis en forme ici, avec
// les mêmes fonctions que les écrans du téléphone. La montre (module Android `wear`) ne calcule
// rien : elle dessine ces blocs dans l'ordre, sans connaître aucune règle métier. Une seule
// vérité, aucun deuxième calcul en Kotlin.
//
// Lecture seule : rien ici n'écrit dans le stockage. JS pur (aucun JSX) : testable en Node.
//
// Forme : { v: 1, date: "AAAA-MM-JJ", at: "HH:MM", pages: [{ key, title, items: [bloc…] }] }.
// Blocs (champ `t`) que la montre sait dessiner — un type inconnu est ignoré par la montre :
//   alert { title, text }                      encadré rouge (sauvegarde périmée)
//   head  { text, col? }                       petit titre en capitales
//   tile  { id?, label, labelCol?, value, unit?, valueCol?, extra?: { txt, col }, note?, pct?, barCol?, big? }
//   text  { text, col?, size?: "s"|"m"|"l", bold?, mono? }
//   kv    { label, value, col?, valueCol?, note?, noteCol?, big? }   libellé à gauche, valeur à droite,
//         note dessous ; `col` colore libellé et valeur, `valueCol` la valeur seule
//   macros { items: [{ label, value, target, pct, col, barCol }] }
//   food  { name, detail, kcal }               une ligne du journal alimentaire
//   chart { points: [nombre|null], from, to, col, min, max }   courbe simple (tendance de la dépense)
//   sep   {}                                   filet
// Couleurs : toujours en hex (#rrggbb), la montre n'a pas les variables CSS.
import { computeEnergyScore, scoreLabel } from "@rawcare/core/energy";
import { computeFreeInsights } from "@rawcare/core/insights";
import { PHASES, targetsForDate, kcalFromMacros, kcalOfEntry, tdeeNow, buildKcalByDate, recompWindows } from "@rawcare/core/targets";
import { realDeficit, tdeeTrend, tdeeOverWindow, MIN_WINDOW_DAYS } from "@rawcare/core/tdee";
import { nextSessions } from "@rawcare/core/nextSession";
import { MEALS, entriesFor, totals, amounts, isQuickRef, resolveLog } from "@rawcare/core/nutrition/foodStore";
import { today as todayKeyNow, shiftDateKey, fmt, longDate } from "@rawcare/core/dateUtils";
import { COLORS } from "../design/tokens.js";
import { progressColor, MACRO_KIND } from "./progress.js";
import { scoreColor, STEPS_TARGET, TDEE_RELIABILITY_COLOR, TDEE_RELIABILITY_LABEL, loggedPct } from "./helpers.js";
import { planForDate } from "./plan.js";
import { weightView, nightNote, insightRows, palierView, palierMacroLine } from "./bordView.js";

export const WATCH_SNAPSHOT_VERSION = 1;

// Comme sur le téléphone : le chiffre reste blanc tant qu'on est « en cours » (citron).
const valColor = (c) => (c === COLORS.accent ? COLORS.text : c);
const pct = (v, tgt) => (v != null && tgt > 0 ? Math.max(0, Math.min(100, Math.round((v / tgt) * 100))) : 0);
const n0 = (x) => Math.round(x ?? 0);
const n1 = (x) => (x == null ? "—" : Math.round(x * 10) / 10);
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/* ---------------------------------------------------------------- Bord */

function bordPage(d, todayKey, now) {
  const { weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, basketSchedule, palier, foodLog, overrides, backup } = d;
  const items = [];

  // Sauvegarde hors du téléphone périmée : même rappel que le Bord (sans le bouton).
  if (backup?.stale) {
    items.push({ t: "alert", title: "Sauvegarde hors du téléphone",
      text: backup.last ? `Dernière il y a ${backup.days} jours (${fmt(backup.last)}).` : "Jamais faite." });
  }

  const energy = computeEnergyScore(todayKey, { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps });
  items.push({ t: "tile", big: true, label: "Énergie",
    value: energy.status === "ok" ? String(energy.total) : "—", unit: energy.status === "ok" ? "/100" : "",
    extra: energy.status === "ok" ? { txt: scoreLabel(energy.total), col: scoreColor(energy.total) } : null,
    note: energy.status === "ok" ? nightNote(sleep, todayKey) : "pas assez de données" });

  const wv = weightView(weight, phase, targets, todayKey);
  items.push({ t: "tile", big: true, label: wv.label, value: String(wv.value), unit: "kg", extra: wv.extra, note: wv.note });

  const mToday = macros.find((m) => m.date === todayKey);
  const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;
  const at = targetsForDate(todayKey, targets);
  const kcalTgt = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));
  const stepsToday = steps.find((s) => s.date === todayKey)?.count ?? 0;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((t) => t.type === "Basket" && t.date === todayKey);
  const waterTgt = targets.water + (basketToday ? 1000 : 0);
  const kc = progressColor(kcalToday, kcalTgt, "limit");
  const st = progressColor(stepsToday, STEPS_TARGET, "goal");
  const wa = progressColor(waterToday, waterTgt, "goal");
  items.push({ t: "tile", label: "Kcal", value: kcalToday != null ? String(kcalToday) : "—", note: `/ ${kcalTgt}`,
    pct: kcalToday != null ? pct(kcalToday, kcalTgt) : 0, barCol: kc, valueCol: valColor(kc) });
  // `id: "pas"` : le téléphone remplace ce bloc toutes les 30 min avec les pas relus dans Health
  // Connect (WatchBridge.kt), sans rouvrir l'app — mêmes règles de couleur (objectif atteint = bleu).
  items.push({ t: "tile", id: "pas", label: "Pas", value: stepsToday.toLocaleString("fr-FR"), note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}`,
    pct: pct(stepsToday, STEPS_TARGET), barCol: st, valueCol: valColor(st), count: stepsToday, target: STEPS_TARGET });
  items.push({ t: "tile", label: "Eau", value: (waterToday / 1000).toFixed(2), unit: "L",
    note: `/ ${(waterTgt / 1000).toFixed(1)} L${basketToday ? " · basket" : ""}`, pct: pct(waterToday, waterTgt), barCol: wa, valueCol: valColor(wa) });

  // Prochaine séance : même appel que le Bord (`nextSessions`, recommandeur temporel S2).
  const next = nextSessions({ now, base: { training, knee, sleep, targets, basketSchedule, energy }, planFor: planForDate(basketSchedule) });
  items.push({ t: "sep" });
  items.push({ t: "head", text: "Prochaine séance" });
  if (!knee.some((k) => k.date === todayKey)) {
    items.push({ t: "text", size: "s", col: COLORS.warn, text: "Genou du jour pas encore noté (sur le téléphone)." });
  }
  items.push({ t: "head", text: "Aujourd'hui", col: COLORS.accent });
  const { suggestions, avoid } = next.today;
  if (next.today.status === "closed") {
    items.push({ t: "text", text: next.today.note, col: COLORS.text2 });
  } else {
    const top = suggestions[0];
    if (top) {
      items.push({ t: "kv", label: top.type, value: `score ${top.score}`, big: true });
      items.push({ t: "text", size: "s", text: top.reason, col: COLORS.text2 });
    }
  }
  for (const r of suggestions.slice(1)) {
    items.push({ t: "kv", label: r.type, value: String(r.score), note: r.reason });
  }
  if (avoid.length) {
    items.push({ t: "head", text: "À éviter aujourd'hui", col: COLORS.danger });
    for (const a of avoid) items.push({ t: "kv", label: a.type, value: "", col: COLORS.danger, note: a.reason });
  }
  const whyToday = (next.today.notProposed || []).filter((x) => x.kind !== "avoid" && x.kind !== "closed");
  pushWhyNot(items, whyToday);

  const tm = next.tomorrow;
  items.push({ t: "head", col: COLORS.accent,
    text: `Demain · ${new Date(tm.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "numeric" })}` });
  const t0 = tm.suggestions[0];
  items.push({ t: "kv", label: t0?.type ?? "—", value: t0 ? String(t0.score) : "", note: t0?.reason });
  if (tm.suggestions.length > 1) {
    items.push({ t: "text", size: "s", col: COLORS.text2, text: `Alternatives : ${tm.suggestions.slice(1).map((s) => `${s.type} (${s.score})`).join(" · ")}` });
  }
  if (tm.avoid.length) items.push({ t: "text", size: "s", col: COLORS.danger, text: `À éviter : ${tm.avoid.map((a) => a.type).join(", ")}` });
  pushWhyNot(items, tm.notProposed);

  // Constats : tous dépliés (on fait défiler, pas de bouton « Voir les N constats »).
  const tdeeForInsights = tdeeNow({ foodLog, overrides, macros, weight, targets });
  const rows = insightRows(computeFreeInsights({ training, weight, macros, sleep, rhr, steps, knee, targets, tdeeResult: tdeeForInsights, kcalTargetToday: kcalTgt, todayDate: todayKey }));
  if (rows.length) {
    items.push({ t: "sep" });
    items.push({ t: "head", text: "Constats" });
    for (const r of rows) items.push({ t: "kv", label: r.label, value: r.value, note: r.note });
  }

  // Palier de la semaine : recomposition seulement, et seulement s'il y a une proposition.
  const pv = PHASES[phase]?.noTarget ? palierView(palier, targets) : null;
  if (pv) {
    items.push({ t: "sep" });
    items.push({ t: "head", text: `Palier · semaine du ${fmt(pv.weekOf)}` });
    items.push({ t: "text", size: "l", bold: true, mono: true, col: pv.color, text: pv.verdict + (pv.blocked ? "  (en attente)" : "") });
    pv.reasons.forEach((x, i) => items.push({ t: "text", size: "s", col: i === 0 ? COLORS.text : COLORS.text2, text: `· ${x}` }));
    if (pv.proposed) {
      items.push({ t: "text", size: "s", mono: true, col: COLORS.text2, text: `Actuel : ${palierMacroLine(pv.cur)}` });
      items.push({ t: "text", size: "s", mono: true, col: COLORS.text, text: `Proposé : ${palierMacroLine(pv.proposed)}` });
      items.push(pv.appliedAt ? { t: "text", size: "s", bold: true, col: COLORS.accent, text: `Appliqué ✓ le ${fmt(pv.appliedAt)}` }
        : pv.alreadyInPlace ? { t: "text", size: "s", col: COLORS.text2, text: "Déjà en place dans tes cibles." }
        : { t: "text", size: "s", col: COLORS.text2, text: "À appliquer depuis le téléphone." });
    }
  }
  return { key: "bord", title: "Bord", items };
}

// « Pourquoi pas les autres ? » : replié sur le téléphone, en petit texte sur la montre.
function pushWhyNot(items, list) {
  if (!list?.length) return;
  items.push({ t: "text", size: "s", col: COLORS.muted, text: "Pourquoi pas les autres ?" });
  for (const x of list) {
    items.push({ t: "text", size: "s", col: x.kind === "avoid" ? COLORS.danger : COLORS.text2, text: `${x.type} — ${x.reason}` });
  }
}

/* ---------------------------------------------------------------- Journal */

const MACRO_SHORT = { prot: "Prot", gluc: "Gluc", lip: "Lip", fib: "Fib" };
const TARGET_KEY = { prot: "protein", gluc: "carbs", lip: "fat", fib: "fiber" };

/** Un jour du journal, comme Nutrition › Journal : calories et reste, 4 macros, eau, repas et aliments. */
function journalDay(items, { date, label, log, overrides, macros, targets, training, withEmptyTotals }) {
  const dayEntries = entriesFor(log, date);
  items.push({ t: "head", col: COLORS.accent, text: `${label} · ${longDate(date)}` });
  if (!dayEntries.length && !withEmptyTotals) {
    items.push({ t: "text", size: "s", col: COLORS.text2, text: "Rien de prévu pour l'instant." });
    return;
  }
  const tg = targetsForDate(date, targets);
  const t = totals(dayEntries);
  // Même cible que l'écran Journal (fibres comptées à 2 kcal/g).
  const kcalTarget = Math.round(tg.protein * 4 + tg.carbs * 4 + tg.fat * 9 + (tg.fiber ?? 0) * 2);
  const left = kcalTarget - t.kcal;
  const kcalColor = progressColor(t.kcal, kcalTarget, "limit");
  items.push({ t: "tile", label: "Calories", value: String(n0(t.kcal)), note: `/ ${kcalTarget}`,
    extra: { txt: left >= 0 ? `Il reste ${n0(left)}` : `Dépassement +${n0(-left)}`, col: kcalColor },
    pct: pct(t.kcal, kcalTarget), barCol: kcalColor });
  items.push({ t: "macros", items: ["prot", "gluc", "lip", "fib"].map((m) => {
    const target = tg[TARGET_KEY[m]];
    const col = progressColor(t[m], target, MACRO_KIND[m]);
    return { label: MACRO_SHORT[m], value: `${n0(t[m])}${t.missing[m] > 0 ? "+?" : ""}`, target: `/ ${target} g`, pct: pct(t[m], target), col: valColor(col), barCol: col };
  }) });
  const water = macros.find((m) => m.date === date)?.water ?? 0;
  if (withEmptyTotals || water > 0) {
    const basketDay = training.some((tr) => tr.type === "Basket" && tr.date === date);
    const waterTgt = tg.water + (basketDay ? 1000 : 0);
    const wc = progressColor(water, waterTgt, "goal");
    items.push({ t: "tile", label: "Eau", value: (water / 1000).toFixed(2), unit: "L", note: `/ ${(waterTgt / 1000).toFixed(1)} L`,
      pct: pct(water, waterTgt), barCol: wc, valueCol: valColor(wc) });
  }
  for (const meal of MEALS) {
    const entries = dayEntries.filter((e) => e.meal === meal.key);
    if (!entries.length) continue;
    const mt = totals(entries);
    items.push({ t: "kv", label: meal.label, value: `${n0(mt.kcal)} kcal`, valueCol: COLORS.accent,
      note: `P${n1(mt.prot)} G${n1(mt.gluc)} L${n1(mt.lip)} Fib${n1(mt.fib)}` });
    for (const e of entries) {
      const a = amounts(e);
      items.push({ t: "food", name: `${e.name}${overrides?.[e.ref] ? " *" : ""}`,
        detail: `${isQuickRef(e.ref) ? "portion" : `${e.q} g`} · P${a.prot ?? "—"} G${a.gluc ?? "—"} L${a.lip ?? "—"} Fib${a.fib ?? "—"}`,
        kcal: a.kcal == null ? "—" : String(a.kcal) });
    }
  }
  if (!dayEntries.length) items.push({ t: "text", size: "s", col: COLORS.text2, text: "Aucun aliment saisi." });
}

function journalPage(d, todayKey) {
  const { foodLog, overrides, macros, targets, training } = d;
  // Mêmes lignes que l'écran : corrections (V6) appliquées à la lecture.
  const log = resolveLog(foodLog, overrides);
  const items = [];
  journalDay(items, { date: todayKey, label: "Aujourd'hui", log, overrides, macros, targets, training, withEmptyTotals: true });
  items.push({ t: "sep" });
  journalDay(items, { date: shiftDateKey(todayKey, 1), label: "Demain", log, overrides, macros, targets, training, withEmptyTotals: false });
  return { key: "journal", title: "Journal", items };
}

/* ---------------------------------------------------------------- Dépense */

const RECOMP_ZONE_COLOR = { visee: COLORS.accent, haut: COLORS.warn, sous: COLORS.warn, trop: COLORS.danger, surplus: COLORS.danger };

function depensePage(d, todayKey) {
  const { foodLog, overrides, macros, weight, targets, phase } = d;
  const at = targetsForDate(todayKey, targets);
  const kcalTargetToday = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));
  // Mêmes appels que DepenseView (PerformanceTab.jsx).
  const result = tdeeNow({ foodLog, overrides, macros, weight, targets });
  const deficitReel = result.status === "ok" ? realDeficit(kcalTargetToday, result.tdee) : null;
  const kcalByDate = buildKcalByDate({ foodLog, overrides, macros, today: todayKey });
  const cutStart = targets.cut?.enabled !== false && targets.cut?.start ? targets.cut.start : null;
  const trend = tdeeTrend({ weightLog: weight, kcalByDate, cutStart, todayDate: todayKey, weeks: 8 });
  const windows = [7, 14, 21, 28]
    .filter((n) => result.status !== "ok" || n !== result.days)
    .map((n) => tdeeOverWindow({ weightLog: weight, kcalByDate, today: todayKey, days: n, cutStart }));
  const recomp = PHASES[phase]?.noTarget ? recompWindows({ foodLog, overrides, macros, weight, targets }) : null;

  const items = [{ t: "head", text: "Dépense estimée" }];
  if (result.status !== "ok") {
    items.push({ t: "text", size: "s", col: COLORS.text2,
      text: `Pas encore assez de données (${result.reason}). Il faut ${MIN_WINDOW_DAYS} jours de pesées et d'apports, dont 70 % loggés.` });
  } else {
    const col = TDEE_RELIABILITY_COLOR[result.reliability];
    items.push({ t: "tile", big: true, label: `Confiance ${TDEE_RELIABILITY_LABEL[result.reliability]}`, labelCol: col, value: String(result.tdee),
      unit: result.margin != null ? `± ${result.margin}` : "", note: `kcal/j · sur ${result.days} j` });
    items.push({ t: "kv", label: "Déficit réel", value: `${deficitReel > 0 ? "+" : ""}${deficitReel} kcal/j`,
      valueCol: deficitReel < 0 ? COLORS.accent : COLORS.danger, note: "contre la cible affichée" });
  }
  if (recomp) {
    items.push({ t: "head", text: "Zone de recomposition" });
    const rows = [["14 j", recomp.j14], ["21 j", recomp.j21]];
    for (const [lbl, r] of rows) {
      if (r.status === "ok") items.push({ t: "kv", label: lbl, value: `${r.reading.deficit > 0 ? "−" : "+"}${Math.abs(r.reading.deficit)} kcal/j`, note: r.reading.label, noteCol: RECOMP_ZONE_COLOR[r.reading.zone] });
      else items.push({ t: "kv", label: lbl, value: "—", note: r.reason });
    }
    const ok = rows.filter(([, r]) => r.status === "ok");
    if (ok.length === 2 && ok[0][1].reading.zone !== ok[1][1].reading.zone) {
      items.push({ t: "text", size: "s", col: COLORS.text2, text: "Les deux fenêtres divergent : attendre qu'elles convergent." });
    }
    items.push({ t: "text", size: "s", col: COLORS.muted, text: "Visée : 100 à 300 kcal/j de déficit réel." });
  }
  if (result.status === "ok") {
    items.push({ t: "text", size: "s", mono: true, col: COLORS.muted,
      text: `Fenêtre ${fmt(result.windowStart)} → ${fmt(result.windowEnd)} · ${loggedPct(result)} % loggés · ${Math.round(result.weighRate * 100)} % pesés` });
    items.push({ t: "text", size: "s", mono: true, col: COLORS.muted, text: `Poids sur la fenêtre : ${result.deltaKg > 0 ? "+" : ""}${result.deltaKg} kg` });
    if (result.overlapsWater) items.push({ t: "text", size: "s", col: COLORS.muted, text: "Fenêtre sur la perte d'eau du début de sèche : dépense sans doute plus basse." });
  }
  if (windows.length) {
    items.push({ t: "head", text: "Comparaison des fenêtres" });
    for (const w of windows) {
      const lbl = `${w.days} j${w.days < MIN_WINDOW_DAYS ? " · indicatif" : ""}`;
      if (w.status === "ok") {
        items.push({ t: "kv", label: lbl, value: `${w.tdee}${w.margin != null ? ` ±${w.margin}` : ""}`,
          note: `${TDEE_RELIABILITY_LABEL[w.reliability]} · ${loggedPct(w)} % loggés`, noteCol: TDEE_RELIABILITY_COLOR[w.reliability] });
      } else items.push({ t: "kv", label: lbl, value: "—", note: w.reason });
    }
    items.push({ t: "text", size: "s", col: COLORS.muted, text: "Fenêtres proches = chiffre solide. Le 7 j est très bruité (0,5 kg d'eau ≈ ±550 kcal/j)." });
  }
  const pts = (trend || []).filter((p) => p.tdee != null);
  if (result.status === "ok" && pts.length >= 2) {
    items.push({ t: "head", text: "Tendance · 8 semaines" });
    items.push({ t: "chart", points: trend.map((p) => p.tdee ?? null), from: fmt(trend[0].date), to: fmt(trend[trend.length - 1].date), col: COLORS.accent,
      min: Math.min(...pts.map((p) => p.tdee)), max: Math.max(...pts.map((p) => p.tdee)) });
  }
  return { key: "depense", title: "Dépense", items };
}

/* ---------------------------------------------------------------- Ensemble */

/**
 * `data` : les mêmes tableaux que ceux d'App.jsx (`weight`, `sleep`, `knee`, `rhr`, `naps`, `macros`,
 * `steps`, `targets`, `training`, `phase`, `basketSchedule`, `palier`), plus `foodLog` et
 * `overrides` (lus dans le stockage) et `backup` = { stale, days, last } (rappel de sauvegarde).
 */
export function buildWatchSnapshot(data, now = new Date()) {
  const todayKey = todayKeyNow();
  const d = { foodLog: [], overrides: {}, knee: [], naps: [], rhr: [], ...data };
  return {
    v: WATCH_SNAPSHOT_VERSION,
    date: todayKey,
    at: hhmm(now),
    pages: [bordPage(d, todayKey, now), journalPage(d, todayKey), depensePage(d, todayKey)],
  };
}
