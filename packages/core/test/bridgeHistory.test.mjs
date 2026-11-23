// Pont PROTOCOLE → JEFFREY : détail par repas (macros) et lecture dans le temps (jour, periode),
// 23/11/2026. Données synthétiques, horloge figée (dimanche 4 octobre 2026).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { buildReading, BRIDGE_SUBJECTS } from "../src/coach/bridge.js";
import { mealMoment, MAX_PERIOD_DAYS } from "../src/coach/bridgeHistory.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import { shiftDateKey } from "../src/dateUtils.js";
import { fixClock, T0, d, BS, planFor, session, exo } from "./_helpers.mjs";

before(() => fixClock());

const plus = (n) => shiftDateKey(T0, n);
const food = (date, meal, name, q, per100, extra = {}) => ({ date, meal, ref: `custom:${name}`, name, q, per100, ...extra });
const AVOINE = { kcal: 400, prot: 15, gluc: 60, lip: 8, fib: 10 };
const POULET = { kcal: 150, prot: 30, gluc: 0, lip: 3, fib: 0 };
const PATES = { kcal: 350, prot: 12, gluc: 70, lip: 2, fib: 3 };

const foodLog = [
  food(T0, "petitdej", "Avoine", 100, AVOINE),
  food(T0, "dejeuner", "Poulet", 200, POULET),
  food(T0, "diner", "Pâtes", 200, PATES),
  food(T0, "pretraining", "Avoine", 50, AVOINE),
  food(d(1), "diner", "Poulet", 100, POULET),
  food(plus(2), "dejeuner", "Pâtes", 150, PATES),
];
const data = {
  foodLog, overrides: {},
  macros: [
    { date: d(2), protein: 150, carbs: 200, fat: 70, fiber: 25, kcal: 2100, water: 2500, source: "foodlog" },
    { date: d(1), protein: 30, carbs: 0, fat: 3, fiber: 0, kcal: 150, water: 1800, source: "foodlog" },
    { date: T0, protein: 0, carbs: 0, fat: 0, fiber: 0, kcal: 0, water: 500, source: "foodlog" },
  ],
  steps: [{ date: d(2), count: 8000 }, { date: d(1), count: 12000 }, { date: T0, count: 1500 }],
  sleep: [{ date: d(2), hours: 5.5, quality: 3 }, { date: d(1), hours: 6, quality: 4 }],
  weight: [{ date: d(2), kg: 94.2 }, { date: d(1), kg: 93.8 }],
  knee: [{ date: d(2), pain: 2, baseline: true }, { date: d(1), pain: 4, baseline: false }],
  rhr: [{ date: d(1), bpm: 50 }],
  naps: [{ date: d(1), minutes: 20 }],
  notes: [{ date: d(1), text: "bonne forme" }],
  training: [session(d(1), "Upper A", [exo("Rowing", true, 60, 10)]), { ...session(d(1), "Basket"), duration: 90, rpe: 7 }],
  targets: DEFAULT_TARGETS, targetHistory: [], basketSchedule: BS,
};
const coach = { facts: { system: "Contexte synthétique.", realtime: {}, summary: {} } };
const ctx = (extra = {}) => ({
  date: T0, heure: "09:00", coach, missing: ["genou"], reminders: [], data, planFor,
  nextSession: { today: { status: "open", suggestions: [{ type: "Mobilité", reason: "r" }], avoid: [], notProposed: [] }, tomorrow: { date: plus(1), suggestions: [{ type: "Lower A", reason: "r" }], avoid: [], notProposed: [] } },
  ...extra,
});

test("moment d'un repas : horaires de Yoann (petit-déj avant 10 h, 12-14, 16-17, 19-20)", () => {
  const today = (meal, heure) => mealMoment(meal, { statut: "aujourdhui", heure });
  assert.equal(today("petitdej", "09:59"), "en_cours");
  assert.equal(today("petitdej", "10:00"), "passe");
  assert.equal(today("dejeuner", "11:59"), "a_venir");
  assert.equal(today("dejeuner", "13:59"), "en_cours");
  assert.equal(today("dejeuner", "14:00"), "passe");
  assert.equal(today("gouter", "16:30"), "en_cours");
  assert.equal(today("diner", "18:00"), "a_venir");
  assert.equal(today("diner", "20:00"), "passe");
  for (const m of ["pretraining", "posttraining", "autre"]) assert.equal(today(m, "12:00"), "sans_horaire");
  assert.equal(mealMoment("diner", { statut: "passe", heure: "09:00" }), "fait");
  assert.equal(mealMoment("petitdej", { statut: "futur", heure: "09:00" }), "prevu");
});

