import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";

// Mise à jour PWA : quand une nouvelle version est déployée, on propose de recharger.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nouvelle version de PROTOCOLE disponible. Recharger maintenant ?")) {
      updateSW(true);
    }
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
