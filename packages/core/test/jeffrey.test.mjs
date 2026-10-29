// Jeffrey, J1.1 : lecture du flux (stream.js), reprise de streamClaude, contrat de la
// conversation (jeffrey.js). Horloge figée au dimanche 04/10/2026 10:00 (_helpers).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createSSEParser, createMessageAccumulator } from "../src/coach/stream.js";
import { streamClaude } from "../src/coach/claudeApi.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";
import { nextSessions } from "../src/nextSession.js";
import { DEFAULT_TARGETS } from "../src/targets.js";
import {
  allowedSessions, validateSessionChoice, toApiMessages, buildJeffreyRequest, JEFFREY_TOOLS,
  continuationIfSilent, replyText, readReply, effortFor, jeffreyAsk,
  pendingMemoryDate, memoryTranscript, withMemory,
  validateAction, applyWater, applyKnee, appendNote, isActionTool,
  confirmedResult, CANCELLED_RESULT, jeffreyDataBlock,
} from "../src/coach/jeffrey.js";
import { upsert } from "../src/dateUtils.js";

test("actions J2 : validation, et même écriture que l'écran correspondant", () => {
  // Eau : bornes, arrondi, libellé.
  assert.deepEqual(validateAction("ajouter_eau", { ml: 500 }), { ok: true, action: { kind: "eau", ml: 500, label: "Ajouter 500 ml d'eau" } });
  assert.equal(validateAction("ajouter_eau", { ml: 5000 }).ok, false);
  assert.equal(validateAction("ajouter_eau", { ml: "x" }).ok, false);
  // Genou : 0 = à la base d'office ; sans retour_base, l'app demandera (null) ; hors bornes refusé.
  assert.equal(validateAction("noter_genou", { douleur: 0 }).action.baseline, true);
  assert.equal(validateAction("noter_genou", { douleur: 3 }).action.baseline, null);
  assert.equal(validateAction("noter_genou", { douleur: 3, retour_base: false }).action.label, "Genou 3/10, pas revenu à la base");
  assert.equal(validateAction("noter_genou", { douleur: 11 }).ok, false);
  assert.equal(validateAction("noter_genou", { douleur: 2.5 }).ok, false);
  // Note : vide refusée, tronquée à 300.
  assert.equal(validateAction("ecrire_note", { texte: "  " }).ok, false);
  assert.equal(validateAction("ecrire_note", { texte: "x".repeat(400) }).action.text.length, 300);
  assert.equal(validateAction("supprimer_tout", {}).ok, false);
  assert.ok(isActionTool("noter_genou") && !isActionTool("choisir_seance"));
  // Écritures : identiques à celles des écrans (Nutrition : upsert de l'eau cumulée en "manual" ;
  // Genou : upsert { date, pain, baseline }).
  const macros = [{ date: "2026-10-04", protein: 100, water: 750, source: "foodlog" }];
  assert.deepEqual(applyWater(macros, "2026-10-04", 500), upsert(macros, { date: "2026-10-04", water: 1250, source: "manual" }));
  assert.deepEqual(applyWater([], "2026-10-04", 250), [{ date: "2026-10-04", water: 250, source: "manual" }]);
  const knee = [{ date: "2026-10-03", pain: 2, baseline: true }];
  assert.deepEqual(applyKnee(knee, "2026-10-04", 3, false), upsert(knee, { date: "2026-10-04", pain: 3, baseline: false }));
  assert.equal(appendNote("", "Deux bières hier"), "Deux bières hier");
  assert.equal(appendNote("Insomnie", "Deux bières hier"), "Insomnie ; Deux bières hier");
});

