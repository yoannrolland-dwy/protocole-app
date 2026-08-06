import { DEFAULT_TARGETS as CORE_DEFAULT_TARGETS, PHASES, targetsForDate as coreTargetsForDate } from "@rawcare/core/targets";

// Bug trouvé le 06/08/2026 (retour de Yoann : "les macros restent bloquées") :
// `DEFAULT_TARGETS` de @rawcare/core porte les cibles PERSONNELLES de Yoann, y compris sa
// fenêtre de sèche réelle en cours (`cut.enabled: true`, ses vraies dates/valeurs) — correct
// pour apps/perso (un seul utilisateur : lui), mais ça veut dire que tout nouveau compte
// apps/public héritait silencieusement de SES cibles temporaires. `targetsForDate()` bascule
// sur `cut` dès que `isCutWindow()` est vraie, ignorant les cibles de base qu'un utilisateur
// modifie dans Préférences — et apps/public n'a aucune UI pour éditer/désactiver `cut`, donc
// aucun moyen de s'en sortir. D'où l'impression que "changer les paramètres ne fait rien".
//
// **Insuffisant seul, corrigé plus loin dans ce fichier** : ce `DEFAULT_TARGETS.cut.enabled:
// false` ne joue que comme valeur de repli pour un compte qui n'a ENCORE rien en
// `data.targets`. Le compte de test de Yoann sur apps/public avait déjà fait l'onboarding
// AVANT ce correctif (avec l'ancien `DEFAULT_TARGETS` du core, `cut.enabled: true`) — sa
// fenêtre de sèche réelle est donc restée écrite en dur dans son `data.targets.cut` en base,
// et un objet stocké écrase entièrement le défaut au merge (`{...DEFAULT_TARGETS,
// ...data.targets}`, pas une fusion profonde) : le bug persistait pour lui malgré ce
// changement. `targetsForDate` ci-dessous force `cut` désactivé INCONDITIONNELLEMENT, quoi
// qu'il y ait en base (junk hérité de ce bug, ou n'importe quoi d'autre) — apps/public n'a de
// toute façon aucune UI pour éditer une fenêtre de sèche, donc ce champ ne doit jamais être
// appliqué ici, point final.
export const DEFAULT_TARGETS = {
  ...CORE_DEFAULT_TARGETS,
  cut: { ...CORE_DEFAULT_TARGETS.cut, enabled: false },
  // `PHASES.seche.target`/`PHASES.prise.target` du core sont des cibles FIXES (93/95 kg) —
  // correct pour apps/perso (poids cible de Yoann, décision explicite documentée dans
  // CLAUDE.md), mais un bêta-testeur n'a aucune raison de viser CES chiffres précis. Bug
  // remonté le 06/08/2026 : "le poids cible reste à 93kg" quoi qu'on change en Préférences —
  // parce qu'aucun champ ne permettait de le changer. `weightCutTarget`/`weightBulkTarget`
  // ci-dessous rendent CES DEUX phases éditables aussi (pas seulement Maintenance comme dans
  // le core) — voir `phaseTarget` plus bas. Valeurs de départ = celles du core, pour ne rien
  // changer tant que l'utilisateur n'a pas édité.
  weightCutTarget: PHASES.seche.target,
  weightBulkTarget: PHASES.prise.target,
};

// Point d'entrée UNIQUE pour lire `data.targets` : force `cut.enabled: false` au niveau du
// merge lui-même, pas seulement dans `targetsForDate` ci-dessous — nécessaire parce que
// `data` circule aussi tel quel vers `packages/core` (CoachIA → buildCoachPrompt → tdeeNow/
// isCutWindow, appelés SANS passer par le `targetsForDate` local d'apps/public). Un seul
// endroit qui neutralise `cut`, plutôt que de compter sur chaque appelant pour y penser.
export const mergeTargets = (stored) => ({
  ...DEFAULT_TARGETS,
  ...(stored || {}),
  cut: { ...DEFAULT_TARGETS.cut, ...(stored?.cut || {}), enabled: false },
});

// Force `cut` désactivé quel que soit ce qui est stocké (voir commentaire ci-dessus) — jamais
// une fenêtre de sèche personnelle appliquée à un compte apps/public.
export const targetsForDate = (d, base) =>
  coreTargetsForDate(d, { ...base, cut: { ...(base?.cut || {}), enabled: false } });

// Contrairement au core (seule "Maintenance" a une cible éditable, Sèche/Prise sont fixes à
// 93/95 — corrects pour l'usage personnel de Yoann), apps/public rend les TROIS phases
// éditables : chaque phase lit son propre champ dans `targets`.
export const phaseTargetField = (phase) =>
  phase === "seche" ? "weightCutTarget" : phase === "prise" ? "weightBulkTarget" : "weightMaintenance";
export const phaseTarget = (phase, targets) =>
  targets[phaseTargetField(phase)] ?? PHASES[phase].target ?? targets.weightMaintenance ?? 96;
