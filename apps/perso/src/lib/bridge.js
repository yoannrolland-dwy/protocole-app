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
import { loadData, briefReminders, aiFromSettings, foodContext, briefDoneFromJeffrey } from "./brief.js";
import { saveTurn } from "./conversationStore.js";
import { makeCoach } from "./coachInputs.js";
import { checkAgir, doneSummary, paramsKey } from "@rawcare/core/coach/bridgeActions";
import { searchCiqual, getCiqual } from "@rawcare/core/nutrition/ciqual";
import { applyActionStored } from "./jeffreyNotify.js";
import { readDraft, writeDraft } from "./sessionDraft.js";
import { restAnnouncement } from "./restSpeech.js";
import { nativeRest, markJeffreyRest, restAfterSet } from "./bridgeRest.js";
import { readSession, logSet, undoLastSet, goToExercise, nextExercise, restAction, finishCheck, abandonCheck } from "@rawcare/core/session/voiceSession";
import { currentSet } from "@rawcare/core/session/engine";
import { byDate } from "@rawcare/core/dateUtils";
import { briefAfterKnee } from "@rawcare/core/coach/brief";
import { jeffreyTurn, newId, hhmm } from "./jeffreyTurn.js";
import { dispatchBridge } from "./restoreGuard.js";
import { aiMissing } from "./ai.js";

/** Erreur du pont : un code court, jamais un texte technique ni une donnée. */
const fail = (code) => Object.assign(new Error(code), { bridgeCode: code });

export const bridgeVersion = () => ({ pont: BRIDGE_VERSION, appli: APP_VERSION });

