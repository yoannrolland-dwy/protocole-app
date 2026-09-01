// Bibliothèque d'exercices — chantier "bibliothèque" du 01/09/2026, premier lot.
//
// SÉPARÉE de `TEMPLATES` (Upper A/B, Lower A/B/C, gabarits prescrits inchangés) et de
// `catalog.js` (types de séance étendus pour apps/public) : celle-ci est une liste PLATE
// d'exercices individuels, pensée pour la substitution ("cette machine est prise, ou j'ai
// envie de varier") — pas encore branchée à aucune UI. Décision actée avec Yoann : ne jamais
// renommer un exercice déjà dans un gabarit actif (le nom est sa clé d'historique dans
// trainingLog — renommer casserait lastPerf/records sans migration), donc chaque entrée ici
// a son propre nom et sa propre histoire, jamais un alias d'un exercice existant.
//
// Premier lot : les mouvements où la salle de Yoann a réellement les deux types
// d'équipement (confirmé par lui, pas supposé) — poulie (câble, pile de poids intégrée) et
// disque (bras de levier chargé à la main avec des disques de fonte). Chaque paire partage
// le même `groupe`/`mouvement`/`tendon` que l'exercice équivalent dans TEMPLATES quand il
// existe, pour que le futur matching par tag (substitution) les traite comme interchangeables.
//
// Volontairement PAS de version haltères pour les développés (couché/incliné/militaire) :
// ces trois existent déjà comme exercices prescrits d'Upper A/B — un doublon ici fragmenterait
// l'historique pour rien, la version haltères déjà loguée sert déjà d'alternative.
//
// Volontairement PAS de version disque pour "Tirage vertical" : un tirage vertical est
// mécaniquement toujours un câble (on tire vers le bas), il n'existe pas de version à disques
// dans une salle de sport standard — pas de faux doublon inventé.

export const EXERCISE_LIBRARY = [
  // ---- Presse à cuisses ----
  { n: "Presse à cuisses (poulie)", s: 4, r: "8-10", rest: 180, mode: "reps", c: "contrôlé, reps + hautes",
    groupe: "quadriceps", mouvement: "genou", materiel: "poulie", tendon: "genou" },
  { n: "Presse à cuisses (disque)", s: 4, r: "8-10", rest: 180, mode: "reps", c: "contrôlé, reps + hautes",
    groupe: "quadriceps", mouvement: "genou", materiel: "disque", tendon: "genou" },

  // ---- Iso leg extension @60° (primer antalgique, genou raide) ----
  { n: "Iso leg extension @60° (poulie)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %",
    groupe: "quadriceps", mouvement: "genou", materiel: "poulie", tendon: "genou" },
  { n: "Iso leg extension @60° (disque)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %",
    groupe: "quadriceps", mouvement: "genou", materiel: "disque", tendon: "genou" },

  // ---- Leg extension unilatérale ----
  { n: "Leg extension unilatérale (poulie)", s: 3, r: "8-10", rest: 120, mode: "reps", c: "tempo 6 s",
    groupe: "quadriceps", mouvement: "genou", materiel: "poulie", tendon: "genou" },
  { n: "Leg extension unilatérale (disque)", s: 3, r: "8-10", rest: 120, mode: "reps", c: "tempo 6 s",
    groupe: "quadriceps", mouvement: "genou", materiel: "disque", tendon: "genou" },

  // ---- Leg curl unilatéral ----
  { n: "Leg curl unilatéral (poulie)", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
    groupe: "ischios", mouvement: "isolation", materiel: "poulie", tendon: null },
  { n: "Leg curl unilatéral (disque)", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
    groupe: "ischios", mouvement: "isolation", materiel: "disque", tendon: null },

  // ---- Mollets à la presse (dépend de la presse à cuisses utilisée ce jour-là) ----
  { n: "Mollets à la presse (poulie)", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné",
    groupe: "mollets", mouvement: "isolation", materiel: "poulie", tendon: null },
  { n: "Mollets à la presse (disque)", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné",
    groupe: "mollets", mouvement: "isolation", materiel: "disque", tendon: null },

  // ---- Rowing (dos, tirage horizontal) ----
  { n: "Rowing poulie basse", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise pronation/neutre (coude)",
    groupe: "dos", mouvement: "tirage", materiel: "poulie", tendon: "coude" },
  { n: "Rowing machine à disques", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise pronation/neutre (coude)",
    groupe: "dos", mouvement: "tirage", materiel: "disque", tendon: "coude" },

  // ---- Tirage vertical (dos, tirage — mécaniquement toujours à la poulie) ----
  { n: "Tirage vertical prise neutre (poulie)", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude)",
    groupe: "dos", mouvement: "tirage", materiel: "poulie", tendon: "coude" },

  // ---- Développé couché ----
  { n: "Développé couché (poulie)", s: 4, r: "8-10", rest: 150, mode: "reps", c: "",
    groupe: "pecs", mouvement: "poussee", materiel: "poulie", tendon: null },
  { n: "Développé couché (disque)", s: 4, r: "8-10", rest: 150, mode: "reps", c: "",
    groupe: "pecs", mouvement: "poussee", materiel: "disque", tendon: null },

  // ---- Développé incliné ----
  { n: "Développé incliné (poulie)", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs",
    groupe: "pecs", mouvement: "poussee", materiel: "poulie", tendon: null },
  { n: "Développé incliné (disque)", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs",
    groupe: "pecs", mouvement: "poussee", materiel: "disque", tendon: null },

  // ---- Développé militaire (épaules) ----
  { n: "Développé militaire (poulie)", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
    groupe: "epaules", mouvement: "poussee", materiel: "poulie", tendon: null },
  { n: "Développé militaire (disque)", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
    groupe: "epaules", mouvement: "poussee", materiel: "disque", tendon: null },
];
