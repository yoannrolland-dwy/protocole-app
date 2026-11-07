// Repos lancé par JEFFREY (06/11/2026, choix de Yoann : « bip sans couper ») : PROTOCOLE ne parle
// pas et ne prend pas la priorité audio. Le réveil natif est demandé sans voix et `quiet` ; l'app
// ouverte garde ce repos silencieux quand on le règle à l'écran. Pont natif simulé, sans réseau.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const alarms = [];
globalThis.window = {
  JeffreyBridgePage: { restAlarm: (json) => alarms.push(JSON.parse(json)) },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
};

const { newSessionDraft, logSet, restAction } = await import("@rawcare/core/session/voiceSession");
const { markJeffreyRest, nativeRest } = await import("../src/lib/bridgeRest.js");
const { writeDraft, readDraft } = await import("../src/lib/sessionDraft.js");
const { restTimer, restState, syncRestFromDraft } = await import("../src/lib/restTimer.js");

const today = new Date().toISOString().slice(0, 10);
const ctx = { training: [], knee: [], now: Date.now() };
// Ce que fait le pont pour un geste de séance (lib/bridge.js, runSessionNow) : règle du cœur,
// marquage, écriture, réveil.
function bridgeGesture(action, d, r) {
  let draft = r.draft;
  if (action === "noter_serie") draft = { ...draft, rest: { secs: r.restSecs, remaining: r.restSecs, endAt: Date.now() + r.restSecs * 1000, label: draft.exos[r.ei].nom, speech: "Série 2." } };
  draft = markJeffreyRest(draft, action);
  writeDraft(draft);
  nativeRest(draft.rest);
  return draft;
}

test("série notée par JEFFREY : réveil sans voix et silencieux, repos marqué « jeffrey »", () => {
  const d0 = writeDraft(newSessionDraft({ type: "Upper A", training: [], hsrWeek: 9, date: today, start: "07:00" }));
  alarms.length = 0;
  bridgeGesture("noter_serie", d0, logSet(d0, { reps: 8, kg: 30 }, ctx));
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].quiet, true);
  assert.equal(alarms[0].voice, null);
  assert.ok(alarms[0].endAt > Date.now());
  assert.equal(readDraft().rest.source, "jeffrey");
});

test("+30 s et pause par JEFFREY : toujours silencieux ; autres gestes non marqués", () => {
  alarms.length = 0;
  bridgeGesture("repos", null, restAction(readDraft(), "plus30", Date.now()));
  assert.deepEqual([alarms[0].quiet, alarms[0].voice], [true, null]);
  bridgeGesture("repos", null, restAction(readDraft(), "pause", Date.now()));
  assert.equal(alarms[1].endAt, null, "pause : réveil retiré");
  assert.equal(readDraft().rest.source, "jeffrey");
  assert.equal(markJeffreyRest({ rest: { secs: 60 } }, "aller_a").rest.source, undefined);
  assert.equal(markJeffreyRest({ exos: [] }, "noter_serie").rest, undefined, "sans repos : rien à marquer");
});

test("app ouverte : le repos de JEFFREY reste marqué si on le règle à l'écran ; « Lancer » le rend à l'app", () => {
  bridgeGesture("repos", null, restAction(readDraft(), "reprendre", Date.now()));
  syncRestFromDraft();
  assert.equal(restState().source, "jeffrey");
  restTimer.add(30);
  assert.equal(readDraft().rest.source, "jeffrey", "+30 s à l'écran : garde l'origine");
  restTimer.toggle(); // pause
  restTimer.toggle(); // reprise
  assert.equal(restState().source, "jeffrey", "reprise : même origine");
  restTimer.toggle(); // pause
  restTimer.toggle("Rowing", "Série 2 de rowing."); // « Lancer » à l'écran
  assert.equal(restState().source, "", "repos de l'app : PROTOCOLE reparle");
  restTimer.start(90, "Rowing", "Série 3 de rowing.");
  assert.equal(readDraft().rest.source, undefined, "série cochée à l'écran : repos de l'app");
  restTimer.stop();
});

test("séance terminée par JEFFREY : réveil retiré", () => {
  alarms.length = 0;
  nativeRest(null);
  assert.deepEqual(alarms, [{ endAt: null }]);
});

// 07/11/2026 (demande de Yoann : « Je ne veux plus que Jeffrey me parle à la fin du minuteur ») :
// toute fin de repos, même lancée dans PROTOCOLE, ne demande plus au réveil natif qu'un bip.
test("repos lancé dans PROTOCOLE : le réveil ne reçoit aucune voix", async () => {
  const { alarmRequest } = await import("../src/timerNotify.js");
  const req = alarmRequest(123456, "Rowing");
  assert.deepEqual(req, { endsAt: 123456, exercise: "Rowing" });
  assert.equal("voice" in req, false);
});
