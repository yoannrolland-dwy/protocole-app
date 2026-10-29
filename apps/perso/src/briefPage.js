// Brief du matin, côté page sans écran (chantier J, J4.1, 29/10/2026). Android réveille l'app
// (BriefAlarmReceiver) ; BriefRunner.kt lit Health Connect (nuit, pesée, FC repos), charge cette
// page dans une WebView jamais affichée et lui passe ces lectures par `window.BriefBridge`. La page
// décide (core/coach/brief.js), écrit le brief si c'est le moment, puis rend la main à Kotlin avec
// la notification à afficher et l'heure du prochain réveil. Aucun plugin Capacitor ici : pas de
// pont dans cette WebView. Les appels à l'IA passent par le relais HTTP natif du pont.
import { createSSEParser } from "@rawcare/core/coach/stream";
import { briefMissing, briefDecision, nextBriefAlarm, briefRetry } from "@rawcare/core/coach/brief";
import { mergeSleep, mergeWeight, mergeRhr, mergeNaps } from "@rawcare/core/healthMerge";
import { today } from "@rawcare/core/dateUtils";
import { aiMissing } from "./lib/ai.js";
import { say } from "./lib/jeffrey.js";
import { makeCoach } from "./lib/coachInputs.js";
import { loadData, aiFromSettings, readBriefState, writeBriefState, missingText, runBrief, saveFallback } from "./lib/brief.js";

const bridge = window.BriefBridge;
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
  const fallback = () => finish({ notify: { kind: "brief", text: saveFallback(makeCoach(data).nextSession(), missing), alert: true }, nextAt: tomorrow });
  if (aiMissing(ai)) return fallback();
  const tries = (state.tries?.date === date ? state.tries.n : 0) + 1;
  writeBriefState({ tries: { date, n: tries } });
  bridge?.preparing(say("briefPreparing"));
  try {
    const text = await runBrief({ data, ai, transport: bridgeTransport, missing });
    return finish({ notify: { kind: "brief", text, alert: true }, nextAt: tomorrow });
  } catch (e) {
    console.error("brief", e);
    const r = briefRetry(now, tries);
    if (r.fallback) return fallback();
    return finish({ notify: { kind: "missing", text: say("briefRetry"), alert: false }, nextAt: r.at.getTime() });
  }
}

main().catch((e) => finish({ error: String(e?.message || e), nextAt: Date.now() + 20 * 60000 }));
