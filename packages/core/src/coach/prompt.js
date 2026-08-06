// Construction du prompt Coach IA — extrait de src/App.jsx (apps/perso) le 05/08/2026,
// chantier RawCare Phase 0. Contenu inchangé, transformé de fermetures sur le state React
// en fonctions pures prenant un "sac de données" en paramètre. L'app assemble ce sac depuis
// son state + un `getSync("foodLog"/"foodOverrides")` frais (voir apps/perso/src/App.jsx)
// et appelle `buildCoachPrompt`/`buildCoachBriefing`.
//
// Vérifié par capture avant/après (navigateur, jeu de données réel seedé) sur
// `buildCoachPrompt(...).system`, `.user` ET `buildCoachBriefing(...)` — les trois textes
// exacts envoyés au modèle — identiques au caractère près.

import { today, byDate, daysBetween, shiftDateKey, round, lastN } from "../dateUtils.js";
import { recommendSessions } from "../recommender.js";
import { exoProgress } from "../training.js";
import { climbSummary } from "../climbing.js";
import { PHASES, phaseTarget, targetsForDate, kcalFromMacros, kcalOfEntry, isCutWindow, tdeeNow } from "../targets.js";
import { realDeficit } from "../tdee.js";
import { MEALS as FOOD_MEALS, entriesFor as foodEntriesFor } from "../nutrition/foodStore.js";

// Amorçage du profil permanent : reprend mot pour mot les règles de coaching qui étaient
// codées en dur dans le prompt jusqu'au 30/07/2026. Écrit une seule fois, à la première
// ouverture, puis c'est Yoann qui l'édite dans les Réglages — donc après les vacances il
// remplace lui-même l'objectif sans qu'un rebuild soit nécessaire.
export const SEED_COACH_PROFILE = `Sèche avant vacances, départ le 18/08/2026. Point de départ 101 kg le 27/07. Projection réaliste : 96-97,5 kg au 18/08 — l'objectif est de s'en rapprocher visuellement, pas de l'atteindre sur la balance. Attendu : environ 3-3,5 kg d'eau et de glycogène perdus sur les 10-14 premiers jours, le reste est de la vraie perte de gras, plus lente.

Lecture du poids : ne pas commenter la tendance avant le 05/08/2026 (avant, les chiffres sont pollués par la perte d'eau). Au-delà, toujours la moyenne glissante 7 jours, jamais un poids isolé.

Volume d'entraînement : ne jamais suggérer d'ajouter une séance ou du cardio à impact par rapport au basket habituel — contre-indication tendineuse (genou et coude) sur cette période.

Escalade : pas de jour attitré. À privilégier les jours Lower ou off, jamais un jour Upper.

Tenir compte des pas quotidiens dans l'analyse de tendance.`;

// Le modèle termine sa réponse par ce marqueur suivi du carnet de bord mis à jour. Choisi
// improbable dans une réponse normale pour éviter une coupure accidentelle. Si le marqueur
// est absent (le modèle n'a pas suivi la consigne), on garde le carnet précédent et on
// affiche la réponse entière : jamais de perte de mémoire silencieuse.
export const CARNET_MARK = "---CARNET---";
export const CARNET_MAX_CHARS = 900;

/**
 * Sépare la réponse affichée du carnet de bord, avec un plafond dur.
 *
 * La consigne demande CARNET_MAX_CHARS au modèle, mais il déborde en pratique (1026 car.
 * mesurés pour 900 demandés le 30/07/2026) : le plafond laisse donc de la marge, et coupe
 * sur une fin de ligne plutôt qu'en plein milieu d'une phrase — un carnet tronqué net
 * corromprait la mémoire relue à l'analyse suivante.
 */
