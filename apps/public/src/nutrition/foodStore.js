// Journal alimentaire — état et persistance côté apps/public (RawCare Phase 2).
//
// Les fonctions pures viennent de @rawcare/core/nutrition/foodStore (identiques à
// apps/perso) : ce fichier les ré-exporte pour que NutritionTab.jsx/FoodSearch.jsx
// importent depuis "./foodStore.js" comme côté perso, et ajoute par-dessus un hook
// useFoodLog(data, update) adapté au backend Supabase (apps/perso a le sien, dépendant
// de store.js/localStorage).
//
// Point d'architecture (voir CLAUDE.md, Chantier RawCare Phase 2, jalon Repas) :
// update() (useUserData.js) fait un aller-retour réseau et fusionne sur la base du
// `data` capturé en fermeture — deux update() consécutifs pour une même action (écrire
// foodLog PUIS dériver macroLog) risqueraient qu'un second appel parte d'un `data` pas
// encore rafraîchi par le premier et écrase son résultat. Chaque mutation qui touche
// foodLog/foodOverrides calcule donc la dérivation macroLog DANS LA MÊME FONCTION,
// avant persistance, et envoie UN SEUL update({ foodLog, macroLog }) (ou
// { foodOverrides, macroLog } pour une correction V6, qui ne touche pas foodLog).

import { useMemo, useState } from "react";
import { upsert } from "@rawcare/core/dateUtils";
import { resolveLog, deriveMacroLog } from "@rawcare/core/nutrition/foodStore";

export * from "@rawcare/core/nutrition/foodStore";

export function useFoodLog(data, update) {
  const raw = data?.foodLog || [];
  const pins = data?.foodPins || [];
  const muted = data?.foodMuted || [];
  const portions = data?.foodPortions || {};
  const recipes = data?.foodRecipes || [];
  const overrides = data?.foodOverrides || {};
  const macros = data?.macroLog || [];

  const log = useMemo(() => resolveLog(raw, overrides), [raw, overrides]);
  const [error, setError] = useState("");

  const persist = async (patch) => {
    setError("");
    try {
      await update(patch);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  // Dérive macroLog depuis le journal résolu (corrections comprises) et fusionne avec
  // les totaux déjà stockés (préserve `water`, jamais porté par la dérivation — upsert
  // fusionne, ne remplace pas). Même condition de changement que la bascule M6 d'apps/perso.
  const persistFood = (nextRaw, nextOverrides = overrides) => {
    const nextLog = resolveLog(nextRaw, nextOverrides);
    const derived = deriveMacroLog(nextLog);
    let nextMacros = macros;
    for (const d of derived) {
      const cur = nextMacros.find((m) => m.date === d.date);
      if (!cur || cur.protein !== d.protein || cur.carbs !== d.carbs || cur.fat !== d.fat
        || cur.fiber !== d.fiber || cur.kcal !== d.kcal || cur.source !== "foodlog") {
        nextMacros = upsert(nextMacros, d);
      }
    }
    const patch = { foodLog: nextRaw, macroLog: nextMacros };
    if (nextOverrides !== overrides) patch.foodOverrides = nextOverrides;
    return persist(patch);
  };

  return {
    log,
    overrides,
    pins,
    muted,
    portions,
    recipes,
    error,
    add: (e) => persistFood([...raw, e]),
    addMany: (es) => persistFood([...raw, ...es]),
    update: (id, patch) => persistFood(raw.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    remove: (id) => persistFood(raw.filter((e) => e.id !== id)),
    saveOverride: (ref, patch) => {
      const merged = { ...(overrides[ref] || {}) };
      for (const [m, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") delete merged[m];
        else merged[m] = Number(v);
      }
      const next = { ...overrides };
      if (Object.keys(merged).length) next[ref] = merged; else delete next[ref];
      return persistFood(raw, next);
    },
    clearOverride: (ref) => {
      const next = { ...overrides };
      delete next[ref];
      return persistFood(raw, next);
    },
    togglePin: (ref) => {
      const next = pins.includes(ref) ? pins.filter((r) => r !== ref) : [...pins, ref];
      return persist({ foodPins: next });
    },
    // Épinglé et masqué sont mutuellement exclusifs (voir apps/perso).
    muteFromSuggestions: (ref) => {
      const nextMuted = muted.includes(ref) ? muted : [...muted, ref];
      const patch = { foodMuted: nextMuted };
      if (pins.includes(ref)) patch.foodPins = pins.filter((r) => r !== ref);
      return persist(patch);
    },
    savePortion: (ref, label, grams) => {
      const list = portions[ref] || [];
      const next = { ...portions, [ref]: [...list.filter((p) => p.label !== label), { label, grams }] };
      return persist({ foodPortions: next });
    },
    removePortion: (ref, label) => {
      const next = { ...portions, [ref]: (portions[ref] || []).filter((p) => p.label !== label) };
      return persist({ foodPortions: next });
    },
    addRecipe: (r) => persist({ foodRecipes: [...recipes, r] }),
    removeRecipe: (id) => persist({ foodRecipes: recipes.filter((r) => r.id !== id) }),
    updateRecipe: (r) => persist({ foodRecipes: recipes.map((x) => (x.id === r.id ? r : x)) }),
  };
}
