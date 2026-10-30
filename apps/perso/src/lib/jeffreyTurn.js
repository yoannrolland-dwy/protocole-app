// Un tour de Jeffrey (extrait de JeffreyChat.jsx le 29/10/2026, logique inchangée) : requête,
// réponse en flux, cartes de séance, actions à confirmer, réponses rapides, relance d'une réponse
// muette. Partagé par la conversation et par le brief du matin (J4.1, page sans écran comprise).
import { streamClaude } from "@rawcare/core/coach/claudeApi";
import {
  readReply, effortFor, validateSessionChoice, continuationIfSilent, isActionTool, validateAction,
} from "@rawcare/core/coach/jeffrey";
import { recordSpend } from "./ai.js";

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const hhmm = () => new Date().toTimeString().slice(0, 5);

/** La réflexion n'est renvoyée à l'API que pour la dernière réponse (voir toApiMessages) :
 *  inutile de la garder dans le stockage pour les réponses plus anciennes. */
export const withoutOldThinking = (entries) => {
  const last = entries.map((e) => e.role).lastIndexOf("assistant");
  return entries.map((e, i) => (e.role === "assistant" && i !== last && e.content?.some((b) => b.type === "thinking" || b.type === "redacted_thinking"))
    ? { ...e, content: e.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") }
    : e);
};

/**
 * Joue un tour : `history` se termine par le message de Monsieur. Relance une fois, outils
 * interdits, si la réponse n'a aucun texte. → { history, journal, memDate }.
 * En cas d'erreur, `e.partial` porte ce qui a déjà été reçu (même forme).
 */
export async function jeffreyTurn({ history, mode, coach, ai, note, transport, foodContext, onText, onRetry, onPass }) {
  let journal = null;
  let memDate = null;
  try {
    for (let pass = 0; pass < 2; pass++) {
      const req = coach.jeffreyRequest(history, note);
      const { message, usedModel, cents } = await streamClaude({
        provider: ai.provider, baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: ai.model,
        system: req.system, messages: req.messages,
        // Outils interdits pour la relance d'une réponse muette (sinon elle peut rester muette). Le
        // brief n'a droit qu'à proposer_reponses (J4.3, 30/10/2026 : la première réponse devient un
        // bouton de la notification) ; sa consigne demande le texte d'abord. Essai du 29/10 : avec
        // tous les outils, Opus avait répondu par des outils seuls, d'où une relance payée.
        toolChoice: pass > 0 ? { type: "none" } : mode === "brief" ? { type: "auto" } : undefined,
        tools: mode === "brief" ? req.tools.filter((t) => t.name === "proposer_reponses") : req.tools,
        effort: effortFor(mode), maxTokens: 16000, streamTransport: transport,
        onText: onText ? (_, all) => onText(readReply([{ type: "text", text: all }]).text) : undefined,
        onRetry,
      });
      recordSpend(cents);
      const { text, journal: j } = readReply(message.content);
      if (j) {
        journal = j;
        memDate = [...history].reverse().find((e) => e.role === "user" && e.memoryFor)?.memoryFor || memDate;
      }
      const tools = message.content.filter((b) => b.type === "tool_use");
      const toolResults = {};
      const choices = [];
      const actions = [];
      for (const t of tools) {
        if (isActionTool(t.name)) {
          const v = validateAction(t.name, t.input, foodContext?.() || {});
          toolResults[t.id] = v.ok ? "Proposée à Monsieur, en attente de sa confirmation : rien n'est fait pour l'instant." : `Refusée par l'application : ${v.reason}.`;
          if (v.ok) actions.push({ id: t.id, ...v.action, status: "pending" });
          continue;
        }
        if (t.name === "choisir_seance") {
          const v = validateSessionChoice(t.input, req.allowed);
          toolResults[t.id] = v.ok ? "Proposée à Monsieur, avec un bouton pour la démarrer." : `Refusée par l'application : ${v.reason}. Ne la proposez pas.`;
          if (v.ok) choices.push({ id: t.id, ...v });
        }
      }
      const quick = tools.find((t) => t.name === "proposer_reponses");
      history = [...history, {
        id: newId(), role: "assistant", at: hhmm(), content: message.content, text, choices, actions,
        quick: quick ? { id: quick.id, options: (quick.input?.options || []).slice(0, 4).map(String) } : null,
        toolResults, meta: { cents, model: usedModel },
      }];
      const cont = pass === 0 ? continuationIfSilent(message) : null;
      if (!cont) break;
      history = [...history, { ...cont, id: newId(), at: hhmm(), hidden: true }];
      onPass?.();
    }
  } catch (e) {
    e.partial = { history: withoutOldThinking(history), journal, memDate };
    throw e;
  }
  return { history: withoutOldThinking(history), journal, memDate };
}
