// État d'une zone douloureuse (genou, coude) — même forme d'entrée pour les deux :
// { date, pain, baseline }. Extrait de src/App.jsx (apps/perso) le 05/08/2026, chantier
// RawCare Phase 0. Pur, contenu inchangé.
//
// Extrait à l'origine du recommandeur (03/08/2026) pour que le genou et le coude partagent
// exactement la même lecture (péremption, seuils, comptage hors base) au lieu de deux
// logiques parallèles qui divergeraient au premier ajustement.
//
// N'inclut PAS `PAIN_ZONES` (config d'affichage de l'onglet Douleurs — titres, textes,
// drapeaux hsr/routines) : c'est de la présentation UI, pas un mécanisme partagé — le
// recommandeur ne l'utilise même pas. `PAIN_ZONES` reste dans apps/perso/src/App.jsx.

import { lastN, daysBetween } from "./dateUtils.js";

// Une douleur notée il y a plus de 3 jours n'est plus un état, c'est une donnée périmée :
// sans cette péremption, une note à 6 bloquait les séances indéfiniment jusqu'à la
// prochaine saisie. Critique depuis que la douleur n'a plus de valeur par défaut (donc
// moins de saisies, donc des états plus souvent périmés).
export const PAIN_FRESH_DAYS = 3;

/**
 * @param log      journal de la zone (kneeLog / elbowLog)
 * @param t0       date du jour
 * @param label    libellé affiché dans les raisons ("genou", "coude")
 * @param opts.unknownIsCaution  true (genou) : pas de donnée fraîche ⇒ prudence par défaut,
 *   parce que le quadricipital est le tendon qui interdit des séances entières et qu'une
 *   absence de saisie ne doit pas passer pour un feu vert. false (coude) : silence total,
 *   même principe que les nudges sommeil/charge — le coude module des scores, il ne bloque
 *   rien tant qu'aucune donnée réelle ne le justifie.
 */
export function zoneState(log, t0, label, { unknownIsCaution }) {
  const within = (arr, n) => arr.filter((e) => { const d = daysBetween(e.date, t0); return d >= 0 && d <= n; });
  const last = lastN(log || [], 1)[0];
  const age = last ? daysBetween(last.date, t0) : Infinity;
  const fresh = !!last && age >= 0 && age <= PAIN_FRESH_DAYS;
  const unknown = !fresh;
  const painLast = fresh ? last.pain : null;
  const flagged7 = within(log || [], 6).filter((k) => k.baseline === false).length;
  const red = fresh && (last.baseline === false || last.pain >= 6);
  // État inconnu ≠ feu vert (genou) : on reste prudent sans bloquer, et on le dit dans la
  // raison affichée pour inciter à noter la douleur.
  const amber = !red && ((unknownIsCaution && unknown) || painLast >= 4 || flagged7 >= 1);
  const note = unknown && unknownIsCaution
    ? (last ? `Douleur ${label} pas notée depuis ${age} j — prudence par défaut, note-la pour un vrai conseil.` : `Douleur ${label} jamais notée — prudence par défaut.`)
    : null;
  // Motif chiffré réutilisé tel quel dans les "à éviter", pour que la raison affichée
  // porte toujours le fait qui a déclenché l'exclusion.
  const redWhy = red ? (last.baseline === false ? "pas revenu à la base sous 24 h" : `douleur ${last.pain}/10`) : null;
  return { last, age, fresh, unknown, painLast, flagged7, red, amber, note, redWhy };
}
