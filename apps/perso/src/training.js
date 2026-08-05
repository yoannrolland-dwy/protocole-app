// Lecture de l'historique d'entraînement — extrait des closures de `buildPrompt` (App.jsx)
// à l'étape V3 (03/08/2026) pour être partagé entre le Coach IA et l'écran de progression.
//
// Deux consommateurs, deux fenêtres : le Coach IA passe les 14 derniers jours (le prompt
// doit rester identique au caractère près, c'est le test de non-régression de cette
// extraction), l'écran passe tout l'historique. D'où des fonctions qui reçoivent une liste
// de séances DÉJÀ filtrée plutôt qu'une fenêtre en paramètre : impossible de se tromper de
// périmètre, et la fonction reste pure.
//
// Aucune dépendance à React ni à `ui.jsx` : ce module doit rester testable seul en Node.

const byDateAsc = (a, b) => a.date.localeCompare(b.date);

/**
 * Meilleure série d'un exercice sur une séance : la charge la plus lourde, puis le plus de
 * reps à charge égale. En mode « temps » (planche, iso) la charge vaut 0 partout, donc
 * c'est la tenue la plus longue qui ressort — le même code couvre les deux cas.
 * Ne compte que les séries cochées ET renseignées : une ligne préremplie jamais faite ne
 * doit pas passer pour une performance.
 */
export function bestSet(ex) {
  const done = (ex.series || []).filter((s) => s.fait && (+s.poids > 0 || +s.val > 0));
  if (!done.length) return null;
  const b = done.reduce((a, s) => (+s.poids > +a.poids || (+s.poids === +a.poids && +s.val > +a.val) ? s : a), done[0]);
  return { poids: +b.poids || 0, val: +b.val || 0 };
}

/**
 * Agrégat envoyé au Coach IA : meilleure série des 3 dernières séances de chaque exercice
 * + tendance de volume. Sortie volontairement figée (mêmes clés, même ordre) — c'est ce que
 * le prompt sérialise.
 * @param sessions séances déjà filtrées (le Coach IA passe les 14 derniers jours)
 *
 * Corrigé à V3 (03/08/2026) pour les exercices en mode « temps » : le volume charge × reps
 * y valait toujours 0 (la charge est nulle), donc TOUS les gainages étaient annoncés
 * « stable » au coach — une planche passée de 60 s à 55 s comprise. Ils sont désormais
 * comparés en secondes, et affichés « 60s » plutôt que « 0x60 » (que le modèle pouvait lire
 * comme une charge nulle). Seul le mode temps change ; la sortie des exercices en reps est
 * identique au caractère près à celle d'avant l'extraction (vérifié par diff sur un jeu de
 * séances synthétique).
 */
export function exoProgress(sessions) {
  const byExo = {};
  sessions.filter((s) => s.exercices).forEach((s) => {
    s.exercices.forEach((e) => {
      const b = bestSet(e);
      if (!b) return;
      (byExo[e.nom] ||= []).push({ d: s.date, mode: e.mode, ...b });
    });
  });
  return Object.entries(byExo).map(([nom, hist]) => {
    const h = hist.slice(-3); // 3 dernières séances suffisent pour lire une tendance
    const last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
    // Volume = charge × reps (ou secondes en mode temps) : capte une progression même
    // quand le poids ne bouge pas.
    const vol = (x) => setScore(x, x.mode);
    const tendance = !prev ? "1re fois"
      : vol(last) > vol(prev) ? "hausse"
      : vol(last) < vol(prev) ? "baisse" : "stable";
    return {
      exo: nom,
      series_max: h.map((x) => `${x.d.slice(5)} ${isTimeMode(x.mode) ? `${x.val}s` : `${x.poids}x${x.val}`}`),
      tendance,
    };
  });
}

/* ============================================================
   Écran « Progression par exercice » (V3)
   ============================================================ */

/** Un exercice en mode « temps » se mesure en secondes, pas en charge × reps. */
export const isTimeMode = (mode) => mode === "temps";

/**
 * Grandeur tracée : le volume de la meilleure série (charge × reps), ou les secondes en
 * mode temps. Pas de 1RM estimé — les formules type Epley n'ont aucun sens sur un protocole
 * HSR à tempo 6 s et amplitude 10-60°, et pousser un 1RM sur un tendon en rééducation est
 * contre-indiqué (décision explicite de la roadmap, ne pas ajouter sans demande).
 */
export const setScore = (best, mode) => (isTimeMode(mode) ? best.val : best.poids * best.val);

/** Série lisible pour le tooltip et les listes : « 60 kg × 8 » ou « 45 s ». */
export const setLabel = (best, mode) =>
  isTimeMode(mode) ? `${best.val} s` : `${best.poids} kg × ${best.val}`;

/**
 * Toutes les séances où l'exercice apparaît avec au moins une série faite, du plus ancien
 * au plus récent. Les séances où il a été ouvert mais rien coché sont écartées : elles ne
 * sont pas une performance à zéro, elles ne sont pas une performance du tout.
 */
export function exerciseSessions(training, nom) {
  return (training || [])
    .map((s) => {
      const e = s.exercices?.find((x) => x.nom === nom);
      if (!e) return null;
      const best = bestSet(e);
      if (!best) return null;
      return {
        date: s.date, type: s.type, mode: e.mode, perLeg: !!e.perLeg,
        best, score: setScore(best, e.mode),
        series: (e.series || []).filter((x) => x.fait && (+x.poids > 0 || +x.val > 0)),
      };
    })
    .filter(Boolean)
    .sort(byDateAsc);
}

