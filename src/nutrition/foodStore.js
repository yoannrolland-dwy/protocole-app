// Journal alimentaire — état et persistance du module Nutrition (M1).
//
// Isolation d'origine (M1, 01/08/2026) LEVÉE À M6 (02/08/2026) : `foodLog` est
// maintenant la source de vérité des macros. `deriveMacroLog()` pousse ses totaux
// quotidiens dans `macroLog` (voir NutritionTab.jsx), mais uniquement pour les dates où
// `foodLog` a réellement des entrées — l'historique Cronometer des jours antérieurs à
// l'existence du module n'est jamais touché. La lecture nutrition/eau depuis Health
// Connect est coupée (healthSync.js) : `foodLog` est désormais l'unique écrivain des
// macros au quotidien. L'eau reste une exception partagée (voir plus bas), inchangée.

import { useEffect, useState } from "react";
import { store } from "../store.js";
import { today as todayKey } from "../ui.jsx";

export const MEALS = [
  { key: "petitdej", label: "Petit-déjeuner" },
  { key: "dejeuner", label: "Déjeuner" },
  { key: "gouter", label: "Goûter" },
  { key: "diner", label: "Dîner" },
  { key: "autre", label: "Autre" },
];

export const MACROS = ["kcal", "prot", "gluc", "lip", "fib"];

