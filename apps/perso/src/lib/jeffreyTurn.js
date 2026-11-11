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
 * Range le résultat d'un tour dans la conversation TELLE QU'ELLE EST MAINTENANT (audit du
 * 10/11/2026, point 13). Avant, le tour réécrivait le jour entier avec sa propre copie, prise au
 * départ : tout ce qui avait changé pendant la réponse était écrasé — une carte confirmée
 * redevenait « Confirmer » (un second tap écrivait l'eau ou le repas deux fois), une réponse
 * arrivée entre-temps (autre message, notification) disparaissait.
 * - `current` : la conversation du jour à l'instant de l'écriture ;
 * - `base` : l'historique donné au tour (son dernier message est celui de Monsieur) ;
 * - `result` : ce que le tour rend (`base` + ses nouvelles entrées).
 * Les entrées déjà présentes gardent leur version ACTUELLE ; seules les nouvelles entrées du tour
 * sont ajoutées, juste après le message auquel elles répondent (à la fin s'il a disparu).
 */
// Une action est « décidée » quand Monsieur l'a confirmée ou annulée. Une décision ne se perd
// jamais au profit d'une copie où elle est encore « à confirmer ».
const decided = (a) => !!a && a.status && a.status !== "pending";

/** Une même entrée vue de deux côtés : `a` fait foi, sauf pour une action décidée seulement dans `b`. */
function mergeEntry(a, b) {
  if (!b?.actions?.length || !a?.actions?.length) return a;
  let changed = false;
  const toolResults = { ...(a.toolResults || {}) };
  const actions = a.actions.map((x) => {
    const y = b.actions.find((z) => z.id === x.id);
    if (!decided(x) && decided(y)) {
      changed = true;
      if (b.toolResults?.[x.id] != null) toolResults[x.id] = b.toolResults[x.id];
      return y;
    }
    return x;
  });
  return changed ? { ...a, actions, toolResults } : a;
}

/**
 * Réunit deux versions de la conversation d'un jour (audit du 10/11/2026, point 13) — celle d'un
 * écran et celle du stockage, qu'une page sans écran (notification, brief, pont) a pu écrire :
 * - aucune entrée n'est perdue : celles que seule `other` connaît sont remises à leur place, juste
 *   après l'entrée qui les précède dans `other` ;
 * - pour une entrée connue des deux, `primary` fait foi, sauf qu'une action décidée d'un côté reste
 *   décidée (jamais un second « Confirmer » sur une action déjà écrite).
 */
export function unionDay(primary, other) {
  const p = primary || [];
  const o = other || [];
  if (!o.length) return p;
  const byId = new Map(o.map((e) => [e.id, e]));
  let out = p.map((e) => (byId.has(e.id) ? mergeEntry(e, byId.get(e.id)) : e));
  const have = new Set(out.map((e) => e.id));
  o.forEach((e, i) => {
    if (have.has(e.id)) return;
    const prevId = i > 0 ? o[i - 1].id : null;
    const at = prevId == null ? -1 : out.findIndex((x) => x.id === prevId);
    out = prevId == null ? [e, ...out] : at >= 0 ? [...out.slice(0, at + 1), e, ...out.slice(at + 1)] : [...out, e];
    have.add(e.id);
  });
  return out;
}

export function mergeTurn(current, base, result) {
  const cur = current || [];
  const baseIds = new Set((base || []).map((e) => e.id));
  const curIds = new Set(cur.map((e) => e.id));
  const added = (result || []).filter((e) => !baseIds.has(e.id) && !curIds.has(e.id));
  if (!added.length) return cur;
  const anchor = (base || [])[base.length - 1];
  const at = anchor ? cur.findIndex((e) => e.id === anchor.id) : -1;
  // Le message de Monsieur n'est plus là : la réponse ne s'affiche jamais sans sa question.
  const merged = at >= 0
    ? [...cur.slice(0, at + 1), ...added, ...cur.slice(at + 1)]
    : [...cur, ...(anchor ? [anchor] : []), ...added];
  return withoutOldThinking(merged);
}

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
