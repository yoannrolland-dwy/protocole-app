# PROTOCOLE — Contexte projet (pour Claude Code)

Ce fichier est lu automatiquement à chaque session Claude Code. Il remplace
le besoin de recoller le contexte à chaque fois.

## Travaux planifiés → `ROADMAP.md`

Les chantiers **à venir** sont décrits dans `ROADMAP.md` à la racine du dépôt
(étapes V1 à V7 : douleurs coude/genou, sauvegarde externe, progression par
exercice, records, escalade/bloc, correction d'aliment, TDEE adaptatif). Ce
fichier-ci ne décrit que ce qui est **déjà livré**.

`ROADMAP.md` n'est PAS chargé automatiquement : quand Yoann dit « GO V1 » (ou
demande n'importe quelle étape V), **le lire d'abord**, puis suivre l'étape telle
qu'elle y est spécifiée. Il contient pour chaque étape les décisions déjà prises,
les pièges identifiés et les tests attendus — ne pas les rouvrir sans raison.
À la fin d'une étape : cocher son état dans le tableau de `ROADMAP.md`, et
documenter le livré ici, dans CLAUDE.md.

## Qui je suis (Yoann)

43 ans, athlète (musculation / basket / escalade), en phase de sèche.
Novice en développement — je suis les instructions étape par étape, je
n'écris pas de code moi-même. J'aime être challengé et qu'on me pose des
questions avant de coder si ma demande est ambiguë, plutôt qu'on suppose.

**Deux tendinopathies actives** (contraintes de correction, pas des détails
cosmétiques) :
- Tendon quadricipital : protocole HSR (Heavy Slow Resistance), tempo 6 s,
  amplitude 10-60°, règle de Silbernagel (douleur ≤ 3-5/10 acceptable
  seulement si retour à la douleur de base sous 24 h).
- Tendon distal du biceps : prises neutres/pronation privilégiées, prise
  supination limitée (chin-ups). L'escalade compte comme charge de tirage
  significative pour le coude.

**Deux traits physiologiques à ne jamais traiter comme des anomalies** (précisés
le 13-17/08/2026, après que l'app les ait signalés à tort) :
- **Short sleeper** : dormir moins de 6 h en moyenne est NORMAL pour moi, ce
  n'est pas un signal de fatigue ni de mauvaise récupération. Le seul signal
  fiable est le **score de qualité 1-4** (calculé depuis les phases de sommeil,
  voir plus bas), jamais la durée seule. Le recommandeur ET le Coach IA suivent
  cette règle — ne pas réintroduire de seuil sur les heures.
- **Athlète, pas pratiquant occasionnel** : ma normale va jusqu'à **2 séances
  par jour** (soit 4-6 sur 3 jours), et m'entraîner 5 jours d'affilée n'a rien
  d'un excès. Les seuils de "charge élevée" du recommandeur sont calibrés
  là-dessus (voir le chantier du 17/08/2026) — ne pas les rabaisser vers des
  valeurs de sportif lambda.

## Ce qu'est l'app

**PROTOCOLE** : app personnelle de suivi sport/nutrition/récupération. Un
seul utilisateur (moi), pas de compte, pas de backend — toutes les données
vivent dans le `localStorage`, sur mon téléphone (Samsung S25).

**Deux cibles de build depuis le même code** (chantier Capacitor terminé,
voir plus bas) :
- **PWA** : déployée sur Netlify, ouverte au navigateur ou épinglée à
  l'écran d'accueil. Déploiement continu via `git push`. Aucune donnée de
  santé synchronisée (saisie 100% manuelle).
- **App Android native** (dossier `android/`, appId
  `com.yoannrolland.protocole`) : installée à la main sur le téléphone via
  USB/adb (pas de store, pas de mise à jour automatique). C'est la seule
  des deux à avoir accès à Health Connect (pas, sommeil, macros, eau
  automatiques — voir section dédiée plus bas). Les deux icônes coexistent
  sur le téléphone ; c'est la version native qu'il faut utiliser pour
  profiter de la synchro.

### Stack technique (versions figées au dernier build réussi — ne pas
changer sans raison explicite, et surtout ne pas "corriger" vers des
versions plus anciennes que Claude connaîtrait mieux par défaut) :
- React 19.2.7
- Vite 8.1.5
- Tailwind CSS v4.3.3 (via `@tailwindcss/vite`, PAS de `tailwind.config.js`,
  juste `@import "tailwindcss";` dans `index.css`)
- recharts 3.10.0 (graphiques)
- lucide-react 1.25.0 (icônes)
- vite-plugin-pwa 1.3.0 (manifeste + service worker)
- @capacitor/core, @capacitor/android, @capacitor/app 8.4.x/8.1.x (app native)
- @capgo/capacitor-health 8.10.0 (lecture Health Connect : pas, sommeil,
  énergie, hydratation — PAS le détail des macros, voir plus bas)
- @capacitor-mlkit/barcode-scanning 8.1.0 (scan code-barres, module Nutrition M3,
  natif seulement)

### Structure des fichiers

**Monorepo npm workspaces depuis le chantier RawCare Phase 0 (05/08/2026, voir plus bas).**
La racine du dépôt ne contient plus que le manifeste de workspaces + la config partagée
(`netlify.toml`, `CLAUDE.md`, `ROADMAP.md`) : l'app elle-même vit dans `apps/perso/`, et la
logique métier pure (moteur de séances, TDEE, nutrition, escalade, recommandeur, prompt
Coach IA) vit dans `packages/core/`, réutilisable par une future `apps/public`.

```
protocole-app/                    (racine = workspaces npm uniquement)
  package.json                    { private:true, workspaces:["apps/*","packages/*"] }
  package-lock.json                (unique, couvre tout le monorepo)
  netlify.toml                     # cible apps/perso via --workspace, pas de `base`
  packages/
    core/                          # @rawcare/core — logique métier pure, zéro React/DOM
      package.json                 # exports en wildcard : "./*" → "./src/*.js"
      src/
        dateUtils.js               # today/localDateKey/shiftDateKey/lastN/daysBetween/fmtHM...
        training.js                # progression, records, détection de records
        tdee.js                    # dépense énergétique adaptative (V7)
        climbing.js                # cotation/résumé des séances d'escalade
        pain.js                    # PAIN_FRESH_DAYS + zoneState (genou/coude)
        recommender.js             # recommendSessions ("Prochaine séance")
        targets.js                 # PHASES, cibles macro, fenêtre de sèche, tdeeNow
        session/
          templates.js             # TEMPLATES, HSR_TABLE, PERI, BASKET_PROTOCOLS...
          perf.js                  # lastPerf/perfHistory/medianTarget (carnet muscu)
        coach/
          claudeApi.js             # appel API Anthropic (PRICING, callClaude)
          prompt.js                # buildCoachPrompt/buildCoachBriefing, splitCarnet
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
        App.jsx                    # composants React + assemblage (importe @rawcare/core)
        store.js                   # persistance localStorage + export/import JSON
        healthSync.js              # synchro Health Connect (pas/sommeil/macros/eau)
        ui.jsx                     # design system "Affirmée" (jetons C + primitives),
                                    # ré-exporte dateUtils depuis @rawcare/core
        claudeApi.js                # shim de ré-export vers @rawcare/core/coach/claudeApi
        nutrition/
          foodStore.js              # hook useFoodLog + ré-export du reste depuis core
          NutritionTab.jsx, FoodSearch.jsx, RestaurantMenu.jsx, PhotoDish.jsx
        index.css                  # @import "tailwindcss" + resets minimaux
      android/                     # projet natif Capacitor — commandes préfixées
                                    # apps/perso/, voir "Mise à jour de l'app native"
        app/src/main/java/com/yoannrolland/protocole/
          MainActivity.java
          HealthNutritionPlugin.kt # lecteur natif maison (macros complètes,
                                    # voir section Health Connect)
    public/                        # apps/public — coquille inerte (Phase 2 la remplira)
      package.json                 # name "@rawcare/public", dépend de @rawcare/core
```

### Design system — "Affirmée" (à respecter strictement pour toute nouvelle UI)
- Fond : `#050505` · Cartes : `#121212`, bordure `#2a2a2a`
- Accent : citron vert `#d7ff3f` (jamais d'autre couleur d'accent)
- Texte : `#f5f5f0` (principal), `#8a8a84` (secondaire), `#6b6b66` (muted),
  `#4a4a46` (dim)
- Danger : `#ff3b30`
- Typographie : `ui-monospace, Menlo, Monaco, monospace` pour TOUS les
  chiffres/valeurs ; labels en majuscules, petite taille, `letter-spacing`
  large
- Boutons : coins arrondis ~8-10px, `primary` = fond accent/texte noir,
  `outline` = bordure accent/texte accent, `plain` = gris
- Tout le styling est en `style={{}}` inline (objet `C` de tokens en haut du
  fichier), pas de classes Tailwind dans les composants (Tailwind sert
  seulement au reset CSS global)

## Fonctionnalités en place (ne pas régresser sans le signaler)

- **8 onglets** : Tableau de bord, Poids, Énergie (ex-Sommeil, 05/09/2026 — sommeil +
  score d'énergie), Pas, Séances, Douleurs (genou seul depuis le 05/09/2026, coude
  retiré), Performance (ex-Macros), Macro (ex-Repas, module Nutrition interne — voir la
  section dédiée plus bas)
- **Carnet de musculation série par série** (`MuscuLogger`) : grille
  kg × reps (ou secondes pour les exos en mode "temps"), mémoire de la
  dernière perf **par série** (pas juste par exercice — si la 3e série était
  à 6 reps parce que fatigué, la fois suivante la 3e série repropose 6),
  reps pré-remplies au **médian** de la fourchette cible (8-12 → 10),
  poids par défaut par exercice tant qu'il n'y a pas d'historique (table
  `DEFAULT_WEIGHTS`, en kg, haltères = valeur par haltère unique, machines =
  valeur lue sur la pile).
- **Templates** (table `TEMPLATES`) : Upper A/B, Lower A/B, Basket,
  Escalade. Chaque exercice muscu a un finisher core en dernier (planche
  jours A, crunch machine jours B). Table HSR (`HSR_TABLE`) pilote les
  séries/reps de la presse à cuisses et du leg extension en Lower A selon
  un réglage "semaine HSR" (1 à 12).
- **Modification d'une séance déjà enregistrée** : toute ligne de
  "Dernières séances" (onglet Séances) est cliquable et rouvre le carnet
  pré-rempli avec les vraies valeurs sauvegardées (pas des suggestions),
  bouton "Enregistrer les modifications" à la place de "Valider la
  séance". Sauvegarder met à jour l'entrée existante dans `trainingLog`
  (comparaison par référence d'objet, comme la suppression) au lieu d'en
  ajouter une nouvelle — corrige l'absence totale d'édition qui obligeait
  à supprimer puis resaisir, avec risque de doublon en cas d'oubli.
  Chaque séance (muscu et non-muscu) porte désormais un `id` stable.
- **Minuteur** dans le carnet : se lance automatiquement au temps de repos
  de l'exercice dès qu'on coche une série, repos réglable en plus (chips
  2:00/1:30/1:00/0:45/0:30 — PAS de 2:30, retiré volontairement pour tenir
  sur une ligne), pastille flottante visible **seulement pendant le
  décompte** (jamais épinglée en permanence — ça gênait le scroll, corrigé
  exprès). **Sur l'app native**, la fin de repos sonne via un vrai réveil
  système (`AlarmManager.setAlarmClock()`, `RestTimerPlugin.kt` +
  `RestAlarmReceiver.kt`), pas une notification programmée — testé le
  28/07/2026 : une notification, même avec un canal en AudioAttributes
  USAGE_ALARM, ne sonnait pas téléphone en mode silencieux (le cas
  permanent de l'utilisateur), alors qu'un vrai réveil traverse le
  silencieux de façon fiable. Le son (3,2 s, alarm.wav) est joué par
  `MediaPlayer` directement sur le flux ALARME dans le `BroadcastReceiver`,
  indépendamment de tout pipeline de notification — vérifié sur appareil,
  volume alarme non coupé même icône silencieux affichée. Une notification
  persistante à chronomètre décroissant affiche le décompte dans la barre
  d'état pendant le repos, remplacée à la fin par "Repos terminé". Sur la
  PWA (pas d'AlarmManager), c'est le bip Web Audio (3 impulsions) qui reste
  la seule alarme. **Routage casque** (29/07/2026, `RestAlarmReceiver.kt`) :
  si un casque filaire ou Bluetooth est connecté au moment où l'alarme
  sonne, le son y est envoyé exclusivement plutôt que sur le haut-parleur —
  demandé explicitement pour ne plus gêner toute la salle de sport. Détecte
  aussi les casques filaires en USB-C (`TYPE_USB_HEADSET`/`TYPE_USB_DEVICE`)
  — ce téléphone n'a pas de prise jack, donc `TYPE_WIRED_HEADSET` seul ne
  suffit jamais. **Piège identifié sur appareil** : rester sur le flux
  ALARME avec `setPreferredDevice()` ne fonctionne PAS — logs
  `APM_AudioPolicyManager` à l'appui, Android force ce flux à sonner
  **simultanément** sur le haut-parleur ET l'appareil connecté (politique
  de sécurité native pour les alarmes, qu'aucun `setPreferredDevice()` ne
  peut outrepasser). Le contournement retenu : quand un casque est détecté,
  le son bascule sur un flux média classique (`USAGE_MEDIA` /
  `CONTENT_TYPE_MUSIC`) qui, lui, respecte le device préféré et n'est routé
  que vers lui — reconfirmé par les logs (un seul device sélectionné, plus
  de doublon haut-parleur), et validé à l'oreille par l'utilisateur en
  Bluetooth. Le mode silencieux ne coupe pas ce flux média (vérifié : ni
  STREAM_MUSIC ni STREAM_ALARM ne figurent parmi les flux mis en sourdine
  par le mode sonnerie), donc le contournement du silencieux reste garanti
  même sans passer par le flux ALARME dans ce cas précis. Limites
  assumées : détecte un casque *connecté*, pas *porté* — posé sur un banc,
  l'alarme resterait silencieuse pour la pièce, compromis accepté ; et si
  le volume média est baissé à zéro indépendamment du volume alarme, ce cas
  précis serait silencieux. Vibration
  passée en amplitude explicite maximale (255/255) sur chaque impulsion.
- **Douleurs (genou + coude)** — onglet unique depuis V1 (03/08/2026), voir la
  section dédiée plus bas. Log douleur 0-10 **sans aucune valeur par défaut**
  (ni 4 ni 5 — changé le 30/07/2026) : rien n'est présélectionné à l'ouverture
  et le bouton Enregistrer reste désactivé tant qu'un chiffre n'a pas été
  touché, pour forcer une vraie évaluation de la sensation plutôt qu'un
  enregistrement réflexe. Si le jour affiché a déjà une entrée, elle est
  rechargée (à l'ouverture de l'onglet, au changement de date **et au changement
  de zone**) ; passer sur une combinaison zone/jour sans entrée remet le champ à
  vide. + règle de Silbernagel (retour à la base sous 24h) sur les deux zones,
  table HSR (attachée au genou seul). Les deux routines guidées qui vivaient ici (rééduc
  autonome, échauffement basket sécurisé) ont déménagé dans l'onglet Séances le 04/09/2026 —
  voir la tuile "Basket" (échauffement en carnet, progressif) et "Mobilité" (choix
  d'exercices, genou/coude inclus) dans le chantier dédié plus bas.
- **Recommandeur "Prochaine séance"** (`recommendSessions`) : analyse tout
  l'historique des séances et des douleurs (pas de jours fixes — je n'ai
  plus de rythme figé). Retourne `{ suggestions, avoid }` : 3 suggestions
  classées par score + une liste "à éviter aujourd'hui" avec raison
  chiffrée (ex. genou hors base → Lower et Basket écartés ; coude hors base →
  Upper et Escalade écartés, depuis V1 ; Upper déjà fait
  aujourd'hui → Escalade déconseillée car volume de tirage sur le coude).
  Testé sur plusieurs scénarios (genou hors base, empilement Lower+Basket,
  zone déjà travaillée le jour même) — logique validée, ne pas simplifier
  sans retester ces cas.
  **Étape 4 (30/07/2026)** : trois ajouts. (1) Nudges souples sommeil/charge
  — une mauvaise nuit et/ou une charge courte élevée retirent des points à
  Upper/Lower/Basket/Escalade (jamais à Repos, qui en profite au contraire) ;
  silencieux si la donnée est absente, pour ne pas punir une simple absence de
  saisie comme le fait le genou. **Seuils révisés le 13-17/08/2026, voir le
  chantier dédié plus bas** : le sommeil ne compte QUE par sa qualité (≤2/4),
  jamais par la durée (short sleeper) ; la charge courte est passée de 3 à
  **7 séances sur 3 jours** (la normale de Yoann monte à 2 séances/jour).
  (2) Fenêtre de sèche (`isCutWindow`) : pénalise
  Basket (−10) et Escalade (−8) — les deux options à impact/tirage visées
  par la règle "pas de volume à impact en plus de l'habituel" du profil
  permanent — et bonifie Repos (+4), sans jamais les interdire (ils restent
  dans la rotation normale, juste moins poussés). (3) Score affiché dans la
  carte "Prochaine séance" (petit badge monospace à côté de chaque type),
  pour rendre le classement auditable au lieu d'une boîte noire. Le
  recommandeur prend désormais `sleep` et `targets` en plus de `training`/
  `knee`.
- **Couplage recommandeur ↔ Coach IA** (étape 4, 30/07/2026) : `buildPrompt`
  recalcule `recommendSessions` avec les mêmes données et injecte son
  verdict (`summary.recommandeur` : top + score + motif, alternatives,
  à éviter) dans le prompt. Consigne explicite au modèle : commenter/
  valider CE verdict plutôt que d'en proposer un autre de son côté, sauf
  désaccord argumenté à signaler explicitement. Avant ce couplage, la carte
  dashboard et l'analyse IA pouvaient recommander deux séances différentes
  sans que rien ne le signale.
- **Macros** : protéines/glucides/lipides/fibres, cibles par défaut
  **215/205/80/35 g** (fibres passées de 30 à 35 g le 03/08/2026, base ET
  fenêtre de sèche en cours) (~2400 kcal), graphique 14 jours en **calories** (pas
  protéines — changé exprès). Une bascule temporaire par date existe
  (`targetsForDate` dans `App.jsx`) pour des périodes ponctuelles (ex.
  sèche intensive avant vacances) — revient automatiquement aux cibles par
  défaut après la période, ne pas la confondre avec un changement
  permanent. Eau en boutons rapides (+250/+500 ml, PAS de saisie manuelle
  pour l'eau — décision explicite). Cible eau de base **2000 mL** (baissée
  de 3000 le 02/08/2026 — alimentation riche en légumes qui couvre déjà une
  bonne partie des besoins hydriques), éditable dans Réglages → "Cible eau
  de base" (`DEFAULT_TARGETS.water` dans `App.jsx`, champ ajouté en même
  temps pour que la valeur reste corrigeable sans rebuild — avant ça,
  aucun écran ne permettait d'éditer une cible de base, seulement la
  fenêtre d'objectif temporaire). Cible eau **+1 L automatique les jours
  où une séance Basket est loggée** (je transpire beaucoup au basket),
  logique inchangée, s'applique par-dessus la nouvelle base sans code
  modifié à ses 4 points de lecture (dashboard, onglet Macros, widget,
  Coach IA).
  **Sur l'app native**, macros et eau du jour sont écrasées par la synchro
  Health Connect si elle a des données ce jour-là (voir section dédiée) —
  les boutons rapides restent utiles pour corriger/compléter entre deux
  synchros.
- **Pas** : onglet dédié (historique, saisie manuelle, graphique 21 jours)
  + tuile sur le tableau de bord. Cible 10 000 pas/jour. Sur l'app native,
  rempli automatiquement par Health Connect.
- **Fiche péri-training** (`PERI` + `BASKET_PROTOCOLS`) : whey seule
  (30 g) avant une séance de muscu ≤ 1h (plus de glucides rapides avant —
  le glycogène de la veille suffit) ; 25-30 g de glucides gardés entre
  muscu et escalade quand enchaînées. Trois protocoles basket détaillés
  avant/pendant/après selon l'horaire (21h, 12h, match dimanche 10h30 — ce
  dernier est un protocole validé, ne pas modifier ses chiffres sans
  demande explicite).
- **Sommeil** : saisie en **heures + minutes** (pas décimal), stockage
  interne toujours en heures décimales. Moyenne 7 jours en **vraie fenêtre
  glissante** (les entrées des 7 derniers jours calendaires, pas juste les
  7 dernières nuits saisies — bug corrigé, ne pas régresser).
- **Phase** (Sèche/Maintenance/Prise) pilote le poids cible partout. **Depuis le
  13/08/2026** : la carte Phase vit dans les **Réglages** (plus sur le Dashboard),
  et les **trois** poids cibles y sont éditables — `PHASES` (`packages/core`)
  garde 93/95 comme valeurs de DÉPART seulement, la surcouche
  `targets.weightCutTarget`/`weightBulkTarget` (côté app) prend le dessus dès
  qu'on édite. Voir le chantier dédié plus bas.
- **Dates + suppression** sur les 6 onglets de saisie (Poids, Sommeil, Pas,
  Séances, Genou, Macros) — sélecteur de date avec pré-remplissage si la
  date a déjà une entrée, bouton Supprimer conditionnel.
- **Réglages (⚙)** : sauvegarde/restauration JSON (Réglages → Sauvegarder hors
  du téléphone / Restaurer un fichier),
  champ clé API Anthropic + modèle pour le Coach IA, **profil permanent du
  coach**, **carnet de bord** (lisible/corrigeable/videable) et **fenêtre
  d'objectif temporaire** (dates + cibles macros) — les trois ajoutés le
  30/07/2026.
- **Profil permanent du coach** (clé `coachProfile`) : texte libre envoyé dans
  le `system` à chaque analyse, présenté au modèle comme une contrainte. Amorcé
  une seule fois (`SEED_COACH_PROFILE`) avec les règles de coaching qui étaient
  codées en dur jusqu'au 30/07/2026 (projection réaliste de la sèche, quand
  lire la balance, interdiction d'ajouter du volume à impact, placement de
  l'escalade). C'est là que vit l'objectif en cours : **après les vacances,
  Yoann le remplace lui-même, sans rebuild**. `null` en stockage = jamais
  amorcé ; une chaîne vide est un choix délibéré et n'est jamais réamorcée.
- **Carnet de bord du coach** (clé `coachJournal`) : la mémoire entre analyses.
  Le modèle écrit une version complète mise à jour après le marqueur
  `---CARNET---` en fin de réponse ; l'app la découpe (`splitCarnet`), la stocke
  et n'affiche que les conseils. C'est un **état**, pas un journal : progression
  chiffrée, ce qui a été demandé et si c'est appliqué, points de vigilance —
  réécrit et élagué à chaque fois, donc il ne gonfle pas et le modèle ne se
  répète pas. **Si le marqueur est absent, l'ancien carnet est conservé et la
  réponse entière est affichée** : jamais de perte de mémoire silencieuse.
  Plafond dur à 1800 caractères, coupé sur une fin de phrase (le modèle dépasse
  la limite de 900 demandée — 1026 mesurés le 30/07/2026).
- **Fenêtre d'objectif temporaire** : rangée dans `targets.cut`
  (`{ enabled, start, end, protein, carbs, fat, fiber }`) et non plus dans des
  constantes de module, donc éditable dans les Réglages. `targetsForDate` lit
  `base.cut` ; hors fenêtre ou si `enabled: false`, retour automatique aux
  cibles de base. Le chargement fusionne avec `DEFAULT_TARGETS` (`{ ...defaults,
  ...stored }`) — indispensable, sinon un `targets` stocké avant cette date
  écraserait tout et laisserait `cut` absent.

### Coach IA — contrat exact (ne pas simplifier sans le signaler)
- **Détail des repas dans le prompt** (02/08/2026) : jusqu'ici le Coach IA ne
  voyait que les totaux macros du jour (`macroLog`, alimenté par `foodLog`
  depuis M6) — jamais QUOI a été mangé. `buildPrompt` lit désormais `foodLog`
  directement (`getSync("foodLog", [])` dans `store.js`, lecture **synchrone**
  au moment précis du clic sur "Analyser" — pas une copie chargée au montage
  de l'app comme `macros`/`weight`/etc., pour ne jamais rater un repas ajouté
  dans l'onglet Repas pendant la session en cours) et regroupe hier/aujourd'hui
  par repas (`repas_hier`/`repas_aujourdhui` dans le bloc TEMPS RÉEL : nom +
  quantité de chaque aliment, PAS les macros qui sont déjà dans `macros_*`).
  Consigne explicite au modèle : commenter la COMPOSITION quand elle appelle un
  conseil concret (répartition protéique entre repas, repas pauvre en fibres,
  timing autour de l'entraînement), pas relire la liste. `buildBriefing`
  (export claude.ai, tokens gratuits) va plus loin et dumpe les 14 jours de
  repas bruts aliment par aliment (`REPAS BRUTS 14 jours`), même logique que
  les séries de musculation brutes déjà présentes.
- Appel direct à `https://api.anthropic.com/v1/messages` depuis le
  navigateur avec la clé API saisie par l'utilisateur (stockée en local
  uniquement), header `anthropic-dangerous-direct-browser-access: true`.
- **Découpage system / user** (30/07/2026) : le rôle + les contraintes
  permanentes + le bloc sèche vont dans `system` (stable d'un appel à l'autre,
  donc rendu en préfixe et prêt pour le cache) ; les données et les consignes
  de sortie restent dans le message utilisateur. `buildPrompt` retourne donc
  `{ system, user }`, pas une chaîne.
- **`output_config: { effort: "medium" }`** (30/07/2026) : Sonnet 5 active la
  réflexion adaptative dès qu'on ne précise rien, et cette réflexion est
  facturée au tarif de SORTIE tout en consommant `max_tokens` — c'est la cause
  réelle des "réponses vides"/troncatures historiques. `medium` garde la
  qualité d'un Sonnet 4.6 en `high` pour bien moins cher. **Ne jamais envoyer
  `output_config` à Haiku 4.5 : il rejette ce paramètre (400)** — d'où le set
  `SUPPORTS_EFFORT`.
- **Reprise automatique** (`callClaude`) : 3 tentatives sur le modèle demandé
  espacées de 1,2 s puis 4 s en cas d'erreur transitoire (429 / 5xx / réseau),
  puis bascule sur `claude-haiku-4-5`. Motivé par une saturation réelle le
  28/07/2026 au soir (Sonnet et Opus en "overloaded", Haiku disponible) alors
  que l'app ne faisait qu'un seul essai. Les erreurs définitives (clé
  invalide, requête malformée) ne sont jamais reprises.
- **Coût réel affiché** après chaque analyse (tokens entrée/sortie + centimes),
  calculé depuis `usage` via la table `PRICING`. Celle-ci porte le tarif
  d'intro Sonnet 5 (2 $/10 $ jusqu'au 31/08/2026) ET le tarif normal
  (3 $/15 $) avec bascule automatique à la date — sans ça l'app
  sous-estimerait silencieusement le coût à partir du 01/09/2026.
- **Mesure réelle du 30/07/2026** : ~7 200 tokens en entrée / ~1 700 en sortie
  = **3,1 ¢ par analyse**. À noter : l'entrée (1,44 ¢) pèse presque autant que
  la sortie (1,7 ¢) — une estimation à la main basée sur le nombre de
  caractères donnait 2× moins, donc **toujours se fier au `usage` affiché,
  jamais à une estimation**. Le plus gros poste d'entrée reste le dump brut
  14 jours des séances.
- `max_tokens: 6000` — volontairement haut car le modèle peut consommer du
  budget en amont du texte visible ; on a eu des "réponses vides" et des
  troncatures avec des valeurs plus basses (1000 → 1800 → 4096 → 6000).
- Le prompt envoie systématiquement : un bloc **temps réel** (hier vs
  aujourd'hui : poids, sommeil, macros/eau en cours, séances, douleur
  genou), un **résumé 14 jours** (moyennes), un **dataset fusionné jour par
  jour** (poids + kcal + macros + fibres + eau, pour que le modèle corrèle
  lui-même poids et apports plutôt que de deviner), et une **progression par
  exercice pré-calculée**.
- **Principe adopté le 30/07/2026 : le JS calcule les faits, l'IA les juge.**
  Les dumps bruts 14 jours (séries de chaque séance, sommeil, genou) ont été
  remplacés par des agrégats calculés en JS : meilleure série par séance +
  tendance de volume (`exoProgress`), moyennes glissantes, pire nuit, douleur
  moyenne 7 j vs 7 j précédents. Mesuré : **entrée 7 457 → 5 845 tokens
  (−22 %), coût 3,4 → 3,1 ¢, et analyse plus fine** (le modèle repère
  désormais une baisse de volume sur un exercice précis et compare la douleur
  d'une semaine à l'autre — impossible depuis le dump brut, où on lui
  demandait de faire l'arithmétique dans 500 mots). Ne pas revenir aux dumps
  bruts : c'était plus cher ET moins bon.
- Le dataset jour par jour utilise des **clés courtes** (`d/p/kc/P/G/L/F/eau/
  pas/cible_kc`) avec les champs nuls omis, et une légende dans le prompt.
- **Le coût est désormais dominé par la SORTIE** (1 895 tok ≈ 1,9 ¢ contre
  1,17 ¢ en entrée) : pour descendre plus bas il faudrait raccourcir la
  réponse, pas le prompt.
- **Export vers claude.ai** (`coach.buildBriefing`, Réglages → « Copier le
  contexte ») : briefing complet dans le presse-papier, volontairement **plus
  riche** que le prompt API (il garde les séries brutes, le profil et le
  carnet) puisque la conversation claude.ai est couverte par l'abonnement et
  ne consomme aucun crédit API. C'est le pendant « suivi de fond » du point du
  jour. `navigator.clipboard` fonctionne dans la WebView Capacitor (vérifié le
  30/07/2026) ; en cas d'échec, le texte s'affiche pour copie manuelle.
- Rôle demandé : coach tout-en-un (sportif + kiné + nutritionniste + coach
  de vie). Réponse structurée en deux temps : 1) quoi faire dans les
  prochaines 24h, 2) tendance de fond 14 jours avec corrélation explicite
  poids/macros/eau/fibres.
- Limite stricte demandée au modèle : 500 mots max, sans restituer les
  données brutes, toujours terminer par une conclusion complète.
- **Pas de champ "question au coach"** — supprimé exprès, l'utilisateur
  préfère poser ses questions dans une conversation Claude classique.
  Seul un champ **"Note du jour"** existe (contexte libre : alcool,
  insomnie, petite blessure — pas une question), conservé et daté, envoyé
  dans le prompt.
- Coût assumé : quelques centimes par analyse, l'utilisateur a mis 5$ de
  crédit sur console.anthropic.com. Ne pas suggérer d'augmenter les coûts
  sans raison.

## Synchro Health Connect (app native uniquement — voir `src/healthSync.js`)

- **Fonctionne** : pas, sommeil, macros complètes (kcal + protéines +
  glucides + lipides + fibres), eau, poids. Lus automatiquement au
  lancement, à chaque retour au premier plan, et via le bouton
  "Synchroniser maintenant" (Réglages). Toujours **écrase** la valeur
  locale du jour concerné si Health Connect a une donnée ce jour-là (règle
  explicitement validée) — sauf si le jour n'a rien à donner, dans ce cas
  la saisie locale existante est préservée.
- **Marqueur `source`** (`"healthconnect"` | `"manual"`) sur chaque entrée
  steps/sleep/macros/poids. Sur l'app native, les onglets Poids/Pas/Sommeil/
  Macros passent en **lecture seule** (bandeau "Synchronisé depuis Health
  Connect" + bouton "Corriger manuellement") quand l'entrée du jour affiché
  a `source: "healthconnect"`. Le bouton révèle le formulaire de saisie
  classique ; sauvegarder ré-étiquette l'entrée en `"manual"` jusqu'à la
  prochaine synchro qui reprend la main. Sur la PWA, `source` n'est jamais
  "healthconnect", donc la saisie reste toujours visible directement.
- **Fait vérifié important** : sur mon installation, **MyFitnessPal écrit
  directement dans Health Connect** (nutrition ET hydratation, source
  `com.myfitnesspal.android`) — ça ne passe pas par Samsung Health. Ne pas
  chercher à lire les macros depuis Samsung Health, ce serait un
  intermédiaire inutile.
- **Lecteur natif maison** (`HealthNutritionPlugin.kt`) : nécessaire parce
  que `@capgo/capacitor-health` ne lit que l'énergie du `NutritionRecord`
  de Health Connect, pas le détail protéines/glucides/lipides/fibres — ce
  plugin maison va chercher ces champs en plus. Réutilise le même
  consentement Health Connect que `@capgo/capacitor-health` (mêmes
  permissions `READ_NUTRITION`/`READ_HYDRATION`), donc un seul écran de
  consentement pour tout.
- **Limite restante, acceptée : le décalage temporel Samsung Health → Health
  Connect.** Health Connect n'est qu'une copie retardée de ce que Samsung
  Health lui transmet (écriture par lots, pas en continu) — décalage
  constaté face au compteur temps réel Samsung Health/montre. Décision
  prise : ne pas contourner via le Samsung Health Data SDK (accès direct
  plus frais, mais mode développeur documenté par Samsung comme *"non
  destiné aux utilisateurs finaux"*, cassable à une mise à jour de Samsung
  Health). Pas de projet de correction ici, c'est un choix assumé.
- **Bug réel trouvé et corrigé le 03/08/2026 : les pas ne correspondaient
  PAS à Health Connect lui-même** (distinct du point précédent, où c'est
  Health Connect qui est en retard sur Samsung Health — ici c'était
  PROTOCOLE qui était en désaccord avec Health Connect). Cause : `today()`
  (`ui.jsx`) et `toKey()` (`healthSync.js`) utilisaient `.toISOString()`,
  qui bascule en UTC. En France l'été (UTC+2), minuit local = 2h du matin
  UTC — décalage vérifié dans le code source du plugin
  `@capgo/capacitor-health` (`HealthManager.kt`) : le bucket `"day"` de
  `queryAggregated` est une tranche fixe de 24h à partir de l'instant
  fourni, pas un vrai jour calendaire local. Les bornes de requête envoyées
  par PROTOCOLE étaient ancrées sur minuit UTC (donc 2h du matin heure
  locale), donc les pas faits entre minuit et l'heure du décalage
  atterrissaient sur la VEILLE. **Corrigé en profondeur, pas seulement pour
  les pas** : `today()` était utilisée partout (poids, sommeil, genou,
  séances, macros, repas) — c'est elle qui datait toute saisie manuelle
  faite entre minuit et l'heure du décalage sur le mauvais jour.
  - `ui.jsx` : nouvelles `localDateKey(d)` (lit les champs LOCAUX d'un
    objet Date, jamais `.toISOString()`) et `shiftDateKey(clé, jours)`
    (arithmétique locale pure via `new Date(y, m, d)`, jamais un
    aller-retour par un instant UTC). `today()` = `localDateKey(new
    Date())`.
  - `healthSync.js` : bornes de requête ancrées sur minuit LOCAL (`new
    Date(y, m, d)`, pas `Date.UTC(...)`), `setDate()` pour l'arithmétique
    de jours (gère correctement les passages heure d'été/hiver, contrairement
    à une simple addition en millisecondes). `toKey` utilise `localDateKey`.
  - Le lecteur natif maison (`HealthNutritionPlugin.kt`, sommeil/poids)
    n'avait PAS ce bug : il convertit déjà correctement chaque instant en
    date locale via `atZone(ZoneId.systemDefault()).toLocalDate()` côté
    Kotlin — seul le chemin JS (agrégation des pas) était concerné.
  - `autoBackup.js` et `foodStore.js` avaient chacun leur propre copie
    locale de `today()`/`todayKey()` avec le même bug — remplacées par un
    import depuis `ui.jsx` plutôt que corrigées en double, pour que les
    trois ne puissent plus diverger.
  - Testé en forçant un instant à 0h30 heure locale (Europe/Paris,
    vérifiée comme fuseau du navigateur de test) : l'ancien code datait
    "hier", le nouveau date correctement "aujourd'hui".
- **Poids** (`HealthNutritionPlugin.readWeight()`) : testé le 27/07/2026,
  ne fonctionnait pas — ni MyFitnessPal (WRITE_WEIGHT absent de son
  manifeste) ni Samsung Health n'écrivaient de pesée dans Health Connect (0
  échantillon). Retesté le 28/07/2026 après une pesée saisie **à la main
  dans Samsung Health lui-même** (pas MyFitnessPal) : cette fois la pesée
  apparaît bien dans Health Connect et se synchronise dans l'app — Samsung
  Health écrit donc les pesées manuelles, simplement aucune n'avait jamais
  été saisie côté Samsung Health avant ce test. Une seule pesée validée à
  ce stade ; à surveiller sur plusieurs jours. "weight" ajouté à
  `READ_TYPES` dans `healthSync.js`, réutilise le même écran de consentement
  @capgo que nutrition/hydratation/sommeil/pas.

## Module Nutrition interne (chantier ouvert le 01/08/2026)

Objectif : se détacher complètement de MyFitnessPal / Cronometer en intégrant un
journal alimentaire dans PROTOCOLE, proche de Cronometer (journal pur, aucun
coaching dans le module — le jugement reste au Coach IA).

**Chantier terminé. M0-M4, M6 et M7 livrés (M5 abandonné).**

| Jalon | Contenu | État |
|---|---|---|
| M0 | Base CIQUAL + moteur de recherche | ✅ 01/08/2026 |
| M1 | Onglet « Repas » isolé, CIQUAL + repas + historique | ✅ 01/08/2026 |
| M2 | Open Food Facts (recherche texte, sans cache persisté) | ✅ 02/08/2026 |
| M3 | Scan code-barres ML Kit (natif seulement) | ✅ 02/08/2026 |
| M4 | Portions/unités, recettes, copier un repas | ✅ 02/08/2026 (quick-add livré en avance dès M2) |
| M5 | (abandonné — micronutriments écartés, voir plus bas) | — |
| M6 | **Bascule** : `foodLog` alimente `macroLog`, coupure HC nutrition/eau | ✅ 02/08/2026 |
| M7 | Retrait des permissions HC nutrition/hydratation | ✅ 03/08/2026 |

- **M7** : `@capgo/capacitor-health` déclare inconditionnellement dans son propre
  manifeste (`node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml`)
  les 4 permissions `READ_NUTRITION`/`WRITE_NUTRITION`/`READ_HYDRATION`/`WRITE_HYDRATION`,
  qu'on les demande ou non à l'exécution (M6 avait coupé la LECTURE côté JS, pas la
  déclaration côté manifeste). Retirées via `tools:node="remove"` dans
  `android/app/src/main/AndroidManifest.xml` (ajout du namespace `xmlns:tools`, absent
  jusqu'ici) — vérifié dans le manifeste fusionné généré par Gradle
  (`app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml`) :
  les 4 permissions ont bien disparu, les autres (pas/sommeil/poids) intactes. Conséquence
  visible : l'écran de consentement Health Connect ne proposera plus nutrition/hydratation
  au prochain octroi de permissions.

### Décisions prises (ne pas les rouvrir sans demande explicite)

- **Pas de base de données. Pas de Room, pas de SQLite, pas de plugin natif.**
  CIQUAL tient en 3 178 lignes / 246 Ko (`src/data/ciqual.json`, chunk séparé de
  74 Ko gzip, précaché par le service worker). Balayage linéaire en JS :
  **0,24 ms par recherche**, mesuré. Room aurait imposé du Kotlin, un aller-retour
  JS↔natif par frappe, et un module mort sur la PWA.
- **Seulement 5 valeurs par aliment : kcal, protéines, glucides, lipides, fibres.**
  Micronutriments écartés explicitement par Yoann le 01/08/2026 — ce qui aligne
  exactement le module sur ce que `macroLog` suit déjà, donc la bascule M6 sera un
  mapping direct.
- **`src/nutrition/` et `src/ui.jsx` : la convention « tout dans App.jsx » est
  levée pour ce chantier** (validé par Yoann). Les primitives du design system ont
  été sorties de `App.jsx` vers `src/ui.jsx` à l'identique — sans ça, le module
  nutrition ne pouvait pas les réutiliser sans import circulaire.
- **Étape 1 strictement isolée (M1, levée à M6)** : `NutritionTab` gérait sa propre
  clé `foodLog` et ne recevait d'`App.jsx` que les cibles, en lecture — `macroLog`,
  `MacroTab` et `healthSync.js` n'étaient pas touchés, Cronometer continuait en
  parallèle. Ce n'est plus le cas depuis la bascule M6 (voir plus bas) : `foodLog`
  alimente désormais `macroLog`.
- **L'eau est une exception à l'isolation, décidée le 02/08/2026** : `NutritionTab`
  lit et écrit `macroLog.water` directement (mêmes boutons +250/+500/−250 que
  `MacroTab`), au lieu de dupliquer la donnée dans `foodLog`. Ce n'est pas une
  entorse au principe d'isolation — l'eau était déjà listée comme fonctionnalité à
  garder telle quelle dans la demande initiale (« déjà interfacée avec Health
  Connect ») — juste le même compteur rendu visible dans les deux onglets.
- **M6 livré le 02/08/2026** (`deriveMacroLog` dans `foodStore.js`, effet dans
  `NutritionTab.jsx`) : confirmé par Yoann avant de lancer — l'eau reste 100 %
  manuelle via les boutons de l'app (plus besoin que MyFitnessPal la fasse
  transiter par Health Connect).
  - **Dérivation, pas duplication de code** : `deriveMacroLog(log)` renvoie les
    totaux (mappés vers les noms `protein/carbs/fat/fiber` de `macroLog`,
    `MACRO_FIELD` dans `foodStore.js`) **uniquement pour les dates présentes dans
    `foodLog`** — jamais la liste complète de `macroLog`. C'est la garantie qui
    protège l'historique Cronometer antérieur au module : une date qui n'existe
    que dans `macroLog` (jamais loggée via Repas) n'est ni lue ni réécrite.
  - L'effet de dérivation tourne sur TOUT `foodLog` à chaque changement, pas
    seulement la date affichée à l'écran — nécessaire parce que "Dupliquer cette
    journée" (M4) peut modifier une date différente de celle en cours de
    consultation. Écriture dans `macroLog` seulement si une comparaison montre un
    changement réel (`source` ou une des 4 macros), pour ne pas déclencher de
    cycle de re-render/écriture à chaque frappe.
  - **Nouveau `source: "foodlog"`** dans `macroLog`, traité par `MacroTab` comme
    `"healthconnect"` (lecture seule, bandeau) mais **sans bouton "Corriger
    manuellement"** : une correction y serait de toute façon réécrasée au
    prochain changement dans `foodLog`, où qu'il ait lieu — mieux vaut ne pas
    proposer une action qui ne tient pas dans la durée. `SyncedBanner` (App.jsx)
    prend désormais un `label` et un `onCorrect` optionnels pour ça.
  - **Coupure de LECTURE seulement** (`healthSync.js`) : `dietaryEnergyConsumed`
    et `dietaryWater` retirés de `READ_TYPES`, bloc `readNutrition`/`macrosByDate`
    supprimé. Les permissions Android `READ_NUTRITION`/`READ_HYDRATION` restent
    déclarées (@capgo/capacitor-health) jusqu'à M7 — ne pas les retirer sans
    demande explicite, ce sera un chantier séparé.
  - **Testé avec un faux historique Cronometer** (`macroLog` seedé avec une date
    antérieure au module, `source: "healthconnect"`) : après ajout dans Repas sur
    le jour courant, la date historique reste identique au bit près, la nouvelle
    date apparaît avec `source: "foodlog"`, le Dashboard/graphique 14 jours/widget
    reflètent le tout sans code supplémentaire de leur côté (ils lisaient déjà
    `macroLog`, seule sa source de vérité a changé).

### Points techniques à connaître

- `scripts/build-ciqual.mjs` régénère `src/data/ciqual.json` depuis le XML ANSES.
  Lancé **à la main**, résultat commité : aucun accès réseau au build Netlify.
  Licence Ouverte Etalab 2.0, attribution affichée dans l'écran de recherche.
- **887 aliments CIQUAL n'ont aucune énergie tabulée** (ni constituant 328 ni 333),
  dont des aliments de base : sucre, lentilles cuites, amandes. L'énergie est alors
  recalculée depuis les macros avec les coefficients du règlement UE 1169/2011
  (+ 7 kcal/g d'alcool, sinon vin et sangria étaient donnés à moitié prix). Un
  garde-fou du script alerte si une boisson alcoolisée passe sans teneur en alcool.
- `ALIM_NOM_INDEX_FR` de l'ANSES contient de vrais **synonymes** (« Cocktail à base
  de rhum » → « Mojito, pina colada, daïquiri… ») : 542 alias de recherche gratuits.
- Le scoring de recherche gère les **accords français** (« pâte complète » trouve
  « Pâtes sèches, au blé complet ») et les **mots vides** (« blanc de poulet » ne
  doit pas classer sur « de »). Curseur à régler en cas de mauvais classement :
  `BREVITY` dans `ciqual.js`.
- **Favoris et historique ne sont pas stockés : ils se dérivent de `foodLog`**
  (fréquence + spécificité au repas + récence). Une liste tenue en parallèle
  finirait par diverger. Seul l'épinglage manuel a une clé (`foodPins`).
- `per100` est **figé à la saisie** (snapshot) : un produit Open Food Facts peut
  être corrigé ou disparaître, l'historique doit rester reproductible.
- **Poids réel mesuré : 236 octets par ligne de journal**, soit ~860 Ko/an à
  10 lignes/jour. Tenable sous le quota localStorage mais ce n'est plus
  négligeable comme l'est `macroLog` (1 ligne/jour). C'est ce chiffre mesuré, pas
  une estimation, qui doit servir à décider d'un éventuel passage à SQLite.
- **Open Food Facts (M2, `src/nutrition/off.js`) : quota confirmé bien plus serré
  qu'annoncé.** Testé en direct le 01-02/08/2026 : une deuxième requête à moins de
  ~5 s de la première renvoie déjà une 503 "Page temporarily unavailable" (pas un
  simple ralentissement). D'où trois protections cumulées, aucune seule ne suffit :
  déclenchement 700 ms après la dernière frappe (jamais à la frappe comme CIQUAL),
  un espacement minimum forcé côté client (`MIN_GAP_MS`) même si le debounce est
  contourné, et un cache mémoire **volontairement non persisté** (une requête déjà
  vue dans la session ne retape jamais l'API — mais on n'écrit rien en
  localStorage, un produit OFF corrigé par la communauté ne doit pas rester
  périmé indéfiniment). Un échec réseau/quota ne fait jamais planter l'écran :
  `searchOFF` retourne `{items:[], error:true}`, affiché comme message plutôt que
  remonté en exception — CIQUAL continue de fonctionner à côté dans tous les cas.
  Endpoint utilisé : `cgi/search.pl` (l'ancien, pas `/api/v2/search` qui répondait
  503 en test). L'en-tête `User-Agent` exigé par OFF est interdit en `fetch()`
  navigateur : `CapacitorHttp` le permet sur le natif (contourne aussi le CORS) ;
  repli `fetch()` sans le header sur la PWA. **Non vérifié en conditions réelles
  dans le navigateur d'aperçu Claude Code** : son bac à sable bloque tout accès
  réseau externe (confirmé même vers `example.com`) — seul `curl` en dehors du
  navigateur a pu valider le comportement de l'API. Premier vrai test : sur
  l'app native, où le réseau n'est pas restreint.
- **Radicaux courts et bruit des alias CIQUAL** : le repli morphologique de
  `matchTerm` (accords français) exigeait au départ seulement 3 lettres de
  radical (`STEM_MIN`), et deux faux positifs réels sont apparus au test : « skyr »
  remontait « Whisky » (radical « sky » trouvé au milieu du mot, hors début de
  mot), et « whey » remontait un jambon végétal via l'alias anglais « wheaty »
  présent dans les données ANSES. Corrigé le 02/08/2026 par deux garde-fous :
  un radical tronqué ne compte que s'il matche en DÉBUT de mot (score ≥ 55, pas
  un simple fragment), et `STEM_MIN` est passé à 4 — un mot de 4 lettres ou moins
  ne subit plus aucun repli du tout. Les deux mots n'existant réellement pas dans
  CIQUAL (normal, ce sont des produits de marque), ils remontent maintenant zéro
  résultat plutôt qu'un résultat trompeur — et se retrouvent via Open Food Facts.
