// Cibles macro / fenêtre d'objectif temporaire / dépense énergétique adaptative. Extrait de
// src/App.jsx (apps/perso) le 05/08/2026, chantier RawCare Phase 0. `isCutWindow` est arrivé
// au jalon 5 (le recommandeur en avait besoin) ; le reste arrive au jalon 6. Pur, contenu
// inchangé.

import { today } from "./dateUtils.js";
import { resolveLog, totals, entriesFor } from "./nutrition/foodStore.js";
import { computeTDEE, mergeKcalSeries } from "./tdee.js";

// `cut` = fenêtre d'objectif temporaire (sèche avant vacances). Rangée DANS `targets`
// plutôt que dans une constante de module, pour deux raisons : elle devient éditable dans
// les Réglages (avant, changer une date imposait un rebuild), et elle voyage avec la prop
// `targets` déjà passée partout — aucune nouvelle prop à faire circuler.
// `enabled: false` la neutralise sans perdre les valeurs, pour la réactiver plus tard.
export const DEFAULT_TARGETS = {
  protein: 215, carbs: 205, fat: 80, fiber: 35, water: 2000, weightMaintenance: 96,
  cut: { enabled: true, start: "2026-07-27", end: "2026-08-18", protein: 220, carbs: 185, fat: 65, fiber: 35 },
};

export const PHASES = {
  seche:       { label: "Sèche",       target: 93, msg: "Déficit modéré. Protéines hautes (≥ 2,2 g/kg) pour préserver le muscle en descendant vers 93 kg." },
  maintenance: { label: "Maintenance", target: null, msg: "Équilibre calorique. Protéines hautes maintenues. Poids cible éditable." },
  prise:       { label: "Prise",       target: 95, msg: "Léger surplus (~+10 %). Protéines hautes. Gain propre vers 95 kg (plafond de phase)." },
};
export const phaseTarget = (phase, targets) =>
  PHASES[phase].target != null ? PHASES[phase].target : (targets.weightMaintenance ?? 96);

// Fenêtre d'objectif temporaire : les cibles macro basculent automatiquement dedans, et
// reviennent seules aux cibles de base une fois la date de fin passée. Lit `base.cut`, donc
// les dates comme les cibles sont modifiables depuis les Réglages sans rebuild.
export const isCutWindow = (d, base) => {
  const c = base?.cut;
  return !!c && c.enabled !== false && !!c.start && !!c.end && d >= c.start && d <= c.end;
};
// eau non concernée : la base + le bonus dynamique basket restent inchangés
export const targetsForDate = (d, base) => {
  if (!isCutWindow(d, base)) return base;
  const { protein, carbs, fat, fiber } = base.cut;
  return { ...base, protein, carbs, fat, fiber };
};

// Calories dérivées des macros (P/G/L en 4/4/9, fibres à 2 kcal/g — règlement UE 1169/2011,
// même coefficient que la table CIQUAL et la saisie libre de l'onglet Repas). Sert de repli
// pour une cible (jamais de kcal réelle) ou un jour sans détail per-aliment.
export const kcalFromMacros = (p, c, f, fib = 0) => (p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9 + (fib ?? 0) * 2;
// Calories réelles d'un jour de macroLog quand elles existent (bascule M6, jour alimenté par
// foodLog) — sinon repli sur l'estimation ci-dessus. Ne jamais recalculer en 4/4/9 un jour qui
// a déjà sa vraie valeur mesurée : Repas et Macros doivent toujours afficher le même chiffre.
export const kcalOfEntry = (m) => m?.kcal ?? kcalFromMacros(m?.protein, m?.carbs, m?.fat, m?.fiber);

/**
 * Dépense énergétique adaptative (V7) — calculée "maintenant", factorisée pour que l'écran
 * Macros et le Coach IA appellent EXACTEMENT le même calcul (jamais deux chiffres
 * différents pour la même réalité). `foodLog`/`overrides` doivent être lus fraîchement par
 * l'appelant (getSync), jamais mis en cache, pour ne jamais rater une correction ou un
 * repas ajouté entre deux appels — même principe que `buildPrompt`.
 */
export function tdeeNow({ foodLog, overrides, macros, weight, targets }) {
  const resolved = resolveLog(foodLog, overrides);
  const foodKcalByDate = {};
  for (const d of new Set(resolved.map((e) => e.date))) {
    // Un jour où AUCUNE entrée n'a de kcal connue reste absent (repli 4/4/9 le cas échéant)
    // plutôt que faussement compté à 0 — `totals()` sinon renverrait 0 pour une journée
    // entièrement inconnue, ce qui biaiserait la moyenne vers le bas.
    const t = totals(entriesFor(resolved, d));
    if (t.missing.kcal === 0) foodKcalByDate[d] = t.kcal;
  }
  const kcalByDate = mergeKcalSeries(foodKcalByDate, macros);
  const cutStart = targets.cut?.enabled !== false && targets.cut?.start ? targets.cut.start : null;
  return computeTDEE({ weightLog: weight, kcalByDate, today: today(), cutStart });
}
