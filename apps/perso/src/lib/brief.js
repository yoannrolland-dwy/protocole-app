// Brief du matin de Jeffrey (chantier J, J4.1, 29/10/2026) — partagé par la page sans écran que
// réveille Android (src/briefPage.js) et par l'app ouverte le matin (App.jsx). Règles du matin :
// packages/core/src/coach/brief.js. Spec : ROADMAP.md, « Chantier J », décision 12 et J4.
import { getSync, store } from "../store.js";
import { DEFAULT_TARGETS } from "@rawcare/core/targets";
import { SEED_COACH_PROFILE } from "@rawcare/core/coach/prompt";
import { JEFFREY_PERSONA, jeffreyAsk, withMemory, pendingMemoryDate } from "@rawcare/core/coach/jeffrey";
import { today, shiftDateKey, daysBetween } from "@rawcare/core/dateUtils";
import { makeCoach } from "./coachInputs.js";
import { jeffreyTurn, newId, hhmm } from "./jeffreyTurn.js";
import { say } from "./jeffrey.js";

// Marqueurs du jour { doneDate, appDate, remindedDate, tries: { date, n } }. Hors DATA_KEYS, comme
// jeffreyMemoryDate : restaurer une vieille sauvegarde ne doit pas faire croire qu'un brief est fait.
const STATE_KEY = "jeffreyBrief";
export const readBriefState = () => getSync(STATE_KEY, {}) || {};
export const writeBriefState = (patch) => store.set(STATE_KEY, { ...readBriefState(), ...patch });

/** Données telles que l'app les charge (mêmes défauts, mêmes fusions), sans rien écrire. */
export function loadData() {
  const storedTargets = getSync("targets", {}) || {};
  const profile = getSync("coachProfile", null);
  const persona = getSync("jeffreyPersona", null);
  return {
    weight: getSync("weightLog", []), sleep: getSync("sleepLog", []), training: getSync("trainingLog", []),
    knee: getSync("kneeLog", []), rhr: getSync("rhrLog", []), naps: getSync("napLog", []),
    macros: getSync("macroLog", []), steps: getSync("stepsLog", []), notes: getSync("noteLog", []),
    targets: { ...DEFAULT_TARGETS, ...storedTargets, cut: { ...DEFAULT_TARGETS.cut, ...(storedTargets.cut || {}) } },
    phase: getSync("phase", "seche"),
    basketSchedule: getSync("basketSchedule", { weekly: [], matchDates: [] }),
    targetHistory: getSync("targetHistory", []), palierWeekly: getSync("palierWeekly", null),
    coachProfile: profile == null ? SEED_COACH_PROFILE : profile,
    coachJournal: getSync("coachJournal", ""),
    jeffreyPersona: persona == null ? JEFFREY_PERSONA : persona,
  };
}

/** Fournisseur IA des Réglages (même construction qu'App.jsx). */
export function aiFromSettings() {
  return getSync("aiProvider", "anthropic") === "litellm"
    ? { provider: "litellm", baseUrl: getSync("litellmUrl", ""), apiKey: getSync("litellmKey", ""), model: getSync("litellmModel", "") }
    : { provider: "anthropic", apiKey: getSync("apiKey", ""), model: getSync("model", "claude-sonnet-5-5") };
}

/** Journal alimentaire lu au moment de la réponse (actions J2b). */
export const foodContext = () => ({
  foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}),
  pins: getSync("foodPins", []), muted: getSync("foodMuted", []), today: today(),
});

const ITEM = { nuit: "votre nuit", "pesée": "votre pesée", genou: "votre genou" };
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);

/** « J'ai votre nuit ; il me manque votre pesée et votre genou. » */
export function missingSentence(missing) {
  const have = ["nuit", "pesée", "genou"].filter((k) => !missing.includes(k)).map((k) => ITEM[k]);
  const need = list(missing.map((k) => ITEM[k]));
  return have.length ? `J'ai ${list(have)} ; il me manque ${need}.` : `Il me manque ${need}.`;
}
export const missingText = (missing, remind = false) =>
  say(remind ? "briefRemind" : "briefWaiting", { x: missingSentence(missing) });

/** Rappels utiles calculés par l'app (la sauvegarde hors du téléphone en retard). */
export function briefReminders() {
  const last = getSync("lastCloudBackup", null);
  if (!last) return ["sauvegarde hors du téléphone : jamais faite"];
  const days = daysBetween(last, today());
  return days >= 14 ? [`sauvegarde hors du téléphone : dernière il y a ${days} jours`] : [];
}

const dateLabel = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Brief sans IA (serveur muet 3 fois) : la date, la séance du recommandeur, ce qui manquait. */
export function fallbackText(nextSession, missing) {
  const top = nextSession?.today?.suggestions?.[0];
  return [
    say("briefFallback"),
    `Nous sommes ${dateLabel()}.`,
    top ? `Séance proposée : ${top.type}${top.reason ? ` (${top.reason})` : ""}.` : nextSession?.today?.note || null,
    missing.length ? `Il me manquait ${list(missing.map((k) => ITEM[k]))}.` : null,
  ].filter(Boolean).join(" ");
}

/** Enregistre la conversation du jour (élagage à 30 jours, comme App.jsx). */
function saveDay(date, entries) {
  const oldest = shiftDateKey(today(), -30);
  const log = { ...getSync("jeffreyLog", {}), [date]: entries };
  store.set("jeffreyLog", Object.fromEntries(Object.entries(log).filter(([d]) => d >= oldest)));
}

/**
 * Écrit le brief dans la conversation du jour et le marque fait. → texte de la réponse.
 * `data` : loadData() (ou l'état de l'app), Health Connect déjà fusionné.
 */
export async function runBrief({ data, ai, transport, missing, onText }) {
  const date = today();
  const log = getSync("jeffreyLog", {});
  const entries = log[date] || [];
  let ask = jeffreyAsk("brief", { dateLabel: dateLabel(), missing, reminders: briefReminders() });
  // Mémoire de la veille (J1.3) : versée au premier message du jour, comme dans la conversation.
  const memDate = pendingMemoryDate(log, date, getSync("jeffreyMemoryDate", null));
  if (memDate && !entries.some((e) => e.memoryFor === memDate)) ask = withMemory(ask, memDate, log[memDate]);
  const history = [...entries, { ...ask, id: newId(), at: hhmm() }];
  const note = (data.notes || []).find((n) => n.date === date)?.text || "";
  const save = ({ history: h, journal, memDate: md }) => {
    if (journal) { store.set("coachJournal", journal); if (md) store.set("jeffreyMemoryDate", md); }
    saveDay(date, h);
  };
  try {
    const r = await jeffreyTurn({ history, mode: "brief", coach: makeCoach(data), ai, note, transport, foodContext, onText });
    save(r);
    writeBriefState({ doneDate: date });
    return [...r.history].reverse().find((e) => e.role === "assistant" && e.text)?.text || "";
  } catch (e) {
    if (e.partial) save(e.partial);
    throw e;
  }
}

/** Repli sans IA : écrit dans la conversation et marque le brief fait. */
export function saveFallback(nextSession, missing) {
  const date = today();
  const text = fallbackText(nextSession, missing);
  const entries = getSync("jeffreyLog", {})[date] || [];
  saveDay(date, [...entries, { id: newId(), role: "assistant", at: hhmm(), text, meta: null }]);
  writeBriefState({ doneDate: date });
  return text;
}
