// Page sans écran de Jeffrey (chantier J). BriefRunner.kt la charge dans une WebView jamais
// affichée quand Monsieur répond depuis la notification (J4.3, `?mode=reply`) ; elle rend la main à
// Kotlin avec la notification à afficher. Aucun plugin Capacitor ici : pas de pont dans cette
// WebView. Les appels à l'IA passent par le relais HTTP natif du pont (`window.BriefBridge`).
// Le brief du matin part dans l'app quand Monsieur note son genou (App.jsx, depuis le 01/11/2026).
// G2 (05/11/2026) : il passe d'abord par l'appli JEFFREY ; si elle ne confirme pas dans la minute
// et que l'app n'est plus à l'écran, c'est cette page qui l'écrit (`?mode=signal`).
// 02/11/2026 : la même page envoie aussi la sauvegarde de 14 h et 23 h (`?mode=backup&slot=…`,
// réveils de Backup.kt), par le pont `request` (client HTTP natif).
import { pageTransport, pageRequest } from "./lib/pageHttp.js";
import { today } from "@rawcare/core/dateUtils";
import { aiMissing } from "./lib/ai.js";
import { sayError, say } from "./lib/jeffrey.js";
import { guardWrite } from "./lib/restoreGuard.js";
import { getSync, storageFrozen } from "./store.js";
import { voiceServer, speechPlan } from "./lib/voiceConfig.js";
import { loadData, aiFromSettings, runReply, runBrief, readBriefState, writeBriefState, claimBrief, releaseClaim } from "./lib/brief.js";
import { briefHandoff, briefMissing, jeffreyBackupDue } from "@rawcare/core/coach/brief";
import { sendBackup } from "./lib/serverBackup.js";
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

// Relais HTTP natif (lib/pageHttp.js, partagé avec la page du pont JEFFREY).
const bridgeTransport = pageTransport(bridge);
const bridgeRequest = pageRequest(bridge);

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
  if (payload.kind !== "confirm" && aiMissing(ai) && !storageFrozen()) {
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: aiMissing(ai) }) } });
  }
  try {
    // Restauration en cours (gel de store.js) : rien n'est fait ni annoncé fait (restoreGuard.js).
    const g = await guardWrite(() => runReply({ payload, data: loadData(), ai, transport: bridgeTransport }));
    if (g.blocked) return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: say("restoring") }) } });
    const r = g.value;
    const voice = r.reply ? voiceFor(r.reply) : undefined;
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec(), voice } });
  } catch (e) {
    console.error("réponse", e);
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: sayError(e) }) } });
  }
}

// Sauvegarde de 14 h ou 23 h : le service au premier plan garde le réseau le temps de l'envoi
// (économie d'énergie) ; rien à afficher ensuite, l'état est dans le marqueur `serverBackup`.
async function backup(slot) {
  if (!bridge) return finish({});
  bridge.preparing("Sauvegarde de vos données, Monsieur.");
  const r = await sendBackup(slot, bridgeRequest);
  return finish(r.ok || r.skipped ? {} : { error: `sauvegarde : ${r.error}` });
}

// Étape G2 (05/11/2026) : contrôle de la minute après le signal envoyé à JEFFREY
// (BriefSignalCheckReceiver, seulement quand l'app n'est pas à l'écran ; à l'écran, c'est l'app qui
// s'en charge). JEFFREY a confirmé → seule la copie du matin part. Sinon → le brief de PROTOCOLE,
// exactement comme celui de l'app (même runBrief, notification sans bruit, voix si casque).
async function signalCheck() {
  // Restauration en cours : aucun brief ni copie, rien d'annoncé ; l'app qui redémarre reprend la main.
  if (storageFrozen()) return finish({});
  const date = today();
  const state = readBriefState();
  const step = briefHandoff({ nowMs: Date.now(), today: date, state }).step;
  if (step === "done") {
    if (!bridge || !jeffreyBackupDue({ today: date, state })) return finish({});
    writeBriefState({ backupDate: date });
    bridge.preparing("Sauvegarde de vos données, Monsieur.");
    await sendBackup("matin", bridgeRequest);
    return finish({});
  }
  // « wait » ne devrait pas arriver (réveil à la minute) ; « signal » : rien n'a été envoyé.
  if (step !== "fallback") return finish({});
  const ai = aiFromSettings();
  if (aiMissing(ai) || !claimBrief(date)) return finish({});
  bridge?.preparing("Je prépare votre brief, Monsieur.");
  const data = loadData();
  try {
    const missing = briefMissing({ today: date, sleep: data.sleep, weight: data.weight, knee: data.knee });
    const g = await guardWrite(() => runBrief({ data, ai, transport: bridgeTransport, missing }));
    if (g.blocked) return finish({}); // gel apparu pendant le brief : rien n'est sûr, rien d'annoncé
    const text = g.value;
    if (!text) return finish({});
    await sendBackup("matin", bridgeRequest);
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec(), voice: voiceFor(text) } });
  } catch (e) {
    console.error("brief de secours", e);
    releaseClaim();
    return finish({ notify: { kind: "thread", alert: false, spec: todaySpec({ me: false, text: sayError(e) }) } });
  }
}

const params = new URLSearchParams(location.search);
if (params.get("mode") === "signal") signalCheck().catch((e) => finish({ error: String(e?.message || e) }));
else if (params.get("mode") === "backup") backup(params.get("slot") || "manuel").catch((e) => finish({ error: String(e?.message || e) }));
else reply().catch((e) => finish({ error: String(e?.message || e) }));
