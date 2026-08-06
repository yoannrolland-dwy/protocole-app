import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // @rawcare/core est un paquet du même workspace npm (symlink), pas une dépendance
  // externe : l'exclure du pré-bundling esbuild évite qu'une édition dans
  // packages/core/src reste invisible en HMR tant que le serveur n'est pas relancé.
  // Même raison que apps/perso/vite.config.js.
  optimizeDeps: { exclude: ["@rawcare/core"] },
  // Port dédié pour ne jamais entrer en conflit avec apps/perso (5173).
  server: { port: 5174 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "RawCare",
        short_name: "RawCare",
        description: "Carnet musculation, nutrition et récupération",
        lang: "fr",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
