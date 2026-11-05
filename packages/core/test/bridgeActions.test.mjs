// Pont JEFFREY, étape G3 (05/11/2026) : `agir`, vérification et phrase relue, sans écriture.
// Données synthétiques, horloge figée au 04/10/2026, table CIQUAL simulée.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { checkAgir, doneSummary, paramsKey, AGIR_ACTIONS } from "../src/coach/bridgeActions.js";
import { foodEntriesFor } from "../src/coach/jeffrey.js";
import { briefAfterKnee } from "../src/coach/brief.js";
import { fixClock, T0, d } from "./_helpers.mjs";

before(() => fixClock());

const TOMORROW = "2026-10-05";
const per = (kcal, prot = 10) => ({ kcal, prot, gluc: 5, lip: 2, fib: 1 });
const row = (date, meal, ref, name, q, p = per(100)) => ({ id: `${ref}-${date}-${meal}`, date, meal, ref, name, q, per100: p });
const CIQ = [
  { ref: "ciqual:1", name: "Banane, pulpe, crue", per100: per(90, 1) },
  { ref: "ciqual:2", name: "Banane plantain, cuite", per100: per(120, 1) },
  { ref: "ciqual:3", name: "Lentilles corail, cuites", per100: per(110, 9) },
];
const ciqual = {
  search: async (q, limit) => CIQ.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, limit),
  get: async (code) => CIQ.find((f) => f.ref === `ciqual:${code}`) || null,
};
const recipe = { id: "r1", name: "Chili maison", per100: per(150, 12), totalWeight: 800, portions: 4 };
const base = (over = {}) => ({
  today: T0,
  weight: [{ date: d(1), kg: 94, source: "healthconnect" }],
  knee: [], macros: [{ date: T0, water: 1250 }],
  foodLog: [
    row(d(1), "dejeuner", "off:1", "Skyr nature", 150),
    row(d(1), "dejeuner", "ciqual:9", "Pain complet", 60),
    row(T0, "dejeuner", "ciqual:9", "Pain complet", 60),
    row(d(2), "gouter", "off:2", "Skyr vanille", 125),
  ],
  overrides: {}, mealPins: {}, mealMuted: {}, recipes: [recipe], ciqual, ...over,
});

test("catalogue : action inconnue → code « inconnu » ; les sept actions", async () => {
  assert.deepEqual(AGIR_ACTIONS, ["ajouter_eau", "noter_genou", "ecrire_note", "noter_poids", "reprendre_repas", "ajouter_habituel", "ajouter_aliment"]);
  await assert.rejects(() => checkAgir("supprimer_tout", {}, base()), (e) => e.code === "inconnu");
});

test("eau : phrase avec le total, aujourd'hui seulement, bornes", async () => {
  const r = await checkAgir("ajouter_eau", { ml: 500 }, base());
  assert.equal(r.resume, "Ajouter 500 ml d'eau aujourd'hui (total 1750 ml)");
  assert.deepEqual(r.act, { kind: "eau", ml: 500, label: "Ajouter 500 ml d'eau", date: T0 });
  assert.equal((await checkAgir("ajouter_eau", { ml: 500, jour: "demain" }, base())).ok, false);
  assert.equal((await checkAgir("ajouter_eau", { ml: 5000 }, base())).ok, false);
  assert.equal((await checkAgir("ajouter_eau", { ml: 500, jour: "hier" }, base())).ok, false);
});

test("genou : la question de la base est posée avant (besoin), remplacement dit", async () => {
  const ask = await checkAgir("noter_genou", { douleur: 3 }, base());
  assert.equal(ask.ok, false);
  assert.equal(ask.besoin, "retour_base");
  const zero = await checkAgir("noter_genou", { douleur: 0 }, base());
  assert.equal(zero.resume, "Noter le genou à 0 sur 10 aujourd'hui, revenu à la base");
  const r = await checkAgir("noter_genou", { douleur: 3, retour_base: false }, base({ knee: [{ date: T0, pain: 2, baseline: true }] }));
  assert.equal(r.resume, "Noter le genou à 3 sur 10 aujourd'hui, pas revenu à la base, à la place de 2 sur 10");
  assert.equal(r.act.baseline, false);
});

