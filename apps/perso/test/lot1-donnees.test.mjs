// Audit du 10/11/2026, lot 1 : séance passée modifiée après une relecture (point 1), écriture
// refusée par le stockage (point 3), restauration vérifiée, tout ou rien, puis figée (point 4).
// Faux stockage en mémoire, quota simulé, données fictives : rien ne touche le téléphone.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
let quota = Infinity; // nombre total de caractères accepté
let onQuotaFail = null; // appelé à chaque écriture refusée (pour simuler une autre page qui écrit)
const used = () => [...mem].reduce((s, [k, v]) => s + k.length + v.length, 0);
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    const prev = mem.has(k) ? k.length + mem.get(k).length : 0;
    if (used() - prev + k.length + String(v).length > quota) {
      onQuotaFail?.();
      const e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
    }
    mem.set(k, String(v));
  },
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.window = new EventTarget();

let n = 0;
const freshStore = () => import(`../src/store.js?t=${++n}`); // le gel est propre à chaque page
const put = (k, v) => mem.set(`protocole:${k}`, JSON.stringify(v));
const read = (k) => JSON.parse(mem.get(`protocole:${k}`));

const { sameSession, upsertSession } = await import("../src/lib/trainingEdit.js");

beforeEach(() => { mem.clear(); quota = Infinity; onQuotaFail = null; });

// --- Point 1 ---------------------------------------------------------------------------------

const upper = { id: "2026-11-02-Upper A-1", date: "2026-11-02", type: "Upper A", exercices: [{ nom: "Rowing", series: [] }] };
const lower = { id: "2026-11-03-Lower B-2", date: "2026-11-03", type: "Lower B" };

test("point 1 : après une relecture (objets neufs), la séance modifiée est remplacée par son id", () => {
  const editing = upper;                                   // ouverte avant de quitter l'app
  const relu = JSON.parse(JSON.stringify([upper, lower]));  // retour au premier plan : relecture
  const rec = { ...upper, exercices: [{ nom: "Rowing", series: [{ poids: "60", val: "8", fait: true }] }] };
  const { list, replaced } = upsertSession(relu, editing, rec);
  assert.equal(replaced, true);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], rec);
  // L'ancien code (comparaison par référence) ne remplaçait rien :
  assert.deepEqual(relu.map((x) => (x === editing ? rec : x)), relu);
});

test("point 1 : vieille séance sans id retrouvée par son contenu ; deux séances distinctes ne se confondent pas", () => {
  const old = { date: "2026-07-01", type: "Basket", duration: 60, rpe: 7 };
  const relu = JSON.parse(JSON.stringify([old, lower]));
  const { list, replaced } = upsertSession(relu, old, { ...old, rpe: 8 });
  assert.equal(replaced, true);
  assert.equal(list[0].rpe, 8);
  assert.equal(sameSession(upper, lower), false);
  assert.equal(sameSession({ ...upper }, { id: upper.id }), true);
  assert.equal(sameSession({ id: "a" }, { date: "x" }), false);
});

test("point 1 : séance disparue entre-temps → ajoutée plutôt que perdue ; nouvelle séance → ajoutée", () => {
  const r1 = upsertSession([lower], upper, { ...upper, rpe: 9 });
  assert.equal(r1.replaced, false);
  assert.equal(r1.list.length, 2);
  const r2 = upsertSession([lower], null, upper);
  assert.deepEqual(r2.list, [lower, upper]);
});

// --- Point 3 ---------------------------------------------------------------------------------

test("point 3 : écriture refusée (stockage plein) → false, erreur retenue, événement émis", async () => {
  const { store, storageError, STORAGE_ERROR_EVENT } = await freshStore();
  assert.equal(await store.set("weightLog", [{ date: "2026-11-02", kg: 93.4 }]), true);
  const seen = [];
  const on = (e) => seen.push(e.detail);
  window.addEventListener(STORAGE_ERROR_EVENT, on);
  quota = used() + 10;
  assert.equal(await store.set("foodLog", [{ date: "2026-11-02", name: "Skyr", q: 150 }]), false);
  window.removeEventListener(STORAGE_ERROR_EVENT, on);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].key, "foodLog");
  assert.equal(seen[0].quota, true);
  assert.equal(storageError().key, "foodLog");
  assert.equal(mem.has("protocole:foodLog"), false);
  assert.deepEqual(read("weightLog"), [{ date: "2026-11-02", kg: 93.4 }]); // rien d'autre touché
});

test("point 3 : undefined retire la clé (relue comme la valeur par défaut, comme avant)", async () => {
  const { store, getSync } = await freshStore();
  put("trainingDraft", { type: "Upper A" });
  assert.equal(await store.set("trainingDraft", undefined), true);
  assert.equal(getSync("trainingDraft", null), null);
});

