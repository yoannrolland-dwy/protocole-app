import { Capacitor, registerPlugin } from "@capacitor/core";

// Widget d'écran d'accueil Android : 5 tuiles de données du tableau de bord (lecture
// seule, tap = ouvre l'app) + un bouton Sync. Le widget (RemoteViews natif) ne peut pas
// lire le localStorage de la WebView — ce module pousse un instantané déjà mis en forme
// par le JS dans les SharedPreferences natives à chaque changement pertinent ; voir
// DashboardWidgetProvider.kt / WidgetBridgePlugin.kt. No-op sur la PWA.

const WidgetBridge = registerPlugin("WidgetBridge");

/**
 * snapshot attendu : { poids, pas, calories, eau, sommeil } — chacun
 * { value: string, note: string }.
 */
export async function updateDashboardWidget(snapshot) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update(snapshot);
  } catch (e) {
    console.log("widgetSync: " + (e?.message || e));
  }
}
