// Utilitaires de date/format — extraits de src/ui.jsx (apps/perso) le 05/08/2026, chantier
// RawCare Phase 0. Purs (aucune dépendance React/DOM), donc partageables avec un futur
// apps/public. `ui.jsx` les ré-exporte pour que rien d'autre n'ait à changer d'import.

// Formate un objet Date en "YYYY-MM-DD" à partir de ses champs LOCAUX (année/mois/jour tels
// qu'affichés sur l'appareil) — jamais `.toISOString()`, qui bascule en UTC et décale la
// date de l'écart au fuseau local (+2h en France l'été) : entre minuit et 2h du matin, ça
// faisait passer "aujourd'hui" pour "hier" partout dans l'app, y compris le découpage des
// pas synchronisés depuis Health Connect. Corrigé le 03/08/2026, trouvé en creusant un écart
// entre le nombre de pas de Samsung Health et celui affiché par PROTOCOLE.
export const localDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => localDateKey(new Date());
// Décale une clé "YYYY-MM-DD" de `days` jours, en arithmétique LOCALE pure (construction via
// `new Date(y, m, d)`, jamais un aller-retour par un instant UTC qui redécalerait la date
// près de minuit selon le fuseau).
export const shiftDateKey = (key, days) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateKey(dt);
};
export const fmt = (d) => { const p = d.split("-"); return `${p[2]}/${p[1]}`; };
export const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
export const longDate = (d) => new Date(d + "T12:00:00")
  .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
export const byDate = (a, b) => a.date.localeCompare(b.date);
export const upsert = (arr, entry) => {
  const i = arr.findIndex((e) => e.date === entry.date);
  const next = [...arr];
  if (i >= 0) next[i] = { ...next[i], ...entry }; else next.push(entry);
  return next.sort(byDate);
};
