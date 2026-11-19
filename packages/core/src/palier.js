// « Palier de la semaine » (chantier R, R3, 02/10/2026) — moteur PUR, testable en Node.
//
// Répond à « combien je mange cette semaine » (pas « que fais-je aujourd'hui », qui est le rôle
// du recommandeur de séance, recommender.js). Propose, chaque semaine, de monter/baisser/
// maintenir les cibles kcal pour rester dans la zone de recomposition — l'app ne modifie
// JAMAIS les cibles toute seule : c'est le bouton « Appliquer » (App.jsx) qui écrit.
//
// Toutes les entrées sont déjà calculées ailleurs (jamais deux calculs différents) :
//   - `trend`  = weightTrend7(weight)  (targets.js) : moy. 7 j et deltas hebdo
//   - `recomp` = recompWindows(...)    (targets.js) : déficit RÉEL 14 j / 21 j + zone
//   - `targetHistory` (clé DATA_KEYS, R2) : dates des paliers précédents
// Les seuils sont des constantes documentées ici, pas du texte libre dans le profil coach.
import { localDateKey, shiftDateKey, daysBetween, byDate } from "./dateUtils.js";
import { kcalFromMacros } from "./targets.js";

export const PALIER = {
  OBSERVATION_DAYS: 14,        // après un palier : eau/glycogène bougent, on ne juge pas
  // La décision tombe TOUJOURS un samedi (19/11/2026, choix de Yoann : jour de cheat, et pesée du
  // matin la plus éloignée du cheat précédent) : le premier samedi à partir du 11e jour, donc
  // entre J+11 et J+17, et pile J+14 quand le palier a été appliqué un samedi. Avant, la
  // proposition se figeait le dimanche : 14 jours d'observation en donnaient jusqu'à 20.
  OBSERVATION_TOLERANCE: 3,
  MIN_LOGGED_RATE: 0.7,        // part des 7 derniers jours avec des apports loggés
  LOSS_TOO_FAST_KG_WEEK: 0.3,  // perte > 0,3 kg/sem deux semaines de suite → remonter
  // Pas FIXE de 100 kcal dans les deux sens (02/10/2026, choix de Yoann après un premier
  // +200 jugé trop brutal — rétention d'eau, tendons) : plus lent à converger quand le déficit
  // est grand (2-3 paliers espacés de 14 j), mais chaque étape est réévaluée sur du réel.
  STEP_UP: 100, STEP_DOWN: 100, MAX_STEP: 100,
  // Un changement de cibles ne compte comme PALIER (et ne déclenche l'observation) que si le
  // changement NET sur la journée atteint 100 kcal — une retouche protéines/glucides à total
  // constant n'en est pas un (même décision du 02/10/2026).
  MIN_CHANGE_KCAL: 100,
  CARBS_SHARE: 0.75,           // un palier se répartit 75 % glucides / 25 % lipides
  ROUND_G: 5,                  // arrondi des grammes
  DECISION_DOW: 6,             // samedi (0 = dimanche)
  DECISION_HOUR: 10,           // à partir de 10 h : la pesée du samedi matin est comptée
};

// Zones adjacentes = lecture cohérente ; deux fenêtres à plus d'un cran d'écart = désaccord.
const ZONE_RANK = { surplus: 0, sous: 1, visee: 2, haut: 3, trop: 4 };

/**
 * Une entrée `targetHistory` est un vrai palier si elle vient du bouton « Appliquer »
 * (`source: "palier"`), ou si son changement net atteint `MIN_CHANGE_KCAL` — mesuré contre
 * `prevKcal` (kcal en début de journée, écrit par `save.targets` depuis le 02/10/2026) ou, à
 * défaut, contre l'entrée précédente. Une entrée sans aucun point de comparaison (ancienne
 * entrée isolée) n'est PAS un palier : un delta inconnu ne prouve rien.
 */
export const isPalierEntry = (e, prev) => {
  if (!e) return false;
  if (e.source === "palier") return true;
  const ref = e.prevKcal ?? prev?.kcal ?? null;
  return ref != null && Math.abs(e.kcal - ref) >= PALIER.MIN_CHANGE_KCAL;
};

/** Dernier VRAI palier de l'historique (ou `null`). */
export const lastPalier = (targetHistory) => {
  const h = [...(targetHistory || [])].filter((p) => p?.date).sort(byDate);
  let last = null;
  h.forEach((e, i) => { if (isPalierEntry(e, h[i - 1])) last = e; });
  return last;
};