// randomUUID exige un contexte sécurisé. La WebView Capacitor sert bien depuis un origine
// sécurisée, mais un repli coûte trois lignes et évite un plantage silencieux à la saisie.
export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`);

// Préfixe des saisies libres / ajouts rapides. CHAQUE entrée doit avoir un `ref` UNIQUE
// (jamais le littéral "quick") : `suggestions()`/`usageStats()` regroupent les lignes du
// journal par `ref` pour bâtir "Vos aliments habituels" — un ref partagé aurait fusionné
// "Whey vanille 30g" et un simple "ajout rapide de macros" en une seule entrée fantôme
// (la plus récente écrasant les autres), et masquer l'une depuis la liste des habituels
// (foodMuted) aurait alors masqué TOUTES les saisies libres futures. Trouvé le 02/08/2026.
export const QUICK_PREFIX = "quick:";
// "quick" (sans suffixe) reste reconnu pour les entrées déjà enregistrées avant ce
// correctif (02/08/2026) — elles gardent leur ref littérale telle quelle, seules les
// nouvelles saisies obtiennent un identifiant unique.
export const isQuickRef = (ref) => ref === "quick" || (typeof ref === "string" && ref.startsWith(QUICK_PREFIX));
export const newQuickRef = () => QUICK_PREFIX + newId();

/**
 * Une ligne de journal.
 *
 * `per100` est FIGÉ à la saisie (snapshot), pas résolu à la lecture : un produit Open Food
 * Facts peut être corrigé ou disparaître, et l'historique doit rester reproductible.
 * On ne fige que les 5 macros.
 *
 * Poids réel MESURÉ le 01/08/2026 : 236 octets par ligne une fois sérialisée (l'id UUID
 * et l'horodatage ISO pèsent à eux seuls 60 caractères). Soit ~2,4 Ko/jour à 10 lignes,
 * donc ~860 Ko par an — tenable sous le quota localStorage (5-10 Mo), mais plus le
 * poste négligeable qu'est `macroLog` (1 ligne/jour). C'est ce chiffre, et pas une
 * estimation, qui doit servir à décider d'un éventuel passage à SQLite.
 *
 * `ref` porte la source (`ciqual:` / `off:` / `custom:` / `quick`), ce qui rend la ligne
 * auto-suffisante pour être rejouée, dédupliquée et scorée.
 */
export function makeEntry({ date, meal, food, q }) {
  return {
    id: newId(),
    date,
    meal,
    ref: food.ref,
    name: food.name,
    q: Number(q),
    per100: {
      kcal: food.per100.kcal, prot: food.per100.prot,
      gluc: food.per100.gluc, lip: food.per100.lip, fib: food.per100.fib,
    },
    at: new Date().toISOString(),
  };
}

// Valeurs réelles d'une ligne = per100 × quantité / 100. `null` reste `null` : une donnée
// absente de la table ne doit jamais être présentée comme un zéro mesuré.
// Les calories sont arrondies à l'entier (une décimale de kcal n'a aucun sens et créait
// un écart visible entre le total d'un repas et la ligne qui le compose), les macros au
// dixième de gramme.
export function amounts(e) {
  const k = e.q / 100;
  const out = {};
  for (const m of MACROS) {
    const v = e.per100?.[m];
    out[m] = v === null || v === undefined ? null
      : m === "kcal" ? Math.round(v * k)
      : Math.round(v * k * 10) / 10;
  }
  return out;
}

export function entriesFor(log, date) {
  return log.filter((e) => e.date === date);
}

/**
 * Totaux d'un ensemble de lignes.
 * `missing` compte, par macro, les lignes dont la donnée est absente — pour que l'UI
 * puisse afficher un total honnête (« 148 g + ? ») plutôt qu'un chiffre faussement exact.
 */
export function totals(entries) {
  const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  const missing = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  for (const e of entries) {
    const a = amounts(e);
    for (const m of MACROS) {
      if (a[m] === null) missing[m]++;
      else t[m] += a[m];
    }
  }
  for (const m of MACROS) t[m] = m === "kcal" ? Math.round(t[m]) : Math.round(t[m] * 10) / 10;
  return { ...t, missing };
}

// --- Dérivation vers macroLog (M6) ------------------------------------------------
//
// `macroLog` suit des noms de champs différents de `foodLog` (hérités de MacroTab, très
// antérieur au module Nutrition) : protein/carbs/fat/fiber, pas prot/gluc/lip/fib.
// Même correspondance que `TARGET_KEY` dans NutritionTab.jsx pour les cibles.
const MACRO_FIELD = { prot: "protein", gluc: "carbs", lip: "fat", fib: "fiber" };

/**
 * Calcule, pour CHAQUE date présente dans `log`, les totaux macroLog dérivés de
 * `foodLog`. Ne retourne QUE les dates qui ont au moins une entrée — jamais la liste
 * complète de `macroLog`, pour ne jamais menacer les jours antérieurs à l'existence du
 * module (historique Cronometer). L'appelant (NutritionTab) est responsable de fusionner
 * ces totaux dans `macroLog` via `upsert`, qui préserve les champs non fournis (`water`
 * en particulier — cette fonction ne le touche jamais).
 */
export function deriveMacroLog(log) {
  const dates = [...new Set(log.map((e) => e.date))];
  return dates.map((date) => {
    const t = totals(entriesFor(log, date));
    const fields = { date, source: "foodlog" };
    for (const [k, name] of Object.entries(MACRO_FIELD)) fields[name] = t[k];
    return fields;
  });
}

// --- Copier un repas (M4) ------------------------------------------------------
//
// Distinct des "aliments habituels" : ici on rejoue TOUT un repas déjà loggé en une
// fois (utile en sèche répétitive — mêmes 3-4 aliments enchaînés), plutôt que de les
// rajouter un par un depuis la recherche.

/**
 * Jours candidats pour "copier un repas" : les jours passés (ou futurs déjà planifiés)
 * qui ont au moins une entrée sur CE repas précis, les plus récents en premier.
 */
export function copySourceCandidates(log, { meal, excludeDate, limit = 10 } = {}) {
  const byDate = new Map();
  for (const e of log) {
    if (e.meal !== meal || e.date === excludeDate) continue;
    let d = byDate.get(e.date);
    if (!d) byDate.set(e.date, (d = { date: e.date, count: 0, kcal: 0, missing: 0 }));
    d.count++;
    const a = amounts(e);
    if (a.kcal === null) d.missing++; else d.kcal += a.kcal;
  }
  return [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((d) => ({ ...d, kcal: Math.round(d.kcal) }));
}

/** Rejoue un ensemble d'entrées vers une autre date/repas : nouveaux id/horodatage,
 * `ref`/`per100` intacts (même snapshot, pas de re-résolution). */
export function copyEntries(entries, { date, meal }) {
  return entries.map((e) => ({
    ...e, id: newId(), date, meal, at: new Date().toISOString(),
  }));
}

// --- Portions nommées (M4) ------------------------------------------------------
//
// "1 pot = 125 g" plutôt que de retaper les grammes à chaque fois. Rangées par `ref`
// (pas par jour) : une portion apprise pour un aliment vaut pour toutes ses saisies
// futures, dans n'importe quel repas.

export function portionsFor(portions, ref) {
  return portions?.[ref] || [];
}

// --- Recettes (M4) ---------------------------------------------------------------
//
// Une recette compile une liste d'ingrédients en UN aliment (per100 sur le poids
// total), avec son propre `ref` stable (`recipe:<id>`) — elle traverse tout le reste
// du pipeline (recherche, QtyPanel, journal) exactement comme un aliment CIQUAL ou
// OFF, sans code dédié supplémentaire. Les ingrédients sont conservés dans l'objet
// pour référence mais ne sont PAS des lignes de journal : seule la recette compilée
// en est une une fois ajoutée à un repas.
//
// Une macro devient `null` sur toute la recette si NE SERAIT-CE QU'UN ingrédient avec
// une quantité > 0 a cette macro absente — additionner un nombre et une inconnue ne
// peut pas donner un vrai total, mieux vaut l'avouer que d'afficher un chiffre faux.
export function compileRecipe(name, ingredients) {
  const totalWeight = ingredients.reduce((s, i) => s + i.q, 0);
  const per100 = {};
  for (const m of MACROS) {
    let sum = 0, hasNull = false;
    for (const i of ingredients) {
      const v = i.per100?.[m];
      if (v === null || v === undefined) { if (i.q > 0) hasNull = true; continue; }
      sum += v * (i.q / 100);
    }
    per100[m] = hasNull || totalWeight === 0 ? null
      : m === "kcal" ? Math.round((sum / totalWeight) * 100)
      : Math.round((sum / totalWeight) * 100 * 10) / 10;
  }
  return {
    id: newId(),
    name: name.trim(),
    totalWeight,
    ingredients: ingredients.map((i) => ({ ref: i.ref, name: i.name, q: i.q })),
    per100,
    createdAt: new Date().toISOString(),
  };
}

/** Forme "aliment" d'une recette stockée, pour l'utiliser dans la recherche/QtyPanel
 * exactement comme un résultat CIQUAL/OFF. `defaultQ` = tout le lot (pas 100 g) : une
 * recette se mange en général en une fois, pas par portion de 100 g. */
export function recipeAsFood(r) {
  return { ref: `recipe:${r.id}`, name: r.name, grp: `Recette · ${r.totalWeight} g`, per100: r.per100, defaultQ: r.totalWeight };
}

export const isRecipeRef = (ref) => typeof ref === "string" && ref.startsWith("recipe:");

// --- Favoris et historique intelligent ---------------------------------------
//
// Rien n'est stocké : tout se DÉRIVE de `foodLog`. Une liste de favoris entretenue en
// parallèle finirait forcément par diverger du journal (aliment supprimé, renommé,
// import JSON partiel) ; dérivée, elle est juste par construction et coûte zéro octet.

const WINDOW_DAYS = 60;

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/**
 * Statistiques d'usage par `ref` sur les 60 derniers jours.
 * @returns {Map<string, {ref, name, per100, freq, mealFreq, days}>}
 */
export function usageStats(log, { meal, date = todayKey() } = {}) {
  const stats = new Map();
  for (const e of log) {
    const age = daysBetween(e.date, date);
    if (age < 0 || age > WINDOW_DAYS) continue;
    let s = stats.get(e.ref);
    if (!s) stats.set(e.ref, (s = { ref: e.ref, name: e.name, per100: e.per100, freq: 0, mealFreq: 0, days: age, lastQ: e.q }));
    s.freq++;
    if (meal && e.meal === meal) s.mealFreq++;
    if (age <= s.days) { s.days = age; s.name = e.name; s.per100 = e.per100; s.lastQ = e.q; }
  }
  return stats;
}

// Fréquence + spécificité au repas + récence. Le facteur 2 sur `mealFreq` fait qu'un
// aliment mangé tous les matins domine la liste du petit-déjeuner sans polluer celle du
// dîner, ce qui est le comportement recherché.
const score = (s) => s.freq + 2 * s.mealFreq + Math.max(0, 14 - s.days);

/**
 * Aliments à proposer avant toute frappe (l'écran d'ajout ouvre là-dessus).
 * `muted` retire un aliment de CETTE liste — pas de foodLog : demandé pour désencombrer
 * "Vos aliments habituels" (un essai raté, un aliment qu'on ne mange plus), sans jamais
 * toucher à l'historique réel des jours déjà enregistrés.
 */
export function suggestions(log, { meal, pins = [], muted = [], limit = 25, date = todayKey() } = {}) {
  const stats = usageStats(log, { meal, date });
  const pinned = new Set(pins);
  const hidden = new Set(muted);
  return [...stats.values()]
    .filter((s) => !hidden.has(s.ref))
    .map((s) => ({ ...s, _s: score(s) + (pinned.has(s.ref) ? 1000 : 0) }))
    .sort((a, b) => b._s - a._s)
    .slice(0, limit)
    .map((s) => ({ ref: s.ref, name: s.name, per100: s.per100, lastQ: s.lastQ, pinned: pinned.has(s.ref) }));
}

/**
 * Bonus à injecter dans searchCiqual : fait remonter ce que l'utilisateur mange vraiment.
 * Plafonné à 30 points — de quoi départager des résultats proches (les scores textuels
 * tournent autour de 90-200), jamais de quoi imposer un aliment hors sujet.
 */
export function searchBoost(log, { meal, date = todayKey() } = {}) {
  const stats = usageStats(log, { meal, date });
  const byCode = new Map();
  for (const s of stats.values()) {
    const m = /^ciqual:(\d+)$/.exec(s.ref);
    if (m) byCode.set(Number(m[1]), Math.min(30, score(s)));
  }
  return (code) => byCode.get(code) || 0;
}

// --- Hook de persistance ------------------------------------------------------

export function useFoodLog() {
  const [log, setLog] = useState([]);
  const [pins, setPins] = useState([]);
  const [muted, setMuted] = useState([]);
  const [portions, setPortions] = useState({});
  const [recipes, setRecipes] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLog(await store.get("foodLog", []));
      setPins(await store.get("foodPins", []));
      setMuted(await store.get("foodMuted", []));
      setPortions(await store.get("foodPortions", {}));
      setRecipes(await store.get("foodRecipes", []));
      setReady(true);
    })();
  }, []);

  const write = (next) => { setLog(next); store.set("foodLog", next); };

  return {
    log,
    pins,
    muted,
    portions,
    recipes,
    ready,
    add: (e) => write([...log, e]),
    addMany: (es) => write([...log, ...es]),
    update: (id, patch) => write(log.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    remove: (id) => write(log.filter((e) => e.id !== id)),
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
  };
}
