import assert from "node:assert/strict";
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { recommendTargets, palierWeekOf, splitDelta, loggedRateLastDays, PALIER } = await import(`${P}/palier.js`);
const { recompZone } = await import(`${P}/tdee.js`);
const { buildCoachPrompt } = await import(`${P}/coach/prompt.js`);
const { DEFAULT_TARGETS } = await import(`${P}/targets.js`);
const { SCHEMES } = await import(`${P}/climbing.js`);
const { today, shiftDateKey } = await import(`${P}/dateUtils.js`);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const T = { protein: 210, carbs: 270, fat: 90, fiber: 35 };
const reading = (deficit) => ({ status: "ok", reading: { deficit, ...recompZone(deficit) } });
const recomp = (d14, d21 = d14) => ({ j14: reading(d14), j21: reading(d21) });
const trend = (d1, d2) => ({ deltaWeek: d1, deltaWeekPrev: d2 });
const now = new Date(2026, 9, 1, 10, 0); // jeudi 1er oct 2026
const run = (o) => recommendTargets({ now, targets: T, targetHistory: [], loggedRate7: 1, ...o });
// 1. perte 0,4 kg/sem × 2 (déficit en zone) → +150
let r = run({ recomp: recomp(250), trend: trend(-0.4, -0.45) });
ok(r.action === "up" && r.deltaKcal === 150, "perte rapide ×2 → +150");
// 2. déficit 600 → +200
r = run({ recomp: recomp(600, 580), trend: trend(-0.2, -0.1) });
ok(r.action === "up" && r.deltaKcal === 200 && r.proposed.carbs === 310 && r.proposed.fat === 95, `déficit 600 → +200 (G ${r.proposed.carbs}, L ${r.proposed.fat})`);
// 3. poids en hausse 2 semaines → −100
r = run({ recomp: recomp(150), trend: trend(0.2, 0.15) });
ok(r.action === "down" && r.deltaKcal === -100 && r.proposed.carbs === 250 && r.proposed.fat === 85, `hausse ×2 → −100 (G ${r.proposed.carbs}, L ${r.proposed.fat})`);
// 4. observation J+9 → hold même avec déficit 600
r = run({ recomp: recomp(600), trend: trend(-0.5, -0.5), targetHistory: [{ date: shiftDateKey("2026-10-01", -9), kcal: 2800 }] });
ok(r.action === "hold" && /Observation.*J\+9\/14/.test(r.blocked) && r.observation.until === shiftDateKey("2026-10-01", 5), "observation J+9 bloque");
// 5. 60 % loggé → hold
r = run({ recomp: recomp(600), trend: trend(-0.5, -0.5), loggedRate7: 0.6 });
ok(r.action === "hold" && /60 %/.test(r.blocked), "60 % loggé bloque");
// 6. 14 j visée / 21 j trop → hold divergence
r = run({ recomp: recomp(200, 650), trend: trend(-0.2, -0.2) });
ok(r.action === "hold" && /désaccord/.test(r.blocked), "fenêtres en désaccord bloque");
// 6b. zones adjacentes (visée / haut) → lecture cohérente, moyenne décide
r = run({ recomp: recomp(280, 340), trend: trend(-0.2, -0.2) });
ok(r.action === "up" && r.deltaKcal === 150, "visée/haut adjacentes, moyenne 310 → +150");
// 7. surplus → −100 ; zone visée → hold sans blocked ; sous la zone → hold
ok(run({ recomp: recomp(-80), trend: trend(0.1, -0.1) }).action === "down", "surplus → −100");
r = run({ recomp: recomp(200), trend: trend(-0.15, -0.1) });
ok(r.action === "hold" && r.blocked === null && /maintenir/i.test(r.reasons.at(-1)), "zone visée → maintenir (non bloqué)");
ok(run({ recomp: recomp(50), trend: trend(-0.1, -0.1) }).action === "hold", "sous la zone → maintenir");
// 8. répartition +150 → +30 G / +5 L ; plafond ±200 ; protéines/fibres intactes
const s = splitDelta(150, T);
ok(s.carbs === 300 && s.fat === 95 && s.protein === 210 && s.fiber === 35, `split +150 → G ${s.carbs} L ${s.fat}`);
ok(PALIER.MAX_STEP === 200, "plafond 200");
// 9. weekOf : dimanche 4/10 13:59 → lundi 28/09 ; 14:01 → lundi 5/10 ; jeudi 1/10 → lundi 28/09 ; lundi 5/10 → 5/10
ok(palierWeekOf(new Date(2026, 9, 4, 13, 59)) === "2026-09-28", "dim 13h59 → lundi en cours");
ok(palierWeekOf(new Date(2026, 9, 4, 14, 1)) === "2026-10-05", "dim 14h01 → lundi suivant");
ok(palierWeekOf(now) === "2026-09-28" && palierWeekOf(new Date(2026, 9, 5, 8)) === "2026-10-05", "jeudi / lundi");
// 10. loggedRateLastDays : 5 des 7 jours terminés → 0.714 ; aujourd'hui ignoré
const t0 = today(); const kb = {}; [1, 2, 3, 5, 7].forEach((i) => { kb[shiftDateKey(t0, -i)] = 2000; }); kb[t0] = 500;
ok(Math.abs(loggedRateLastDays(kb, t0) - 5 / 7) < 1e-9, "loggedRate 5/7, jour en cours ignoré");
// 11. prompt : palier_semaine + consigne quand fourni ; rien sinon
const base = { weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "", journal: "", scheme: SCHEMES.gym, basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false };
const pal = { weekOf: "2026-09-28", result: run({ recomp: recomp(600), trend: trend(-0.2, -0.1) }), appliedAt: null };
const pr = buildCoachPrompt({ ...base, phase: "recomposition", palier: pal }, "");
ok(pr.user.includes('"palier_semaine"') && pr.user.includes("ne propose JAMAIS un autre palier"), "palier_semaine + consigne");
const pr0 = buildCoachPrompt({ ...base, phase: "seche" }, "");
ok(!pr0.user.includes("palier"), "sèche sans palier : rien");
console.log(`${n} assertions OK`);
