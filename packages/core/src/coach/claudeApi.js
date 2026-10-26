// Appel à l'API Messages (format Anthropic), partagé par le Coach IA, la Carte resto et la Photo
// d'un plat. Deux fournisseurs (26/10/2026) : Anthropic en direct, ou un serveur LiteLLM qui
// expose le même format (`/v1/messages`) pour tous les fournisseurs qu'il connaît.
// Extrait d'App.jsx le 05/08/2026 (logique inchangée) pour être réutilisable depuis
// src/nutrition/ sans import circulaire.

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { today } from "../dateUtils.js";

// Tarifs Anthropic en $ par million de tokens (relevés le 29/07/2026). `intro` est un
// tarif de lancement à durée limitée : au-delà de `introUntil` on repasse au tarif normal,
// d'où la date en dur plutôt qu'un simple prix — sinon l'app sous-estimerait le coût à
// partir du 01/09/2026 sans que rien ne le signale.
export const PRICING = {
  // Sonnet 5.5 (07/10/2026) : successeur de Sonnet 5 au même tarif (2 $ / 10 $ par MTok), effort
  // supporté (défaut "high" côté API ; l'app envoie "medium", voir CLAUDE.md).
  "claude-sonnet-5-5": { in: 2, out: 10 },
  // Opus 5.5 (26/10/2026) : 4 $ / 20 $ par MTok, réflexion toujours active (effort par défaut "medium").
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5": { in: 3, out: 15, intro: { in: 2, out: 10 }, introUntil: "2026-08-31" },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-opus-5": { in: 5, out: 25 },
};
export const PRICING_FALLBACK = { in: 3, out: 15 }; // modèle inconnu : on estime au tarif Sonnet

// Coût en centimes de dollar. `cache_read` est facturé ~10 % du tarif d'entrée ; on le
// compte séparément pour que l'affichage reste juste si on active le cache un jour.
export const costCents = (model, usage) => {
  const p = PRICING[model] || PRICING_FALLBACK;
  const rate = p.intro && today() <= p.introUntil ? p.intro : { in: p.in, out: p.out };
  const cached = usage?.cache_read_input_tokens || 0;
  const fresh = (usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0);
  const out = usage?.output_tokens || 0;
  return ((fresh * rate.in + cached * rate.in * 0.1 + out * rate.out) / 1e6) * 100;
};

// Haiku 4.5 REJETTE output_config.effort (paramètre réservé aux modèles récents) : on ne
// l'envoie donc que pour les modèles qui le supportent, sinon la bascule de secours
// échouerait avec une erreur 400 au pire moment.
export const SUPPORTS_EFFORT = new Set(["claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-5-5", "claude-opus-5"]);
export const FALLBACK_MODEL = "claude-haiku-4-5";

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// --- LiteLLM (26/10/2026) -----------------------------------------------------------------
// LiteLLM nomme les modèles « fournisseur/modèle » (ex. "anthropic/claude-haiku-4-5"). Pour
// les tarifs, le niveau de réflexion et le modèle de secours, on raisonne sur le nom Anthropic.
export const baseModel = (m) => String(m || "").replace(/^anthropic\//, "");

/** Vrai si le modèle est un Claude (seuls les Claude ont l'outil web_fetch de Carte resto). */
export const isClaudeModel = (provider, m) => provider !== "litellm" || /^anthropic\/|claude/.test(String(m || ""));

/** Modèle de secours en cas de saturation, ou null : pas de bascule pour un autre fournisseur
 *  que Claude (LiteLLM sait gérer ses propres secours si on le configure côté serveur). */
export function fallbackFor(provider, m) {
  if (provider !== "litellm") return FALLBACK_MODEL;
  return /^anthropic\//.test(String(m || "")) ? `anthropic/${FALLBACK_MODEL}` : null;
}

/** Coût en centimes, ou null s'il est inconnu (jamais une estimation fausse). Claude : nos tarifs ;
 *  autre modèle via LiteLLM : coût renvoyé par le serveur (en-tête x-litellm-response-cost, en $). */
export function callCents(m, usage, liteCostDollars) {
  const b = baseModel(m);
  if (PRICING[b]) return costCents(b, usage);
  const c = liteCostDollars == null || liteCostDollars === "" ? NaN : Number(liteCostDollars);
  if (Number.isFinite(c)) return c * 100;
  if (/^claude/.test(b)) return costCents(b, usage); // Claude sans tarif connu : estimation comme avant
  return null;
}

const trimUrl = (u) => String(u || "").trim().replace(/\/+$/, "");

// Requête HTTP. Sur l'app native, LiteLLM passe par CapacitorHttp : le serveur ne répond pas
// à la vérification CORS du navigateur (testé le 26/10/2026 : 404 sur OPTIONS), que le client
// natif ne fait pas. Anthropic direct garde fetch(), qui fonctionne depuis toujours.
async function httpJson({ url, method = "POST", headers, body, native }) {
  if (native) {
    const res = await CapacitorHttp.request({ url, method, headers, data: body });
    let data = res.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = null; } }
    const h = Object.fromEntries(Object.entries(res.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    return { status: res.status, ok: res.status >= 200 && res.status < 300, data, header: (k) => h[k] };
  }
  const res = await fetch(url, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* réponse non-JSON */ }
  return { status: res.status, ok: res.ok, data, header: (k) => res.headers.get(k), statusText: res.statusText };
}

/** Une requête Messages vers le bon fournisseur → { status, ok, data, header }. */
function defaultTransport({ provider, baseUrl, apiKey, body }) {
  if (provider === "litellm") {
    return httpJson({
      url: `${trimUrl(baseUrl)}/v1/messages`,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "anthropic-version": "2023-06-01" },
      body, native: Capacitor.isNativePlatform(),
    });
  }
  return httpJson({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body,
  });
}

