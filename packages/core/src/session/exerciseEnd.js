// Fin d'exercice et compte rendu de séance, dits par JEFFREY (17/11/2026, demande de Yoann ;
// cadrage : jeffrey-app/docs/cadrage/TENDANCE_EXERCICE_COMPTE_RENDU.md). Fonctions pures.
//
// Décisions de Yoann (17/11/2026) :
// - une annonce par exercice, quand sa DERNIÈRE série est cochée ou notée, jamais à chaque série ;
// - hausse / stable / baisse / première fois par rapport à la dernière fois, avec la règle déjà en
//   place (`sessionTrend`, comparaison à format égal), sans la changer ;
// - record sur cette même dernière série : UNE seule phrase qui dit le record et la tendance ;
// - compte rendu court (2 à 3 phrases) à la validation de la séance ;
// - phrases fixes, plusieurs tournures, aucun appel au modèle ;
// - genou hors base : ni tendance ni record (compte rendu réduit aux chiffres) ;
// - exercice quitté avant la fin : rien ;
// - compte rendu : un exercice non terminé compte dans les séries, pas dans les tendances.
// Après le premier essai de Yoann (17/11/2026, remplace deux hypothèses du cadrage) :
// - une séance ROUVERTE depuis l'historique (du jour ou d'un autre jour) parle comme une séance en
//   cours ; sa tendance se compare aux séances jusqu'à sa date (elle-même exclue), ses records à
//   tout l'historique (même règle que l'étoile du carnet), et son compte rendu ne dit pas de durée
//   (seule l'heure de début est connue) ;
// - l'annonce est redite CHAQUE fois que l'exercice redevient complet (décocher puis recocher, série
//   ajoutée puis cochée), recalculée avec les valeurs du moment.

import { exerciseSessions, recordToBeat, sessionTrend, doneSets, bestSet } from "../training.js";
import { recordSetIndexes, spokenName, ofName } from "./engine.js";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pickOf = (rand) => (arr) => arr[Math.min(arr.length - 1, Math.floor((rand ?? Math.random)() * arr.length))];
const kg = (v) => `${String(v).replace(".", ",")} kilo${Math.abs(v) >= 2 ? "s" : ""}`;
const isTime = (e) => e?.mode === "temps";
const sameAsEdited = (s, ex) => !!ex && (s === ex || (ex.id && s.id === ex.id));

/** Libellé de tendance du contrat : hausse | stable | baisse | premiere. */
export const TREND_KEY = { up: "hausse", flat: "stable", down: "baisse", first: "premiere" };

/** Toutes les séries prévues de l'exercice sont faites. */
export const exerciseComplete = (e) => !!e?.series?.length && e.series.every((s) => s.fait);

/** Tendance de l'exercice `e` (brouillon) avec la séance du jour : hausse | stable | baisse | premiere. */
export function trendWithToday(e, { training = [], date, exclude = null } = {}) {
  const best = bestSet(e);
  if (!best) return null;
  const hist = exerciseSessions(training.filter((s) => !sameAsEdited(s, exclude) && s.date <= date), e.nom);
  const today = { date, mode: e.mode, rir: e.rir ?? null, best, series: doneSets(e) };
  return TREND_KEY[sessionTrend([...hist, today], e.mode)];
}

/** « 34 kilos, 10 répétitions » / « 60 secondes » d'une série. */
export function setWords(e, s) {
  const v = +s.val || 0;
  if (isTime(e)) return `${v} secondes`;
  return [+s.poids > 0 ? kg(+s.poids) : null, `${v} répétition${v >= 2 ? "s" : ""}`].filter(Boolean).join(", ");
}

const TREND_PHRASES = {
  hausse: [
    "Fin {de} : en hausse par rapport à la dernière fois.",
    "Dernière série {de} faite, Monsieur : en progrès sur la dernière fois.",
    "{N}, c'est fini : en hausse sur la dernière fois.",
  ],
  stable: [
    "Fin {de} : stable par rapport à la dernière fois.",
    "Dernière série {de} faite, Monsieur : même niveau que la dernière fois.",
    "{N}, c'est fini : stable sur la dernière fois.",
  ],
  baisse: [
    "Fin {de} : en baisse, deux séances de suite sous la précédente.",
    "Dernière série {de} faite, Monsieur : en baisse sur les deux dernières séances.",
    "{N}, c'est fini : en baisse depuis deux séances.",
  ],
  premiere: [
    "Fin {de} : première fois, rien à comparer.",
    "Dernière série {de} faite, Monsieur : c'est la première fois, la référence est posée.",
    "{N}, c'est fini : première séance, rien à comparer.",
  ],
};
const RECORD_PHRASES = [
  "Nouveau record {de}, Monsieur : {w}, et l'exercice est {t}.",
  "Fin {de} sur un record, Monsieur : {w}, et l'exercice est {t}.",
  "Dernière série record {de} : {w}, et l'exercice est {t}.",
];
const TREND_WORD = { hausse: "en hausse", stable: "stable", baisse: "en baisse", premiere: "nouveau" };
const SIDE = { G: ", jambe gauche", D: ", jambe droite" };

/** Phrase de fin d'exercice. `record` = { words, jambe? } quand la dernière série bat un record. */
export function exerciseEndPhrase({ nom, tendance, record = null, rand }) {
  const pick = pickOf(rand);
  const fill = (t) => t.replace("{de}", ofName(nom)).replace("{N}", cap(spokenName(nom)));
  if (record) {
    return fill(pick(RECORD_PHRASES))
      .replace("{w}", `${record.words}${SIDE[record.jambe] ?? ""}`)
      .replace("{t}", TREND_WORD[tendance] ?? "stable");
  }
  return fill(pick(TREND_PHRASES[tendance] ?? TREND_PHRASES.stable));
}