test("macros à 9 h : détail par repas, le dîner saisi n'est pas compté comme passé ; rien d'existant ne bouge", () => {
  const r = buildReading("macros", ctx()).faits;
  // Champs existants toujours là, dans le même ordre, puis les deux nouveaux.
  assert.deepEqual(Object.keys(r), ["heure", "phase", "cible", "consomme", "reste", "repas_aujourdhui", "par_repas", "total_passe_ou_en_cours", "moyenne_7j", "depense_estimee", "palier_semaine"]);
  assert.deepEqual(Object.keys(r.par_repas), ["pretraining", "petitdej", "dejeuner", "diner"]);
  assert.deepEqual(r.par_repas.petitdej, { libelle: "Petit-déjeuner", moment: "en_cours", horaire: "avant 10 h", kcal: 400, proteines: 15, glucides: 60, lipides: 8, fibres: 10, aliments: ["Avoine 100g"] });
  assert.equal(r.par_repas.dejeuner.moment, "a_venir");
  assert.equal(r.par_repas.dejeuner.kcal, 300);
  assert.equal(r.par_repas.diner.moment, "a_venir");
  assert.equal(r.par_repas.pretraining.moment, "sans_horaire");
  assert.equal(r.par_repas.pretraining.horaire, null);
  // Seul le petit-déjeuner (en cours) compte : ni le dîner prévu, ni le pré-training sans horaire.
  assert.equal(r.total_passe_ou_en_cours.kcal, 400);
  assert.equal(r.total_passe_ou_en_cours.proteines, 15);
});

test("macros à 20 h : tous les repas à horaire sont passés", () => {
  const r = buildReading("macros", ctx({ heure: "20:00" })).faits;
  assert.equal(r.par_repas.diner.moment, "passe");
  assert.equal(r.total_passe_ou_en_cours.kcal, 400 + 300 + 700);
});

test("macros : corrections d'aliments appliquées, donnée absente signalée « incomplet »", () => {
  const log = [food(T0, "petitdej", "Avoine", 100, AVOINE), food(T0, "petitdej", "Inconnu", 50, { kcal: null, prot: null, gluc: 5, lip: 1, fib: 0 })];
  const r = buildReading("macros", ctx({ data: { ...data, foodLog: log, overrides: { "custom:Avoine": { kcal: 380 } } } })).faits;
  assert.equal(r.par_repas.petitdej.kcal, 380);
  assert.deepEqual(r.par_repas.petitdej.incomplet, ["kcal", "proteines"]);
});

test("macros sans journal fourni : par_repas vide, le reste inchangé", () => {
  const r = buildReading("macros", ctx({ data: undefined })).faits;
  assert.deepEqual(r.par_repas, {});
  assert.equal(r.total_passe_ou_en_cours.kcal, 0);
});

test("jour passé (hier) : tout ce qui est noté, repas « fait », séances avec exercices et séries, rien de prévu", () => {
  const r = buildReading("jour", ctx({ demande: { date: d(1) } }));
  assert.deepEqual(r.manque, [], "« manque » ne parle que d'aujourd'hui");
  const f = r.faits;
  assert.equal(f.statut_jour, "passe");
  assert.equal(f.jour_semaine, "samedi");
  assert.ok(!("heure" in f) && !("prevu" in f) && !("total_passe_ou_en_cours" in f));
  assert.deepEqual(f.total_saisi, { kcal: 150, proteines: 30, glucides: 0, lipides: 3, fibres: 0 });
  assert.equal(f.par_repas.diner.moment, "fait");
  assert.equal(f.eau_ml, 1800);
  assert.equal(f.pas, 12000);
  assert.deepEqual(f.sommeil_nuit_precedente, { heures: 6, qualite: 4, score: f.sommeil_nuit_precedente.score });
  assert.equal(f.poids_kg, 93.8);
  assert.deepEqual(f.genou, { douleur: 4, base_ok: false });
  assert.equal(f.fc_repos, 50);
  assert.equal(f.sieste_min, 20);
  assert.equal(f.note, "bonne forme");
  assert.equal(f.cible.eau_ml, DEFAULT_TARGETS.water + 1000, "basket fait ce jour-là : +1 L, règle de l'app");
  assert.deepEqual(f.seances_faites[0], { type: "Upper A", exercices: [{ nom: "Rowing", unite: "repetitions", series: [{ poids_kg: 60, val: 10, fait: true }] }] });
  assert.deepEqual(f.seances_faites[1], { type: "Basket", duree_min: 90, rpe: 7, exercices: [] });
  assert.ok(r.regles.includes("HISTORIQUE") && r.regles.includes("REPAS"));
});

