// Séance à la voix (chantier G4, étape C3, 05/11/2026) : ce que l'appli JEFFREY peut faire sur la
// séance en cours, par le pont. Fonctions pures sur le brouillon (`trainingDraft`, voir
// apps/perso/src/lib/sessionDraft.js) ; l'écriture, le réveil de fin de repos et la phrase de fin
// de repos restent dans l'app. Aucune règle métier nouvelle : tout passe par le moteur de séance
// (engine.js), les records (V4) et les plateaux du carnet.
//
// Choix de Yoann (05/11/2026) :
// - une série est notée TOUT DE SUITE, avec une phrase de confirmation, et « annule » la retire ;
// - la série en cours suit la liste dans l'ordre (un exercice optionnel pas commencé est sauté) ;
//   « passe au rowing » change d'exercice ;
// - fin de séance : un résumé relu, puis « oui » ; pour le Basket, la durée et l'effort d'abord ;
// - annonces : records battus (jamais genou hors base) et plateaux seulement ;
// - douleur pendant la séance : la noter (noter_genou), la séance continue.
//
// Champs du brouillon ajoutés par la voix : `courant` (exercice nommé par Monsieur) et
// `voix.last` (dernière série notée à la voix, pour « annule »).

import { TEMPLATES } from "./templates.js";
import { metaFor } from "./exoMeta.js";
import { buildExercises, currentSet, recordSetIndexes, doneExercises, sessionRecord, spokenName } from "./engine.js";
import { exerciseSessions, recordToBeat, progressiveOverloadSuggestion, painOutOfBase } from "../training.js";

