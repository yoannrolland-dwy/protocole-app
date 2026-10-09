// 09/10/2026 : fiche match 10h30, mollets en superset avec la presse, protéines hebdo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, BASKET_PROTOCOLS, exoSeriesCount } from "../src/session/templates.js";
import { weeklyProteinTrend } from "../src/targets.js";
import { fixClock, T0, d } from "./_helpers.mjs";

fixClock();

const flat = (key) => BASKET_PROTOCOLS[key].blocks.flatMap((b) => [b.h, ...b.items]).join("\n");

test("fiche match 10h30 : caféine déplacée à 9h20, nouveau petit-déj, échauffement détaillé, plus de mobilité maison", () => {
  const m = BASKET_PROTOCOLS.match10h;
  const block = (h) => m.blocks.find((b) => b.h.startsWith(h));
  assert.ok(!block("Au réveil").items.join(" ").includes("Caféine"));
  assert.ok(block("Au réveil").items.join(" ").includes("500 ml"));
  assert.ok(block("10-15 min").items[0].includes("pain blanc 100 g + miel 25 g + whey 30 g"));
  assert.equal(block("10-15 min").items.length, 1);
  assert.equal(block("9h20").items.length, 1);
  assert.ok(block("9h20").items.join(" ").includes("caféine 1 cachet 200 mg"));
  const ech = block("9h45").items.join("\n");
  for (const n of ["1. Cardio léger 5 min", "2. Mobilité dynamique 5 min", "3. Isométrie genou", "4. Montée progressive", "5. Spécifique basket", "douleur genou > 3/10"]) assert.ok(ech.includes(n), n);
  assert.ok(ech.trim().endsWith("Gorgées d'eau régulières."));
  assert.ok(!flat("match10h").includes("Mobilité 8-10 min"));
  const adj = m.blocks.find((b) => b.h.startsWith("⚠")).items.join("\n");
  assert.ok(adj.includes("~50-55 g (pain blanc 70 g + miel 15 g) au lieu de ~77 g"));
  // Récupération immédiate et déjeuner inchangés.
  assert.ok(flat("match10h").includes("Total : 25 g P / 34 g G / 1 g L / 275 kcal."));
  assert.ok(flat("match10h").includes("Total : 41 g P / 65 g G / 13 g L / ~600 kcal."));
});

test("mollets en superset : autant de séries que la presse, à chaque semaine HSR", () => {
  const mol = (t) => TEMPLATES[t].exos.find((e) => e.n === "Mollets à la presse");
  for (const t of ["Lower A", "Lower C", "Full Body"]) {
    assert.equal(exoSeriesCount(TEMPLATES[t], mol(t), 9), 4, `${t} semaine 9`);
    assert.equal(exoSeriesCount(TEMPLATES[t], mol(t), 1), 3, `${t} semaine 1`);
    assert.equal(exoSeriesCount(TEMPLATES[t], mol(t), 4), 4, `${t} semaine 4`);
  }
  // Lower B : presse fixe à 4 séries, donc mollets 4 quelle que soit la semaine HSR.
  assert.equal(exoSeriesCount(TEMPLATES["Lower B"], mol("Lower B"), 1), 4);
  // Un exo HSR suit la table, un exo ordinaire garde ses séries.
  const presse = TEMPLATES["Lower A"].exos.find((e) => e.hsr && e.n.startsWith("Presse"));
  assert.equal(exoSeriesCount(TEMPLATES["Lower A"], presse, 9), 4);
  assert.equal(exoSeriesCount(TEMPLATES["Upper A"], TEMPLATES["Upper A"].exos[0], 9), TEMPLATES["Upper A"].exos[0].s);
});

test("weeklyProteinTrend : moyenne par semaine lundi-dimanche, aujourd'hui exclu, jour sans donnée ignoré", () => {
  // T0 = dimanche 2026-10-04 (lundi de cette semaine = 2026-09-28).
  const macros = [
    { date: d(6), protein: 200 }, { date: d(5), protein: 180 }, { date: d(4), protein: 220 }, // lun-mer
    { date: T0, protein: 40 },        // aujourd'hui, journée incomplète : exclue
    { date: d(8), protein: 100 },     // semaine précédente (dimanche... lundi d(13)..d(7))
  ];
  const w = weeklyProteinTrend(macros, { weeks: 2 });
  assert.equal(w.length, 2);
  assert.equal(w[1].weekStart, "2026-09-28");
  assert.equal(w[1].avgProtein, 200);
  assert.equal(w[1].days, 3);
  assert.equal(w[0].avgProtein, 100);
  assert.equal(weeklyProteinTrend([], { weeks: 1 })[0].avgProtein, null);
});
