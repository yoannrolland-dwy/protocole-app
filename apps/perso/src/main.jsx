import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App.jsx";
import { isSilentSync } from "./silentSync.js";
import "./index.css";

if (Capacitor.isNativePlatform()) {
  // App native : les assets sont embarqués dans l'APK, le service worker n'apporte rien
  // et servait au contraire l'ancien code après un `adb install -r` tant qu'on n'avait pas
  // accepté la popup de rechargement (l'app semblait alors "ne plus se mettre à jour").
  // On le désenregistre et on vide ses caches pour que l'APK fasse toujours foi.
  navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
  caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k)));
} else {
  // PWA : quand une nouvelle version est déployée, on propose de recharger.
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm("Nouvelle version de Protocole disponible. Recharger maintenant ?")) {
        updateSW(true);
      }
    },
  });
}

// Bouton Sync du widget (SilentSyncActivity, voir DashboardWidgetProvider.kt) : l'app est
// lancée dans une activité au thème translucide, mais la WebView peint elle-même le fond
// noir de l'app par-dessus quoi qu'il arrive — la translucidité de la fenêtre Android ne
// suffit donc pas. En mode silencieux, on rend le fond transparent et App() ne restitue
// rien (voir le prop `silent`), tout en laissant tourner ses effets (synchro, widget).
isSilentSync().then((silent) => {
  if (silent) {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App silent={silent} />
    </React.StrictMode>
  );
});
