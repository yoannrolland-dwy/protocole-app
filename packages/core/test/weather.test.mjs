// J4.2 — météo du brief : position arrondie à ~1 km, résumé par créneau, rien d'inventé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { roundCoord, openMeteoUrl, summarizeWeather, skyLabel } from "../src/weather.js";
import { jeffreyAsk } from "../src/coach/jeffrey.js";

const D = "2026-10-30";
const hours = Array.from({ length: 24 }, (_, i) => i);
const json = {
  hourly: {
    time: hours.map((i) => `${D}T${String(i).padStart(2, "0")}:00`),
    temperature_2m: hours.map((i) => 5 + i * 0.5),
    precipitation_probability: hours.map((i) => (i >= 12 && i < 14 ? 80 : 10)),
    precipitation: hours.map((i) => (i >= 12 && i < 14 ? 1.25 : 0)),
    weather_code: hours.map((i) => (i >= 12 && i < 14 ? 63 : 3)),
    wind_speed_10m: hours.map((i) => 10 + i),
  },
};

test("position : arrondie à 0,01° (~1 km), seule la position arrondie part à Open-Meteo", () => {
  assert.equal(roundCoord(48.856613), 48.86);
  assert.equal(roundCoord(2.352222), 2.35);
  const url = openMeteoUrl(48.856613, 2.352222);
  assert.match(url, /latitude=48\.86&longitude=2\.35/);
  assert.match(url, /forecast_days=1/);
  assert.doesNotMatch(url, /48\.8566/);
});

test("summarizeWeather : un résumé par créneau (min/max, risque et cumul de pluie, vent, ciel le plus marquant)", () => {
  const w = summarizeWeather(json, D);
  assert.deepEqual(Object.keys(w), ["matin", "midi", "apres_midi", "soir"]);
  assert.deepEqual(w.matin, { temp_min: 8, temp_max: 10, pluie_risque_max: 10, pluie_mm: 0, vent_max_kmh: 19, ciel: "couvert" });
  assert.deepEqual(w.midi, { temp_min: 11, temp_max: 12, pluie_risque_max: 80, pluie_mm: 2.5, vent_max_kmh: 23, ciel: "pluie" });
  assert.equal(summarizeWeather(json, "2026-10-31"), null);
  assert.equal(summarizeWeather({}, D), null);
  assert.equal(skyLabel(0), "dégagé");
  assert.equal(skyLabel(95), "orage");
});

test("brief : la météo n'est demandée que si elle est là", () => {
  const w = summarizeWeather(json, D);
  assert.match(jeffreyAsk("brief", { weather: w }).apiText, /Météo du jour par créneau : \{"matin"/);
  assert.doesNotMatch(jeffreyAsk("brief").apiText, /Météo du jour/);
});
