// Pont privé PROTOCOLE → JEFFREY, étape G3 (05/11/2026) : l'appli JEFFREY agit dans PROTOCOLE à la
// voix. Elle relit l'action à Monsieur (`verifier: true` : rien n'est écrit, PROTOCOLE renvoie la
// phrase à dire), attend un « oui », puis demande l'écriture (`verifier: false`).
//
// Ce module ne fait que VÉRIFIER et DÉCRIRE une action ; l'écriture reste celle de l'app
// (`applyActionStored`, mêmes écritures que les écrans). Aucune règle métier nouvelle : les
// actions de Jeffrey existantes passent par `validateAction` ; les deux nouvelles reprennent les
// règles des écrans (poids : saisie manuelle de l'onglet Poids, jamais à la place d'une pesée de
// la balance ; aliment : mêmes quantités proposées que l'écran d'ajout).
//
// Choix de Yoann (05/11/2026) :
// - poids : refusé si la pesée du jour vient déjà de la balance (Health Connect la remettrait) ;
// - aliment sans quantité : recette = 1 portion, aliment déjà mangé = quantité de la dernière
//   fois, aliment jamais mangé = demander les grammes ;
// - recherche : ses recettes et ce qu'il a mangé sur 60 jours, puis CIQUAL (pas d'Open Food Facts) ;
// - date : aujourd'hui, et aussi demain pour les trois actions de repas (comme l'onglet
//   Nutrition, seul écran qui accepte une date future : on planifie un repas, on ne mesure pas
//   demain son genou ni son poids).

import { validateAction } from "./jeffrey.js";
import { shiftDateKey, round } from "../dateUtils.js";
import {
  MEALS, usageStats, recipeAsFood, recipePortions, resolveLog, amounts,
} from "../nutrition/foodStore.js";

export const MEAL_ACTIONS = new Set(["reprendre_repas", "ajouter_habituel", "ajouter_aliment"]);

/** Catalogue des actions du pont (sert à la validation des noms et à la documentation). */
export const AGIR_ACTIONS = [
  "ajouter_eau", "noter_genou", "ecrire_note", "noter_poids",
  "reprendre_repas", "ajouter_habituel", "ajouter_aliment",
];

const CHOICES_MAX = 5;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const kgText = (kg) => `${String(kg).replace(".", ",")} kg`;
const mealOf = (key) => MEALS.find((m) => m.key === key);
const atMeal = (key) => (key === "autre" ? "en Extra" : `au ${mealOf(key).label.toLowerCase()}`);
const ofMeal = (key) => (key === "autre" ? "l'Extra" : `le ${mealOf(key).label.toLowerCase()}`);
const dayWord = (jour) => (jour === "demain" ? "de demain" : "d'aujourd'hui");
const fail = (raison, extra = {}) => ({ ok: false, raison, ...extra });

/** Jour visé → { jour, date } ou erreur. `demain` n'est permis que pour les actions de repas. */
function dayOf(action, parametres, today) {
  const jour = parametres?.jour ?? "aujourdhui";
  if (jour !== "aujourdhui" && jour !== "demain") return fail(`jour inconnu : ${jour} (aujourdhui ou demain)`);
  if (jour === "demain" && !MEAL_ACTIONS.has(action)) return fail("cette action ne se fait que pour aujourd'hui");
  return { ok: true, jour, date: jour === "demain" ? shiftDateKey(today, 1) : today };
}

/** Nombre JSON ou texte « 93,4 ». */
const num = (v) => (typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN);

function checkWeight(parametres, { weight, date }) {
  const kg = num(parametres?.kg);
  if (!Number.isFinite(kg) || kg < 40 || kg > 200) return fail("poids hors de 40 à 200 kg");
  const value = round(kg, 1);
  const cur = (weight || []).find((w) => w.date === date);
  if (cur?.source === "healthconnect") {
    return fail(`la pesée d'aujourd'hui vient déjà de la balance (${kgText(cur.kg)}) : elle n'est pas remplacée`);
  }
  const instead = cur?.kg != null ? `, à la place de ${kgText(cur.kg)}` : "";
  return { ok: true, act: { kind: "poids", date, kg: value }, resume: `Noter ${kgText(value)} aujourd'hui${instead}` };
}

/** Aliments de Monsieur : ses recettes, puis tout ce qu'il a mangé sur 60 jours, tous repas. */
function ownFoods(ctx) {
  const out = new Map();
  for (const r of ctx.recipes || []) {
    const f = recipeAsFood(r);
    out.set(f.ref, { ref: f.ref, name: f.name, per100: f.per100, recipe: r });
  }
  for (const s of usageStats(ctx.foodLog || [], { date: ctx.today }).values()) {
    if (out.has(s.ref)) out.get(s.ref).lastQ = s.lastQ;
    else out.set(s.ref, { ref: s.ref, name: s.name, per100: s.per100, lastQ: s.lastQ, freq: s.freq });
  }
  return [...out.values()];
}