export const CARNET_HARD_LIMIT = CARNET_MAX_CHARS * 2;
export function splitCarnet(raw) {
  const i = raw.indexOf(CARNET_MARK);
  if (i < 0) return { advice: raw, journal: null };
  const advice = raw.slice(0, i).trim();
  let journal = raw.slice(i + CARNET_MARK.length).trim();
  if (journal.length > CARNET_HARD_LIMIT) {
    const cut = journal.slice(0, CARNET_HARD_LIMIT);
    const brk = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
    journal = (brk > CARNET_HARD_LIMIT * 0.6 ? cut.slice(0, brk + 1) : cut).trim();
  }
  // Un carnet vide ou un conseil vide = découpage raté : on préfère tout afficher.
  if (!advice || !journal) return { advice: raw, journal: null };
  return { advice, journal };
}

// Hissé hors de buildCoachPrompt : buildCoachBriefing en a besoin aussi, et le laisser dans
// la portée de buildCoachPrompt provoquait un ReferenceError au clic sur « Copier le
// contexte » (invisible à la compilation, puisque l'erreur n'existe qu'à l'exécution).
export const last14 = (arr) => arr.filter((e) => daysBetween(e.date, today()) <= 14).sort(byDate);

// Détail des repas (nom + quantité de chaque aliment, par repas) : ce que `macros`
// (agrégats macroLog) ne peut pas montrer. Regroupé ici plutôt que dans `foodStore.js`,
// pour rester au plus près de ce que le Coach IA en fait (labels lisibles, jours vides
// omis) sans imposer cette forme au reste du module Nutrition.
export const mealsFor = (log, date) => {
  const out = {};
  FOOD_MEALS.forEach(({ key, label }) => {
    const items = foodEntriesFor(log, date).filter((e) => e.meal === key)
      .map((e) => `${e.name} ${e.q}g`);
    if (items.length) out[label] = items;
  });
  return out;
};

/**
 * `data` : { weight, sleep, training, knee, elbow, macros, notes, steps, targets, phase,
 *            foodLog, foodOverrides, profile, journal }
 * `foodLog`/`foodOverrides` doivent être lus fraîchement par l'appelant (getSync), jamais
 * mis en cache, pour ne jamais rater une correction ou un repas ajouté entre deux appels.
 */