- **Retours d'usage réel du 02/08/2026** (première session de test en parallèle de
  Cronometer) : la recherche CIQUAL+OFF est jugée correcte mais **pas au niveau de
  MyFitnessPal** — Yoann mange surtout des produits à code-barres, ce qui pousse M3 (scan)
  plus haut en priorité perçue que prévu. Trois correctifs livrés en réponse :
  - **Reprise automatique sur échec OFF** (`off.js`) : mesuré que le seuil réel n'est PAS
    une fenêtre glissante simple (4 s → 503, 5 s → 200, 6 s → 503 juste après) — aucun
    espacement client fixe ne peut donc garantir de passer. Un échec est retenté avant
    d'afficher quoi que ce soit ; le message d'erreur a aussi été reformulé pour ne plus
    affirmer "quota atteint", non vérifiable depuis le client. **Renforcé le même jour**
    (retour "un peu plus fluide mais peut mieux faire") : 2 tentatives de rattrapage au
    lieu d'une (délais croissants 2,5 s / 4 s, 3 essais au total), même logique que la
    reprise déjà en place pour l'API Claude. Un vrai 503 isolé, voire deux d'affilée, ne
    remontent donc plus jamais jusqu'à l'écran.
  - **Masquer un aliment de "Vos aliments habituels"** (`foodMuted`, nouvelle clé
    `DATA_KEYS`) : décongestionne la liste dérivée sans jamais toucher à l'historique réel
    (`foodLog`). Épinglé et masqué sont mutuellement exclusifs.
  - **"Macro rapide" par carte repas** : ouvre directement la saisie libre (sans passer
    par la recherche), nom désormais optionnel (repli sur "Ajout rapide").
  - **Bug trouvé en testant ce dernier point, corrigé le 02/08/2026** : toutes les saisies
    libres partageaient le littéral `ref: "quick"`. `suggestions()`/`usageStats()`
    regroupent le journal par `ref` pour bâtir les habituels — un ref partagé fusionnait
    silencieusement toutes les saisies libres en une seule entrée fantôme (la plus
    récente écrasant les autres), et masquer cette entrée aurait masqué TOUTES les
    saisies libres futures. Chaque saisie libre reçoit maintenant un ref unique
    (`newQuickRef()`, préfixe `quick:` + id). Les entrées déjà enregistrées avec le
    littéral `quick` restent reconnues (`isQuickRef()`) pour la compatibilité arrière,
    mais ne bénéficient pas rétroactivement de l'unicité.
  - **Dates futures dans l'onglet Repas** (`DateField` dans `ui.jsx`, prop `future`) :
    demandé explicitement pour planifier des repas à l'avance (ex. macros d'un match
    prévu). Le plafond `max={today()}` reste le comportement PAR DÉFAUT sur les 6 autres
    onglets de saisie (Poids, Sommeil, Pas, Séances, Genou, Macros) — une date future n'y
    a aucun sens, ce sont des mesures de ce qui s'est passé. Seul `NutritionTab` passe
    `future` pour lever le plafond.
