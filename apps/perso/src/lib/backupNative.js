// Pont vers BackupPlugin.kt (sauvegarde sur le serveur Oracle, 02/11/2026) : requêtes HTTP par le
// client natif (pas de CORS, TLS vérifié) et activation des réveils de 14 h et 23 h. Hors de l'app
// native (aperçu navigateur), repli sur fetch : le serveur ne répond pas au CORS, l'envoi y échoue
// proprement (« serveur injoignable »).
import { Capacitor, registerPlugin } from "@capacitor/core";

const Backup = registerPlugin("Backup");
const native = () => Capacitor.isNativePlatform();

/** → { status, text } ; status -1 si le réseau a échoué. */
export async function backupRequest({ method, url, headers = {}, body }) {
  if (native()) return Backup.request({ method, url, headers, body: body ?? null });
  try {
    const r = await fetch(url, { method, headers, body });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: -1, text: String(e?.message || e) };
  }
}

/** Réveils de 14 h et 23 h : actifs seulement quand une clé est posée. */
export const setServerBackupAlarms = (on) =>
  (native() ? Backup.setEnabled({ enabled: on }).catch((e) => console.warn("sauvegarde", e)) : Promise.resolve());
