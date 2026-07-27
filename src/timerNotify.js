import { Capacitor } from "@capacitor/core";

// Alarme de fin de repos via notification locale Android.
//
// Pourquoi : dans une WebView, le décompte JS et le bip Web Audio ne sont pas garantis
// quand l'app passe en arrière-plan ou que l'écran se verrouille (le navigateur throttle
// les timers). Une notification locale programmée est portée par le système : elle sonne
// à l'heure dite même app fermée, et reste visible dans la barre de notification.
//
// No-op sur la PWA/navigateur, où seul le bip Web Audio existe.

const CHANNEL_ID = "muscu-timer";
const NOTIF_ID = 4201; // id fixe : une seule alarme de repos à la fois

let plugin = null;
let ready = false;

async function get() {
  if (!Capacitor.isNativePlatform()) return null;
  if (plugin) return plugin;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    plugin = LocalNotifications;
  } catch {
    return null;
  }
  return plugin;
}

async function ensureReady(LN) {
  if (ready) return true;
  try {
    let perm = await LN.checkPermissions();
    if (perm.display !== "granted") perm = await LN.requestPermissions();
    if (perm.display !== "granted") return false;
    // Canal dédié : importance max = bandeau + son, et son d'alarme plutôt que le
    // "ding" discret des notifications ordinaires (audible en salle de sport).
    await LN.createChannel({
      id: CHANNEL_ID,
      name: "Minuteur de repos",
      description: "Fin du temps de repos entre les séries",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "alarm.wav",
    });
    ready = true;
    return true;
  } catch {
    return false;
  }
}

/** Programme l'alarme de fin de repos dans `seconds` secondes. */
export async function scheduleRestAlarm(seconds) {
  const LN = await get();
  if (!LN || !(await ensureReady(LN))) return;
  try {
    await LN.cancel({ notifications: [{ id: NOTIF_ID }] });
    await LN.schedule({
      notifications: [{
        id: NOTIF_ID,
        channelId: CHANNEL_ID,
        title: "Repos terminé",
        body: "Série suivante.",
        schedule: {
          at: new Date(Date.now() + seconds * 1000),
          allowWhileIdle: true, // sonne même en mode Doze (écran verrouillé, téléphone posé)
        },
        smallIcon: "ic_launcher",
        ongoing: false,
        autoCancel: true,
      }],
    });
  } catch { /* l'app reste utilisable sans l'alarme système */ }
}

/** Annule l'alarme en attente (pause, remise à zéro, changement d'exercice, sortie du carnet). */
export async function cancelRestAlarm() {
  const LN = await get();
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: NOTIF_ID }] }); } catch { /* ignore */ }
}
