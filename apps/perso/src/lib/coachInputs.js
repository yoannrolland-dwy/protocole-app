// Requête du coach et de Jeffrey à partir des données (extrait d'App.jsx le 29/10/2026, logique
// inchangée). L'app la construit avec son état React, le brief du matin (J4.1, page sans écran)
// avec les données relues dans le stockage : jamais deux façons d'assembler la même requête.
import { getSync } from "../store.js";
import { today } from "../ui.jsx";
import { computeEnergyScore } from "@rawcare/core/energy";
import { nextSessions } from "@rawcare/core/nextSession";
import { buildCoachPrompt } from "@rawcare/core/coach/prompt";
import { buildJeffreyRequest } from "@rawcare/core/coach/jeffrey";
import { familiesForToday, isMatchWeek, isPostMatchDay, planForDate } from "./plan.js";

/** `d` : { weight, sleep, training, knee, macros, notes, steps, rhr, naps, targets, phase,
 *  basketSchedule, targetHistory, palierWeekly, coachProfile, coachJournal, jeffreyPersona }. */
export function makeCoach(d) {
  const energy = () => computeEnergyScore(today(), { rhrLog: d.rhr, sleepLog: d.sleep, stepsLog: d.steps, napLog: d.naps });
  const next = (en) => nextSessions({ now: new Date(), base: { training: d.training, knee: d.knee, sleep: d.sleep, targets: d.targets, basketSchedule: d.basketSchedule, energy: en }, planFor: planForDate(d.basketSchedule) });
  // Le journal alimentaire est lu frais (getSync), jamais une copie du montage : un repas ajouté
  // pendant la session doit compter.
  const buildPrompt = (note, { profile = d.coachProfile, journal = d.coachJournal } = {}) => {
    const en = energy();
    return buildCoachPrompt({
      weight: d.weight, sleep: d.sleep, training: d.training, knee: d.knee, macros: d.macros, notes: d.notes, steps: d.steps, targets: d.targets, phase: d.phase,
      foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
      profile, journal, basketSchedule: d.basketSchedule, weeklyPlan: familiesForToday(d.basketSchedule),
      matchWeek: isMatchWeek(d.basketSchedule), postMatch: isPostMatchDay(d.basketSchedule), targetHistory: d.targetHistory, palier: d.palierWeekly,
      // Recommandeur temporel (S2) : même verdict Aujourd'hui/Demain que la carte du Dashboard.
      nextSession: next(en),
      energy: en,
    }, note);
  };
  // Jeffrey (J1.2) : mêmes faits que le Coach IA et même verdict que « Prochaine séance ».
  const jeffreyRequest = (history, note) => buildJeffreyRequest({
    coach: buildPrompt(note), persona: d.jeffreyPersona, nextSession: next(energy()), history,
    heure: new Date().toTimeString().slice(0, 5),
  });
  // Verdict Aujourd'hui/Demain seul (brief sans IA, J4.1).
  const nextSession = () => next(energy());
  return { buildPrompt, jeffreyRequest, nextSession };
}
