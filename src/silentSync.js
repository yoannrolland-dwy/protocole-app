import { Capacitor, registerPlugin } from "@capacitor/core";

// Bouton Sync du widget : l'app est alors lancée dans une activité invisible
// (SilentSyncActivity.kt, thème translucide, aucune UI visible) uniquement pour
// exécuter la synchro Health Connect déjà existante (runHealthSync). Ce module permet
// au JS de savoir qu'il tourne dans ce mode, et de signaler la fin pour que l'activité
// se referme (voir WidgetBridgePlugin.kt). No-op sur la PWA.

const WidgetBridge = registerPlugin("WidgetBridge");

export async function isSilentSync() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { silent } = await WidgetBridge.isSilentSync();
    return !!silent;
  } catch {
    return false;
  }
}

/** Arrête l'animation de la flèche sur le widget et referme l'activité invisible. */
export async function finishSilentSync() {
  if (!Capacitor.isNativePlatform()) return;
  try { await WidgetBridge.finishSilentSync(); } catch { /* ignore */ }
}
