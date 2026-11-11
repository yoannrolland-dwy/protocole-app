// Audit du 10/11/2026, lot 2 : conversation de Jeffrey (point 13) et date figée des écrans de Corps
// (point 14). Faux stockage, données fictives, aucun appel à l'IA.
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

const { mergeTurn, unionDay } = await import("../src/lib/jeffreyTurn.js");
const { saveTurn, saveDayMerged } = await import("../src/lib/conversationStore.js");
const { turnFlight } = await import("../src/lib/turnFlight.js");
const { rolloverDecision } = await import("../src/lib/dayRollover.js");
const { decideAction } = await import("@rawcare/core/coach/jeffrey");
const { today } = await import("@rawcare/core/dateUtils");

const D = today();
const readDay = () => JSON.parse(mem.get("protocole:jeffreyLog") || "{}")[D] || [];
const putDay = (entries) => mem.set("protocole:jeffreyLog", JSON.stringify({ [D]: entries }));
beforeEach(() => { mem.clear(); turnFlight.end(); });

// Conversation fictive : Jeffrey propose 500 ml d'eau, carte à confirmer.
const u1 = { id: "u1", role: "user", text: "J'ai bu 500 ml" };
const a1 = { id: "a1", role: "assistant", text: "Je l'ajoute ?", actions: [{ id: "t1", kind: "eau", ml: 500, label: "500 ml d'eau", status: "pending" }],
  toolResults: { t1: "Proposée à Monsieur, en attente de sa confirmation : rien n'est fait pour l'instant." } };
const u2 = { id: "u2", role: "user", text: "Et le genou ?" };
const a2 = { id: "a2", role: "assistant", text: "Notez-le, Monsieur." };
const confirm = (entries, writes) => decideAction(entries, "a1", "t1", { ok: true, apply: () => { writes.n++; return null; }, doneText: "C'est fait, Monsieur.", cancelledText: "" });

// --- Point 13 : une carte confirmée pendant une réponse ---------------------------------------

test("carte confirmée pendant une réponse : elle reste faite, un second tap n'écrit rien", () => {
  const writes = { n: 0 };
  const base = [u1, a1, u2];                 // ce que le tour a reçu au départ
  const result = [...base, a2];              // ce que le tour rend
  const current = confirm(base, writes);     // Monsieur a confirmé la carte pendant la réponse
  assert.equal(writes.n, 1);
  // Avant : le tour réécrivait le jour avec `result` → la carte redevenait « Confirmer ».
  assert.equal(result[1].actions[0].status, "pending");
  assert.notEqual(confirm(result, writes), null); // … et un second tap écrivait une deuxième fois
  writes.n = 1;
  const merged = mergeTurn(current, base, result);
  assert.deepEqual(merged.map((e) => e.id), ["u1", "a1", "u2", "a2"]);
  assert.equal(merged[1].actions[0].status, "done");
  assert.equal(confirm(merged, writes), null);
  assert.equal(writes.n, 1);
});

test("deux messages partis en même temps : aucune réponse perdue, chacune après sa question", () => {
  const start = [u1, a1];
  const point = { id: "u3", role: "user", text: "Faites-moi le point", mode: "point" };
  const pointReply = { id: "a3", role: "assistant", text: "Le point du jour… (payé)" };
  const chat = { id: "u4", role: "user", text: "Merci" };
  const chatReply = { id: "a4", role: "assistant", text: "Avec plaisir, Monsieur." };
  // Les deux messages ont été écrits avant que la première réponse n'arrive.
  let day = [...start, point, chat];
  day = mergeTurn(day, [...start, point], [...start, point, pointReply]);
  day = mergeTurn(day, [...start, point, chat], [...start, point, chat, chatReply]);
  assert.deepEqual(day.map((e) => e.id), ["u1", "a1", "u3", "a3", "u4", "a4"]);
  // Avant : le second tour réécrivait sa copie, où « a3 » n'existait pas → le point payé disparaissait.
  assert.equal([...start, point, chat, chatReply].some((e) => e.id === "a3"), false);
});

test("deux instances de l'écran (onglet Analyse et bulle) : un seul tour à la fois", () => {
  const seen = [];
  const off = turnFlight.subscribe(() => seen.push(turnFlight.count()));
  assert.equal(turnFlight.begin(), true);   // envoi depuis l'onglet Analyse
  assert.equal(turnFlight.begin(), false);  // envoi depuis la bulle pendant la réponse : refusé
  assert.equal(turnFlight.count(), 1);      // les deux instances se disent occupées
  turnFlight.end();
  assert.equal(turnFlight.begin(), true);   // la réponse finie, l'autre instance peut envoyer
  turnFlight.end();
  off();
  assert.deepEqual(seen, [1, 0, 1, 0]);
});

test("réunion écran / stockage : aucune entrée perdue, une décision prise d'un côté le reste", () => {
  const writes = { n: 0 };
  const screen = [u1, a1, u2];                                 // l'écran n'a pas encore relu
  const stored = [...confirm([u1, a1], writes), { id: "n1", role: "user", text: "depuis la notification" }];
  const day = unionDay(screen, stored);
  // Le message venu du stockage est remis juste après celui qui le précède là-bas (la carte a1).
  assert.deepEqual(day.map((e) => e.id), ["u1", "a1", "n1", "u2"]);
  assert.equal(day[1].actions[0].status, "done");
  assert.match(day[1].toolResults.t1, /confirmé/);
  // Dans l'autre sens aussi : une décision de l'écran n'est pas écrasée par une copie en attente.
  const back = unionDay(confirm([u1, a1], writes), [u1, a1]);
  assert.equal(back[1].actions[0].status, "done");
  // Une entrée inconnue en tête ou au milieu revient à sa place.
  assert.deepEqual(unionDay([u2], [u1, a1, u2]).map((e) => e.id), ["u1", "a1", "u2"]);
});

