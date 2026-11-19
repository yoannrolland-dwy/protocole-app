// Textes et couleurs du tableau de bord (Bord), sortis des composants le 17/11/2026 pour que
// l'écran du téléphone et l'instantané de la montre (lib/watchSnapshot.js) disent exactement la
// même chose : un seul calcul, deux affichages. Logique reprise À L'IDENTIQUE de Dashboard.jsx,
// InsightsCard.jsx et PalierCard.jsx. JS pur (aucun JSX) : testable en Node.
import { VOLUME_TARGET } from "@rawcare/core/volume";
import { fmt, today, lastN, fmtHM, round, shiftDateKey, daysBetween } from "@rawcare/core/dateUtils";
import { PALIER, nextPalierDecision } from "@rawcare/core/palier";
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

const PALIER_COLOR = { up: COLORS.accent, down: COLORS.warn, hold: COLORS.text };
const PALIER_MACROS = [["carbs", "Glucides"], ["fat", "Lipides"], ["protein", "Protéines"], ["fiber", "Fibres"]];
const frNum = (x) => String(x).replace(".", ",").replace("-", "−");
const signedKg = (x) => `${x > 0 ? "+" : ""}${frNum(x)} kg`;
const ZONE = "100 à 300";
const PALIER_JUDGE = {
  trop: `C'est trop pour gagner du muscle : la zone visée est de ${ZONE}.`,
  haut: `C'est un peu haut : la zone visée est de ${ZONE}.`,
  perteRapide: `Et tu perds plus de ${frNum(PALIER.LOSS_TOO_FAST_KG_WEEK)} kg par semaine depuis deux semaines : c'est trop rapide.`,
  surplus: `Tu n'es plus en déficit : il en faut un léger (${ZONE}) pour perdre du gras.`,
  poidsMonte: "Et ton poids moyen monte depuis deux semaines.",
  sous: `C'est juste sous la zone visée (${ZONE}) : on garde et on observe.`,
  visee: `C'est dans la zone visée (${ZONE}) : rien à changer.`,
};

/** Le « pourquoi » en phrases entières, et le compteur de la période d'observation (recalculé au
 *  jour `asOf` : la proposition est figée pour la semaine, pas le compteur). */
