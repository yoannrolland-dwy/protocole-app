// Météo du brief du matin (chantier J, J4.2, 29/10/2026). Décision 7 (ROADMAP.md, chantier J) :
// la position est notée à l'ouverture de l'app seulement (premier plan, jamais en arrière-plan),
// approximative (permission ACCESS_COARSE_LOCATION seule) et arrondie à ~1 km ; le brief utilise la
// dernière connue. Elle ne part qu'à Open-Meteo ; Jeffrey ne reçoit que le résumé par créneau.
import { getSync, store } from "../store.js";
import { openMeteoUrl, summarizeWeather, roundCoord } from "@rawcare/core/weather";
import { today } from "@rawcare/core/dateUtils";

// Hors DATA_KEYS : propre au téléphone, jamais exportée dans une sauvegarde.
const KEY = "lastPosition";

/** À l'ouverture et au retour au premier plan. Refus ou échec : rien, le brief se fait sans météo. */
export function notePosition() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => store.set(KEY, { lat: roundCoord(p.coords.latitude), lon: roundCoord(p.coords.longitude), at: new Date().toISOString() }),
    () => {},
    { enableHighAccuracy: false, maximumAge: 3600000, timeout: 15000 },
  );
}

/** Résumé par créneau pour aujourd'hui, ou null (pas de position, réseau, réponse illisible). */
export async function fetchWeather({ timeoutMs = 6000 } = {}) {
  const pos = getSync(KEY, null);
  if (!pos) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(openMeteoUrl(pos.lat, pos.lon), { signal: ctl.signal });
    if (!res.ok) return null;
    return summarizeWeather(await res.json(), today());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
