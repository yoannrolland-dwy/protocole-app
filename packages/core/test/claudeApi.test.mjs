// Tarifs et compatibilité effort des modèles (claudeApi.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING, SUPPORTS_EFFORT } from "../src/coach/claudeApi.js";

test("Sonnet 5.5 : tarif 2 $/10 $ par MTok, effort supporté (Sonnet 5 et Haiku inchangés)", () => {
  assert.deepEqual(PRICING["claude-sonnet-5-5"], { in: 2, out: 10 });
  assert.ok(SUPPORTS_EFFORT.has("claude-sonnet-5-5") && SUPPORTS_EFFORT.has("claude-opus-5-5"));
  assert.ok(!SUPPORTS_EFFORT.has("claude-haiku-4-5"), "Haiku rejette output_config (400)");
  assert.equal(PRICING["claude-sonnet-5"].in, 3);
  assert.deepEqual(PRICING["claude-opus-5-5"], { in: 4, out: 20 }, "Opus 5.5 : 4 $ / 20 $");
});

// --- LiteLLM (26/10/2026) ---
import { callClaude, baseModel, fallbackFor, isClaudeModel, callCents, costCents } from "../src/coach/claudeApi.js";

const fakeTransport = (replies, seen) => async (req) => {
  seen.push(req);
  const r = replies.shift();
  return { ok: r.status === 200, status: r.status, data: r.data, header: (k) => r.headers?.[k] };
};
const okMsg = { content: [{ type: "text", text: "salut" }], usage: { input_tokens: 1000, output_tokens: 500 } };

test("LiteLLM : nom fournisseur/modèle ramené au nom Anthropic, secours seulement pour Claude", () => {
  assert.equal(baseModel("anthropic/claude-sonnet-5-5"), "claude-sonnet-5-5");
  assert.equal(baseModel("claude-sonnet-5-5"), "claude-sonnet-5-5");
  assert.equal(fallbackFor("anthropic", "claude-sonnet-5-5"), "claude-haiku-4-5");
  assert.equal(fallbackFor("litellm", "anthropic/claude-sonnet-5-5"), "anthropic/claude-haiku-4-5");
  assert.equal(fallbackFor("litellm", "openai/gpt-5"), null);
  assert.ok(isClaudeModel("anthropic", "x") && isClaudeModel("litellm", "anthropic/claude-haiku-4-5"));
  assert.ok(!isClaudeModel("litellm", "gemini/gemini-3-pro"));
});

test("LiteLLM : coût Claude = nos tarifs ; autre modèle = coût du serveur, sinon inconnu (null)", () => {
  const u = { input_tokens: 1000, output_tokens: 500 };
  assert.equal(callCents("anthropic/claude-sonnet-5-5", u, "0.9"), costCents("claude-sonnet-5-5", u));
  assert.equal(callCents("openai/gpt-5", u, "0.0123"), 1.23);
  assert.equal(callCents("openai/gpt-5", u, "0"), 0);
  assert.equal(callCents("openai/gpt-5", u, undefined), null);
  assert.equal(callCents("claude-sonnet-5-5", u, undefined), costCents("claude-sonnet-5-5", u));
});

test("callClaude LiteLLM : effort envoyé aux seuls Claude qui l'acceptent, fournisseur et adresse transmis", async () => {
  const seen = [];
  const r = await callClaude({ provider: "litellm", baseUrl: "https://srv/", apiKey: "k", model: "anthropic/claude-sonnet-5-5", system: "s", user: "u", effort: "medium", maxTokens: 10, transport: fakeTransport([{ status: 200, data: okMsg }], seen) });
  assert.equal(seen[0].provider, "litellm");
  assert.equal(seen[0].baseUrl, "https://srv/");
  assert.deepEqual(seen[0].body.output_config, { effort: "medium" });
  assert.equal(r.usedModel, "anthropic/claude-sonnet-5-5");
  assert.equal(r.cents, costCents("claude-sonnet-5-5", okMsg.usage));
  const seen2 = [];
  await callClaude({ provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "gemini/gemini-3-pro", system: "s", user: "u", effort: "medium", maxTokens: 10, transport: fakeTransport([{ status: 200, data: okMsg }], seen2) });
  assert.equal(seen2[0].body.output_config, undefined);
});

test("callClaude : un modèle non-Claude saturé n'est pas basculé sur Haiku ; un Claude via LiteLLM l'est", async () => {
  const sat = { status: 529, data: { type: "error", error: { message: "overloaded" } } };
  const seen = [];
  await assert.rejects(callClaude({ provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "openai/gpt-5", system: "s", user: "u", maxTokens: 10, retryDelays: [0, 0], transport: fakeTransport([sat, sat, sat], seen) }), /overloaded/);
  assert.equal(seen.length, 3);
  const seen2 = [];
  const r = await callClaude({ provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "anthropic/claude-sonnet-5-5", system: "s", user: "u", maxTokens: 10, retryDelays: [0, 0], transport: fakeTransport([sat, sat, sat, { status: 200, data: okMsg }], seen2) });
  assert.equal(r.usedModel, "anthropic/claude-haiku-4-5");
});

test("callClaude Anthropic direct : comportement inchangé (secours Haiku, coût calculé)", async () => {
  const seen = [];
  const r = await callClaude({ apiKey: "k", model: "claude-sonnet-5-5", system: "s", user: "u", effort: "medium", maxTokens: 10, transport: fakeTransport([{ status: 200, data: okMsg }], seen) });
  assert.equal(seen[0].provider, "anthropic");
  assert.deepEqual(seen[0].body.output_config, { effort: "medium" });
  assert.equal(r.cents, costCents("claude-sonnet-5-5", okMsg.usage));
});
