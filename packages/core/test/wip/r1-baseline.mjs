// Capture hash du prompt coach (system+user) et du bilan pour les 3 phases existantes —
// comparé après R1 pour prouver la non-régression au caractère près.
import { createHash } from "node:crypto";
import { buildCoachPrompt, buildBilanPrompt } from "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src/coach/prompt.js";
import { DEFAULT_TARGETS } from "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src/targets.js";
import { SCHEMES } from "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src/climbing.js";
import { today, shiftDateKey } from "/Users/yrolland/Documents/GitHub/protocole-app/packages/core/src/dateUtils.js";
const t0 = today();
const days = (n) => Array.from({ length: n }, (_, i) => shiftDateKey(t0, -i));
const weight = days(28).map((d, i) => ({ date: d, kg: 95 + Math.sin(i) * 0.3 - i * 0.03 }));
const sleep = days(14).map((d, i) => ({ date: d, hours: 6 + (i % 3) * 0.4, quality: 2 + (i % 3) }));
const macros = days(14).map((d, i) => ({ date: d, protein: 200 + i, carbs: 250, fat: 85, fiber: 35, water: 2000, kcal: 2700 }));
const steps = days(14).map((d, i) => ({ date: d, count: 8000 + i * 100 }));
const training = [{ id: "a", date: shiftDateKey(t0, -1), type: "Upper A", exercices: [{ nom: "Développé couché haltères", series: [{ poids: 32, val: 9, done: true }] }] }];
const base = { weight, sleep, training, knee: [{ date: t0, pain: 2, baseline: true }], macros, notes: [], steps, targets: DEFAULT_TARGETS, foodLog: [], foodOverrides: {}, profile: "profil test", journal: "", scheme: SCHEMES.gym, basketSchedule: { weekly: [3, 5], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false };
const norm = (s) => s.replace(/"heure_analyse":"[0-9]{2}:[0-9]{2}"/, "\"heure_analyse\":\"HH:MM\"");
const h = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const out = {};
for (const phase of (process.argv[2] || "seche,maintenance,prise").split(",")) {
  const p = buildCoachPrompt({ ...base, phase }, "note test");
  const b = buildBilanPrompt({ facts: { fenetreJours: 90, test: 1 }, phase, targets: DEFAULT_TARGETS, profile: "profil test", notes: [] });
  out[phase] = { system: h(p.system), user: h(norm(p.user)), bilanSystem: h(b.system), bilanUser: h(b.user), sysLen: p.system.length };
  if (process.env.SHOW) console.log(phase, "\n", p.system.slice(0, 220), "\n", JSON.stringify(JSON.parse(p.user.split("RÉSUMÉ 14 JOURS (moyennes fiables, tendance de fond) :\n")[1].split("\n\nJOUR PAR JOUR")[0]).poids));
}
console.log(JSON.stringify(out));