/** `lire {sujet}` → { date, regles, faits, manque }. Rien n'est écrit. */
export function readSubject(sujet) {
  // G4-C3 : la séance en cours (brouillon), pour la séance à la voix.
  if (sujet === "seance") return { date: today(), ...readSession(readDraft(), sessionCtx(Date.now())) };
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
    saveTurn(date, entries, h); // fusion dans la conversation du moment (audit, point 13)
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
  // G4-C3 : gestes de séance notés tout de suite (choix de Yoann), sans relecture ni jeton.
  if (SESSION_NOW.has(action)) return runSessionNow(action, parametres, { now, write: args?.verifier === false });
  const check = SESSION_CONFIRM.has(action) ? () => sessionConfirmCheck(action, parametres, now) : () => checkAgir(action, parametres, ctx);
  if (args?.verifier !== false) {
    const res = await check();
    if (!res.ok) return res;
    const jeton = newJeton();
    const kept = Object.entries(pendingAgir(now)).sort((a, b) => b[1].exp - a[1].exp).slice(0, AGIR_MAX - 1);
    store.set(AGIR_KEY, Object.fromEntries([...kept, [jeton, { key, resume: res.resume, exp: now + AGIR_TTL_MS }]]));
    return { ok: true, resume: res.resume, ...(res.question ? { question: res.question } : {}), jeton };
  }
  const pending = pendingAgir(now);
  const p = args?.jeton ? pending[args.jeton] : null;
  if (!p || p.key !== key) {
    return { fait: false, raison: "rien n'a été relu à Monsieur pour cette demande (jeton absent, périmé ou paramètres différents) : relisez-la d'abord" };
  }
  // Jeton à usage unique : retiré avant l'écriture.
  delete pending[args.jeton];
  store.set(AGIR_KEY, pending);
  const res = await check();
  if (!res.ok) return { fait: false, raison: res.raison };
  if (res.resume !== p.resume) return { fait: false, raison: `les données ont changé depuis la relecture ; relisez à Monsieur : ${res.resume}` };
  if (res.apply) { res.apply(); return { fait: true, resume: res.done }; }
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

// --- G4-C3 : la séance à la voix (05/11/2026) ----------------------------------------------------
// Règles pures : packages/core/src/session/voiceSession.js ; ici, l'écriture du brouillon, le
// réveil de fin de repos (natif, par la page) et l'enregistrement de la séance.
const SESSION_NOW = new Set(["noter_serie", "annuler_serie", "aller_a", "exercice_suivant", "repos"]);
const SESSION_CONFIRM = new Set(["terminer_seance", "annuler_seance"]);

function sessionCtx(now) {
  return { training: getSync("trainingLog", []), knee: getSync("kneeLog", []), now };
}

/** Geste de séance immédiat. `write: false` : décrit sans rien écrire. */
export function runSessionNow(action, p, { now = Date.now(), write = true } = {}) {
  const d = readDraft();
  const ctx = sessionCtx(now);
  let r;
  if (action === "noter_serie") r = logSet(d, p, ctx);
  else if (action === "annuler_serie") r = undoLastSet(d);
  else if (action === "aller_a") r = goToExercise(d, p, ctx);
  else if (action === "exercice_suivant") r = nextExercise(d, ctx);
  else r = restAction(d, p?.action, now);
  if (!r.ok) {
    const out = { fait: false, raison: r.raison };
    if (r.choix) out.choix = r.choix;
    if (r.besoin) out.besoin = r.besoin;
    return out;
  }
  let draft = r.draft;
  // Série notée : repos de l'exercice lancé, avec la phrase de fin de repos du carnet.
  if (action === "noter_serie") {
    // Sans repos prévu : aucun minuteur, le repos en cours s'arrête, pas de bip (`restAfterSet`).
    draft = restAfterSet(draft, { secs: r.restSecs, label: draft.exos[r.ei].nom, speech: restAnnouncement(draft.exos, r.ei, r.si), now });
  }
  if (action === "annuler_serie" && draft.rest?.endAt) draft = { ...draft, rest: { ...draft.rest, endAt: null, remaining: draft.rest.secs } };
  if (action === "repos" && p?.action === "lancer") {
    const cur = currentSet(draft.exos, { ei: draft.courant });
    if (cur) draft = { ...draft, rest: { ...draft.rest, speech: restAnnouncement(draft.exos, cur.ei, -1) } };
  }
  const out = { fait: true, resume: r.phrase };
  if (r.record) out.record = true;
  if (r.plateau) out.plateau = r.plateau;
  if (!write) return { ok: true, resume: r.phrase, immediat: true };
  draft = markJeffreyRest(draft, action);
  writeDraft(draft);
  if (action === "noter_serie" || action === "annuler_serie" || action === "repos") nativeRest(draft.rest);
  return out;
}

/** Fin ou abandon de la séance : relecture (résumé, question), puis écriture après « oui ». */
function sessionConfirmCheck(action, p, now) {
  const d = readDraft();
  if (action === "terminer_seance") {
    const r = finishCheck(d, p, { nowMs: now });
    if (!r.ok) return r;
    return {
      ok: true, resume: r.resume, question: r.question, done: `Séance ${d.type} enregistrée, Monsieur.`,
      apply: () => {
        const log = getSync("trainingLog", []);
        const next = r.editingId ? log.map((t) => (t.id === r.editingId ? r.record : t)) : [...log, r.record];
        store.set("trainingLog", next.sort(byDate));
        store.set("trainingDraft", null);
        nativeRest(null);
      },
    };
  }
  const r = abandonCheck(d);
  if (!r.ok) return r;
  return {
    ok: true, resume: r.resume, question: r.question, done: `Séance ${d.type} abandonnée : rien n'a été enregistré.`,
    apply: () => { store.set("trainingDraft", null); nativeRest(null); },
  };
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
    // Pendant une restauration (gel de store.js), une opération qui écrit rend « restauration »,
    // jamais un succès : refusée avant, résultat écarté si le gel apparaît pendant (restoreGuard.js).
    return await dispatchBridge(op, async () => {
      if (op === "version") return { ok: true, json: bridgeVersion() };
      if (op === "lire") return { ok: true, json: readSubject(args?.sujet) };
      if (op === "analyse") return { ok: true, json: await runAnalyse({ type: args?.type, transport }) };
      // G2 : JEFFREY confirme qu'il fait le brief du jour, avant de parler ou de notifier.
      if (op === "brief_fait") return { ok: true, json: briefDoneFromJeffrey(args) };
      // G3 : action relue puis écrite (voir runAgir).
      if (op === "agir") return { ok: true, json: await runAgir(args) };
      return { ok: false, erreur: "inconnu" };
    });
  } catch (e) {
    // Seulement un code connu : jamais un message d'erreur qui pourrait porter une donnée.
    const code = e?.bridgeCode || e?.code;
    return { ok: false, erreur: BRIDGE_ERRORS.includes(code) ? code : "interne" };
  }
}
