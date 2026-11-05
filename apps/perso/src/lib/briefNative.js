// Pont vers BriefPlugin.kt (brief du matin, J4.1) : notification Jeffrey et réglage Activé /
// Désactivé. Plus aucun réveil depuis le 01/11/2026 (le brief part dans l'app quand le genou est
// noté) ; `cancelBriefAlarm` retire celui qu'une ancienne version aurait laissé. Sans effet hors de
// l'app native (aperçu navigateur, PWA).
import { Capacitor, registerPlugin } from "@capacitor/core";

const Brief = registerPlugin("Brief");
const native = () => Capacitor.isNativePlatform();
const quiet = (p) => p.catch((e) => console.warn("brief", e));

export const cancelBriefAlarm = () => (native() ? quiet(Brief.cancelAlarm()) : Promise.resolve());
export const cancelBriefNotification = () => (native() ? quiet(Brief.cancelNotification()) : Promise.resolve());
/** Notification de conversation de Jeffrey (brief écrit dans l'app, sans bruit) : `spec` vient de
 *  notificationSpec (lib/jeffreyNotify.js). */
export const postJeffreyNotification = (spec) => (native() ? quiet(Brief.post({ spec: JSON.stringify(spec) })) : Promise.resolve());
export const setBriefEnabled = (enabled) => (native() ? quiet(Brief.setEnabled({ enabled })) : Promise.resolve());
export async function briefEnabled() {
  if (!native()) return true;
  try { return (await Brief.isEnabled()).enabled !== false; } catch { return true; }
}

/**
 * Étape G2 (05/11/2026) : prévient l'appli JEFFREY que le brief du jour est prêt (diffusion
 * protégée par sa permission PROTOCOLE_SIGNAL). → true si le signal est parti ; false si JEFFREY
 * n'est pas installé, n'a pas encore le récepteur, ou si la permission n'est pas accordée (et
 * toujours hors app native). Quand il part, Kotlin programme aussi le contrôle de la minute
 * (BriefSignalCheckReceiver) : le brief de secours part même si l'app a été quittée.
 */
export async function signalJeffrey({ date, manque }) {
  if (!native()) return false;
  try { return (await Brief.signalJeffrey({ json: JSON.stringify({ date, manque }) })).sent === true; } catch (e) { console.warn("brief", e); return false; }
}
