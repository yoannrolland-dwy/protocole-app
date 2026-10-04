import assert from "node:assert/strict";
const P = "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src";
const { TEMPLATES, TYPES } = await import(`${P}/session/templates.js`);
const { recommendSessions } = await import(`${P}/recommender.js`);
const { computeInsights } = await import(`${P}/insights.js`).catch(() => ({}));
const { today, shiftDateKey } = await import(`${P}/dateUtils.js`);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// 1. Plus aucune série > 12 reps en Upper A/B (hors temps/HSR)
const maxRep = (r) => Math.max(...String(r).match(/\d+/g).map(Number));
for (const t of ["Upper A", "Upper B", "Lower B"]) for (const e of TEMPLATES[t].exos) if (e.mode === "reps" && e.r !== "table HSR") ok(maxRep(e.r) <= 12, `${t} · ${e.n} ${e.r}`);
// 2. Exercices/séries Upper inchangés sauf curls poignets (2 séries)
ok(TEMPLATES["Upper A"].exos.length === 8 && TEMPLATES["Upper B"].exos.length === 8, "8 exos chacun");
ok(TEMPLATES["Upper A"].exos.find((e) => e.n === "Développé incliné haltères").r === "8-10" && TEMPLATES["Upper A"].exos.find((e) => e.n === "Rowing barre ou machine").s === 4, "développés 8-10, dos 4 séries");
ok(TEMPLATES["Upper A"].exos.find((e) => e.n.startsWith("Curl poignets")).s === 2, "curls poignets 2 séries");
// 3. Full Body
const FB = TEMPLATES["Full Body"];
ok(TYPES.includes("Full Body") && FB.hsr && FB.chargeTags.includes("genou"), "Full Body existe, HSR, tag genou");
ok(FB.exos.map((e) => e.n).join("|") === "Presse à cuisses (HSR)|Mollets à la presse|Leg extension unilatérale|Soulevé de terre roumain|Hip thrust|Développé incliné haltères|Rowing barre ou machine|Élévations latérales haltères", "ordre et contenu du Full Body");
// 4. Recommandeur : postMatch → Full Body (avec bonus planning), sinon inchangé
const t0 = today();
const knee = [{ date: t0, pain: 2, baseline: true }];
const base = { training: [], knee, sleep: [], targets: { cut: {} }, scheme: undefined };
let r = recommendSessions({ ...base, postMatch: true, weeklyPlan: ["Full Body"] });
ok(r.suggestions.some((s) => s.type === "Full Body") && !r.suggestions.some((s) => s.type.startsWith("Lower")), "postMatch → Full Body suggéré, pas de Lower");
ok(/Planning idéal du jour : Full Body/.test(r.suggestions.find((s) => s.type === "Full Body").reason), "bonus planning appliqué");
r = recommendSessions({ ...base, matchWeek: true });
ok(r.suggestions.some((s) => s.type === "Lower C") && !r.suggestions.some((s) => s.type === "Full Body"), "sans postMatch : Lower C comme avant");
r = recommendSessions({ ...base, postMatch: true, knee: [{ date: t0, pain: 7, baseline: false }] });
ok(r.avoid.some((a) => a.type === "Full Body" && /haut du corps/.test(a.reason)), "genou rouge → Full Body à éviter, conseil haut du corps");
// 5. Full Body fait aujourd'hui → ni Lower ni Upper re-suggérés
r = recommendSessions({ ...base, training: [{ date: t0, type: "Full Body", exercices: [] }] });
ok(r.avoid.some((a) => /Lower déjà fait/.test(a.reason)) && r.suggestions.find((s) => s.type.startsWith("Upper"))?.score < 10, "Full Body loggé → compte comme Upper ET Lower");
console.log(`${n} assertions OK`);