/**
 * Samedi auquel se rattache la proposition courante (début de la « semaine » du palier, qui va du
 * samedi au vendredi). Le samedi à partir de 10 h : ce samedi. Le samedi AVANT 10 h, et du
 * dimanche au vendredi : le samedi précédent. Arithmétique locale (famille `shiftDateKey`),
 * jamais un aller-retour par un instant UTC. Jusqu'au 19/11/2026 : lundi, bascule dimanche 14 h.
 */
export function palierWeekOf(now = new Date()) {
  const dow = now.getDay(); // 0 = dimanche
  const key = localDateKey(now);
  if (dow === PALIER.DECISION_DOW) return now.getHours() >= PALIER.DECISION_HOUR ? key : shiftDateKey(key, -7);
  return shiftDateKey(key, -((dow - PALIER.DECISION_DOW + 7) % 7));
}

/** Premier jour où un palier posé le `lastDate` peut être rejugé (J+11). */
const observationEnd = (lastDate) => shiftDateKey(lastDate, PALIER.OBSERVATION_DAYS - PALIER.OBSERVATION_TOLERANCE);

/** Samedi de la prochaine décision après un palier posé le `lastDate` : le premier samedi à
 *  partir de J+11. */
export function nextPalierDecision(lastDate) {
  const from = observationEnd(lastDate);
  const [y, m, d] = from.split("-").map(Number);
  return shiftDateKey(from, (PALIER.DECISION_DOW - new Date(y, m - 1, d).getDay() + 7) % 7);
}

/** Part des `days` jours TERMINÉS (t0−1 … t0−days) ayant des apports dans `kcalByDate`. */
export function loggedRateLastDays(kcalByDate, t0, days = 7) {
  let n = 0;
  for (let i = 1; i <= days; i++) if (kcalByDate?.[shiftDateKey(t0, -i)] != null) n++;
  return n / days;
}

/** Répartit un palier de `deltaKcal` : 75 % glucides / 25 % lipides, arrondis à 5 g,
 * protéines et fibres jamais touchées (décision 10 de la spec). */
export function splitDelta(deltaKcal, targets) {
  const r5 = (g) => Math.round(g / PALIER.ROUND_G) * PALIER.ROUND_G;
  const carbs = Math.max(0, (targets.carbs ?? 0) + r5((deltaKcal * PALIER.CARBS_SHARE) / 4));
  const fat = Math.max(0, (targets.fat ?? 0) + r5((deltaKcal * (1 - PALIER.CARBS_SHARE)) / 9));
  const protein = targets.protein ?? 0, fiber = targets.fiber ?? 0;
  return { protein, carbs, fat, fiber, kcal: Math.round(kcalFromMacros(protein, carbs, fat, fiber)) };
}

/**
 * @returns { weekOf, action: "hold"|"up"|"down", deltaKcal, proposed|null, reasons[], blocked|null,
 *            observation?, facts: { why, … } }
 * `facts.why` : observation | peuLogge | sansDonnees | desaccord (garde-fous) ; trop | haut |
 * perteRapide (hausse) ; surplus | poidsMonte (baisse) ; sous | visee (maintien).
 * `blocked` non nul = un garde-fou a empêché toute proposition (observation, données) ; un
 * `hold` sans `blocked` = données suffisantes, la zone est bonne, on maintient.
 */
