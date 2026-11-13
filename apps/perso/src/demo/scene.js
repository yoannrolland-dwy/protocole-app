// Dessin des démonstrations 3D (13/11/2026) : le mannequin, ses accessoires, la caméra.
// Chargé seulement à l'ouverture d'une démonstration (import dynamique depuis DemoViewer.jsx),
// pour que three.js ne pèse pas sur le démarrage de l'app. Couleurs : celles du design system.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, HemisphereLight, DirectionalLight, Mesh, Group,
  MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry, BoxGeometry, GridHelper,
  Vector3, Quaternion, BufferGeometry, Line, LineBasicMaterial, MathUtils,
} from "three";
import { createRig, applyPose, snapshot, RADIUS, BAR, DB, SAFETY_R, barLine } from "./rig.js";
import { buildTimeline, poseAt } from "./timeline.js";
import { COLORS } from "../design/tokens.js";

const BODY = "#c9c9c0", JOINT = "#8d8d85";
const UP = new Vector3(0, 1, 0);

export const VIEWS = {
  face: { az: 0, el: 10 }, profilG: { az: 90, el: 10 }, profilD: { az: -90, el: 10 },
  dos: { az: 180, el: 10 }, dessus: { az: 90, el: 82 },
};

function buildBody(rig, mats) {
  const meshes = [];
  const add = (joint, mesh, part, ball) => {
    mesh.userData = { part, ball };
    rig.j[joint].add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  // Segment entre deux points du repère d'une articulation.
  const seg = (joint, a, b, ra, rb, part, sx = 1, sz = 1) => {
    const A = new Vector3(...a), B = new Vector3(...b), dir = B.clone().sub(A);
    const m = new Mesh(new CylinderGeometry(rb, ra, dir.length(), 20, 1), mats.body);
    m.position.copy(A).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    m.scale.set(sx, 1, sz);
    return add(joint, m, part, false);
  };
  const ball = (joint, r, part, at = [0, 0, 0], s = [1, 1, 1], isJoint = true) => {
    const m = new Mesh(new SphereGeometry(r, 20, 14), mats.body);
    m.position.set(...at);
    m.scale.set(...s);
    return add(joint, m, part, isJoint);
  };

  // Tronc
  ball("pelvis", 0.105, "bassin", [0, -0.01, 0], [1.3, 0.85, 0.9], false);
  seg("pelvis", [0, 0, 0], [0, 0.11, 0], 0.1, 0.098, "torse", 1.25, 0.85);
  ball("spine", 0.098, "torse", [0, 0, 0], [1.25, 0.9, 0.85], false);
  seg("spine", [0, 0, 0], [0, 0.17, 0], 0.098, 0.108, "torse", 1.3, 0.85);
  ball("chest", 0.108, "torse", [0, 0, 0], [1.3, 0.9, 0.85], false);
  seg("chest", [0, 0, 0], [0, 0.2, 0], 0.108, 0.1, "torse", 1.45, 0.85);
  seg("chest", [-0.185, 0.21, 0], [0.185, 0.21, 0], 0.052, 0.052, "torse");
  seg("chest", [0, 0.2, 0], [0, 0.27, 0], 0.046, 0.044, "tete");
  seg("neck", [0, 0, 0], [0, 0.06, 0], 0.044, 0.044, "tete");
  ball("head", 0.1, "tete", [0, 0, 0], [0.92, 1.08, 1], false);
  ball("head", 0.02, "nez", [0, -0.012, 0.098], [1, 1, 1], true); // repère : où regarde le mannequin

  for (const s of ["L", "R"]) {
    ball("sh" + s, 0.055, "epaule" + s);
    seg("sh" + s, [0, 0, 0], [0, -0.29, 0], 0.046, 0.04, "bras" + s);
    ball("el" + s, 0.042, "avantBras" + s);
    seg("el" + s, [0, 0, 0], [0, -0.27, 0], 0.038, 0.031, "avantBras" + s);
    ball("ha" + s, 0.042, "avantBras" + s, [0, 0, 0], [0.8, 1.15, 1], false);
    ball("hip" + s, 0.075, "hanche" + s);
    seg("hip" + s, [0, 0, 0], [0, -0.43, 0], 0.07, 0.054, "cuisse" + s);
    ball("kn" + s, 0.055, "genou" + s);
    seg("kn" + s, [0, 0, 0], [0, -0.42, 0], 0.05, 0.04, "jambe" + s);
    ball("an" + s, 0.045, "cheville" + s);
    seg("an" + s, [0, -0.05, -0.06], [0, -0.05, 0.17], 0.035, 0.035, "pied" + s);
    ball("an" + s, 0.035, "pied" + s, [0, -0.05, -0.06], [1, 1, 1], false);
    ball("an" + s, 0.035, "pied" + s, [0, -0.05, 0.17], [1, 1, 1], false);
  }
  return meshes;
}

/** Boîte englobante de toutes les positions clés : sert à cadrer la caméra et à poser le tapis. */
function bounds(rig, demo) {
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const f of demo.frames) {
    applyPose(rig, f.pose, { pin: demo.pin, rest: demo.rest });
    const snap = snapshot(rig);
    for (const [n, p] of Object.entries(snap)) {
      const r = RADIUS[n];
      lo.min(new Vector3(p[0] - r, p[1] - r, p[2] - r));
      hi.max(new Vector3(p[0] + r, p[1] + r, p[2] + r));
    }
    if (demo.props?.barbell) {
      const { center, axis } = barLine(snap);
      for (const k of [-1, 1]) {
        const end = center.clone().addScaledVector(axis, k * BAR.half);
        lo.min(end.clone().subScalar(BAR.plate)); hi.max(end.clone().addScalar(BAR.plate));
      }
    }
  }
  // Les accessoires posés à côté du corps (colonne de poulie, montant) restent dans le cadre.
  for (const bx of demo.props?.boxes || []) { lo.min(new Vector3(bx[0] - bx[3] / 2, 0, bx[2] - bx[5] / 2)); hi.max(new Vector3(bx[0] + bx[3] / 2, Math.min(bx[1] + bx[4] / 2, hi.y), bx[2] + bx[5] / 2)); }
  if (demo.props?.pole) { lo.min(new Vector3(demo.props.pole[0], 0, demo.props.pole[1])); hi.max(new Vector3(demo.props.pole[0], 0, demo.props.pole[1] + 0.03)); }
  lo.y = 0;
  return { center: lo.clone().add(hi).multiplyScalar(0.5), size: hi.clone().sub(lo), lo, hi };
}

