// Jeffrey, le majordome (chantier J, J1.1, 29/10/2026) : contrat de la conversation.
// Spec et décisions : ROADMAP.md, « Chantier J ». Principe hérité du Coach IA : le JS calcule
// les faits (mêmes données que `buildCoachPrompt`, via son champ `facts`), le modèle les juge et
// répond dans la voix de Jeffrey. Le recommandeur reste le garde-fou : Jeffrey choisit une
// séance PARMI celles qu'il autorise, et l'app vérifie (`validateSessionChoice`).
//
// Ordre du `system`, du plus stable au plus changeant, pour le cache de l'API : rôle et règles,
// puis personnalité (éditable), puis données du moment. Les règles priment sur la personnalité.

import { splitCarnet, CARNET_MARK, CARNET_MAX_CHARS } from "./prompt.js";
import { upsert, shiftDateKey } from "../dateUtils.js";
import { MEALS, suggestions, copyEntries, makeEntry, resolveLog, totals, amounts } from "../nutrition/foodStore.js";

/** Personnalité d'amorçage (clé `jeffreyPersona`, éditable dans les Réglages). */
export const JEFFREY_PERSONA = `Vous êtes Jeffrey, le majordome de Monsieur. Vous le vouvoyez toujours et l'appelez « Monsieur ». Langage châtié, phrases courtes et élégantes, flegme britannique. Vous avez le sens de l'humour : traits d'esprit, understatement, pince-sans-rire, une vraie blague quand l'occasion s'y prête. Taquin, volontiers cynique, et ce en toute circonstance, mais toujours avec une bienveillance évidente derrière la pique : on doit sentir que vous êtes de son côté. Ne répétez pas la même plaisanterie d'un message à l'autre. Vous ne flattez pas et ne dramatisez pas : vous constatez, vous conseillez, vous laissez Monsieur décider.`;

/** Les deux règles validées par Yoann (29/10/2026), qui priment sur la personnalité. */
export const JEFFREY_RULES = `RÈGLES QUI PRIMENT SUR LA PERSONNALITÉ, quoi qu'elle dise :
1. Le ton ne change jamais les faits ni les garde-fous. Une séance que le recommandeur écarte reste écartée, une douleur reste une douleur, un chiffre reste ce chiffre. Monsieur est un petit dormeur : une nuit courte n'est jamais un signe de fatigue, seul le score de qualité du sommeil compte — vous pouvez en plaisanter, jamais le présenter comme un problème.
2. Une alerte est toujours dite clairement : une phrase nette d'abord, l'humour éventuellement après.`;

const ROLE = `Vous êtes Jeffrey, le majordome de PROTOCOLE, l'application de suivi de Monsieur (Yoann). Derrière le majordome, vous avez les compétences d'un coach sportif, d'un kinésithérapeute, d'un nutritionniste et d'un coach de vie. Ce n'est pas un avis médical.`;

