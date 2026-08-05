// Écran de recherche et d'ajout d'un aliment (feuille plein écran).
//
// Deux temps : on choisit un aliment, puis on règle la quantité. Séparer les deux évite
// la liste de résultats encombrée de champs de saisie, et laisse la place à un aperçu
// des macros réelles avant de valider.
//
// CIQUAL tourne à chaque caractère (0,24 ms mesuré) et reste toujours en tête. Open Food
// Facts (M2, produits de marque à code-barres) est sous un séparateur en dessous,
// déclenché seulement 700 ms après la dernière frappe — son quota de recherche texte est
// étroit (~10 req/min, une deuxième requête à moins de 5 s de la première renvoie déjà
// une 503, vérifié le 01/08/2026), une recherche à la volée le ferait sauter en quelques
// secondes d'utilisation normale.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, ChevronLeft, Star, PencilLine, Trash2, ScanBarcode, ChefHat, Plus } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { C, Btn, Label, Body, Empty, Stepper, TextInput, inputStyle } from "../ui.jsx";
import { searchCiqual, normalize } from "./ciqual.js";
import { searchOFF, getOFFByBarcode } from "./off.js";
import { suggestions, searchBoost, MACROS, newQuickRef, portionsFor, compileRecipe, recipeAsFood, isRecipeRef,
         applyOverride } from "./foodStore.js";
import { scanBarcode } from "./scan.js";

const OFF_DEBOUNCE_MS = 700;

const MACRO_LABEL = { kcal: "kcal", prot: "P", gluc: "G", lip: "L", fib: "Fib" };

/**
 * Recherche CIQUAL + Open Food Facts partagée entre la recherche principale d'un repas et
 * le sélecteur d'ingrédients d'une recette (02/08/2026 : les recettes doivent pouvoir
 * piocher des produits de marque aussi, pas seulement des aliments bruts). CIQUAL tourne
 * à chaque caractère (0,24 ms mesuré), OFF seulement 700 ms après la dernière frappe — son
 * quota de recherche texte est trop étroit pour suivre la frappe (voir off.js).
 */
