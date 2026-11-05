// Page sans écran du pont JEFFREY (étape G1, 05/11/2026). JeffreyBridgeService.kt la charge dans
// une WebView jamais affichée, à la même origine que l'app (donc même stockage), pour UNE requête de
// l'appli JEFFREY : `window.JeffreyBridgePage.request()` donne { op, json }, `finish` rend
// { ok, json } ou { ok, erreur }. Aucun plugin Capacitor ici ; les appels à l'IA (analyse) passent
// par le relais HTTP natif (`http`). Écritures : le point/bilan (G1), `brief_fait` (G2) et les
// actions relues puis confirmées par Monsieur (`agir`, G3).
import { handleBridgeRequest } from "./lib/bridge.js";
import { pageTransport } from "./lib/pageHttp.js";

const bridge = window.JeffreyBridgePage;
const finish = (result) => {
  if (bridge) bridge.finish(JSON.stringify(result));
  else console.log("pont", result);
};

async function main() {
  const req = JSON.parse(bridge?.request() || "{}");
  // Analyse : service au premier plan le temps de l'appel (réseau en économie d'énergie).
  if (req.op === "analyse") bridge?.keepAlive();
  return finish(await handleBridgeRequest(req.op, req.json, { transport: pageTransport(bridge) }));
}
main().catch(() => finish({ ok: false, erreur: "interne" }));