test("note : texte gardé tel quel, vide refusé", async () => {
  assert.equal((await checkAgir("ecrire_note", { texte: "deux bières" }, base())).resume, "Ajouter à la note du jour : « deux bières »");
  assert.equal((await checkAgir("ecrire_note", { texte: "  " }, base())).ok, false);
});

test("poids : refusé si la balance a déjà pesé aujourd'hui (choix de Yoann), sinon saisie manuelle", async () => {
  const hc = await checkAgir("noter_poids", { kg: 93.4 }, base({ weight: [{ date: T0, kg: 93.6, source: "healthconnect" }] }));
  assert.equal(hc.ok, false);
  assert.match(hc.raison, /vient déjà de la balance \(93,6 kg\)/);
  const r = await checkAgir("noter_poids", { kg: "93,44" }, base());
  assert.equal(r.resume, "Noter 93,4 kg aujourd'hui");
  assert.deepEqual(r.act, { kind: "poids", date: T0, kg: 93.4 });
  const again = await checkAgir("noter_poids", { kg: 93.2 }, base({ weight: [{ date: T0, kg: 93.4, source: "manual" }] }));
  assert.equal(again.resume, "Noter 93,2 kg aujourd'hui, à la place de 93,4 kg");
  assert.equal((await checkAgir("noter_poids", { kg: 12 }, base())).ok, false);
  assert.equal((await checkAgir("noter_poids", { kg: 93, jour: "demain" }, base())).ok, false);
});

test("repas repris : hier → aujourd'hui ; aujourd'hui → demain (« demain aussi », choix de Yoann)", async () => {
  const r = await checkAgir("reprendre_repas", { repas: "dejeuner" }, base());
  assert.match(r.resume, /^Reprendre le déjeuner d'hier pour aujourd'hui : Skyr nature, Pain complet, 210 kcal ; l'aliment déjà noté reste$/);
  assert.equal(r.act.date, T0);
  const t = await checkAgir("reprendre_repas", { repas: "dejeuner", jour: "demain" }, base());
  assert.equal(t.resume, "Reprendre le déjeuner d'aujourd'hui pour demain : Pain complet, 60 kcal");
  const rows = foodEntriesFor(t.act, base().foodLog, t.act.date);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, TOMORROW);
  assert.equal((await checkAgir("reprendre_repas", { repas: "diner" }, base())).ok, false);
});

test("habituel : quantité de la dernière fois, aussi pour demain", async () => {
  const r = await checkAgir("ajouter_habituel", { aliment: "skyr", repas: "dejeuner", jour: "demain" }, base());
  assert.equal(r.resume, "Ajouter Skyr nature, 150 g, comme la dernière fois, au déjeuner de demain (150 kcal)");
  assert.equal(r.act.date, TOMORROW);
});

test("aliment : ses aliments d'abord (exact, unique, plusieurs → choix), puis CIQUAL", async () => {
  // Plusieurs skyr dans ses aliments → choix, les plus mangés d'abord.
  const many = await checkAgir("ajouter_aliment", { aliment: "skyr", repas: "gouter" }, base());
  assert.equal(many.ok, false);
  assert.deepEqual(many.choix.map((c) => c.ref).sort(), ["off:1", "off:2"]);
  // Choisi par ref → quantité de la dernière fois, tous repas confondus.
  const pick = await checkAgir("ajouter_aliment", { ref: "off:1", repas: "gouter" }, base());
  assert.equal(pick.resume, "Ajouter Skyr nature, 150 g, comme la dernière fois, au goûter d'aujourd'hui (150 kcal)");
  assert.equal(pick.act.kind, "aliment");
  // Nom exact → pas de choix.
  const exact = await checkAgir("ajouter_aliment", { aliment: "skyr vanille", repas: "gouter", grammes: 100 }, base());
  assert.equal(exact.resume, "Ajouter Skyr vanille, 100 g, au goûter d'aujourd'hui (100 kcal)");
  // Recette : 1 portion par défaut, ou N portions.
  const rec = await checkAgir("ajouter_aliment", { aliment: "chili", repas: "diner" }, base());
  assert.equal(rec.resume, "Ajouter Chili maison, 1 portion (200 g), au dîner d'aujourd'hui (300 kcal)");
  const rec2 = await checkAgir("ajouter_aliment", { aliment: "chili", repas: "diner", portions: 2, jour: "demain" }, base());
  assert.equal(rec2.act.q, 400);
  assert.equal(rec2.act.date, TOMORROW);
  assert.equal((await checkAgir("ajouter_aliment", { aliment: "chili", repas: "diner", portions: 5 }, base())).ok, false);
});

