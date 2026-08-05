// Photo d'un plat (05/08/2026) — estime les macros d'une assiette à partir d'une ou
// plusieurs photos, plus une note complémentaire facultative (ex. "riz basmati ~150g",
// "sauce à part", "sans le pain") pour corriger ce que la photo seule ne peut pas savoir.
//
// Distinct de Carte resto (qui choisit AVANT de commander, à partir d'un menu) : ici on
// logge ce qui est SERVI, chez soi comme au restaurant. Un seul plat par estimation — pas
// de suggestions ni de découpage par catégorie, juste un nom + des macros à ajouter au
// journal, comme "Saisie libre". Panneau embarqué dans FoodSearch au même niveau que les
// trois autres options.
//
// Fiabilité : le point faible connu de ce genre d'estimation est le POIDS/la portion, pas
// l'identification du plat — sans repère d'échelle dans la photo (fourchette, diamètre de
// l'assiette), l'écart peut facilement atteindre 30-50%. La note complémentaire est le
// principal levier pour corriger ça ; le system prompt lui donne priorité sur le jugé visuel.

import React, { useState, useRef } from "react";
import { ChevronLeft, Sparkles, Plus, Camera, X } from "lucide-react";
import { C, Btn, Label, Body, inputStyle } from "../ui.jsx";
import { callClaude, costCents } from "../claudeApi.js";
import { fileToImagePayload } from "@rawcare/core/nutrition/imageUtils";
import { newQuickRef } from "./foodStore.js";

const MAX_PHOTOS = 3;

