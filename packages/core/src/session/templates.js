// Moteur de séances — gabarits, poids par défaut, table HSR, routines guidées, fiches
// péri-training. Extrait de src/App.jsx (apps/perso) le 05/08/2026, chantier RawCare
// Phase 0. Pur (aucune dépendance React/DOM).
//
// RawCare Phase 1, 06/08/2026 : chaque exercice gagne des métadonnées de bibliothèque
// (`groupe`/`mouvement`/`materiel`/`tendon`) et chaque type de séance un `chargeTags` —
// PUREMENT ADDITIF, aucun champ existant ni valeur ne change. `n`/`nom` reste l'identité
// de l'exercice (clé dans DEFAULT_WEIGHTS/lastPerf/perfHistory et dans tout l'historique
// trainingLog) : les nouveaux champs ne sont lus par aucun code existant, seulement prêts
// pour une future bibliothèque d'exercices. Voir aussi `./catalog.js` (sports et types de
// séance supplémentaires, non actifs dans apps/perso).

const TEMPLATES = {
  "Upper A": { kind: "muscu", chargeTags: ["tirage"], exos: [
    { n: "Développé incliné haltères", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs, priorité · 1-2 reps en réserve",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null, famille: "developpe-incline" },
    // Spécialisation épaules / largeur du dos / haut des pecs (05/10/2026, analyse physique de
    // Yoann — voir CLAUDE.md) : tirage vertical ajouté (largeur des dorsaux), rowing 4 → 3 et face
    // pull 3 → 2 (haut du dos = point fort, on y retire du volume), élévations latérales 3 → 5
    // (deltoïde LATÉRAL, levier n°1 de la carrure), planche 3 → 2 pour tenir ~1 h. Fourchettes
    // ≤ 12 reps conservées (décision du 04/10). Mêmes noms d'exercices : historique intact.
    { n: "Tirage vertical prise neutre", s: 3, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude) · largeur des dorsaux",
      groupe: "dos", mouvement: "tirage", materiel: "machine", tendon: "coude", famille: "tirage-vertical" },
    { n: "Rowing barre ou machine", s: 3, r: "8-10", rest: 120, mode: "reps", c: "prise pronation/neutre (coude)",
      groupe: "dos", mouvement: "tirage", materiel: "barre", tendon: "coude", famille: "rowing" },
    // Reps plafonnées à 12 (04/10/2026, demande de Yoann) : l'hypertrophie est très proche entre
    // ~6 et ~30 reps tant que la série finit près de l'échec (Schoenfeld 2017/2021) — ce qui
    // compte est le volume hebdo et la proximité de l'échec, pas le nombre de reps. Exercices
    // et nombre de séries volontairement INCHANGÉS (choix explicite de Yoann).
    { n: "Écarté poulie basse", s: 3, r: "10-12", rest: 90, mode: "reps", c: "ligne ascendante (haut des pecs) · bon étirement en bas",
      groupe: "pecs", mouvement: "isolation", materiel: "poulie", tendon: null },
    // 08/10/2026 : 5 séries d'un même mouvement → 3 + 2 sur deux profils de résistance
    // (haltères = tension en haut, poulie = tension bras le long du corps, position étirée).
    // Même volume hebdo (10 séries), moins de dégradation sur les dernières séries. Upper B
    // fait l'inverse (3 poulie + 2 haltères). Mêmes noms des deux côtés → historique continu.
    { n: "Élévations latérales haltères", s: 3, r: "10-12", rest: 60, mode: "reps", c: "priorité carrure · sans élan",
      groupe: "epaules", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Élévations latérales poulie", s: 2, r: "10-12", rest: 60, mode: "reps", c: "poulie à hauteur de main, câble derrière le corps",
      groupe: "epaules", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Extension triceps poulie haute", s: 3, r: "10-12", rest: 75, mode: "reps", c: "",
      groupe: "triceps", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Face pull", s: 2, r: "10-12", rest: 60, mode: "reps", c: "arrière d'épaule",
      groupe: "epaules", mouvement: "tirage", materiel: "poulie", tendon: null },
    // Curls poignets RÉDUITS 3×15-20 → 2×10-12 (04/10/2026) : douleur au poignet gauche sur ce
    // seul mouvement. Choix de Yoann de les garder réduits plutôt que de les remplacer par du
    // grip isométrique (dead hang / farmer walk, proposés) — à revoir si la douleur revient.
    { n: "Curl poignets pronation", s: 2, r: "10-12", rest: 60, mode: "reps", c: "léger, avant-bras · stop si douleur poignet",
      groupe: "avant-bras", mouvement: "isolation", materiel: "halteres", tendon: null },
  ]},
  "Upper B": { kind: "muscu", chargeTags: ["tirage"], exos: [
    { n: "Développé couché haltères", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs, priorité",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null, famille: "developpe-couche" },
    { n: "Tirage vertical prise neutre", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude)",
      groupe: "dos", mouvement: "tirage", materiel: "machine", tendon: "coude", famille: "tirage-vertical" },
    // Spécialisation (05/10/2026, voir Upper A) : militaire 3 → 2 (l'avant d'épaule est déjà très
    // sollicité par tous les développés), écarté poulie basse ajouté (haut des pecs), élévations
    // latérales 5 séries, rear delt 3 → 2, crunch 3 → 2. Rééduc du coude (curl marteau) et curls
    // poignets (2×10-12, poignet) inchangés.
    { n: "Développé militaire haltères", s: 2, r: "8-10", rest: 120, mode: "reps", c: "",
      groupe: "epaules", mouvement: "poussee", materiel: "halteres", tendon: null, famille: "developpe-militaire" },
    { n: "Écarté poulie basse", s: 2, r: "10-12", rest: 90, mode: "reps", c: "ligne ascendante (haut des pecs) · bon étirement en bas",
      groupe: "pecs", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Élévations latérales poulie", s: 3, r: "10-12", rest: 60, mode: "reps", c: "priorité carrure · poulie à hauteur de main, câble derrière le corps",
      groupe: "epaules", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Élévations latérales haltères", s: 2, r: "10-12", rest: 60, mode: "reps", c: "sans élan",
      groupe: "epaules", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Rear delt machine (reverse pec deck)", s: 2, r: "10-12", rest: 60, mode: "reps", c: "arrière d'épaule",
      groupe: "epaules", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Curl marteau (prise neutre)", s: 3, r: "10-12", rest: 75, mode: "reps", c: "prise neutre (coude)",
      groupe: "biceps", mouvement: "isolation", materiel: "halteres", tendon: "coude" },
    { n: "Curl poignets supination", s: 2, r: "10-12", rest: 60, mode: "reps", c: "léger, avant-bras · stop si douleur poignet",
      groupe: "avant-bras", mouvement: "isolation", materiel: "halteres", tendon: null },
  ]},
  "Lower A": { kind: "muscu", knee: true, hsr: true, chargeTags: ["genou"], exos: [
    { n: "Iso leg extension @60° (si genou raide)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "iso-leg-extension" },
    { n: "Presse à cuisses (HSR)", s: 3, r: "table HSR", rest: 180, mode: "reps", hsr: true, c: "tempo 6 s · amplitude 10-60°",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "presse-cuisses" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "en superset avec la presse", supersetAvec: "Presse à cuisses (HSR)",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null, famille: "mollets-presse" },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 150, mode: "reps", c: "genou peu sollicité",
      groupe: "ischios-fessiers", mouvement: "hanche", materiel: "barre", tendon: null },
    { n: "Leg extension unilatérale", s: 3, r: "table HSR", rest: 120, mode: "reps", hsr: true, c: "tempo 6 s",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "leg-extension-unilaterale" },
  ]},
  "Lower B": { kind: "muscu", knee: true, chargeTags: ["genou"], exos: [
    { n: "Presse à cuisses", s: 4, r: "8-10", rest: 180, mode: "reps", c: "contrôlé, reps + hautes",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "presse-cuisses" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "en superset avec la presse", supersetAvec: "Presse à cuisses",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null, famille: "mollets-presse" },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou-safe",
      groupe: "fessiers", mouvement: "hanche", materiel: "machine", tendon: null },
    { n: "Leg extension unilatérale", s: 3, r: "8-10", rest: 120, mode: "reps", c: "tempo 6 s",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "leg-extension-unilaterale" },
    { n: "Leg curl unilatéral", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "ischios", mouvement: "isolation", materiel: "machine", tendon: null, famille: "leg-curl-unilateral" },
  ]},
  // Semaine avec match (01/09/2026) : Lower unique de la semaine, HSR lourd mais volume total
  // réduit par rapport à Lower A (mollets 3 séries au lieu de 4, planche 2 au lieu de 3) —
  // compense l'ajout du Hip thrust et du RDL dans la même séance. "Leg extension unilatérale"
  // réutilise le même exercice (même nom, même historique) que Lower A/B, saisie simplifiée.
  "Lower C": { kind: "muscu", knee: true, hsr: true, chargeTags: ["genou"], exos: [
    { n: "Iso leg extension @60° (si genou raide)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "iso-leg-extension" },
    { n: "Presse à cuisses (HSR)", s: 3, r: "table HSR", rest: 180, mode: "reps", hsr: true, c: "tempo 6 s · amplitude 10-60°",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "presse-cuisses" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "en superset avec la presse", supersetAvec: "Presse à cuisses (HSR)",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null, famille: "mollets-presse" },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 150, mode: "reps", c: "genou peu sollicité",
      groupe: "ischios-fessiers", mouvement: "hanche", materiel: "barre", tendon: null },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou-safe",
      groupe: "fessiers", mouvement: "hanche", materiel: "machine", tendon: null },
    { n: "Leg extension unilatérale", s: 3, r: "table HSR", rest: 120, mode: "reps", hsr: true, c: "tempo 6 s",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "leg-extension-unilaterale" },
  ]},
  // Full Body (04/10/2026, demande de Yoann) : UNIQUEMENT le lundi qui suit un dimanche de
  // match (détection côté app, `isPostMatchDay` → recommandeur `postMatch`). Base Lower C
  // (choix de Yoann) + 1 pec + 1 dos + 1 épaule, ce qui ajoute une 3e exposition pecs/épaules
  // ces semaines-là. Le bloc HSR genou (presse + leg extension, table HSR) est GARDÉ intact et
  // en tête : si ce lundi remplace un Lower C (deux matchs consécutifs), c'est la seule séance
  // lourde genou de la semaine. Mollets en superset avec la presse (habitude de Yoann, aucun
  // temps perdu). RDL/hip thrust : chaîne postérieure déjà chargée par le match → 2-3 reps en
  // réserve, jamais à l'échec. Mêmes noms d'exercices qu'Upper/Lower : historique, records et
  // progression partagés. Pas de planche (séance déjà longue, ~65 min).
  "Full Body": { kind: "muscu", knee: true, hsr: true, chargeTags: ["genou", "tirage"], exos: [
    { n: "Presse à cuisses (HSR)", s: 3, r: "table HSR", rest: 180, mode: "reps", hsr: true, c: "tempo 6 s · amplitude 10-60° · superset mollets",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "presse-cuisses" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "en superset avec la presse", supersetAvec: "Presse à cuisses (HSR)",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null, famille: "mollets-presse" },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 150, mode: "reps", c: "lendemain de match : 2-3 reps en réserve, jamais à l'échec",
      groupe: "ischios-fessiers", mouvement: "hanche", materiel: "barre", tendon: null },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "lendemain de match : 2-3 reps en réserve",
      groupe: "fessiers", mouvement: "hanche", materiel: "machine", tendon: null },
    { n: "Développé incliné haltères", s: 3, r: "8-10", rest: 150, mode: "reps", c: "pecs, priorité · 1-2 reps en réserve",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null, famille: "developpe-incline" },
    // Spécialisation (05/10/2026) : tirage vertical à la place du rowing (largeur des dorsaux),
    // élévations latérales 3 → 4. Bas du corps et HSR intacts. Pas de rééduc coude ici (reste en
    // Upper A/B) pour tenir ~1 h — choix de Yoann.
    { n: "Tirage vertical prise neutre", s: 3, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude) · largeur des dorsaux",
      groupe: "dos", mouvement: "tirage", materiel: "machine", tendon: "coude", famille: "tirage-vertical" },
    { n: "Leg extension unilatérale", s: 3, r: "table HSR", rest: 120, mode: "reps", hsr: true, c: "tempo 6 s",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou", famille: "leg-extension-unilaterale" },
    { n: "Élévations latérales haltères", s: 4, r: "10-12", rest: 60, mode: "reps", c: "priorité carrure · sans élan",
      groupe: "epaules", mouvement: "isolation", materiel: "halteres", tendon: null },
  ]},
  // Échauffement (04/09/2026) : déménagé depuis ROUTINES.basket (routine "jouée" hors
  // trainingLog, onglet Douleurs) — devient un vrai carnet d'exercices, suivi pas à pas comme
  // Upper/Lower, et loggé (recommandeur/Coach IA le voient). `withMeta: true` ajoute les
  // champs durée + RPE de la vraie séance (perdus sinon : `kind: "muscu"` seul ne capture ni
  // l'un ni l'autre) — sans ça, passer Basket en carnet d'exercices aurait fait perdre un
  // signal déjà utilisé par le Coach IA et "Dernières séances". Montée en régime progressive
  // (7 étapes, intensité croissante) au lieu des 5 blocs d'origine — contenu réétalé, pas
  // juste renommé, pour une vraie progressivité (cardio → mobilité → primer genou → charge
  // légère → charge élevée → spécifique modéré → spécifique intense).
  "Basket": { kind: "muscu", knee: true, withMeta: true, chargeTags: ["genou"], exos: [
    { n: "Cardio léger (vélo ou trot)", s: 1, r: "5 min", rest: 0, mode: "temps", c: "élever la température, allure tranquille",
      groupe: "cardio", mouvement: "cardio", materiel: "aucun", tendon: null },
    { n: "Mobilité dynamique", s: 1, r: "5 min", rest: 0, mode: "temps", c: "fentes marchées, balancements hanche/cheville",
      groupe: "mobilite", mouvement: "mobilite", materiel: "aucun", tendon: null },
    { n: "Primer iso genou (wall-sit @60°)", s: 4, r: "40 s", rest: 20, mode: "temps", c: "sous le seuil de douleur — antalgie + activation",
      groupe: "quadriceps", mouvement: "genou", materiel: "aucun", tendon: "genou" },
    { n: "Montée en charge : squats", s: 2, r: "45 s", rest: 30, mode: "temps", c: "poids du corps, amplitude progressive · ~60-70 %",
      groupe: "quadriceps", mouvement: "genou", materiel: "aucun", tendon: "genou" },
    { n: "Montée en charge : sauts", s: 2, r: "30 s", rest: 30, mode: "temps", c: "hauteur ↑ seulement si indolore · ~80 %",
      groupe: "quadriceps", mouvement: "genou", materiel: "aucun", tendon: "genou" },
    { n: "Spécifique basket : accél/décél", s: 1, r: "90 s", rest: 20, mode: "temps", c: "changements de direction ~70-80 %",
      groupe: "cardio", mouvement: "specifique", materiel: "aucun", tendon: null },
    { n: "Spécifique basket : tirs en mouvement", s: 1, r: "60 s", rest: 0, mode: "temps", c: "intensité proche du match",
      groupe: "cardio", mouvement: "specifique", materiel: "aucun", tendon: null },
  ]},
  "Escalade": { kind: "sport", climb: true, chargeTags: ["tirage"], exos: [] },

  // "Mobilité" (04/09/2026) : déménagée depuis ROUTINES.reeduc (onglet Douleurs), ÉLARGIE à
  // plusieurs exercices AU CHOIX (`opt: true` partout — même mécanisme que "Iso leg extension
  // (si genou raide)" en Lower A, qui documente déjà que valider sans rien cocher ne persiste
  // rien) plutôt que les 2 seuls blocs genou/coude d'origine, comme demandé. `chargeTags: []`
  // et AUCUN flag knee/climb DÉLIBÉRÉMENT : de la récup/mobilité ne doit jamais compter comme
  // une exposition genou/coude (gate, pénalité ambre) ni comme une charge d'entraînement —
  // voir aussi l'exclusion de "Mobilité" dans load3/streak (recommender.js).
  // Mobilité (refonte 07/10/2026, décisions de Yoann) : séance du matin mardi/mercredi/vendredi à
  // la SALLE, ~20 min avant 30 min de marche. Exercices nommés précisément, chacun justifié par
  // sa synergie basket / escalade / muscu (les anciens libellés vagues « Mobilité hanche »,
  // « chevilles », « étirement chaîne postérieure », « gainage doux » ne lui parlaient pas).
  // TOUT LE CORE a déménagé ici (planche et crunch machine retirés des 5 gabarits de muscu qui
  // en avaient — gain de 4-6 min par séance, abdos 3×/semaine, mêmes noms → historique continu).
  // Le recommandeur propose « Mobilité » comme type de récupération (ex-« Récupération
  // active ») : chargeTags vide, jamais une charge, jamais gaté.
  "Mobilité": { kind: "muscu", chargeTags: [], exos: [
    { n: "Iso leg extension unilatérale @60° (genou)", s: 3, r: "45 s", rest: 60, mode: "temps",
      c: "rééduc tendon quadricipital · effort ~70 %, sous le seuil de douleur · antalgie avant le basket du soir",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Hanche 90/90 avec transitions", s: 2, r: "45 s", rest: 20, mode: "temps", opt: true,
      c: "par côté · rotation interne/externe de hanche : défense basse et changements de direction (basket), talon-fesse et haut de pied (escalade)",
      groupe: "mobilite", mouvement: "mobilite", materiel: "aucun", tendon: null },
    { n: "Cheville : genou au mur", s: 2, r: "10", rest: 20, mode: "reps", opt: true,
      c: "par côté · talon au sol, genou vers le mur, lent, sans rebond · mesure : distance orteils-mur (viser > 10 cm) · amorti des réceptions (basket), adhérence talon bas (escalade)",
      groupe: "mobilite", mouvement: "mobilite", materiel: "aucun", tendon: null },
    { n: "Rotation externe épaule poulie basse", s: 2, r: "12", rest: 45, mode: "reps", opt: true,
      c: "par côté, léger · coiffe des rotateurs : contrepoids aux 10 séries d'élévations hebdo et aux tirages bras en l'air (escalade)",
      groupe: "coiffe", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Core — Planche", s: 2, r: "45-60 s", rest: 60, mode: "temps", c: "anti-extension · progresser par difficulté, pas par durée",
      groupe: "core", mouvement: "gainage", materiel: "aucun", tendon: null },
    { n: "Core — Crunch machine", s: 2, r: "10-12", rest: 60, mode: "reps", c: "contrôlé, 1-2 reps en réserve",
      groupe: "core", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Iso flexion coude prise marteau + supination", s: 2, r: "30 s", rest: 45, mode: "temps", opt: true,
      c: "prévention coude (sans douleur depuis septembre) · à cocher selon l'escalade de la semaine",
      groupe: "biceps", mouvement: "isolation", materiel: "aucun", tendon: "coude" },
  ]},
};
export { TEMPLATES };
export const TYPES = Object.keys(TEMPLATES);

