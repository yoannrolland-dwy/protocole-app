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
//
// RawCare Phase 1, zones dynamiques (06/08/2026) : `zoneState`/`buildZones` prenaient
// exactement 2 zones nommées "genou"/"coude" en dur. Généralisés en un CADRE — N zones
// arbitraires, chacune avec ses propres seuils Silbernagel (péremption, seuil rouge, seuil
// ambre) — pour qu'une future `apps/public` puisse laisser un utilisateur définir ses
// propres zones (nom libre, paramètres réglables), comme prévu par la feuille de route
// ("cadre configurable libre ... zéro zone par défaut"). AUCUN changement de stockage :
// `apps/perso` continue de fournir exactement `knee`/`elbow` via `DEFAULT_ZONES` ci-dessous
// — la question du stockage dynamique (`kneeLog`/`elbowLog` figés vs clé arbitraire) reste
// volontairement hors scope, comme tranché au lot précédent pour le recommandeur : c'est
// une décision de migration de données, à prendre au calme, pas un prérequis pour que le
// moteur lui-même sache gérer N zones.

import { lastN, daysBetween } from "./dateUtils.js";

// Une douleur notée il y a plus de 3 jours n'est plus un état, c'est une donnée périmée :
// sans cette péremption, une note à 6 bloquait les séances indéfiniment jusqu'à la
// prochaine saisie. Critique depuis que la douleur n'a plus de valeur par défaut (donc
// moins de saisies, donc des états plus souvent périmés).
// Reste la valeur par DÉFAUT (zones sans `freshDays` explicite) — désormais réglable par
// zone, voir `zoneState`.
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
 * @param opts.freshDays            péremption en jours (défaut `PAIN_FRESH_DAYS` = 3).
 * @param opts.redPainThreshold     douleur ≥ ce seuil ⇒ rouge (défaut 6).
 * @param opts.amberPainThreshold   douleur ≥ ce seuil ⇒ ambre (défaut 4).
 * @param opts.flaggedWindowDays    fenêtre de comptage "jours hors base" (défaut 6, soit 7 j).
 *   Tous les seuils ont une valeur par défaut identique à l'ancien comportement figé, pour
 *   que genou/coude (qui ne les précisent pas) restent bit pour bit inchangés — une future
 *   zone peut les régler différemment (ex. un tendon qui tolère moins de douleur).
 */
export function zoneState(log, t0, label, opts) {
  const { unknownIsCaution, freshDays = PAIN_FRESH_DAYS, redPainThreshold = 6,
    amberPainThreshold = 4, flaggedWindowDays = 6 } = opts;
  const within = (arr, n) => arr.filter((e) => { const d = daysBetween(e.date, t0); return d >= 0 && d <= n; });
  const last = lastN(log || [], 1)[0];
  const age = last ? daysBetween(last.date, t0) : Infinity;
  const fresh = !!last && age >= 0 && age <= freshDays;
  const unknown = !fresh;
  const painLast = fresh ? last.pain : null;
  const flagged7 = within(log || [], flaggedWindowDays).filter((k) => k.baseline === false).length;
  const red = fresh && (last.baseline === false || last.pain >= redPainThreshold);
  // État inconnu ≠ feu vert (genou) : on reste prudent sans bloquer, et on le dit dans la
  // raison affichée pour inciter à noter la douleur.
  const amber = !red && ((unknownIsCaution && unknown) || painLast >= amberPainThreshold || flagged7 >= 1);
  const note = unknown && unknownIsCaution
    ? (last ? `Douleur ${label} pas notée depuis ${age} j — prudence par défaut, note-la pour un vrai conseil.` : `Douleur ${label} jamais notée — prudence par défaut.`)
    : null;
  // Motif chiffré réutilisé tel quel dans les "à éviter", pour que la raison affichée
  // porte toujours le fait qui a déclenché l'exclusion.
  const redWhy = red ? (last.baseline === false ? "pas revenu à la base sous 24 h" : `douleur ${last.pain}/10`) : null;
  return { last, age, fresh, unknown, painLast, flagged7, red, amber, note, redWhy };
}

/**
 * Regroupe N zones de douleur en une liste d'états, pour que `recommendSessions`
 * (packages/core/src/recommender.js) puisse gater/pénaliser par TAG de charge (`gateTag`)
 * plutôt que par nom de zone codé en dur.
 *
 * @param zoneDefs liste de définitions `{ key, label, gateTag, unknownIsCaution, coachClause,
 *   freshDays?, redPainThreshold?, amberPainThreshold?, flaggedWindowDays? }` — un
 *   utilisateur `apps/public` pourrait en fournir une liste arbitraire (nom libre, seuils
 *   réglables), `apps/perso` fournit toujours `DEFAULT_ZONES` (voir plus bas).
 * @param logs     map `{ [key]: journal }`, une entrée par zone de `zoneDefs`.
 * @param t0       date du jour.
 *
 * `gateTag` fait le lien avec `chargeTags` sur les types de séance
 * (packages/core/src/session/templates.js) : le genou gate/pénalise tout type taggé
 * `"genou"`, le coude tout type taggé `"tirage"`.
 *
 * `coachClause` : description courte de la contrainte de rééducation propre à la zone,
 * utilisée par `buildCoachPrompt` (packages/core/src/coach/prompt.js) pour construire la
 * phrase "Deux tendinopathies en rééduc : ..." du system prompt sans la répéter en dur.
 */
export function buildZones(zoneDefs, logs, t0) {
  return zoneDefs.map((z) => ({
    ...z,
    state: zoneState(logs[z.key], t0, z.label, {
      unknownIsCaution: z.unknownIsCaution,
      freshDays: z.freshDays,
      redPainThreshold: z.redPainThreshold,
      amberPainThreshold: z.amberPainThreshold,
      flaggedWindowDays: z.flaggedWindowDays,
    }),
  }));
}

// Config des deux zones réelles de Yoann, seule utilisée aujourd'hui (par `recommender.js`
// et `coach/prompt.js`) — aucun seuil précisé, donc les défauts de `zoneState` s'appliquent
// à l'identique de l'ancien comportement figé. Une future `apps/public` construirait sa
// propre liste (zéro zone par défaut, nom + seuils choisis par l'utilisateur) plutôt que de
// réutiliser celle-ci.
export const DEFAULT_ZONES = [
  { key: "knee", label: "genou", gateTag: "genou", unknownIsCaution: true,
    coachClause: "tendon quadricipital (HSR, tempo 6 s, règle de Silbernagel : douleur ≤ 3-5/10 tolérée si retour à la base sous 24 h)" },
  { key: "elbow", label: "coude", gateTag: "tirage", unknownIsCaution: false,
    coachClause: "distale du biceps (prises neutres/pronation privilégiées, supination limitée)" },
];