const CHAT_RULES = `CONVERSATION :
- Commencez TOUJOURS par votre réponse écrite à Monsieur, même courte. Les outils ne remplacent jamais cette réponse : ils viennent après, en complément.
- Réponses courtes : 3 à 6 phrases, 120 mots au plus, sauf si Monsieur demande un détail. Texte simple : pas de titres, pas de gras, pas de listes ; jamais de restitution des données brutes, citez seulement le chiffre qui appuie un conseil.
- Appuyez-vous sur les DONNÉES DU MOMENT fournies par l'application. Une donnée absente se dit absente, ne l'inventez jamais. "heure" est l'heure exacte : un total du jour en cours n'est jamais jugé contre une cible de journée complète.
- Séances : pour proposer ou confirmer une séance, utilisez l'outil choisir_seance, et UNIQUEMENT avec une séance de SEANCES_AUTORISEES (aujourd'hui ou demain). Vous pouvez nuancer le choix du recommandeur selon ce que Monsieur vous dit (fatigue ressentie, temps disponible, envie) ; jamais proposer une séance hors de cette liste.
- Quand quelques réponses courtes aideraient Monsieur à vous répondre, utilisez l'outil proposer_reponses (2 à 4 réponses de 24 caractères au plus).
- Appelez les outils après votre texte, jamais à sa place : votre réponse écrite doit se suffire.
- Actions (ajouter_eau, noter_genou, ecrire_note, reprendre_repas, ajouter_habituel) : proposez-les quand Monsieur vous donne l'information ou le demande (« j'ai bu un demi-litre », « genou à 2 », « comme hier au petit-déj », « ajoute mon skyr au goûter »). Un habituel s'ajoute toujours à la quantité de la dernière fois : si Monsieur en veut une autre, dites-lui qu'il l'ajustera dans Nutrition. Si l'application refuse une action, dites-le simplement, sans inventer d'aliment ni de quantité. Elles ne sont faites qu'après sa confirmation d'un tap : ne dites jamais que c'est fait, dites que vous le lui proposez. Jamais un chiffre qu'il n'a pas donné.
- Les DONNÉES DU MOMENT sont relues à chaque message de Monsieur : elles comptent DÉJÀ toutes les actions qu'il a confirmées (voir le résultat de vos outils). Ne rajoutez jamais une action confirmée à un chiffre de ces données, et ne revenez pas sur un total juste.`;

/** Outils de la conversation (J1). Les actions qui écrivent des données arrivent en J2. */
export const JEFFREY_TOOLS = [
  {
    name: "choisir_seance",
    description: "Propose à Monsieur une séance, choisie parmi SEANCES_AUTORISEES pour ce jour-là. L'application l'affiche avec un bouton pour la démarrer.",
    input_schema: {
      type: "object",
      properties: {
        jour: { type: "string", enum: ["aujourdhui", "demain"] },
        type: { type: "string", description: "Nom exact d'une séance de SEANCES_AUTORISEES pour ce jour." },
        raison: { type: "string", description: "Une phrase : pourquoi celle-ci plutôt qu'une autre." },
      },
      required: ["jour", "type", "raison"],
    },
  },
  {
    name: "proposer_reponses",
    description: "Affiche des réponses rapides que Monsieur peut toucher au lieu d'écrire.",
    input_schema: {
      type: "object",
      properties: { options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["options"],
    },
  },
];

// --- Actions confirmées (J2, 29/10/2026) ------------------------------------------------------
// Jeffrey PROPOSE une action ; l'app l'affiche en carte « Confirmer / Annuler » et n'écrit rien
// sans un tap. L'écriture est exactement celle de l'écran correspondant (fonctions ci-dessous,
// testées contre l'écran). Après la confirmation, pas de nouvel appel : la réponse locale est une
// phrase fixe, et Jeffrey apprend le résultat au message suivant (tool_result).
export const JEFFREY_ACTION_TOOLS = [
  {
    name: "ajouter_eau",
    description: "Propose d'ajouter de l'eau bue aujourd'hui (Monsieur confirme d'un tap). Uniquement si Monsieur dit avoir bu.",
    input_schema: { type: "object", properties: { ml: { type: "integer", description: "Quantité bue, en millilitres (50 à 2000)." } }, required: ["ml"] },
  },
  {
    name: "noter_genou",
    description: "Propose d'enregistrer la douleur du genou d'aujourd'hui (0 à 10), donnée par Monsieur lui-même. Ne déduisez jamais un chiffre qu'il n'a pas dit. retour_base : la douleur est-elle revenue à son niveau de base sous 24 h ? À omettre si Monsieur ne l'a pas dit, l'application lui demandera.",
    input_schema: { type: "object", properties: { douleur: { type: "integer" }, retour_base: { type: "boolean" } }, required: ["douleur"] },
  },
  {
    name: "ecrire_note",
    description: "Propose d'ajouter une phrase à la note du jour (contexte hors chiffres : alcool, insomnie, stress, petite blessure…), avec les mots de Monsieur.",
    input_schema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] },
  },
  {
    name: "reprendre_repas",
    description: "Propose de copier le repas d'HIER dans le même repas d'aujourd'hui (tous ses aliments, mêmes quantités). Uniquement si Monsieur le demande (« comme hier au petit-déj »).",
    input_schema: { type: "object", properties: { repas: { type: "string", enum: MEALS.map((m) => m.key), description: "autre = Extra" } }, required: ["repas"] },
  },
  {
    name: "ajouter_habituel",
    description: "Propose d'ajouter à un repas d'aujourd'hui un aliment que Monsieur mange déjà à ce repas, à la quantité de la dernière fois (jamais une autre). aliment : le nom tel que Monsieur l'a dit (« skyr »). Si l'application ne le trouve pas parmi ses habituels de ce repas, elle vous le dira : ne l'inventez pas.",
    input_schema: { type: "object", properties: { aliment: { type: "string" }, repas: { type: "string", enum: MEALS.map((m) => m.key), description: "autre = Extra" } }, required: ["aliment", "repas"] },
  },
];
const ACTION_NAMES = new Set(JEFFREY_ACTION_TOOLS.map((t) => t.name));
export const isActionTool = (name) => ACTION_NAMES.has(name);