test("jour futur : seulement le prévu (repas, basket, planning, recommandeur du lendemain)", () => {
  const demain = buildReading("jour", ctx({ demande: { date: plus(1) } })).faits;
  assert.equal(demain.statut_jour, "futur");
  assert.deepEqual(demain.prevu.planning_ideal, ["Full Body"], "lendemain de match");
  assert.equal(demain.prevu.recommandeur.propositions[0].type, "Lower A");
  const f = buildReading("jour", ctx({ demande: { date: plus(2) } })).faits;
  assert.equal(f.par_repas.dejeuner.moment, "prevu");
  assert.equal(f.total_saisi.kcal, 525);
  for (const k of ["pas", "poids_kg", "sommeil_nuit_precedente", "seances_faites", "eau_ml"]) assert.ok(!(k in f), k);
  assert.equal(f.prevu.basket, null);
  assert.ok(!("recommandeur" in f.prevu));
  const match = buildReading("jour", ctx({ demande: { date: "2026-10-11" } })).faits;
  assert.equal(match.prevu.basket, "match");
  assert.equal(buildReading("jour", ctx({ demande: { date: "2026-10-07" } })).faits.prevu.basket, "entrainement");
});

test("jour : aujourd'hui par défaut, avec l'heure, le « manque » du jour et le recommandeur", () => {
  const r = buildReading("jour", ctx());
  assert.equal(r.faits.date, T0);
  assert.equal(r.faits.heure, "09:00");
  assert.equal(r.faits.statut_jour, "aujourdhui");
  assert.deepEqual(r.manque, ["genou"]);
  assert.equal(r.faits.prevu.recommandeur.statut, "ouverte");
  assert.equal(r.faits.total_passe_ou_en_cours.kcal, 400);
  assert.equal(r.faits.prevu.basket, "match");
});

test("période : totaux et moyennes sur les jours passés seulement, une ligne par jour", () => {
  const f = buildReading("periode", ctx({ demande: { du: d(2), au: plus(2) } })).faits;
  assert.equal(f.nb_jours, 5);
  assert.equal(f.jours_passes, 2);
  assert.deepEqual(f.jours.map((j) => j.statut), ["passe", "passe", "aujourdhui", "futur", "futur"]);
  const t = f.totaux_et_moyennes;
  assert.deepEqual(t.kcal, { moyenne: 1125, total: 2250, min: 150, max: 2100, jours: 2 });
  assert.deepEqual(t.pas, { moyenne: 10000, total: 20000, min: 8000, max: 12000, jours: 2 }, "aujourd'hui (1 500 pas, en cours) exclu");
  assert.deepEqual(t.poids_kg, { premier: 94.2, dernier: 93.8, variation: -0.4, moyenne: 94, min: 93.8, max: 94.2, jours: 2 });
  assert.equal(t.genou.jours_hors_base, 1);
  assert.equal(t.sommeil_h.moyenne, 5.8);
  assert.deepEqual(t.seances, { total: 2, par_type: { "Upper A": 1, Basket: 1 } });
  assert.equal(t.fc_repos.jours, 1);
  assert.deepEqual(f.jours[1], { date: d(1), jour: "samedi", statut: "passe", kcal: 150, proteines: 30, glucides: 0, lipides: 3, fibres: 0, eau_ml: 1800, pas: 12000, sommeil_h: 6, sommeil_qualite: 4, poids_kg: 93.8, genou: 4, genou_hors_base: true, fc_repos: 50, seances: ["Upper A", "Basket"] });
  assert.deepEqual(f.jours[4], { date: plus(2), jour: "mardi", statut: "futur", kcal: 525, proteines: 18, glucides: 105, lipides: 3, fibres: 4.5, planning_ideal: ["Repos"] });
});

test("période et jour : demandes invalides refusées avec le code « inconnu »", () => {
  const code = (e) => e.code === "inconnu";
  assert.throws(() => buildReading("periode", ctx({ demande: {} })), code);
  assert.throws(() => buildReading("periode", ctx({ demande: { du: T0, au: d(1) } })), code, "fin avant début");
  assert.throws(() => buildReading("periode", ctx({ demande: { du: "2026-02-30", au: T0 } })), code, "date impossible");
  assert.throws(() => buildReading("periode", ctx({ demande: { du: shiftDateKey(T0, -MAX_PERIOD_DAYS), au: T0 } })), code, "plus d'un an");
  assert.equal(buildReading("periode", ctx({ demande: { du: shiftDateKey(T0, 1 - MAX_PERIOD_DAYS), au: T0 } })).faits.nb_jours, MAX_PERIOD_DAYS);
  assert.throws(() => buildReading("jour", ctx({ demande: { date: "hier" } })), code);
});

test("sujets : les six d'origine gardent leurs règles, jour et periode s'ajoutent", () => {
  assert.deepEqual(BRIDGE_SUBJECTS, ["sport_du_jour", "macros", "forme", "brief", "point", "bilan", "jour", "periode"]);
  const sport = buildReading("sport_du_jour", ctx()).regles;
  assert.ok(!sport.includes("REPAS :") && !sport.includes("HISTORIQUE :"));
  const macros = buildReading("macros", ctx()).regles;
  assert.ok(macros.includes("REPAS :") && !macros.includes("HISTORIQUE :"));
});