test("mémoire : le dernier jour passé non versé au carnet, transcription sans les messages cachés", () => {
  const log = {
    "2026-10-01": [{ role: "user", text: "Vieux" }],
    "2026-10-02": [{ role: "user", text: "Bonjour", at: "08:00" }, { role: "user", text: "(relance)", hidden: true }, { role: "assistant", text: "Bonjour Monsieur.", at: "08:01" }],
    "2026-10-03": [{ role: "user", hidden: true, text: "x" }],
    "2026-10-04": [{ role: "user", text: "Aujourd'hui" }],
  };
  assert.equal(pendingMemoryDate(log, "2026-10-04", null), "2026-10-02"); // le 03 n'a rien de visible
  assert.equal(pendingMemoryDate(log, "2026-10-04", "2026-10-02"), null);  // déjà versé
  assert.equal(pendingMemoryDate({}, "2026-10-04", null), null);
  assert.equal(memoryTranscript(log["2026-10-02"]), "08:00 Monsieur : Bonjour\n08:01 Jeffrey : Bonjour Monsieur.");
  // Message ordinaire : réponse normale puis carnet ; le texte affiché ne change pas.
  const e = withMemory(jeffreyAsk("chat", { text: "Salut" }), "2026-10-02", log["2026-10-02"]);
  assert.equal(e.text, "Salut");
  assert.equal(e.memoryFor, "2026-10-02");
  assert.match(e.apiText, /^Salut\n\n\(Demande de l'application : voici votre conversation du 2026-10-02[\s\S]*---CARNET---[\s\S]*Jeffrey : Bonjour Monsieur\./);
  // Point complet : sa consigne de carnet suffit, la mémoire s'y ajoute sans la doubler.
  const p = withMemory(jeffreyAsk("point"), "2026-10-02", log["2026-10-02"]);
  assert.equal((p.apiText.match(/---CARNET---/g) || []).length, 1);
  // Rien de visible : message inchangé.
  const same = jeffreyAsk("chat", { text: "x" });
  assert.equal(withMemory(same, "2026-10-03", log["2026-10-03"]), same);
});

test("point complet et bilan : texte affiché court, consignes envoyées au modèle, carnet séparé", () => {
  const p = jeffreyAsk("point");
  assert.equal(p.text, "Faites-moi le point, Jeffrey.");
  assert.match(p.apiText, /POINT COMPLET/);
  assert.match(p.apiText, /---CARNET---/);
  const b = jeffreyAsk("bilan", { bilanUser: "BILAN LONG TERME — 90 derniers jours" });
  assert.match(b.apiText, /BILAN 3 MOIS[\s\S]*BILAN LONG TERME/);
  assert.equal(jeffreyAsk("chat", { text: "Bonjour" }).apiText, undefined);
  // Le modèle reçoit apiText, la conversation garde text.
  const m = toApiMessages([p]);
  assert.match(m[0].content[0].text, /POINT COMPLET/);
  // Carnet retiré du texte affiché, gardé à part.
  const r = readReply([{ type: "text", text: "Voici le point, Monsieur.\n---CARNET---\nÉtat : genou 2/10." }]);
  assert.equal(r.text, "Voici le point, Monsieur.");
  assert.equal(r.journal, "État : genou 2/10.");
  assert.deepEqual(readReply([{ type: "text", text: "Bonjour Monsieur." }]), { text: "Bonjour Monsieur.", journal: null });
  assert.equal(effortFor("chat"), "low");
  assert.equal(effortFor("point"), "medium");
  assert.equal(effortFor("bilan"), "medium");
});

test("réponse sans texte (seulement des boutons) : relance écrite ; avec texte : rien", () => {
  const tool = { type: "tool_use", id: "t", name: "proposer_reponses", input: { options: ["A", "B"] } };
  const silent = { content: [{ type: "thinking", thinking: "…", signature: "s" }, tool], stop_reason: "tool_use" };
  const c = continuationIfSilent(silent);
  assert.equal(c.role, "user");
  assert.match(c.text, /Répondez maintenant à Monsieur par écrit/);
  assert.equal(continuationIfSilent({ content: [{ type: "text", text: "Bonjour Monsieur." }, tool] }), null);
  assert.equal(continuationIfSilent({ content: [] }), null);
  assert.equal(replyText([{ type: "text", text: " A " }, { type: "text", text: "B" }]), "A B");
});
import { fixClock, BS, planFor, at, kneeOk } from "./_helpers.mjs";

before(() => fixClock());

// Réponse en flux réaliste : réflexion signée, texte en deux morceaux, un appel d'outil.
const EVENTS = [
  ["message_start", { type: "message_start", message: { id: "msg_1", model: "claude-opus-5-5", usage: { input_tokens: 1200, cache_read_input_tokens: 3000, output_tokens: 1 } } }],
  ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } }],
  ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Monsieur a bien dormi." } }],
  ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-abc" } }],
  ["content_block_stop", { type: "content_block_stop", index: 0 }],
  ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }],
  ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Bonjour " } }],
  ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Monsieur." } }],
  ["content_block_stop", { type: "content_block_stop", index: 1 }],
  ["content_block_start", { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "tu_1", name: "choisir_seance", input: {} } }],
  ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"jour":"aujour' } }],
  ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: 'dhui","type":"Basket","raison":"match"}' } }],
  ["content_block_stop", { type: "content_block_stop", index: 2 }],
  ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 240 } }],
  ["message_stop", { type: "message_stop" }],
];
const SSE = EVENTS.map(([n, d]) => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`).join("");

test("flux SSE coupé n'importe où : même message que d'un bloc", () => {
  const run = (chunkSize) => {
    const texts = [];
    const acc = createMessageAccumulator({ onText: (_, all) => texts.push(all) });
    const p = createSSEParser((n, d) => acc.push(n, d));
    for (let i = 0; i < SSE.length; i += chunkSize) p.push(SSE.slice(i, i + chunkSize));
    p.end();
    return { msg: acc.message(), texts };
  };
  const whole = run(SSE.length);
  for (const size of [1, 7, 33]) assert.deepEqual(run(size).msg, whole.msg);
  const m = whole.msg;
  assert.equal(m.stop_reason, "tool_use");
  assert.deepEqual(m.usage, { input_tokens: 1200, cache_read_input_tokens: 3000, output_tokens: 240 });
  assert.deepEqual(m.content[0], { type: "thinking", thinking: "Monsieur a bien dormi.", signature: "sig-abc" });
  assert.equal(m.content[1].text, "Bonjour Monsieur.");
  assert.deepEqual(m.content[2].input, { jour: "aujourdhui", type: "Basket", raison: "match" });
  assert.deepEqual(whole.texts, ["Bonjour ", "Bonjour Monsieur."]);
});

test("un événement error dans le flux lève une erreur", () => {
  const acc = createMessageAccumulator();
  assert.throws(() => acc.push("error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }), /Overloaded/);
});

// Transport factice : rejoue des événements, ou répond une erreur HTTP.
const fakeTransport = (script) => {
  let n = 0;
  const calls = [];
  const fn = async ({ body, onEvent }) => {
    calls.push(body);
    const step = script[Math.min(n++, script.length - 1)];
    if (step.status) return { ok: false, status: step.status, data: { error: { message: `HTTP ${step.status}` } }, header: () => null };
    for (const [name, d] of step.events) onEvent(name, d);
    if (step.throwAfter) throw new Error("connexion coupée");
    return { ok: true, status: 200, header: () => null };
  };
  fn.calls = calls;
  return fn;
};

test("streamClaude : reprise sur 429 avant le flux, coût calculé, corps en flux", async () => {
  const tr = fakeTransport([{ status: 429 }, { events: EVENTS }]);
  const r = await streamClaude({ provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "anthropic/claude-opus-5-5", system: [], messages: [], maxTokens: 100, effort: "medium", streamTransport: tr, retryDelays: [0] });
  assert.equal(tr.calls.length, 2);
  assert.equal(tr.calls[0].stream, true);
  assert.deepEqual(tr.calls[0].output_config, { effort: "medium" });
  assert.equal(r.usedModel, "anthropic/claude-opus-5-5");
  assert.equal(r.message.content[1].text, "Bonjour Monsieur.");
  // Opus 5.5 : 4 $ / 20 $ par MTok, lecture du cache à 10 % → (1200×4 + 3000×0,4 + 240×20) / 1e6 × 100
  assert.ok(Math.abs(r.cents - (1200 * 4 + 3000 * 0.4 + 240 * 20) / 1e4) < 1e-9, String(r.cents));
});

test("coût : une écriture dans le cache coûte 125 % du tarif d'entrée (mesures réelles du 29/10)", async () => {
  const { costCents } = await import("../src/coach/claudeApi.js");
  // 1er tour réel : 4 tokens frais, 9 576 écrits dans le cache, 1 248 en sortie (Opus 5.5).
  const c = costCents("claude-opus-5-5", { input_tokens: 4, cache_creation_input_tokens: 9576, output_tokens: 1248 });
  assert.ok(Math.abs(c - (4 * 4 + 9576 * 5 + 1248 * 20) / 1e4) < 1e-9, String(c));
});

test("streamClaude : une coupure en plein flux n'est jamais rejouée (texte déjà affiché)", async () => {
  const tr = fakeTransport([{ events: EVENTS.slice(0, 8), throwAfter: true }, { events: EVENTS }]);
  await assert.rejects(streamClaude({ provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "anthropic/claude-opus-5-5", system: [], messages: [], maxTokens: 100, streamTransport: tr, retryDelays: [0] }), /connexion coupée/);
  assert.equal(tr.calls.length, 1);
});

// --- Contrat de la conversation ------------------------------------------------------------
const base = (o = {}) => ({ training: [], knee: kneeOk(), sleep: [], targets: { cut: { enabled: false } }, basketSchedule: BS, ...o });

test("séances autorisées : affichées + moins prioritaires, jamais les écartées", () => {
  // Dimanche 9 h, jour de match : Basket proposé ; journée ouverte.
  const ns = nextSessions({ now: at("2026-10-04", 9), base: base(), planFor });
  const allowed = allowedSessions(ns);
  assert.ok(allowed.aujourdhui.includes("Basket"));
  for (const a of ns.today.avoid) assert.ok(!allowed.aujourdhui.includes(a.type), a.type);
  for (const n of ns.today.notProposed.filter((x) => x.kind !== "priority")) assert.ok(!allowed.aujourdhui.includes(n.type), n.type);
  assert.ok(allowed.demain.length > 0);
  // Journée fermée : rien d'autorisé aujourd'hui.
  assert.deepEqual(allowedSessions({ today: { status: "closed", suggestions: [{ type: "Upper A" }] }, tomorrow: null }).aujourdhui, []);
});

test("choisir_seance hors de la liste : refusé (le recommandeur garde la main)", () => {
  const allowed = { aujourdhui: ["Basket", "Mobilité"], demain: ["Full Body"] };
  assert.deepEqual(validateSessionChoice({ jour: "aujourdhui", type: "Basket", raison: "match" }, allowed), { ok: true, jour: "aujourdhui", type: "Basket", raison: "match" });
  assert.equal(validateSessionChoice({ jour: "aujourdhui", type: "Lower C", raison: "x" }, allowed).ok, false);
  assert.equal(validateSessionChoice({ jour: "demain", type: "Basket", raison: "x" }, allowed).ok, false);
  assert.equal(validateSessionChoice({ jour: "hier", type: "Basket" }, allowed).ok, false);
});

test("historique : tool_result obligatoire après un outil, réflexion gardée seulement au dernier tour", () => {
  const think = { type: "thinking", thinking: "…", signature: "s" };
  const h = [
    { role: "user", text: "Bonjour Jeffrey" },
    { role: "assistant", content: [think, { type: "text", text: "Bonjour Monsieur." }, { type: "tool_use", id: "t1", name: "proposer_reponses", input: { options: ["Oui", "Non"] } }], toolResults: { t1: "Monsieur a touché « Oui »." } },
    { role: "user", text: "Oui" },
    { role: "assistant", content: [think, { type: "text", text: "Parfait." }] },
    { role: "user", text: "Et demain ?" },
  ];
  const m = toApiMessages(h);
  assert.deepEqual(m.map((x) => x.role), ["user", "assistant", "user", "assistant", "user"]);
  assert.ok(!m[1].content.some((b) => b.type === "thinking"), "ancienne réflexion retirée");
  assert.ok(m[3].content.some((b) => b.type === "thinking" && b.signature === "s"), "dernière réflexion gardée, signée");
  assert.deepEqual(m[2].content[0], { type: "tool_result", tool_use_id: "t1", content: "Monsieur a touché « Oui »." });
  assert.equal(m[2].content[1].text, "Oui");
});

test("requête de Jeffrey : règles avant la personnalité, cache sur 3 points, outils déclarés", () => {
  const data = { weight: [], sleep: [], training: [], knee: kneeOk(), macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, phase: "recomposition", foodLog: [], foodOverrides: {}, profile: "profil test", journal: "carnet test", basketSchedule: BS };
  const coach = buildCoachPrompt(data, "");
  const ns = nextSessions({ now: at("2026-10-04", 9), base: base(), planFor });
  const r = buildJeffreyRequest({ coach, persona: "", nextSession: ns, history: [{ role: "user", text: "Que me conseillez-vous ?" }], heure: "09:00" });
  const [rules, persona, dataBlock] = r.system;
  assert.match(rules.text, /Le ton ne change jamais les faits/);
  assert.match(rules.text, /Une alerte est toujours dite clairement/);
  assert.match(rules.text, /petit dormeur/);
  assert.match(rules.text, /profil test/); // contexte permanent du coach repris tel quel
  assert.match(persona.text, /Jeffrey/);   // personnalité d'amorçage quand rien n'est écrit
  assert.match(dataBlock.text, /SEANCES_AUTORISEES/);
  assert.match(dataBlock.text, /carnet test/);
  // L'heure est dans le message (pas dans les données, qui restent en cache toute la conversation).
  assert.doesNotMatch(dataBlock.text, /heure_analyse|09:00/);
  const lastUser = r.messages[r.messages.length - 1].content;
  assert.deepEqual(lastUser.map((b) => b.text), ["heure : 09:00", "Que me conseillez-vous ?"]);
  const cached = [...r.system, ...r.messages.flatMap((m) => m.content)].filter((b) => b.cache_control);
  assert.equal(cached.length, 3);
  assert.deepEqual(r.tools.map((t) => t.name), [...JEFFREY_TOOLS.map((t) => t.name), "ajouter_eau", "noter_genou", "ecrire_note"]);
  assert.ok(r.allowed.aujourdhui.includes("Basket"));
});

test("buildCoachPrompt : facts ajouté, system/user inchangés (la capture datée les vérifie)", () => {
  const coach = buildCoachPrompt({ weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, phase: "seche", foodLog: [], foodOverrides: {}, profile: "", journal: "" }, "");
  assert.equal(coach.facts.system, coach.system);
  assert.ok(coach.facts.realtime && coach.facts.summary);
});

test("régression 29/10 : après le tap, Jeffrey reçoit le nouveau total et sait que ses données le comptent déjà", () => {
  const eau = validateAction("ajouter_eau", { ml: 500 }).action;
  const r = confirmedResult(eau, { before: 1250, after: 1750 });
  assert.match(r, /passée de 1250 à 1750 ml/);
  assert.match(r, /comptent déjà ce changement/);
  const genou = { ...validateAction("noter_genou", { douleur: 2 }).action, label: "Genou 2/10, revenu à la base" };
  assert.match(confirmedResult(genou, null), /c'est fait \(Genou 2\/10, revenu à la base\)/);
  assert.equal(CANCELLED_RESULT, "Monsieur a annulé : rien n'a été fait.");
  const block = jeffreyDataBlock({ facts: { realtime: {}, summary: {}, exoProgress: {} }, allowed: [] });
  assert.match(block, /comptent déjà les actions qu'il a confirmées/);
  const req = buildJeffreyRequest({
    coach: buildCoachPrompt({ weight: [], sleep: [], training: [], knee: [], macros: [], notes: [], steps: [], targets: DEFAULT_TARGETS, phase: "seche", foodLog: [], foodOverrides: {}, profile: "", journal: "" }, ""),
    persona: "", nextSession: null, history: [{ role: "user", text: "bonjour" }], heure: "13:45",
  });
  assert.match(req.system[0].text, /Ne rajoutez jamais une action confirmée/);
});

test("régression 29/10 : la relance d'une réponse muette interdit les outils ; sans toolChoice, requête inchangée", async () => {
  const tools = [{ name: "x", input_schema: { type: "object" } }];
  const tr = fakeTransport([{ events: EVENTS }, { events: EVENTS }, { events: EVENTS }]);
  const base = { provider: "litellm", baseUrl: "https://srv", apiKey: "k", model: "anthropic/claude-opus-5-5", system: [], messages: [], maxTokens: 100, streamTransport: tr, retryDelays: [0] };
  await streamClaude({ ...base, tools, toolChoice: { type: "none" } });
  await streamClaude({ ...base, tools });
  await streamClaude({ ...base, toolChoice: { type: "none" } });
  assert.deepEqual(tr.calls[0].tool_choice, { type: "none" });
  assert.deepEqual(tr.calls[0].tools, tools);
  assert.equal("tool_choice" in tr.calls[1], false);
  assert.equal("tool_choice" in tr.calls[2], false); // jamais sans outils déclarés
});
