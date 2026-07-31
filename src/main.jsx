import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App.jsx";
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
