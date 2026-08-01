# PROTOCOLE — Contexte projet (pour Claude Code)

Ce fichier est lu automatiquement à chaque session Claude Code. Il remplace
le besoin de recoller le contexte à chaque fois.

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
```
protocole-app/
  index.html
  vite.config.js        # React + Tailwind v4 + PWA
  capacitor.config.json # config app native (SystemBars insetsHandling: css)
  package.json / package-lock.json
  public/                # icônes PWA (icon-192, icon-512, maskable, apple-touch)
                         # + privacypolicy.html (exigée par Health Connect)
  src/
    main.jsx             # point d'entrée + enregistrement service worker
    App.jsx              # TOUT le code applicatif (~2100 lignes, un seul fichier)
    store.js             # persistance localStorage + export/import JSON
    healthSync.js        # synchro Health Connect (pas/sommeil/macros/eau)
    ui.jsx               # design system "Affirmée" : jetons C + primitives,
                         # extraits d'App.jsx le 01/08/2026 pour être partagés
    data/ciqual.json     # table CIQUAL compactée (3178 aliments, 246 Ko)
    nutrition/           # module Nutrition interne (onglet "Repas", bêta)
      ciqual.js          #   chargement lazy + recherche + scoring
      off.js             #   recherche + lecture par code-barres Open Food Facts
      scan.js            #   scan code-barres ML Kit (M3, natif seulement)
      foodStore.js       #   clés foodLog/foodPins, totaux, favoris dérivés
      NutritionTab.jsx   #   l'onglet
      FoodSearch.jsx     #   recherche (CIQUAL + OFF), quantité, saisie libre
    index.css            # @import "tailwindcss" + resets minimaux
  android/               # projet natif Capacitor — build/déploiement séparé
                         # de la PWA, voir "Mise à jour de l'app native"
    app/src/main/java/com/yoannrolland/protocole/
      MainActivity.java
      HealthNutritionPlugin.kt  # lecteur natif maison (macros complètes,
                                 # voir section Health Connect)
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

- **8 onglets** : Tableau de bord, Poids, Sommeil, Pas, Séances, Genou, Macros,
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
- **Genou** : log douleur 0-10 **sans aucune valeur par défaut** (ni 4 ni 5 —
  changé le 30/07/2026) : rien n'est présélectionné à l'ouverture et le bouton
  Enregistrer reste désactivé tant qu'un chiffre n'a pas été touché, pour forcer
  une vraie évaluation de la sensation plutôt qu'un enregistrement réflexe. Si
  le jour affiché a déjà une entrée, elle est rechargée (à l'ouverture de
  l'onglet comme au changement de date) ; changer vers un jour sans entrée
  remet le champ à vide. +
  règle de Silbernagel (retour à la base sous 24h), table HSR, deux
  routines guidées avec minuteur (rééduc autonome, échauffement basket
  sécurisé).
- **Recommandeur "Prochaine séance"** (`recommendSessions`) : analyse tout
  l'historique des séances et des douleurs (pas de jours fixes — je n'ai
  plus de rythme figé). Retourne `{ suggestions, avoid }` : 3 suggestions
  classées par score + une liste "à éviter aujourd'hui" avec raison
  chiffrée (ex. genou hors base → Lower et Basket écartés ; Upper déjà fait
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
  **215/205/80/30 g** (~2400 kcal), graphique 14 jours en **calories** (pas
  protéines — changé exprès). Une bascule temporaire par date existe
  (`targetsForDate` dans `App.jsx`) pour des périodes ponctuelles (ex.
  sèche intensive avant vacances) — revient automatiquement aux cibles par
  défaut après la période, ne pas la confondre avec un changement
  permanent. Eau en boutons rapides (+250/+500 ml, PAS de saisie manuelle
  pour l'eau — décision explicite). Cible eau **+1 L automatique les jours
  où une séance Basket est loggée** (je transpire beaucoup au basket).
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
- **Réglages (⚙)** : export/import JSON (Réglages → Exporter/Importer),
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
- **Limite connue et acceptée pour les pas** : Health Connect n'est qu'une
  copie retardée de ce que Samsung Health lui transmet — décalage constaté
  face au compteur temps réel Samsung Health/montre. Décision prise : ne
  pas contourner via le Samsung Health Data SDK (accès direct plus frais,
  mais mode développeur documenté par Samsung comme *"non destiné aux
  utilisateurs finaux"*, cassable à une mise à jour de Samsung Health). Pas
  de projet de correction ici, c'est un choix assumé.
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

**Chantier volontairement itératif. M0-M3 livrés, M4+ reste à faire.**

| Jalon | Contenu | État |
|---|---|---|
| M0 | Base CIQUAL + moteur de recherche | ✅ 01/08/2026 |
| M1 | Onglet « Repas » isolé, CIQUAL + repas + historique | ✅ 01/08/2026 |
| M2 | Open Food Facts (recherche texte, sans cache persisté) | ✅ 02/08/2026 |
| M3 | Scan code-barres ML Kit (natif seulement) | ✅ 02/08/2026 |
| M4 | Portions/unités, recettes, copier un repas | à faire (quick-add livré en avance, voir plus bas) |
| M5 | (abandonné — micronutriments écartés, voir plus bas) | — |
| M6 | **Bascule** : `foodLog` alimente `macroLog`, coupure HC nutrition/eau | à faire |
| M7 | Retrait des permissions HC nutrition/hydratation | à faire |

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
- **Étape 1 strictement isolée** : `NutritionTab` gère sa propre clé `foodLog` et
  ne reçoit d'`App.jsx` que les cibles, en lecture. `macroLog`, `MacroTab` et
  `healthSync.js` ne sont pas touchés — Cronometer continue en parallèle, et
  retirer l'onglet suffit à tout annuler.
- **Health Connect nutrition/hydratation deviendra inutile, mais seulement à M6.**
  Le vrai risque est là : tant que `runHealthSync` tourne, il écrase `macroLog`
  avec les données Cronometer à chaque retour au premier plan. Au moment de la
  bascule il faut **couper la lecture nutrition/eau**, pas seulement écrire
  ailleurs. En revanche **ne pas écrire vers Health Connect** : rien ne consomme
  ces données chez Yoann, ce serait deux permissions de plus pour rien. Pas,
  sommeil et poids restent sur Health Connect, inchangés.
- **L'eau est une exception à l'isolation, décidée le 02/08/2026** : `NutritionTab`
  lit et écrit `macroLog.water` directement (mêmes boutons +250/+500/−250 que
  `MacroTab`), au lieu de dupliquer la donnée dans `foodLog`. Ce n'est pas une
  entorse au principe d'isolation — l'eau était déjà listée comme fonctionnalité à
  garder telle quelle dans la demande initiale (« déjà interfacée avec Health
  Connect ») — juste le même compteur rendu visible dans les deux onglets. Seuls
  kcal/macros restent isolés dans `foodLog` jusqu'à M6.

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
    premier vrai test à faire par Yoann sur l'appareil.

## Règles absolues à ne jamais casser

1. **Ne jamais changer les clés localStorage** (`weightLog`, `sleepLog`,
   `trainingLog`, `kneeLog`, `macroLog`, `noteLog`, `stepsLog`, `targets`,
   `phase`, `hsrWeek`, `apiKey`, `model`, `coachProfile`, `coachJournal`,
   `foodLog`, `foodPins` — préfixées `protocole:` dans `store.js`)
   sans écrire une migration. Casser une clé = perdre l'historique de
   l'utilisateur, ce qui est la pire chose possible ici.
   **Toute nouvelle clé doit être ajoutée à `DATA_KEYS` dans `store.js`**,
   sinon elle est absente de l'export JSON et silencieusement perdue à la
   prochaine restauration.
2. **Toujours vérifier que le build passe** (`npm run build`) avant de
   considérer une modification terminée.
3. **Bumper `APP_VERSION`** (dans `App.jsx`) et `"version"` (dans
   `package.json`) à chaque changement livré.
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
  sur le site existant (Build command: `npm run build`, Publish directory:
  `dist`).

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
  Exporter), à ne jamais oublier de rappeler avant une mise à jour
  importante — GitHub ne contient que le code, jamais les données perso.

## Mise à jour de l'app Android native (différent du déploiement PWA)

Le `git push` sur `main` ne redéploie **que la PWA** (Netlify, automatique).
L'app native installée sur le téléphone ne se met JAMAIS à jour seule — il
faut rebuild + réinstaller à la main à chaque changement de code qui la
concerne :
```
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
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
