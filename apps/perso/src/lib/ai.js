// Fournisseur IA (26/10/2026) : Anthropic en direct, ou serveur LiteLLM (même format de requête,
// tous les fournisseurs). `ai` = { provider, apiKey, model, baseUrl } construit par App.jsx et
// passé tel quel à callClaude par le Coach IA, la Carte resto et la Photo d'un plat.

/** Message à afficher si le fournisseur choisi n'est pas complet, sinon null. */
export function aiMissing(ai) {
  if (ai?.provider === "litellm") {
    if (!ai.baseUrl || !ai.apiKey || !ai.model) return "Renseigne l'adresse, la clé et le modèle LiteLLM dans Réglages pour activer cette fonction.";
    return null;
  }
  return ai?.apiKey ? null : "Ajoute ta clé API Anthropic dans Réglages pour activer cette fonction.";
}

/** Coût affiché après un appel : centimes, ou « coût inconnu » (jamais une estimation fausse). */
export function fmtCost(cents) {
  if (cents == null) return "coût inconnu";
  return `≈ ${cents < 1 ? cents.toFixed(2) : cents.toFixed(1)} ¢`;
}
