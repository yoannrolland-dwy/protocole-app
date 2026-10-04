// Recommandeur TEMPOREL (chantier S, S1, 04/10/2026) — module PUR, testable en Node.
//
// Constat de Yoann (dimanche 21h10, après un match) : « Prochaine séance » proposait encore
// Lower C alors que le lendemain serait un Full Body. `recommendSessions` ne connaît que la
// date, jamais l'heure. Ce module répond à deux questions à la fois :
//   - AUJOURD'HUI : qu'est-ce qui reste faisable, compte tenu de l'heure et de ce qui est déjà
//     loggé ? (créneaux tirés des habitudes de Yoann, décision 1 de la spec)
//   - DEMAIN : qu'est-ce qui est prévu ? (prévision — sommeil/énergie de demain inconnus)
// Les deux appellent `recommendSessions` (une seule logique de score), `asOf` changeant la
// date de référence. Le planning idéal vit côté app : l'appelant fournit `planFor(dateKey)`.
import { localDateKey, shiftDateKey } from "./dateUtils.js";
import { recommendSessions } from "./recommender.js";

// Créneaux (décision 1 — habitudes, pas des règles : rien n'est bloqué à la saisie, seule la
// suggestion affichée change). Heures locales.
export const SLOTS = { MORNING_END: 12, MIDDAY_END: 14 };

const isMuscuType = (type) => /^(Upper|Lower|Full Body)/.test(type);
const isRestType = (type) => type.startsWith("Repos");
const dowOf = (dateKey) => { const [y, m, d] = dateKey.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

/** Basket prévu ce jour-là (jour hebdo fixe ou date de match) — même règle que le recommandeur. */
export const isBasketPlanned = (basketSchedule, dateKey) =>
  !!(basketSchedule?.matchDates?.includes(dateKey) || basketSchedule?.weekly?.includes(dowOf(dateKey)));

/** Un match loggé aujourd'hui = une séance Basket à une date du calendrier de matchs. */
export const matchLogged = (training, basketSchedule, dateKey) =>
  !!basketSchedule?.matchDates?.includes(dateKey) && training.some((t) => t.date === dateKey && t.type === "Basket");

/**
 * Le type est-il encore faisable aujourd'hui à l'heure `hour`, sachant si une séance (hors
 * mobilité) a déjà été loggée aujourd'hui ? Décisions 1 et 3 de la spec :
 *   - repos/mobilité : toujours (la mobilité n'est jamais une contrainte) ;
 *   - musculation : le matin, et seulement si rien n'est encore loggé (pas de 2e muscu) ;
 *   - escalade : jusqu'à 14h (matin ou midi), y compris en 2e séance ;
 *   - basket : seulement s'il est planifié (jour fixe ou match), toute la journée tant qu'il
 *     n'est pas loggé ; jamais proposé hors planning.
 *   - autres sports (catalogue public) : comme l'escalade.
 */
export function slotOpen(type, { hour, sessionDone, basketPlanned }) {
  if (isRestType(type)) return true;
  if (isMuscuType(type)) return hour < SLOTS.MORNING_END && !sessionDone;
  if (type === "Basket") return basketPlanned; // décision 1 : basket seulement s'il est au planning
  return hour < SLOTS.MIDDAY_END;
}

/**
 * @param now        Date (injectable pour les tests et l'aperçu)
 * @param base       les entrées habituelles de `recommendSessions` (training, knee, sleep,
 *                   targets, scheme, basketSchedule, energy, zones…) — SANS weeklyPlan/
 *                   matchWeek/postMatch/asOf, que ce module calcule par date.
 * @param planFor    (dateKey) => { weeklyPlan, matchWeek, postMatch } — fourni par l'app.
 * @returns { today: { date, status: "open"|"closed", suggestions, avoid, note },
 *            tomorrow: { date, suggestions, avoid, caveat } }
 */
export function nextSessions({ now = new Date(), base, planFor }) {
  const todayKey = localDateKey(now);
  const tomorrowKey = shiftDateKey(todayKey, 1);
  const hour = now.getHours();
  const training = base.training || [];
  const plan = (d) => (planFor ? planFor(d) : {}) || {};

  // ---- Aujourd'hui ----
  // `limit: Infinity` : le filtrage par créneau doit voir TOUTES les suggestions, sinon une
  // option 4e au score (ex. l'escalade du midi après une muscu du matin) serait coupée avant
  // même d'être évaluée. On recoupe à 3 après filtrage.
  const recoToday = recommendSessions({ ...base, ...plan(todayKey), asOf: todayKey, limit: Infinity });
  const doneToday = training.filter((t) => t.date === todayKey && t.type !== "Mobilité");
  const ctx = {
    hour,
    sessionDone: doneToday.length > 0,
    basketPlanned: isBasketPlanned(base.basketSchedule, todayKey) && !doneToday.some((t) => t.type === "Basket"),
  };
  let today;
  if (matchLogged(training, base.basketSchedule, todayKey)) {
    // Décision 4 : un match loggé ferme la journée — seule la mobilité reste possible.
    today = { date: todayKey, status: "closed", suggestions: [], avoid: [], note: "Match joué aujourd'hui : journée terminée — mobilité possible." };
  } else {
    const open = recoToday.suggestions.filter((s) => slotOpen(s.type, ctx)).slice(0, 3);
    const trainable = open.filter((s) => !isRestType(s.type));
    today = trainable.length
      ? { date: todayKey, status: "open", suggestions: open, avoid: recoToday.avoid, note: null }
      : { date: todayKey, status: "closed", suggestions: [], avoid: [], note: ctx.sessionDone ? "Séance du jour faite : journée terminée — mobilité possible." : "Plus de créneau d'entraînement aujourd'hui — mobilité possible." };
  }

  // ---- Demain ---- (décision 6 : prévision — sommeil et énergie de demain inconnus, donc
  // non appliqués ; la douleur genou d'aujourd'hui compte comme relevé frais à J−1)
  const recoTomorrow = recommendSessions({ ...base, ...plan(tomorrowKey), sleep: [], energy: undefined, asOf: tomorrowKey });
  const tomorrow = {
    date: tomorrowKey, suggestions: recoTomorrow.suggestions, avoid: recoTomorrow.avoid,
    caveat: "Prévision — sous réserve de ton genou et de ta nuit.",
  };
  return { today, tomorrow };
}
