import { Capacitor } from "@capacitor/core";
import { today, shiftDateKey } from "./ui.jsx";

// Sauvegarde HORS du téléphone (étape V2, 03/08/2026).
//
// À ne pas confondre avec `autoBackup.js`, qui écrit un export quotidien dans
// Documents/Protocole : celle-là protège d'un bug qui corromprait le localStorage ou d'une
// suppression accidentelle dans l'app, mais PAS de la perte/casse du téléphone ni d'un
// « vider les données » (qui efface aussi ce dossier). Tout l'historique tient dans
// quelques Mo : il n'y a aucune raison d'accepter ce point unique de défaillance.
//
// Ce module ne fait pas la sauvegarde lui-même (c'est `doExport` dans App.jsx, qui
// réutilise la feuille de partage Android déjà en place) : il tient la date de la dernière
// sauvegarde externe et fabrique le rappel. C'est le RAPPEL VISIBLE, pas le bouton, qui
// fait que la sauvegarde a lieu.
//
// La date vit sous la clé `lastCloudBackup`, volontairement ABSENTE de `DATA_KEYS` :
// restaurer une vieille sauvegarde ne doit pas faire croire à l'app qu'elle vient d'être
// sauvegardée. Même raisonnement que `lastAutoBackupDate`, déjà hors de la liste.

/** Au-delà, l'app affiche un bandeau d'alerte (Réglages + Dashboard). */
export const STALE_DAYS = 14;
/** Délai après la dernière sauvegarde avant le premier rappel, puis période de répétition. */
export const REMIND_DAYS = 7;

// Identifiant fixe : reprogrammer écrase le rappel précédent au lieu d'en empiler un
// nouveau à chaque lancement de l'app.
const NOTIF_ID = 4242;

const daysBetweenKeys = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** Nombre de jours depuis la dernière sauvegarde externe, ou `null` si jamais faite. */
export function daysSinceBackup(lastDate) {
  if (!lastDate) return null;
  return daysBetweenKeys(lastDate, today());
}

/** Jamais sauvegardé, ou plus vieux que STALE_DAYS. */
export function isBackupStale(lastDate) {
  const d = daysSinceBackup(lastDate);
  return d == null || d > STALE_DAYS;
}

/**
 * (Re)programme le rappel : REMIND_DAYS après la dernière sauvegarde, puis toutes les
 * semaines tant qu'il est ignoré. Reprogrammé à chaque lancement et après chaque
 * sauvegarde, donc une sauvegarde fraîche repousse le rappel au lieu de le laisser sonner
 * pour rien — un rappel hebdomadaire fixe serait du bruit le lendemain d'un export.
 * No-op sur la PWA (pas de notification planifiée hors app).
 */
export async function scheduleBackupReminder(lastDate) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Import dynamique + lecture par variable locale : ne jamais retourner l'objet plugin
    // depuis une fonction async (voir la note dans timerNotify.js).
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;

    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});

    // Jamais sauvegardé : on ne fait pas semblant d'avoir une date de référence, le rappel
    // part de maintenant. Sinon il partirait de l'époque Unix et sonnerait immédiatement.
    const base = lastDate || today();
    const at = new Date(`${shiftDateKey(base, REMIND_DAYS)}T19:00:00`);
    // Échéance déjà passée (sauvegarde vieille de plus de REMIND_DAYS) : sonner à la
    // prochaine occurrence plutôt que jamais — une date passée serait ignorée par Android.
    while (at.getTime() < Date.now() + 60_000) at.setDate(at.getDate() + REMIND_DAYS);

    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID,
        title: "Sauvegarde PROTOCOLE",
        body: "Aucune sauvegarde hors du téléphone depuis une semaine. Réglages → Sauvegarder hors du téléphone.",
        schedule: { at, repeats: true, every: "week", allowWhileIdle: true },
      }],
    });
  } catch (e) {
    console.log("cloudBackup: " + (e?.message || e));
  }
}
