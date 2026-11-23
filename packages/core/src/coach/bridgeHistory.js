// Pont PROTOCOLE → JEFFREY : détail par repas et lecture dans le temps (23/11/2026, demande de
// Yoann, cadrage validé le jour même). Lecture seule, additive : aucun sujet existant ne change de
// forme, `macros` gagne seulement `par_repas` et `total_passe_ou_en_cours`.
// - Détail par repas : Yoann saisit ses repas à l'avance (parfois plusieurs jours) et les corrige
//   dans la journée. Un total « saisi » n'est donc pas un total « mangé » : à 9 h, Jeffrey avait dit
//   « déjà plus de 3 000 kcal ». Chaque repas porte son repère `moment`.
// - Sujets `jour` ({ date }) et `periode` ({ du, au }) : ce que Yoann verrait à l'écran pour un jour
//   passé ou futur, et des totaux / moyennes calculés ici (Jeffrey ne recalcule rien).
// Même principe que bridge.js : PROTOCOLE calcule les faits, Jeffrey les juge et parle.

import { MEALS, entriesFor, totals, resolveLog, alcoholGramsFor } from "../nutrition/foodStore.js";
import { targetsForDate, kcalOfEntry, hasIntake, kcalTargetOn } from "../targets.js";
import { computeSleepScore } from "../energy.js";
import { isBasketPlanned } from "../nextSession.js";
import { shiftDateKey, daysBetween } from "../dateUtils.js";

// Horaires habituels des repas de Yoann (23/11/2026, ses mots) : petit-déjeuner avant 10 h,
// déjeuner 12 h-14 h, goûter 16 h-17 h, dîner 19 h-20 h. Pré-training, post-training et Extra
// n'ont pas d'horaire fixe. `fin` exclue : à 14:00 le déjeuner est passé.
export const MEAL_WINDOWS = {
  petitdej: { fin: "10:00", texte: "avant 10 h" },
  dejeuner: { debut: "12:00", fin: "14:00", texte: "12 h-14 h" },
  gouter: { debut: "16:00", fin: "17:00", texte: "16 h-17 h" },
  diner: { debut: "19:00", fin: "20:00", texte: "19 h-20 h" },
};

/** Plus longue période lisible d'un coup (un an) : la réponse reste loin de la limite de 200 000 caractères. */
export const MAX_PERIOD_DAYS = 366;

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const weekdayOf = (k) => { const [y, m, d] = k.split("-").map(Number); return JOURS[new Date(y, m - 1, d).getDay()]; };
const bad = () => Object.assign(new Error("demande invalide"), { code: "inconnu" });

/** Date « AAAA-MM-JJ » réelle (pas de 31 février), sinon null. */
export function validDate(k) {
  if (typeof k !== "string" || !DATE_RE.test(k)) return null;
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? k : null;
}

/** Jour passé, aujourd'hui ou futur, vu depuis `today`. */
export const dayStatus = (date, today) => (date < today ? "passe" : date > today ? "futur" : "aujourdhui");

/**
 * Repère d'un repas. Jour passé : « fait » ; jour futur : « prevu ». Aujourd'hui, d'après
 * l'heure et MEAL_WINDOWS : « a_venir », « en_cours » ou « passe » ; « sans_horaire » pour
 * pré-training, post-training et Extra.
 */
export function mealMoment(meal, { statut, heure }) {
  if (statut === "passe") return "fait";
  if (statut === "futur") return "prevu";
  const w = MEAL_WINDOWS[meal];
  if (!w || !heure) return "sans_horaire";
  if (w.debut && heure < w.debut) return "a_venir";
  return heure < w.fin ? "en_cours" : "passe";
}

const MACRO_OUT = [["kcal", "kcal"], ["prot", "proteines"], ["gluc", "glucides"], ["lip", "lipides"], ["fib", "fibres"]];

