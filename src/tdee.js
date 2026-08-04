// Dépense énergétique adaptative (TDEE calculé) — étape V7 (04/08/2026).
//
// Principe (MacroFactor) : on lisse le poids pour éliminer le bruit hydrique, on compare la
// tendance réelle à ce que le déficit loggé prédisait, et on en déduit la dépense réelle.
//
// Module PUR, sans dépendance React/ui.jsx (testable seul en Node) : l'appelant prépare les
// données (kcal réelles par jour, fusion avec le repli 4/4/9, date du jour) et ce module ne
// fait que le calcul. Même convention que training.js et climbing.js.

export const KCAL_PER_KG = 7700;          // coefficient masse grasse → kcal
export const EMA_HALFLIFE_DAYS = 7;       // tendance réagit en ~7-10 jours (roadmap)
export const MIN_WINDOW_DAYS = 14;        // en dessous : jamais un chiffre, "pas assez de données"
export const IDEAL_WINDOW_DAYS = 28;
export const RELIABLE_WINDOW_DAYS = 21;   // seuil pour la fiabilité "fiable"
export const MIN_LOGGED_RATE = 0.70;      // part mini de jours avec des apports enregistrés
export const WATER_PHASE_DAYS = 21;       // durée de la perte hydrique/glycogène en début de sèche

