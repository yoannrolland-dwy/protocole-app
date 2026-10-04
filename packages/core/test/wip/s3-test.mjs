import assert from "node:assert/strict";
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { nextSessions } = await import(`${P}/nextSession.js`);
const { heavyPullDoneOn } = await import(`${P}/recommender.js`);
const { SCHEMES } = await import(`${P}/climbing.js`);
const { shiftDateKey } = await import(`${P}/dateUtils.js`);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const FAM = { sansMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Lower"], 0: ["Upper"] },
  avecMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Upper"], 0: ["Basket"] } };
const bs = { weekly: [3, 5], matchDates: ["2026-10-04", "2026-10-11"] };
const dow = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
const planFor = (k) => { const w = dow(k), sun = shiftDateKey(k, w === 0 ? 0 : 7 - w); const mw = bs.matchDates.includes(sun), pm = bs.matchDates.includes(shiftDateKey(k, -1));
  return { weeklyPlan: pm ? ["Full Body"] : FAM[mw ? "avecMatch" : "sansMatch"][w], matchWeek: mw, postMatch: pm }; };
const at = (k, h) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, h); };
const run = (k, h, training = []) => nextSessions({ now: at(k, h), base: { training, knee: [{ date: k, pain: 2, baseline: true }], sleep: [], targets: { cut: { enabled: false } }, scheme: SCHEMES.gym, basketSchedule: bs }, planFor });
const ex = (nom, fait) => ({ nom, series: [{ poids: 50, val: 9, fait }] });
const why = (r, type) => r.notProposed.find((x) => x.type === type);
// --- Escalade selon les séries de tirage cochées ---
const fbRowCoche = [{ date: "2026-10-05", type: "Full Body", exercices: [ex("Presse à cuisses (HSR)", true), ex("Rowing barre ou machine", true)] }];
const fbRowNonCoche = [{ date: "2026-10-05", type: "Full Body", exercices: [ex("Presse à cuisses (HSR)", true), ex("Rowing barre ou machine", false)] }];
ok(heavyPullDoneOn(fbRowCoche, "2026-10-05").join() === "Rowing barre ou machine" && heavyPullDoneOn(fbRowNonCoche, "2026-10-05").length === 0, "heavyPullDoneOn : coché vs non coché");
let r = run("2026-10-05", 10, fbRowCoche);
ok(!r.today.suggestions.some((s) => s.type === "Escalade") && /flexion du coude déjà faits aujourd'hui \(Rowing barre ou machine\)/.test(why(r.today, "Escalade").reason), `FB + rowing coché : escalade bloquée — ${why(r.today, "Escalade")?.reason}`);
r = run("2026-10-05", 10, fbRowNonCoche);
ok(r.today.suggestions.some((s) => s.type === "Escalade"), `FB sans rowing coché : escalade proposée (${r.today.suggestions.map((s) => s.type)})`);
r = run("2026-10-08", 10, [{ date: "2026-10-08", type: "Upper B", exercices: [ex("Tirage vertical prise neutre", true)] }]);
ok(/Tirage vertical/.test(why(r.today, "Escalade")?.reason || ""), "Upper B + tirage vertical coché : bloquée");
r = run("2026-10-08", 10, [{ date: "2026-10-08", type: "Upper A", exercices: [ex("Face pull", true)] }]);
ok(r.today.suggestions.some((s) => s.type === "Escalade"), "face pull seul : escalade autorisée");
r = run("2026-10-08", 10, [{ date: "2026-10-08", type: "Upper B", exercices: [ex("Curl marteau (prise neutre)", true)] }]);
ok(/Curl marteau/.test(why(r.today, "Escalade")?.reason || ""), "curl marteau coché : escalade bloquée");
r = run("2026-10-08", 9, [{ date: "2026-10-08", type: "Mobilité", exercices: [ex("Iso flexion coude prise marteau + supination", true)] }]);
ok(r.today.suggestions.some((s) => s.type === "Escalade"), "iso coude de mobilité : ne bloque jamais");
r = run("2026-10-08", 10, [{ date: "2026-10-08", type: "Upper A", exercices: [ex("Rowing poulie basse", true)] }]);
ok(/Rowing poulie basse/.test(why(r.today, "Escalade")?.reason || ""), "variante bibliothèque (rowing poulie) : bloquée");
// --- Explications : chaque type non proposé a une phrase ---
const types = ["Upper A", "Upper B", "Lower A", "Lower B", "Lower C", "Full Body", "Basket", "Escalade"];
for (const [k, h, tr, label] of [["2026-10-04", 21, [{ date: "2026-10-04", type: "Basket", exercices: [] }], "dim 21h match"], ["2026-10-08", 9, [], "jeu 9h"], ["2026-10-10", 15, [], "sam 15h"], ["2026-10-05", 10, fbRowCoche, "lun 10h FB"]]) {
  const x = run(k, h, tr);
  for (const [lbl, blk] of [["auj", x.today], ["demain", x.tomorrow]]) {
    const shown = new Set(blk.suggestions.map((s) => s.type));
    const missing = types.filter((t) => !shown.has(t) && !blk.notProposed.some((p) => p.type === t && p.reason));
    ok(missing.length === 0, `${label} ${lbl} : toutes les séances expliquées (manque: ${missing})`);
  }
}
// quelques phrases attendues
r = run("2026-10-08", 9);
ok(/Alternance/.test(why(r.today, r.today.suggestions[0].type === "Upper A" ? "Upper B" : "Upper A").reason), "jeudi : Upper non retenu → alternance");
ok(/Pas au planning/.test(why(r.today, "Basket").reason), `jeudi : basket → ${why(r.today, "Basket").reason}`);
ok(/Seulement le lendemain d'un match/.test(why(r.today, "Full Body").reason), "jeudi : Full Body → seulement lendemain de match");
r = run("2026-10-10", 15);
ok(/Créneau passé — la musculation/.test(why(r.today, "Upper A")?.reason || why(r.today, "Upper B")?.reason), "sam 15h : muscu créneau passé");
r = run("2026-10-04", 21, [{ date: "2026-10-04", type: "Basket", exercices: [] }]);
ok(/Lendemain de match : le Full Body remplace/.test(why(r.tomorrow, "Lower C").reason), `demain lundi : Lower C → ${why(r.tomorrow, "Lower C").reason}`);
console.log(`${n} assertions OK`);
// demain lundi (pas de basket au planning) : basket ni proposé ni « moins prioritaire »
{ const x = run("2026-10-04", 21, [{ date: "2026-10-04", type: "Basket", exercices: [] }]);
  assert.ok(!x.tomorrow.suggestions.some((s) => s.type === "Basket"), "demain : basket hors planning non proposé");
  assert.ok(/Pas au planning ce jour-là/.test(x.tomorrow.notProposed.find((p) => p.type === "Basket").reason), "demain : basket expliqué par le planning");
  // demain mercredi (basket planifié) : il est proposé
  const y = run("2026-10-06", 21);
  assert.ok(y.tomorrow.suggestions.some((s) => s.type === "Basket"), "demain mercredi : basket planifié proposé");
  console.log("+3 assertions OK (basket demain)"); }
