// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { Sparkles, ChevronRight, ChevronDown } from "lucide-react";
import { splitCarnet } from "@rawcare/core/coach/prompt";
import { C, Card, Label, Body, Btn, inputStyle } from "../../design/compat.jsx";
import { callClaude } from "../../claudeApi.js";
import { aiMissing, fmtCost } from "../../lib/ai.js";

/* ============================================================
   COACH IA
   ============================================================ */
/* ------------------------------------------------------------
   Coach IA — appel API : tarifs, reprise sur saturation, coût réel
   ------------------------------------------------------------ */


export function CoachIA({ coach, todayNote, saveNote, saveJournal }) {
  const [state, setState] = useState("idle");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState(todayNote || "");
  const [openNote, setOpenNote] = useState(false);
  const [progress, setProgress] = useState("");   // « réessai 1/2… », « bascule Haiku… »
  const [meta, setMeta] = useState(null);         // { model, usage, cents } de la dernière analyse
  // Point 4 du chantier IA (07/09/2026) : quel type de dernière analyse est affiché — "jour"
  // (habituelle, 14j + carnet de bord) ou "bilan" (approfondie, 90j, pas de carnet).
  const [kind, setKind] = useState("jour");

  const run = async (which = "jour") => {
    const missing = aiMissing(coach.ai);
    if (missing) {
      setErr(missing);
      setState("error"); return;
    }
    if (which === "jour") saveNote(note);
    setState("loading"); setErr(""); setProgress(""); setMeta(null); setKind(which);
    try {
      const { system, user } = which === "bilan" ? coach.buildBilan() : coach.buildPrompt(note);
      const askedModel = coach.ai.model || "claude-sonnet-5-5";
      const { data, usedModel, cents } = await callClaude({
        provider: coach.ai.provider,
        baseUrl: coach.ai.baseUrl,
        apiKey: coach.ai.apiKey,
        model: askedModel,
        system,
        user,
        // « medium » plutôt que le défaut « high » : Sonnet 5 active la réflexion adaptative
        // dès qu'on ne précise rien, et cette réflexion est facturée au tarif de sortie tout
        // en consommant max_tokens — c'est la cause des réponses vides/tronquées observées
        // (budget monté 1000 → 1800 → 4096 → 6000). À « medium » la qualité reste au niveau
        // de Sonnet 4.6 en « high » pour une fraction du coût. Le bilan (moins de données en
        // entrée, mais 600 mots demandés au lieu de 500) garde une marge un peu plus large.
        effort: "medium",
        // 16000 (26/10/2026, passage à Opus 5.5) : sa réflexion, toujours active, consomme ce même
        // budget avant le texte visible. Simple plafond : seuls les tokens produits sont facturés.
        maxTokens: 16000,
        onRetry: setProgress,
      });
      setProgress("");
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      // Le bilan n'a pas de carnet de bord (ce n'est pas l'analyse quotidienne, voir
      // buildBilanPrompt) : `splitCarnet` ne s'applique qu'à "jour".
      let out = raw, journal = null;
      if (which === "jour") ({ advice: out, journal } = splitCarnet(raw));
      if (journal) saveJournal(journal);
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: data.usage, cents, carnet: !!journal });
      if (!out) {
        console.warn("CoachIA — réponse vide, réponse brute :", data);
        const hasThinking = (data.content || []).some((b) => b.type === "thinking" || b.type === "redacted_thinking");
        setErr(
          data.stop_reason === "max_tokens"
            ? (hasThinking
                ? "Le modèle a épuisé son budget en réflexion interne avant de répondre. Réessaie (limite déjà augmentée) ; si ça persiste, signale-le-moi."
                : "Réponse coupée avant la fin (budget de tokens atteint). Réessaie.")
            : `Réponse vide (stop_reason: ${data.stop_reason || "inconnu"}). Signale ce message pour diagnostic.`
        );
        setState("error");
        return;
      }
      setText(out); setState("done");
    } catch (e) {
      console.error("CoachIA", e);
      setProgress("");
      setErr(e?.message || "Erreur inconnue"); setState("error");
    }
  };

  const ta = { ...inputStyle(false), fontFamily: "inherit", fontSize: 12, fontWeight: 400, resize: "vertical" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} color={C.accent} />
          <Label style={{ fontSize: 12 }}>Coach IA</Label>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="outline" onClick={() => run("jour")} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 13 }}>
            {state === "loading" && kind === "jour" ? "Analyse…" : "Analyser"}
          </Btn>
          <Btn variant="outline" onClick={() => run("bilan")} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 13 }}>
            {state === "loading" && kind === "bilan" ? "Analyse…" : "Bilan 3 mois"}
          </Btn>
        </div>
      </div>

      {state === "loading" && progress && (
        <Body style={{ fontSize: 13, color: C.muted, fontFamily: C.mono, marginBottom: 6 }}>{progress}</Body>
      )}

      <button type="button" className="p-tap" onClick={() => setOpenNote((o) => !o)} aria-expanded={openNote} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minHeight: 48, padding: 0, background: "none", border: "none", fontFamily: "inherit", marginBottom: openNote ? 8 : 0 }}>
        {openNote ? <ChevronDown size={18} color={C.text2} aria-hidden="true" /> : <ChevronRight size={18} color={C.text2} aria-hidden="true" />}
        <span style={{ fontSize: 14, color: C.text2 }}>
          Note du jour{note ? <span style={{ color: C.accent }}> · remplie</span> : " (contexte)"}
        </span>
      </button>
      {openNote && (
        <div style={{ marginBottom: 10 }}>
          <textarea rows={2} value={note} placeholder="ex. j'ai bu de l'alcool hier soir, insomnie de 2h, cheville qui tire…"
            onChange={(e) => setNote(e.target.value)} onBlur={() => saveNote(note)} style={ta} />
          <Body style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
            Contexte hors données chiffrées (alcool, blessure, stress…), pris en compte dans l'analyse d'aujourd'hui.
          </Body>
        </div>
      )}

      {state === "error" && (
        <div style={{ fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
          {/rate limit|429/i.test(err)
            ? <>Limite de débit atteinte. Attends ~1 min puis <button onClick={run} style={{ background: "none", border: "none", color: C.danger, textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>réessaie</button>.</>
            : <>{err}</>}
        </div>
      )}
      {state === "done" && kind === "bilan" && <Label style={{ marginBottom: 6 }}>Bilan — 90 derniers jours</Label>}
      {state === "done" && <Body style={{ whiteSpace: "pre-wrap" }}>{text}</Body>}
      {state === "done" && meta?.usage && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
            {(meta.usage.input_tokens ?? 0).toLocaleString("fr-FR")} tok entrée · {(meta.usage.output_tokens ?? 0).toLocaleString("fr-FR")} tok sortie
            {meta.fellBack && <span style={{ color: C.accent }}> · {meta.model}</span>}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.accent, fontWeight: 700 }}>
            {fmtCost(meta.cents)}
          </span>
        </div>
      )}
      {state === "idle" && <Body style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>« Analyser » : tes 14 derniers jours (poids, macros, eau, séances, sommeil, douleur genou), au jour le jour et sur la semaine glissante. « Bilan 3 mois » : corrélations calculées sur 90 jours (records, sommeil vs énergie, escalade vs genou, fibres vs stagnation, sèche). Nécessite ta clé API (Réglages).</Body>}
    </Card>
  );
}
