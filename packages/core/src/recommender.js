// RECOMMANDEUR — historique des séances + état des zones de douleur (genou, coude).
// Sort des suggestions classées ET des séances à éviter.
//
// RawCare Phase 1 (06/08/2026) : le gate/la pénalité par zone de douleur, et l'historique
// d'exposition, sont désormais génériques par TAG de charge (`chargeTags` sur les types de
// séance, packages/core/src/session/templates.js) plutôt que câblés sur les noms "genou"/
// "coude" — un futur sport taggé "genou" ou "tirage" (voir session/catalog.js) hérite déjà
// du cooldown et du gate dur sans nouvelle branche de code, juste une ligne dans
// AMBER_PENALTY et un `chargeTags` sur son type. Le texte des raisons affichées et le score
// de base par type de séance restent en revanche écrits à la main : ce sont des conseils en
// langage naturel propres à chaque sport (la formulation diffère volontairement d'un type à
// l'autre), pas des données interchangeables — les généraliser ferait perdre la nuance
// voulue. Vérifié par diff caractère près sur les scénarios de la Phase 0 + des scénarios
// ciblant spécifiquement chaque nuance non généralisée (cooldown genou, exclusions croisées,
// magnitudes de pénalité par type).
//
// RawCare, chantier "parité apps/public", Lot F (06/08/2026) : le catalogue étendu
// (session/catalog.js — Course à pied/Vélo/Foot) rejoint le scoring via le nouveau paramètre
// optionnel `extraSports` (liste de noms). Absent (tous les appels apps/perso +
// coach/prompt.js) → aucun bloc supplémentaire ne s'exécute, sortie identique bit pour bit à
// avant ce lot. Chaque sport reste un bloc de score ÉCRIT À LA MAIN (même principe que
// Basket/Escalade ci-dessus) — "généraliser les sports" veut dire "un bloc de plus par
// sport activé", pas une boucle générique sur le catalogue. Vérifié par diff caractère près :
// sans `extraSports`, identique à avant ; avec, scénarios dédiés (genou hors base, cut
// window, exclusions croisées avec Basket sur le tag "genou" partagé).
import { today, byDate, daysBetween, fmtHM, shiftDateKey } from "./dateUtils.js";
import { buildZones, DEFAULT_ZONES, mergeZoneStates } from "./pain.js";
import { TEMPLATES } from "./session/templates.js";
import { SPORTS_CATALOG } from "./session/catalog.js";
import { climbLoad } from "./climbing.js";
import { isCutWindow } from "./targets.js";
import { exerciseSessions, exerciseTrend } from "./training.js";

// Pénalité (score) quand la zone associée à ce tag est ambre, par type de séance porteur du
// tag. Magnitude différente par type (l'escalade pèse plus lourd sur le coude que l'Upper, à
// volume égal — prises fermées, à-coups) : une future entrée pour un nouveau sport taggé
// "genou"/"tirage" s'ajoute ici, pas dans une nouvelle branche de recommendSessions.
const AMBER_PENALTY = {
  genou: { "Lower A": 10, "Lower B": 10, "Basket": 8, "Course à pied": 8, "Foot": 10 },
  tirage: { "Upper A": 10, "Upper B": 10, "Escalade": 12 },
};

// État neutre pour un gate ("genou"/"tirage") sans zone correspondante dans `zones` — cas
// normal pour un utilisateur apps/public qui n'a suivi qu'une seule zone, ou aucune. Ne
// gate/pénalise rien, silencieux (RawCare, onboarding — 06/08/2026).
const NEUTRAL_ZONE = { unknown: false, painLast: null, flagged7: 0, red: false, amber: false, note: null, redWhy: null };