- **M3 livré le 02/08/2026** (`@capacitor-mlkit/barcode-scanning` 8.1.0,
  `src/nutrition/scan.js`) : `BarcodeScanner.scan()` (Google Code Scanner) et **pas**
  `startScan()`, qui affiche la caméra derrière la WebView et impose de rendre le fond
  transparent — incompatible avec le fond opaque du design system. Formats restreints à
  EAN-13/EAN-8/UPC-A/UPC-E (codes-barres produits uniquement).
  - **Aucune permission CAMERA déclarée dans le manifeste, ni demandée à l'exécution** :
    `scan()` ouvre l'interface native de Google Play Services par-dessus l'app (comme un
    intent), documenté explicitement par le plugin ("no camera permission is required").
    Vérifié le 02/08/2026 après `npx cap sync` : `AndroidManifest.xml` ne gagne aucune
    ligne `<uses-permission>`.
  - **Lecture par code-barres (`getOFFByBarcode` dans `off.js`) : quota bien plus large
    que la recherche texte**, vérifié par rafale de 4 lectures à <0,1 s d'écart sans
    aucune 503 (contre 503 dès ~4-6 s d'écart en recherche texte, voir plus haut). Endpoint
    `api/v0/product/{code}.json`, séparé de `cgi/search.pl` — aucun `MIN_GAP_MS` ni
    espacement forcé pour ce chemin, juste la même reprise en cas de vrai souci réseau.
  - Premier scan sur l'appareil : le module Play Services (quelques Mo) peut nécessiter un
    téléchargement (`installGoogleBarcodeScannerModule()`), déclenché automatiquement avant
    `scan()` si `isGoogleBarcodeScannerModuleAvailable()` répond `false`.
  - `@capacitor-mlkit/barcode-scanning` 8.1.0 déclare `@capacitor/core >=8.0.0` et
    `minSdkVersion` 24 (l'app est en 26) — compatibilité vérifiée le 01/08/2026.
  - **Non testé en conditions réelles avec un vrai scan caméra** dans cette session (pas de
    moyen de piloter la caméra du téléphone à distance) — build natif installé (v3.33.0),
    **testé avec succès par Yoann sur l'appareil le 02/08/2026.**
- **M4 livré le 02/08/2026.** Trois briques indépendantes, toutes réutilisent le pipeline
  existant sans code dédié supplémentaire côté journal :
  - **Copier un repas** (`copySourceCandidates`/`copyEntries` dans `foodStore.js`) : liste
    les jours (passés OU futurs déjà planifiés) qui ont déjà CE repas précis rempli, tap =
    duplication immédiate (nouveaux `id`/horodatage, `ref`/`per100` intacts). Panneau
    inline dans la carte du repas, pas une feuille plein écran — c'est un choix rapide
    parmi peu d'options.
  - **Portions nommées** (`foodPortions`, ref → `[{label, grams}]`) : "1 pot = 125 g"
    directement dans `QtyPanel`, apprises une fois par aliment (`ref`), valables pour
    toutes ses saisies futures dans n'importe quel repas. Épinglé/masqué n'a pas
    d'équivalent ici : une portion mal nommée se supprime avec le `×` sur sa chip.
  - **Recettes** (`foodRecipes`, `compileRecipe`/`recipeAsFood` dans `foodStore.js`) :
    compile une liste d'ingrédients (recherche CIQUAL dédiée, volontairement sans OFF pour
    ne pas imbriquer son quota/debounce dans un sous-écran) en UN `per100` sur le poids
    total, avec un `ref` stable `recipe:<id>`. **Décision clé** : une recette devient un
    "aliment" comme un autre (même forme `{ref, name, per100}`) plutôt qu'un mécanisme
    séparé — elle traverse `QtyPanel`, les portions nommées, la recherche, tout le reste,
    sans un seul `if` dédié. `defaultQ = totalWeight` : une recette se mange en général en
    un lot défini, pas par portion de 100 g comme un aliment brut. Une macro devient
    `null` sur toute la recette si NE SERAIT-CE QU'UN ingrédient avec une quantité > 0 a
    cette macro absente — additionner un nombre et une inconnue ne donne jamais un vrai
    total. Section "Vos recettes" dans `FoodSearch` : toujours visible sans frappe (jamais
    de réseau, la liste reste courte), filtrée par nom sinon.
  - Bug de coordonnées rencontré en testant "Copier un repas" dans le navigateur d'aperçu
    Claude Code (pas un bug de l'app) : un clic ciblant le conteneur du panneau au lieu de
    la ligne cliquable à l'intérieur ne déclenchait rien silencieusement — résolu en
    ciblant l'élément DOM précis plutôt que des coordonnées d'écran.
- **Retours du 02/08/2026 sur M4, deux ajouts avant le commit :**
  - **OFF dans le sélecteur d'ingrédients de recette.** La séparation stricte M2 (pas d'OFF
    dans `IngredientPicker`, pour ne pas imbriquer son quota/debounce) a été révisée : Yoann
    mange surtout des produits à code-barres, donc CIQUAL seul manquait trop d'ingrédients
    réels. Extrait un hook partagé `useFoodSearch(q, {boost, limit})` (CIQUAL + OFF, même
    debounce 700 ms) et un composant `OffSection`, utilisés à la fois par la recherche
    principale et `IngredientPicker` — élimine la duplication plutôt que de recopier la
    logique une deuxième fois.
  - **Dupliquer une journée (sens inverse de "Copier un repas")** : `DuplicatePanel` dans
    `NutritionTab.jsx`, accessible depuis la carte Date. Là où "Copier un repas" part d'un
    repas VIDE et choisit où TIRER (un jour source), celui-ci part du jour AFFICHÉ et choisit
    où COLLER (un ou plusieurs repas, "Toute la journée", vers une date au choix — passée ou
    future). **Aucun risque d'écrasement** : ni cette fonctionnalité ni `copyEntries` ne
    suppriment jamais rien, elles ne font qu'AJOUTER des lignes — un aliment déjà présent sur
    le jour cible n'est jamais touché, propriété déjà vraie de `copyEntries` avant même cette
    demande, donc aucune logique de fusion à écrire séparément. Cases pré-cochées sur les
    repas qui ont déjà du contenu le jour affiché. Testé : contenu ajouté deux fois de suite
    sur la même date cible, l'entrée saisie manuellement entre les deux n'a pas bougé.
- **Retours du 03/08/2026** :
  - **« Vos aliments habituels » passe de 12 à 25** (`suggestions()` dans
    `foodStore.js`, simple changement de la limite par défaut — dérivé de
    `foodLog`, aucun coût de stockage supplémentaire).
  - **Changer de jour au doigt (swipe) dans l'onglet Repas.** Décision AU
    RELÂCHÉ (`touchend`), jamais `preventDefault` sur `touchmove` : le
    scroll vertical normal de la page n'est donc jamais bloqué ni
    saccadé, on regarde seulement si le trajet final ressemble à un swipe
    horizontal une fois le doigt levé (distance mini 60px, pente
    verticale/horizontale sous 0,6). Départ ignoré si à moins de 24px du
    bord gauche de l'écran, pour ne jamais entrer en conflit avec le
    geste "retour" du système Android. Désactivé quand `FoodSearch` est
    ouvert (feuille plein écran à part, un swipe en train de chercher un
    aliment ne doit pas changer le jour en dessous). Testé avec de vrais
    `TouchEvent` simulés : swipe gauche → jour suivant, droite → jour
    précédent, et les trois garde-fous (bord, distance, pente)
    confirmés inopérants chacun séparément.
  - **Date en estompé à côté de chaque repas** ("Goûter 05/08" ou "Goûter
    aujourd'hui") : le swipe seul ne se voyait pas assez, rien à l'écran
    n'indiquait qu'on avait changé de jour. Réutilise la même logique que
    le sous-titre en haut d'écran (`date === today() ? "aujourd'hui" :
    fmt(date)`).
- **Modifier une recette déjà enregistrée (05/08/2026, v3.51.0)** : jusqu'ici seule la
  suppression totale d'une recette était possible — corriger un ingrédient obligeait à tout
  ressaisir. `compileRecipe(name, ingredients, existing)` accepte désormais un troisième
  argument optionnel : passé, il conserve l'`id`/`createdAt` d'origine (le `ref`
  `recipe:<id>` reste stable) au lieu d'en générer une nouvelle. Nouveau `updateRecipe` dans
  `useFoodLog()`, icône crayon à côté de la corbeille sur chaque ligne de "Vos recettes"
  (`Row` gagne un `onEdit`). `RecipeBuilder` accepte un `recipe` optionnel qui préremplit nom
  et ingrédients et bascule les libellés ("Modifier la recette" / "Enregistrer les
  modifications"). **Nouveau aussi : modifier la quantité d'un ingrédient déjà dans la
  recette** (jusque-là on ne pouvait que le retirer et en rajouter un autre) — taper sur la
  ligne d'un ingrédient ouvre un `Stepper` dédié, distinct d'`IngredientPicker` qui sert à en
  AJOUTER un nouveau.
  **Bug trouvé et corrigé pendant le test** : `compileRecipe` ne stockait que
  `{ref, name, q}` par ingrédient, jamais son `per100` — en rouvrant une recette pour la
  modifier, impossible de recalculer le total (affichait "— kcal"), et sauvegarder l'aurait
  silencieusement corrompue (toutes les macros à `null`). Chaque ingrédient garde désormais
  son propre `per100` figé, cohérent avec le principe M1 (figé à la saisie, jamais résolu à
  la lecture) : une recette ne doit pas changer de composition si la table CIQUAL est mise à
  jour derrière. **Testé dans l'aperçu** : création, modification du nom et remplacement d'un
  ingrédient (pomme → banane, total recalculé en direct), édition de quantité seule,
  sauvegarde confirmée en PLACE (une seule recette après modification, pas de doublon).
- **Bug réel remonté par Yoann le 05/08/2026 (corrigé en v3.51.1), le test ci-dessus n'avait
  pas couvert ce cas** : le test avait couvert la création ET la modification d'une recette
  *nouvellement créée* (donc déjà pourvue de `per100` par ingrédient), pas la modification
  d'une recette *antérieure à v3.51.0* — celles-ci ont des ingrédients qui n'ont jamais eu de
  `per100` stocké. Rouvrir une telle recette et l'enregistrer recalculait le total avec des
  macros manquantes et l'écrasait avec des valeurs `null` partout — la recette affichait
  alors 0 dans tous les repas qui l'utilisent. **Corrigé par auto-réparation** :
  `RecipeBuilder` détecte à l'ouverture si des ingrédients n'ont pas de `per100` et les
  re-résout silencieusement depuis leur source d'origine (`getCiqual`/`getOFFByBarcode` selon
  le préfixe du `ref` — un ingrédient de recette vient toujours de CIQUAL ou OFF, jamais
  d'une saisie libre ni d'une autre recette, donc toujours résoluble par ce chemin). Le total
  se met à jour dès la résolution terminée ; enregistrer ensuite persiste enfin un `per100`
  correct par ingrédient, réparant la recette pour de bon. Un ingrédient irrésolu (OFF
  injoignable) reste honnêtement absent plutôt que de planter l'écran. **La recette cassée se
  répare simplement en la rouvrant en modification et en enregistrant à nouveau** (même sans
  rien changer) — pas de manipulation JSON requise.
- **Calories affichées en réglant la quantité d'un ingrédient de recette (05/08/2026,
  v3.51.2)** : jusqu'ici, ajouter ou modifier un ingrédient dans une recette ne montrait que
  les grammes, sans indication de calories avant validation — contrairement à `QtyPanel`
  (ajout d'un aliment à un repas), qui affiche déjà l'apport en direct. Nouveau composant
  `KcalPreview` partagé, branché sur les deux écrans concernés (`IngredientPicker` en ajout,
  et l'éditeur de quantité de `RecipeBuilder` en modification) — même formule que `amounts()`
  dans `foodStore.js` (kcal arrondie à l'entier), recalculée à chaque changement de quantité.
  Volontairement limité aux calories (pas le détail P/G/L/Fib comme `QtyPanel`) : c'est ce qui
  a été demandé, et le detail complet existe déjà une fois l'ingrédient ajouté (total de la
  recette, juste en dessous de la liste).
- **Calories aussi sur la LISTE des ingrédients déjà ajoutés (05/08/2026, v3.51.3)** :
  demande complémentaire — la carte v3.51.2 couvrait les deux écrans de réglage de quantité,
  pas la liste elle-même dans `RecipeBuilder` (qui n'affichait que "Nom · 120g"). Chaque ligne
  passe sur deux niveaux ("Nom" puis "120g · **48 kcal**" en accent, réutilisant `kcalFor`)
  au lieu d'une seule ligne — nécessaire pour garder la place au clic vers l'éditeur de
  quantité (`onClick` sur toute la ligne, inchangé) sans surcharger.
- **Fibres manquantes sur chaque ligne d'aliment du journal (05/08/2026, v3.51.4)** : le
  total d'un repas (carte "Goûter" etc.) affichait bien P/G/L/Fib, mais `EntryRow` — la ligne
  repliée de CHAQUE aliment individuel dans `NutritionTab.jsx` — n'affichait que P/G/L,
  fibres oubliées. Ajout de `Fib{a.fib ?? "—"}` à la ligne, même style que les trois autres
  et que le total du repas juste au-dessus.
- **Incohérence des calories entre l'onglet Repas et l'onglet Macros (05/08/2026, v3.51.5)** :
  Repas affichait la vraie somme mesurée par aliment (`totals().kcal`, table CIQUAL/OFF,
  fibres comprises) tandis que Macros/Dashboard/widget recalculaient toujours via 4/4/9 pur
  (`protein*4+carbs*4+fat*9`) à partir des macros du jour — **fibres jamais comptées**
  (2 kcal/g, règlement UE 1169/2011), donc deux chiffres différents pour la même journée dès
  qu'elle contient des fibres. Le même formule tronquée était dupliquée à une douzaine
  d'endroits (Dashboard, MacroTab, widget écran d'accueil, dataset 14 jours et texte système
  du Coach IA), y compris pour les CIBLES (pas seulement la consommation).
  **Corrigé avec deux helpers partagés** (`App.jsx`, juste après `targetsForDate`) :
  `kcalFromMacros(p,c,f,fib)` (4/4/9 + fibres à 2 kcal/g — même coefficient que la table
  CIQUAL et la saisie libre de `FreeEntry`, qui l'utilisait déjà) remplace partout l'ancienne
  formule tronquée pour les CIBLES ; `kcalOfEntry(m)` préfère la vraie valeur mesurée
  (`m.kcal`) quand elle existe et ne retombe sur l'estimation que si elle est absente, pour la
  CONSOMMATION. `deriveMacroLog` (bascule M6, `foodStore.js`) pousse désormais aussi `kcal`
  (vraie somme) dans `macroLog` pour les jours alimentés par `foodLog` — jusqu'ici seuls
  protein/carbs/fat/fiber étaient dérivés, jamais kcal, ce qui obligeait Macros à
  recalculer une approximation alors que la vraie valeur existait déjà. Comparaison de
  `NutritionTab` étendue à `cur.kcal !== d.kcal` pour que les jours déjà migrés avant ce
  correctif se fassent backfiller une seule fois au prochain chargement (pas de nouvelle clé,
  pas de migration manuelle). `tdee.js` (`kcal449`) volontairement **non touché** : repli
  4/4/9 déjà scopé aux seules dates antérieures au module Repas, déjà testé (15 assertions),
  aucun rapport avec cette incohérence d'affichage. **Testé dans l'aperçu** : "Pomme, sèche"
  (252 kcal réelles, 8,7 g fibres/100 g — écart de 17 kcal avec un 4/4/9 pur) loguée dans
  Repas, même chiffre 252 vérifié à l'identique dans Macros et le Dashboard (aperçu
  navigateur) ; cible passée de 2205 à 2275 kcal (35 g fibres × 2, cohérent partout). Le
  widget écran d'accueil (Android natif) utilise le même helper mais n'a pas pu être vérifié
  hors du téléphone — à confirmer visuellement après installation.
- **Barre collante pour signaler le jour affiché dans Repas (05/08/2026, v3.52.0)** : remonté
  par Yoann — le sous-titre "aujourd'hui"/date et la date en estompé à côté de chaque repas
  (03/08/2026) se perdaient dès qu'il scrollait, aucun repère ne restait visible. Nouvelle
  barre `position: sticky, top: 0` juste sous le `ScreenHeader`, visible UNIQUEMENT quand
  `date !== today()` : texte accent citron directionnel ("← Hier · dim. 2 août",
  "jeu. 6 août · demain →", ou "Il y a N jours"/"Dans N jours" au-delà de ±1) + bouton
  "Aujourd'hui" pour revenir en un tap. Fond `C.accentRow` (jeton déjà utilisé ailleurs pour
  un état actif/sélectionné, pas une nouvelle couleur), bordure accent, bleed horizontal en
  marge négative pour occuper toute la largeur malgré le padding du conteneur.
  **Volontairement PAS une pastille flottante** : le minuteur de repos a déjà expérimenté une
  pastille épinglée en permanence et l'a abandonnée explicitement ("ça gênait le scroll",
  voir plus haut) — même piège évité ici en repositionnant l'info existante plutôt qu'en
  ajoutant un élément flottant nouveau. Écart de jours calculé en arithmétique locale pure
  (`new Date(y, m-1, d)`, même famille que `shiftDateKey`), jamais un aller-retour par un
  instant UTC. **Testé dans l'aperçu** (mobile 375×812) : label et flèche corrects pour "il y
  a 3 jours" et "demain", barre confirmée toujours visible après un scroll profond jusqu'au
  bas de la liste des repas, bouton "Aujourd'hui" ramène bien à `today()` et fait disparaître
  la barre.

## Chantier V — étapes livrées

### V1 — Douleurs : harmoniser coude et genou (03/08/2026, v3.42.0)

Le tendon distal du biceps n'existait que comme *contrainte* (prises neutres dans
les templates, pénalités fixes escalade/Upper, une phrase dans le `system` du
Coach IA) : aucun chiffre, donc le recommandeur écartait l'escalade sur une règle
figée plutôt que sur l'état réel du coude. Désormais les deux tendinopathies sont
mesurées de la même façon.

- **Nouvelle clé `elbowLog`** (dans `DATA_KEYS`), **même forme que `kneeLog`**
  (`{ date, pain, baseline }`). Clé séparée volontairement plutôt qu'un `painLog`
  unique avec un champ `zone` : fusionner aurait imposé de migrer l'historique de
  douleur réel du genou pour un gain purement esthétique. **Aucune migration,
  `kneeLog` n'est pas touché** (vérifié au test : identique au bit près après
  plusieurs saisies côté coude).
- **`KneeTab` → `PainTab`** (onglet « Douleurs », `tab: "pain"`), piloté par la
  table `PAIN_ZONES` : une zone = un libellé, un journal, et deux drapeaux
  (`hsr`, `routines`). **La table HSR et les deux routines guidées ne s'affichent
  que sur le genou** — elles sont propres au quadricipital. Ajouter une 3e zone
  un jour = une entrée dans `PAIN_ZONES` + une clé dans `DATA_KEYS` + une ligne
  dans `save`.
- **`zoneState(log, t0, label, { unknownIsCaution })`** : extrait du
  recommandeur, partagé par les deux zones (péremption `PAIN_FRESH_DAYS = 3`,
  seuils rouge/ambre, comptage hors base 7 j). Le paramètre `unknownIsCaution`
  porte la seule vraie différence de traitement :
  - **genou = `true`** : pas de donnée fraîche ⇒ prudence par défaut (gate dur,
    il interdit des séances entières).
  - **coude = `false`** : **silence total** tant qu'aucune douleur n'est notée —
    même principe que les nudges sommeil/charge, une absence de saisie ne doit
    pas devenir une alerte.
- **Règles du recommandeur ajoutées** : coude hors base → **Upper ET Escalade
  écartés** (raison chiffrée, comme le genou) et Repos +12 ; coude ambre →
  **Upper −10 et Escalade −12** (pénalité plus lourde sur l'escalade : c'est la
  sollicitation la plus intense du tendon distal du biceps), jamais sur Repos.
  Cas de repli traité : une zone peut être ambre sans douleur du jour (relevé
  hors base il y a 4-6 j, compté dans `flagged7` mais périmé) — la raison
  affichée ne prétend alors pas donner un chiffre du jour.
- **Coach IA** : `douleur_coude_hier`/`douleur_coude_aujourdhui` dans le bloc
  temps réel, `summary.coude` (mêmes agrégats que `summary.genou`), « coude »
  ajouté à la ligne « Traite explicitement CHAQUE domaine », `Coude brut` dans le
  briefing claude.ai. Coût : quelques dizaines de tokens.
- **Dashboard** : la tuile Genou devient une tuile **Douleurs à deux valeurs**
  (rendu `pair` dans la liste `tiles`, les tuiles simples sont inchangées).
- Testé dans le navigateur d'aperçu : jour sans entrée coude → champ vide +
  Enregistrer désactivé + pas de table HSR ; coude hors base → Upper et Escalade
  dans « à éviter » avec motif ; coude à 4/10 → Upper 36 → 26 et Escalade sortie
  du top 3 ; `elbowLog` bien présent dans l'export JSON.

### V2 — Sauvegarde régulière hors du téléphone (03/08/2026, v3.43.0)

`autoBackup.js` écrivait déjà un export quotidien dans `Documents/Protocole` : ça
protège d'un bug qui corromprait le localStorage, **pas** de la perte/casse du
téléphone ni d'un « vider les données » (qui efface aussi ce dossier). V2 comble
ce point unique de défaillance, sans backend et sans OAuth (les deux écartés dans
`ROADMAP.md`).

- **`src/cloudBackup.js`** : `daysSinceBackup`, `isBackupStale` (seuil
  `STALE_DAYS = 14`) et `scheduleBackupReminder` (rappel `REMIND_DAYS = 7`).
- **Le bouton existant est réutilisé, pas dupliqué** : « Exporter » devient
  « **Sauvegarder hors du téléphone** » (même chemin natif Filesystem+Share déjà
  en place), et « Importer » devient « Restaurer un fichier ». La date n'est
  enregistrée **que si `Share.share` résout** — annuler la feuille rejette la
  promesse, donc une annulation ne date rien (message dédié « Sauvegarde
  annulée » au lieu de l'ancien « Export impossible : Share canceled »). On date
  une intention aboutie, pas une réception : impossible de vérifier depuis l'app
  que le fichier est bien arrivé sur Drive, et le texte de confirmation le dit.
- **Clé `lastCloudBackup`, volontairement ABSENTE de `DATA_KEYS`** — restaurer
  une vieille sauvegarde ne doit pas faire croire à l'app qu'elle vient d'être
  sauvegardée. Même raisonnement que `lastAutoBackupDate`. **Vérifié au test** :
  un `importData` contenant `lastCloudBackup: "2020-01-01"` laisse la valeur
  locale intacte.
- **Bandeau d'alerte** au-delà de 14 jours (ou jamais sauvegardé), dans les
  Réglages **et sur le Dashboard** — c'est le rappel visible, pas le bouton, qui
  fait que la sauvegarde a lieu. Le bandeau du Dashboard ouvre les Réglages au
  tap. Seuil vérifié à la journée près : J-14 rien, J-15 bandeau.
- **Rappel système** (natif) : notification `id 4242` programmée à
  `dernière sauvegarde + 7 j` à 19h, répétée chaque semaine. **Reprogrammée à
  chaque lancement ET à chaque sauvegarde** (`useEffect` dépendant de
  `lastCloudBackup`) : une sauvegarde fraîche repousse l'échéance au lieu de
  laisser sonner le rappel de la semaine précédente. Un rappel hebdomadaire fixe
  aurait été du bruit le lendemain d'un export. Échéance déjà passée → avancée
  d'une semaine à la fois plutôt qu'ignorée par Android.
- **Vérifié sur l'appareil le 03/08/2026** (v3.43.0 installée) : au lancement,
  `LocalNotifications.schedule` part bien avec `id 4242`,
  `at: 2026-08-10T19:00 local`, `repeats: true, every: "week"` — soit J+7 puisque
  aucune sauvegarde n'avait encore été faite. Aucune erreur `cloudBackup:` dans
  logcat.
- **`android:allowBackup="true"` ne sert à RIEN sur ce téléphone** : `adb shell
  bmgr enabled` répond « **Backup Manager currently disabled** » (vérifié le
  03/08/2026). Le filet Android n'est donc pas seulement invérifiable, il est
  **inactif**. Ne jamais le présenter comme un second filet tant que ce n'est pas
  réactivé côté Android, et de toute façon **jamais** comme la sauvegarde
  principale.

### V3 — Progression visible par exercice (03/08/2026, v3.44.0)

`exoProgress` était calculé pour le Coach IA et n'apparaissait **nulle part à
l'écran** : l'app avait des courbes pour le poids, le sommeil, les pas, la
douleur et les calories, mais aucune pour l'entraînement, qui est son cœur.

- **Nouveau module `src/training.js`**, sans aucune dépendance React/`ui.jsx`
  (donc testable seul en Node) : `bestSet`, `exoProgress`, `exerciseList`,
  `exerciseSessions`, `exerciseTrend`, `setScore`, `setLabel`, `isTimeMode`.
- **Fenêtre passée par l'appelant, pas en paramètre** : les fonctions reçoivent
  une liste de séances **déjà filtrée** (Coach IA : `last14(training)` ; écran :
  tout l'historique). Impossible de se tromper de périmètre, et les fonctions
  restent pures.
- **Non-régression vérifiée par diff**, pas à l'œil : un script a comparé la
  sortie de l'ancienne closure de `buildPrompt` (copiée verbatim) à celle du
  module extrait, sur un jeu de séances synthétique couvrant 4 séances d'un même
  exercice (donc `slice(-3)`), un exo par jambe, un exo sans série cochée et une
  séance non-muscu. **Sortie identique au caractère près pour les exercices en
  reps.**
- **Bug trouvé par ce test et corrigé — le seul écart volontaire au prompt** :
  en mode « temps » (gainage), le volume `charge × reps` valait toujours 0 (la
  charge est nulle), donc **TOUS les exercices de gainage étaient annoncés
  « stable » au coach**, y compris une planche passée de 60 s à 55 s. Ils sont
  désormais comparés en **secondes**, et affichés `60s` au lieu de `0x60` (que le
  modèle pouvait lire comme une charge nulle). Sans cette correction, l'écran
  aurait dit « baisse » là où le coach disait « stable » — deux vérités pour le
  même historique.
- **Écran « Progression par exercice »** : carte d'entrée dans l'onglet Séances →
  liste des exercices déjà réalisés (le plus récent en tête, avec tendance) →
  détail (courbe + toutes les séries séance par séance, jambe G/D comprise).
- **Ce qui est tracé : le volume de la meilleure série** (charge × reps), ou les
  **secondes** en mode temps. Le tooltip montre la série lisible (« 60 kg × 8 »,
  « 60 s »), pas le volume brut. **Pas de 1RM estimé, volontairement** : les
  formules type Epley n'ont aucun sens sur un protocole HSR à tempo 6 s et
  amplitude 10-60°, et pousser un 1RM sur un tendon en rééducation est
  contre-indiqué — ne pas ajouter sans demande explicite.
- **Un exercice ouvert mais sans série cochée n'existe pas** pour cet écran (ni
  dans la liste, ni dans le compteur) : ce n'est pas une performance à zéro,
  c'est une absence de performance. Une seule séance → message dédié au lieu
  d'une courbe à un point.

### V4 — Détection de record sur une série (03/08/2026, v3.45.0)

Rend visible une progression que l'app connaissait déjà mais ne signalait jamais.
Réutilise `bestSet` extrait à V3 — aucune nouvelle clé localStorage, un record
n'est pas une donnée à stocker mais une lecture de l'historique.

- **Définition** (dans `training.js`) : `beats(a, b, mode)` — charge la plus
  lourde, puis le plus de reps à charge égale ; **secondes en mode temps**.
  **Égaler n'est pas battre.** Calculé sur **tout l'historique**, jamais sur
  14 jours (sinon tout redeviendrait un record tous les quinze jours).
- **`recordsBySession(training)`** rejoue l'historique dans l'ordre
  chronologique et renvoie une `Map` (**objet séance → exercices ayant battu un
  record ce jour-là**), clé par référence d'objet comme la suppression/édition
  ailleurs dans l'app — pas par `id`, que les séances les plus anciennes n'ont
  pas toutes. **C'est la réponse au piège du premier lancement** : on ne déclare
  pas un record sur chaque exercice de la prochaine séance, on relit l'existant.
- **Le premier passage sur un exercice n'est PAS un record**, c'est une
  référence (même convention que la tendance « 1re fois » de V3).
- **`recordToBeat(training, nom, exclude)`** : référence affichée dans le
  carnet, calculée en excluant la séance en cours (une séance en modification ne
  doit pas être son propre record à battre). Sémantique assumée : « meilleure
  série jamais faite », pas « meilleure série avant cette date » — rouvrir une
  vieille séance ne ressuscite donc pas un record déjà dépassé depuis.
- **Affichage** : dans le carnet, la référence (`★ record : 32 kg × 9`) sous la
  consigne, et un `★` accent accolé au numéro de la série qui bat le record au
  moment où elle est cochée (la référence avance au fil des séries, donc seules
  les vraies améliorations successives ressortent). Dans « Dernières séances »,
  un `★` (ou `★2`, `★3`…) à côté du type de séance. Pas de confettis, pas
  d'animation : un record est un fait, le design system est austère.
- **Garde-fou du profil** (`painOutOfBase`) : **aucun record n'est mis en avant
  un jour où le genou OU le coude est hors base** (`baseline === false` ou
  douleur ≥ 6, mêmes seuils que le recommandeur). Féliciter une charge record le
  jour où le tendon a flambé, c'est encourager exactement ce que Silbernagel
  cherche à éviter. Le record est calculé et enregistré normalement, il n'est
  simplement pas signalé — et pas de relevé ce jour-là ne supprime rien (une
  absence de saisie n'est pas une alerte).
- **Testé** (script Node sur historique synthétique + aperçu) : séquence de
  records conforme sur 5 séances, égalité non signalée, séance non cochée
  ignorée, exercice jamais fait sans record, mode temps comparé en secondes,
  garde-fou vérifié dans les deux sens (séance passée marquée `★2` masquée le
  jour d'un genou hors base ; carnet sans aucune étoile ni référence avec un
  coude à 7/10 le jour même, malgré une série qui bat largement le record).

### V5 — Escalade : suivi des blocs (03/08/2026, v3.46.0)

L'escalade était la séance la moins documentée (durée + RPE) alors que c'est
celle qui charge le tendon du coude — et le recommandeur lui appliquait une
pénalité **forfaitaire** : une heure tranquille et une grosse session de blocs
comptaient pareil.

- **Périmètre : bloc uniquement.** Pas de sélecteur bloc/voie — ne pas
  réintroduire la notion de « voie » sans demande explicite.
- **ÉCHELLE : celle de SA SALLE, par couleur de piste — PAS Fontainebleau**
  (corrigé en v3.47.0 le 03/08/2026 ; la v3.46.0 était partie sur Font par
  erreur, `ROADMAP.md` le supposait). Six couleurs ordonnées **jaune < vert <
  bleu < rouge < noir < violet**, cinq niveaux dans chaque (5 = le plus dur), soit
  30 cotations. C'est ce que Yoann lit sur le mur : lui demander de convertir en
  6B+ serait une saisie fausse et lente. **Ne pas reconvertir en Fontainebleau**,
  y compris dans le prompt du Coach IA (consigne explicite pour le modèle).
- **`src/climbing.js`** (module pur, testable en Node) : `COLORS`, `LEVELS`,
  `GRADES` (échelle ordonnée), `gradeIndex`/`gradeLabel`/`gradeColor`,
  `climbSummary`, `climbLabel`, `climbLoad`. Format stocké :
  `"<couleur>-<niveau>"` (ex. `"bleu-3"`). L'ordre **doit** venir de la table :
  en comparaison de texte `"bleu-1" < "jaune-5"`, c'est-à-dire l'inverse de la
  difficulté réelle (test dédié sur ce piège).
- **AUCUNE nouvelle clé localStorage** : les blocs vivent dans l'entrée de séance
  existante (`blocs: [{ cotation, issue }]`, `issue` ∈ flash/essais/echec), à
  côté de `duration` et `rpe`, exactement comme `exercices` pour la muscu. Le
  champ est **omis** quand aucun bloc n'est saisi — une séance sans blocs reste
  bit pour bit ce qu'elle était avant V5.
- **Métriques dérivées, jamais stockées** : volume (nb de blocs), intensité
  (cotation max et **médiane**), réussite (flash/essais/échec). Choix explicites :
  les échecs comptent dans le **volume** (ils chargent le tendon autant, sinon
  plus) mais pas dans l'intensité réussie — d'où `max`/`mediane` sur les blocs
  réussis et `max_tente` à part. La médiane d'un nombre pair prend l'élément
  inférieur du milieu : « Bleu 3½ » n'existe pas, la valeur affichée doit rester
  une vraie cotation. Une cotation **hors échelle** compte dans le volume mais
  pas dans l'intensité — elle charge le coude quoi qu'il arrive, et c'est ce qui
  protège les blocs éventuellement saisis en Fontainebleau avec la v3.46.0.
- **Saisie pensée pour la salle** (`BlocsField`) : une issue « armée » en haut
  (défaut « après essais », le cas fréquent), puis **une ligne par couleur** avec
  sa pastille et les niveaux 1 à 5 — chaque tap ajoute un bloc et la case affiche
  son compteur. Récap groupé par (cotation, issue) avec des boutons **−/+** pour
  ajuster une quantité d'un pouce, c'est le « plusieurs blocs d'un coup »
  demandé. Jamais de champ texte libre.
  **Les pastilles de couleur sont la seule entorse admise au « accent citron
  uniquement »** du design system : ici la couleur EST la donnée, pas une
  décoration. Le noir est rendu en gris clair — sur un fond `#050505` un vrai
  noir serait invisible.
- **Le vrai bénéfice — recommandeur** : `climbLoad` classe la dernière séance en
  légère (≤ 8 blocs) / normale / grosse (≥ 18) et **module la pénalité** sur
  Upper et Escalade (4 / 8 / 14 au lieu du forfait 8), avec une raison chiffrée
  (« Escalade hier : 20 blocs (max Rouge 2) — grosse session, tirage lourd sur le
  coude »). **Mesuré dans l'aperçu, même situation par ailleurs** : Upper 47
  (session légère) vs 43 (séance sans blocs, comportement d'origine) vs 37
  (grosse session, où Lower passe devant). Croisé avec la douleur de coude réelle
  (V1), c'est la première fois que la charge de tirage est évaluée sur des faits.
- **Pas de charge supposée quand la donnée manque** : `climbLoad` renvoie `null`
  si la séance n'a pas de blocs (tout l'historique d'avant V5), et le
  comportement forfaitaire d'origine s'applique alors tel quel — vérifié.
- **Coach IA** : `autresSeances` porte le **résumé** (`blocs: {n, max, mediane,
  max_tente, flash, essais, echec}`) avec sa légende, jamais la liste brute —
  sur une séance de 20 blocs elle coûterait des tokens pour un signal que le JS
  calcule exactement.
- « Dernières séances » affiche « 60′ · RPE 7 · 4 blocs · Rouge 1 max ».

### V6 — Corriger les valeurs d'un aliment (03/08/2026, v3.48.0)

Répond au `+?` : un produit Open Food Facts sans teneur en fibres affichait un
total honnête mais définitivement incomplet, sans aucun moyen de le corriger.

- **Nouvelle clé `foodOverrides`** (`{ [ref]: { kcal?, prot?, gluc?, lip?, fib? } }`,
  partielle), ajoutée à `DATA_KEYS`. La perdre rendrait tout l'historique corrigé
  silencieusement faux — elle est encore moins optionnelle que les autres.
- **Rétroactif — confirmé explicitement par Yoann le 03/08/2026** (la roadmap
  laissait la décision ouverte). Une correction s'applique **à la lecture**, donc
  partout, y compris aux repas déjà enregistrés.
- **Couche séparée, jamais écrite dans le journal** : `resolveLog(log, overrides)`
  produit un journal résolu ; `useFoodLog` garde l'état brut (`raw`) pour toutes
  les **écritures** et n'expose que le résolu en **lecture**. Conséquence : les
  `per100` d'origine ne sont jamais touchés, donc retirer une correction rend leur
  valeur d'origine à toutes les lignes. **Piège évité au passage** : si les
  mutations partaient du journal résolu, la première modification d'une ligne
  figerait la valeur corrigée et la correction cesserait d'être réversible.
- Ce n'est **pas** un reniement du snapshot figé à la saisie (M1) : celui-ci
  existe pour se protéger d'une source EXTERNE qui change sous les pieds, pas pour
  empêcher Yoann de corriger sa propre donnée quand il sait qu'elle est fausse.
  `onAdd` envoie toujours le `per100` **d'origine**, même quand l'écran affiche la
  valeur corrigée — sinon les saisies futures figeraient la correction.
- **Saisie** : lien « Corriger les valeurs de cet aliment » dans la fiche
  (`QtyPanel`) → 5 champs **pour 100 g** (comme les tables source et l'emballage).
  Champ vide = pas de correction sur cette macro. Une valeur retapée **identique**
  à celle de la table n'est pas enregistrée comme correction — sinon elle
  s'afficherait en accent et survivrait à une mise à jour de la table.
- **Marqueur visuel** (une correction ne doit jamais être invisible) : valeur en
  accent + `*` dans la fiche, phrase explicative, et `*` accent après le nom de
  l'aliment sur chaque ligne du journal.
- **LE PIÈGE, vérifié explicitement** : la dérivation M6 tourne sur le journal
  résolu, donc `macroLog` est mis à jour rétroactivement — mais `deriveMacroLog`
  ne renvoie **que les dates présentes dans `foodLog`**. Testé bout en bout avec un
  historique Cronometer seedé au 15/07 (`source: "healthconnect"`) : après
  correction des fibres, la date historique est **identique au bit près**, les
  deux dates du journal passent de `+?` à 7 g et 3,5 g, et le `foodLog` stocké
  garde ses `fib: null`. 11 assertions supplémentaires sur les fonctions pures.

### V7 — Dépense énergétique adaptative (04/08/2026, v3.49.0)

Livrée **immédiatement en usage réel**, pas seulement le code : demande explicite de Yoann
("je veux qu'il commence tout de suite, j'ai bien rempli le journal") après que la roadmap
avait suggéré d'attendre 2-3 semaines. Décision : ne rien retarder — l'algorithme a de toute
façon un garde-fou intégré (`"pas assez de données"` plutôt qu'un chiffre non fiable), donc
le construire maintenant ne peut rien afficher de trompeur ; il commence juste à produire un
vrai chiffre dès que l'historique réel (poids + macros, `macroLog` compris pour les dates
antérieures au module Repas) le permet — pas besoin d'attendre que tout vienne de `foodLog`.

- **Nouveau module `src/tdee.js`**, pur (testable en Node, aucune dépendance React/ui.jsx) :
  `computeTDEE`, `mergeKcalSeries`, `smoothedWeightSeries`, `trendAt`, `realDeficit`.
  **Aucune nouvelle clé localStorage** : c'est un calcul, jamais une donnée stockée.
- **Tendance de poids** : moyenne mobile **exponentielle** (jamais le brut), demi-vie 7 j
  (réagit en ~7-10 j comme demandé), alpha ajusté à l'écart réel entre deux pesées
  (`1-(1-alpha)^gap`) pour qu'un trou de plusieurs jours ne fige pas artificiellement la
  tendance. Calculée sur **tout l'historique disponible** (pas seulement la fenêtre
  retenue) : sans préchauffe avant la fenêtre, le décalage inhérent à toute EMA fausserait
  la pente sur une perte linéaire — vérifié par test (60 j d'historique, écart au résultat
  théorique de la roadmap sous 15 kcal).
- **Fenêtre** : cherche la PLUS LONGUE parmi [28, 21, 14] jours qui atteint 70 % de jours
  avec des apports loggés (jamais moins de 14, jamais un chiffre en dessous de ce seuil).
  Un utilisateur avec beaucoup d'historique mais un début de saisie irrégulier obtient donc
  un résultat sur une fenêtre plus courte mais fiable, plutôt qu'un "pas assez de données"
  à tort.
- **Source des kcal — jamais 4/4/9 par défaut** : `mergeKcalSeries` utilise les kcal
  **réelles** de `foodLog` (CIQUAL/OFF, réglement UE 1169/2011, fibres comprises, **et les
  corrections V6 appliquées** — `tdeeNow` résout `foodOverrides` avant de sommer) pour
  chaque date qui y figure, et ne se rabat sur le 4/4/9 de `macroLog` que pour les dates
  antérieures au module Repas (historique Cronometer/Health Connect). Une journée dont
  AUCUNE entrée n'a de kcal connue reste absente plutôt que comptée à 0 (`totals()` sinon
  renverrait 0 pour un jour entièrement inconnu, ce qui biaiserait la moyenne).
- **Piège de la sèche traité, pas seulement documenté** : une fenêtre qui chevauche les 21
  premiers jours de la sèche en cours (`targets.cut.start`) est **toujours** plafonnée à
  fiabilité "faible", quelle que soit la qualité des données par ailleurs — le coefficient
  7700 kcal/kg ne vaut pas pour de l'eau/glycogène. Dès qu'assez de jours POST-phase
  existent (≥14 après `cutStart+21`), la fenêtre choisie les **préfère** et exclut
  entièrement la phase hydrique. **État réel au 04/08/2026** (8 jours après le début de la
  sèche du 27/07) : la fenêtre chevauche forcément encore la phase hydrique, donc la carte
  affiche "fiabilité faible" — normal et attendu, pas un bug.
- **Aucun ajustement automatique des cibles** (décision confirmée de la roadmap) : l'app
  affiche le chiffre et le déficit réel, l'arbitrage reste à Yoann et au Coach IA.
- **Affichage** : carte "Dépense estimée" dans l'onglet Macros (`TdeeCard`), sous la
  tendance calories 14 j. Chiffre + badge de fiabilité coloré (accent/ambre/muted) + jours
  de fenêtre + déficit réel contre la cible **d'aujourd'hui** (jamais celle de la date
  parcourue dans le sélecteur, qui peut être un jour passé) + note explicite si la fenêtre
  chevauche la perte hydrique.
- **Coach IA** : `summary.depense_estimee` (`kcal_j`, `fiabilite`, `fenetre_jours`,
  `deficit_reel_vs_cible`, `chevauche_perte_eau`), calculé par `tdeeNow` — **la même
  fonction que la carte de l'onglet Macros**, jamais deux chiffres différents pour la même
  réalité. Consigne explicite : utiliser ce déficit plutôt que l'estimer à la louche, et le
  nuancer explicitement si la fiabilité est faible ou si la fenêtre chevauche la perte
  d'eau. `"pas assez de données"` si le calcul est insuffisant — jamais un chiffre inventé.
- **Testé** : 15 assertions en Node sur `tdee.js` (formule vérifiée sur l'exemple exact de
  la roadmap, jours manquants ignorés sans fausser la moyenne, <14 j → insuffisant, kcal
  réelles prioritaires sur le 4/4/9, chevauchement de la phase hydrique plafonné, fenêtre
  post-phase préférée dès qu'assez de recul) + vérification bout en bout dans l'aperçu avec
  un historique synthétique réaliste (30 j de poids/macros, 4 j de vrai `foodLog`) :
  carte Macros et prompt Coach IA (`buildBriefing`) affichent **exactement le même chiffre**
  (2803 kcal/j, fiabilité faible, 28 j, déficit −598).

### Réglages divers (04/08/2026, v3.50.0)

Quatre demandes ponctuelles, hors chantier V, groupées dans une même livraison :

- **Orientation verrouillée en portrait** : `android:screenOrientation="portrait"` sur
  `MainActivity` dans `AndroidManifest.xml`. Vérifié dans le manifeste fusionné généré par
  Gradle après `cap sync` — le réglage n'est pas perdu au sync.
- **Carnet de musculation : reps/temps à gauche, poids à droite** (inversion de l'ordre
  précédent). Uniquement les DEUX colonnes de saisie et l'en-tête (`Sér | Reps/Sec | Poids`)
  — le mapping des données (`poids`/`val`) est inchangé, seul l'ordre visuel bouge. Les
  labels texte ailleurs (« dernière fois : 32 kg × 8 », `★ record :`, l'historique
  "progression") gardent leur format `poids × val`, non demandés, non touchés.
- **Alarme de fin de repos, volume ET durée divisés par deux** :
  - Native (`RestAlarmReceiver.kt`) : `alarm.wav` était en réalité **deux moitiés de 1,6 s
    strictement identiques** concaténées (vérifié échantillon par échantillon) — la
    moitié coupée est donc un point de boucle naturel, aucune coupure audible. Fichier
    tronqué à 1,6 s. `player.setVolume(1f,1f)` → `0.5f,0.5f`.
  - PWA (`beep()` dans `App.jsx`, Web Audio) : gain de crête 0,35 → 0,175, espacement et
    durée des 3 impulsions réduits de moitié (~0,57 s → ~0,29 s au total). Même logique
    que le natif, pour que les deux environnements restent cohérents.
  - Vibration non touchée (pas demandé) : `longArrayOf(0,400,200,400,200,600)` inchangé.

## Chantier RawCare — Phase 0 (05/08/2026, v3.54.0)

Première étape technique du chantier RawCare (version grand public envisagée de PROTOCOLE,
voir mémoire `project-public-version` — feuille de route complète en 5 phases publiée en
artifact le 05/08/2026, pas dans ce dépôt). Objectif de la Phase 0, tel que défini dans la
feuille de route : extraire toute la logique métier pure dans un package partagé
`packages/core`, **sans aucun changement de comportement pour l'app perso**. Pas de nouvelle
fonctionnalité — une réorganisation de code, vérifiée à chaque étape par build + tests de
non-régression (même méthode que V3/V7).

- **Monorepo npm workspaces.** Racine du dépôt = gestionnaire de workspaces uniquement
  (`{ private:true, workspaces:["apps/*","packages/*"] }`). L'app actuelle relocalisée telle
  quelle dans `apps/perso/` (nom de package inchangé `protocole-pwa`, aucune fonctionnalité
  touchée). `apps/public/` créée en coquille inerte (juste un `package.json` dépendant de
  `@rawcare/core`, pas encore de code) — prête pour la Phase 2 sans rien engager
  aujourd'hui. Voir la nouvelle structure de fichiers plus haut dans ce document.
- **`packages/core` (`@rawcare/core`)** : moteur de séances (`session/templates.js`,
  `session/perf.js`), TDEE (`tdee.js`, déjà extrait à V7), nutrition
  (`nutrition/ciqual.js`/`off.js`/`scan.js`/`imageUtils.js`/`foodStore.js`), cotation
  escalade (`climbing.js`, déjà extrait à V5), état des zones douloureuses (`pain.js`),
  recommandeur (`recommender.js`), cibles macro/TDEE adaptatif (`targets.js`), construction
  du prompt Coach IA (`coach/prompt.js`, `coach/claudeApi.js`) — exactement le périmètre
  nommé dans la feuille de route. `PAIN_ZONES` (config d'affichage de l'onglet Douleurs)
  reste volontairement côté app : c'est de la présentation UI, le recommandeur ne l'utilise
  même pas.
- **`exports` en wildcard** (`packages/core/package.json`, `"./*": "./src/*.js"`) plutôt
  qu'une liste écrite à la main : mêmes imports `@rawcare/core/training`,
  `@rawcare/core/coach/prompt`, etc., zéro entrée à maintenir à chaque nouveau fichier.
- **Shims de compatibilité** pour que la quasi-totalité des fichiers de `apps/perso` n'aient
  RIEN changé dans leurs imports : `ui.jsx` importe puis ré-exporte les utilitaires de
  date/format (`today`, `daysBetween`, `lastN`, `fmtHM`...) depuis `@rawcare/core/dateUtils` ;
  `src/claudeApi.js` et `src/nutrition/foodStore.js` (partie pure seulement, le hook
  `useFoodLog` reste côté app car il dépend de `store.js`) font de même.
- **`buildPrompt`/`buildBriefing` → `buildCoachPrompt`/`buildCoachBriefing`** (jalon le plus
  risqué, fait en dernier) : c'étaient des fermetures sur ~13 morceaux de state React + des
  appels directs à `getSync`, devenues des fonctions pures prenant un "sac de données" en
  paramètre. `App.jsx` assemble ce sac (state + `getSync` frais, comme avant) dans un
  wrapper `coach.buildPrompt`/`coach.buildBriefing` inchangé côté appelants (`CoachIA`,
  `SettingsPanel`).
- **Non-régression vérifiée par capture avant/après sur données réelles**, pas seulement des
  scénarios synthétiques : dataset seedé dans `localStorage` via le navigateur d'aperçu, hash
  + longueur de `buildPrompt("une note de test").system`, `.user` et `buildBriefing()`
  capturés AVANT le refactor (via un hook temporaire `window.__coach_debug`, retiré avant
  commit) puis APRÈS avec le même état — identiques au caractère près (805/8794/7560
  caractères, mêmes hashes). Pour `recommendSessions`/`zoneState` : diff texte ligne à ligne
  entre l'ancien bloc et le nouveau module (identique à l'export près) PUIS 9 scénarios
  synthétiques (genou hors base, coude ambre, grosse escalade, fenêtre de sèche, sommeil
  court, charge 3 jours, combos) exécutés en Node — comportement conforme à ce qui est
  documenté plus haut dans ce fichier.
- **`netlify.toml` sans `base`** : `command = "npm run build --workspace=apps/perso"`,
  `publish = "apps/perso/dist"` plutôt qu'un `[build] base = "apps/perso"` — évite de
  dépendre d'un réglage "Base directory" du tableau de bord Netlify, invérifiable depuis le
  code. L'installation `npm install` de Netlify tourne à la racine du dépôt (détectée via le
  lockfile racine), là où les workspaces npm ont besoin de tourner pour se lier. **Non
  testé en conditions réelles à cette date** — tout ce chantier est resté sur `dev`, qui ne
  déclenche jamais de build Netlify. Le premier `git push` sur `main` après ce chantier (à la
  demande explicite de Yoann, comme toujours) devra être suivi via les logs de déploiement
  Netlify ; si le `command`/`publish` ne suffit pas, il faudra ajuster depuis là. Un build
  cassé ne remplace jamais le site en ligne — aucun risque de downtime, juste un déploiement
  à corriger.
- **`android/capacitor.settings.gradle`** (généré, code en dur un chemin relatif vers
  `node_modules`) : re-régénéré via `npx cap sync android` depuis `apps/perso/` après le
  déplacement — passe de `../node_modules/...` à `../../node_modules/...` (un niveau de
  profondeur en plus). Vérifié par `git diff` avant de committer le fichier régénéré.
- **`apps/perso/vite.config.js`** reçoit `optimizeDeps: { exclude: ["@rawcare/core"] }` — évite
  un souci connu de pré-bundling esbuild qui empêcherait le rechargement à chaud quand on
  édite un fichier de `packages/core`. Testé explicitement : édition d'un fichier core
  pendant `npm run dev`, mise à jour visible sans redémarrage du serveur.
- **Un dernier `npm run build --workspace=apps/perso` propre à la fin de chaque jalon**,
  plus un test manuel dans l'aperçu (les 8 onglets, Coach IA) — aucune régression détectée à
  aucune étape. Huit commits séparés sur `dev` (un par jalon), pour qu'un problème découvert
  plus tard puisse être isolé au jalon précis qui l'a introduit plutôt que noyé dans un seul
  gros commit.

## Chantier RawCare — Phase 1, premier lot (06/08/2026, v3.55.0)

Suite de la Phase 0. La feuille de route Phase 1 ("Généraliser le cœur") compte 7
sous-chantiers ; deux touchent le moteur du recommandeur lui-même (zones de douleur,
sports/tags de charge) et un troisième nécessite un système d'identité pour les exercices
(bibliothèque d'exercices) — trois redesigns substantiels et imbriqués, sur du code qui
protège en ce moment les tendons de Yoann. Décision prise avec Yoann le 06/08/2026 :
commencer par le lot contenu et à faible risque ci-dessous, traiter le reste (zones de
douleur, sports, bibliothèque d'exercices, types de séance) dans une session dédiée
ultérieure vu l'ampleur.

- **Sélecteur de cotation escalade** (`packages/core/src/climbing.js`) : devient un registre
  de schémas (`SCHEMES.gym` / `SCHEMES.fontainebleau`) au lieu d'une échelle unique codée en
  dur. `gradeIndex`/`climbSummary`/`climbLabel`/`climbLoad` prennent désormais le schéma en
  paramètre explicite (jamais d'état module global). Le schéma "gym" (couleur de salle,
  6 couleurs × 5 niveaux) reste le défaut et reproduit l'ancien comportement à l'identique —
  vérifié par script Node comparant ancien/nouveau sur plusieurs scénarios de blocs.
  Fontainebleau : 23 cotations standard (3 → 8c+), notation universellement connue.
- **Nouveau réglage `climbScheme`** (chaîne `"gym"` par défaut, ajouté à `DATA_KEYS`) :
  sélecteur `Pills` dans les Réglages. **Aucune migration de données** : un bloc déjà logué
  sous un schéma devient simplement hors échelle sous l'autre (compte dans le volume de la
  séance, pas dans le classement par niveau) — même traitement qu'un bloc mal saisi,
  mécanisme déjà existant depuis V5, pas de code nouveau pour ce cas.
- **`BlocsField` à deux modes de rendu** : grille couleur × niveau si le schéma expose
  `colors`/`levels` (cas "gym", inchangé visuellement) ; sinon liste de puces en `flex-wrap`,
  une par cotation (cas "fontainebleau"). Le swatch couleur du récapitulatif ne s'affiche
  qu'en mode grille (`scheme.gradeColor` renvoie `null` pour Fontainebleau de toute façon).
- **`recommendSessions`/`buildCoachPrompt`/`buildCoachBriefing` scheme-aware** : nouveau
  paramètre `scheme` (aucun autre changement de logique). Le paragraphe d'instruction du
  Coach IA sur l'échelle de cotation devient conditionnel : texte identique à l'existant si
  `scheme.id === "gym"`, note courte ("échelle Fontainebleau standard") sinon — plus de mise
  en garde "ne pas convertir en Fontainebleau" hors du cas où c'est réellement le schéma actif.
  Vérifié par diff sur les 9 scénarios synthétiques de Phase 0 (recommandeur) et par capture
  hash avant/après sur données réelles seedées (Coach IA), schéma "gym" — identique au
  caractère près dans les deux cas.
- **Cibles macro de base éditables** : nouvelle carte "Cibles macro de base" dans les
  Réglages (protéines/glucides/lipides/fibres/poids de maintenance), même pattern que les
  éditeurs eau/fenêtre de sèche déjà en place. Comble le seul vrai manque trouvé à
  l'exploration : ces champs n'avaient aucun éditeur nulle part, seuls des défauts codés en
  dur dans `DEFAULT_TARGETS`. Aucun changement de `packages/core` requis —
  `targetsForDate`/`phaseTarget`/`kcalFromMacros` lisaient déjà ces champs.
  **Précision de périmètre** : la feuille de route parle de cibles "configurables à
  l'onboarding", mais aucun flux de première ouverture n'existe encore (ni côté
  `apps/perso`, ni côté `apps/public` qui est toujours une coquille vide) — un onboarding
  n'a nulle part où s'accrocher pour l'instant. Cet éditeur Réglages est la brique
  nécessaire pour qu'un futur onboarding ait quelque chose à appeler, pas l'onboarding
  lui-même.
## Chantier RawCare — Phase 1, deuxième lot (06/08/2026, v3.56.0)

Suite immédiate du premier lot, même session (contrainte pratique : Yoann en accès distant,
sans PC pour reprendre plus tard). En lisant `recommendSessions` en entier (206 lignes),
chaque type de séance a une formule de score et des conditions d'exclusion **entièrement
sur mesure** — aucune généralisation propre du moteur de score n'est possible sans le
réécrire, sur du code qui protège en ce moment les tendons de Yoann. Pas de pari pris sous
contrainte de temps sur ce point précis.

**Portée retenue** : enrichir le MODÈLE DE DONNÉES dans `packages/core`, sans toucher au
moteur de score ni à l'UI active de Yoann — zéro changement de comportement pour `apps/perso`,
vérifié par diff comme le reste de la Phase 0/1.

- **Exercices existants taggés** (`packages/core/src/session/templates.js`) : chaque exercice
  des 4 gabarits muscu de Yoann (Upper A/B, Lower A/B) gagne `groupe`/`mouvement`/`materiel`/
  `tendon`. **L'identité de l'exercice ne change pas** (`n` reste la même chaîne — c'est la
  clé dans `DEFAULT_WEIGHTS`/`lastPerf`/`perfHistory` et dans tout `trainingLog`, donc
  l'historique continue de matcher à l'identique). Vérifié par diff : tous les champs déjà
  présents (valeurs incluses) sont restés identiques, seuls des champs nouveaux ont été
  ajoutés.
- **`chargeTags` sur les types de séance existants** : `["tirage"]` pour Upper A/B et
  Escalade, `["genou"]` pour Lower A/B et Basket. Les flags `knee`/`climb`/`hsr` déjà lus
  par `recommendSessions` **restent inchangés en parallèle** — `chargeTags` est une couche
  de métadonnées en plus, pas un remplacement du mécanisme actuel.
- **`packages/core/src/session/catalog.js`, nouveau, jamais importé par `apps/perso`** :
  `SPORTS_CATALOG` (Course à pied, Vélo, Foot) et `SESSION_TYPES_CATALOG` (Full body, et un
  Bro split en 4 jours — Pecs/Triceps, Dos/Biceps, Épaules, Jambes), même forme que
  `TEMPLATES` (`kind`/`chargeTags`/`exos` taggés). Yoann ne pratique aucun de ces sports et
  ne suit pas ces splits : les ajouter à son picker aurait été du bruit dans SON app,
  contraire à la règle transversale de la feuille de route ("chaque brique testée d'abord
  SUR ton app perso comme config par défaut : ton usage quotidien ne change pas"). Ce fichier
  prouve que le modèle de données scale au-delà des 6 types actuels ; une future
  `apps/public` pourra le lire pour laisser un utilisateur choisir/activer ses propres
  sports et son propre split. **Charge genou tranchée avec Yoann** : Foot et Course à pied
  traités comme le Basket (gate dur si genou hors base), Vélo sans tag `genou` (pas
  d'impact).
- **Non fait à ce lot, repris au lot suivant** : réécriture du moteur de score de
  `recommendSessions` pour qu'il note génériquement n'importe quel sport à partir de
  `chargeTags` — voir le lot suivant, qui l'a fait.

## Chantier RawCare — Phase 1, troisième lot (06/08/2026, v3.57.0)

Suite immédiate du deuxième lot, même session (contrainte pratique : Yoann en accès distant,
sans PC pour reprendre plus tard). Reprend le point explicitement repoussé au lot précédent :
le moteur de score de `recommendSessions`, câblé en dur sur les 6 types nommés
(`isUpper`/`isLower`, littéraux `"Basket"`/`"Escalade"`).

**Reconsidération par rapport au lot précédent** : la question du stockage des zones de
douleur (deux clés `kneeLog`/`elbowLog` figées vs stockage dynamique) semblait bloquer cette
généralisation. En relisant `recommendSessions` en entier, ce n'est pas le cas : le moteur
peut devenir générique sur un **tableau de zones** en interne, tout en restant appelé avec
exactement les deux zones actuelles, construites à partir des mêmes `kneeLog`/`elbowLog`
qu'aujourd'hui. **Aucun changement de stockage, aucune migration** — cette question reste
repoussée (toujours pour la même raison : décision à prendre au calme), mais elle n'était
plus un blocage pour ce lot.

- **`packages/core/src/pain.js`, nouvelle fonction `buildZones({ knee, elbow }, t0)`** :
  regroupe les deux zones en une liste (`{ key, label, gateTag, unknownIsCaution,
  coachClause, state }`), `state` étant le `zoneState(...)` déjà existant et inchangé.
  `gateTag` fait le lien avec `chargeTags` sur `TEMPLATES` : le genou gate/pénalise tout
  type taggé `"genou"`, le coude tout type taggé `"tirage"`.
- **`packages/core/src/recommender.js` généralisé par tag, pas par nom** :
  - `dKnee`/`kneeToday` (exposition récente au tag "genou") passent de
    `TEMPLATES[t.type]?.knee` (un flag dédié) à `TEMPLATES[t.type]?.chargeTags?.includes("genou")`
    — un futur sport du catalogue taggé "genou" (Foot, Course à pied) hériterait déjà du
    cooldown 48h et du gate dur sans toucher au recommandeur.
  - Nouvelle table `AMBER_PENALTY` (magnitude de pénalité par zone ambre × type porteur du
    tag : `Lower A/B` -10, `Basket` -8 pour "genou" ; `Upper A/B` -10, `Escalade` -12 pour
    "tirage") remplace les constantes éparpillées dans le code — ajouter un sport genou/
    tirage plus tard est une ligne dans cette table, pas une nouvelle branche.
  - **Ce qui reste explicitement du code dédié, pas généralisé** (parce que ce sont des
    comportements de sport, pas des règles de zone) : la modulation de pénalité par
    `climbLoad` (volume réel de blocs, propre à l'escalade), le choix de variante A/B
    (`variant()`), les exclusions croisées "déjà fait aujourd'hui" entre types de même tag,
    et **tout le texte des raisons affichées** (langage naturel propre à chaque sport,
    volontairement différent d'un type à l'autre — le généraliser aurait fait perdre la
    nuance voulue).
- **`packages/core/src/coach/prompt.js`** : la phrase "Deux tendinopathies en rééduc : ..."
  du system prompt, câblée en dur pour exactement 2 zones, est reconstruite en itérant sur
  `buildZones(...)` (chaque zone porte sa propre `coachClause`) — produit un texte
  identique au caractère près pour les 2 zones actuelles.
- **Vérification, la plus poussée du chantier RawCare à ce jour** : 18 scénarios de diff
  (les 9 de la Phase 0 + 9 nouveaux ciblant spécifiquement chaque nuance non généralisée :
  cooldown genou via Lower ET via Basket, magnitudes de pénalité Lower≠Basket et
  Upper≠Escalade, exclusions croisées tirage/genou) — identiques au caractère près entre
  l'ancien `recommendSessions` et le nouveau. Capture hash avant/après pour
  `buildCoachPrompt`/`buildCoachBriefing` sur données réelles seedées — un premier écart
  observé s'est révélé être une comparaison contre une capture périmée (données de séances
  sorties de la fenêtre de 7 jours entre deux captures à plusieurs heures d'écart dans la
  même session, pas une régression) : reconfirmé par une capture avant/après refaite dos à
  dos, identique.
- **Ce qui reste, inchangé par rapport au lot précédent** : stockage dynamique des zones de
  douleur, activation du catalogue côté UI, rôle du Coach IA pour un public multi-utilisateur
  — toujours pour les mêmes raisons (décision de migration à ne pas presser, pas de
  consommateur avant `apps/public`).

## Chantier RawCare — Phase 1, quatrième lot (06/08/2026, v3.58.0)

Reprend le point resté délibérément hors scope au lot précédent : `zoneState`/`buildZones`
(`packages/core/src/pain.js`) prenaient exactement 2 zones nommées "genou"/"coude" en dur,
avec des seuils Silbernagel (péremption, seuil rouge, seuil ambre) figés en constantes.
Généralisés en un **cadre** — N zones arbitraires, chacune avec ses propres seuils réglables
— pour coller à l'ambition de la feuille de route ("cadre configurable libre ... zéro zone
par défaut"), sans toucher au stockage.

- **`zoneState(log, t0, label, opts)`** accepte désormais `freshDays`/`redPainThreshold`/
  `amberPainThreshold`/`flaggedWindowDays` en plus de `unknownIsCaution`, tous optionnels
  avec une valeur par défaut identique à l'ancien comportement figé (3 j / 6 / 4 / 6 j) —
  une zone qui ne les précise pas se comporte donc à l'identique.
- **`buildZones(zoneDefs, logs, t0)`** remplace `buildZones({knee, elbow}, t0)` : prend une
  liste de définitions de zone (`key`/`label`/`gateTag`/`unknownIsCaution`/`coachClause` +
  seuils optionnels) et une map `{[key]: journal}`, au lieu d'exactement deux journaux nommés.
- **Nouveau `DEFAULT_ZONES`** (`packages/core/src/pain.js`) : la config des deux zones
  réelles de Yoann (genou, coude), désormais consommée par `recommender.js` et
  `coach/prompt.js` via `buildZones(DEFAULT_ZONES, { knee, elbow }, t0)` — **aucun changement
  de comportement pour `apps/perso`**, qui continue de fournir exactement les mêmes deux
  journaux `kneeLog`/`elbowLog` qu'avant.
- **Stockage toujours pas migré, volontairement** : `apps/perso` n'a aucune notion de zone
  dynamique, aucune UI, aucune clé nouvelle. La question kneeLog/elbowLog figés vs stockage
  arbitraire reste hors scope — c'est une décision de migration de données, pas un prérequis
  pour que le moteur sache gérer N zones. Une future `apps/public` construirait sa propre
  liste de zones (nom libre, seuils choisis par l'utilisateur, zéro zone par défaut) sans
  passer par `DEFAULT_ZONES`.
- **Vérifié par diff caractère près** : script Node capturant `recommendSessions(...)` et
  `buildZones(...)` sur 6 scénarios (vide, genou rouge, genou hors base, coude ambre, coude
  rouge, combo 3 séances + sommeil court) avant/après le refactor — sortie identique au bit
  près. Build `apps/perso` propre, testé dans l'aperçu (Dashboard, carte « Prochaine
  séance ») sans erreur console.
- **Ce qui reste, inchangé par rapport aux lots précédents** : stockage dynamique réel des
  zones (clé arbitraire côté `apps/perso`/`apps/public`), bibliothèque d'exercices avec
  système d'identité (au-delà du `n`/`nom` actuel, qui reste la clé de tout l'historique),
  activation du catalogue côté UI, rôle du Coach IA pour un public multi-utilisateur — tous
  attendent un vrai consommateur (`apps/public`, Phase 2).

## Chantier RawCare — Phase 2, premier et deuxième jalons (06/08/2026, apps/public v0.1.0)

Premier code réel dans `apps/public` (jusque-là une coquille inerte). Projet Supabase créé
par Yoann (organisation `yoannrolland-dwy's Org`, projet `rawCARE`, région UE). Bêta fermée :
comptes créés à la main par Yoann dans le dashboard Supabase, **pas d'inscription libre**.

- **Choix de schéma : une seule table `user_data`** (`user_id uuid primary key references
  auth.users`, `data jsonb`) plutôt qu'une table par type de donnée. La colonne `data`
  reprend exactement la forme de l'export JSON actuel de `apps/perso`
  (`{weightLog, trainingLog, macroLog, ...}` — les mêmes clés que `DATA_KEYS` dans
  `apps/perso/src/store.js`). Décision motivée par "backend minimal, sans sur-construire"
  (feuille de route) : `packages/core` consomme déjà ces objets JS tels quels, donc zéro
  couche de transformation ; et la sécurité se résume à UNE règle simple à auditer
  (`auth.uid() = user_id`) plutôt qu'à répéter la même règle sur 21 tables. SQL exécuté par
  Yoann dans l'éditeur SQL Supabase (RLS activé, policies select/insert/update scopées à
  `auth.uid()`, pas de policy delete pour l'instant).
- **`apps/public/src/supabaseClient.js`** : lit `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  depuis `.env.local` (gitignored, `.env.example` committé comme modèle). `createClient`
  lève une exception SYNCHRONE si l'URL est vide — `supabase` reste `null` tant que les
  variables ne sont pas renseignées plutôt que de planter l'app au chargement (piège trouvé
  et corrigé pendant ce jalon).
- **Auth email/mot de passe** (`LoginScreen.jsx`, `useAuth.js`) : pas de lien "créer un
  compte" (bêta fermée). `useAuth` s'appuie uniquement sur
  `supabase.auth.onAuthStateChange`, qui couvre à la fois l'état initial et les changements
  ultérieurs — pas besoin d'un `getSession()` séparé en plus.
- **`userData.js`** : `loadUserData`/`saveUserData`, upsert d'une ligne vide au premier
  login (un nouveau bêta-testeur n'a par définition aucune donnée).
- **`Home.jsx`** : écran minimal avec un champ "note de test" qui écrit dans
  `data.testNote` — sert uniquement à prouver le trajet complet (connexion → écriture →
  relecture après un vrai rechargement de page), pas une fonctionnalité. **Testé de bout en
  bout avec le vrai compte de Yoann** : connexion, session qui survit à un F5, note
  sauvegardée relue après rechargement complet, déconnexion — les quatre confirmés dans le
  navigateur d'aperçu.
- **`apps/public/src/ui.js`** : sous-ensemble minimal des jetons "Affirmée" (couleurs,
  inputs, boutons) — à étoffer avec les vrais écrans, pas une réplique complète de
  `apps/perso/src/ui.jsx` à ce stade.
- **Port de dev dédié (5174)**, distinct de `apps/perso` (5173), pour pouvoir lancer les
  deux en parallèle sans conflit — nouvelle entrée `rawcare-public-dev` dans
  `.claude/launch.json`.
- **Non fait à ce stade, volontairement** : aucun vrai écran de données (séances, macros,
  douleurs...), pas de synchro avec `packages/core` au-delà de la preuve de trajet, pas de
  déploiement (`apps/public` ne tourne qu'en local pour l'instant, aucun site Netlify créé
  pour elle).

## Chantier RawCare — Phase 2, troisième jalon (06/08/2026, apps/public)

Premier vrai écran de données : Poids, choisi pour valider le schéma `user_data` sur une
fonctionnalité réelle avant de dérouler séances/macros/douleurs. Décisions prises avec Yoann
avant de coder (questions posées explicitement, ambiguïtés non tranchées par la feuille de
route) : nav minimale à 2 onglets plutôt que remplacer `Home`, pas de graphique pour ce
premier écran (recharts non ajouté), sélecteur de date natif (`<input type="date">`) plutôt
que porter le `DateField` custom de `apps/perso`.

- **`WeightTab.jsx`** : lit/écrit `data.weightLog`, **même forme que `apps/perso`**
  (`{date, kg}`) — aucune transformation de schéma. Réutilise `today`/`upsert`/`round`/`fmt`
  depuis `@rawcare/core/dateUtils` tels quels (déjà purs, déjà partagés depuis la Phase 0),
  zéro logique de date dupliquée. Carte valeur actuelle + formulaire date/poids + historique
  (10 dernières pesées) — pas de graphique, pas de cible de phase (aucune notion de
  phase/cibles côté `apps/public` à ce stade).
- **`useUserData.js`**, nouveau hook partagé : extrait du chargement/écriture qui vivait
  jusque-là dans `Home.jsx` seul. Chargé UNE fois par le parent (`App.jsx`) et partagé entre
  les onglets — changer d'onglet ne refait pas de round-trip Supabase, seul `update(patch)`
  (fusion + sauvegarde) écrit.
- **Nav à 2 onglets** (`App.jsx`) : en-tête (logo + déconnexion) et barre d'onglets
  Accueil/Poids partagés, remplace l'orchestration à un seul écran des jalons précédents.
  `Home.jsx` adapté pour recevoir `data`/`update`/`error` en props au lieu de charger lui-même
  — son rôle de preuve de round-trip (`testNote`) reste inchangé.
- **`apps/public/src/ui.js` → `ui.jsx`** (renommage) : le fichier contient désormais du JSX
  (nouvelles primitives `Card`/`Label`/`Big`/`Empty`, plus `buttonDanger`) — nécessaire pour
  qu'esbuild le parse, comme `apps/perso/src/ui.jsx`. Tous les imports mis à jour.
- **Vérifié** : build `apps/perso` ET `apps/public` propres après le changement (règle
  absolue #2). Écran de connexion revérifié sans erreur console dans l'aperçu. **Écran Poids
  testé de bout en bout par Yoann avec son vrai compte** (`rawcare-public-dev`, port 5174) :
  3 pesées saisies, déconnexion, reconnexion — les 3 valeurs toujours là. Round-trip
  `weightLog` dans `user_data` confirmé, pas seulement en théorie.
- **Non fait à ce stade** : les autres écrans de données (séances, macros, douleurs),
  déploiement de `apps/public`.

## Chantier RawCare — Phase 2, quatrième jalon (06/08/2026, apps/public)

Deuxième écran de données, dans l'ordre des onglets de `apps/perso` (Tableau de bord, Poids,
**Sommeil**, Pas, Séances, Douleurs, Macros, Repas). Même minimalisme que le jalon Poids (pas
de graphique, pas de moyenne 7 jours) — aucune nouvelle question posée à Yoann, les décisions
prises pour Poids s'appliquaient directement.

- **`SleepTab.jsx`** : lit/écrit `data.sleepLog`, même forme que `apps/perso` sur les champs
  qui font sens ici (`{date, hours, quality}` — pas de `source`, `apps/public` n'a pas de
  synchro Health Connect). **Saisie en heures + minutes, jamais décimal** : reprend la
  décision déjà actée pour `apps/perso` (voir plus haut) — ce n'était pas ambigu, donc pas
  reposé en question.
- **`Pills` porté depuis `apps/perso/src/ui.jsx` vers `apps/public/src/ui.jsx`** (sélecteur
  qualité 1-4 étoiles) : premier composant généraliste au-delà de ce qui était strictement
  nécessaire pour Poids — anticipé comme réutilisable (Douleurs y ressemblera).
- **Nav passée de 2 à 3 onglets** (`App.jsx`) : la barre boutons `flex:1` du jalon précédent
  aurait mal vieilli une fois les 8 onglets présents ; passée en rangée `overflow-x: auto`
  avec boutons à largeur naturelle (`flex: 0 0 auto`) — changement direct, pas une question
  à poser, nécessité mécaniquement par l'ajout d'un 3e onglet.
- **Testé de bout en bout dans le navigateur d'aperçu, avec la session déjà active de
  Yoann** (pas de saisie d'identifiants) : nuit 7h30/★★★ saisie, carte "Dernière nuit" et
  historique mis à jour, **persistance vérifiée après un rechargement complet de la page**
  (round-trip Supabase réel, pas juste l'état React local) — puis entrée de test supprimée
  pour ne pas polluer les vraies données de Yoann.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Pas (prochain dans l'ordre), Séances, Douleurs, Macros, Repas ;
  déploiement de `apps/public`.

## Chantier RawCare — Phase 2, cinquième jalon (06/08/2026, apps/public)

Troisième écran de données, dans l'ordre : **Pas**. Même minimalisme que Poids/Sommeil.

- **`StepsTab.jsx`** : lit/écrit `data.stepsLog`, même forme que `apps/perso` sur les champs
  pertinents (`{date, count}`, pas de `source`). Cible fixe 10 000 pas/jour reprise telle
  quelle de `STEPS_TARGET` (apps/perso) — pas une donnée à configurer, donc pas de nouvelle
  clé de réglage. Barre de progression simple (pas un graphique recharts) contre la cible,
  cohérent avec le reste de l'écran "actuel" déjà utilisé pour Poids/Sommeil.
- Nav passée à 4 onglets (Accueil/Poids/Sommeil/Pas), aucun changement de structure
  nécessaire (la barre scrollable posée au jalon précédent absorbe l'ajout).
- **Testé de bout en bout** dans le navigateur d'aperçu avec la session déjà active de
  Yoann : 8 500 pas saisis, carte + historique mis à jour, **persistance vérifiée après un
  rechargement complet de la page** (round-trip Supabase réel), puis entrée de test
  supprimée pour ne pas polluer les vraies données.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Séances (prochain dans l'ordre — plus gros morceau, carnet de
  musculation série par série), Douleurs, Macros, Repas ; déploiement de `apps/public`.

## Chantier RawCare — Phase 2, sixième jalon : Poids/Sommeil/Pas à parité (06/08/2026)

Revirement explicite de Yoann après les trois premiers écrans minimalistes : "je ne veux
plus d'onglet minimaliste, je veux qu'ils soient normaux" — parité visuelle et fonctionnelle
avec `apps/perso` (graphiques, moyennes 7j, cible de poids par Phase), pas une version
dégradée. Fait AVANT Séances (Phase B), pour que le carnet complet parte des vraies
primitives plutôt que du sous-ensemble ad hoc initial.

- **`apps/public/src/ui.jsx` remplacé par une copie verbatim d'`apps/perso/src/ui.jsx`**
  (confirmé identique par `diff`) : mêmes jetons `C` (`text2`, `borderDim`, `accentRow`,
  `dangerBg`/`Border`/`Text`), mêmes primitives (`Card`, `Label`, `Body`, `Big`, `Empty`,
  `Btn`, `inputStyle(focused)`, `TextInput`, `Stepper`, `Field`, `DateField`, `Pills`,
  `ScreenHeader`, `chartAxis`/`tooltipStyle`/`tooltipItemStyle`). Le fichier ne dépendait
  déjà que de React et `@rawcare/core/dateUtils` — 100 % portable sans adaptation.
  **`DateField` s'est avéré être un simple `<input type="date">`** habillé par `Field`, pas
  un calendrier custom : le porter n'a donc rien coûté de plus que porter `Field`/
  `inputStyle`. Tous les fichiers consommateurs (`LoginScreen.jsx`, `Home.jsx`, `App.jsx`,
  `WeightTab.jsx`, `SleepTab.jsx`, `StepsTab.jsx`) réécrits pour utiliser ces vrais
  noms/composants au lieu du sous-ensemble ad hoc précédent (`C.secondary`→`C.text2`,
  `buttonPrimary`/`buttonDanger` bruts → `Btn variant="primary"/"danger"`, inputs nus →
  `Field`/`DateField`/`Stepper`).
- **Nouvelles dépendances `apps/public`** : `recharts` et `lucide-react` (mêmes versions
  qu'`apps/perso`) — graphiques et icônes des boutons.
- **`WeightTab.jsx`** : `LineChart` 60 jours + `ReferenceLine` sur la cible, carte Phase
  (Sèche/Maintenance/Prise, `Pills` + message) déplacée directement dans l'écran Poids
  plutôt que sur un Dashboard qui n'existe pas encore côté `apps/public` — `PHASES`/
  `phaseTarget`/`DEFAULT_TARGETS` réutilisés tels quels depuis `@rawcare/core/targets`.
  Nouveaux champs `data.phase` (défaut `"seche"`) et `data.targets` (fusionné à la lecture
  avec `DEFAULT_TARGETS`, même pattern défensif qu'`apps/perso`, prêt pour Macros).
- **`SleepTab.jsx`** : mini-barres 7 nuits + `BarChart` 21 jours + moyenne 7j, ajoutés
  sans changer la saisie heures/minutes déjà en place.
- **`StepsTab.jsx`** : moyenne 7j + `BarChart` 21 jours avec `ReferenceLine` sur la cible
  10 000, ajoutés sans changer la barre de progression déjà en place.
- **Testé de bout en bout** dans le navigateur d'aperçu (session déjà active de Yoann) :
  rendu des trois écrans confirmé visuellement identique à `apps/perso` (captures d'écran
  comparées), bascule de Phase sur Poids vérifiée (cible 93→95 kg en changeant Sèche→Prise,
  remise sur Sèche ensuite pour ne pas altérer le réglage réel de Yoann sans demande),
  round-trip Supabase revérifié après rechargement complet sur Sommeil ET Pas, entrées de
  test nettoyées. Aucune erreur console.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Phase B (Séances, carnet complet) enchaîne directement sur ce
  jalon, en réutilisant les primitives désormais partagées.

## Chantier RawCare — Phase 2, septième jalon : Séances, carnet complet (06/08/2026)

Cinquième écran de données d'`apps/public`, dans l'ordre : **Séances**. Contrairement aux
écrans précédents, Yoann a choisi explicitement le carnet complet dès ce jalon (série par
série, templates, HSR, minuteur, records) plutôt qu'une version dégradée — validé en amont
via un plan détaillé (`EnterPlanMode`/`ExitPlanMode`) vu l'ampleur du morceau.

- **Toute la logique métier venait déjà de `packages/core`**, extraite lors des chantiers
  V3/V4/V5/RawCare Phase 0/1 : `session/templates.js` (`TEMPLATES`, `TYPES`,
  `DEFAULT_WEIGHTS`, `HSR_TABLE`, `hsrForWeek`, `hsrParse`, `parseSecs`), `session/perf.js`
  (`lastPerf`, `lastExerciseSets`, `perfHistory`, `medianTarget`), `training.js` (`bestSet`,
  `isTimeMode`, `setScore`, `setLabel`, `exerciseSessions`, `exerciseList`, `exerciseTrend`,
  `beats`, `recordToBeat`, `recordsBySession`, `painOutOfBase`), `climbing.js` (`SCHEMES`,
  `ISSUES`, `gradeIndex`, `climbSummary`, `climbLabel`). Ce jalon est donc resté un travail
  d'UI React consommant des fonctions pures existantes — aucune nouvelle logique métier.
- **Nouveaux fichiers** : `SessionsTab.jsx` (≈ `TrainTab`), `MuscuLogger.jsx` (≈
  `MuscuLogger`, port quasi verbatim), `BlocsField.jsx` (≈ `BlocsField`, port quasi
  verbatim), `ProgressScreen.jsx` (≈ `ProgressScreen` + `ExerciseDetail` fusionnés).
- **Simplifications assumées** (signalées, pas cachées) :
  1. **Minuteur web-only** : `apps/public` est un site web pur, pas de Capacitor — bip Web
     Audio + vibration seulement, sans la branche `scheduleRestAlarm`/`AlarmManager`
     (exactement le chemin déjà emprunté par `apps/perso` dans un navigateur, pas dans
     l'app native).
  2. **`SCHEMES.gym` figé** (cotation escalade) : pas de réglage `climbScheme`/Réglages côté
     `apps/public` pour l'instant.
  3. **`painOutOfBase` reçoit `data.kneeLog`/`data.elbowLog`, actuellement toujours `[]`**
     (Douleurs n'existe pas encore, prochain jalon) — la suppression d'affichage des records
     un jour de douleur hors base est donc inactive pour l'instant, s'activera d'elle-même
     sans changement de code une fois Douleurs livré.
  4. **`hsrWeek` stocké comme simple champ `data.hsrWeek`** (défaut 1), réglable directement
     depuis l'écran Séances, pas de Réglages dédiés.
  5. **`ProgressScreen` sans graphique recharts** (liste "séance par séance" + tendance
     texte) — contrairement à Poids/Sommeil/Pas, pas demandé explicitement pour cet écran.
- **Pastille flottante du minuteur repositionnée** : `apps/perso` réserve `76px` en bas pour
  sa barre d'onglets (en bas d'écran) ; `apps/public` a sa nav en haut, donc juste une marge
  de sécurité (`16px` + safe-area) sans réservation d'espace.
- **Testé de bout en bout** dans le navigateur d'aperçu (session déjà active de Yoann) :
  séance Upper A avec une série cochée (préremplissage vérifié : reps au médian, poids par
  défaut), minuteur auto-lancé au clic + pastille flottante confirmés, **rechargement
  complet de la page** pour vérifier le round-trip Supabase réel, réouverture en
  modification (valeurs réelles rechargées — « dernière fois : 32 kg × 9 », pas de
  suggestions), écran Progression vérifié (l'exercice coché apparaît, les non cochés non),
  séance Escalade avec 2 blocs saisis via `BlocsField` (résumé "2 blocs · max Bleu 2 ·
  médiane Bleu 1 · 0 flash / 2 essais / 0 échec" confirmé correct), les deux séances de test
  supprimées et absence revérifiée après un nouveau rechargement complet. Aucune erreur
  console à aucune étape.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Douleurs (prochain dans l'ordre), Macros, Repas ; déploiement de
  `apps/public`.

## Chantier RawCare — Phase 2, huitième jalon : Douleurs (06/08/2026)

Sixième écran de données d'`apps/public`, dans l'ordre : **Douleurs** (genou + coude). Même
minimalisme méthodologique que Séances : `PAIN_ZONES` (config d'affichage — titres, textes,
drapeaux `hsr`/`routines`) reste un port quasi verbatim côté app, exactement comme
`apps/perso` (`packages/core/src/pain.js` le documente explicitement : c'est de la
présentation, pas un mécanisme partagé). Aucune nouvelle logique métier — `zoneState` et
tous les seuils Silbernagel étaient déjà dans `packages/core/src/pain.js` depuis la Phase 1.

- **Nouveaux fichiers** : `PainTab.jsx` (≈ `PainTab`), `RoutinePlayer.jsx` (≈
  `RoutinePlayer`, port verbatim — purement visuel, aucune dépendance native même côté
  `apps/perso`, donc rien à simplifier).
- **`data.kneeLog`/`data.elbowLog`** : mêmes clés et même forme (`{date, pain, baseline}`)
  qu'`apps/perso` — `SessionsTab.jsx` les lisait déjà (`painOutOfBase`) en attendant cet
  écran, donc la suppression d'affichage des records un jour de douleur hors base (V4,
  signalée comme inactive au jalon Séances) **s'active automatiquement à partir de ce
  jalon**, sans aucun changement dans `SessionsTab.jsx`/`MuscuLogger.jsx`.
- **Aucune simplification supplémentaire** par rapport à `apps/perso` : graphique 30 jours
  avec points cerclés (surcharge), carte d'alerte, échelle 0-10, table HSR (genou
  uniquement), routines guidées avec minuteur (genou uniquement) — tout porté.
- **Testé de bout en bout** dans le navigateur d'aperçu (session déjà active de Yoann) :
  douleur 3/10 saisie sur Genou, **round-trip Supabase confirmé après rechargement complet**
  de la page, douleur relevée à 7/10 → carte "⚠ Signal de surcharge" affichée correctement,
  bascule vers Coude vérifiée (journal vide et indépendant, table HSR et routines absentes —
  comportement correct puisque `zone.hsr`/`zone.routines` sont à `false` pour cette zone),
  retour sur Genou (état 7/10 rechargé, confirmant l'isolation par zone), routine "Rééduc
  autonome" lancée et minuteur vérifié en décompte réel (0:45 → 0:33), entrée de test
  supprimée et absence revérifiée. Aucune erreur console à aucune étape.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Macros (prochain dans l'ordre), Repas ; déploiement de
  `apps/public`.

## Chantier RawCare — Phase 2, neuvième jalon : Macros (06/08/2026)

Septième écran de données d'`apps/public`, dans l'ordre : **Macros**. Toute la logique
(`PHASES`/`targetsForDate`/`kcalFromMacros`/`kcalOfEntry`/`tdeeNow`/`DEFAULT_TARGETS` dans
`@rawcare/core/targets`, `realDeficit`/`MIN_WINDOW_DAYS` dans `@rawcare/core/tdee`,
`PERI`/`BASKET_PROTOCOLS` dans `@rawcare/core/session/templates`) existait déjà — port UI
quasi verbatim de `MacroTab`/`TdeeCard`.

- **`data.macroLog`** : nouveau champ, même forme qu'`apps/perso`
  (`{date, protein, carbs, fat, fiber, water, source}`). `data.targets` (déjà introduit au
  jalon Poids pour `weightMaintenance`) sert maintenant pour de vrai : protéines/glucides/
  lipides/fibres/eau/fenêtre de sèche (`cut`), via le même `DEFAULT_TARGETS` fusionné à la
  lecture.
- **Simplifications assumées** : pas de `Capacitor.isNativePlatform()` (`apps/public` est
  toujours en comportement "PWA" — les compteurs démarrent à la cible, jamais à zéro) ; pas
  de bandeau lecture seule (`SyncedBanner`) puisqu'aucune source externe (Health Connect,
  Repas) n'existe encore côté `apps/public` — `source` vaut toujours `"manual"`. `kcalOfEntry`
  préfère déjà `m.kcal` quand il existe : l'écran affichera automatiquement la vraie valeur
  mesurée dès que Repas sera livré, sans aucun changement de code ici. `tdeeNow` reçoit
  `foodLog: []`/`overrides: {}` (pas de module Repas) et se rabat donc entièrement sur le
  4/4/9 de `macroLog` — même repli qu'`apps/perso` pour tout historique antérieur à son
  propre module Repas.
- **Testé de bout en bout** dans le navigateur d'aperçu (session déjà active de Yoann) :
  cible affichée **220 g protéines / 2275 kcal dès l'ouverture** — confirme que
  `targetsForDate` détecte correctement la fenêtre de sèche réelle en cours (2026-07-27 →
  2026-08-18, `DEFAULT_TARGETS.cut`) sans aucun réglage supplémentaire ; saisie enregistrée,
  **round-trip Supabase confirmé après rechargement complet** (macros ET eau à 0,50 L
  toujours là), carte "Dépense estimée" affichant correctement "pas assez de données" (aucun
  historique), entrée de test supprimée et absence revérifiée. Aucune erreur console.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Non fait à ce stade** : Repas (dernier écran de données dans l'ordre) ; déploiement de
  `apps/public`.

## Chantier RawCare — Phase 2, dixième jalon : Repas (06/08/2026)

Septième et dernier écran de données d'`apps/public`, dans l'ordre : **Repas** (module
Nutrition — CIQUAL, Open Food Facts, recettes, portions nommées, corrections V6). Toute la
logique métier venait déjà de `packages/core/src/nutrition/` (`ciqual.js`, `off.js`,
`foodStore.js`) — port UI, zéro nouvelle logique métier. `ciqual.js` charge
`../data/ciqual.json` par un chemin relatif au fichier, résolu correctement quel que soit
l'appelant ; `off.js` importe `@capacitor/core`, **hoisté au `node_modules` racine du
monorepo et bien résolvable depuis `apps/public`** (vérifié par `require.resolve` avant de
coder) — sur le web, `Capacitor.isNativePlatform()` renvoie `false` et `off.js` emprunte son
repli `fetch()` déjà prévu pour la PWA, sans aucune adaptation.

- **Deux limitations dures, pas des choix à trancher** (absentes de l'écran, pas juste
  désactivées) :
  1. **Pas de scan code-barres** — `scanBarcode()` dépend de
     `@capacitor-mlkit/barcode-scanning`, un pont natif absent d'`apps/public` (site web
     pur). CIQUAL et la recherche Open Food Facts par texte restent disponibles.
  2. **Pas de Carte resto ni Photo d'un plat** — ces deux écrans appellent l'API Anthropic
     avec une clé saisie par l'utilisateur ; `apps/public` n'a aucun écran Réglages ni
     stockage de clé à ce stade (le rôle du Coach IA pour un public multi-utilisateur reste
     un chantier futur séparé).
  Le panneau d'ajout d'`apps/public` propose donc : recherche CIQUAL + Open Food Facts,
  Saisie libre, Nouvelle recette.
- **Point d'architecture — dérivation `foodLog` → `macroLog` combinée en un seul
  `update()`** (`apps/public/src/nutrition/foodStore.js`, hook `useFoodLog(data, update)`) :
  contrairement à `apps/perso`, où la dérivation tourne dans un `useEffect` séparé (sûr car
  `store.set()` est une écriture localStorage synchrone), `update()` d'`apps/public` fait un
  aller-retour réseau Supabase et fusionne sur la base du `data` capturé en fermeture — deux
  `update()` consécutifs pour une même action (écrire `foodLog` PUIS dériver `macroLog`)
  auraient risqué qu'un second appel parte d'un `data` pas encore rafraîchi par le premier et
  écrase son résultat. Chaque mutation qui touche `foodLog`/`foodOverrides` calcule donc la
  dérivation **dans la même fonction**, avant persistance, et envoie **un seul**
  `update({ foodLog, macroLog })` (ou `{ foodOverrides, macroLog }` pour une correction V6).
  Vérifié que `upsert` (`@rawcare/core/dateUtils`) **fusionne** et ne remplace pas — la
  dérivation (qui ne porte jamais `water`) préserve donc `water` sur les dates déjà
  existantes. Le hook centralise aussi la gestion d'erreur (`error` local), vu le nombre de
  points de mutation dispersés entre `NutritionTab` et les sous-composants de `FoodSearch`.
- **Nouveaux fichiers** : `apps/public/src/nutrition/foodStore.js` (hook +
  ré-export des fonctions pures), `FoodSearch.jsx` (port quasi verbatim d'`apps/perso` moins
  scan/Carte resto/Photo d'un plat), `NutritionTab.jsx` (port adapté à la signature commune
  `{ data, update, error }` des écrans `apps/public` — `kcalTarget` utilise désormais
  `kcalFromMacros` de `@rawcare/core/targets`, déjà utilisé par `MacroTab.jsx`, au lieu de
  dupliquer la formule 4/4/9+fibres codée en dur comme le fait encore `apps/perso`).
- **`data.foodLog`/`foodPins`/`foodMuted`/`foodPortions`/`foodRecipes`/`foodOverrides`** :
  mêmes clés et mêmes formes qu'`apps/perso`, aucune nouvelle table Supabase. `data.macroLog`
  reçoit la dérivation avec `source: "foodlog"`, donc `MacroTab.jsx` reflète Repas sans aucun
  changement de son côté (même mécanique que la bascule M6 d'`apps/perso`).
  Eau : reste une exception à l'isolation, écrite directement dans `macroLog.water` comme
  côté perso.
- **Testé de bout en bout** dans le navigateur d'aperçu (session Supabase de Yoann déjà
  active) : recherche CIQUAL confirmée (« Pomme, sèche » → 252 kcal, 8,7 g fibres — même
  exemple que celui documenté au jalon V6/kcal du 05/08/2026), **recherche Open Food Facts
  elle aussi fonctionnelle dans cet aperçu** (résultats Banania/Gerble sur « banane » —
  contrairement à apps/perso M2, où le bac à sable bloquait tout accès réseau externe ;
  quelques 503/CORS intermittents observés sur d'autres requêtes, absorbés par la reprise
  automatique déjà en place dans `off.js`, sans jamais remonter à l'écran), aliment CIQUAL
  ajouté à un repas avec calories/macros du jour recalculées correctement, **round-trip
  Supabase confirmé après un rechargement complet de la page**, onglet Macros vérifié
  affichant exactement le même total que Repas, Saisie libre testée (30 g protéines → 120
  kcal), Nouvelle recette testée (ingrédient CIQUAL + Open Food Facts, total recalculé),
  toutes les données de test supprimées et absence reconfirmée après un nouveau rechargement
  complet. Aucune erreur console applicative.
- Build `apps/perso` ET `apps/public` propres après le changement (règle absolue #2).
- **Chantier RawCare Phase 2 : les sept écrans de données sont désormais tous livrés**
  (Poids, Sommeil, Pas, Séances, Douleurs, Macros, Repas — Accueil reste l'écran de preuve de
  trajet du deuxième jalon, pas un écran de données). **Non fait à ce stade** : déploiement
  de `apps/public` (aucun site Netlify créé pour elle).

## Chantier RawCare — Onboarding complet (06/08/2026)

Condition posée par la feuille de route avant la Phase 3 (« Bêta réelle ») : un premier
onboarding capturant sports pratiqués, zone(s) de douleur optionnelle(s), cibles macro,
échelle d'escalade et clé API Anthropic. Deux limitations de portée actées avec Yoann avant
de coder (voir échanges de la session) réduisent la vision « catalogue/zones entièrement
libres » de la feuille de route :

1. **Sports** : `recommendSessions` (`packages/core/src/recommender.js`) reste câblé à la
   main sur exactement 6 types (Upper A/B, Lower A/B, Basket, Escalade) — le généraliser au
   catalogue étendu (`session/catalog.js` : Course/Vélo/Foot/Full body/Bro split) reste hors
   scope (déjà repoussé en Phase 1 comme trop risqué à faire vite). Le picker de sports à
   l'onboarding se limite donc à un sous-ensemble de 3 familles pleinement supportées
   (Musculation Upper/Lower, Basket, Escalade) — colle bien au cercle de bêta réel (salle
   d'escalade + équipe de basket).
2. **Zones de douleur** : le gate du recommandeur ne réagit qu'à deux `gateTag` précis
   (« genou » et « tirage », les seuls portés par ces 6 types). Choix guidé à 3 options à
   l'onboarding : Genou (gate genou) / Coude (gate tirage) / Autre (nom libre, suivi seul,
   aucun effet sur les suggestions), répétable, zéro zone par défaut.

Structuré en 3 lots, chacun buildé et vérifié avant le suivant.

### Lot 1 — `recommendSessions` tolérant aux zones dynamiques

Seul changement dans `packages/core` de tout ce chantier — touche le moteur qui protège les
tendons de Yoann en ce moment, donc additif et vérifié par diff comme chaque changement
précédent sur ce fichier.

- Signature étendue de façon additive : nouveau paramètre optionnel `zones` (résultat déjà
  construit de `buildZones(zoneDefs, logs, t0)`). Absent (tous les appelants existants :
  `apps/perso/src/App.jsx` Dashboard et `packages/core/src/coach/prompt.js`) →
  `buildZones(DEFAULT_ZONES, {knee, elbow}, t0)` en interne, comportement identique bit pour
  bit à avant. **Aucun call site existant modifié.**
- `K`/`E` (état genou/tirage) passent de `zones.find(...).state` (plantait si absent) à
  `zones.find(...)?.state ?? NEUTRAL_ZONE` — une zone absente (utilisateur `apps/public` qui
  n'a suivi qu'une seule zone, ou aucune) ne gate/pénalise plus rien, silencieusement, au
  lieu de faire planter la fonction.
- **Vérifié** par script Node de diff caractère près (scratchpad, non commité) : les
  scénarios déjà couverts en Phase 0/1 (genou rouge, coude ambre, combo...) restent
  identiques au caractère près, sans `zones` ET avec `zones` reconstruites depuis
  `DEFAULT_ZONES`. Quatre nouveaux scénarios sur le chemin `zones` dynamique : zéro zone
  (pas de crash, aucun avoid genou/coude), une seule zone gate "genou" (Lower écarté, Upper
  jamais touché), une zone custom gate "tirage" (pénalité Upper appliquée), une zone avec un
  `gateTag` sans rapport ("poignet" — aucun gate déclenché, pas de crash).

### Lot 2 — Sports actifs, escalade, zones de douleur dynamiques (apps/public)

- **`apps/public/src/onboarding.js`** (nouveau) : `SPORT_FAMILIES`/`FAMILY_TYPES` (mapping
  famille → types `TEMPLATES`, Upper/Lower forment UNE famille "musculation"),
  `familyOf(type)` (préfixe, gère aussi les types combinés d'`avoid` comme "Upper A / B"),
  `PAIN_ZONE_PRESETS` (les 3 options guidées) et `newZoneKey()` (identifiant unique pour une
  zone "Autre").
- **`data.activeSports`** (array de clés `SPORT_FAMILIES`) et **`data.painZones`** (array de
  `{key, label, gateTag, unknownIsCaution, hsr, routines, coachClause}`) + **`data.painLogs`**
  (map `{[zoneKey]: [...entrées]}`, remplace `kneeLog`/`elbowLog` fixes pour `apps/public`).
- **`SessionsTab.jsx`** : grille de types filtrée à `FAMILY_TYPES` des familles actives ;
  `scheme` lu depuis `SCHEMES[data.climbScheme] || SCHEMES.gym` (plus figé sur "gym") ;
  `painOutOfBase` reçoit `Object.values(data.painLogs || {})` — `training.js` accepte déjà un
  tableau de N journaux, aucun changement requis côté core.
- **`PainTab.jsx`** réécrit pour itérer `data.painZones` (N zones) au lieu du tableau
  `PAIN_ZONES` figé à 2 : sélecteur `Pills` généralisé, journal par zone dans
  `data.painLogs[zoneKey]`, table HSR + routines réservées à la zone `gateTag === "genou"`
  (même convention qu'apps/perso), écran vide honnête si aucune zone suivie. Ajout/suppression
  d'une zone : géré depuis `Onboarding.jsx` (Lot 3), pas dans cet écran.

### Lot 3 — Écran d'onboarding + carte « Prochaine séance »

- **`apps/public/src/Onboarding.jsx`** (nouveau) : formulaire à défilement unique (pas
  d'assistant multi-étapes — aucun pattern wizard n'existe ailleurs dans l'app), réutilisé en
  création ET modification (`data`/`update` préremplissent, un seul `update()` final, même
  convention que `RecipeBuilder`/`MuscuLogger`). Cinq sections : sports (chips multi-sélection,
  zéro autorisé), zones de douleur (3 presets + nom libre pour "Autre", liste ajoutée/
  supprimable), cibles macro de base (mêmes `Field`+`Stepper` que Réglages `apps/perso`),
  échelle d'escalade (affichée seulement si "escalade" est coché), clé API Anthropic
  (optionnel, texte explicite — rien ne la consomme encore côté `apps/public`, prête pour le
  futur écran Coach IA). **Le patch final n'inclut jamais `painLogs`** : `update()` fusionnant
  par `{...data, ...patch}`, l'omettre préserve l'historique déjà loggé — l'inclure (même à
  `{}`) l'aurait écrasé à chaque réédition via "Préférences".
- **`App.jsx`** : `Authenticated` calcule `needsOnboarding = status !== "loading" &&
  !data?.onboarded` et affiche `<Onboarding>` à la place du contenu tant que c'est vrai (même
  principe que `!session` → `LoginScreen`). Bouton « Préférences » à côté de « Se
  déconnecter » (masqué tant que `needsOnboarding`) qui bascule `editingPrefs` et rouvre le
  même composant avec `onClose` — pas d'écran Réglages complet construit pour ce chantier.
- **`Home.jsx`** : carte « Prochaine séance » (port du bloc `apps/perso` Dashboard,
  `App.jsx:400-425`), alimentée par `recommendSessions` avec `zones:
  buildZones(data.painZones || [], data.painLogs || {}, today())` et `scheme:
  SCHEMES[data.climbScheme] || SCHEMES.gym`. `suggestions`/`avoid` filtrées après coup à
  `data.activeSports` via `familyOf` (reste dans `apps/public`, ne touche pas
  `packages/core`) — jamais de sport non pratiqué suggéré ou écarté. Pas de grille de tuiles
  complète (poids/pas/eau...) — hors scope, jalon Dashboard séparé si voulu plus tard.
- **Testé de bout en bout** dans le navigateur d'aperçu avec le vrai compte de Yoann (jamais
  onboardé sur `apps/public` avant ce chantier) : gate de première ouverture confirmé,
  3 sports + 2 zones (Genou/Coude) + cibles macro + échelle escalade + clé API complétés,
  **round-trip Supabase confirmé après rechargement complet**, `SessionsTab` limité aux 6
  types des 3 familles actives, `PainTab` isole bien les journaux Genou/Coude (aucune fuite),
  fenêtre de sèche réelle (`targets.cut`) préservée intacte par l'onboarding (merge, pas
  écrasement), carte « Prochaine séance » cohérente et réactive (score Lower A passé de 41 à
  51 après un relevé genou "retour à la base : oui", note de prudence par défaut disparue) ;
  bouton « Préférences » testé (rouvre préempli, "Annuler" revient à l'onglet précédent sans
  toucher aux données) ; entrée de test genou supprimée et absence reconfirmée après un
  nouveau rechargement complet. Aucune erreur console applicative (seuls des 503/CORS
  intermittents OFF déjà documentés, sans rapport avec ce chantier).
- Build `apps/perso` ET `apps/public` propres après chaque lot (règle absolue #2).
- **Non fait à ce stade, signalé explicitement** : pas d'écran Réglages complet (le bouton
  « Préférences » couvre seulement la réédition de l'onboarding) ; pas de suppression fine
  d'une zone déjà loggée au-delà du retrait de la liste (historique orphelin mais jamais
  perdu) ; catalogue étendu (Course/Vélo/Foot/Full body/Bro split) toujours hors UI ; Coach IA
  toujours absent d'`apps/public` (la clé API collectée ne sert encore à rien, prête pour ce
  futur jalon) ; déploiement de `apps/public` toujours pas fait.

## Chantier RawCare — Écran Coach IA public (06/08/2026)

Dernière brique fonctionnelle d'`apps/public` avant socle légal + déploiement (Phase 3).
Toute la logique venait déjà de `packages/core/src/coach/` (`prompt.js`/`claudeApi.js`,
extraits d'`apps/perso` à la Phase 0) — chantier de port UI + une généralisation ciblée du
prompt, pas de nouvelle logique métier.

**Découverte bloquante en explorant, pas un choix de portée** : `buildCoachPrompt` était
câblé en dur sur `knee`/`elbow` (deux journaux fixes) et appelait en interne `buildZones(
DEFAULT_ZONES, {knee, elbow}, today())`. Depuis le chantier onboarding, `apps/public` n'a
plus `kneeLog`/`elbowLog` : il a des zones dynamiques (`data.painZones`/`data.painLogs`, 0 à
N zones, noms libres). Passer `knee:[]/elbow:[]` n'aurait pas suffi : `DEFAULT_ZONES` reste
codé en dur pour la clause de tendinopathies, donc le prompt aurait quand même affirmé
« deux tendinopathies en rééduc : tendon quadricipital... » à un bêta-testeur n'ayant pas ce
problème — une fausse affirmation de santé, pas une simplification acceptable.

**Ton du Coach IA public** — tranché avec Yoann : rôle inchangé (coach sportif + kiné +
nutritionniste + coach de vie), juste dépersonnalisé (sports tirés de `data.activeSports`,
plus de "Yoann, 43 ans"), avec le disclaimer déjà présent dans le prompt partagé complété
d'un disclaimer visible en permanence dans l'UI (pas seulement à l'état idle comme côté
apps/perso).

### Lot 1 — Généraliser `buildCoachPrompt`/`buildCoachBriefing` (packages/core/src/coach/prompt.js)

Seul fichier de `packages/core` touché. Additif, vérifié par diff comme chaque changement
précédent sur ce module.

- Trois nouveaux paramètres optionnels dans le "sac de données" : `zones` (résultat déjà
  construit de `buildZones(zoneDefs, painLogs, t0)`), `painLogs`, `identity` (remplace la
  clause "de Yoann, 43 ans, athlète (...)" du `system`). **Absents** (apps/perso, seul call
  site inchangé `App.jsx:2450-2461`, et l'appel interne de `buildCoachBriefing`) →
  comportement identique bit pour bit à avant.
- **Présents** (apps/public) : `realtime.douleurs`/`summary.douleurs` (tableaux génériques
  `{zone, hier/aujourdhui, ...}`) remplacent — dans cette branche seulement — les champs
  nommés `douleur_genou_*`/`summary.genou`/`summary.coude`. La clause "Deux tendinopathies en
  rééduc" ne compte que les zones avec un `coachClause` défini (une zone "Autre" — suivi
  libre — n'en a pas, mais reste visible dans les données). Les mentions prose ("Traite
  explicitement CHAQUE domaine...", "douleurs (...)", "NOTES DE CONTEXTE écrites par...")
  deviennent conditionnelles : texte legacy verbatim si `zones` absent, sinon reconstruites
  depuis les libellés des zones réellement suivies (rien si zéro zone). `buildCoachBriefing`
  généralisé pareil : dumps "Genou brut"/"Coude brut" nommés remplacés par une ligne par zone
  réelle.
- `reco = recommendSessions({..., zones, ...})` : `zones` passé tel quel (undefined pour
  apps/perso) — jamais deux verdicts différents entre le Coach IA et la carte "Prochaine
  séance" côté apps/public.
- **Vérifié** par script Node de diff caractère près (scratchpad, non commité) :
  `buildCoachPrompt`/`buildCoachBriefing` sans `zones`/`identity` identiques bit pour bit à
  avant (`system`, `user`, briefing) ; avec `zones` : 0 zone (aucune mention tendinopathie,
  identity substituée, plus aucune mention de "Yoann"), 1 zone custom "genou", 2 zones dont
  une "Autre" sans clause (visible dans les données mais absente de la clause dédiée),
  briefing avec dumps nommés par zone — tout vérifié sans crash.

### Lot 2 — Nouvelles données + `CoachIA.jsx` (apps/public)

- **Nouveaux champs `data`** : `noteLog` (`[{date, text}]`), `coachProfile` (texte libre,
  **vide par défaut — jamais amorcé avec `SEED_COACH_PROFILE`**, qui est du texte spécifique
  à la sèche de Yoann), `coachJournal` (texte, vide par défaut), `model` (texte, défaut
  `"claude-sonnet-5"` — apps/perso utilise déjà un simple champ texte pour ça, pas un
  sélecteur).
- **`Onboarding.jsx`** : champ modèle ajouté sous la clé API, même carte.
- **`apps/public/src/CoachIA.jsx`** (nouveau) : port de `CoachIA`
  (`apps/perso/src/App.jsx:175-291`) — bouton Analyser, note du jour repliable, coût/tokens,
  gestion erreurs (429, réponse vide, bascule modèle) via `callClaude`. Carte "Profil /
  objectifs" ajoutée (textarea repliable, même pattern que Note du jour) éditant
  `data.coachProfile` directement dans cette carte plutôt que dans un Réglages séparé —
  `apps/public` n'en a pas (décision déjà actée au chantier onboarding). Bouton "Copier le
  contexte pour claude.ai" (`buildCoachBriefing`) avec repli sur affichage à l'écran si
  `navigator.clipboard` échoue.
- Assemblage du sac de données synchrone depuis `data` (Supabase a déjà tout chargé) : pas de
  `getSync` comme côté apps/perso (localStorage).

### Lot 3 — Intégration + disclaimer + vérification

- **`Home.jsx`** : carte `CoachIA` ajoutée sous "Prochaine séance" — même emplacement
  qu'apps/perso (Dashboard), pas un onglet séparé.
- **Disclaimer permanent** sous le bouton Analyser : « Le Coach IA ne remplace pas un avis
  médical ou un kinésithérapeute. »
- **Testé de bout en bout** dans le navigateur d'aperçu avec le vrai compte de Yoann (sports
  + zones Genou/Coude déjà configurés au chantier onboarding) : "Copier le contexte" (repli
  écran, clipboard indisponible dans l'aperçu) a produit un prompt correct — identité
  générique ("de cet utilisateur, athlète (musculation, basket, escalade)", aucune mention de
  "Yoann"), tendinopathies réelles de son compte correctement citées avec les `coachClause`
  définies à l'onboarding, fenêtre de sèche réelle préservée intacte, `douleurs` en tableau
  générique dans le JSON temps réel/résumé ; "Analyser" sans clé API affiche l'erreur
  attendue référençant "Préférences" (pas de clé saisie pour ce compte, comportement non
  testé plus loin — pas de raison de solliciter une vraie clé pour ce test) ; carte "Profil /
  objectifs" testée en écriture ET suppression, **round-trip Supabase confirmé après
  rechargement complet** dans les deux sens ; donnée de test nettoyée et absence reconfirmée.
  Aucune erreur console applicative.
- Build `apps/perso` ET `apps/public` propres après chaque lot.
- **Non fait à ce stade** : sélecteur de modèle en Pills (texte libre pour l'instant, comme
  apps/perso) ; pas de vraie analyse testée avec une clé API réelle (nécessiterait la clé
  d'un utilisateur, hors du champ de ce test) ; socle légal minimal (mentions légales, RGPD)
  et déploiement d'`apps/public` restent les deux derniers chantiers avant la Phase 3.

## Chantier RawCare — Socle légal minimal (06/08/2026)

Avant-dernier chantier de la Phase 3 (« Bêta réelle »), avec le déploiement d'`apps/public`.
Contenu rédigé par Claude à partir des faits vérifiés du projet (statut personnel de Yoann,
hébergement Supabase/Netlify, aucun tracker tiers) — **pas une relecture juridique
professionnelle** : suffisant pour une bêta fermée gratuite entre amis, à revoir si le
périmètre change (public élargi, monétisation).

- **`apps/public/public/privacypolicy.html`** (nouveau, `apps/public/public/` créé pour
  l'occasion — n'existait pas encore) : politique de confidentialité RGPD complète —
  responsable de traitement (Yoann, à titre personnel, contact
  `yoann.rolland@gmail.com` — identité choisie explicitement avec Yoann plutôt que
  supposée), données collectées (compte, suivi sportif, **données de santé** au sens RGPD
  pour les zones de douleur, nutrition, préférences, clé API Anthropic optionnelle),
  hébergement Supabase en région UE avec Row Level Security, **section dédiée au partage
  avec Anthropic** quand le Coach IA est utilisé (envoi direct navigateur→API, jamais via un
  serveur RawCare, sous le compte Anthropic de l'utilisateur — lien vers leur politique de
  confidentialité), droits RGPD (accès/rectification/effacement/portabilité, traités
  manuellement par email à ce stade de la bêta — pas de bouton self-service, dit
  explicitement plutôt que de sous-entendre une automatisation qui n'existe pas), cookies
  (stockage local technique seulement, aucun tracker), mineurs exclus.
- **`apps/public/public/mentionslegales.html`** (nouveau) : éditeur (Yoann, personne
  physique, pas de structure commerciale), hébergement (Netlify pour le site, Supabase UE
  pour les données), propriété intellectuelle (CIQUAL/Etalab, Open Food Facts/ODbL, déjà
  documentées ailleurs), responsabilité (rappel Coach IA ≠ avis médical).
- Les deux pages reprennent les jetons de design "Affirmée" (fond `#050505`, accent citron,
  mono pour les libellés) — cohérentes visuellement avec le reste de l'app, contrairement à
  `apps/perso/public/privacypolicy.html` (minimaliste, sans style, pensé uniquement pour une
  exigence Play Store/Health Connect — pas le même contexte : `apps/perso` n'a ni compte ni
  serveur).
- **Liens ajoutés** : pied de page de `LoginScreen.jsx` (visible avant connexion — obligation
  RGPD d'être consultable sans compte) et pied de page de `App.jsx` côté authentifié.
  Fichiers statiques dans `apps/public/public/`, copiés tels quels par Vite à la racine de
  `dist/` (pas de route React) — mêmes URLs `/privacypolicy.html`/`/mentionslegales.html`
  qu'`apps/perso`.
- **Testé** : build `apps/public` propre, les deux pages présentes dans `dist/`, rendu
  vérifié dans le navigateur d'aperçu (les deux pages, plus les liens de pied de page sur
  l'écran de connexion et la vue authentifiée).
- **Non fait à ce stade** : vérification par un professionnel du droit (hors du champ de
  Claude) ; bouton de suppression de compte en libre-service (les demandes RGPD passent par
  email pour l'instant, dit explicitement dans la politique) ; déploiement d'`apps/public`
  (dernier chantier avant la Phase 3).

## Chantier RawCare — Correctifs post-retours bêta (06/08/2026)

Après la mise en prod, retour de Yoann sur `apps/public` en le montrant à ses connaissances :
« j'ai l'impression que l'app n'est pas fini [...] trop downgradé [...] plein de bugs ». Deux
catégories distinctes : un gros backlog de fonctionnalités (scan code-barres, Carte resto/
Photo d'un plat, catalogue de sports étendu, zones de douleur libres, Réglages complet,
Dashboard complet — **non traité ici**, chantier séparé à planifier) et quatre bugs concrets,
tous corrigés dans cette session.

- **« Le poids cible reste à 93kg » / « Les macros restent à 2420kcal » — même cause
  racine.** `packages/core/src/targets.js` porte les cibles PERSONNELLES de Yoann :
  `PHASES.seche.target`/`PHASES.prise.target` fixés à 93/95 (corrects pour lui, décision
  documentée), et surtout `DEFAULT_TARGETS.cut` = SA fenêtre de sèche réelle en cours
  (`enabled: true`, dates 27/07→18/08, cibles 220g/2275kcal). Ces deux constantes sont
  légitimes pour `apps/perso` (un seul utilisateur, lui) mais `apps/public` les servait
  telles quelles à tout compte, sans aucune UI pour les changer — d'où l'impression que
  « changer les paramètres ne fait rien ».
  - **Un premier correctif (même session, avant ce retour) s'est révélé insuffisant** :
    `apps/public/src/defaultTargets.js` avait déjà été créé avec `cut.enabled: false` en
    repli, mais ça ne joue que pour un compte qui n'a ENCORE rien en `data.targets` — celui
    de Yoann avait déjà fait l'onboarding public AVANT ce correctif, donc `cut.enabled: true`
    était déjà écrit en dur dans son `data.targets` en base (confirmé par une requête directe
    à l'API REST Supabase depuis le navigateur d'aperçu) : un objet stocké écrase le défaut
    entièrement au merge (`{...DEFAULT_TARGETS, ...data.targets}`, pas une fusion profonde),
    donc le bug persistait malgré le premier correctif.
  - **Fix définitif** : `defaultTargets.js` exporte désormais `mergeTargets(stored)`, point
    d'entrée UNIQUE pour lire `data.targets` dans tout `apps/public` (remplace les fusions
    manuelles `{...DEFAULT_TARGETS, ...(data?.targets||{})}` dupliquées dans `WeightTab.jsx`/
    `MacroTab.jsx`/`NutritionTab.jsx`/`CoachIA.jsx`/`Home.jsx`/`Onboarding.jsx`) — force
    `cut.enabled: false` INCONDITIONNELLEMENT, quoi qu'il y ait en base. `targetsForDate`
    local (utilisé par `MacroTab`/`NutritionTab`) fait la même chose en deuxième filet.
    Repose sur le fait qu'apps/public n'a de toute façon aucune UI pour éditer une fenêtre de
    sèche — ce champ ne doit jamais s'appliquer ici, point final. Rouvrir Préférences et
    enregistrer répare aussi, en base, un compte encore porteur de l'ancien bug (`Onboarding`
    initialise son état via `mergeTargets` puis sauvegarde tel quel).
  - **`PHASES.seche.target`/`PHASES.prise.target` (93/95 kg) rendus éditables pour
    `apps/public`**, alors qu'ils sont fixes dans le core : nouveaux champs
    `weightCutTarget`/`weightBulkTarget` dans `DEFAULT_TARGETS` local (valeurs de départ =
    93/95, identiques au core, donc rien ne change tant que l'utilisateur n'édite pas),
    `phaseTarget`/`phaseTargetField` locaux qui lisent le bon champ selon la phase (au lieu
    d'utiliser la fonction figée du core). `WeightTab.jsx` gagne un Stepper "Poids cible —
    {Phase} (kg)" dans la carte Phase, pour LES TROIS phases (le core n'en rend éditable
    qu'une, Maintenance).
  - **Vérifié en conditions réelles** avec le compte de Yoann : cible Macros passée de
    220g/2275kcal (fenêtre de sèche fantôme) à 105g/1269kcal (ses vraies cibles de base) dès
    le rechargement ; Stepper "Poids cible — Sèche" testé (93 → 93.5 kg, round-trip Supabase
    confirmé après rechargement complet), puis remis à 93 pour ne pas altérer sa vraie
    donnée. Build `apps/perso` ET `apps/public` propres — `packages/core/src/targets.js`
    n'a pas été touché, aucun risque pour `apps/perso`.
- **« Dans les cibles macro, quand le chiffre dépasse la centaine, on ne le voit plus
  trop… que 2 chiffres sur 3 »** : bug CSS classique de flexbox — un enfant flex refuse par
  défaut de rétrécir sous la taille de son contenu (`min-width: auto`), ce qui coupait
  l'input d'un `Stepper` à 3 chiffres (ex. "220") dans une grille 2 colonnes étroite
  (Préférences, Macros). Corrigé dans `apps/public/src/ui.jsx` (`minWidth: 0` sur le
  conteneur flex ET l'input, `flexShrink: 0` sur les boutons +/− et l'unité). **Mêmes
  bugs partout où `Stepper` est utilisé** (Poids, Séances/HSR, Repas…), pas seulement les
  écrans remontés. `apps/public/src/ui.jsx` étant une copie verbatim d'`apps/perso/src/
  ui.jsx` (documenté ainsi depuis le jalon "Poids/Sommeil/Pas à parité"), le même correctif a
  été appliqué aux DEUX fichiers pour ne pas les faire diverger, même si Yoann n'a pas
  remonté ce bug côté `apps/perso` (latent mais bien présent : même code, même défaut CSS).
  Vérifié visuellement dans l'aperçu (375 px) : "105", "95", "45", "32" désormais lisibles en
  entier dans la grille 2 colonnes de Préférences.
- **Retiré au passage (pas remonté par Yoann, trouvé en lisant `Home.jsx`)** : la carte
  "Note de test (round-trip user_data)", reste de debug des tout premiers jalons apps/public,
  toujours affichée à un vrai bêta-testeur — supprimée avec son état et sa fonction `save()`.

## Session d'ajustements 07-17/08/2026 (perso + public, v3.59.0 → v3.65.0)

Session longue de retours d'usage réel, sans nouveau gros chantier : 13 commits, tous sur
`dev`. **`main` n'a reçu que les 6 premiers** (jusqu'à `0c51e31`) — les 7 suivants
(sommeil fractionné, boutons Repas, scroll onglet, progressive overload, sommeil
short-sleeper, Stepper vertical, heure du Coach IA, seuils recommandeur) sont poussés sur
`dev` mais **pas encore déployés sur le site public** au moment d'écrire ces lignes.
L'app native est à jour (v3.65.0 installée).

### Recommandeur — le repos ne se déclenche plus sur le volume brut

Trois passes successives sur `packages/core/src/recommender.js`, la dernière étant la plus
importante (Repos était proposé beaucoup trop souvent).

- **Repos basé sur des signaux de dérive, plus sur un décompte de séances** (07/08) : le
  score ne compte plus le NOMBRE de séances sur 7 j glissants. Trois signaux de dérive :
  (1) genou hors base, (2) **baisse de perf sur ≥2 exercices** travaillés dans les 3
  derniers jours (`exerciseTrend`, jamais branché au recommandeur avant), (3) **≥2 nuits
  de mauvaise qualité** sur 3 jours. Les jours consécutifs sans coupure (`streak`) ne sont
  plus qu'un **repère soft** : ils montent le score mais ne bloquent jamais une suggestion
  d'entraînement, et pèsent moins dès qu'un vrai signal est déjà présent.
- **Sommeil : la qualité seule, jamais la durée** (13/08) : `sleepPoor` et `sleepDrift`
  déclenchaient sur `heures < 6 OU qualité ≤ 2` — le OU sur les heures pénalisait à tort
  une nuit courte de BONNE qualité, alors que Yoann est short sleeper. Condition sur la
  durée **entièrement retirée** des deux signaux. Le texte affiché passe de "Nuit courte"
  à "Sommeil de qualité faible". Vérifié par script : nuit de 5 h à 4/4 donne désormais
  exactement les mêmes scores qu'une nuit de 8 h à 4/4.
- **Seuils recalibrés pour un athlète** (17/08, le correctif qui a vraiment réglé le
  problème) : deux signaux génériques gonflaient Repos en continu SANS aucun vrai signe de
  fatigue, parce qu'ils étaient calibrés pour un pratiquant occasionnel.
  - `loadHigh` (charge 3 j) : **3 → 7 séances**. La normale déclarée de Yoann monte à
    2 séances/jour (4-6 sur 3 j), donc l'ancien seuil se déclenchait quasi en permanence —
    pénalisant Upper/Lower/Basket/Escalade via `fatigueScore` ET bonifiant Repos.
  - `streak` : **5 → 10 jours** sans coupure. 5 jours d'affilée est courant pour lui.
  - **Décision explicite de Yoann** : corriger la CAUSE (Repos sur-noté) plutôt que gonfler
    artificiellement le score de base d'Upper/Lower — en dégonflant Repos, la muscu remonte
    mécaniquement. Ne pas "compenser" en boostant la muscu si le sujet revient.

### Sommeil — nuits fractionnées et grille de qualité

`apps/perso/android/.../HealthNutritionPlugin.kt` (natif, l'app web n'a pas ce calcul) :

- **Nuits fractionnées additionnées** (09/08) : en cas d'insomnie, l'app source écrit
  parfois DEUX `SleepSessionRecord` pour une même nuit ; `out.put(...)` sur une seule clé
  par enregistrement **écrasait silencieusement** le premier segment. Les enregistrements
  sont regroupés par **"jour de sommeil" = fenêtre de midi la veille à midi le jour même**
  (`sleepDayOf`) — pas le jour calendaire de fin, qui aurait séparé un segment finissant à
  23h50 d'un second commençant à 00h10 — puis **sommés** : durée additionnée, qualité
  recalculée sur l'efficacité et le temps endormi COMBINÉS (une nuit = une seule note).
- **Palier "Excellent" abaissé à 6 h** (17/08) : `asleepMinSum >= 390` → `>= 360`.
  Grille actuelle (efficacité = temps endormi ÷ temps au lit) : **4** ≥90 % et ≥6 h ·
  **3** ≥80 % et ≥5h30 · **2** ≥65 % OU ≥4h30 · **1** sinon. Pas de phases dans Health
  Connect ⇒ `quality: null` (aucune note inventée), seule la période brute sert de durée.

### Coach IA — heure de l'analyse

`packages/core/src/coach/prompt.js` + `nowHM()` dans `dateUtils.js` (14/08). Le prompt ne
connaissait que la DATE : lancé à 8 h du matin, le modèle jugeait 3000 pas / 600 kcal
"insuffisants" par rapport à la cible du jour ENTIER — un procès d'intention permanent.

- Nouveau champ `heure_analyse` (HH:MM local) dans le bloc TEMPS RÉEL, + consigne explicite
  de ne jamais juger les champs `_aujourdhui`/`_en_cours` contre une cible de journée
  complète.
- **Repères par NOM de repas** (les macros/eau peuvent être saisies à l'avance, contrairement
  aux pas/poids/sommeil qui sont toujours à jour) : avant midi seul le petit-déjeuner est
  attendu, midi-15 h + déjeuner, 15-18 h + goûter, 19-22 h + dîner. **"Autre" est un repas
  flexible, jamais un repère horaire.** Un repas plus tardif déjà rempli n'est pas suspect —
  Yoann planifie parfois ses repas à l'avance. Le trou 18-19 h est laissé au bon sens du
  modèle, volontairement pas codé en règle rigide.
- `buildCoachBriefing` (export claude.ai) en hérite automatiquement.
- **Le profil permanent a été enrichi par Yoann le même jour** (dans les Réglages, pas dans
  le code) : clause short sleeper (juger sur le score qualité, jamais la durée) + demande
  d'analyser activement le lien nutrition/hydratation ↔ sommeil, énergie et performance.

### Progressive overload — la charge prime sur le volume

`packages/core/src/training.js` (13/08). `exerciseTrend()` et `exoProgress()` comparaient le
**volume** (poids × reps) : 40 kg × 10 → 45 kg × 6 (400 → 270) s'affichait comme une
**baisse** alors que c'est une progression. Les deux utilisent désormais la même hiérarchie
que les records (`beats()`) : **poids plus lourd = toujours "hausse"**, peu importe les reps ;
à poids égal seulement, les reps départagent. Corrige au passage une incohérence réelle — une
séance pouvait afficher `★ record` ET "tendance : baisse" simultanément. Le graphique continue
de tracer le volume, seul le verdict hausse/baisse/stable change. `delta` reste le volume
brut, purement informatif.

### UI — retours d'usage (perso + public)

- **Phase déplacée du Dashboard vers les Réglages** (13/08, les deux apps) : ce n'est pas un
  écran de suivi. Côté `apps/perso`, les poids cibles **Sèche et Prise deviennent éditables**
  comme l'était déjà Maintenance — via une surcouche locale `targets.weightCutTarget`/
  `weightBulkTarget` et un `phaseTarget` local dans `App.jsx` qui prend le dessus sur celui
  du core ; **`packages/core/src/targets.js` n'est pas touché** (93/95 restent les valeurs de
  départ). Côté `apps/public`, la carte a migré de `WeightTab.jsx` vers `Onboarding.jsx`
  (`mode="settings"`), où les trois étaient déjà éditables.
- **Les 3 Stepper de poids cible empilés verticalement** (13/08) : sur une seule ligne ils
  débordaient du cadre de la Card et le champ était trop étroit pour taper dedans. Une phase
  par ligne. Corrigé dans les DEUX apps (même code copié).
- **Réglages d'`apps/public` : roue crantée, plus un onglet** (07/08) — icône `Settings`
  (lucide-react, comme `apps/perso`) à côté de "Se déconnecter", ouvrant un overlay
  (`showSettings` séparé de `tab`, même architecture que `apps/perso`).
- **Export/import JSON dans `apps/public`** (07/08) : il n'existait AUCUNE copie des données
  hors Supabase. Nouvelle carte "Sauvegarde des données" dans Réglages — export du `data`
  complet **sans la clé API** (même précaution qu'`exportData()` côté perso), import qui
  fusionne clé par clé via `update()` (donc une restauration ne touche jamais la clé API
  configurée).
- **Boutons d'ajout remontés en haut de l'écran Repas** (10/08) : "Saisie libre" / "Nouvelle
  recette" / "Carte resto" / "Photo d'un plat" étaient sous la liste de résultats, donc hors
  écran la plupart du temps. Remontés juste sous la barre de recherche, dans les deux apps.
- **Retour en haut de page à chaque changement d'onglet** (10/08) : `apps/perso` réinitialise
  le `scrollTop` de son `<main>` scrollable (React ne le démonte pas entre deux onglets),
  `apps/public` fait un `window.scrollTo(0,0)` — même `useEffect([tab, showSettings])`.

### Nutrition — favoris

`packages/core/src/nutrition/foodStore.js` + `FoodSearch.jsx` des deux apps (07/08) :

- **Favoris qui disparaissaient** : `suggestions()` avait un plafond de 25 (qui évinçait des
  aliments réellement fréquents) ET ne cherchait que dans la fenêtre de 60 jours d'usage —
  donc un aliment **épinglé** mais pas relogué depuis 60 j disparaissait purement et
  simplement. Plafond **retiré** (`limit = Infinity`), et un ref épinglé absent des stats est
  désormais retrouvé dans TOUT l'historique. L'épinglage est une intention durable, pas un
  signal de fréquence récente.
- **Tri par repas** : épinglés d'abord, puis les aliments déjà logués à CE repas précis
  (`mealFreq > 0`), puis le reste — un aliment très fréquent à un AUTRE repas ne passe plus
  devant un habitué de celui-ci.
- **Favoris dans `IngredientPicker`** (création de recette) : il n'affichait QUE la recherche
  textuelle, jamais les habituels à champ vide. `log`/`pins`/`muted` lui sont maintenant
  passés (via `RecipeBuilder`) — sans `meal`, un ingrédient de recette n'étant pas lié à un
  repas.

### Chantiers évoqués mais NON faits (à reprendre)

- **Bibliothèque d'exercices** (`apps/public`, identité au-delà du `nom`) : reportée à une
  session dédiée, décision explicite de Yoann. **Devenue plus motivée depuis** : c'est le
  prérequis pour que sa copine ait ses propres Upper/Lower sans dupliquer `TEMPLATES` en dur
  (voir ci-dessous) — dupliquer casserait justement le "une seule app qui se met à jour pour
  les deux".
- **App iOS pour sa copine** (voir la mémoire `project-ios-girlfriend-app`) : chantier bloqué,
  pas abandonné. Décisions prises : données séparées (déjà acquis gratuitement — `localStorage`
  est par appareil), app native voulue (PWA refusée : "mon app native est bien plus complète"),
  **pas de compte Apple Developer** (99 $/an refusé) → piste AltStore/SideStore. **Bloquant
  réel** : Xcode n'est pas installé sur ce Mac (seulement les Command Line Tools) — CocoaPods,
  lui, a été installé le 14/08 (`brew install cocoapods`, 1.17.0). Rien ne peut démarrer avant
  Xcode. Risques d'AltStore/SideStore documentés avec Yoann : signature à re-valider tous les
  7 jours, casse possible à chaque mise à jour iOS, Yoann en support technique permanent.

## Chantier RawCare — Refonte Macro/Performance + ajout rapide + galerie/photo (01/09/2026, v3.66.0)

Trois retours d'usage groupés en une session, portés à l'identique sur `apps/perso` et
`apps/public` (fichiers en miroir, mêmes noms).

- **Ajout à la volée sur "Vos aliments habituels"** (`FoodSearch.jsx`) : bouton `+` par ligne
  (`QuickAddButton`), ajoute directement à la **dernière quantité utilisée** (`f.lastQ`,
  toujours renseignée pour un aliment déjà loggé — 100 g de repli sinon) sans ouvrir le détail
  ni fermer le tiroir de recherche. Retour visuel bref (coche) le temps qu'il n'y a pas de
  navigation pour confirmer autrement. **Scope volontairement limité aux favoris/habituels**
  (pas la recherche CIQUAL/OFF) — décision explicite de Yoann.
  **Changement structurel qui va avec** : "Ajouter" (détail d'un aliment via `QtyPanel`, ou
  "Saisie libre" via `FreeEntry`) ne ferme plus tout le tiroir — il ramène sur l'écran
  précédent À L'INTÉRIEUR du tiroir (`onBack()` appelé après `onAdd()`). Seul le bouton "X"
  referme désormais. `NutritionTab.add()` ne fait plus de `setOpenMeal(null)` lui-même.
  Corrige au passage un bug latent : "Photo d'un plat" affichait un état "Ajouté ✓" qui ne
  pouvait jamais s'afficher puisque le tiroir se refermait instantanément avant ce changement.
- **Choix galerie/appareil photo** (`PhotoDish.jsx`, `RestaurantMenu.jsx`) : deux inputs
  `<input type="file">` distincts au lieu d'un seul — un input galerie (`multiple`, inchangé)
  et un nouvel input caméra dédié (`capture="environment"`, un cliché à la fois). Raison :
  `multiple` fait disparaître l'option caméra du sélecteur système sur beaucoup d'appareils
  Android — ce n'était pas un choix de widget à faire, c'est une contrainte du sélecteur
  natif. Solution HTML pure, aucune dépendance native supplémentaire, donc identique sur les
  deux apps (natif comme web).
- **"Repas" → "Macro" (icône `Flame`), "Macros" → "Performance" (icône `TrendingUp`)** — les
  icônes précédentes (couverts/pomme) n'étaient pas appréciées, en plus du renommage demandé.
  `apps/public` n'a pas d'icônes de nav (barre texte seule) : seuls les libellés changent
  là-bas. Clés internes renommées en cohérence (`food`→`macro`, `macro`/`macros`→`perf`),
  aucune clé `localStorage` touchée (les clés de nav ne sont pas persistées).
  **"Performance" (ex-Macros) vidé de tout ce qui devient redondant avec "Macro" (ex-Repas)** :
  plus de saisie manuelle de macros, plus de cibles P/G/L/Fib du jour, plus de graphique
  14 jours quotidien, plus d'eau — tout ça existe déjà dans "Macro" via `foodLog`. Reste
  seulement : dépense estimée (TDEE, inchangé), fiche péri-training (inchangée), protocole
  basket (inchangé), et une nouvelle **moyenne kcal lundi-vendredi par semaine** (8 semaines,
  `weeklyWeekdayKcalTrend` dans `packages/core/src/targets.js`, partagée par les deux apps).
  Week-ends **volontairement exclus du calcul** (pas juste non affichés) — l'objectif explicite
  de Yoann est de suivre la semaine de travail sans que les cheat days du week-end ne la
  lissent. Semaine ancrée sur le lundi, arithmétique locale pure (même famille que
  `shiftDateKey`), jamais un aller-retour par un instant UTC. Un jour sans apport connu est
  ignoré plutôt que compté à 0 (`days` compte les jours réellement loggés dans la semaine).
  `apps/public/src/MacroTab.jsx` supprimé, remplacé par `PerformanceTab.jsx` (même contenu que
  la version `apps/perso`, signature `{ data, update, error }` au lieu de props directes).
- **Testé dans l'aperçu (`apps/perso` uniquement)** : ajout d'un aliment via le détail →
  retour confirmé sur la liste de recherche (pas fermeture du tiroir) ; `+` rapide sur un
  aliment déjà loggé → re-logué à l'identique (même quantité), tiroir resté ouvert ; onglets
  Performance et Macro vérifiés (icônes, titres, contenu) ; Galerie/Photo vérifiés sur "Photo
  d'un plat" ET "Carte resto". **`apps/public` non testé en direct** (pas de session Supabase
  active dans cette session, pas d'identifiants) — port fichier par fichier en miroir exact de
  la version `apps/perso` déjà testée, mais un test réel sur `apps/public` reste à faire.
  Build `apps/perso` ET `apps/public` propres.

## Chantier RawCare — Lower C, correction Leg curl, planning idéal (01/09/2026, v3.67.0)

Retours d'usage sur le programme muscu et l'onglet TDEE, `apps/perso` uniquement (contenu
personnel à Yoann — planning avec matchs, Lower C — pas propagé à `apps/public`, qui n'a de
toute façon pas accès à "Lower C" : `FAMILY_TYPES.musculation` dans `onboarding.js` reste
`["Upper A","Upper B","Lower A","Lower B"]`, liste figée non dérivée de `TEMPLATES`).

- **Correction "Leg curl bilatéral" → "Leg curl unilatéral"** (Lower B) : erreur de nom,
  l'exercice réel est unilatéral. Renommé dans `TEMPLATES` (Lower B), `catalog.js` (Bro
  split — Jambes, pour cohérence même si inutilisé), et `DEFAULT_WEIGHTS`. **Le nom d'un
  exercice est aussi sa clé d'historique** (`lastPerf`/records/progression matchent par
  `nom` dans `trainingLog`) : un simple renommage du gabarit aurait fait repartir de zéro la
  progression de cet exercice. Migration additive dans `apps/perso/src/App.jsx` (juste après
  le chargement de `trainingLog`) : renomme silencieusement toute occurrence historique de
  "Leg curl bilatéral" en "Leg curl unilatéral", idempotente (no-op après la première
  exécution), jamais retirée du code (coût nul de la laisser en permanence, même précédent
  que la fusion de `targets` avec `DEFAULT_TARGETS` au chargement).
- **"Leg extension unilatérale" : saisie G/D simplifiée** (Lower A, B et C) — retrait de
  `perLeg: true` sur les trois occurrences. Demandé à l'origine seulement pour Lower A/C,
  mais c'est le même exercice (même `nom`) dans les trois gabarits : laisser Lower B avec la
  distinction G/D aurait fait cohabiter deux formats de saisie sur le même historique,
  perturbant le "dernière fois" préremplie. **Décision confirmée par Yoann après qu'on le lui
  ait signalé.** Sans risque : `bestSet`/`exerciseSessions`/`lastPerf` (training.js, perf.js)
  sont déjà agnostiques du flag `perLeg` — ils lisent `series` telle quelle, qu'elle soit
  scindée G/D ou plate. Les séances déjà loguées gardent leur propre `perLeg` historique
  (stocké par séance, pas recalculé) ; seul le tout premier "dernière fois" après le
  changement peut piocher une valeur d'un ancien set G isolé — cosmétique, se corrige tout
  seul dès la séance suivante.
- **Nouveau type de séance "Lower C"** (semaine avec match, Lower unique de la semaine) :
  `chargeTags: ["genou"], knee: true, hsr: true` — mêmes mécanismes de sécurité que Lower A/B.
  7 exercices : Iso leg extension (option, 5×45s, identique à Lower A), Presse à cuisses
  (HSR), Leg extension unilatérale (HSR, saisie simplifiée), Mollets à la presse (**3** séries,
  pas 4 comme A/B), Soulevé de terre roumain, Hip thrust, Core — Planche (**2** séries, pas 3).
  Volume total réduit par rapport à Lower A pour compenser l'ajout de RDL + Hip thrust dans la
  même séance. Apparaît automatiquement dans le sélecteur `apps/perso` (`TYPES.map(...)`,
  dynamique) — aucun code UI à ajouter côté carnet.
  **Non intégré au recommandeur automatique** ("Prochaine séance") : `variant("Lower A",
  "Lower B")` reste inchangé, Lower C n'est donc jamais suggéré ni écarté automatiquement —
  c'est un choix manuel de Yoann selon son calendrier de matchs, pas une décision que
  l'algorithme doit prendre. Le gate de sécurité genou (cooldown 48h, "déjà fait aujourd'hui")
  reste correct dans tous les cas : `dKnee`/`kneeToday` sont déjà génériques par `chargeTags`
  (Phase 1 lot 3), pas câblés sur des noms de type littéraux — Lower C en hérite sans aucun
  code supplémentaire. Seul `isLower()` (comptage du volume hebdo affiché, "Lower X/2 cette
  semaine") a été étendu pour reconnaître aussi "Lower C" — correction isolée d'une ligne,
  confirmée par Yoann, qui ne touche ni au choix automatique Lower A/B ni à aucune logique de
  sécurité.
- **Carte "Planning idéal"** dans l'onglet TDEE (`apps/perso` seulement) : deux variantes
  (sans match / avec match) sélectionnables par `Pills`, contenu figé dans une constante
  `WEEKLY_PLAN` locale à `App.jsx` — texte affiché à titre de référence uniquement, jamais lu
  par le recommandeur ni le Coach IA (pas de couplage, contrairement à
  `summary.recommandeur` dans `buildCoachPrompt`).
- **Texte de la table HSR mis à jour** ("Pilote presse à cuisses + leg extension en Lower A
  et Lower C", au lieu de "Lower A" seul) — la table pilote désormais les deux gabarits.
- **Testé dans l'aperçu** : Lower C apparaît dans le sélecteur avec les 7 exercices et les
  bons volumes (3×15RM presse HSR semaine 1, mollets 3 séries, planche 2 séries) ; Leg
  extension unilatérale confirmée en saisie simple (3 lignes, plus de colonnes G/D) sur
  Lower B ; Lower B affiche "Leg curl unilatéral" avec son poids par défaut (35 kg) préservé ;
  carte Planning idéal vérifiée dans les deux variantes ; aucune erreur console. Séances de
  test annulées, rien sauvegardé. Build `apps/perso` ET `apps/public` propres (le second pour
  confirmer que les changements de `packages/core` ne cassent rien côté public, qui n'active
  Lower C nulle part).

## Chantier RawCare — Bibliothèque d'exercices, premier lot (01/09/2026)

Reprise du chantier reporté en Phase 1 ("Bibliothèque d'exercices... identité au-delà du
nom... reportée à une session dédiée"). Cadrage fait avec Yoann avant de coder : pas de
source externe (wger, free-exercise-db, ExerciseDB) — la vraie difficulté n'est pas la liste
de noms d'exercices, c'est le tag `tendon` (sécurité Silbernagel), qu'aucune base externe ne
connaît. Importer un gros catalogue non qualifié aurait donné un faux sentiment de couverture
sécurité, pire que rien. Décision : bibliothèque construite à la main, même taxonomie
(`groupe`/`mouvement`/`materiel`/`tendon`) que `TEMPLATES`, alimentée au fil des sessions.

- **`packages/core/src/session/exercises.js`, nouveau** : `EXERCISE_LIBRARY`, liste PLATE de
  19 exercices, **séparée de `TEMPLATES`** — décision actée avec Yoann après avoir signalé le
  risque : renommer un exercice déjà dans un gabarit actif casse sa clé d'historique (comme
  pour Leg curl le 01/09/2026), une bibliothèque à part évite toute migration. **Non branchée
  à aucune UI pour l'instant** — c'est la brique de données, pas encore de bouton "remplacer
  cet exercice" dans le carnet.
- **Périmètre du premier lot** : les mouvements où la salle de Yoann a RÉELLEMENT les deux
  types d'équipement (confirmé par lui, pas supposé) — Presse à cuisses, Iso leg extension
  @60°, Leg extension unilatérale, Leg curl unilatéral, Mollets à la presse, Rowing,
  Développé couché/incliné/militaire. Chaque paire poulie/disque partage `groupe`/`mouvement`/
  `tendon` avec l'exercice équivalent de `TEMPLATES` (même vocabulaire de tags, pour un futur
  matching par substitution).
  **"machine poulie"** = câble tiré via une poulie, pile de poids intégrée. **"machine à
  disque"** = bras de levier chargé à la main avec des disques de fonte, pas de câble.
- **Deux exceptions volontaires, pas des oublis** : pas de version disque pour "Tirage
  vertical" (mécaniquement toujours un câble — pas de fausse alternative inventée) ; pas de
  version haltères pour les développés couché/incliné/militaire (existent déjà comme
  exercices prescrits d'Upper A/B — `Développé couché haltères` etc. — un doublon ici
  fragmenterait l'historique pour rien).
- **Testé** : le module se charge sans erreur (19 entrées confirmées), build `apps/perso` ET
  `apps/public` propres (fichier non importé, donc aucun changement de comportement observable
  — rien à vérifier dans l'aperçu à ce stade).
- **Non fait à ce stade** : périmètre `apps/public` (identité au-delà du nom, si un jour les
  utilisatrices peuvent créer leurs propres exercices) toujours pas retranché ; d'autres
  mouvements pourraient rejoindre la bibliothèque au fil de l'eau, pas besoin de tout
  couvrir d'un coup. **UI de substitution livrée au lot suivant, voir plus bas.**

## Chantier RawCare — Bibliothèque d'exercices, deuxième lot : substitution (01/09/2026)

Branche le premier lot (`EXERCISE_LIBRARY`) à une vraie UI dans le carnet `apps/perso` —
"cette machine est prise, ou j'ai envie de varier", la demande d'origine.

- **Bouton "Remplacer cet exercice"** (`MuscuLogger`, App.jsx) : visible sur un exercice
  ouvert dès qu'au moins un candidat existe dans `EXERCISE_LIBRARY`. Ouvre un panneau inline
  listant les candidats, tap = substitution immédiate. **Portée : cette séance uniquement**,
  jamais le gabarit — Upper/Lower ne changent jamais, le remplacement se logue sous son
  propre nom (nouvel historique, `lastPerf`/`def` recherchés sous la nouvelle identité).
  Le **protocole reste celui prescrit** : `mode`/`perLeg`/`opt`/`rest`/nombre de séries/cible
  HSR viennent de l'exercice d'ORIGINE (le gabarit), jamais de la bibliothèque — changer de
  machine ne doit jamais changer le tempo ni le nombre de séries d'un exercice HSR. Seuls
  `nom`/`consigne`/`materiel`/`tendon`/`groupe`/`mouvement`/`famille` viennent de
  l'alternative choisie. Séries remises à zéro (celles de l'ancien exercice n'ont aucun sens
  sous le nouveau nom). Pas de poids par défaut fabriqué pour un exercice jamais utilisé :
  champ vide plutôt qu'un nombre inventé (même principe que partout ailleurs dans l'app).
- **Bug trouvé au test, corrigé avant de livrer** : le premier lot filtrait les candidats par
  `groupe`+`mouvement` — trop large. "Presse à cuisses" et "Iso leg extension" partagent les
  deux (`quadriceps`/`genou`) mais sont des exercices mécaniquement différents (poussée
  composée vs isolation) ; le filtre les proposait l'un pour l'autre. **Nouveau tag
  `famille`** (ex. `"presse-cuisses"`, `"leg-extension-unilaterale"`) posé à la fois sur
  `EXERCISE_LIBRARY` et sur les 13 exercices concernés de `TEMPLATES` (17 occurrences, la
  plupart dupliquées entre Lower A/B/C) — identifie le mouvement précis, substituable
  seulement à équipement différent. Purement additif sur `TEMPLATES` (nouveau champ,
  `n`/`s`/`r`/tout le reste inchangé) : aucun risque, aucune migration.
- **Testé dans l'aperçu** : "Presse à cuisses" ne propose plus que ses deux variantes
  poulie/disque (plus de contamination croisée avec Iso leg extension/Leg extension
  unilatérale) ; substitution réelle sur "Leg extension unilatérale" → "Leg extension
  unilatérale (poulie)" confirmée (3×8-10 conservé, "première fois" correct, consigne
  reprise) ; aucune erreur console. Séance de test annulée, rien sauvegardé. Build
  `apps/perso` ET `apps/public` propres.
- **Non fait à ce stade** : le bouton n'apparaît que pour les 13 exercices déjà taggés
  `famille` (ceux qui ont un pendant dans `EXERCISE_LIBRARY`) — les autres (Hip thrust, RDL,
  travail de core, curls...) n'ont simplement pas de bouton, comportement honnête plutôt
  qu'une liste vide affichée pour rien. La bibliothèque continuera de grandir au fil de
  l'eau (lot 1) ; la question apps/public (identité au-delà du nom si un jour les
  utilisatrices créent leurs propres exercices) reste ouverte, non retranchée.

### Correctif same-day : substitution perdue à la réouverture d'une séance (01/09/2026)

Trouvé par Yoann en testant après livraison, pas au premier tour de tests : rouvrir en
modification une séance contenant un exercice substitué le réaffichait sous son nom
D'ORIGINE (poids par défaut, aucun historique) au lieu du nom substitué avec ses vraies
valeurs sauvegardées — enregistrer les modifications à ce moment-là aurait donc écrasé les
séries loguées sous le nom substitué.

- **Cause** : `buildExos` retrouvait une séance déjà enregistrée en cherchant
  `initial.exercices.find(e => e.nom === ex.n)` — `ex.n` est le nom du gabarit (« Leg
  extension unilatérale »), mais l'entrée sauvegardée porte le nom SUBSTITUÉ (« Leg extension
  unilatérale (poulie) ») : le match échouait silencieusement, sans erreur visible.
- **Fix** : nouveau champ `origine` sur l'entrée sauvegardée (posé par `substitute()`, jamais
  écrasé par une substitution suivante — garde le nom du gabarit, pas le remplacement
  précédent) et persisté par `validate()`. `buildExos` matche désormais par
  `e.nom === ex.n || e.origine === ex.n`, et si l'entrée retrouvée est bien substituée,
  recalcule `consigne`/`groupe`/`mouvement`/`materiel`/`tendon`/`last`/`def` sous le nom
  substitué (pas celui du gabarit) en recherchant l'entrée correspondante dans
  `EXERCISE_LIBRARY`.
- **Testé dans l'aperçu, bout en bout** : substitution "Leg extension unilatérale" →
  "(disque)", 35 kg × 9 coché, séance validée, **réouverte en modification** — confirmée
  rechargée sous "Leg extension unilatérale (disque)" avec "dernière fois : 35 kg × 9 · 1
  série ✓" (pas un retour au gabarit d'origine). Aucune erreur console. Séance de test
  annulée puis supprimée après vérification, rien de réel affecté. Build `apps/perso` propre.

## Chantier RawCare — Planning Basket fixe (01/09/2026, v3.69.0)

Le recommandeur ne connaissait que ce qui était déjà loggé dans `trainingLog` — il ne
pouvait pas savoir qu'un Basket est prévu AVANT d'être saisi. Yoann a un entraînement fixe
le mercredi soir et le vendredi midi, plus 22 matchs le dimanche cette saison (octobre à
mai) — des dates PONCTUELLES, pas "tous les dimanches" (~34 dimanches possibles sur la
période, seulement 22 avec match).

- **`basketSchedule`, nouvelle clé `DATA_KEYS`** : `{ weekly: [0-6], matchDates:
  ["AAAA-MM-JJ"] }` (0=dimanche...6=samedi, comme `Date#getDay()`). Deux mécanismes
  distincts pour deux réalités distinctes — un jour fixe se répète indéfiniment, une date de
  match ne se répète jamais toute seule. Défaut `{weekly:[], matchDates:[]}` : aucun effet
  tant que rien n'est configuré.
- **`packages/core/src/recommender.js`, nouveau paramètre optionnel `basketSchedule`** —
  absent (comportement de tous les appelants d'avant ce chantier, et d'`apps/public` qui ne
  le fournit pas encore) → `isScheduledBasket` renvoie toujours `false`, comportement
  identique bit pour bit à avant.
  - **`dKneeEff`** (nouveau, distinct de `dKnee`) : un Basket prévu aujourd'hui OU hier
    (planning, pas encore loggé) compte comme une exposition genou pour le gate du Lower —
    exactement comme si la séance avait déjà eu lieu. **Utilisé UNIQUEMENT par le bloc Lower**,
    jamais par le bloc Basket lui-même : sinon un Basket prévu aujourd'hui s'écarterait de
    ses propres suggestions (`dKnee`/`kneeToday` réels, inchangés, gardent ce rôle pour le
    bloc Basket). Message distinct selon que l'exposition est réelle ("Exposition genou déjà
    faite aujourd'hui") ou seulement planifiée ("Basket prévu aujourd'hui") — jamais
    affirmer un fait qui n'a pas encore eu lieu.
  - **Priorité absolue le jour même** : un Basket planifié aujourd'hui obtient un score fixe
    de 999 (au-dessus de tout calcul possible) avec le texte "C'est le jour de
    l'entraînement — Basket prévu aujourd'hui", garantissant la première place dans
    "Prochaine séance" — demande explicite de Yoann, ce n'est plus une suggestion parmi
    d'autres à évaluer une fois que c'est sur le planning. Placé après les gates de sécurité
    (genou rouge, double exposition réelle) : ceux-ci restent prioritaires même un jour
    planifié.
- **`packages/core/src/coach/prompt.js`** : `basketSchedule` ajouté au sac de données de
  `buildCoachPrompt`, transmis tel quel à `recommendSessions` — même verdict entre la carte
  "Prochaine séance" et le Coach IA, comme depuis Phase 1. `buildCoachBriefing` n'appelle pas
  `recommendSessions`, non concerné.
- **`apps/perso/src/App.jsx`** : état `basketSchedule` (chargé/sauvé comme `climbScheme`),
  nouvelle carte "Planning Basket fixe" dans les Réglages — chips jour de semaine
  (Lun-Dim, multi-sélection) pour l'entraînement récurrent, champ date + liste
  ajouter/supprimer pour les dates de match. Réglages plutôt que code en dur (décision de
  Yoann) : la saison de matchs change, pas de rebuild à chaque fois.
- **Correctif au passage, sans rapport avec ce chantier** : le titre "## Règles absolues à
  ne jamais casser" avait été écrasé par erreur lors d'une édition précédente (remplacé par
  un titre de chantier dupliqué) — repéré en cherchant où insérer cette section, corrigé.
- **Testé dans l'aperçu** (mercredi 2 septembre confirmé via l'horloge du navigateur) :
  planning configuré (mercredi + vendredi + un dimanche de test), "Prochaine séance" affiche
  bien Basket en premier avec le score 999 et le texte dédié, "Lower A / B" apparaît dans
  "à éviter" avec "Basket prévu aujourd'hui — ne pas empiler." Logique du lendemain (jeudi,
  cooldown 48h même sans avoir loggé le Basket de la veille) vérifiée par script Node isolé
  (impossible de changer l'horloge du navigateur d'aperçu) : `dKneeEff = 1` le jeudi suivant
  un mercredi planifié, gate bien déclenché. Dates de match testées indépendamment des jours
  fixes (un dimanche sans match dans la liste n'est pas reconnu). Aucune erreur console.
  Build `apps/perso` ET `apps/public` propres.
- **Non fait à ce stade** : Yoann doit configurer lui-même son vrai planning dans Réglages
  après l'installation (mercredi/vendredi + ses 22 dates de match réelles) — je n'ai pas ses
  22 dates, seule une date de test a été utilisée puis laissée dans l'aperçu (sans
  conséquence, aperçu isolé du téléphone réel). `apps/public` n'a pas encore ce réglage
  (pas d'écran Réglages équivalent pour l'instant) — le paramètre reste `undefined` côté
  public, sans effet, comme prévu par la conception additive.

## Chantier RawCare — Favoris cherchés en premier (01/09/2026, v3.69.1)

Retour de Yoann : taper 2 caractères dans la recherche d'aliment faisait disparaître
entièrement "Vos aliments habituels" au profit de CIQUAL — retrouver un favori en tapant son
nom prenait donc plus de temps que la première fois où il avait été loggé.

- **`FoodSearch.jsx` (les deux apps)** : `favMatches` — filtre texte local sur `sugg` (déjà
  tous les favoris/récents, jamais limité) dès que la recherche est active, affiché dans une
  nouvelle section "Favoris et récents" juste après "Vos recettes", avant les résultats
  CIQUAL/OFF. Mêmes actions que la liste habituelle (épingler, masquer, `+` ajout rapide).
  Les résultats CIQUAL en dessous excluent ce qui est déjà remonté en favori (par `ref`), pour
  ne jamais afficher le même aliment deux fois à l'écran.
- **Testé dans l'aperçu (`apps/perso`)** : "Pomme Gala" loguée puis recherchée par "pomme" —
  remonte bien en tête sous "Favoris et récents", absente des 40 résultats CIQUAL juste en
  dessous (pas de doublon). Aucune erreur console. Test nettoyé (localStorage vidé).
  **`apps/public` non testé en direct** (pas de session Supabase active) — port fichier par
  fichier en miroir exact, build propre.

## Chantier RawCare — Échauffement basket + Mobilité en carnet, nouveaux repas (04/09/2026, v3.70.0)

Deux retours groupés, `apps/perso` uniquement (contenu personnel — programme d'échauffement,
routine coude/genou spécifiques). Décisions prises sans repasser par une question, avec le
raisonnement explicité ici pour que Yoann puisse challenger a posteriori :
- **"Pré-training"/"Post-training"** : noms retenus tels que proposés par Yoann — cohérents
  avec le reste de l'app (PERI/BASKET_PROTOCOLS parlent déjà d'"avant"/"après basket" en
  prose, WHEY/RPE/TDEE/HSR sont déjà des emprunts anglais assumés) et plus précis que "Avant
  entraînement"/"Après entraînement" (ambigus avec "avant/après LA séance de muscu du jour").