function useFoodSearch(q, { boost, limit = 40 } = {}) {
  const [results, setResults] = useState([]);
  const [offResults, setOffResults] = useState([]);
  const [offState, setOffState] = useState("idle"); // idle | loading | done | error
  const runId = useRef(0);
  const offRunId = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    // Jeton de course : searchCiqual est asynchrone (le JSON se charge à la première
    // frappe), donc une réponse tardive ne doit jamais écraser une plus récente.
    const id = ++runId.current;
    searchCiqual(q, { limit, boost }).then((r) => { if (runId.current === id) setResults(r); });
  }, [q, boost, limit]);

  useEffect(() => {
    if (q.trim().length < 2) { setOffResults([]); setOffState("idle"); return; }
    setOffState("idle");
    const id = ++offRunId.current;
    const t = setTimeout(() => {
      if (offRunId.current !== id) return;
      setOffState("loading");
      searchOFF(q).then(({ items, error }) => {
        if (offRunId.current !== id) return;
        setOffResults(items);
        setOffState(error ? "error" : "done");
      });
    }, OFF_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  return { results, offResults, offState };
}

// Bloc "Produits industriels" affiché sous les résultats CIQUAL — identique dans la
// recherche principale et le sélecteur d'ingrédients de recette.
function OffSection({ offState, offResults, onPick }) {
  return (
    <>
      <Label style={{ marginTop: 18, marginBottom: 4 }}>Produits industriels</Label>
      {(offState === "idle" || offState === "loading") && (
        <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>
          {offState === "loading" ? "Recherche Open Food Facts…" : "…"}
        </Body>
      )}
      {offState === "error" && (
        <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>
          Open Food Facts est indisponible pour le moment — réessayez dans quelques secondes.
        </Body>
      )}
      {offState === "done" && offResults.length === 0 && (
        <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>Aucun produit trouvé.</Body>
      )}
      {offResults.map((f) => <Row key={f.ref} food={f} onClick={() => onPick(f)} />)}
    </>
  );
}

// Une valeur absente de la table n'est pas un zéro : on l'affiche « — » pour que le
// total du jour puisse rester honnête (voir totals().missing dans foodStore).
const val = (v, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

// OFF est crowdsourcé : beaucoup de produits n'ont pas toutes les macros renseignées.
// Un badge honnête plutôt que de faire passer une donnée manquante pour un vrai zéro.
const missingCount = (food) => MACROS.filter((m) => food.per100[m] === null || food.per100[m] === undefined).length;

function Row({ food, onClick, pinned, onPin, onRemove, onEdit }) {
  const incomplete = food.ref.startsWith("off:") && missingCount(food) > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      borderBottom: `1px solid ${C.divider}`, padding: "10px 2px",
    }}>
      <div onClick={onClick} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{food.name}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 3, fontFamily: C.mono, fontSize: 10.5, color: C.muted }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>{val(food.per100.kcal)} kcal</span>
          <span>P{val(food.per100.prot)}</span>
          <span>G{val(food.per100.gluc)}</span>
          <span>L{val(food.per100.lip)}</span>
          <span style={{ color: C.dim }}>/100 g</span>
        </div>
        {(food.brand || food.grp) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 0.8 }}>{food.brand || food.grp}</span>
            {incomplete && (
              <span style={{ fontSize: 8.5, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 4px" }}>
                données incomplètes
              </span>
            )}
          </div>
        )}
      </div>
      {onPin && (
        <button onClick={onPin} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6,
          color: pinned ? C.accent : C.dim,
        }}>
          <Star size={15} fill={pinned ? C.accent : "none"} />
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6, color: C.dim,
        }}>
          <PencilLine size={14} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6, color: C.dim,
        }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------- saisie libre / ajout rapide ----------
   Indispensable dès M1 : sans elle, un aliment absent de CIQUAL (skyr, whey, plat du
   restaurant) bloque la journée entière et rend le test en parallèle impossible.
   Les valeurs saisies sont les macros DE LA PORTION mangée — on les stocke donc en
   per100 avec une quantité de 100 g, ce qui garde le même modèle que le reste sans
   demander à l'utilisateur de faire une règle de trois.
   Le nom est optionnel (02/08/2026, "ajout rapide" demandé explicitement) : quand on
   veut juste loguer "35g de protéines" sans réfléchir à un intitulé, exiger un nom est
   la friction qui pousse à abandonner. Un nom vide se sauvegarde sous "Ajout rapide". */
function FreeEntry({ onAdd, onBack, backLabel = "Saisie libre" }) {
  const [name, setName] = useState("");
  const [m, setM] = useState({ prot: "", gluc: "", lip: "", fib: "" });
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const kcal = Math.round(num(m.prot) * 4 + num(m.gluc) * 4 + num(m.lip) * 9 + num(m.fib) * 2);
  const ok = MACROS.some((k) => k !== "kcal" && m[k] !== "" && num(m[k]) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>{backLabel}</Label>
      </div>
      <Body style={{ fontSize: 10.5, color: C.dim }}>
        Macros de la portion réellement mangée, pas pour 100 g.
      </Body>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (optionnel — ex. Skyr vanille 150 g)" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["prot", "Protéines"], ["gluc", "Glucides"], ["lip", "Lipides"], ["fib", "Fibres"]].map(([k, l]) => (
          <div key={k}>
            <Label style={{ marginBottom: 4 }}>{l} (g)</Label>
            <input type="text" inputMode="decimal" value={m[k]} placeholder="0"
              onChange={(e) => setM({ ...m, [k]: e.target.value })}
              style={{ ...inputStyle(false), textAlign: "center" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Label>Calories calculées</Label>
        <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.accent }}>{kcal}</span>
      </div>
      <Btn variant="primary" disabled={!ok} onClick={() => onAdd({
        ref: newQuickRef(),
        name: name.trim() || "Ajout rapide",
        per100: { kcal, prot: num(m.prot), gluc: num(m.gluc), lip: num(m.lip), fib: num(m.fib) },
      }, 100)}>Ajouter</Btn>
    </div>
  );
}

