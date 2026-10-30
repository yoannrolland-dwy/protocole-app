// Tour de Jeffrey (lib/jeffreyTurn.js) : le brief s'écrit en un seul appel, avec le seul outil
// proposer_reponses (J4.3, 30/10/2026 ; avant : outils interdits — essai réel du 29/10, réponse
// faite d'outils seuls puis relancée, 10,5 ¢ au lieu de ~5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { jeffreyTurn } from "../src/lib/jeffreyTurn.js";

const sse = (blocks) => blocks.flatMap((b, i) => [
  ["content_block_start", { type: "content_block_start", index: i, content_block: b.type === "text" ? { type: "text", text: "" } : { type: "tool_use", id: b.id, name: b.name, input: {} } }],
  ["content_block_delta", { type: "content_block_delta", index: i, delta: b.type === "text" ? { type: "text_delta", text: b.text } : { type: "input_json_delta", partial_json: JSON.stringify(b.input) } }],
  ["content_block_stop", { type: "content_block_stop", index: i }],
]);
const transport = (replies) => {
  const calls = [];
  const fn = async ({ body, onEvent }) => {
    calls.push(body);
    onEvent("message_start", { type: "message_start", message: { id: "m", role: "assistant", content: [], usage: { input_tokens: 10, output_tokens: 1 } } });
    for (const [n, d] of sse(replies.shift() || [{ type: "text", text: "…" }])) onEvent(n, d);
    onEvent("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } });
    onEvent("message_stop", { type: "message_stop" });
    return { ok: true, status: 200, header: () => null };
  };
  fn.calls = calls;
  return fn;
};
const coach = { jeffreyRequest: () => ({ system: [], messages: [{ role: "user", content: "x" }], tools: [{ name: "proposer_reponses", input_schema: { type: "object" } }, { name: "ajouter_eau", input_schema: { type: "object" } }], allowed: [] }) };
const ai = { provider: "anthropic", apiKey: "k", model: "claude-opus-5-5" };
const history = [{ id: "u", role: "user", text: "x" }];

test("brief : un seul appel, seul outil proposer_reponses, la réponse rapide est gardée", async () => {
  const tr = transport([[{ type: "text", text: "Bonjour Monsieur." }, { type: "tool_use", id: "q1", name: "proposer_reponses", input: { options: ["Démarrer Upper A", "Genou 2/10"] } }]]);
  const r = await jeffreyTurn({ history, mode: "brief", coach, ai, transport: tr });
  assert.equal(tr.calls.length, 1);
  assert.deepEqual(tr.calls[0].tool_choice, { type: "auto" });
  assert.deepEqual(tr.calls[0].tools.map((t) => t.name), ["proposer_reponses"]);
  assert.equal(r.history.at(-1).text, "Bonjour Monsieur.");
  assert.deepEqual(r.history.at(-1).quick.options, ["Démarrer Upper A", "Genou 2/10"]);
});

test("conversation : outils permis au premier passage, interdits seulement à la relance d'une réponse muette", async () => {
  const tr = transport([[{ type: "tool_use", id: "t1", name: "proposer_reponses", input: { options: ["Oui"] } }], [{ type: "text", text: "Voilà, Monsieur." }]]);
  const r = await jeffreyTurn({ history, mode: "chat", coach, ai, transport: tr });
  assert.equal(tr.calls.length, 2);
  assert.equal("tool_choice" in tr.calls[0], false);
  assert.deepEqual(tr.calls[1].tool_choice, { type: "none" });
  assert.equal(r.history.at(-1).text, "Voilà, Monsieur.");
});
