// Carte resto (05/08/2026) — extrapole une carte de restaurant (texte collé/tapé) en
// plats estimés (macros au jugé, PAS mesurées) puis propose 2-3 combinaisons entrée+plat
// ou entrée+entrée adaptées à l'objectif « peu de calories, riche en protéines », plus les
// desserts de la carte. Utilise l'API Claude déjà branchée pour le Coach IA (même clé,
// même module d'appel `callClaude`), avec un système de prompt dédié demandant du JSON
// strict pour pouvoir afficher et logger chaque plat individuellement.
//
// Volontairement un module séparé de la recherche CIQUAL/OFF : ici on ESTIME (aucun plat
// de carte n'existe dans une base), alors que le reste du journal MESURE. Le marquage
// "(estimé IA)" sur le nom de chaque entrée loggée le rend visible dans le journal, jamais
// silencieux — même esprit que le `*` des corrections V6.
//
// Panneau EMBARQUÉ dans FoodSearch (même registre que FreeEntry/RecipeBuilder : chevron
// retour + Label, pas de fenêtre propre) — accessible depuis "+Ajouter" au même niveau que
// "Saisie libre"/"Nouvelle recette" (demandé le 05/08/2026, pas un bouton direct dans
// l'onglet Repas comme la toute première version). Le repas de destination est donc déjà
// connu (celui pour lequel "+Ajouter" a été ouvert) : pas de sélecteur de repas ici.

import React, { useState, useRef } from "react";
import { ChevronLeft, Sparkles, Plus, Check, Camera, X } from "lucide-react";
import { C, Btn, Label, Body, inputStyle } from "../ui.jsx";
import { callClaude, costCents } from "../claudeApi.js";

function extractJson(raw) {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// Jusqu'à 4 photos (une carte a souvent plusieurs pages/faces). Redimensionnées côté client
// (1600px de long, JPEG ~82%) avant envoi : une photo de téléphone brute pèse plusieurs Mo,
// inutile en tokens et en temps de requête pour lire du texte sur une carte.
const MAX_PHOTOS = 4;

function fileToImagePayload(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale) || 1;
        const h = Math.round(img.height * scale) || 1;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl: jpeg, base64: jpeg.split(",")[1], mediaType: "image/jpeg" });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const SYSTEM_PROMPT = `Tu es un nutritionniste qui aide à choisir un repas au restaurant à partir d'une carte.
On te donne la carte (en texte et/ou en photo) et les macros qu'il reste à l'utilisateur à consommer
ce jour-là. Tâche :
1. Extrait chaque plat identifiable de la carte (nom repris tel quel ou reformulé brièvement s'il est
   ambigu, lu sur la ou les photos si fournies), catégorie parmi "entree"/"plat"/"dessert"/"autre", et
   ESTIME ses macros (kcal, prot, gluc, lip, fib en grammes) à partir de sa composition et de portions
   restaurant françaises courantes. Ce sont des estimations, pas des valeurs mesurées : reste
   réaliste, ne détaille pas ton raisonnement.
2. Propose 2 à 3 combinaisons adaptées à l'objectif "peu de calories, riche en protéines", chacune
   composée de EXACTEMENT deux plats de la carte : soit une entrée + un plat, soit une entrée + une
   autre entrée (jamais un plat seul, jamais dessert dans une combinaison). Les noms dans
   suggestions[].plats doivent être copiés EXACTEMENT depuis plats[].nom.
3. N'invente aucun plat absent de la carte. Si la carte est illisible (photo floue, texte vide),
   renvoie des tableaux vides plutôt que d'inventer.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, exactement
selon ce schéma :
{"plats":[{"nom":string,"categorie":"entree"|"plat"|"dessert"|"autre","kcal":number,"prot":number,"gluc":number,"lip":number,"fib":number}],
"suggestions":[{"titre":string,"plats":[string,string],"kcal":number,"prot":number,"gluc":number,"lip":number,"fib":number,"pourquoi":string}]}`;