/** Totaux foodStore (kcal/prot/gluc/lip/fib) → noms du pont ; `incomplet` liste les macros dont une ligne manque. */
function macrosOut(t) {
  const out = {};
  for (const [k, name] of MACRO_OUT) out[name] = t[k];
  const missing = MACRO_OUT.filter(([k]) => t.missing?.[k] > 0).map(([, name]) => name);
  if (missing.length) out.incomplet = missing;
  return out;
}

/**
 * Détail par repas d'un jour → { par_repas, total_passe_ou_en_cours }. Corrections d'aliments
 * appliquées (mêmes chiffres que l'onglet Repas). Repas vides absents. `total_passe_ou_en_cours`
 * seulement aujourd'hui (somme des repas « passe » ou « en_cours » ; un repas sans horaire n'y est pas).
 */
export function mealsDetail({ foodLog, overrides, date, statut, heure }) {
  const day = entriesFor(resolveLog(foodLog || [], overrides), date);
  const par_repas = {};
  const past = [];
  for (const { key, label } of MEALS) {
    const items = day.filter((e) => e.meal === key);
    if (!items.length) continue;
    const moment = mealMoment(key, { statut, heure });
    par_repas[key] = {
      libelle: label, moment, horaire: MEAL_WINDOWS[key]?.texte ?? null,
      ...macrosOut(totals(items)),
      aliments: items.map((e) => `${e.name} ${e.q}g`),
    };
    if (moment === "passe" || moment === "en_cours") past.push(...items);
  }
  const out = { par_repas };
  if (statut === "aujourdhui") out.total_passe_ou_en_cours = macrosOut(totals(past));
  return out;
}

const findDay = (arr, d) => (arr || []).find((e) => e.date === d);

/** Total saisi d'un jour : celui de macroLog (identique à l'écran), sinon la somme du journal, sinon null. */
function dayTotal(data, date, food) {
  const m = findDay(data.macros, date);
  if (hasIntake(m)) {
    return { kcal: Math.round(kcalOfEntry(m)), proteines: round1(m.protein ?? null), glucides: round1(m.carbs ?? null), lipides: round1(m.fat ?? null), fibres: round1(m.fiber ?? null) };
  }
  const entries = entriesFor(food, date);
  if (!entries.length) return null;
  return macrosOut(totals(entries));
}

/** Cibles d'un jour : kcal en vigueur ce jour-là (paliers compris), macros, eau (+1 L un jour de basket fait, règle de l'app). */
function dayTargets(data, date) {
  if (!data.targets) return null;
  const at = targetsForDate(date, data.targets);
  const basket = (data.training || []).some((t) => t.date === date && t.type === "Basket");
  return {
    kcal: kcalTargetOn(date, data.targets, data.targetHistory),
    proteines: at.protein, glucides: at.carbs, lipides: at.fat, fibres: at.fiber,
    eau_ml: data.targets.water == null ? null : data.targets.water + (basket ? 1000 : 0),
  };
}

/** Séance enregistrée → type, horaire, durée, ressenti, exercices et séries (comme le carnet). */
function sessionOut(t) {
  return {
    type: t.type,
    ...(t.start ? { debut: t.start } : {}),
    ...(t.duration ? { duree_min: t.duration } : {}),
    ...(t.rpe ? { rpe: t.rpe } : {}),
    exercices: (t.exercices || []).map((e) => ({
      nom: e.nom,
      // `val` = répétitions (mode « reps ») ou secondes (mode « temps »).
      unite: e.mode === "temps" ? "secondes" : "repetitions",
      ...(e.perLeg ? { par_jambe: true } : {}),
      series: (e.series || []).map((s) => ({ poids_kg: s.poids, val: s.val, fait: !!s.fait, ...(s.leg ? { jambe: s.leg } : {}) })),
    })),
  };
}

