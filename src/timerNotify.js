import { Capacitor, registerPlugin } from "@capacitor/core";

// Minuteur de repos : décompte visible dans la barre d'état + sonnerie de fin.
//
// Pourquoi du natif : dans une WebView, le décompte JS et le bip Web Audio ne sont pas
// garantis quand l'app passe en arrière-plan ou que l'écran se verrouille (les timers JS
// sont throttlés). Deux notifications système prennent le relais :
//   - une notification persistante avec chronomètre décroissant, animée par Android ;
//   - une notification programmée qui sonne à la fin, sur un canal en USAGE_ALARM
//     (volume alarme, pas volume notification) créé par RestTimerPlugin.kt.
//
// No-op sur la PWA/navigateur, où seul le bip Web Audio existe.

const RestTimer = registerPlugin("RestTimer");
const NOTIF_ID = 4201; // id fixe : une seule alarme de repos à la fois

// Attention : ne JAMAIS retourner un objet plugin Capacitor depuis une fonction async.
// L'`await` du côté appelant cherche une méthode `.then()` sur le proxy natif, qui lève
// « LocalNotifications.then() is not implemented on android ». D'où ce chargement qui
// ne renvoie rien et laisse les appelants lire la variable de module.
let LN = null;
let lnLoaded = false;
let alarmChannel = null;

async function loadLN() {
  if (lnLoaded) return;
  lnLoaded = true;
  try {
    const mod = await import("@capacitor/local-notifications");
    LN = mod.LocalNotifications;
  } catch {
    LN = null;
  }
}

/** Programme l'alarme de fin de repos et affiche le décompte. `seconds` = durée du repos. */
export async function scheduleRestAlarm(seconds, exercise = "") {
  if (!Capacitor.isNativePlatform() || !(seconds > 0)) return;
  await loadLN();
  if (!LN) return;

  try {
    let perm = await LN.checkPermissions();
    if (perm.display !== "granted") perm = await LN.requestPermissions();
    if (perm.display !== "granted") return;

    // Le canal doit exister avant la programmation : c'est lui qui porte le son d'alarme.
    if (!alarmChannel) {
      const res = await RestTimer.prepare();
      alarmChannel = res?.channelId;
    }

    const endsAt = Date.now() + seconds * 1000;

    await LN.cancel({ notifications: [{ id: NOTIF_ID }] });
    await LN.schedule({
      notifications: [{
        id: NOTIF_ID,
        channelId: alarmChannel,
        title: "Repos terminé",
        body: exercise ? `${exercise} — série suivante.` : "Série suivante.",
        schedule: {
          at: new Date(endsAt),
          allowWhileIdle: true, // sonne même en mode Doze (téléphone posé, écran éteint)
        },
        smallIcon: "ic_launcher",
        autoCancel: true,
      }],
    });

    await RestTimer.showCountdown({ endsAt, exercise });
  } catch (e) {
    console.log("timerNotify: " + (e?.message || e));
  }
}

/** Retire le décompte sans toucher à l'alarme (fin de repos atteinte app au premier plan). */
export async function hideRestCountdown() {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestTimer.hideCountdown(); } catch { /* ignore */ }
}

/** Annule l'alarme et retire le décompte (pause, remise à zéro, sortie du carnet). */
export async function cancelRestAlarm() {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestTimer.hideCountdown(); } catch { /* ignore */ }
  await loadLN();
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: NOTIF_ID }] }); } catch { /* ignore */ }
}
