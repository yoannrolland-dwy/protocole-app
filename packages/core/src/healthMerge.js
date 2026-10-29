// Fusion des lectures Health Connect dans les journaux (extrait de runHealthSync, App.jsx, le
// 29/10/2026, logique inchangée) : la synchro de l'app ET le brief du matin préparé app fermée
// (J4.1) appliquent ainsi exactement la même règle. Health Connect écrase la valeur du jour
// concerné ; un jour sans donnée garde la saisie locale.
import { upsert, round } from "./dateUtils.js";

const each = (byDate, log, fn) => {
  let next = log || [];
  Object.entries(byDate || {}).forEach(([date, v]) => { next = fn(next, date, v); });
  return next;
};

export const mergeSteps = (log, byDate) =>
  each(byDate, log, (next, date, count) => upsert(next, { date, count, source: "healthconnect" }));

// `quality` n'est présent que les nuits avec le détail par phase : absent, une note saisie à la
// main pour ce jour-là n'est pas touchée.
export const mergeSleep = (log, byDate) =>
  each(byDate, log, (next, date, d) => upsert(next, { date, hours: round(d.hours, 2), ...(d.quality != null ? { quality: d.quality } : {}), source: "healthconnect" }));

// `time` (heure de pesée, 08/10/2026) seulement quand Health Connect la fournit. Rattrapage de
// l'heure seule (90 j) sur les pesées déjà présentes hors fenêtre de synchro.
export function mergeWeight(log, byDate, timeByDate) {
  let next = each(byDate, log, (n, date, kg) => {
    const time = timeByDate?.[date];
    return upsert(n, { date, kg, source: "healthconnect", ...(time ? { time } : {}) });
  });
  Object.entries(timeByDate || {}).forEach(([date, time]) => {
    if (byDate?.[date] != null) return;
    const cur = next.find((w) => w.date === date);
    if (cur && !cur.time) next = upsert(next, { ...cur, time });
  });
  return next;
}

export const mergeRhr = (log, byDate) => each(byDate, log, (next, date, bpm) => upsert(next, { date, bpm }));
export const mergeNaps = (log, byDate) => each(byDate, log, (next, date, minutes) => upsert(next, { date, minutes }));
