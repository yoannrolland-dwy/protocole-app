// Moteur de séance (chantier G4, étape C1, 05/11/2026) : la logique du carnet de musculation,
// sortie de `MuscuLogger.jsx` à l'identique, sans React ni stockage, pour que l'écran et (plus
// tard, C2/C3) l'appli JEFFREY travaillent sur la même séance. Aucun changement de comportement :
// chaque fonction est la copie de ce que faisait le composant (même ordre, mêmes valeurs par
// défaut), vérifiée par captures avant/après du carnet.
//
// Un exercice du carnet : { nom, mode ("temps" = secondes), perLeg, opt, rest (s), target, scheme,
// consigne, def, last, groupe, mouvement, materiel, tendon, famille, rir, origine?, added?,
// series: [{ poids, val, fait, leg }] }. Les champs de saisie gardent des chaînes vides tant que
// rien n'est tapé (« "" » = vide, pas 0).

import { TEMPLATES, DEFAULT_WEIGHTS, hsrForWeek, hsrParse, exoSeriesCount } from "./templates.js";
import { lastPerf, lastExerciseSets, medianTarget } from "./perf.js";
import { EXERCISE_LIBRARY } from "./exercises.js";
import { catalogEntry } from "./exoCatalog.js";
import { round } from "../dateUtils.js";
import { beats } from "../training.js";

const hsrReps = (hsrWeek) => hsrParse(hsrForWeek(hsrWeek).scheme).reps;

/** Séries préremplies : la même série de la dernière séance, sinon la dernière perf, sinon le
 *  poids par défaut ; reps = médiane de la fourchette cible. */
function prefill({ training, nom, target, perLeg, nSeries }) {
  const last = lastPerf(training, nom);
  const lastSets = lastExerciseSets(training, nom);
  const def = DEFAULT_WEIGHTS[nom];
  const medVal = medianTarget(target);
  const mk = (leg, k) => {
    const pool = lastSets ? (leg == null ? lastSets : lastSets.filter((s) => s.leg === leg)) : null;
    const prev = pool?.[k] || null;
    return { poids: prev?.poids ?? last?.poids ?? def ?? "", val: prev?.val ?? (medVal === "" ? "" : medVal), fait: false, leg };
  };
  const series = perLeg
    ? [...Array(nSeries)].map((_, k) => mk("G", k)).concat([...Array(nSeries)].map((_, k) => mk("D", k)))
    : [...Array(nSeries)].map((_, k) => mk(null, k));
  return { last, def, series };
}

/** Exercice neuf. `tpl` : gabarit qui le prescrit (séries d'un HSR ou d'un superset), null pour
 *  une variante de la bibliothèque. */
