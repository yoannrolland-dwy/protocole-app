// Journal alimentaire — état et persistance du module Nutrition (M1).
//
// Les fonctions pures ont déménagé vers @rawcare/core/nutrition/foodStore le 05/08/2026
// (chantier RawCare Phase 0, logique inchangée) : ce fichier les ré-exporte pour que
// NutritionTab.jsx/FoodSearch.jsx continuent d'importer depuis "./foodStore.js" sans
// aucun changement, et ne garde que le hook `useFoodLog()` — spécifique à cette app car il
// dépend de `store.js` (persistance localStorage).

import { useEffect, useMemo, useState } from "react";
import { store } from "../store.js";
import { resolveLog } from "@rawcare/core/nutrition/foodStore";

export * from "@rawcare/core/nutrition/foodStore";

// --- Hook de persistance ------------------------------------------------------

export function useFoodLog() {
  // `raw` = ce qui est stocké (snapshots d'origine intacts). `log` = ce que voit le reste
  // de l'app (corrections appliquées). Les mutations partent TOUJOURS de `raw` : sans ça,
  // la première modification d'une ligne figerait la valeur corrigée dans le journal et la
  // correction cesserait d'être réversible.
  const [raw, setLog] = useState([]);
  const [pins, setPins] = useState([]);
  const [muted, setMuted] = useState([]);
  const [portions, setPortions] = useState({});
  const [recipes, setRecipes] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLog(await store.get("foodLog", []));
      setPins(await store.get("foodPins", []));
      setMuted(await store.get("foodMuted", []));
      setPortions(await store.get("foodPortions", {}));
      setRecipes(await store.get("foodRecipes", []));
      setOverrides(await store.get("foodOverrides", {}));
      setReady(true);
    })();
  }, []);

  const write = (next) => { setLog(next); store.set("foodLog", next); };
  const log = useMemo(() => resolveLog(raw, overrides), [raw, overrides]);

  return {
    log,
    overrides,
    pins,
    muted,
    portions,
    recipes,
    ready,
    add: (e) => write([...raw, e]),
    addMany: (es) => write([...raw, ...es]),
    update: (id, patch) => write(raw.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    remove: (id) => write(raw.filter((e) => e.id !== id)),
    /**
     * Enregistre/retire une correction pour un `ref`. `patch` ne porte que les champs
     * touchés ; une valeur `null` efface la correction de ce champ et rend sa valeur
     * d'origine à toutes les lignes concernées. Le `ref` disparaît de la table quand il
     * n'a plus aucune correction — pas d'entrée vide qui traînerait dans l'export.
     */
    saveOverride: (ref, patch) => {
      const merged = { ...(overrides[ref] || {}) };
      for (const [m, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") delete merged[m];
        else merged[m] = Number(v);
      }
      const next = { ...overrides };
      if (Object.keys(merged).length) next[ref] = merged; else delete next[ref];
      setOverrides(next);
      store.set("foodOverrides", next);
    },
    clearOverride: (ref) => {
      const next = { ...overrides };
      delete next[ref];
      setOverrides(next);
      store.set("foodOverrides", next);
    },
    togglePin: (ref) => {
      const next = pins.includes(ref) ? pins.filter((r) => r !== ref) : [...pins, ref];
      setPins(next);
      store.set("foodPins", next);
    },
    // Épinglé et masqué sont mutuellement exclusifs : masquer un aliment qu'on avait
    // épinglé par erreur doit aussi le désépingler, sinon il resterait invisible malgré
    // un score artificiellement forcé en tête.
    muteFromSuggestions: (ref) => {
      const nextMuted = muted.includes(ref) ? muted : [...muted, ref];
      setMuted(nextMuted);
      store.set("foodMuted", nextMuted);
      if (pins.includes(ref)) {
        const nextPins = pins.filter((r) => r !== ref);
        setPins(nextPins);
        store.set("foodPins", nextPins);
      }
    },
    savePortion: (ref, label, grams) => {
      const list = portions[ref] || [];
      // Même libellé retapé = on remplace, pas de doublon silencieux.
      const next = { ...portions, [ref]: [...list.filter((p) => p.label !== label), { label, grams }] };
      setPortions(next);
      store.set("foodPortions", next);
    },
    removePortion: (ref, label) => {
      const next = { ...portions, [ref]: (portions[ref] || []).filter((p) => p.label !== label) };
      setPortions(next);
      store.set("foodPortions", next);
    },
    addRecipe: (r) => {
      const next = [...recipes, r];
      setRecipes(next);
      store.set("foodRecipes", next);
    },
    removeRecipe: (id) => {
      const next = recipes.filter((r) => r.id !== id);
      setRecipes(next);
      store.set("foodRecipes", next);
    },
    updateRecipe: (r) => {
      const next = recipes.map((x) => (x.id === r.id ? r : x));
      setRecipes(next);
      store.set("foodRecipes", next);
    },
  };
}