/** Ce qui est prévu un jour (aujourd'hui ou futur) : basket du calendrier, planning idéal, verdict du recommandeur. */
function plannedOf(data, date, { planFor, recommandeur }) {
  const match = !!data.basketSchedule?.matchDates?.includes(date);
  const out = {
    basket: match ? "match" : isBasketPlanned(data.basketSchedule, date) ? "entrainement" : null,
    // Repère de Yoann (onglet Dépense), pas une séance programmée.
    planning_ideal: planFor ? (planFor(date)?.weeklyPlan || []) : null,
  };
  if (recommandeur) out.recommandeur = recommandeur;
  return out;
}

/**
 * Faits d'un jour (sujet `jour`). `data` : loadData() + `foodLog`/`overrides` lus frais ;
 * `opts` = { today, heure, planFor, recommandeur } (recommandeur : verdict du jour ou du
 * lendemain, mis en forme par bridge.js, ou null).
 */
export function dayFacts(date, data, { today, heure, planFor, recommandeur = null }) {
  const statut = dayStatus(date, today);
  const food = resolveLog(data.foodLog || [], data.overrides);
  const repas = mealsDetail({ foodLog: data.foodLog, overrides: data.overrides, date, statut, heure });
  const alcool = alcoholGramsFor(data.foodLog || [], date);
  const out = {
    date, jour_semaine: weekdayOf(date), statut_jour: statut,
    ...(statut === "aujourdhui" ? { heure } : {}),
    total_saisi: dayTotal(data, date, food),
    ...repas,
    ...(alcool > 0 ? { alcool_g: alcool } : {}),
    cible: dayTargets(data, date),
  };
  if (statut !== "futur") {
    const s = findDay(data.sleep, date);
    const k = findDay(data.knee, date);
    out.eau_ml = findDay(data.macros, date)?.water ?? null;
    out.pas = findDay(data.steps, date)?.count ?? null;
    out.sommeil_nuit_precedente = s ? { heures: round1(s.hours), qualite: s.quality ?? null, score: computeSleepScore({ hours: s.hours, quality: s.quality }) } : null;
    out.sieste_min = findDay(data.naps, date)?.minutes ?? null;
    out.poids_kg = findDay(data.weight, date)?.kg ?? null;
    out.genou = k ? { douleur: k.pain ?? null, base_ok: k.baseline !== false } : null;
    out.fc_repos = findDay(data.rhr, date)?.bpm ?? null;
    out.note = findDay(data.notes, date)?.text || null;
    out.seances_faites = (data.training || []).filter((t) => t.date === date).map(sessionOut);
  }
  if (statut !== "passe") out.prevu = plannedOf(data, date, { planFor, recommandeur });
  return out;
}

/** Une ligne courte d'un jour, pour la liste d'une période. */
function dayRow(date, data, food, today, planFor) {
  const statut = dayStatus(date, today);
  const t = dayTotal(data, date, food);
  const row = { date, jour: weekdayOf(date), statut };
  if (t) Object.assign(row, { kcal: t.kcal, proteines: t.proteines, glucides: t.glucides, lipides: t.lipides, fibres: t.fibres });
  if (statut === "futur") {
    const p = plannedOf(data, date, { planFor });
    if (p.basket) row.basket_prevu = p.basket;
    if (p.planning_ideal?.length) row.planning_ideal = p.planning_ideal;
    return row;
  }
  const water = findDay(data.macros, date)?.water;
  const steps = findDay(data.steps, date)?.count;
  const s = findDay(data.sleep, date);
  const w = findDay(data.weight, date)?.kg;
  const k = findDay(data.knee, date);
  const rhr = findDay(data.rhr, date)?.bpm;
  if (water != null) row.eau_ml = water;
  if (steps != null) row.pas = steps;
  if (s) { row.sommeil_h = round1(s.hours); if (s.quality != null) row.sommeil_qualite = s.quality; }
  if (w != null) row.poids_kg = w;
  if (k) { row.genou = k.pain ?? null; if (k.baseline === false) row.genou_hors_base = true; }
  if (rhr != null) row.fc_repos = rhr;
  const seances = (data.training || []).filter((x) => x.date === date).map((x) => x.type);
  if (seances.length) row.seances = seances;
  return row;
}

