// J4.1 — brief du matin : ce qui manque, quand l'app le lance (depuis le 01/11/2026 : quand le
// genou est noté) ; et la fusion Health Connect partagée par l'app et la page sans écran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEF, briefMissing, briefInApp } from "../src/coach/brief.js";
import { mergeSteps, mergeSleep, mergeWeight, mergeRhr, mergeNaps } from "../src/healthMerge.js";
import { jeffreyAsk, effortFor } from "../src/coach/jeffrey.js";

const D = "2026-10-30";
const t = (h, m) => new Date(2026, 9, 30, h, m, 0, 0);
const hm = (d) => `${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

test("briefMissing : nuit, pesée, genou du jour, dans cet ordre", () => {
  assert.deepEqual(briefMissing({ today: D, sleep: [], weight: [], knee: [] }), ["nuit", "pesée", "genou"]);
  assert.deepEqual(briefMissing({ today: D, sleep: [{ date: D }], weight: [{ date: "2026-10-29" }], knee: [{ date: D }] }), ["pesée"]);
  assert.deepEqual(briefMissing({ today: D, sleep: [{ date: D }], weight: [{ date: D }], knee: [{ date: D }] }), []);
});

test("briefInApp : le brief part quand le genou est noté (01/11/2026), le matin seulement", () => {
  const knee = [{ date: D, pain: 2, baseline: true }];
  assert.deepEqual(BRIEF, { start: [5, 0], end: [12, 0] });
  // Genou pas encore noté : on attend, même avec la nuit et la pesée (plus de boucle ni de 10 h).
  assert.equal(briefInApp({ now: t(6, 30), today: D, knee: [] }), "wait");
  assert.equal(briefInApp({ now: t(11, 59), today: D, knee: [{ date: "2026-10-29" }] }), "wait");
  // Genou noté : brief, quelle que soit l'heure du matin.
  assert.equal(briefInApp({ now: t(5, 0), today: D, knee }), "brief");
  assert.equal(briefInApp({ now: t(11, 59), today: D, knee }), "brief");
  // « Le brief tout de suite » : sans genou.
  assert.equal(briefInApp({ now: t(6, 30), today: D, knee: [], force: true }), "brief");
  // Hors du matin : rien, même avec le genou ou le bouton.
  assert.equal(briefInApp({ now: t(4, 59), today: D, knee }), "off");
  assert.equal(briefInApp({ now: t(12, 0), today: D, knee, force: true }), "off");
  // Déjà fait aujourd'hui : jamais un second brief payé ; un marqueur de la veille ne compte pas.
  assert.equal(briefInApp({ now: t(7, 0), today: D, knee, state: { doneDate: D } }), "done");
  assert.equal(briefInApp({ now: t(7, 0), today: D, knee, state: { doneDate: "2026-10-29" } }), "brief");
});

test("jeffreyAsk brief : date, ce qui manque, rappels, réflexion courte", () => {
  const a = jeffreyAsk("brief", { dateLabel: "vendredi 30 octobre", missing: ["genou"], reminders: ["sauvegarde il y a 16 j"] });
  assert.equal(a.mode, "brief");
  assert.match(a.apiText, /BRIEF DU MATIN du vendredi 30 octobre/);
  assert.match(a.apiText, /Il manque encore : genou\. .*n'inventez jamais/);
  assert.match(a.apiText, /Rappels possibles : sauvegarde il y a 16 j/);
  assert.match(jeffreyAsk("brief").apiText, /sont là/);
  assert.equal(effortFor("brief"), "low");
});

test("healthMerge : même règle que la synchro de l'app (écrase le jour, garde le reste)", () => {
  const sleep = mergeSleep([{ date: "2026-10-29", hours: 6, quality: 3, source: "manual" }, { date: D, hours: 5, quality: 2, source: "manual" }],
    { [D]: { hours: 5.876, quality: 4 }, "2026-10-28": { hours: 6.1 } });
  assert.deepEqual(sleep.find((s) => s.date === D), { date: D, hours: 5.88, quality: 4, source: "healthconnect" });
  assert.deepEqual(sleep.find((s) => s.date === "2026-10-29"), { date: "2026-10-29", hours: 6, quality: 3, source: "manual" });
  assert.equal("quality" in sleep.find((s) => s.date === "2026-10-28"), false);
  const w = mergeWeight([{ date: "2026-09-01", kg: 95 }], { [D]: 93.8 }, { [D]: "06:02", "2026-09-01": "07:10" });
  assert.deepEqual(w.find((x) => x.date === D), { date: D, kg: 93.8, source: "healthconnect", time: "06:02" });
  assert.equal(w.find((x) => x.date === "2026-09-01").time, "07:10");
  assert.deepEqual(mergeSteps([], { [D]: 1200 }), [{ date: D, count: 1200, source: "healthconnect" }]);
  assert.deepEqual(mergeRhr([], { [D]: 52 }), [{ date: D, bpm: 52 }]);
  assert.deepEqual(mergeNaps([], { [D]: 25 }), [{ date: D, minutes: 25 }]);
  assert.deepEqual(mergeSleep([{ date: D, hours: 7 }], {}), [{ date: D, hours: 7 }]);
});