/**
 * Liste des exercices déjà réalisés (au moins une série cochée), le plus récent en tête.
 * Un exercice jamais fait n'y figure pas : l'écran de détail n'est donc jamais ouvert sur
 * un historique vide.
 */
export function exerciseList(training) {
  const byExo = {};
  (training || []).forEach((s) => {
    (s.exercices || []).forEach((e) => {
      if (!bestSet(e)) return;
      const cur = (byExo[e.nom] ||= { nom: e.nom, mode: e.mode, count: 0, last: "" });
      cur.count += 1;
      if (s.date > cur.last) { cur.last = s.date; cur.mode = e.mode; }
    });
  });
  return Object.values(byExo).sort((a, b) => b.last.localeCompare(a.last) || a.nom.localeCompare(b.nom));
}

/* ============================================================
   RECORDS (V4)
   ============================================================ */

/**
 * `a` bat-il `b` ? Charge la plus lourde, puis le plus de reps à charge égale ; secondes en
 * mode temps. Même hiérarchie que `bestSet`, pour qu'un record soit toujours la série que
 * l'app affiche déjà comme la meilleure.
 * `b` absent = premier passage sur l'exercice : ce n'est PAS un record, c'est une référence
 * (voir `recordsBySession` / `recordToBeat`, qui renvoient `null` dans ce cas).
 */
export function beats(a, b, mode) {
  if (!a) return false;
  if (!b) return false;
  if (isTimeMode(mode)) return +a.val > +b.val;
  return +a.poids > +b.poids || (+a.poids === +b.poids && +a.val > +b.val);
}

/**
 * Meilleure série jamais réalisée sur cet exercice, toutes séances confondues SAUF celle
 * passée en `exclude` (la séance en cours d'écriture ou de modification : elle ne doit pas
 * être son propre record à battre). `null` si l'exercice n'a jamais été fait.
 *
 * Calculé sur TOUT l'historique, jamais sur 14 jours : sinon tout redeviendrait un record
 * tous les quinze jours.
 *
 * Les exercices par jambe sont traités globalement (comme `bestSet`) : le record est la
 * meilleure série, peu importe le côté.
 */
export function recordToBeat(training, nom, exclude = null) {
  let best = null;
  (training || []).forEach((s) => {
    if (s === exclude || (exclude?.id && s.id === exclude.id)) return;
    const e = s.exercices?.find((x) => x.nom === nom);
    if (!e) return;
    const b = bestSet(e);
    if (b && (!best || beats(b, best, e.mode))) best = b;
  });
  return best;
}

/**
 * Records **au moment où ils ont eu lieu** : rejoue l'historique dans l'ordre chronologique
 * et retient, pour chaque séance, les exercices dont la meilleure série a battu tout ce qui
 * précédait.
 *
 * C'est la réponse au piège du premier lancement : on ne déclare pas un record sur chaque
 * exercice de la prochaine séance, on relit l'historique existant pour savoir où en étaient
 * les records à chaque date.
 *
 * @returns Map (objet séance → liste des exercices ayant battu un record ce jour-là). Clé
 *   par référence d'objet, comme la suppression et la modification de séance ailleurs dans
 *   l'app — pas par `id`, que les séances les plus anciennes n'ont pas toutes.
 */
export function recordsBySession(training) {
  const best = {};
  const out = new Map();
  [...(training || [])].sort(byDateAsc).forEach((s) => {
    (s.exercices || []).forEach((e) => {
      const b = bestSet(e);
      if (!b) return;
      const prev = best[e.nom];
      if (!prev) { best[e.nom] = b; return; } // premier passage = référence, pas un record
      if (beats(b, prev, e.mode)) {
        best[e.nom] = b;
        out.set(s, [...(out.get(s) || []), e.nom]);
      }
    });
  });
  return out;
}

/**
 * Douleur hors base ce jour-là, sur l'une ou l'autre des deux zones (V1).
 * Sert de garde-fou d'AFFICHAGE des records : féliciter une charge record le jour où le
 * tendon a flambé, c'est encourager exactement ce que la règle de Silbernagel cherche à
 * éviter. Le record reste calculé et enregistré, il n'est simplement pas mis en avant.
 * Pas de relevé ce jour-là = pas de suppression du badge : une absence de saisie n'est pas
 * une alerte (même principe que le coude dans le recommandeur).
 */
export function painOutOfBase(logs, date) {
  return (logs || []).some((log) => {
    const e = (log || []).find((x) => x.date === date);
    return !!e && (e.baseline === false || e.pain >= 6);
  });
}

/**
 * Tendance sur les 3 dernières séances, même définition que celle envoyée au Coach IA
 * (dernière vs précédente) — l'écran et le coach ne doivent jamais dire deux choses
 * différentes du même historique.
 */
export function exerciseTrend(sessions) {
  const h = sessions.slice(-3);
  if (h.length < 2) return { key: "first", label: "1re fois", delta: null };
  const last = h[h.length - 1], prev = h[h.length - 2];
  const delta = last.score - prev.score;
  if (delta > 0) return { key: "up", label: "hausse", delta };
  if (delta < 0) return { key: "down", label: "baisse", delta };
  return { key: "flat", label: "stable", delta: 0 };
}
