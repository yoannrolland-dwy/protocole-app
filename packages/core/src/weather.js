// Météo du brief du matin (chantier J, J4.2, 29/10/2026) : Open-Meteo (gratuit, sans clé). Pur et
// testé. Décision 7 (ROADMAP.md, chantier J) : la position est notée à l'ouverture de l'app,
// arrondie à ~1 km, jamais lue en arrière-plan ; elle ne part qu'à Open-Meteo, et Jeffrey ne reçoit
// que le résumé ci-dessous (jamais les coordonnées).

/** Arrondi à 0,01° (~1 km). */
export const roundCoord = (x) => Math.round(Number(x) * 100) / 100;

export function openMeteoUrl(lat, lon) {
  const p = new URLSearchParams({
    latitude: String(roundCoord(lat)), longitude: String(roundCoord(lon)),
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
    timezone: "auto", forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// Créneaux du brief : ceux où tombent les séances (salle tôt, basket midi ou soir) et la marche.
export const SLOTS = [
  { key: "matin", from: 6, to: 10 },
  { key: "midi", from: 11, to: 14 },
  { key: "apres_midi", from: 14, to: 18 },
  { key: "soir", from: 18, to: 22 },
];

// Codes WMO d'Open-Meteo → mot français. Le code le plus élevé d'un créneau est le plus marquant.
export function skyLabel(code) {
  if (code == null) return null;
  if (code === 0) return "dégagé";
  if (code <= 2) return "peu nuageux";
  if (code === 3) return "couvert";
  if (code <= 48) return "brouillard";
  if (code <= 57) return "bruine";
  if (code <= 67) return "pluie";
  if (code <= 77) return "neige";
  if (code <= 82) return "averses";
  if (code <= 86) return "averses de neige";
  return "orage";
}

/** Réponse Open-Meteo → { matin: { temp_min, temp_max, pluie_risque_max, pluie_mm, vent_max_kmh, ciel }, … }
 *  pour la date demandée ; un créneau sans heure lue est omis ; null si rien d'exploitable. */
export function summarizeWeather(json, dateKey) {
  const h = json?.hourly;
  if (!h?.time?.length) return null;
  const out = {};
  for (const s of SLOTS) {
    const idx = h.time.map((t, i) => [t, i]).filter(([t]) => {
      if (!t.startsWith(dateKey)) return false;
      const hour = Number(t.slice(11, 13));
      return hour >= s.from && hour < s.to;
    }).map(([, i]) => i);
    if (!idx.length) continue;
    const vals = (k) => idx.map((i) => h[k]?.[i]).filter((v) => v != null);
    const temp = vals("temperature_2m");
    const prob = vals("precipitation_probability");
    const mm = vals("precipitation");
    const wind = vals("wind_speed_10m");
    const codes = vals("weather_code");
    out[s.key] = {
      temp_min: temp.length ? Math.round(Math.min(...temp)) : null,
      temp_max: temp.length ? Math.round(Math.max(...temp)) : null,
      pluie_risque_max: prob.length ? Math.max(...prob) : null,
      pluie_mm: mm.length ? Math.round(mm.reduce((a, b) => a + b, 0) * 10) / 10 : null,
      vent_max_kmh: wind.length ? Math.round(Math.max(...wind)) : null,
      ciel: codes.length ? skyLabel(Math.max(...codes)) : null,
    };
  }
  return Object.keys(out).length ? out : null;
}
