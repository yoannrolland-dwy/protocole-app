// Couleur d'avancement vers une cible (25/10/2026, demande de Yoann), UNE règle pour tous les
// écrans afin qu'aucun ne dise autre chose qu'un autre :
//  - "limit" (calories, glucides, lipides) : citron jusqu'à la cible, ORANGE jusqu'à +10 %,
//    ROUGE au-delà (seuil choisi par Yoann) ;
//  - "goal" (pas, eau, protéines, fibres) : citron tant que la cible n'est pas atteinte, BLEU
//    une fois atteinte ou dépassée (dépasser est une bonne nouvelle : protéines et fibres
//    traitées comme pas et eau, choix de Yoann pour la recomposition).
// Fichier JS pur (aucun JSX) pour rester testable en Node.
import { COLORS } from "../design/tokens.js";

export const OVER_LIGHT = 1.10; // au-delà : gros dépassement

/** État : "under" | "over-light" | "over-heavy" (limit) ou "under" | "reached" (goal). */
export function progressState(value, target, kind) {
  if (value == null || !(target > 0)) return "under";
  const r = value / target;
  if (kind === "goal") return r >= 1 ? "reached" : "under";
  if (r <= 1) return "under";
  return r <= OVER_LIGHT ? "over-light" : "over-heavy";
}

const COLOR = { under: COLORS.accent, "over-light": COLORS.warn, "over-heavy": COLORS.danger, reached: COLORS.over };

/** Couleur hex brute (utilisable aussi dans les attributs SVG de recharts). */
export function progressColor(value, target, kind) {
  return COLOR[progressState(value, target, kind)];
}

export const MACRO_KIND = { prot: "goal", fib: "goal", gluc: "limit", lip: "limit", kcal: "limit" };
