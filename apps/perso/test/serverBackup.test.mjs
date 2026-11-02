// Sauvegarde sur le serveur Oracle (02/11/2026) : envoi, erreurs sans reprise, liste, restauration
// vérifiée, date qui fait taire le rappel. Requêtes simulées : aucun réseau.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const put = (k, v) => localStorage.setItem(`protocole:${k}`, JSON.stringify(v));
const read = (k) => JSON.parse(localStorage.getItem(`protocole:${k}`));

const { sendBackup, listBackups, fetchBackup, lastOffPhoneBackup, backupConfig, BACKUP_DEFAULT_URL } = await import("../src/lib/serverBackup.js");

const fakeServer = (reply) => {
  const calls = [];
  const request = async (o) => { calls.push(o); return reply(o); };
  return { calls, request };
};

beforeEach(() => {
  mem.clear();
  put("weightLog", [{ date: "2026-11-02", kg: 93.4 }]);
  put("apiKey", "sk-secret"); put("litellmKey", "lk-secret"); put("voiceKey", "vk-secret");
  put("backupKey", "cle-sauvegarde");
});

test("sans clé : rien ne part", async () => {
  put("backupKey", "");
  const s = fakeServer(() => ({ status: 201, text: "{}" }));
  assert.deepEqual(await sendBackup("23h", s.request), { ok: false, skipped: true });
  assert.equal(s.calls.length, 0);
});

test("envoi : PUT /v1/backup, clé et créneau en en-têtes, export sans aucune clé secrète, marqueur posé", async () => {
  const s = fakeServer(() => ({ status: 201, text: JSON.stringify({ id: "b42", savedAt: "x", bytes: 10, sha256: "y" }) }));
  const now = new Date("2026-11-02T13:00:04.000Z");
  assert.deepEqual(await sendBackup("14h", s.request, now), { ok: true, id: "b42" });
  const [c] = s.calls;
  assert.equal(c.method, "PUT");
  assert.equal(c.url, `${BACKUP_DEFAULT_URL}/v1/backup`);
  assert.equal(c.headers.Authorization, "Bearer cle-sauvegarde");
  assert.equal(c.headers["X-Backup-Slot"], "14h");
  assert.equal(c.headers["Content-Type"], "application/json");
  const body = JSON.parse(c.body);
  assert.equal(body.app, "PROTOCOLE");
  assert.deepEqual(body.data.weightLog, [{ date: "2026-11-02", kg: 93.4 }]);
  for (const k of ["apiKey", "litellmKey", "voiceKey", "backupKey", "serverBackup"]) assert.equal(body.data[k], undefined, k);
  assert.doesNotMatch(c.body, /secret|cle-sauvegarde/);
  assert.deepEqual(read("serverBackup"), { okAt: now.toISOString(), okId: "b42", slot: "14h", errorAt: null, error: null });
});

test("erreurs : un seul essai, message lisible, la dernière réussite reste", async () => {
  const ok = fakeServer(() => ({ status: 201, text: "{}" }));
  await sendBackup("matin", ok.request, new Date("2026-11-02T06:10:00Z"));
  for (const [status, error] of [[401, "clé refusée"], [429, "trop d'envois en une minute, réessayez plus tard"], [-1, "serveur injoignable"], [413, "copie trop grosse (20 Mo au plus)"]]) {
    const s = fakeServer(() => ({ status, text: "" }));
    assert.deepEqual(await sendBackup("23h", s.request, new Date("2026-11-02T22:00:00Z")), { ok: false, error });
    assert.equal(s.calls.length, 1, "jamais de reprise automatique");
    const st = read("serverBackup");
    assert.equal(st.okAt, "2026-11-02T06:10:00.000Z");
    assert.equal(st.error, error);
  }
});

test("adresse : barre finale retirée, adresse par défaut si vide", () => {
  assert.equal(backupConfig().url, BACKUP_DEFAULT_URL);
  put("backupUrl", " https://serveur.test/sauvegarde/ ");
  assert.equal(backupConfig().url, "https://serveur.test/sauvegarde");
});

test("liste et restauration : copie vérifiée avant de l'accepter", async () => {
  const copy = { app: "PROTOCOLE", schema: 1, exportedAt: "2026-11-02T13:00:00Z", data: { weightLog: [] } };
  const s = fakeServer(({ url }) => {
    if (url.endsWith("/v1/backup")) return { status: 200, text: JSON.stringify([{ id: "b1", savedAt: "2026-11-02T13:00:04Z", slot: "14h", bytes: 1400000 }]) };
    if (url.endsWith("/v1/backup/b1")) return { status: 200, text: JSON.stringify(copy) };
    if (url.endsWith("/v1/backup/autre")) return { status: 200, text: JSON.stringify({ app: "AUTRE", data: {} }) };
    return { status: 404, text: "" };
  });
  assert.equal((await listBackups(s.request))[0].id, "b1");
  assert.deepEqual(await fetchBackup("b1", s.request), copy);
  await assert.rejects(fetchBackup("autre", s.request), /copie illisible/);
  await assert.rejects(fetchBackup("absent", s.request), /erreur 404/);
  assert.ok(s.calls.every((c) => c.method === "GET" && c.headers.Authorization === "Bearer cle-sauvegarde"));
});

test("rappel de 14 jours : la copie la plus récente, serveur ou manuelle, fait foi", async () => {
  assert.equal(lastOffPhoneBackup("2026-10-01"), "2026-10-01");
  assert.equal(lastOffPhoneBackup(null), null);
  const s = fakeServer(() => ({ status: 201, text: "{}" }));
  await sendBackup("23h", s.request, new Date(2026, 10, 2, 23, 0));
  assert.equal(lastOffPhoneBackup("2026-10-01"), "2026-11-02");
  assert.equal(lastOffPhoneBackup(null), "2026-11-02");
  assert.equal(lastOffPhoneBackup("2026-11-05"), "2026-11-05");
});