const mealOf = (key) => MEALS.find((m) => m.key === key);
const theMeal = (key) => (key === "autre" ? "l'Extra" : `le ${mealOf(key).label.toLowerCase()}`);
const atMeal = (key) => (key === "autre" ? "en Extra" : `au ${mealOf(key).label.toLowerCase()}`);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** J2b : repris d'hier (même repas) ou habituel de ce repas, à sa dernière quantité. Le contexte
 *  `ctx` = { foodLog (brut, per100 d'origine), overrides, pins, muted, today }. */
function validateFood(name, input, ctx) {
  const meal = input?.repas;
  if (!mealOf(meal)) return { ok: false, reason: `repas inconnu : ${meal}` };
  const log = ctx.foodLog || [];
  const date = ctx.today;
  if (name === "reprendre_repas") {
    const from = shiftDateKey(date, -1);
    const src = log.filter((e) => e.date === from && e.meal === meal);
    if (!src.length) return { ok: false, reason: `rien n'est noté ${atMeal(meal)} d'hier` };
    const kcal = totals(resolveLog(src, ctx.overrides)).kcal;
    const already = log.filter((e) => e.date === date && e.meal === meal).length;
    return { ok: true, action: {
      kind: "repas", meal, from, entryIds: src.map((e) => e.id), items: src.map((e) => ({ name: e.name, q: e.q })), kcal, already,
      label: `Reprendre ${theMeal(meal)} d'hier : ${src.length} aliment${src.length > 1 ? "s" : ""}, ${kcal} kcal`,
    } };
  }
  const asked = norm(input?.aliment);
  if (!asked) return { ok: false, reason: "nom d'aliment vide" };
  const habits = suggestions(log, { meal, pins: ctx.pins, muted: ctx.muted, date });
  const words = asked.split(" ");
  const match = habits.filter((h) => words.every((w) => norm(h.name).includes(w)));
  const exact = match.filter((h) => norm(h.name) === asked);
  const pick = exact.length === 1 ? exact[0] : match.length === 1 ? match[0] : null;
  if (!match.length) {
    const known = habits.slice(0, 8).map((h) => h.name).join(", ");
    return { ok: false, reason: `aucun aliment habituel « ${input.aliment} » ${atMeal(meal)}${known ? ` (ses habituels à ce repas : ${known})` : " (aucun habituel à ce repas)"}` };
  }
  if (!pick) return { ok: false, reason: `plusieurs habituels correspondent ${atMeal(meal)} : ${match.slice(0, 5).map((h) => h.name).join(", ")} — demandez à Monsieur lequel` };
  const food = { ref: pick.ref, name: pick.name, per100: pick.per100 };
  const kcal = amounts(resolveLog([{ ...food, q: pick.lastQ }], ctx.overrides)[0]).kcal;
  return { ok: true, action: {
    kind: "habituel", meal, food, q: pick.lastQ, kcal,
    label: `Ajouter ${pick.name} · ${pick.lastQ} g ${atMeal(meal)}${kcal != null ? ` (${kcal} kcal)` : ""}`,
  } };
}

/** Lignes de journal à écrire pour une action repas/habituel confirmée (`log` brut). Mêmes
 *  écritures que « Comme hier » / « Copier un repas » (copyEntries) et le tap sur un habituel. */
export function foodEntriesFor(action, log, date) {
  if (action.kind === "repas") {
    const ids = new Set(action.entryIds);
    return copyEntries((log || []).filter((e) => ids.has(e.id)), { date, meal: action.meal });
  }
  if (action.kind === "habituel") return [makeEntry({ date, meal: action.meal, food: action.food, q: action.q })];
  return [];
}

/** Vérifie un appel d'outil d'action → { ok, action } ou { ok: false, reason }. `action` porte
 *  `kind`, les valeurs normalisées et `label` (ce que la carte affiche). `ctx` sert aux actions
 *  du journal alimentaire (J2b). */
export function validateAction(name, input, ctx = {}) {
  if (name === "reprendre_repas" || name === "ajouter_habituel") return validateFood(name, input, ctx);
  if (name === "ajouter_eau") {
    const ml = Math.round(Number(input?.ml));
    if (!Number.isFinite(ml) || ml < 50 || ml > 2000) return { ok: false, reason: "quantité d'eau hors de 50 à 2000 ml" };
    return { ok: true, action: { kind: "eau", ml, label: `Ajouter ${ml} ml d'eau` } };
  }
  if (name === "noter_genou") {
    const pain = Number(input?.douleur);
    if (!Number.isInteger(pain) || pain < 0 || pain > 10) return { ok: false, reason: "douleur hors de 0 à 10" };
    // 0 = pas de douleur, donc à la base (même règle que la saisie rapide du tableau de bord).
    const baseline = pain === 0 ? true : typeof input?.retour_base === "boolean" ? input.retour_base : null;
    const label = `Genou ${pain}/10${baseline == null ? "" : baseline ? ", revenu à la base" : ", pas revenu à la base"}`;
    return { ok: true, action: { kind: "genou", pain, baseline, label } };
  }
  if (name === "ecrire_note") {
    const text = String(input?.texte || "").trim().slice(0, 300);
    if (!text) return { ok: false, reason: "note vide" };
    return { ok: true, action: { kind: "note", text, label: `Note du jour : « ${text} »` } };
  }
  return { ok: false, reason: `action inconnue : ${name}` };
}

/** Eau : même écriture que les boutons +250/+500 de Nutrition. */
export const applyWater = (macros, date, ml) => {
  const next = Math.max(0, ((macros || []).find((m) => m.date === date)?.water ?? 0) + ml);
  return upsert(macros || [], { date, water: next, source: "manual" });
};
/** Genou : même écriture que la saisie rapide du tableau de bord et l'onglet Genou. */
export const applyKnee = (knee, date, pain, baseline) => upsert(knee || [], { date, pain, baseline });
/** Note du jour : la phrase s'ajoute à ce qui est déjà écrit, sans rien effacer. */
export const appendNote = (existing, text) => ((existing || "").trim() ? `${existing.trim()} ; ${text}` : text);

/** Résultat renvoyé à Jeffrey après le tap. Avec le nouveau total d'eau (`change` = {before,
 *  after}) : le 29/10/2026 il a pris les données (déjà à jour) pour la valeur d'avant et a
 *  annoncé 2 250 ml au lieu de 1 750. */
export function confirmedResult(action, change) {
  const what = action.kind === "eau" && change ? `eau du jour passée de ${change.before} à ${change.after} ml` : action.label;
  return `Monsieur a confirmé : c'est fait (${what}). Les DONNÉES DU MOMENT de vos prochains messages comptent déjà ce changement : ne l'ajoutez pas une seconde fois.`;
}
export const CANCELLED_RESULT = "Monsieur a annulé : rien n'a été fait.";

/**
 * Confirme (`ok`) ou annule une action en attente (J2) — partagé par la conversation et la
 * notification (J4.3). `apply(action)` écrit l'action confirmée et renvoie le changement
 * (eau avant/après) ou null ; `baseline` complète une douleur au genou sans réponse sur la base.
 * → nouvelle liste d'entrées (action marquée faite ou annulée, résultat d'outil pour Jeffrey),
 * ou null si l'action n'est plus en attente.
 */
export function decideAction(entries, entryId, actionId, { ok, baseline, apply, doneText, cancelledText }) {
  const entry = entries.find((e) => e.id === entryId);
  const action = entry?.actions?.find((a) => a.id === actionId);
  if (!action || action.status !== "pending") return null;
  let done;
  let change = null;
  if (ok) {
    const act = action.kind === "genou" && action.baseline == null ? { ...action, baseline: !!baseline } : action;
    change = apply?.(act) ?? null;
    const label = act.kind === "genou" ? `Genou ${act.pain}/10, ${act.baseline ? "revenu à la base" : "pas revenu à la base"}` : act.label;
    done = { ...act, label, status: "done", doneText };
  } else {
    done = { ...action, status: "cancelled", doneText: cancelledText };
  }
  const result = ok ? confirmedResult(done, change) : CANCELLED_RESULT;
  return entries.map((e) => (e.id !== entryId ? e : {
    ...e,
    actions: e.actions.map((a) => (a.id === actionId ? done : a)),
    toolResults: { ...e.toolResults, [actionId]: result },
  }));
}

/** Séances que Jeffrey a le droit de proposer, d'après `nextSessions` : celles que le
 *  recommandeur affiche et celles qu'il juge seulement moins prioritaires. Jamais une séance
 *  écartée (à éviter, créneau passé, journée fermée) ni une variante non retenue. */
export function allowedSessions(nextSession) {
  const pick = (day, open) => {
    if (!day || !open) return [];
    const shown = (day.suggestions || []).map((s) => s.type);
    const lower = (day.notProposed || []).filter((n) => n.kind === "priority").map((n) => n.type);
    return [...new Set([...shown, ...lower])];
  };
  return {
    aujourdhui: pick(nextSession?.today, nextSession?.today?.status !== "closed"),
    demain: pick(nextSession?.tomorrow, true),
  };
}

/** Vérifie un appel à choisir_seance. → { ok, jour, type, raison } ou { ok: false, reason }. */
export function validateSessionChoice(input, allowed) {
  const jour = input?.jour === "demain" ? "demain" : input?.jour === "aujourdhui" ? "aujourdhui" : null;
  if (!jour) return { ok: false, reason: "jour invalide" };
  const list = allowed?.[jour] || [];
  if (!list.includes(input?.type)) return { ok: false, reason: `« ${input?.type} » n'est pas autorisée ${jour === "demain" ? "demain" : "aujourd'hui"}` };
  return { ok: true, jour, type: input.type, raison: String(input.raison || "") };
}

/** Texte visible d'une réponse. */
export const replyText = (content) => (content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();

/** Texte à afficher (sans le carnet de bord écrit en fin de « point ») et carnet à enregistrer. */
export function readReply(content) {
  const { advice, journal } = splitCarnet(replyText(content));
  return { text: advice, journal };
}

/** Réflexion selon la demande (choix de Yoann, 29/10/2026) : réduite pour la conversation (premier
 *  mot plus tôt), normale pour le point complet et le bilan. */
export const effortFor = (mode) => (mode === "point" || mode === "bilan" ? "medium" : "low");

const POINT_INSTR = `(Demande de l'application : POINT COMPLET. Faites le point sur la journée et la tendance des 14 derniers jours, dans votre voix, 300 mots au plus, texte simple sans titres ni gras. Couvrez ce qui compte aujourd'hui : séance (d'après le recommandeur), nutrition et hydratation (d'après l'heure), récupération, genou ; puis la tendance de fond (poids en moyenne 7 jours, apports, dépense estimée). Terminez par une conclusion complète. Puis, APRÈS la conclusion, écrivez la ligne ${CARNET_MARK} seule, et en dessous la version mise à jour du CARNET DE BORD : un ÉTAT, pas un journal — réécrit en entier, élagué de ce qui est résolu ou périmé, ${CARNET_MAX_CHARS} caractères au plus : progression chiffrée, ce que vous avez demandé et si c'est appliqué, points de vigilance en cours. Pas de conseils dedans.)`;

// --- Mémoire d'un jour sur l'autre (J1.3, 29/10/2026) ------------------------------------
// La conversation d'un jour passé est versée dans le carnet de bord au premier message suivant,
// dans le même appel (pas d'appel en plus) : le lendemain, Jeffrey s'en souvient sans tout relire.

const MEMORY_MAX_CHARS = 6000;

/** Dernier jour passé dont la conversation n'est pas encore dans le carnet, ou null.
 *  `log` : { "AAAA-MM-JJ": [messages] } ; `doneDate` : dernier jour déjà versé au carnet. */
export function pendingMemoryDate(log, todayKey, doneDate) {
  const days = Object.keys(log || {})
    .filter((d) => d < todayKey && (!doneDate || d > doneDate) && (log[d] || []).some((e) => !e.hidden && e.text))
    .sort();
  return days.length ? days[days.length - 1] : null;
}

/** Transcription lisible d'une journée (messages visibles seulement), tronquée par le début. */
export function memoryTranscript(entries) {
  const lines = (entries || []).filter((e) => !e.hidden && e.text)
    .map((e) => `${e.at || ""} ${e.role === "user" ? "Monsieur" : "Jeffrey"} : ${e.text}`.trim());
  let t = lines.join("\n");
  if (t.length > MEMORY_MAX_CHARS) t = `…${t.slice(t.length - MEMORY_MAX_CHARS)}`;
  return t;
}

/** Ajoute à un message de Monsieur la conversation d'un jour passé et la consigne de mettre le
 *  carnet à jour. `memoryFor` marque le message : la mémoire n'est versée qu'une fois par jour. */
export function withMemory(entry, date, entries) {
  const transcript = memoryTranscript(entries);
  if (!transcript) return entry;
  const base = entry.apiText ?? entry.text;
  const carnet = entry.mode === "point" ? "" : ` Répondez d'abord normalement à Monsieur ; puis, APRÈS votre réponse, écrivez la ligne ${CARNET_MARK} seule, et en dessous la version mise à jour du CARNET DE BORD (un état, réécrit en entier, ${CARNET_MAX_CHARS} caractères au plus : progression chiffrée, ce que vous avez demandé et si c'est appliqué, ce que Monsieur vous a confié, points de vigilance).`;
  return { ...entry, memoryFor: date, apiText: `${base}\n\n(Demande de l'application : voici votre conversation du ${date} avec Monsieur. Retenez-en l'essentiel dans votre carnet de bord.${carnet})\n${transcript}` };
}

/** Message envoyé pour une demande. `text` est affiché dans la conversation ; `apiText` (s'il
 *  diffère) est ce que reçoit le modèle — il reste dans l'historique pour que le cache tienne. */
export function jeffreyAsk(mode, { text, bilanUser, missing, reminders, dateLabel, weather } = {}) {
  if (mode === "point") {
    const t = text || "Faites-moi le point, Jeffrey.";
    return { role: "user", text: t, apiText: `${t}\n\n${POINT_INSTR}`, mode };
  }
  if (mode === "bilan") {
    const t = text || "Le bilan des trois derniers mois, je vous prie.";
    return { role: "user", text: t, mode, apiText: `${t}\n\n(Demande de l'application : BILAN 3 MOIS. Les données ci-dessous ont été calculées sur 90 jours. Rédigez-le dans votre voix, vouvoiement, 400 mots au plus, texte simple sans titres ni gras ; les consignes de forme écrites ci-dessous au tutoiement sont remplacées par celles-ci. Interprétez, ne recalculez pas ; un champ null veut dire pas assez de recul.)\n\n${bilanUser || ""}` };
  }
  if (mode === "brief") {
    // J4 : brief du matin, lu d'abord sur l'écran verrouillé. `missing` = ce qui manque encore
    // (« nuit », « pesée », « genou ») quand il part à 10 h ; `reminders` = rappels calculés par
    // l'app (sauvegarde en retard…). Réflexion courte (effortFor) : il doit tenir dans la minute
    // dont dispose un réveil en arrière-plan.
    const t = text || "Le brief du matin, Jeffrey.";
    const manque = missing?.length
      ? `Il manque encore : ${missing.join(", ")}. Dites-le en une phrase et n'inventez jamais la valeur absente.`
      : "La nuit, la pesée et le genou du jour sont là.";
    const rappels = reminders?.length ? ` Rappels possibles : ${reminders.join(" ; ")}.` : "";
    // J4.2 : météo du jour par créneau (Open-Meteo, position approximative jamais transmise).
    const meteo = weather ? ` Météo du jour par créneau : ${JSON.stringify(weather)}. Une phrase, seulement ce qui change quelque chose (pluie pour la marche ou le trajet, froid ou chaleur) ; sans météo, n'en dites rien.` : "";
    return { role: "user", text: t, mode, apiText: `${t}\n\n(Demande de l'application : BRIEF DU MATIN du ${dateLabel || "jour"}. ${manque}${rappels}${meteo} Dans cet ordre, 150 mots au plus, texte simple : une salutation datée ; la météo si elle compte ; la nuit (score de qualité, jamais la durée seule) ; l'énergie ; la pesée et la tendance 7 j ; le planning du jour et la séance que vous proposez, prise dans SEANCES_AUTORISEES ; une ou deux questions (le genou s'il n'est pas noté, le ressenti) ; un rappel seulement s'il est utile (palier de la semaine, sauvegarde). La première phrase est courte : c'est elle qu'on lit sur l'écran verrouillé. Le brief est lu dans une notification : écrivez tout le texte d'abord, puis appelez seulement l'outil proposer_reponses avec 2 ou 3 réponses courtes, la plus probable en premier (elle devient un bouton de la notification). Aucun autre outil.)` };
  }
  return { role: "user", text, mode: "chat" };
}

/** Filet de sécurité (essai réel du 29/10/2026 : une réponse faite uniquement de boutons, sans un
 *  mot, malgré la consigne). Si la réponse n'a aucun texte mais appelle des outils, l'app renvoie
 *  aussitôt ce message pour que Jeffrey réponde par écrit (un appel de plus, seulement dans ce cas).
 *  → { role: "user", text } à ajouter à l'historique, ou null si rien à faire. */
export function continuationIfSilent(message) {
  if (replyText(message?.content)) return null;
  if (!(message?.content || []).some((b) => b.type === "tool_use")) return null;
  return { role: "user", text: "(Message de l'application : votre réponse n'avait pas de texte. Répondez maintenant à Monsieur par écrit, en quelques phrases, sans rappeler d'outil.)" };
}

/** Bloc des données du moment (dernier bloc du `system`). Il ne change que si une donnée
 *  change : l'heure n'y figure PAS (elle est dans le message de Monsieur), sinon le cache
 *  serait réécrit à chaque minute — constaté à l'essai réel du 29/10/2026. */
export function jeffreyDataBlock({ facts, allowed }) {
  const { heure_analyse: _heure, ...realtime } = facts.realtime || {};
  const parts = [
    "DONNÉES DU MOMENT — calculées par l'application, ne les recalculez pas. Relues à chaque message de Monsieur : elles comptent déjà les actions qu'il a confirmées. L'heure exacte est indiquée en tête du dernier message de Monsieur.",
    `TEMPS RÉEL (hier vs aujourd'hui) : ${JSON.stringify(realtime)}`,
    `RÉSUMÉ 14 JOURS (moyennes, recommandeur, dépense estimée) : ${JSON.stringify(facts.summary)}`,
    `PROGRESSION PAR EXERCICE (14 j) : ${JSON.stringify(facts.exoProgress)}`,
  ];
  if (facts.autresSeances?.length) parts.push(`SÉANCES SANS SÉRIES (basket, escalade ; "charge" = RPE × minutes) : ${JSON.stringify(facts.autresSeances)}`);
  if (facts.notesTxt) parts.push(`NOTES DE CONTEXTE de Monsieur (14 j) :\n${facts.notesTxt}`);
  parts.push(`SEANCES_AUTORISEES (seules séances que vous pouvez proposer) : ${JSON.stringify(allowed)}`);
  parts.push(facts.journal ? `CARNET DE BORD (votre mémoire des jours précédents) :\n${facts.journal}` : "CARNET DE BORD : vide.");
  return parts.join("\n\n");
}

/** Historique stocké → messages de l'API. Une entrée : { role: "user", text } ou
 *  { role: "assistant", content: [blocs reçus], toolResults?: { [id]: texte } }.
 *  - Un tool_use exige un tool_result en tête du message utilisateur suivant.
 *  - La réflexion n'est renvoyée que pour la dernière réponse (signature intacte) : l'API
 *    l'exige pour enchaîner après un outil, et l'ignore pour les tours plus anciens. */
export function toApiMessages(history) {
  const lastAssistant = history.map((h) => h.role).lastIndexOf("assistant");
  const out = [];
  history.forEach((h, i) => {
    if (h.role === "assistant") {
      const content = (h.content || []).filter((b) =>
        (b.type !== "thinking" && b.type !== "redacted_thinking") || i === lastAssistant);
      if (content.length) out.push({ role: "assistant", content });
      return;
    }
    const prev = out[out.length - 1];
    const results = prev?.role === "assistant"
      ? prev.content.filter((b) => b.type === "tool_use").map((b) => ({
          type: "tool_result", tool_use_id: b.id,
          content: history[i - 1]?.toolResults?.[b.id] ?? "Affiché à Monsieur.",
        }))
      : [];
    out.push({ role: "user", content: [...results, { type: "text", text: h.apiText ?? h.text }] });
  });
  return out;
}

/**
 * Requête complète pour une réponse de Jeffrey.
 * `coach` : résultat de `buildCoachPrompt(data, note)` (on n'en garde que `facts`).
 * `history` : messages déjà échangés aujourd'hui, le dernier étant celui de Monsieur.
 * Retourne { system, messages, tools, allowed } — `allowed` sert à valider choisir_seance.
 */
export function buildJeffreyRequest({ coach, persona, nextSession, history, heure }) {
  const facts = coach.facts;
  const allowed = allowedSessions(nextSession);
  const cache = { type: "ephemeral" };
  const system = [
    { type: "text", text: `${ROLE}\n\nCONTEXTE DU COACH (contraintes permanentes) : ${facts.system}\n\n${JEFFREY_RULES}\n\n${CHAT_RULES}` },
    { type: "text", text: `PERSONNALITÉ (écrite par Monsieur ; les règles ci-dessus priment) :\n${(persona || JEFFREY_PERSONA).trim()}`, cache_control: cache },
    { type: "text", text: jeffreyDataBlock({ facts, allowed }), cache_control: cache },
  ];
  const messages = toApiMessages(history);
  // L'heure va dans le dernier message de Monsieur (pas dans les données, voir plus haut), et le
  // troisième point de cache s'y pose : le tour suivant relit tout l'échange depuis le cache.
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const blocks = last.content;
    blocks.splice(blocks.length - 1, 0, { type: "text", text: `heure : ${heure}` });
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: cache };
  }
  return { system, messages, tools: [...JEFFREY_TOOLS, ...JEFFREY_ACTION_TOOLS], allowed };
}
