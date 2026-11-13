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
// Carte au format carte bancaire (08/11/2026, choix de Yoann ; fidélité, vitale… pas forcément
// une carte de paiement) : posée à plat à côté de l'assiette, elle sert
// d'échelle (85,6 × 54 mm) ; elle ne dit rien de la hauteur d'un tas.
// Détail de l'estimation (13/11/2026, demande de Yoann) : sous le total, une ligne par composant
// (grammes, kcal, macros) et les hypothèses de l'IA. Consigne et lecture : dishEstimate.js. Le
// journal reçoit toujours une seule ligne « <plat> (estimé IA) ».

import React, { useState, useRef } from "react";
import { ChevronLeft, Sparkles, Plus, Camera, Image, X } from "lucide-react";
import { C, Btn, Label, Body, inputStyle } from "../design/compat.jsx";
import { callClaude } from "../claudeApi.js";
import { aiMissing, fmtCost, recordSpend } from "../lib/ai.js";
import { fileToImagePayload } from "@rawcare/core/nutrition/imageUtils";
import { newQuickRef } from "./foodStore.js";
import { say, sayError, sayStable } from "../lib/jeffrey.js";
// Consigne et lecture de la réponse : dishEstimate.js (détail de l'estimation, 13/11/2026).
import { DISH_PROMPT, buildDishUserText, extractJson, readDishEstimate } from "./dishEstimate.js";

const MAX_PHOTOS = 3;
const r0 = (n) => Math.round(n ?? 0);

