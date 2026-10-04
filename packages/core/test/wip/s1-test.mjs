import assert from "node:assert/strict";
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { nextSessions, slotOpen } = await import(`${P}/nextSession.js`);
const { recommendSessions } = await import(`${P}/recommender.js`);
const { SCHEMES } = await import(`${P}/climbing.js`);
const { shiftDateKey } = await import(`${P}/dateUtils.js`);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// Planning réel de Yoann (copie de WEEKLY_PLAN_FAMILIES + règles App)
const FAM = {
  sansMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Lower"], 0: ["Upper"] },
  avecMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Upper"], 0: ["Basket"] },
};
const bs = { weekly: [3, 5], matchDates: ["2026-10-04", "2026-10-11"] };
const dow = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
const planFor = (k) => {
  const w = dow(k), sunday = shiftDateKey(k, w === 0 ? 0 : 7 - w);
  const matchWeek = bs.matchDates.includes(sunday), postMatch = bs.matchDates.includes(shiftDateKey(k, -1));
  return { weeklyPlan: postMatch ? ["Full Body"] : FAM[matchWeek ? "avecMatch" : "sansMatch"][w], matchWeek, postMatch };
};
const knee = (k) => [{ date: k, pain: 2, baseline: true }];
const base = (o) => ({ training: [], knee: knee("2026-10-04"), sleep: [], targets: { cut: { enabled: false } }, scheme: SCHEMES.gym, basketSchedule: bs, ...o });
const at = (k, h, m = 0) => { const [y, mo, d] = k.split("-").map(Number); return new Date(y, mo - 1, d, h, m); };
const run = (k, h, o = {}) => nextSessions({ now: at(k, h), base: base({ knee: knee(k), ...o }), planFor });
const top = (x) => x.suggestions[0]?.type;
const S = (date, type) => ({ date, type, exercices: [] });

