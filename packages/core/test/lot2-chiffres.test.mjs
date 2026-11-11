// Audit du 10/11/2026, lot 2 (chiffres faux ou trompeurs), points 6 à 12 et 15 côté cœur.
// Chaque test reproduit l'erreur décrite dans le rapport, avec des données fictives.
// Horloge figée au dimanche 04/10/2026 10:00 (T0).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { fixClock, T0, d, at, BS, planFor, summaryOf } from "./_helpers.mjs";
import { syncMacroLog } from "../src/nutrition/foodStore.js";
import { DEFAULT_TARGETS, weeklyKcalTrend, weeklyProteinTrend, kcalTargetOn, buildKcalByDate, hasIntake } from "../src/targets.js";
import { dailyKcal, regularity } from "../src/nutritionStats.js";
import { buildCoachPrompt, buildBilanPrompt, last14 } from "../src/coach/prompt.js";
import { recommendSessions } from "../src/recommender.js";
import { progressiveOverloadSuggestion, exerciseSessions } from "../src/training.js";
import { getOFFByBarcode } from "../src/nutrition/off.js";
import { fiberWeightStagnationCorrelation, computeBilanFacts } from "../src/bilan.js";
import { nextSessions } from "../src/nextSession.js";
import { newSessionDraft, logSet } from "../src/session/voiceSession.js";
import { medianTarget, seriesTarget } from "../src/session/perf.js";
import { parseSecs } from "../src/session/templates.js";
import { addSet } from "../src/session/engine.js";
import { shiftDateKey } from "../src/dateUtils.js";

before(() => fixClock());

const line = (date, meal = "dejeuner") => ({ id: `${date}-${meal}`, date, meal, ref: "ciqual:1", name: "Aliment fictif", q: 100,
  per100: { kcal: 500, prot: 40, gluc: 50, lip: 10, fib: 5 } });
const base = { weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [],
  foodOverrides: {}, profile: "", journal: "", basketSchedule: { weekly: [], matchDates: [] }, weeklyPlan: [], energy: null, matchWeek: false, phase: "recomposition" };

// --- Point 6 : jour vidé de ses aliments -------------------------------------------------------

test("point 6 : dernière ligne d'un jour supprimée → ses macros partent, l'eau reste", () => {
  const filled = syncMacroLog([{ date: T0, water: 750, source: "manual" }], [line(T0)], []);
  const day = filled.macros.find((m) => m.date === T0);
  assert.deepEqual([day.kcal, day.protein, day.water, day.source], [500, 40, 750, "foodlog"]);
  // Avant : la dérivation ne regardait que les dates présentes dans le journal → 500 kcal restaient.
  const emptied = syncMacroLog(filled.macros, [], [T0]);
  assert.equal(emptied.changed, true);
  assert.deepEqual(emptied.macros, [{ date: T0, water: 750, source: "manual" }]);
});

test("point 6 : ajout annulé sur un jour sans eau → la ligne du jour disparaît", () => {
  const filled = syncMacroLog([], [line(T0)], []);
  assert.deepEqual(syncMacroLog(filled.macros, [], [T0]).macros, []);
});

test("point 6 : garde-fous — historique d'avant le module, saisie manuelle et dates non vues intacts", () => {
  const macros = [
    { date: d(90), protein: 180, carbs: 200, fat: 70, source: "healthconnect" }, // Cronometer
    { date: d(3), protein: 150, carbs: 100, fat: 50, source: "manual" },
    { date: d(2), protein: 40, carbs: 50, fat: 10, fiber: 5, kcal: 500, source: "foodlog" },
  ];
  // Journal vide au chargement (illisible, par exemple) : aucune date n'a été vue → rien n'est vidé.
  const r1 = syncMacroLog(macros, [], []);
  assert.equal(r1.changed, false);
  assert.equal(r1.macros, macros);
  // Dates vues puis absentes : seules les lignes « foodlog » sont touchées.
  const r2 = syncMacroLog(macros, [], [d(90), d(3), d(2)]);
  assert.deepEqual(r2.macros, macros.slice(0, 2));
});

test("point 6 : la dépense ne relit pas en 4/4/9 un total resté sans journal", () => {
  const macros = [
    { date: d(2), protein: 200, carbs: 250, fat: 85, kcal: 2700, source: "foodlog" }, // jour vidé, total resté
    { date: d(90), protein: 180, carbs: 200, fat: 70, source: "healthconnect" },
  ];
  const kcal = buildKcalByDate({ foodLog: [line(d(1))], overrides: {}, macros, today: T0 });
  assert.equal(kcal[d(2)], undefined);
  assert.equal(kcal[d(1)], 500);
  assert.equal(kcal[d(90)], 180 * 4 + 200 * 4 + 70 * 9);
});

