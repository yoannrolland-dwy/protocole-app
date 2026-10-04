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
import { TEMPLATES } from "./session/templates.js";

// « Pourquoi pas les autres ? » (04/10/2026, demande de Yoann) : chaque type de séance NON
// proposé reçoit une phrase explicative, aujourd'hui comme demain — plus jamais une séance qui
// disparaît sans raison. Mobilité exclue (jamais une contrainte, toujours possible).
const EXPLAIN_TYPES = Object.keys(TEMPLATES).filter((t) => t !== "Mobilité");

/** Un libellé d'`avoid` couvre-t-il ce type ? "Upper A / B" couvre Upper A et Upper B. */
function covers(label, type) {
  if (label === type) return true;
  if (!label.includes("/")) return false;
  const prefix = label.split(" ")[0];
  return label.slice(prefix.length).split("/").map((x) => x.trim()).some((l) => `${prefix} ${l}` === type);
}

/** Raison d'un type que le recommandeur n'a ni suggéré ni écarté (variante non retenue). */
function variantReason(type, produced, plan) {
  const other = (fam) => produced.find((t) => t !== type && t.startsWith(fam) && !t.includes("/"));
  if (type === "Full Body") return "Seulement le lendemain d'un match.";
  if (type === "Lower C") return plan.postMatch ? "Lendemain de match : le Full Body remplace le Lower." : "Seulement les semaines avec match (Lower unique de la semaine).";
  if (type.startsWith("Lower")) {
    if (plan.postMatch) return "Lendemain de match : le Full Body remplace le Lower.";
    if (plan.matchWeek) return "Semaine avec match : Lower C remplace Lower A/B.";
    const o = other("Lower");
    return o ? `Alternance : ${o} est la moins récente.` : "Pas proposé par le recommandeur.";
  }
  if (type.startsWith("Upper")) {
    const o = other("Upper");
    return o ? `Alternance : ${o} est la moins récente.` : "Pas proposé par le recommandeur.";
  }
  return "Pas proposé par le recommandeur.";
}

/**
 * Une entrée par type non affiché : `kind` = closed (journée fermée par un match) | avoid
 * (sécurité / déjà fait — raison du recommandeur) | slot (créneau, planning) | priority
 * (moins bien classé) | variant (autre variante retenue).
 */
function explain({ all, shown, avoid, slotReason, plan, closedReason }) {
  const shownSet = new Set(shown.map((x) => x.type));
  const produced = [...all, ...avoid].map((x) => x.type);
  const out = [];
  for (const type of EXPLAIN_TYPES) {
    if (shownSet.has(type)) continue;
    if (closedReason) { out.push({ type, kind: "closed", reason: closedReason }); continue; }
    const a = avoid.find((x) => covers(x.type, type));
    if (a) { out.push({ type, kind: "avoid", reason: a.reason }); continue; }
    const sg = all.find((x) => x.type === type);
    if (sg) {
      const r = slotReason ? slotReason(type) : null;
      out.push(r ? { type, kind: "slot", reason: r } : { type, kind: "priority", reason: `Moins prioritaire (score ${sg.score}).` });
      continue;
    }
    out.push({ type, kind: "variant", reason: variantReason(type, produced, plan) });
  }
  return out;
}

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
 * @returns { today: { date, status: "open"|"closed", suggestions, avoid, note, notProposed },
 *            tomorrow: { date, suggestions, avoid, caveat, notProposed } }
 * `notProposed` : [{ type, kind, reason }] — une phrase pour chaque type de séance non affiché.
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
  const slotReason = (type) => {
    if (slotOpen(type, ctx)) return null;
    if (isMuscuType(type)) return ctx.sessionDone ? "Une séance est déjà faite aujourd'hui — pas de deuxième musculation." : "Créneau passé — la musculation se fait le matin (avant 12h).";
    if (type === "Basket") return "Pas au planning aujourd'hui — le basket n'est proposé que les jours prévus.";
    return "Créneau passé — escalade le matin ou le midi (avant 14h).";
  };
  const planToday = plan(todayKey);
  let today;
  if (matchLogged(training, base.basketSchedule, todayKey)) {
    // Décision 4 : un match loggé ferme la journée — seule la mobilité reste possible.
    const closedReason = "Match joué aujourd'hui : journée terminée.";
    today = { date: todayKey, status: "closed", suggestions: [], avoid: [], note: "Match joué aujourd'hui : journée terminée — mobilité possible.",
      notProposed: explain({ all: [], shown: [], avoid: [], plan: planToday, closedReason }) };
  } else {
    const open = recoToday.suggestions.filter((s) => slotOpen(s.type, ctx)).slice(0, 3);
    const trainable = open.filter((s) => !isRestType(s.type));
    const notProposed = explain({ all: recoToday.suggestions, shown: trainable.length ? open : [], avoid: recoToday.avoid, slotReason, plan: planToday });
    today = trainable.length
      ? { date: todayKey, status: "open", suggestions: open, avoid: recoToday.avoid, note: null, notProposed }
      : { date: todayKey, status: "closed", suggestions: [], avoid: [], note: ctx.sessionDone ? "Séance du jour faite : journée terminée — mobilité possible." : "Plus de créneau d'entraînement aujourd'hui — mobilité possible.", notProposed };
  }

  // ---- Demain ---- (décision 6 : prévision — sommeil et énergie de demain inconnus, donc
  // non appliqués ; la douleur genou d'aujourd'hui compte comme relevé frais à J−1)
  const planTomorrow = plan(tomorrowKey);
  const recoTomorrow = recommendSessions({ ...base, ...planTomorrow, sleep: [], energy: undefined, asOf: tomorrowKey, limit: Infinity });
  // Même règle qu'aujourd'hui (décision 1) : un basket hors planning n'est jamais proposé —
  // ni suggéré demain, ni expliqué par un simple « moins prioritaire ».
  const basketPlannedTomorrow = isBasketPlanned(base.basketSchedule, tomorrowKey);
  const tomorrowSlot = (type) => (type === "Basket" && !basketPlannedTomorrow ? "Pas au planning ce jour-là — le basket n'est proposé que les jours prévus." : null);
  const shownTomorrow = recoTomorrow.suggestions.filter((x) => !tomorrowSlot(x.type)).slice(0, 3);
  const tomorrow = {
    date: tomorrowKey, suggestions: shownTomorrow, avoid: recoTomorrow.avoid,
    caveat: "Prévision — sous réserve de ton genou et de ta nuit.",
    notProposed: explain({ all: recoTomorrow.suggestions, shown: shownTomorrow, avoid: recoTomorrow.avoid, slotReason: tomorrowSlot, plan: planTomorrow }),
  };
  return { today, tomorrow };
}
