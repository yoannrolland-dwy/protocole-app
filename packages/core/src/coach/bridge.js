// Pont privé PROTOCOLE → JEFFREY (étape G1, lecture seule, 05/11/2026). Cadrage :
// jeffrey-app/docs/cadrage/ETAPE_G_PONT_PROTOCOLE.md (§3, §5, §6 : contrat v1).
// Extension compatible du 12/11/2026 (op `agir`, gestes de séance) : la relecture d'un geste rend un
// `jeton` lié à l'action, aux paramètres et à la cible ; une écriture qui porte un `jeton` n'est faite
// que s'il est valable et la cible inchangée (apps/perso/src/lib/sessionGestures.js). Sans jeton :
// geste immédiat, inchangé.
// Principe inchangé : PROTOCOLE calcule les faits, Jeffrey (ici l'appli JEFFREY) les juge et parle.
// Ce module ne fait que METTRE EN FORME des faits déjà calculés ailleurs (buildCoachPrompt,
// nextSessions, computeEnergyScore, buildBilanPrompt) : aucune règle métier nouvelle. La
// personnalité n'y est pas : JEFFREY porte la sienne.

import { JEFFREY_RULES, BRIEF_ORDER, allowedSessions } from "./jeffrey.js";
import { computeSleepScore, scoreLabel } from "../energy.js";

export const BRIDGE_VERSION = 1;
export const BRIDGE_SUBJECTS = ["sport_du_jour", "macros", "forme", "brief", "point", "bilan"];

const COMPETENCES = "Ces règles viennent de PROTOCOLE, l'application de suivi de Monsieur (Yoann) : sport, nutrition, récupération. Derrière le majordome : coach sportif, kinésithérapeute, nutritionniste et coach de vie. Ce n'est pas un avis médical.";
const DONNEES = "DONNÉES : les faits sont calculés par PROTOCOLE, ne les recalculez pas. Une donnée absente (null, ou listée dans « manque ») se dit absente, ne l'inventez jamais. « heure » est l'heure du calcul : un total du jour en cours n'est jamais jugé contre une cible de journée complète.";
const SEANCES = "SÉANCES : ne proposez qu'une séance de « seances_autorisees » (aujourd'hui ou demain). Vous pouvez nuancer le choix du recommandeur selon ce que Monsieur vous dit (fatigue ressentie, temps disponible, envie) ; une séance « a_eviter » reste écartée.";
const ALERTES = "ALERTES D'ABORD : une douleur hors base, une séance écartée pour la sécurité ou une donnée du jour qui manque se disent en premier, en une phrase nette.";
const MACROS = "MACROS : « reste » = cible du jour moins consommé ; une valeur négative est un dépassement.";

/**
 * Règles de coach de PROTOCOLE pour JEFFREY (sans la personnalité). `coachSystem` : le
 * contexte permanent du coach (`facts.system` de buildCoachPrompt : phase, tendinopathie,
 * contexte écrit par Yoann). Le brief ajoute l'ordre du brief de PROTOCOLE.
 */
export function bridgeRules(coachSystem, sujet) {
  const parts = [COMPETENCES, `CONTEXTE DU COACH (contraintes permanentes) : ${coachSystem}`, JEFFREY_RULES, DONNEES, SEANCES, ALERTES, MACROS];
  // Mêmes consignes de forme que le brief de PROTOCOLE (jeffreyAsk « brief ») : ordre, 150 mots,
  // texte simple, première phrase courte, donnée absente dite et jamais inventée (G2, 05/11/2026).
  if (sujet === "brief") parts.push(`BRIEF DU MATIN : dans cet ordre, 150 mots au plus, texte simple (pas de titres, de gras ni de listes) : ${BRIEF_ORDER}. La première phrase est courte : c'est elle qu'on voit ou qu'on entend d'abord. S'il manque la nuit, la pesée ou le genou (« manque »), dites-le en une phrase et n'inventez jamais la valeur absente. Les rappels sont dans « rappels ». PROTOCOLE ne fournit pas la météo : sans météo de votre côté, n'en dites rien.`);
  return parts.join("\n\n");
}

