// Tarifs et compatibilité effort des modèles (claudeApi.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING, SUPPORTS_EFFORT } from "../src/coach/claudeApi.js";

test("Sonnet 5.5 : tarif 2 $/10 $ par MTok, effort supporté (Sonnet 5 et Haiku inchangés)", () => {
  assert.deepEqual(PRICING["claude-sonnet-5-5"], { in: 2, out: 10 });
  assert.ok(SUPPORTS_EFFORT.has("claude-sonnet-5-5") && SUPPORTS_EFFORT.has("claude-opus-5-5"));
  assert.ok(!SUPPORTS_EFFORT.has("claude-haiku-4-5"), "Haiku rejette output_config (400)");
  assert.equal(PRICING["claude-sonnet-5"].in, 3);
});
