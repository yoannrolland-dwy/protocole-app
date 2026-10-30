// Pont vers BriefPlugin.kt (brief du matin, J4.1) : réveils et notification Jeffrey. Sans effet
// hors de l'app native (aperçu navigateur, PWA) : le brief s'y écrit seulement dans l'app ouverte.
import { Capacitor, registerPlugin } from "@capacitor/core";

const Brief = registerPlugin("Brief");
const native = () => Capacitor.isNativePlatform();
const quiet = (p) => p.catch((e) => console.warn("brief", e));

export const scheduleBrief = (at) => (native() ? quiet(Brief.schedule({ at })) : Promise.resolve());
export const cancelBriefNotification = () => (native() ? quiet(Brief.cancelNotification()) : Promise.resolve());
/** Notification de conversation de Jeffrey (brief écrit dans l'app, sans bruit) : `spec` vient de
 *  notificationSpec (lib/jeffreyNotify.js). */
export const postJeffreyNotification = (spec) => (native() ? quiet(Brief.post({ spec: JSON.stringify(spec) })) : Promise.resolve());
export const setBriefEnabled = (enabled) => (native() ? quiet(Brief.setEnabled({ enabled })) : Promise.resolve());
export const testBrief = (seconds = 10) => (native() ? quiet(Brief.testIn({ seconds })) : Promise.resolve());
export async function briefEnabled() {
  if (!native()) return true;
  try { return (await Brief.isEnabled()).enabled !== false; } catch { return true; }
}