export default function PhotoDish({ ai, onAdd, onBack }) {
  const [photos, setPhotos] = useState([]); // [{id, dataUrl, base64, mediaType}]
  const [photoErr, setPhotoErr] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // readDishEstimate : { nom, kcal, prot, gluc, lip, fib, detail, explication }
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
      setPhotoErr(say("photoUnread"));
    }
  };
  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const run = async () => {
    const missing = aiMissing(ai);
    if (missing) { setErr(missing); setState("error"); return; }
    if (!photos.length) return;
    setState("loading"); setErr(""); setProgress(""); setResult(null); setMeta(null); setAdded(false);
    try {
      const user = [
        ...photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } })),
        { type: "text", text: buildDishUserText(note) },
      ];
      const askedModel = ai.model || "claude-sonnet-5";
      const { data, usedModel, cents } = await callClaude({
        provider: ai.provider, baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: askedModel, system: DISH_PROMPT, user,
        // 1024 → 16000 (26/10/2026) : avec Opus 5.5 la réflexion toujours active aurait coupé le JSON.
        effort: "medium", maxTokens: 16000, onRetry: setProgress,
      });
      setProgress("");
      // Compté dès que la réponse est là : une réponse illisible ou « plat non reconnu » a été payée
      // aussi, et manquait à « Dépensé ce mois-ci » (audit du 10/11/2026, point 15).
      recordSpend(cents);
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      let parsed;
      try { parsed = extractJson(raw); }
      catch {
        console.warn("Photo d'un plat — JSON illisible :", raw);
        setErr(say("aiUnreadable")); setState("error"); return;
      }
      const estimate = readDishEstimate(parsed);
      if (!estimate) {
        setErr(say("photoUnknown"));
        setState("error");
        return;
      }
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: data.usage, cents });
      setResult(estimate);
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
        <button type="button" className="p-tap" onClick={onBack} aria-label="Retour" style={{ background: "none", border: "none", color: C.accent, width: 44, height: 44, display: "grid", placeItems: "center", padding: 0, flexShrink: 0 }}>
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <Label style={{ fontSize: 13 }}>Photo d'un plat</Label>
      </div>

      <div>
        <Label style={{ marginBottom: 5 }}>Photo de l'assiette</Label>
        {/* Deux inputs distincts (01/09/2026) : `multiple` sur l'input galerie fait
            disparaître l'option caméra du sélecteur système sur beaucoup d'appareils Android
            — l'input caméra dédié, avec `capture`, force l'appareil photo directement, un
            cliché à la fois (cohérent : la prise de vue n'a jamais de sens en multiple). */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={pickPhotos} style={{ display: "none" }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={pickPhotos} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={p.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: `1.5px solid ${C.border}` }} />
              {/* Zone de toucher 44 px (U3 après U4), rond visible de 24 px dans le coin de la vignette. */}
              <button type="button" className="p-tap" onClick={() => removePhoto(p.id)} aria-label="Retirer cette photo" style={{
                position: "absolute", top: -14, right: -14, width: 44, height: 44, background: "transparent", border: "none",
                display: "grid", placeItems: "center", padding: 0, cursor: "pointer",
              }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: C.danger, color: "#fff", display: "grid", placeItems: "center" }}>
                  <X size={14} aria-hidden="true" />
                </span>
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 6, border: `1.5px dashed ${C.border}`, background: "transparent",
                color: C.muted, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                <Image size={18} />
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Galerie</span>
              </button>
              <button onClick={() => cameraInputRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 6, border: `1.5px dashed ${C.border}`, background: "transparent",
                color: C.muted, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                <Camera size={18} />
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Photo</span>
              </button>
            </>
          )}
        </div>
        {photoErr && <Body style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>{photoErr}</Body>}
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
        <Body style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
          Estimation IA — le poids est le plus incertain. Posez une carte au format carte bancaire
          (fidélité, vitale…) à plat à côté de l'assiette et prenez la photo de dessus : elle sert
          d'échelle. La précision ci-dessus
          prime sur ce que l'IA devine.
        </Body>
      </div>

      <Btn variant="primary" onClick={run} disabled={state === "loading" || !photos.length} style={{ padding: "10px 0", fontSize: 12 }}>
        <Sparkles size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
        {state === "loading" ? (progress || "Analyse…") : "Estimer ce plat"}
      </Btn>

      {state === "error" && <Body style={{ fontSize: 13, color: C.danger }}>{sayError(err)}</Body>}

      {result && (
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 800, marginBottom: 6 }}>{result.nom}</div>
          <div style={{ display: "flex", gap: 9, fontFamily: C.mono, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
            <span style={{ color: C.accent, fontWeight: 800 }}>{Math.round(result.kcal)} kcal</span>
            <span>P{Math.round(result.prot)}</span>
            <span>G{Math.round(result.gluc)}</span>
            <span>L{Math.round(result.lip)}</span>
            <span>Fib{Math.round(result.fib)}</span>
          </div>
          {/* Détail de l'estimation (13/11/2026) : une ligne par composant, puis les hypothèses de l'IA.
              Affiché avant « Ajouter », pour le lire avant de valider. */}
          {(result.detail.length > 0 || result.explication) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <Label style={{ marginBottom: 6 }}>Détail de l'estimation</Label>
              {result.detail.length > 0 && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                  {result.detail.map((l, i) => (
                    <li key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, color: C.text, overflowWrap: "anywhere" }}>
                        {l.aliment}
                        {l.grammes !== null && <span style={{ fontFamily: C.mono, color: C.muted }}> · {r0(l.grammes)} g</span>}
                      </span>
                      <span style={{ fontFamily: C.mono, fontSize: 13, color: C.text, fontWeight: 700, whiteSpace: "nowrap" }}>{r0(l.kcal)} kcal</span>
                      <span style={{ gridColumn: "1 / -1", fontFamily: C.mono, fontSize: 12, color: C.muted }}>
                        P{l.prot === null ? "—" : r0(l.prot)} G{l.gluc === null ? "—" : r0(l.gluc)} L{l.lip === null ? "—" : r0(l.lip)} Fib{l.fib === null ? "—" : r0(l.fib)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {result.explication && (
                <Body style={{ fontSize: 13, color: C.muted, marginTop: result.detail.length ? 10 : 0, lineHeight: 1.45 }}>{result.explication}</Body>
              )}
            </div>
          )}
          <Btn variant={added ? "plain" : "primary"} disabled={added} onClick={add}
            style={{ width: "100%", marginTop: 9, padding: "7px 0", fontSize: 13 }}>
            {added ? "Ajouté au journal ✓" : (<><Plus size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />Ajouter</>)}
          </Btn>
          {meta && (
            <Body style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 8 }}>
              {meta.model}{meta.fellBack ? " (bascule)" : ""} · {fmtCost(meta.cents)}
            </Body>
          )}
        </div>
      )}
    </div>
  );
}
