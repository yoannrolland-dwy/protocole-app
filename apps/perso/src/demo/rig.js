// Mannequin des démonstrations 3D (13/11/2026) : squelette et poses, sans aucun dessin.
// Écrit pour PROTOCOLE ; seul le calcul de three.js sert ici (Object3D, vecteurs), donc ce fichier
// tourne aussi sous Node : les tests vérifient les appuis au sol de chaque pose sans écran.
//
// Repère : Y vers le haut, le mannequin regarde vers +Z, son côté gauche est en +X. Mètres.
// Une pose est écrite en angles ANATOMIQUES, en degrés (voir `applyPose`) : c'est ce qui rend les
// exercices lisibles et faciles à corriger.
import { Object3D, Vector3, Quaternion, Euler, MathUtils } from "three";

const SH = 0.185; // demi-largeur d'épaules
const HP = 0.095; // demi-largeur de hanches
export const UPPER_ARM = 0.29, FOREARM = 0.30, THIGH = 0.43, SHIN = 0.42;

// [nom, parent, décalage depuis le parent en position debout, rayon du volume]
export const JOINTS = [
  ["pelvis", null, [0, 0, 0], 0.105],
  ["spine", "pelvis", [0, 0.11, 0], 0.1],
  ["chest", "spine", [0, 0.17, 0], 0.11],
  ["ribs", "chest", [0, 0.13, 0], 0.115],
  ["neck", "chest", [0, 0.27, 0], 0.05],
  ["head", "neck", [0, 0.1, 0], 0.1],
  ["shL", "chest", [SH, 0.21, 0], 0.055], ["elL", "shL", [0, -UPPER_ARM, 0], 0.042], ["haL", "elL", [0, -FOREARM, 0], 0.042],
  ["shR", "chest", [-SH, 0.21, 0], 0.055], ["elR", "shR", [0, -UPPER_ARM, 0], 0.042], ["haR", "elR", [0, -FOREARM, 0], 0.042],
  ["hipL", "pelvis", [HP, -0.04, 0], 0.075], ["knL", "hipL", [0, -THIGH, 0], 0.055], ["anL", "knL", [0, -SHIN, 0], 0.045],
  ["toeL", "anL", [0, -0.05, 0.17], 0.035], ["heelL", "anL", [0, -0.05, -0.06], 0.035],
  ["hipR", "pelvis", [-HP, -0.04, 0], 0.075], ["knR", "hipR", [0, -THIGH, 0], 0.055], ["anR", "knR", [0, -SHIN, 0], 0.045],
  ["toeR", "anR", [0, -0.05, 0.17], 0.035], ["heelR", "anR", [0, -0.05, -0.06], 0.035],
];
export const RADIUS = Object.fromEntries(JOINTS.map(([n, , , r]) => [n, r]));

// Parties du corps que scene.js dessine et qu'une démonstration peut mettre en jaune (`active`).
export const PARTS = ["bassin", "torse", "tete", ...["L", "R"].flatMap((s) =>
  ["epaule", "bras", "avantBras", "hanche", "cuisse", "genou", "jambe", "cheville", "pied"].map((p) => p + s))];

// Points d'un membre, écartés du calcul d'appui quand ce membre est guidé par une cible.
const LIMB_POINTS = {
  handL: ["elL", "haL"], handR: ["elR", "haR"],
  footL: ["knL", "anL", "toeL", "heelL"], footR: ["knR", "anR", "toeR", "heelR"],
};

export function createRig() {
  const j = {};
  for (const [name, parent, off] of JOINTS) {
    const o = new Object3D();
    o.name = name;
    o.position.set(off[0], off[1], off[2]);
    if (parent) j[parent].add(o);
    j[name] = o;
  }
  const root = new Object3D();
  root.add(j.pelvis);
  return { root, j };
}

const rad = MathUtils.degToRad;
const DOWN = new Vector3(0, -1, 0);
const _v = new Vector3(), _a = new Vector3(), _b = new Vector3(), _q = new Quaternion(), _q2 = new Quaternion();

export const worldPos = (rig, name, out = new Vector3()) => rig.j[name].getWorldPosition(out);