/* ---------- création d'une recette (M4) ----------
   Même recherche CIQUAL + OFF que l'écran principal (via useFoodSearch) : les ingrédients
   d'une recette sont aussi souvent des produits de marque que des aliments bruts — Yoann
   mange surtout à code-barres (retour du 02/08/2026), pas de raison de s'en priver ici. */
function IngredientPicker({ onAdd, onCancel }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [grams, setGrams] = useState(100);
  const { results, offResults, offState } = useFoodSearch(q, { limit: 15 });
  const showEmpty = q.trim().length >= 2 && results.length === 0;

  if (pick) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Label style={{ fontSize: 11 }}>{pick.name}</Label>
        <Stepper value={grams} set={setGrams} step={10} unit="g" min={1} int />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" style={{ flex: 1 }} onClick={() => onAdd({ ...pick, q: Number(grams) })}>Ajouter à la recette</Btn>
          <Btn variant="ghost" onClick={() => setPick(null)}>Retour</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un ingrédient…" style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onCancel} style={{ padding: "0 10px" }}>Annuler</Btn>
      </div>
      {showEmpty && <Empty>Aucun résultat dans CIQUAL.</Empty>}
      {results.map((f) => (
        <div key={f.ref} onClick={() => { setPick(f); setGrams(100); }} style={{
          padding: "8px 2px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer",
        }}>
          <div style={{ fontSize: 12, color: C.text }}>{f.name}</div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginTop: 2 }}>{val(f.per100.kcal)} kcal /100 g</div>
        </div>
      ))}
      {q.trim().length >= 2 && (
        <OffSection offState={offState} offResults={offResults} onPick={(f) => { setPick(f); setGrams(100); }} />
      )}
    </div>
  );
}