function extractJson(raw) {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

const SYSTEM_PROMPT = `Tu es un nutritionniste qui estime les macros d'une assiette à partir d'une photo.
On te donne une ou plusieurs photos du même plat (éventuellement plusieurs angles) et une note
complémentaire facultative écrite par l'utilisateur (une quantité, un ingrédient à corriger ou
préciser, ce qui n'a pas été mangé). Tâche :
1. Identifie les aliments visibles sur la ou les photos et estime les quantités au jugé, à l'aide des
   repères visuels disponibles (taille de l'assiette, des couverts, comparaison avec des portions
   courantes). Le poids estimé à partir d'une seule photo est la principale source d'erreur (peut
   facilement varier de 30 à 50 %) : reste réaliste, ne détaille pas ton raisonnement.
2. Si la note complémentaire précise ou corrige une quantité ou un ingrédient, PRIORISE cette
   information sur ton estimation visuelle — l'utilisateur en sait plus que la photo.
3. Calcule kcal/prot/gluc/lip/fib (en grammes, kcal en kcal) pour l'ensemble de l'assiette.
4. Donne un nom court et concret au plat (ex. "Poulet rôti, riz, brocolis"), pas une catégorie
   générique.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, exactement
selon ce schéma :
{"lisible":boolean,"nom":string,"kcal":number,"prot":number,"gluc":number,"lip":number,"fib":number}

Si la ou les photos ne permettent pas d'identifier un plat exploitable (flou, hors-sujet, vide), mets
"lisible" à false plutôt que d'inventer — les autres champs peuvent alors être à 0/vide.`;

function buildUserText(note) {
  return note.trim()
    ? `Estime les macros de ce plat à partir de la ou des photos ci-jointes.\n\nNote complémentaire de l'utilisateur : ${note.trim()}`
    : "Estime les macros de ce plat à partir de la ou des photos ci-jointes.";
}

export default function PhotoDish({ apiKey, model, onAdd, onBack }) {
  const [photos, setPhotos] = useState([]); // [{id, dataUrl, base64, mediaType}]
  const [photoErr, setPhotoErr] = useState("");
  const fileInputRef = useRef(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { nom, kcal, prot, gluc, lip, fib }
  const [meta, setMeta] = useState(null);
  const [added, setAdded] = useState(false);

  const pickPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setPhotoErr("");
    try {
      const converted = await Promise.all(files.map((f) => fileToImagePayload(f)));
      setPhotos((prev) => [...prev, ...converted.map((p, i) => ({ id: `${Date.now()}-${i}`, ...p }))].slice(0, MAX_PHOTOS));
    } catch {
      setPhotoErr("Une photo n'a pas pu être lue — réessaie.");
    }
  };
  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const run = async () => {
    if (!apiKey) { setErr("Ajoute ta clé API Anthropic dans Réglages pour activer cette fonction."); setState("error"); return; }
    if (!photos.length) return;
    setState("loading"); setErr(""); setProgress(""); setResult(null); setMeta(null); setAdded(false);
    try {
      const user = [
        ...photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } })),
        { type: "text", text: buildUserText(note) },
      ];
      const askedModel = model || "claude-sonnet-5";
      const { data, usedModel } = await callClaude({
        apiKey, model: askedModel, system: SYSTEM_PROMPT, user,
        effort: "medium", maxTokens: 1024, onRetry: setProgress,
      });
      setProgress("");
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      let parsed;
      try { parsed = extractJson(raw); }
      catch {
        console.warn("Photo d'un plat — JSON illisible :", raw);
        setErr("Réponse illisible. Réessaie."); setState("error"); return;
      }
      if (!parsed.lisible) {
        setErr("Photo(s) illisible(s) — plat non identifié. Réessaie avec une autre photo, plus proche ou mieux éclairée.");
        setState("error");
        return;
      }
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: data.usage, cents: costCents(usedModel, data.usage) });
      setResult(parsed);
      setState("done");
    } catch (e) {
      console.error("PhotoDish", e);
      setProgress("");
      setErr(e?.message || "Erreur inconnue"); setState("error");
    }
  };

  const add = () => {
    onAdd({
      ref: newQuickRef(),
      name: `${result.nom} (estimé IA)`,
      per100: { kcal: result.kcal, prot: result.prot, gluc: result.gluc, lip: result.lip, fib: result.fib },
    }, 100);
    setAdded(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>Photo d'un plat</Label>
      </div>

      <div>
        <Label style={{ marginBottom: 5 }}>Photo de l'assiette</Label>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={pickPhotos} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={p.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: `1.5px solid ${C.border}` }} />
              <button onClick={() => removePhoto(p.id)} style={{
                position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
                background: C.danger, border: "none", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}>
                <X size={11} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button onClick={() => fileInputRef.current?.click()} style={{
              width: 72, height: 72, borderRadius: 6, border: `1.5px dashed ${C.border}`, background: "transparent",
              color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Camera size={20} />
            </button>
          )}
        </div>
        {photoErr && <Body style={{ fontSize: 10, color: C.danger, marginTop: 4 }}>{photoErr}</Body>}
      </div>

      <div>
        <Label style={{ marginBottom: 5 }}>Précision (facultatif)</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. riz basmati ~150 g, sauce à part, sans le pain…"
          rows={3}
          style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 12, fontWeight: 400, resize: "vertical", width: "100%" }}
        />
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
          Estimation IA — le poids est le plus incertain sans repère d'échelle dans la photo. La
          précision ci-dessus prime sur ce que l'IA devine.
        </Body>
      </div>

      <Btn variant="primary" onClick={run} disabled={state === "loading" || !photos.length} style={{ padding: "10px 0", fontSize: 12 }}>
        <Sparkles size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
        {state === "loading" ? (progress || "Analyse…") : "Estimer ce plat"}
      </Btn>

      {state === "error" && <Body style={{ fontSize: 11, color: C.danger }}>{err}</Body>}

      {result && (
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12.5, color: C.text, fontWeight: 800, marginBottom: 6 }}>{result.nom}</div>
          <div style={{ display: "flex", gap: 9, fontFamily: C.mono, fontSize: 10, color: C.muted, flexWrap: "wrap" }}>
            <span style={{ color: C.accent, fontWeight: 800 }}>{Math.round(result.kcal)} kcal</span>
            <span>P{Math.round(result.prot)}</span>
            <span>G{Math.round(result.gluc)}</span>
            <span>L{Math.round(result.lip)}</span>
            <span>Fib{Math.round(result.fib)}</span>
          </div>
          <Btn variant={added ? "plain" : "primary"} disabled={added} onClick={add}
            style={{ width: "100%", marginTop: 9, padding: "7px 0", fontSize: 11 }}>
            {added ? "Ajouté au journal ✓" : (<><Plus size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />Ajouter</>)}
          </Btn>
          {meta && (
            <Body style={{ fontSize: 9.5, color: C.dim, textAlign: "center", marginTop: 8 }}>
              {meta.model}{meta.fellBack ? " (bascule)" : ""} · {meta.cents.toFixed(1)}¢
            </Body>
          )}
        </div>
      )}
    </div>
  );
}
