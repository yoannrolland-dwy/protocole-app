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
import { today, shiftDateKey } from "./dateUtils.js";
import { metaFor } from "./session/exoMeta.js";
import { isTimeMode } from "./training.js";

export const PRIORITY_GROUPS = ["pecs", "epaules"];
export const VOLUME_TARGET = { min: 10, max: 20 };
export const EXCLUDED_GROUPS = new Set(["cardio", "mobilite"]);
export const GROUP_LABELS = {
  pecs: "Pectoraux", epaules: "Épaules", dos: "Dos", biceps: "Biceps", triceps: "Triceps",
  "avant-bras": "Avant-bras", quadriceps: "Quadriceps", ischios: "Ischios",
  "ischios-fessiers": "Ischios / fessiers", fessiers: "Fessiers", mollets: "Mollets", core: "Core",
};
// Ordre d'affichage : prioritaires d'abord, puis haut du corps, puis bas, puis core.
const ORDER = ["pecs", "epaules", "dos", "biceps", "triceps", "avant-bras", "quadriceps", "ischios", "ischios-fessiers", "fessiers", "mollets", "core"];

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

/**
 * Séries cochées par groupe sur les `days` derniers jours (jour `asOf` inclus).
 * @returns {{ from, to, groups: [{ groupe, label, series, exercices: string[], priority, status }] }}
 *   — `status` renseigné pour les groupes prioritaires seulement ; un groupe prioritaire à
 *   0 série apparaît quand même (c'est l'information utile), un autre groupe à 0 est omis.
 */
export function weeklyVolumeByGroup(training, { asOf = today(), days = 7 } = {}) {
  const from = shiftDateKey(asOf, -(days - 1)), to = asOf;
  const acc = new Map();
  (training || []).forEach((t) => {
    if (!t.date || t.date < from || t.date > to) return;
    (t.exercices || []).forEach((e) => {
      const g = groupOf(e);
      if (!g) return;
      const n = (e.series || []).filter((s) => s.fait).length;
      if (!n) return;
      const cur = acc.get(g) ?? { series: 0, exercices: new Set() };
      cur.series += n; cur.exercices.add(e.nom);
      acc.set(g, cur);
    });
  });
  PRIORITY_GROUPS.forEach((g) => { if (!acc.has(g)) acc.set(g, { series: 0, exercices: new Set() }); });
  const groups = [...acc.entries()]
    .map(([groupe, v]) => {
      const priority = PRIORITY_GROUPS.includes(groupe);
      return { groupe, label: GROUP_LABELS[groupe] ?? groupe, series: v.series, exercices: [...v.exercices], priority, status: priority ? zoneStatus(v.series) : null };
    })
    .sort((a, b) => (ORDER.indexOf(a.groupe) + 1 || 99) - (ORDER.indexOf(b.groupe) + 1 || 99));
  return { from, to, groups };
}

/** Forme compacte pour le Coach IA : `{ pecs: 12, epaules: 9, ... }` (groupes présents seulement). */
export function volumeForCoach(training, opts) {
  const { groups } = weeklyVolumeByGroup(training, opts);
  const out = {};
  groups.forEach((g) => { if (g.series || g.priority) out[g.groupe] = g.series; });
  return out;
}
