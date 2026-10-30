// Volume hebdomadaire par groupe musculaire (chantier T2, 04/10/2026). Pur, testable en Node.
//
// Zéro donnée nouvelle : on compte les séries COCHÉES (`fait`) des 7 derniers jours dans
// `trainingLog`, sommées par le tag `groupe` de l'exercice (lu par nom dans les gabarits +
// bibliothèque via `metaFor`, comme `heavyPullDoneOn`). Un exercice substitué (`origine`)
// compte pour le groupe de l'exercice RÉELLEMENT fait (son `nom`), repli sur l'origine si
// le nom est inconnu. Exclus du décompte : le mode « temps » (gainage, isométries, cardio —
// une tenue de 45 s n'est pas une série d'hypertrophie ; c'est aussi ce qui retire
// naturellement tout le contenu Basket/Mobilité, intégralement en mode temps) et les
// groupes non musculaires `cardio`/`mobilite`.
//
// Zone cible 10-20 séries/semaine pour les groupes PRIORITAIRES de Yoann (pecs, épaules —
// décision du 04/10/2026, fourchette classique de volume hebdo pour l'hypertrophie) ;
// affichage neutre (compte seul) pour les autres. Le Coach IA reçoit le même tableau.
//
// Travail indirect (30/10/2026, choix de Yoann) : une série de développé (poussée du haut du
// corps : pecs ou épaules) compte aussi pour ½ série de triceps, une série de tirage ou de
// rowing (dos) pour ½ série de biceps. Avant, rien n'était compté en indirect : les triceps
// n'apparaissaient pas une semaine sans extensions. Le face pull (arrière d'épaule) n'en fait pas
// partie. Le total affiché est direct + ½ indirect ; le détail reste disponible (`direct`,
// `indirect`).
import { today, shiftDateKey } from "./dateUtils.js";
import { metaFor } from "./session/exoMeta.js";
import { isTimeMode } from "./training.js";

export const PRIORITY_GROUPS = ["pecs", "epaules"];
export const VOLUME_TARGET = { min: 10, max: 20 };
export const EXCLUDED_GROUPS = new Set(["cardio", "mobilite"]);
export const INDIRECT_FACTOR = 0.5;
export const GROUP_LABELS = {
  pecs: "Pectoraux", epaules: "Épaules", dos: "Dos", biceps: "Biceps", triceps: "Triceps",
  "avant-bras": "Avant-bras", quadriceps: "Quadriceps", ischios: "Ischios",
  "ischios-fessiers": "Ischios / fessiers", fessiers: "Fessiers", mollets: "Mollets", core: "Core", coiffe: "Coiffe des rotateurs",
};
// Ordre d'affichage : prioritaires d'abord, puis haut du corps, puis bas, puis core.
const ORDER = ["pecs", "epaules", "dos", "biceps", "triceps", "avant-bras", "quadriceps", "ischios", "ischios-fessiers", "fessiers", "mollets", "core", "coiffe"];

/** Groupe musculaire d'une entrée d'exercice du journal, ou `null` si inconnu/exclu. */
export function groupOf(entry) {
  const meta = metaFor(entry.nom) ?? metaFor(entry.origine);
  const mode = entry.mode ?? meta?.mode;
  if (isTimeMode(mode)) return null;
  const g = meta?.groupe;
  if (!g || EXCLUDED_GROUPS.has(g)) return null;
  return g;
}

/** Position d'un compte par rapport à la zone cible : "sous" | "dans" | "au-dessus". */
export const zoneStatus = (series, target = VOLUME_TARGET) =>
  series < target.min ? "sous" : series > target.max ? "au-dessus" : "dans";

/** Groupe travaillé en indirect par un exercice : développé → triceps, tirage du dos → biceps. */
export function indirectGroupOf(entry) {
  const meta = metaFor(entry.nom) ?? metaFor(entry.origine);
  if (!meta || isTimeMode(entry.mode ?? meta.mode)) return null;
  if (meta.mouvement === "poussee" && (meta.groupe === "pecs" || meta.groupe === "epaules")) return "triceps";
  if (meta.mouvement === "tirage" && meta.groupe === "dos") return "biceps";
  return null;
}

/**
 * Séries cochées par groupe sur les `days` derniers jours (jour `asOf` inclus).
 * @returns {{ from, to, groups: [{ groupe, label, series, direct, indirect, exercices: string[], priority, status }] }}
 *   — `series` = direct + ½ indirect ; `status` renseigné pour les groupes prioritaires
 *   seulement ; un groupe prioritaire à 0 série apparaît quand même (c'est l'information utile),
 *   un autre groupe à 0 est omis.
 */
export function weeklyVolumeByGroup(training, { asOf = today(), days = 7 } = {}) {
  const from = shiftDateKey(asOf, -(days - 1)), to = asOf;
  const acc = new Map();
  const slot = (g) => {
    if (!acc.has(g)) acc.set(g, { direct: 0, indirect: 0, exercices: new Set() });
    return acc.get(g);
  };
  (training || []).forEach((t) => {
    if (!t.date || t.date < from || t.date > to) return;
    (t.exercices || []).forEach((e) => {
      const n = (e.series || []).filter((s) => s.fait).length;
      if (!n) return;
      const g = groupOf(e);
      if (g) { const cur = slot(g); cur.direct += n; cur.exercices.add(e.nom); }
      const ig = indirectGroupOf(e);
      if (ig) slot(ig).indirect += n;
    });
  });
  PRIORITY_GROUPS.forEach((g) => slot(g));
  const groups = [...acc.entries()]
    .map(([groupe, v]) => {
      const priority = PRIORITY_GROUPS.includes(groupe);
      const series = v.direct + v.indirect * INDIRECT_FACTOR;
      return {
        groupe, label: GROUP_LABELS[groupe] ?? groupe, series, direct: v.direct, indirect: v.indirect,
        exercices: [...v.exercices], priority, status: priority ? zoneStatus(series) : null,
      };
    })
    .sort((a, b) => (ORDER.indexOf(a.groupe) + 1 || 99) - (ORDER.indexOf(b.groupe) + 1 || 99));
  return { from, to, groups };
}

/** Forme compacte pour le Coach IA : `{ pecs: 12, epaules: 9, triceps: 4.5, ... }` (groupes
 *  présents seulement ; biceps et triceps comptent le travail indirect à ½). */
export function volumeForCoach(training, opts) {
  const { groups } = weeklyVolumeByGroup(training, opts);
  const out = {};
  groups.forEach((g) => { if (g.series || g.priority) out[g.groupe] = g.series; });
  return out;
}
