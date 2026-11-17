// Textes et couleurs du tableau de bord (Bord), sortis des composants le 17/11/2026 pour que
// l'écran du téléphone et l'instantané de la montre (lib/watchSnapshot.js) disent exactement la
// même chose : un seul calcul, deux affichages. Logique reprise À L'IDENTIQUE de Dashboard.jsx,
// InsightsCard.jsx et PalierCard.jsx. JS pur (aucun JSX) : testable en Node.
import { VOLUME_TARGET } from "@rawcare/core/volume";
import { fmt, today, lastN, fmtHM, round } from "@rawcare/core/dateUtils";
import { weightTrend7, kcalFromMacros } from "@rawcare/core/targets";
import { COLORS } from "../design/tokens.js";
import { phaseTarget, recompTrendColor, TDEE_RELIABILITY_LABEL } from "./helpers.js";

/** Tuile Poids : pesée du jour en valeur, delta à la cible (sèche/prise) ou tendance hebdo
 *  (recomposition, sans poids cible) en ligne colorée, cible ou moyenne 7 j en note. */
export function weightView(weight, phase, targets, todayKey = today()) {
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(weight, 1)[0];
  const wDelta = wLast && tgtW != null ? round(wLast.kg - tgtW) : null;
  const wTrend = tgtW == null ? weightTrend7(weight, todayKey) : null;
  // Recomposition (05/10/2026) : ±0,3 kg/sem = attendu (citron), au-delà = ambre, jamais rouge.
  const extra = wDelta != null ? { txt: `${wDelta > 0 ? "▲" : "▼"} ${Math.abs(wDelta)} kg de la cible`, col: wDelta > 0 ? COLORS.danger : COLORS.accent }
    : wTrend?.deltaWeek != null ? { txt: `${wTrend.deltaWeek > 0 ? "▲" : "▼"} ${Math.abs(wTrend.deltaWeek)} kg/sem`, col: recompTrendColor(wTrend.deltaWeek) }
    : null;
  return {
    label: wLast && wLast.date !== todayKey ? `Poids · ${fmt(wLast.date)}` : "Poids",
    value: wLast ? wLast.kg : "—",
    extra,
    note: tgtW != null ? `cible ${tgtW} kg` : `moy. 7 j ${wTrend?.avg7 ?? "—"} kg`,
  };
}

/** Note de la tuile Énergie : durée de la dernière nuit, étoiles de qualité, date si ancienne. */
export function nightNote(sleep, todayKey = today()) {
  const n = lastN(sleep, 1)[0];
  return n
    ? `nuit ${fmtHM(n.hours)}${n.quality != null ? " · " + "★".repeat(n.quality) : ""}${n.date !== todayKey ? ` (${fmt(n.date)})` : ""}`
    : "nuit non synchronisée";
}

/** Lignes de la carte Constats (chaque constat n'apparaît que s'il a assez de données). */
export function insightRows(insights) {
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
      note: `${w.deltaKg > 0 ? "+" : ""}${w.deltaKg} kg sur ${w.days} j · confiance ${TDEE_RELIABILITY_LABEL[w.reliability] ?? w.reliability}`,
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
  if (insights.plateaus) {
    const p = insights.plateaus;
    rows.push({ label: "Plateaux en cours", value: `${p.length}`, note: p.map((x) => `${x.nom} (${x.sessions} séances)`).join(" · ") });
  }
  if (insights.volumeShortfall) {
    const v = insights.volumeShortfall;
    rows.push({ label: "Volume sous la zone", value: v.map((g) => `${g.label} ${g.series}/${VOLUME_TARGET.min}`).join(" · "), note: "séries cochées sur 7 j · groupes prioritaires" });
  }
  if (insights.cutAdherence) {
    const a = insights.cutAdherence;
    rows.push({ label: "Régularité de la sèche", value: `${a.pct}%`, note: `des jours dans la cible (${a.loggedDays} jours loggés)` });
  }
  if (insights.sleepEnergy) {
    const s = insights.sleepEnergy;
    const gap = s.goodAvg - s.poorAvg;
    const lecture = gap >= 15 ? "Grand écart : ton sommeil pilote ton énergie, c'est le levier à protéger."
      : gap >= 8 ? "Écart modéré : une mauvaise nuit se paie, sans être dramatique."
      : gap >= 0 ? "Petit écart : tu encaisses bien une nuit moyenne."
      : "Écart inversé : d'autres facteurs dominent (charge de la veille, FC repos).";
    rows.push({ label: "Effet du sommeil sur l'énergie", value: `${s.goodAvg} vs ${s.poorAvg}`,
      note: `Après une excellente nuit, ton score d'énergie du matin est à ${s.goodAvg} en moyenne, contre ${s.poorAvg} après une mauvaise nuit (${s.goodN} et ${s.poorN} nuits comparées, 60 derniers jours). ${lecture}` });
  }
  return rows;
}

const PALIER_COLOR = { up: COLORS.accent, down: COLORS.warn, hold: COLORS.text2 };

/** Carte Palier de la semaine (R3) : verdict, raisons, macros actuelles et proposées. null sans proposition. */
export function palierView(palier, targets) {
  const r = palier?.result;
  if (!r) return null;
  const cur = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fiber: targets.fiber, kcal: Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber)) };
  const p = r.proposed;
  return {
    weekOf: palier.weekOf,
    blocked: !!r.blocked,
    verdict: r.action === "up" ? `+${r.deltaKcal} kcal/j` : r.action === "down" ? `−${Math.abs(r.deltaKcal)} kcal/j` : "Maintenir",
    color: PALIER_COLOR[r.action],
    reasons: r.reasons,
    cur,
    proposed: p || null,
    alreadyInPlace: !!p && ["protein", "carbs", "fat", "fiber"].every((k) => cur[k] === p[k]),
    appliedAt: palier.appliedAt || null,
  };
}

export const palierMacroLine = (t) => `${t.kcal} kcal · ${t.protein} P / ${t.carbs} G / ${t.fat} L / ${t.fiber} F`;
