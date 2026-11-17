# Structure des fichiers

Fiche de référence, sortie de CLAUDE.md le 16/11/2026.

### Structure des fichiers

**Monorepo npm workspaces depuis le chantier RawCare Phase 0 (05/08/2026, voir plus bas).**
La racine du dépôt ne contient plus que le manifeste de workspaces + la config partagée
(`CLAUDE.md`, `ROADMAP.md`) : l'app elle-même vit dans `apps/perso/`, et la logique métier pure
(moteur de séances, TDEE, nutrition, recommandeur, prompt Coach IA, Jeffrey) vit dans
`packages/core/`. Le monorepo vient de la version publique RawCare, arrêtée le 02/11/2026
(archive : `docs/archive/rawcare/`) ; il est gardé tel quel, le changer ne rapporterait rien.

```
protocole-app/                    (racine = workspaces npm uniquement)
  package.json                    { private:true, workspaces:["apps/*","packages/*"] }
  package-lock.json                (unique, couvre tout le monorepo)
  packages/
    core/                          # @rawcare/core — logique métier pure, zéro React/DOM
      package.json                 # exports en wildcard : "./*" → "./src/*.js"
      src/
        dateUtils.js               # today/localDateKey/shiftDateKey/lastN/daysBetween/fmtHM...
        training.js                # progression, records, détection de records
        tdee.js                    # dépense énergétique adaptative (V7)
        pain.js                    # PAIN_FRESH_DAYS + zoneState (genou/coude)
        recommender.js             # recommendSessions ("Prochaine séance")
        targets.js                 # PHASES, cibles macro, fenêtre de sèche, tdeeNow
        session/
          templates.js             # TEMPLATES, HSR_TABLE, PERI, BASKET_PROTOCOLS...
          perf.js                  # lastPerf/perfHistory/medianTarget (carnet muscu)
        coach/
          claudeApi.js             # appel API Anthropic/LiteLLM (PRICING, callClaude, streamClaude)
          prompt.js                # buildCoachPrompt/buildCoachBriefing, splitCarnet
          jeffrey.js, brief.js,    # Jeffrey : personnalité, outils, brief, flux, texte pour la
          stream.js, speechText.js #   voix (voir « Jeffrey, état actuel » en tête)
        nutrition/
          ciqual.js, off.js, scan.js, imageUtils.js
          foodStore.js             # fonctions pures (le hook useFoodLog reste dans l'app)
        data/ciqual.json           # table CIQUAL compactée (3178 aliments, 246 Ko)
      scripts/build-ciqual.mjs     # régénère data/ciqual.json (lancé à la main)
  apps/
    perso/                         # l'app perso (= tout ce qui existait avant Phase 0)
      index.html
      vite.config.js               # React + Tailwind v4 + PWA + optimizeDeps exclude core
      capacitor.config.json        # config app native (SystemBars insetsHandling: css)
      package.json                 # nom inchangé "protocole-pwa", dépend de @rawcare/core
      public/                      # icônes PWA + privacypolicy.html (Health Connect)
      src/
        main.jsx                   # point d'entrée + enregistrement service worker
        App.jsx                    # composant racine seul : état, synchro, navigation (U0)
        version.js                 # APP_VERSION (à bumper à chaque livraison)
        lib/helpers.js, lib/plan.js # utilitaires partagés, planning idéal / semaine de match
        lib/jeffrey*.js, brief.js, # Jeffrey : phrases fixes, tour de conversation, brief,
          voice*.js, ai.js...       #   notification, voix, fournisseur IA (voir en tête)
        components/                # composants partagés (SyncedBanner, TabBar, SubTabs,
                                    # SessionBar, JeffreyBubble, JeffreyOverlay...)
        screens/                   # un fichier par écran (U0, 25/10/2026) :
                                    # dashboard/ (Dashboard, JeffreyCard, PalierCard, WhyNot,
                                    # KneeQuickLog, InsightsCard), WeightTab, SleepTab,
                                    # StepsTab, PainTab, train/ (TrainTab, MuscuLogger,
                                    # ProgressScreen, GeneField, VolumeCard), perf/
                                    # (PerformanceTab, TdeeCard, JeffreyChat, ReferenceCards),
                                    # settings/ (SettingsPanel, BasketScheduleCard)
        briefPage.js (+ brief.html) # page sans écran du brief du matin (Jeffrey)
        store.js                   # persistance localStorage + export/import JSON
        healthSync.js              # synchro Health Connect (pas/sommeil/macros/eau)
        design/                    # design system v2 (U2) : tokens.js (source unique des
                                    # jetons) + theme.css (classes p-*, polices)
        ui.jsx                     # primitives v1 (jetons C) + ré-export de T/COLORS v2,
                                    # ré-exporte dateUtils depuis @rawcare/core
        claudeApi.js                # shim de ré-export vers @rawcare/core/coach/claudeApi
        nutrition/
          foodStore.js              # hook useFoodLog + ré-export du reste depuis core
          NutritionTab.jsx, FoodSearch.jsx, RestaurantMenu.jsx, PhotoDish.jsx,
          RecipesPanel.jsx, FoodsPanel.jsx
        index.css                  # @import "tailwindcss" + resets minimaux
      android/                     # projet natif Capacitor — commandes préfixées
                                    # apps/perso/, voir "Mise à jour de l'app native"
        app/src/main/java/com/yoannrolland/protocole/
          MainActivity.java
          HealthNutritionPlugin.kt # lecteur natif maison (macros complètes,
                                    # voir section Health Connect)
          HealthReads.kt            # nuit, pesée, FC repos (partagé avec le brief)
          JeffreyVoice.kt, JeffreyHttpPlugin.kt, JeffreyNotifReceiver.kt,
          Brief*.kt                 # Jeffrey : voix, relais HTTP, notification, brief
          RestTimerPlugin.kt, RestAlarmReceiver.kt  # minuteur de repos, réveil, voix
          DashboardWidgetProvider.kt, WidgetBridgePlugin.kt,
          WidgetStepsRefresher.kt   # widget d'écran d'accueil
          WatchBridge.kt            # montre : publie l'instantané, relit les pas (30 min)
        wear/                       # appli de la montre (Wear OS, Compose), lecture seule,
                                    # même identifiant et même clé que le téléphone
  docs/                            # maquettes (refonte-ihm), prompts et comptes rendus
                                    # (sauvegarde-oracle), archive RawCare (archive/rawcare)
```
