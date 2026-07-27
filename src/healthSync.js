import { Capacitor } from "@capacitor/core";

// Synchro Health Connect (Android) — pas + sommeil, 14 derniers jours.
// N'a d'effet que dans l'app native (Capacitor) ; no-op sur la PWA/navigateur.
const SYNC_DAYS = 14;
const toKey = (d) => d.toISOString().slice(0, 10);

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
    auth = await Health.checkAuthorization({ read: ["steps", "sleep"] });
    const missing = ["steps", "sleep"].filter((t) => !auth.readAuthorized?.includes(t));
    if (missing.length) auth = await Health.requestAuthorization({ read: ["steps", "sleep"] });
  } catch (e) {
    return { status: "error", message: String(e) };
  }

  const canSteps = auth.readAuthorized?.includes("steps");
  const canSleep = auth.readAuthorized?.includes("sleep");
  if (!canSteps && !canSleep) return { status: "denied" };

  // Bornes alignées sur minuit UTC (même convention que today() dans App.jsx) pour que
  // les buckets "day" retournés par le plugin correspondent aux vraies dates calendaires,
  // et pas à des tranches de 24h ancrées sur l'heure actuelle.
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(todayUTC.getTime() - (SYNC_DAYS - 1) * 24 * 60 * 60 * 1000);
  const stepsByDate = {};
  const sleepByDate = {};

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
      const { samples } = await Health.readSamples({
        dataType: "sleep",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      samples.forEach((s) => {
        const key = toKey(new Date(s.endDate || s.startDate));
        sleepByDate[key] = (sleepByDate[key] ?? 0) + (s.value ?? 0) / 60;
      });
    }
  } catch (e) {
    return { status: "error", message: String(e) };
  }

  return { status: "ok", stepsByDate, sleepByDate };
}