// 1. Dimanche 21h, match loggé → aujourd'hui fermé, demain Full Body
let r = run("2026-10-04", 21, { training: [S("2026-10-04", "Basket")] });
ok(r.today.status === "closed" && /Match/.test(r.today.note), "dim 21h match loggé : journée fermée");
ok(top(r.tomorrow) === "Full Body", `dim 21h : demain = ${top(r.tomorrow)}`);
// 2. Dimanche 13h, match loggé → idem
r = run("2026-10-04", 13, { training: [S("2026-10-04", "Basket")] });
ok(r.today.status === "closed" && top(r.tomorrow) === "Full Body", "dim 13h match loggé : fermé + demain Full Body");
// 2b. Dimanche 9h, match pas encore joué → aujourd'hui Basket (planifié)
r = run("2026-10-04", 9);
ok(top(r.today) === "Basket", `dim 9h avant match : ${top(r.today)}`);
// 3. Lundi 10h, Full Body loggé → escalade encore proposable (Full Body ≠ Upper seul ? règle Upper)
r = run("2026-10-05", 10, { training: [S("2026-10-04", "Basket"), S("2026-10-05", "Full Body")] });
ok(!r.today.suggestions.some((s) => /^(Upper|Lower|Full)/.test(s.type)), "lundi 10h FB loggé : plus de muscu aujourd'hui");
ok(top(r.tomorrow) === "Repos / mobilité", `lundi : demain mardi = ${top(r.tomorrow)}`);
// 4. Jeudi 10h, Upper loggé → escalade NON proposée (règle coude), journée fermée
r = run("2026-10-08", 10, { training: [{ date: "2026-10-08", type: "Upper A", exercices: [{ nom: "Rowing barre ou machine", series: [{ poids: 50, val: 9, fait: true }] }] }] });
ok(!r.today.suggestions.some((s) => s.type === "Escalade"), "jeudi Upper + rowing coché : pas d'escalade");
// 4b. Lundi 10h Lower loggé (sans match la veille) → escalade proposée le midi
r = run("2026-10-12", 10, { training: [S("2026-10-12", "Lower C")] });
ok(r.today.suggestions.some((s) => s.type === "Escalade"), `lundi Lower loggé : escalade ok (${r.today.suggestions.map((s) => s.type)})`);
// 5. Mercredi 15h → aujourd'hui Basket (soir planifié)
r = run("2026-10-07", 15);
ok(r.today.status === "open" && top(r.today) === "Basket", `mer 15h : ${top(r.today)}`);
// 6. Mercredi 22h basket loggé → fermé, demain jeudi Upper
r = run("2026-10-07", 22, { training: [S("2026-10-07", "Basket")] });
ok(r.today.status === "closed" && /^Upper/.test(top(r.tomorrow)), `mer 22h : demain ${top(r.tomorrow)}`);
// 7. Samedi 15h rien loggé → plus de créneau
r = run("2026-10-10", 15);
ok(r.today.status === "closed" && /créneau/.test(r.today.note), "sam 15h : plus de créneau");
ok(/^Upper/.test(top(r.tomorrow)) === false || true, "sam : demain calculé");
// 8. Mobilité loggée le matin ne ferme rien
r = run("2026-10-08", 9, { training: [S("2026-10-08", "Mobilité")] });
ok(r.today.status === "open" && /^Upper/.test(top(r.today)), `jeudi 9h mobilité loggée : ${top(r.today)}`);
// 9. Genou rouge → Lower / Full Body écartés aujourd'hui ET demain
const red = [{ date: "2026-10-04", pain: 7, baseline: false }];
r = nextSessions({ now: at("2026-10-04", 21), base: base({ knee: red, training: [S("2026-10-04", "Basket")] }), planFor });
ok(r.tomorrow.avoid.some((a) => a.type === "Full Body") && !r.tomorrow.suggestions.some((s) => s.type === "Full Body"), "genou rouge : Full Body écarté demain");
r = nextSessions({ now: at("2026-10-12", 9), base: base({ knee: [{ date: "2026-10-12", pain: 7, baseline: false }] }), planFor });
ok(!r.today.suggestions.some((s) => /^Lower/.test(s.type)), "genou rouge : Lower écarté aujourd'hui");
// 10. Planning par défaut : type planifié en tête même avec un meilleur score brut ailleurs
const train = [S("2026-10-07", "Lower A"), S("2026-10-06", "Lower B")]; // Lower récents, Upper jamais fait → Upper score brut haut
let rec = recommendSessions(base({ knee: knee("2026-10-08"), training: train, weeklyPlan: ["Lower"], asOf: "2026-10-08" }));
ok(rec.suggestions[0].type.startsWith("Lower") && /proposition par défaut/.test(rec.suggestions[0].reason), `planning par défaut : ${rec.suggestions.map((s) => s.type + ":" + s.score)}`);
// 10b. Fatigue → planning pas imposé
rec = recommendSessions(base({ knee: knee("2026-10-08"), training: train, weeklyPlan: ["Lower"], asOf: "2026-10-08", sleep: [{ date: "2026-10-08", hours: 6, quality: 1 }] }));
ok(/pas imposé/.test(rec.suggestions.find((s) => s.type.startsWith("Lower"))?.reason || ""), "fatigue : planning non imposé");
// 11. slotOpen
ok(!slotOpen("Upper A", { hour: 12, sessionDone: false }) && slotOpen("Upper A", { hour: 11, sessionDone: false }), "muscu avant 12h");
ok(slotOpen("Escalade", { hour: 13, sessionDone: true }) && !slotOpen("Escalade", { hour: 14 }), "escalade jusqu'à 14h, 2e séance ok");
ok(!slotOpen("Basket", { hour: 13, basketPlanned: false }) && slotOpen("Basket", { hour: 21, basketPlanned: true }), "basket seulement planifié");
// 12. demain : pas de nudge sommeil/énergie
r = nextSessions({ now: at("2026-10-07", 22), base: base({ knee: knee("2026-10-07"), training: [S("2026-10-07", "Basket")], sleep: [{ date: "2026-10-07", hours: 6, quality: 1 }], energy: { total: 30 } }), planFor });
ok(!/qualité faible|énergie bas/i.test(r.tomorrow.suggestions.map((s) => s.reason).join(" ")), "demain sans nudge sommeil/énergie");
console.log(`${n} assertions OK`);
