import { Capacitor } from "@capacitor/core";
import { exportData } from "./store.js";

// Sauvegarde locale automatique : un export JSON silencieux par jour, écrit dans le
// dossier "Documents" public du téléphone (survit à une réinstallation de l'app, visible
// depuis un gestionnaire de fichiers) — protège contre un bug qui corromprait le
// localStorage ou une suppression accidentelle dans l'app.
//
// Ne protège PAS contre la perte/casse du téléphone ni un "vider les données" de l'app
// (qui efface aussi ce dossier) : pour ça, l'export manuel vers Drive avant chaque MEP
// reste nécessaire, voir CLAUDE.md. No-op sur la PWA/navigateur.

const FOLDER = "Protocole";
const KEEP_DAYS = 30;
const today = () => new Date().toISOString().slice(0, 10);

/** Appelé au lancement et à chaque retour au premier plan ; no-op si déjà fait aujourd'hui. */
export async function runAutoBackup(lastDate, onDone) {
  if (!Capacitor.isNativePlatform()) return;
  const date = today();
  if (lastDate === date) return;

  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const json = JSON.stringify(exportData(), null, 2);
    await Filesystem.writeFile({
      path: `${FOLDER}/protocole-auto-${date}.json`,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    // Ménage : ne garde que les KEEP_DAYS derniers jours pour ne pas accumuler les fichiers.
    const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents });
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const m = f.name.match(/^protocole-auto-(\d{4}-\d{2}-\d{2})\.json$/);
      if (m && new Date(m[1]).getTime() < cutoff) {
        await Filesystem.deleteFile({ path: `${FOLDER}/${f.name}`, directory: Directory.Documents }).catch(() => {});
      }
    }

    onDone?.(date);
  } catch (e) {
    console.log("autoBackup: " + (e?.message || e));
  }
}
