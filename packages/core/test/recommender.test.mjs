// Recommandeur « Prochaine séance » (recommender.js) — porté de fb-test.mjs, s1-baseline.mjs,
// s3-test.mjs + les régressions de septembre 2026 transformées en tests nommés.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { recommendSessions, heavyPullDoneOn } from "../src/recommender.js";
import { SCHEMES } from "../src/climbing.js";
import { fixClock, T0, d, session, exo, kneeOk, kneeRed, snapshot } from "./_helpers.mjs";

before(() => fixClock());
const T = { cut: { enabled: false } };
const base = (o = {}) => ({ training: [], knee: kneeOk(), sleep: [], targets: T, scheme: SCHEMES.gym, ...o });
const types = (r) => r.suggestions.map((s) => s.type);

// ---------- Régression du 14/09/2026 (v3.80.5) : « déjà fait aujourd'hui » perdu au retrait du gate 48h
test("régression 14/09 : Lower C + Escalade loggés aujourd'hui → ni l'un ni l'autre re-suggéré, Repos seul", () => {
  const r = recommendSessions(base({ training: [session(T0, "Lower C"), session(T0, "Escalade")] }));
  assert.ok(!types(r).some((t) => /^Lower/.test(t)), `Lower encore suggéré : ${types(r)}`);
  assert.ok(!types(r).includes("Escalade"), `Escalade encore suggérée : ${types(r)}`);
  assert.ok(r.avoid.some((a) => /^Lower/.test(a.type) && /déjà fait/.test(a.reason)), "Lower dans « à éviter » avec le motif");
  assert.ok(r.avoid.some((a) => a.type === "Escalade" && /déjà fait/.test(a.reason)), "Escalade dans « à éviter » avec le motif");
  assert.ok(types(r).some((t) => /Repos/.test(t)), "Repos reste proposé");
});

test("régression 14/09 (non-régression du 13/09) : un Basket loggé aujourd'hui ne bloque PAS Lower", () => {
  const r = recommendSessions(base({ training: [session(T0, "Basket")] }));
  assert.ok(types(r).some((t) => /^Lower/.test(t)), `Lower attendu : ${types(r)}`);
  assert.ok(!r.avoid.some((a) => /^Lower/.test(a.type)), "Lower ne doit pas être écarté");
});

test("gate 48h retiré (13/09) : basket hier ET aujourd'hui, genou en base → Lower suggéré ; genou rouge → Lower bloqué", () => {
  let r = recommendSessions(base({ training: [session(d(1), "Basket"), session(T0, "Basket")] }));
  assert.ok(types(r).some((t) => /^Lower/.test(t)), `Lower attendu : ${types(r)}`);
  r = recommendSessions(base({ knee: kneeRed() }));
  assert.ok(!types(r).some((t) => /^Lower/.test(t)) && r.avoid.some((a) => /^Lower/.test(a.type)), "genou rouge → Lower écarté");
});

// ---------- Régression du 14/09/2026 (v3.80.2) : Lower C jamais suggérable automatiquement
test("régression 14/09 : matchWeek → Lower C suggéré, Lower A/B absents ; sans matchWeek → jamais Lower C", () => {
  let r = recommendSessions(base({ matchWeek: true }));
  assert.ok(types(r).includes("Lower C"), `Lower C attendu : ${types(r)}`);
  assert.ok(!types(r).some((t) => t === "Lower A" || t === "Lower B"));
  r = recommendSessions(base());
  assert.ok(!types(r).includes("Lower C") && types(r).some((t) => t === "Lower A" || t === "Lower B"), `A/B attendu : ${types(r)}`);
});

test("matchWeek + genou rouge → l'avoid référence « Lower C » (pas « Lower A / B »)", () => {
  const r = recommendSessions(base({ matchWeek: true, knee: kneeRed() }));
  assert.ok(r.avoid.some((a) => a.type === "Lower C"), JSON.stringify(r.avoid));
  assert.ok(!r.avoid.some((a) => /Lower A/.test(a.type)));
});

// ---------- Full Body / postMatch (04/10/2026, v3.89.0)
test("postMatch → Full Body suggéré avec bonus planning, pas de Lower", () => {
  const r = recommendSessions(base({ postMatch: true, weeklyPlan: ["Full Body"] }));
  assert.ok(types(r).includes("Full Body") && !types(r).some((t) => /^Lower/.test(t)), types(r));
  assert.match(r.suggestions.find((s) => s.type === "Full Body").reason, /Planning idéal du jour : Full Body/);
});

test("postMatch + genou rouge → Full Body à éviter, conseil haut du corps", () => {
  const r = recommendSessions(base({ postMatch: true, knee: kneeRed() }));
  assert.ok(r.avoid.some((a) => a.type === "Full Body" && /haut du corps/.test(a.reason)), JSON.stringify(r.avoid));
});

test("Full Body loggé aujourd'hui → compte comme Upper ET Lower", () => {
  const r = recommendSessions(base({ training: [session(T0, "Full Body")] }));
  assert.ok(r.avoid.some((a) => /Lower déjà fait/.test(a.reason)), JSON.stringify(r.avoid));
  const up = r.suggestions.find((s) => s.type.startsWith("Upper"));
  assert.ok(!up || up.score < 10, `Upper encore bien noté : ${JSON.stringify(up)}`);
});

