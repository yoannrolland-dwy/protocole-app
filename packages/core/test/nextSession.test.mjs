// Recommandeur temporel (nextSession.js) — porté de s1-test.mjs et s3-test.mjs (chantier S).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { nextSessions, slotOpen } from "../src/nextSession.js";
import { SCHEMES } from "../src/climbing.js";
import { fixClock, BS, planFor, at, session, exo, kneeOk, kneeRed } from "./_helpers.mjs";

before(() => fixClock());
const base = (o = {}) => ({ training: [], knee: kneeOk(), sleep: [], targets: { cut: { enabled: false } }, scheme: SCHEMES.gym, basketSchedule: BS, ...o });
const run = (k, h, o = {}) => nextSessions({ now: at(k, h), base: base({ knee: kneeOk(k), ...o }), planFor });
const top = (x) => x.suggestions[0]?.type;
const types = (x) => x.suggestions.map((s) => s.type);
const why = (blk, type) => blk.notProposed.find((x) => x.type === type);
const MATCH = session("2026-10-04", "Basket");

test("dimanche 21h, match loggé → journée fermée, demain Full Body", () => {
  const r = run("2026-10-04", 21, { training: [MATCH] });
  assert.equal(r.today.status, "closed");
  assert.match(r.today.note, /Match/);
  assert.equal(top(r.tomorrow), "Full Body");
});

test("dimanche 13h, match loggé → idem ; dimanche 9h avant match → Basket (planifié)", () => {
  let r = run("2026-10-04", 13, { training: [MATCH] });
  assert.ok(r.today.status === "closed" && top(r.tomorrow) === "Full Body");
  r = run("2026-10-04", 9);
  assert.equal(top(r.today), "Basket");
});

test("lundi 10h, Full Body loggé → plus de muscu aujourd'hui ; demain mardi = Repos", () => {
  const r = run("2026-10-05", 10, { training: [MATCH, session("2026-10-05", "Full Body")] });
  assert.ok(!types(r.today).some((t) => /^(Upper|Lower|Full)/.test(t)), types(r.today));
  assert.equal(top(r.tomorrow), "Repos / mobilité");
});

test("jeudi 10h, Upper avec rowing COCHÉ → pas d'escalade ; lundi Lower seul → escalade proposée le midi", () => {
  let r = run("2026-10-08", 10, { training: [session("2026-10-08", "Upper A", [exo("Rowing barre ou machine", true)])] });
  assert.ok(!types(r.today).includes("Escalade"), types(r.today));
  r = run("2026-10-12", 10, { training: [session("2026-10-12", "Lower C")] });
  assert.ok(types(r.today).includes("Escalade"), types(r.today));
});

test("mercredi 15h → Basket (soir planifié) ; mercredi 22h basket loggé → fermé, demain jeudi Upper", () => {
  let r = run("2026-10-07", 15);
  assert.ok(r.today.status === "open" && top(r.today) === "Basket", top(r.today));
  r = run("2026-10-07", 22, { training: [session("2026-10-07", "Basket")] });
  assert.ok(r.today.status === "closed" && /^Upper/.test(top(r.tomorrow)), top(r.tomorrow));
});

test("samedi 15h rien loggé → plus de créneau (fermé), demain calculé", () => {
  const r = run("2026-10-10", 15);
  assert.equal(r.today.status, "closed");
  assert.match(r.today.note, /créneau/);
  assert.ok(r.tomorrow.suggestions.length > 0);
});

test("mobilité loggée le matin ne ferme rien", () => {
  const r = run("2026-10-08", 9, { training: [session("2026-10-08", "Mobilité")] });
  assert.ok(r.today.status === "open" && /^Upper/.test(top(r.today)), top(r.today));
});

test("genou rouge → Lower / Full Body écartés aujourd'hui ET demain", () => {
  let r = nextSessions({ now: at("2026-10-04", 21), base: base({ knee: kneeRed(), training: [MATCH] }), planFor });
  assert.ok(r.tomorrow.avoid.some((a) => a.type === "Full Body") && !types(r.tomorrow).includes("Full Body"));
  r = nextSessions({ now: at("2026-10-12", 9), base: base({ knee: kneeRed("2026-10-12") }), planFor });
  assert.ok(!types(r.today).some((t) => /^Lower/.test(t)), types(r.today));
});

test("slotOpen : muscu avant 12h, escalade jusqu'à 14h (2e séance ok), basket seulement planifié", () => {
  assert.ok(!slotOpen("Upper A", { hour: 12, sessionDone: false }) && slotOpen("Upper A", { hour: 11, sessionDone: false }));
  assert.ok(slotOpen("Escalade", { hour: 13, sessionDone: true }) && !slotOpen("Escalade", { hour: 14 }));
  assert.ok(!slotOpen("Basket", { hour: 13, basketPlanned: false }) && slotOpen("Basket", { hour: 21, basketPlanned: true }));
});