const fail = (raison, extra = {}) => ({ ok: false, raison, ...extra });
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => (typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isTime = (e) => e?.mode === "temps";
const isBodyweight = (e) => (e?.materiel ?? metaFor(e?.nom)?.materiel) === "aucun";
const SIDE = { G: "côté gauche", D: "côté droit" };
export const kilos = (kg) => `${String(kg).replace(".", ",")} kilo${Math.abs(kg) >= 2 ? "s" : ""}`;

/** « 1 min 30 », « 2 minutes », « 45 secondes ». */
export function restText(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (!m) return `${s} secondes`;
  if (!s) return m === 1 ? "1 minute" : `${m} minutes`;
  return `${m} min ${s}`;
}

const isSession = (d) => !!d?.type && Array.isArray(d.exos);
const countSets = (exos) => exos.reduce((n, e) => n + e.series.filter((s) => s.fait).length, 0);
const editedOf = (d, ctx) => (d.editingId ? (ctx.training || []).find((t) => t.id === d.editingId) ?? null : null);
const painRedOf = (d, ctx) => painOutOfBase([ctx.knee || []], d.date);

/** Nouvelle séance (carnet) préparée par la voix : même construction que l'ouverture du carnet. */
export function newSessionDraft({ type, training = [], hsrWeek, date, start }) {
  return { type, date, editingId: null, start, duration: 60, rpe: 7, exos: buildExercises({ type, training, hsrWeek }) };
}

/** Plateau de l'exercice (même calcul que le carnet), jamais si le genou est hors base. */
function plateauOf(nom, d, ctx) {
  if (painRedOf(d, ctx)) return null;
  const p = progressiveOverloadSuggestion(exerciseSessions(ctx.training || [], nom), nom);
  if (!p) return null;
  return p.kind === "reps"
    ? `Plateau depuis ${p.sessions} séances : visez ${p.target} répétitions à ${kilos(p.poids)}.`
    : `Plateau depuis ${p.sessions} séances : passez à la charge supérieure.`;
}

/** « 9 répétitions à 30 kilos » / « 45 secondes » d'une série (prévue ou faite). */
function setWords(e, s) {
  if (isTime(e)) return s.val === "" || s.val == null ? "durée à préciser" : `${+s.val} secondes`;
  const reps = s.val === "" || s.val == null ? null : +s.val;
  const kg = s.poids === "" || s.poids == null ? null : +s.poids;
  if (reps == null) return kg ? `à ${kilos(kg)}` : "à préciser";
  return kg ? `${reps} à ${kilos(kg)}` : `${reps} répétitions`;
}

function where(exos, cur) {
  const e = exos[cur.ei];
  return `${cap(spokenName(e.nom))}, série ${cur.n}${cur.leg ? ` ${SIDE[cur.leg]}` : ""}`;
}

/** Choisit l'exercice nommé par Monsieur → { ok, ei } ou un refus (avec `choix`). */
export function findExercise(exos, query) {
  const asked = norm(query);
  if (!asked) return fail("nom d'exercice vide");
  const words = asked.split(" ");
  const names = exos.map((e) => `${norm(e.nom)} ${norm(spokenName(e.nom))}`);
  const match = exos.map((e, i) => i).filter((i) => words.every((w) => names[i].includes(w)));
  const exact = match.filter((i) => norm(exos[i].nom) === asked || norm(spokenName(exos[i].nom)) === asked);
  if (exact.length === 1) return { ok: true, ei: exact[0] };
  if (match.length === 1) return { ok: true, ei: match[0] };
  if (match.length > 1) return fail("plusieurs exercices correspondent : demandez à Monsieur lequel", { choix: match.slice(0, 5).map((i) => exos[i].nom) });
  return fail(`aucun exercice « ${query} » dans la séance (${exos.map((e) => e.nom).join(", ")})`);
}

/**
 * Où en est la séance (op `lire`, sujet `seance`). → { seance: null } sans séance en cours.
 * `ctx` = { training, knee, now (ms) }.
 */
export function readSession(d, ctx) {
  if (!isSession(d)) return { seance: null };
  const exos = d.exos;
  const cur = currentSet(exos, { ei: d.courant });
  const out = {
    type: d.type, date: d.date, debut: d.start,
    faits: { exercices: doneExercises(exos), total_exercices: exos.length, series: countSets(exos) },
    repos: d.rest?.endAt && d.rest.endAt > ctx.now
      ? { en_cours: true, reste_s: Math.ceil((d.rest.endAt - ctx.now) / 1000) }
      : { en_cours: false },
  };
  if (TEMPLATES[d.type]?.withMeta) Object.assign(out, { duree_min: d.duration, rpe: d.rpe });
  if (!cur) return { seance: { ...out, courant: null, phrase: "Toutes les séries sont faites, Monsieur : il ne reste qu'à enregistrer la séance." } };
  const e = exos[cur.ei];
  const s = e.series[cur.si];
  const painRed = painRedOf(d, ctx);
  const ref = painRed ? null : recordToBeat(ctx.training || [], e.nom, editedOf(d, ctx));
  const plateau = plateauOf(e.nom, d, ctx);
  out.courant = {
    exercice: e.nom, serie: cur.n, ...(cur.leg ? { jambe: cur.leg } : {}),
    prevu: isTime(e) ? { secondes: s.val === "" ? null : +s.val } : { kg: s.poids === "" ? null : +s.poids, reps: s.val === "" ? null : +s.val },
    cible: e.target, repos_s: e.rest,
    ...(ref ? { record_a_battre: isTime(e) ? { secondes: +ref.val } : { kg: +ref.poids, reps: +ref.val } } : {}),
    ...(plateau ? { plateau } : {}),
  };
  out.phrase = `${where(exos, cur)} : ${setWords(e, s)} prévus.${plateau ? ` ${plateau}` : ""}`;
  return { seance: out };
}

/**
 * Note une série tout de suite (choix de Yoann). `p` = { reps | secondes, kg?, exercice?, jambe? }.
 * → { ok, draft, ei, si, restSecs, phrase, record, plateau } ou un refus. Le repos et la phrase de fin
 * de repos sont lancés par l'app.
 */
export function logSet(d, p, ctx) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  let exos = d.exos;
  let courant = d.courant;
  if (p?.exercice != null) {
    const f = findExercise(exos, p.exercice);
    if (!f.ok) return f;
    courant = f.ei;
  }
  let cur = currentSet(exos, { ei: courant });
  if (p?.jambe != null) {
    if (p.jambe !== "G" && p.jambe !== "D") return fail("jambe : G ou D");
    const ei = cur?.ei ?? courant;
    const e = exos[ei];
    if (!e?.perLeg) return fail("cet exercice ne se note pas jambe par jambe");
    const si = e.series.findIndex((s) => !s.fait && s.leg === p.jambe);
    if (si < 0) return fail(`plus de série ${SIDE[p.jambe]} à faire sur cet exercice`);
    cur = { ei, si, nom: e.nom, leg: p.jambe, n: e.series.slice(0, si + 1).filter((s) => s.leg === p.jambe).length };
  }
  if (!cur) return fail("toutes les séries sont faites : il ne reste qu'à enregistrer la séance");
  const e = exos[cur.ei];
  const before = e.series[cur.si];
  const raw = isTime(e) ? (p?.secondes ?? p?.reps) : p?.reps;
  const val = Math.round(num(raw));
  if (isTime(e)) {
    if (!Number.isFinite(val) || val < 1 || val > 900) return fail(`durée en secondes manquante pour ${e.nom} (1 à 900)`, { besoin: "secondes" });
  } else if (!Number.isFinite(val) || val < 1 || val > 100) {
    return fail(`nombre de répétitions manquant pour ${e.nom} (1 à 100)`, { besoin: "reps" });
  }
  let poids = before.poids;
  if (p?.kg != null) {
    const kg = Math.round(num(p.kg) * 10) / 10;
    if (!Number.isFinite(kg) || kg < 0 || kg > 500) return fail("charge hors de 0 à 500 kg");
    poids = kg;
  } else if (!isTime(e) && before.poids === "" && !isBodyweight(e)) {
    // Exercice au poids du corps (squats de l'échauffement basket, cheville au mur) : aucune charge
    // à demander, la série se note sans kilos, comme à l'écran (audit du 10/11/2026, point 15).
    return fail(`charge inconnue pour ${e.nom} : demandez-la à Monsieur`, { besoin: "kg" });
  }
  const firstOfExercise = !e.series.some((s) => s.fait);
  const after = { ...before, val, poids, fait: true };
  exos = exos.map((x, i) => (i !== cur.ei ? x : { ...x, series: x.series.map((s, j) => (j !== cur.si ? s : after)) }));
  const painRed = painRedOf(d, ctx);
  const ref = painRed ? null : recordToBeat(ctx.training || [], e.nom, editedOf(d, ctx));
  const record = !!ref && recordSetIndexes(exos[cur.ei], ref).has(cur.si);
  const plateau = firstOfExercise ? plateauOf(e.nom, d, ctx) : null;
  const draft = { ...d, exos, courant, voix: { last: { ei: cur.ei, si: cur.si, before } } };
  // Exercice sans repos prévu (échauffement basket) : on ne dit pas « repos 0 secondes ».
  const restSecs = Number(e.rest) > 0 ? Number(e.rest) : 0;
  const phrase = `${where(exos, cur)} notée, ${setWords(exos[cur.ei], after)}${restSecs ? `, repos ${restText(restSecs)}` : ""}.`
    + (record ? " Record battu, Monsieur." : "") + (plateau ? ` ${plateau}` : "");
  return { ok: true, draft, ei: cur.ei, si: cur.si, restSecs, phrase, record, plateau };
}

