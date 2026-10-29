// Transport en flux pour Jeffrey (chantier J, J1.1, 29/10/2026), passé à `streamClaude`
// (packages/core/src/coach/claudeApi.js). Sur l'app native avec LiteLLM : relais Android
// `JeffreyHttp` (le serveur ne répond pas au CORS, CapacitorHttp ne lit pas un flux). Sinon
// (Anthropic direct, ou l'aperçu navigateur) : `fetch` en flux, comme le reste du code partagé.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { fetchStreamTransport } from "@rawcare/core/coach/claudeApi";

const JeffreyHttp = registerPlugin("JeffreyHttp");

let seq = 0;

/** Même contrat que fetchStreamTransport : { url, headers, body, onEvent } → { ok, status, data, header }. */
export async function nativeStreamTransport({ url, headers, body, onEvent }) {
  const id = `j${Date.now()}-${++seq}`;
  let received = 0;
  let failure = null;
  const handle = await JeffreyHttp.addListener("jeffreyStream", (e) => {
    if (e.id !== id) return;
    received++;
    let d = e.data;
    try { d = JSON.parse(e.data); } catch { /* données non JSON : passées telles quelles */ }
    try { onEvent(e.event, d); } catch (err) { failure = failure || err; }
  });
  try {
    const res = await JeffreyHttp.stream({ id, url, headers, body: JSON.stringify(body) });
    if (res.status < 200 || res.status >= 300) {
      let data = null;
      try { data = JSON.parse(res.errorBody); } catch { /* corps non JSON */ }
      return { ok: false, status: res.status, data, header: () => null };
    }
    // Les événements et la fin de l'appel traversent le pont séparément : on attend d'avoir
    // reçu tous ceux que le relais annonce avant de clore (une seconde au plus).
    for (let i = 0; i < 50 && received < res.events; i++) await new Promise((r) => setTimeout(r, 20));
    if (failure) throw failure;
    return { ok: true, status: res.status, header: (k) => (k === "x-litellm-response-cost" ? res.cost ?? null : null) };
  } finally {
    handle.remove();
  }
}

/** Le bon transport pour le fournisseur réglé. */
export const streamTransportFor = (ai) =>
  ai?.provider === "litellm" && Capacitor.isNativePlatform() ? nativeStreamTransport : fetchStreamTransport;