test("demain : aucun nudge sommeil/énergie (inconnus pour demain)", () => {
  const r = nextSessions({ now: at("2026-10-07", 22), base: base({ knee: kneeOk("2026-10-07"), training: [session("2026-10-07", "Basket")], sleep: [{ date: "2026-10-07", hours: 6, quality: 1 }], energy: { total: 30 } }), planFor });
  assert.doesNotMatch(r.tomorrow.suggestions.map((s) => s.reason).join(" "), /qualité faible|énergie bas/i);
});

// ---------- Escalade selon les séries de tirage cochées (v3.92.0), vue nextSessions
test("Full Body + rowing coché → escalade bloquée avec le nom de l'exercice ; rowing non coché → proposée", () => {
  const fbRow = [session("2026-10-05", "Full Body", [exo("Presse à cuisses (HSR)", true), exo("Rowing barre ou machine", true)])];
  let r = run("2026-10-05", 10, { training: fbRow });
  assert.ok(!types(r.today).includes("Escalade"));
  assert.match(why(r.today, "Escalade").reason, /flexion du coude déjà faits aujourd'hui \(Rowing barre ou machine\)/);
  r = run("2026-10-05", 10, { training: [session("2026-10-05", "Full Body", [exo("Presse à cuisses (HSR)", true), exo("Rowing barre ou machine", false)])] });
  assert.ok(types(r.today).includes("Escalade"), types(r.today));
});

test("tirage vertical / curl marteau / rowing poulie cochés → bloquée ; face pull seul / iso coude de mobilité → autorisée", () => {
  const D = "2026-10-08";
  assert.match(why(run(D, 10, { training: [session(D, "Upper B", [exo("Tirage vertical prise neutre", true)])] }).today, "Escalade")?.reason || "", /Tirage vertical/);
  assert.match(why(run(D, 10, { training: [session(D, "Upper B", [exo("Curl marteau (prise neutre)", true)])] }).today, "Escalade")?.reason || "", /Curl marteau/);
  assert.match(why(run(D, 10, { training: [session(D, "Upper A", [exo("Rowing poulie basse", true)])] }).today, "Escalade")?.reason || "", /Rowing poulie basse/);
  assert.ok(types(run(D, 10, { training: [session(D, "Upper A", [exo("Face pull", true)])] }).today).includes("Escalade"));
  assert.ok(types(run(D, 9, { training: [session(D, "Mobilité", [exo("Iso flexion coude prise marteau + supination", true)])] }).today).includes("Escalade"));
});

// ---------- « Pourquoi pas les autres ? » : chaque type non proposé a une phrase
test("notProposed : toutes les séances non proposées sont expliquées (4 situations × aujourd'hui/demain)", () => {
  const all = ["Upper A", "Upper B", "Lower A", "Lower B", "Lower C", "Full Body", "Basket", "Escalade"];
  const fbRow = [session("2026-10-05", "Full Body", [exo("Rowing barre ou machine", true)])];
  for (const [k, h, tr, label] of [["2026-10-04", 21, [MATCH], "dim 21h match"], ["2026-10-08", 9, [], "jeu 9h"], ["2026-10-10", 15, [], "sam 15h"], ["2026-10-05", 10, fbRow, "lun 10h FB"]]) {
    const x = run(k, h, { training: tr });
    for (const [lbl, blk] of [["auj", x.today], ["demain", x.tomorrow]]) {
      const shown = new Set(types(blk));
      const missing = all.filter((t) => !shown.has(t) && !blk.notProposed.some((p) => p.type === t && p.reason));
      assert.deepEqual(missing, [], `${label} ${lbl} : séances sans explication`);
    }
  }
});

test("notProposed : phrases attendues (alternance, planning, Full Body, créneau, lendemain de match)", () => {
  let r = run("2026-10-08", 9);
  const otherUpper = top(r.today) === "Upper A" ? "Upper B" : "Upper A";
  assert.match(why(r.today, otherUpper).reason, /Alternance/);
  assert.match(why(r.today, "Basket").reason, /Pas au planning/);
  assert.match(why(r.today, "Full Body").reason, /Seulement le lendemain d'un match/);
  r = run("2026-10-10", 15);
  assert.match(why(r.today, "Upper A")?.reason || why(r.today, "Upper B")?.reason, /Créneau passé — la musculation/);
  r = run("2026-10-04", 21, { training: [MATCH] });
  assert.match(why(r.tomorrow, "Lower C").reason, /Lendemain de match : le Full Body remplace/);
});

test("demain : basket hors planning ni proposé ni « moins prioritaire » ; basket planifié → proposé", () => {
  const x = run("2026-10-04", 21, { training: [MATCH] });
  assert.ok(!types(x.tomorrow).includes("Basket"));
  assert.match(why(x.tomorrow, "Basket").reason, /Pas au planning ce jour-là/);
  const y = run("2026-10-06", 21);
  assert.ok(types(y.tomorrow).includes("Basket"), types(y.tomorrow));
});