function buildUserText(menuText, remaining, hasPhotos) {
  const header = `RESTE À CONSOMMER CE JOUR-LÀ : ${Math.round(remaining.kcal)} kcal, ${Math.round(remaining.prot)} g protéines, ${Math.round(remaining.gluc)} g glucides, ${Math.round(remaining.lip)} g lipides, ${Math.round(remaining.fib)} g fibres.`;
  if (hasPhotos) {
    return `${header}\n\nLis la carte du restaurant sur la ou les photos ci-jointes.${menuText.trim() ? `\n\nNote complémentaire : ${menuText.trim()}` : ""}`;
  }
  return `${header}\n\nCARTE DU RESTAURANT :\n${menuText.trim()}`;
}

function MacroLine({ kcal, prot, gluc, lip, fib }) {
  return (
    <div style={{ display: "flex", gap: 9, fontFamily: C.mono, fontSize: 10, color: C.muted, flexWrap: "wrap" }}>
      <span style={{ color: C.accent, fontWeight: 800 }}>{Math.round(kcal)} kcal</span>
      <span>P{Math.round(prot)}</span>
      <span>G{Math.round(gluc)}</span>
      <span>L{Math.round(lip)}</span>
      <span>Fib{Math.round(fib)}</span>
    </div>
  );
}

function DishRow({ dish, onLog, logged }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{dish.nom}</div>
        <MacroLine {...dish} />
      </div>
      <button onClick={() => onLog(dish)} disabled={logged} style={{
        background: logged ? "transparent" : C.card, border: `1.5px solid ${logged ? C.accent : C.border}`,
        borderRadius: 6, padding: "6px 8px", cursor: logged ? "default" : "pointer",
        color: logged ? C.accent : C.muted, display: "flex", alignItems: "center",
      }}>
        {logged ? <Check size={13} /> : <Plus size={13} />}
      </button>
    </div>
  );
}

function SuggestionCard({ s, dishesByName, onLog, logged }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 800, marginBottom: 2 }}>{s.titre}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 6 }}>{s.plats.join(" + ")}</div>
      <MacroLine {...s} />
      {s.pourquoi && <Body style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>{s.pourquoi}</Body>}
      <Btn variant={logged ? "plain" : "primary"} disabled={logged} onClick={() => onLog(s)}
        style={{ width: "100%", marginTop: 9, padding: "7px 0", fontSize: 11 }}>
        {logged ? "Ajouté au journal ✓" : "Logger cette suggestion"}
      </Btn>
    </div>
  );
}

const CAT_LABEL = { entree: "Entrées", plat: "Plats", dessert: "Desserts", autre: "Autres" };
const CAT_ORDER = ["entree", "plat", "dessert", "autre"];