- **Tuile "Mobilité"** (pas "Mobilité/rééducation", qui ne tenait pas bien dans la grille
  2 colonnes) : un seul mot, même longueur que les autres tuiles ("Escalade", "Lower C"),
  couvre à la fois mobilité générale et rééduc genou/coude.

### Onglet Macro — 2 repas ajoutés, 1 renommé

- **`packages/core/src/nutrition/foodStore.js`, `MEALS`** : "Pré-training" ajouté avant
  "Petit-déjeuner", "Post-training" ajouté après "Dîner" (avant "Extra") — nouvelles clés
  (`pretraining`/`posttraining`), aucune migration nécessaire. **"Autre" → "Extra" est un
  renommage d'AFFICHAGE seul** : la clé interne reste `"autre"` (déjà stockée dans chaque
  ligne de `foodLog` depuis M1) — la renommer aurait cassé le regroupement par repas de tout
  l'historique déjà saisi sous cette clé, pour un gain purement cosmétique. Ordre dans `MEALS`
  = ordre d'affichage uniquement (vérifié : aucun autre code n'en dépend), donc sans risque.
- **`coach/prompt.js`** : la phrase du prompt qui explique au modèle les repères horaires par
  repas ("avant midi seul le petit-déjeuner...") mentionne désormais "Pré-training"/
  "Post-training"/"Extra" comme repas flexibles (liés à une séance, pas à l'heure), à la place
  de la seule mention "Autre".
- Propagé automatiquement à `apps/public` (même `MEALS` partagé) — non testé en direct (pas de
  session Supabase active dans cette session).

### Onglet Séances — Basket et Mobilité en carnet d'exercices

- **Basket** (`packages/core/src/session/templates.js`) : passe de `kind: "sport"` (exos
  vides) à `kind: "muscu"` avec 7 exercices d'échauffement — l'échauffement, jusqu'ici une
  routine à minuteur JOUÉE depuis l'onglet Douleurs (jamais logguée), devient un vrai carnet
  suivi pas à pas comme Upper/Lower (mêmes checkboxes série par série, mêmes minuteur/
  historique/records) et sauvegardé dans `trainingLog` — donc visible par le Coach IA et
  "Dernières séances". **Montée en régime progressive** (demande explicite) : 7 étapes
  d'intensité croissante (cardio léger → mobilité dynamique → primer iso genou wall-sit →
  squats poids du corps → sauts → changements de direction 70-80 % → spécifique intensité
  match) — contenu réétalé depuis les 5 blocs d'origine de `ROUTINES.basket`, pas juste
  renommé, pour une vraie progressivité. Les repères de sécurité genou (primer sous le seuil
  de douleur, activation avant charge) sont conservés du texte d'origine.
