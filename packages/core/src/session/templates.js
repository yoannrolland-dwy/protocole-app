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
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Rowing barre ou machine", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise pronation/neutre (coude)",
      groupe: "dos", mouvement: "tirage", materiel: "barre", tendon: "coude" },
    { n: "Écarté poulie basse", s: 3, r: "12-15", rest: 90, mode: "reps", c: "ligne ascendante (haut des pecs)",
      groupe: "pecs", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Extension triceps poulie haute", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "triceps", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Élévations latérales haltères", s: 3, r: "12-15", rest: 75, mode: "reps", c: "variante haltères",
      groupe: "epaules", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Face pull", s: 3, r: "15", rest: 60, mode: "reps", c: "arrière d'épaule",
      groupe: "epaules", mouvement: "tirage", materiel: "poulie", tendon: null },
    { n: "Curl poignets pronation", s: 3, r: "15-20", rest: 60, mode: "reps", c: "léger, avant-bras",
      groupe: "avant-bras", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Core — Planche", s: 3, r: "45-60 s", rest: 60, mode: "temps", c: "finisher · anti-extension · progresser par difficulté",
      groupe: "core", mouvement: "gainage", materiel: "aucun", tendon: null },
  ]},
  "Upper B": { kind: "muscu", chargeTags: ["tirage"], exos: [
    { n: "Développé couché haltères", s: 4, r: "8-10", rest: 150, mode: "reps", c: "ouverture pecs, priorité",
      groupe: "pecs", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Tirage vertical prise neutre", s: 4, r: "8-10", rest: 120, mode: "reps", c: "prise neutre (coude)",
      groupe: "dos", mouvement: "tirage", materiel: "machine", tendon: "coude" },
    { n: "Développé militaire haltères", s: 3, r: "8-10", rest: 120, mode: "reps", c: "",
      groupe: "epaules", mouvement: "poussee", materiel: "halteres", tendon: null },
    { n: "Rear delt machine (reverse pec deck)", s: 3, r: "12-15", rest: 75, mode: "reps", c: "arrière d'épaule",
      groupe: "epaules", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Élévations latérales poulie", s: 3, r: "12-15", rest: 75, mode: "reps", c: "variante poulie",
      groupe: "epaules", mouvement: "isolation", materiel: "poulie", tendon: null },
    { n: "Curl marteau (prise neutre)", s: 3, r: "10-12", rest: 75, mode: "reps", c: "prise neutre (coude)",
      groupe: "biceps", mouvement: "isolation", materiel: "halteres", tendon: "coude" },
    { n: "Curl poignets supination", s: 3, r: "15-20", rest: 60, mode: "reps", c: "léger, avant-bras",
      groupe: "avant-bras", mouvement: "isolation", materiel: "halteres", tendon: null },
    { n: "Core — Crunch machine", s: 3, r: "12-15", rest: 60, mode: "reps", c: "finisher · contrôlé, 1-2 reps en réserve",
      groupe: "core", mouvement: "isolation", materiel: "machine", tendon: null },
  ]},
  "Lower A": { kind: "muscu", knee: true, hsr: true, chargeTags: ["genou"], exos: [
    { n: "Iso leg extension @60° (si genou raide)", s: 5, r: "45 s", rest: 120, mode: "temps", opt: true, c: "primer antalgique · effort ~70 %",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Presse à cuisses (HSR)", s: 3, r: "table HSR", rest: 180, mode: "reps", hsr: true, c: "tempo 6 s · amplitude 10-60°",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Leg extension unilatérale", s: 3, r: "table HSR", rest: 120, mode: "reps", hsr: true, perLeg: true, c: "tempo 6 s · par jambe",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Soulevé de terre roumain", s: 3, r: "8-10", rest: 150, mode: "reps", c: "genou peu sollicité",
      groupe: "ischios-fessiers", mouvement: "hanche", materiel: "barre", tendon: null },
    { n: "Core — Planche", s: 3, r: "45-60 s", rest: 60, mode: "temps", c: "finisher · pas de crunch le jour du RDL",
      groupe: "core", mouvement: "gainage", materiel: "aucun", tendon: null },
  ]},
  "Lower B": { kind: "muscu", knee: true, chargeTags: ["genou"], exos: [
    { n: "Presse à cuisses", s: 4, r: "8-10", rest: 180, mode: "reps", c: "contrôlé, reps + hautes",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Mollets à la presse", s: 4, r: "10-12", rest: 90, mode: "reps", c: "enchaîné",
      groupe: "mollets", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Leg extension unilatérale", s: 3, r: "8-10", rest: 120, mode: "reps", perLeg: true, c: "tempo 6 s · par jambe",
      groupe: "quadriceps", mouvement: "genou", materiel: "machine", tendon: "genou" },
    { n: "Hip thrust", s: 3, r: "8-10", rest: 120, mode: "reps", c: "genou-safe",
      groupe: "fessiers", mouvement: "hanche", materiel: "machine", tendon: null },
    { n: "Leg curl bilatéral", s: 3, r: "10-12", rest: 90, mode: "reps", c: "",
      groupe: "ischios", mouvement: "isolation", materiel: "machine", tendon: null },
    { n: "Core — Crunch machine", s: 3, r: "12-15", rest: 60, mode: "reps", c: "finisher · contrôlé, 1-2 reps en réserve",
      groupe: "core", mouvement: "isolation", materiel: "machine", tendon: null },
  ]},
  "Basket":   { kind: "sport", knee: true, chargeTags: ["genou"], exos: [] },
  "Escalade": { kind: "sport", climb: true, chargeTags: ["tirage"], exos: [] },
};
export { TEMPLATES };
export const TYPES = Object.keys(TEMPLATES);