// ---------- Planning idéal = proposition par défaut (S1)
test("planning par défaut : type planifié en tête même avec un meilleur score brut ailleurs", () => {
  const train = [session("2026-10-07", "Lower A"), session("2026-10-06", "Lower B")];
  const r = recommendSessions(base({ knee: kneeOk("2026-10-08"), training: train, weeklyPlan: ["Lower"], asOf: "2026-10-08" }));
  assert.ok(r.suggestions[0].type.startsWith("Lower"), types(r).join());
  assert.match(r.suggestions[0].reason, /proposition par défaut/);
});

test("planning par défaut : signal de fatigue → le planning n'est pas imposé", () => {
  const train = [session("2026-10-07", "Lower A"), session("2026-10-06", "Lower B")];
  const r = recommendSessions(base({ knee: kneeOk("2026-10-08"), training: train, weeklyPlan: ["Lower"], asOf: "2026-10-08", sleep: [{ date: "2026-10-08", hours: 6, quality: 1 }] }));
  assert.match(r.suggestions.find((s) => s.type.startsWith("Lower"))?.reason || "", /pas imposé/);
});

test("basket planifié aujourd'hui → score 999 en tête", () => {
  const r = recommendSessions(base({ basketSchedule: { weekly: [0, 1, 2, 3, 4, 5, 6], matchDates: [] } }));
  assert.equal(r.suggestions[0].type, "Basket");
  assert.equal(r.suggestions[0].score, 999);
});

// ---------- Escalade selon la flexion du coude réellement faite (v3.92.0)
test("heavyPullDoneOn : rowing coché vs non coché, variante bibliothèque, curl marteau, face pull, mobilité", () => {
  const day = "2026-10-05";
  assert.deepEqual(heavyPullDoneOn([session(day, "Full Body", [exo("Presse à cuisses (HSR)", true), exo("Rowing barre ou machine", true)])], day), ["Rowing barre ou machine"]);
  assert.deepEqual(heavyPullDoneOn([session(day, "Full Body", [exo("Rowing barre ou machine", false)])], day), []);
  assert.deepEqual(heavyPullDoneOn([session(day, "Upper A", [exo("Rowing poulie basse", true)])], day), ["Rowing poulie basse"]);
  assert.deepEqual(heavyPullDoneOn([session(day, "Upper B", [exo("Curl marteau (prise neutre)", true)])], day), ["Curl marteau (prise neutre)"]);
  assert.deepEqual(heavyPullDoneOn([session(day, "Upper A", [exo("Face pull", true)])], day), []);
  assert.deepEqual(heavyPullDoneOn([session(day, "Mobilité", [exo("Iso flexion coude prise marteau + supination", true)])], day), []);
});

test("escalade : bloquée seulement si une série de tirage/flexion du coude est COCHÉE aujourd'hui", () => {
  const rowCoche = recommendSessions(base({ training: [session(T0, "Upper A", [exo("Rowing barre ou machine", true)])] }));
  assert.ok(rowCoche.avoid.some((a) => a.type === "Escalade" && /flexion du coude déjà faits aujourd'hui \(Rowing barre ou machine\)/.test(a.reason)), JSON.stringify(rowCoche.avoid));
  const rowNon = recommendSessions(base({ training: [session(T0, "Upper A", [exo("Rowing barre ou machine", false)])] }));
  assert.ok(!rowNon.avoid.some((a) => a.type === "Escalade"), "Upper sans rowing coché n'empêche plus l'escalade");
});

// ---------- Capture datée (s1-baseline) : 11 scénarios figés, sortie complète
test("capture datée : sorties de recommendSessions sur 11 scénarios (snapshots/recommender.json)", () => {
  const sc = {
    vide: {},
    genouRouge: { knee: kneeRed() },
    genouAmbre: { knee: [{ date: d(1), pain: 4, baseline: true }] },
    lowerAujourdhui: { training: [session(T0, "Lower C")] },
    upperHierEscalade: { training: [session(d(1), "Upper A"), { date: d(2), type: "Escalade", blocs: Array(20).fill({ cotation: "rouge-2", issue: "essais" }) }] },
    sommeilCourt: { sleep: [{ date: T0, hours: 5, quality: 1 }, { date: d(1), hours: 5, quality: 2 }] },
    charge: { training: [0, 0, 1, 1, 2, 2, 2].map((n, i) => session(d(n), ["Upper A", "Lower A", "Basket", "Upper B", "Escalade", "Lower B", "Basket"][i])) },
    planUpper: { weeklyPlan: ["Upper"] },
    planLowerMatch: { weeklyPlan: ["Lower"], matchWeek: true },
    postMatch: { postMatch: true, weeklyPlan: ["Full Body"] },
    basketPrevu: { basketSchedule: { weekly: [0, 1, 2, 3, 4, 5, 6], matchDates: [] } },
  };
  const out = {};
  for (const [k, v] of Object.entries(sc)) out[k] = recommendSessions({ ...base({ knee: k === "vide" ? [] : kneeOk() }), ...v });
  snapshot("recommender", out);
});
