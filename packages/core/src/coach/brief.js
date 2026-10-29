// Brief du matin de Jeffrey (chantier J, J4.1, 29/10/2026) : quand le préparer, quoi attendre.
// Pur et testé ; la page sans écran (réveil Android) et l'app ouverte utilisent ces mêmes règles,
// pour qu'il n'y ait jamais deux briefs payés le même matin.
//
// Décisions (ROADMAP.md, chantier J, décision 12 et J4) : il attend la nuit, la pesée et le
// genou ; tant qu'il en manque, une seule notification mise à jour sans bruit, une relance
// sonore vers 9 h, et à 10 h le brief part avec ce qu'il a. Premier réveil à 5 h 17 (choix de
// Yoann), puis toutes les 20 minutes. Tous les jours.

export const BRIEF = {
  start: [5, 17],
  stepMin: 20,
  remind: [9, 0],
  deadline: [10, 0],
  retryMin: 5,
  maxTries: 3,
};

const at = (d, [h, m]) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);

/** Ce qui manque encore aujourd'hui, dans l'ordre où Jeffrey l'énumère. */
export function briefMissing({ today, sleep, weight, knee }) {
  const has = (log) => (log || []).some((e) => e.date === today);
  return [!has(sleep) && "nuit", !has(weight) && "pesée", !has(knee) && "genou"].filter(Boolean);
}

/**
 * Que faire à ce réveil ? `state` = { doneDate, appDate, remindedDate } (marqueurs du jour).
 * - skip : brief déjà fait, ou l'app a pris la main ce matin (ouverte avant le brief) ;
 * - wait : trop tôt (réveil en avance) ;
 * - brief : tout est là, ou il est 10 h passées ;
 * - remind : il manque encore quelque chose à 9 h passées, relance sonore pas encore faite ;
 * - update : il manque quelque chose, notification mise à jour sans bruit.
 */
export function briefDecision({ now, today, missing, state = {} }) {
  if (state.doneDate === today || state.appDate === today) return "skip";
  if (now < at(now, BRIEF.start)) return "wait";
  if (!missing.length || now >= at(now, BRIEF.deadline)) return "brief";
  if (now >= at(now, BRIEF.remind) && state.remindedDate !== today) return "remind";
  return "update";
}

/** Heure du prochain réveil. Brief fait (ou 10 h passées) → demain 5 h 17. Sinon toutes les
 *  20 minutes, sans jamais sauter 9 h (la relance) ni 10 h (l'échéance). */
export function nextBriefAlarm(now, { doneToday = false } = {}) {
  const start = at(now, BRIEF.start);
  const remind = at(now, BRIEF.remind);
  const deadline = at(now, BRIEF.deadline);
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (doneToday || now >= deadline) return tomorrow;
  if (now < start) return start;
  const step = new Date(now.getTime() + BRIEF.stepMin * 60000);
  const candidates = [step, remind, deadline].filter((d) => d > now);
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

/** Après un échec de l'IA : réessayer dans 5 minutes, puis repli sans IA au 3e échec. */
export function briefRetry(now, tries) {
  if (tries >= BRIEF.maxTries) return { fallback: true };
  return { fallback: false, at: new Date(now.getTime() + BRIEF.retryMin * 60000) };
}
