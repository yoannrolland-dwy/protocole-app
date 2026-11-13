// Démonstrations 3D des exercices (13/11/2026, étape 1 : la séance Mobilité).
// Une entrée par NOM d'exercice (le même nom que dans les gabarits). Poses en angles anatomiques,
// décrites dans rig.js. Textes écrits pour PROTOCOLE.
//
// Champs d'une démonstration :
// - `frames` : positions clés (timeline.js) ;
// - `active` : parties du mannequin dessinées en jaune (la zone qui travaille) ;
// - `view` : caméra de départ (face, profilG, profilD, dos, dessus, ou { az, el } en degrés) ;
// - `pin` : appui qui ne glisse pas ; `touch` : points qui doivent toucher le sol (tests) ;
// - `sides` : exercice d'un seul côté, on peut voir l'autre ; `side` : le côté qui travaille ici ;
// - `props` : accessoires (tapis, mur, montant, caisson, câble) ;
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

// Debout, pieds posés : bassin placé à la main, jambes guidées par les pieds.
const stand = (y, z, pitch, extra = {}) => ({
  pos: [0, y, z], root: [pitch, 0, 0], footL: [0.11, 0.085, 0], footR: [-0.11, 0.085, 0], ...extra,
});

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
        pose: { root: [0, 0, 0], hipR: [-12, 0, 0], kneeR: 78, ankleR: -90, footL: [0.095, 0.085, 0.56], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
      { d: 2.6, hold: 1.6, cue: "Pousser le bassin vers l'avant, fessier arrière serré, sans cambrer",
        pose: { root: [-4, 0, 0], hipR: [-36, 0, 0], kneeR: 58, ankleR: -90, footL: [0.095, 0.085, 0.56], ...LR("sh", [0, 8, 0]), ...LR("el", 15) } },
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
      { d: 1.6, hold: 0.3, cue: "Sur le dos, genoux pliés, pieds plus larges que le bassin",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...FEET_FLOOR, kneePoleL: [0, 1, 0.2], kneePoleR: [0, 1, 0.2] } },
      { d: 2, hold: 0.8, cue: "Laisser tomber les deux genoux d'un côté, épaules lourdes",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...FEET_FLOOR, kneePoleL: [1, 0.45, 0.2], kneePoleR: [1, 0.45, 0.2] } },
      { d: 2, hold: 0.3, cue: "Revenir au centre", pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...FEET_FLOOR, kneePoleL: [0, 1, 0.2], kneePoleR: [0, 1, 0.2] } },
      { d: 2, hold: 0.8, cue: "Puis de l'autre côté, sans décoller les épaules",
        pose: { root: [-90, 0, 0], ...ARMS_FLOOR, ...FEET_FLOOR, kneePoleL: [-1, 0.45, 0.2], kneePoleR: [-1, 0.45, 0.2] } },
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
      { d: 2.4, hold: 0.6, cue: "Dos, tête et bras contre le mur, coudes pliés, mains à hauteur des épaules",
        pose: stand(0.975, 0, 0, { handL: [0.47, 1.5, -0.07], handR: [-0.47, 1.5, -0.07], elbowL: [0.6, -1, -0.05], elbowR: [-0.6, -1, -0.05] }) },
      { d: 2.8, hold: 0.8, cue: "Glisser les bras vers le haut sans décoller les coudes ni le bas du dos",
        pose: stand(0.975, 0, 0, { handL: [0.3, 1.98, -0.07], handR: [-0.3, 1.98, -0.07], elbowL: [0.9, -0.6, -0.05], elbowR: [-0.9, -0.6, -0.05] }) },
    ],
    sentir: "Le travail entre les omoplates et l'ouverture à l'avant des épaules.",
    eviter: "Décoller le bas du dos ou les coudes du mur pour monter plus haut.",
  },

  "Rotation externe épaule poulie basse": {
    view: "face", active: ["epauleL", "avantBrasL"], touch: ["toeL", "heelL", "toeR", "heelR"], sides: true, side: "L",
    props: { cable: { from: [-0.7, 0.3, 0.12], to: "haL" }, boxes: [[-0.76, 1, 0.12, 0.1, 2, 0.1]] },
    frames: [
      { d: 2, hold: 0.4, cue: "Coude collé au corps, plié à 90°, l'avant-bras part du ventre",
        pose: stand(0.975, 0, 0, { shL: [0, 4, -55], elL: 90, shR: [0, 6, 0], elR: 8 }) },
      { d: 2, hold: 0.8, cue: "Ouvrir l'avant-bras vers l'extérieur, le coude ne quitte pas le flanc, puis freiner le retour",
        pose: stand(0.975, 0, 0, { shL: [0, 4, 40], elL: 90, shR: [0, 6, 0], elR: 8 }) },
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
};

export const hasDemo = (nom) => !!DEMOS[nom];
