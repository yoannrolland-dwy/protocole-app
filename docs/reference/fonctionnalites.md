# Fonctionnalités en place

Fiche de référence, sortie de CLAUDE.md le 16/11/2026. À lire avant de modifier un écran existant.

## Fonctionnalités en place (ne pas régresser sans le signaler)

- **5 onglets depuis le 25/10/2026 (chantier U, U3 étape 1)** : Bord (écran « Tableau de
  bord » ; s'est appelé « Aujourd'hui » de U3 au 25/10/2026), Séance, Nutrition (ex-Macro, module Nutrition interne), **Corps** (sous-onglets
  Poids · Énergie · Pas · Genou — les 4 anciens onglets), Analyse (ex-TDEE/Performance).
  Clés internes inchangées (`dash`, `train`, `macro`, `corps`, `perf` ; sous-onglets
  `weight`, `sleep`, `steps`, `pain`) : `goTo` dans App.jsx traduit les anciennes clés
  encore appelées par les écrans. Avant : 8 onglets (Tableau de bord, Poids, Énergie, Pas,
  Séances, Douleurs, Performance, Macro)
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
