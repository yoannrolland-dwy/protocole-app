// Modifier à la voix, lots 2 et 3 (25/11/2026) : corriger un aliment et les mesures d'un jour.
// Données synthétiques, horloge figée au 04/10/2026.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { checkAgir, doneSummary } from "../src/coach/bridgeActions.js";
import { dayWords, editDay, editedFoodLog, withoutDay, waterTotal } from "../src/coach/bridgeEdits.js";
import { syncMacroLog, resolveLog } from "../src/nutrition/foodStore.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());

const per = (kcal) => ({ kcal, prot: 10, gluc: 5, lip: 2, fib: 1 });
const row = (id, date, meal, ref, name, q) => ({ id, date, meal, ref, name, q, per100: per(100) });
const ctx = (over = {}) => ({
  today: T0,
  weight: [{ date: d(1), kg: 94, source: "healthconnect" }, { date: d(2), kg: 93.5, source: "manual" }],
  knee: [{ date: d(1), pain: 5, baseline: false }],
  macros: [{ date: T0, water: 1250, source: "foodlog", kcal: 260 }],
  notes: [{ date: T0, text: "mal dormi" }],
  foodLog: [
    row("a", T0, "dejeuner", "ciqual:9", "Riz basmati, cuit", 200),
    row("b", T0, "gouter", "off:2", "Yaourt nature", 125),
    row("c", T0, "diner", "ciqual:9", "Riz basmati, cuit", 150),
    row("q", T0, "autre", "quick:1", "Part de gâteau", 100),
  ],
  ...over,
});

test("jour : aujourd'hui, hier, une date des 7 derniers jours ; jamais à venir ni trop ancien", () => {
  assert.equal(editDay({}, T0).date, T0);
  assert.equal(editDay({ jour: "hier" }, T0).date, d(1));
  assert.equal(editDay({ jour: d(7) }, T0).date, d(7));
  assert.equal(editDay({ jour: d(8) }, T0).ok, false);
  assert.equal(editDay({ jour: "2026-10-05" }, T0).ok, false);
  assert.equal(editDay({ jour: "mardi" }, T0).ok, false);
  assert.equal(dayWords(T0, T0), "d'aujourd'hui");
  assert.equal(dayWords(d(1), T0), "d'hier");
  assert.equal(dayWords("2026-10-01", T0), "du jeudi 1er octobre");
});

test("aliment : grammes avant / après, déplacé, retiré ; les totaux du jour suivent, l'eau reste", async () => {
  const r = await checkAgir("modifier_aliment", { aliment: "riz", repas: "dejeuner", grammes: 150 }, ctx());
  assert.equal(r.resume, "Corriger Riz basmati, cuit du déjeuner d'aujourd'hui : 150 g au lieu de 200 g");
  assert.deepEqual(r.act, { kind: "aliment_modif", date: T0, id: "a", patch: { q: 150 } });
  const moved = await checkAgir("modifier_aliment", { aliment: "yaourt", vers_repas: "diner" }, ctx());
  assert.equal(moved.resume, "Corriger Yaourt nature du goûter d'aujourd'hui : déplacé vers le dîner");
  const gone = await checkAgir("retirer_aliment", { aliment: "yaourt nature", repas: "gouter" }, ctx());
  assert.equal(gone.resume, "Retirer Yaourt nature, 125 g, du goûter d'aujourd'hui");
  assert.equal(doneSummary(gone.act), "C'est corrigé dans PROTOCOLE");
  // Écriture : le journal et les totaux du jour ; l'eau est gardée.
  const log = editedFoodLog(ctx().foodLog, r.act);
  assert.equal(log.find((e) => e.id === "a").q, 150);
  const { macros } = syncMacroLog(ctx().macros, resolveLog(log, {}), [T0]);
  const day = macros.find((m) => m.date === T0);
  assert.equal(day.water, 1250);
  assert.equal(day.kcal, 150 + 125 + 150 + 100);
  // Dernier aliment d'un jour retiré : ses totaux partent, l'eau reste.
  const empty = editedFoodLog([row("z", T0, "diner", "x", "Pomme", 100)], { kind: "aliment_retrait", id: "z" });
  const cleared = syncMacroLog([{ date: T0, water: 500, source: "foodlog", kcal: 100 }], empty, [T0]).macros;
  assert.deepEqual(cleared, [{ date: T0, water: 500, source: "manual" }]);
});