// Poids par défaut (kg) — haltères = par haltère, machines = valeur de la pile.
export const DEFAULT_WEIGHTS = {
  "Développé incliné haltères": 32,
  "Développé couché haltères": 34,
  "Développé militaire haltères": 28,
  "Écarté poulie basse": 10,
  "Extension triceps poulie haute": 30,
  "Élévations latérales haltères": 16,
  "Élévations latérales poulie": 5,
  "Face pull": 30,
  "Rear delt machine (reverse pec deck)": 76,
  "Curl marteau (prise neutre)": 18,
  "Curl poignets pronation": 6,
  "Curl poignets supination": 14,
  "Rowing barre ou machine": 55,
  "Tirage vertical prise neutre": 85,
  "Presse à cuisses (HSR)": 200,
  "Presse à cuisses": 200,
  "Leg extension unilatérale": 25,
  "Iso leg extension @60° (si genou raide)": 25,
  "Mollets à la presse": 200,
  "Soulevé de terre roumain": 120,
  "Hip thrust": 200,
  "Leg curl unilatéral": 35,
  "Core — Crunch machine": 40,
};

export const HSR_TABLE = [
  { wk: "1", from: 1, to: 1, scheme: "3 × 15RM" },
  { wk: "2-3", from: 2, to: 3, scheme: "3 × 12RM" },
  { wk: "4-5", from: 4, to: 5, scheme: "4 × 10RM" },
  { wk: "6-8", from: 6, to: 8, scheme: "4 × 8RM" },
  { wk: "9-12", from: 9, to: 12, scheme: "4 × 6RM" },
];
export const hsrForWeek = (w) => HSR_TABLE.find((r) => w >= r.from && w <= r.to) || HSR_TABLE[0];
/**
 * Nombre de séries d'un exercice d'un gabarit pour une semaine HSR donnée (09/10/2026). Un
 * exercice HSR suit la table ; un exercice `supersetAvec` (mollets) fait **autant de séries que
 * son partenaire de superset** — ta règle : en superset chaque série de presse est suivie d'une
 * série de mollets. Repli sur `ex.s` si le partenaire est introuvable.
 */