// --- Point 7 : repas planifiés comptés dans la semaine en cours --------------------------------

test("point 7 : deux jours planifiés ne tirent plus la moyenne de la semaine (133 → 200 g)", () => {
  const end = "2026-10-02"; // vendredi ; semaine du lundi 28/09
  const day = (date, protein, kcal) => ({ date, protein, carbs: 250, fat: 85, kcal, source: "foodlog" });
  const macros = [
    ...["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"].map((k) => day(k, 200, 2700)),
    day(end, 60, 800),            // aujourd'hui, en cours
    day("2026-10-03", 0, 300),    // samedi planifié
    day("2026-10-04", 0, 300),    // dimanche planifié
  ];
  const prot = weeklyProteinTrend(macros, { weeks: 1, endDate: end })[0];
  assert.equal(Math.round((200 * 4 + 0 + 0) / 6), 133); // l'ancien calcul
  assert.deepEqual([prot.avgProtein, prot.days], [200, 4]);
  // Kcal : aujourd'hui reste compté (règle du 13/09/2026), les jours à venir non.
  const kc = weeklyKcalTrend(macros, { weeks: 1, endDate: end })[0];
  assert.deepEqual([kc.avgKcal, kc.days], [Math.round((2700 * 4 + 800) / 5), 5]);
});

test("point 15 : un jour avec de l'eau seule n'est pas un jour à 0 kcal", () => {
  const end = "2026-10-02";
  const macros = [{ date: "2026-09-29", protein: 200, carbs: 250, fat: 85, kcal: 2700 }, { date: "2026-09-30", water: 1500, source: "manual" }];
  assert.equal(hasIntake(macros[1]), false);
  assert.deepEqual(weeklyKcalTrend(macros, { weeks: 1, endDate: end })[0], { weekStart: "2026-09-28", avgKcal: 2700, days: 1 });
});

// --- Point 8 : la moyenne 7 jours donnée à Jeffrey -----------------------------------------------

test("point 8 : moyenne 7 j sur les jours terminés (175 → 200 g le matin), pas compris", () => {
  const macros = [
    { date: T0, protein: 25, carbs: 30, fat: 10, kcal: 300, water: 250, source: "foodlog" }, // ce matin
    ...Array.from({ length: 7 }, (_, i) => ({ date: d(i + 1), protein: 200, carbs: 250, fat: 85, kcal: 2700, water: 2000, source: "foodlog" })),
    { date: shiftDateKey(T0, 1), protein: 10, carbs: 10, fat: 5, kcal: 120, source: "foodlog" }, // demain, planifié
  ];
  const steps = [{ date: T0, count: 1200 }, ...Array.from({ length: 7 }, (_, i) => ({ date: d(i + 1), count: 9000 }))];
  assert.equal(Math.round((25 + 200 * 6) / 7), 175); // l'ancien calcul (aujourd'hui + 6 jours)
  const s = summaryOf(buildCoachPrompt({ ...base, macros, steps }, "").user);
  assert.equal(s.macros_moy_7j.proteines, 200);
  assert.equal(s.macros_moy_7j.eau_ml, 2000);
  assert.equal(s.pas_moy_7j, 9000);
});

// --- Point 9 : cible du jour concerné ------------------------------------------------------------

const KCAL_NOW = 2925;
const targetsNow = { ...DEFAULT_TARGETS, protein: 200, carbs: 300, fat: 95, fiber: 35, cut: { ...DEFAULT_TARGETS.cut, enabled: false } };
const history = [
  { date: d(20), kcal: 2800, prevKcal: 2600, protein: 200, carbs: 280, fat: 90, fiber: 35, source: "manual" },
  { date: d(5), kcal: KCAL_NOW, prevKcal: 2800, protein: 200, carbs: 300, fat: 95, fiber: 35, source: "palier" },
];

test("point 9 : cible en vigueur chaque jour d'après l'historique des paliers", () => {
  assert.equal(kcalTargetOn(T0, targetsNow, history), KCAL_NOW);
  assert.equal(kcalTargetOn(d(5), targetsNow, history), KCAL_NOW); // le jour du palier vaut pour le jour entier
  assert.equal(kcalTargetOn(d(6), targetsNow, history), 2800);
  assert.equal(kcalTargetOn(d(20), targetsNow, history), 2800);
  assert.equal(kcalTargetOn(d(21), targetsNow, history), 2600);    // avant le premier changement : son `prevKcal`
  assert.equal(kcalTargetOn(d(6), targetsNow, []), KCAL_NOW);      // sans historique : comme avant
  assert.equal(kcalTargetOn(d(6), targetsNow, [{ date: d(5), kcal: KCAL_NOW }]), KCAL_NOW); // repère absent : cible actuelle
});