- **`withMeta: true`** (nouveau flag `TEMPLATES`) : Basket restait le seul type "muscu" à
  avoir besoin de Durée + RPE (déjà utilisés par "Dernières séances" et le Coach IA pour les
  séances non-muscu) — sans ce flag, passer Basket en carnet d'exercices aurait fait perdre
  ces deux champs. `MuscuLogger` (`apps/perso/src/App.jsx`) gagne un état `duration`/`rpe`
  local (init `initial?.duration ?? 60`/`initial?.rpe ?? 7`, même défaut que l'ancien
  formulaire non-muscu), rendu juste sous Date/Début uniquement si `template.withMeta`, et
  persisté par `validate()`. "Dernières séances" affiche désormais les deux à la fois quand
  ils coexistent (`7 exos · 12 séries · 60′ · RPE 7`) au lieu de l'ancien "soit l'un soit
  l'autre" — la ligne construit une liste de morceaux (exos/séries, durée, RPE, escalade) et
  ne garde que ceux présents, rétrocompatible à l'identique pour tous les autres types.
- **Nouvelle tuile "Mobilité"** (`TEMPLATES`, `kind: "muscu"`) : déménagée depuis
  `ROUTINES.reeduc` (2 blocs genou/coude uniquement) et **élargie à 7 exercices au choix**
  (demande explicite : "avoir le choix... même si je les fais pas tous") — les 2 exercices
  d'origine (iso leg extension genou, iso flexion coude prise marteau + supination, mêmes
  consignes Silbernagel) plus 5 exercices de mobilité générale (hanche, chevilles, chaîne
  postérieure, épaules, gainage doux). **Tous en `opt: true`** — même mécanisme déjà en place
  pour "Iso leg extension (si genou raide)" en Lower A : un exercice non coché n'est
  simplement pas persisté (`validate()` le filtre), donc "choisir librement" ne demandait
  aucun nouveau code, seulement le bon contenu et le bon flag partout.