test("aliment : plusieurs correspondent → choix ; saisie libre sans grammes ; rien ne change ; absent", async () => {
  const two = await checkAgir("modifier_aliment", { aliment: "riz", grammes: 100 }, ctx());
  assert.equal(two.ok, false);
  assert.equal(two.besoin, "repas");
  assert.match(two.raison, /^Riz basmati, cuit est noté au déjeuner \(200 g\) et au dîner \(150 g\)/);
  const names = await checkAgir("retirer_aliment", { aliment: "riz" }, ctx({ foodLog: [row("a", T0, "dejeuner", "x", "Riz basmati", 100), row("b", T0, "dejeuner", "y", "Riz complet", 100)] }));
  assert.deepEqual(names.choix, ["Riz basmati", "Riz complet"]);
  assert.match((await checkAgir("modifier_aliment", { aliment: "gâteau", grammes: 80 }, ctx())).raison, /saisie libre/);
  assert.match((await checkAgir("modifier_aliment", { aliment: "riz", repas: "diner", grammes: 150 }, ctx())).raison, /^rien ne change/);
  assert.equal((await checkAgir("modifier_aliment", { aliment: "riz", repas: "diner" }, ctx())).besoin, "valeur");
  assert.match((await checkAgir("retirer_aliment", { aliment: "pâtes" }, ctx())).raison, /aucun aliment « pâtes » d'aujourd'hui/);
  assert.equal((await checkAgir("retirer_aliment", { aliment: "yaourt", jour: d(9) }, ctx())).ok, false);
});

test("poids : corriger, effacer ; jamais une pesée de la balance", async () => {
  const r = await checkAgir("corriger_poids", { kg: 93.2, jour: d(2) }, ctx());
  assert.equal(r.resume, "Corriger le poids du vendredi 2 octobre : 93,2 kg au lieu de 93,5 kg");
  assert.deepEqual(r.act, { kind: "poids", date: d(2), kg: 93.2 });
  const del = await checkAgir("corriger_poids", { effacer: true, jour: d(2) }, ctx());
  assert.equal(del.resume, "Effacer le poids du vendredi 2 octobre, 93,5 kg");
  assert.deepEqual(withoutDay(ctx().weight, d(2)).map((w) => w.date), [d(1)]);
  assert.match((await checkAgir("corriger_poids", { kg: 93, jour: "hier" }, ctx())).raison, /vient de la balance/);
  assert.match((await checkAgir("corriger_poids", { effacer: true, jour: "hier" }, ctx())).raison, /vient de la balance/);
});

test("genou : la base est demandée avant, corriger d'hier, effacer", async () => {
  assert.equal((await checkAgir("corriger_genou", { douleur: 3, jour: "hier" }, ctx())).besoin, "retour_base");
  const r = await checkAgir("corriger_genou", { douleur: 3, retour_base: true, jour: "hier" }, ctx());
  assert.equal(r.resume, "Corriger le genou d'hier : 3 sur 10, revenu à la base, au lieu de 5 sur 10");
  assert.deepEqual(r.act, { kind: "genou", date: d(1), pain: 3, baseline: true });
  assert.equal((await checkAgir("corriger_genou", { effacer: true, jour: "hier" }, ctx())).resume, "Effacer le genou d'hier, 5 sur 10");
  assert.equal((await checkAgir("corriger_genou", { effacer: true }, ctx())).ok, false, "rien aujourd'hui");
});

test("eau : le total du jour, avant / après ; note : remplacer ou effacer", async () => {
  const w = await checkAgir("corriger_eau", { ml: 1500 }, ctx());
  assert.equal(w.resume, "Corriger l'eau d'aujourd'hui : 1500 ml au lieu de 1250 ml");
  assert.equal(waterTotal(ctx().macros, T0, 1500).find((m) => m.date === T0).water, 1500);
  assert.equal((await checkAgir("corriger_eau", { ml: 1250 }, ctx())).ok, false);
  const n = await checkAgir("corriger_note", { texte: "bien dormi" }, ctx());
  assert.equal(n.resume, "Remplacer la note d'aujourd'hui par « bien dormi » ; elle disait « mal dormi »");
  const del = await checkAgir("corriger_note", { effacer: true }, ctx());
  assert.deepEqual(del.act, { kind: "note_remplace", date: T0, text: "" });
  assert.equal((await checkAgir("corriger_note", { effacer: true, jour: "hier" }, ctx())).ok, false);
});
