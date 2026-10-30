// Brief du matin, côté page sans écran (chantier J, J4.1, 29/10/2026). Android réveille l'app
// (BriefAlarmReceiver) ; BriefRunner.kt lit Health Connect (nuit, pesée, FC repos), charge cette
// page dans une WebView jamais affichée et lui passe ces lectures par `window.BriefBridge`. La page
// décide (core/coach/brief.js), écrit le brief si c'est le moment, puis rend la main à Kotlin avec
// la notification à afficher et l'heure du prochain réveil. Aucun plugin Capacitor ici : pas de
// pont dans cette WebView. Les appels à l'IA passent par le relais HTTP natif du pont.
// J4.3 (30/10/2026) : la même page répond aussi à Monsieur depuis la notification (`?mode=reply`).
import { createSSEParser } from "@rawcare/core/coach/stream";
import { briefMissing, briefDecision, nextBriefAlarm, briefRetry } from "@rawcare/core/coach/brief";
import { mergeSleep, mergeWeight, mergeRhr, mergeNaps } from "@rawcare/core/healthMerge";
import { today } from "@rawcare/core/dateUtils";
import { aiMissing } from "./lib/ai.js";
import { say, sayError } from "./lib/jeffrey.js";
import { makeCoach } from "./lib/coachInputs.js";
import { getSync } from "./store.js";
import { voiceServer, speechPlan } from "./lib/voiceConfig.js";
import { loadData, aiFromSettings, readBriefState, writeBriefState, missingText, runBrief, runReply, saveFallback } from "./lib/brief.js";
import { notificationSpec } from "./lib/jeffreyNotify.js";

const bridge = window.BriefBridge;

// Voix (29/10/2026) : Kotlin prépare l'audio du brief (serveur Oracle) juste après la
// notification et le garde sur le téléphone, pour l'écouter chez soi ou en chemin sans attendre ni
// réseau. Lu tout de suite seulement pendant une séance (carnet ouvert) ET casque branché — Kotlin
// vérifie le casque. Réglages lus sans plugin (pas de pont Capacitor dans cette page).
const voiceFor = (text) => {
  const server = voiceServer();
  const plan = speechPlan(text);
  return server && plan ? { ...server, ...plan, play: !!getSync("trainingDraft", null)?.type } : undefined;
};
const finish = (result) => {
  if (bridge) bridge.finish(JSON.stringify(result));
  else console.log("brief", result);
};

// Relais HTTP natif : même contrat que fetchStreamTransport, mais le corps arrive en entier (SSE
// relu d'un bloc). Le serveur LiteLLM ne répond pas au CORS, et cette WebView n'a pas CapacitorHttp.
let seq = 0;
const pending = new Map();
window.__briefHttpDone = (id, status, text) => { pending.get(id)?.(status, text); pending.delete(id); };
const bridgeTransport = ({ url, headers, body, onEvent }) => new Promise((resolve) => {
  const id = String(++seq);
  pending.set(id, (status, text) => {
    if (status < 200 || status >= 300) {
      let data = null;
      try { data = JSON.parse(text); } catch { /* corps non JSON */ }
      resolve({ ok: false, status, data, header: () => null });
      return;
    }
    const parser = createSSEParser(onEvent);
    parser.push(text);
    parser.end();
    resolve({ ok: true, status, header: () => null });
  });
  bridge.http(id, url, JSON.stringify(headers), JSON.stringify(body));
});

// Notification de conversation (J4.3) : le fil du jour, les boutons Écouter / Répondre / réponse
// rapide ou Confirmer. Kotlin la construit (BriefRunner.postThread).
const todaySpec = (extra) => {
  const spec = notificationSpec(getSync("jeffreyLog", {})[today()] || []);
  return extra ? { ...spec, messages: [...spec.messages, extra] } : spec;
};

// Réponse de Monsieur depuis la notification (J4.3) : `bridge.payload()` dit ce qu'il a fait
// (réponse écrite, réponse rapide, action confirmée). Pas de réveil à reprogrammer ici. La voix de
// la réponse est préparée (jamais jouée d'office : question écrite, réponse écrite).
async function reply() {
  const payload = JSON.parse(bridge?.payload() || "{}");
  const ai = aiFromSettings();
  if (payload.kind !== "confirm" && aiMissing(ai)) {
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: aiMissing(ai) }) } });
  }
  try {
    const r = await runReply({ payload, data: loadData(), ai, transport: bridgeTransport });
    const voice = r.reply ? voiceFor(r.reply) : undefined;
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec(), voice: voice && { ...voice, play: false } } });
  } catch (e) {
    console.error("réponse", e);
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: sayError(e) }) } });
  }
}

async function main() {
  const now = new Date();
  const date = today();
  const health = JSON.parse(bridge?.health() || "{}");
  const data = loadData();
  // Health Connect fusionné EN MÉMOIRE seulement (même règle que la synchro de l'app) : l'app
  // relit et enregistre elle-même ces données à sa prochaine ouverture.
  data.sleep = mergeSleep(data.sleep, health.sleep?.days);
  data.naps = mergeNaps(data.naps, health.sleep?.naps);
  data.weight = mergeWeight(data.weight, health.weight?.days, health.weight?.times);
  data.rhr = mergeRhr(data.rhr, health.rhr?.days);

  const state = readBriefState();
  const missing = briefMissing({ today: date, sleep: data.sleep, weight: data.weight, knee: data.knee });
  const decision = briefDecision({ now, today: date, missing, state });

  if (decision === "skip" || decision === "wait") {
    return finish({ notify: null, nextAt: nextBriefAlarm(now, { doneToday: decision === "skip" }).getTime() });
  }
  if (decision === "update" || decision === "remind") {
    if (decision === "remind") writeBriefState({ remindedDate: date });
    return finish({ notify: { kind: "missing", text: missingText(missing, decision === "remind"), alert: decision === "remind" }, nextAt: nextBriefAlarm(now).getTime() });
  }

  // C'est l'heure du brief.
  const tomorrow = nextBriefAlarm(now, { doneToday: true }).getTime();
  const ai = aiFromSettings();
  const fallback = () => {
    const text = saveFallback(makeCoach(data).nextSession(), missing);
    return finish({ notify: { kind: "brief", text, alert: true, voice: voiceFor(text), spec: todaySpec() }, nextAt: tomorrow });
  };
  if (aiMissing(ai)) return fallback();
  const tries = (state.tries?.date === date ? state.tries.n : 0) + 1;
  writeBriefState({ tries: { date, n: tries } });
  bridge?.preparing(say("briefPreparing"));
  try {
    const text = await runBrief({ data, ai, transport: bridgeTransport, missing });
    return finish({ notify: { kind: "brief", text, alert: true, voice: voiceFor(text), spec: todaySpec() }, nextAt: tomorrow });
  } catch (e) {
    console.error("brief", e);
    const r = briefRetry(now, tries);
    if (r.fallback) return fallback();
    return finish({ notify: { kind: "missing", text: say("briefRetry"), alert: false }, nextAt: r.at.getTime() });
  }
}

if (new URLSearchParams(location.search).get("mode") === "reply") {
  reply().catch((e) => finish({ error: String(e?.message || e) }));
} else {
  main().catch((e) => finish({ error: String(e?.message || e), nextAt: Date.now() + 20 * 60000 }));
}
