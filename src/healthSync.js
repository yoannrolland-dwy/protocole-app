import { Capacitor, registerPlugin } from "@capacitor/core";

// Synchro Health Connect (Android) — pas, sommeil, macros et eau sur 14 jours.
// N'a d'effet que dans l'app native (Capacitor) ; no-op sur la PWA/navigateur.
const SYNC_DAYS = 14;
const toKey = (d) => d.toISOString().slice(0, 10);
const round2 = (x) => Math.round(x * 100) / 100;

// Lecteur natif maison : le plugin @capgo n'expose que l'énergie du NutritionRecord,
// celui-ci récupère aussi protéines/glucides/lipides/fibres (voir HealthNutritionPlugin.kt).
const HealthNutrition = registerPlugin("HealthNutrition");

// Types demandés au plugin @capgo : il gère l'écran de consentement Health Connect.
// dietaryEnergyConsumed → READ_NUTRITION, dietaryWater → READ_HYDRATION, weight →
// READ_WEIGHT : ce sont exactement les permissions dont le lecteur natif a besoin, d'où
// un seul consentement. "weight" ajouté le 28/07/2026 : une pesée saisie à la main dans
// Samsung Health (pas MyFitnessPal, qui ne déclare pas WRITE_WEIGHT) apparaît bien dans
// Health Connect — voir HealthNutritionPlugin.readWeight().
const READ_TYPES = ["steps", "sleep", "dietaryEnergyConsumed", "dietaryWater", "weight"];

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
  const canNutrition = auth.readAuthorized?.includes("dietaryEnergyConsumed")
    && auth.readAuthorized?.includes("dietaryWater");
  const canWeight = auth.readAuthorized?.includes("weight");
  if (!canSteps && !canSleep && !canNutrition && !canWeight) return { status: "denied" };

  // Bornes alignées sur minuit UTC (même convention que today() dans App.jsx) pour que
  // les buckets "day" retournés par le plugin correspondent aux vraies dates calendaires,
  // et pas à des tranches de 24h ancrées sur l'heure actuelle.
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(todayUTC.getTime() - (SYNC_DAYS - 1) * 24 * 60 * 60 * 1000);
  const stepsByDate = {};
  const sleepByDate = {};
  const macrosByDate = {};
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

    if (canNutrition) {
      const { days } = await HealthNutrition.readNutrition({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      (days || []).forEach((d) => {
        // Un jour sans macro renseignée ne doit pas écraser une saisie manuelle par des zéros.
        if (!d.hasNutrition && !d.hasWater) return;
        macrosByDate[d.date] = {
          ...(d.hasNutrition ? {
            protein: Math.round(d.protein),
            carbs: Math.round(d.carbs),
            fat: Math.round(d.fat),
            fiber: Math.round(d.fiber),
          } : {}),
          ...(d.hasWater ? { water: Math.round(d.waterMl) } : {}),
        };
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

  return { status: "ok", stepsByDate, sleepByDate, macrosByDate, weightByDate };
}
