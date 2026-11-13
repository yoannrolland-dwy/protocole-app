// Démonstrations 3D (13/11/2026) : contrôle, sans écran, que chaque pose tient debout.
// Une démonstration fausse serait pire que pas de démonstration : les appuis doivent toucher le
// sol, rien ne doit passer dessous, une main ou un pied posé doit être à portée du bras ou de la
// jambe, et rien ne traverse un mur. Vérifié aux positions clés ET pendant le trajet, des deux côtés.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES } from "@rawcare/core/session/templates";
import { EXERCISE_CATALOG } from "@rawcare/core/session/exoCatalog";
import { DEMOS, hasDemo } from "../src/demo/demos.js";
import { createRig, applyPose, snapshot, RADIUS, PARTS, BAR, SAFETY_R, barLine } from "../src/demo/rig.js";
import { buildTimeline, poseAt, mirrorPose, mirrorDemo } from "../src/demo/timeline.js";

const rig = createRig();
const eachVersion = (fn) => {
  for (const [nom, d] of Object.entries(DEMOS)) {
    fn(nom, d);
    if (d.sides) fn(`${nom} (autre côté)`, mirrorDemo(d));
  }
};
const lowest = (s) => Math.min(...Object.entries(s).map(([n, p]) => p[1] - RADIUS[n]));
const beyondWall = (s, w) => Math.max(...Object.entries(s).map(([n, p]) => (w.side === "back" ? w.z - (p[2] - RADIUS[n]) : p[2] + RADIUS[n] - w.z)));

test("chaque exercice de la séance Mobilité a sa démonstration, et chaque démonstration est un exercice de l'app", () => {
  for (const e of TEMPLATES["Mobilité"].exos) assert.ok(hasDemo(e.n), `pas de démonstration : ${e.n}`);
  const noms = new Set(EXERCISE_CATALOG.map((c) => c.ex.n));
  for (const nom of Object.keys(DEMOS)) assert.ok(noms.has(nom), `démonstration sans exercice : ${nom}`);
  // Étape 2 : haltères, barre et bancs. Le hip thrust et le rowing (machines) viendront à l'étape 3 ;
  // les curls poignets restent sans démonstration (le mannequin n'a pas de poignet articulé).
  for (const nom of ["Développé couché haltères", "Développé incliné haltères", "Développé militaire haltères",
    "Élévations latérales haltères", "Curl marteau (prise neutre)", "Oiseau haltères",
    "Squat sur sécurités", "Mollets debout à la barre", "Soulevé de terre roumain"]) assert.ok(hasDemo(nom), `pas de démonstration : ${nom}`);
  for (const nom of ["Hip thrust", "Rowing barre ou machine", "Leg extension unilatérale", "Curl poignets pronation"]) assert.equal(hasDemo(nom), false, nom);
});

test("barre : les disques ne touchent jamais le sol ; au squat, la barre se pose sur les sécurités sans passer dessous", () => {
  eachVersion((nom, d) => {
    if (!d.props?.barbell) return;
    const tl = buildTimeline(d.frames, { cut: d.cut });
    const safety = d.props.rack?.safety;
    for (let t = 0; t < tl.total; t += 0.1) {
      applyPose(rig, poseAt(tl, t).pose, { pin: d.pin, rest: d.rest });
      const { center } = barLine(snapshot(rig));
      assert.ok(center.y - BAR.plate > 0.005, `${nom}, à ${t.toFixed(1)} s : un disque touche le sol`);
      if (safety != null) assert.ok(center.y - BAR.r - (safety + SAFETY_R) > -0.008, `${nom}, à ${t.toFixed(1)} s : la barre passe sous les sécurités`);
    }
    d.frames.forEach((f, i) => {
      if (!f.onSafety) return;
      applyPose(rig, f.pose, { pin: d.pin, rest: d.rest });
      const { center } = barLine(snapshot(rig));
      assert.ok(Math.abs(center.y - BAR.r - (safety + SAFETY_R)) < 0.01, `${nom}, position ${i} : la barre devrait reposer sur les sécurités`);
    });
  });
  assert.ok(DEMOS["Squat sur sécurités"].frames.some((f) => f.onSafety), "le squat montre l'arrêt sur les sécurités");
});