- **Aucun impact négatif sur les douleurs/l'entraînement futur — demande explicite, vérifiée
  point par point** :
  - "Mobilité" porte `chargeTags: []` et aucun flag `knee`/`climb` : ne gate ni ne pénalise
    jamais rien (le gate/la pénalité genou-coude lit `chargeTags`, voir Phase 1 lot 3).
  - `recommender.js` : nouveau `isLoadBearing = (t) => t.type !== "Mobilité"`, appliqué à
    `load3` (charge 3 j, sinon aurait déclenché `fatigueScore`/`loadHigh` à tort sur une
    séance de récup), `trainedDays` (streak — un jour de Mobilité seule ne casse ni ne compte
    comme un jour "entraîné"), et `recentExoNames` (signal de baisse de perf — la durée d'un
    étirement n'a rien à voir avec une tendance de charge). Reste dans `training` sans filtre
    partout ailleurs (historique, décompte "7 j" par type exact, Coach IA) : seuls ces 3
    signaux génériques "toute séance compte" en avaient besoin.
  - Basket, lui, continue de compter normalement dans `chargeTags: ["genou"]`/`load3`/
    `trainedDays` — comportement inchangé, c'est une vraie charge d'entraînement.
- **`parseSecs`/`medianTarget` gèrent désormais "min"** (`templates.js`/`session/perf.js`) :
  bug trouvé au test — "5 min" (Cardio léger, Basket) affichait "maintien 5 s" et préremplissait
  la série à 5 au lieu de 300, les deux fonctions ne lisant que le dernier nombre de la chaîne
  sans regarder l'unité. Corrigé par un test `/min/i` (× 60 si présent), sans "min" dans la
  chaîne le comportement est strictement inchangé (vérifié : toutes les autres cibles du
  projet, en secondes ou en reps, ne contiennent jamais "min").
- **`PainTab`/`ROUTINES`** : la section "Routines guidées" (genou uniquement) et son état
  `routine` retirés de `PainTab` — `RoutinePlayer`/`flatten()` (App.jsx) et l'import
  `SkipForward` (devenus morts) supprimés. **`ROUTINES` reste exporté par `templates.js` et
  intact** : `apps/public` l'utilise encore dans son propre `PainTab.jsx` (zones dynamiques,
  hors scope de ce chantier apps/perso-only) — vérifié avant de toucher au fichier partagé.
- **Non propagé à `apps/public`, volontairement** : "Mobilité" n'est PAS dans `FAMILY_TYPES`
  (`apps/public/src/onboarding.js`), donc n'apparaît jamais dans son picker de séances — même
  mécanisme déjà en place pour "Lower C" (type présent dans `TEMPLATES` mais absent de
  `FAMILY_TYPES.musculation`, donc invisible côté public). Basket, en revanche, EST dans
  `FAMILY_TYPES.basket` : le nouveau contenu d'échauffement + `withMeta` profitent aussi aux
  utilisateurs `apps/public` qui logguent du Basket — attendu, pas un oubli : c'est le même
  mécanisme de partage déjà en jeu pour tout changement de contenu Upper/Lower/Basket/Escalade
  depuis la Phase 2 (ex. renommage "Leg curl"), pas une propagation par réflexe.
- **Testé dans l'aperçu (`apps/perso`)** : tuile "MOBILITÉ" tient sur une ligne dans la grille
  2 colonnes ; Basket ouvre bien un carnet à 7 exercices avec Durée/RPE, "maintien 300 s"
  correct pour "5 min", série préremplie à 300 (plus 5) ; séance Basket loguée avec 1 série
  cochée + durée 60′/RPE 7 → "Dernières séances" affiche "7 exos · 12 séries · 60′ · RPE 7" ;
  Mobilité ouvre 7 exercices tous marqués "(option)", aucun champ Durée/RPE (pas `withMeta`) ;
  onglet Douleurs vérifié sans la section Routines, table HSR intacte pour le genou ; onglet
  Macro vérifié avec les 7 repas dans l'ordre Pré-training → Petit-déjeuner → Déjeuner →
  Goûter → Dîner → Post-training → Extra. Aucune erreur console à aucune étape. Séance de
  test supprimée après vérification. Build `apps/perso` ET `apps/public` propres.
- **Non fait à ce stade** : `apps/public` non testé en direct (pas de session Supabase
  active) ; pas de nouvelle question posée à Yoann sur le contenu exact des 7 exercices de
  Mobilité (choix fait avec le raisonnement documenté ci-dessus, à ajuster sur son retour).

## Chantier RawCare — Coude retiré, planning idéal couplé au recommandeur (05/09/2026, apps/perso v3.71.0)

Yoann n'a plus aucune douleur au coude depuis son retour de vacances — confirmé explicitement,
retrait complet demandé (option "tout retirer", pas juste désactiver le gate).

- **Coude retiré du recommandeur sans toucher à sa logique** : `DEFAULT_ZONES`
  (`packages/core/src/pain.js`) ne porte plus que le genou. Le mécanisme par TAG (Phase 1,
  RawCare) rend ça sans risque — plus aucune zone ne portant `gateTag: "tirage"`, tout ce qui
  dépendait du coude dans `recommender.js` (gate Escalade/Upper, `AMBER_PENALTY.tirage`, texte
  des raisons) devient silencieusement neutre (`NEUTRAL_ZONE`) : **`recommender.js` lui-même
  n'a pas été touché**.
