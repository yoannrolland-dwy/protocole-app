import { Capacitor, registerPlugin } from "@capacitor/core";
import { voiceServer, speechPlan } from "./lib/voiceConfig.js";
import { speak } from "./lib/voice.js";

// Minuteur de repos : décompte visible dans la barre d'état + sonnerie de fin.
//
// Pourquoi du natif : dans une WebView, le décompte JS et le bip Web Audio ne sont pas
// garantis quand l'app passe en arrière-plan ou que l'écran se verrouille (les timers JS
// sont throttlés).
//
// La sonnerie de fin passe par un vrai réveil système (AlarmManager.setAlarmClock, voir
// RestTimerPlugin.kt / RestAlarmReceiver.kt), pas par une notification programmée : testé
// le 28/07/2026, une notification — même avec un son en AudioAttributes USAGE_ALARM — ne
// sonnait pas téléphone en mode silencieux. Un vrai réveil, si, exactement comme l'appli
// Horloge. @capacitor/local-notifications ne sert plus ici qu'à obtenir la permission
// d'affichage des notifications (POST_NOTIFICATIONS, Android 13+), pour le décompte et le
// message "Repos terminé" — plus à programmer la sonnerie elle-même.
//
// No-op sur la PWA/navigateur, où seul le bip Web Audio existe.

const RestTimer = registerPlugin("RestTimer");

// Annonce de Jeffrey après le bip (31/10/2026) : la phrase est préparée en audio dès le lancement
// du repos (serveur Oracle, gardée sur le téléphone), puis le réveil natif la joue juste après le
// bip, casque ou haut-parleur (choix de Yoann : toujours). Les réglages de la voix, clé comprise,
// partent dans les préférences privées de l'app (RestTimerPlugin), jamais dans l'intent du réveil.

// Attention : ne JAMAIS retourner un objet plugin Capacitor depuis une fonction async.
// L'`await` du côté appelant cherche une méthode `.then()` sur le proxy natif, qui lève
// « LocalNotifications.then() is not implemented on android ». D'où ce chargement qui
// ne renvoie rien et laisse les appelants lire la variable de module.
let LN = null;
let lnLoaded = false;

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

async function ensureNotificationPermission() {
  await loadLN();
  if (!LN) return false;
  let perm = await LN.checkPermissions();
  if (perm.display !== "granted") perm = await LN.requestPermissions();
  return perm.display === "granted";
}

/** Programme l'alarme de fin de repos et affiche le décompte. `seconds` = durée du repos. */
export async function scheduleRestAlarm(seconds, exercise = "", speech = "") {
  if (!Capacitor.isNativePlatform() || !(seconds > 0)) return;

  try {
    if (!(await ensureNotificationPermission())) return;

    const endsAt = Date.now() + seconds * 1000;
    const server = speech ? voiceServer() : null;
    const plan = server ? speechPlan(speech) : null;
    const voice = plan ? { ...server, ...plan } : null;
    await RestTimer.scheduleAlarm({ endsAt, exercise, ...(voice ? { voice } : {}) });
    if (voice) speak(speech, { play: false }).catch(() => {});
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
  try { await RestTimer.cancelAlarm(); } catch { /* ignore */ }
}
