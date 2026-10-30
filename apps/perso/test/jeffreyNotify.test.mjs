// Notification de conversation de Jeffrey (J4.3, 30/10/2026) : ce qu'elle affiche, et la
// confirmation d'une action partagée par la conversation et la notification (decideAction).
import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationSpec } from "../src/lib/jeffreyNotify.js";
import { decideAction, CANCELLED_RESULT } from "@rawcare/core/coach/jeffrey";

const brief = [
  { id: "u0", role: "user", text: "Bonjour", mode: "chat" },
  { id: "a0", role: "assistant", text: "Bonjour Monsieur." },
  { id: "u1", role: "user", text: "Le brief du matin, Jeffrey.", mode: "brief" },
  { id: "a1", role: "assistant", text: "Bonjour Monsieur. Upper A aujourd'hui.", quick: { id: "q1", options: ["Démarrer Upper A", "Genou 2/10"] } },
];

test("le fil commence au brief du jour ; la première réponse rapide devient un bouton", () => {
  const s = notificationSpec(brief);
  assert.deepEqual(s.messages, [{ me: false, text: "Bonjour Monsieur. Upper A aujourd'hui." }]);
  assert.deepEqual(s.quick, { label: "Démarrer Upper A", quickFor: "q1" });
  assert.equal(s.confirm, null);
  assert.equal(s.listen, null, "pas de voix sans serveur ni clé");
});

test("une action en attente remplace la réponse rapide ; genou sans base → deux boutons", () => {
  const withEau = [...brief, { id: "u2", role: "user", text: "J'ai bu 500 ml", mode: "chat" },
    { id: "a2", role: "assistant", text: "Je l'ajoute ?", quick: { id: "q2", options: ["Oui"] }, actions: [{ id: "t1", kind: "eau", ml: 500, label: "Ajouter 500 ml d'eau", status: "pending" }] }];
  const s = notificationSpec(withEau);
  assert.deepEqual(s.confirm, { entryId: "a2", actionId: "t1", label: "Ajouter 500 ml d'eau", needsBaseline: false });
  assert.equal(s.quick, null);
  assert.deepEqual(s.messages.map((m) => m.me), [false, true, false]);
  const genou = [...brief, { id: "a3", role: "assistant", text: "Je note ?", actions: [{ id: "t2", kind: "genou", pain: 3, baseline: null, label: "Genou 3/10", status: "pending" }] }];
  assert.equal(notificationSpec(genou).confirm.needsBaseline, true);
});

test("decideAction : confirmer écrit l'action, annuler ne fait rien, une action déjà traitée est ignorée", () => {
  const entries = [{ id: "a", role: "assistant", actions: [{ id: "t", kind: "genou", pain: 3, baseline: null, label: "Genou 3/10", status: "pending" }], toolResults: {} }];
  const applied = [];
  const ok = decideAction(entries, "a", "t", { ok: true, baseline: false, apply: (act) => { applied.push(act); return null; }, doneText: "Fait, Monsieur." });
  assert.equal(applied[0].baseline, false);
  assert.equal(ok[0].actions[0].status, "done");
  assert.equal(ok[0].actions[0].label, "Genou 3/10, pas revenu à la base");
  assert.match(ok[0].toolResults.t, /Monsieur a confirmé/);
  const no = decideAction(entries, "a", "t", { ok: false, apply: () => assert.fail("rien ne doit être écrit"), cancelledText: "Bien." });
  assert.equal(no[0].actions[0].status, "cancelled");
  assert.equal(no[0].toolResults.t, CANCELLED_RESULT);
  assert.equal(decideAction(ok, "a", "t", { ok: true, apply: () => assert.fail("déjà fait") }), null);
});