/** Oriente l'articulation pour que son segment (axe −Y) pointe dans la direction donnée (monde). */
function aim(joint, worldDir) {
  joint.parent.getWorldQuaternion(_q).invert();
  const local = worldDir.clone().normalize().applyQuaternion(_q);
  joint.quaternion.setFromUnitVectors(DOWN, local);
}

/** Membre à deux segments vers une cible : la première articulation vise le coude (ou le genou),
 *  la seconde vise la cible. `pole` : direction vers laquelle le coude ou le genou plie. */
function solveTwoBone(rig, a, b, end, target, pole) {
  const A = rig.j[a], B = rig.j[b];
  const la = Math.abs(B.position.y), lb = Math.abs(rig.j[end].position.y);
  A.quaternion.identity(); B.quaternion.identity();
  rig.root.updateMatrixWorld(true);
  const S = A.getWorldPosition(new Vector3());
  const dir = _v.copy(target).sub(S);
  const full = dir.length();
  const d = MathUtils.clamp(full, Math.abs(la - lb) + 1e-4, la + lb - 1e-4);
  dir.normalize();
  const cosA = MathUtils.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1);
  const perp = _a.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dir, -dir.z);
  perp.normalize();
  const E = _b.copy(S).addScaledVector(dir, la * cosA).addScaledVector(perp, la * Math.sqrt(1 - cosA * cosA));
  aim(A, E.clone().sub(S));
  rig.root.updateMatrixWorld(true);
  const T = S.clone().addScaledVector(dir, d);
  aim(B, T.sub(B.getWorldPosition(new Vector3())));
  return full - (la + lb); // > 0 : cible hors de portée, de cette distance
}

/** Pied à plat : la semelle parallèle au sol, la pointe dans la direction `yaw` (degrés, 0 = +Z).
 *  `pitch` (degrés, autour de l'axe gauche-droite) incline la semelle, par exemple sur le plateau
 *  d'une presse. */
function flatFoot(rig, ankle, yaw = 0, pitch = 0) {
  const A = rig.j[ankle];
  A.parent.getWorldQuaternion(_q).invert();
  _q2.setFromEuler(new Euler(rad(pitch), rad(yaw), 0, "YXZ"));
  A.quaternion.copy(_q).multiply(_q2);
}

const set = (o, x, y, z, order) => o.rotation.set(rad(x), rad(y), rad(z), order);
const v3 = (p) => new Vector3(p[0], p[1], p[2]);

/**
 * Applique une pose. Clés (toutes facultatives, 0 par défaut) :
 * - `root: [bascule avant, lacet, roulis]` : 0 debout, 90 à plat ventre (tête vers +Z), −90 sur le dos ;
 * - `pos: [x, y, z]` : bassin posé à cet endroit (sinon le corps est posé au sol tout seul) ;
 * - `spine`, `chest`, `neck : [flexion avant, rotation, inclinaison]` ;
 * - `hipL/hipR : [flexion, abduction, rotation externe]`, `kneeL/kneeR` : flexion,
 *   `ankleL/ankleR` : flexion dorsale (négatif = pointe tendue) ;
 * - `shL/shR : [flexion, abduction, rotation externe]`, `elL/elR` : flexion ;
 * - cibles : `handL/handR: [x, y, z]` (centre de la main), `footL/footR: [x, y, z]` (cheville, pied
 *   mis à plat), avec `elbowL/R` et `kneePoleL/R` : direction où plie le coude ou le genou ;
 * - `flatL/flatR: 1` : pied à plat sans cible ; `yawL/yawR` : ouverture du pied ; `sole` : inclinaison
 *   des semelles d'un pied guidé (plateau de presse) ;
 * - `handFrame: "chest" | "pelvis"` : les cibles des mains sont données dans le repère de ce point
 *   du corps (barre posée sur le dos ou sur les hanches : elle suit le corps qui bouge) ;
 * - `gripL/gripR: [x, y, z]` : sens de la poignée d'un haltère (dessin seul, voir scene.js).
 * `opts.pin = { p, z, x? }` : ce point est ramené à cette profondeur (les appuis ne glissent pas).
 * `opts.rest = { points, y }` : ces points-là sont posés à cette hauteur (banc, cale) au lieu du
 * point le plus bas du corps posé au sol.
 * Rend `{ reach }` : distance manquante de chaque cible hors de portée.
 */
