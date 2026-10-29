// Conversation avec Jeffrey (chantier J, J1.2, 29/10/2026) — remplace la carte Coach IA en tête
// de l'onglet Analyse. Contrat et règles : packages/core/src/coach/jeffrey.js ; spec : ROADMAP.md,
// « Chantier J ». La conversation du jour vit dans `jeffreyLog` (App.jsx) : une réponse en cours
// s'y enregistre même si Monsieur change d'onglet (l'écriture passe par App, toujours montée).
import { useEffect, useRef, useState } from "react";
import { Send, ChevronRight, ChevronDown } from "lucide-react";
import { TEMPLATES } from "@rawcare/core/session/templates";
import { streamClaude } from "@rawcare/core/coach/claudeApi";
import {
  jeffreyAsk, readReply, effortFor, validateSessionChoice, continuationIfSilent, withMemory,
  isActionTool, validateAction, appendNote, confirmedResult, CANCELLED_RESULT,
} from "@rawcare/core/coach/jeffrey";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button, IconButton, Chip } from "../../design/primitives.jsx";
import { today } from "../../ui.jsx";
import { aiMissing, fmtCost, recordSpend } from "../../lib/ai.js";
import { say, sayStable, sayError } from "../../lib/jeffrey.js";
import { streamTransportFor } from "../../lib/jeffreyHttp.js";

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const hhmm = () => new Date().toTimeString().slice(0, 5);

/** La réflexion n'est renvoyée à l'API que pour la dernière réponse (voir toApiMessages) :
 *  inutile de la garder dans le stockage pour les réponses plus anciennes. */
const withoutOldThinking = (entries) => {
  const last = entries.map((e) => e.role).lastIndexOf("assistant");
  return entries.map((e, i) => (e.role === "assistant" && i !== last && e.content?.some((b) => b.type === "thinking" || b.type === "redacted_thinking"))
    ? { ...e, content: e.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") }
    : e);
};

function SessionCard({ choice, onStart }) {
  const canStart = choice.jour === "aujourdhui" && TEMPLATES[choice.type];
  return (
    <div style={{ border: `1px solid ${T.c.accentLine}`, borderRadius: 12, padding: 12, display: "grid", gap: 8, background: T.c.field }}>
      <div style={{ fontSize: 13, color: T.c.text2 }}>{choice.jour === "demain" ? "Demain" : "Aujourd'hui"}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.c.text }}>{choice.type}</div>
      {choice.raison && <div style={{ fontSize: 14, color: T.c.text2, lineHeight: 1.45 }}>{choice.raison}</div>}
      {canStart && <Button variant="primary" block onClick={() => onStart(choice.type)}>Démarrer {choice.type}</Button>}
    </div>
  );
}

// Action proposée par Jeffrey (J2) : rien n'est écrit sans un tap. Genou sans « retour à la
// base » connu : la carte pose la question au lieu d'un simple Confirmer.
function ActionCard({ action, onDecide }) {
  const box = { border: `1px solid ${T.c.line}`, borderRadius: 12, padding: 12, display: "grid", gap: 8, background: T.c.field };
  if (action.status === "done") return <div style={{ ...box, color: T.c.text2, fontSize: 14 }}>✓ {action.label} — <span style={{ color: T.c.accent }}>{action.doneText}</span></div>;
  if (action.status === "cancelled") return <div style={{ ...box, color: T.c.muted, fontSize: 14 }}>{action.label} — {action.doneText}</div>;
  const askBase = action.kind === "genou" && action.baseline == null;
  return (
    <div style={box}>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.c.text }}>{action.label}</div>
      {askBase && <div style={{ fontSize: 14, color: T.c.text2 }}>Retour à la douleur de base sous 24 h ?</div>}
      <div style={{ display: "grid", gridTemplateColumns: askBase ? "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        {askBase ? (
          <>
            <Button variant="primary" onClick={() => onDecide(action, true, true)}>Oui</Button>
            <Button variant="outline" onClick={() => onDecide(action, true, false)}>Non</Button>
          </>
        ) : <Button variant="primary" onClick={() => onDecide(action, true)}>Confirmer</Button>}
        <Button variant="plain" onClick={() => onDecide(action, false)}>Annuler</Button>
      </div>
    </div>
  );
}