export function makeExercise(ex, tpl, { training = [], hsrWeek } = {}) {
  const nSeries = exoSeriesCount(tpl, ex, hsrWeek);
  const target = ex.hsr ? `${hsrReps(hsrWeek)}` : ex.r;
  const { last, def, series } = prefill({ training, nom: ex.n, target, perLeg: ex.perLeg, nSeries });
  return { nom: ex.n, mode: ex.mode, perLeg: !!ex.perLeg, opt: !!ex.opt, rest: ex.rest,
    target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${nSeries} × ${ex.r}`, consigne: ex.c, def, last,
    groupe: ex.groupe, mouvement: ex.mouvement, materiel: ex.materiel, tendon: ex.tendon, famille: ex.famille, rir: null, series };
}

/** Exercice ajouté en cours de séance (31/10/2026) : prescription de sa définition d'origine.
 *  `c` : entrée du catalogue (`catalogEntry`). */
export const makeAddedExercise = (c, ctx) => ({ ...makeExercise(c.ex, c.type ? TEMPLATES[c.type] : null, ctx), opt: false, added: true });

/**
 * Exercices du carnet à l'ouverture. `initial` : séance déjà enregistrée rouverte en
 * modification — ses séries réelles sont réaffichées (pas des suggestions), une substitution est
 * retrouvée par `origine`, et les exercices ajoutés en cours de séance sont remis à la fin.
 */
export function buildExercises({ type, training = [], hsrWeek, initial }) {
  const template = TEMPLATES[type];
  const ctx = { training, hsrWeek };
  const fromTemplate = template.exos.map((ex) => {
    const target = ex.hsr ? `${hsrReps(hsrWeek)}` : ex.r;
    const last = lastPerf(training, ex.n);
    const def = DEFAULT_WEIGHTS[ex.n];
    // Un exercice substitué (01/09/2026) est enregistré sous un AUTRE nom que celui du gabarit :
    // `origine` porte le nom du gabarit, sinon la substitution disparaîtrait à la réouverture.
    const savedEx = initial?.exercices?.find((e) => e.nom === ex.n || e.origine === ex.n);
    if (savedEx) {
      const wasSubstituted = savedEx.nom !== ex.n;
      const lib = wasSubstituted ? EXERCISE_LIBRARY.find((l) => l.n === savedEx.nom) : null;
      const savedLast = wasSubstituted ? lastPerf(training, savedEx.nom) : last;
      const savedDef = wasSubstituted ? DEFAULT_WEIGHTS[savedEx.nom] : def;
      return { nom: savedEx.nom, mode: savedEx.mode ?? ex.mode, perLeg: !!savedEx.perLeg, opt: !!ex.opt, rest: ex.rest,
        target, scheme: ex.hsr ? hsrForWeek(hsrWeek).scheme : `${exoSeriesCount(template, ex, hsrWeek)} × ${ex.r}`,
        consigne: lib ? lib.c : ex.c, def: savedDef, last: savedLast,
        groupe: lib ? lib.groupe : ex.groupe, mouvement: lib ? lib.mouvement : ex.mouvement,
        materiel: lib ? lib.materiel : ex.materiel, tendon: lib ? lib.tendon : ex.tendon,
        famille: ex.famille, origine: wasSubstituted ? ex.n : undefined, rir: savedEx.rir ?? null,
        series: savedEx.series.map((s) => ({ poids: s.poids, val: s.val, fait: s.fait, leg: s.leg })) };
    }
    return makeExercise(ex, template, ctx);
  });
  // Exercices enregistrés qui ne viennent pas du gabarit (ni directement ni par substitution) :
  // ajoutés en cours de séance, remis à la fin.
  const names = new Set(template.exos.map((x) => x.n));
  const added = (initial?.exercices || []).filter((e) => !names.has(e.nom) && !names.has(e.origine)).map((se) => {
    const c = catalogEntry(se.nom);
    const base = c ? makeAddedExercise(c, ctx) : { nom: se.nom, mode: se.mode, rest: 90, target: "", scheme: "", consigne: "", last: lastPerf(training, se.nom), added: true };
    return { ...base, nom: se.nom, mode: se.mode ?? base.mode, perLeg: !!se.perLeg, origine: se.origine, rir: se.rir ?? null,
      series: se.series.map((s) => ({ poids: s.poids, val: s.val, fait: s.fait, leg: s.leg })) };
  });
  return fromTemplate.concat(added);
}

// ---- Opérations sur les séries (chacune rend une nouvelle liste, rien n'est modifié) ----

const mapExo = (exos, ei, f) => exos.map((e, i) => (i !== ei ? e : f(e)));

/** Poids (`poids`) ou reps/secondes (`val`) d'une série, tels que tapés. */
export const updateSet = (exos, ei, si, field, value) =>
  mapExo(exos, ei, (e) => ({ ...e, series: e.series.map((s, j) => (j !== si ? s : { ...s, [field]: value })) }));

/** Coche / décoche une série. */
export const toggleSet = (exos, ei, si) =>
  mapExo(exos, ei, (e) => ({ ...e, series: e.series.map((s, j) => (j !== si ? s : { ...s, fait: !s.fait })) }));

/** « + série » : copie la dernière série de la même jambe (ou de la liste), non cochée. */
export const addSet = (exos, ei, leg) => mapExo(exos, ei, (e) => {
  const sameLeg = e.series.filter((s) => s.leg === leg);
  const proto = sameLeg[sameLeg.length - 1] || {};
  return { ...e, series: [...e.series, { poids: proto.poids ?? "", val: proto.val ?? medianTarget(e.target), fait: false, leg }] };
});

/** Indice de la DERNIÈRE série non cochée de la jambe (ou de la liste), -1 si aucune : « − série »
 *  ne retire jamais une série déjà faite (U3, choix de Yoann). */
export function lastRemovable(e, leg) {
  for (let j = e.series.length - 1; j >= 0; j--) {
    const s = e.series[j];
    if ((leg == null || s.leg === leg) && !s.fait) return j;
  }
  return -1;
}

/** « − série ». */
export const removeLastSet = (exos, ei, leg) => mapExo(exos, ei, (e) => {
  const j = lastRemovable(e, leg);
  return j < 0 ? e : { ...e, series: e.series.filter((_, k) => k !== j) };
});

/** Reps en réserve (T4) : 0, 1, 2 ou 3 (= 3+) ; la même valeur une seconde fois la retire. */
export const setRir = (exos, ei, v) => mapExo(exos, ei, (e) => ({ ...e, rir: e.rir === v ? null : v }));

/** Ajout d'un exercice en fin de liste / retrait (tant qu'aucune série n'est cochée : règle de l'écran). */
export const appendExercise = (exos, item) => [...exos, item];
export const removeExercise = (exos, ei) => exos.filter((_, i) => i !== ei);

/** Remplaçants proposés : même `famille` (mouvement précis, autre équipement), plus le retour à
 *  l'exercice d'origine du gabarit s'il a déjà été remplacé. */
export function substitutionCandidates(e, template) {
  const candidates = e.famille
    ? EXERCISE_LIBRARY.filter((l) => l.famille === e.famille && l.n !== e.nom && l.n !== e.origine)
    : [];
  const original = e.origine ? (template.exos.find((x) => x.n === e.origine) ?? catalogEntry(e.origine)?.ex) : null;
  if (original) candidates.unshift({ ...original, isOriginal: true });
  return candidates;
}

/**
 * Remplace un exercice pour CETTE séance (jamais le gabarit). Nom, consigne et étiquettes viennent
 * du remplaçant ; le PROTOCOLE (mode, jambe par jambe, option, repos, nombre de séries, cible
 * HSR) reste celui prescrit. Séries remises à zéro, préremplies sous le nouveau nom. `origine`
 * garde le nom du gabarit à travers plusieurs remplacements et disparaît au retour à l'original.
 */
export const substituteExercise = (exos, ei, lib, { training = [] } = {}) => mapExo(exos, ei, (e) => {
  const nSeries = e.perLeg ? e.series.filter((s) => s.leg === "G").length : e.series.length;
  const { last, def, series } = prefill({ training, nom: lib.n, target: e.target, perLeg: e.perLeg, nSeries });
  const origin = e.origine ?? e.nom;
  return { ...e, rir: null, nom: lib.n, consigne: lib.c, groupe: lib.groupe, mouvement: lib.mouvement,
    materiel: lib.materiel, tendon: lib.tendon, famille: lib.famille, def, last, series,
    origine: lib.n === origin ? undefined : origin };
});

// ---- Où en est la séance ----

/**
 * Ce qui vient après la série `si` de l'exercice `ei` (considérée comme faite ; `si` = -1 : aucune).
 * → { kind: "set", nom, n, leg } | { kind: "exercise", nom } | { kind: "done" }.
 * Sert à la phrase de fin de repos (lib/restSpeech.js).
 */
export function nextAfter(exos, ei, si) {
  const done = (e, i, j) => e.series[j].fait || (i === ei && j === si);
  const e = exos[ei];
  if (e) {
    const j = e.series.findIndex((s, k) => !done(e, ei, k));
    if (j >= 0) {
      const leg = e.series[j].leg ?? null;
      const n = e.series.slice(0, j + 1).filter((s) => (s.leg ?? null) === leg).length;
      return { kind: "set", nom: e.nom, n, leg };
    }
  }
  // Exercice suivant : le premier, après celui-ci, qui reste à faire (une option pas encore
  // commencée est sautée), en repartant du début si besoin.
  for (let k = 1; k < exos.length; k++) {
    const i = (ei + k) % exos.length;
    const x = exos[i];
    const started = x.series.some((s, j) => done(x, i, j));
    if (x.opt && !started) continue;
    if (x.series.some((s, j) => !done(x, i, j))) return { kind: "exercise", nom: x.nom };
  }
  return { kind: "done" };
}

/**
 * Série en cours, pour l'appli JEFFREY (C3). Choix de Yoann (05/11/2026) : « toujours dans
 * l'ordre ». C'est la prochaine série non cochée du premier exercice pas fini, dans l'ordre de la
 * liste. Un exercice optionnel jamais commencé est sauté (choix de Yoann, comme l'annonce de fin
 * de repos). `ei` : exercice que Monsieur a nommé (« passe au rowing ») ; il prime tant qu'il lui
 * reste une série. → { ei, si, nom, n, leg } ou null si tout est fait.
 */
export function currentSet(exos, { ei } = {}) {
  const firstOpen = (i) => exos[i].series.findIndex((s) => !s.fait);
  const describe = (i) => {
    const si = firstOpen(i);
    const e = exos[i];
    const leg = e.series[si].leg ?? null;
    const n = e.series.slice(0, si + 1).filter((s) => (s.leg ?? null) === leg).length;
    return { ei: i, si, nom: e.nom, n, leg };
  };
  if (ei != null && exos[ei] && firstOpen(ei) >= 0) return describe(ei);
  for (let i = 0; i < exos.length; i++) {
    const started = exos[i].series.some((s) => s.fait);
    if (exos[i].opt && !started) continue;
    if (firstOpen(i) >= 0) return describe(i);
  }
  return null;
}

/** Exercices avec au moins une série cochée (« 3/9 exos »). */
export const doneExercises = (exos) => exos.filter((e) => e.series.some((s) => s.fait)).length;

/**
 * Ligne `trainingLog` de la séance validée — exactement ce qu'enregistre « Valider la séance ».
 * Séries vides retirées (ni poids, ni reps, ni cochée), exercice sans série retiré ; RIR et
 * `origine` seulement s'ils existent ; durée et RPE pour les gabarits `withMeta` (Basket).
 */
export function sessionRecord({ id, date, type, start, duration, rpe, exos }) {
  const template = TEMPLATES[type];
  return {
    id, date, type, start,
    ...(template.withMeta ? { duration: round(Number(duration) || 0), rpe: Number(rpe) || 0 } : {}),
    exercices: exos.map((e) => ({
      nom: e.nom, mode: e.mode, perLeg: e.perLeg, origine: e.origine,
      ...(e.rir != null ? { rir: e.rir } : {}),
      series: e.series
        .filter((s) => s.poids !== "" || s.val !== "" || s.fait)
        .map((s) => ({ poids: s.poids === "" ? 0 : +s.poids, val: s.val === "" ? 0 : +s.val, fait: s.fait, leg: s.leg })),
    })).filter((e) => e.series.length),
  };
}

/** Séries qui battent le record au moment où elles sont cochées : la référence (`ref`, meilleure
 *  série de l'historique hors séance en cours) avance au fil des séries. Aucune la 1re fois.
 *  (Sorti du carnet en C3, même calcul que l'étoile ★ à l'écran.) */
export function recordSetIndexes(e, ref) {
  let run = ref;
  const out = new Set();
  if (!run) return out;
  e.series.forEach((s, i) => {
    if (!s.fait) return;
    const cur = { poids: +s.poids || 0, val: +s.val || 0 };
    if (!(cur.poids > 0 || cur.val > 0)) return;
    if (beats(cur, run, e.mode)) { run = cur; out.add(i); }
  });
  return out;
}

/** Nom d'exercice lisible à voix haute : sans parenthèses, « @60° » → « à 60° », tiret → virgule.
 *  (Déplacé de lib/restSpeech.js en C3.) */
export function spokenName(nom) {
  const s = String(nom || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/@\s*/g, "à ")
    .replace(/\s+[—–-]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** « de développé incliné » / « d'élévations latérales ». */
export const ofName = (nom) => {
  const x = spokenName(nom);
  return /^[aeiouyàâéèêëîïôûü]/i.test(x) ? `d'${x}` : `de ${x}`;
};
