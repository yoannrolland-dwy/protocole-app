// « Sauvegarder hors du téléphone » : écrit l'export complet (sans aucune clé secrète, voir
// `exportData`) puis ouvre le partage Android. Sorti de `SettingsPanel.doExport` tel quel
// (audit du 10/11/2026, lot 1, point 5) pour que l'écran de secours puisse s'en servir aussi.
// Résout quand une destination a été choisie ; rejette si le partage est annulé ou échoue.
import { Capacitor } from "@capacitor/core";
import { exportData } from "../store.js";
import { today } from "@rawcare/core/dateUtils";

export async function shareExport() {
  const json = JSON.stringify(exportData(), null, 2);
  const name = `protocole-${today()}.json`;
  // Le téléchargement via <a download> ne fonctionne pas dans la WebView native :
  // on écrit le fichier puis on ouvre le partage Android (Drive, mail, Fichiers…).
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    // `Share.share` ne résout QUE si une destination a été choisie (annuler la feuille
    // rejette la promesse) : c'est le seul signal disponible côté app pour dire que la
    // sauvegarde est partie. On ne peut évidemment pas vérifier qu'elle est bien
    // arrivée sur Drive — on date une intention aboutie, pas une réception.
    await Share.share({ title: name, files: [uri] });
    return { native: true };
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  // Sur la PWA le fichier atterrit dans les téléchargements de la machine qui affiche
  // l'app — donc hors du téléphone aussi, du point de vue du risque couvert.
  return { native: false };
}
