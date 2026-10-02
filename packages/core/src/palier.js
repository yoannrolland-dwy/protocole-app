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
  MIN_LOGGED_RATE: 0.7,        // part des 7 derniers jours avec des apports loggés
  LOSS_TOO_FAST_KG_WEEK: 0.3,  // perte > 0,3 kg/sem deux semaines de suite → remonter
  UP_SMALL: 150, UP_BIG: 200, DOWN: 100, MAX_STEP: 200,
  CARBS_SHARE: 0.75,           // un palier se répartit 75 % glucides / 25 % lipides
  ROUND_G: 5,                  // arrondi des grammes
  SUNDAY_HOUR: 14,             // la proposition de la semaine suivante existe dès dimanche 14 h
};

// Zones adjacentes = lecture cohérente ; deux fenêtres à plus d'un cran d'écart = désaccord.
const ZONE_RANK = { surplus: 0, sous: 1, visee: 2, haut: 3, trop: 4 };

/**
 * Lundi de la semaine à laquelle s'applique la proposition courante. Du lundi au samedi, et
 * le dimanche AVANT 14 h : le lundi de la semaine en cours. Le dimanche à partir de 14 h : le
 * lundi suivant (la proposition se fige pour la semaine qui arrive). Arithmétique locale
 * (famille `shiftDateKey`), jamais un aller-retour par un instant UTC.
 */
export function palierWeekOf(now = new Date()) {
  const dow = now.getDay(); // 0 = dimanche
  const key = localDateKey(now);
  if (dow === 0 && now.getHours() >= PALIER.SUNDAY_HOUR) return shiftDateKey(key, 1);
  return shiftDateKey(key, -(dow === 0 ? 6 : dow - 1));
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
 *            observation? }
 * `blocked` non nul = un garde-fou a empêché toute proposition (observation, données) ; un
 * `hold` sans `blocked` = données suffisantes, la zone est bonne, on maintient.
 */
export function recommendTargets({ now = new Date(), targets, trend, recomp, targetHistory, loggedRate7 }) {
  const weekOf = palierWeekOf(now);
  const t0 = localDateKey(now);
  const hold = (reason, extra = {}) => ({ weekOf, action: "hold", deltaKcal: 0, proposed: null, reasons: [reason], blocked: reason, ...extra });

  // 1. Période d'observation après le dernier palier — prime sur tout le reste.
  const last = [...(targetHistory || [])].filter((p) => p?.date).sort(byDate).at(-1);
  if (last) {
    const since = daysBetween(last.date, t0);
    if (since < PALIER.OBSERVATION_DAYS) {
      return hold(`Observation après le palier du ${last.date} : J+${since}/${PALIER.OBSERVATION_DAYS}`,
        { observation: { since, until: shiftDateKey(last.date, PALIER.OBSERVATION_DAYS) } });
    }
  }

  // 2. Données : jamais un chiffre inventé.
  if (loggedRate7 != null && loggedRate7 < PALIER.MIN_LOGGED_RATE) {
    return hold(`Semaine trop peu loggée (${Math.round(loggedRate7 * 100)} % des jours)`);
  }
  const r14 = recomp?.j14?.reading, r21 = recomp?.j21?.reading;
  if (!r14 || !r21) return hold("Dépense sur 14 et 21 j indisponible — pas assez de données");
  if (Math.abs(ZONE_RANK[r14.zone] - ZONE_RANK[r21.zone]) > 1) {
    return hold(`Fenêtres en désaccord — 14 j : ${r14.label} ; 21 j : ${r21.label}. Attendre qu'elles convergent`);
  }

  const deficit = Math.round((r14.deficit + r21.deficit) / 2);
  const reasons = [`Déficit réel moyen 14/21 j : ${deficit} kcal/j (${r14.zone === r21.zone ? r14.label : `14 j ${r14.label}, 21 j ${r21.label}`})`];
  const d1 = trend?.deltaWeek ?? null, d2 = trend?.deltaWeekPrev ?? null;
  const sg = (x) => `${x > 0 ? "+" : ""}${x}`;
  if (d1 != null) reasons.push(`Poids moy. 7 j : ${sg(d1)} kg/sem${d2 != null ? ` (semaine d'avant ${sg(d2)})` : ""}`);

  // 3. Hausse (déficit trop fort, ou perte trop rapide deux semaines de suite).
  let delta = 0;
  const lossTooFast = d1 != null && d2 != null && d1 <= -PALIER.LOSS_TOO_FAST_KG_WEEK && d2 <= -PALIER.LOSS_TOO_FAST_KG_WEEK;
  if (deficit > 500) { delta = PALIER.UP_BIG; reasons.push("Déficit > 500 kcal/j : trop élevé pour gagner du muscle"); }
  else if (deficit > 300) { delta = PALIER.UP_SMALL; reasons.push("Déficit 300-500 kcal/j : haut pour une recomposition"); }
  else if (lossTooFast) { delta = PALIER.UP_SMALL; reasons.push(`Perte > ${PALIER.LOSS_TOO_FAST_KG_WEEK} kg/sem deux semaines de suite`); }
  // 4. Baisse (surplus, ou moyenne 7 j qui remonte deux semaines de suite).
  else if (deficit <= 0) { delta = -PALIER.DOWN; reasons.push("Surplus : hors objectif"); }
  else if (d1 != null && d2 != null && d1 > 0 && d2 > 0) { delta = -PALIER.DOWN; reasons.push("Moyenne 7 j en hausse deux semaines de suite"); }
  // 5. Sinon : maintenir.
  else reasons.push(deficit < 100 ? "Légèrement sous la zone visée : maintenir et observer" : "Zone visée : maintenir");

  delta = Math.max(-PALIER.MAX_STEP, Math.min(PALIER.MAX_STEP, delta));
  if (delta === 0) return { weekOf, action: "hold", deltaKcal: 0, proposed: null, reasons, blocked: null };
  return { weekOf, action: delta > 0 ? "up" : "down", deltaKcal: delta, proposed: splitDelta(delta, targets), reasons, blocked: null };
}