test("point 3 : place occupée comptée sur les seules clés de l'app, plus grosses en tête", async () => {
  const { storageUsage } = await freshStore();
  put("foodLog", Array.from({ length: 50 }, (_, i) => ({ id: i, name: "Aliment fictif" })));
  put("weightLog", [{ date: "2026-11-02", kg: 93 }]);
  mem.set("autre-app:x", "y".repeat(500));
  const u = storageUsage(2);
  assert.equal(u.top[0].key, "foodLog");
  assert.equal(u.top.length, 2);
  assert.equal(u.chars, used() - "autre-app:x".length - 500);
});

// --- Point 4 ---------------------------------------------------------------------------------

const goodExport = () => ({ app: "PROTOCOLE", schema: 1, exportedAt: "2026-11-09T08:00:00.000Z", data: {
  weightLog: [{ date: "2026-11-08", kg: 92.9 }], trainingLog: [upper], phase: "recomposition", hsrWeek: 9,
  targets: { protein: 200 }, palierWeekly: null, coachProfile: null, jeffreyLog: {}, basketSchedule: { weekly: [3, 5], matchDates: [] },
} });

test("point 4 : fichier abîmé (null, mauvais type, ligne illisible) refusé, rien d'écrit", async () => {
  const { importData, validateImport } = await freshStore();
  put("trainingLog", [lower]);
  for (const bad of [
    { trainingLog: null }, { weightLog: { date: "x" } }, { foodLog: [null] }, { targets: [] },
    { phase: 3 }, { hsrWeek: null }, { basketSchedule: { weekly: 3 } }, { jeffreyLog: "x" },
  ]) {
    const file = { app: "PROTOCOLE", data: { ...goodExport().data, ...bad } };
    assert.ok(validateImport(file).problems.length, JSON.stringify(bad));
    assert.throws(() => importData(file), (e) => e.code === "invalid");
  }
  assert.deepEqual(read("trainingLog"), [lower]);
  assert.equal(mem.has("protocole:weightLog"), false);
});

test("point 4 : JSON qui n'est pas une sauvegarde PROTOCOLE refusé", async () => {
  const { importData } = await freshStore();
  assert.throws(() => importData({ foo: 1 }), /aucune donnée PROTOCOLE/);
  assert.throws(() => importData([1, 2]), /pas une sauvegarde/);
  assert.equal(mem.size, 0);
});

test("point 4 : export de l'app accepté tel quel ; restauration puis stockage figé jusqu'au rechargement", async () => {
  const s1 = await freshStore();
  Object.entries(goodExport().data).forEach(([k, v]) => put(k, v));
  put("apiKey", "sk-fictive");
  const exported = s1.exportData();
  assert.deepEqual(s1.validateImport(exported).problems, []);
  assert.equal("apiKey" in exported.data, false);

  mem.clear(); put("apiKey", "sk-fictive"); put("stepsLog", [{ date: "2026-11-10", steps: 9000 }]);
  const s2 = await freshStore();
  s2.importData(exported);
  assert.deepEqual(read("weightLog"), [{ date: "2026-11-08", kg: 92.9 }]);
  assert.deepEqual(read("stepsLog"), [{ date: "2026-11-10", steps: 9000 }]); // absente du fichier : gardée
  assert.equal(read("apiKey"), "sk-fictive");
  assert.equal(s2.storageFrozen(), true);
  // La synchro Health Connect qui réécrirait l'état d'avant pendant les 800 ms : refusée.
  assert.equal(await s2.store.set("weightLog", [{ date: "2026-11-01", kg: 95 }]), false);
  assert.deepEqual(read("weightLog"), [{ date: "2026-11-08", kg: 92.9 }]);
  assert.throws(() => s2.importData(exported), /déjà faite/);
});