function palierWhy(r, asOf) {
  // Proposition figée avant le 19/11/2026 : pas de `facts`. L'observation se retrouve par sa date
  // de fin ; pour le reste on garde les raisons d'origine.
  const f = r.facts || (r.observation ? { why: "observation", lastDate: shiftDateKey(r.observation.until, -PALIER.OBSERVATION_DAYS) } : null);
  if (!f) return { lines: r.reasons || [], progress: null };
  if (f.why === "observation") {
    // La décision tombe le samedi le plus proche du 14e jour (palier.js) : le compteur va
    // jusqu'à ce samedi-là, pas jusqu'à 14.
    const next = f.next || nextPalierDecision(f.lastDate);
    const total = daysBetween(f.lastDate, next);
    const day = Math.max(0, Math.min(total, daysBetween(f.lastDate, asOf)));
    return {
      lines: [`Tu as changé tes calories le ${fmt(f.lastDate)}. L'app attend environ 2 semaines avant de juger, car le poids bouge d'abord à cause de l'eau.`],
      progress: {
        day, total, pct: Math.round((day / total) * 100),
        text: `Jour ${day} sur ${total}`,
        next: `Prochaine décision : samedi ${fmt(next)}${day >= total ? ", à partir de 10 h" : ""}`,
      },
    };
  }
  if (f.why === "peuLogge") {
    return { lines: [`Seulement ${f.pct} % des 7 derniers jours ont des repas notés. Il en faut au moins ${Math.round(PALIER.MIN_LOGGED_RATE * 100)} % pour que l'app puisse juger.`], progress: null };
  }
  if (f.why === "sansDonnees") {
    return { lines: ["L'app n'a pas encore assez de pesées et de repas notés (2 à 3 semaines) pour estimer ta dépense."], progress: null };
  }
  if (f.why === "desaccord") {
    return { lines: [`Tes 2 dernières semaines et tes 3 dernières ne disent pas la même chose (14 j : ${f.label14} ; 21 j : ${f.label21}). L'app attend qu'elles soient d'accord.`], progress: null };
  }
  const balance = f.deficit > 0 ? `Chaque jour, tu dépenses environ ${f.deficit} kcal de plus que tu ne manges`
    : f.deficit < 0 ? `Chaque jour, tu manges environ ${-f.deficit} kcal de plus que tu ne dépenses`
    : "Tu manges autant que tu dépenses";
  const lines = [`${balance} (moyenne des 2 à 3 dernières semaines). ${PALIER_JUDGE[f.why] ?? ""}`.trim()];
  if (f.weekDelta != null) {
    lines.push(`Ton poids moyen : ${signedKg(f.weekDelta)} en 7 jours${f.weekDeltaPrev != null ? `, ${signedKg(f.weekDeltaPrev)} les 7 jours d'avant` : ""}.`);
  }
  return { lines, progress: null };
}

/**
 * Carte Palier de la semaine (R3), en clair depuis le 19/11/2026 (demande de Yoann : la carte
 * parlait en abréviations). D'abord quoi faire (`title`), puis pourquoi (`lines`), le compteur
 * d'observation (`progress`), et le tableau Aujourd'hui / Proposé (`rows`) quand il y a un
 * changement à appliquer. Partagée avec la montre. null sans proposition.
 */
export function palierView(palier, targets, asOf = today()) {
  const r = palier?.result;
  if (!r) return null;
  const cur = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fiber: targets.fiber, kcal: Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber)) };
  const p = r.proposed || null;
  const appliedAt = palier.appliedAt || null;
  const alreadyInPlace = !!p && PALIER_MACROS.every(([k]) => cur[k] === p[k]);
  const pending = !!p && !appliedAt && !alreadyInPlace;
  const same = pending ? PALIER_MACROS.filter(([k]) => cur[k] === p[k]).map(([, l]) => l.toLowerCase()) : [];
  const sameText = same.join(" et ");
  return {
    weekOf: palier.weekOf,
    weekLabel: `samedi ${fmt(palier.weekOf)}`,
    intro: "Chaque samedi, l'app vérifie si tu manges la bonne quantité.",
    title: r.action === "up" ? `Mange ${r.deltaKcal} kcal de plus par jour`
      : r.action === "down" ? `Mange ${Math.abs(r.deltaKcal)} kcal de moins par jour`
      : "Garde tes calories actuelles",
    color: PALIER_COLOR[r.action],
    ...palierWhy(r, asOf),
    cur,
    proposed: p,
    // Tableau seulement tant que le changement reste à appliquer : une fois en place, les deux
    // colonnes seraient identiques.
    rows: pending ? [
      { label: "Calories", cur: `${cur.kcal}`, next: `${p.kcal}` },
      ...PALIER_MACROS.filter(([k]) => cur[k] !== p[k]).map(([k, l]) => ({ label: l, cur: `${cur[k]} g`, next: `${p[k]} g` })),
    ] : null,
    unchanged: same.length ? `${sameText[0].toUpperCase()}${sameText.slice(1)} ne change${same.length > 1 ? "nt" : ""} pas.` : null,
    targetsLine: p && !pending ? `Tes cibles : ${p.kcal} kcal · glucides ${p.carbs} g · lipides ${p.fat} g · protéines ${p.protein} g · fibres ${p.fiber} g` : null,
    status: !p ? null : appliedAt ? `Appliqué ✓ le ${fmt(appliedAt)}` : alreadyInPlace ? "Déjà en place dans tes cibles." : null,
    alreadyInPlace,
    appliedAt,
  };
}
