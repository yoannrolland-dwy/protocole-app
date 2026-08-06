import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { callClaude, costCents } from "@rawcare/core/coach/claudeApi";
import { buildCoachPrompt, buildCoachBriefing, splitCarnet } from "@rawcare/core/coach/prompt";
import { buildZones } from "@rawcare/core/pain";
import { SCHEMES } from "@rawcare/core/climbing";
import { DEFAULT_TARGETS } from "@rawcare/core/targets";
import { today, byDate } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body, Btn, Field, inputStyle } from "./ui.jsx";

// Coach IA — RawCare, chantier Coach IA public (06/08/2026). Port de CoachIA
// (apps/perso/src/App.jsx:175-291) : toute la logique (prompt, appel API, coût, reprise sur
// erreur) vient de @rawcare/core/coach/, déjà généralisée aux zones de douleur dynamiques
// (voir packages/core/src/coach/prompt.js) pour ne jamais affirmer à tort qu'un
// bêta-testeur a une tendinopathie qu'il n'a pas suivie.
//
// Différences avec apps/perso, assumées :
// - Assemblage du "sac de données" synchrone depuis `data` (Supabase a déjà tout chargé en
//   mémoire) — pas de `getSync` comme côté localStorage.
// - `coachProfile` (data.coachProfile) éditable directement dans cette carte ("Profil /
//   objectifs"), pas dans un écran Réglages séparé (apps/public n'en a pas — décision déjà
//   actée au chantier onboarding). Vide par défaut, jamais amorcé avec `SEED_COACH_PROFILE`
//   (texte spécifique à la sèche de Yoann, inapplicable à un inconnu).
// - Disclaimer visible en permanence sous le bouton Analyser, pas seulement à l'état idle.
export default function CoachIA({ data, update, error: loadError }) {
  const apiKey = data?.apiKey || "";
  const model = data?.model || "claude-sonnet-5";

  const [state, setState] = useState("idle");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState(() => (data?.noteLog || []).find((n) => n.date === today())?.text || "");
  const [openNote, setOpenNote] = useState(false);
  const [profile, setProfile] = useState(data?.coachProfile || "");
  const [openProfile, setOpenProfile] = useState(false);
  const [progress, setProgress] = useState("");
  const [meta, setMeta] = useState(null);
  const [saveErr, setSaveErr] = useState("");

  const saveNote = async (t) => {
    const txt = (t || "").trim();
    const noteLog = data?.noteLog || [];
    const rest = noteLog.filter((n) => n.date !== today());
    const next = txt ? [...rest, { date: today(), text: txt }].sort(byDate) : rest;
    try { await update({ noteLog: next }); } catch (e) { setSaveErr(String(e.message || e)); }
  };
  const saveProfile = async (t) => {
    try { await update({ coachProfile: (t || "").trim() }); } catch (e) { setSaveErr(String(e.message || e)); }
  };
  const saveJournal = async (t) => {
    try { await update({ coachJournal: (t || "").trim() }); } catch (e) { setSaveErr(String(e.message || e)); }
  };

  // Sac de données pour @rawcare/core/coach/prompt — `zones`/`painLogs`/`identity` sont ce
  // qui rend le prompt correct pour un utilisateur quelconque plutôt que pour Yoann (voir
  // packages/core/src/coach/prompt.js).
  const bag = (n) => {
    const activeSports = data?.activeSports || [];
    const zones = buildZones(data?.painZones || [], data?.painLogs || {}, today());
    const identity = activeSports.length
      ? `de cet utilisateur, athlète (${activeSports.join(", ")})`
      : "de cet utilisateur";
    return {
      weight: data?.weightLog || [], sleep: data?.sleepLog || [], training: data?.trainingLog || [],
      macros: data?.macroLog || [], notes: data?.noteLog || [], steps: data?.stepsLog || [],
      targets: { ...DEFAULT_TARGETS, ...(data?.targets || {}) }, phase: data?.phase || "seche",
      foodLog: data?.foodLog || [], foodOverrides: data?.foodOverrides || {},
      profile: data?.coachProfile || "", journal: data?.coachJournal || "",
      scheme: SCHEMES[data?.climbScheme] || SCHEMES.gym,
      zones, painLogs: data?.painLogs || {}, identity,
    };
  };

  const run = async () => {
    if (!apiKey) {
      setErr("Ajoute ta clé API Anthropic depuis « Préférences » pour activer l'analyse.");
      setState("error"); return;
    }
    await saveNote(note);
    setState("loading"); setErr(""); setProgress(""); setMeta(null);
    try {
      const { system, user } = buildCoachPrompt(bag(), note);
      const askedModel = model || "claude-sonnet-5";
      const { data: resData, usedModel } = await callClaude({
        apiKey, model: askedModel, system, user,
        effort: "medium", maxTokens: 6000, onRetry: setProgress,
      });
      setProgress("");
      const raw = (resData.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      const { advice, journal } = splitCarnet(raw);
      if (journal) await saveJournal(journal);
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: resData.usage, cents: costCents(usedModel, resData.usage), carnet: !!journal });
      if (!advice) {
        console.warn("CoachIA — réponse vide, réponse brute :", resData);
        const hasThinking = (resData.content || []).some((b) => b.type === "thinking" || b.type === "redacted_thinking");
        setErr(
          resData.stop_reason === "max_tokens"
            ? (hasThinking
                ? "Le modèle a épuisé son budget en réflexion interne avant de répondre. Réessaie ; si ça persiste, signale-le."
                : "Réponse coupée avant la fin (budget de tokens atteint). Réessaie.")
            : `Réponse vide (stop_reason: ${resData.stop_reason || "inconnu"}).`
        );
        setState("error");
        return;
      }
      setText(advice); setState("done");
    } catch (e) {
      console.error("CoachIA", e);
      setProgress("");
      setErr(e?.message || "Erreur inconnue"); setState("error");
    }
  };

  const copyBriefing = async () => {
    const txt = buildCoachBriefing(bag());
    try {
      await navigator.clipboard.writeText(txt);
      setErr(""); setMeta((m) => ({ ...m, briefingCopied: true }));
    } catch {
      setText(txt); setState("done");
    }
  };

  const ta = { ...inputStyle(false), fontFamily: "inherit", fontSize: 12, fontWeight: 400, resize: "vertical" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} color={C.accent} />
          <Label style={{ fontSize: 10 }}>Coach IA</Label>
        </div>
        <Btn variant="outline" onClick={run} disabled={state === "loading"} style={{ padding: "6px 10px", fontSize: 11 }}>
          {state === "loading" ? "Analyse…" : "Analyser"}
        </Btn>
      </div>

      {state === "loading" && progress && (
        <Body style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono, marginBottom: 6 }}>{progress}</Body>
      )}

      <div onClick={() => setOpenNote((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", marginBottom: openNote ? 8 : 0 }}>
        {openNote ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
        <span style={{ fontSize: 11, color: C.muted }}>
          Note du jour{note ? <span style={{ color: C.accent }}> · remplie</span> : " (contexte)"}
        </span>
      </div>
      {openNote && (
        <div style={{ marginBottom: 10 }}>
          <textarea rows={2} value={note} placeholder="ex. courbatures, insomnie, petite douleur…"
            onChange={(e) => setNote(e.target.value)} onBlur={() => saveNote(note)} style={ta} />
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
            Contexte hors données chiffrées, pris en compte dans l'analyse d'aujourd'hui.
          </Body>
        </div>
      )}

      <div onClick={() => setOpenProfile((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", marginBottom: openProfile ? 8 : 0 }}>
        {openProfile ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
        <span style={{ fontSize: 11, color: C.muted }}>
          Profil / objectifs{profile ? <span style={{ color: C.accent }}> · rempli</span> : " (optionnel)"}
        </span>
      </div>
      {openProfile && (
        <div style={{ marginBottom: 10 }}>
          <Field label="Objectif en cours, contraintes permanentes…">
            <textarea rows={3} value={profile} placeholder="ex. objectif de prise de masse d'ici décembre, pas de squat lourd (genou)…"
              onChange={(e) => setProfile(e.target.value)} onBlur={() => saveProfile(profile)} style={ta} />
          </Field>
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
            Traité comme des contraintes par le coach, pas des suggestions. Modifiable à tout moment.
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
      {state === "done" && <Body style={{ whiteSpace: "pre-wrap" }}>{text}</Body>}
      {state === "done" && meta?.usage && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>
            {(meta.usage.input_tokens ?? 0).toLocaleString("fr-FR")} tok entrée · {(meta.usage.output_tokens ?? 0).toLocaleString("fr-FR")} tok sortie
            {meta.fellBack && <span style={{ color: C.accent }}> · {meta.model}</span>}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent, fontWeight: 700 }}>
            ≈ {meta.cents < 1 ? meta.cents.toFixed(2) : meta.cents.toFixed(1)} ¢
          </span>
        </div>
      )}
      {state === "idle" && (
        <Body style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
          Analyse tes 14 derniers jours (poids, macros, eau, séances, sommeil, douleurs suivies), au jour le
          jour et sur la semaine glissante. Nécessite ta clé API (Préférences).
        </Body>
      )}

      <Btn variant="ghost" onClick={copyBriefing} style={{ width: "100%", marginTop: 10, padding: "6px 0", fontSize: 10.5 }}>
        Copier le contexte pour claude.ai{meta?.briefingCopied ? " · copié" : ""}
      </Btn>

      {/* Disclaimer permanent (pas seulement à l'état idle, contrairement à apps/perso) :
          un utilisateur inconnu de Yoann, sans kiné dans la boucle, doit toujours le voir. */}
      <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 10, textAlign: "center" }}>
        Le Coach IA ne remplace pas un avis médical ou un kinésithérapeute.
      </Body>

      {saveErr && <p style={{ color: C.danger, fontSize: 11, marginTop: 8 }}>{saveErr}</p>}
      {loadError && <p style={{ color: C.danger, fontSize: 11, marginTop: 8 }}>{loadError}</p>}
    </Card>
  );
}