test("bancs et cale : les points d'appui sont posés dessus", () => {
  eachVersion((nom, d) => {
    if (!d.rest) return;
    d.frames.forEach((f, i) => {
      applyPose(rig, f.pose, { pin: d.pin, rest: d.rest });
      const s = snapshot(rig);
      const low = Math.min(...d.rest.points.map((p) => s[p][1] - RADIUS[p]));
      assert.ok(Math.abs(low - d.rest.y) < 1e-6, `${nom}, position ${i} : pas posé sur l'appui`);
    });
  });
});

test("forme d'une démonstration : positions, consignes, repères, zones en jaune connues", () => {
  for (const [nom, d] of Object.entries(DEMOS)) {
    assert.ok(d.frames.length >= 2, nom);
    for (const f of d.frames) {
      assert.ok(f.cue && f.cue.length > 10, `${nom} : consigne manquante`);
      assert.ok(f.d > 0 && f.hold >= 0, `${nom} : durées`);
    }
    assert.ok(d.sentir && d.eviter, `${nom} : repères « à sentir » et « à éviter »`);
    assert.ok(d.active.length > 0, nom);
    for (const p of d.active) assert.ok(PARTS.includes(p), `${nom} : partie inconnue ${p}`);
    if (d.sides) assert.match(d.side, /^[LR]$/, `${nom} : côté qui travaille`);
    // Les mêmes cibles à chaque position : une main posée ne devient pas libre en cours de route.
    const targets = (f) => Object.keys(f.pose).filter((k) => /^(hand|foot)[LR]$/.test(k) && f.pose[k]).sort().join(",");
    for (const f of d.frames) assert.equal(targets(f), targets(d.frames[0]), `${nom} : cibles différentes d'une position à l'autre`);
    assert.equal(d.frames.every((f) => !!f.pose.pos) || d.frames.every((f) => !f.pose.pos), true, `${nom} : bassin posé à la main ou au sol, pas les deux`);
  }
});

test("positions clés : appuis au sol, rien sous le sol, cibles à portée, mur respecté", () => {
  eachVersion((nom, d) => {
    d.frames.forEach((f, i) => {
      const { reach } = applyPose(rig, f.pose, { pin: d.pin, rest: d.rest });
      const s = snapshot(rig);
      const where = `${nom}, position ${i}`;
      assert.ok(lowest(s) > -0.012, `${where} : un point passe sous le sol (${lowest(s).toFixed(3)} m)`);
      for (const p of d.touch || []) {
        const h = s[p][1] - RADIUS[p];
        assert.ok(Math.abs(h) < 0.03, `${where} : ${p} devrait toucher le sol (à ${h.toFixed(3)} m)`);
      }
      for (const [k, v] of Object.entries(reach)) assert.ok(v < 0.004, `${where} : ${k} hors de portée de ${v.toFixed(3)} m`);
      if (d.props?.wall) assert.ok(beyondWall(s, d.props.wall) < 0.015, `${where} : le corps traverse le mur`);
    });
  });
});

test("pendant le trajet : rien ne s'enfonce, rien ne se décroche, le corps ne saute pas", () => {
  eachVersion((nom, d) => {
    const tl = buildTimeline(d.frames, { cut: d.cut });
    let prev = null;
    for (let t = 0; t < tl.total; t += 0.1) {
      const { reach } = applyPose(rig, poseAt(tl, t).pose, { pin: d.pin, rest: d.rest });
      const s = snapshot(rig);
      const where = `${nom}, à ${t.toFixed(1)} s`;
      assert.ok(lowest(s) > -0.03, `${where} : un point s'enfonce (${lowest(s).toFixed(3)} m)`);
      for (const [k, v] of Object.entries(reach)) assert.ok(v < 0.02, `${where} : ${k} se décroche de ${v.toFixed(3)} m`);
      if (d.props?.wall) assert.ok(beyondWall(s, d.props.wall) < 0.03, `${where} : le corps traverse le mur`);
      if (prev) assert.ok(Math.hypot(s.pelvis[0] - prev[0], s.pelvis[1] - prev[1], s.pelvis[2] - prev[2]) < 0.08, `${where} : le bassin saute`);
      prev = s.pelvis;
    }
  });
});