// Poids par défaut (kg) — haltères = par haltère, machines = valeur de la pile.
export const DEFAULT_WEIGHTS = {
  "Développé incliné haltères": 32,
  "Développé couché haltères": 34,
  "Développé militaire haltères": 28,
  "Écarté poulie basse": 12.5,
  "Extension triceps poulie haute": 30,
  "Élévations latérales haltères": 16,
  "Élévations latérales poulie": 5,
  "Face pull": 30,
  "Rear delt machine (reverse pec deck)": 76,
  "Curl marteau (prise neutre)": 18,
  "Curl poignets pronation": 6,
  "Curl poignets supination": 14,
  "Rowing barre ou machine": 55,
  "Tirage vertical prise neutre": 80,
  "Presse à cuisses (HSR)": 200,
  "Presse à cuisses": 200,
  "Leg extension unilatérale": 25,
  "Iso leg extension @60° (si genou raide)": 25,
  "Mollets à la presse": 200,
  "Soulevé de terre roumain": 120,
  "Hip thrust": 200,
  "Leg curl bilatéral": 35,
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
export const hsrParse = (scheme) => {
  const m = scheme.match(/(\d+)\s*×\s*(\d+)/);
  return m ? { series: +m[1], reps: +m[2] } : { series: 3, reps: 10 };
};
export const parseSecs = (str) => {
  const nums = String(str).match(/\d+/g);
  return nums ? +nums[nums.length - 1] : 30;
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
        "Repas normal 18h-18h30 si possible (protéines + glucides + légumes), 2h30-3h avant.",
        "Sinon collation 20h-20h15 (45-60 min avant) : 30-40 g glucides rapides (pain, fruit) + whey si peu de protéines depuis le repas de midi.",
        "Hydratation : 500 ml dans les 2h précédentes.",
        "Caféine : à éviter après 18h-19h — la séance finit tard (~22h30), risque de perturber l'endormissement.",
      ]},
      { h: "Pendant", items: [
        "21h-22h30 : eau 500-750 ml par petites gorgées aux pauses.",
        "Si séance intense >1h avec sprints/sauts répétés : 20 g glucides rapides à la pause si sensation de fatigue.",
      ]},
      { h: "Après", items: [
        "22h30+ : whey 30 g dans les 30 min (≈25 g protéines).",
        "Si dîner déjà pris avant la séance : 20-30 g glucides supplémentaires suffisent avec la whey.",
        "Si pas dîné avant : repas léger et digeste (protéines maigres + glucides + légumes), éviter l'excès de lipides/fibres qui ralentit la digestion en fin de soirée.",
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
        "Petit-déj normal 7h-8h (glucides + protéines).",
        "Collation 11h15-11h30 (30-45 min avant) : 20-30 g glucides rapides (banane, pain, bonbons) + eau 300-400 ml. Whey si petit-déj léger en protéines.",
        "Caféine : 200 mg 30-45 min avant si utile — pas de souci pour le sommeil à cette heure.",
      ]},
      { h: "Pendant", items: [
        "12h-13h/13h30 : eau 500-750 ml.",
        "Si séance longue (>1h) ou intense : 20 g glucides à la pause.",
      ]},
      { h: "Après (vrai déjeuner décalé)", items: [
        "Si le déjeuner est retardé de plus de 30-45 min après la séance : whey 20-25 g immédiatement pour ne pas attendre à jeun.",
        "Déjeuner complet dès que possible : protéines 150 g + glucides 150-200 g + légumes + huile d'olive crue 10 g.",
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
        "Caféine : 1 cachet 200 mg.",
      ]},
      { h: "10-15 min après le réveil", items: [
        "Petit-déj pré-match : pain blanc 2-3 tranches + miel + whey.",
        "(Pas de banane → remplacer par 1 tranche de pain en plus, ou 20 g de bonbons.)",
      ]},
      { h: "20-40 min après le petit-déj", items: [
        "Marche 15-20 min, allure tranquille — active circulation et digestion.",
      ]},
      { h: "Ensuite", items: [
        "Douche chaude 5-8 min (jamais froide avant un match — réduit la performance neuromusculaire).",
        "Mobilité 8-10 min : cercles épaules/hanches, fentes alternées, squats poids du corps, sauts légers sur place.",
      ]},
      { h: "Jusqu'au départ (9h)", items: [
        "Hydratation continue : 400-500 ml d'eau par petites gorgées.",
      ]},
      { h: "9h20-9h25 (pré-match)", items: [
        "Bonbons 30 g + eau 250 ml.",
      ]},
      { h: "9h45 — Échauffement", items: [
        "Gorgées d'eau régulières.",
      ]},
      { h: "Pendant le match (10h30-12h)", items: [
        "Temps morts : 100-150 ml eau.",
        "Mi-temps (~11h15) : 250 ml eau + 20 g bonbons si creux.",
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
        "Gros repas/soirée la veille → déjà chargé en glycogène, réduire glucides du petit-déj à 35-40 g au lieu de 50-60 g.",
        "Lever à 8h au lieu de 7h → décaler la mobilité à la salle (9h15) plutôt qu'à la maison, timing trop serré sinon.",
      ]},
    ],
  },
};
