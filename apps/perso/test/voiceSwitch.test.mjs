// Interrupteur « Voix de Jeffrey » (01/11/2026) : coupé, Jeffrey se tait partout (aucune lecture,
// aucune synthèse, aucune préparation) mais écrit toujours. Pont natif simulé : aucun réseau.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// localStorage minimal (Node) : même préfixe que store.js.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const put = (k, v) => localStorage.setItem(`protocole:${k}`, JSON.stringify(v));
const read = (k) => JSON.parse(localStorage.getItem(`protocole:${k}`));

const { voiceSettings, voiceServer, voiceEnabled, saveVoiceSettings } = await import("../src/lib/voiceConfig.js");
const voice = await import("../src/lib/voice.js");
const { notificationSpec } = await import("../src/lib/jeffreyNotify.js");
const { exportData } = await import("../src/store.js");

// Pont natif simulé : garde les appels, rend `speechDone` comme le natif.
function fakeBridge({ nativeEnabled = true } = {}) {
  const calls = [];
  const listeners = {};
  let current = null;
  let enabled = nativeEnabled;
  const emit = (ev, data) => (listeners[ev] || []).forEach((cb) => cb(data));
  return {
    calls,
    get nativeEnabled() { return enabled; },
    addListener(ev, cb) { (listeners[ev] ||= []).push(cb); return { remove() {} }; },
    async speechBegin(o) {
      calls.push(["begin", o.id, [...o.chunks], o.play]);
      if (!enabled) return { skipped: true, disabled: true };
      if (current) emit("speechDone", { id: current, ok: false, cancelled: true });
      current = o.id;
      return {};
    },
    async speechPush(o) { calls.push(["push", o.id, [...o.chunks]]); },
    async speechFinish(o) {
      calls.push(["finish", o.id]);
      if (current === o.id) { current = null; emit("speechDone", { id: o.id, ok: true, cancelled: false }); }
    },
    async speechStop() {
      calls.push(["stop"]);
      if (current) { const id = current; current = null; emit("speechDone", { id, ok: false, cancelled: true }); }
    },
    async setEnabled({ enabled: on }) {
      calls.push(["setEnabled", on]);
      enabled = on;
      if (!on && current) { const id = current; current = null; emit("speechDone", { id, ok: false, cancelled: true }); }
      return { enabled };
    },
  };
}
const tick = () => new Promise((r) => setImmediate(r));

const S1 = "Bonjour Monsieur, voici la première phrase du jour. ";
const S2 = "Et voici une seconde phrase pour la suite. ";
const S3 = "Puis une troisième, qui ne doit jamais partir. ";

beforeEach(() => {
  mem.clear();
  put("litellmUrl", "https://serveur.test");
  put("voiceKey", "cle-de-test");
  voice._setVoiceBridge(null);
});

test("par défaut la voix est activée, même avec l'ancienne forme des réglages", () => {
  assert.equal(voiceEnabled(), true);
  put("jeffreyVoice", { voice: "fr-fr-x-frd-local", rate: 1.4, pitch: 0.9 });
  assert.deepEqual(voiceSettings(), { speed: 1.2, url: "", enabled: true });
  assert.deepEqual(voiceServer(), { url: "https://serveur.test", key: "cle-de-test", speed: 1.2 });
});

test("coupée : plus aucun serveur vocal ; adresse, vitesse et clé gardées ; choix relu et exporté", () => {
  saveVoiceSettings({ speed: 1.35, url: "https://voix.test/" });
  saveVoiceSettings({ enabled: false });
  assert.equal(voiceServer(), null);
  assert.deepEqual(read("jeffreyVoice"), { speed: 1.35, url: "https://voix.test/", enabled: false });
  assert.equal(read("voiceKey"), "cle-de-test");
  assert.equal(voiceSettings().enabled, false, "relu depuis le stockage (redémarrage)");
  const out = exportData().data;
  assert.equal(out.jeffreyVoice.enabled, false);
  assert.equal(out.voiceKey, undefined, "la clé n'est jamais exportée");
  saveVoiceSettings({ enabled: true });
  assert.deepEqual(voiceServer(), { url: "https://voix.test", key: "cle-de-test", speed: 1.35 });
});