export function recommendTargets({ now = new Date(), targets, trend, recomp, targetHistory, loggedRate7 }) {
  const weekOf = palierWeekOf(now);
  const t0 = localDateKey(now);
  const hold = (reason, extra = {}) => ({ weekOf, action: "hold", deltaKcal: 0, proposed: null, reasons: [reason], blocked: reason, ...extra });

  // 1. Période d'observation après le dernier VRAI palier (≥ MIN_CHANGE_KCAL net, ou appliqué
  //    depuis la carte) — prime sur tout le reste. Elle se juge au SAMEDI de la proposition
  //    (`weekOf`), pas au jour du calcul : un recalcul en milieu de semaine (cibles retouchées à
  //    la main, app pas ouverte le samedi) répond comme l'aurait fait le samedi.
  const last = lastPalier(targetHistory);
  if (last) {
    const since = daysBetween(last.date, t0);
    if (weekOf < observationEnd(last.date)) {
      return hold(`Observation après le palier du ${last.date} : J+${since}/${PALIER.OBSERVATION_DAYS}`,
        { observation: { since, until: shiftDateKey(last.date, PALIER.OBSERVATION_DAYS) }, facts: { why: "observation", lastDate: last.date, next: nextPalierDecision(last.date) } });
    }
  }

  // 2. Données : jamais un chiffre inventé.
  if (loggedRate7 != null && loggedRate7 < PALIER.MIN_LOGGED_RATE) {
    return hold(`Semaine trop peu loggée (${Math.round(loggedRate7 * 100)} % des jours)`, { facts: { why: "peuLogge", pct: Math.round(loggedRate7 * 100) } });
  }
  const r14 = recomp?.j14?.reading, r21 = recomp?.j21?.reading;
  if (!r14 || !r21) return hold("Dépense sur 14 et 21 j indisponible — pas assez de données", { facts: { why: "sansDonnees" } });
  if (Math.abs(ZONE_RANK[r14.zone] - ZONE_RANK[r21.zone]) > 1) {
    return hold(`Fenêtres en désaccord — 14 j : ${r14.label} ; 21 j : ${r21.label}. Attendre qu'elles convergent`,
      { facts: { why: "desaccord", label14: r14.label, label21: r21.label } });
  }

  const deficit = Math.round((r14.deficit + r21.deficit) / 2);
  const reasons = [`Déficit réel moyen 14/21 j : ${deficit} kcal/j (${r14.zone === r21.zone ? r14.label : `14 j ${r14.label}, 21 j ${r21.label}`})`];
  const d1 = trend?.deltaWeek ?? null, d2 = trend?.deltaWeekPrev ?? null;
  const sg = (x) => `${x > 0 ? "+" : ""}${x}`;
  if (d1 != null) reasons.push(`Poids moy. 7 j : ${sg(d1)} kg/sem${d2 != null ? ` (semaine d'avant ${sg(d2)})` : ""}`);

  // 3. Hausse (déficit trop fort, ou perte trop rapide deux semaines de suite) — toujours
  //    +STEP_UP, quelle que soit l'ampleur du déficit : le palier suivant viendra environ 14 j plus tard.
  // `why` = la raison retenue, en code (19/11/2026) : la carte du Bord et la montre en font des
  // phrases entières (lib/bordView.js). Les textes `reasons` ci-dessous restent tels quels, le
  // Coach les lit.
  let delta = 0, why;
  const lossTooFast = d1 != null && d2 != null && d1 <= -PALIER.LOSS_TOO_FAST_KG_WEEK && d2 <= -PALIER.LOSS_TOO_FAST_KG_WEEK;
  if (deficit > 500) { delta = PALIER.STEP_UP; why = "trop"; reasons.push("Déficit > 500 kcal/j : trop élevé pour gagner du muscle — remonter par paliers de 100"); }
  else if (deficit > 300) { delta = PALIER.STEP_UP; why = "haut"; reasons.push("Déficit 300-500 kcal/j : haut pour une recomposition"); }
  else if (lossTooFast) { delta = PALIER.STEP_UP; why = "perteRapide"; reasons.push(`Perte > ${PALIER.LOSS_TOO_FAST_KG_WEEK} kg/sem deux semaines de suite`); }
  // 4. Baisse (surplus, ou moyenne 7 j qui remonte deux semaines de suite).
  else if (deficit <= 0) { delta = -PALIER.STEP_DOWN; why = "surplus"; reasons.push("Surplus : hors objectif"); }
  else if (d1 != null && d2 != null && d1 > 0 && d2 > 0) { delta = -PALIER.STEP_DOWN; why = "poidsMonte"; reasons.push("Moyenne 7 j en hausse deux semaines de suite"); }
  // 5. Sinon : maintenir.
  else { why = deficit < 100 ? "sous" : "visee"; reasons.push(deficit < 100 ? "Légèrement sous la zone visée : maintenir et observer" : "Zone visée : maintenir"); }

  delta = Math.max(-PALIER.MAX_STEP, Math.min(PALIER.MAX_STEP, delta));
  const facts = { why, deficit, weekDelta: d1, weekDeltaPrev: d2 };
  if (delta === 0) return { weekOf, action: "hold", deltaKcal: 0, proposed: null, reasons, blocked: null, facts };
  return { weekOf, action: delta > 0 ? "up" : "down", deltaKcal: delta, proposed: splitDelta(delta, targets), reasons, blocked: null, facts };
}