// `recipe` (V8, 05/08/2026) : passé pour MODIFIER une recette existante (nom + ingrédients,
// quantité de chaque ingrédient comprise) plutôt que d'en créer une nouvelle — jusqu'ici
// seule la suppression totale était possible, sans aucun moyen de corriger un ingrédient
// sans tout ressaisir depuis zéro.
function RecipeBuilder({ recipe, onSave, onBack }) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? []);
  const [picking, setPicking] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const compiled = useMemo(() => compileRecipe(name || "?", ingredients), [name, ingredients]);
  const ok = name.trim().length > 0 && ingredients.length > 0;

  if (picking) {
    return <IngredientPicker onCancel={() => setPicking(false)}
      onAdd={(ing) => { setIngredients([...ingredients, ing]); setPicking(false); }} />;
  }

  // Réglage de la quantité d'un ingrédient DÉJÀ dans la recette — distinct d'IngredientPicker,
  // qui sert à en ajouter un nouveau. Même Stepper que partout ailleurs dans l'app.
  if (editingIndex !== null) {
    const ing = ingredients[editingIndex];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Label style={{ fontSize: 11 }}>{ing.name}</Label>
        <Stepper value={ing.q} step={10} unit="g" min={1} int
          set={(v) => setIngredients(ingredients.map((x, j) => (j === editingIndex ? { ...x, q: v } : x)))} />
        <Btn variant="primary" onClick={() => setEditingIndex(null)}>OK</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>{recipe ? "Modifier la recette" : "Nouvelle recette"}</Label>
      </div>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Mon shaker du matin)" />

      {ingredients.map((ing, i) => (
        <div key={i} onClick={() => setEditingIndex(i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer" }}>
          <span style={{ fontSize: 12, color: C.text }}>{ing.name} <span style={{ color: C.muted, fontFamily: C.mono, fontSize: 10.5 }}>· {ing.q}g</span></span>
          <button onClick={(e) => { e.stopPropagation(); setIngredients(ingredients.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 6 }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <Btn variant="plain" onClick={() => setPicking(true)}>
        <Plus size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Ajouter un ingrédient
      </Btn>

      {ingredients.length > 0 && (
        <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Label>Total ({compiled.totalWeight} g)</Label>
            <span style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: C.accent }}>
              {val(compiled.per100.kcal)} kcal<span style={{ color: C.muted, fontSize: 10 }}>/100g</span>
            </span>
          </div>
        </div>
      )}

      <Btn variant="primary" disabled={!ok} onClick={() => onSave(name.trim(), ingredients)}>
        {recipe ? "Enregistrer les modifications" : "Enregistrer la recette"}
      </Btn>
    </div>
  );
}

/* ---------- réglage de la quantité ---------- */
// Portions nommées (M4) : "1 pot = 125 g" plutôt que retaper les grammes à chaque fois.
// Rangées par `ref` dans foodStore (foodPortions), donc apprises une fois pour toutes
// les saisies futures de cet aliment précis.
function QtyPanel({ food, initialQ, portions, onSavePortion, onRemovePortion, onAdd, onBack,
                    override, onSaveOverride, onClearOverride }) {
  const [q, setQ] = useState(initialQ ?? 100);
  const [addingPortion, setAddingPortion] = useState(false);
  const [portionLabel, setPortionLabel] = useState("");
  const [fixing, setFixing] = useState(false);
  const k = q / 100;
  // Valeurs AFFICHÉES = snapshot + corrections. `food.per100` n'est jamais modifié : c'est
  // lui qui part dans `onAdd`, donc une nouvelle ligne stocke toujours la valeur d'origine
  // et la correction reste une couche réversible, y compris sur les saisies futures.
  const shown = applyOverride(food.per100, override);
  const isFixed = (m) => override && override[m] !== undefined && override[m] !== null;
  const anyFixed = MACROS.some(isFixed);
  // `int` pour les calories : cohérent avec amounts() dans foodStore, où une décimale de
  // kcal a été jugée trompeuse.
  const amount = (v, int = false) =>
    (v === null || v === undefined ? "—" : int ? Math.round(v * k) : Math.round(v * k * 10) / 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, lineHeight: 1.35 }}>{food.name}</div>
          {food.grp && <div style={{ fontSize: 9, color: C.dim, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{food.grp}</div>}
        </div>
      </div>

      <div>
        <Label style={{ marginBottom: 6 }}>Quantité (g)</Label>
        <Stepper value={q} set={setQ} step={10} unit="g" min={1} int />

        {portions.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {portions.map((p) => (
              <div key={p.label} style={{
                display: "flex", alignItems: "center", gap: 4, borderRadius: 6,
                background: q === p.grams ? C.accent : C.card,
                border: `1.5px solid ${q === p.grams ? C.accent : C.border}`,
                paddingLeft: 10,
              }}>
                <button onClick={() => setQ(p.grams)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "5px 0",
                  fontSize: 11, fontWeight: 800, color: q === p.grams ? "#000" : C.text,
                }}>{p.label} · {p.grams}g</button>
                <button onClick={() => onRemovePortion(food.ref, p.label)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "5px 7px",
                  color: q === p.grams ? "#000" : C.dim,
                }}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[30, 50, 100, 150, 200, 250].map((v) => (
            <button key={v} onClick={() => setQ(v)} style={{
              padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
              fontSize: 11, fontWeight: 800,
              background: q === v ? C.accent : C.card, color: q === v ? "#000" : C.muted,
              border: `1.5px solid ${q === v ? C.accent : C.border}`,
            }}>{v}</button>
          ))}
        </div>

        {addingPortion ? (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)}
              placeholder={`Nom (ex. 1 pot)`} style={{ ...inputStyle(false), flex: 1, fontSize: 12 }} />
            <Btn variant="primary" disabled={!portionLabel.trim()} style={{ padding: "0 12px" }} onClick={() => {
              onSavePortion(food.ref, portionLabel.trim(), q);
              setPortionLabel(""); setAddingPortion(false);
            }}>OK</Btn>
          </div>
        ) : (
          <button onClick={() => setAddingPortion(true)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "7px 0 0",
            fontSize: 10.5, color: C.muted, textDecoration: "underline",
          }}>Enregistrer {q} g comme portion nommée</button>
        )}
      </div>

      <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <Label>Apport</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.accent }}>{amount(shown.kcal, true)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>kcal{isFixed("kcal") ? "*" : ""}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {["prot", "gluc", "lip", "fib"].map((m) => (
            <div key={m} style={{ textAlign: "center" }}>
              {/* Marqueur discret : une valeur corrigée passe en accent et porte un *.
                  Une correction ne doit jamais être invisible. */}
              <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: isFixed(m) ? C.accent : C.text }}>
                {amount(shown[m])}{isFixed(m) ? "*" : ""}
              </div>
              <div style={{ fontSize: 8.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{MACRO_LABEL[m]}</div>
            </div>
          ))}
        </div>
        {MACROS.some((m) => shown[m] === null || shown[m] === undefined) && (
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 9 }}>
            Certaines valeurs sont absentes {isRecipeRef(food.ref) ? "d'un des ingrédients de cette recette" : food.ref.startsWith("off:") ? "de la fiche Open Food Facts" : "de la table CIQUAL"} et ne seront pas comptées. Tu peux les corriger ci-dessous.
          </Body>
        )}
        {anyFixed && (
          <Body style={{ fontSize: 10, color: C.accent, marginTop: 9 }}>
            * valeur corrigée par toi — appliquée à cet aliment partout, y compris dans les repas déjà enregistrés.
          </Body>
        )}
      </div>

      {onSaveOverride && (fixing ? (
        <OverridePanel food={food} shown={shown} override={override}
          onSave={(patch) => { onSaveOverride(food.ref, patch); setFixing(false); }}
          onClear={() => { onClearOverride(food.ref); setFixing(false); }}
          onCancel={() => setFixing(false)} />
      ) : (
        <button onClick={() => setFixing(true)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: 11, color: C.muted, textDecoration: "underline", textAlign: "left",
        }}>Corriger les valeurs de cet aliment{anyFixed ? " (déjà corrigé)" : ""}</button>
      ))}

      <Btn variant="primary" onClick={() => onAdd(food, q)}>Ajouter</Btn>
    </div>
  );
}

