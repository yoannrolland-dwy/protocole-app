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

- **8 onglets** : Tableau de bord, Poids, Sommeil, Pas, Séances, Douleurs, Macros,
  Repas (module Nutrition interne en bêta — voir la section dédiée plus bas)
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
  table HSR et deux routines guidées avec minuteur (rééduc autonome,
  échauffement basket sécurisé) **attachées au genou seul**.
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
  — une nuit courte (<6h ou qualité ≤2, sur la nuit d'hier seulement) et/ou
  3 séances sur les 3 derniers jours retirent des points à Upper/Lower/
  Basket/Escalade (jamais à Repos, qui en profite au contraire) ; silencieux
  si la donnée est absente, pour ne pas punir une simple absence de saisie
  comme le fait le genou. (2) Fenêtre de sèche (`isCutWindow`) : pénalise
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
- **Phase** (Sèche/Maintenance/Prise) pilote le poids cible partout (93 en
  sèche, 95 en prise, éditable en maintenance).
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
- **Reste de la Phase 1, pas commencé** : zones de douleur généralisées, bibliothèque de
  sports + tags de charge (généralisation de `recommendSessions`), bibliothèque d'exercices
  (l'identité d'un exercice est aujourd'hui juste une chaîne de caractères libre, utilisée
  comme clé dans `DEFAULT_WEIGHTS`/`lastPerf`/`perfHistory` ET dans tout `trainingLog` —
  toute refonte devra préserver cette chaîne ou migrer l'historique), types de séance
  (Full body, Bro split — aucune notion de "split" n'existe encore comme donnée, seulement
  un préfixe de nom partagé entre "Upper A"/"Upper B").

## Règles absolues à ne jamais casser

1. **Ne jamais changer les clés localStorage** (`weightLog`, `sleepLog`,
   `trainingLog`, `kneeLog`, `elbowLog`, `macroLog`, `noteLog`, `stepsLog`, `targets`,
   `phase`, `hsrWeek`, `climbScheme`, `apiKey`, `model`, `coachProfile`, `coachJournal`,
   `foodLog`, `foodPins`, `foodMuted`, `foodPortions`, `foodRecipes`,
   `foodOverrides` —
   préfixées `protocole:` dans `store.js`)
   sans écrire une migration. Casser une clé = perdre l'historique de
   l'utilisateur, ce qui est la pire chose possible ici.
   **Toute nouvelle clé doit être ajoutée à `DATA_KEYS` dans `store.js`**,
   sinon elle est absente de l'export JSON et silencieusement perdue à la
   prochaine restauration. **Deux exceptions volontaires**, à ne pas « corriger » :
   `lastAutoBackupDate` et `lastCloudBackup` sont des marqueurs de sauvegarde —
   les restaurer ferait croire à l'app qu'une sauvegarde vient d'avoir lieu.
2. **Toujours vérifier que le build passe** (`npm run build --workspace=apps/perso`,
   depuis la racine du monorepo) avant de considérer une modification terminée.
3. **Bumper `APP_VERSION`** (dans `apps/perso/src/App.jsx`) et `"version"` (dans
   `apps/perso/package.json`) à chaque changement livré.
4. **Déployer sur le MÊME site Netlify existant**, jamais en créer un
   nouveau — l'URL du site est liée au localStorage de l'utilisateur.
   Le déploiement continu est déjà en place (voir plus bas), donc un
   simple `git push` suffit.
5. Avant de simplifier une règle métier (Silbernagel, table HSR, logique
   du recommandeur, contrat du Coach IA), demander confirmation — ce sont
   des décisions prises après plusieurs itérations, pas des choix
   arbitraires.
6. **Pas d'import "coller depuis MyFitnessPal"** ni d'automatisation par
   demi-mesure des macros — proposé puis explicitement refusé. La seule
   voie validée est la synchro Health Connect complète (voir section
   dédiée), **désormais en place et fonctionnelle**. Ne pas resimplifier
   vers un import partiel (ex. calories seules sans le détail macro).

## Workflow de déploiement (déjà en place, ne pas en proposer un autre)

- Dépôt GitHub : `yoannrolland-dwy/protocole-app`.
- Dossier local : `/Users/yrolland/Documents/GitHub/protocole-app`.
- **Netlify est connecté en Continuous Deployment à ce dépôt** : chaque
  `git push` sur `main` déclenche automatiquement un rebuild + redéploiement
  sur le site existant. Depuis le chantier RawCare Phase 0 (05/08/2026, monorepo) :
  Build command `npm run build --workspace=apps/perso`, Publish directory
  `apps/perso/dist` — géré par `netlify.toml`, voir la section RawCare Phase 0
  plus haut pour le détail et l'avertissement sur le premier déploiement à surveiller.

### Deux branches — règle importante pour le budget Netlify

Netlify facture **15 crédits par déploiement de production**, sur un quota de
**300 crédits/mois** (soit 20 déploiements). Or l'app native se met à jour par
USB **sans aucun `git push`** : seul le déploiement de la PWA coûte.

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
poussé sur `main` ne touche aucun fichier de la PWA (cas d'un commit purement
`android/` ou documentaire). **Vérifié empiriquement le 27/07/2026** : un build
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

Après un `adb install -r`, l'app peut afficher "Nouvelle version
disponible, recharger ?" au premier lancement (le service worker de la PWA
tourne aussi dans l'app native) — c'est normal, accepter le rechargement
pour être sûr d'avoir le code à jour.

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
