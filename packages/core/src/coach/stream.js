// Lecture d'une réponse en flux de l'API Messages (chantier J, J1.1, 29/10/2026).
// Le format est celui d'Anthropic (`stream: true`), relayé tel quel par LiteLLM : des
// événements SSE (`event: …` / `data: {…}`) qui décrivent les blocs de la réponse au fil de
// l'eau. Deux briques pures, sans réseau : un découpeur SSE et un accumulateur qui reconstruit
// le message final (texte, appels d'outils, réflexion avec sa signature, coût).

/** Découpeur SSE incrémental : `push(texte)` accepte des morceaux coupés n'importe où (même au
 *  milieu d'une ligne) et appelle `onEvent(nom, données)` pour chaque événement complet. */
export function createSSEParser(onEvent) {
  let buf = "";
  let name = "message";
  let data = [];
  const flush = () => {
    if (!data.length) { name = "message"; return; }
    const raw = data.join("\n");
    data = [];
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch { /* données non JSON : passées telles quelles */ }
    const n = name;
    name = "message";
    onEvent(n, parsed);
  };
  const line = (l) => {
    if (l === "") return flush();
    if (l.startsWith(":")) return; // commentaire (battement de cœur du serveur)
    if (l.startsWith("event:")) name = l.slice(6).trim();
    else if (l.startsWith("data:")) data.push(l.slice(5).replace(/^ /, ""));
  };
  return {
    push(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        line(buf.slice(0, i).replace(/\r$/, ""));
        buf = buf.slice(i + 1);
      }
    },
    end() {
      if (buf) { line(buf.replace(/\r$/, "")); buf = ""; }
      flush();
    },
  };
}

/** Accumulateur : `push(nom, données)` pour chaque événement, `onText(delta, texteComplet)`
 *  à chaque morceau de texte visible. `message()` rend le message final au format de l'API
 *  non-flux ({ id, model, content, stop_reason, usage }). Un événement `error` lève une erreur. */
export function createMessageAccumulator({ onText } = {}) {
  const msg = { id: null, model: null, content: [], stop_reason: null, usage: {} };
  const partial = {}; // index → JSON d'outil en cours de réception
  let text = "";
  return {
    push(name, d) {
      const type = d?.type || name;
      if (type === "error") {
        const err = new Error(d?.error?.message || "Erreur pendant le flux");
        err.status = d?.error?.type === "overloaded_error" ? 529 : null;
        err.retryable = d?.error?.type === "overloaded_error";
        throw err;
      }
      if (type === "message_start") {
        Object.assign(msg, { id: d.message?.id ?? null, model: d.message?.model ?? null });
        Object.assign(msg.usage, d.message?.usage || {});
      } else if (type === "content_block_start") {
        const b = { ...d.content_block };
        if (b.type === "tool_use") { b.input = {}; partial[d.index] = ""; }
        if (b.type === "text") b.text = b.text || "";
        if (b.type === "thinking") { b.thinking = b.thinking || ""; b.signature = b.signature || ""; }
        msg.content[d.index] = b;
      } else if (type === "content_block_delta") {
        const b = msg.content[d.index];
        const delta = d.delta || {};
        if (!b) return;
        if (delta.type === "text_delta") {
          b.text += delta.text;
          text += delta.text;
          onText?.(delta.text, text);
        } else if (delta.type === "input_json_delta") partial[d.index] += delta.partial_json || "";
        else if (delta.type === "thinking_delta") b.thinking += delta.thinking || "";
        else if (delta.type === "signature_delta") b.signature += delta.signature || "";
      } else if (type === "content_block_stop") {
        const b = msg.content[d.index];
        if (b?.type === "tool_use") {
          const raw = partial[d.index];
          try { b.input = raw ? JSON.parse(raw) : {}; } catch { b.input = {}; b.invalidInput = raw; }
          delete partial[d.index];
        }
      } else if (type === "message_delta") {
        if (d.delta?.stop_reason) msg.stop_reason = d.delta.stop_reason;
        Object.assign(msg.usage, d.usage || {});
      }
    },
    /** Texte visible reçu jusqu'ici. */
    text: () => text,
    /** Au moins un événement reçu : une erreur après ce point ne se rattrape plus par une reprise. */
    started: () => msg.id != null || msg.content.length > 0,
    message: () => ({ ...msg, content: msg.content.filter(Boolean) }),
  };
}
