// Modifier à la voix, lots 2 et 3 (25/11/2026) : JEFFREY corrige un aliment d'un repas (grammes,
// repas, retrait) et les mesures d'un jour (poids, genou, eau, note), comme Monsieur à l'écran.
// Cadrage : jeffrey-app/docs/cadrage/PROTOCOLE_MODIFIER.md. Choix de Yoann :
// - aujourd'hui, hier ou un jour des 7 derniers jours (jamais plus loin, jamais un jour à venir) ;
// - effacer est permis à la voix ; toujours relu avec l'avant et l'après, puis « oui » (pont, runAgir) ;
// - mêmes règles que les écrans : pas de grammes pour une saisie libre (portion), un poids venu de la
//   balance (Santé Connect) n'est ni corrigé ni effacé (il serait remis), un genou au-dessus de 0
//   demande s'il est revenu à la base sous 24 h.
//
// Module pur : il VÉRIFIE et DÉCRIT ; l'écriture est `applyActionStored` (apps/perso/src/lib/jeffreyNotify.js).

import { shiftDateKey, upsert } from "../dateUtils.js";
import { MEALS, isQuickRef } from "../nutrition/foodStore.js";

export const EDIT_ACTIONS = [
  "modifier_aliment", "retirer_aliment",
  "corriger_poids", "corriger_genou", "corriger_eau", "corriger_note",
];
export const EDIT_DAYS = 7;

