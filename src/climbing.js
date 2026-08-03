// Escalade — suivi des blocs (étape V5, 03/08/2026).
//
// Périmètre volontairement réduit au BLOC : Yoann ne fait que ça (confirmé le 03/08/2026).
// Pas de sélecteur bloc/voie, pas d'échelle de cotation de voie — une seule échelle,
// Fontainebleau. Ne pas réintroduire la notion de « voie » sans demande explicite.
//
// Les blocs vivent dans l'entrée de séance existante (`trainingLog`), à côté de `duration`
// et `rpe` — exactement comme `exercices` pour la muscu. AUCUNE nouvelle clé localStorage.
//
// Aucune dépendance React : module pur, testable seul en Node.

/**
 * Échelle Fontainebleau, ordonnée. Indispensable pour calculer un maximum et une médiane :
 * une cotation est une chaîne, et `"6C+" > "6B"` n'a aucun sens en comparaison de texte.
 */
export const FONT_GRADES = [
  "3", "4", "5", "5+", "6A", "6A+", "6B", "6B+", "6C", "6C+",
  "7A", "7A+", "7B", "7B+", "7C", "7C+", "8A", "8A+", "8B", "8B+", "8C", "8C+",
];

export const gradeIndex = (c) => FONT_GRADES.indexOf(c);

/** Les trois issues possibles d'un bloc, dans l'ordre d'affichage de la saisie. */
export const ISSUES = [
  { key: "flash", label: "Flash", short: "F" },
  { key: "essais", label: "Après essais", short: "E" },
  { key: "echec", label: "Échec", short: "✗" },
];

/**
 * Métriques dérivées d'une liste de blocs — calculées, jamais stockées :
 * - volume    : nombre de blocs, le proxy de charge sur le tendon du coude ;
 * - intensité : cotation maximale et cotation médiane de la séance ;
 * - réussite  : répartition flash / après essais / échec.
 *
 * La médiane d'un nombre pair de blocs prend l'élément inférieur du milieu plutôt qu'une
 * interpolation : « 6A½ » n'existe pas, la valeur affichée doit rester une vraie cotation.
 * Les échecs comptent dans le volume (ils chargent le tendon autant, sinon plus) mais pas
 * dans l'intensité réussie — d'où `max`/`mediane` calculés sur les blocs RÉUSSIS seulement,
 * et `maxTente` pour l'essai le plus dur, échecs compris.
 */
export function climbSummary(blocs) {
  const list = (blocs || []).filter((b) => gradeIndex(b.cotation) >= 0);
  if (!list.length) return null;
  const idx = (b) => gradeIndex(b.cotation);
  const reussis = list.filter((b) => b.issue !== "echec").map(idx).sort((a, b) => a - b);
  const tous = list.map(idx).sort((a, b) => a - b);
  const med = (arr) => (arr.length ? FONT_GRADES[arr[Math.floor((arr.length - 1) / 2)]] : null);
  const count = (k) => list.filter((b) => b.issue === k).length;
  return {
    n: list.length,
    max: reussis.length ? FONT_GRADES[reussis[reussis.length - 1]] : null,
    mediane: med(reussis),
    max_tente: FONT_GRADES[tous[tous.length - 1]],
    flash: count("flash"), essais: count("essais"), echec: count("echec"),
  };
}

/** Résumé compact pour une ligne d'historique : « 14 blocs · 6B max ». */
export function climbLabel(blocs) {
  const s = climbSummary(blocs);
  if (!s) return null;
  return `${s.n} bloc${s.n > 1 ? "s" : ""}${s.max ? ` · ${s.max} max` : ""}`;
}

// Seuils de volume, en nombre de blocs. Bornes choisies pour distinguer trois situations
// réelles en salle, pas pour être précises au bloc près : une session de découverte à
// quelques blocs, une session normale, et une grosse session (10-20 blocs, le cas décrit
// par Yoann) qui charge lourdement le tendon distal du biceps.
export const CLIMB_LIGHT = 8;
export const CLIMB_HEAVY = 18;

/**
 * Charge de tirage d'une séance d'escalade, pour le recommandeur.
 * `null` si la séance n'a pas de blocs saisis : tout l'historique d'avant V5 est dans ce
 * cas, et le recommandeur doit alors garder son comportement forfaitaire d'origine plutôt
 * que de supposer une charge qu'il ne connaît pas.
 */
export function climbLoad(session) {
  const s = climbSummary(session?.blocs);
  if (!s) return null;
  return { n: s.n, level: s.n <= CLIMB_LIGHT ? "legere" : s.n >= CLIMB_HEAVY ? "grosse" : "normale", max: s.max };
}