/** « Annule » : la dernière série notée à la voix revient comme avant. */
export function undoLastSet(d) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const last = d.voix?.last;
  const e = last && d.exos[last.ei];
  if (!e || !e.series[last.si]) return fail("aucune série notée à la voix à annuler");
  const exos = d.exos.map((x, i) => (i !== last.ei ? x : { ...x, series: x.series.map((s, j) => (j !== last.si ? s : last.before)) }));
  const leg = last.before.leg ?? null;
  const n = e.series.slice(0, last.si + 1).filter((s) => (s.leg ?? null) === leg).length;
  return { ok: true, draft: { ...d, exos, voix: null }, phrase: `${cap(spokenName(e.nom))}, série ${n}${leg ? ` ${SIDE[leg]}` : ""} annulée.` };
}

/** « Passe au rowing » : l'exercice nommé devient l'exercice en cours. */
export function goToExercise(d, p, ctx) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const f = findExercise(d.exos, p?.exercice);
  if (!f.ok) return f;
  const draft = { ...d, courant: f.ei };
  const r = readSession(draft, ctx).seance;
  if (r.courant?.exercice !== d.exos[f.ei].nom) return fail(`${d.exos[f.ei].nom} est déjà fini`);
  return { ok: true, draft, phrase: r.phrase };
}

/** « Exercice suivant » : le prochain exercice de la liste qui reste à faire (une option pas
 *  commencée est sautée), en repartant du début si besoin. */
export function nextExercise(d, ctx) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const exos = d.exos;
  const cur = currentSet(exos, { ei: d.courant });
  if (!cur) return fail("toutes les séries sont faites : il ne reste qu'à enregistrer la séance");
  for (let k = 1; k < exos.length; k++) {
    const i = (cur.ei + k) % exos.length;
    const x = exos[i];
    if (x.opt && !x.series.some((s) => s.fait)) continue;
    if (x.series.some((s) => !s.fait)) {
      const draft = { ...d, courant: i };
      return { ok: true, draft, phrase: readSession(draft, ctx).seance.phrase };
    }
  }
  return fail("plus d'autre exercice à faire");
}

/**
 * Repos : `action` ∈ lancer | plus30 | pause | reprendre | stop (mêmes effets que les boutons du
 * carnet). → { ok, draft, alarm: { endAt, label } | null, phrase }. `alarm` = réveil natif à
 * (re)programmer ; null = à annuler.
 */
