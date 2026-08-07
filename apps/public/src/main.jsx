import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";

// `registerType: "prompt"` (vite.config.js) exige un appel explicite à `registerSW` côté
// app — sans lui, un nouveau service worker déployé reste "waiting" indéfiniment et ne
// prend jamais la main tant que TOUS les onglets du site ne sont pas fermés (pas juste
// rechargés). Absent jusqu'ici côté apps/public — port du même mécanisme qu'apps/perso
// (main.jsx), sans la branche Capacitor/native qui n'a pas de sens ici (site web pur).
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nouvelle version de RawCare disponible. Recharger maintenant ?")) {
      updateSW(true);
    }
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