// `zones` (RawCare, onboarding — 06/08/2026) : résultat déjà construit de `buildZones(zoneDefs,
// logs, t0)`, optionnel et additif. Absent (apps/perso, coach/prompt.js) → comportement
// identique bit pour bit à avant : `buildZones(DEFAULT_ZONES, {knee, elbow}, t0)` en interne.
// Fourni (apps/public) → zones dynamiques de l'utilisateur, potentiellement 0 à N zones,
// gate "genou"/"tirage" absent toléré via NEUTRAL_ZONE plutôt qu'un crash.
export function recommendSessions({ training, knee, elbow, zones, sleep, targets, scheme, extraSports }) {
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
  // `chargeTags` d'un type de séance, TEMPLATES (6 types apps/perso) OU SPORTS_CATALOG
  // (Lot F : Course à pied/Vélo/Foot, jamais dans TEMPLATES) — un type présent dans les deux
  // n'existe pas, donc l'ordre du `??` n'a pas d'incidence. Sans ce fallback, une séance
  // "Foot" ne serait jamais reconnue comme exposition genou pour le cooldown/l'exclusion
  // croisée avec Lower/Basket.
  const chargeTagsOf = (type) => TEMPLATES[type]?.chargeTags ?? SPORTS_CATALOG[type]?.chargeTags;
  // Généralisé sur les tags de charge : "depuis combien de jours un type taggé `tag` n'a
  // pas été fait" — remplace le flag `knee` figé sur Lower/Basket, marche pour n'importe
  // quel type taggé "genou"/"tirage", y compris au catalogue.
  const daysSinceTag = (tag) => daysSince((t) => chargeTagsOf(t.type)?.includes(tag));
  const ago = (d) => (isFinite(d) ? (d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`) : "jamais fait");
  const cap = (d) => (isFinite(d) ? Math.min(d, 7) : 7);

  // volume des 7 derniers jours
  const w = within(training, 6);
  const upper7 = w.filter(isUpper).length;
  const lower7 = w.filter(isLower).length;
  const basket7 = w.filter((t) => t.type === "Basket").length;
  const climb7 = w.filter((t) => t.type === "Escalade").length;
  // Lot F : toujours calculés (jamais seulement si `extraSports` les active) — inoffensif
  // pour apps/perso, qui ne logue jamais ces types (toujours 0), et alimente honnêtement le
  // décompte "séances sur 7 j" du bloc Repos même pour un sport désactivé après coup.
  const run7 = w.filter((t) => t.type === "Course à pied").length;
  const foot7 = w.filter((t) => t.type === "Foot").length;
  const bike7 = w.filter((t) => t.type === "Vélo").length;

  const dUpper = daysSince(isUpper);
  const dLower = daysSince(isLower);
  const dBasket = daysSince((t) => t.type === "Basket");
  const dClimb = daysSince((t) => t.type === "Escalade");
  const dRun = daysSince((t) => t.type === "Course à pied");
  const dFoot = daysSince((t) => t.type === "Foot");
  const dBike = daysSince((t) => t.type === "Vélo");
  const dKnee = daysSinceTag("genou"); // Lower + Basket + Course à pied + Foot (tag partagé)

  // Charge de la dernière séance d'escalade (V5) : jusqu'ici la pénalité « escalade
  // récente » était FORFAITAIRE — une heure tranquille et une grosse session de blocs
  // comptaient pareil. `climbLoad` renvoie `null` si la séance n'a pas de blocs saisis
  // (tout l'historique d'avant V5), et le comportement forfaitaire d'origine s'applique
  // alors tel quel : pas de charge supposée à partir d'une donnée absente.
  const lastClimb = training.filter((t) => t.type === "Escalade").slice(-1)[0];
  const climbLast = dClimb <= 1 ? climbLoad(lastClimb, scheme) : null;
  // Pénalité modulée : une session légère pèse moins qu'un forfait, une grosse pèse plus.
  const CLIMB_PEN = { legere: 4, normale: 8, grosse: 14 };
  const climbPen = climbLast ? CLIMB_PEN[climbLast.level] : 8;
  const climbWhy = climbLast
    ? `Escalade ${dClimb === 0 ? "aujourd'hui" : "hier"} : ${climbLast.n} blocs${climbLast.max ? ` (max ${scheme.gradeLabel(climbLast.max)})` : ""} — ${climbLast.level === "grosse" ? "grosse session, tirage lourd sur le coude" : climbLast.level === "legere" ? "session légère, impact limité sur le coude" : "charge de tirage normale"}.`
    : "Escalade récente : allège le tirage (coude).";

  // Zones de douleur, génériques par tag de charge (RawCare Phase 1) — `buildZones`
  // (packages/core/src/pain.js) sait désormais gérer N zones arbitraires ; `apps/perso`
  // continue de fournir exactement les deux mêmes journaux (knee/elbow) via `DEFAULT_ZONES`.
  // Le genou est un gate dur : pas de donnée fraîche ⇒ prudence par défaut. Le coude ne
  // module que des scores tant qu'une douleur réelle n'est pas notée (silencieux sinon).
  const z = zones ?? buildZones(DEFAULT_ZONES, { knee, elbow }, t0);
  // `gateTag` peut être une chaîne (DEFAULT_ZONES, une zone par gate) ou un tableau (zones
  // libres d'apps/public, Lot E : un utilisateur peut choisir "genou"+"tirage" sur une même
  // zone, ou aucun tag pour un suivi pur) — `matchesTag` gère les deux formes, `null`/absent
  // ne matchant jamais rien. Plusieurs zones peuvent gater le même tag (ex. "Genou gauche"/
  // "Genou droit") : `mergeZoneStates` les combine (le pire l'emporte), et redonne l'état
  // inchangé pour un unique élément — comportement bit pour bit identique à avant sur
  // DEFAULT_ZONES, qui n'a qu'une zone par gate.
  const matchesTag = (gateTag, tag) => gateTag === tag || (Array.isArray(gateTag) && gateTag.includes(tag));
  const kneeZones = z.filter((zn) => matchesTag(zn.gateTag, "genou"));
  const tirageZones = z.filter((zn) => matchesTag(zn.gateTag, "tirage"));
  const K = kneeZones.length ? mergeZoneStates(kneeZones.map((zn) => zn.state)) : NEUTRAL_ZONE;
  const E = tirageZones.length ? mergeZoneStates(tirageZones.map((zn) => zn.state)) : NEUTRAL_ZONE;
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
  const kneeToday = todayTypes.some((x) => chargeTagsOf(x)?.includes("genou"));
  // Sports du catalogue étendu réellement actifs pour cet utilisateur (Lot F) — absent/vide
  // pour apps/perso, donc aucun des trois blocs ci-dessous ne pousse de suggestion/avoid.
  const active = new Set(extraSports || []);

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
    if (elbowAmber) { upScore -= AMBER_PENALTY.tirage["Upper A"]; upReason += ` ${elbowWhy} → charge de tirage prudente, prises neutres/pronation.`; }
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
    let loScore = 20 + (2 - lower7) * 12 + cap(dLower) - (kneeAmber ? AMBER_PENALTY.genou["Lower A"] : 0);
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
    let bScore = 10 + cap(dBasket) - (kneeAmber ? AMBER_PENALTY.genou["Basket"] : 0) - (dKnee <= 1 ? 6 : 0);
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
    if (elbowAmber) { cScore -= AMBER_PENALTY.tirage["Escalade"]; cReason += ` ${elbowWhy} → volume de tirage à réduire.`; }
    if (cutOn) { cScore -= 8; cReason += " Fenêtre de sèche : pas de volume tirage en plus de l'habituel."; }
    cScore = fatigueScore(cScore);
    const cFat = fatigueReason(); if (cFat) cReason += ` ${cFat}`;
    push(sugg, "Escalade", cScore, cReason);
  }

  // ---- COURSE À PIED ---- (Lot F, catalogue étendu : impact genou, comme Basket, mais pas
  // de conflit "fatigue générale" avec Upper — courir n'entre pas en conflit avec du haut du
  // corps comme le fait un sport de saut/pivot)
  if (active.has("Course à pied")) {
    if (kneeRed) {
      push(avoid, "Course à pied", 0, "Impact répété sur le genou : à proscrire tant qu'il n'est pas revenu à sa base.");
    } else if (dKnee === 0 || kneeToday) {
      push(avoid, "Course à pied", 0, "Expo genou déjà faite aujourd'hui — deuxième dose déconseillée.");
    } else {
      let rScore = 10 + cap(dRun) - (kneeAmber ? AMBER_PENALTY.genou["Course à pied"] : 0) - (dKnee <= 1 ? 6 : 0);
      let rReason = `${run7}× cette semaine · dernière ${ago(dRun)}.`;
      if (kneeUnknown) rReason += ` ${kneeNote}`;
      else if (kneeAmber) rReason += " Genou sensible : réduire l'allure/le volume.";
      if (cutOn) { rScore -= 8; rReason += " Fenêtre de sèche : pas de volume à impact en plus de l'habituel."; }
      rScore = fatigueScore(rScore);
      const rFat = fatigueReason(); if (rFat) rReason += ` ${rFat}`;
      push(sugg, "Course à pied", rScore, rReason);
    }
  }

  // ---- FOOT ---- (Lot F : traité comme Basket — impact genou ET conflit fatigue générale
  // avec Upper le même jour, même sollicitation croisée)
  if (active.has("Foot")) {
    if (kneeRed) {
      push(avoid, "Foot", 0, "Sauts et changements de direction : à proscrire tant que le genou n'est pas revenu à sa base.");
    } else if (dKnee === 0 || kneeToday) {
      push(avoid, "Foot", 0, "Expo genou déjà faite aujourd'hui — deuxième dose déconseillée.");
    } else if (upperToday) {
      push(avoid, "Foot", 0, "Musculation (Upper) déjà faite aujourd'hui — foot déconseillé le même jour (fatigue générale).");
    } else {
      let fScore = 10 + cap(dFoot) - (kneeAmber ? AMBER_PENALTY.genou["Foot"] : 0) - (dKnee <= 1 ? 6 : 0);
      let fReason = `${foot7}× cette semaine · dernier ${ago(dFoot)}.`;
      if (kneeUnknown) fReason += ` ${kneeNote}`;
      else if (kneeAmber) fReason += " Genou sensible : réduire le volume de sauts/changements d'appui.";
      if (cutOn) { fScore -= 10; fReason += " Fenêtre de sèche : pas de volume à impact en plus de l'habituel."; }
      fScore = fatigueScore(fScore);
      const fFat = fatigueReason(); if (fFat) fReason += ` ${fFat}`;
      push(sugg, "Foot", fScore, fReason);
    }
  }

  // ---- VÉLO ---- (Lot F : aucun tag genou au catalogue — mouvement contrôlé, genou-friendly
  // en rééduc, décision déjà actée en Phase 1 — jamais écarté, pas de pénalité de sèche)
  if (active.has("Vélo")) {
    let vScore = fatigueScore(8 + cap(dBike));
    let vReason = `${bike7}× cette semaine · dernier ${ago(dBike)}. Genou-friendly, mouvement contrôlé.`;
    const vFat = fatigueReason(); if (vFat) vReason += ` ${vFat}`;
    push(sugg, "Vélo", vScore, vReason);
  }

  // ---- REPOS ---- (jamais pénalisé par la fatigue, la sèche ou une douleur : c'est
  // l'option qui en profite)
  //
  // Demande explicite de Yoann (07/08/2026, athlète capable de s'entraîner plusieurs fois
  // par jour) : le score ne repose plus sur le NOMBRE de séances sur 7 j glissants (une
  // grosse journée à deux séances mais bien récupérée n'est pas une surcharge). Le
  // déclencheur PRINCIPAL devient 3 signaux de DÉRIVE sur 2-3 jours, indépendants du
  // nombre de jours enchaînés :
  //   1. genou hors base (déjà géré ailleurs via kneeRed/kLast.baseline) ;
  //   2. baisse de perf sur plusieurs exercices travaillés récemment (exerciseTrend,
  //      déjà utilisé par l'écran Progression, jamais branché ici avant) ;
  //   3. tendance de sommeil sur 2-3 nuits (pas juste la dernière, contrairement à
  //      `sleepPoor` — qui reste inchangé pour le nudge des autres types de séance).
  // Les jours consécutifs sans repos ne sont plus qu'un repère de sécurité SOFT (`streak`) :
  // ils font monter le score mais n'y contribuent significativement que si les 3 signaux
  // restent propres — jamais de blocage dur, jamais d'`avoid`.

  const trainedDays = new Set(training.map((t) => t.date));
  // Si aucune séance n'a encore été loguée aujourd'hui, on compte à partir d'hier (sinon
  // un streak de 6 jours retomberait artificiellement à 0 tant que la séance du jour
  // n'est pas saisie).
  let streak = 0;
  { let d = trainedDays.has(t0) ? t0 : shiftDateKey(t0, -1);
    while (trainedDays.has(d)) { streak++; d = shiftDateKey(d, -1); } }

  // Signal 2 — baisse de perf : exercices travaillés dans les 3 derniers jours (aujourd'hui
  // compris) dont la tendance (dernière séance vs précédente, même définition que l'écran
  // Progression) est à la baisse. Un seul exercice en baisse arrive tout le temps (fatigue
  // locale, mauvaise nuit isolée) ; ≥ 2 est le signal d'une dérive plus large.
  const recentExoNames = new Set();
  within(training, 2).forEach((s) => (s.exercices || []).forEach((e) => recentExoNames.add(e.nom)));
  const decliningExos = [...recentExoNames].filter((nom) => exerciseTrend(exerciseSessions(training, nom)).key === "down");
  const perfDrift = decliningExos.length >= 2;

  // Signal 3 — tendance de sommeil : au moins 2 nuits courtes/mauvaise qualité sur les 3
  // derniers jours (contre une seule nuit pour `sleepPoor`, qui reste le signal utilisé par
  // les autres types de séance, inchangé).
  const recentNights = within(sleep || [], 2);
  const poorNights = recentNights.filter((n) => n.hours < 6 || (n.quality != null && n.quality <= 2)).length;
  const sleepDrift = poorNights >= 2;

  const driftSignals = [kneeRed, perfDrift, sleepDrift].filter(Boolean).length;

  let restScore = kneeRed ? 45 : 5;
  let restReason = kneeRed ? "Décharge : mobilité douce + routine de rééduc autonome."
    : `${streak} j consécutifs d'entraînement.`;
  if (!kneeRed && perfDrift) {
    restScore += 16;
    restReason += ` Baisse de perf sur ${decliningExos.length} exercices récents (${decliningExos.slice(0, 2).join(", ")}) → signal de fatigue à surveiller.`;
  }
  if (!kneeRed && sleepDrift) {
    restScore += 14;
    restReason += ` ${poorNights} nuits courtes ou de mauvaise qualité sur les 3 derniers jours.`;
  }
  // Repère soft : ne pèse vraiment que si les 3 signaux ci-dessus restent propres — un
  // streak de 5+ jours à signaux propres n'empêche jamais une suggestion d'entraînement,
  // il fait juste remonter un peu le repos dans le classement.
  if (!kneeRed && streak >= 5) { restScore += driftSignals === 0 ? 10 : 4; restReason += ` ${streak} j sans coupure.`; }
  // Coude hors base : Upper ET Escalade sont écartés, il ne reste que le bas du corps —
  // le repos remonte, sans jamais atteindre le score d'un genou hors base (qui, lui,
  // écarte aussi Lower et Basket, donc ne laisse quasiment rien d'autre).
  if (elbowRed) { restScore += 12; restReason += ` Coude hors base (${E.redWhy}) : tout le haut du corps est écarté aujourd'hui.`; }
  if (!kneeRed && loadHigh) { restScore += 8; restReason += ` ${load3} séances sur les 3 derniers jours → fatigue à surveiller.`; }
  if (!kneeRed && cutOn) { restScore += 4; restReason += " Fenêtre de sèche : le repos ne compte pas comme volume manqué."; }
  push(sugg, "Repos / mobilité", restScore, restReason);

  return {
    suggestions: sugg.sort((a, b) => b.score - a.score).slice(0, 3),
    avoid,
  };
}