- **`PainTab` simplifié à une seule zone** (genou) : plus de sélecteur `Pills` de zone,
  `PAIN_ZONES` ne contient plus que "Genou". `elbowLog` reste dans `DATA_KEYS` (voir Règles
  absolues #1) pour ne pas perdre l'historique déjà exporté, mais plus aucun code natif ne le
  lit/l'écrit.
- **`coach/prompt.js`** : branche `!zones` (legacy, celle qu'utilise `apps/perso`) purgée de
  toute mention du coude (`douleur_coude_*`, `summary.coude`, `painDomainClause`). La clause
  "Une tendinopathie en rééduc" s'ajuste automatiquement (déjà générique par zone depuis Phase
  1) puisque `DEFAULT_ZONES` n'a plus qu'une entrée.
- **Mobilité (TEMPLATES) inchangée** : le seul exercice de coude déjà présent ("Iso flexion
  coude prise marteau + supination") était déjà LE seul exercice coude de la routine — rien à
  retirer, la demande "garder un seul exercice" était déjà satisfaite par construction.
- **`apps/public` non affecté** : ses zones sont dynamiques (`data.painZones`), jamais liées à
  `DEFAULT_ZONES` — vérifié avant de toucher au fichier partagé.

### Planning idéal couplé au recommandeur

- **Mardi/Jeudi inversés** dans `WEEKLY_PLAN` (App.jsx, onglet TDEE) — Repos actif passe au
  mardi, Upper au jeudi, dans les deux variantes (avec/sans match).
- **`WEEKLY_PLAN_FAMILIES`** : version machine-lisible du même planning (une ou plusieurs
  "familles" de type par jour de la semaine, ex. `["Lower"]`, `["Mobilité","Basket"]`), gardée
  manuellement synchronisée avec `WEEKLY_PLAN` (commentaire explicite dans le code pour ne pas
  les faire diverger).
- **`recommender.js`, nouveau paramètre optionnel `weeklyPlan`** : liste de familles prévues
  aujourd'hui, déjà résolue par l'appelant. **Bonus de score MODÉRÉ (+18 pts)**, jamais un
  remplacement — décision explicite de Yoann (pas de priorité quasi systématique comme le
  Basket planifié). Appliqué en tout dernier, après tous les gates de sécurité : un type déjà
  écarté via `avoid` n'est jamais bonifié.
- **Semaine avec/sans match détectée AUTOMATIQUEMENT** (`familiesForToday` dans App.jsx) depuis
  `basketSchedule.matchDates` : un match le dimanche de la semaine en cours → variante
  "avecMatch", sinon "sansMatch" — décision explicite de Yoann plutôt qu'un réglage manuel à
  rebasculer chaque semaine.
- **Coach IA** : `weeklyPlan` transmis à `buildCoachPrompt`/`recommendSessions` de la même
  façon que côté Dashboard — jamais deux verdicts différents.
- **Testé en direct dans l'aperçu** : bonus "Planning idéal du jour : Lower — bonus de
  priorité" confirmé sur "Lower A" un samedi ; bascule automatique vers "avecMatch" vérifiée en
  seedant un match le dimanche suivant (le score du jour passe de Lower à Upper, conforme au
  planning avec match).

## Chantier RawCare — Score d'énergie façon Samsung Health + score de sommeil (05-07/09/2026, apps/perso v3.71.0 → v3.72.0)

Samsung Health affiche un "score d'énergie" propriétaire, jamais exposé par Health Connect (ni
`RestingHeartRateRecord`, confirmé vide sur ce téléphone malgré une FC repos bien visible dans
Samsung Health — voir plus bas). Le Samsung Health Data SDK (accès plus direct) a été écarté
comme trop complexe pour ce projet, comme documenté plus haut dans ce fichier. Ce chantier
reconstruit une approximation maison à partir de données déjà lisibles via Health Connect.

- **Nouveau module pur `packages/core/src/energy.js`** (aucune dépendance React/DOM) :
  - `computeSleepScore(night)` : score de sommeil sur 100, remis à l'échelle depuis la qualité
    1-4 déjà calculée nativement (efficacité + temps endormi, `HealthNutritionPlugin.readSleep`)
    plutôt que recalculé depuis zéro. Paliers donnés par Yoann : 85-100 excellent (qualité 4),
    75-84 bon (3), 60-74 correct (2), 0-59 risque (1) ; la durée de la nuit place le score À
    L'INTÉRIEUR de son palier. Sans qualité native (saisie manuelle, ou nuit sans détail par
    phase) : estimation par la seule durée, jamais "excellent" sans une vraie mesure
    d'efficacité.
  - `computeEnergyScore(t0, {rhrLog, sleepLog, stepsLog})` : 4 modules sur 100 pts (grille
    donnée par Yoann) — FC repos vs moyenne 7 j (30 pts), sommeil de la nuit (30 pts, **recalibré
    le 07/09/2026** — voir plus bas), activité de la veille (25 pts), régularité du sommeil vs
    moyenne 7 j (15 pts). `trailingAvg` : moyenne des 7 jours PRÉCÉDANT (jamais incluant) le jour
    noté, minimum 3 points trouvés sinon `null` — jamais une moyenne peu fiable. **Jamais de
    total inventé** : si un seul module manque de donnée, `status: "insufficient"`, mais le
    détail des modules disponibles reste affiché (pas un "pas assez de données" muet).
  - `scoreLabel(v)` : libellé qualitatif (Excellent/Bon/Correct/Risque), mêmes paliers que le
    score de sommeil.
- **Recalibrage du module sommeil (07/09/2026)** : le barème d'origine (durée seule — 8h=30,
  7h=25, 6h=18...) suivait la grille demandée à la lettre mais contredisait une règle déjà
  établie dans ce fichier (Yoann est short sleeper, 6-7h est SA normale, jamais un signal de
  fatigue) — ça décalait systématiquement le score vers le bas par rapport à Samsung Health, qui
  pondère surtout qualité/efficacité. Remplacé par `computeSleepScore(night)` ramené sur 30
  points (`Math.round(score/100 × 30)`), confirmé par Yoann après une question explicite —
  jamais deux calculs de "qualité de sommeil" différents qui pourraient se contredire.
- **FC repos (`rhrLog`, nouvelle clé DATA_KEYS)** — deux versions, la seconde seule retenue :
  - **v1 abandonnée** : lecture de `RestingHeartRateRecord` (type Health Connect dédié) — resté
    vide après synchro sur ce téléphone alors que Samsung Health affiche bien une FC repos dans
    sa propre UI. Confirmé par Yoann via l'app Health Connect elle-même (autorisation "FC repos"
    accordée, mais aucune entrée de ce type précis) : Samsung Health ne pousse pas ce type vers
    Health Connect ici, seulement la FC continue.
  - **v2 retenue** (`HealthNutritionPlugin.readRestingHeartRate`) : FC repos reconstruite en
    moyennant les mesures de FC continue (`HeartRateRecord`) tombant dans les phases de sommeil
    RÉEL de chaque nuit (mêmes stages/découpage "jour de sommeil" que `readSleep`), avec repli
    sur la période brute coucher→réveil si une nuit n'a pas de détail par phase.
  - **Bug de pagination trouvé en diagnostiquant sur device (logs `adb logcat`)** : `readRecords`
    limite à 1000 enregistrements par page et ne renvoie que la première page si on ignore
    `pageToken` — invisible pour poids/sommeil/nutrition (quelques enregistrements/jour), mais
    sur 14 jours de FC continue (largement >1000 enregistrements, triés du plus ancien au plus
    récent), ça coupait systématiquement AVANT les données du jour même. Nouveau helper privé
    `readAllRecords` (boucle sur toutes les pages) dans `HealthNutritionPlugin.kt`, utilisé pour
    la lecture FC. Diagnostiqué en ajoutant des `Log.d` temporaires lus en direct via
    `adb logcat` pendant un relancement forcé de l'app (`am force-stop` + `am start`) — logs
    retirés une fois la cause confirmée.
  - `healthSync.js` : `READ_TYPES` demande `"heartRate"` (plus `"restingHeartRate"`, abandonné
    avec la v1).
- **UI** :
  - Onglet **Sommeil renommé "Énergie"** (`SleepTab` dans App.jsx, clé de tab restée `"sleep"`
    en interne) : nouvelle carte `EnergyScoreCard` en tête (score total + détail des 4 modules,
    toujours affiché même si le total est indisponible), score de sommeil affiché à côté de la
    durée ("Dernière nuit"). Durée du module sommeil affichée en **h/min** (`fmtHM`), jamais en
    décimal.
  - **Tuile Dashboard "Douleurs" remplacée par "Score d'énergie"** (demande explicite de Yoann —
    le genou reste suivi via l'onglet Douleurs, plus besoin de sa propre tuile).
  - **Alerte** sous la carte "Prochaine séance" si aucune entrée genou n'existe pour aujourd'hui
    (`!knee.some(k => k.date === today())`) — demande explicite, distincte du `kneeNote` déjà
    existant dans le recommandeur (qui ne se déclenche qu'après péremption de 3 j, pas "pas noté
    aujourd'hui" spécifiquement).
  - **Widget écran d'accueil** : tuile "Sommeil" → "Énergie" (`WidgetBridgePlugin.KEYS`,
    `DashboardWidgetProvider.buildViews`, `widget_dashboard.xml` — ids et libellé renommés).
    Valeur = score d'énergie + libellé qualitatif (`scoreLabel`, ex. "88 Excellent" — taille de
    police réduite à 13sp sur cette tuile pour absorber la longueur variable du libellé). Note =
    "Sommeil " + durée réelle en h/min (PAS le score de sommeil — changé sur demande explicite
    après un premier essai avec le score).
  - **Score d'énergie intégré comme signal d'adaptation dans le recommandeur** (pas seulement
    affiché) : nouveau paramètre optionnel `energy` dans `recommendSessions`, `energyLow`
    (score < 50, silencieux si donnée absente) traité exactement comme `sleepPoor`/`loadHigh`
    (nudge -6 sur `fatigueScore`, +8 sur Repos) — complète ce que Yoann avait demandé
    initialement ("adapter en fonction de... score d'énergie") et qui manquait à la première
    passe.
- **Testé en conditions réelles sur le téléphone de Yoann** (pas seulement dans l'aperçu) :
  build + `npx cap sync android` + `gradlew assembleDebug` + `adb install -r`, logs vérifiés
  via `adb logcat` à chaque étape de diagnostic. Score final confirmé cohérent (ex. "92
  Excellent" avec 6h01 de sommeil, plus jamais pénalisé pour une nuit courte de bonne qualité).

## Chantier RawCare — Carte resto : diagnostic et corrections (07/09/2026, apps/perso v3.73.0 → v3.73.1)

Signalé par Yoann : une carte de restaurant réelle (site avec plusieurs menus sur une seule
page — formule déjeuner, carte à la carte, carte des boissons/vins) ne remontait aucun plat.
Diagnostic fait AVANT toute modification (méthode demandée explicitement par Yoann,
confirmation point par point) : récupération de la page en HTTP simple (`curl`, sans JS —
proche de ce que voit l'outil `web_fetch`, qui ne rend pas le JavaScript selon la doc Anthropic)
pour mesurer son contenu réel plutôt que deviner.

- **Cause 1 (confirmée) : `max_content_tokens` trop bas.** Une page de carte resto réaliste,
  cumulant plusieurs menus, peut à elle seule dépasser largement les 5000 tokens de texte
  d'origine (mesuré : ~5900 tokens sur un cas réel qui n'était pourtant pas anormalement long) —
  la lecture était tronquée avant même d'atteindre le menu utile.
- **Cause 2 (confirmée, hypothèse initiale de Yoann) : pollution par plusieurs menus + carte des
  boissons/vins.** Une fois le HTML aplati en texte, plus aucun titre ne sépare "Menu Déjeuner"/
  "Carte Food"/"Carte des Boissons"/"Carte des Vins" — des plats identiques apparaissent parfois
  en double (formule ET carte, prix différents), et une énorme liste de boissons/vins/cocktails
  suit directement les plats sans démarcation claire.
- **Cause 3 (angle mort du code, indépendant de l'URL testée) : le bloc `web_fetch_tool_result`
  était totalement ignoré** — seuls les blocs `type: "text"` de la réponse étaient lus. Un échec
  net de lecture (page bloquée, type non supporté, timeout — `error_code` documenté par
  Anthropic) donnait donc exactement le même "Aucun plat reconnu" qu'une carte simplement vide,
  aucun moyen de distinguer les deux cas.
- **`RestaurantMenu.jsx`, trois correctifs (les 3 validés par Yoann)** :
  1. `max_content_tokens` : 5000 → 20000 (testé en conditions réelles) → **10000** (valeur
     retenue) — 20000 laissait passer la carte des boissons/vins EN ENTIER, que le modèle doit
     ensuite activement lire puis exclure (prompt), ce qui grignotait à son tour trop de budget
     de réflexion pour finir le JSON (voir point 3).
  2. `SYSTEM_PROMPT` renforcé : exclusion explicite des boissons/alcool de la liste des plats,
     consigne pour repérer TOUS les menus de nourriture d'une page qui en cumule plusieurs tout
     en ignorant ce qui suit "Carte des boissons"/"Carte des vins"/"Cocktails"/etc., et
     dédoublonnage des plats identiques entre plusieurs menus (garder la version "à la carte"
     plutôt que la formule).
  3. `webFetchError(content)` : détecte un bloc `web_fetch_tool_result` en échec
     (`type: "web_fetch_tool_result_error"`), mappe son `error_code` à un message clair affiché
     à l'écran au lieu du générique "Aucun plat reconnu".
- **Bug supplémentaire trouvé EN TESTANT le correctif ci-dessus (même piège que le Coach IA,
  déjà documenté dans ce fichier)** : `maxTokens` (budget de SORTIE, réflexion `effort:"medium"`
  comprise) était resté à 3000 alors que `max_content_tokens` avait été monté à 20000 — plus de
  contenu à digérer ⇒ plus de réflexion ⇒ le JSON se coupait en plein milieu
  (`stop_reason: "max_tokens"`), d'où "Réponse illisible" alors que le fetch avait réussi.
  Ajout d'un message dédié ("Réponse coupée...") quand `stop_reason === "max_tokens"`, pour que
  ce cas précis se reconnaisse tout seul si ça revient. `maxTokens` : 3000 → 8000 (encore
  insuffisant en test réel) → **14000** (valeur retenue).
- **Confirmé fonctionnel par Yoann sur son téléphone** après le réglage `max_content_tokens:
  10000` / `maxTokens: 14000` — testé avec un lien réel, plats correctement extraits.
- **L'URL utilisée pour ce diagnostic était un exemple de test fourni par Yoann, volontairement
  non conservée dans le code ni dans cette documentation** (demande explicite) — le
  raisonnement/les correctifs ci-dessus sont génériques, pas spécifiques à un site.
- **Intégration au journal vérifiée, déjà en place, rien à créer** : `logRestoDishes`
  (`NutritionTab.jsx`) utilise déjà `food.addMany` avec exactement le même chemin de stockage
  (`foodLog`) que "Ajouter"/"Saisie libre", suffixé "(estimé IA)".

## Macro rapide — calories toujours éditables (07/09/2026, apps/perso+public v3.74.0)

`FreeEntry` (saisie libre, `FoodSearch.jsx`) forçait les calories au calcul 4/4/9+fibres dès
qu'une macro était renseignée, masquant le champ de saisie manuelle — impossible de corriger
pour tout ce que les 4 macros suivies ne couvrent pas, l'alcool en particulier (un cocktail à
190 kcal peut n'avoir que quelques grammes de glucides comme macro connue, le reste vient de
l'alcool qui n'est pas une macro suivie par l'app).

- **Un seul champ Calories, toujours visible et modifiable** : pré-rempli automatiquement
  depuis les macros (`kcalComputed`) tant que l'utilisateur n'y a pas touché lui-même
  (`kcalTouched`) ; dès qu'il tape une valeur, elle devient la référence et NE SE FAIT PLUS
  ÉCRASER par un changement de macro ensuite — remplace l'ancien état à deux modes (calories
  calculées en lecture seule OU calories seules, mutuellement exclusifs avec les macros).
  Testé en direct : 16 g glucides → 64 kcal auto, corrigé à 190, ajout de 2 g protéines
  ensuite → reste à 190.
- Porté à l'identique sur `apps/public` (même composant, même comportement).

## Chantier RawCare — 4 points IA (07/09/2026, apps/perso v3.75.0 → v3.77.0)

Suite à une question de Yoann sur l'installation d'un LLM local (Gemma...) pour réduire le
coût API : conclusion que le cloud reste le bon choix (un modèle local serait nettement plus
faible sur ce raisonnement multi-domaine, et n'a pas d'équivalent à `web_fetch`/vision pour
Carte resto/Photo d'un plat — voir l'échange détaillé dans la session). Yoann a ensuite
demandé d'extrapoler ce que l'IA pourrait apporter au quotidien : 6 pistes proposées, une
écartée (#5, alertes précoces douleur), une autre abandonnée après cadrage (#3 initial,
logging repas maison en langage naturel — redondant avec la recherche CIQUAL/OFF déjà en
place, coût répété plusieurs fois par jour pour un gain de friction faible). **3 points
retenus, cadrés en détail avec Yoann avant tout code (réponses aux questions posées via
AskUserQuestion), livrés dans cet ordre — apps/perso uniquement, décision explicite de ne
pas porter sur apps/public dans ce chantier.**

### Point 1 — Constats gratuits (JS pur, zéro appel API)

Nouveau module `packages/core/src/insights.js` (testé en Node) : réutilise records V4, TDEE
V7 et score d'énergie déjà calculés plutôt que de dupliquer leur logique. Nouvelle carte
"Constats" sur le Dashboard (`InsightsCard`, `apps/perso/src/App.jsx`), sous "Prochaine
séance" — sept constats, chacun affiché seulement s'il a assez de données (la carte entière
disparaît si aucun n'en a) :
- **Streaks** : jours d'affilée entraînés (tout type confondu, y compris Mobilité —
  célébration de régularité, pas un signal de charge comme dans le recommandeur) et jours
  d'affilée avec macros loggées. Tolère un jour de battement (streak type Duolingo : pas
  cassé tant qu'un jour complet n'est pas sauté).
