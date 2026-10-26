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
import { Search, X, ChevronLeft, Star, PencilLine, Trash2, ScanBarcode, ChefHat, Utensils, Camera, Plus, Check } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { C, Btn, Label, Body, Empty, Stepper, TextInput, inputStyle } from "../design/compat.jsx";
// v2 (chantier U, U3 étape 2) : la feuille, la recherche, les lignes, la quantité et la saisie
// libre passent sur les primitives v2 ; recettes, corrections V6, Carte resto et Photo passent
// après U4 par design/compat.jsx (mêmes noms que les primitives v1, valeurs v2).
import { T } from "../design/tokens.js";
import { Eyebrow, Button, IconButton, Chip, NumberField, TextField } from "../design/primitives.jsx";
import { searchCiqual, normalize, getCiqual } from "@rawcare/core/nutrition/ciqual";
import { searchOFF, getOFFByBarcode } from "@rawcare/core/nutrition/off";
import { suggestions, searchBoost, MACROS, newQuickRef, portionsFor, compileRecipe, recipeAsFood, isRecipeRef,
         applyOverride } from "./foodStore.js";
import { scanBarcode } from "@rawcare/core/nutrition/scan";
import RestaurantMenu from "./RestaurantMenu.jsx";
import PhotoDish from "./PhotoDish.jsx";

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
        <Body style={{ fontSize: 13, color: C.dim, padding: "6px 0" }}>
          {offState === "loading" ? "Recherche Open Food Facts…" : "…"}
        </Body>
      )}
      {offState === "error" && (
        <Body style={{ fontSize: 13, color: C.dim, padding: "6px 0" }}>
          Open Food Facts est indisponible pour le moment — réessayez dans quelques secondes.
        </Body>
      )}
      {offState === "done" && offResults.length === 0 && (
        <Body style={{ fontSize: 13, color: C.dim, padding: "6px 0" }}>Aucun produit trouvé.</Body>
      )}
      {offResults.map((f) => <Row key={f.ref} food={f} onClick={() => onPick(f)} />)}
    </>
  );
}

// Une valeur absente de la table n'est pas un zéro : on l'affiche « — » pour que le
// total du jour puisse rester honnête (voir totals().missing dans foodStore).
const val = (v, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

// Calories réelles pour une quantité donnée (05/08/2026) — demandé pour qu'un réglage de
// quantité, que ce soit un nouvel ingrédient ou un ingrédient déjà dans la recette, montre
// tout de suite l'impact en calories plutôt que des grammes seuls.
const kcalFor = (per100, q) =>
  per100?.kcal === null || per100?.kcal === undefined ? null : Math.round((per100.kcal * q) / 100);

function KcalPreview({ per100, q }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <Label>Calories</Label>
      <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.accent }}>
        {val(kcalFor(per100, q))}<span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}> kcal</span>
      </span>
    </div>
  );
}

// OFF est crowdsourcé : beaucoup de produits n'ont pas toutes les macros renseignées.
// Un badge honnête plutôt que de faire passer une donnée manquante pour un vrai zéro.
const missingCount = (food) => MACROS.filter((m) => food.per100[m] === null || food.per100[m] === undefined).length;

// Ajout à la volée (01/09/2026) : sur "Vos aliments habituels", un + ajoute directement à
// la dernière quantité utilisée (f.lastQ, toujours renseigné pour un aliment déjà loggé —
// voir suggestions() dans foodStore ; 100 g de repli pour un favori jamais encore logué),
// sans ouvrir le détail ni fermer le tiroir de recherche — le but est d'enchaîner plusieurs
// ajouts sans revenir à l'écran précédent à chaque fois. Retour visuel bref (coche) le temps
// qu'il n'y a pas de navigation pour confirmer l'action autrement.
function QuickAddButton({ onAdd, name }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton label={done ? "Ajouté" : `Ajouter ${name || "cet aliment"}`} tone="accent"
      onClick={(e) => { e.stopPropagation(); if (done) return; onAdd(); setDone(true); setTimeout(() => setDone(false), 900); }}>
      {done ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
    </IconButton>
  );
}

