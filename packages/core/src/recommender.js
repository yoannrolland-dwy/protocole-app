// RECOMMANDEUR — historique des séances + état du genou et du coude.
// Sort des suggestions classées ET des séances à éviter.
//
// Extrait de src/App.jsx (apps/perso) le 05/08/2026, chantier RawCare Phase 0. Pur,
// contenu inchangé — vérifié par diff sur plusieurs scénarios synthétiques avant et après
// l'extraction (genou hors base, coude ambre, grosse séance d'escalade, fenêtre de sèche,
// sommeil court, charge 3 jours élevée).

import { today, byDate, daysBetween, fmtHM } from "./dateUtils.js";
import { zoneState } from "./pain.js";
import { TEMPLATES } from "./session/templates.js";
import { climbLoad, gradeLabel } from "./climbing.js";
import { isCutWindow } from "./targets.js";

export function recommendSessions({ training, knee, elbow, sleep, targets }) {
  const t0 = today();
  const isUpper = (t) => t.type === "Upper A" || t.type === "Upper B";
  const isLower = (t) => t.type === "Lower A" || t.type === "Lower B";
  // `d >= 0` indispensable : sans lui, une entrée datée dans le futur (le sélecteur de
  // date le permet) donne un écart négatif, donc « <= n » est vrai et elle compte dans
  // la semaine écoulée. Même garde-fou que le helper global `withinDays`.
  const within = (arr, n) => arr.filter((e) => { const d = daysBetween(e.date, t0); return d >= 0 && d <= n; });
  const daysSince = (pred) => {
    const hits = training.filter(pred);
    return hits.length ? daysBetween(hits[hits.length - 1].date, t0) : Infinity;
  };
  const ago = (d) => (isFinite(d) ? (d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`) : "jamais fait");
  const cap = (d) => (isFinite(d) ? Math.min(d, 7) : 7);

  // volume des 7 derniers jours
  const w = within(training, 6);
  const upper7 = w.filter(isUpper).length;
  const lower7 = w.filter(isLower).length;
  const basket7 = w.filter((t) => t.type === "Basket").length;
  const climb7 = w.filter((t) => t.type === "Escalade").length;

  const dUpper = daysSince(isUpper);
  const dLower = daysSince(isLower);
  const dBasket = daysSince((t) => t.type === "Basket");
  const dClimb = daysSince((t) => t.type === "Escalade");
  const dKnee = daysSince((t) => TEMPLATES[t.type]?.knee); // Lower + Basket

  // Charge de la dernière séance d'escalade (V5) : jusqu'ici la pénalité « escalade
  // récente » était FORFAITAIRE — une heure tranquille et une grosse session de blocs
  // comptaient pareil. `climbLoad` renvoie `null` si la séance n'a pas de blocs saisis
  // (tout l'historique d'avant V5), et le comportement forfaitaire d'origine s'applique
  // alors tel quel : pas de charge supposée à partir d'une donnée absente.
  const lastClimb = training.filter((t) => t.type === "Escalade").slice(-1)[0];
  const climbLast = dClimb <= 1 ? climbLoad(lastClimb) : null;
  // Pénalité modulée : une session légère pèse moins qu'un forfait, une grosse pèse plus.
  const CLIMB_PEN = { legere: 4, normale: 8, grosse: 14 };
  const climbPen = climbLast ? CLIMB_PEN[climbLast.level] : 8;
  const climbWhy = climbLast
    ? `Escalade ${dClimb === 0 ? "aujourd'hui" : "hier"} : ${climbLast.n} blocs${climbLast.max ? ` (max ${gradeLabel(climbLast.max)})` : ""} — ${climbLast.level === "grosse" ? "grosse session, tirage lourd sur le coude" : climbLast.level === "legere" ? "session légère, impact limité sur le coude" : "charge de tirage normale"}.`
    : "Escalade récente : allège le tirage (coude).";

  // État du genou (bas du corps) et du coude (tirage) — même lecture, deux réglages.
  // Le genou est un gate dur : pas de donnée fraîche ⇒ prudence par défaut. Le coude ne
  // module que des scores tant qu'une douleur réelle n'est pas notée (silencieux sinon).
  const K = zoneState(knee, t0, "genou", { unknownIsCaution: true });
  const E = zoneState(elbow, t0, "coude", { unknownIsCaution: false });
  const { unknown: kneeUnknown, painLast, flagged7, red: kneeRed, amber: kneeAmber, note: kneeNote } = K;
  const kLast = K.last;
  const elbowRed = E.red, elbowAmber = E.amber;
  // Raison chiffrée réutilisée sur Upper et Escalade quand le coude est sensible. La
  // dernière douleur peut être absente alors que la zone est ambre (relevé hors base il y
  // a 4-6 j, donc compté dans `flagged7` mais périmé comme état) : on ne prétend pas
  // afficher un chiffre du jour dans ce cas.
  const elbowWhy = E.painLast != null
    ? `Coude ${E.painLast}/10${E.flagged7 ? `, ${E.flagged7} j hors base sur 7` : ""}`
    : `Coude : ${E.flagged7} j hors base sur les 7 derniers jours`;

  // Sommeil récent — nudge, pas un blocage : contrairement au genou (tendinopathie, donc
  // gate dur), une mauvaise nuit est un facteur de prudence parmi d'autres, pas un verdict
  // de sécurité. Pas de donnée = pas de pénalité (silencieux), pour ne pas punir une simple
  // absence de saisie comme le ferait le genou.
  const lastNight = (sleep || []).slice().sort(byDate).pop();
  const lastNightFresh = lastNight && daysBetween(lastNight.date, t0) <= 1;
  const sleepPoor = lastNightFresh && (lastNight.hours < 6 || (lastNight.quality != null && lastNight.quality <= 2));
  const sleepNote = sleepPoor ? `Nuit courte (${fmtHM(lastNight.hours)}) → séance allégée ou repos conseillé.` : null;

  // Charge des 3 derniers jours (fatigue à court terme) — distinct du volume 7 j déjà
  // utilisé plus haut : 3 séances sur 3 jours signale une fatigue qu'une moyenne
  // hebdomadaire peut masquer.
  const load3 = within(training, 2).length;
  const loadHigh = load3 >= 3;

  // Fenêtre d'objectif (sèche avant vacances) : la règle du profil est de ne jamais AJOUTER
  // de volume à impact par rapport au rythme habituel — donc on n'interdit pas Basket/
  // Escalade (ils restent dans sa rotation normale), mais on n'inflate plus leur score et on
  // favorise un peu plus le repos, pour ne pas pousser vers plus de séances que d'habitude.
  const cutOn = isCutWindow(t0, targets);

  // ce qui est déjà fait aujourd'hui
  const todayTypes = training.filter((t) => t.date === t0).map((t) => t.type);
  const upperToday = todayTypes.some((x) => x.startsWith("Upper"));
  const lowerToday = todayTypes.some((x) => x.startsWith("Lower"));
  const climbToday = todayTypes.includes("Escalade");
  const kneeToday = todayTypes.some((x) => TEMPLATES[x]?.knee);

  // variante la moins récente
  const variant = (a, b) => {
    const da = daysSince((t) => t.type === a), db = daysSince((t) => t.type === b);
    return da >= db ? a : b;
  };

  const sugg = [], avoid = [];
  const push = (arr, type, score, reason) => arr.push({ type, score, reason });

  // Nudge fatigue partagé (sommeil + charge 3j), appliqué à toute option encore en lice —
  // jamais à Repos, qui doit au contraire en profiter.
  const fatigueScore = (s) => s - (sleepPoor ? 6 : 0) - (loadHigh ? 6 : 0);
  const fatigueReason = () => [sleepNote, loadHigh ? `${load3} séances sur les 3 derniers jours → fatigue à surveiller.` : null].filter(Boolean).join(" ");

  // ---- HAUT DU CORPS : jamais bloqué par le genou, mais bloqué par le coude ----
  const upV = variant("Upper A", "Upper B");
  if (elbowRed) {
    push(avoid, "Upper A / B", 0, `Coude : ${E.redWhy}. Volume de tirage à suspendre jusqu'au retour à la base (Silbernagel).`);
  } else if (climbToday) {
    push(avoid, "Upper A / B", 0, "Escalade déjà faite aujourd'hui — volume de tirage sur le coude, ne pas empiler un Upper.");
  } else {
    let upScore = 20 + (2 - upper7) * 12 + cap(dUpper);
    let upReason = `Upper ${upper7}/2 cette semaine · dernier ${ago(dUpper)}.`;
    if (kneeRed) { upScore += 18; upReason += " Genou à ménager → c'est l'option sûre, jambes au repos."; }
    if (elbowAmber) { upScore -= 10; upReason += ` ${elbowWhy} → charge de tirage prudente, prises neutres/pronation.`; }
    if (dClimb <= 1) { upScore -= climbPen; upReason += ` ${climbWhy}`; }
    if (dUpper === 0) { upScore -= 32; upReason = `Haut du corps déjà fait aujourd'hui (${upper7}/2 cette semaine) — à reprendre après récupération.`; }
    upScore = fatigueScore(upScore);
    const upFat = fatigueReason(); if (upFat) upReason += ` ${upFat}`;
    push(sugg, upV, upScore, upReason);
  }

  // ---- BAS DU CORPS ----
  if (kneeRed) {
    push(avoid, "Lower A / B", 0, `Genou : ${kLast.baseline === false ? "pas revenu à la base sous 24 h" : `douleur ${painLast}/10`}. Attendre le retour à la base.`);
  } else if (kneeToday || dKnee === 0) {
    push(avoid, "Lower A / B", 0, "Exposition genou déjà faite aujourd'hui — ne pas empiler.");
  } else if (dKnee <= 1) {
    push(avoid, "Lower A / B", 0, "Expo genou hier (Lower ou basket) — laisser ~48 h au tendon.");
  } else {
    const loV = variant("Lower A", "Lower B");
    let loScore = 20 + (2 - lower7) * 12 + cap(dLower) - (kneeAmber ? 10 : 0);
    let loReason = `Lower ${lower7}/2 cette semaine · dernier ${ago(dLower)}.`;
    if (kneeUnknown) loReason += ` ${kneeNote} Charge prudente, tempo 6 s.`;
    else if (kneeAmber) loReason += ` Genou sensible (${painLast}/10${flagged7 ? `, ${flagged7} j hors base` : ""}) → charge prudente, tempo 6 s.`;
    loScore = fatigueScore(loScore);
    const loFat = fatigueReason(); if (loFat) loReason += ` ${loFat}`;
    push(sugg, loV, loScore, loReason);
  }

  // ---- BASKET ----
  if (kneeRed) {
    push(avoid, "Basket", 0, "Sauts et changements de direction : à proscrire tant que le genou n'est pas revenu à sa base.");
  } else if (dKnee === 0 || kneeToday) {
    push(avoid, "Basket", 0, "Expo genou déjà faite aujourd'hui — deuxième dose déconseillée.");
  } else if (upperToday) {
    push(avoid, "Basket", 0, "Musculation (Upper) déjà faite aujourd'hui — basket déconseillé le même jour (fatigue générale).");
  } else {
    let bScore = 10 + cap(dBasket) - (kneeAmber ? 8 : 0) - (dKnee <= 1 ? 6 : 0);
    let bReason = `${basket7}× cette semaine · dernier ${ago(dBasket)}. Passer par l'échauffement guidé.`;
    if (kneeUnknown) bReason += ` ${kneeNote}`;
    else if (kneeAmber) bReason += " Genou sensible : réduire le volume de sauts.";
    if (cutOn) { bScore -= 10; bReason += " Fenêtre de sèche : pas de volume à impact en plus de l'habituel."; }
    bScore = fatigueScore(bScore);
    const bFat = fatigueReason(); if (bFat) bReason += ` ${bFat}`;
    push(sugg, "Basket", bScore, bReason);
  }

  // ---- ESCALADE ---- (pas de jour attitré : autorisée surtout jours Lower ou off, jamais un jour Upper)
  if (elbowRed) {
    push(avoid, "Escalade", 0, `Coude : ${E.redWhy}. C'est la séance qui charge le plus le tendon distal du biceps — attendre le retour à la base.`);
  } else if (upperToday) {
    push(avoid, "Escalade", 0, "Upper déjà fait aujourd'hui — l'escalade ajoute du volume de tirage (coude).");
  } else {
    let cScore = 10 + cap(dClimb) - (dClimb <= 1 ? climbPen : 0) + (lowerToday ? 6 : 0);
    let cReason = `${climb7}× cette semaine · dernière ${ago(dClimb)}. Compte comme volume tirage : à placer un jour Lower ou off.`;
    if (dClimb <= 1 && climbLast) cReason += ` ${climbWhy}`;
    if (lowerToday) cReason += " Lower déjà fait aujourd'hui : bon jour pour l'escalade (pas de conflit coude).";
    // Pénalité plus lourde que sur Upper : à volume égal, l'escalade est la sollicitation
    // la plus intense du tendon distal du biceps (prises fermées, à-coups, blocages).
    if (elbowAmber) { cScore -= 12; cReason += ` ${elbowWhy} → volume de tirage à réduire.`; }
    if (cutOn) { cScore -= 8; cReason += " Fenêtre de sèche : pas de volume tirage en plus de l'habituel."; }
    cScore = fatigueScore(cScore);
    const cFat = fatigueReason(); if (cFat) cReason += ` ${cFat}`;
    push(sugg, "Escalade", cScore, cReason);
  }

  // ---- REPOS ---- (jamais pénalisé par la fatigue, la sèche ou une douleur : c'est
  // l'option qui en profite)
  let restScore = kneeRed ? 45 : (upper7 + lower7 + basket7 + climb7 >= 6 ? 22 : 5);
  let restReason = kneeRed ? "Décharge : mobilité douce + routine de rééduc autonome."
    : `${upper7 + lower7 + basket7 + climb7} séances sur 7 j — une journée creuse consolide les adaptations.`;
  // Coude hors base : Upper ET Escalade sont écartés, il ne reste que le bas du corps —
  // le repos remonte, sans jamais atteindre le score d'un genou hors base (qui, lui,
  // écarte aussi Lower et Basket, donc ne laisse quasiment rien d'autre).
  if (elbowRed) { restScore += 12; restReason += ` Coude hors base (${E.redWhy}) : tout le haut du corps est écarté aujourd'hui.`; }
  if (!kneeRed && sleepPoor) { restScore += 10; restReason += ` ${sleepNote}`; }
  if (!kneeRed && loadHigh) { restScore += 8; restReason += ` ${load3} séances sur les 3 derniers jours → fatigue à surveiller.`; }
  if (!kneeRed && cutOn) { restScore += 4; restReason += " Fenêtre de sèche : le repos ne compte pas comme volume manqué."; }
  push(sugg, "Repos / mobilité", restScore, restReason);

  return {
    suggestions: sugg.sort((a, b) => b.score - a.score).slice(0, 3),
    avoid,
  };
}
