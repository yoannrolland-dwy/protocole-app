// Scan de code-barres (M3, 02/08/2026) — natif seulement.
//
// `BarcodeScanner.scan()` (Google Code Scanner), PAS `startScan()`. `startScan()`
// affiche la caméra en direct DERRIÈRE la WebView et exige de rendre le fond de l'app
// transparent pour la voir — incompatible avec le fond opaque du design system, et il
// faudrait déclarer la permission CAMERA. `scan()` ouvre l'interface native de Google
// Play Services par-dessus l'app (comme un intent), ne rend rien lui-même, et surtout
// **ne demande aucune permission caméra** : Google Play Services la gère en interne,
// documenté explicitement par le plugin. Vérifié le 02/08/2026 : la seule chose à faire
// est de sortir un `code`, aucune configuration Android supplémentaire.
//
// Formats volontairement restreints aux codes-barres produits (EAN-13/8, UPC-A/E) : ni
// QR code ni Code 128, qu'on ne croisera jamais sur un emballage alimentaire — restreindre
// accélère aussi la détection.

import { Capacitor } from "@capacitor/core";

let pluginPromise = null;
const loadPlugin = () => {
  if (!pluginPromise) pluginPromise = import("@capacitor-mlkit/barcode-scanning");
  return pluginPromise;
};

/**
 * Lance le scanner. Ne throw jamais : retourne toujours un statut exploitable par l'UI,
 * qui doit distinguer "annulé par l'utilisateur" (rien à afficher) d'une vraie panne.
 * @returns {Promise<{ code: string|null, status: "ok"|"cancelled"|"unsupported"|"error" }>}
 */
export async function scanBarcode() {
  if (!Capacitor.isNativePlatform()) return { code: null, status: "unsupported" };

  const { BarcodeScanner, BarcodeFormat } = await loadPlugin();

  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      // Premier scan sur cet appareil : le module Play Services (quelques Mo) doit être
      // téléchargé. installGoogleBarcodeScannerModule() ne fait que déclencher le
      // téléchargement — on relance scan() dans la foulée, qui affichera lui-même
      // l'écran d'installation natif si besoin plutôt que de rester bloqué en silence.
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
    });
    const code = barcodes[0]?.rawValue || barcodes[0]?.displayValue || null;
    return code ? { code, status: "ok" } : { code: null, status: "cancelled" };
  } catch (e) {
    // L'utilisateur qui ferme l'écran de scan sans rien scanner déclenche une erreur
    // côté plugin (pas de résultat) — pas une vraie panne, ne doit rien afficher.
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes("cancel")) return { code: null, status: "cancelled" };
    return { code: null, status: "error" };
  }
}
