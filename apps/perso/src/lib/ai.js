// Fournisseur IA (26/10/2026) : Anthropic en direct, ou serveur LiteLLM (même format de requête,
// tous les fournisseurs). `ai` = { provider, apiKey, model, baseUrl } construit par App.jsx et
// passé tel quel à callClaude par le Coach IA, la Carte resto et la Photo d'un plat.
import { say } from "./jeffrey.js";
import { getSync, store } from "../store.js";
import { today } from "@rawcare/core/dateUtils";

/** Message à afficher si le fournisseur choisi n'est pas complet, sinon null. */
export function aiMissing(ai) {
  if (ai?.provider === "litellm") {
    if (!ai.baseUrl || !ai.apiKey || !ai.model) return say("aiMissingLite");
    return null;
  }
  return ai?.apiKey ? null : say("aiMissingKey");
}

// Coût du mois (chantier J, J1.3, 29/10/2026) : chaque appel à l'IA ajoute son coût réel (Jeffrey,
// Carte resto, Photo d'un plat). Clé `aiSpend` = { month: "AAAA-MM", cents }, remise à zéro au
// premier appel d'un nouveau mois. Un coût inconnu (null) n'ajoute rien.
const monthKey = () => today().slice(0, 7);

export function recordSpend(cents) {
  if (!Number.isFinite(cents) || cents <= 0) return;
  const cur = getSync("aiSpend", null);
  const base = cur?.month === monthKey() ? cur.cents : 0;
  store.set("aiSpend", { month: monthKey(), cents: base + cents });
}

/** Centimes dépensés ce mois-ci (0 si rien encore, ou si le compteur date d'un mois passé). */
export function monthSpend() {
  const cur = getSync("aiSpend", null);
  return cur?.month === monthKey() ? cur.cents : 0;
}

/** Coût affiché après un appel : centimes, ou « coût inconnu » (jamais une estimation fausse). */
export function fmtCost(cents) {
  if (cents == null) return "coût inconnu";
  return `≈ ${cents < 1 ? cents.toFixed(2) : cents.toFixed(1)} ¢`;
}
