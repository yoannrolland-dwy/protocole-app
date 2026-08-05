import { Capacitor, registerPlugin } from "@capacitor/core";
import { localDateKey } from "./ui.jsx";

// Synchro Health Connect (Android) — pas, sommeil et poids sur 14 jours.
// N'a d'effet que dans l'app native (Capacitor) ; no-op sur la PWA/navigateur.
//
// BASCULE M6 (02/08/2026) : nutrition et hydratation NE SONT PLUS lues ici. `foodLog`
// (module Nutrition) est désormais l'unique écrivain de `macroLog`, eau comprise (saisie
// manuelle via les boutons +250/+500 ml, décision explicite de Yoann à la bascule — plus
// besoin que Health Connect fasse transiter la valeur écrite par MyFitnessPal). Les
// permissions READ_NUTRITION/READ_HYDRATION restent déclarées côté Android tant que M7
// (retrait des permissions) n'est pas fait — coupure de LECTURE seulement ici.
const SYNC_DAYS = 14;
// `d` est un objet Date : lire ses champs LOCAUX (pas `.toISOString()`, qui bascule en UTC
// et redécale la date — voir le commentaire plus bas sur les bornes de requête).
const toKey = (d) => localDateKey(d);
const round2 = (x) => Math.round(x * 100) / 100;

// Lecteur natif maison — ne sert plus qu'au sommeil et au poids depuis la bascule M6
// (voir HealthNutritionPlugin.kt : readNutrition() existe toujours côté Kotlin mais
// n'est plus appelé ici).
const HealthNutrition = registerPlugin("HealthNutrition");

// Types demandés au plugin @capgo : il gère l'écran de consentement Health Connect.
// weight → READ_WEIGHT, ajouté le 28/07/2026 : une pesée saisie à la main dans Samsung
// Health (pas MyFitnessPal, qui ne déclare pas WRITE_WEIGHT) apparaît bien dans Health
// Connect — voir HealthNutritionPlugin.readWeight().
const READ_TYPES = ["steps", "sleep", "weight"];

export async function syncHealthConnect() {
  if (!Capacitor.isNativePlatform()) return { status: "web" };

  let Health;
  try {
    ({ Health } = await import("@capgo/capacitor-health"));
  } catch {
    return { status: "error", message: "plugin indisponible" };
  }

  const avail = await Health.isAvailable();
  if (!avail.available) return { status: "unavailable", reason: avail.reason };

  let auth;
  try {
    auth = await Health.checkAuthorization({ read: READ_TYPES });
    const missing = READ_TYPES.filter((t) => !auth.readAuthorized?.includes(t));
    if (missing.length) auth = await Health.requestAuthorization({ read: READ_TYPES });
  } catch (e) {
    return { status: "error", message: String(e) };
  }

  const canSteps = auth.readAuthorized?.includes("steps");
  const canSleep = auth.readAuthorized?.includes("sleep");
  const canWeight = auth.readAuthorized?.includes("weight");
  if (!canSteps && !canSleep && !canWeight) return { status: "denied" };

  // Bornes alignées sur MINUIT LOCAL (corrigé le 03/08/2026 — c'était minuit UTC, soit 2h
  // du matin heure locale en France l'été : le plugin @capgo/capacitor-health traite le
  // bucket "day" comme une tranche fixe de 24h à partir de l'instant fourni (vérifié dans
  // son code source, HealthManager.kt), donc les pas faits entre minuit et l'heure du
  // décalage se retrouvaient comptés sur la VEILLE. `new Date(y, m, d)` construit un
  // instant en heure locale ; `setDate` (pas de l'arithmétique en millisecondes) gère
  // correctement les passages heure d'été/hiver.
  const now = new Date();
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(localMidnight); end.setDate(end.getDate() + 1);
  const start = new Date(localMidnight); start.setDate(start.getDate() - (SYNC_DAYS - 1));
  const stepsByDate = {};
  const sleepByDate = {};
  const weightByDate = {};

  try {
    if (canSteps) {
      const { samples } = await Health.queryAggregated({
        dataType: "steps",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        bucket: "day",
        aggregation: "sum",
      });
      samples.forEach((s) => {
        const key = toKey(new Date(s.startDate));
        stepsByDate[key] = Math.round(s.value ?? 0);
      });
    }

    if (canSleep) {
      // Lecteur natif plutôt que Health.readSamples("sleep") : ce dernier ne rapporte que la
      // période (coucher→réveil), jamais le détail par phase — donc jamais de durée réelle ni
      // de qualité calculable. Voir HealthNutritionPlugin.readSleep().
      const { days } = await HealthNutrition.readSleep({
        startDate: start.toISOString(), endDate: end.toISOString(),
      });
      Object.entries(days || {}).forEach(([date, d]) => {
        sleepByDate[date] = { hours: round2(d.hours), ...(d.quality != null ? { quality: d.quality } : {}) };
      });
    }

    if (canWeight) {
      const { days } = await HealthNutrition.readWeight({
        startDate: start.toISOString(), endDate: end.toISOString(),
      });
      Object.entries(days || {}).forEach(([date, kg]) => { weightByDate[date] = kg; });
    }
  } catch (e) {
    return { status: "error", message: String(e) };
  }

  return { status: "ok", stepsByDate, sleepByDate, weightByDate };
}
