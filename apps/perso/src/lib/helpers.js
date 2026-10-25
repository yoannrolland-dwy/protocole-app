// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { phaseTarget as phaseTargetCore } from "@rawcare/core/targets";
import { C, today, daysBetween } from "../ui.jsx";
import { COLORS } from "../design/tokens.js";

// Courbe des protéines du graphique hebdo (09/10/2026) : ambre déjà utilisé ailleurs dans l'app
// (fiabilité TDEE, volume sous la zone), distinct des barres kcal en citron.
export const PROT_LINE = "#e8a33d";

// Poids cible Sèche/Prise rendus éditables (07/08/2026) — packages/core/src/targets.js garde
// 93/95 en dur (décision figée, ce sont des valeurs personnelles) : la surcouche vit ici.
// `targets.weightCutTarget`/`weightBulkTarget` prennent le dessus s'ils sont définis, sinon
// repli sur les constantes du core — comportement inchangé tant que rien n'est édité. Même
// principe que `weightMaintenance`, déjà éditable côté core pour la phase Maintenance.
export const phaseTarget = (phase, targets) => {
  if (phase === "seche" && targets.weightCutTarget != null) return targets.weightCutTarget;
  if (phase === "prise" && targets.weightBulkTarget != null) return targets.weightBulkTarget;
  return phaseTargetCore(phase, targets);
};

/* ---------- utilitaires ---------- */
export const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
// entrées comprises dans les n derniers jours (fenêtre glissante, aujourd'hui inclus)
const withinDays = (arr, n) => arr.filter((e) => {
  const d = daysBetween(e.date, today());
  return d >= 0 && d <= n - 1;
});
export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Couleur de la tendance de poids hebdo en Recomposition (05/10/2026) : |delta| ≤ 0,3 kg/sem
// = objectif tenu (citron) ; au-delà = ambre, dans les deux sens ; jamais rouge.
const RECOMP_TREND_MAX = 0.3;
export const recompTrendColor = (deltaWeek) => (Math.abs(deltaWeek) <= RECOMP_TREND_MAX ? C.accent : "#e8a33d");

/* ============================================================
   TAB — SOMMEIL
   ============================================================ */
// Couleur par palier de score (0-100) — mêmes seuils que ceux donnés par Yoann pour le
// score de sommeil (85+ excellent, 75-84 bon, 60-74 correct, <60 risque), réutilisés tels
// quels pour le score d'énergie (même échelle, même lecture).
export function scoreColor(v) {
  if (v == null) return C.muted;
  if (v >= 75) return C.accent;
  if (v >= 60) return "#e8a33d";
  return C.danger;
}

/* ============================================================
   TAB — PAS
   ============================================================ */
export const STEPS_TARGET = 10000;

/* ============================================================
   TAB — SÉANCES
   ============================================================ */
/* ============================================================
   ÉCRAN — PROGRESSION PAR EXERCICE (V3)
   `exoProgress` était calculé pour le Coach IA et n'apparaissait nulle part à l'écran :
   l'app avait des courbes pour le poids, le sommeil, les pas, la douleur et les calories,
   mais aucune pour l'entraînement, qui est pourtant son cœur.
   ============================================================ */
// Gris v2 pour « stable » (U3 étape 6) : le muted v1 n'atteignait que 3,5:1. Utilisé par
// ProgressScreen seul.
export const trendColor = (key) => (key === "up" ? COLORS.accent : key === "down" ? COLORS.danger : COLORS.muted);

// Couleur par palier de fiabilité — mêmes seuils visuels que la douleur (accent = bon,
// ambre = à nuancer, danger = à prendre avec de grosses pincettes). "Faible" n'utilise pas
// le rouge : ce n'est pas une alerte, juste une estimation à ne pas trop croire.
export const TDEE_RELIABILITY_COLOR = { fiable: C.accent, moyenne: "#e8a33d", faible: C.muted };
// Libellés affichés (05/10/2026) : « confiance élevée / moyenne / faible » — la répétition
// « fiabilité fiable » gênait à la lecture. Clés internes (`reliability`) inchangées.
export const TDEE_RELIABILITY_LABEL = { fiable: "élevée", moyenne: "moyenne", faible: "faible" };

/**
 * Carte "Dépense estimée" (V7). Jamais un chiffre non fiable : tant qu'il n'y a pas assez
 * de recul (14 j mini, 70 % des apports loggés), affiche pourquoi plutôt qu'un nombre.
 */
// % de jours loggés AFFICHÉ (24/09/2026) : sur les seuls jours TERMINÉS de la fenêtre. La
// fenêtre va jusqu'à aujourd'hui (pesée du matin, qui reflète les apports jusqu'à hier soir),
// mais les kcal du jour en cours sont toujours exclues (journée incomplète, voir
// buildKcalByDate) — sans ce décompte, 28 jours parfaitement saisis s'affichaient à 96 %.
// Affichage seulement : `loggedRate` (seuils de fiabilité/70 %) reste calculé comme avant.
export const loggedPct = (r) => Math.min(100, Math.round((r.loggedDays / Math.max(1, r.days - 1)) * 100));