export const exoSeriesCount = (template, ex, hsrWeek) => {
  const hsrSeries = hsrParse(hsrForWeek(hsrWeek).scheme).series;
  if (ex.hsr) return hsrSeries;
  if (ex.supersetAvec) {
    const partner = (template?.exos || []).find((e) => e.n === ex.supersetAvec);
    if (partner) return partner.hsr ? hsrSeries : partner.s;
  }
  return ex.s;
};
export const hsrParse = (scheme) => {
  const m = scheme.match(/(\d+)\s*×\s*(\d+)/);
  return m ? { series: +m[1], reps: +m[2] } : { series: 3, reps: 10 };
};
// Gère "min" (04/09/2026, échauffement basket : "5 min" plutôt que "300 s" pour rester
// lisible côté carnet) en plus des "45 s"/"30-45 s" d'origine — sans "min" dans la chaîne,
// comportement strictement inchangé (dernier nombre = secondes).
export const parseSecs = (str) => {
  const s = String(str);
  const nums = s.match(/\d+/g);
  if (!nums) return 30;
  const last = +nums[nums.length - 1];
  return /min/i.test(s) ? last * 60 : last;
};

export const ROUTINES = {
  reeduc: {
    title: "Rééduc autonome",
    sub: "hors Lower A/B · 3ᵉ exposition genou · antalgique",
    blocks: [
      { label: "Iso leg extension unilatérale @60°", work: 45, rest: 120, rounds: 5, note: "effort ~70 %, douleur ≤ 3/10, doser par genou" },
      { label: "Iso flexion coude (prise marteau) + supination", work: 45, rest: 60, rounds: 4, note: "prise neutre, supination résistée en fin de tenue" },
    ],
  },
  basket: {
    title: "Échauffement basket",
    sub: "~15-20 min · douleur > 3/10 → réduire, ne pas forcer",
    blocks: [
      { label: "Cardio léger (vélo ou trot)", work: 300, rest: 0, rounds: 1, note: "élever la température" },
      { label: "Mobilité dynamique", work: 300, rest: 0, rounds: 1, note: "fentes marchées, balancements, hanche, chevilles" },
      { label: "Primer iso genou (wall-sit @60°)", work: 40, rest: 20, rounds: 4, note: "sous le seuil de douleur — antalgie + activation" },
      { label: "Montée en charge (squats PDC → sauts)", work: 60, rest: 30, rounds: 2, note: "amplitude/hauteur ↑ seulement si indolore" },
      { label: "Spécifique basket (accél/décél, shoots)", work: 120, rest: 0, rounds: 1, note: "changements de direction 70-80 %" },
    ],
  },
};

