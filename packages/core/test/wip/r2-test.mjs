import assert from "node:assert/strict";
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { recompZone, recompReading } = await import(`${P}/tdee.js`);
const { recompWindows, DEFAULT_TARGETS } = await import(`${P}/targets.js`);
const { buildCoachPrompt } = await import(`${P}/coach/prompt.js`);
const { SCHEMES } = await import(`${P}/climbing.js`);
const { today, shiftDateKey } = await import(`${P}/dateUtils.js`);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// 1. bornes du barème
const z = (d) => recompZone(d)?.zone;
ok(z(-50) === "surplus" && z(0) === "surplus", "≤0 surplus");
ok(z(1) === "sous" && z(99) === "sous", "0-100 sous");
ok(z(100) === "visee" && z(200) === "visee" && z(300) === "visee", "100-300 visée (bornes incluses)");
ok(z(301) === "haut" && z(500) === "haut", "300-500 haut (500 inclus)");
ok(z(501) === "trop" && z(900) === "trop", ">500 trop");
ok(recompZone(null) === null && recompReading({ status: "insufficient" }) === null, "null si pas de chiffre");
ok(recompReading({ status: "ok", tdee: 2800, meanIntake: 2590 }).deficit === 210, "deficit = tdee − apports");
// 2. recompWindows sur un historique synthétique (30 j, perte ~0,3 kg/sem, 2500 kcal/j)
const t0 = today();
const weight = Array.from({ length: 30 }, (_, i) => ({ date: shiftDateKey(t0, -i), kg: 94 + i * 0.043 }));
const macros = Array.from({ length: 30 }, (_, i) => ({ date: shiftDateKey(t0, -i), protein: 200, carbs: 260, fat: 80, fiber: 35, kcal: 2500 }));
const rw = recompWindows({ foodLog: [], overrides: {}, macros, weight, targets: DEFAULT_TARGETS });
ok(rw.j14.status === "ok" && rw.j21.status === "ok", "14 et 21 j calculés");
ok(rw.j14.reading.deficit === rw.j14.tdee - rw.j14.meanIntake, "lecture cohérente 14 j");
ok(["visee", "haut"].includes(rw.j14.reading.zone), `zone plausible 14 j (${rw.j14.reading.zone}, déficit ${rw.j14.reading.deficit})`);
console.log("recompWindows :", { j14: [rw.j14.tdee, rw.j14.meanIntake, rw.j14.reading.deficit, rw.j14.reading.zone], j21: [rw.j21.tdee, rw.j21.meanIntake, rw.j21.reading.deficit, rw.j21.reading.zone] });
// 3. prompt : recomposition + historique de paliers
const base = { weight, sleep: [], training: [], knee: [], macros, notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "", journal: "", scheme: SCHEMES.gym, basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false };
const hist = [{ date: shiftDateKey(t0, -5), kcal: 2800, protein: 210, carbs: 270, fat: 90, fiber: 35, source: "manual" }, { date: shiftDateKey(t0, -120), kcal: 2600, protein: 210, carbs: 230, fat: 85, fiber: 35, source: "manual" }];
const pr = buildCoachPrompt({ ...base, phase: "recomposition", targetHistory: hist }, "");
const summary = JSON.parse(pr.user.split("RÉSUMÉ 14 JOURS (moyennes fiables, tendance de fond) :\n")[1].split("\n\nJOUR PAR JOUR")[0]);
ok(summary.depense_estimee.recomposition?.j14?.zone, "summary.depense_estimee.recomposition présent");
ok(summary.paliers?.length === 1 && summary.paliers[0].kcal === 2800, "paliers : seulement l'entrée < 90 j");
ok(pr.user.includes("PALIERS DE CIBLES") && pr.user.includes("depense_estimee.recomposition"), "consignes paliers + recomposition dans le user");
const pr2 = buildCoachPrompt({ ...base, phase: "seche", targetHistory: [] }, "");
ok(!pr2.user.includes("PALIERS") && !pr2.user.includes("recomposition"), "sèche sans historique : aucun bloc ajouté");
const pr3 = buildCoachPrompt({ ...base, phase: "seche", targetHistory: hist }, "");
ok(pr3.user.includes("PALIERS DE CIBLES") && !pr3.user.includes("depense_estimee.recomposition"), "sèche AVEC historique : paliers oui, zone recomposition non");
console.log(`${n} assertions OK`);
