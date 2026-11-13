// Déroulé d'une démonstration (13/11/2026) : des positions clés, et le passage de l'une à l'autre.
// Fichier pur (aucun dessin) : testé sous Node.

const ease = (k) => k * k * (3 - 2 * k);
const isNum = (v) => typeof v === "number";

/** Mélange deux poses. Une clé absente d'un côté vaut 0 (angles), sauf les cibles et les
 *  directions, reprises telles quelles de l'autre pose. */
const TARGET_KEY = /^(pos|hand[LR]|foot[LR]|elbow[LR]|kneePole[LR]|grip[LR]|handFrame)$/;
export function lerpPose(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key], vb = b[key];
    if (va == null && vb == null) continue;
    if (typeof (va ?? vb) === "string") { out[key] = k < 0.5 ? (va ?? vb) : (vb ?? va); continue; }
    if (va == null || vb == null) {
      const v = va ?? vb;
      if (TARGET_KEY.test(key) || /^flat/.test(key)) out[key] = v;
      else out[key] = isNum(v) ? v * (va == null ? k : 1 - k) : v.map((x) => x * (va == null ? k : 1 - k));
    } else if (isNum(va)) out[key] = va + (vb - va) * k;
    else out[key] = va.map((x, i) => x + (vb[i] - x) * k);
  }
  return out;
}

/**
 * `frames` : [{ pose, d, hold, cue }] — `d` secondes pour ARRIVER à cette position, `hold`
 * secondes passées dessus, `cue` la consigne dite pendant le trajet et la tenue.
 * Le déroulé boucle : après la dernière position on revient à la première (en `frames[0].d`),
 * sauf `cut` (la dernière position est la même que la première, on repart sans transition).
 */
export function buildTimeline(frames, { cut = false } = {}) {
  const segs = [];
  let t = 0;
  frames.forEach((f, i) => {
    if (f.hold > 0) { segs.push({ t0: t, t1: t + f.hold, a: f.pose, b: f.pose, cue: f.cue, frame: i }); t += f.hold; }
    const last = i === frames.length - 1;
    if (last && cut) return;
    const nx = frames[last ? 0 : i + 1];
    segs.push({ t0: t, t1: t + nx.d, a: f.pose, b: nx.pose, cue: nx.cue, frame: last ? 0 : i + 1 });
    t += nx.d;
  });
  return { segs, total: t };
}

/** Pose et consigne à l'instant `t` (secondes, ramené dans la boucle). */
export function poseAt(tl, t) {
  const tt = ((t % tl.total) + tl.total) % tl.total;
  const s = tl.segs.find((x) => tt < x.t1) || tl.segs[tl.segs.length - 1];
  const k = s.t1 > s.t0 ? ease((tt - s.t0) / (s.t1 - s.t0)) : 0;
  return { pose: s.a === s.b ? s.a : lerpPose(s.a, s.b, k), cue: s.cue, frame: s.frame };
}

const swapSide = (key) => key.replace(/([LR])$/, (m) => (m === "L" ? "R" : "L"));
const FLIP_X = /^(pos|hand[LR]|foot[LR]|elbow[LR]|kneePole[LR]|grip[LR])$/;

/** Même pose de l'autre côté du corps. */
export function mirrorPose(p) {
  const out = {};
  for (const [key, v] of Object.entries(p)) {
    if (v == null) continue;
    const k = swapSide(key);
    if (key === "root" || key === "spine" || key === "chest" || key === "neck") out[k] = [v[0], -v[1], -v[2]];
    else if (FLIP_X.test(key)) out[k] = [-v[0], v[1], v[2]];
    else out[k] = v;
  }
  return out;
}

/** Démonstration vue de l'autre côté : poses, appui fixe, zones en jaune et accessoires. */
export function mirrorDemo(d) {
  const flipX = (b) => [-b[0], ...b.slice(1)];
  const props = d.props && {
    ...d.props,
    boxes: d.props.boxes?.map(flipX),
    pole: d.props.pole && flipX(d.props.pole),
    cable: d.props.cable && { from: flipX(d.props.cable.from), to: swapSide(d.props.cable.to) },
  };
  return {
    ...d, props,
    frames: d.frames.map((f) => ({ ...f, pose: mirrorPose(f.pose) })),
    pin: d.pin && { ...d.pin, p: swapSide(d.pin.p), x: d.pin.x != null ? -d.pin.x : undefined },
    rest: d.rest && { ...d.rest, points: d.rest.points.map(swapSide) },
    active: d.active.map(swapSide),
    touch: d.touch?.map(swapSide),
  };
}
