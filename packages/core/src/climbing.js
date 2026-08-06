// Escalade — suivi des blocs (étape V5, 03/08/2026). Registre de schémas de cotation
// (RawCare Phase 1, 06/08/2026) : le schéma "gym" (couleur de salle) reste le défaut, un
// schéma "fontainebleau" (échelle standard) s'y ajoute, sélectionnable dans les Réglages —
// voir apps/perso/src/App.jsx pour le réglage `climbScheme`.
//
// Périmètre volontairement réduit au BLOC : Yoann ne fait que ça (confirmé le 03/08/2026).
// Pas de sélecteur bloc/voie. Ne pas réintroduire la notion de « voie » sans demande
// explicite.
//
// Les blocs vivent dans l'entrée de séance existante (`trainingLog`), à côté de `duration`
// et `rpe` — exactement comme `exercices` pour la muscu. AUCUNE nouvelle clé localStorage
// pour les blocs eux-mêmes (le réglage `climbScheme` est une clé séparée, côté app).
//
// Fonctions pures, schéma toujours passé en paramètre explicite (jamais d'état module
// global) — cohérent avec le reste de `packages/core`. Testable seul en Node.

/**
 * Schéma "gym" : couleurs de piste, de la plus facile à la plus dure. `hex` sert uniquement
 * à repérer la ligne dans la grille de saisie : c'est la DONNÉE elle-même qui est une
 * couleur, seule exception admise à la règle « accent citron uniquement » du design system.
 * Le noir est rendu en gris clair : sur un fond #050505, un vrai noir serait invisible.
 */
export const GYM_COLORS = [
  { key: "jaune", label: "Jaune", hex: "#e8d44d" },
  { key: "vert", label: "Vert", hex: "#5fc86a" },
  { key: "bleu", label: "Bleu", hex: "#4d9ae8" },
  { key: "rouge", label: "Rouge", hex: "#e05252" },
  { key: "noir", label: "Noir", hex: "#8f8f8a" },
  { key: "violet", label: "Violet", hex: "#a56fe0" },
];
export const GYM_LEVELS = [1, 2, 3, 4, 5];
// Échelle complète ordonnée (30 cotations) : jaune 1→5, puis vert 1→5, etc. Format stocké :
// "<couleur>-<niveau>", ex. "bleu-3".
const GYM_GRADES = GYM_COLORS.flatMap((c) => GYM_LEVELS.map((n) => `${c.key}-${n}`));

/**
 * Schéma "fontainebleau" : échelle standard de bloc/bloc en salle, notation universellement
 * connue (pas besoin d'un swatch couleur ni d'un avertissement dans le prompt Coach IA,
 * contrairement au schéma "gym" qui est propre à la salle de Yoann).
 */
export const FONT_GRADES = [
  "3", "4", "4+", "5", "5+",
  "6a", "6a+", "6b", "6b+", "6c", "6c+",
  "7a", "7a+", "7b", "7b+", "7c", "7c+",
  "8a", "8a+", "8b", "8b+", "8c", "8c+",
];

/**
 * Registre des schémas de cotation. `colors`/`levels` présents = rendu en grille couleur ×
 * niveau côté UI (BlocsField) ; absents = rendu en liste plate. `makeGrade` n'a de sens que
 * pour un schéma en grille — Fontainebleau tape directement la cotation.
 */
export const SCHEMES = {
  gym: {
    id: "gym", label: "Couleur de salle",
    grades: GYM_GRADES, colors: GYM_COLORS, levels: GYM_LEVELS,
    makeGrade: (color, level) => `${color}-${level}`,
    /** « bleu-3 » → « Bleu 3 » (affichage), robuste à une valeur inconnue. */
    gradeLabel: (c) => {
      const [col, n] = String(c || "").split("-");
      const meta = GYM_COLORS.find((x) => x.key === col);
      return meta ? `${meta.label} ${n}` : String(c || "");
    },
    gradeColor: (c) => GYM_COLORS.find((x) => x.key === String(c || "").split("-")[0])?.hex || null,
  },
  fontainebleau: {
    id: "fontainebleau", label: "Fontainebleau",
    grades: FONT_GRADES,
    gradeLabel: (c) => String(c || ""),
    gradeColor: () => null,
  },
};

/** Les trois issues possibles d'un bloc, dans l'ordre d'affichage de la saisie. */
export const ISSUES = [
  { key: "flash", label: "Flash", short: "F" },
  { key: "essais", label: "Après essais", short: "E" },
  { key: "echec", label: "Échec", short: "✗" },
];

export const gradeIndex = (scheme, c) => scheme.grades.indexOf(c);

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
 * aussi bien un bloc mal saisi qu'un changement de schéma (les blocs d'un ancien schéma
 * deviennent hors échelle du nouveau, sans qu'aucune migration de données soit nécessaire).
 */
export function climbSummary(blocs, scheme) {
  const list = (blocs || []).filter((b) => b && b.cotation);
  if (!list.length) return null;
  const classables = list.filter((b) => gradeIndex(scheme, b.cotation) >= 0);
  const idx = (b) => gradeIndex(scheme, b.cotation);
  const reussis = classables.filter((b) => b.issue !== "echec").map(idx).sort((a, b) => a - b);
  const tous = classables.map(idx).sort((a, b) => a - b);
  const med = (arr) => (arr.length ? scheme.grades[arr[Math.floor((arr.length - 1) / 2)]] : null);
  const count = (k) => list.filter((b) => b.issue === k).length;
  return {
    n: list.length,
    max: reussis.length ? scheme.grades[reussis[reussis.length - 1]] : null,
    mediane: med(reussis),
    max_tente: tous.length ? scheme.grades[tous[tous.length - 1]] : null,
    flash: count("flash"), essais: count("essais"), echec: count("echec"),
  };
}

/** Résumé compact pour une ligne d'historique : « 14 blocs · Bleu 3 max ». */
export function climbLabel(blocs, scheme) {
  const s = climbSummary(blocs, scheme);
  if (!s) return null;
  return `${s.n} bloc${s.n > 1 ? "s" : ""}${s.max ? ` · ${scheme.gradeLabel(s.max)} max` : ""}`;
}

// Seuils de volume, en nombre de blocs. Bornes choisies pour distinguer trois situations
// réelles en salle, pas pour être précises au bloc près : une session de découverte à
// quelques blocs, une session normale, et une grosse session (10-20 blocs, le cas décrit
// par Yoann) qui charge lourdement le tendon distal du biceps. Indépendant du schéma de
// cotation (c'est le VOLUME de blocs qui compte, pas leur niveau).
export const CLIMB_LIGHT = 8;
export const CLIMB_HEAVY = 18;

/**
 * Charge de tirage d'une séance d'escalade, pour le recommandeur.
 * `null` si la séance n'a pas de blocs saisis : tout l'historique d'avant V5 est dans ce
 * cas, et le recommandeur doit alors garder son comportement forfaitaire d'origine plutôt
 * que de supposer une charge qu'il ne connaît pas.
 */
export function climbLoad(session, scheme) {
  const s = climbSummary(session?.blocs, scheme);
  if (!s) return null;
  return { n: s.n, level: s.n <= CLIMB_LIGHT ? "legere" : s.n >= CLIMB_HEAVY ? "grosse" : "normale", max: s.max };
}
