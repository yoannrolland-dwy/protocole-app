// Score de force par groupe musculaire (14/11/2026, demande de Yoann). Fichier pur, testé sous Node.
//
// Méthode (choisie avec Yoann) :
// - 1RM ESTIMÉ par série, formule d'Epley (1RM = charge × (1 + reps/30)), en comptant les
//   répétitions en réserve comme des répétitions possibles (reps + RIR, RIR absent = 0). Fiable à
//   environ ±5 % jusqu'à une dizaine de répétitions près de l'échec ; au-delà de 12 (reps + RIR),
//   la série n'est pas utilisée. Ce n'est qu'un calcul : aucun test de charge maximale.
// - Comparé à SOI-MÊME : chaque exercice a sa référence (le meilleur 1RM estimé de ses 4 premières
//   semaines), donc la taille, la longueur des membres et les leviers s'annulent, comme les
//   différences de machine (une pile de poulie n'est pas un kilo d'haltère).
// - Groupe = moyenne géométrique des rapports « meilleur 1RM estimé des 4 dernières semaines /
//   référence » de ses exercices faits pendant ces 4 semaines, × 100. Moyenne géométrique : un
//   exercice à +20 % et un à −20 % ne s'annulent pas faussement.
// - Force RELATIVE : même indice, ramené au poids de corps avec l'exposant 0,67 (mise à l'échelle
//   allométrique, Jaric 2002). Elle monte aussi quand le poids baisse sans changement du muscle :
//   la force brute reste le chiffre principal.
// Exclus : exercices en durée, mobilité, coiffe, cardio, et TOUT le quadriceps (leg extension HSR,
// presse et squat sur sécurités sont sous le protocole du genou : tempo imposé, amplitude
// partielle — un 1RM estimé n'y a pas de sens et ne doit rien encourager).

import { metaFor } from "./session/exoMeta.js";
import { GROUP_LABELS, GROUP_ORDER } from "./volume.js";
import { today, shiftDateKey } from "./dateUtils.js";

export const STRENGTH = { maxReps: 12, windowDays: 28, exponent: 0.67, weeks: 26 };
const EXCLUDED = new Set(["mobilite", "coiffe", "cardio", "quadriceps"]);

/** 1RM estimé d'une série (Epley, reps + RIR), ou `null` si la série ne s'y prête pas. */
export function e1rm(poids, reps, rir = 0) {
  const w = +poids, r = +reps, total = r + (+rir || 0);
  if (!(w > 0) || !(r > 0) || total > STRENGTH.maxReps) return null;
  return total <= 1 ? w : w * (1 + total / 30);
}

/** Groupe musculaire compté dans le score, ou `null` si l'exercice en est exclu. */
export function strengthGroup(nom) {
  const m = metaFor(nom);
  if (!m || m.mode === "temps" || !m.groupe || EXCLUDED.has(m.groupe)) return null;
  return m.groupe;
}