test("point 9 : après un palier, les jours d'avant ne paraissent plus hors cible", () => {
  // 10 jours terminés à 2800 kcal, la cible de l'époque ; palier à 2925 il y a 5 jours.
  const macros = Array.from({ length: 10 }, (_, i) => ({ date: d(i + 6), protein: 200, carbs: 280, fat: 90, fiber: 35, kcal: 2800, source: "foodlog" }));
  const tight = { ...targetsNow, carbs: 400 }; // cible actuelle fictive très au-dessus (3325), pour un écart net
  const hist = [{ date: d(5), kcal: 3325, prevKcal: 2800, source: "manual" }];
  assert.equal(regularity({ macros, foodLog: [], targets: tight }).inRange, 0);                       // avant : tous hors cible
  assert.equal(regularity({ macros, foodLog: [], targets: tight, targetHistory: hist }).inRange, 10); // cible de chaque jour
  const days = dailyKcal(macros, tight, { targetHistory: hist });
  assert.equal(days.find((x) => x.date === d(6)).target, 2800);
  assert.equal(days.find((x) => x.date === T0).target, 3325);
  // Jeffrey : `cible_kc` du jour par jour suit la même règle.
  const user = buildCoachPrompt({ ...base, macros, targets: tight, targetHistory: hist }, "").user;
  const rows = JSON.parse(user.split("JOUR PAR JOUR")[1].split("\n")[1]); // la ligne JSON sous le titre
  assert.equal(rows.find((r) => r.d === d(6).slice(5)).cible_kc, 2800);
});

// --- Point 10 : petit dormeur, phrases périmées ------------------------------------------------

test("point 10 : aucune durée de nuit présentée comme un signal ; règles retirées absentes du contexte", () => {
  const sleep = Array.from({ length: 7 }, (_, i) => ({ date: d(i), hours: 5.2, quality: 4 }));
  const p = buildCoachPrompt({ ...base, sleep }, "");
  const s = summaryOf(p.user);
  assert.deepEqual(Object.keys(s.sommeil).sort(), ["heures_moy_7j", "qualite_moy_7j"]);
  assert.doesNotMatch(p.user + p.system, /pire_nuit|nuits_sous_6h/);
  assert.doesNotMatch(p.system, /expositions genou|jour d'un Upper/);
  assert.match(p.system, /tirage ou de flexion du coude/);
  // Recommandeur : deux nuits de mauvaise QUALITÉ → la phrase ne parle plus de nuits « courtes ».
  const bad = [{ date: T0, hours: 7.5, quality: 1 }, { date: d(1), hours: 7.5, quality: 2 }];
  const reco = recommendSessions({ training: [], knee: [{ date: T0, pain: 1, baseline: true }], sleep: bad, targets: DEFAULT_TARGETS, limit: Infinity });
  const rest = reco.suggestions.find((x) => x.type === "Mobilité");
  assert.match(rest.reason, /2 nuits de mauvaise qualité/);
  assert.doesNotMatch(rest.reason, /courtes/);
});

// --- Point 11 : plateau sur la mobilité et la coiffe ---------------------------------------------

const flat = (nom, poids, val) => Array.from({ length: 6 }, (_, i) => ({
  date: d((5 - i) * 5), type: "x", exercices: [{ nom, mode: "reps", series: [{ poids, val, fait: true }, { poids, val, fait: true }] }] }));

test("point 11 : plus de « charge supérieure » sur la rotation externe d'épaule ni la cheville au mur", () => {
  for (const nom of ["Rotation externe épaule poulie basse", "Cheville : genou au mur"]) {
    const sessions = exerciseSessions(flat(nom, 5, 12), nom);
    assert.equal(sessions.length, 6);
    assert.equal(progressiveOverloadSuggestion(sessions, nom), null, nom);
  }
});

test("point 11 : comportement inchangé ailleurs — exercice classique et squat sur sécurités", () => {
  const incline = "Développé incliné haltères";
  const r = progressiveOverloadSuggestion(exerciseSessions(flat(incline, 30, 8), incline), incline);
  assert.deepEqual([r.kind, r.target, r.sessions], ["reps", 10, 6]);
  // Question ouverte du rapport, non tranchée : le squat sur sécurités garde la règle commune.
  const squat = "Squat sur sécurités";
  const q = progressiveOverloadSuggestion(exerciseSessions(flat(squat, 80, 6), squat), squat);
  assert.deepEqual([q.kind, q.sessions], ["poids", 6]);
});

// --- Point 12 : échec réseau du scan gardé en mémoire --------------------------------------------

test("point 12 : un échec réseau n'est pas gardé — le même code rescanné, réseau revenu, est trouvé", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0, online = false;
  globalThis.fetch = async () => {
    calls++;
    if (!online) throw new Error("réseau coupé");
    return { ok: true, json: async () => ({ status: 1, product: { code: "3000000000017", product_name: "Produit fictif", nutriments: { "energy-kcal_100g": 120 } } }) };
  };
  try {
    const opts = { retryDelays: [] }; // pas d'attente dans le test
    const ko = await getOFFByBarcode("3000000000017", opts);
    assert.equal(ko.error, true);
    online = true;
    const ok = await getOFFByBarcode("3000000000017", opts); // avant : l'échec revenait du cache
    assert.equal(ok.error, false);
    assert.equal(ok.item.name.includes("Produit fictif"), true);
    const n = calls;
    await getOFFByBarcode("3000000000017", opts); // un produit trouvé reste en mémoire
    assert.equal(calls, n);
    // Un produit réellement inconnu reste en mémoire aussi.
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ status: 0 }) }; };
    assert.equal((await getOFFByBarcode("3000000000024", opts)).notFound, true);
    const m = calls;
    assert.equal((await getOFFByBarcode("3000000000024", opts)).notFound, true);
    assert.equal(calls, m);
  } finally { globalThis.fetch = realFetch; }
});

