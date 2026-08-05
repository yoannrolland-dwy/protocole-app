// Escalade — suivi des blocs (étape V5, 03/08/2026).
//
// Périmètre volontairement réduit au BLOC : Yoann ne fait que ça (confirmé le 03/08/2026).
// Pas de sélecteur bloc/voie. Ne pas réintroduire la notion de « voie » sans demande
// explicite.
//
// ÉCHELLE : celle de SA SALLE, par couleur de piste — PAS Fontainebleau (corrigé le
// 03/08/2026, la version 3.46.0 était partie sur Font par erreur). Six couleurs ordonnées,
// et cinq niveaux dans chaque couleur. C'est ce qu'il lit sur le mur : lui demander de
// convertir en 6B+ serait une saisie fausse et lente.
//
// Les blocs vivent dans l'entrée de séance existante (`trainingLog`), à côté de `duration`
// et `rpe` — exactement comme `exercices` pour la muscu. AUCUNE nouvelle clé localStorage.
//
// Aucune dépendance React : module pur, testable seul en Node.

/**
 * Couleurs de piste, de la plus facile à la plus dure. `hex` sert uniquement à repérer la
 * ligne dans la grille de saisie : c'est la DONNÉE elle-même qui est une couleur, seule
 * exception admise à la règle « accent citron uniquement » du design system.
 * Le noir est rendu en gris clair : sur un fond #050505, un vrai noir serait invisible.
 */
export const COLORS = [
  { key: "jaune", label: "Jaune", hex: "#e8d44d" },
  { key: "vert", label: "Vert", hex: "#5fc86a" },
  { key: "bleu", label: "Bleu", hex: "#4d9ae8" },
  { key: "rouge", label: "Rouge", hex: "#e05252" },
  { key: "noir", label: "Noir", hex: "#8f8f8a" },
  { key: "violet", label: "Violet", hex: "#a56fe0" },
];
export const LEVELS = [1, 2, 3, 4, 5];

/**
 * Échelle complète ordonnée (30 cotations) : jaune 1→5, puis vert 1→5, etc. Indispensable
 * pour un maximum et une médiane — une cotation est une chaîne, et `"vert-2" > "bleu-5"`
 * en comparaison de texte est faux (et l'ordre alphabétique des couleurs n'a rien à voir
 * avec leur difficulté).
 * Format stocké : `"<couleur>-<niveau>"`, ex. `"bleu-3"`.
 */
export const GRADES = COLORS.flatMap((c) => LEVELS.map((n) => `${c.key}-${n}`));

export const gradeIndex = (c) => GRADES.indexOf(c);
export const makeGrade = (color, level) => `${color}-${level}`;
/** « bleu-3 » → « Bleu 3 » (affichage), robuste à une valeur inconnue. */
export const gradeLabel = (c) => {
  const [col, n] = String(c || "").split("-");
  const meta = COLORS.find((x) => x.key === col);
  return meta ? `${meta.label} ${n}` : String(c || "");
};
export const gradeColor = (c) => COLORS.find((x) => x.key === String(c || "").split("-")[0])?.hex || null;

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
 * interpolation : « bleu 3½ » n'existe pas, la valeur affichée doit rester une vraie
 * cotation. Les échecs comptent dans le volume (ils chargent le tendon autant, sinon plus)
 * mais pas dans l'intensité réussie — d'où `max`/`mediane` calculés sur les blocs RÉUSSIS
 * seulement, et `max_tente` pour l'essai le plus dur, échecs compris.
 *
 * Une cotation hors échelle compte dans le VOLUME mais pas dans l'intensité : elle charge
 * le coude quoi qu'il arrive, et on ne peut pas la classer sans inventer un ordre. Couvre
 * les blocs éventuellement saisis en Fontainebleau par la v3.46.0 (échelle corrigée juste
 * après) : leur charge reste comptée au lieu de disparaître silencieusement.
 */
export function climbSummary(blocs) {
  const list = (blocs || []).filter((b) => b && b.cotation);
  if (!list.length) return null;
  const classables = list.filter((b) => gradeIndex(b.cotation) >= 0);
  const idx = (b) => gradeIndex(b.cotation);
  const reussis = classables.filter((b) => b.issue !== "echec").map(idx).sort((a, b) => a - b);
  const tous = classables.map(idx).sort((a, b) => a - b);
  const med = (arr) => (arr.length ? GRADES[arr[Math.floor((arr.length - 1) / 2)]] : null);
  const count = (k) => list.filter((b) => b.issue === k).length;
  return {
    n: list.length,
    max: reussis.length ? GRADES[reussis[reussis.length - 1]] : null,
    mediane: med(reussis),
    max_tente: tous.length ? GRADES[tous[tous.length - 1]] : null,
    flash: count("flash"), essais: count("essais"), echec: count("echec"),
  };
}

/** Résumé compact pour une ligne d'historique : « 14 blocs · Bleu 3 max ». */
export function climbLabel(blocs) {
  const s = climbSummary(blocs);
  if (!s) return null;
  return `${s.n} bloc${s.n > 1 ? "s" : ""}${s.max ? ` · ${gradeLabel(s.max)} max` : ""}`;
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
