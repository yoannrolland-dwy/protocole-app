// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { today, shiftDateKey } from "../ui.jsx";

// Planning hebdomadaire idéal (01/09/2026) — affiché à titre de référence dans l'onglet TDEE,
// jamais lu par le recommandeur ni le Coach IA : c'est un repère pour Yoann, pas une règle
// appliquée automatiquement. Deux variantes selon qu'il y a match ou non dans la semaine.
// Mardi/Jeudi inversés le 05/09/2026 (demande explicite de Yoann) : Upper passe au jeudi,
// le repos actif remonte au mardi. `WEEKLY_PLAN_FAMILIES` ci-dessous DOIT rester en phase
// avec ce texte (même inversion) — voir `familiesForToday`, qui couple ce planning au
// recommandeur ("Prochaine séance").
export const WEEKLY_PLAN = {
  sansMatch: [
    { jour: "Lundi", texte: "Lower A (HSR lourd) — Full Body si match la veille" },
    { jour: "Mardi", texte: "Mobilité (salle, ~20 min) + 30 min de marche ; escalade légère en option selon ressenti" },
    { jour: "Mercredi", texte: "Mobilité (matin) · Basket (soir)" },
    { jour: "Jeudi", texte: "Upper A" },
    { jour: "Vendredi", texte: "Mobilité (matin) · Basket (midi)" },
    { jour: "Samedi", texte: "Lower B (HSR)" },
    { jour: "Dimanche", texte: "Upper B" },
  ],
  avecMatch: [
    { jour: "Lundi", texte: "Lower C (HSR lourd) — Full Body si match la veille" },
    { jour: "Mardi", texte: "Mobilité + marche — même logique que la semaine sans match" },
    { jour: "Mercredi", texte: "Mobilité (matin) · Basket (soir)" },
    { jour: "Jeudi", texte: "Upper A" },
    { jour: "Vendredi", texte: "Mobilité (matin) · Basket (midi)" },
    { jour: "Samedi", texte: "Upper B + routine iso quad autonome" },
    { jour: "Dimanche", texte: "Match" },
  ],
};

// Version machine-lisible du planning ci-dessus, couplée au recommandeur (05/09/2026) :
// pour chaque jour de la semaine (index `Date#getDay()`, 0=dimanche...6=samedi), la ou les
// "familles" de séance prévues. Une famille est un préfixe de type reconnu par
// `recommendSessions` (packages/core/src/recommender.js) — "Upper" matche "Upper A"/"Upper
// B", "Lower" matche "Lower A/B/C", "Repos" matche "Mobilité" (la récup = la séance Mobilité). "Mobilité" matche aussi
// aucun type suggéré automatiquement (c'est un choix manuel, jamais suggéré) : gardée ici
// à titre documentaire, sans effet sur le score.
const WEEKLY_PLAN_FAMILIES = {
  sansMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Lower"], 0: ["Upper"] },
  avecMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Upper"], 0: ["Basket"] },
};

/**
 * Vrai si un match est prévu ce dimanche (fin de la semaine en cours, lundi-dimanche) —
 * détecté AUTOMATIQUEMENT depuis `basketSchedule.matchDates`. Décision explicite de Yoann
 * (05/09/2026) plutôt qu'un réglage manuel à rebasculer chaque semaine. Extrait de
 * `familiesForToday` le 14/09/2026 pour être réutilisé aussi par `recommendSessions`
 * (`matchWeek`, packages/core/src/recommender.js) : jusque-là le recommandeur ne pouvait
 * jamais suggérer Lower C, même un lundi de semaine avec match où la carte "Planning idéal"
 * l'annonce explicitement — retour de Yoann après l'avoir constaté en usage réel.
 */
// Jour de la semaine d'une clé "AAAA-MM-JJ" (arithmétique locale, jamais UTC).
const dowOfKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

// Les trois helpers de planning acceptent une date (chantier S, 04/10/2026) : le recommandeur
// temporel calcule aussi la séance de DEMAIN. Défaut = aujourd'hui, comportement inchangé.
export function isMatchWeek(basketSchedule, dateKey = today()) {
  const dow = dowOfKey(dateKey); // 0=dimanche...6=samedi
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  const sundayKey = shiftDateKey(dateKey, daysUntilSunday);
  return !!basketSchedule?.matchDates?.includes(sundayKey);
}

/**
 * Familles du planning idéal pour AUJOURD'HUI, à passer telles quelles à `recommendSessions`
 * (`weeklyPlan`) — le recommandeur ne sait rien du planning lui-même, juste matcher une
 * famille à un type suggéré (bonus modéré, jamais un remplacement, voir recommender.js).
 */
export function familiesForToday(basketSchedule, dateKey = today()) {
  // Lendemain de match (04/10/2026) : le planning du jour devient "Full Body", quelle que soit
  // la variante de la semaine — prime sur Lower A/C du lundi.
  if (isPostMatchDay(basketSchedule, dateKey)) return ["Full Body"];
  const dow = dowOfKey(dateKey); // 0=dimanche...6=samedi
  const variant = isMatchWeek(basketSchedule, dateKey) ? "avecMatch" : "sansMatch";
  return WEEKLY_PLAN_FAMILIES[variant][dow] || [];
}

/** Contexte de planning d'une date, au format attendu par `nextSessions` (`planFor`). */
export const planForDate = (basketSchedule) => (dateKey) => ({
  weeklyPlan: familiesForToday(basketSchedule, dateKey),
  matchWeek: isMatchWeek(basketSchedule, dateKey),
  postMatch: isPostMatchDay(basketSchedule, dateKey),
});

/**
 * Vrai si un match a eu lieu HIER (04/10/2026) — en pratique le lundi qui suit un dimanche de
 * match, jour du "Full Body" (demande de Yoann : uniquement ces lundis-là ; les dimanches sans
 * match restent des jours de musculation normaux). Nécessite que la date d'hier survive à la
 * purge des dates passées (voir l'effet de chargement d'`App` : on garde ≥ hier).
 */
export function isPostMatchDay(basketSchedule, dateKey = today()) {
  return !!basketSchedule?.matchDates?.includes(shiftDateKey(dateKey, -1));
}
