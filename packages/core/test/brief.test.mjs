// J4.1 — brief du matin : ce qui manque, la décision à chaque réveil, l'heure du prochain
// réveil ; et la fusion Health Connect partagée par l'app et le brief.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEF, briefMissing, briefDecision, nextBriefAlarm, briefRetry } from "../src/coach/brief.js";
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

test("briefDecision : attendre en silence avant 9 h, relancer à 9 h une fois, brief à 10 h ou dès que tout est là", () => {
  const miss = ["genou"];
  assert.equal(briefDecision({ now: t(5, 0), today: D, missing: miss }), "wait");
  // 30/10/2026 : plus de notification « il me manque… » avant 9 h.
  assert.equal(briefDecision({ now: t(5, 17), today: D, missing: miss }), "wait");
  assert.equal(briefDecision({ now: t(8, 59), today: D, missing: miss }), "wait");
  assert.equal(briefDecision({ now: t(6, 40), today: D, missing: [] }), "brief");
  assert.equal(briefDecision({ now: t(9, 0), today: D, missing: miss }), "remind");
  assert.equal(briefDecision({ now: t(9, 20), today: D, missing: miss, state: { remindedDate: D } }), "update");
  assert.equal(briefDecision({ now: t(10, 0), today: D, missing: miss, state: { remindedDate: D } }), "brief");
  // Déjà fait, ou l'app ouverte a pris la main ce matin : jamais un second brief payé.
  assert.equal(briefDecision({ now: t(7, 0), today: D, missing: [], state: { doneDate: D } }), "skip");
  assert.equal(briefDecision({ now: t(7, 0), today: D, missing: [], state: { appDate: D } }), "skip");
  // Un marqueur de la veille ne compte pas.
  assert.equal(briefDecision({ now: t(7, 0), today: D, missing: [], state: { doneDate: "2026-10-29", appDate: "2026-10-29" } }), "brief");
});

test("nextBriefAlarm : 5 h 17, puis toutes les 5 min sans sauter 9 h ni 10 h, puis demain", () => {
  assert.equal(hm(nextBriefAlarm(t(3, 0))), "30 05:17");
  assert.equal(hm(nextBriefAlarm(t(5, 17))), "30 05:22");
  assert.equal(hm(nextBriefAlarm(t(8, 57))), "30 09:00");
  assert.equal(hm(nextBriefAlarm(t(9, 50))), "30 09:55");
  assert.equal(hm(nextBriefAlarm(t(9, 57))), "30 10:00");
  assert.equal(hm(nextBriefAlarm(t(10, 0))), "31 05:17");
  assert.equal(hm(nextBriefAlarm(t(6, 0), { doneToday: true })), "31 05:17");
  assert.equal(hm(nextBriefAlarm(t(23, 0))), "31 05:17");
});

test("briefRetry : 5 min après un échec, repli sans IA au 3e", () => {
  assert.equal(BRIEF.maxTries, 3);
  assert.equal(hm(briefRetry(t(6, 0), 1).at), "30 06:05");
  assert.equal(briefRetry(t(6, 0), 3).fallback, true);
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