const fail = (raison, extra = {}) => ({ ok: false, raison, ...extra });
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => (typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN);
const kgText = (kg) => `${String(kg).replace(".", ",")} kg`;
const mealOf = (key) => MEALS.find((m) => m.key === key);
const mealWord = (key) => (key === "autre" ? "l'Extra" : `le ${mealOf(key).label.toLowerCase()}`);
const ofMealWord = (key) => (key === "autre" ? "de l'Extra" : `du ${mealOf(key).label.toLowerCase()}`);
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « d'aujourd'hui », « d'hier », « du lundi 23 novembre ». */
export function dayWords(date, today) {
  if (date === today) return "d'aujourd'hui";
  if (date === shiftDateKey(today, -1)) return "d'hier";
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `du ${DAYS[dow]} ${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}

/** `jour` : aujourdhui (défaut), hier, ou une date AAAA-MM-JJ des 7 derniers jours. → { ok, date } ou un refus. */
export function editDay(p, today) {
  const jour = p?.jour ?? "aujourdhui";
  let date;
  if (jour === "aujourdhui") date = today;
  else if (jour === "hier") date = shiftDateKey(today, -1);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(String(jour))) date = jour;
  else return fail(`jour illisible : ${jour} (aujourdhui, hier ou AAAA-MM-JJ)`);
  if (date > today) return fail("on ne corrige pas un jour à venir");
  if (date < shiftDateKey(today, -EDIT_DAYS)) return fail(`trop ancien : seulement les ${EDIT_DAYS} derniers jours`);
  return { ok: true, date };
}

const qText = (e) => (isQuickRef(e.ref) ? "une portion" : `${e.q} g`);

/** L'aliment nommé dans le journal du jour (et du repas si donné) → { ok, entry } ou un refus avec `choix`. */
function findEntry(foodLog, date, today, p) {
  const asked = norm(p?.aliment);
  if (!asked) return fail("aliment manquant : demandez à Monsieur lequel", { besoin: "aliment" });
  if (p?.repas != null && !mealOf(p.repas)) return fail(`repas inconnu : ${p.repas} (${MEALS.map((m) => m.key).join(", ")})`);
  const words = asked.split(" ");
  const day = (foodLog || []).filter((e) => e.date === date && (p?.repas == null || e.meal === p.repas));
  const match = day.filter((e) => words.every((w) => norm(e.name).includes(w)));
  const exact = match.filter((e) => norm(e.name) === asked);
  const found = exact.length === 1 ? exact : match;
  if (found.length === 1) return { ok: true, entry: found[0] };
  if (found.length > 1) {
    // Le même aliment à plusieurs repas : c'est le repas qui manque. Des aliments différents : leurs noms exacts.
    const names = [...new Set(found.map((e) => e.name))];
    if (names.length === 1) {
      return fail(`${names[0]} est noté ${found.map((e) => `${mealWord(e.meal).replace(/^le /, "au ").replace(/^l'Extra$/, "en Extra")} (${qText(e)})`).join(" et ")} : demandez à Monsieur lequel, puis rappelez avec « repas »`, { besoin: "repas" });
    }
    return fail("plusieurs aliments correspondent : demandez à Monsieur lequel", { choix: names.slice(0, 5) });
  }
  const where = p?.repas != null ? ` ${ofMealWord(p.repas)}` : "";
  return fail(`aucun aliment « ${p.aliment} »${where} ${dayWords(date, today)} dans le journal`);
}

function checkFoodEdit(action, p, ctx, date) {
  const f = findEntry(ctx.foodLog, date, ctx.today, p);
  if (!f.ok) return f;
  const e = f.entry;
  const day = dayWords(date, ctx.today);
  if (action === "retirer_aliment") {
    return { ok: true, act: { kind: "aliment_retrait", date, id: e.id },
      resume: `Retirer ${e.name}, ${qText(e)}, ${ofMealWord(e.meal)} ${day}` };
  }
  const patch = {};
  const parts = [];
  if (p?.grammes == null && p?.vers_repas == null) return fail("rien à corriger : grammes ou vers_repas", { besoin: "valeur" });
  if (p?.grammes != null) {
    if (isQuickRef(e.ref)) return fail(`${e.name} est une saisie libre (une portion) : ses grammes ne se changent pas`);
    const g = Math.round(num(p.grammes));
    if (!Number.isFinite(g) || g < 1 || g > 2000) return fail("grammes hors de 1 à 2000");
    if (g !== e.q) { patch.q = g; parts.push(`${g} g au lieu de ${e.q} g`); }
  }
  if (p?.vers_repas != null) {
    if (!mealOf(p.vers_repas)) return fail(`repas inconnu : ${p.vers_repas} (${MEALS.map((m) => m.key).join(", ")})`);
    if (p.vers_repas !== e.meal) { patch.meal = p.vers_repas; parts.push(`déplacé vers ${mealWord(p.vers_repas)}`); }
  }
  if (!parts.length) return fail(`rien ne change : ${e.name}, ${qText(e)}, ${ofMealWord(e.meal)} ${day}`);
  return { ok: true, act: { kind: "aliment_modif", date, id: e.id, patch },
    resume: `Corriger ${e.name} ${ofMealWord(e.meal)} ${day} : ${parts.join(", ")}` };
}

function checkWeightEdit(p, ctx, date) {
  const cur = (ctx.weight || []).find((w) => w.date === date);
  const day = dayWords(date, ctx.today);
  if (cur?.source === "healthconnect") return fail(`le poids ${day} vient de la balance (${kgText(cur.kg)}) : Santé Connect le remettrait. À corriger dans PROTOCOLE, onglet Poids`);
  if (p?.effacer === true) {
    if (!cur) return fail(`aucun poids noté ${day}`);
    return { ok: true, act: { kind: "poids_efface", date }, resume: `Effacer le poids ${day}, ${kgText(cur.kg)}` };
  }
  const kg = Math.round(num(p?.kg) * 10) / 10;
  if (!Number.isFinite(kg) || kg < 40 || kg > 200) return fail("poids hors de 40 à 200 kg", { besoin: "kg" });
  if (cur?.kg === kg) return fail(`rien ne change : ${kgText(kg)} ${day}`);
  return { ok: true, act: { kind: "poids", date, kg },
    resume: cur ? `Corriger le poids ${day} : ${kgText(kg)} au lieu de ${kgText(cur.kg)}` : `Noter ${kgText(kg)} ${day}` };
}

function checkKneeEdit(p, ctx, date) {
  const cur = (ctx.knee || []).find((k) => k.date === date);
  const day = dayWords(date, ctx.today);
  if (p?.effacer === true) {
    if (!cur) return fail(`aucune douleur du genou notée ${day}`);
    return { ok: true, act: { kind: "genou_efface", date }, resume: `Effacer le genou ${day}, ${cur.pain} sur 10` };
  }
  const pain = Number(p?.douleur);
  if (!Number.isInteger(pain) || pain < 0 || pain > 10) return fail("douleur hors de 0 à 10", { besoin: "douleur" });
  // 0 = à la base ; sinon la question de Silbernagel est posée avant (même règle que noter_genou).
  const baseline = pain === 0 ? true : typeof p?.retour_base === "boolean" ? p.retour_base : null;
  if (baseline == null) return fail("demandez à Monsieur si la douleur est revenue à son niveau de base sous 24 heures", { besoin: "retour_base" });
  if (cur && cur.pain === pain && cur.baseline === baseline) return fail(`rien ne change : ${pain} sur 10 ${day}`);
  const base = baseline ? "revenu à la base" : "pas revenu à la base";
  return { ok: true, act: { kind: "genou", date, pain, baseline },
    resume: cur ? `Corriger le genou ${day} : ${pain} sur 10, ${base}, au lieu de ${cur.pain} sur 10` : `Noter le genou à ${pain} sur 10 ${day}, ${base}` };
}

function checkWaterEdit(p, ctx, date) {
  const before = (ctx.macros || []).find((m) => m.date === date)?.water ?? 0;
  const ml = Math.round(num(p?.ml));
  if (!Number.isFinite(ml) || ml < 0 || ml > 6000) return fail("eau du jour hors de 0 à 6000 ml (le total, pas un ajout)", { besoin: "ml" });
  const day = dayWords(date, ctx.today);
  if (ml === before) return fail(`rien ne change : ${ml} ml ${day}`);
  return { ok: true, act: { kind: "eau_total", date, ml }, resume: `Corriger l'eau ${day} : ${ml} ml au lieu de ${before} ml` };
}

