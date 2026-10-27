import { Capacitor, registerPlugin } from "@capacitor/core";

// Widget d'écran d'accueil Android : 5 tuiles de données du tableau de bord (lecture
// seule, tap = ouvre l'app) + un bouton Sync. Le widget (RemoteViews natif) ne peut pas
// lire le localStorage de la WebView — ce module pousse un instantané déjà mis en forme
// par le JS dans les SharedPreferences natives à chaque changement pertinent ; voir
// DashboardWidgetProvider.kt / WidgetBridgePlugin.kt. No-op sur la PWA.

const WidgetBridge = registerPlugin("WidgetBridge");

/**
 * snapshot attendu : { poids, pas, calories, eau, energie, sync } — chacun
 * { value: string, note: string, color?: "#rrggbb", bar?: 0-100, barColor?: "#rrggbb" }.
 * color = couleur du chiffre (absente ou "" = blanc) ; bar/barColor = barre de progression
 * (pas, calories, eau seulement) ; energie porte labelColor = couleur du libellé après le score (« 88 Excellent »). "sync" n'affiche pas sa valeur (juste l'icône Sync),
 * seule sa note (horodatage de dernière synchro) est utilisée. "energie" (ex-"sommeil",
 * 05/09/2026) affiche le score d'énergie en valeur et la durée de sommeil réelle en note.
 */
/** Écran demandé par un tap sur une tuile du widget (clé de `goTo` : "weight", "macro"…), ou ""
 *  si l'app a été ouverte autrement. Lu une seule fois : l'extra est effacé côté natif. */
export async function consumeWidgetTab() {
  if (!Capacitor.isNativePlatform()) return "";
  try {
    const { tab } = await WidgetBridge.consumeOpenTab();
    return tab || "";
  } catch {
    return "";
  }
}

export async function updateDashboardWidget(snapshot) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update(snapshot);
  } catch (e) {
    console.log("widgetSync: " + (e?.message || e));
  }
}