function Row({ food, onClick, pinned, onPin, onRemove, onEdit, onQuickAdd }) {
  const incomplete = food.ref.startsWith("off:") && missingCount(food) > 0;
  const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${T.c.lineSoft}`, fontFamily: T.f.body }}>
      <button type="button" className="p-tap" onClick={onClick} style={{
        flex: 1, minWidth: 0, minHeight: 60, padding: "8px 2px", background: "none", border: "none",
        textAlign: "left", color: T.c.text, fontFamily: "inherit",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{food.name}</div>
        <div style={{ ...mono, display: "flex", flexWrap: "wrap", columnGap: 10, marginTop: 3, fontSize: 13, color: T.c.text2 }}>
          <span style={{ color: T.c.accent, fontWeight: 700 }}>{val(food.per100.kcal)} kcal</span>
          <span>P{val(food.per100.prot)}</span>
          <span>G{val(food.per100.gluc)}</span>
          <span>L{val(food.per100.lip)}</span>
          <span style={{ color: T.c.muted }}>/100 g</span>
        </div>
        {(food.brand || food.grp) && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 12, color: T.c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{food.brand || food.grp}</span>
            {incomplete && (
              <span style={{ fontSize: 12, color: T.c.muted, border: `1px solid ${T.c.line}`, borderRadius: 4, padding: "0 5px" }}>
                données incomplètes
              </span>
            )}
          </div>
        )}
      </button>
      {onPin && (
        <IconButton label={pinned ? `Retirer ${food.name} des favoris` : `Épingler ${food.name}`} aria-pressed={pinned} size={44}
          style={{ border: "none" }} onClick={onPin}>
          <Star size={18} fill={pinned ? T.c.accent : "none"} aria-hidden="true" />
        </IconButton>
      )}
      {onEdit && (
        <IconButton label={`Modifier ${food.name}`} size={44} style={{ border: "none" }} onClick={onEdit}>
          <PencilLine size={18} aria-hidden="true" />
        </IconButton>
      )}
      {onRemove && (
        <IconButton label={`Masquer ${food.name}`} size={44} style={{ border: "none" }} onClick={onRemove}>
          <Trash2 size={18} aria-hidden="true" />
        </IconButton>
      )}
      {onQuickAdd && <QuickAddButton onAdd={onQuickAdd} name={food.name} />}
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
  const [m, setM] = useState({ prot: "", gluc: "", lip: "", fib: "", alcool: "" });
  // Ajouter / Retirer (07/10/2026, demande de Yoann) : « Retirer » enregistre une ligne de
  // CORRECTION aux valeurs négatives — pour affiner une estimation faite en début de journée sans
  // tout ressaisir. Même formulaire, même pipeline ; seul le signe change à l'enregistrement.
  const [remove, setRemove] = useState(false);
  const sign = remove ? -1 : 1;
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  // Alcool (T5, 04/10/2026) : 7 kcal/g (même coefficient que la table CIQUAL), optionnel,
  // stocké dans la ligne `foodLog` (per100.alcool) pour le Coach IA — jamais une macro cible.
  const alcohol = num(m.alcool);
  const macrosEntered = MACROS.some((k) => k !== "kcal" && m[k] !== "" && num(m[k]) > 0) || alcohol > 0;
  const kcalComputed = Math.round(num(m.prot) * 4 + num(m.gluc) * 4 + num(m.lip) * 9 + num(m.fib) * 2 + alcohol * 7);

  // Calories toujours éditables, jamais figées sur le calcul 4/4/9+fibres (07/09/2026,
  // demande explicite de Yoann — cas de l'alcool : un Jamaican Mule ~190 kcal n'a que 16 g
  // de glucides comme macro connue, le calcul 4/4/9 sous-estimerait grossièrement puisque
  // l'app ne suit pas l'alcool comme macro à part). Suit automatiquement le calcul tant que
  // l'utilisateur n'a rien tapé lui-même dans le champ ; dès qu'il tape, sa valeur devient
  // la référence et NE SE FAIT PLUS ÉCRASER par un changement de macro ensuite — c'est
  // exactement le comportement demandé ("les calories restent même si je rentre d'autres
  // macros").
  const [kcal, setKcal] = useState("");
  const [kcalTouched, setKcalTouched] = useState(false);
  useEffect(() => {
    if (!kcalTouched) setKcal(kcalComputed ? String(kcalComputed) : "");
  }, [kcalComputed, kcalTouched]);

  const ok = macrosEntered || num(kcal) > 0;
  const submit = () => {
    if (!ok) return;
    onAdd({
      ref: newQuickRef(),
      name: name.trim() || (remove ? `Correction (−${Math.round(num(kcal))} kcal)` : "Ajout rapide"),
      ...(remove ? { correction: true } : {}),
      per100: macrosEntered
        ? { kcal: sign * Math.round(num(kcal)), prot: sign * num(m.prot), gluc: sign * num(m.gluc), lip: sign * num(m.lip), fib: sign * num(m.fib), ...(alcohol > 0 ? { alcool: sign * alcohol } : {}) }
        // Calories seules : les macros sont vraiment INCONNUES (null), pas nulles —
        // même principe que les fibres manquantes d'un produit Open Food Facts.
        : { kcal: sign * Math.round(num(kcal)), prot: null, gluc: null, lip: null, fib: null },
    }, 100);
    onBack();
  };

  // Entrée passe au champ suivant (clavier numérique « Suivant »), Entrée sur les calories valide.
  const FIELDS = [["prot", "Protéines"], ["gluc", "Glucides"], ["lip", "Lipides"], ["fib", "Fibres"], ["alcool", "Alcool"]];
  const refs = useRef([]);
  const next = (i) => refs.current[i + 1]?.focus();

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: T.f.body, color: T.c.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton label="Retour" size={44} style={{ border: "none", color: T.c.accent }} onClick={onBack}><ChevronLeft size={24} aria-hidden="true" /></IconButton>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{backLabel}</h3>
      </div>
      <div role="group" aria-label="Ajouter ou retirer" style={{ display: "flex", gap: 6 }}>
        {[[false, "Ajouter"], [true, "Retirer"]].map(([v, l]) => (
          <Chip key={l} on={remove === v} onClick={() => setRemove(v)} style={{ flex: 1, justifyContent: "center" }}>{l}</Chip>
        ))}
      </div>
      <div className="p-sec">
        {remove
          ? "Correction : ce que tu saisis sera RETIRÉ des totaux du repas (estimation trop haute faite plus tôt)."
          : "Macros de la portion réellement mangée, pas pour 100 g."}
      </div>
      <TextField value={name} onChange={setName} placeholder="Nom (optionnel — ex. Skyr vanille 150 g)" label="Nom" enterKeyHint="next" onEnter={() => refs.current[0]?.focus()} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {FIELDS.map(([k, l], i) => (
          <div key={k} style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <Eyebrow>{l} (g)</Eyebrow>
            <NumberField value={m[k]} onChange={(v) => setM((p) => ({ ...p, [k]: v }))} label={l}
              inputRef={(el) => { refs.current[i] = el; }} enterKeyHint="next" onEnter={() => next(i)} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Eyebrow>Calories</Eyebrow>
        <NumberField value={kcal} onChange={(v) => { setKcalTouched(true); setKcal(v); }} unit="kcal" label="Calories" big
          inputRef={(el) => { refs.current[FIELDS.length] = el; }} onEnter={submit} style={{ color: T.c.accent }} />
      </div>
      <Button variant="primary" block disabled={!ok} onClick={submit}>{remove ? "Retirer" : "Ajouter"}</Button>
    </div>
  );
}

// Répare un ingrédient de recette créé AVANT le 05/08/2026 (v3.51.0), quand `compileRecipe`
// ne gardait que `{ref, name, q}` par ingrédient, jamais son `per100` — rouvrir une telle
// recette pour la modifier recalculait le total avec des macros manquantes et le sauvegardait
// ainsi (total entier mis à `null`, affiché "0" dans les repas qui l'utilisent). Re-résout le
// `per100` depuis la source d'origine (CIQUAL/OFF) via le `ref`, exactement ce que ferait une
// nouvelle recherche — les ingrédients d'une recette ne viennent QUE de CIQUAL/OFF (jamais
// d'une saisie libre ni d'une autre recette), donc toujours résolubles par ce chemin.
async function resolveIngredient(ing) {
  if (ing.per100) return ing;
  const mc = /^ciqual:(\d+)$/.exec(ing.ref);
  if (mc) {
    const food = await getCiqual(mc[1]);
    if (food) return { ...ing, per100: food.per100 };
  }
  const mo = /^off:(.+)$/.exec(ing.ref);
  if (mo) {
    const { item } = await getOFFByBarcode(mo[1]);
    if (item) return { ...ing, per100: item.per100 };
  }
  return ing;
}

/* ---------- création d'une recette (M4) ----------
   Même recherche CIQUAL + OFF que l'écran principal (via useFoodSearch) : les ingrédients
   d'une recette sont aussi souvent des produits de marque que des aliments bruts — Yoann
   mange surtout à code-barres (retour du 02/08/2026), pas de raison de s'en priver ici. */
function IngredientPicker({ onAdd, onCancel, log, pins, muted }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [grams, setGrams] = useState(100);
  const { results, offResults, offState } = useFoodSearch(q, { limit: 15 });
  const showEmpty = q.trim().length >= 2 && results.length === 0;
  const showSugg = q.trim().length < 2;
  // Favoris/aliments habituels (07/08/2026, retour de Yoann) : jusqu'ici IngredientPicker
  // n'affichait QUE la recherche textuelle, contrairement à l'écran principal — pas de
  // `meal` ici (un ingrédient de recette n'est pas lié à un repas précis).
  const sugg = useMemo(() => suggestions(log || [], { pins, muted }), [log, pins, muted]);

  if (pick) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Label style={{ fontSize: 13 }}>{pick.name}</Label>
        <Stepper value={grams} set={setGrams} step={10} unit="g" min={1} int />
        <KcalPreview per100={pick.per100} q={grams} />
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
      {showSugg && sugg.length > 0 && (
        <Label style={{ marginTop: 4, marginBottom: 2 }}>Vos aliments habituels</Label>
      )}
      {showEmpty && <Empty>Aucun résultat dans CIQUAL.</Empty>}
      {(showSugg ? sugg : results).map((f) => (
        <button type="button" className="p-tap" key={f.ref} onClick={() => { setPick(f); setGrams(100); }} style={{
          display: "block", width: "100%", minHeight: 56, padding: "8px 2px", background: "none", border: "none",
          borderBottom: `1px solid ${C.divider}`, textAlign: "left", fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{f.name}</div>
          <div style={{ fontFamily: C.mono, fontSize: 13, color: C.text2, marginTop: 2 }}>{val(f.per100.kcal)} kcal /100 g</div>
        </button>
      ))}
      {!showSugg && q.trim().length >= 2 && (
        <OffSection offState={offState} offResults={offResults} onPick={(f) => { setPick(f); setGrams(100); }} />
      )}
    </div>
  );
}

// `recipe` (V8, 05/08/2026) : passé pour MODIFIER une recette existante (nom + ingrédients,
// quantité de chaque ingrédient comprise) plutôt que d'en créer une nouvelle — jusqu'ici
// seule la suppression totale était possible, sans aucun moyen de corriger un ingrédient
// sans tout ressaisir depuis zéro.
function RecipeBuilder({ recipe, onSave, onBack, log, pins, muted }) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? []);
  const [picking, setPicking] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // Auto-réparation (05/08/2026) : une recette créée avant v3.51.0 a des ingrédients sans
  // `per100` stocké. Sans ce correctif, le total recalculé à l'ouverture serait "—" et
  // "Enregistrer les modifications" écraserait la recette avec des macros à `null` partout
  // — exactement le bug remonté par Yoann. Tourne une seule fois à l'ouverture (pas à
  // chaque frappe), silencieux : le total se met à jour dès la résolution terminée.
  useEffect(() => {
    if (!recipe || !recipe.ingredients.some((i) => !i.per100)) return;
    let cancelled = false;
    Promise.all(recipe.ingredients.map(resolveIngredient)).then((resolved) => {
      if (!cancelled) setIngredients(resolved);
    }).catch(() => {}); // un ingrédient irrésolu (OFF hors-ligne) reste sans per100 — le
    // total l'affichera honnêtement en absent plutôt que de planter cet écran.
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);
  const compiled = useMemo(() => compileRecipe(name || "?", ingredients), [name, ingredients]);
  const ok = name.trim().length > 0 && ingredients.length > 0;

  if (picking) {
    return <IngredientPicker onCancel={() => setPicking(false)} log={log} pins={pins} muted={muted}
      onAdd={(ing) => { setIngredients([...ingredients, ing]); setPicking(false); }} />;
  }

  // Réglage de la quantité d'un ingrédient DÉJÀ dans la recette — distinct d'IngredientPicker,
  // qui sert à en ajouter un nouveau. Même Stepper que partout ailleurs dans l'app.
  if (editingIndex !== null) {
    const ing = ingredients[editingIndex];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Label style={{ fontSize: 13 }}>{ing.name}</Label>
        <Stepper value={ing.q} step={10} unit="g" min={1} int
          set={(v) => setIngredients(ingredients.map((x, j) => (j === editingIndex ? { ...x, q: v } : x)))} />
        <KcalPreview per100={ing.per100} q={ing.q} />
        <Btn variant="primary" onClick={() => setEditingIndex(null)}>OK</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="p-tap" onClick={onBack} aria-label="Retour" style={{ background: "none", border: "none", color: C.accent, width: 44, height: 44, display: "grid", placeItems: "center", padding: 0, flexShrink: 0 }}>
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <Label style={{ fontSize: 13 }}>{recipe ? "Modifier la recette" : "Nouvelle recette"}</Label>
      </div>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Mon shaker du matin)" />

      {ingredients.map((ing, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, borderBottom: `1px solid ${C.divider}` }}>
          <button type="button" className="p-tap" onClick={() => setEditingIndex(i)} aria-label={`Modifier la quantité de ${ing.name}`} style={{
            flex: 1, minWidth: 0, minHeight: 56, padding: "8px 2px", background: "none", border: "none", textAlign: "left", fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{ing.name}</div>
            <div style={{ fontFamily: C.mono, fontSize: 13, color: C.text2, marginTop: 2 }}>
              {ing.q}g · <span style={{ color: C.accent, fontWeight: 700 }}>{val(kcalFor(ing.per100, ing.q))} kcal</span>
            </div>
          </button>
          <button type="button" className="p-tap" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} aria-label={`Retirer ${ing.name} de la recette`}
            style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: C.text2, padding: 0, flexShrink: 0 }}>
            <Trash2 size={18} aria-hidden="true" />
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
              {val(compiled.per100.kcal)} kcal<span style={{ color: C.muted, fontSize: 12 }}>/100g</span>
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
  // Quantité en CHAÎNE pendant la frappe (champ vide, « 12 » en cours…), convertie à l'ajout.
  const [qTxt, setQTxt] = useState(String(initialQ ?? 100));
  const q = Number(qTxt);
  const qOk = Number.isFinite(q) && q > 0;
  const setQ = (v) => setQTxt(String(v));
  const [addingPortion, setAddingPortion] = useState(false);
  const [portionLabel, setPortionLabel] = useState("");
  const [fixing, setFixing] = useState(false);
  const k = qOk ? q / 100 : 0;
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
  const submit = () => { if (!qOk) return; onAdd(food, q); onBack(); };
  const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ display: "grid", gap: 16, fontFamily: T.f.body, color: T.c.text }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <IconButton label="Retour" size={44} style={{ border: "none", color: T.c.accent }} onClick={onBack}><ChevronLeft size={24} aria-hidden="true" /></IconButton>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{food.name}</h3>
          {food.grp && <div style={{ fontSize: 12, color: T.c.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{food.grp}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <Eyebrow>Quantité</Eyebrow>
        {/* Entrée = Ajouter : régler la quantité puis valider sans quitter le clavier. */}
        <NumberField value={qTxt} onChange={setQTxt} unit="g" step={10} min={1} inputMode="numeric"
          label="Quantité en grammes" onEnter={submit} big />

        {portions.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {portions.map((p) => (
              <span key={p.label} style={{ display: "inline-flex", alignItems: "center" }}>
                <Chip on={q === p.grams} onClick={() => setQ(p.grams)}>{p.label} · {p.grams} g</Chip>
                <IconButton label={`Supprimer la portion ${p.label}`} size={44} style={{ border: "none" }}
                  onClick={() => onRemovePortion(food.ref, p.label)}><X size={16} aria-hidden="true" /></IconButton>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[30, 50, 100, 150, 200, 250].map((v) => (
            <Chip key={v} on={q === v} onClick={() => setQ(v)}><span style={mono}>{v}</span></Chip>
          ))}
        </div>

        {addingPortion ? (
          <div style={{ display: "flex", gap: 6 }}>
            <TextField value={portionLabel} onChange={setPortionLabel} placeholder="Nom (ex. 1 pot)" label="Nom de la portion"
              onEnter={() => { if (portionLabel.trim() && qOk) { onSavePortion(food.ref, portionLabel.trim(), q); setPortionLabel(""); setAddingPortion(false); } }} />
            <Button variant="primary" disabled={!portionLabel.trim() || !qOk} onClick={() => {
              onSavePortion(food.ref, portionLabel.trim(), q);
              setPortionLabel(""); setAddingPortion(false);
            }}>OK</Button>
          </div>
        ) : (
          <button type="button" className="p-tap" onClick={() => setAddingPortion(true)} disabled={!qOk} style={{
            background: "none", border: "none", padding: 0, minHeight: 44, textAlign: "left",
            fontSize: 14, color: T.c.text2, textDecoration: "underline", fontFamily: "inherit",
          }}>Enregistrer {qOk ? q : "—"} g comme portion nommée</button>
        )}
      </div>

      <div style={{ background: T.c.field, border: `1px solid ${T.c.line}`, borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Eyebrow>Apport</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ ...mono, fontSize: 28, fontWeight: 700, color: T.c.accent }}>{amount(shown.kcal, true)}</span>
            <span style={{ fontSize: 13, color: T.c.text2, fontWeight: 700 }}>kcal{isFixed("kcal") ? "*" : ""}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          {["prot", "gluc", "lip", "fib"].map((m) => (
            <div key={m} style={{ textAlign: "center" }}>
              {/* Marqueur discret : une valeur corrigée passe en accent et porte un *.
                  Une correction ne doit jamais être invisible. */}
              <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: isFixed(m) ? T.c.accent : T.c.text }}>
                {amount(shown[m])}{isFixed(m) ? "*" : ""}
              </div>
              <div className="p-label" style={{ marginTop: 2 }}>{MACRO_LABEL[m]}</div>
            </div>
          ))}
        </div>
        {MACROS.some((m) => shown[m] === null || shown[m] === undefined) && (
          <div className="p-muted">
            Certaines valeurs sont absentes {isRecipeRef(food.ref) ? "d'un des ingrédients de cette recette" : food.ref.startsWith("off:") ? "de la fiche Open Food Facts" : "de la table CIQUAL"} et ne seront pas comptées. Tu peux les corriger ci-dessous.
          </div>
        )}
        {anyFixed && (
          <div style={{ fontSize: 13, color: T.c.accent }}>
            * valeur corrigée par toi — appliquée à cet aliment partout, y compris dans les repas déjà enregistrés.
          </div>
        )}
      </div>

      {onSaveOverride && (fixing ? (
        <OverridePanel food={food} shown={shown} override={override}
          onSave={(patch) => { onSaveOverride(food.ref, patch); setFixing(false); }}
          onClear={() => { onClearOverride(food.ref); setFixing(false); }}
          onCancel={() => setFixing(false)} />
      ) : (
        <button type="button" className="p-tap" onClick={() => setFixing(true)} style={{
          background: "none", border: "none", padding: 0, minHeight: 44, textAlign: "left",
          fontSize: 14, color: T.c.text2, textDecoration: "underline", fontFamily: "inherit",
        }}>Corriger les valeurs de cet aliment{anyFixed ? " (déjà corrigé)" : ""}</button>
      ))}

      <Button variant="primary" block disabled={!qOk} onClick={submit}>Ajouter{qOk ? ` ${q} g` : ""}</Button>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {MACROS.map((m) => (
          <div key={m}>
            <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, textAlign: "center" }}>
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

// 4 entrées en grille 2 × 2 : 15 px et marges courtes pour que « Nouvelle recette » et
// « Photo d'un plat » tiennent sur une ligne à 360 px de large.
const ACTION = { flex: "1 1 calc(50% - 4px)", fontSize: 15, padding: "0 10px", whiteSpace: "nowrap" };

/* ---------- feuille principale ---------- */
export default function FoodSearch({
  meal, mealLabel, date, log, pins, muted, portions, recipes, overrides,
  onAdd, onTogglePin, onMute, onSavePortion, onRemovePortion, onCreateRecipe, onRemoveRecipe, onUpdateRecipe,
  onSaveOverride, onClearOverride,
  ai, remaining, onLogDishes,
  onClose, startFree = false,
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  // L'ajout rapide (bouton "Macro rapide" par repas) ouvre directement ce panneau, sans
  // passer par la recherche — la friction visée est justement d'éviter la recherche.
  const [free, setFree] = useState(startFree);
  const [building, setBuilding] = useState(false);
  // Carte resto (05/08/2026) : au même niveau que "Saisie libre"/"Nouvelle recette", pas un
  // bouton séparé dans l'onglet Repas — demandé explicitement après une première version.
  const [resto, setResto] = useState(false);
  // Photo d'un plat (05/08/2026) : logge ce qui est SERVI (une seule photo suffit, pas de
  // menu à lire) — même registre que Carte resto mais un plat unique, pas de suggestions.
  const [photoMode, setPhotoMode] = useState(false);
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
  // Favoris/récents cherchés EN PREMIER, même en tapant (01/09/2026, retour de Yoann) :
  // avant, taper 2 caractères faisait disparaître entièrement "Vos aliments habituels" au
  // profit de CIQUAL — un favori mettait donc plus de temps à retrouver que la première
  // fois. `sugg` porte déjà tous les favoris/récents (jamais limité, voir foodStore), un
  // simple filtre texte local suffit, sans nouvelle requête ni debounce.
  const favMatches = useMemo(() => {
    if (showSugg) return [];
    const nq = normalize(q);
    return sugg.filter((f) => normalize(f.name).includes(nq));
  }, [sugg, q, showSugg]);
  // CIQUAL/OFF ne répètent jamais un aliment déjà remonté en favori/récent juste au-dessus.
  const favRefs = useMemo(() => new Set(favMatches.map((f) => f.ref)), [favMatches]);
  const list = showSugg ? sugg : results.filter((f) => !favRefs.has(f.ref));
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
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "8px 8px 8px 16px", borderBottom: `1px solid ${T.c.lineSoft}`, fontFamily: T.f.body,
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.c.text }}>{mealLabel}</h2>
        <IconButton label="Fermer la recherche" onClick={onClose}><X size={22} aria-hidden="true" /></IconButton>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, fontFamily: T.f.body }}>
        {building ? (
          <RecipeBuilder recipe={editingRecipe} log={log} pins={pins} muted={muted}
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
        ) : resto ? (
          <RestaurantMenu ai={ai} remaining={remaining} meal={meal}
            onLogDishes={onLogDishes} onBack={() => setResto(false)} />
        ) : photoMode ? (
          <PhotoDish ai={ai} onAdd={onAdd} onBack={() => setPhotoMode(false)} />
        ) : sel ? (
          <QtyPanel food={sel} initialQ={sel.lastQ ?? sel.defaultQ}
            portions={portionsFor(portions, sel.ref)} onSavePortion={onSavePortion} onRemovePortion={onRemovePortion}
            override={overrides?.[sel.ref]} onSaveOverride={onSaveOverride} onClearOverride={onClearOverride}
            onAdd={onAdd} onBack={() => setSel(null)} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <TextField inputRef={inputRef} value={q} onChange={setQ} icon={Search}
                placeholder="Rechercher un aliment…" label="Rechercher un aliment" enterKeyHint="search" />
              {/* M3, natif seulement : scan() (Google Code Scanner) — pas de permission
                  caméra, pas d'écran web équivalent. */}
              {Capacitor.isNativePlatform() && (
                <IconButton label="Scanner un code-barres" tone="accent" size={52} onClick={scan} disabled={scanState === "lookup"}>
                  <ScanBarcode size={22} aria-hidden="true" />
                </IconButton>
              )}
            </div>

            {/* Remonté tout en haut (07/08/2026, retour de Yoann) : ces 4 actions étaient
                reléguées en bas de la liste de suggestions/résultats, donc hors écran la
                plupart du temps — alors que "Saisie libre"/"Nouvelle recette"/"Carte resto"/
                "Photo d'un plat" sont des points d'entrée au même niveau que la recherche,
                pas un repli à découvrir en scrollant. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <Button variant="plain" onClick={() => setFree(true)} style={ACTION}>
                <PencilLine size={18} aria-hidden="true" />Saisie libre
              </Button>
              <Button variant="plain" onClick={() => setBuilding(true)} style={ACTION}>
                <ChefHat size={18} aria-hidden="true" />Nouvelle recette
              </Button>
              <Button variant="plain" onClick={() => setResto(true)} style={ACTION}>
                <Utensils size={18} aria-hidden="true" />Carte resto
              </Button>
              <Button variant="plain" onClick={() => setPhotoMode(true)} style={ACTION}>
                <Camera size={18} aria-hidden="true" />Photo d'un plat
              </Button>
            </div>

            {scanState === "lookup" && (
              <div className="p-sec" style={{ padding: "0 0 10px" }}>Recherche du produit scanné…</div>
            )}
            {scanState === "notfound" && (
              <div className="p-sec" style={{ padding: "0 0 10px" }}>
                Code {scanCode} inconnu d'Open Food Facts. Cherchez-le à la main ou utilisez la saisie libre.
              </div>
            )}
            {scanState === "error" && (
              <div className="p-sec" style={{ padding: "0 0 10px" }}>
                Scan indisponible pour le moment — réessayez.
              </div>
            )}

            {matchedRecipes.length > 0 && (
              <>
                <Eyebrow style={{ marginBottom: 2 }}>Vos recettes</Eyebrow>
                {matchedRecipes.map((r) => (
                  <Row key={`recipe:${r.id}`} food={recipeAsFood(r)}
                    onClick={() => setSel(recipeAsFood(r))}
                    onEdit={() => { setEditingRecipe(r); setBuilding(true); }}
                    onRemove={() => onRemoveRecipe(r.id)} />
                ))}
              </>
            )}

            {!showSugg && favMatches.length > 0 && (
              <>
                <Eyebrow style={{ marginBottom: 2, marginTop: matchedRecipes.length > 0 ? 16 : 0 }}>Favoris et récents</Eyebrow>
                {favMatches.map((f) => (
                  <Row key={f.ref + f.name} food={f} pinned={f.pinned}
                    onClick={() => setSel(f)}
                    onPin={() => onTogglePin(f.ref)}
                    onRemove={() => onMute(f.ref)}
                    onQuickAdd={() => onAdd(f, f.lastQ ?? f.defaultQ ?? 100)} />
                ))}
              </>
            )}

            <Eyebrow style={{ marginBottom: 2, marginTop: (matchedRecipes.length > 0 || favMatches.length > 0) ? 16 : 0 }}>
              {showSugg ? "Vos aliments habituels" : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
            </Eyebrow>

            {list.length === 0 ? (
              <Empty>{showSugg ? "Rien encore. Cherchez un aliment." : "Aucun résultat dans CIQUAL."}</Empty>
            ) : (
              list.map((f) => (
                <Row key={f.ref + f.name} food={f} pinned={f.pinned}
                  onClick={() => setSel(f)}
                  onPin={showSugg ? () => onTogglePin(f.ref) : undefined}
                  onRemove={showSugg ? () => onMute(f.ref) : undefined}
                  onQuickAdd={showSugg ? () => onAdd(f, f.lastQ ?? f.defaultQ ?? 100) : undefined} />
              ))
            )}

            {!showSugg && <OffSection offState={offState} offResults={offResults} onPick={setSel} />}

            <div className="p-muted" style={{ marginTop: 14, textAlign: "center", fontSize: 12 }}>
              Table Ciqual 2020 — ANSES · Licence Ouverte 2.0<br />
              Open Food Facts · Licence Open Database (ODbL)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
