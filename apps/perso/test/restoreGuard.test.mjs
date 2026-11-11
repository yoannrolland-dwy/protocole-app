// Audit du 10/11/2026, point 4 (fin) : pendant le gel qui suit une restauration, le pont JEFFREY et
// la réponse depuis la notification ne doivent jamais annoncer comme faite une écriture refusée.
// Faux stockage, données fictives. Le pont et la page sans écran ne se chargent pas sous Node
// (ils tirent des écrans .jsx) : la règle vit dans restoreGuard.js, testée ici, et son
// branchement dans bridge.js / briefPage.js est vérifié dans le code source.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.window = new EventTarget();

const { dispatchBridge, guardWrite, RESTORING, BRIDGE_WRITE_OPS } = await import("../src/lib/restoreGuard.js");
const { store } = await import("../src/store.js");
const { BRIDGE_ERRORS } = await import("@rawcare/core/coach/bridge");
const { PHRASES } = await import("../src/lib/jeffrey.js");

// Une restauration faite par la page principale : marqueur daté vu par les pages sans écran.
const restoreStarted = () => mem.set("protocole:restoreLock", String(Date.now()));
beforeEach(() => mem.clear());

// Opération du pont qui écrit et annonce « fait » (comme agir confirmé).
const fakeAgir = (calls, during) => async () => {
  calls.n++;
  during?.();
  const written = await store.set("macroLog", [{ date: "2026-11-11", water: 500 }]);
  return { ok: true, json: { fait: true, resume: "500 ml d'eau ajoutés", written } };
};

test("hors restauration : le pont répond normalement", async () => {
  const calls = { n: 0 };
  const r = await dispatchBridge("agir", fakeAgir(calls));
  assert.equal(r.ok, true);
  assert.equal(r.json.fait, true);
  assert.equal(calls.n, 1);
});

test("restauration en cours : agir, analyse, brief_fait → « restauration », rien n'est lancé ni écrit", async () => {
  restoreStarted();
  for (const op of BRIDGE_WRITE_OPS) {
    const calls = { n: 0 };
    const r = await dispatchBridge(op, fakeAgir(calls));
    assert.deepEqual(r, { ok: false, erreur: RESTORING }, op);
    assert.equal(calls.n, 0, op);
  }
  assert.equal(mem.has("protocole:macroLog"), false);
});

test("gel apparu pendant l'opération : l'écriture est refusée et le « fait » écarté", async () => {
  const calls = { n: 0 };
  const r = await dispatchBridge("agir", fakeAgir(calls, restoreStarted));
  assert.equal(calls.n, 1);
  assert.deepEqual(r, { ok: false, erreur: RESTORING }); // jamais { fait: true }
  assert.equal(mem.has("protocole:macroLog"), false);
});

test("lire et version restent possibles pendant la restauration (aucune écriture)", async () => {
  restoreStarted();
  assert.deepEqual(await dispatchBridge("lire", async () => ({ ok: true, json: { faits: {} } })), { ok: true, json: { faits: {} } });
  assert.equal((await dispatchBridge("version", async () => ({ ok: true, json: { pont: 1 } }))).ok, true);
});

test("notification : réponse bloquée avant ou pendant, avec la phrase « réessayez »", async () => {
  let ran = 0;
  restoreStarted();
  assert.deepEqual(await guardWrite(async () => { ran++; return "c'est fait"; }), { blocked: true });
  assert.equal(ran, 0); // aucun appel à l'IA payé pendant la restauration
  mem.clear();
  assert.deepEqual(await guardWrite(async () => { restoreStarted(); return "c'est fait"; }), { blocked: true });
  mem.clear();
  assert.deepEqual(await guardWrite(async () => "c'est fait"), { blocked: false, value: "c'est fait" });
  const phrase = PHRASES.restoring.join(" ");
  assert.match(phrase, /Restauration en cours/);
  assert.match(phrase, /rien n'a été fait/);
  assert.match(phrase, /Réessayez/);
});

test("contrat du pont : « restauration » est un code connu (jamais réécrit en « interne »)", () => {
  assert.ok(BRIDGE_ERRORS.includes(RESTORING));
});

test("branchement : le pont et la page de notification passent par la garde", () => {
  const bridge = readFileSync(new URL("../src/lib/bridge.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/briefPage.js", import.meta.url), "utf8");
  const handler = bridge.slice(bridge.indexOf("export async function handleBridgeRequest"));
  assert.match(handler, /return await dispatchBridge\(op, async \(\) => \{[\s\S]*op === "agir"[\s\S]*\}\);/);
  assert.match(page, /guardWrite\(\(\) => runReply\(/);
  assert.match(page, /if \(g\.blocked\) return finish\(\{ notify: [^\n]*say\("restoring"\)/);
  assert.match(page, /async function signalCheck\(\) \{\n[^\n]*\n  if \(storageFrozen\(\)\) return finish\(\{\}\);/);
  assert.match(page, /guardWrite\(\(\) => runBrief\(/);
});