// --- Point 15 : petits écarts --------------------------------------------------------------------

test("point 15 : bilan — une semaine de PRISE de poids n'est plus une « semaine de perte »", () => {
  const weight = [], macros = [];
  // 3 semaines stables (fibres 20), 3 semaines de perte (fibres 40), 3 semaines de prise (fibres 60).
  const kinds = ["stable", "perte", "prise", "stable", "perte", "prise", "stable", "perte", "prise"];
  kinds.forEach((k, w) => {
    const end = shiftDateKey(T0, -w * 7), start = shiftDateKey(end, -6);
    const delta = k === "stable" ? 0 : k === "perte" ? -0.5 : 0.5;
    weight.push({ date: start, kg: 95 }, { date: end, kg: 95 + delta });
    for (let i = 1; i <= 4; i++) macros.push({ date: shiftDateKey(start, i), fiber: k === "stable" ? 20 : k === "perte" ? 40 : 60 });
  });
  const r = fiberWeightStagnationCorrelation(weight, macros, T0, 63);
  assert.deepEqual([r.stagnantWeeksN, r.droppingWeeksN], [3, 3]);
  assert.equal(r.stagnantWeeksAvgFiber, 20);
  assert.equal(r.droppingWeeksAvgFiber, 40); // avant : 50, les semaines de prise (60 g) y étaient mêlées
});

