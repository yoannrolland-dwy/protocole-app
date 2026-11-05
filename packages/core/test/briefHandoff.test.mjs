// Étape G2 du pont JEFFREY (05/11/2026) : le brief passe d'abord par JEFFREY, PROTOCOLE ne le fait
// qu'en secours. Jamais deux briefs, jamais de matin sans brief.
import { test } from "node:test";
import assert from "node:assert/strict";
import { briefHandoff, claimPatch, briefDoneByJeffrey, jeffreyBackupDue, SIGNAL_WAIT_MS, CLAIM_HOLD_MS } from "../src/coach/brief.js";

const T = "2026-11-06";
const NOW = 1_000_000_000;

test("premier passage : prévenir JEFFREY ; un signal d'hier ne compte pas", () => {
  assert.deepEqual(briefHandoff({ nowMs: NOW, today: T, state: {} }), { step: "signal" });
  assert.deepEqual(briefHandoff({ nowMs: NOW, today: T, state: { signal: { date: "2026-11-05", at: NOW, sent: true } } }), { step: "signal" });
});

test("JEFFREY prévenu : attente d'une minute, puis secours", () => {
  const state = { signal: { date: T, at: NOW, sent: true } };
  assert.deepEqual(briefHandoff({ nowMs: NOW + 10_000, today: T, state }), { step: "wait", leftMs: SIGNAL_WAIT_MS - 10_000 });
  assert.deepEqual(briefHandoff({ nowMs: NOW + SIGNAL_WAIT_MS, today: T, state }), { step: "fallback" });
});

test("JEFFREY injoignable (absent, permission refusée) : secours tout de suite", () => {
  assert.deepEqual(briefHandoff({ nowMs: NOW, today: T, state: { signal: { date: T, at: NOW, sent: false } } }), { step: "fallback" });
});

test("bouton « Le brief tout de suite » ou réservation de PROTOCOLE : secours ; brief fait : rien", () => {
  const waiting = { signal: { date: T, at: NOW, sent: true } };
  assert.deepEqual(briefHandoff({ nowMs: NOW + 1, today: T, state: waiting, force: true }), { step: "fallback" });
  assert.deepEqual(briefHandoff({ nowMs: NOW, today: T, state: { claimDate: T } }), { step: "fallback" });
  assert.deepEqual(briefHandoff({ nowMs: NOW, today: T, state: { ...waiting, doneDate: T, by: "jeffrey" }, force: true }), { step: "done" });
});

test("réservation : refusée si fait ou tentative en cours, permise après échec ou délai", () => {
  assert.deepEqual(claimPatch({ nowMs: NOW, today: T, state: {} }), { claimDate: T, claimAt: NOW });
  assert.equal(claimPatch({ nowMs: NOW, today: T, state: { doneDate: T } }), null);
  assert.equal(claimPatch({ nowMs: NOW + 1000, today: T, state: { claimDate: T, claimAt: NOW } }), null);
  assert.deepEqual(claimPatch({ nowMs: NOW + CLAIM_HOLD_MS, today: T, state: { claimDate: T, claimAt: NOW } }), { claimDate: T, claimAt: NOW + CLAIM_HOLD_MS });
  assert.deepEqual(claimPatch({ nowMs: NOW + 1000, today: T, state: { claimDate: T, claimAt: 0 } }), { claimDate: T, claimAt: NOW + 1000 });
});

test("brief_fait : marque le jour une seule fois, jamais après une réservation de PROTOCOLE", () => {
  const ok = briefDoneByJeffrey({ date: T }, { today: T, state: { signal: { date: T, at: NOW, sent: true } } });
  assert.deepEqual(ok, { result: { fait: true }, patch: { doneDate: T, by: "jeffrey" } });
  assert.deepEqual(briefDoneByJeffrey({ date: T }, { today: T, state: { doneDate: T, by: "jeffrey" } }).result, { fait: false, deja: true });
  assert.deepEqual(briefDoneByJeffrey({ date: T }, { today: T, state: { doneDate: T } }).result, { fait: false, deja: true });
  assert.deepEqual(briefDoneByJeffrey({ date: T }, { today: T, state: { claimDate: T, claimAt: NOW } }).result, { fait: false, deja: true });
  assert.deepEqual(briefDoneByJeffrey({ date: "2026-11-05" }, { today: T, state: {} }), { result: { fait: false }, patch: null });
});

test("brief_fait d'essai : accepté pour le jour, rien de marqué, même brief déjà fait", () => {
  assert.deepEqual(briefDoneByJeffrey({ date: T, essai: true }, { today: T, state: { doneDate: T } }), { result: { fait: true, essai: true }, patch: null });
  assert.deepEqual(briefDoneByJeffrey({ date: "2026-11-05", essai: true }, { today: T, state: {} }).result, { fait: false });
});

test("après un brief de JEFFREY : la copie du matin part une seule fois", () => {
  assert.equal(jeffreyBackupDue({ today: T, state: { doneDate: T, by: "jeffrey" } }), true);
  assert.equal(jeffreyBackupDue({ today: T, state: { doneDate: T, by: "jeffrey", backupDate: T } }), false);
  assert.equal(jeffreyBackupDue({ today: T, state: { doneDate: T } }), false);
});