/** Choisit l'aliment nommé → { ok, food } ou un refus (avec `choix` s'il y en a plusieurs). */
async function findFood(parametres, ctx) {
  const own = ownFoods(ctx);
  const ref = parametres?.ref;
  if (ref) {
    const hit = own.find((f) => f.ref === ref);
    if (hit) return { ok: true, food: hit };
    const code = /^ciqual:(\d+)$/.exec(ref)?.[1];
    const ciq = code ? await ctx.ciqual.get(code) : null;
    return ciq ? { ok: true, food: { ref: ciq.ref, name: ciq.name, per100: ciq.per100 } } : fail(`aliment inconnu : ${ref}`);
  }
  const asked = norm(parametres?.aliment);
  if (!asked) return fail("nom d'aliment vide");
  const words = asked.split(" ");
  const match = own.filter((f) => words.every((w) => norm(f.name).includes(w)));
  const exact = match.filter((f) => norm(f.name) === asked);
  if (exact.length === 1) return { ok: true, food: exact[0] };
  if (match.length === 1) return { ok: true, food: match[0] };
  const several = (list) => fail("plusieurs aliments correspondent : demandez à Monsieur lequel", {
    choix: list.slice(0, CHOICES_MAX).map((f) => ({ ref: f.ref, nom: f.name })),
  });
  if (match.length > 1) {
    // Recettes d'abord, puis les plus mangés.
    return several([...match].sort((a, b) => (b.recipe ? 1 : 0) - (a.recipe ? 1 : 0) || (b.freq ?? 0) - (a.freq ?? 0)));
  }
  const found = await ctx.ciqual.search(parametres.aliment, CHOICES_MAX);
  if (!found.length) return fail(`aucun aliment « ${parametres.aliment} » ni dans les aliments de Monsieur ni dans la table CIQUAL`);
  if (found.length === 1) return { ok: true, food: { ref: found[0].ref, name: found[0].name, per100: found[0].per100 } };
  return several(found.map((f) => ({ ref: f.ref, name: f.name })));
}

/** Quantité : grammes dits, sinon portions d'une recette (1 par défaut), sinon la dernière fois. */
function quantityOf(food, parametres) {
  if (parametres?.grammes != null) {
    const g = Math.round(num(parametres.grammes));
    if (!Number.isFinite(g) || g < 1 || g > 2000) return fail("quantité hors de 1 à 2000 g");
    return { ok: true, q: g, how: `${g} g` };
  }
  if (food.recipe) {
    const max = recipePortions(food.recipe);
    const n = parametres?.portions == null ? 1 : Math.round(num(parametres.portions));
    if (!Number.isFinite(n) || n < 1 || n > max) return fail(`la recette compte ${max} portion${max > 1 ? "s" : ""}`);
    const q = Math.round((food.recipe.totalWeight * n) / max);
    return { ok: true, q, how: max > 1 ? `${n} portion${n > 1 ? "s" : ""} (${q} g)` : `${q} g` };
  }
  if (parametres?.portions != null) return fail("les portions ne valent que pour une recette : donnez les grammes");
  if (food.lastQ) return { ok: true, q: food.lastQ, how: `${food.lastQ} g, comme la dernière fois` };
  return fail(`quantité manquante pour ${food.name} : demandez à Monsieur combien de grammes`, { besoin: "grammes" });
}

async function checkFood(parametres, ctx, { jour, date }) {
  const meal = parametres?.repas;
  if (!mealOf(meal)) return fail(`repas inconnu : ${meal}`);
  const f = await findFood(parametres, ctx);
  if (!f.ok) return f;
  const qty = quantityOf(f.food, parametres);
  if (!qty.ok) return qty;
  const food = { ref: f.food.ref, name: f.food.name, per100: f.food.per100 };
  const kcal = amounts(resolveLog([{ ...food, q: qty.q }], ctx.overrides)[0]).kcal;
  return {
    ok: true,
    act: { kind: "aliment", date, meal, food, q: qty.q, kcal },
    resume: `Ajouter ${food.name}, ${qty.how}, ${atMeal(meal)} ${dayWord(jour)}${kcal != null ? ` (${kcal} kcal)` : ""}`,
  };
}

const namesOf = (items) => {
  const names = items.slice(0, 4).map((i) => i.name);
  return items.length > 4 ? `${names.join(", ")}…` : names.join(", ");
};