test("aliment CIQUAL : jamais mangé → demander les grammes ; plusieurs → choix ; introuvable", async () => {
  const lent = await checkAgir("ajouter_aliment", { aliment: "lentilles", repas: "diner" }, base());
  assert.equal(lent.besoin, "grammes");
  const ok = await checkAgir("ajouter_aliment", { aliment: "lentilles", repas: "diner", grammes: 200 }, base());
  assert.equal(ok.resume, "Ajouter Lentilles corail, cuites, 200 g, au dîner d'aujourd'hui (220 kcal)");
  assert.equal(ok.act.food.ref, "ciqual:3");
  const ban = await checkAgir("ajouter_aliment", { aliment: "banane", repas: "gouter", grammes: 120 }, base());
  assert.deepEqual(ban.choix, [{ ref: "ciqual:1", nom: "Banane, pulpe, crue" }, { ref: "ciqual:2", nom: "Banane plantain, cuite" }]);
  const byRef = await checkAgir("ajouter_aliment", { ref: "ciqual:1", repas: "gouter", grammes: 120 }, base());
  assert.equal(byRef.act.food.name, "Banane, pulpe, crue");
  assert.equal((await checkAgir("ajouter_aliment", { aliment: "durian", repas: "gouter", grammes: 50 }, base())).ok, false);
  assert.equal((await checkAgir("ajouter_aliment", { aliment: "lentilles", repas: "brunch", grammes: 50 }, base())).ok, false);
  assert.equal((await checkAgir("ajouter_aliment", { aliment: "lentilles", repas: "diner", portions: 2 }, base())).ok, false);
});

test("aliment corrigé (V6) : kcal relue avec la correction, ligne écrite avec la valeur d'origine", async () => {
  const r = await checkAgir("ajouter_aliment", { ref: "off:1", repas: "gouter", grammes: 100 }, base({ overrides: { "off:1": { kcal: 60 } } }));
  assert.match(r.resume, /\(60 kcal\)$/);
  const [line] = foodEntriesFor(r.act, [], r.act.date);
  assert.equal(line.per100.kcal, 100);
  assert.equal(line.meal, "gouter");
});

test("phrase de fin et clé des paramètres", () => {
  assert.equal(doneSummary({ kind: "eau", ml: 500 }, { before: 1250, after: 1750 }), "500 ml d'eau ajoutés : 1750 ml aujourd'hui");
  assert.equal(doneSummary({ kind: "poids", kg: 93.4 }), "93,4 kg notés aujourd'hui");
  assert.equal(paramsKey("ajouter_eau", { ml: 500, jour: "aujourdhui" }), paramsKey("ajouter_eau", { jour: "aujourdhui", ml: 500 }));
  assert.notEqual(paramsKey("ajouter_eau", { ml: 500 }), paramsKey("ajouter_eau", { ml: 250 }));
});

test("genou noté par JEFFREY : brief à faire selon la règle de l'app (même app fermée)", () => {
  const knee = [{ date: T0, pain: 2, baseline: true }];
  const at = (h) => new Date(2026, 9, 4, h, 0);
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee }), "a_faire");
  // Hors de 5 h – midi, déjà fait, réservé par PROTOCOLE, désactivé dans les Réglages : rien.
  assert.equal(briefAfterKnee({ now: at(13), today: T0, knee }), null);
  assert.equal(briefAfterKnee({ now: at(4), today: T0, knee }), null);
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee, state: { doneDate: T0, by: "jeffrey" } }), null);
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee, state: { claimDate: T0, claimAt: 0 } }), null);
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee, enabled: false }), null);
  // Signal G2 déjà envoyé par l'app ouverte : JEFFREY peut encore le faire (brief_fait l'arbitre).
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee, state: { signal: { date: T0, at: 1, sent: true } } }), "a_faire");
  // Brief d'hier : sans effet aujourd'hui.
  assert.equal(briefAfterKnee({ now: at(7), today: T0, knee, state: { doneDate: d(1), claimDate: d(1) } }), "a_faire");
});