export function restAction(d, action, now) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const cur = currentSet(d.exos, { ei: d.courant });
  const e = d.exos[cur?.ei ?? 0];
  const r = d.rest || { secs: e?.rest ?? 120, remaining: e?.rest ?? 120, endAt: null, label: e?.nom ?? "", speech: "" };
  const running = !!r.endAt && r.endAt > now;
  const left = running ? Math.ceil((r.endAt - now) / 1000) : r.remaining;
  let rest;
  let phrase;
  if (action === "lancer") {
    const secs = e?.rest ?? r.secs;
    rest = { secs, remaining: secs, endAt: now + secs * 1000, label: e?.nom ?? r.label, speech: r.speech };
    phrase = `Repos lancé, ${restText(secs)}.`;
  } else if (action === "plus30") {
    rest = running ? { ...r, endAt: r.endAt + 30_000, remaining: left + 30 } : { ...r, remaining: r.remaining + 30 };
    phrase = running ? `Trente secondes de plus : il reste ${restText(left + 30)}.` : `Repos réglé à ${restText(r.remaining + 30)}.`;
  } else if (action === "pause") {
    if (!running) return fail("aucun repos en cours");
    rest = { ...r, endAt: null, remaining: left };
    phrase = `Repos en pause, il reste ${restText(left)}.`;
  } else if (action === "reprendre") {
    if (running) return fail("le repos est déjà en cours");
    const secs = r.remaining > 0 ? r.remaining : r.secs;
    rest = { ...r, remaining: secs, endAt: now + secs * 1000 };
    phrase = `Repos repris, ${restText(secs)}.`;
  } else if (action === "stop") {
    rest = { ...r, endAt: null, remaining: r.secs };
    phrase = "Repos arrêté.";
  } else {
    return fail("action de repos inconnue (lancer, plus30, pause, reprendre, stop)");
  }
  return { ok: true, draft: { ...d, rest }, alarm: rest.endAt ? { endAt: rest.endAt, label: rest.label } : null, phrase };
}

/**
 * Fin de séance : vérifie et décrit (résumé relu, puis « oui »). Basket : la durée et l'effort
 * sont demandés d'abord (`besoin`). → { ok, record, resume, question } ou un refus.
 */
export function finishCheck(d, p, { nowMs }) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const sets = countSets(d.exos);
  if (!sets) return fail("aucune série n'est faite : rien à enregistrer. Pour arrêter sans rien garder : annuler_seance");
  const meta = !!TEMPLATES[d.type]?.withMeta;
  let duration = d.duration;
  let rpe = d.rpe;
  if (meta) {
    const du = Math.round(num(p?.duree));
    if (p?.duree == null) return fail("durée de la séance manquante : demandez-la à Monsieur (minutes)", { besoin: "duree" });
    if (!Number.isFinite(du) || du < 5 || du > 300) return fail("durée hors de 5 à 300 minutes");
    const r = Math.round(num(p?.rpe));
    if (p?.rpe == null) return fail("effort ressenti manquant : demandez-le à Monsieur (1 à 10)", { besoin: "rpe" });
    if (!Number.isFinite(r) || r < 1 || r > 10) return fail("effort ressenti (RPE) hors de 1 à 10");
    duration = du;
    rpe = r;
  }
  const n = doneExercises(d.exos);
  const counts = `${n} exercice${n > 1 ? "s" : ""}, ${sets} série${sets > 1 ? "s" : ""} faite${sets > 1 ? "s" : ""}`;
  const metaText = meta ? `, ${duration} min, effort ${rpe} sur 10` : "";
  const record = sessionRecord({ id: d.editingId ?? `${d.date}-${d.type}-${nowMs}`, date: d.date, type: d.type, start: d.start, duration, rpe, exos: d.exos });
  return {
    ok: true, record, editingId: d.editingId ?? null,
    resume: `Enregistrer la séance ${d.type} : ${counts}${metaText}`,
    question: `Dois-je enregistrer la séance ${d.type}, Monsieur ? ${cap(counts)}${metaText}.`,
  };
}

/** Abandon de la séance (relecture, puis « oui ») : le brouillon est effacé, rien n'est gardé. */
export function abandonCheck(d) {
  if (!isSession(d)) return fail("aucune séance en cours dans PROTOCOLE");
  const sets = countSets(d.exos);
  const lost = sets ? ` (${sets} série${sets > 1 ? "s" : ""} faite${sets > 1 ? "s" : ""} perdue${sets > 1 ? "s" : ""})` : "";
  return {
    ok: true,
    resume: `Abandonner la séance ${d.type} sans l'enregistrer${lost}`,
    question: `Dois-je abandonner la séance ${d.type} sans l'enregistrer, Monsieur ?${sets ? ` ${cap(lost.slice(2, -1))}.` : ""}`,
  };
}