export const PERI = [
  { t: "Avant muscu seule (séance ≤ 1h)", d: "Whey 30 g étalée du réveil jusqu'au début de la séance. Pas de glucides rapides nécessaires : les réserves de glycogène du repas de la veille suffisent pour une séance ≤ 1h. Caféine 200 mg si utile." },
  { t: "Muscu + escalade enchaînées", d: "Pas de glucides avant la muscu (whey seule, comme ci-dessus). 25-30 g de glucides rapides entre les deux séances, avant l'escalade." },
  { t: "Avant basket (1h-1h15)", d: "30-40 g glucides selon l'intensité prévue." },
  { t: "Pendant basket", d: "800 ml-1 L d'eau. +20 g glucides à la mi-temps si coup de mou." },
  { t: "Après basket", d: "Repos le lendemain → whey + 35-40 g glucides. Entraînement le lendemain → 40-50 g glucides. Post tardif : ratio glucides/protéines ~1,4:1." },
  { t: "Après muscu", d: "Intégrer au total protéique du jour — le timing exact n'est pas critique (c'est le total journalier qui compte)." },
];

// Protocoles détaillés basket — timing macro avant/pendant/après selon l'heure de la séance
export const BASKET_PROTOCOLS = {
  soir21h: {
    title: "Entraînement 21h",
    sub: "session soirée · attention au sommeil qui suit",
    blocks: [
      { h: "Avant", items: [
        "Repas normal 18h-18h30 si possible (protéines + glucides + légumes), 2h30-3h avant — macros suivies normalement dans l'onglet Macro, pas de cible dédiée ici.",
        "Sinon collation 20h-20h15 (45-60 min avant), cible 35 g G. Ex. 65 g de pain (≈2 tranches) → 6 g P / 36 g G / 1 g L / ~175 kcal, ou 175 g de banane (≈1,5 fruit) → 2 g P / 35 g G / 0 g L / ~155 kcal.",
        "+ whey 30 g si peu de protéines depuis le repas de midi → 25 g P / 2 g G / 1 g L / ~120 kcal.",
        "Hydratation : 500 ml dans les 2h précédentes.",
        "Caféine : à éviter après 18h-19h — la séance finit tard (~22h30), risque de perturber l'endormissement.",
      ]},
      { h: "Pendant", items: [
        "21h-22h30 : eau 500-750 ml par petites gorgées aux pauses.",
        "Si séance intense >1h avec sprints/sauts répétés : 20 g de bonbons à la pause si sensation de fatigue → 16 g G / ~72 kcal.",
      ]},
      { h: "Après", items: [
        "22h30+ : whey 30 g dans les 30 min → 25 g P / 2 g G / 1 g L / ~120 kcal.",
        "Si dîner déjà pris avant la séance : whey seule suffit, pas de glucides supplémentaires nécessaires (timing des glucides post-effort sans effet démontré au-delà de 24h avant la prochaine séance).",
        "Si pas dîné avant : repas léger et digeste (protéines maigres + glucides + légumes), éviter l'excès de lipides/fibres qui ralentit la digestion en fin de soirée — macros suivies normalement dans l'onglet Macro.",
        "Terminer le repas ~1h avant le coucher pour ne pas nuire à l'endormissement.",
        "Eau : compléter les pertes (repère : 1 kg perdu ≈ 1 L à boire en plus).",
      ]},
    ],
  },
  midi12h: {
    title: "Entraînement 12h",
    sub: "session midi · déjeuner décalé",
    blocks: [
      { h: "Avant", items: [
        "Petit-déj normal 7h-8h (glucides + protéines) — macros suivies normalement dans l'onglet Macro.",
        "Collation 11h15-11h30 (30-45 min avant), cible 25 g G. Ex. 45 g de pain → 4 g P / 25 g G / 0 g L / ~120 kcal, ou 125 g de banane (≈1 fruit) → 1 g P / 25 g G / 0 g L / ~110 kcal, ou 30 g de bonbons → 24 g G / ~110 kcal.",
        "+ eau 300-400 ml.",
        "+ whey 30 g si petit-déj léger en protéines → 25 g P / 2 g G / 1 g L / ~120 kcal.",
        "Caféine : 200 mg 30-45 min avant si utile — pas de souci pour le sommeil à cette heure.",
      ]},
      { h: "Pendant", items: [
        "12h-13h/13h30 : eau 500-750 ml.",
        "Si séance longue (>1h) ou intense : 20 g de bonbons à la pause → 16 g G / ~72 kcal.",
      ]},
      { h: "Après (vrai déjeuner décalé)", items: [
        "Si le déjeuner est retardé de plus de 30-45 min après la séance : whey 20 g immédiatement pour ne pas attendre à jeun → 17 g P / 1 g G / 1 g L / ~80 kcal.",
        "Déjeuner complet dès que possible : poulet ou poisson 150 g (45 g P / 6 g L / ~247 kcal) + riz blanc ou patate douce 175 g (5 g P / 49 g G / ~227 kcal) + légumes 200 g (4 g P / 8 g G / ~50 kcal) + huile d'olive crue 10 g (10 g L / ~90 kcal). Total : 54 g P / 57 g G / 16 g L / ~615 kcal.",
        "Eau : compléter les pertes de la séance.",
      ]},
    ],
  },
  match10h: {
    title: "Match dimanche 10h30",
    sub: "échauffement 9h45 · protocole complet validé",
    blocks: [
      { h: "Au réveil (7h ou 8h selon la nuit)", items: [
        "500 ml d'eau immédiatement.",
      ]},
      { h: "10-15 min après le réveil", items: [
        "Petit-déj pré-match : pain blanc 100 g + miel 25 g + whey 30 g → ≈34 g P / 77 g G / 2 g L / ~450 kcal.",
      ]},
      { h: "20-40 min après le petit-déj", items: [
        "Marche 15-20 min, allure tranquille — active circulation et digestion.",
      ]},
      { h: "Ensuite", items: [
        "Douche chaude 5-8 min (jamais froide avant un match — réduit la performance neuromusculaire).",
      ]},
      { h: "Jusqu'au départ (9h)", items: [
        "Hydratation continue : 400-500 ml d'eau par petites gorgées.",
      ]},
      { h: "9h20-9h25 (pré-match)", items: [
        "Bonbons 30 g → 24 g G / ~110 kcal + eau 250 ml + caféine 1 cachet 200 mg.",
      ]},
      { h: "9h45 — Échauffement", items: [
        "1. Cardio léger 5 min.",
        "2. Mobilité dynamique 5 min (fentes marchées, balancements de jambe, hanches, chevilles).",
        "3. Isométrie genou : 3-5 × 30-45 s (chaise ou iso quad à ~60°).",
        "4. Montée progressive : squats poids du corps 2×10, puis sauts/réceptions douces 2×5.",
        "5. Spécifique basket : accélérations/décélérations, changements de direction, shoots en mouvement.",
        "Règle : douleur genou > 3/10 à n'importe quelle étape → réduire, ne pas forcer.",
        "Gorgées d'eau régulières.",
      ]},
      { h: "Pendant le match (10h30-12h)", items: [
        "Temps morts : 100-150 ml eau.",
        "Mi-temps (~11h15) : 250 ml eau + 20 g bonbons si creux → 16 g G / ~72 kcal.",
        "Q3/Q4 : 100-150 ml eau par pause.",
        "Total visé : 800 ml-1 L d'eau.",
      ]},
      { h: "12h-12h30 (récupération immédiate)", items: [
        "Whey 1 dose (35 g) → 25 g P / 2 g G / 1 g L / 130 kcal.",
        "Bonbons 40 g → 32 g G / 145 kcal.",
        "Eau 500 ml.",
        "Total : 25 g P / 34 g G / 1 g L / 275 kcal.",
      ]},
      { h: "13h30-14h (vrai déjeuner)", items: [
        "Protéines : poulet ou poisson 150 g.",
        "Glucides : riz blanc ou patate douce 200 g.",
        "Légumes : 250 g.",
        "Huile d'olive crue : 10 g.",
        "Total : 41 g P / 65 g G / 13 g L / ~600 kcal.",
      ]},
      { h: "⚠ Ajustements selon le contexte de la veille", items: [
        "Réveil spontané plus tôt → se lever tout de suite, ne pas lutter au lit.",
        "Transit fragile / selles liquides (stress pré-match) → petit-déj sans fibres, sans lipides, sans laitage lourd ; réduire ou sauter la caféine si ventre sensible.",
        "Gros repas/soirée la veille → déjà chargé en glycogène, réduire les glucides du petit-déj à ~50-55 g (pain blanc 70 g + miel 15 g) au lieu de ~77 g.",
      ]},
    ],
  },
};
