import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // @rawcare/core est un paquet du même workspace npm (symlink), pas une dépendance
  // externe : l'exclure du pré-bundling esbuild évite qu'une édition dans
  // packages/core/src reste invisible en HMR tant que le serveur n'est pas relancé.
  optimizeDeps: { exclude: ["@rawcare/core"] },
  // Deux pages : l'app, et la page sans écran du brief du matin (J4.1, chargée par BriefRunner.kt).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        brief: fileURLToPath(new URL("./brief.html", import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Protocole",
        short_name: "Protocole",
        description: "Console perso de suivi — muscu, sommeil, genou, macros",
        lang: "fr",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