// --- Écritures depuis la notification, le brief et le pont (pages sans écran) ----------------

test("réponse depuis la notification pendant que l'app écrit : rien n'est effacé", () => {
  const writes = { n: 0 };
  // La page sans écran lit la conversation, puis attend la réponse de Jeffrey…
  putDay([u1, a1]);
  const base = [u1, a1];
  const notif = { id: "n1", role: "user", text: "Oui, merci" };
  // … pendant ce temps l'app confirme la carte et Monsieur écrit un message.
  putDay([...confirm([u1, a1], writes), u2]);
  saveTurn(D, base, [...base, notif, { id: "n1r", role: "assistant", text: "Bien, Monsieur." }]);
  const day = readDay();
  assert.deepEqual(day.map((e) => e.id), ["u1", "a1", "n1", "n1r", "u2"]);
  assert.equal(day[1].actions[0].status, "done");
  assert.equal(confirm(day, writes), null); // « Confirmer » de la notification sur la même carte : rien
  assert.equal(writes.n, 1);
});

test("brief et point du pont : le tour est rangé dans la conversation du moment", () => {
  putDay([u1]);
  const base = [u1];
  const ask = { id: "b1", role: "user", text: "(brief)", hidden: true };
  putDay([u1, u2]);                                        // l'app a écrit entre-temps
  saveTurn(D, base, [...base, ask, { id: "b1r", role: "assistant", text: "Bonjour, Monsieur." }]);
  assert.deepEqual(readDay().map((e) => e.id), ["u1", "b1", "b1r", "u2"]);
  // Le code passe bien par cette écriture (brief.js : brief et réponse ; bridge.js : point, bilan).
  const brief = readFileSync(new URL("../src/lib/brief.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../src/lib/bridge.js", import.meta.url), "utf8");
  assert.equal((brief.match(/saveTurn\(date, entries, h/g) || []).length, 2);
  assert.match(brief, /saveDayMerged\(date, next\)/);
  assert.match(bridge, /saveTurn\(date, entries, h\)/);
  assert.doesNotMatch(brief + bridge, /saveDay\(date, h\)/);
});

test("« Confirmer » depuis la notification : la carte décidée, le message écrit dans l'app gardé", () => {
  const writes = { n: 0 };
  const read = [u1, a1];                 // ce que la notification a lu
  putDay([u1, a1, u2]);                  // l'app a ajouté un message entre-temps
  saveDayMerged(D, confirm(read, writes));
  const day = readDay();
  assert.deepEqual(day.map((e) => e.id), ["u1", "a1", "u2"]);
  assert.equal(day[1].actions[0].status, "done");
});

test("branchement : l'écran ajoute ou modifie ses entrées une à une, jamais le jour entier", () => {
  const chat = readFileSync(new URL("../src/screens/perf/JeffreyChat.jsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(chat, /setDay\(date, \(cur\) => mergeTurn\(cur, history, h\)\)/);
  assert.match(chat, /setDay\(today\(\), \(cur\) => \[\.\.\.\(patch \? cur\.map\(patch\) : cur\), mine\]\)/);
  assert.match(chat, /const fresh = unionDay\(entries, getSync\("jeffreyLog"/);
  assert.match(chat, /if \(busy \|\| !turnFlight\.begin\(\)\) return;/);
  assert.doesNotMatch(chat, /setDay\(today\(\), next\)/);
  assert.match(app, /const base = unionDay\(prev\[date\] \|\| \[\], stored\);/);
});

// --- Point 14 : écran de Corps laissé ouvert la nuit ------------------------------------------

test("changement de jour : l'écran qui montrait aujourd'hui passe au nouveau jour", () => {
  assert.deepEqual(rolloverDecision({ anchor: "2026-11-10", date: "2026-11-10", now: "2026-11-11" }), { anchor: "2026-11-11", pick: "2026-11-11" });
  // Même jour : rien.
  assert.deepEqual(rolloverDecision({ anchor: "2026-11-11", date: "2026-11-11", now: "2026-11-11" }), { anchor: "2026-11-11", pick: null });
  // Monsieur regardait volontairement un autre jour : il y reste, le repère avance.
  assert.deepEqual(rolloverDecision({ anchor: "2026-11-10", date: "2026-11-07", now: "2026-11-11" }), { anchor: "2026-11-11", pick: null });
  // Deux nuits d'affilée : on rattrape d'un coup.
  assert.deepEqual(rolloverDecision({ anchor: "2026-11-09", date: "2026-11-09", now: "2026-11-11" }), { anchor: "2026-11-11", pick: "2026-11-11" });
});

test("branchement : les quatre écrans de Corps passent au jour suivant par leur pickDate", () => {
  for (const f of ["WeightTab", "StepsTab", "SleepTab", "PainTab"]) {
    const src = readFileSync(new URL(`../src/screens/${f}.jsx`, import.meta.url), "utf8");
    assert.match(src, /useDayRollover\(date, pickDate\)/, f);
  }
});
