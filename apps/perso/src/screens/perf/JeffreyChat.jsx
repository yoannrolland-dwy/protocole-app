// Conversation avec Jeffrey (chantier J, J1.2, 29/10/2026) — remplace la carte Coach IA en tête
// de l'onglet Analyse. Contrat et règles : packages/core/src/coach/jeffrey.js ; spec : ROADMAP.md,
// « Chantier J ». La conversation du jour vit dans `jeffreyLog` (App.jsx) : une réponse en cours
// s'y enregistre même si Monsieur change d'onglet (l'écriture passe par App, toujours montée).
import { useEffect, useRef, useState } from "react";
import { Send, ChevronRight, ChevronDown, Mic, Square, Volume2 } from "lucide-react";
import { TEMPLATES } from "@rawcare/core/session/templates";
import {
  jeffreyAsk, withMemory, appendNote, confirmedResult, CANCELLED_RESULT,
} from "@rawcare/core/coach/jeffrey";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button, IconButton, Chip } from "../../design/primitives.jsx";
import { today } from "../../ui.jsx";
import { aiMissing, fmtCost } from "../../lib/ai.js";
import { say, sayStable, sayError } from "../../lib/jeffrey.js";
import { streamTransportFor } from "../../lib/jeffreyHttp.js";
import { jeffreyTurn, newId, hhmm } from "../../lib/jeffreyTurn.js";
import { voiceAvailable, voiceReady, listen, stopListening, speak, stopSpeaking, createSpeechStream } from "../../lib/voice.js";

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
      {action.kind === "repas" && (
        <div style={{ fontSize: 13, color: T.c.text2, display: "grid", gap: 2 }}>
          {action.items.map((it, i) => <div key={i}>{it.name} · <span style={{ fontFamily: T.f.num }}>{it.q} g</span></div>)}
          {action.already > 0 && <div style={{ color: T.c.muted }}>Les {action.already} aliment{action.already > 1 ? "s" : ""} déjà noté{action.already > 1 ? "s" : ""} aujourd'hui restent.</div>}
        </div>
      )}
      {askBase &&<div style={{ fontSize: 14, color: T.c.text2 }}>Retour à la douleur de base sous 24 h ?</div>}
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

function Message({ entry, onStart, onDecide, speaking, onSpeak }) {
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
      {(entry.meta || (entry.text && voiceReady())) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {entry.meta && <span className="p-num" style={{ fontSize: 12, color: T.c.muted }}>{fmtCost(entry.meta.cents)}</span>}
          {/* Écouter un message (ou arrêter la lecture en cours). */}
          {entry.text && voiceReady() && (
            <IconButton label={speaking ? "Arrêter la lecture" : "Écouter ce message"} size={44} onClick={() => onSpeak(entry)}>
              {speaking ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

// `memory` (J1.3) : { date, entries } d'un jour passé pas encore versé au carnet, ou null ;
// `onMemoryDone(date)` quand Jeffrey a réécrit son carnet avec. `initialAsk` : demande lancée à
// l'ouverture (« point » depuis la carte du tableau de bord), une seule fois.
export function JeffreyChat({ coach, ai, entries, setDay, todayNote, saveNote, saveJournal, onStart, memory, onMemoryDone, initialAsk, onAction, foodContext }) {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(null); // { text, progress } pendant une réponse
  const [err, setErr] = useState("");
  const [note, setNote] = useState(todayNote || "");
  const [openNote, setOpenNote] = useState(false);
  // Voix (J3) : dictée en cours, message en cours de lecture.
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  // Voix indisponible (pas de réseau, serveur arrêté) : une ligne discrète, la réponse reste écrite.
  const [voiceNote, setVoiceNote] = useState("");
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
  // `onSpeech` : reçoit le texte en direct pour la voix (question dictée).
  const run = async (history, mode, onSpeech) => {
    const missing = aiMissing(ai);
    if (missing) { setErr(missing); return; }
    const date = today();
    setErr("");
    setLive({ text: "", progress: "" });
    const apply = ({ history: h, journal, memDate }) => {
      if (journal) { saveJournal(journal); if (memDate) onMemoryDone?.(memDate); }
      setDay(date, h);
    };
    try {
      const r = await jeffreyTurn({
        history, mode, coach, ai, note, foodContext, transport: streamTransportFor(ai),
        onText: (text) => { setLive((l) => ({ ...(l || {}), text })); onSpeech?.(text); },
        onRetry: (p) => setLive((l) => ({ ...(l || {}), progress: p })),
        onPass: () => setLive({ text: "", progress: "" }),
      });
      apply(r);
      return r.history;
    } catch (e) {
      console.error("Jeffrey", e);
      if (e.partial) apply(e.partial);
      setErr(e?.message || "cause inconnue");
      return null;
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
    setVoiceNote("");
    // Il répond comme on lui a parlé (décision 11) : question dictée → réponse à voix haute, dès
    // la première phrase complète, pendant que le reste s'écrit.
    if (!entry.spoken) { run(next, entry.mode || "chat"); return; }
    const voice = createSpeechStream();
    run(next, entry.mode || "chat", voice.feed).then((h) => {
      const reply = h && [...h].reverse().find((e) => e.role === "assistant" && e.text);
      if (reply) setSpeakingId(reply.id);
      return voice.finish().then((r) => {
        if (!r.ok && !r.cancelled && !r.skipped) setVoiceNote(say("voiceDown"));
        if (reply) setSpeakingId((s) => (s === reply.id ? null : s));
      });
    });
  };

  const speakEntry = (e) => {
    setSpeakingId(e.id);
    setVoiceNote("");
    speak(e.text).then((r) => {
      if (!r.ok && !r.cancelled && !r.skipped) setVoiceNote(say("voiceDown"));
    }).finally(() => setSpeakingId((s) => (s === e.id ? null : s)));
  };
  const toggleSpeak = (e) => {
    if (speakingId === e.id) { stopSpeaking(); setSpeakingId(null); } else speakEntry(e);
  };

  // Dictée (J3, choix de Yoann) : le texte s'écrit dans le champ pendant qu'il parle, puis part
  // tout seul quand il se tait. Un second tap arrête l'écoute.
  const mic = async () => {
    if (listening) { stopListening(); return; }
    if (busy) return;
    stopSpeaking();
    setSpeakingId(null);
    setErr("");
    setListening(true);
    setDraft("");
    try {
      const text = (await listen((p) => setDraft(p))).trim();
      setDraft("");
      if (text) ask({ ...jeffreyAsk("chat", { text }), spoken: true });
    } catch (e) {
      setErr(e?.message || "dictée impossible");
    } finally {
      setListening(false);
    }
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
        {entries.map((e) => <Message key={e.id} entry={e} onStart={onStart} onDecide={decide} speaking={speakingId === e.id} onSpeak={toggleSpeak} />)}
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

      {voiceNote && <div className="p-sec" role="status">{voiceNote}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea className="p-field" rows={2} value={draft} disabled={busy || listening}
          placeholder={sayStable("chatPlaceholder")} aria-label="Message à Jeffrey" enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDraft(); } }}
          style={{ flex: 1, minWidth: 0, resize: "none", height: "auto", minHeight: 52, padding: "12px 14px", fontFamily: T.f.body, fontSize: 16, lineHeight: 1.4 }} />
        {voiceAvailable() && (
          <IconButton label={listening ? "Arrêter la dictée" : "Parler à Jeffrey"} tone={listening ? "accent" : undefined} size={52} onClick={mic} disabled={busy && !listening}>
            {listening ? <Square size={18} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </IconButton>
        )}
        <IconButton label="Envoyer à Jeffrey" tone="accent" size={52} onClick={sendDraft} disabled={busy || listening || !draft.trim()}>
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