export function applyPose(rig, pose, opts = {}) {
  const { j, root } = rig;
  const g = (k) => pose[k] ?? [0, 0, 0];
  const n = (k) => pose[k] ?? 0;
  root.position.set(0, 0, 0);
  const r = g("root");
  set(j.pelvis, r[0], r[1], r[2], "YXZ");
  for (const k of ["spine", "chest", "neck"]) { const a = g(k); set(j[k], a[0], a[1], a[2], "YXZ"); }
  for (const [side, s] of [["L", 1], ["R", -1]]) {
    const h = g("hip" + side), sh = g("sh" + side);
    set(j["hip" + side], -h[0], s * h[2], s * h[1], "XZY");
    set(j["kn" + side], n("knee" + side), 0, 0, "XYZ");
    set(j["an" + side], -n("ankle" + side), s * n("yaw" + side), 0, "YXZ");
    set(j["sh" + side], -sh[0], s * sh[2], s * sh[1], "XZY");
    set(j["el" + side], -n("el" + side), 0, 0, "XYZ");
  }
  root.updateMatrixWorld(true);
  for (const [side, s] of [["L", 1], ["R", -1]]) if (pose["flat" + side]) flatFoot(rig, "an" + side, s * n("yaw" + side));
  root.updateMatrixWorld(true);

  // Pose au sol : le point le plus bas touche le sol, sans les membres guidés par une cible.
  const guided = new Set(Object.keys(LIMB_POINTS).filter((k) => pose[k]).flatMap((k) => LIMB_POINTS[k]));
  if (pose.pos) root.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  else {
    let low = Infinity;
    const rest = opts.rest;
    for (const [name, , , rr] of JOINTS) {
      if (rest ? !rest.points.includes(name) : guided.has(name)) continue;
      low = Math.min(low, worldPos(rig, name, _v).y - rr);
    }
    root.position.y = (rest ? rest.y : 0) - low;
    if (opts.pin) {
      root.updateMatrixWorld(true);
      const p = worldPos(rig, opts.pin.p, _v);
      root.position.z += (opts.pin.z ?? 0) - p.z;
      if (opts.pin.x != null) root.position.x += opts.pin.x - p.x;
    }
  }
  root.updateMatrixWorld(true);

  const reach = {};
  for (const [side, s] of [["L", 1], ["R", -1]]) {
    if (pose["hand" + side]) {
      const pole = pose["elbow" + side] ? v3(pose["elbow" + side]) : new Vector3(s * 0.4, -0.6, -1);
      const target = v3(pose["hand" + side]);
      if (pose.handFrame) j[pose.handFrame].localToWorld(target);
      reach["hand" + side] = solveTwoBone(rig, "sh" + side, "el" + side, "ha" + side, target, pole);
    }
    if (pose["foot" + side]) {
      const pole = pose["kneePole" + side] ? v3(pose["kneePole" + side]) : new Vector3(s * 0.08, 0, 1);
      reach["foot" + side] = solveTwoBone(rig, "hip" + side, "kn" + side, "an" + side, v3(pose["foot" + side]), pole);
      root.updateMatrixWorld(true);
      flatFoot(rig, "an" + side, s * n("yaw" + side), n("sole"));
    }
    root.updateMatrixWorld(true);
  }
  return { reach };
}

// Matériel, en mètres : barre olympique (2,2 m, disques de 45 cm), haltère, sécurités du rack.
export const BAR = { half: 1.1, r: 0.014, plate: 0.225, plateAt: 0.85, plateW: 0.05 };
export const DB = { handle: 0.075, r: 0.016, plate: 0.075, plateW: 0.05 };
export const SAFETY_R = 0.025;

/** Barre tenue à deux mains : elle passe par le centre des deux mains (positions de `snapshot`). */
export function barLine(snap) {
  const a = new Vector3(...snap.haL), b = new Vector3(...snap.haR);
  return { center: a.clone().add(b).multiplyScalar(0.5), axis: a.sub(b).normalize() };
}

/** Positions de tous les points du corps, pour les tests et pour cadrer la caméra. */
export function snapshot(rig) {
  const out = {};
  for (const [name] of JOINTS) { const p = worldPos(rig, name); out[name] = [p.x, p.y, p.z]; }
  return out;
}