// --- arithmétique de dates (Y-M-D uniquement, jamais un instant "maintenant") -------------
// Ces deux dates sont déjà des clés stockées (jamais une lecture d'horloge), donc l'aller-
// retour par un instant UTC est ici sans danger : contrairement au bug historique de
// `today()`/`toKey()` (voir CLAUDE.md, corrigé le 03/08/2026), on ne capture jamais "now" —
// on ne fait que compter des jours entre deux clés déjà fixées.
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const shiftDate = (key, days) => {
  const d = new Date(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const maxDate = (a, b) => (a > b ? a : b);
const round2 = (x) => Math.round(x * 100) / 100;

// --- fusion des kcal réelles (foodLog) et du repli 4/4/9 (macroLog) -----------------------

/** 4/4/9 sur une entrée macroLog — seul repli disponible pour les dates Cronometer qui
 * n'existent que là (macroLog ne stocke pas les kcal). */
export const kcal449 = (m) => (m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fat ?? 0) * 9;

/**
 * Fusionne kcal réelles et repli 4/4/9. `foodKcalByDate` (les vraies valeurs CIQUAL/OFF,
 * fibres comprises selon le règlement UE 1169/2011) est TOUJOURS prioritaire — le 4/4/9 ne
 * sert que pour une date qui n'a pas d'entrée dans `foodLog` (historique antérieur au
 * module Nutrition). Sans cette priorité, le TDEE serait biaisé de façon systématique
 * (c'est le « décalage fibres » déjà signalé ailleurs dans l'app).
 */
export function mergeKcalSeries(foodKcalByDate, macroLog) {
  const out = { ...foodKcalByDate };
  for (const m of macroLog || []) {
    if (out[m.date] == null && (m.protein != null || m.carbs != null || m.fat != null)) {
      out[m.date] = Math.round(kcal449(m));
    }
  }
  return out;
}

// --- tendance de poids : moyenne mobile exponentielle -------------------------------------

const alphaFor = (halfLifeDays) => 1 - Math.pow(2, -1 / halfLifeDays);

/**
 * EMA du poids, un point par pesée (jamais le poids brut : une pesée isolée ne veut rien
 * dire). `effectiveAlpha = 1-(1-alpha)^gap` : deux pesées espacées de plusieurs jours
 * pèsent proportionnellement plus dans la mise à jour qu'une pesée le lendemain, sinon un
 * grand trou dans les pesées laisserait la tendance figée artificiellement longtemps.
 */
export function smoothedWeightSeries(weightLog, halfLifeDays = EMA_HALFLIFE_DAYS) {
  const alpha = alphaFor(halfLifeDays);
  const sorted = [...(weightLog || [])].filter((w) => w.kg != null).sort((a, b) => a.date.localeCompare(b.date));
  let ema = null, prevDate = null;
  return sorted.map((w) => {
    if (ema == null) ema = w.kg;
    else {
      const gap = Math.max(1, daysBetween(prevDate, w.date));
      const eff = 1 - Math.pow(1 - alpha, gap);
      ema = ema + eff * (w.kg - ema);
    }
    prevDate = w.date;
    return { date: w.date, kg: ema };
  });
}

/** Valeur lissée en vigueur à `date` : dernière pesée lissée à cette date ou avant (report
 * en avant, comme la donnée réelle — le poids ne "change" qu'aux pesées). `null` si aucune
 * pesée n'existe encore à cette date. */
export function trendAt(smoothed, date) {
  let v = null;
  for (const p of smoothed) { if (p.date > date) break; v = p.kg; }
  return v;
}

// --- fenêtre et fiabilité -------------------------------------------------------------

function windowStats(kcalByDate, weightLog, start, end) {
  const days = daysBetween(start, end) + 1;
  let logged = 0;
  for (let i = 0; i < days; i++) if (kcalByDate[shiftDate(start, i)] != null) logged++;
  const weighed = (weightLog || []).filter((w) => w.kg != null && w.date >= start && w.date <= end).length;
  return { days, loggedRate: logged / days, weighRate: Math.min(1, weighed / days) };
}

function meanKcal(kcalByDate, start, end) {
  const days = daysBetween(start, end) + 1;
  let sum = 0, n = 0;
  for (let i = 0; i < days; i++) {
    const v = kcalByDate[shiftDate(start, i)];
    if (v != null) { sum += v; n++; }
  }
  return n ? sum / n : null;
}

/**
 * Cherche la MEILLEURE longueur de fenêtre parmi [28, 21, 14] (dans cet ordre de
 * préférence — « idéalement 21-28 », jamais moins de 14), ancrée sur `today` et jamais
 * antérieure à `floorDate` (le premier jour utilisable, ex. la première pesée jamais
 * faite, ou le premier jour post-perte-hydrique). Retient la PLUS LONGUE fenêtre qui
 * atteint le taux de complétude minimum — un utilisateur avec beaucoup d'historique mais
 * un début de saisie irrégulier doit quand même obtenir un résultat sur une fenêtre plus
 * courte mais fiable, pas un "pas assez de données" à tort.
 */
function bestWindow(kcalByDate, weightLog, today, floorDate) {
  for (const len of [IDEAL_WINDOW_DAYS, RELIABLE_WINDOW_DAYS, MIN_WINDOW_DAYS]) {
    let start = shiftDate(today, -(len - 1));
    if (floorDate && start < floorDate) start = floorDate;
    const days = daysBetween(start, today) + 1;
    if (days < MIN_WINDOW_DAYS) continue; // fenêtre trop courte une fois bornée par floorDate
    const stats = windowStats(kcalByDate, weightLog, start, today);
    if (stats.loggedRate >= MIN_LOGGED_RATE) return { start, days, ...stats };
  }
  return null;
}

/**
 * Indice de fiabilité, dérivé de la longueur de fenêtre, du taux de jours loggés et de la
 * densité des pesées. Une fenêtre qui chevauche la phase de perte hydrique (`overlapsWater`)
 * est TOUJOURS plafonnée à "faible", quelle que soit la qualité des données par ailleurs —
 * exigence explicite de la roadmap (le coefficient 7700 kcal/kg ne vaut pas pour de l'eau).
 */
function reliabilityOf({ days, loggedRate, weighRate, overlapsWater }) {
  if (overlapsWater) return "faible";
  if (weighRate < 0.4) return "faible";
  if (days >= RELIABLE_WINDOW_DAYS && loggedRate >= 0.85 && weighRate >= 0.7) return "fiable";
  if (days >= MIN_WINDOW_DAYS && loggedRate >= MIN_LOGGED_RATE) return "moyenne";
  return "faible";
}

// --- calcul principal -------------------------------------------------------------

/**
 * @param weightLog   historique complet des pesées [{date, kg}]
 * @param kcalByDate  { [date]: kcal } déjà fusionné (voir `mergeKcalSeries`)
 * @param today       date de référence (fin de fenêtre), ex. `today()` de ui.jsx
 * @param cutStart    date de début de la sèche en cours (`targets.cut.start`), ou `null`
 *                    si aucune fenêtre de sèche n'est active — désactive toute la logique
 *                    de préférence/pénalité liée à la perte hydrique.
 *
 * @returns `{ status: "insufficient", reason }` — jamais un chiffre non fiable —
 *   ou `{ status: "ok", tdee, meanIntake, deltaKg, windowStart, windowEnd, days,
 *   loggedRate, weighRate, reliability, overlapsWater }`.
 */
export function computeTDEE({ weightLog, kcalByDate, today, cutStart = null }) {
  const earliestWeight = (weightLog || [])
    .filter((w) => w.kg != null)
    .reduce((min, w) => (!min || w.date < min ? w.date : min), null);
  if (!earliestWeight) return { status: "insufficient", reason: "aucune pesée enregistrée" };

  let chosen = null, overlapsWater = false;

  // Préférer une fenêtre qui EXCLUT la phase de perte hydrique, dès qu'assez de données
  // post-phase existent (roadmap : "dès qu'assez de données existent" — sinon on retombe
  // sur la fenêtre standard, quitte à afficher une fiabilité dégradée).
  if (cutStart) {
    const postStart = shiftDate(cutStart, WATER_PHASE_DAYS);
    if (postStart <= today) chosen = bestWindow(kcalByDate, weightLog, today, maxDate(postStart, earliestWeight));
  }
  if (!chosen) {
    chosen = bestWindow(kcalByDate, weightLog, today, earliestWeight);
    if (chosen && cutStart) {
      const waterEnd = shiftDate(cutStart, WATER_PHASE_DAYS - 1);
      overlapsWater = chosen.start <= waterEnd && today >= cutStart;
    }
  }
  if (!chosen) {
    return {
      status: "insufficient",
      reason: daysBetween(earliestWeight, today) + 1 < MIN_WINDOW_DAYS
        ? "pas assez de jours d'historique"
        : "trop peu de jours avec des apports enregistrés",
    };
  }

  const { start, days, loggedRate, weighRate } = chosen;
  const mean = meanKcal(kcalByDate, start, today);
  const smoothed = smoothedWeightSeries(weightLog);
  const trendStart = trendAt(smoothed, start), trendEnd = trendAt(smoothed, today);
  if (mean == null || trendStart == null || trendEnd == null) {
    return { status: "insufficient", reason: "poids ou apports absents sur la fenêtre retenue" };
  }

  const deltaKg = round2(trendEnd - trendStart);
  // TDEE = apports_moyens − (Δ_tendance_kg × 7700 / nb_jours). Vérification de signe :
  // 2200 kcal/j, −0,5 kg sur 14 j → 2200 − (−0,5×7700/14) = 2200+275 = 2475 kcal/j.
  const tdee = Math.round(mean - (deltaKg * KCAL_PER_KG) / days);

  return {
    status: "ok",
    tdee, meanIntake: Math.round(mean), deltaKg,
    windowStart: start, windowEnd: today, days,
    loggedRate: round2(loggedRate), weighRate: round2(weighRate),
    reliability: reliabilityOf({ days, loggedRate, weighRate, overlapsWater }),
    overlapsWater,
  };
}

/** Déficit réel actuel = cible affichée aujourd'hui − dépense estimée. Négatif = la cible
 * est sous la dépense réelle (vrai déficit) ; positif = la cible est en fait au-dessus
 * (pas de déficit malgré l'intention). Calcul centralisé pour ne jamais diverger entre
 * l'écran Macros et le Coach IA. */
export const realDeficit = (targetKcalToday, tdee) => Math.round(targetKcalToday - tdee);
