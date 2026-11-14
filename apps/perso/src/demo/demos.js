// Démonstrations 3D des exercices (13/11/2026). Étape 1 : la séance Mobilité ; étape 2 : haltères,
// barre et bancs.
// Une entrée par NOM d'exercice (le même nom que dans les gabarits). Poses en angles anatomiques,
// décrites dans rig.js. Textes écrits pour PROTOCOLE.
//
// Champs d'une démonstration :
// - `frames` : positions clés (timeline.js) ;
// - `active` : parties du mannequin dessinées en jaune (la zone qui travaille) ;
// - `view` : caméra de départ (face, profilG, profilD, dos, dessus, ou { az, el } en degrés) ;
// - `pin` : appui qui ne glisse pas ; `touch` : points qui doivent toucher le sol (tests) ;
// - `rest` : points posés sur un banc ou une cale, à cette hauteur (au lieu du sol) ;
// - `sides` : exercice d'un seul côté, on peut voir l'autre ; `side` : le côté qui travaille ici ;
// - `props` : accessoires (tapis, mur, montant, caisson, câble, rack, barre, haltères) ;
// - `jump` : le corps quitte le sol (saut) : les tests acceptent un déplacement rapide ;
// - `sentir`, `eviter` : un repère chacun.

const LR = (key, v) => ({ [key + "L"]: v, [key + "R"]: v });

// À quatre pattes : genoux au sol (repère z = 0), mains posées sous les épaules.
// Bascule du buste `P`, flexion des genoux `K` ; la hanche suit pour que le tibia reste au sol.
const HANDS_Z = 0.51;
const quad = (P = 75, K = 90, extra = {}) => ({
  root: [P, 0, 0], ...LR("hip", [P + K - 90, 0, 0]), ...LR("knee", K), ...LR("ankle", -90),
  handL: [0.185, 0.042, HANDS_Z], handR: [-0.185, 0.042, HANDS_Z], ...extra,
});
const KNEES = { p: "knL", z: 0 };

// Sur le dos : bassin au repère z = 0, tête vers −Z, pieds vers +Z.
const ARMS_FLOOR = { handL: [0.34, 0.042, -0.02], handR: [-0.34, 0.042, -0.02], elbowL: [1, 0, 0.2], elbowR: [-1, 0, 0.2] };
const FEET_FLOOR = { footL: [0.2, 0.085, 0.47], footR: [-0.2, 0.085, 0.47] };
// Essuie-glaces : pieds écartés d'environ 60 cm, genoux à ~90° (sources de kinésithérapie).
const WIPER_FEET = { footL: [0.3, 0.085, 0.6], footR: [-0.3, 0.085, 0.6] };

// Debout, pieds posés : bassin placé à la main, jambes guidées par les pieds.
const stand = (y, z, pitch, extra = {}) => ({
  pos: [0, y, z], root: [pitch, 0, 0], footL: [0.11, 0.085, 0], footR: [-0.11, 0.085, 0], ...extra,
});

// Étape 2. Bancs : assise à 45 cm. Dossier : [x, y, z, largeur, longueur, épaisseur, inclinaison].
const SEAT = [0, 0.225, -0.02, 0.3, 0.45, 0.4];
const SEATED = { points: ["pelvis"], y: 0.45 };
const SEATED_FEET = { footL: [0.22, 0.085, 0.5], footR: [-0.22, 0.085, 0.5], kneePoleL: [0.3, 1, 0.5], kneePoleR: [-0.3, 1, 0.5] };
// Barre posée sur le haut du dos : mains tenues dans le repère du buste, elle suit le corps.
const BAR_ON_BACK = { handFrame: "chest", handL: [0.45, 0.2, -0.115], handR: [-0.45, 0.2, -0.115], elbowL: [0.3, -1, -0.8], elbowR: [-0.3, -1, -0.8] };
const SQUAT_FEET = { footL: [0.17, 0.085, 0], footR: [-0.17, 0.085, 0], yawL: 15, yawR: 15, kneePoleL: [0.3, 0, 1], kneePoleR: [-0.3, 0, 1] };
// Squat sur sécurités : en bas, 60° de flexion du genou, barre au-dessus du milieu du pied
// (calculé) ; la barre y repose sur les sécurités.
const SQUAT_SAFETY = 1.316 - 0.014 - 0.025;
// Prises : sens de la poignée de l'haltère (dans le prolongement l'une de l'autre, ou neutre).
const PRONE = { gripL: [1, 0, 0], gripR: [-1, 0, 0] };
const NEUTRAL = { gripL: [0, 0, 1], gripR: [0, 0, 1] };

// Étape 3. Machines de jambes : assise à 50 cm.
const LEG_SEAT = { points: ["pelvis"], y: 0.5 };
const LEG_EXT_BASE = { root: [-10, 0, 0], ...LR("hip", [80, 0, 0]), handL: [0.27, 0.56, 0.02], handR: [-0.27, 0.56, 0.02], elbowL: [1, -0.3, -0.3], elbowR: [-1, -0.3, -0.3] };
const LEG_EXT_BOXES = [[0, 0.25, 0.02, 0.45, 0.5, 0.5], [0, 0.85, -0.22, 0.45, 0.7, 0.08, -10]];
const LEG_CURL_BASE = { root: [-15, 0, 0], ...LR("hip", [75, 0, 0]), handL: [0.27, 0.56, 0.02], handR: [-0.27, 0.56, 0.02], elbowL: [1, -0.3, -0.3], elbowR: [-1, -0.3, -0.3] };
// Presse à 45° : buste incliné de 55° en arrière, pieds sur une glissière à 45° (positions des
// pieds calculées pour 90°, 60° et 10° de flexion du genou), semelles à plat sur le plateau.
const PRESS_SEAT = { points: ["pelvis"], y: 0.4 };
const PRESS_FEET = { 90: [0.15, 1.012, 0.312], 60: [0.15, 1.111, 0.411], 10: [0.15, 1.191, 0.492] };
const pressPose = (foot) => ({ root: [-55, 0, 0], neck: [20, 0, 0], footL: foot, footR: [-foot[0], foot[1], foot[2]], kneePoleL: [0.15, 1, 0.3], kneePoleR: [-0.15, 1, 0.3], sole: -135,
  handL: [0.3, 0.45, -0.1], handR: [-0.3, 0.45, -0.1], elbowL: [1, -0.3, 0], elbowR: [-1, -0.3, 0] });
const PRESS_PROPS = {
  boxes: [[0, 0.2, 0.05, 0.45, 0.4, 0.45], [0, 0.595, -0.364, 0.45, 0.8, 0.08, -55], [0.42, 1.05, 0.45, 0.05, 1.1, 0.05, 45], [-0.42, 1.05, 0.45, 0.05, 1.1, 0.05, 45]],
  follow: [{ at: "pieds", offset: [0, 0.116, 0.032], size: [0.7, 0.55, 0.04], rotX: -45 }],
};
const CALF_PRESS = { root: [-55, 0, 0], neck: [20, 0, 0], ...LR("hip", [84, 0, 0]), ...LR("knee", 8), handL: [0.3, 0.45, -0.1], handR: [-0.3, 0.45, -0.1], elbowL: [1, -0.3, 0], elbowR: [-1, -0.3, 0] };

