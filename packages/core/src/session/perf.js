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

export const medianTarget = (r) => {
  const nums = String(r).match(/\d+/g);
  if (!nums) return "";
  if (nums.length === 1) return +nums[0];
  return Math.round((+nums[0] + +nums[nums.length - 1]) / 2);
};