export function buildCoachPrompt(data, note) {
  const { weight, sleep, training, knee, elbow, macros, notes, steps, targets, phase,
    foodLog, foodOverrides, profile, journal, scheme } = data;

  // Dépense adaptative (V7) : mêmes données, même calcul que la carte de l'onglet
  // Macros (`tdeeNow`) — jamais deux chiffres différents pour la même réalité.
  const tdeeResult = tdeeNow({ foodLog, overrides: foodOverrides, macros, weight, targets });
  const tgtW = phaseTarget(phase, targets);
  const win = (arr, a, b) => arr.filter((e) => { const d = daysBetween(e.date, today()); return d >= a && d <= b; });
  const avgKey = (arr, k) => { const v = arr.map((e) => e[k]).filter((x) => x != null); return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const w7 = avgKey(win(weight, 0, 6), "kg"), w14 = avgKey(win(weight, 7, 13), "kg");
  const m7 = win(macros, 0, 6);
  const sessCount = (a, b) => { const o = {}; win(training, a, b).forEach((t) => { o[t.type] = (o[t.type] || 0) + 1; }); return o; };
  const kLast = lastN(knee, 1)[0] ?? null;
  const eLast = lastN(elbow, 1)[0] ?? null;

  // Verdict du recommandeur ("Prochaine séance") : recalculé ici avec les mêmes données,
  // et injecté dans le prompt pour que le coach commente/valide UN seul avis au lieu de
  // produire le sien indépendamment (les deux pouvaient se contredire avant ce couplage).
  const reco = recommendSessions({ training, knee, elbow, sleep, targets, scheme });

  // --- progression par exercice, calculée plutôt qu'envoyée en brut ---
  // Le dump des séries brutes sur 14 jours était le plus gros poste du prompt (mesuré :
  // il pesait pour l'essentiel des 7 457 tokens d'entrée) pour le signal le plus faible —
  // on demandait au modèle de faire de l'arithmétique dans une réponse de 500 mots, ce
  // qu'il survolait forcément. Le JS sait le faire exactement et gratuitement : on
  // n'envoie plus que la meilleure série par séance et la tendance qui en découle.
  // Le calcul vit dans `src/training.js` depuis V3 : l'écran de progression lit
  // exactement les mêmes fonctions, sur tout l'historique au lieu de 14 jours.
  const exoProgressData = exoProgress(last14(training));

  // Séances non-muscu : durée et RPE suffisent, il n'y a pas de séries à analyser.
  // Sauf l'escalade depuis V5 : on remonte le RÉSUMÉ des blocs (nombre, cotation max et
  // médiane, réussite), jamais la liste brute — sur une séance de 20 blocs elle
  // coûterait des tokens pour un signal que le JS calcule exactement.
  const autresSeances = last14(training).filter((s) => !s.exercices)
    .map((s) => ({ d: s.date.slice(5), t: s.type, ...(s.duration != null ? { min: s.duration } : {}), ...(s.rpe != null ? { rpe: s.rpe } : {}),
      ...(climbSummary(s.blocs, scheme) ? { blocs: climbSummary(s.blocs, scheme) } : {}) }));

  // --- temps réel : hier vs aujourd'hui, avec deltas explicites ---
  const findDay = (arr, d) => arr.find((e) => e.date === d);
  const y = shiftDateKey(today(), -1);
  const wToday = findDay(weight, today()), wYest = findDay(weight, y);
  const mToday = findDay(macros, today()), mYest = findDay(macros, y);
  const sToday = findDay(sleep, today()), sYest = findDay(sleep, y);
  const kToday = findDay(knee, today()), kYest = findDay(knee, y);
  const eToday = findDay(elbow, today()), eYest = findDay(elbow, y);
  const trToday = training.filter((t) => t.date === today());
  const trYest = training.filter((t) => t.date === y);
  const basketTodayFlag = trToday.some((t) => t.type === "Basket");
  const waterTgtToday = targets.water + (basketTodayFlag ? 1000 : 0);
  const atToday = targetsForDate(today(), targets);
  const sToday_steps = findDay(steps, today()), sYest_steps = findDay(steps, y);
  const steps7 = avgKey(win(steps, 0, 6), "count");

  const realtime = {
    hier: y, aujourdhui: today(),
    poids: { hier: wYest?.kg ?? null, aujourdhui: wToday?.kg ?? null,
      delta: (wYest?.kg != null && wToday?.kg != null) ? round(wToday.kg - wYest.kg) : null },
    sommeil_nuit_derniere: sToday ? { heures: round(sToday.hours, 2), qualite: sToday.quality ?? null } : null,
    sommeil_avant_hier: sYest ? { heures: round(sYest.hours, 2), qualite: sYest.quality ?? null } : null,
    macros_hier: mYest ? { proteines: mYest.protein, glucides: mYest.carbs, lipides: mYest.fat, fibres: mYest.fiber, eau_ml: mYest.water } : null,
    macros_aujourdhui_en_cours: mToday ? { proteines: mToday.protein, glucides: mToday.carbs, lipides: mToday.fat, fibres: mToday.fiber, eau_ml: mToday.water, cible_eau_ml: waterTgtToday } : null,
    repas_hier: mealsFor(foodLog, y),
    repas_aujourdhui: mealsFor(foodLog, today()),
    pas_hier: sYest_steps?.count ?? null, pas_aujourdhui: sToday_steps?.count ?? null,
    seances_hier: trYest.map((t) => t.type),
    seances_aujourdhui: trToday.map((t) => t.type),
    douleur_genou_hier: kYest ? { pain: kYest.pain, base_ok: kYest.baseline !== false } : null,
    douleur_genou_aujourdhui: kToday ? { pain: kToday.pain, base_ok: kToday.baseline !== false } : null,
    douleur_coude_hier: eYest ? { pain: eYest.pain, base_ok: eYest.baseline !== false } : null,
    douleur_coude_aujourdhui: eToday ? { pain: eToday.pain, base_ok: eToday.baseline !== false } : null,
  };

  const summary = {
    phase: PHASES[phase].label, poids_cible: tgtW,
    poids: { dernier: lastN(weight, 1)[0]?.kg ?? null, moy_7j: w7, moy_7j_precedents: w14, tendance_kg_sur_semaine: (w7 != null && w14 != null) ? round(w7 - w14) : null },
    macros_moy_7j: { proteines: avgKey(m7, "protein"), glucides: avgKey(m7, "carbs"), lipides: avgKey(m7, "fat"), fibres: avgKey(m7, "fiber"), eau_ml: avgKey(m7, "water") },
    cibles: { proteines: atToday.protein, glucides: atToday.carbs, lipides: atToday.fat, fibres: atToday.fiber, eau_ml: targets.water },
    // Sommeil et genou : ces agrégats remplacent les tableaux bruts 14 j qui étaient
    // envoyés en plus et n'apportaient rien de plus que ce que le JS calcule ici.
    sommeil: {
      heures_moy_7j: avgKey(win(sleep, 0, 6), "hours"), qualite_moy_7j: avgKey(win(sleep, 0, 6), "quality"),
      pire_nuit_7j: (() => { const v = win(sleep, 0, 6).map((s) => s.hours).filter((x) => x != null); return v.length ? round(Math.min(...v), 2) : null; })(),
      nuits_sous_6h_7j: win(sleep, 0, 6).filter((s) => s.hours != null && s.hours < 6).length,
    },
    pas_moy_7j: steps7 != null ? Math.round(steps7) : null,
    seances_7j: sessCount(0, 6), seances_14j: sessCount(0, 13),
    genou: {
      derniere_douleur: kLast?.pain ?? null, derniere_date: kLast?.date ?? null,
      base_ok: kLast ? kLast.baseline !== false : null,
      jours_hors_base_14j: win(knee, 0, 13).filter((k) => k.baseline === false).length,
      douleur_moy_7j: avgKey(win(knee, 0, 6), "pain"), douleur_moy_7j_precedents: avgKey(win(knee, 7, 13), "pain"),
    },
    // Mêmes agrégats pour le tendon distal du biceps (V1, 03/08/2026) : jusqu'ici le
    // coude n'existait que comme contrainte dans le `system`, sans un seul chiffre à
    // commenter. Coût : quelques dizaines de tokens.
    coude: {
      derniere_douleur: eLast?.pain ?? null, derniere_date: eLast?.date ?? null,
      base_ok: eLast ? eLast.baseline !== false : null,
      jours_hors_base_14j: win(elbow, 0, 13).filter((k) => k.baseline === false).length,
      douleur_moy_7j: avgKey(win(elbow, 0, 6), "pain"), douleur_moy_7j_precedents: avgKey(win(elbow, 7, 13), "pain"),
    },
    recommandeur: {
      top: reco.suggestions[0] ? { type: reco.suggestions[0].type, score: reco.suggestions[0].score, motif: reco.suggestions[0].reason } : null,
      alternatives: reco.suggestions.slice(1).map((s) => ({ type: s.type, score: s.score })),
      a_eviter: reco.avoid.map((a) => ({ type: a.type, motif: a.reason })),
    },
    // Dépense adaptative (V7) : le JS peut désormais donner un déficit EXACT au lieu
    // que le coach l'estime à la louche à partir du poids et des apports. `null` tant
    // qu'il n'y a pas assez de recul — jamais un chiffre non fiable.
    depense_estimee: tdeeResult.status === "ok" ? {
      kcal_j: tdeeResult.tdee, fiabilite: tdeeResult.reliability, fenetre_jours: tdeeResult.days,
      deficit_reel_vs_cible: realDeficit(Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber)), tdeeResult.tdee),
      chevauche_perte_eau: tdeeResult.overlapsWater,
    } : { statut: "pas assez de données" },
  };

  const notesTxt = last14(notes).map((n) => `${n.date} : ${n.text}`).join("\n")
    + ((note || "").trim() && !notes.some((n) => n.date === today() && n.text === note.trim())
        ? `${last14(notes).length ? "\n" : ""}${today()} : ${note.trim()}` : "");

  // dataset fusionné jour par jour (pour corrélation poids ↔ macros/eau/fibres/pas) — remplace les tableaux bruts séparés
  const days14 = [...new Set([...last14(weight), ...last14(macros), ...last14(steps)].map((e) => e.date))].sort();
  const merged = days14.map((d) => {
    const w = weight.find((e) => e.date === d);
    const m = macros.find((e) => e.date === d);
    const st = steps.find((e) => e.date === d);
    const kcal = m ? Math.round(kcalOfEntry(m)) : null;
    const at = targetsForDate(d, targets);
    // Clés courtes et champs nuls omis : sur 14 lignes, les `"proteines":null` répétés
    // pesaient pour rien. Une légende explicite les abréviations dans le prompt.
    const row = { d: d.slice(5), p: w?.kg, kc: kcal, P: m?.protein, G: m?.carbs, L: m?.fat,
      F: m?.fiber, eau: m?.water, pas: st?.count,
      cible_kc: Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber)) };
    Object.keys(row).forEach((k) => { if (row[k] == null) delete row[k]; });
    return row;
  });

  // La fenêtre d'objectif ne produit plus qu'un constat FACTUEL, généré depuis la
  // config éditable (dates + cibles) : plus de dates en dur, et plus de disparition
  // silencieuse du bloc le jour où la fenêtre se termine.
  const cutOn = isCutWindow(today(), targets);
  const daysToEnd = cutOn ? daysBetween(today(), targets.cut.end) : null;
  const tempBlock = cutOn ? `

OBJECTIF EN COURS — fenêtre du ${targets.cut.start} au ${targets.cut.end} (encore ${daysToEnd} j) : cibles macros actives ${atToday.protein}P/${atToday.carbs}G/${atToday.fat}L/${atToday.fiber}fibres (~${Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber))} kcal).` : "";

  // Les RÈGLES de l'objectif (projection réaliste, quand lire la balance, interdiction
  // d'ajouter du volume à impact…) vivent désormais dans le profil permanent, éditable
  // par Yoann — elles ne sont plus en dur dans ce fichier.
  const profileBlock = (profile || "").trim()
    ? `

CONTEXTE PERMANENT écrit par Yoann — à traiter comme des contraintes, pas des suggestions :
${profile.trim()}` : "";

  // Découpage system / user : le rôle et les contraintes permanentes ne changent pas
  // d'un appel à l'autre, les données oui. Le champ `system` est rendu avant les
  // messages, donc cette partie stable formera le préfixe — utile si on active le cache
  // un jour, et plus propre en attendant. Les consignes de sortie restent en fin de
  // message utilisateur, là où elles ont fait leurs preuves (l'historique de troncatures
  // de ce module ne justifie pas de les déplacer maintenant).
  const system = `Tu es le coach personnel tout-en-un de Yoann, 43 ans, athlète (muscu/basket/escalade) : à la fois coach sportif, kinésithérapeute, nutritionniste et coach de vie. Phase ${PHASES[phase].label}, poids cible ${tgtW} kg. Deux tendinopathies en rééduc : tendon quadricipital (HSR, tempo 6 s, règle de Silbernagel : douleur ≤ 3-5/10 tolérée si retour à la base sous 24 h) et distale du biceps (prises neutres/pronation privilégiées, supination limitée). Protéines hautes prioritaires. Escalade = volume tirage, jamais empilée le jour d'un Upper ; ne pas cumuler les expositions genou.${tempBlock}${profileBlock}`;

  // Le paragraphe sur l'échelle de cotation dépend du schéma actif (RawCare Phase 1,
  // 06/08/2026) : "gym" est propre à la salle de l'utilisateur, donc l'explication complète
  // (ordre des couleurs, mise en garde anti-Fontainebleau) reste nécessaire. Un schéma
  // standard comme Fontainebleau est une notation déjà connue du modèle, aucune mise en
  // garde à faire.
  const cotationInstr = scheme.id === "gym"
    ? `Les cotations sont celles de SA SALLE, au format "couleur-niveau", ordonnées ainsi : jaune < vert < bleu < rouge < noir < violet, et 1 à 5 dans chaque couleur (5 = le plus dur). Ne pas les convertir en Fontainebleau.`
    : `Les cotations sont en échelle ${scheme.label} standard.`;

  const user = `TEMPS RÉEL — hier vs aujourd'hui (regarde d'abord ça, c'est le plus actionnable) :
${JSON.stringify(realtime)}

RÉSUMÉ 14 JOURS (moyennes fiables, tendance de fond) :
${JSON.stringify(summary)}

JOUR PAR JOUR — pour corréler apports et variations de poids (rétention d'eau via sodium/glucides vs vraie perte de masse grasse). Clés : d=date, p=poids, kc=kcal, P/G/L=protéines/glucides/lipides, F=fibres, eau=ml, pas, cible_kc=cible kcal du jour. Un champ absent = pas de donnée ce jour-là :
${JSON.stringify(merged)}

PROGRESSION PAR EXERCICE (14 j) — déjà calculée, ne refais pas l'arithmétique. "series_max" = meilleure série de chaque séance au format "MM-JJ poidsXreps" (ou "MM-JJ Ns" pour les exercices en gainage, mesurés en secondes) ; "tendance" compare le volume (charge × reps, ou les secondes en gainage) de la dernière séance à la précédente :
${JSON.stringify(exoProgressData)}
${autresSeances.length ? `Séances sans séries (basket/escalade) : ${JSON.stringify(autresSeances)}\nPour l'escalade (bloc en salle), "blocs" résume la séance : n=nombre de blocs (le proxy de charge sur le tendon du coude), max/mediane=cotations réussies, max_tente=le plus dur essayé, puis la répartition flash/essais/echec. ${cotationInstr}` : ""}
${notesTxt ? `\nNOTES DE CONTEXTE écrites par Yoann (14 j, ex. alcool, insomnie, petite blessure) — à prendre en compte activement dans l'analyse :\n${notesTxt}\n` : ""}
${(journal || "").trim() ? `CARNET DE BORD — état que TU as écrit à la fin de ta dernière analyse. C'est ta mémoire : appuie-toi dessus pour enchaîner (a-t-il appliqué ce que tu avais demandé ? où en est la progression ?) au lieu de repartir de zéro.\n${journal.trim()}\n` : "CARNET DE BORD : vide, c'est ta première analyse. Tu le créeras en fin de réponse.\n"}
Structure ta réponse en deux temps :
1. **Aujourd'hui / les prochaines 24h** : à partir du bloc TEMPS RÉEL, dis-lui concrètement quoi faire (ou éviter) MAINTENANT — séance, nutrition, hydratation, récupération, douleurs (genou ET coude) — en te basant sur ce qui s'est passé hier et sur les notes de contexte. \`repas_hier\`/\`repas_aujourdhui\` donnent le détail réel des aliments par repas (pas seulement les totaux macros) : commente la COMPOSITION si elle appelle un conseil concret (répartition protéique entre repas, repas trop pauvre/trop riche en fibres, timing autour de l'entraînement) — pas une simple relecture de la liste. Le champ \`recommandeur\` (dans RÉSUMÉ 14 JOURS) donne déjà un verdict calculé sur la séance du jour (score + motif, alternatives, à éviter) : appuie-toi dessus au lieu d'en recalculer un autre de ton côté — commente-le, nuance-le ou signale un désaccord argumenté si tu vois un facteur qu'il ignore, mais ne propose pas une séance différente sans le dire explicitement.
2. **Tendance de fond (14 jours)** : ce qui se dessine sur la durée et ce qu'il faut ajuster pour la semaine à venir, EN CORRÉLANT explicitement poids, kcal, macros, fibres et eau à partir du dataset JOUR PAR JOUR (ex. un pic de poids coïncide-t-il avec un pic de glucides/sodium la veille plutôt qu'un vrai surplus calorique ? un manque de fibres ou d'eau coïncide-t-il avec une stagnation ?). Le champ \`depense_estimee\` (dans RÉSUMÉ 14 JOURS) donne déjà la dépense énergétique réelle calculée par le JS (tendance de poids lissée vs apports réels) avec sa fiabilité et sa fenêtre : utilise CE chiffre pour le déficit plutôt que d'en estimer un toi-même à la louche à partir du poids et des apports bruts. S'il chevauche la perte hydrique du début de sèche (\`chevauche_perte_eau\`) ou si la fiabilité est "faible", dis-le explicitement et nuance en conséquence — ne présente jamais ce chiffre comme définitif dans ce cas. S'il vaut "pas assez de données", n'invente pas de dépense chiffrée.
Traite explicitement CHAQUE domaine : poids (bruit quotidien vs moyenne glissante), macros (protéines jour le jour, reste en moyenne 7j), eau (jours de basket +1L), sommeil (impact récup), pas quotidiens (corrélation activité/résultat), séances (équilibre Upper/Lower, progressive overload exercice par exercice, respect coude/escalade), douleurs genou ET coude (Silbernagel sur les deux tendons, priorité absolue si l'un des deux a flambé — le coude conditionne l'escalade et le tirage, le genou le Lower et le basket).
Sois direct, concret, chiffré, sans préambule ni rappel du contexte, sans reciter les données brutes (cite seulement les chiffres qui appuient un conseil) : va droit aux conseils, en bullet points courts. Limite stricte : 500 mots maximum au total — écourte les détails plutôt que de laisser une section inachevée, et termine toujours par une phrase de conclusion complète. Ce n'est pas un avis médical.

Puis, APRÈS ta conclusion, écris la ligne \`${CARNET_MARK}\` seule, et en dessous la version mise à jour du carnet de bord. Règles du carnet : c'est un ÉTAT, pas un journal — tu réécris la version complète à chaque fois, tu élagues ce qui est résolu ou périmé, tu gardes ce qui est en cours. ${CARNET_MAX_CHARS} caractères maximum. Y faire figurer : où en est la progression (chiffrée), ce que tu as demandé de changer et si ça a été appliqué, ce qui a marché ou pas, les points de vigilance en cours. Pas de conseils dedans, pas de redite de la réponse ci-dessus.`;

  return { system, user };
}