export const DEMOS = {
  "Chat-vache": {
    view: "profilG", active: ["torse", "bassin"], pin: KNEES, touch: ["knL", "knR", "haL", "haR"], props: { mat: true },
    frames: [
      { d: 1.2, hold: 0.3, cue: "À quatre pattes, mains sous les épaules, genoux sous les hanches", pose: quad(75) },
      { d: 2.4, hold: 0.8, cue: "Expirer : repousser le sol, arrondir tout le dos, menton vers la poitrine",
        pose: quad(50, 90, { spine: [20, 0, 0], chest: [24, 0, 0], neck: [35, 0, 0] }) },
      { d: 2.4, hold: 0.8, cue: "Inspirer : laisser descendre le ventre, ouvrir la poitrine, regard devant",
        pose: quad(88, 90, { spine: [-12, 0, 0], chest: [-12, 0, 0], neck: [-28, 0, 0] }) },
    ],
    sentir: "Le dos qui bouge vertèbre par vertèbre, du bassin jusqu'à la nuque.",
    eviter: "Plier les coudes ou forcer en bout de course : l'amplitude vient du dos, pas des bras.",
  },

  "Rotation thoracique à quatre pattes": {
    view: { az: 42, el: 20 }, active: ["torse", "epauleR"], pin: KNEES, touch: ["knL", "knR", "haL"], sides: true, side: "R", props: { mat: true },
    frames: [
      { d: 1.8, hold: 0.4, cue: "Une main derrière la tête : le coude descend vers le poignet d'appui",
        pose: quad(78, 90, { handR: undefined, shR: [20, 75, 90], elR: 150, chest: [4, 10, 0], neck: [10, 10, 0] }) },
      { d: 2.6, hold: 1, cue: "Le coude monte vers le plafond, le regard le suit, le bassin ne bouge pas",
        pose: quad(75, 90, { handR: undefined, shR: [0, 85, 90], elR: 150, spine: [0, -12, 0], chest: [-4, -42, 0], neck: [0, -25, 0] }) },
    ],
    sentir: "La rotation entre les omoplates, pas dans le bas du dos.",
    eviter: "Laisser le bassin tourner ou partir sur le côté : les hanches restent au-dessus des genoux.",
  },

  "Bascule vers les talons": {
    view: "profilG", active: ["hancheL", "hancheR", "cuisseL", "cuisseR", "bassin"], pin: KNEES, touch: ["knL", "knR", "haL", "haR"], props: { mat: true },
    frames: [
      { d: 2, hold: 0.4, cue: "À quatre pattes, dos long", pose: quad(75, 90, { elbowL: [1, 0.2, -0.4], elbowR: [-1, 0.2, -0.4] }) },
      { d: 2.6, hold: 1, cue: "Reculer les fesses vers les talons, les mains restent en place, le dos reste long",
        pose: quad(65, 150, { spine: [4, 0, 0], neck: [-10, 0, 0], elbowL: [1, 0.2, -0.4], elbowR: [-1, 0.2, -0.4] }) },
    ],
    sentir: "Les hanches qui se plient, un étirement sous les bras et le long du dos.",
    eviter: "Arrondir le bas du dos pour aller plus loin : on s'arrête dès que le bassin part en rétroversion.",
  },

  "Fente basse (ouverture de hanche)": {
    view: "profilG", active: ["hancheR", "cuisseR", "bassin"], pin: { p: "knR", z: 0 }, touch: ["knR", "toeL", "heelL"], sides: true, side: "R", props: { mat: true },
    frames: [
      { d: 2, hold: 0.4, cue: "Un genou au sol, l'autre pied devant, buste droit",
        pose: { root: [0, 0, 0], hipR: [0, 0, 0], kneeR: 89, ankleR: -90, footL: [0.095, 0.085, 0.56], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
      { d: 2.6, hold: 1.6, cue: "Rentrer le bassin et serrer le fessier arrière : la hanche s'ouvre de 10-15°, sans cambrer",
        pose: { root: [-6, 0, 0], spine: [6, 0, 0], hipR: [-16, 0, 0], kneeR: 79, ankleR: -90, footL: [0.095, 0.085, 0.56], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
    ],
    sentir: "Un étirement à l'avant de la hanche de la jambe arrière.",
    eviter: "Cambrer le bas du dos : c'est le bassin qui avance, les côtes restent basses.",
  },

  "Hanche 90/90 avec transitions": (() => {
    const hands = { handL: [0.3, 0.042, -0.2], handR: [-0.3, 0.042, -0.2], elbowL: [1, 0, -0.5], elbowR: [-1, 0, -0.5] };
    // Jambe avant : cuisse vers l'avant, tibia en travers. Jambe arrière : cuisse sur le côté, tibia vers l'arrière.
    const left = { root: [-6, 0, 0], ...hands,
      footL: [-0.325, 0.085, 0.43], kneePoleL: [0, 0, 1], yawL: -90,
      footR: [-0.525, 0.085, -0.42], kneePoleR: [-1, 0, 0.2], yawR: 180 };
    const right = { root: [-6, 0, 0], ...hands,
      footR: [0.325, 0.085, 0.43], kneePoleR: [0, 0, 1], yawR: -90,
      footL: [0.525, 0.085, -0.42], kneePoleL: [1, 0, 0.2], yawL: 180 };
    const up = { root: [-12, 0, 0], ...hands,
      footL: [0.24, 0.085, 0.5], kneePoleL: [0.2, 1, 0.3], yawL: 10, footR: [-0.24, 0.085, 0.5], kneePoleR: [-0.2, 1, 0.3], yawR: 10 };
    return {
      view: { az: 28, el: 34 }, active: ["hancheL", "hancheR", "bassin"], pin: { p: "pelvis", z: 0 }, touch: ["pelvis"], props: { mat: true },
      frames: [
        { d: 2.2, hold: 1.4, cue: "Jambe avant et jambe arrière pliées à 90°, buste grand", pose: left },
        { d: 2, hold: 0.2, cue: "Les genoux remontent, les pieds restent au sol", pose: up },
        { d: 2.2, hold: 1.4, cue: "Et basculent de l'autre côté, sans s'aider des mains si possible", pose: right },
        { d: 2, hold: 0.2, cue: "Les genoux remontent", pose: up },
      ],
      sentir: "La rotation dans les deux hanches, une vers l'extérieur, l'autre vers l'intérieur.",
      eviter: "S'effondrer vers l'arrière : le buste reste grand, quitte à réduire l'amplitude.",
    };
  })(),

  "Essuie-glaces de hanches": {
    view: "dessus", active: ["hancheL", "hancheR", "bassin"], pin: { p: "pelvis", z: 0 }, touch: ["ribs", "head"], props: { mat: true },
    frames: [
      { d: 1.6, hold: 0.3, cue: "Sur le dos, genoux pliés à 90°, pieds écartés d'environ 60 cm",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...WIPER_FEET, kneePoleL: [0, 1, 0.2], kneePoleR: [0, 1, 0.2] } },
      { d: 2, hold: 0.8, cue: "Laisser tomber les deux genoux d'un côté (30-45°), épaules lourdes",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...WIPER_FEET, kneePoleL: [0.8, 1, 0.2], kneePoleR: [0.8, 1, 0.2] } },
      { d: 2, hold: 0.3, cue: "Revenir au centre", pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...WIPER_FEET, kneePoleL: [0, 1, 0.2], kneePoleR: [0, 1, 0.2] } },
      { d: 2, hold: 0.8, cue: "Puis de l'autre côté, sans décoller les épaules",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...WIPER_FEET, kneePoleL: [-0.8, 1, 0.2], kneePoleR: [-0.8, 1, 0.2] } },
    ],
    sentir: "Les hanches qui tournent, un léger étirement sur le côté du bassin.",
    eviter: "Décoller l'épaule opposée pour gagner de l'amplitude.",
  },

  "Pont fessier": {
    view: "profilG", active: ["bassin", "hancheL", "hancheR", "cuisseL", "cuisseR"], pin: { p: "shL", z: -0.49 }, touch: ["head"], props: { mat: true },
    frames: [
      { d: 2, hold: 0.5, cue: "Sur le dos, pieds à plat, talons proches des fesses",
        pose: { root: [-90, 0, 0], handL: [0.3, 0.042, -0.05], handR: [-0.3, 0.042, -0.05], elbowL: [1, 0, 0.2], elbowR: [-1, 0, 0.2], ...FEET_FLOOR, kneePoleL: [0, 1, 0.1], kneePoleR: [0, 1, 0.1] } },
      { d: 1.6, hold: 2, cue: "Pousser dans les talons, monter le bassin, serrer les fessiers 2 secondes",
        pose: { root: [-114, 0, 0], spine: [-4, 0, 0], neck: [26, 0, 0], handL: [0.3, 0.042, -0.05], handR: [-0.3, 0.042, -0.05], elbowL: [1, 0, 0.2], elbowR: [-1, 0, 0.2], ...FEET_FLOOR, kneePoleL: [0, 1, 0.1], kneePoleR: [0, 1, 0.1] } },
    ],
    sentir: "Les fessiers qui travaillent, pas le bas du dos ni l'arrière des cuisses seuls.",
    eviter: "Monter en cambrant : épaules, bassin et genoux alignés suffisent.",
  },

  "Squat profond assisté": {
    view: "profilG", active: ["hancheL", "hancheR", "genouL", "genouR", "chevilleL", "chevilleR"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { pole: [0, 0.467] },
    frames: [
      { d: 2.4, hold: 0.5, cue: "Debout face au montant, pieds un peu plus larges que le bassin",
        pose: stand(0.95, -0.04, 2, { footL: [0.17, 0.085, 0], footR: [-0.17, 0.085, 0], yawL: 20, yawR: 20, handL: [0.07, 1.15, 0.4], handR: [-0.07, 1.15, 0.4], kneePoleL: [0.35, 0, 1], kneePoleR: [-0.35, 0, 1] }) },
      { d: 3, hold: 2.4, cue: "Descendre aussi bas que possible, talons au sol, genoux dans l'axe des pieds",
        pose: stand(0.3, -0.24, 22, { spine: [6, 0, 0], neck: [-14, 0, 0], footL: [0.17, 0.085, 0], footR: [-0.17, 0.085, 0], yawL: 20, yawR: 20, handL: [0.07, 0.88, 0.4], handR: [-0.07, 0.88, 0.4], kneePoleL: [0.35, 0, 1], kneePoleR: [-0.35, 0, 1] }) },
    ],
    sentir: "Les hanches et les chevilles qui s'ouvrent, le poids réparti sur tout le pied.",
    eviter: "Décoller les talons ou laisser les genoux rentrer vers l'intérieur.",
  },

  "Levée de jambe tendue, allongé": {
    view: "profilG", active: ["cuisseL", "hancheL"], pin: { p: "pelvis", z: 0 }, touch: ["ribs", "head", "heelR"], sides: true, side: "L", props: { mat: true },
    frames: [
      { d: 2.2, hold: 0.5, cue: "Sur le dos, les deux jambes tendues, bas du dos au sol",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, hipL: [2, 0, 0], ankleL: 5, ankleR: 5 } },
      { d: 2.4, hold: 1, cue: "Monter une jambe tendue, pointe du pied vers soi, puis redescendre lentement",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, hipL: [72, 0, 0], ankleL: 12, ankleR: 5 } },
    ],
    sentir: "L'arrière de la cuisse qui s'étire sur la jambe levée.",
    eviter: "Plier le genou ou décoller le bas du dos : mieux vaut monter moins haut.",
  },

  "Charnière de hanche": {
    view: "profilG", active: ["cuisseL", "cuisseR", "bassin"], touch: ["toeL", "heelL", "toeR", "heelR"], props: {},
    frames: [
      { d: 2.2, hold: 0.5, cue: "Debout, pieds largeur du bassin, genoux déverrouillés",
        pose: stand(0.955, -0.01, 0, { ...LR("sh", [0, 6, 0]), ...LR("el", 8) }) },
      { d: 2.6, hold: 1, cue: "Reculer les fesses, dos plat, jusqu'à sentir l'arrière des cuisses",
        pose: stand(0.9, -0.2, 56, { neck: [-10, 0, 0], ...LR("sh", [56, 6, 0]), ...LR("el", 8) }) },
    ],
    sentir: "L'arrière des cuisses qui s'étire, le poids vers les talons.",
    eviter: "Arrondir le dos ou plier les genoux comme pour un squat : ce sont les hanches qui reculent.",
  },

  "Grands cercles de bras": {
    view: "profilG", active: ["epauleL", "epauleR", "brasL", "brasR"], touch: ["toeL", "heelL", "toeR", "heelR"], cut: true, props: {},
    frames: [
      { d: 0.9, hold: 0, cue: "Debout, côtes basses, bras tendus", pose: stand(0.975, 0, 0, { ...LR("sh", [0, 8, 0]) }) },
      { d: 0.9, hold: 0, cue: "Les bras montent devant", pose: stand(0.975, 0, 0, { ...LR("sh", [90, 8, 0]) }) },
      { d: 0.9, hold: 0, cue: "Passent près des oreilles", pose: stand(0.975, 0, 0, { ...LR("sh", [180, 8, 0]) }) },
      { d: 0.9, hold: 0, cue: "Et redescendent derrière, le plus loin possible sans cambrer", pose: stand(0.975, 0, 0, { ...LR("sh", [270, 30, 0]) }) },
      { d: 0.9, hold: 0, cue: "Debout, côtes basses, bras tendus", pose: stand(0.975, 0, 0, { ...LR("sh", [360, 8, 0]) }) },
    ],
    sentir: "Les épaules qui tournent sur toute leur amplitude, sans à-coup.",
    eviter: "Cambrer ou avancer les côtes quand les bras passent derrière.",
  },

  "Anges au mur": {
    view: "face", active: ["epauleL", "epauleR", "brasL", "brasR"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { wall: { z: -0.115, side: "back" } },
    frames: [
      { d: 2.4, hold: 0.6, cue: "Talons à 15-20 cm du mur ; dos, tête et bras contre le mur, coudes à 90°, bras à hauteur des épaules",
        pose: stand(0.965, 0, 0, { footL: [0.11, 0.085, 0.12], footR: [-0.11, 0.085, 0.12], handL: [0.47, 1.5, -0.07], handR: [-0.47, 1.5, -0.07], elbowL: [0.6, -1, -0.05], elbowR: [-0.6, -1, -0.05] }) },
      { d: 2.8, hold: 0.8, cue: "Glisser les bras vers le haut sans décoller les coudes ni le bas du dos",
        pose: stand(0.965, 0, 0, { footL: [0.11, 0.085, 0.12], footR: [-0.11, 0.085, 0.12], handL: [0.3, 1.98, -0.07], handR: [-0.3, 1.98, -0.07], elbowL: [0.9, -0.6, -0.05], elbowR: [-0.9, -0.6, -0.05] }) },
    ],
    sentir: "Le travail entre les omoplates et l'ouverture à l'avant des épaules.",
    eviter: "Décoller le bas du dos ou les coudes du mur pour monter plus haut.",
  },

  "Rotation externe épaule poulie basse": {
    view: "face", active: ["epauleL", "avantBrasL"], touch: ["toeL", "heelL", "toeR", "heelR"], sides: true, side: "L",
    props: { cable: { from: [-0.7, 0.3, 0.12], to: "haL" }, boxes: [[-0.76, 1, 0.12, 0.1, 2, 0.1]] },
    frames: [
      { d: 2, hold: 0.4, cue: "Coude collé au corps, plié à 90°, l'avant-bras part du ventre",
        pose: stand(0.975, 0, 0, { shL: [0, 4, -35], elL: 90, shR: [0, 6, 0], elR: 8 }) },
      { d: 2, hold: 0.8, cue: "Ouvrir l'avant-bras vers l'extérieur, le coude ne quitte pas le flanc, puis freiner le retour",
        pose: stand(0.975, 0, 0, { shL: [0, 4, 50], elL: 90, shR: [0, 6, 0], elR: 8 }) },
    ],
    sentir: "L'arrière de l'épaule, en profondeur, sans douleur à l'avant.",
    eviter: "Décoller le coude ou tourner le buste pour finir le mouvement.",
  },

  "Cheville : genou au mur": {
    view: "profilG", active: ["chevilleL", "jambeL"], touch: ["toeL", "heelL"], sides: true, side: "L",
    props: { wall: { z: 0.315, side: "front" } },
    frames: [
      { d: 2, hold: 0.4, cue: "Face au mur, pied avant à une main du mur, talon au sol",
        pose: { pos: [0, 0.92, -0.08], root: [4, 0, 0], footL: [0.095, 0.085, 0], footR: [-0.095, 0.085, -0.3], handL: [0.2, 1.28, 0.273], handR: [-0.2, 1.28, 0.273] } },
      { d: 2.6, hold: 1, cue: "Avancer le genou vers le mur, lentement, sans décoller le talon",
        pose: { pos: [0, 0.846, 0.078], root: [4, 0, 0], footL: [0.095, 0.085, 0], footR: [-0.095, 0.085, -0.3], handL: [0.2, 1.28, 0.273], handR: [-0.2, 1.28, 0.273] } },
    ],
    sentir: "Un étirement dans le mollet et à l'avant de la cheville du pied avant.",
    eviter: "Laisser le talon se décoller ou le genou partir vers l'intérieur.",
  },

  "Iso leg extension unilatérale @60° (genou)": {
    view: "profilG", active: ["genouL", "cuisseL"], sides: true, side: "L",
    props: { boxes: [[0, 0.26, 0.16, 0.5, 0.52, 0.52], [0, 0.72, -0.2, 0.5, 0.75, 0.1]] },
    frames: [
      { d: 2, hold: 0.6, cue: "Assis, dos calé, les deux genoux à 90°",
        pose: { pos: [0, 0.63, 0], root: [-12, 0, 0], ...LR("hip", [78, 0, 0]), ...LR("knee", 90), handL: [0.27, 0.56, 0.1], handR: [-0.27, 0.56, 0.1] } },
      { d: 2, hold: 4, cue: "Monter une jambe jusqu'à 60° de flexion et tenir, effort à 70 %, sans douleur",
        pose: { pos: [0, 0.63, 0], root: [-12, 0, 0], ...LR("hip", [78, 0, 0]), kneeL: 60, kneeR: 90, handL: [0.27, 0.56, 0.1], handR: [-0.27, 0.56, 0.1] } },
    ],
    sentir: "Le quadriceps qui tient, une tension stable, sans à-coup.",
    eviter: "Tendre complètement le genou ou forcer au-delà du seuil de douleur.",
  },

  "Iso flexion coude prise marteau + supination": {
    view: "profilG", active: ["brasL", "avantBrasL"], touch: ["toeL", "heelL", "toeR", "heelR"], sides: true, side: "L", props: {},
    frames: [
      { d: 2, hold: 0.5, cue: "Debout, coude au corps, pouce vers le haut",
        pose: stand(0.975, 0, 0, { shL: [0, 4, 0], elL: 25, shR: [0, 6, 0], elR: 8 }) },
      { d: 2, hold: 4, cue: "Plier à 90° contre une résistance fixe et tenir, sans douleur ; même chose paume vers le haut",
        pose: stand(0.975, 0, 0, { shL: [0, 4, 0], elL: 90, shR: [0, 6, 0], elR: 8 }) },
    ],
    sentir: "Le biceps et l'avant-bras qui tiennent, sans tiraillement au pli du coude.",
    eviter: "Avancer le coude ou hausser l'épaule pour tenir.",
  },

  "Core — Crunch machine": {
    view: "profilG", active: ["torse"],
    props: { boxes: [[0, 0.215, 0.14, 0.5, 0.43, 0.5], [0, 0.66, -0.2, 0.5, 0.8, 0.1]] },
    frames: [
      { d: 2, hold: 0.5, cue: "Assis, mains sur les poignées, dos long",
        pose: { pos: [0, 0.545, 0], root: [-8, 0, 0], ...LR("hip", [82, 0, 0]), ...LR("knee", 90), ...LR("sh", [70, 12, 0]), ...LR("el", 120) } },
      { d: 2, hold: 0.8, cue: "Enrouler le buste, les côtes vers le bassin, puis remonter en freinant",
        pose: { pos: [0, 0.545, 0], root: [-8, 0, 0], spine: [30, 0, 0], chest: [24, 0, 0], neck: [10, 0, 0], ...LR("hip", [82, 0, 0]), ...LR("knee", 90), ...LR("sh", [70, 12, 0]), ...LR("el", 120) } },
    ],
    sentir: "Les abdominaux qui raccourcissent, le bassin immobile.",
    eviter: "Tirer avec les bras ou plier aux hanches au lieu d'enrouler le dos.",
  },

  "Core — Planche": {
    view: "profilG", active: ["torse", "bassin"], touch: ["toeL", "toeR", "elL", "elR"], props: { mat: true },
    frames: [
      { d: 2, hold: 2.5, cue: "Sur les avant-bras et les pointes de pieds, corps aligné de la tête aux talons",
        pose: { root: [84.5, 0, 0], ...LR("sh", [84.5, 0, 0]), ...LR("el", 90), neck: [-8, 0, 0] } },
      { d: 2, hold: 2.5, cue: "Serrer les fessiers, rentrer les côtes, respirer sans laisser le bassin descendre",
        pose: { root: [83.5, 0, 0], spine: [2, 0, 0], ...LR("sh", [84.5, 0, 0]), ...LR("el", 90), neck: [-8, 0, 0] } },
    ],
    sentir: "Toute la sangle abdominale, sans pincement dans le bas du dos.",
    eviter: "Laisser le bassin descendre ou monter les fesses : la ligne reste droite.",
  },

  // ---------------------------------------------------------------- Étape 2 : haltères, barre, bancs

  // Repères (NSCA, ACE, Rodríguez-Ridao 2020) : en bas, bras à ~55-60° du buste, coude à ~90°,
  // avant-bras verticaux, haltères à hauteur du milieu de la poitrine ; en haut, bras presque tendus
  // au-dessus des épaules, haltères qui ne se touchent pas. Positions des mains calculées.
  "Développé couché haltères": (() => {
    const base = { root: [-90, 0, 0], neck: [6, 0, 0], footL: [0.3, 0.085, 0.42], footR: [-0.3, 0.085, 0.42],
      kneePoleL: [0.4, 1, 0.3], kneePoleR: [-0.4, 1, 0.3], elbowL: [0.23, -0.07, 0.16], elbowR: [-0.23, -0.07, 0.16], ...PRONE };
    const top = { ...base, handL: [0.18, 1.149, -0.48], handR: [-0.18, 1.149, -0.48] };
    const low = { ...base, handL: [0.417, 0.792, -0.332], handR: [-0.417, 0.792, -0.332] };
    return {
      view: { az: 55, el: 22 }, active: ["torse", "epauleL", "epauleR", "brasL", "brasR"],
      rest: { points: ["pelvis", "spine", "chest", "ribs", "head"], y: 0.45 }, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { dumbbells: true, boxes: [[0, 0.225, -0.31, 0.3, 0.45, 1.02]] },
      frames: [
        { d: 1.2, hold: 0.6, cue: "Allongé, pieds à plat, omoplates serrées, bras tendus au-dessus des épaules", pose: top },
        { d: 2.2, hold: 0.3, cue: "Descendre jusqu'au milieu de la poitrine, coudes à 45-60° du buste, avant-bras verticaux", pose: low },
        { d: 1.2, hold: 0.6, cue: "Pousser vers le haut, les haltères se rapprochent sans se toucher", pose: top },
      ],
      sentir: "Les pectoraux qui s'étirent en bas et poussent en remontant.",
      eviter: "Ouvrir les coudes à 90° du buste ou décoller les fesses du banc.",
    };
  })(),

  // Repères : banc entre 30 et 45° (haut des pectoraux à 30° chez Rodríguez-Ridao 2020, à 44° chez
  // Trebs 2010 ; au-delà, l'épaule prend le relais), montré à 30°. Mêmes repères de bras qu'au banc
  // plat, trajectoire verticale au-dessus du haut de la poitrine.
  "Développé incliné haltères": (() => {
    const base = { root: [-60, 0, 0], neck: [18, 0, 0], ...SEATED_FEET, elbowL: [0.24, -0.135, 0.09], elbowR: [-0.24, -0.135, 0.09], ...PRONE };
    const top = { ...base, handL: [0.18, 1.384, -0.414], handR: [-0.18, 1.384, -0.414] };
    const low = { ...base, handL: [0.425, 0.965, -0.335], handR: [-0.425, 0.965, -0.335] };
    return {
      view: { az: 65, el: 14 }, active: ["torse", "epauleL", "epauleR"],
      rest: SEATED, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { dumbbells: true, boxes: [SEAT, [0, 0.613, -0.371, 0.3, 0.8, 0.08, -60]] },
      frames: [
        { d: 1.2, hold: 0.6, cue: "Dossier à 30°, dos et tête calés, bras tendus au-dessus du haut de la poitrine", pose: top },
        { d: 2.2, hold: 0.3, cue: "Descendre sur les côtés du haut de la poitrine, coudes à 45-60° du buste, avant-bras verticaux", pose: low },
        { d: 1.2, hold: 0.6, cue: "Pousser vers le haut, à la verticale des épaules", pose: top },
      ],
      sentir: "Le haut des pectoraux et l'avant des épaules.",
      eviter: "Monter le dossier au-delà de 45° (l'épaule travaille à la place des pectoraux) ou cambrer.",
    };
  })(),

  // Repères (NSCA, ACE) : en bas, haltères à hauteur d'épaules, avant-bras verticaux, coudes à ~90°
  // et ~30° en avant du plan du corps ; en haut, coudes tendus sans verrouiller, haltères au-dessus
  // de la tête.
  "Développé militaire haltères": (() => {
    const base = { root: [-12, 0, 0], neck: [6, 0, 0], ...SEATED_FEET, elbowL: [0.24, -0.075, 0.14], elbowR: [-0.24, -0.075, 0.14], ...PRONE };
    const low = { ...base, handL: [0.428, 1.259, 0.038], handR: [-0.428, 1.259, 0.038] };
    const top = { ...base, handL: [0.16, 1.618, -0.05], handR: [-0.16, 1.618, -0.05] };
    return {
      view: { az: 25, el: 8 }, active: ["epauleL", "epauleR", "brasL", "brasR"],
      rest: SEATED, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { dumbbells: true, boxes: [SEAT, [0, 0.869, -0.205, 0.3, 0.8, 0.08, -12]] },
      frames: [
        { d: 1.2, hold: 0.5, cue: "Dos calé, haltères à hauteur d'épaules, avant-bras verticaux, coudes un peu en avant", pose: low },
        { d: 1.3, hold: 0.4, cue: "Pousser au-dessus de la tête jusqu'aux bras tendus, sans cambrer", pose: top },
        { d: 2, hold: 0.3, cue: "Redescendre en freinant jusqu'aux épaules", pose: low },
      ],
      sentir: "Le devant et le côté des épaules.",
      eviter: "Décoller le dos du dossier, cambrer, ou ouvrir les coudes complètement sur les côtés.",
    };
  })(),

  // Repères (ACE, Coratella 2020) : montée jusqu'à 90° (bras parallèles au sol, pas plus haut), coude
  // fléchi de 10-20° et fixe, dans le plan de l'omoplate (15-30° en avant du plan du corps, montré à
  // 25°), rotation neutre : jamais le pouce vers le bas.
  "Élévations latérales haltères": (() => {
    const base = { pos: [0, 0.975, 0], root: [5, 0, 0], neck: [-5, 0, 0], footL: [0.11, 0.085, 0], footR: [-0.11, 0.085, 0],
      elbowL: [0.1, 0, -1], elbowR: [-0.1, 0, -1], ...NEUTRAL };
    const low = { ...base, handL: [0.254, 0.885, 0.101], handR: [-0.254, 0.885, 0.101] };
    const high = { ...base, handL: [0.715, 1.463, 0.29], handR: [-0.715, 1.463, 0.29] };
    return {
      view: { az: 30, el: 8 }, active: ["epauleL", "epauleR"], touch: ["toeL", "heelL", "toeR", "heelR"], props: { dumbbells: true },
      frames: [
        { d: 1.2, hold: 0.4, cue: "Debout, buste légèrement penché, coudes à peine fléchis, haltères devant les cuisses", pose: low },
        { d: 1.2, hold: 0.4, cue: "Monter les bras un peu en avant du corps jusqu'à l'horizontale, pas plus haut, sans élan", pose: high },
        { d: 2, hold: 0.2, cue: "Redescendre en freinant, les coudes gardent le même angle", pose: low },
      ],
      sentir: "Le côté des épaules, du début à la fin du mouvement.",
      eviter: "Hausser les épaules, monter au-dessus de l'horizontale, tourner le pouce vers le bas ou donner de l'élan.",
    };
  })(),

  // Repères (ACE) : coude de ~0 à 130-140° de flexion, bras vertical collé au flanc et immobile,
  // prise neutre (celle à privilégier pour le tendon distal du biceps).
  "Curl marteau (prise neutre)": {
    view: { az: 60, el: 10 }, active: ["brasL", "brasR", "avantBrasL", "avantBrasR"], touch: ["toeL", "heelL", "toeR", "heelR"], props: { dumbbells: true },
    frames: [
      { d: 1.2, hold: 0.3, cue: "Debout, bras le long du corps, pouces vers l'avant", pose: stand(0.975, 0, 0, { ...LR("sh", [0, 5, 0]), ...LR("el", 5) }) },
      { d: 1.2, hold: 0.5, cue: "Plier les coudes, pouces vers le haut ; le bras ne bouge pas", pose: stand(0.975, 0, 0, { ...LR("sh", [0, 5, 0]), ...LR("el", 135) }) },
      { d: 2, hold: 0.2, cue: "Redescendre en freinant jusqu'aux bras presque tendus", pose: stand(0.975, 0, 0, { ...LR("sh", [0, 5, 0]), ...LR("el", 5) }) },
    ],
    sentir: "L'avant du bras et le dessus de l'avant-bras.",
    eviter: "Balancer le buste ou avancer les coudes pour lever plus lourd.",
  },

  // Repères (ACE, ExRx) : buste penché de 70-85°, coude fléchi de 15-25° et fixe, bras ouverts jusqu'au
  // niveau du dos (~80-90°), prise neutre. Positions des mains calculées.
  "Oiseau haltères": (() => {
    const base = { root: [57, 0, 0], spine: [15, 0, 0], chest: [12, 0, 0], neck: [-24, 0, 0],
      footL: [0.16, 0.085, 0.42], footR: [-0.16, 0.085, 0.42], kneePoleL: [0.1, 1, 0.5], kneePoleR: [-0.1, 1, 0.5],
      elbowL: [0.2, 0.6, -0.8], elbowR: [-0.2, 0.6, -0.8], ...NEUTRAL };
    const low = { ...base, handL: [0.36, 0.136, 0.463], handR: [-0.36, 0.136, 0.463] };
    const high = { ...base, handL: [0.765, 0.701, 0.463], handR: [-0.765, 0.701, 0.463] };
    return {
      view: { az: 25, el: 22 }, active: ["epauleL", "epauleR"],
      rest: SEATED, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { dumbbells: true, boxes: [[0, 0.225, -0.4, 0.3, 0.45, 1.0]] },
      frames: [
        { d: 1.2, hold: 0.4, cue: "Assis au bout du banc, poitrine sur les cuisses, haltères sous les genoux, prise neutre", pose: low },
        { d: 1.3, hold: 0.6, cue: "Ouvrir les bras sur les côtés jusqu'au niveau du dos, coudes légèrement fléchis et fixes", pose: high },
        { d: 2, hold: 0.2, cue: "Redescendre en freinant", pose: low },
      ],
      sentir: "L'arrière des épaules et le haut du dos, entre les omoplates.",
      eviter: "Plier les coudes pour tirer, ou relever le buste pour aider.",
    };
  })(),

  "Squat sur sécurités": {
    view: { az: 35, el: 28 }, active: ["cuisseL", "cuisseR", "genouL", "genouR", "bassin"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { barbell: true, rack: { z: 0.03, safety: SQUAT_SAFETY } },
    frames: [
      { d: 1, hold: 1, cue: "Barre sur le haut du dos, pieds largeur d'épaules, pointes légèrement ouvertes",
        pose: { pos: [0, 0.97, 0.05], root: [10, 0, 0], neck: [-6, 0, 0], ...SQUAT_FEET, ...BAR_ON_BACK } },
      { d: 3, hold: 0.8, onSafety: true, cue: "Descendre en 3 secondes jusqu'à poser la barre sur les sécurités (~60° de genou), puis arrêt complet",
        pose: { pos: [0, 0.843, -0.1], root: [30, 0, 0], neck: [-18, 0, 0], ...SQUAT_FEET, ...BAR_ON_BACK } },
      { d: 0.8, hold: 1, cue: "Remonter de façon explosive, genoux dans l'axe des pieds",
        pose: { pos: [0, 0.97, 0.05], root: [10, 0, 0], neck: [-6, 0, 0], ...SQUAT_FEET, ...BAR_ON_BACK } },
    ],
    sentir: "Les quadriceps et les fessiers ; au genou, une gêne de 3/10 au plus.",
    eviter: "Rebondir sur les sécurités ou laisser les genoux rentrer vers l'intérieur.",
  },

  "Mollets debout à la barre": (() => {
    const base = { root: [2, 0, 0], ...LR("knee", 3), ...BAR_ON_BACK };
    return {
      view: { az: 100, el: 6 }, active: ["jambeL", "jambeR", "chevilleL", "chevilleR"],
      rest: { points: ["toeL", "toeR"], y: 0.1 }, pin: { p: "toeL", z: 0.2 },
      props: { barbell: true, rack: { z: 0.06 }, boxes: [[0, 0.05, 0.2, 0.6, 0.1, 0.14]] },
      frames: [
        { d: 1.2, hold: 0.4, cue: "Barre sur le dos, l'avant des pieds sur la cale, talons dans le vide",
          pose: { ...base, ...LR("ankle", 22) } },
        { d: 0.7, hold: 0.5, cue: "Monter vite sur la pointe des pieds, le plus haut possible", pose: { ...base, ...LR("ankle", -32) } },
        { d: 2, hold: 0.6, cue: "Redescendre en 2 secondes, talons sous la cale, pause en bas sans rebond", pose: { ...base, ...LR("ankle", 22) } },
      ],
      sentir: "Les mollets, étirés en bas et contractés en haut.",
      eviter: "Plier les genoux pour aider ou rebondir en bas.",
    };
  })(),

  "Soulevé de terre roumain": (() => {
    const FT = { footL: [0.11, 0.085, 0], footR: [-0.11, 0.085, 0], kneePoleL: [0.05, 0, 1], kneePoleR: [-0.05, 0, 1], elbowL: [0.3, 0, -1], elbowR: [-0.3, 0, -1] };
    const top = { pos: [0, 0.965, 0.0], root: [3, 0, 0], ...FT, handL: [0.24, 0.9, 0.1], handR: [-0.24, 0.9, 0.1] };
    const low = { pos: [0, 0.86, -0.31], root: [70, 0, 0], neck: [-25, 0, 0], ...FT, handL: [0.24, 0.45, 0.06], handR: [-0.24, 0.45, 0.06] };
    // À mi-chemin (calculé) : les hanches ont déjà reculé, la barre est à mi-cuisse.
    const mid = { pos: [0, 0.89, -0.305], root: [45, 0, 0], neck: [-16, 0, 0], ...FT, handL: [0.24, 0.67, 0.08], handR: [-0.24, 0.67, 0.08] };
    return {
      view: { az: 58, el: 12 }, active: ["cuisseL", "cuisseR", "bassin"], touch: ["toeL", "heelL", "toeR", "heelR"], cut: true,
      props: { barbell: true },
      frames: [
        { d: 1.2, hold: 0.6, cue: "Debout, barre contre les cuisses, prise largeur d'épaules, genoux déverrouillés", pose: top },
        { d: 1.2, hold: 0, cue: "Reculer les fesses, dos plat : la barre glisse le long des cuisses", pose: mid },
        { d: 1.3, hold: 0.4, cue: "Jusque sous les genoux, sans arrondir le dos", pose: low },
        { d: 0.8, hold: 0, cue: "Remonter en poussant les hanches vers l'avant", pose: mid },
        { d: 0.7, hold: 0.6, cue: "Debout, fessiers serrés, sans se pencher en arrière", pose: top },
      ],
      sentir: "L'arrière des cuisses qui s'étire, puis les fessiers en remontant.",
      eviter: "Arrondir le dos ou plier les genoux comme un squat : ce sont les hanches qui reculent.",
    };
  })(),

  // ---------------------------------------------------------------- Étape 3 : poulies et machines
  // Repères : docs/demos-3d/technique-machines-poulies.md (ACE, NSCA, études citées).

  // Buste incliné de 30° au plus (ACE ; ici 15°), poignée jusqu'au haut de la poitrine, coudes qui
  // descendent le long des côtes. Choix de Yoann : prise neutre.
  "Tirage vertical prise neutre": (() => {
    const base = { root: [-15, 0, 0], neck: [6, 0, 0], footL: [0.2, 0.085, 0.45], footR: [-0.2, 0.085, 0.45],
      kneePoleL: [0.2, 1, 0.6], kneePoleR: [-0.2, 1, 0.6], elbowL: [0.6, -1, -0.6], elbowR: [-0.6, -1, -0.6], gripL: [0, 0, 1], gripR: [0, 0, 1] };
    const top = { ...base, handL: [0.25, 1.62, -0.06], handR: [-0.25, 1.62, -0.06] };
    const low = { ...base, handL: [0.25, 1.03, 0.03], handR: [-0.25, 1.03, 0.03] };
    return {
      view: { az: 60, el: 8 }, active: ["torse", "brasL", "brasR"],
      rest: { points: ["pelvis"], y: 0.47 }, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { handles: true, handle: true, cables: [{ from: [0, 2.35, -0.06], to: "mains" }],
        boxes: [[0, 0.235, -0.02, 0.4, 0.47, 0.4], [0, 0.63, 0.33, 0.6, 0.08, 0.12], [0, 1.2, -0.55, 0.1, 2.4, 0.1], [0, 2.38, -0.3, 0.1, 0.06, 0.55]] },
      frames: [
        { d: 1.2, hold: 0.5, cue: "Assis, cuisses calées, buste un peu en arrière, bras tendus, prise neutre", pose: top },
        { d: 1.3, hold: 0.6, cue: "Tirer la poignée jusqu'au haut de la poitrine, coudes vers les hanches", pose: low },
        { d: 2, hold: 0.2, cue: "Remonter en contrôlant jusqu'aux bras tendus, épaules qui s'étirent", pose: top },
      ],
      sentir: "Les dorsaux, sous les bras, qui tirent les coudes vers le bas.",
      eviter: "Se pencher en arrière de plus de 30° ou tirer avec les bras seuls, coudes en avant.",
    };
  })(),

  // Buste vertical (léger allongement vers l'avant au départ), poignée jusqu'au haut du ventre,
  // coudes juste derrière le tronc. Choix de Yoann : poulie basse assise ; prise neutre (coude).
  "Rowing poulie basse": (() => {
    const base = { neck: [0, 0, 0], footL: [0.12, 0.25, 0.62], footR: [-0.12, 0.25, 0.62], kneePoleL: [0.1, 1, 0.3], kneePoleR: [-0.1, 1, 0.3], sole: -60,
      elbowL: [0.3, -0.3, -1], elbowR: [-0.3, -0.3, -1], gripL: [0, 1, 0], gripR: [0, 1, 0] };
    const reach = { ...base, root: [12, 0, 0], handL: [0.06, 0.88, 0.66], handR: [-0.06, 0.88, 0.66] };
    const pull = { ...base, root: [0, 0, 0], handL: [0.06, 0.86, 0.17], handR: [-0.06, 0.86, 0.17] };
    return {
      view: { az: 70, el: 10 }, active: ["torse", "brasL", "brasR", "epauleL", "epauleR"],
      rest: { points: ["pelvis"], y: 0.4 }, pin: { p: "pelvis", z: 0 },
      props: { handles: true, handle: true, cables: [{ from: [0, 0.3, 1.25], to: "mains" }],
        boxes: [[0, 0.2, 0.05, 0.35, 0.4, 0.8], [0, 0.25, 0.72, 0.5, 0.35, 0.04, -30], [0, 0.35, 1.3, 0.2, 0.7, 0.1]] },
      frames: [
        { d: 1.2, hold: 0.4, cue: "Assis, pieds calés, genoux légèrement fléchis, bras tendus, dos droit", pose: reach },
        { d: 1.3, hold: 0.6, cue: "Tirer la poignée jusqu'au haut du ventre, buste vertical, coudes juste derrière le corps", pose: pull },
        { d: 2, hold: 0.2, cue: "Rendre en contrôlant, bras tendus, les épaules s'avancent un peu", pose: reach },
      ],
      sentir: "Le milieu du dos, entre les omoplates, qui se serrent en fin de tirage.",
      eviter: "Basculer le buste d'avant en arrière pour tirer, ou hausser les épaules.",
    };
  })(),

  // Coudes fixes à ~15-30°, les bras partent ~30-45° sous l'horizontale et finissent mains à hauteur
  // des épaules ou du menton.
  "Écarté poulie basse": {
    view: { az: 30, el: 10 }, active: ["torse", "epauleL", "epauleR"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { handles: true, cables: [{ from: [0.85, 0.2, -0.05], to: "haL" }, { from: [-0.85, 0.2, -0.05], to: "haR" }],
      boxes: [[0.92, 1.0, -0.05, 0.12, 2.0, 0.12], [-0.92, 1.0, -0.05, 0.12, 2.0, 0.12]] },
    frames: [
      { d: 1.2, hold: 0.5, cue: "Debout entre les poulies basses, bras ouverts vers le bas, coudes légèrement fléchis",
        pose: stand(0.975, 0, 4, { handL: [0.649, 1.14, 0.116], handR: [-0.649, 1.14, 0.116], elbowL: [0.5, -1, -0.3], elbowR: [-0.5, -1, -0.3] }) },
      { d: 1.4, hold: 0.6, cue: "Ramener les mains devant soi, de bas en haut, jusqu'à hauteur du menton",
        pose: stand(0.975, 0, 4, { handL: [0.1, 1.58, 0.56], handR: [-0.1, 1.58, 0.56], elbowL: [0.5, -1, -0.3], elbowR: [-0.5, -1, -0.3] }) },
      { d: 2, hold: 0.2, cue: "Rouvrir lentement, sans changer l'angle des coudes, jusqu'à l'étirement", pose: null },
    ],
    sentir: "Le haut des pectoraux, étirés en bas et serrés en haut.",
    eviter: "Plier les coudes pour pousser (cela devient un développé) ou cambrer.",
  },

  // Montée jusqu'à 90°, coude presque tendu, rotation neutre (Coratella 2020). Consigne de la séance :
  // poulie à hauteur de main, câble derrière le corps.
  "Élévations latérales poulie": {
    view: { az: 20, el: 10 }, active: ["epauleL"], touch: ["toeL", "heelL", "toeR", "heelR"], sides: true, side: "L",
    props: { cables: [{ from: [-0.4, 0.85, -0.18], to: "haL" }], boxes: [[-0.47, 1.0, -0.22, 0.12, 2.0, 0.12]] },
    frames: [
      { d: 1.2, hold: 0.4, cue: "De profil à la poulie, le câble passe derrière le corps, main à côté de la cuisse",
        pose: stand(0.975, 0, 5, { handL: [0.2, 0.89, -0.06], elbowL: [0.1, 0, -1], shR: [0, 6, 0], elR: 10 }) },
      { d: 1.2, hold: 0.4, cue: "Monter le bras sur le côté, un peu en avant, jusqu'à l'horizontale",
        pose: stand(0.975, 0, 5, { handL: [0.715, 1.463, 0.29], elbowL: [0.1, 0, -1], shR: [0, 6, 0], elR: 10 }) },
      { d: 2, hold: 0.2, cue: "Redescendre en freinant, la poulie garde le muscle sous tension en bas", pose: null },
    ],
    sentir: "Le côté de l'épaule, y compris en bas du mouvement.",
    eviter: "Hausser l'épaule, pencher le buste vers la poulie ou dépasser l'horizontale.",
  },

  // Bras verticaux immobiles le long du corps, coudes de ~90-110° à ~0-5°, buste vertical ou un peu
  // penché. Choix de Yoann : corde.
  "Extension triceps poulie haute": {
    view: { az: 60, el: 8 }, active: ["brasL", "brasR"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { rope: { pulley: [0, 2.15, 0.42] }, boxes: [[0, 1.1, 0.5, 0.12, 2.2, 0.12]] },
    frames: [
      { d: 1.2, hold: 0.4, cue: "Face à la poulie haute, buste un peu penché, coudes collés au corps, corde à hauteur de poitrine",
        pose: stand(0.975, 0, 10, { neck: [-8, 0, 0], ...LR("sh", [-6, 8, 0]), ...LR("el", 100) }) },
      { d: 1.2, hold: 0.5, cue: "Tendre les bras vers le bas, écarter un peu la corde en fin de mouvement",
        pose: stand(0.975, 0, 10, { neck: [-8, 0, 0], ...LR("sh", [-10, 14, 0]), ...LR("el", 4) }) },
      { d: 2, hold: 0.2, cue: "Remonter en freinant, sans que les coudes avancent", pose: null },
    ],
    sentir: "L'arrière du bras, jusqu'au coude tendu.",
    eviter: "Avancer les coudes ou appuyer avec le poids du corps.",
  },

  // Arrivée : coudes à la hauteur des épaules, coudes pliés, mains de part et d'autre du front
  // (rotation externe). Prise neutre sur la corde.
  "Face pull": {
    view: { az: 40, el: 12 }, active: ["epauleL", "epauleR", "torse"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { rope: { pulley: [0, 1.55, 0.95] }, boxes: [[0, 1.1, 1.02, 0.12, 2.2, 0.12]] },
    frames: [
      { d: 1.2, hold: 0.4, cue: "Face à la poulie à hauteur du visage, bras tendus, corde en prise neutre",
        pose: stand(0.975, 0, 0, { handL: [0.07, 1.47, 0.57], handR: [-0.07, 1.47, 0.57], elbowL: [1, -0.1, -0.3], elbowR: [-1, -0.1, -0.3] }) },
      { d: 1.3, hold: 0.6, cue: "Tirer vers le visage, coudes hauts et écartés, mains de part et d'autre du front",
        pose: stand(0.975, 0, 0, { handL: [0.33, 1.72, 0.0], handR: [-0.33, 1.72, 0.0], elbowL: [1, -0.1, -0.3], elbowR: [-1, -0.1, -0.3] }) },
      { d: 2, hold: 0.2, cue: "Rendre en contrôlant jusqu'aux bras tendus", pose: null },
    ],
    sentir: "L'arrière des épaules et le haut du dos, entre les omoplates.",
    eviter: "Tirer vers le menton avec les coudes bas, ou se pencher en arrière.",
  },

  // Bras horizontaux, coudes à ~10-20°, de devant jusqu'au plan du corps ; prise neutre (Schoenfeld 2013).
  "Rear delt machine (reverse pec deck)": {
    view: { az: 30, el: 25 }, active: ["epauleL", "epauleR"],
    rest: { points: ["pelvis"], y: 0.47 }, pin: { p: "pelvis", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { handles: true, boxes: [[0, 0.235, -0.02, 0.4, 0.47, 0.4], [0, 0.95, 0.15, 0.35, 0.5, 0.06], [0, 0.6, 0.3, 0.12, 0.7, 0.1]] },
    frames: [
      { d: 1.2, hold: 0.4, cue: "Assis, poitrine contre le coussin, bras tendus devant, poignées verticales",
        pose: { root: [0, 0, 0], footL: [0.2, 0.085, 0.45], footR: [-0.2, 0.085, 0.45], kneePoleL: [0.2, 1, 0.6], kneePoleR: [-0.2, 1, 0.6],
          handL: [0.11, 1.065, 0.575], handR: [-0.11, 1.065, 0.575], elbowL: [0.4, 0.2, -1], elbowR: [-0.4, 0.2, -1], gripL: [0, 1, 0], gripR: [0, 1, 0] } },
      { d: 1.3, hold: 0.6, cue: "Ouvrir les bras à l'horizontale jusqu'au niveau du corps, coudes légèrement fléchis",
        pose: { root: [0, 0, 0], footL: [0.2, 0.085, 0.45], footR: [-0.2, 0.085, 0.45], kneePoleL: [0.2, 1, 0.6], kneePoleR: [-0.2, 1, 0.6],
          handL: [0.765, 1.065, 0.02], handR: [-0.765, 1.065, 0.02], elbowL: [0.4, 0.2, -1], elbowR: [-0.4, 0.2, -1], gripL: [0, 1, 0], gripR: [0, 1, 0] } },
      { d: 2, hold: 0.2, cue: "Revenir en contrôlant", pose: null },
    ],
    sentir: "L'arrière des épaules.",
    eviter: "Plier les coudes pour tirer ou décoller la poitrine du coussin.",
  },

  // Machine de leg extension : assise à 50 cm, dossier à 10°, cuisses à l'horizontale, rouleau devant
  // le bas du tibia. Isométrie à 60° de flexion (Rio 2015 : 5 × 45 s à ~70 %).
  "Iso leg extension @60° (si genou raide)": {
    view: "profilG", active: ["cuisseL", "cuisseR", "genouL", "genouR"],
    rest: LEG_SEAT, pin: { p: "pelvis", z: 0 },
    props: { boxes: LEG_EXT_BOXES, pads: [{ joint: "anL", at: [-0.095, 0.04, 0.075], r: 0.05, len: 0.45 }] },
    frames: [
      { d: 1.5, hold: 0.6, cue: "Assis, dos calé, genoux à 90°, rouleau sur le bas des tibias", pose: { ...LEG_EXT_BASE, ...LR("knee", 90) } },
      { d: 1.5, hold: 4, cue: "Monter jusqu'à 60° de flexion et tenir 45 secondes, effort à 70 %, sans douleur", pose: { ...LEG_EXT_BASE, ...LR("knee", 60) } },
    ],
    sentir: "Les quadriceps qui tiennent, une tension stable au-dessus du genou.",
    eviter: "Tendre la jambe ou forcer au-delà du seuil de douleur.",
  },

  // Amplitude de la rééducation de Yoann (HSR) : de 60° à 10° de flexion, tempo 3 s montée, 3 s
  // descente. La machine standard va de 90° à 0-10° ; la zone 0-30° charge le plus la rotule.
  "Leg extension unilatérale": {
    view: "profilG", active: ["cuisseL", "genouL"], sides: true, side: "L",
    rest: LEG_SEAT, pin: { p: "pelvis", z: 0 },
    props: { boxes: LEG_EXT_BOXES, pads: [{ joint: "anL", at: [0, 0.04, 0.075], r: 0.05, len: 0.22 }] },
    frames: [
      { d: 1.5, hold: 0.4, cue: "Assis, dos calé, une jambe sous le rouleau, genou à 60° (amplitude de rééducation)", pose: { ...LEG_EXT_BASE, kneeL: 60, kneeR: 90 } },
      { d: 3, hold: 0.3, cue: "Tendre en 3 secondes jusqu'à 10° de flexion, sans verrouiller le genou", pose: { ...LEG_EXT_BASE, kneeL: 10, kneeR: 90 } },
      { d: 3, hold: 0.3, cue: "Redescendre en 3 secondes jusqu'à 60°", pose: { ...LEG_EXT_BASE, kneeL: 60, kneeR: 90 } },
    ],
    sentir: "Le quadriceps, avec une gêne au tendon de 3/10 au plus.",
    eviter: "Lancer la charge, ou sortir de l'amplitude 10-60°.",
  },

  // Assis (choix de Yoann) : hanche à ~90°, coussin sur les cuisses, genou de ~5-10° à ~90-110°
  // (Maeo 2021 : la position assise allonge davantage les ischio-jambiers).
  "Leg curl unilatéral": {
    view: "profilG", active: ["cuisseL"], sides: true, side: "L",
    rest: LEG_SEAT, pin: { p: "pelvis", z: 0 },
    props: { boxes: [[0, 0.25, 0.02, 0.45, 0.5, 0.5], [0, 0.87, -0.24, 0.45, 0.7, 0.08, -15], [0, 0.68, 0.33, 0.5, 0.07, 0.15]],
      pads: [{ joint: "anL", at: [0, 0.04, -0.075], r: 0.05, len: 0.22 }] },
    frames: [
      { d: 1.5, hold: 0.4, cue: "Assis, dos calé, coussin sur le bas des cuisses, jambe tendue sur le rouleau", pose: { ...LEG_CURL_BASE, kneeL: 8, kneeR: 8 } },
      { d: 1.4, hold: 0.5, cue: "Plier le genou jusqu'à ~100°, le talon passe sous l'assise", pose: { ...LEG_CURL_BASE, kneeL: 100, kneeR: 8 } },
      { d: 2.2, hold: 0.2, cue: "Revenir en freinant jusqu'à la jambe presque tendue", pose: { ...LEG_CURL_BASE, kneeL: 8, kneeR: 8 } },
    ],
    sentir: "L'arrière de la cuisse.",
    eviter: "Décoller les fesses de l'assise ou laisser la charge retomber.",
  },

  // Machine de hip thrust (choix de Yoann) : haut du dos sur le coussin (pointe des omoplates), pieds
  // à plat ; en haut, genou à ~90°, tibia vertical, buste parallèle au sol, hanche neutre (NSCA).
  "Hip thrust": (() => {
    const base = { neck: [20, 0, 0], footL: [0.17, 0.085, 0.88], footR: [-0.17, 0.085, 0.88], kneePoleL: [0.1, 1, 0.4], kneePoleR: [-0.1, 1, 0.4],
      handL: [0.3, 0.45, -0.05], handR: [-0.3, 0.45, -0.05], elbowL: [1, -0.5, 0], elbowR: [-1, -0.5, 0] };
    return {
      view: { az: 75, el: 12 }, active: ["bassin", "hancheL", "hancheR"],
      rest: { points: ["ribs"], y: 0.42 }, pin: { p: "ribs", z: 0 }, touch: ["toeL", "heelL", "toeR", "heelR"],
      props: { boxes: [[0, 0.21, -0.05, 0.5, 0.42, 0.3], [0, 0.01, 0.88, 0.6, 0.02, 0.4]], pads: [{ joint: "pelvis", at: [0, -0.02, 0.13], r: 0.05, len: 0.5 }] },
      frames: [
        { d: 1.2, hold: 0.4, cue: "Haut du dos sur le coussin, ceinture sur les hanches, pieds à plat, hanches basses", pose: { ...base, root: [-55, 0, 0], neck: [36, 0, 0] } },
        { d: 1.2, hold: 1, cue: "Pousser dans les talons jusqu'au buste parallèle au sol, tibias verticaux, fessiers serrés", pose: { ...base, root: [-90, 0, 0] } },
        { d: 2, hold: 0.2, cue: "Redescendre en contrôlant", pose: { ...base, root: [-55, 0, 0], neck: [36, 0, 0] } },
      ],
      sentir: "Les fessiers, surtout en haut.",
      eviter: "Cambrer pour monter plus haut : en haut, côtes basses et menton rentré.",
    };
  })(),

  // Presse à 45° : dossier incliné, pieds à largeur de hanches sur le plateau ; en bas, genou à ~90°
  // (ACE), en haut ~5-10° sans verrouiller. Glissière calculée pour une cheville naturelle.
  "Presse à cuisses": {
    view: { az: 80, el: 10 }, active: ["cuisseL", "cuisseR", "bassin"],
    rest: PRESS_SEAT, pin: { p: "pelvis", z: 0 }, props: PRESS_PROPS,
    frames: [
      { d: 1.2, hold: 0.4, cue: "Dos et bassin calés, pieds à largeur de hanches au milieu du plateau, jambes presque tendues", pose: pressPose(PRESS_FEET[10]) },
      { d: 2.2, hold: 0.3, cue: "Descendre jusqu'à environ 90° de genou, le bassin reste collé au siège", pose: pressPose(PRESS_FEET[90]) },
      { d: 1.4, hold: 0.4, cue: "Pousser sans verrouiller les genoux, genoux dans l'axe des pieds", pose: pressPose(PRESS_FEET[10]) },
    ],
    sentir: "Les quadriceps et les fessiers ; au genou, une gêne de 3/10 au plus.",
    eviter: "Décoller le bassin du siège en bas, ou verrouiller les genoux en haut.",
  },

  // Protocole HSR de Yoann : amplitude 10-60° de flexion, tempo 3 s / 3 s.
  "Presse à cuisses (HSR)": {
    view: { az: 80, el: 10 }, active: ["cuisseL", "cuisseR", "genouL", "genouR"],
    rest: PRESS_SEAT, pin: { p: "pelvis", z: 0 }, props: PRESS_PROPS,
    frames: [
      { d: 1.2, hold: 0.4, cue: "Dos calé, pieds au milieu du plateau, genoux à 10° de flexion", pose: pressPose(PRESS_FEET[10]) },
      { d: 3, hold: 0.3, cue: "Descendre en 3 secondes jusqu'à 60° de genou (amplitude de rééducation)", pose: pressPose(PRESS_FEET[60]) },
      { d: 3, hold: 0.3, cue: "Remonter en 3 secondes jusqu'à 10°, sans verrouiller", pose: pressPose(PRESS_FEET[10]) },
    ],
    sentir: "Les quadriceps, avec une gêne au tendon de 3/10 au plus.",
    eviter: "Accélérer ou sortir de l'amplitude 10-60°.",
  },

  // Jambes presque tendues ; cheville de ~15-20° de flexion dorsale à ~30-45° de flexion plantaire.
  "Mollets à la presse": {
    view: { az: 80, el: 10 }, active: ["jambeL", "jambeR", "chevilleL", "chevilleR"],
    rest: PRESS_SEAT, pin: { p: "pelvis", z: 0 },
    props: { boxes: PRESS_PROPS.boxes, follow: [{ at: "orteils", offset: [0, 0.18, -0.1], size: [0.7, 0.55, 0.04], rotX: -45 }] },
    frames: [
      { d: 1.2, hold: 0.5, cue: "Jambes presque tendues, l'avant des pieds au bas du plateau, talons dans le vide", pose: { ...CALF_PRESS, ...LR("ankle", 15) } },
      { d: 0.8, hold: 0.6, cue: "Pousser sur la pointe des pieds le plus loin possible", pose: { ...CALF_PRESS, ...LR("ankle", -35) } },
      { d: 2, hold: 0.4, cue: "Revenir en 2 secondes jusqu'à l'étirement, sans rebond", pose: { ...CALF_PRESS, ...LR("ankle", 15) } },
    ],
    sentir: "Les mollets, étirés puis contractés.",
    eviter: "Plier les genoux ou rebondir en bas.",
  },

  // ---------------------------------------------------------------- Échauffement basket
  // Repères : docs/demos-3d/technique-mobilite-gainage.md, § 17. Positions du bassin calculées pour
  // l'angle de genou visé, le centre du corps au-dessus des pieds.

  "Cardio léger (vélo ou trot)": {
    view: { az: 70, el: 8 }, active: ["cuisseL", "cuisseR", "jambeL", "jambeR"],
    frames: [
      { d: 0.35, hold: 0, cue: "Trotter tranquillement (ou pédaler) pendant 3 minutes, pour se réchauffer",
        pose: { root: [8, 0, 0], hipL: [45, 0, 0], kneeL: 75, ankleL: -15, hipR: [-12, 0, 0], kneeR: 15, shL: [-30, 8, 0], shR: [35, 8, 0], ...LR("el", 90) } },
      { d: 0.35, hold: 0, cue: "Allure facile : on peut parler en trottant",
        pose: { root: [8, 0, 0], hipR: [45, 0, 0], kneeR: 75, ankleR: -15, hipL: [-12, 0, 0], kneeL: 15, shR: [-30, 8, 0], shL: [35, 8, 0], ...LR("el", 90) } },
    ],
    sentir: "Le souffle qui s'accélère un peu, les jambes qui se réchauffent.",
    eviter: "Partir trop vite : c'est une mise en route, pas un sprint.",
  },

  "Mobilité dynamique": (() => {
    const base = { footL: [0.11, 0.085, 0.42], footR: [-0.11, 0.085, -0.38], kneePoleL: [0.05, 0, 1], kneePoleR: [-0.05, -0.2, 1], ...LR("sh", [0, 8, 0]), ...LR("el", 20) };
    return {
      view: "profilG", active: ["hancheL", "hancheR", "cuisseL", "cuisseR"], touch: ["toeL", "heelL"], sides: true, side: "L",
      frames: [
        { d: 1, hold: 0.3, cue: "Un grand pas en avant, buste droit", pose: { ...base, pos: [0, 0.868, 0.025], root: [0, 0, 0] } },
        { d: 1.6, hold: 0.4, cue: "Descendre en fente, genou avant au-dessus de la cheville, genou arrière vers le sol", pose: { ...base, pos: [0, 0.608, 0.02], root: [0, 0, 0] } },
        { d: 1.2, hold: 0.2, cue: "Remonter et changer de jambe en avançant ; finir par des balancements de jambe", pose: { ...base, pos: [0, 0.868, 0.025], root: [0, 0, 0] } },
      ],
      sentir: "L'avant de la hanche arrière qui s'étire, les fessiers qui travaillent.",
      eviter: "Laisser le genou avant rentrer vers l'intérieur ou se pencher en avant.",
    };
  })(),

  // Dos au mur, genoux à 60° au-dessus des chevilles, pieds à ~40-50 cm du mur (Rio 2015 pour
  // l'isométrie à 60°).
  "Primer iso genou (wall-sit @60°)": {
    view: "profilG", active: ["cuisseL", "cuisseR", "genouL", "genouR"], touch: ["toeL", "heelL", "toeR", "heelR"],
    props: { wall: { z: -0.12, side: "back" } },
    frames: [
      { d: 1.5, hold: 0.4, cue: "Dos contre le mur, pieds à 40-50 cm du mur, largeur des hanches",
        pose: { pos: [0, 0.87, 0.0], root: [0, 0, 0], footL: [0.11, 0.085, 0.372], footR: [-0.11, 0.085, 0.372], ...LR("sh", [0, 8, 0]), ...LR("el", 10) } },
      { d: 2, hold: 4, cue: "Glisser jusqu'à 60° de genou et tenir 40 secondes, sous le seuil de douleur",
        pose: { pos: [0, 0.76, 0.0], root: [0, 0, 0], footL: [0.11, 0.085, 0.372], footR: [-0.11, 0.085, 0.372], ...LR("sh", [0, 8, 0]), ...LR("el", 10) } },
    ],
    sentir: "Les quadriceps qui chauffent, une tension stable au genou.",
    eviter: "Descendre plus bas que 60°, décoller le dos du mur ou laisser les genoux dépasser les orteils.",
  },

  // Amplitude progressive : un premier squat à ~55°, puis vers 85° si c'est indolore (au-delà de
  // 60°, on sort de la plage de rééducation : profondeur selon la douleur).
  "Montée en charge : squats": (() => {
    const base = { footL: [0.17, 0.085, 0], footR: [-0.17, 0.085, 0], yawL: 15, yawR: 15, kneePoleL: [0.3, 0, 1], kneePoleR: [-0.3, 0, 1], ...LR("sh", [80, 10, 0]), ...LR("el", 10) };
    const up = { ...base, pos: [0, 0.97, 0.03], root: [5, 0, 0], ...LR("sh", [10, 10, 0]) };
    return {
      view: { az: 60, el: 8 }, active: ["cuisseL", "cuisseR", "bassin"], touch: ["toeL", "heelL", "toeR", "heelR"],
      frames: [
        { d: 1, hold: 0.3, cue: "Pieds largeur d'épaules, pointes un peu ouvertes", pose: up },
        { d: 2, hold: 0.2, cue: "Premier squat à mi-hauteur, bras devant pour l'équilibre", pose: { ...base, pos: [0, 0.865, -0.07], root: [30, 0, 0] } },
        { d: 1, hold: 0.3, cue: "Remonter en poussant dans les talons", pose: up },
        { d: 2, hold: 0.2, cue: "Puis plus bas si c'est indolore, talons au sol, genoux dans l'axe", pose: { ...base, pos: [0, 0.735, -0.07], root: [30, 0, 0] } },
        { d: 1, hold: 0.3, cue: "Remonter en 1 seconde", pose: up },
      ],
      cut: true,
      sentir: "Les cuisses et les fessiers ; au genou, une gêne de 3/10 au plus.",
      eviter: "Décoller les talons, arrondir le dos ou descendre plus bas que la douleur ne le permet.",
    };
  })(),

  // Impulsion bras et jambes, réception souple : genou fléchi à plus de 30° au contact, dans l'axe
  // des pieds.
  "Montée en charge : sauts": (() => {
    const F = (y) => ({ footL: [0.15, y, 0], footR: [-0.15, y, 0], kneePoleL: [0.2, 0, 1], kneePoleR: [-0.2, 0, 1] });
    return {
      view: { az: 60, el: 8 }, active: ["cuisseL", "cuisseR", "jambeL", "jambeR", "bassin"], jump: true,
      frames: [
        { d: 1, hold: 0.3, cue: "Debout, pieds largeur de hanches", pose: { ...F(0.085), pos: [0, 0.97, 0.0], root: [3, 0, 0], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
        { d: 0.6, hold: 0.1, cue: "Fléchir et lancer les bras en arrière", pose: { ...F(0.085), pos: [0, 0.823, -0.09], root: [35, 0, 0], ...LR("sh", [-40, 10, 0]), ...LR("el", 15) } },
        { d: 0.3, hold: 0.1, cue: "Sauter en poussant fort, bras vers le haut", pose: { ...F(0.29), pos: [0, 1.175, 0.0], root: [3, 0, 0], ...LR("sh", [165, 10, 0]), ...LR("el", 10) } },
        { d: 0.3, hold: 0.5, cue: "Se réceptionner en souplesse, genoux fléchis et dans l'axe des pieds", pose: { ...F(0.085), pos: [0, 0.905, -0.03], root: [20, 0, 0], ...LR("sh", [40, 10, 0]), ...LR("el", 30) } },
        { d: 0.8, hold: 0.3, cue: "Se redresser ; hauteur augmentée seulement si c'est indolore", pose: { ...F(0.085), pos: [0, 0.97, 0.0], root: [3, 0, 0], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
      ],
      cut: true,
      sentir: "Une impulsion franche et une réception silencieuse.",
      eviter: "Atterrir jambes tendues ou genoux qui rentrent vers l'intérieur.",
    };
  })(),

  // Accélération : buste penché, poussée vers l'arrière. Freinage : centre de gravité abaissé, pied
  // posé devant le bassin, genou dans l'axe, buste droit.
  "Spécifique basket : accél/décél": (() => {
    const arms = (a, b) => ({ shL: [a, 15, 0], shR: [b, 15, 0], ...LR("el", 75) });
    const athletic = { pos: [0, 0.91, -0.05], root: [25, 0, 0], footL: [0.2, 0.085, 0], footR: [-0.2, 0.085, 0], yawL: 10, yawR: 10, kneePoleL: [0.25, 0, 1], kneePoleR: [-0.25, 0, 1], ...LR("sh", [25, 20, 0]), ...LR("el", 70) };
    const accel = { pos: [0, 0.75, 0.03], root: [35, 0, 0], footL: [0.12, 0.085, 0.3], footR: [-0.12, 0.085, -0.55], yawL: 0, yawR: 0, kneePoleL: [0.05, 0, 1], kneePoleR: [-0.05, 0, 1], ...arms(-30, 60) };
    const brake = { pos: [0, 0.73, 0.0], root: [0, 0, 0], footL: [0.17, 0.085, 0.38], footR: [-0.2, 0.085, -0.25], yawL: 0, yawR: 30, kneePoleL: [0.1, 0, 1], kneePoleR: [-0.3, 0, 1], ...arms(20, 20) };
    return {
      view: { az: 70, el: 8 }, active: ["cuisseL", "cuisseR", "bassin"], touch: ["toeL", "heelL", "toeR", "heelR"],
      frames: [
        { d: 1, hold: 0.4, cue: "Position athlétique : genoux fléchis, poids sur l'avant des pieds", pose: athletic },
        { d: 0.5, hold: 0.3, cue: "Accélérer : buste penché en avant, pousser fort vers l'arrière", pose: accel },
        { d: 0.6, hold: 0.5, cue: "Freiner : pied planté devant le bassin, hanches basses, buste droit, genou dans l'axe", pose: brake },
        { d: 0.8, hold: 0.3, cue: "Revenir en position athlétique, intensité qui monte à chaque passage", pose: athletic },
      ],
      cut: true,
      sentir: "Les cuisses et les fessiers qui encaissent le freinage.",
      eviter: "Freiner jambe tendue, genou qui rentre vers l'intérieur au changement de direction.",
    };
  })(),

  "Spécifique basket : tirs en mouvement": (() => {
    const F = (y) => ({ footL: [0.15, y, 0], footR: [-0.15, y, 0], kneePoleL: [0.2, 0, 1], kneePoleR: [-0.2, 0, 1] });
    const elbows = { elbowL: [0.6, -1, -0.2], elbowR: [-0.3, -1, 0.1] };
    const catchPose = { ...F(0.085), pos: [0, 0.908, -0.01], root: [15, 0, 0], ...elbows, handL: [0.12, 1.15, 0.3], handR: [-0.12, 1.15, 0.3] };
    return {
      view: { az: 50, el: 8 }, active: ["epauleR", "brasR", "avantBrasR", "cuisseL", "cuisseR"], jump: true,
      props: { ball: { at: "mains", offset: [0, 0.04, 0.06] } },
      frames: [
        { d: 0.8, hold: 0.3, cue: "Recevoir la balle à hauteur de poitrine, genoux fléchis", pose: catchPose },
        { d: 0.4, hold: 0, cue: "Fléchir les jambes pour prendre l'impulsion", pose: { ...F(0.085), pos: [0, 0.855, -0.04], root: [22, 0, 0], ...elbows, handL: [0.12, 1.08, 0.3], handR: [-0.12, 1.08, 0.3] } },
        { d: 0.35, hold: 0, cue: "Monter la balle au-dessus du front en sautant, coude du bras de tir sous la balle",
          pose: { ...F(0.24), pos: [0, 1.12, 0.0], root: [3, 0, 0], elbowL: [0.6, -1, -0.2], elbowR: [-0.1, -1, 0.3], handL: [0.04, 1.98, 0.17], handR: [-0.1, 1.95, 0.2] } },
        { d: 0.25, hold: 0.4, cue: "Tendre le bras de tir vers le panier au sommet du saut, poignet cassé",
          pose: { ...F(0.24), pos: [0, 1.12, 0.0], root: [3, 0, 0], elbowL: [0.6, -1, -0.2], elbowR: [-0.1, -1, 0.3], handL: [0.0, 2.08, 0.22], handR: [-0.13, 2.12, 0.26] } },
        { d: 0.35, hold: 0.3, cue: "Se réceptionner en souplesse au même endroit, genoux fléchis", pose: catchPose },
      ],
      cut: true,
      sentir: "Une seule poussée continue des jambes jusqu'au bout des doigts.",
      eviter: "Tirer avec les bras seuls ou se réceptionner jambes tendues.",
    };
  })(),
};

// Une position de retour écrite `pose: null` reprend la première position.
for (const d of Object.values(DEMOS)) for (const fr of d.frames) if (!fr.pose) fr.pose = d.frames[0].pose;

// Variantes du même geste sur un autre équipement : même démonstration. Les développés en machine
// reprennent ceux aux haltères, avec des poignées à la place des haltères.
const withHandles = (d) => ({ ...d, props: { ...d.props, dumbbells: false, handles: true } });
const SAME = {
  "Tirage vertical prise neutre (poulie)": DEMOS["Tirage vertical prise neutre"],
  "Rowing barre ou machine": DEMOS["Rowing poulie basse"],
  "Iso leg extension @60° (poulie)": DEMOS["Iso leg extension @60° (si genou raide)"],
  "Iso leg extension @60° (disque)": DEMOS["Iso leg extension @60° (si genou raide)"],
  "Leg extension unilatérale (poulie)": DEMOS["Leg extension unilatérale"],
  "Leg extension unilatérale (disque)": DEMOS["Leg extension unilatérale"],
  "Leg curl unilatéral (poulie)": DEMOS["Leg curl unilatéral"],
  "Leg curl unilatéral (disque)": DEMOS["Leg curl unilatéral"],
  "Presse à cuisses (poulie)": DEMOS["Presse à cuisses"],
  "Presse à cuisses (disque)": DEMOS["Presse à cuisses"],
  "Mollets à la presse (poulie)": DEMOS["Mollets à la presse"],
  "Mollets à la presse (disque)": DEMOS["Mollets à la presse"],
  "Développé couché (poulie)": withHandles(DEMOS["Développé couché haltères"]),
  "Développé couché (disque)": withHandles(DEMOS["Développé couché haltères"]),
  "Développé incliné (poulie)": withHandles(DEMOS["Développé incliné haltères"]),
  "Développé incliné (disque)": withHandles(DEMOS["Développé incliné haltères"]),
  "Développé militaire (poulie)": withHandles(DEMOS["Développé militaire haltères"]),
  "Développé militaire (disque)": withHandles(DEMOS["Développé militaire haltères"]),
};
Object.assign(DEMOS, SAME);

export const hasDemo = (nom) => !!DEMOS[nom];