- **Récap des records récents** : `recordsBySession` sur 30 jours glissants, un record posé
  un jour où le genou est hors base est exclu (`painOutOfBase`, même garde-fou que
  l'affichage individuel du carnet, V4).
- **Déficit réel** : ne recalcule rien, formate `tdeeNow(...)` (même calcul que la carte
  Macros — jamais deux chiffres différents pour la même réalité).
- **Projection fin de sèche** : poids projeté à la date de fin de `targets.cut`, en
  extrapolant la tendance EMA du poids au rythme mesuré par le TDEE (`deltaKg/days`).
- **Type de séance délaissé** : celui dont la dernière occurrence est la plus ancienne (ou
  jamais loggé, prioritaire), Mobilité exclue (pas une charge d'entraînement, même
  exclusion que `isLoadBearing` dans le recommandeur). Rien signalé sous 14 jours.
- **Régularité de la sèche** : % de jours loggés dans ±10 % de la cible du jour
  (`targetsForDate`), depuis le début de la fenêtre. Un jour non loggé est ignoré, pas compté
  comme un échec.
- **Sommeil vs score d'énergie** : score moyen des matins après une nuit qualité 4 vs
  qualité ≤2, sur 60 jours glissants — `null` sous 3 points par groupe.
- **Testé dans l'aperçu** avec un historique synthétique complet : les 7 lignes s'affichent
  avec les bonnes valeurs, aucune erreur console.

### Point 3 — Coach de programmation (détection de plateau, JS pur aussi)

Nouvelles fonctions dans `packages/core/src/training.js` (testées en Node, 7 scénarios) :
`progressiveOverloadSuggestion(sessions, nom)` détecte un plateau (4 séances d'affilée
"stable", même définition que `exerciseTrend` mais rejouée pas à pas plutôt qu'estimée sur
les 3 dernières) et suggère un progressive overload classique — viser le haut de la
fourchette de reps (`+2 reps`, plafonné au max de la fourchette lue dans les gabarits), puis
passer à la charge supérieure une fois en haut de fourchette (pas d'incrément chiffré :
les paliers réels dépendent du matériel, que l'app ne connaît pas assez finement).
**Exclusions volontaires** : exercices HSR (`templateDefsFor` exclut le nom entier dès
qu'UNE de ses définitions dans les gabarits a `hsr: true` — ex. "Leg extension unilatérale"
est HSR en Lower A/C mais pas en Lower B, donc exclu partout par prudence) et mode "temps"
(gainage/tenues, hors scope).
Affiché sur la fiche exercice de l'écran Progression (`ExerciseDetail`), sous le graphique —
carte "Plateau détecté" avec la consigne exacte. **Même garde-fou que les records (V4)** :
pas de suggestion un jour où le genou est hors base (`painOutOfBase`), pour ne jamais
encourager une surcharge le jour où le tendon a flambé. `knee` remonté en prop depuis
`TrainTab` → `ProgressScreen` → `ExerciseDetail` (n'existait pas avant, ajouté pour ce
chantier).
**Testé dans l'aperçu** : plateau détecté et suggestion correcte sur un historique
synthétique (55 kg × 8 stable → "vise 10 reps") ; carte confirmée masquée après avoir simulé
une douleur genou hors base le jour même.

### Point 4 — Bilan long terme (le seul qui coûte, à la demande uniquement)

Nouveau module `packages/core/src/bilan.js` (testé en Node) : `computeBilanFacts(...)`
étend les briques du point 1 sur une fenêtre de 90 jours (records, déficit réel, projection
de sèche, type délaissé, régularité de la sèche, sommeil vs énergie) et ajoute deux
corrélations propres au bilan, absentes du point 1 :
- **Charge d'escalade vs douleur genou les 2 jours suivants** (`climbLoadPainCorrelation`) :
  douleur moyenne après une "grosse" séance (`climbLoad`, V5) vs une séance légère/normale —
  `null` sous 2 séances par groupe.
- **Fibres vs stagnation de poids, semaine par semaine** (`fiberWeightStagnationCorrelation`) :
  apport moyen en fibres des semaines où le poids a stagné (variation < 0,15 kg) vs des
  semaines où il a nettement baissé — `null` sous 3 semaines par groupe.
Intégré à la carte Coach IA existante (pas un nouvel écran, décision explicite de Yoann) :
nouveau bouton "Bilan 3 mois" à côté d'"Analyser" (`CoachIA`, état `kind` pour distinguer les
deux analyses). `buildBilanPrompt` (`packages/core/src/coach/prompt.js`) — **même principe
que le prompt quotidien : "le JS calcule les faits, l'IA les juge"**, ici étendu sur 3 mois
au lieu de 14 jours. Pas de bloc "temps réel" jour/hier, pas de carnet de bord (ce n'est pas
l'analyse quotidienne) — uniquement les faits calculés, que le modèle interprète et priorise
plutôt que de recalculer ou d'en inventer d'autres (`null` explicite conservé dans le JSON
envoyé : le modèle doit voir qu'un point a été considéré mais manque de données, pas
l'absence silencieuse d'une clé). Limite 600 mots (vs 500 pour l'analyse quotidienne),
`maxTokens: 8000` (vs 6000) par précaution — même piège de troncature déjà rencontré sur le
Coach IA et la Carte resto, mieux vaut un budget large qu'une réponse coupée.
**Testé dans l'aperçu** : bouton "Bilan 3 mois" affiché à côté d'"Analyser" sans casser la
mise en page, clic avec une fausse clé API confirme que `computeBilanFacts`/`buildBilanPrompt`
s'exécutent sans erreur et qu'une vraie requête part vers l'API Anthropic (rejetée
proprement en 401, pas une erreur de requête malformée) — pas de test avec une vraie clé
(nécessiterait la clé réelle de Yoann, hors du champ de ce test).

### Non fait à ce stade

- **Point 2 (mémoire longue/bilan) était le nom d'origine de cette idée** — rebaptisé et
  scindé : ce qui en reste est exactement le point 4 ci-dessus, cadré et livré.
- **`apps/public` non touché**, décision explicite de Yoann (voir en tête de section) — les
  trois modules (`insights.js`, `training.js` étendu, `bilan.js`) vivent dans
  `packages/core`, donc portables sans réécrire la logique le jour où Yoann le demande,
  seule l'UI restera à faire.
- **Pas de test avec un vrai appel API** pour le bilan (voir plus haut) — à confirmer par
  Yoann avec sa vraie clé, en particulier la qualité de l'interprétation des corrélations et
  si la limite de 600 mots/8000 tokens est bien calibrée en usage réel.

### Correctif post-test réel : notes de contexte absentes du Bilan (07/09/2026, v3.77.1)

Testé par Yoann avec sa vraie clé API ("j'ai testé ça m'a l'air cohérent") — puis remonté :
le Bilan 3 mois ignorait complètement le journal `notes` (alcool, insomnie, petite
blessure...), y compris la note du jour. Corrigé : `buildBilanPrompt` (`coach/prompt.js`)
accepte désormais un paramètre `notes`, filtré sur la fenêtre du bilan (90 j, pas 14 j comme
l'analyse quotidienne — sur 3 mois c'est la RÉCURRENCE d'une note qui est le signal, pas une
mention isolée), avec une consigne explicite de relier une récurrence à une corrélation
quand c'est pertinent. `coach.buildBilan()` (App.jsx) passe `notes` en plus des données déjà
utilisées. Testé par script Node (notes dans la fenêtre incluses, notes plus anciennes
exclues, aucun bloc si `notes` vide). **Retour de Yoann après ce correctif** : "c'est mieux"
mais pertinence réelle pas encore certaine — à réévaluer à l'usage, pas de nouvelle demande
de changement pour l'instant.

### Point abandonné : notifications proactives

C'était le 5e point envisagé dans la discussion initiale ("passer du réactif à l'ambiant" —
une notification native le matin avec un mini-résumé), volontairement mis en dernier car le
plus lourd techniquement (nécessite une vraie tâche native en arrière-plan, au-delà d'une
simple notification programmée à l'avance — le mécanisme `LocalNotifications`/`AlarmManager`
déjà en place dans l'app sert à un usage ponctuel, pas à un calcul quotidien répété). Une
fois les points 1/3/4 livrés et proposé à nouveau, **Yoann l'a explicitement abandonné** :
contrairement aux trois autres, ce point ne calcule rien de nouveau — il pousserait vers une
notification une info déjà visible sur le Dashboard (score d'énergie, prochaine séance), et
comme il ouvre l'app plusieurs fois par jour de toute façon (musculation, macros...), le
gain réel ("ne pas avoir à aller chercher l'info") est faible pour son usage. **Ne pas
reproposer sans un nouveau contexte** (ex. un moment identifié où il n'ouvre pas l'app le
matin).

## Idée abandonnée : extrapoler l'eau des aliments (09/09/2026)

Yoann a demandé si l'eau contenue dans les aliments (fruits/légumes surtout, souvent 85-95 %
d'eau) pourrait être calculée et ajoutée à son suivi hydrique — hypothèse que son impression
de "trop boire" (toilettes fréquentes) vienne du fait que son alimentation très végétale
apporte déjà beaucoup d'eau, non comptée par-dessus la cible actuelle. **Scientifiquement
fondé** (les recommandations officielles d'hydratation comptent l'eau totale, boissons +
aliments — c'est déjà pour cette raison que la cible de base avait été baissée de 3000 à
2000 mL le 02/08/2026) et **techniquement faisable** : CIQUAL a une teneur en eau par 100g
dans ses données sources, simplement pas extraite par `build-ciqual.mjs` (arrêté à 5 valeurs
depuis le 01/08/2026) ; Open Food Facts n'a quasiment jamais cette donnée, mais ça importe
peu puisque les fruits/légumes bruts de Yoann passent par CIQUAL, pas par un scan.
Proposition faite (ligne séparée "Eau des aliments", jamais fusionnée dans le compteur
piloté par les boutons +250/+500 pour ne pas rendre ce chiffre auto-déclaré confus) —
**Yoann a tranché que ça ne valait pas le coup** : gain informatif, pas actionnable (aucune
cible à ajuster dessus), pour un chantier qui touche une décision déjà prise (les 5 valeurs
CIQUAL). **Ne pas reproposer sans nouveau contexte.**

## Chantier RawCare — Plateau : volume secondaire + durée affichée (10/09/2026, apps/perso v3.79.0)

Deux retours de Yoann après avoir testé le point 3 du chantier "4 points IA" (détection de
plateau). Question posée d'abord ("comment calculer un progressive overload qui soit
pertinent ?") avant de coder — proposition retenue après discussion des tradeoffs.

- **Volume total comme garde-fou secondaire** (`packages/core/src/training.js`,
  `progressiveOverloadSuggestion`) : jusqu'ici, un plateau se déclarait dès que la MEILLEURE
  série stagnait 4 séances d'affilée (`beats()`), sans regarder les autres séries de la
  séance. Nouveau `sessionVolume(session)` (somme poids × reps de TOUTES les séries cochées)
  sert de second signal : si le volume total a progressé sur la fenêtre du plateau (ex.
  60×8/60×7/60×5 → 60×8/60×8/60×6 — la meilleure série ne bouge pas, mais tenir la charge sur
  les séries suivantes est une vraie progression), ce n'est PAS un plateau. **La charge reste
  prioritaire pour dire hausse/baisse** (historique du 13/08/2026, volontairement pas rouvert) —
  le volume n'intervient qu'en second filtre, jamais comme critère principal.
- **Fenêtre de détection étendue à la vraie série stable**, pas figée à 4 séances : la
  fonction remonte maintenant tant que les séances restent "stable" deux à deux, pour pouvoir
  dire DEPUIS QUAND (`weeks`/`sessions`/`since` dans le retour), pas juste s'il y a plateau ou
  non. `PLATEAU_STABLE_STREAK = 4` reste le seuil minimum pour déclarer un plateau, mais la
  durée réelle peut être plus longue.
- **Affiché à deux endroits** :
  1. **Liste "Progression par exercice"** (`ProgressScreen`) : badge ambre "PLATEAU" à côté
     de la tendance (hausse/baisse/stable), pour voir d'un coup d'œil quels exercices sont
     coincés sans ouvrir chaque fiche.
  2. **Carnet de musculation, en direct** (`MuscuLogger`, demande explicite : "je lance la
     séance, je veux savoir dès que j'ouvre l'exercice") — une ligne discrète "⏸ plateau
     depuis N semaines" juste sous "★ record", même style/emplacement, pas de nouvel écran ni
     de carte supplémentaire ("sans trop alourdir l'interface").
  Même garde-fou douleur que les records (V4) et la fiche détail : masqué si le genou est
  hors base aujourd'hui (`painRed` dans `MuscuLogger`, `painOutOfBase` dans `ProgressScreen`).
- **Fiche détail** (`ExerciseDetail`, carte "Plateau détecté") mise à jour pour afficher la
  vraie durée ("6 séances stables d'affilée (depuis 4 semaines)") au lieu du texte figé
  "4 séances stables d'affilée".
- **Testé en Node** : non-régression sur tous les scénarios déjà couverts (7 du point 3
  initial + 3 du garde-fou volume) — identiques au comportement précédent, seuls les champs
  `weeks`/`sessions`/`since` s'ajoutent au retour. Nouveau scénario : plateau de 6 séances
  espacées de 5 jours après 2 séances de progression → détecte bien exactement les 6 séances
  du plateau (pas les 2 précédentes), 4 semaines calculées correctement. **Testé dans
  l'aperçu** : historique synthétique (6 séances stables sur "Développé incliné haltères",
  espacées de 5 jours) → badge "⏸ plateau depuis 4 semaines" affiché dès l'ouverture de
  l'exercice dans le carnet Upper A, juste sous le record. Aucune erreur console. Build
  `apps/perso` ET `apps/public` propres.

## Chantier RawCare — Gate genou 48h retiré, détails TDEE et sommeil (13/09/2026, apps/perso v3.80.0)

Trois retours de Yoann, discutés et cadrés avant tout code (chaque changement de règle
métier confirmé explicitement, comme demandé) :

### Recommandeur — gate 48h sur Lower A/B retiré

`recommendSessions` bloquait TOTALEMENT Lower A/B (pas juste une pénalité) dès qu'une
activité taguée "genou" (Lower, Basket, Course à pied, Foot) avait eu lieu aujourd'hui OU
hier (`dKneeEff <= 1`). Avec le planning basket réel de Yoann (mercredi + vendredi + matchs
dimanche), ce gate ne laissait plus qu'**un seul jour par semaine** où Lower pouvait sortir
— alors que le score de base vise 2 séances Lower/semaine. Diagnostic confirmé par Yoann,
qui a choisi l'option la plus radicale : **seul l'état RÉEL de la douleur compte désormais**
(`kneeRed` bloque toujours Lower ; `kneeAmber` continue de le pénaliser sans le bloquer),
plus aucune règle basée sur "combien de jours depuis la dernière exposition genou".
`dKneeEff`/`basketYesterday` (devenus morts, ils ne servaient qu'à ce gate) supprimés ;
`basketToday` reste seul nécessaire pour le bloc Basket. Les exclusions "déjà fait
aujourd'hui" de Basket/Course à pied/Foot (basées sur `dKnee`, pas `dKneeEff`) sont
inchangées — hors scope de cette demande, c'est un souci de fatigue générale le même jour,
pas de rééducation du tendon. **Testé** : basket hier ET aujourd'hui, genou en base → Lower A
suggéré normalement (avant : bloqué avec le texte "laisser ~48h au tendon") ; genou
réellement rouge (baseline false) → Lower reste bloqué ; l'auto-exclusion de Basket le jour
même reste intacte.

### Onglet TDEE — nouveaux détails, tous à partir de données déjà calculées

- **Carte "Moyenne kcal" repensée** : Yoann a signalé que ses cheat meals ne suivent pas un
  jour fixe (contrairement à l'hypothèse "cheat days le week-end" du 01/09/2026) — exclure
  spécifiquement le week-end n'avait donc plus de sens pour lui. Remplacée par une vraie
  moyenne glissante 7 jours (lundi-dimanche) : elle absorbe un écart ponctuel quel que soit
  le jour où il tombe, sans avoir à deviner lequel exclure. **Nouvelle fonction
  `weeklyKcalTrend`** (`packages/core/src/targets.js`), factorisée avec l'ancienne
  `weeklyWeekdayKcalTrend` (fonction privée `weeklyKcalAverages` partagée, seul le nombre de
  jours échantillonnés par semaine diffère — 5 vs 7). **`weeklyWeekdayKcalTrend` gardée
  intacte pour `apps/public`**, qui continue de l'utiliser telle quelle (comportement
  vérifié identique par test avant/après la factorisation).
- **Carte "Dépense estimée" enrichie** : `computeTDEE` retournait déjà `windowStart`/
  `windowEnd`/`loggedRate`/`weighRate`/`deltaKg`, simplement jamais affichés. Ajout de deux
  lignes : la fenêtre exacte + % de jours loggés/pesés, et la tendance de poids lissée sur
  la fenêtre — **zéro nouveau calcul**, juste de l'affichage.
- **Nouvelle fonction `tdeeTrend`** (`packages/core/src/tdee.js`) : rejoue `computeTDEE` avec
  un `today` décalé de semaine en semaine (8 points), sur les mêmes données — donne une vraie
  tendance (monte/descend/stagne) au lieu d'un seul chiffre instantané. Un point sans assez
  d'historique reste `null` plutôt qu'un chiffre inventé. Affiché en `LineChart` sous la carte
  "Dépense estimée", visible dès 2 points valides.
- **`buildKcalByDate`, extrait de `tdeeNow`** (`targets.js`) : la logique de résolution
  CIQUAL/OFF/corrections V6 → kcal par date était enfouie dans `tdeeNow`, donc dupliquée à
  la main aurait été nécessaire pour `tdeeTrend`. Extraite en fonction exportée séparée,
  réutilisée par les deux — `tdeeNow` inchangé au comportement près (vérifié par test).
- **Testé en Node** : `weeklyWeekdayKcalTrend` identique à avant sur un cas réel (moyenne
  lun-ven = 2000 sur un jeu de données avec week-end à 4000) ; `weeklyKcalTrend` calcule bien
  la vraie moyenne 7 jours sur le même jeu (2571, week-end inclus) ; `tdeeTrend` sur 70 jours
  d'historique synthétique donne 8 points cohérents, fiabilité "fiable" partout ; `tdeeNow`/
  `buildKcalByDate` revérifiés après la factorisation. **Testé dans l'aperçu** : les 3 cartes
  s'affichent avec des valeurs cohérentes sur un historique synthétique de 70 jours, aucune
  erreur console.

### Onglet Énergie — détails sommeil

Jusqu'ici seule la durée avait une moyenne/un graphique dans le temps — la QUALITÉ n'était
visible que nuit par nuit ("Dernière nuit").

- **"Qualité moy. 7j"** : nouvelle tuile à côté de "Durée moy. 7j" (les deux dans une grille
  2 colonnes désormais, contre une seule tuile pleine largeur avant) — moyenne du champ
  `quality` (1-4) sur les 7 dernières nuits qui en ont une.
- **"Score de sommeil · 21 jours"** : nouveau graphique, même `computeSleepScore` que
  "Dernière nuit" (jamais un second calcul) — remplit le vrai manque signalé : deux nuits de
  durée identique peuvent avoir une efficacité très différente, invisible sur le graphique
  "Sommeil · 21 jours" (durée brute) déjà en place. Couleurs par palier (`scoreColor`, même
  convention que le score d'énergie).
- **"Répartition · 21 jours"** : compte des nuits par palier (Excellent/Bon/Correct/Risque,
  `scoreLabel`) sur la période — vue d'ensemble rapide sans relire 21 barres une par une.
- **Testé dans l'aperçu** : 21 nuits synthétiques à qualité variable → répartition 9/6/3/3
  affichée correctement (somme = 21), graphique score coloré cohérent avec les paliers,
  moyenne qualité 7j affichée (3/4 sur l'échantillon). Aucune erreur console.

Build `apps/perso` ET `apps/public` propres après chaque changement.

## Correctif TDEE — journée en cours exclue de la moyenne (13/09/2026, apps/perso v3.80.1)

Yoann a signalé que le TDEE lui paraissait bizarre : "il prend les informations
nutritionnelles du jour". Diagnostic confirmé : `computeTDEE` moyennait les kcal sur une
fenêtre glissante allant jusqu'à AUJOURD'HUI inclus — journée forcément incomplète au
moment où on consulte l'onglet TDEE (repas pas encore tous pris), donc systématiquement
tirée vers le bas et fausse la moyenne. Le poids, lui, n'avait besoin d'aucune correction :
la pesée du matin précède les repas du jour, donc elle reflète déjà naturellement
l'alimentation jusqu'à hier soir — confirmé avec Yoann, comportement déjà correct.

- **`buildKcalByDate`** (`packages/core/src/targets.js`) accepte désormais un paramètre
  `today` optionnel et **retire cette date du résultat** avant de le renvoyer. `computeTDEE`/
  `meanKcal` sont déjà tolérants aux jours absents (un jour non loggé ne compte simplement pas
  dans la moyenne, mécanisme préexistant) — retirer l'entrée du jour suffit, aucun nouveau
  mécanisme nécessaire.
- **`tdeeNow`** passe désormais `today: today()` à `buildKcalByDate` (au lieu de le lire
  seulement pour `computeTDEE`). `apps/perso/src/App.jsx` (calcul de `tdeeHistory`, tendance 8
  semaines) fait de même.
- **Sans effet sur les points PASSÉS de `tdeeTrend`** (tendance 8 semaines) : seule la fenêtre
  du point le plus récent (aujourd'hui) s'étend jusqu'à la date réelle du jour — les fenêtres
  des semaines précédentes se terminent sur des dates déjà passées, donc déjà complètes, et ne
  perdent aucune donnée. Vérifié explicitement par test (le dernier point de la tendance
  correspond toujours exactement à `tdeeNow`, les points antérieurs sont inchangés).
- **Testé en Node** : jeu de données synthétique (20 jours à 2140 kcal/j réels + un jour du
  jour à seulement 220 kcal, repas du matin seul) — avant le correctif, la moyenne tombait à
  2052 kcal/j (tirée vers le bas par la journée partielle) ; après, elle reste exactement à
  2140 (journée en cours totalement ignorée, aucune contamination).
- **Carte "Moyenne kcal · semaine"** (`weeklyKcalTrend`) a le même défaut théorique sur la
  semaine en cours, mais Yoann a choisi de la garder telle quelle (moyenne glissante 7 jours,
  effet qui s'estompe plus vite) — **pas de changement fait ici, décision explicite**.

Build `apps/perso` ET `apps/public` propres.

## Correctif recommandeur — Lower C jamais suggérable automatiquement (14/09/2026, apps/perso v3.80.2)

Yoann a signalé : "Le recommandeur ne m'a pas recommandé le lower C alors que j'ai match
dimanche." Diagnostic confirmé, incohérence entre deux décisions prises séparément : la carte
"Planning idéal" (onglet TDEE) annonce bien "Lower C (HSR lourd)" le lundi d'une semaine avec
match, mais le couplage recommandeur (`WEEKLY_PLAN_FAMILIES`, 05/09/2026) ne peut bonifier
que des types réellement générés par `recommendSessions` — et Lower C avait été
**volontairement exclu** de la suggestion automatique le 01/09/2026 ("choix manuel de Yoann
selon son calendrier de matchs"). Résultat : le bonus "Lower" ne pouvait profiter qu'à Lower
A/B, jamais à Lower C, qui n'apparaissait donc structurellement jamais dans "Prochaine
séance", même les lundis de semaine avec match. Confirmé avec Yoann que son match du
20/09/2026 était bien enregistré (Réglages → Planning Basket fixe) — **décision explicite de
revenir sur celle du 01/09** : Lower C doit désormais être suggérable automatiquement.

- **`packages/core/src/recommender.js`, nouveau paramètre optionnel `matchWeek`** (booléen,
  additif) : absent/faux → comportement identique bit pour bit à avant (`variant("Lower A",
  "Lower B")`, comme depuis toujours). Vrai → le bloc "BAS DU CORPS" suggère directement
  `"Lower C"` au lieu d'alterner A/B — seul effet de ce paramètre, tout le reste du scoring
  (genou, fatigue, sommeil) reste partagé sans distinction, `isLower()` incluait déjà Lower C
  dans les décomptes `lower7`/`dLower` depuis le 01/09. L'avoid genou rouge référence aussi
  `"Lower C"` (au lieu de `"Lower A / B"`) quand `matchWeek` est vrai, pour ne jamais avertir
  sur un type qui ne sera de toute façon pas proposé cette semaine-là.
- **`apps/perso/src/App.jsx`, nouvelle fonction `isMatchWeek(basketSchedule)`** : extraite de
  `familiesForToday` (même détection déjà en place depuis le 05/09 — un match ce dimanche,
  fin de la semaine lundi-dimanche, via `basketSchedule.matchDates`), réutilisée par les DEUX
  appels à `recommendSessions`/`buildCoachPrompt` (Dashboard et Coach IA) pour ne jamais avoir
  deux verdicts différents. `familiesForToday` inchangée en sortie, juste réécrite par-dessus
  ce nouveau helper partagé.
- **`packages/core/src/coach/prompt.js`** : `matchWeek` ajouté au sac de données de
  `buildCoachPrompt`, transmis tel quel à `recommendSessions` — même mécanisme additif que
  `weeklyPlan`/`basketSchedule` avant lui. `apps/public` non affecté (ne fournit pas ce champ,
  n'a de toute façon pas "Lower C" dans son catalogue de types).
- **Testé en Node** : sans `matchWeek`, la suggestion Lower reste A ou B (non-régression,
  jamais C) ; avec `matchWeek: true`, Lower C est bien suggéré et Lower A/B disparaissent des
  suggestions ; genou rouge + `matchWeek` → l'avoid référence "Lower C" (pas "Lower A / B") ;
  genou rouge sans `matchWeek` → comportement inchangé. `isMatchWeek` revérifié avec la vraie
  date du jour (lundi 14/09/2026) : résout bien dimanche 20/09/2026 comme prochain dimanche,
  match détecté correctement. **Testé dans l'aperçu** : genou en base, planning avec match le
  20/09 seedé → "Prochaine séance" affiche "Lower C" en tête (score 59) avec le texte "Planning
  idéal du jour : Lower — bonus de priorité", aucune erreur console.

Build `apps/perso` ET `apps/public` propres.

## Réorganisation de l'onglet Réglages (14/09/2026, apps/perso v3.80.3)

Yoann : "c'est un peu le bordel" — proposition faite AVANT de coder (ordre + regroupement),
validée point par point via deux questions (retrait complet d'"Objectif temporaire" plutôt
que la garder repliée ; regroupement des 4 cartes Coach IA plutôt que seulement clé/modèle).
Pur réordonnancement UI, `apps/public` n'a pas la même écran Réglages (Onboarding en mode
"settings" + sa propre carte export/import) — non concerné, non touché.

- **Nouvel ordre** (`SettingsPanel`, `apps/perso/src/App.jsx`), du plus fréquemment utilisé
  au moins fréquent : Sauvegarde des données (seul réglage avec un rappel actif — bandeau +
  notification hebdo) → Planning Basket fixe → Phase → Cibles macro de base (+ poids cible
  par phase) → Cible eau de base → Système de cotation escalade → Health Connect (natif) →
  puis un label "Coach IA" et les 4 cartes du coach regroupées tout en bas (clé API/modèle,
  contexte permanent, carnet de bord, revue de fond claude.ai) — Yoann ne s'en sert quasiment
  jamais au quotidien.
- **Carte "Objectif temporaire · cibles macros" retirée entièrement de l'écran** (jugée
  inutile) : `targets.cut` reste intact en interne (`isCutWindow`/`targetsForDate` continuent
  de le lire normalement partout ailleurs dans l'app — TDEE, Coach IA, cibles du jour), plus
  aucune UI pour l'éditer. Les variables locales `cut`/`setCut` du composant, devenues
  inutiles, retirées avec la carte ; import `isCutWindow` (désormais inutilisé dans ce
  fichier) retiré aussi. Texte de la carte "Cibles macro de base" ajusté (ne référence plus
  la fenêtre temporaire disparue).
- **Aucune migration nécessaire** : aucune clé `localStorage` touchée, aucune donnée perdue —
  un pur réordonnancement/masquage d'UI. Si un jour une sèche ponctuelle avant vacances refait
  sens, la carte peut être remise sans backfill (la donnée n'a jamais bougé).
- **Testé dans l'aperçu** : ordre confirmé exact (Sauvegarde → Planning Basket → Phase →
  Cibles macro → Eau → Escalade → label "Coach IA" → les 4 cartes coach), "Objectif
  temporaire" bien absent, aucune erreur console. Build `apps/perso` ET `apps/public` propres
  (`apps/public` non affecté, aucun fichier partagé touché).

### Affinage le même jour : la fréquence réelle d'usage, pas le rappel actif (apps/perso v3.80.4)

Retour de Yoann sur le premier essai : "sauvegarde et restaurer un fichier peuvent aussi être
en bas. en fait il faut classer les parties par ordre d'utilisation, de fréquence." L'erreur
de raisonnement identifiée : avoir déduit "rappel actif (bandeau + notification hebdo) ⇒
réglage fréquent" — un rappel qui pousse À agir n'est pas la même chose qu'un réglage
réellement ouvert souvent. Plutôt que de re-deviner une seconde fois, question posée
directement (par réglage, lesquels sont vraiment utilisés souvent) au lieu de raffiner sur une
hypothèse déjà invalidée une fois.

- **Ordre final confirmé par Yoann, réglage par réglage** (plus fréquent → moins fréquent) :
  Planning Basket fixe → Phase → Cibles macro de base (+ poids cible) → Cible eau de base →
  Coach IA · contexte permanent → Coach IA · carnet de bord → Revue de fond claude.ai →
  Système de cotation escalade → Health Connect (natif) → Coach IA · clé API + modèle →
  Sauvegarde des données (Sauvegarder/Restaurer).
- **Le bloc "Coach IA" n'est plus un groupe contigu** : contexte permanent/carnet de bord/
  revue de fond sont utilisés souvent (remontés au milieu, à la suite des cibles macro/eau),
  tandis que clé API/modèle reste quasi jamais touché (redescendu près du bas, juste avant
  Sauvegarde). Le label de section "Coach IA" ajouté au premier essai est retiré : chaque
  carte porte déjà son propre titre "Coach IA · …", donc plus besoin d'un séparateur commun
  une fois le groupe scindé en deux positions non adjacentes.
- **Testé dans l'aperçu** : ordre re-vérifié exact (Planning Basket → Phase → Cibles macro →
  Eau → contexte permanent → carnet de bord → revue de fond → escalade → clé API → Sauvegarde
  en tout dernier), aucune erreur console.

## Correctif recommandeur — "déjà fait aujourd'hui" perdu au retrait du gate 48h (14/09/2026, apps/perso v3.80.5)

Yoann : "j'ai loggé un lower C et une séance d'escalade ce matin mais le recommandeur me
propose en prochaine séance lower C puis repos mobilité puis escalade, ce n'est pas normal."
Diagnostic confirmé dans le code : le retrait du gate 48h la veille (13/09) a supprimé PAR
ERREUR la vérification "Lower déjà fait aujourd'hui" — elle vivait dans la même condition que
le cooldown retiré (`kneeToday || dKneeEff === 0`), et est partie avec lui alors que ce n'était
pas demandé. L'Escalade, elle, n'avait de son côté JAMAIS eu cette vérification (contrairement
à Upper/Basket/Course à pied/Foot, qui l'ont tous) — un gap préexistant, pas une régression du
13/09, révélé par le même scénario de test.

- **`packages/core/src/recommender.js`** : bloc BAS DU CORPS — nouvelle branche `else if
  (lowerToday)` (avant le calcul de suggestion), avoid "Lower déjà fait aujourd'hui —
  deuxième dose déconseillée", même texte que Basket/Course/Foot pour le même cas. Bloc
  ESCALADE — nouvelle branche `else if (climbToday)`, même traitement. **Scope
  volontairement étroit** : `lowerToday`/`climbToday` (déjà calculés plus haut, testent le
  type EXACT fait aujourd'hui) plutôt que `kneeToday`/`dKnee` (n'importe quelle activité
  taguée "genou" aujourd'hui, Basket compris) — utiliser la version large aurait réintroduit
  une partie de la contrainte que Yoann venait justement de faire retirer la veille (un
  Basket fait aujourd'hui ne doit toujours PAS bloquer Lower).
- **Testé en Node** : scénario exact de Yoann (Lower C + Escalade loggés aujourd'hui) →
  aucun des deux suggéré, tous deux dans "à éviter" avec le bon motif, seul "Repos/mobilité"
  reste proposé ; sans rien loggé aujourd'hui → comportement normal inchangé ; **non-régression
  clé** : un Basket loggé aujourd'hui (sans Lower) ne bloque toujours PAS Lower — le
  changement du 13/09 reste intact. **Testé dans l'aperçu**, mêmes données que Yoann
  (knee en base, Lower C + Escalade aujourd'hui) : "Prochaine séance" affiche uniquement
  Repos/mobilité, "à éviter" liste Lower A/B et Escalade avec "déjà fait(e) aujourd'hui —
  deuxième dose déconseillée", aucune erreur console.

Build `apps/perso` ET `apps/public` propres.

## Correctif favoris — filtrage strict par repas (17/09/2026, apps/perso+public v3.80.6)

Yoann : "je n'ai jamais mangé de fève de soja dans 'extra' ou 'petit déjeuner' donc il ne
doit pas se retrouver en haut de la liste" — demande explicite de revérifier le code
(`packages/core/src/nutrition/foodStore.js`). Le tri par repas déjà en place depuis le
07/08/2026 (épinglés → déjà mangés à CE repas → le reste) **atténuait** le problème sans le
résoudre : deux trous identifiés.
1. Un aliment **épinglé** passait toujours en tête (niveau 0), **avant même** le tri par
   repas — un épinglage suivait donc l'utilisateur sur TOUS les repas, y compris ceux où
   l'aliment n'a jamais mis les pieds.
2. Un aliment jamais mangé à CE repas mais très fréquent À UN AUTRE (niveau "le reste", trié
   par fréquence globale) pouvait dominer ce niveau dès que le repas courant n'avait
   lui-même aucun historique — et comme ce niveau devenait alors le seul contenu affiché, il
   se retrouvait de fait en tête de la liste.

- **`suggestions()`** (`foodStore.js`) : nouveau filtre `.filter((s) => !meal || s.mealFreq >
  0)` — quand `meal` est fourni (ajout depuis une carte repas de l'onglet Macro), la liste ne
  montre plus QUE les aliments réellement mangés à CE repas précis, épinglage compris. Un
  aliment épinglé mais jamais mangé à ce repas n'apparaît plus du tout pour lui (reste
  accessible via la recherche classique) — décision confirmée par Yoann (plutôt que "épinglé
  en bas de liste"), après question posée explicitement.
- **`IngredientPicker`** (création de recette, seul appelant SANS `meal` — un ingrédient
  n'est pas lié à un repas) : comportement **strictement inchangé**, le filtre ne s'applique
  que si `meal` est fourni.
- **Partagé `packages/core`, donc les deux apps en bénéficient** — `apps/public` utilise le
  même `suggestions()` avec la même signature (`FoodSearch.jsx` des deux apps, vérifié
  identique).
- **Testé en Node** : aliment mangé 20× au déjeuner mais jamais en "extra" → absent de la
  liste "extra" même si "extra" a un autre historique (Chips) ; repas totalement vierge
  (petit-déjeuner) → liste vide, aucun repli par fréquence ; même aliment épinglé → toujours
  absent d'un repas où il n'a jamais été mangé ; au déjeuner (son vrai repas) → apparaît
  normalement ; **non-régression** : sans `meal` (recette), comportement identique à avant,
  épinglé toujours en tête. **Testé dans l'aperçu** (`apps/perso`) : "Petit-déjeuner"
  affiche "Rien encore. Cherchez un aliment." malgré la fève de soja épinglée et mangée 20×
  au déjeuner ; "Extra" affiche uniquement "Chips" (son vrai historique), fève de soja
  absente. Aucune erreur console. `apps/public` non testé en direct (pas de session Supabase
  active) — port automatique via `packages/core`, build propre.

Build `apps/perso` ET `apps/public` propres.

## Règles absolues à ne jamais casser

1. **Ne jamais changer les clés localStorage** (`weightLog`, `sleepLog`,
   `trainingLog`, `kneeLog`, `elbowLog`, `rhrLog`, `napLog`, `macroLog`, `noteLog`, `stepsLog`, `targets`,
   `phase`, `hsrWeek`, `climbScheme`, `basketSchedule`, `apiKey`, `model`, `coachProfile`,
   `coachJournal`, `foodLog`, `foodPins`, `foodMuted`, `foodPortions`, `foodRecipes`,
   `foodOverrides` —
   préfixées `protocole:` dans `store.js`)
   sans écrire une migration. Casser une clé = perdre l'historique de
   l'utilisateur, ce qui est la pire chose possible ici.
   **Toute nouvelle clé doit être ajoutée à `DATA_KEYS` dans `store.js`**,
   sinon elle est absente de l'export JSON et silencieusement perdue à la
   prochaine restauration. **Deux exceptions volontaires**, à ne pas « corriger » :
   `lastAutoBackupDate` et `lastCloudBackup` sont des marqueurs de sauvegarde —
   les restaurer ferait croire à l'app qu'une sauvegarde vient d'avoir lieu.
   `elbowLog` est un troisième cas particulier depuis le 05/09/2026 : le coude a été
   retiré (plus aucun code ne le lit/l'écrit, voir plus bas), la clé reste dans
   `DATA_KEYS` uniquement pour ne pas perdre l'historique déjà exporté.
   `trainingDraft` (19/09/2026, brouillon auto-sauvegardé du carnet en cours — voir
   chantier dédié plus bas) est une quatrième exception volontaire : état éphémère lié à
   l'appareil au moment présent, pas une donnée à restaurer sur un autre appareil ou à une
   autre date — ne jamais l'ajouter à `DATA_KEYS`.
2. **Toujours vérifier que le build passe** (`npm run build --workspace=apps/perso`,
   depuis la racine du monorepo) avant de considérer une modification terminée.
3. **Bumper `APP_VERSION`** (dans `apps/perso/src/App.jsx`) et `"version"` (dans
   `apps/perso/package.json`) à chaque changement livré.
4. **Déployer sur le MÊME site Netlify existant**, jamais en créer un
   nouveau. Le déploiement continu est déjà en place (voir plus bas), donc un
   simple `git push` suffit. **Depuis le 06/08/2026, ce site sert `apps/public`
   (RawCare), plus `apps/perso`** — voir "Bascule Netlify vers apps/public"
   plus bas pour le contexte. L'ancienne raison de cette règle (l'URL liée au
   localStorage d'un utilisateur donné) ne s'appliquait qu'à la PWA
   `apps/perso`, qui n'est plus déployée nulle part ; la règle reste valable
   pour une raison plus simple : un site Netlify = une URL stable, ne pas la
   fragmenter sans raison.
5. Avant de simplifier une règle métier (Silbernagel, table HSR, logique
   du recommandeur, contrat du Coach IA), demander confirmation — ce sont
   des décisions prises après plusieurs itérations, pas des choix
   arbitraires.
6. **Pas d'import "coller depuis MyFitnessPal"** ni d'automatisation par
   demi-mesure des macros — proposé puis explicitement refusé. La seule
   voie validée est la synchro Health Connect complète (voir section
   dédiée), **désormais en place et fonctionnelle**. Ne pas resimplifier
   vers un import partiel (ex. calories seules sans le détail macro).

## Bascule Netlify vers apps/public (06/08/2026)

Yoann n'utilise plus que l'app Android native en perso (jamais utilisé la PWA pour de
vraies données, confirmé le 06/08/2026) et a choisi de réutiliser le site Netlify existant
pour `apps/public` (RawCare) plutôt que d'en créer un nouveau, pour garder une config
simple. **Aucun couplage technique entre la PWA et l'app native** ne s'y opposait :
`main.jsx` désenregistre déjà le service worker et vide ses caches côté natif
(`Capacitor.isNativePlatform()`), donc l'app native ne dépend en rien de ce qui est déployé
ou non sur Netlify — voir "Correctif historique" dans la section mise à jour de l'app
native, plus bas.

- **`netlify.toml`** repointé : `command = "npm run build --workspace=apps/public"`,
  `publish = "apps/public/dist"`, filtre `ignore` recentré sur les chemins `apps/public/*` +
  `packages/core` (au lieu d'`apps/perso/*`).
- **La PWA `apps/perso` n'est donc plus déployée nulle part.** Son code reste dans le
  dépôt tel quel (l'app native en dépend pour son propre build Vite — même pipeline,
  vite-plugin-pwa compris) : rien n'a été retiré, seul le déploiement public s'arrête.
- **Fait côté tableau de bord Netlify par Yoann** : Build command/Publish directory vidés
  (remis à "Not set", `netlify.toml` fait foi), variables d'environnement
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ajoutées.
- **Premier déploiement en échec** : `vite build` plantait sur Netlify (Linux) avec
  `Cannot find native binding` pour `@rolldown/binding-linux-x64-gnu` (le bundler de
  Vite 8) — bug npm connu sur les dépendances optionnelles
  ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) : `package-lock.json` avait été
  généré sur macOS et n'embarquait pas le binaire natif Linux. Corrigé par réinstallation
  complète (`rm -rf node_modules package-lock.json && npm install`) — le lockfile régénéré
  référence bien tous les binaires natifs par plateforme. Si ce genre d'erreur revient après
  un ajout de dépendance, c'est le premier réflexe à avoir (pas un problème de code).
- **Second déploiement réussi, le 06/08/2026 : `apps/public` (RawCare) est en ligne**, sur le
  site Netlify qui servait auparavant la PWA `apps/perso`. Chantier RawCare Phase 2 terminé
  de bout en bout — reste seulement la Phase 3 (envoyer le lien au cercle de bêta, mesurer la
  rétention), qui n'est pas un chantier technique.
- **Rattrapage git au passage** : un gros backlog de travail jamais commité (remontant à
  plusieurs sessions avant celle du déploiement) a été découvert à ce moment-là — tout
  commité et poussé en 5 commits groupés par chantier avant de fusionner sur `main`. Depuis,
  Claude Code demande confirmation à chaque commit, séparément d'une confirmation avant tout
  passage en prod — ne plus jamais laisser du travail "livré" mais non commité s'accumuler
  silencieusement.

## Workflow de déploiement (déjà en place, ne pas en proposer un autre)

- Dépôt GitHub : `yoannrolland-dwy/protocole-app`.
- Dossier local : `/Users/yrolland/Documents/GitHub/protocole-app`.
- **Netlify est connecté en Continuous Deployment à ce dépôt** : chaque
  `git push` sur `main` déclenche automatiquement un rebuild + redéploiement
  sur le site existant. Depuis le 06/08/2026 (bascule vers apps/public, voir plus haut) :
  Build command `npm run build --workspace=apps/public`, Publish directory
  `apps/public/dist` — géré par `netlify.toml`.

### Deux branches — règle importante pour le budget Netlify

Netlify facture **15 crédits par déploiement de production**, sur un quota de
**300 crédits/mois** (soit 20 déploiements). Or l'app native se met à jour par
USB **sans aucun `git push`** : seul le déploiement du site web (`apps/public`
désormais) coûte.

D'où l'organisation suivante, à respecter par défaut :

- **`dev`** = branche de travail. J'y pousse librement (natif, doc, code
  partagé) : Netlify ne construit que `main`, donc **pousser sur `dev` ne coûte
  rien** tout en gardant le code sauvegardé sur GitHub.
- **`main`** = ce qui est en ligne. On n'y fusionne `dev` **que sur demande
  explicite de Yoann** ("déploie la PWA"). Un seul déploiement embarque alors
  tout le cumul des commits accumulés.

Ne jamais pousser directement sur `main` sans que Yoann l'ait demandé.
Prérequis vérifié le 27/07/2026 : côté Netlify, *Branch deploys* est bien sur
**"None"** — `dev` ne déclenche donc aucun build. À revérifier si ce réglage
venait à changer.

Un `netlify.toml` complète ce dispositif : il annule le build quand un commit
poussé sur `main` ne touche aucun fichier d'`apps/public` ni de son cœur partagé
(cas d'un commit purement `apps/perso/`, `android/` ou documentaire). **Vérifié
empiriquement le 27/07/2026** (sur l'ancienne cible `apps/perso`, même mécanisme) : un build
annulé par cette règle **ne consomme aucun crédit** et n'incrémente pas le
compteur "Production deploys" (resté à 15 après un push ne touchant que
`netlify.toml`). La documentation Netlify ne le précise pas — ne pas remettre
ce point en doute sans nouveau test.
- Client Git utilisé par l'utilisateur : **GitHub Desktop** (interface
  graphique, pas de ligne de commande Git manuelle) — mais si Claude Code
  gère lui-même git add/commit/push directement, c'est very bien aussi et
  probablement plus fluide que de repasser par GitHub Desktop à la main.
- Sauvegarde des données utilisateur = export JSON manuel (Réglages →
  **Sauvegarder hors du téléphone**, renommé à V2), à ne jamais oublier de
  rappeler avant une mise à jour importante — GitHub ne contient que le code,
  jamais les données perso.

## Mise à jour de l'app Android native (différent du déploiement PWA)

Le `git push` sur `main` ne redéploie **que la PWA** (Netlify, automatique).
L'app native installée sur le téléphone ne se met JAMAIS à jour seule — il
faut rebuild + réinstaller à la main à chaque changement de code qui la
concerne. **Depuis le chantier RawCare Phase 0 (05/08/2026), les commandes
tournent depuis `apps/perso/`** (l'app a été relocalisée dans le monorepo,
`android/` avec elle) :
```
npm run build --workspace=apps/perso
cd apps/perso
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
Téléphone branché en USB, débogage USB activé et autorisé sur l'appareil.
Variables d'environnement requises (déjà ajoutées à `~/.zshrc`) :
`ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`,
`JAVA_HOME=/opt/homebrew/opt/openjdk@21`.

**Correctif historique** : un ancien bug faisait que l'app native semblait "ne plus se
mettre à jour" après un `adb install -r` tant qu'on n'avait pas accepté une popup "Nouvelle
version disponible" héritée du service worker de la PWA. Corrigé dans `main.jsx` :
côté natif (`Capacitor.isNativePlatform()`), le service worker est désenregistré et ses
caches vidés au démarrage — l'APK fait toujours foi, aucune popup de ce type ne peut plus
apparaître sur l'app native (confirmé par Yoann le 06/08/2026 : jamais vue). Cette popup
reste normale et à accepter uniquement si elle apparaît dans un navigateur (PWA).

## Chantier RawCare — Brouillon auto-sauvegardé du carnet de séance (19/09/2026, apps/perso v3.82.0)

Retour de Yoann : quitter l'onglet Séances en cours de carnet (ex. pour vérifier Macro)
annulait toute la séance — rien n'était perdu qu'à la validation finale ("Valider la
séance"), car `TrainTab` est démonté à chaque changement d'onglet
(`{tab === "train" && <TrainTab .../>}` dans `App.jsx`), détruisant tout son état React
(type ouvert, date, et dans `MuscuLogger` chaque série cochée/poids/reps saisis).

- **Nouvelle clé `trainingDraft`, volontairement hors `DATA_KEYS`** (voir Règles absolues
  #1, quatrième exception) : état éphémère de "ce qui est en cours dans le carnet
  maintenant", pas une donnée à restaurer sur un export/import.
- **`MuscuLogger` écrit son propre brouillon** (`{ type, date, editingId, start, duration,
  rpe, exos }`) via un `useEffect` déclenché à chaque changement de `exos`/`start`/
  `duration`/`rpe` — donc dès qu'une série est cochée, pas seulement à la validation. Au
  montage, un brouillon correspondant exactement (même type/date/séance éditée) est
  restauré à la place de la reconstruction habituelle depuis l'historique.
- **`TrainTab` restaure `open`/`date`/`editing` au montage** depuis le même brouillon (avec
  garde-fou `TEMPLATES[type]` pour ignorer un brouillon devenu invalide) : rouvrir l'onglet
  Séances après l'avoir quitté en pleine séance rouvre directement le carnet là où il en
  était, sans repasser par le sélecteur de type.
- **Escalade (kind "sport", rendue directement par `TrainTab`, pas par `MuscuLogger`)**
  bénéficie du même mécanisme côté blocs saisis (`BlocsField`) — même bug, même correctif.
- **Nettoyage explicite du brouillon** à la validation (`validate()`/`logSession`) et à
  l'annulation (bouton "Annuler", des deux écrans) — une séance terminée ou abandonnée
  volontairement ne doit pas ressusciter au prochain lancement. Démarrer un nouveau type
  (`pickType`) ou rouvrir une séance passée pour modification (`editSession`) efface aussi
  tout brouillon existant, pour ne jamais mélanger deux séances.
- **Aucun impact sur `trainingLog`, le recommandeur, le Coach IA, les records ou le TDEE** :
  rien de tout cela ne lit le brouillon, seul `MuscuLogger`/`TrainTab` le lisent au montage.
  Le comportement de "Valider la séance" est strictement inchangé.
- **Testé dans l'aperçu** : série cochée sur Upper A, changement d'onglet (Macro) puis
  retour sur Séances → carnet rouvert automatiquement avec la série toujours cochée ;
  "Annuler" puis retour sur Séances → sélecteur de type vide (pas de résurrection) ;
  validation puis retour → sélecteur de type vide. Build `apps/perso` propre.

## Chantier RawCare — Gestion des siestes (23/09/2026, apps/perso v3.83.0)

Yoann a demandé comment PROTOCOLE devrait gérer les siestes (la montre les détecte
automatiquement). Discussion scientifique d'abord (une sieste n'appartient ni à la nuit
d'avant ni à celle d'après — épisode de récupération à part ; risque uniquement sur la nuit
SUIVANTE si trop longue/tardive), puis diagnostic technique confirmé par Yoann : la montre
enregistre bien les siestes comme n'importe quel `SleepSessionRecord` Health Connect.

- **Bug réel confirmé, pas hypothétique** : le découpage "jour de sommeil" (`sleepDayOf`,
  fenêtre midi-veille à midi-jour même, `HealthNutritionPlugin.kt`) regroupait TOUT
  enregistrement tombant dans cette fenêtre — une sieste à 14h tombe dans la fenêtre qui se
  termine à midi le LENDEMAIN, donc se faisait fusionner silencieusement dans la nuit
  suivante, faussant sa durée, sa qualité, ET la FC repos calculée dessus
  (`readRestingHeartRate`, qui réutilise le même découpage).
- **`isNap(r)`** (nouveau helper privé) : classifie une session comme sieste si son heure de
  DÉBUT tombe entre 12h et 18h — jamais une heure de coucher plausible, y compris après un
  match tardif. Heuristique simple, assumée : Health Connect n'a aucun champ natif
  distinguant sieste et nuit.
- **`readSleep()`** : sépare siestes/nuits AVANT le calcul (`partition`), exclut les siestes
  du calcul de nuit (comportement inchangé pour les vraies nuits), et renvoie un nouveau
  champ `naps` — durée sommée par date CALENDAIRE (pas "jour de sommeil", qui n'a de sens que
  pour une nuit).
- **`readRestingHeartRate()`** : mêmes sessions de sieste exclues du calcul de FC repos
  nocturne (`.filterNot { isNap(it) }`) — sans ça, la FC (plus élevée en sieste qu'en sommeil
  profond, surtout après une séance) aurait continué de fausser la nuit suivante.
- **Nouvelle clé `napLog`** (`{date, minutes}`, ajoutée à `DATA_KEYS`) : remontée par
  `healthSync.js`/`App.jsx` exactement comme `rhrLog` (pas de saisie manuelle, pas de champ
  `source` à arbitrer).
- **Affichage dans l'onglet Énergie, à côté du vrai sommeil** (demande explicite) : ligne
  "+ sieste aujourd'hui : Xh XX" sous la carte "Dernière nuit", visible uniquement si une
  sieste existe pour la date du jour.
- **Bonus sieste dans le score d'énergie (revirement le même jour)** : premier jet livré sans
  toucher au score ("la science ne rattache pas une sieste à une nuit"), mais Yoann a
  raisonnablement objecté qu'une sieste redonne un vrai regain de vigilance mesurable — ça
  mérite de compter. Nuance retenue : les 4 modules existants (FC repos/sommeil/activité/
  régularité) restent des signaux de récupération DE FOND, qu'une sieste ne "répare" pas ;
  mais un **5e module séparé "Sieste"** (`packages/core/src/energy.js`, `MODULE_MAX.nap = 5`,
  `scoreNapModule`) capture le regain de vigilance à part, **additif et plafonné à 5 pts**,
  jamais mêlé aux poids déjà calibrés des 4 autres. Barème : plein bonus dès 20 min (seuil
  "power nap", jamais de sommeil profond), plafonné pareil jusqu'à 90 min (pas de pénalité
  pour l'éventuelle inertie de réveil en zone 30-70 min, hors de portée d'un score journalier
  unique), rien de plus au-delà de 90 min. `computeEnergyScore` plafonne désormais le total à
  100 (`Math.min(100, ...)`) — une sieste peut combler un score un peu juste, jamais pousser
  un score déjà excellent au-dessus de la barre. Absence de sieste = `points: 0` (fait connu,
  jamais `null`), donc ce module ne bloque jamais le calcul même sans sieste. Branché aux 4
  appels de `computeEnergyScore` dans `App.jsx` (Dashboard, onglet Énergie, widget natif,
  sac de données Coach IA) — jamais deux verdicts différents pour la même réalité.
  **Exception délibérée** : `sleepEnergyCorrelation` (`insights.js`, corrélation qualité de
  sommeil ↔ score d'énergie) ne reçoit PAS `napLog` — l'objectif de cette mesure est
  d'isoler l'effet de la qualité de sommeil seule, qu'un bonus sieste le même jour
  contaminerait.
- **`apps/public` non concerné** pour la synchro (Health Connect est natif `apps/perso`
  uniquement) ; `packages/core/src/energy.js` est partagé, donc son build a été revérifié.
- **Testé** : build `apps/perso` + `apps/public` propres, `./gradlew assembleDebug` propre
  (Kotlin compile). Script Node dédié (8 assertions) sur `computeEnergyScore` : score
  inchangé sans sieste, bonus plein à 20 min, bonus partiel arrondi à 10 min, plafonné à
  120 min, aucun effet d'une sieste d'un autre jour, total jamais > 100 même avec les 4
  modules déjà au maximum. Vérifié dans l'aperçu (module "Sieste" affiché dans le détail du
  score, "+ sieste aujourd'hui" sous "Dernière nuit"), aucune erreur console.
  **Non testé en conditions réelles sur l'appareil** (nécessite une vraie sieste détectée par
  la montre) — à confirmer par Yoann après installation.

## TDEE — comparaison des fenêtres 7/14/21/28 j (24/09/2026, apps/perso v3.84.0)

Yoann rentrait de vacances il y a pile 28 jours et doutait de la fiabilité de l'estimation
sur 28 j. Intuition confirmée par simulation : l'eau/glycogène stockés en vacances repartent
les premiers jours du retour, la balance baisse plus que le déficit réel ne l'explique, et
le 28 j **surestime** la dépense (scénario synthétique : 2921 kcal/j pour une vraie valeur
≈ 2640). Challengé avant de coder : sur 7 j, une variation d'eau de 0,5 kg décale le résultat
d'environ ±550 kcal/j (±275 sur 14 j, ±180 sur 21 j, ±140 sur 28 j) — Yoann a tenu à garder
le 7 j, **avec un avertissement explicite**.

- **`tdeeOverWindow`** (nouveau, `packages/core/src/tdee.js`) : TDEE sur une fenêtre de
  longueur FIXE, sans recherche de meilleure fenêtre ni plancher à 14 j — sert à COMPARER,
  pas à remplacer l'estimation de référence (`computeTDEE`, inchangée : elle reste celle
  utilisée par le déficit réel, les Constats, le Bilan et le Coach IA). Mêmes garde-fous :
  jamais de chiffre si la fenêtre dépasse l'historique de pesées ou < 70 % de jours loggés.
  Une fenêtre < 14 j reste toujours en fiabilité "faible" (`reliabilityOf` existant).
- **Formule factorisée** (`tdeeOnWindow`, privée) : `computeTDEE` et `tdeeOverWindow`
  partagent exactement le même calcul — jamais deux formules différentes.
- **UI** : section "Comparaison des fenêtres" dans la carte "Dépense estimée" (onglet TDEE),
  une ligne par fenêtre (hors celle déjà retenue par l'estimation de référence, pour ne pas
  l'afficher deux fois), avec fiabilité et % de jours loggés. Le 7 j est marqué
  "· indicatif", et une note explique la lecture : fenêtres qui convergent = chiffre solide ;
  la plus longue qui s'écarte = sans doute polluée par un événement ancien. Le problème du
  retour de vacances se résorbe de lui-même en ~1 semaine (la fenêtre glisse).
- **Non propagé au Coach IA ni à `apps/public`** (non demandé).
- **Testé** : script Node — `computeTDEE` et `tdeeTrend` identiques au caractère près à
  l'ancienne version (comparée via `git show HEAD`) sur 5 scénarios (vacances, sans vacances,
  trous de saisie, sèche récente/ancienne) ; `tdeeOverWindow(28)` = estimation de référence
  quand celle-ci retient 28 j ; garde-fous historique trop court / < 70 % loggés vérifiés.
  Aperçu : section affichée avec des valeurs cohérentes sur un historique synthétique "retour
  de vacances", aucune erreur console. Build `apps/perso` ET `apps/public` propres.

## Comment je veux qu'on travaille

- Explique en une phrase ce qui change et pourquoi avant de coder.
- Une chose à la fois si la demande est ambiguë — pose une question plutôt
  que de supposer.
- Challenge-moi si tu vois un meilleur choix technique ou si ma demande
  contredit une règle déjà établie ci-dessus.
- Réponses concises adaptées à un usage mobile quand c'est pertinent
  (l'app elle-même est consultée sur téléphone), mais dans Claude Code la
  priorité reste la clarté du diff/des changements.
- Toujours en français.
