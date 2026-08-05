// Appel direct à l'API Messages Anthropic, partagé par le Coach IA et la Carte resto.
// Extrait d'App.jsx le 05/08/2026 (logique inchangée) pour être réutilisable depuis
// src/nutrition/ sans import circulaire.

import { today } from "../dateUtils.js";

// Tarifs Anthropic en $ par million de tokens (relevés le 29/07/2026). `intro` est un
// tarif de lancement à durée limitée : au-delà de `introUntil` on repasse au tarif normal,
// d'où la date en dur plutôt qu'un simple prix — sinon l'app sous-estimerait le coût à
// partir du 01/09/2026 sans que rien ne le signale.
export const PRICING = {
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
export const SUPPORTS_EFFORT = new Set(["claude-sonnet-5", "claude-opus-5"]);
export const FALLBACK_MODEL = "claude-haiku-4-5";

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

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
 */
export async function callClaude({ apiKey, model, system, user, effort, maxTokens, tools, onRetry }) {
  const attempt = async (m) => {
    const body = {
      model: m,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    };
    if (effort && SUPPORTS_EFFORT.has(m)) body.output_config = { effort };
    if (tools) body.tools = tools;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* réponse non-JSON */ }
    if (!res.ok || !data || data.type === "error") {
      const err = new Error(data?.error?.message || `HTTP ${res.status} ${res.statusText}`.trim());
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }
    return { data, usedModel: m };
  };

  const delays = [1200, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await attempt(model);
    } catch (e) {
      // Erreur réseau (pas de status) : transitoire aussi, on retente.
      const transient = e.retryable || e.status == null;
      if (!transient || i === delays.length) {
        if (transient && model !== FALLBACK_MODEL) {
          onRetry?.(`Modèle saturé — bascule sur ${FALLBACK_MODEL}…`);
          return await attempt(FALLBACK_MODEL);
        }
        throw e;
      }
      onRetry?.(`Réessai ${i + 1}/${delays.length}…`);
      await sleepMs(delays[i]);
    }
  }
  throw new Error("Échec inattendu"); // inatteignable, garde-fou
}