/**
 * Briefing complet à coller dans une conversation claude.ai.
 *
 * Volontairement PLUS riche que le prompt API : ici les tokens ne coûtent rien
 * (l'abonnement couvre la conversation), donc on garde les séries brutes que le prompt
 * API n'envoie plus, et on ajoute le profil et le carnet pour que la conversation
 * démarre avec tout le contexte. C'est le pendant « suivi de fond » du point du jour.
 */
export function buildCoachBriefing(data) {
  const { training, foodLog, sleep, knee, elbow } = data;
  const { system, user } = buildCoachPrompt(data, "");
  const brut = last14(training).filter((s) => s.exercices).map((s) => ({
    d: s.date, t: s.type,
    ex: s.exercices.map((e) => ({ n: e.nom, s: e.series.map((x) => `${x.poids || 0}x${x.val || 0}${x.leg ? "/" + x.leg : ""}`) })),
  }));
  const repasBrut = [...new Set(last14(foodLog).map((e) => e.date))].sort().map((d) => ({ d, ...mealsFor(foodLog, d) }));
  return `${system}

${user.split("Structure ta réponse en deux temps")[0].trim()}

SÉRIES BRUTES 14 jours (détail complet, pour analyser la progressive overload exercice par exercice) :
${JSON.stringify(brut)}

REPAS BRUTS 14 jours (détail complet, aliment par aliment) :
${JSON.stringify(repasBrut)}

Sommeil brut : ${JSON.stringify(last14(sleep))}
Genou brut : ${JSON.stringify(last14(knee))}
Coude brut : ${JSON.stringify(last14(elbow))}

---
Fais-moi une revue de fond : tendances sur la durée, corrélations entre apports/activité/poids/récupération, et ce qu'il faut ajuster pour la semaine à venir. Tu peux me poser des questions.`;
}
