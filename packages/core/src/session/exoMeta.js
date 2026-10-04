// Métadonnées d'exercice lues PAR NOM (chantier T2, 04/10/2026 — extrait de recommender.js,
// où `EXO_META` servait déjà à `heavyPullDoneOn`). Le journal (`trainingLog`) n'enregistre
// que `nom`/`origine`/`mode` par exercice : `groupe`/`mouvement`/`materiel`/`tendon`/
// `famille` se retrouvent ici, dans les gabarits puis la bibliothèque (premier trouvé gagne,
// les gabarits ont priorité). Partagé par le recommandeur (tirage du coude) et le volume
// hebdomadaire par groupe musculaire.
import { TEMPLATES } from "./templates.js";
import { EXERCISE_LIBRARY } from "./exercises.js";

export const EXO_META = (() => {
  const m = new Map();
  Object.values(TEMPLATES).forEach((t) => (t.exos || []).forEach((e) => { if (!m.has(e.n)) m.set(e.n, e); }));
  EXERCISE_LIBRARY.forEach((e) => { if (!m.has(e.n)) m.set(e.n, e); });
  return m;
})();

/** Définition (gabarit ou bibliothèque) d'un exercice par son nom, ou `undefined`. */
export const metaFor = (nom) => (nom ? EXO_META.get(nom) : undefined);