/** Meilleur 1RM estimé de chaque séance, par exercice compté : { nom: [{ date, v }] } (ordre chronologique). */
export function e1rmHistory(training) {
  const out = {};
  [...(training || [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => {
    (s.exercices || []).forEach((e) => {
      if (e.mode === "temps" || !strengthGroup(e.nom)) return;
      let best = null;
      (e.series || []).forEach((x) => {
        if (!x.fait) return;
        const v = e1rm(x.poids, x.val, e.rir);
        if (v != null && (best == null || v > best)) best = v;
      });
      if (best != null) (out[e.nom] ||= []).push({ date: s.date, v: best });
    });
  });
  return out;
}

/** Poids moyen des 7 jours qui finissent à `date`, sinon la dernière pesée avant ; `null` sinon. */
export function weightAt(weightLog, date) {
  const w = (weightLog || []).filter((x) => x.date <= date && +x.kg > 0);
  if (!w.length) return null;
  const from = shiftDateKey(date, -6);
  const recent = w.filter((x) => x.date >= from);
  const list = recent.length ? recent : [w.reduce((a, b) => (b.date > a.date ? b : a))];
  return list.reduce((s, x) => s + +x.kg, 0) / list.length;
}

const geo = (xs) => Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length);
const maxIn = (pts, from, to) => pts.reduce((m, p) => (p.date >= from && p.date <= to && (m == null || p.v > m) ? p.v : m), null);

/** Référence d'un exercice : meilleur 1RM estimé de ses 4 premières semaines, et le poids de corps d'alors. */
function baseline(pts, weightLog) {
  const first = pts[0].date;
  const end = shiftDateKey(first, STRENGTH.windowDays - 1);
  return { first, v: maxIn(pts, first, end), kg: weightAt(weightLog, end) ?? weightAt(weightLog, first) };
}

/** Indice d'un groupe au jour `d` (brut et relatif), à partir des exercices faits dans les 4 semaines. */
function indexAt(exos, d, weightLog) {
  const from = shiftDateKey(d, -(STRENGTH.windowDays - 1));
  const raw = [], rel = [], used = [];
  const kgNow = weightAt(weightLog, d);
  exos.forEach((x) => {
    if (x.base.first > d) return;
    const v = maxIn(x.pts, from, d);
    if (v == null) return;
    const r = v / x.base.v;
    raw.push(r);
    if (kgNow && x.base.kg) rel.push(r * Math.pow(x.base.kg / kgNow, STRENGTH.exponent));
    used.push({ nom: x.nom, v, r });
  });
  if (!raw.length) return null;
  return { index: Math.round(geo(raw) * 100), rel: rel.length === raw.length ? Math.round(geo(rel) * 100) : null, used };
}

/**
 * Score de force par groupe au jour `asOf`.
 * @returns [{ groupe, label, index, rel, change4w, relChange4w, since, points: [{ date, index, rel }],
 *   exercices: [{ nom, e1rm, base, pct, since, materiel }] }] — groupes faits dans les 4 dernières
 *   semaines seulement, dans l'ordre habituel des groupes.
 */
export function strengthByGroup(training, weightLog, { asOf = today() } = {}) {
  const hist = e1rmHistory(training);
  const byGroup = {};
  Object.entries(hist).forEach(([nom, pts]) => {
    const g = strengthGroup(nom);
    (byGroup[g] ||= []).push({ nom, pts, base: baseline(pts, weightLog) });
  });
  const out = [];
  GROUP_ORDER.filter((g) => byGroup[g]).forEach((g) => {
    const exos = byGroup[g];
    const now = indexAt(exos, asOf, weightLog);
    if (!now) return;
    const before = indexAt(exos, shiftDateKey(asOf, -STRENGTH.windowDays), weightLog);
    const since = exos.map((x) => x.base.first).sort()[0];
    const points = [];
    for (let k = STRENGTH.weeks; k >= 0; k--) {
      const d = shiftDateKey(asOf, -7 * k);
      if (d < since) continue;
      const p = indexAt(exos, d, weightLog);
      if (p) points.push({ date: d, index: p.index, rel: p.rel });
    }
    out.push({
      groupe: g, label: GROUP_LABELS[g] || g, index: now.index, rel: now.rel, since,
      change4w: before ? now.index - before.index : null,
      relChange4w: before && before.rel != null && now.rel != null ? now.rel - before.rel : null,
      points,
      exercices: now.used.map((u) => {
        const x = exos.find((e) => e.nom === u.nom);
        return { nom: u.nom, e1rm: Math.round(u.v * 2) / 2, base: Math.round(x.base.v * 2) / 2,
          pct: Math.round((u.r - 1) * 100), since: x.base.first, materiel: metaFor(u.nom)?.materiel ?? null };
      }).sort((a, b) => b.pct - a.pct),
    });
  });
  return out;
}
