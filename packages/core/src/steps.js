/* ============================================================
   PAS — totaux par jour depuis les enregistrements Health Connect (25/10/2026)
   ============================================================ */

import { localDateKey } from "./dateUtils.js";

/**
 * Pas par date locale à partir des enregistrements bruts de Health Connect
 * (`[{ startDate, endDate, value, sourceId }]`, dates ISO UTC).
 *
 * Pourquoi pas l'agrégation du plugin (`queryAggregated`, bucket « day ») : elle découpe en tranches
 * fixes de 24 h et répartit chaque enregistrement au prorata de son chevauchement. Or Samsung Health
 * n'écrit qu'UN enregistrement par jour (total mis à jour en continu) dont les bornes ne suivent pas
 * forcément minuit local — constaté le 25/10/2026 (passage à l'heure d'hiver : l'enregistrement du
 * 24/10 était daté 01h→01h). Résultat : le total du jour était coupé entre deux tranches, la petite
 * (1/24) portant la même date et écrasant la grosse (« 335 pas » au lieu de 8 053), et la veille
 * perdait 1/24 de ses pas.
 *
 * Règle : chaque enregistrement est rattaché à la date locale de son MILIEU (un total journalier
 * tombe ainsi sur le bon jour quel que soit le décalage de ses bornes ; un enregistrement fin à
 * cheval sur minuit est assigné en bloc, erreur négligeable). Plusieurs sources (Samsung Health +
 * une autre app) sont gardées séparées puis on prend la plus haute par jour, pour ne jamais compter
 * deux fois les mêmes pas — Health Connect fait ce dédoublonnage dans son agrégation, pas dans la
 * lecture brute.
 *
 * @param keyOf Date → "AAAA-MM-JJ" (défaut : date LOCALE ; injectable pour les tests).
 */
export function stepsByLocalDay(records, { keyOf = localDateKey } = {}) {
  const bySource = {}; // date → { sourceId → pas }
  (records || []).forEach((r) => {
    const a = new Date(r.startDate).getTime();
    const b = new Date(r.endDate).getTime();
    const v = Number(r.value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(v) || v < 0) return;
    const key = keyOf(new Date(a + Math.max(0, b - a) / 2));
    const src = r.sourceId || "?";
    bySource[key] ||= {};
    bySource[key][src] = (bySource[key][src] || 0) + v;
  });
  const out = {};
  Object.entries(bySource).forEach(([key, srcs]) => { out[key] = Math.round(Math.max(...Object.values(srcs))); });
  return out;
}
