// Pont privé PROTOCOLE → JEFFREY, étape G1 (lecture seule, 05/11/2026). Exécuté par la page sans
// écran bridge.html (src/bridgePage.js), à la demande de l'appli JEFFREY (service lié protégé
// JeffreyBridgeService.kt). Mêmes données et mêmes calculs que l'app : loadData() + makeCoach().
// Mise en forme des faits : packages/core/src/coach/bridge.js. Contrat : jeffrey-app,
// docs/cadrage/ETAPE_G_PONT_PROTOCOLE.md, §6.
import { getSync, store } from "../store.js";
import { today } from "@rawcare/core/dateUtils";
import { computeEnergyScore } from "@rawcare/core/energy";
import { briefMissing } from "@rawcare/core/coach/brief";
import { buildReading, BRIDGE_VERSION, BRIDGE_SUBJECTS, BRIDGE_ERRORS } from "@rawcare/core/coach/bridge";
import { jeffreyAsk, withMemory, pendingMemoryDate } from "@rawcare/core/coach/jeffrey";
import { APP_VERSION } from "../version.js";
import { loadData, briefReminders, aiFromSettings, foodContext, saveDay, briefDoneFromJeffrey } from "./brief.js";
import { makeCoach } from "./coachInputs.js";
import { checkAgir, doneSummary, paramsKey } from "@rawcare/core/coach/bridgeActions";
import { searchCiqual, getCiqual } from "@rawcare/core/nutrition/ciqual";
import { applyActionStored } from "./jeffreyNotify.js";
import { briefAfterKnee } from "@rawcare/core/coach/brief";
import { jeffreyTurn, newId, hhmm } from "./jeffreyTurn.js";
import { aiMissing } from "./ai.js";

/** Erreur du pont : un code court, jamais un texte technique ni une donnée. */
const fail = (code) => Object.assign(new Error(code), { bridgeCode: code });

export const bridgeVersion = () => ({ pont: BRIDGE_VERSION, appli: APP_VERSION });

/** `lire {sujet}` → { date, regles, faits, manque }. Rien n'est écrit. */
export function readSubject(sujet) {
  if (!BRIDGE_SUBJECTS.includes(sujet)) throw fail("inconnu");
  const data = loadData();
  const date = today();
  const coach = makeCoach(data);
  const note = (data.notes || []).find((n) => n.date === date)?.text || "";
  return buildReading(sujet, {
    date, heure: hhmm(),
    coach: coach.buildPrompt(note),
    nextSession: coach.nextSession(),
    energy: computeEnergyScore(date, { rhrLog: data.rhr, sleepLog: data.sleep, stepsLog: data.steps, napLog: data.naps }),
    napMinutes: (data.naps || []).find((n) => n.date === date)?.minutes ?? null,
    missing: briefMissing({ today: date, sleep: data.sleep, weight: data.weight, knee: data.knee }),
    reminders: briefReminders(),
    bilan: sujet === "bilan" ? coach.buildBilan() : null,
  });
}

/**
 * `analyse {type: point|bilan}` → { texte }. Exactement le point et le bilan de Jeffrey dans
 * PROTOCOLE : même demande (jeffreyAsk), même tour (jeffreyTurn), avec la configuration IA des
 * Réglages (Opus). Écrit dans la conversation du jour et met le carnet de bord à jour, comme
 * aujourd'hui. `transport` : relais HTTP natif de la page.
 */
export async function runAnalyse({ type, transport }) {
  if (type !== "point" && type !== "bilan") throw fail("inconnu");
  const ai = aiFromSettings();
  if (aiMissing(ai)) throw fail("ia_absente");
  const data = loadData();
  const coach = makeCoach(data);
  const date = today();
  const log = getSync("jeffreyLog", {});
  const entries = log[date] || [];
  let ask = type === "bilan" ? jeffreyAsk("bilan", { bilanUser: coach.buildBilan().user }) : jeffreyAsk("point");
  // Mémoire de la veille (J1.3) : versée au premier message du jour, comme dans la conversation.
  const memDate = pendingMemoryDate(log, date, getSync("jeffreyMemoryDate", null));
  if (memDate && !entries.some((e) => e.memoryFor === memDate)) ask = withMemory(ask, memDate, log[memDate]);
  const history = [...entries, { ...ask, id: newId(), at: hhmm() }];
  const note = (data.notes || []).find((n) => n.date === date)?.text || "";
  const save = ({ history: h, journal, memDate: md }) => {
    if (journal) { store.set("coachJournal", journal); if (md) store.set("jeffreyMemoryDate", md); }
    saveDay(date, h);
  };
  let r;
  try {
    r = await jeffreyTurn({ history, mode: type, coach, ai, note, transport, foodContext });
  } catch (e) {
    if (e.partial) save(e.partial);
    throw fail("ia_echec");
  }
  save(r);
  const texte = [...r.history].reverse().find((e) => e.role === "assistant" && e.text)?.text || "";
  if (!texte) throw fail("ia_echec");
  return { texte };
}

// --- G3 : agir (05/11/2026) ---------------------------------------------------------------------
// Relecture d'abord (`verifier: true`) : rien n'est écrit, PROTOCOLE rend la phrase à relire et un
// jeton. L'écriture (`verifier: false`) exige ce jeton, pour exactement les mêmes paramètres, dans
// les 3 minutes, une seule fois ; l'action est revérifiée sur les données du moment et n'est écrite
// que si sa phrase n'a pas changé. Ainsi ce qui est écrit est toujours ce que Monsieur a entendu.
// Jetons en attente : clé `jeffreyAgir`, hors DATA_KEYS (marqueur du moment, jamais exporté).
const AGIR_KEY = "jeffreyAgir";
const AGIR_TTL_MS = 3 * 60_000;
const AGIR_MAX = 5;