const sessionsOf = (list) => (list || []).map((s) => ({ type: s.type, raison: s.reason }));

/** Une journée de `nextSessions` (aujourd'hui ou demain), sans les scores. */
function dayOf(day, { isToday }) {
  if (!day) return null;
  const out = {};
  if (isToday) out.statut = day.status === "closed" ? "terminée" : "ouverte";
  else out.date = day.date;
  if (day.note) out.note = day.note;
  out.propositions = sessionsOf(day.suggestions);
  out.a_eviter = sessionsOf(day.avoid);
  // « Pourquoi pas les autres ? » de la carte du Bord, sans redire ce qui est déjà à éviter.
  const avoided = new Set((day.avoid || []).map((a) => a.type));
  out.pas_proposees = (day.notProposed || []).filter((n) => !avoided.has(n.type)).map((n) => ({ type: n.type, raison: n.reason }));
  if (!isToday && day.caveat) out.reserve = day.caveat;
  return out;
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** Consommé du jour (0 si rien n'est saisi) et reste = cible − consommé. */
function macrosOf(realtime, cible) {
  const m = realtime?.macros_aujourdhui_en_cours;
  const consomme = {
    kcal: m?.kcal ?? 0, proteines: round1(m?.proteines ?? 0), glucides: round1(m?.glucides ?? 0),
    lipides: round1(m?.lipides ?? 0), fibres: round1(m?.fibres ?? 0), eau_ml: m?.eau_ml ?? 0,
    ...(m?.alcool_g ? { alcool_g: m.alcool_g } : {}),
  };
  const reste = {};
  for (const k of ["kcal", "proteines", "glucides", "lipides", "fibres", "eau_ml"]) {
    reste[k] = cible?.[k] == null ? null : round1(cible[k] - consomme[k]);
  }
  return { consomme, reste };
}

function sportOf({ facts, nextSession }) {
  const r = facts.realtime || {};
  return {
    aujourdhui: dayOf(nextSession?.today, { isToday: true }),
    demain: dayOf(nextSession?.tomorrow, { isToday: false }),
    seances_autorisees: allowedSessions(nextSession),
    seances_faites: { aujourdhui: r.seances_aujourdhui || [], hier: r.seances_hier || [] },
    genou: { aujourdhui: r.douleur_genou_aujourdhui ?? null, hier: r.douleur_genou_hier ?? null, resume: facts.summary?.genou ?? null },
    seances_7j: facts.summary?.seances_7j ?? null,
    volume_hebdo_series: facts.summary?.volume_hebdo_series ?? null,
  };
}

function energyOf(energy) {
  if (!energy) return null;
  return {
    statut: energy.status === "ok" ? "ok" : "incomplet",
    total: energy.total ?? null, libelle: scoreLabel(energy.total ?? null),
    modules: (energy.modules || []).map((m) => ({ nom: m.label, points: m.points, max: m.max, raison: m.reason ?? null })),
  };
}

function formeOf({ facts, energy, napMinutes }) {
  const r = facts.realtime || {};
  const s = facts.summary || {};
  const nuit = r.sommeil_nuit_derniere;
  const rhr = (energy?.modules || []).find((m) => m.key === "rhr");
  return {
    nuit: nuit ? { ...nuit, score: computeSleepScore({ hours: nuit.heures, quality: nuit.qualite }) } : null,
    sommeil_7j: s.sommeil ?? null,
    sieste_min: napMinutes ?? null,
    poids: { ...(r.poids || {}), ...(s.poids ? { moy_7j: s.poids.moy_7j, moy_7j_precedents: s.poids.moy_7j_precedents, tendance_kg_sur_semaine: s.poids.tendance_kg_sur_semaine } : {}), phase: s.phase ?? null, poids_cible: s.poids_cible ?? null },
    genou: { aujourdhui: r.douleur_genou_aujourdhui ?? null, hier: r.douleur_genou_hier ?? null, resume: s.genou ?? null },
    fc_repos: rhr?.bpm != null ? { aujourdhui: rhr.bpm, moy_7j: rhr.avg7 ?? null } : null,
    energie: energyOf(energy),
    pas: { hier: r.pas_hier ?? null, aujourdhui: r.pas_aujourdhui ?? null, moy_7j: s.pas_moy_7j ?? null },
  };
}

/**
 * Réponse de l'opération `lire` → { date, regles, faits, manque }.
 * `ctx` = {
 *   date, heure,
 *   coach : buildCoachPrompt(...) (on lit `facts`),
 *   nextSession : nextSessions(...) (même verdict que la carte du Bord),
 *   energy : computeEnergyScore(...), napMinutes : sieste du jour (min) ou null,
 *   missing : briefMissing(...) (« nuit », « pesée », « genou »),
 *   reminders : rappels calculés par l'app (sauvegarde en retard…),
 *   bilan : buildBilanPrompt(...) (sujet « bilan » seulement),
 * }.
 */
export function buildReading(sujet, ctx) {
  if (!BRIDGE_SUBJECTS.includes(sujet)) throw Object.assign(new Error("sujet inconnu"), { code: "inconnu" });
  const facts = ctx.coach.facts;
  const r = facts.realtime || {};
  const s = facts.summary || {};
  let faits;
  if (sujet === "sport_du_jour") {
    faits = { heure: ctx.heure, ...sportOf({ facts, nextSession: ctx.nextSession }) };
  } else if (sujet === "macros") {
    const cible = facts.cibles_du_jour || null;
    faits = {
      heure: ctx.heure, phase: s.phase ?? null, cible, ...macrosOf(r, cible),
      repas_aujourdhui: r.repas_aujourdhui ?? null,
      moyenne_7j: s.macros_moy_7j ?? null,
      depense_estimee: s.depense_estimee ?? null,
      palier_semaine: s.palier_semaine ?? null,
    };
  } else if (sujet === "forme") {
    faits = { heure: ctx.heure, ...formeOf({ facts, energy: ctx.energy, napMinutes: ctx.napMinutes }) };
  } else if (sujet === "brief") {
    const sport = sportOf({ facts, nextSession: ctx.nextSession });
    faits = {
      heure: ctx.heure, ...formeOf({ facts, energy: ctx.energy, napMinutes: ctx.napMinutes }),
      seance: { aujourdhui: sport.aujourdhui, demain: sport.demain, seances_autorisees: sport.seances_autorisees },
      palier_semaine: s.palier_semaine ?? null,
      rappels: ctx.reminders || [],
    };
  } else if (sujet === "point") {
    // Complet : les mêmes faits que la conversation de Jeffrey dans PROTOCOLE (jeffreyDataBlock).
    faits = {
      heure: ctx.heure, temps_reel: r, resume_14j: s, progression_14j: facts.exoProgress ?? null,
      seances_sans_series: facts.autresSeances ?? [], notes_14j: facts.notesTxt || null,
      seances_autorisees: allowedSessions(ctx.nextSession), carnet: facts.journal || null,
      cibles_du_jour: facts.cibles_du_jour ?? null,
    };
  } else {
    faits = { ...(ctx.bilan?.faits || {}), notes: ctx.bilan?.notes || null, carnet: facts.journal || null };
  }
  return { date: ctx.date, regles: bridgeRules(facts.system, sujet), faits, manque: ctx.missing || [] };
}

/** Codes d'erreur courts du pont (jamais de texte technique ni de donnée privée). */
// Contrat v1 confirmé par la session JEFFREY (05/11/2026). `trop_long` : réponse au-delà de
// 200 000 caractères (limite Binder), posé par le service Android.
// `restauration` (11/11/2026) : une restauration est en cours dans PROTOCOLE, rien n'a été fait,
// réessayer dans quelques secondes.
export const BRIDGE_ERRORS = ["occupe", "inconnu", "delai", "ia_absente", "ia_echec", "interne", "trop_long", "restauration"];
