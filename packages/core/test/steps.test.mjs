// Pas Health Connect (steps.js) — régression du 25/10/2026 : jour du passage à l'heure d'hiver.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stepsByLocalDay } from "../src/steps.js";

// Clé de date en UTC : les milieux d'enregistrements tombent vers 10-11 h UTC, donc la même date qu'à Paris,
// et le test ne dépend pas du fuseau de la machine.
const keyOf = (d) => d.toISOString().slice(0, 10);
const SH = "com.sec.android.app.shealth";

// Enregistrements RÉELS lus sur le téléphone le 25/10/2026 à 14h20 (un total par jour, Samsung Health).
// Jusqu'au 23/10 : bornes = minuit local d'été (22h UTC). 24/10 et 25/10 : datés avec le décalage d'hiver (23h UTC).
const REAL = [
  { startDate: "2026-10-24T23:00:00Z", endDate: "2026-10-25T22:59:59.999Z", value: 8053, sourceId: SH },
  { startDate: "2026-10-23T23:00:00Z", endDate: "2026-10-24T22:59:59.999Z", value: 7239, sourceId: SH },
  { startDate: "2026-10-22T22:00:00Z", endDate: "2026-10-23T21:59:59.999Z", value: 10263, sourceId: SH },
  { startDate: "2026-10-21T22:00:00Z", endDate: "2026-10-22T21:59:59.999Z", value: 10091, sourceId: SH },
];

test("régression 25/10 : chaque total journalier tombe sur SON jour, sans découpage ni écrasement", () => {
  assert.deepEqual(stepsByLocalDay(REAL, { keyOf }), {
    "2026-10-25": 8053, // l'agrégation en tranches de 24 h renvoyait 335 (tranche d'une heure qui écrasait le vrai total)
    "2026-10-24": 7239, // et 6937 (1/24 perdu au profit de la tranche voisine)
    "2026-10-23": 10263,
    "2026-10-22": 10091,
  });
});

test("plusieurs enregistrements fins le même jour s'additionnent ; deux sources ne se comptent pas deux fois", () => {
  const fine = [
    { startDate: "2026-10-20T08:00:00Z", endDate: "2026-10-20T08:30:00Z", value: 1200, sourceId: SH },
    { startDate: "2026-10-20T12:00:00Z", endDate: "2026-10-20T12:45:00Z", value: 2300, sourceId: SH },
  ];
  assert.equal(stepsByLocalDay(fine, { keyOf })["2026-10-20"], 3500);
  const twoSources = [...fine, { startDate: "2026-10-20T00:00:00Z", endDate: "2026-10-20T23:59:59Z", value: 3600, sourceId: "autre.app" }];
  assert.equal(stepsByLocalDay(twoSources, { keyOf })["2026-10-20"], 3600, "max par source, pas la somme des deux apps");
});

test("entrées invalides ignorées, liste vide → objet vide", () => {
  assert.deepEqual(stepsByLocalDay([], { keyOf }), {});
  assert.deepEqual(stepsByLocalDay(undefined, { keyOf }), {});
  assert.deepEqual(stepsByLocalDay([{ startDate: "n'importe quoi", endDate: "x", value: 5 }, { startDate: REAL[0].startDate, endDate: REAL[0].endDate, value: -3 }], { keyOf }), {});
});