test("point 4 : stockage plein en cours de restauration → état d'avant relu et retrouvé, pas figé", async () => {
  const s = await freshStore();
  put("weightLog", [{ date: "2026-10-01", kg: 95 }]);
  const before = new Map(mem);
  const file = goodExport();
  file.data.trainingLog = [{ ...upper, note: "x".repeat(5000) }];
  quota = used() + 1000; // assez pour weightLog, pas pour trainingLog
  assert.throws(() => s.importData(file), (e) => e.code === "write" && e.unrestored.length === 0
    && /stockage plein ; rien n'a été modifié/.test(e.message));
  assert.deepEqual(new Map(mem), before);
  assert.equal(s.storageFrozen(), false);
});

// Cas reproduit le 11/11/2026 sur la première version : weightLog volumineux devient petit,
// sleepLog grossit dans la place libérée, puis trainingLog dépasse le quota. Remettre les clés dans
// l'ordre d'écriture échouait sur weightLog (plus de place), et l'échec était ignoré.
const bigToSmall = () => {
  put("weightLog", Array.from({ length: 60 }, (_, i) => ({ date: `2026-09-${String(i % 30 + 1).padStart(2, "0")}`, kg: 95, note: "pesée fictive" })));
  put("sleepLog", [{ date: "2026-11-01", hours: 5.5 }]);
  put("trainingLog", [lower]);
  const file = { app: "PROTOCOLE", data: {
    weightLog: [{ date: "2026-11-08", kg: 92.9 }],
    sleepLog: Array.from({ length: 60 }, (_, i) => ({ date: `2026-08-${String(i % 30 + 1).padStart(2, "0")}`, hours: 5.5, note: "nuit fictive" })),
    trainingLog: [{ ...upper, note: "x".repeat(4000) }],
  } };
  quota = used() + 200;
  return file;
};

test("point 4 : retour arrière quand la place libérée a été reprise par une autre clé (cas reproduit)", async () => {
  const s = await freshStore();
  const file = bigToSmall();
  const before = new Map(mem);
  // Preuve que le cas est réel : l'ancien retour arrière (ordre d'écriture, erreurs ignorées) le rate.
  const copy = new Map(mem);
  const old = () => {
    const prev = new Map(["weightLog", "sleepLog"].map((k) => [k, mem.get(`protocole:${k}`)]));
    localStorage.setItem("protocole:weightLog", JSON.stringify(file.data.weightLog));
    localStorage.setItem("protocole:sleepLog", JSON.stringify(file.data.sleepLog));
    assert.throws(() => localStorage.setItem("protocole:trainingLog", JSON.stringify(file.data.trainingLog)));
    for (const k of ["weightLog", "sleepLog"]) { try { localStorage.setItem(`protocole:${k}`, prev.get(k)); } catch { /* ignoré */ } }
  };
  old();
  assert.notEqual(mem.get("protocole:weightLog"), copy.get("protocole:weightLog"));
  mem.clear(); copy.forEach((v, k) => mem.set(k, v));

  assert.throws(() => s.importData(file), (e) => e.code === "write" && e.unrestored.length === 0);
  assert.deepEqual(new Map(mem), before); // chaque clé relue : état d'avant exact
  assert.equal(s.storageFrozen(), false);
});

test("point 4 : retour arrière impossible → clé nommée, alerte émise, jamais présenté comme réussi", async () => {
  const s = await freshStore();
  const file = bigToSmall();
  const seen = [];
  const on = (e) => seen.push(e.detail);
  window.addEventListener(s.STORAGE_ERROR_EVENT, on);
  // Une autre page écrit pendant le retour arrière et reprend la place libérée.
  onQuotaFail = () => { onQuotaFail = null; quota = used() - 400; };
  assert.throws(() => s.importData(file), (e) => e.code === "rollback" && e.unrestored.includes("weightLog")
    && /retour arrière incomplet pour : .*weightLog/.test(e.message));
  window.removeEventListener(s.STORAGE_ERROR_EVENT, on);
  assert.equal(seen.length, 2); // l'écriture refusée, puis le retour arrière incomplet
  assert.deepEqual(seen[1].unrestored, s.storageError().unrestored);
  assert.equal(s.storageFrozen(), false);
});

test("point 4 : gel après import : écritures ET suppressions refusées, y compris depuis une autre page", async () => {
  const main = await freshStore();
  put("trainingDraft", { type: "Upper A" });
  main.importData(goodExport());
  const lock = read("restoreLock");
  assert.equal(await main.store.del("trainingDraft"), false);
  assert.equal(await main.store.set("trainingDraft", undefined), false); // undefined = suppression
  assert.deepEqual(read("trainingDraft"), { type: "Upper A" });
  // Page sans écran (pont JEFFREY, notification, sauvegarde) : autre instance du module.
  const bridge = await freshStore();
  assert.equal(bridge.storageFrozen(), true);
  assert.equal(await bridge.store.set("weightLog", [{ date: "2026-01-01", kg: 99 }]), false);
  assert.equal(await bridge.store.del("weightLog"), false);
  assert.throws(() => bridge.importData(goodExport()), /déjà faite/);
  assert.deepEqual(read("weightLog"), goodExport().data.weightLog);
  assert.equal("restoreLock" in main.exportData().data, false); // jamais exporté
  // Marqueur périmé : plus de gel.
  mem.set("protocole:restoreLock", String(lock - bridge.RESTORE_LOCK_MS - 1));
  assert.equal(bridge.storageFrozen(), false);
  // Redémarrage de la page principale : main.jsx lève le marqueur avant tout rendu.
  mem.set("protocole:restoreLock", String(Date.now()));
  const restarted = await freshStore();
  restarted.releaseRestoreLock();
  assert.equal(restarted.storageFrozen(), false);
  assert.equal(await restarted.store.set("weightLog", [{ date: "2026-11-11", kg: 92.5 }]), true);
});
