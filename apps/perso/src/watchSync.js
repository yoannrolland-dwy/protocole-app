import { Capacitor, registerPlugin } from "@capacitor/core";

// Montre (Galaxy Watch, 17/11/2026) : l'instantané déjà calculé par lib/watchSnapshot.js part au
// natif (WatchBridgePlugin.kt), qui le garde pour la relecture des pas toutes les 30 min et le
// publie sur la couche de données Wear OS, où l'appli de la montre le lit. Lecture seule de bout
// en bout : la montre ne renvoie rien. No-op hors de l'app Android.
const WatchBridge = registerPlugin("WatchBridge");

export async function updateWatch(snapshot) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WatchBridge.update({ json: JSON.stringify(snapshot) });
  } catch (e) {
    console.log("watchSync: " + (e?.message || e));
  }
}