export function createDemoScene(canvas, { onTick } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  scene.background = new Color(COLORS.bg);
  const camera = new PerspectiveCamera(32, 1, 0.1, 40);
  scene.add(new HemisphereLight("#ffffff", "#3a3a35", 1.5));
  const sun = new DirectionalLight("#ffffff", 1.6);
  sun.position.set(2.5, 5, 3);
  scene.add(sun);
  const grid = new GridHelper(8, 32, COLORS.line, COLORS.lineSoft);
  scene.add(grid);

  const mats = {
    body: new MeshStandardMaterial({ color: BODY, roughness: 0.75, metalness: 0 }),
    joint: new MeshStandardMaterial({ color: JOINT, roughness: 0.8, metalness: 0 }),
    active: new MeshStandardMaterial({ color: COLORS.accent, roughness: 0.6, metalness: 0, emissive: COLORS.accent, emissiveIntensity: 0.12 }),
    prop: new MeshStandardMaterial({ color: COLORS.raised, roughness: 0.95, metalness: 0 }),
    mat: new MeshStandardMaterial({ color: COLORS.card, roughness: 1, metalness: 0 }),
    metal: new MeshStandardMaterial({ color: COLORS.muted, roughness: 0.5, metalness: 0.3 }),
    weight: new MeshStandardMaterial({ color: "#3d3d38", roughness: 0.7, metalness: 0.2 }),
    safety: new MeshStandardMaterial({ color: COLORS.text2, roughness: 0.4, metalness: 0.3 }),
    cable: new LineBasicMaterial({ color: COLORS.text2 }),
    edge: new MeshBasicMaterial({ color: COLORS.line }),
  };
  const rig = createRig();
  const meshes = buildBody(rig, mats);
  scene.add(rig.root);
  const propGroup = new Group();
  scene.add(propGroup);

  let demo = null, tl = null, t = 0, playing = true, speed = 1, raf = 0, last = 0, dirty = true, disposed = false;
  let cable = null, lastTick = 0, barbell = null, dumbbells = null;
  const cam = { az: 90, el: 10, dist: 4, base: 4, target: new Vector3(0, 0.8, 0) };

  function placeCamera() {
    const az = MathUtils.degToRad(cam.az), el = MathUtils.degToRad(cam.el);
    camera.position.set(
      cam.target.x + cam.dist * Math.cos(el) * Math.sin(az),
      cam.target.y + cam.dist * Math.sin(el),
      cam.target.z + cam.dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(cam.target);
    dirty = true;
  }

  function clearProps() {
    for (const o of [...propGroup.children]) {
      propGroup.remove(o);
      o.traverse((x) => x.geometry?.dispose?.());
    }
    cable = null; barbell = null; dumbbells = null;
  }

  function buildProps(d, b) {
    clearProps();
    const p = d.props || {};
    if (p.mat) {
      const len = Math.max(1.9, b.size.z + 0.3);
      const m = new Mesh(new BoxGeometry(0.72, 0.012, len), mats.mat);
      m.position.set(0, 0.006, b.center.z);
      propGroup.add(m);
      const rim = new Mesh(new BoxGeometry(0.75, 0.004, len + 0.03), mats.edge);
      rim.position.set(0, 0.002, b.center.z);
      propGroup.add(rim);
    }
    if (p.wall) {
      const back = p.wall.side === "back";
      const m = new Mesh(new BoxGeometry(2.4, 2.3, 0.05), mats.prop);
      m.position.set(0, 1.15, p.wall.z + (back ? -0.025 : 0.025));
      propGroup.add(m);
    }
    if (p.pole) {
      const m = new Mesh(new CylinderGeometry(0.025, 0.025, 2.1, 16), mats.metal);
      m.position.set(p.pole[0], 1.05, p.pole[1]);
      propGroup.add(m);
    }
    // Boîte : [x, y, z, largeur, hauteur, profondeur, inclinaison autour de X en degrés].
    for (const bx of p.boxes || []) {
      const m = new Mesh(new BoxGeometry(bx[3], bx[4], bx[5]), mats.prop);
      m.position.set(bx[0], bx[1], bx[2]);
      if (bx[6]) m.rotation.x = MathUtils.degToRad(bx[6]);
      propGroup.add(m);
    }
    // Rack : deux montants, et les sécurités (barres horizontales d'avant en arrière) à leur hauteur.
    if (p.rack) {
      const { z = 0, x = 0.62, safety } = p.rack;
      for (const sx of [-x, x]) {
        // Quatre montants : la barre passe entre ceux de devant et ceux de derrière.
        for (const sz of [z - 0.36, z + 0.36]) {
          const up = new Mesh(new BoxGeometry(0.06, 2.0, 0.06), mats.metal);
          up.position.set(sx, 1.0, sz);
          propGroup.add(up);
        }
        if (safety != null) {
          const bar = new Mesh(new CylinderGeometry(SAFETY_R, SAFETY_R, 0.78, 14), mats.safety);
          bar.rotation.x = Math.PI / 2;
          bar.position.set(sx, safety, z);
          propGroup.add(bar);
        }
      }
    }
    if (p.barbell) {
      const g = new Group();
      const shaft = new Mesh(new CylinderGeometry(BAR.r, BAR.r, BAR.half * 2, 14), mats.metal);
      g.add(shaft);
      for (const k of [-1, 1]) {
        const plate = new Mesh(new CylinderGeometry(BAR.plate, BAR.plate, BAR.plateW, 32), mats.weight);
        plate.position.y = k * BAR.plateAt;
        g.add(plate);
      }
      barbell = g;
      propGroup.add(g);
    }
    if (p.dumbbells) {
      dumbbells = ["L", "R"].map(() => {
        const g = new Group();
        g.add(new Mesh(new CylinderGeometry(DB.r, DB.r, DB.handle * 2 + DB.plateW * 2, 12), mats.metal));
        for (const k of [-1, 1]) {
          const plate = new Mesh(new CylinderGeometry(DB.plate, DB.plate, DB.plateW, 20), mats.weight);
          plate.position.y = k * (DB.handle + DB.plateW / 2);
          g.add(plate);
        }
        propGroup.add(g);
        return g;
      });
    }
    if (p.cable) {
      const g = new BufferGeometry().setFromPoints([new Vector3(...p.cable.from), new Vector3()]);
      cable = { line: new Line(g, mats.cable), to: p.cable.to };
      propGroup.add(cable.line);
    }
  }

  function applyAt(time) {
    if (!demo) return null;
    const cur = poseAt(tl, time);
    applyPose(rig, cur.pose, { pin: demo.pin, rest: demo.rest });
    if (barbell) {
      const { center, axis } = barLine(snapshot(rig));
      barbell.position.copy(center);
      barbell.quaternion.setFromUnitVectors(UP, axis);
    }
    if (dumbbells) {
      for (const [i, side] of ["L", "R"].entries()) {
        const hand = rig.j["ha" + side].getWorldPosition(new Vector3());
        const elbow = rig.j["el" + side].getWorldPosition(new Vector3());
        const fore = hand.clone().sub(elbow).normalize();
        // Sens de la poignée : celui demandé par la pose, sinon l'avant de l'avant-bras (prise
        // neutre bras le long du corps). Toujours ramené perpendiculaire à l'avant-bras.
        const hint = cur.pose["grip" + side]
          ? new Vector3(...cur.pose["grip" + side])
          : new Vector3(0, 0, 1).applyQuaternion(rig.j["el" + side].getWorldQuaternion(new Quaternion()));
        const dir = hint.addScaledVector(fore, -hint.dot(fore)).normalize();
        dumbbells[i].position.copy(hand);
        dumbbells[i].quaternion.setFromUnitVectors(UP, dir);
      }
    }
    if (cable) {
      const pos = cable.line.geometry.attributes.position;
      const w = rig.j[cable.to].getWorldPosition(new Vector3());
      pos.setXYZ(1, w.x, w.y, w.z);
      pos.needsUpdate = true;
    }
    return cur;
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (playing && demo) { t = (t + dt * speed) % tl.total; dirty = true; }
    if (!dirty) return;
    dirty = false;
    const cur = applyAt(t);
    renderer.render(scene, camera);
    if (cur && onTick && (now - lastTick > 90 || !playing)) { lastTick = now; onTick({ t, total: tl.total, cue: cur.cue }); }
  }

  // Tourner au doigt, pincer pour zoomer, molette sur ordinateur.
  const pointers = new Map();
  let pinch = 0;
  const onDown = (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 1) {
      cam.az -= (e.clientX - p.x) * 0.5;
      cam.el = MathUtils.clamp(cam.el + (e.clientY - p.y) * 0.4, -4, 88);
      placeCamera();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) { cam.dist = MathUtils.clamp(cam.dist * (pinch / d), cam.base * 0.45, cam.base * 1.8); placeCamera(); }
      pinch = d;
    }
  };
  const onUp = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  const onWheel = (e) => { e.preventDefault(); cam.dist = MathUtils.clamp(cam.dist * (1 + e.deltaY * 0.001), cam.base * 0.45, cam.base * 1.8); placeCamera(); };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
    dirty = true;
  }

  let box = null;
  // Distance qui fait tenir tout le geste dans le cadre, quelle que soit la forme de l'écran.
  function fit() {
    if (!box) return;
    const r = 0.5 * Math.hypot(box.size.x, box.size.y, box.size.z);
    const v = MathUtils.degToRad(camera.fov / 2);
    const h = Math.atan(Math.tan(v) * camera.aspect);
    const keep = cam.base ? cam.dist / cam.base : 1;
    cam.base = (r / Math.sin(Math.min(v, h))) * 1.02;
    cam.dist = cam.base * keep;
    placeCamera();
  }

  const api = {
    setDemo(d, { keepView = false } = {}) {
      demo = d;
      tl = buildTimeline(d.frames, { cut: d.cut });
      t = 0;
      const active = new Set(d.active || []);
      for (const m of meshes) {
        const { part, ball } = m.userData;
        m.material = active.has(part) ? mats.active : ball ? mats.joint : mats.body;
      }
      box = bounds(rig, d);
      buildProps(d, box);
      cam.target.copy(box.center);
      if (!keepView) { const v = typeof d.view === "object" ? d.view : VIEWS[d.view] || VIEWS.profilG; cam.az = v.az; cam.el = v.el; cam.dist = 0; cam.base = 0; }
      fit();
      dirty = true;
      return tl.total;
    },
    setPlaying(on) { playing = on; dirty = true; },
    setSpeed(x) { speed = x; },
    setView(name) { const v = VIEWS[name]; if (!v) return; cam.az = v.az; cam.el = v.el; cam.dist = cam.base; placeCamera(); },
    seek(time) { t = Math.max(0, Math.min(time, tl ? tl.total - 0.001 : 0)); dirty = true; },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      clearProps();
      for (const m of meshes) m.geometry.dispose();
      for (const m of Object.values(mats)) m.dispose();
      renderer.dispose();
    },
  };
  resize();
  raf = requestAnimationFrame(frame);
  return api;
}