const stat = (xs, { total = false, digits = 1 } = {}) => {
  if (!xs.length) return null;
  const r = (x) => (digits === 0 ? Math.round(x) : round1(x));
  return { moyenne: r(avg(xs)), ...(total ? { total: r(xs.reduce((a, b) => a + b, 0)) } : {}), min: r(Math.min(...xs)), max: r(Math.max(...xs)), jours: xs.length };
};

/**
 * Faits d'une période (sujet `periode`, bornes comprises). Totaux et moyennes sur les jours
 * PASSÉS de la période seulement (aujourd'hui est en cours, le futur est prévu) ; chaque mesure ne
 * compte que les jours où elle existe (`jours`). Une ligne par jour, futur compris.
 */
export function periodFacts(du, au, data, { today, planFor }) {
  const food = resolveLog(data.foodLog || [], data.overrides);
  const n = daysBetween(du, au) + 1;
  const dates = Array.from({ length: n }, (_, i) => shiftDateKey(du, i));
  const jours = dates.map((d) => dayRow(d, data, food, today, planFor));
  const past = dates.filter((d) => d < today);
  const pick = (f) => past.map(f).filter((x) => x != null && Number.isFinite(x));
  const totalsOf = past.map((d) => dayTotal(data, d, food)).filter(Boolean);
  const weights = past.map((d) => findDay(data.weight, d)).filter((w) => w?.kg != null);
  const knees = past.map((d) => findDay(data.knee, d)).filter((k) => k && k.pain != null);
  const sessions = (data.training || []).filter((t) => t.date >= du && t.date <= au && t.date < today);
  const parType = {};
  for (const t of sessions) parType[t.type] = (parType[t.type] || 0) + 1;
  const alcool = past.reduce((a, d) => a + alcoholGramsFor(data.foodLog || [], d), 0);
  const nutri = (k) => stat(totalsOf.map((t) => t[k]).filter((x) => x != null), { total: true, digits: k === "kcal" ? 0 : 1 });
  return {
    du, au, nb_jours: n,
    jours_passes: past.length,
    calcul: "totaux et moyennes sur les jours passés de la période (aujourd'hui et le futur exclus) ; « jours » = jours où la mesure existe",
    totaux_et_moyennes: {
      kcal: nutri("kcal"), proteines: nutri("proteines"), glucides: nutri("glucides"), lipides: nutri("lipides"), fibres: nutri("fibres"),
      eau_ml: stat(pick((d) => findDay(data.macros, d)?.water), { digits: 0 }),
      pas: stat(pick((d) => findDay(data.steps, d)?.count), { total: true, digits: 0 }),
      sommeil_h: stat(pick((d) => findDay(data.sleep, d)?.hours)),
      sommeil_qualite: stat(pick((d) => findDay(data.sleep, d)?.quality)),
      poids_kg: weights.length ? { premier: weights[0].kg, dernier: weights.at(-1).kg, variation: round1(weights.at(-1).kg - weights[0].kg), ...stat(weights.map((w) => w.kg)) } : null,
      genou: knees.length ? { ...stat(knees.map((k) => k.pain)), jours_hors_base: knees.filter((k) => k.baseline === false).length } : null,
      fc_repos: stat(pick((d) => findDay(data.rhr, d)?.bpm), { digits: 0 }),
      seances: { total: sessions.length, par_type: parType },
      ...(alcool > 0 ? { alcool_g_total: round1(alcool) } : {}),
    },
    jours,
  };
}

/** Bornes d'une période validées → [du, au], sinon erreur « inconnu ». */
export function checkPeriod(du, au) {
  if (!validDate(du) || !validDate(au) || au < du) throw bad();
  if (daysBetween(du, au) + 1 > MAX_PERIOD_DAYS) throw bad();
  return [du, au];
}

/** Date d'un jour validée (défaut : aujourd'hui), sinon erreur « inconnu ». */
export function checkDay(date, today) {
  if (date == null || date === "") return today;
  if (!validDate(date)) throw bad();
  return date;
}
