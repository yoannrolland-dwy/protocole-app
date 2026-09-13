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

// Semaine ancrée sur le lundi, arithmétique locale pure (mêmes `new Date(y, m-1, d)` que
// `shiftDateKey`/`localDateKey`), jamais un aller-retour par un instant UTC. Un jour sans
// apport connu est ignoré plutôt que compté à 0 — la moyenne porte sur les jours réellement
// loggés (`days`), pour rester honnête sur une semaine partiellement saisie. Factorisé
// (13/09/2026) : `weeklyWeekdayKcalTrend` (lun-ven, historique) et `weeklyKcalTrend` (7 jours,
// voir plus bas) ne diffèrent que par le nombre de jours échantillonnés par semaine.
function weeklyKcalAverages(macros, { weeks = 8, endDate, sampleDays = 7 } = {}) {
  const end = endDate || today();
  const [ey, em, ed] = end.split("-").map(Number);
  const endObj = new Date(ey, em - 1, ed);
  const mondayOffset = (endObj.getDay() + 6) % 7; // lundi=0 ... dimanche=6
  const thisMonday = new Date(endObj);
  thisMonday.setDate(endObj.getDate() - mondayOffset);

  const kcalByDate = new Map(macros.map((m) => [m.date, kcalOfEntry(m)]));
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);
    let sum = 0, days = 0;
    for (let i = 0; i < sampleDays; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dateKey(d);
      if (kcalByDate.has(key)) { sum += kcalByDate.get(key); days++; }
    }
    out.push({ weekStart: dateKey(monday), avgKcal: days ? Math.round(sum / days) : null, days });
  }
  return out;
}

/**
 * Moyenne des calories du lundi au vendredi, semaine par semaine (onglet Performance,
 * chantier "révision Macro/Performance" du 01/09/2026). Week-ends exclus volontairement —
 * l'objectif était de suivre la semaine de travail sans que les cheat days du week-end ne la
 * lissent. **Gardée telle quelle pour `apps/public`** (même fonction, même comportement) —
 * `apps/perso` est passé à `weeklyKcalTrend` (7 jours) le 13/09/2026, voir plus bas : les
 * cheat meals de Yoann ne suivent pas un jour fixe, donc exclure spécifiquement le week-end
 * n'avait plus de sens pour lui personnellement.
 */
export function weeklyWeekdayKcalTrend(macros, opts = {}) {
  return weeklyKcalAverages(macros, { ...opts, sampleDays: 5 });
}

/**
 * Moyenne des calories sur les 7 jours de la semaine, semaine par semaine (13/09/2026,
 * `apps/perso` uniquement) : une vraie moyenne glissante absorbe un écart ponctuel quel que
 * soit le jour où il tombe, sans avoir à deviner quels jours exclure — contrairement à
 * `weeklyWeekdayKcalTrend`, pensée pour un profil avec des cheat days systématiquement le
 * week-end (pas le cas de Yoann).
 */
export function weeklyKcalTrend(macros, opts = {}) {
  return weeklyKcalAverages(macros, { ...opts, sampleDays: 7 });
}

/**
 * Dépense énergétique adaptative (V7) — calculée "maintenant", factorisée pour que l'écran
 * Macros et le Coach IA appellent EXACTEMENT le même calcul (jamais deux chiffres
 * différents pour la même réalité). `foodLog`/`overrides` doivent être lus fraîchement par
 * l'appelant (getSync), jamais mis en cache, pour ne jamais rater une correction ou un
 * repas ajouté entre deux appels — même principe que `buildPrompt`.
 */
/**
 * Kcal réelles par date, fusionnées avec le repli 4/4/9 (voir `mergeKcalSeries`) — extrait de
 * `tdeeNow` (13/09/2026) pour être réutilisé par `tdeeTrend` (onglet TDEE, historique semaine
 * par semaine) sans dupliquer la logique de résolution CIQUAL/OFF/corrections V6.
 *
 * `today`, si fourni, retire du résultat l'entrée de CETTE date (13/09/2026, demande
 * explicite) : une journée en cours n'a jamais un total de kcal complet (repas pas encore
 * pris), donc l'inclure fausserait toute moyenne vers le bas. `computeTDEE`/`meanKcal` sont
 * déjà tolérants aux jours absents (un jour non loggé ne compte simplement pas dans la
 * moyenne) — retirer `today` du résultat suffit, aucun mécanisme supplémentaire nécessaire.
 * Sans effet sur les points passés de `tdeeTrend` (leur fenêtre ne s'étend jamais jusqu'à
 * `today` réel), seul le point du jour même en bénéficie.
 */
export function buildKcalByDate({ foodLog, overrides, macros, today: todayKey }) {
  const resolved = resolveLog(foodLog, overrides);
  const foodKcalByDate = {};
  for (const d of new Set(resolved.map((e) => e.date))) {
    // Un jour où AUCUNE entrée n'a de kcal connue reste absent (repli 4/4/9 le cas échéant)
    // plutôt que faussement compté à 0 — `totals()` sinon renverrait 0 pour une journée
    // entièrement inconnue, ce qui biaiserait la moyenne vers le bas.
    const t = totals(entriesFor(resolved, d));
    if (t.missing.kcal === 0) foodKcalByDate[d] = t.kcal;
  }
  const merged = mergeKcalSeries(foodKcalByDate, macros);
  if (todayKey != null) delete merged[todayKey];
  return merged;
}

export function tdeeNow({ foodLog, overrides, macros, weight, targets }) {
  const t0 = today();
  const kcalByDate = buildKcalByDate({ foodLog, overrides, macros, today: t0 });
  const cutStart = targets.cut?.enabled !== false && targets.cut?.start ? targets.cut.start : null;
  return computeTDEE({ weightLog: weight, kcalByDate, today: t0, cutStart });
}
