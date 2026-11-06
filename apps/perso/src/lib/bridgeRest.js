// Repos réglé par l'appli JEFFREY, par le pont (06/11/2026, choix de Yoann : « bip sans couper »).
// JEFFREY dit déjà les phrases : PROTOCOLE ne parle pas et ne prend pas la priorité audio, sinon
// JEFFREY perd le son et ferme sa conversation (constaté le 06/11/2026 à 17 h 56). À la fin du
// repos : le bip seul, mêlé au son en cours, et la vibration.

/** Repos lancé ou réglé par JEFFREY : marqué, pour que l'app ouverte le garde silencieux
 *  (+30 s, reprise après pause). */
export function markJeffreyRest(draft, action) {
  if (!draft?.rest || (action !== "noter_serie" && action !== "repos")) return draft;
  return { ...draft, rest: { ...draft.rest, source: "jeffrey" } };
}

/** Réveil de fin de repos (natif, par la page du pont) : programmé à `rest.endAt`, sans voix et
 *  silencieux, ou retiré. Hors app native : rien. */
export function nativeRest(rest) {
  const page = typeof window !== "undefined" ? window.JeffreyBridgePage : null;
  if (!page?.restAlarm) return;
  if (!rest?.endAt) { page.restAlarm(JSON.stringify({ endAt: null })); return; }
  page.restAlarm(JSON.stringify({ endAt: rest.endAt, label: rest.label || "", voice: null, quiet: true }));
}