test("point 15 : bilan — moyenne kcal sur les 7 jours de la semaine, plus du lundi au vendredi", () => {
  const macros = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map((date) => ({ date, protein: 200, carbs: 250, fat: 85, kcal: 2000 }))
    .concat(["2026-09-26", "2026-09-27"].map((date) => ({ date, protein: 200, carbs: 400, fat: 120, kcal: 4000 })));
  const facts = computeBilanFacts({ training: [], knee: [], weight: [], macros, sleep: [], rhr: [], steps: [], targets: DEFAULT_TARGETS, foodLog: [], overrides: {}, todayDate: T0 });
  assert.equal("kcalSemaineLunVen" in facts, false);
  const week = facts.kcalSemaine.find((w) => w.weekStart === "2026-09-21");
  assert.deepEqual([week.avgKcal, week.days], [Math.round((2000 * 5 + 4000 * 2) / 7), 7]);
  const bilan = buildBilanPrompt({ facts, phase: "recomposition", targets: DEFAULT_TARGETS, profile: "", notes: [] });
  assert.match(bilan.user, /"kcal_semaine":\[/);
  assert.doesNotMatch(bilan.user, /lun_ven/);
});

test("point 15 : un jour planifié (à venir) n'apparaît plus comme passé dans les 14 jours", () => {
  const tomorrow = shiftDateKey(T0, 1);
  assert.deepEqual(last14([{ date: d(15) }, { date: d(14) }, { date: T0 }, { date: tomorrow }]).map((e) => e.date), [d(14), T0]);
  const macros = [{ date: d(1), protein: 200, carbs: 250, fat: 85, kcal: 2700 }, { date: tomorrow, protein: 90, carbs: 100, fat: 30, kcal: 1100 }];
  const user = buildCoachPrompt({ ...base, macros }, "").user;
  assert.doesNotMatch(user.split("JOUR PAR JOUR")[1], new RegExp(`"d":"${tomorrow.slice(5)}"`));
});

test("point 15 : mardi, Upper fait le matin → la Mobilité prévue n'est plus dite « moins prioritaire »", () => {
  const tue = "2026-10-06";
  const training = [{ date: tue, type: "Upper A", exercices: [{ nom: "Rowing barre ou machine", series: [{ poids: 60, val: 9, fait: true }] }] }];
  // Rowing coché : escalade écartée (tirage du jour), plus de muscu → journée fermée, mobilité possible.
  const r = nextSessions({ now: at(tue, 10), base: { training, knee: [{ date: tue, pain: 1, baseline: true }], sleep: [], targets: DEFAULT_TARGETS, basketSchedule: BS }, planFor });
  assert.equal(r.today.status, "closed");
  assert.match(r.today.note, /mobilité possible/);
  const mob = r.today.notProposed.find((x) => x.type === "Mobilité");
  assert.equal(mob.kind, "priority"); // inchangé : Jeffrey et le pont s'en servent
  assert.equal(mob.reason, "Prévue au planning aujourd'hui — encore possible ce matin.");
  assert.doesNotMatch(mob.reason, /Moins prioritaire/);
});

test("point 15 : planche « 45-60 s » — 60 s partout (choix de Yoann du 11/11/2026), consigne gardée", () => {
  // Avant : 53 s préremplies dans la série (médiane) et 60 s sur le bouton « Maintien ».
  assert.equal(medianTarget("45-60 s"), 53);
  assert.equal(seriesTarget("45-60 s", "temps"), 60);
  assert.equal(parseSecs("45-60 s"), 60);
  const mob = newSessionDraft({ type: "Mobilité", training: [], hsrWeek: 9, date: T0, start: "07:00" });
  const plank = mob.exos.find((e) => e.nom === "Core — Planche");
  assert.equal(plank.target, "45-60 s");
  assert.ok(plank.series.every((s) => s.val === 60));
  assert.equal(addSet(mob.exos, mob.exos.indexOf(plank), null)[mob.exos.indexOf(plank)].series.at(-1).val, 60);
  // Rien d'autre ne bouge : reps = médiane, durées uniques inchangées.
  assert.equal(seriesTarget("10-12", "reps"), 11);
  assert.equal(seriesTarget("45 s", "temps"), 45);
  assert.equal(seriesTarget("3 min", "temps"), 180);
});

test("point 15 : séance à la voix — échauffement basket sans « repos 0 secondes », cheville au mur sans kilos", () => {
  const ctx = { training: [], knee: [], now: Date.UTC(2026, 9, 4, 8) };
  const basket = newSessionDraft({ type: "Basket", training: [], hsrWeek: 9, date: T0, start: "20:00" });
  assert.equal(basket.exos[0].rest, 0);
  const a = logSet(basket, { secondes: 180 }, ctx);
  assert.equal(a.ok, true);
  assert.equal(a.restSecs, 0);
  assert.doesNotMatch(a.phrase, /repos/);
  // Exercice en répétitions au poids du corps (Mobilité, « Cheville : genou au mur ») : avant,
  // « charge inconnue » ; la série se note sans kilos, comme à l'écran.
  const mob = newSessionDraft({ type: "Mobilité", training: [], hsrWeek: 9, date: T0, start: "07:00" });
  const ankle = mob.exos.find((e) => e.nom === "Cheville : genou au mur");
  assert.deepEqual([ankle.mode, ankle.materiel, ankle.series[0].poids], ["reps", "aucun", ""]);
  const b = logSet(mob, { reps: 10, exercice: ankle.nom }, ctx);
  assert.equal(b.ok, true, b.raison);
  assert.match(b.phrase, /10 répétitions/);
  // Un exercice chargé sans charge connue la demande toujours (rotation externe à la poulie).
  const cuff = mob.exos.find((e) => e.nom === "Rotation externe épaule poulie basse");
  const c = logSet(mob, { reps: 12, exercice: cuff.nom }, ctx);
  assert.equal(c.ok, false);
  assert.equal(c.besoin, "kg");
});