/**
 * Éditeur de correction (V6). Toujours exprimé POUR 100 g, comme les tables source — c'est
 * ce qui est écrit sur l'emballage, et ça évite d'avoir à re-convertir selon la quantité
 * affichée juste au-dessus.
 * Un champ laissé vide = pas de correction sur cette macro : la valeur d'origine reprend
 * la main. C'est ce qui rend la correction réversible macro par macro.
 */
function OverridePanel({ food, shown, override, onSave, onClear, onCancel }) {
  const init = {};
  for (const m of MACROS) init[m] = override?.[m] ?? (shown[m] === null || shown[m] === undefined ? "" : String(shown[m]));
  const [v, setV] = useState(init);
  const set = (m, val) => setV((p) => ({ ...p, [m]: val.replace(",", ".") }));

  return (
    <div style={{ background: C.bg, border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: 12 }}>
      <Label style={{ marginBottom: 4 }}>Corriger · valeurs pour 100 g</Label>
      <Body style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        S'applique partout où cet aliment apparaît, y compris dans les repas déjà enregistrés.
        Champ vide = on garde la valeur d'origine.
      </Body>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {MACROS.map((m) => (
          <div key={m}>
            <div style={{ fontSize: 8.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, textAlign: "center" }}>
              {m === "kcal" ? "kcal" : MACRO_LABEL[m]}
            </div>
            <input value={v[m]} onChange={(e) => set(m, e.target.value)} inputMode="decimal" placeholder="—"
              style={{ ...inputStyle(false), padding: "7px 4px", fontSize: 12, textAlign: "center", width: "100%" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <Btn variant="primary" style={{ flex: 1 }} onClick={() => {
          // On ne retient que ce qui DIFFÈRE réellement de la valeur d'origine : recopier
          // la valeur de la table à l'identique ne doit pas créer une fausse « correction »
          // (qui s'afficherait en accent et survivrait à une mise à jour de la table).
          const patch = {};
          for (const m of MACROS) {
            const s = String(v[m]).trim();
            patch[m] = s === "" || Number(s) === food.per100[m] ? null : Number(s);
          }
          onSave(patch);
        }}>Enregistrer</Btn>
        {override && <Btn variant="danger" onClick={onClear}>Tout annuler</Btn>}
        <Btn variant="ghost" onClick={onCancel}>Fermer</Btn>
      </div>
    </div>
  );
}

/* ---------- feuille principale ---------- */
export default function FoodSearch({
  meal, mealLabel, date, log, pins, muted, portions, recipes, overrides,
  onAdd, onTogglePin, onMute, onSavePortion, onRemovePortion, onCreateRecipe, onRemoveRecipe, onUpdateRecipe,
  onSaveOverride, onClearOverride,
  onClose, startFree = false,
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  // L'ajout rapide (bouton "Macro rapide" par repas) ouvre directement ce panneau, sans
  // passer par la recherche — la friction visée est justement d'éviter la recherche.
  const [free, setFree] = useState(startFree);
  const [building, setBuilding] = useState(false);
  // Recette en cours de modification (V8) — `null` = on en crée une nouvelle.
  const [editingRecipe, setEditingRecipe] = useState(null);
  // idle | scanning | lookup | notfound | error — distinct de offState : le scan peut
  // échouer avant même d'atteindre OFF (module Play Services, annulation).
  const [scanState, setScanState] = useState("idle");
  const [scanCode, setScanCode] = useState(null);
  const inputRef = useRef(null);

  const scan = async () => {
    setScanState("idle"); // efface un message d'un scan précédent (notfound/error)
    const { code, status } = await scanBarcode();
    if (status !== "ok") { if (status === "error") setScanState("error"); return; }
    setScanCode(code);
    setScanState("lookup");
    const { item, notFound, error } = await getOFFByBarcode(code);
    if (item) { setSel(item); setScanState("idle"); }
    else setScanState(error ? "error" : "notfound");
  };

  const boost = useMemo(() => searchBoost(log, { meal, date }), [log, meal, date]);
  const sugg = useMemo(() => suggestions(log, { meal, pins, muted, date }), [log, meal, pins, muted, date]);
  const { results, offResults, offState } = useFoodSearch(q, { boost });

  useEffect(() => { if (!startFree) inputRef.current?.focus(); }, [startFree]);

  const showSugg = q.trim().length < 2;
  const list = showSugg ? sugg : results;
  // Recettes : jamais de réseau ni de debounce, juste un filtre local — la liste est
  // toujours courte. Toutes affichées sans frappe, filtrées par nom sinon.
  const matchedRecipes = useMemo(() => {
    if (!recipes?.length) return [];
    if (showSugg) return recipes;
    const nq = normalize(q);
    return recipes.filter((r) => normalize(r.name).includes(nq));
  }, [recipes, q, showSugg]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 60,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: `1.5px solid ${C.border}`,
      }}>
        <Label style={{ fontSize: 11, color: C.text }}>{mealLabel}</Label>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {building ? (
          <RecipeBuilder recipe={editingRecipe}
            onBack={() => { setBuilding(false); setEditingRecipe(null); }}
            onSave={(name, ingredients) => {
              const r = compileRecipe(name, ingredients, editingRecipe);
              if (editingRecipe) onUpdateRecipe(r); else onCreateRecipe(r);
              setBuilding(false);
              setEditingRecipe(null);
              setSel(recipeAsFood(r));
            }} />
        ) : free ? (
          <FreeEntry onAdd={onAdd} onBack={() => setFree(false)}
            backLabel={startFree ? "Macro rapide" : "Saisie libre"} />
        ) : sel ? (
          <QtyPanel food={sel} initialQ={sel.lastQ ?? sel.defaultQ}
            portions={portionsFor(portions, sel.ref)} onSavePortion={onSavePortion} onRemovePortion={onRemovePortion}
            override={overrides?.[sel.ref]} onSaveOverride={onSaveOverride} onClearOverride={onClearOverride}
            onAdd={onAdd} onBack={() => setSel(null)} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color={C.muted} style={{ position: "absolute", left: 10, top: 11 }} />
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un aliment…"
                  style={{ ...inputStyle(false), paddingLeft: 32, fontFamily: "inherit", fontWeight: 600 }} />
              </div>
              {/* M3, natif seulement : scan() (Google Code Scanner) — pas de permission
                  caméra, pas d'écran web équivalent. */}
              {Capacitor.isNativePlatform() && (
                <button onClick={scan} disabled={scanState === "lookup"} style={{
                  background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 6,
                  width: 40, color: scanState === "lookup" ? C.dim : C.accent, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ScanBarcode size={18} />
                </button>
              )}
            </div>

            {scanState === "lookup" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>Recherche du produit scanné…</Body>
            )}
            {scanState === "notfound" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>
                Code {scanCode} inconnu d'Open Food Facts. Cherchez-le à la main ou utilisez la saisie libre.
              </Body>
            )}
            {scanState === "error" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>
                Scan indisponible pour le moment — réessayez.
              </Body>
            )}

            {matchedRecipes.length > 0 && (
              <>
                <Label style={{ marginBottom: 4 }}>Vos recettes</Label>
                {matchedRecipes.map((r) => (
                  <Row key={`recipe:${r.id}`} food={recipeAsFood(r)}
                    onClick={() => setSel(recipeAsFood(r))}
                    onEdit={() => { setEditingRecipe(r); setBuilding(true); }}
                    onRemove={() => onRemoveRecipe(r.id)} />
                ))}
              </>
            )}

            <Label style={{ marginBottom: 4, marginTop: matchedRecipes.length > 0 ? 14 : 0 }}>
              {showSugg ? "Vos aliments habituels" : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
            </Label>

            {list.length === 0 ? (
              <Empty>{showSugg ? "Rien encore. Cherchez un aliment." : "Aucun résultat dans CIQUAL."}</Empty>
            ) : (
              list.map((f) => (
                <Row key={f.ref + f.name} food={f} pinned={f.pinned}
                  onClick={() => setSel(f)}
                  onPin={showSugg ? () => onTogglePin(f.ref) : undefined}
                  onRemove={showSugg ? () => onMute(f.ref) : undefined} />
              ))
            )}

            {!showSugg && <OffSection offState={offState} offResults={offResults} onPick={setSel} />}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Btn variant="plain" onClick={() => setFree(true)} style={{ flex: 1 }}>
                <PencilLine size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
                Saisie libre
              </Btn>
              <Btn variant="plain" onClick={() => setBuilding(true)} style={{ flex: 1 }}>
                <ChefHat size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
                Nouvelle recette
              </Btn>
            </div>
            <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 10, textAlign: "center" }}>
              Table Ciqual 2020 — ANSES · Licence Ouverte 2.0<br />
              Open Food Facts · Licence Open Database (ODbL)
            </Body>
          </>
        )}
      </div>
    </div>
  );
}