test("coupée : la notification n'a pas de bouton Écouter, le texte reste", () => {
  const entries = [
    { id: "u", role: "user", text: "Le brief du matin, Jeffrey.", mode: "brief" },
    { id: "a", role: "assistant", text: "Bonjour Monsieur. Upper A aujourd'hui, le genou va bien." },
  ];
  assert.ok(notificationSpec(entries).listen, "voix active : Écouter proposé");
  saveVoiceSettings({ enabled: false });
  const s = notificationSpec(entries);
  assert.equal(s.listen, null);
  assert.equal(s.text, "Bonjour Monsieur. Upper A aujourd'hui, le genou va bien.");
});

test("coupée : speak et le flux ne touchent pas le pont natif (ni lecture, ni cache, ni préparation)", async () => {
  const b = fakeBridge();
  voice._setVoiceBridge(b, true);
  saveVoiceSettings({ enabled: false });
  assert.equal(voice.voiceReady(), false);
  assert.deepEqual(await voice.speak("Bonjour Monsieur, une phrase assez longue.", { play: false }), { ok: false, skipped: true });
  assert.deepEqual(await voice.speak("Bonjour Monsieur, une phrase assez longue."), { ok: false, skipped: true });
  const st = voice.createSpeechStream();
  st.feed(S1); st.feed(S1 + S2);
  assert.equal((await st.finish()).skipped, true);
  assert.deepEqual(b.calls, []);
});

test("couper pendant une réponse : parole arrêtée, phrases suivantes jetées, le texte continue", async () => {
  const b = fakeBridge();
  voice._setVoiceBridge(b, true);
  const st = voice.createSpeechStream();
  let shown = "";
  const onText = (t) => { shown = t; st.feed(t); }; // comme JeffreyChat : affichage puis voix
  onText(S1);
  await tick();
  assert.deepEqual(b.calls.map((c) => c[0]), ["begin"]);
  await voice.setVoiceEnabled(false);
  onText(S1 + S2);
  onText(S1 + S2 + S3);
  const r = await st.finish();
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true, "fin signalée comme annulée, pas comme une panne");
  assert.equal(shown, S1 + S2 + S3, "le texte s'écrit jusqu'au bout");
  assert.deepEqual(b.calls.map((c) => c[0]), ["begin", "setEnabled", "stop"]);
  assert.equal(b.nativeEnabled, false, "réglage recopié au natif");
});

test("refus du natif (déjà coupé de son côté) : la voix s'arrête net, rien n'attend", async () => {
  const b = fakeBridge({ nativeEnabled: false });
  voice._setVoiceBridge(b, true);
  assert.deepEqual(await voice.speak("Bonjour Monsieur, une phrase assez longue."), { ok: false, skipped: true });
  const st = voice.createSpeechStream();
  st.feed(S1);
  await tick();
  st.feed(S1 + S2);
  const r = await st.finish();
  assert.deepEqual([r.ok, r.skipped, r.disabled], [false, true, true]);
  assert.deepEqual(b.calls.map((c) => c[0]), ["begin", "begin"], "aucune phrase poussée ni fin envoyée après le refus");
});

test("réactiver : la voix sert à la demande suivante, sans rejouer d'ancienne phrase", async () => {
  const b = fakeBridge();
  voice._setVoiceBridge(b, true);
  const old = voice.createSpeechStream();
  old.feed(S1);
  await tick();
  await voice.setVoiceEnabled(false);
  old.feed(S1 + S2);
  await voice.setVoiceEnabled(true);
  old.feed(S1 + S2 + S3); // l'ancien flux reste muet
  await old.finish();
  const fresh = voice.createSpeechStream();
  fresh.feed("Nouvelle réponse, Monsieur, toute fraîche. ");
  await tick();
  await fresh.finish();
  const begins = b.calls.filter((c) => c[0] === "begin").map((c) => c[2].join(" "));
  assert.equal(begins.length, 2);
  assert.ok(begins[1].startsWith("Nouvelle réponse"), begins[1]);
  assert.ok(!b.calls.some((c) => c[0] === "push"), "aucune ancienne phrase renvoyée");
});

test("au lancement, l'interrupteur stocké est recopié au natif", async () => {
  const b = fakeBridge();
  voice._setVoiceBridge(b, true);
  saveVoiceSettings({ enabled: false });
  await voice.syncVoiceEnabled();
  assert.deepEqual(b.calls, [["setEnabled", false]]);
});
