// Carte « Palier de la semaine » en clair (19/11/2026, demande de Yoann : la carte parlait en
// abréviations). Le calcul (packages/core/src/palier.js) ne change pas : on vérifie ici les
// phrases, le compteur d'observation recalculé chaque jour, et le tableau Aujourd'hui / Proposé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { palierView } from "../src/lib/bordView.js";
import { recommendTargets } from "@rawcare/core/palier";
import { recompZone } from "@rawcare/core/tdee";

const T = { protein: 200, carbs: 380, fat: 105, fiber: 35 };
const reading = (deficit) => ({ status: "ok", reading: { deficit, ...recompZone(deficit) } });
const recomp = (a, b = a) => ({ j14: reading(a), j21: reading(b) });
const trend = (d1, d2) => ({ deltaWeek: d1, deltaWeekPrev: d2 });
const now = new Date(2026, 10, 15, 14, 2); // dimanche 15/11/2026 : proposition du samedi 14/11
const run = (o) => recommendTargets({ now, targets: T, targetHistory: [], loggedRate7: 1, ...o });
const wrap = (result, extra = {}) => ({ weekOf: result.weekOf, result, appliedAt: null, ...extra });

test("observation figée AVANT ce changement (cas réel du 19/11) : phrases, jour recalculé, décision le samedi", () => {
  const old = { weekOf: "2026-11-16", action: "hold", deltaKcal: 0, proposed: null,
    reasons: ["Observation après le palier du 2026-11-09 : J+6/14"], blocked: "Observation après le palier du 2026-11-09 : J+6/14",
    observation: { since: 6, until: "2026-11-23" } };
  const v = palierView(wrap(old), T, "2026-11-19");
  assert.equal(v.title, "Garde tes calories actuelles");
  assert.equal(v.intro, "Chaque samedi, l'app vérifie si tu manges la bonne quantité.");
  assert.match(v.lines[0], /^Tu as changé tes calories le 09\/11\. L'app attend environ 2 semaines avant de juger/);
  // Palier du lundi 09/11 : le samedi le plus proche du 14e jour est le 21/11 (J+12).
  assert.equal(v.progress.text, "Jour 10 sur 12", "le compteur suit le jour, il ne reste pas à J+6");
  assert.equal(v.progress.pct, 83);
  assert.equal(v.progress.next, "Prochaine décision : samedi 21/11");
  assert.equal(v.rows, null);
  const matin = palierView(wrap(old), T, "2026-11-21"); // samedi avant 10 h : la proposition n'est pas encore refaite
  assert.equal(matin.progress.text, "Jour 12 sur 12");
  assert.equal(matin.progress.pct, 100);
  assert.equal(matin.progress.next, "Prochaine décision : samedi 21/11, à partir de 10 h");
});

test("observation calculée maintenant : même texte, à partir de `facts` ; la carte est datée du samedi", () => {
  const r = run({ recomp: recomp(600), trend: trend(-0.2, -0.1), targetHistory: [{ date: "2026-11-09", kcal: 3300, prevKcal: 3200, source: "palier" }] });
  assert.equal(r.facts.why, "observation");
  assert.equal(r.weekOf, "2026-11-14");
  const v = palierView(wrap(r), T, "2026-11-15");
  assert.equal(v.weekLabel, "samedi 14/11");
  assert.equal(v.progress.text, "Jour 6 sur 12");
  assert.equal(v.progress.next, "Prochaine décision : samedi 21/11");
  // Palier appliqué un samedi : décision pile 14 jours plus tard.
  const sam = run({ recomp: recomp(600), trend: trend(-0.2, -0.1), targetHistory: [{ date: "2026-11-14", kcal: 3300, prevKcal: 3200, source: "palier" }] });
  const vs = palierView(wrap(sam), T, "2026-11-15");
  assert.equal(vs.progress.text, "Jour 1 sur 14");
  assert.equal(vs.progress.next, "Prochaine décision : samedi 28/11");
});

test("hausse : quoi faire, pourquoi en phrases, tableau des seules lignes qui changent", () => {
  const r = run({ recomp: recomp(420), trend: trend(-0.4, -0.3) });
  const v = palierView(wrap(r), T, "2026-11-16");
  assert.equal(v.title, "Mange 100 kcal de plus par jour");
  assert.equal(v.lines[0], "Chaque jour, tu dépenses environ 420 kcal de plus que tu ne manges (moyenne des 2 à 3 dernières semaines). C'est un peu haut : la zone visée est de 100 à 300.");
  assert.equal(v.lines[1], "Ton poids moyen : −0,4 kg en 7 jours, −0,3 kg les 7 jours d'avant.");
  assert.deepEqual(v.rows.map((x) => x.label), ["Calories", "Glucides", "Lipides"]);
  assert.deepEqual(v.rows[1], { label: "Glucides", cur: "380 g", next: "400 g" });
  assert.equal(v.unchanged, "Protéines et fibres ne changent pas.");
  assert.equal(v.status, null, "à appliquer : le bouton, pas de mention");
  assert.equal(v.targetsLine, null);
});

test("hausse appliquée : plus de tableau (deux colonnes identiques), les cibles sur une ligne", () => {
  const r = run({ recomp: recomp(600), trend: trend(-0.2, -0.1) });
  const v = palierView(wrap(r, { appliedAt: "2026-11-16" }), r.proposed, "2026-11-17");
  assert.equal(v.rows, null);
  assert.equal(v.unchanged, null);
  assert.equal(v.status, "Appliqué ✓ le 16/11");
  assert.match(v.targetsLine, /^Tes cibles : \d+ kcal · glucides 400 g · lipides 110 g · protéines 200 g · fibres 35 g$/);
  assert.match(v.lines[0], /C'est trop pour gagner du muscle/);
});

test("baisse et maintien : surplus, poids qui monte, zone visée, sous la zone", () => {
  const down = palierView(wrap(run({ recomp: recomp(-80), trend: trend(0.1, 0.2) })), T, "2026-11-16");
  assert.equal(down.title, "Mange 100 kcal de moins par jour");
  assert.match(down.lines[0], /^Chaque jour, tu manges environ 80 kcal de plus que tu ne dépenses .*Tu n'es plus en déficit/);
  assert.equal(down.lines[1], "Ton poids moyen : +0,1 kg en 7 jours, +0,2 kg les 7 jours d'avant.");
  const monte = palierView(wrap(run({ recomp: recomp(200), trend: trend(0.1, 0.2) })), T, "2026-11-16");
  assert.match(monte.lines[0], /Et ton poids moyen monte depuis deux semaines\.$/);
  const ok = palierView(wrap(run({ recomp: recomp(200), trend: trend(-0.1, 0) })), T, "2026-11-16");
  assert.equal(ok.title, "Garde tes calories actuelles");
  assert.match(ok.lines[0], /C'est dans la zone visée \(100 à 300\) : rien à changer\.$/);
  assert.equal(ok.progress, null);
  const sous = palierView(wrap(run({ recomp: recomp(50), trend: trend(-0.1, 0) })), T, "2026-11-16");
  assert.match(sous.lines[0], /juste sous la zone visée/);
  const vite = palierView(wrap(run({ recomp: recomp(250), trend: trend(-0.4, -0.45) })), T, "2026-11-16");
  assert.equal(vite.title, "Mange 100 kcal de plus par jour");
  assert.match(vite.lines[0], /tu perds plus de 0,3 kg par semaine depuis deux semaines/);
});

test("garde-fous de données : semaine peu notée, pas assez de données, fenêtres en désaccord", () => {
  const peu = palierView(wrap(run({ loggedRate7: 3 / 7, recomp: recomp(200), trend: trend(0, 0) })), T, "2026-11-16");
  assert.equal(peu.title, "Garde tes calories actuelles");
  assert.equal(peu.lines[0], "Seulement 43 % des 7 derniers jours ont des repas notés. Il en faut au moins 70 % pour que l'app puisse juger.");
  const sans = palierView(wrap(run({ recomp: null, trend: trend(0, 0) })), T, "2026-11-16");
  assert.match(sans.lines[0], /pas encore assez de pesées et de repas notés/);
  const des = palierView(wrap(run({ recomp: recomp(-50, 400), trend: trend(0, 0) })), T, "2026-11-16");
  assert.match(des.lines[0], /ne disent pas la même chose .*L'app attend qu'elles soient d'accord\.$/);
});

test("proposition figée avant ce changement, hors observation : les raisons d'origine restent affichées ; sans proposition : rien", () => {
  const old = { weekOf: "2026-11-09", action: "hold", deltaKcal: 0, proposed: null, reasons: ["Déficit réel moyen 14/21 j : 200 kcal/j (zone visée (100-300))", "Zone visée : maintenir"], blocked: null };
  const v = palierView(wrap(old), T, "2026-11-12");
  assert.deepEqual(v.lines, old.reasons);
  assert.equal(palierView(null, T), null);
  assert.equal(palierView({ weekOf: "2026-11-09", result: null }, T), null);
});

// ---------- Tendance de la prochaine décision pendant l'attente (19/11/2026)
import { palierOutlook, OUTLOOK_FROM_DAY } from "../src/lib/bordView.js";
import { today, shiftDateKey } from "@rawcare/core/dateUtils";

const T0 = today();
const dayKey = (n) => shiftDateKey(T0, n);
/** 40 jours de pesées (pente `kgPerDay`) et d'apports notés à `kcal`. */
function live(kgPerDay, kcal = 3000) {
  const weight = [], macros = [];
  for (let i = 40; i >= 0; i--) {
    weight.push({ date: dayKey(-i), kg: 92 + (40 - i) * kgPerDay });
    if (i > 0) macros.push({ date: dayKey(-i), kcal, protein: 200, carbs: 380, fat: 80, fiber: 35 });
  }
  return { weight, macros, foodLog: [], overrides: {} };
}
const waiting = (daysAgo) => {
  const last = dayKey(-daysAgo);
  return wrap({ weekOf: last, action: "hold", deltaKcal: 0, proposed: null, reasons: ["x"], blocked: "x",
    observation: { since: 0, until: shiftDateKey(last, 14) }, facts: { why: "observation", lastDate: last } });
};

test("tendance : rien sans données du jour, « trop tôt » avant le 8e jour, puis le sens et une phrase", () => {
  assert.equal(OUTLOOK_FROM_DAY, 8);
  assert.equal(palierView(waiting(9), T, T0).outlook, null, "sans données du jour : pas de bloc");
  const tot = palierView(waiting(7), T, T0, live(-0.08));
  assert.equal(tot.outlook.tone, "early");
  assert.equal(tot.outlook.title, "Tendance de la prochaine décision : trop tôt pour le dire");
  assert.match(tot.outlook.text, /à partir du jour 8/);
  const v = palierView(waiting(8), T, T0, live(-0.08)); // −0,56 kg par semaine : perte nette
  assert.equal(v.outlook.tone, "up");
  assert.equal(v.outlook.title, "Pour l'instant, ça va vers une hausse");
  assert.match(v.outlook.text, /^Tu (dépenses environ \d+ kcal de plus que tu ne manges chaque jour, au-dessus de la zone visée|perds plus de 0,3 kg par semaine)/);
  assert.equal(v.outlook.note, "Indication du jour : la décision se prend samedi.");
  // La décision affichée, elle, ne change pas : on attend toujours.
  assert.equal(v.title, "Garde tes calories actuelles");
});

test("tendance : baisse quand le poids monte, même calcul que la règle du samedi, rien hors attente", () => {
  const up = live(0.05);
  const v = palierView(waiting(10), T, T0, up);
  assert.equal(v.outlook.tone, "down");
  assert.equal(v.outlook.title, "Pour l'instant, ça va vers une baisse");
  assert.equal(palierOutlook({ ...up, targets: T }, T0).action, "down", "même moteur, sans la période d'observation");
  const peu = { ...live(-0.02), macros: [] };
  const inconnu = palierView(waiting(10), T, T0, peu);
  assert.equal(inconnu.outlook.tone, "unknown");
  assert.equal(inconnu.outlook.title, "Pour l'instant, impossible à dire");
  const decide = palierView(wrap(run({ recomp: recomp(200), trend: trend(-0.1, 0) })), T, "2026-11-16", up);
  assert.equal(decide.outlook, null, "la carte qui vient de décider n'affiche que sa décision");
});
