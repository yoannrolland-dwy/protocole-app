// Catalogue étendu — sports et types de séance au-delà des 6 actifs dans apps/perso.
// RawCare Phase 1, 06/08/2026.
//
// `apps/perso` N'IMPORTE PAS CE FICHIER : Yoann pratique musculation/basket/escalade et suit
// un split Upper/Lower, pas les entrées ci-dessous. Les ajouter à son picker serait du bruit
// dans SON app pour des options qu'il n'utilisera jamais — contraire à la règle transversale
// de la feuille de route ("chaque brique testée d'abord SUR ton app perso comme config par
// défaut : ton usage quotidien ne change pas"). Ce catalogue existe pour prouver que le
// modèle de données (mêmes champs que `./templates.js` : `kind`/`chargeTags`/`exos` taggés)
// scale au-delà des 6 types actuels — une future `apps/public` pourra le lire pour laisser
// un utilisateur choisir/activer ses propres sports et son propre split.
//
// `recommendSessions` (packages/core/src/recommender.js) ne lit PAS ce fichier : son moteur
// de score reste, pour l'instant, écrit sur mesure pour les 6 types actuels (voir le
// commentaire en tête de ce fichier dans CLAUDE.md — généraliser le moteur de score
// lui-même est repoussé à une session dédiée, trop risqué à faire vite sur du code qui
// protège des tendons en rééducation).
//
// Charge genou des 3 sports supplémentaires, tranchée avec Yoann le 06/08/2026 : Foot et
// Course à pied traités comme le Basket (impact, gate dur si genou hors base) ; Vélo sans
// tag `genou` (pas d'impact, mouvement contrôlé — genou-friendly en rééduc).

export const SPORTS_CATALOG = {
  "Course à pied": { kind: "sport", chargeTags: ["genou"], exos: [] },
  "Vélo":          { kind: "sport", chargeTags: [], exos: [] },
  "Foot":          { kind: "sport", chargeTags: ["genou"], exos: [] },
};

// "Full body" : une seule séance qui sollicite tout le corps (typiquement 2-3×/semaine),
// à l'opposé du split Upper/Lower de Yoann qui répartit le volume sur deux jours distincts.
export const SESSION_TYPES_CATALOG = {
  "Full body": { kind: "muscu", chargeTags: ["genou", "tirage"], exos: [
    { n: "Squat gobelet", s: 3, r: "10-12", rest: 120, mode: "reps", c: "charge modérée, amplitude complète",
      groupe: "quadriceps", mouvement: "genou", materiel: "halteres", tendon: "genou" },
    { n: "Développé couché haltères", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Rowing haltère un bras", s: 3, r: "10-12", rest: 90, mode: "reps", c: "prise neutre",
      groupe: "dos", mouvement: "tirage", materiel: "halteres", tendon: "coude" },
    { n: "Développé épaules haltères", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "epaules", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou peu sollicité",
      groupe: "ischios-fessiers", mouvement: "hanche", materiel: "barre", tendon: null },
    { n: "Core — Planche", s: 3, r: "30-45 s", rest: 60, mode: "temps", c: "finisher",
      groupe: "core", mouvement: "gainage", materiel: "aucun", tendon: null },
  ]},

  // "Bro split" : un groupe musculaire par jour, 4 jours (variante courante — pas de
  // configurateur libre, cf. décision de la feuille de route). Chaque jour est son propre
  // type de séance, comme "Upper A"/"Upper B" le sont déjà pour Yoann.
  "Bro split — Pecs/Triceps": { kind: "muscu", chargeTags: [], exos: [
    { n: "Développé couché barre", s: 4, r: "6-10", rest: 150, mode: "reps", c: "",
      groupe: "pecs", mouvement: "poussee", materiel: "barre", tendon: null },
    { n: "Développé incliné haltères", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Écarté poulie", s: 3, r: "12-15", rest: 90, mode: "reps", c: "",
      groupe: "pecs", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Extension triceps poulie haute", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "triceps", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Dips (assistés si besoin)", s: 3, r: "8-12", rest: 90, mode: "reps", c: "",
      groupe: "triceps", mouvement: "poussee", materiel: "aucun", tendon: null },
  ]},
  "Bro split — Dos/Biceps": { kind: "muscu", chargeTags: ["tirage"], exos: [
    { n: "Tractions ou tirage vertical", s: 4, r: "6-10", rest: 150, mode: "reps", c: "prise neutre si coude sensible",
      groupe: "dos", mouvement: "tirage", materiel: "machine", tendon: "coude" },
    { n: "Rowing barre", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
      groupe: "dos", mouvement: "tirage", materiel: "barre", tendon: "coude" },
    { n: "Tirage horizontal poulie", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "dos", mouvement: "tirage", materiel: "poulie", tendon: null },
    { n: "Curl barre EZ", s: 3, r: "8-10", rest: 75, mode: "reps", c: "",
      groupe: "biceps", mouvement: "isolation", materiel: "barre", tendon: null },
    { n: "Curl marteau (prise neutre)", s: 3, r: "10-12", rest: 75, mode: "reps", c: "prise neutre (coude)",
      groupe: "biceps", mouvement: "isolation", materiel: "halteres", tendon: "coude" },
  ]},
  "Bro split — Épaules": { kind: "muscu", chargeTags: [], exos: [
    { n: "Développé militaire barre", s: 4, r: "6-10", rest: 120, mode: "reps", c: "",
      groupe: "epaules", mouvement: "poussee", materiel: "barre", tendon: null },
    { n: "Élévations latérales haltères", s: 4, r: "12-15", rest: 75, mode: "reps", c: "",
      groupe: "epaules", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Face pull", s: 3, r: "15", rest: 60, mode: "reps", c: "arrière d'épaule",
      groupe: "epaules", mouvement: "tirage", materiel: "poulie", tendon: null },
    { n: "Élévations frontales poulie", s: 3, r: "12-15", rest: 60, mode: "reps", c: "",
      groupe: "epaules", mouvement: "isolation", materiel: "poulie", tendon: null },
  ]},
  "Bro split — Jambes": { kind: "muscu", chargeTags: ["genou"], exos: [
    { n: "Squat barre ou presse à cuisses", s: 4, r: "6-10", rest: 180, mode: "reps", c: "amplitude selon confort genou",
      groupe: "quadriceps", mouvement: "genou", materiel: "barre", tendon: "genou" },
    { n: "Leg extension", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Leg curl bilatéral", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "ischios", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou-safe",
      groupe: "fessiers", mouvement: "hanche", materiel: "machine", tendon: null },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null },
  ]},
};