function checkNoteEdit(p, ctx, date) {
  const cur = ((ctx.notes || []).find((n) => n.date === date)?.text || "").trim();
  const day = dayWords(date, ctx.today);
  if (p?.effacer === true) {
    if (!cur) return fail(`aucune note ${day}`);
    return { ok: true, act: { kind: "note_remplace", date, text: "" }, resume: `Effacer la note ${day} : « ${cur} »` };
  }
  const text = String(p?.texte || "").trim().slice(0, 300);
  if (!text) return fail("nouveau texte de la note manquant", { besoin: "texte" });
  if (text === cur) return fail("rien ne change : la note est déjà celle-là");
  return { ok: true, act: { kind: "note_remplace", date, text },
    resume: cur ? `Remplacer la note ${day} par « ${text} » ; elle disait « ${cur} »` : `Écrire la note ${day} : « ${text} »` };
}

/** Vérifie et décrit une correction. `ctx` : celui de `checkAgir`, plus `notes` (noteLog). */
export function checkEdit(action, p, ctx) {
  const d = editDay(p, ctx.today);
  if (!d.ok) return d;
  const { date } = d;
  if (action === "modifier_aliment" || action === "retirer_aliment") return checkFoodEdit(action, p, ctx, date);
  if (action === "corriger_poids") return checkWeightEdit(p, ctx, date);
  if (action === "corriger_genou") return checkKneeEdit(p, ctx, date);
  if (action === "corriger_eau") return checkWaterEdit(p, ctx, date);
  return checkNoteEdit(p, ctx, date);
}

// --- Écritures pures (appelées par applyActionStored) ---

/** Journal des aliments après une correction d'aliment. */
export function editedFoodLog(foodLog, act) {
  const log = foodLog || [];
  if (act.kind === "aliment_retrait") return log.filter((e) => e.id !== act.id);
  return log.map((e) => (e.id === act.id ? { ...e, ...act.patch } : e));
}
/** Poids ou genou d'un jour effacé. */
export const withoutDay = (arr, date) => (arr || []).filter((e) => e.date !== date);
/** Eau du jour fixée à un total (même ligne que les boutons d'eau). */
export const waterTotal = (macros, date, ml) => upsert(macros || [], { date, water: ml, source: "manual" });
