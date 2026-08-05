// Cibles macro / fenêtre d'objectif temporaire. Rempli progressivement pendant le chantier
// RawCare Phase 0 : `isCutWindow` arrive au jalon 5 (le recommandeur en a besoin), le reste
// (PHASES, targetsForDate, kcalFromMacros, tdeeNow...) arrive au jalon 6.

// Fenêtre d'objectif temporaire : les cibles macro basculent automatiquement dedans, et
// reviennent seules aux cibles de base une fois la date de fin passée. Lit `base.cut`, donc
// les dates comme les cibles sont modifiables depuis les Réglages sans rebuild.
export const isCutWindow = (d, base) => {
  const c = base?.cut;
  return !!c && c.enabled !== false && !!c.start && !!c.end && d >= c.start && d <= c.end;
};
