// Historique de performance par exercice — mémoire série par série pour préremplir le
// carnet de musculation. Extrait de src/App.jsx (apps/perso) le 05/08/2026, chantier
// RawCare Phase 0. Pur, zéro changement de contenu.

export const refSet = (ex) => (ex.series || []).reduce((a, b) => ((b.poids ?? 0) > (a?.poids ?? -1) ? b : a), null);

export function lastPerf(training, nom) {
  for (let i = training.length - 1; i >= 0; i--) {
    const s = training[i];
    const ex = s.exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) {
      const ref = refSet(ex) || ex.series[ex.series.length - 1];
      return { poids: ref.poids ?? 0, val: ref.val ?? 0, mode: ex.mode, date: s.date };
    }
  }
  return null;
}

export function perfHistory(training, nom, n = 6) {
  const out = [];
  for (const s of training) {
    const ex = s.exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) {
      const ref = refSet(ex) || ex.series[ex.series.length - 1];
      out.push({ date: s.date, poids: ref.poids ?? 0, val: ref.val ?? 0, mode: ex.mode });
    }
  }
  return out.slice(-n);
}

export function lastExerciseSets(training, nom) {
  for (let i = training.length - 1; i >= 0; i--) {
    const ex = training[i].exercices?.find((e) => e.nom === nom);
    if (ex && ex.series?.length) return ex.series;
  }
  return null;
}

// Gère "min" (04/09/2026, échauffement basket/mobilité : "5 min" plutôt que "300 s" pour
// rester lisible côté carnet) — même conversion que `parseSecs` (templates.js), pour que le
// préremplissage de la série (ici) et le bouton "maintien" (parseSecs) affichent le même
// nombre de secondes. Sans "min" dans la chaîne (reps, HSR, secondes déjà en l'état),
// comportement strictement inchangé.
export const medianTarget = (r) => {
  const s = String(r);
  const nums = s.match(/\d+/g);
  if (!nums) return "";
  const val = nums.length === 1 ? +nums[0] : Math.round((+nums[0] + +nums[nums.length - 1]) / 2);
  return /min/i.test(s) ? val * 60 : val;
};