/** Données lues au moment de la demande (mêmes clés que les écrans). */
export function agirContext() {
  return {
    today: today(),
    weight: getSync("weightLog", []), knee: getSync("kneeLog", []), macros: getSync("macroLog", []),
    foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}),
    mealPins: getSync("foodMealPins", {}), mealMuted: getSync("foodMealMuted", {}),
    recipes: getSync("foodRecipes", []),
    ciqual: { search: (q, limit) => searchCiqual(q, { limit }), get: getCiqual },
    // G4-A : séances.
    now: new Date(), nowMs: Date.now(),
    training: getSync("trainingLog", []), draft: getSync("trainingDraft", null),
    nextSession: () => makeCoach(loadData()).nextSession(),
  };
}

const pendingAgir = (now) => Object.fromEntries(Object.entries(getSync(AGIR_KEY, {}) || {}).filter(([, v]) => v?.exp > now));
const newJeton = () => Math.random().toString(36).slice(2, 8);

/**
 * `agir { action, parametres, verifier, jeton? }`.
 * verifier: true → { ok: true, resume, jeton } ou { ok: false, raison, choix?, besoin? }.
 * verifier: false → { fait: true, resume, brief_du_jour?, ouvrir? } ou { fait: false, raison }.
 * `brief_du_jour: "a_faire"` : genou noté et brief du jour à faire (voir briefAfterKnee).
 */
export async function runAgir(args, { now = Date.now(), ctx = agirContext() } = {}) {
  const action = args?.action;
  const parametres = args?.parametres && typeof args.parametres === "object" ? args.parametres : {};
  const key = paramsKey(action, parametres);
  if (args?.verifier !== false) {
    const res = await checkAgir(action, parametres, ctx);
    if (!res.ok) return res;
    const jeton = newJeton();
    const kept = Object.entries(pendingAgir(now)).sort((a, b) => b[1].exp - a[1].exp).slice(0, AGIR_MAX - 1);
    store.set(AGIR_KEY, Object.fromEntries([...kept, [jeton, { key, resume: res.resume, exp: now + AGIR_TTL_MS }]]));
    return { ok: true, resume: res.resume, jeton };
  }
  const pending = pendingAgir(now);
  const p = args?.jeton ? pending[args.jeton] : null;
  if (!p || p.key !== key) {
    return { fait: false, raison: "rien n'a été relu à Monsieur pour cette demande (jeton absent, périmé ou paramètres différents) : relisez-la d'abord" };
  }
  // Jeton à usage unique : retiré avant l'écriture.
  delete pending[args.jeton];
  store.set(AGIR_KEY, pending);
  const res = await checkAgir(action, parametres, ctx);
  if (!res.ok) return { fait: false, raison: res.raison };
  if (res.resume !== p.resume) return { fait: false, raison: `les données ont changé depuis la relecture ; relisez à Monsieur : ${res.resume}` };
  const change = applyActionStored(res.act);
  const out = { fait: true, resume: doneSummary(res.act, change) };
  // G4-A : séance démarrée → JEFFREY ouvre PROTOCOLE (le service ne peut pas lancer une activité
  // depuis l'arrière-plan). L'app ouvre le carnet d'elle-même (clé jeffreyStart) ; l'extra
  // open_tab l'amène simplement sur l'onglet Séance.
  if (res.act.kind === "demarrer") {
    out.ouvrir = { paquet: "com.yoannrolland.protocole", activite: "com.yoannrolland.protocole.MainActivity", extras: { open_tab: "train" } };
  }
  // Genou noté : si la règle du brief le lancerait maintenant, JEFFREY enchaîne sur le brief (même
  // app fermée). Réglage Activé / Désactivé lu par le natif ; absent (aperçu) = activé.
  if (res.act.kind === "genou") {
    const enabled = window.JeffreyBridgePage?.briefEnabled ? window.JeffreyBridgePage.briefEnabled() : true;
    const b = briefAfterKnee({ now: new Date(now), today: ctx.today, knee: getSync("kneeLog", []), state: getSync("jeffreyBrief", {}) || {}, enabled });
    if (b) out.brief_du_jour = b;
  }
  return out;
}

/**
 * Une requête du pont → { ok: true, json } ou { ok: false, erreur }. `json` : texte JSON de la
 * question ({ sujet }, { type }, { date } ou { action, parametres, verifier, jeton }). Opérations :
 * version, lire, analyse (G1), brief_fait (G2), agir (G3).
 */
export async function handleBridgeRequest(op, json, { transport } = {}) {
  try {
    let args = {};
    try { args = json ? JSON.parse(json) : {}; } catch { return { ok: false, erreur: "inconnu" }; }
    if (op === "version") return { ok: true, json: bridgeVersion() };
    if (op === "lire") return { ok: true, json: readSubject(args?.sujet) };
    if (op === "analyse") return { ok: true, json: await runAnalyse({ type: args?.type, transport }) };
    // G2 : JEFFREY confirme qu'il fait le brief du jour, avant de parler ou de notifier.
    if (op === "brief_fait") return { ok: true, json: briefDoneFromJeffrey(args) };
    // G3 : action relue puis écrite (voir runAgir).
    if (op === "agir") return { ok: true, json: await runAgir(args) };
    return { ok: false, erreur: "inconnu" };
  } catch (e) {
    // Seulement un code connu : jamais un message d'erreur qui pourrait porter une donnée.
    const code = e?.bridgeCode || e?.code;
    return { ok: false, erreur: BRIDGE_ERRORS.includes(code) ? code : "interne" };
  }
}