/**
 * Annonce de fin d'exercice après qu'une série a été cochée (écran) ou notée (voix).
 * `exos` = exercices APRÈS la série ; `ei`/`si` = la série ; `ref` = record à battre (hors séance
 * en cours, null si le genou est hors base) ; `exclude` = la séance rouverte (exclue de la tendance).
 * → null (rien à dire) ou { exercice, tendance, phrase, record?: { kg, reps | secondes, jambe? } }.
 */
export function exerciseEnd({ exos, ei, si, ref = null, training = [], date, exclude = null, painRed = false, rand }) {
  const e = exos?.[ei];
  if (painRed || !e || !exerciseComplete(e)) return null;
  const tendance = trendWithToday(e, { training, date, exclude });
  if (!tendance) return null;
  const s = e.series[si];
  const isRecord = !!ref && !!s?.fait && recordSetIndexes(e, ref).has(si);
  const record = isRecord
    ? { ...(isTime(e) ? { secondes: +s.val || 0 } : { kg: +s.poids || 0, reps: +s.val || 0 }), ...(s.leg ? { jambe: s.leg } : {}) }
    : null;
  return {
    exercice: e.nom, tendance,
    phrase: exerciseEndPhrase({ nom: e.nom, tendance, record: isRecord ? { words: setWords(e, s), jambe: s.leg } : null, rand }),
    ...(record ? { record } : {}),
  };
}

/** Minutes écoulées depuis l'heure de début « HH:MM » (null si absente ou hors 1 à 300). */
export function elapsedMinutes(start, now) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(start || ""));
  if (!m) return null;
  const d = new Date(now);
  let diff = d.getHours() * 60 + d.getMinutes() - (+m[1] * 60 + +m[2]);
  if (diff < 0) diff += 1440;
  return diff >= 1 && diff <= 300 ? diff : null;
}

const WORDS = ["aucun", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];
const nb = (n, fem = false) => (fem && n === 1 ? "une" : fem && n === 0 ? "aucune" : WORDS[n] ?? String(n));
const plural = (n, word, fem = false) => `${nb(n, fem)} ${word}${n > 1 ? "s" : ""}`;
const joinNames = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`);

const OPENINGS = [
  "Séance {type} enregistrée, Monsieur : {c}.",
  "C'est enregistré, Monsieur : séance {type}, {c}.",
  "Séance {type} terminée : {c}.",
];

/**
 * Compte rendu à l'enregistrement de la séance. `exos` = exercices du brouillon, `minutes` = durée
 * (null si inconnue). → { phrase, exercices, series, minutes, records: [noms], hausse, stable,
 * baisse: [noms], premiere, non_termines } — records et tendances vides si `painRed`.
 */
export function sessionReport({ type, exos = [], training = [], exclude = null, date, painRed = false, minutes = null, rand }) {
  const pick = pickOf(rand);
  const done = exos.filter((e) => e.series.some((s) => s.fait));
  const series = done.reduce((n, e) => n + e.series.filter((s) => s.fait).length, 0);
  const records = [], baisse = [];
  let hausse = 0, stable = 0, premiere = 0, nonTermines = 0;
  if (!painRed) {
    done.forEach((e) => {
      const ref = recordToBeat(training, e.nom, exclude);
      if (ref && recordSetIndexes(e, ref).size) records.push(e.nom);
      if (!exerciseComplete(e)) { nonTermines++; return; }
      const t = trendWithToday(e, { training, date, exclude });
      if (t === "hausse") hausse++;
      else if (t === "baisse") baisse.push(e.nom);
      else if (t === "premiere") premiere++;
      else if (t === "stable") stable++;
    });
  }
  const counts = [plural(done.length, "exercice"), plural(series, "série", true), ...(minutes ? [`${minutes} minutes`] : [])].join(", ");
  const parts = [pick(OPENINGS).replace("{type}", type).replace("{c}", counts)];
  if (!painRed) {
    if (records.length === 1) parts.push(`Un record, sur ${spokenName(records[0])}.`);
    else if (records.length > 1) parts.push(`${cap(nb(records.length))} records : ${joinNames(records.map(spokenName))}.`);
    const finished = hausse + stable + baisse.length + premiere;
    const unfinished = nonTermines ? `${plural(nonTermines, "exercice")} non terminé${nonTermines > 1 ? "s" : ""}` : "";
    if (finished) {
      const t = [`${cap(plural(hausse, "exercice"))} en hausse`, `${nb(stable)} stable${stable > 1 ? "s" : ""}`,
        baisse.length ? `${nb(baisse.length)} en baisse : ${joinNames(baisse.map(spokenName))}` : "aucun en baisse"];
      if (premiere) t.push(`${nb(premiere)} fait${premiere > 1 ? "s" : ""} pour la première fois`);
      if (unfinished) t.push(unfinished);
      parts.push(`${t.join(", ")}.`);
    } else if (unfinished) {
      parts.push(`${cap(unfinished)}, pas de tendance.`);
    }
  }
  return {
    phrase: parts.join(" "), exercices: done.length, series, minutes,
    records, hausse, stable, baisse, premiere, non_termines: nonTermines,
  };
}
