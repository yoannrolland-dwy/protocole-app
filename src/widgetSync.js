import { Capacitor, registerPlugin } from "@capacitor/core";

// Widget d'écran d'accueil Android : les 6 tuiles du tableau de bord, en lecture seule,
// tap = ouvre l'app. Le widget (RemoteViews natif) ne peut pas lire le localStorage de la
// WebView — ce module pousse un instantané déjà mis en forme par le JS (mêmes valeurs que
// les tuiles du tableau de bord) dans les SharedPreferences natives à chaque changement
// pertinent ; voir DashboardWidgetProvider.kt / WidgetBridgePlugin.kt. No-op sur la PWA.

const WidgetBridge = registerPlugin("WidgetBridge");

/**
 * snapshot attendu : { poids, pas, calories, eau, sommeil, genou } — chacun
 * { value: string, note: string, alert?: boolean }.
 */
export async function updateDashboardWidget(snapshot) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update(snapshot);
  } catch (e) {
    console.log("widgetSync: " + (e?.message || e));
  }
}
