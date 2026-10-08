// Heure de la pesée (08/10/2026) — OBSERVATION SEULEMENT, aucune pesée n'est exclue ni
// corrigée (décision explicite de Yoann). Il a remarqué qu'une pesée très tôt (~5h30, les
// nuits courtes) sort plus haute qu'à 8h : moins d'eau perdue par la respiration/miction,
// digestion moins avancée. L'effet sur le TDEE est noyé dans la marge affichée (±138 kcal
// sur 28 j), mais il voulait le voir chiffré. On compare chaque pesée à la tendance EMA
// (jamais au poids brut, pour neutraliser la perte réelle) et on moyenne l'écart par groupe
// d'heure. `time` est "HH:MM" local, posé par la synchro Health Connect ; une pesée manuelle
// n'en a pas et n'entre dans aucun groupe.
import { smoothedWeightSeries } from "./tdee.js";

export const EARLY_CUTOFF_HOUR = 7; // avant 7 h = « aux aurores »
export const WEIGH_TIME_MIN_SAMPLES = 3;

const hourOf = (time) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};

/**
 * `{ early: { n, meanDelta, meanHour }, late: {...}, diff, ready }` — delta = pesée − EMA du
 * jour, en kg (positif = plus lourd que la tendance). `ready` = les deux groupes ont au moins
 * WEIGH_TIME_MIN_SAMPLES pesées. `diff` = early.meanDelta − late.meanDelta (null si pas prêt).
 */
export function weighTimeAnalysis(weightLog, { cutoffHour = EARLY_CUTOFF_HOUR, days = 90, asOf } = {}) {
  const log = [...(weightLog || [])].filter((w) => w.kg != null && w.date).sort((a, b) => a.date.localeCompare(b.date));
  const ema = new Map(smoothedWeightSeries(log).map((e) => [e.date, e.kg]));
  const last = asOf ?? log[log.length - 1]?.date;
  const early = [], late = [];
  for (const w of log) {
    const h = hourOf(w.time);
    if (h == null) continue;
    if (last && daysDiff(w.date, last) > days) continue;
    const t = ema.get(w.date);
    if (t == null) continue;
    (h < cutoffHour ? early : late).push({ delta: w.kg - t, hour: h });
  }
  const grp = (arr) => ({
    n: arr.length,
    meanDelta: arr.length ? round2(arr.reduce((a, x) => a + x.delta, 0) / arr.length) : null,
    meanHour: arr.length ? round2(arr.reduce((a, x) => a + x.hour, 0) / arr.length) : null,
  });
  const e = grp(early), l = grp(late);
  const ready = e.n >= WEIGH_TIME_MIN_SAMPLES && l.n >= WEIGH_TIME_MIN_SAMPLES;
  return { early: e, late: l, ready, diff: ready ? round2(e.meanDelta - l.meanDelta) : null, cutoffHour };
}

const round2 = (x) => Math.round(x * 100) / 100;
const daysDiff = (a, b) => {
  const p = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
};
