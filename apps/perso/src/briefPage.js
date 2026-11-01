// Page sans écran de Jeffrey (chantier J). BriefRunner.kt la charge dans une WebView jamais
// affichée quand Monsieur répond depuis la notification (J4.3, `?mode=reply`) ; elle rend la main à
// Kotlin avec la notification à afficher. Aucun plugin Capacitor ici : pas de pont dans cette
// WebView. Les appels à l'IA passent par le relais HTTP natif du pont (`window.BriefBridge`).
// Le brief du matin, lui, ne passe plus par ici depuis le 01/11/2026 : il part dans l'app quand
// Monsieur note son genou (App.jsx).
import { createSSEParser } from "@rawcare/core/coach/stream";
import { today } from "@rawcare/core/dateUtils";
import { aiMissing } from "./lib/ai.js";
import { sayError } from "./lib/jeffrey.js";
import { getSync } from "./store.js";
import { voiceServer, speechPlan } from "./lib/voiceConfig.js";
import { loadData, aiFromSettings, runReply } from "./lib/brief.js";
import { notificationSpec } from "./lib/jeffreyNotify.js";

const bridge = window.BriefBridge;

// Voix (29/10/2026) : Kotlin prépare l'audio de la réponse (serveur Oracle) juste après la
// notification et le garde sur le téléphone. Lu tout de suite dès qu'un casque est branché
// (31/10/2026, choix de Yoann) — Kotlin vérifie le casque. Réglages lus sans plugin.
const voiceFor = (text) => {
  const server = voiceServer();
  const plan = speechPlan(text);
  return server && plan ? { ...server, ...plan, play: true } : undefined;
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
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec(), voice } });
  } catch (e) {
    console.error("réponse", e);
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: sayError(e) }) } });
  }
}

reply().catch((e) => finish({ error: String(e?.message || e) }));
