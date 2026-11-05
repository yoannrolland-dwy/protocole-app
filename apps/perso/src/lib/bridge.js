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

/**
 * Une requête du pont → { ok: true, json } ou { ok: false, erreur }. `json` : texte JSON de la
 * question ({ sujet }, { type } ou { date }). Opérations : version, lire, analyse (G1), brief_fait (G2).
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
    return { ok: false, erreur: "inconnu" };
  } catch (e) {
    // Seulement un code connu : jamais un message d'erreur qui pourrait porter une donnée.
    const code = e?.bridgeCode || e?.code;
    return { ok: false, erreur: BRIDGE_ERRORS.includes(code) ? code : "interne" };
  }
}