/** Modèles connus du serveur LiteLLM (GET /v1/models) → liste d'identifiants triée. */
export async function listLiteLLMModels({ baseUrl, apiKey }) {
  const res = await httpJson({
    url: `${trimUrl(baseUrl)}/v1/models`, method: "GET",
    headers: { authorization: `Bearer ${apiKey}` }, native: Capacitor.isNativePlatform(),
  });
  if (!res.ok) throw new Error(res.data?.error?.message || `HTTP ${res.status}`);
  return (res.data?.data || []).map((x) => x.id).filter(Boolean).sort();
}

/**
 * Un appel à l'API Messages, avec reprise automatique.
 *
 * Pourquoi : constaté le 28/07/2026 au soir, l'API a renvoyé « overloaded » sur Sonnet et
 * Opus alors que Haiku répondait encore. L'app ne faisait qu'une seule tentative, donc une
 * saturation passagère se soldait par une erreur brute affichée à l'utilisateur.
 * Stratégie : 2 reprises espacées sur les erreurs transitoires (429 / 5xx / réseau), puis
 * bascule sur Haiku — moins fin, mais disponible et 3× moins cher, ce qui vaut mieux que
 * pas d'analyse du tout. Les erreurs définitives (clé invalide, requête malformée) ne sont
 * jamais reprises : ça ne ferait que retarder le vrai message d'erreur.
 *
 * `provider` : "anthropic" (défaut, comportement inchangé) ou "litellm" (+ `baseUrl`).
 * Retourne { data, usedModel, cents } — `cents` null si le coût est inconnu.
 */
export async function callClaude({ apiKey, model, system, user, effort, maxTokens, tools, onRetry, provider = "anthropic", baseUrl, transport = defaultTransport, retryDelays = [1200, 4000] }) {
  const attempt = async (m) => {
    const body = {
      model: m,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    };
    if (effort && SUPPORTS_EFFORT.has(baseModel(m))) body.output_config = { effort };
    if (tools) body.tools = tools;
    const res = await transport({ provider, baseUrl, apiKey, body });
    const data = res.data;
    if (!res.ok || !data || data.type === "error") {
      const err = new Error(data?.error?.message || `HTTP ${res.status} ${res.statusText || ""}`.trim());
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }
    return { data, usedModel: m, cents: callCents(m, data.usage, res.header?.("x-litellm-response-cost")) };
  };

  const fallback = fallbackFor(provider, model);
  const delays = retryDelays;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await attempt(model);
    } catch (e) {
      // Erreur réseau (pas de status) : transitoire aussi, on retente.
      const transient = e.retryable || e.status == null;
      if (!transient || i === delays.length) {
        if (transient && fallback && model !== fallback) {
          onRetry?.(`Modèle saturé — bascule sur ${fallback}…`);
          return await attempt(fallback);
        }
        throw e;
      }
      onRetry?.(`Réessai ${i + 1}/${delays.length}…`);
      await sleepMs(delays[i]);
    }
  }
  throw new Error("Échec inattendu"); // inatteignable, garde-fou
}