test("déroulé : durée, boucle, consigne du moment, reprise sans transition", () => {
  const frames = [
    { d: 1, hold: 0.5, cue: "départ", pose: { kneeL: 0, root: [0, 0, 0] } },
    { d: 2, hold: 1, cue: "plier", pose: { kneeL: 90, root: [10, 0, 0] } },
  ];
  const tl = buildTimeline(frames);
  assert.equal(tl.total, 0.5 + 2 + 1 + 1, "tenue, aller, tenue, retour");
  assert.equal(poseAt(tl, 0).pose.kneeL, 0);
  assert.equal(poseAt(tl, 1.5).cue, "plier");
  assert.ok(Math.abs(poseAt(tl, 1.5).pose.kneeL - 45) < 0.01, "à mi-chemin");
  assert.equal(poseAt(tl, 3).pose.kneeL, 90, "tenue");
  assert.equal(poseAt(tl, 4.5 + 0.2).pose.kneeL, 0, "la boucle repart du début");
  assert.equal(buildTimeline(frames, { cut: true }).total, 0.5 + 2 + 1, "sans retour");
  // Cercles de bras : un tour complet, puis on repart sans dérouler le bras à l'envers.
  const c = DEMOS["Grands cercles de bras"];
  assert.equal(c.cut, true);
  assert.equal(c.frames.at(-1).pose.shL[0] - c.frames[0].pose.shL[0], 360);
});

test("symétrie : l'autre côté est le miroir exact", () => {
  const pose = DEMOS["Levée de jambe tendue, allongé"].frames[1].pose;
  applyPose(rig, pose, { pin: { p: "pelvis", z: 0 } });
  const a = snapshot(rig);
  applyPose(rig, mirrorPose(pose), { pin: { p: "pelvis", z: 0 } });
  const b = snapshot(rig);
  for (const [l, r] of [["anL", "anR"], ["knL", "knR"], ["haL", "haR"]]) {
    assert.ok(Math.abs(a[l][0] + b[r][0]) < 1e-6 && Math.abs(a[l][1] - b[r][1]) < 1e-6 && Math.abs(a[l][2] - b[r][2]) < 1e-6, `${l} ↔ ${r}`);
  }
  const m = mirrorDemo(DEMOS["Rotation externe épaule poulie basse"]);
  assert.deepEqual(m.active, ["epauleR", "avantBrasR"]);
  assert.equal(m.props.cable.to, "haR");
  assert.equal(m.props.cable.from[0], 0.7);
});

test("repères du squelette : debout 1,72 m, bras le long du corps, jambe levée à 90°", () => {
  applyPose(rig, {});
  let s = snapshot(rig);
  assert.ok(Math.abs(s.head[1] + RADIUS.head - 1.725) < 0.01, "taille");
  assert.ok(Math.abs(s.toeL[1] - RADIUS.toeL) < 1e-6, "pieds au sol");
  assert.ok(s.haL[1] < s.elL[1] && s.elL[1] < s.shL[1], "bras pendants");
  applyPose(rig, { hipL: [90, 0, 0], kneeL: 90 });
  s = snapshot(rig);
  assert.ok(s.knL[2] > 0.4 && Math.abs(s.knL[1] - s.hipL[1]) < 1e-6, "cuisse à l'horizontale, vers l'avant");
  assert.ok(Math.abs(s.anL[2] - s.knL[2]) < 1e-6 && s.anL[1] < s.knL[1], "tibia vertical");
});
