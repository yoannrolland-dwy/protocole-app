// Sauvegarde automatique sur le serveur Oracle de Yoann (02/11/2026). Trois copies par jour : le
// matin juste après le brief (App.jsx), à 14 h et à 23 h (réveils natifs, Backup.kt → page sans
// écran, src/briefPage.js), plus « Sauvegarder maintenant » (Réglages). Le serveur garde les 21
// dernières copies et la dernière de chaque mois pendant un an (contrat fourni par la session
// Oracle : PUT/GET /v1/backup, /v1/backup/latest, /v1/backup/{id}, /v1/health).
//
// Les requêtes passent par le client HTTP natif (`request` injecté : plugin Backup dans l'app,
// pont de la page sans écran) : pas de CORS, TLS vérifié normalement. Ni la clé ni le contenu ne
// sont jamais écrits dans un journal.
//
// Clés : `backupUrl` (dans DATA_KEYS, vide = adresse par défaut) ; `backupKey` (clé dédiée,
// JAMAIS exportée, saisie par Yoann lui-même) ; `serverBackup` (marqueur { okAt, okId, slot,
// errorAt, error }, hors DATA_KEYS : restaurer une vieille copie ne doit pas faire croire qu'une
// sauvegarde vient d'avoir lieu, même règle que lastCloudBackup).
import { getSync, store, exportData } from "../store.js";
import { localDateKey } from "@rawcare/core/dateUtils";

export const BACKUP_DEFAULT_URL = "https://141.253.109.120/protocole-backup";

export const backupConfig = () => ({
  url: (getSync("backupUrl", "") || BACKUP_DEFAULT_URL).trim().replace(/\/+$/, ""),
  key: (getSync("backupKey", "") || "").trim(),
});
export const backupReady = () => !!backupConfig().key;
export const serverBackupState = () => getSync("serverBackup", null) || {};
const setState = (patch) => store.set("serverBackup", { ...serverBackupState(), ...patch });

const auth = (key) => ({ Authorization: `Bearer ${key}` });

/** Message lisible pour un code de réponse du serveur. */
export function backupError(status) {
  if (status === -1) return "serveur injoignable";
  if (status === 401) return "clé refusée";
  if (status === 413) return "copie trop grosse (20 Mo au plus)";
  if (status === 429) return "trop d'envois en une minute, réessayez plus tard";
  if (status === 400) return "copie refusée par le serveur";
  if (status === 503) return "stockage du serveur indisponible";
  return `erreur ${status}`;
}

/**
 * Envoie une copie. `slot` : "matin" | "14h" | "23h" | "manuel". → { ok, id?, error? }.
 * Jamais de reprise automatique : le serveur limite à six envois par minute, et un envoi coupé
 * par le réseau a pu être enregistré quand même (pas d'idempotence) ; le créneau suivant suffit.
 */
export async function sendBackup(slot, request, now = new Date()) {
  const { url, key } = backupConfig();
  if (!key) return { ok: false, skipped: true };
  const body = JSON.stringify(exportData());
  const r = await request({
    method: "PUT", url: `${url}/v1/backup`, body,
    headers: { ...auth(key), "Content-Type": "application/json", "X-Backup-Slot": slot },
  });
  if (r.status === 201) {
    let id = null;
    try { id = JSON.parse(r.text).id ?? null; } catch { /* réponse sans corps lisible */ }
    setState({ okAt: now.toISOString(), okId: id, slot, errorAt: null, error: null });
    return { ok: true, id };
  }
  const error = backupError(r.status);
  setState({ errorAt: now.toISOString(), error });
  return { ok: false, error };
}

/** Copies gardées par le serveur, la plus récente d'abord. */
export async function listBackups(request) {
  const { url, key } = backupConfig();
  const r = await request({ method: "GET", url: `${url}/v1/backup`, headers: auth(key) });
  if (r.status !== 200) throw new Error(backupError(r.status));
  const list = JSON.parse(r.text);
  if (!Array.isArray(list)) throw new Error("liste illisible");
  return list;
}

/** Une copie, vérifiée (même forme que l'export de l'app) avant toute restauration. */
export async function fetchBackup(id, request) {
  const { url, key } = backupConfig();
  const r = await request({ method: "GET", url: `${url}/v1/backup/${encodeURIComponent(id)}`, headers: auth(key) });
  if (r.status !== 200) throw new Error(backupError(r.status));
  const obj = JSON.parse(r.text);
  if (obj?.app !== "PROTOCOLE" || !obj.data || typeof obj.data !== "object") throw new Error("copie illisible");
  return obj;
}

/** Date (AAAA-MM-JJ, heure locale) de la dernière sauvegarde réussie sur le serveur, ou null. */
export function serverBackupDate() {
  const at = serverBackupState().okAt;
  return at ? localDateKey(new Date(at)) : null;
}

/** Dernière copie hors du téléphone, manuelle ou serveur : c'est elle qui pilote le bandeau et
 *  le rappel de 14 jours (une copie serveur du jour les fait taire). */
export function lastOffPhoneBackup(lastCloudBackup) {
  const server = serverBackupDate();
  if (!server) return lastCloudBackup || null;
  if (!lastCloudBackup) return server;
  return server > lastCloudBackup ? server : lastCloudBackup;
}