function Message({ entry, onStart, onDecide }) {
  if (entry.hidden) return null;
  // Réponse muette relancée (continuationIfSilent) : rien à montrer, son coût est dans le total.
  if (entry.role === "assistant" && !entry.text && !entry.choices?.length && !entry.actions?.length) return null;
  if (entry.role === "user") {
    return (
      <div style={{ justifySelf: "end", maxWidth: "85%", background: T.c.raised, borderRadius: "14px 14px 4px 14px", padding: "10px 12px", fontSize: 15, color: T.c.text, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
        {entry.text}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: "100%" }}>
      {entry.text && <div style={{ fontSize: 15, color: T.c.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{entry.text}</div>}
      {(entry.choices || []).map((c) => <SessionCard key={c.id} choice={c} onStart={onStart} />)}
      {(entry.actions || []).map((a) => <ActionCard key={a.id} action={a} onDecide={(act, ok, base) => onDecide(entry.id, act, ok, base)} />)}
      {entry.meta && <div className="p-num" style={{ fontSize: 12, color: T.c.muted }}>{fmtCost(entry.meta.cents)}</div>}
    </div>
  );
}

// `memory` (J1.3) : { date, entries } d'un jour passé pas encore versé au carnet, ou null ;
// `onMemoryDone(date)` quand Jeffrey a réécrit son carnet avec. `initialAsk` : demande lancée à
// l'ouverture (« point » depuis la carte du tableau de bord), une seule fois.
export function JeffreyChat({ coach, ai, entries, setDay, todayNote, saveNote, saveJournal, onStart, memory, onMemoryDone, initialAsk, onAction }) {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(null); // { text, progress } pendant une réponse
  const [err, setErr] = useState("");
  const [note, setNote] = useState(todayNote || "");
  const [openNote, setOpenNote] = useState(false);
  const endRef = useRef(null);
  const busy = live != null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [entries.length, busy]);

  // Demande lancée à l'ouverture (carte du tableau de bord), une seule fois.
  const asked = useRef(false);
  useEffect(() => {
    if (!initialAsk || asked.current) return;
    asked.current = true;
    ask(jeffreyAsk(initialAsk));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsk]);

  // Une réponse de Jeffrey pour l'historique donné (dernier message : celui de Monsieur).
  // Relance automatique une fois si la réponse n'a aucun texte (continuationIfSilent).
  const run = async (history, mode) => {
    const missing = aiMissing(ai);
    if (missing) { setErr(missing); return; }
    const date = today();
    setErr("");
    setLive({ text: "", progress: "" });
    try {
      for (let pass = 0; pass < 2; pass++) {
        const req = coach.jeffreyRequest(history, note);
        const { message, usedModel, cents } = await streamClaude({
          provider: ai.provider, baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: ai.model,
          system: req.system, messages: req.messages, tools: req.tools,
          effort: effortFor(mode), maxTokens: 16000, streamTransport: streamTransportFor(ai),
          onText: (_, all) => setLive((l) => ({ ...(l || {}), text: readReply([{ type: "text", text: all }]).text })),
          onRetry: (p) => setLive((l) => ({ ...(l || {}), progress: p })),
        });
        recordSpend(cents);
        const { text, journal } = readReply(message.content);
        if (journal) {
          saveJournal(journal);
          const memDate = [...history].reverse().find((e) => e.role === "user" && e.memoryFor)?.memoryFor;
          if (memDate) onMemoryDone?.(memDate);
        }
        const tools = message.content.filter((b) => b.type === "tool_use");
        const toolResults = {};
        const choices = [];
        const actions = [];
        for (const t of tools) {
          if (isActionTool(t.name)) {
            const v = validateAction(t.name, t.input);
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
        setLive({ text: "", progress: "" });
      }
      setDay(date, withoutOldThinking(history));
    } catch (e) {
      console.error("Jeffrey", e);
      setDay(date, withoutOldThinking(history));
      setErr(e?.message || "cause inconnue");
    } finally {
      setLive(null);
    }
  };

  const ask = (userEntry) => {
    if (busy) return;
    let history = entries;
    // Réponse rapide touchée : on le dit à Jeffrey dans le résultat de son outil.
    const lastA = [...history].reverse().find((e) => e.role === "assistant");
    if (userEntry.quickFor && lastA?.quick?.id === userEntry.quickFor) {
      history = history.map((e) => (e === lastA ? { ...e, toolResults: { ...e.toolResults, [lastA.quick.id]: `Monsieur a touché « ${userEntry.text} ».` } } : e));
    }
    let { quickFor: _q, ...entry } = userEntry;
    // Mémoire (J1.3) : la conversation d'un jour passé part avec le premier message, une fois.
    if (memory && !history.some((e) => e.memoryFor === memory.date)) entry = withMemory(entry, memory.date, memory.entries);
    const next = [...history, { ...entry, id: newId(), at: hhmm() }];
    setDay(today(), next);
    run(next, entry.mode || "chat");
  };

  // Confirmation ou annulation d'une action (J2). La note du jour s'écrit ici (elle est aussi
  // dans ce composant) ; l'eau et le genou par App (`onAction`), avec l'écriture de l'écran.
  const decide = (entryId, action, ok, baseline) => {
    if (action.status !== "pending") return;
    let done = action;
    let change = null;
    if (ok) {
      const act = action.kind === "genou" && action.baseline == null ? { ...action, baseline } : action;
      if (act.kind === "note") { const n = appendNote(note, act.text); setNote(n); saveNote(n); }
      else change = onAction?.(act) ?? null;
      const label = act.kind === "genou" ? `Genou ${act.pain}/10, ${act.baseline ? "revenu à la base" : "pas revenu à la base"}` : act.label;
      done = { ...act, label, status: "done", doneText: say("actionDone") };
    } else {
      done = { ...action, status: "cancelled", doneText: say("actionCancelled") };
    }
    const result = ok ? confirmedResult(done, change) : CANCELLED_RESULT;
    setDay(today(), entries.map((e) => (e.id !== entryId ? e : {
      ...e,
      actions: e.actions.map((a) => (a.id === action.id ? done : a)),
      toolResults: { ...e.toolResults, [action.id]: result },
    })));
  };

  const sendDraft = () => {
    const t = draft.trim();
    if (!t || busy) return;
    setDraft("");
    ask(jeffreyAsk("chat", { text: t }));
  };
  const lastEntry = entries[entries.length - 1];
  const retry = () => { if (!busy && lastEntry?.role === "user") run(entries, lastEntry.mode || "chat"); };
  const lastAssistant = [...entries].reverse().find((e) => e.role === "assistant" && !e.hidden);
  const quick = !busy && lastEntry?.role === "assistant" ? lastAssistant?.quick : null;
  const spent = entries.reduce((s, e) => s + (e.meta?.cents || 0), 0);

  return (
    <Panel tone="key">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <Eyebrow style={{ color: T.c.accent }}>Jeffrey</Eyebrow>
        {spent > 0 && <span className="p-num" style={{ fontSize: 12, color: T.c.muted }}>aujourd'hui {fmtCost(spent)}</span>}
      </div>

      {entries.length === 0 && !busy && <div style={{ fontSize: 15, color: T.c.text2 }}>{sayStable("chatHello")}</div>}

      <div style={{ display: "grid", gap: 14 }}>
        {entries.map((e) => <Message key={e.id} entry={e} onStart={onStart} onDecide={decide} />)}
        {busy && (
          <div style={{ fontSize: 15, color: live.text ? T.c.text : T.c.muted, whiteSpace: "pre-wrap", lineHeight: 1.5 }} aria-live="polite">
            {live.text || sayStable("chatThinking")}
            {live.progress && <div className="p-num" style={{ fontSize: 12, color: T.c.muted, marginTop: 4 }}>{live.progress}</div>}
          </div>
        )}
        {err && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 14, color: T.c.danger, lineHeight: 1.45 }}>{sayError(err)}</div>
            {lastEntry?.role === "user" && <Button variant="outline" onClick={retry}>Réessayer</Button>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {quick?.options?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {quick.options.map((o) => (
            <Chip key={o} onClick={() => ask({ ...jeffreyAsk("chat", { text: o }), quickFor: quick.id })}>{o}</Chip>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea className="p-field" rows={2} value={draft} disabled={busy}
          placeholder={sayStable("chatPlaceholder")} aria-label="Message à Jeffrey" enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDraft(); } }}
          style={{ flex: 1, minWidth: 0, resize: "none", height: "auto", minHeight: 52, padding: "12px 14px", fontFamily: T.f.body, fontSize: 16, lineHeight: 1.4 }} />
        <IconButton label="Envoyer à Jeffrey" tone="accent" size={52} onClick={sendDraft} disabled={busy || !draft.trim()}>
          <Send size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
        <Button variant="outline" disabled={busy} onClick={() => ask(jeffreyAsk("point"))}>Faites-moi le point</Button>
        <Button variant="outline" disabled={busy} onClick={() => ask(jeffreyAsk("bilan", { bilanUser: coach.buildBilan().user }))}>Bilan 3 mois</Button>
      </div>

      <div>
        <button type="button" className="p-tap" onClick={() => setOpenNote((o) => !o)} aria-expanded={openNote}
          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minHeight: 48, padding: 0, background: "none", border: "none", fontFamily: "inherit" }}>
          {openNote ? <ChevronDown size={18} color={T.c.text2} aria-hidden="true" /> : <ChevronRight size={18} color={T.c.text2} aria-hidden="true" />}
          <span style={{ fontSize: 14, color: T.c.text2 }}>
            Note du jour{note ? <span style={{ color: T.c.accent }}> · remplie</span> : " (contexte)"}
          </span>
        </button>
        {openNote && (
          <div style={{ display: "grid", gap: 6 }}>
            <textarea className="p-field" rows={2} value={note} aria-label="Note du jour"
              placeholder="ex. alcool hier soir, insomnie, cheville qui tire…"
              onChange={(e) => setNote(e.target.value)} onBlur={() => saveNote(note)}
              style={{ resize: "vertical", height: "auto", minHeight: 52, padding: "12px 14px", fontFamily: T.f.body, fontSize: 15 }} />
            <div style={{ fontSize: 13, color: T.c.muted }}>Contexte hors chiffres (alcool, blessure, stress…), que Jeffrey prend en compte aujourd'hui.</div>
          </div>
        )}
      </div>
    </Panel>
  );
}