export default function RestaurantMenu({ apiKey, model, remaining, meal, onLogDishes, onBack }) {
  const [menuText, setMenuText] = useState("");
  const [photos, setPhotos] = useState([]); // [{id, dataUrl, base64, mediaType}]
  const [photoErr, setPhotoErr] = useState("");
  const fileInputRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { plats, suggestions }
  const [meta, setMeta] = useState(null);
  const [loggedKeys, setLoggedKeys] = useState(() => new Set());

  const pickPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
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

  const hasInput = menuText.trim().length > 0 || photos.length > 0;

  const run = async () => {
    if (!apiKey) { setErr("Ajoute ta clé API Anthropic dans Réglages pour activer cette fonction."); setState("error"); return; }
    if (!hasInput) return;
    setState("loading"); setErr(""); setProgress(""); setResult(null); setMeta(null); setLoggedKeys(new Set());
    try {
      const hasPhotos = photos.length > 0;
      const text = buildUserText(menuText, remaining, hasPhotos);
      const user = hasPhotos
        ? [...photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } })),
           { type: "text", text }]
        : text;
      const askedModel = model || "claude-sonnet-5";
      const { data, usedModel } = await callClaude({
        apiKey, model: askedModel, system: SYSTEM_PROMPT, user,
        effort: "medium", maxTokens: 3000, onRetry: setProgress,
      });
      setProgress("");
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      let parsed;
      try { parsed = extractJson(raw); }
      catch {
        console.warn("Carte resto — JSON illisible :", raw);
        setErr("Réponse illisible. Réessaie, ou simplifie le texte/la photo.");
        setState("error");
        return;
      }
      setMeta({ model: usedModel, fellBack: usedModel !== askedModel, usage: data.usage, cents: costCents(usedModel, data.usage) });
      setResult({ plats: parsed.plats || [], suggestions: parsed.suggestions || [] });
      setState("done");
    } catch (e) {
      console.error("RestaurantMenu", e);
      setProgress("");
      setErr(e?.message || "Erreur inconnue"); setState("error");
    }
  };

  const dishesByName = new Map((result?.plats || []).map((d) => [d.nom, d]));

  const logDish = (dish, key) => {
    onLogDishes([{ name: dish.nom, macros: dish, meal }]);
    setLoggedKeys((prev) => new Set(prev).add(key));
  };

  // Un seul appel à onLogDishes (jamais un par plat) : les deux plats d'une suggestion
  // doivent être ajoutés dans le même batch, sinon le second écraserait le premier côté
  // journal (fermeture React périmée sur des appels food.add successifs — bug trouvé et
  // corrigé le 05/08/2026, food.addMany est le seul chemin sûr pour un ajout multiple).
  const logSuggestion = (s) => {
    const key = `sugg:${s.titre}`;
    const items = s.plats.map((nom) => dishesByName.get(nom)).filter(Boolean)
      .map((d) => ({ name: d.nom, macros: d, meal }));
    onLogDishes(items);
    setLoggedKeys((prev) => new Set(prev).add(key));
  };

  const grouped = CAT_ORDER
    .map((cat) => ({ cat, items: (result?.plats || []).filter((d) => (d.categorie || "autre") === cat) }))
    .filter((g) => g.items.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>Carte resto</Label>
      </div>

      <div>
        <Label style={{ marginBottom: 5 }}>Carte du restaurant</Label>
        <textarea
          value={menuText}
          onChange={(e) => setMenuText(e.target.value)}
          placeholder={photos.length ? "Note complémentaire (facultatif)…" : "Colle ou tape le menu : entrées, plats, desserts…\nEx. Tartare de saumon, avocat, agrumes — 14€\nPoulet fermier rôti, légumes de saison — 19€\n…"}
          rows={photos.length ? 3 : 7}
          style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 12, fontWeight: 400, resize: "vertical", width: "100%" }}
        />

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={pickPhotos} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative", width: 56, height: 56 }}>
              <img src={p.dataUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1.5px solid ${C.border}` }} />
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
              width: 56, height: 56, borderRadius: 6, border: `1.5px dashed ${C.border}`, background: "transparent",
              color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Camera size={18} />
            </button>
          )}
        </div>

        {photoErr && <Body style={{ fontSize: 10, color: C.danger, marginTop: 4 }}>{photoErr}</Body>}
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
          Estimations IA, pas des valeurs mesurées — utile pour choisir, pas une pesée.
        </Body>
      </div>

      <Btn variant="primary" onClick={run} disabled={state === "loading" || !hasInput} style={{ padding: "10px 0", fontSize: 12 }}>
        <Sparkles size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
        {state === "loading" ? (progress || "Analyse…") : "Analyser la carte"}
      </Btn>

        {state === "error" && <Body style={{ fontSize: 11, color: C.danger }}>{err}</Body>}

        {result && (
          <>
            {result.suggestions.length > 0 && (
              <div>
                <Label style={{ marginBottom: 6 }}>Suggestions</Label>
                {result.suggestions.map((s, i) => (
                  <SuggestionCard key={i} s={s} dishesByName={dishesByName}
                    onLog={logSuggestion} logged={loggedKeys.has(`sugg:${s.titre}`)} />
                ))}
              </div>
            )}

            {grouped.map(({ cat, items }) => (
              <div key={cat}>
                <Label style={{ marginBottom: 4 }}>{CAT_LABEL[cat]}</Label>
                {items.map((d, i) => {
                  const key = `dish:${cat}:${i}:${d.nom}`;
                  return <DishRow key={key} dish={d} onLog={(dish) => logDish(dish, key)} logged={loggedKeys.has(key)} />;
                })}
              </div>
            ))}

            {result.plats.length === 0 && (
              <Body style={{ fontSize: 11, color: C.dim }}>Aucun plat reconnu.</Body>
            )}

            {meta && (
              <Body style={{ fontSize: 9.5, color: C.dim, textAlign: "center" }}>
                {meta.model}{meta.fellBack ? " (bascule)" : ""} · {meta.cents.toFixed(1)}¢
              </Body>
            )}
          </>
        )}
    </div>
  );
}
