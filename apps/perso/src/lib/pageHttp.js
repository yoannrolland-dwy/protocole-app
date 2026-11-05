// Relais HTTP des pages sans écran (brief.html, bridge.html) : le natif fait la requête (LiteLLM
// ne répond pas au CORS, et ces WebView n'ont pas CapacitorHttp), puis rappelle
// `window.__briefHttpDone(id, status, text)` avec la réponse entière. Extrait de briefPage.js le
// 05/11/2026 (pont JEFFREY), logique inchangée.
import { createSSEParser } from "@rawcare/core/coach/stream";

let seq = 0;
const pending = new Map();
window.__briefHttpDone = (id, status, text) => { pending.get(id)?.(status, text); pending.delete(id); };

/** Même contrat que fetchStreamTransport, mais le corps arrive en entier (SSE relu d'un bloc).
 *  `bridge` : l'interface native de la page (méthode `http(id, url, headers, body)`). */
export const pageTransport = (bridge) => ({ url, headers, body, onEvent }) => new Promise((resolve) => {
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

/** Requête PUT/GET par le natif (`bridge.request`), réponse entière : { status, text }. */
export const pageRequest = (bridge) => ({ method, url, headers = {}, body }) => new Promise((resolve) => {
  const id = String(++seq);
  pending.set(id, (status, text) => resolve({ status, text }));
  bridge.request(id, method, url, JSON.stringify(headers), body ?? null);
});