/**
 * Vérifie une action demandée par JEFFREY, sans rien écrire.
 * → { ok: true, act, resume } (`act` : ce que `applyActionStored` écrira, avec sa date ;
 *   `resume` : la phrase que JEFFREY relit à Monsieur) ou { ok: false, raison, choix?, besoin? }.
 * `ctx` = { today, weight, knee, macros, foodLog (brut), overrides, mealPins, mealMuted,
 *   recipes, ciqual: { search(q, limit), get(code) } }.
 * Lève `{ code: "inconnu" }` pour une action hors catalogue.
 */
export async function checkAgir(action, parametres, ctx) {
  if (!AGIR_ACTIONS.includes(action)) throw Object.assign(new Error("action inconnue"), { code: "inconnu" });
  const p = parametres && typeof parametres === "object" ? parametres : {};
  const d = dayOf(action, p, ctx.today);
  if (!d.ok) return d;
  const { jour, date } = d;

  if (action === "noter_poids") return checkWeight(p, { weight: ctx.weight, date });
  if (action === "ajouter_aliment") return checkFood(p, ctx, d);

  const foodCtx = { foodLog: ctx.foodLog, overrides: ctx.overrides, mealPins: ctx.mealPins, mealMuted: ctx.mealMuted, today: date };
  const v = validateAction(action, p, foodCtx);
  if (!v.ok) return fail(v.reason);
  const a = { ...v.action, date };

  if (a.kind === "eau") {
    const before = (ctx.macros || []).find((m) => m.date === date)?.water ?? 0;
    return { ok: true, act: a, resume: `Ajouter ${a.ml} ml d'eau aujourd'hui (total ${before + a.ml} ml)` };
  }
  if (a.kind === "genou") {
    // À la voix, pas de carte « Oui / Non » : JEFFREY pose la question de Silbernagel avant.
    if (a.baseline == null) return fail("demandez à Monsieur si la douleur est revenue à son niveau de base sous 24 heures", { besoin: "retour_base" });
    const cur = (ctx.knee || []).find((k) => k.date === date);
    const instead = cur?.pain != null ? `, à la place de ${cur.pain} sur 10` : "";
    return { ok: true, act: a, resume: `Noter le genou à ${a.pain} sur 10 aujourd'hui, ${a.baseline ? "revenu à la base" : "pas revenu à la base"}${instead}` };
  }
  if (a.kind === "note") return { ok: true, act: a, resume: `Ajouter à la note du jour : « ${a.text} »` };
  if (a.kind === "repas") {
    const from = jour === "demain" ? "d'aujourd'hui" : "d'hier";
    const kept = !a.already ? "" : a.already === 1 ? " ; l'aliment déjà noté reste" : ` ; les ${a.already} aliments déjà notés restent`;
    return { ok: true, act: a, resume: `Reprendre ${ofMeal(a.meal)} ${from} pour ${jour === "demain" ? "demain" : "aujourd'hui"} : ${namesOf(a.items)}, ${a.kcal} kcal${kept}` };
  }
  // Habituel : un aliment de ce repas, à la quantité de la dernière fois.
  return { ok: true, act: a, resume: `Ajouter ${a.food.name}, ${a.q} g, comme la dernière fois, ${atMeal(a.meal)} ${dayWord(jour)}${a.kcal != null ? ` (${a.kcal} kcal)` : ""}` };
}

/** Phrase de ce qui a été écrit (réponse de `agir` avec `verifier: false`). `change` : eau
 *  avant/après rendue par l'écriture. */
export function doneSummary(act, change) {
  if (act.kind === "eau" && change) return `${act.ml} ml d'eau ajoutés : ${change.after} ml aujourd'hui`;
  if (act.kind === "genou") return `Genou noté à ${act.pain} sur 10, ${act.baseline ? "revenu à la base" : "pas revenu à la base"}`;
  if (act.kind === "note") return `Note du jour complétée : « ${act.text} »`;
  if (act.kind === "poids") return `${kgText(act.kg)} notés aujourd'hui`;
  if (act.kind === "repas") return `${act.items.length} aliment${act.items.length > 1 ? "s" : ""} ajouté${act.items.length > 1 ? "s" : ""} (${act.kcal} kcal)`;
  return `${act.food.name}, ${act.q} g, ajouté${act.kcal != null ? ` (${act.kcal} kcal)` : ""}`;
}

/** Clé stable des paramètres (ordre des champs indifférent) : la relecture et l'écriture doivent
 *  porter sur exactement la même demande. */
export function paramsKey(action, parametres) {
  const p = parametres && typeof parametres === "object" ? parametres : {};
  return JSON.stringify([action, Object.keys(p).sort().map((k) => [k, p[k]])]);
}
