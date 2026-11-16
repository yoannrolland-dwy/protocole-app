# Jeffrey dans PROTOCOLE — état actuel

Fiche de référence, sortie de CLAUDE.md le 16/11/2026. À lire avant de toucher à Jeffrey.

## Jeffrey, état actuel (mis à jour le 13/11/2026, apps/perso v3.163.0 ; inchangé en v3.164.0)

Résumé de référence. Les sections datées plus bas (chantier J, 29-31/10/2026) racontent comment on
en est arrivé là ; **en cas de désaccord, c'est cette section qui fait foi**. À tenir à jour à
chaque changement de Jeffrey.

**Qui il est.** Le majordome de PROTOCOLE, dans `apps/perso`. Il remplace la carte « Coach IA » (bouton « Analyser ») depuis v3.128.0.
Derrière le majordome : coach sportif, kiné, nutritionniste et coach de vie ; ce n'est pas un avis
médical. Principe hérité du Coach IA : **le JS calcule les faits, Jeffrey les juge**. Ses données
sont celles de `buildCoachPrompt` (champ `facts`) ; le recommandeur reste le garde-fou : Jeffrey
ne propose qu'une séance de la liste autorisée, et l'app le vérifie (`validateSessionChoice`).

**Personnalité** (`JEFFREY_PERSONA`, `packages/core/src/coach/jeffrey.js`). Ce texte n'est que la
version de départ : celle qui sert est la clé `jeffreyPersona`, éditable dans Réglages › Jeffrey ›
« Jeffrey · personnalité » (« Rétablir la personnalité d'origine » remet ce texte). Relu sur le
téléphone le 31/10/2026 : identique au texte du code. Version de départ : vouvoiement, « Monsieur » ; langage châtié, phrases courtes, flegme britannique ; humour
(traits d'esprit, understatement, pince-sans-rire, vraie blague quand l'occasion s'y prête) ;
taquin, volontiers cynique, mais toujours bienveillant, on sent qu'il est du côté de Monsieur ; ne
répète pas une plaisanterie d'un message à l'autre ; ne flatte pas, ne dramatise pas : il constate,
conseille et laisse Monsieur décider.

**Deux règles qui priment sur la personnalité** (`JEFFREY_RULES`) :
1. Le ton ne change jamais les faits ni les garde-fous (séance écartée, douleur, chiffre). Monsieur
   est un petit dormeur : une nuit courte n'est jamais un signe de fatigue, seul le score de
   qualité compte (on peut en plaisanter, jamais le présenter comme un problème).
2. Une alerte se dit toujours clairement : une phrase nette d'abord, l'humour éventuellement après.

Les **messages fixes de l'app** (écrans vides, confirmations, erreurs, notifications) parlent aussi
dans sa voix : recueil `PHRASES` dans `apps/perso/src/lib/jeffrey.js` (`say`, `sayStable`,
`sayError`), sans aucun appel à l'IA. Tout nouveau message de l'app va dans ce recueil (test :
chaque phrase dit « Monsieur », aucune ne tutoie).

**Où il apparaît.** Onglet Analyse › sous-onglet « Jeffrey » (en dernier depuis v3.157.3, Analyse s'ouvre sur « Dépense ») ; bulle sur les
autres onglets (pas dans Analyse, les Réglages, ni avec un carnet de séance ouvert), qui ouvre la
même conversation en surimpression ; carte du Bord (en haut le matin, une ligne sous les tuiles
l'après-midi) ; notification de conversation (brief et réponses). La conversation s'ouvre tout en
bas, champ de saisie visible.

**Ce qu'il fait.**
- Conversation libre, texte au fil de l'eau ; « Faites-moi le point » (300 mots, met à jour le
  carnet de bord après `---CARNET---`) ; « Bilan 3 mois » (faits calculés sur 90 jours).
- Outils : `choisir_seance` (carte avec « Démarrer »), `proposer_reponses` (pastilles), et cinq
  actions **jamais écrites sans un tap de Monsieur** : `ajouter_eau`, `noter_genou`, `ecrire_note`,
  `reprendre_repas` (même repas d'hier), `ajouter_habituel` (quantité de la dernière fois).
- Mémoire : la conversation d'un jour passé est versée dans le carnet de bord au premier message
  suivant ; les conversations sont gardées 30 jours (`jeffreyLog`).
- Brief du matin (depuis v3.148.0) : **il part dans l'app quand Monsieur note son genou**, entre
  5 h et midi. L'app relit Health Connect une fois juste avant. S'il manque la nuit ou la pesée,
  le brief part quand même et Jeffrey le dit. Il est écrit dans la conversation, avec une
  notification sans bruit. **Aucun réveil en arrière-plan.** « Le brief tout de suite » (carte du
  Bord) le lance sans genou. Météo Open-Meteo en une phrase si elle change quelque chose (position
  approximative, jamais envoyée à l'IA). Le brief n'a qu'un outil : `proposer_reponses`.
  **Depuis v3.153.0 (G2), il passe d'abord par l'appli JEFFREY** : PROTOCOLE la prévient et
  n'écrit son brief qu'en secours, si JEFFREY ne confirme pas dans la minute (voir le pont).
- Notification de conversation : Écouter · Répondre · une réponse rapide (ou « Confirmer » si une
  action attend). Une réponse écrite dans la notification fait répondre Jeffrey sans ouvrir l'app.
- Fin de repos du carnet : **le bip seul**, plus aucune phrase depuis v3.157.2 (07/11/2026).

**Pont vers l'appli JEFFREY (étape G1, lecture seule, v3.152.0).** L'appli Android JEFFREY
(`fr.yrolland.jeffrey`, assistant vocal, autre dépôt `jeffrey-app`) remplacera à terme ce Jeffrey :
PROTOCOLE calcule les faits, JEFFREY parle. Cadrage et contrat : `jeffrey-app`,
`docs/cadrage/ETAPE_G_PONT_PROTOCOLE.md` (§6).
- Porte : service lié exporté `com.yoannrolland.protocole/.bridge.JeffreyBridgeService`, protégé
  par la permission `com.yoannrolland.protocole.permission.JEFFREY_BRIDGE` (niveau `signature` :
  les deux applis sont signées par la clé de développement du Mac, empreinte vérifiée identique le
  05/11/2026) ; l'appelant est revérifié (`checkSignatures`). `Messenger` : question `what = 1`,
  Bundle `{ op, id, json }` ; réponse `what = 2`, `{ id, ok, json }` ou `{ id, ok = false, erreur }`
  (code court : `occupe`, `inconnu` — op, sujet, type ou JSON —, `delai`, `ia_absente`, `ia_echec`,
  `interne`, `trop_long` au-delà de 200 000 caractères, `restauration` pendant les 15 s qui
  suivent une restauration — rien n'a été fait, réessayer). Une requête à la fois ; 20 s
  pour `version`/`lire`, 90 s pour `analyse`. Le journal Android ne note que l'opération, l'issue
  et la durée.
- Calcul : page sans écran `bridge.html` (`src/bridgePage.js`, `lib/bridge.js`), même origine que
  l'app donc même stockage, même code (`loadData` + `makeCoach`). Mise en forme :
  `packages/core/src/coach/bridge.js` (`buildReading`), sans aucune règle métier nouvelle.
- Opérations : `version` → `{ pont: 1, appli }` ; `lire { sujet }` (`sport_du_jour`, `macros`,
  `forme`, `brief`, `point`, `bilan`) → `{ date, regles, faits, manque }` — `regles` = contexte du
  coach + `JEFFREY_RULES` + données, séances autorisées, alertes d'abord, **sans la personnalité** ;
  `macros` donne le **reste du jour** (cible − consommé, eau comprise ; négatif = dépassé) ;
  `manque` = `briefMissing`. `analyse { type: point|bilan }` → `{ texte }` : exactement le point ou
  le bilan d'ici (même demande, même tour, configuration IA des Réglages, donc Opus), écrit dans la
  conversation du jour, carnet de bord mis à jour.
- Jamais par le pont : aucune clé, aucun réglage d'IA, aucun export complet, aucune écriture hors
  du point/bilan, de `brief_fait` et des actions de `agir`.
- **G3, actions à la voix (v3.154.0)** : op `agir { action, parametres, verifier, jeton }` (20 s).
  - **Deux temps.** `verifier: true` n'écrit rien. Il rend `{ ok, resume, jeton }` : JEFFREY relit
    `resume` à Monsieur. Un refus rend `{ ok: false, raison }`, avec si besoin `choix` (5 aliments
    au plus, `{ ref, nom }`) ou `besoin` (`grammes`, `retour_base`). `verifier: false` exige le
    jeton (3 min, usage unique, mêmes paramètres). L'action est revérifiée et n'est écrite que si
    la phrase n'a pas changé. Il rend `{ fait, resume }` ou `{ fait: false, raison }`.
  - **Sept actions**, vérifiées par `checkAgir` (`packages/core/src/coach/bridgeActions.js`) :
    - les cinq de Jeffrey, via `validateAction` ;
    - `noter_poids` : saisie manuelle de l'onglet Poids, refusée si la balance a déjà pesé
      aujourd'hui ;
    - `ajouter_aliment` : ses recettes et ses aliments sur 60 jours, puis CIQUAL, sans Open Food
      Facts. Sans quantité : recette = 1 portion, aliment déjà mangé = la dernière fois, sinon
      `besoin: grammes`.
  - **Jour** : `jour: demain` seulement pour les trois actions de repas.
  - **Genou noté par JEFFREY** : si la règle du brief le lancerait maintenant (`briefAfterKnee`,
    `brief.js`), la réponse porte `brief_du_jour: "a_faire"`, même app fermée. Conditions : 5 h
    à midi, brief activé (lu par le natif, `briefEnabled`), pas encore fait ni réservé. JEFFREY
    enchaîne, `brief_fait` d'abord, comme en G2.
  - **Écriture** : `applyActionStored`, mêmes écritures que les écrans, avec maintenant une date,
    le poids et l'aliment.
  - Jetons en attente : clé `jeffreyAgir`, hors `DATA_KEYS`.
  - Catalogue donné à JEFFREY : notes de la session, `G3-protocole-agir-catalogue.md`.
- **G4-A, séances à la voix (v3.155.0)** : deux actions de plus dans `agir` (`bridgeActions.js`).
  - `demarrer_seance { type }` : n'importe quel gabarit (choix de Yoann). La relecture dit quand
    la séance va contre le recommandeur d'aujourd'hui (`startWarning` : « à savoir » si elle est
    seulement moins prioritaire, « attention, non recommandée aujourd'hui : <raison> » sinon).
    Refus si une séance est déjà en cours (`trainingDraft`).
  - L'écriture dépose `jeffreyStart` = `{ type, at }` (hors `DATA_KEYS`, 10 min) et rend `ouvrir`
    (activité de PROTOCOLE + `open_tab: train`), que JEFFREY lance. L'app fait alors exactement
    « Démarrer » (`consumeJeffreyStart`, App.jsx) : au lancement, au retour au premier plan ou
    par la relecture. Jamais par-dessus une séance en cours ; l'extra seul n'ouvre que l'onglet.
  - `noter_seance_faite { type, duree, rpe, debut?, gene? }` : Escalade, Basket ou Mobilité
    seulement. Même ligne `trainingLog` que la séance « sport » de l'onglet Séance ; la gêne ne
    vaut que pour l'escalade. Les carnets de musculation sont refusés.
  - Catalogue donné à JEFFREY : notes de la session, `G4-protocole-seances-catalogue.md`.
- **G4-C1, moteur de séance (v3.155.1)** : la logique du carnet de musculation vit dans
  `packages/core/src/session/engine.js`. On y trouve la construction des exercices (HSR,
  superset, prérempli, réouverture), les opérations sur les séries, `nextAfter`, `currentSet` et
  `sessionRecord`. `MuscuLogger.jsx` n'en est plus que l'affichage, sans changement visible.
  Pas encore exposé par le pont. Plan C3 (séance à la voix) dans les notes de la session,
  `G4-C1-protocole-moteur-de-seance.md`.
- **G4-C2, brouillon = séance en cours (v3.156.0)** : `trainingDraft` (`lib/sessionDraft.js`,
  `{ …, exos, rev, rest? }`) est la seule vérité. Chaque geste du carnet applique le moteur au
  brouillon **stocké**, l'enregistre aussitôt (`rev` + 1), puis l'affiche.
  - Une autre page qui l'écrit est relue : `DRAFT_EVENT`, envoyé par la relecture de G3 ; le
    carnet relit si `rev` n'est pas le sien.
  - Le minuteur range son état dans `rest` (`secs, remaining, endAt, label, speech`) à chaque
    geste, et s'y recale quand une autre page l'écrit (`syncRestFromDraft`). Le réveil natif
    est inchangé.
- **G4-C3, séance à la voix (v3.157.0)** : règles pures dans
  `packages/core/src/session/voiceSession.js`, écriture dans `lib/bridge.js`.
  - `lire { sujet: "seance" }` : où en est la séance.
  - **Gestes immédiats** de `agir`, sans relecture : `noter_serie` (série notée tout de suite, repos
    lancé, record ou plateau annoncés), `annuler_serie`, `aller_a`, `exercice_suivant`, `repos`.
  - **Avec relecture et jeton** : `terminer_seance` (résumé ; pour le Basket, durée puis effort),
    `annuler_seance`.
  - Une séance de carnet démarrée à la voix crée le brouillon tout de suite, même app fermée
    (`jeffreyStart.resume`). L'app l'ouvre telle quelle (`resumeSession`, `resumeTick` de
    TrainTab) et ferme le carnet quand la séance est enregistrée à la voix.
  - Le pont programme le réveil de fin de repos sans l'app : `restAlarm` de la page du pont →
    `RestTimerPlugin.scheduleFromBridge` / `cancelFromBridge`.
  - Brouillon : `courant` (exercice nommé) et `voix.last` (pour « annule »).
  - Catalogue : `G4-C3-protocole-seance-voix-catalogue.md`.
  - **Repos lancé par JEFFREY = PROTOCOLE se tait (v3.157.1, choix de Yoann : « bip sans
    couper »)** : à la fin, le bip seul, sans priorité audio ni phrase (`quiet`, `lib/bridgeRest.js`,
    `RestEndAudio`), vibration gardée. Le repos porte `rest.source: "jeffrey"` ; +30 s et reprise à
    l'écran le gardent silencieux, « Lancer » ou une série cochée à l'écran le rendent à l'app.
    Fin ou abandon de séance par JEFFREY : réveil retiré et bip en cours arrêté.
  - **Depuis v3.157.2 (07/11/2026), c'est vrai de TOUT repos**, lancé dans PROTOCOLE ou par
    JEFFREY : voir la section du 07/11/2026 en fin de fichier. `quiet` et `rest.source` sont encore
    écrits mais n'ont plus d'effet.
- **Jeton des gestes de séance (v3.162.0, installé sur le S25 le 12/11/2026)** : la relecture
  d'un geste (`verifier: true`) rend un `jeton` lié à l'action, aux paramètres et à la cible (séance,
  exercice, série, minuteur) ; une écriture qui porte la clé `jeton` (même vide) n'est faite que si le
  jeton est valable et la cible inchangée, jamais de repli vers le geste immédiat. Sans `jeton` :
  inchangé. Code : `lib/sessionGestures.js`, `lib/agirTokens.js`. Contrat :
  `docs/suivi-jeffrey/2026-11-12-jeton-gestes-seance.md`.
- **Record coché à l'écran → JEFFREY félicite (v3.163.0, 13/11/2026, choix de Yoann : « le mélange
  des deux, seulement casque branché »)** : diffusion explicite à
  `fr.yrolland.jeffrey/.protocole.RecordSignalReceiver`, action
  `fr.yrolland.jeffrey.action.PROTOCOLE_RECORD`, même permission que le brief, extra `json` =
  `{ date, exercice, kg, reps | secondes, jambe?, ancien, detail }`. Envoyée seulement casque branché
  (vérifié par le natif), jamais genou hors base, jamais pour une série notée à la voix, une fois par
  série et valeurs. `lib/recordSignal.js`, `JeffreySignal.sendRecord`. Contrat :
  `G5-protocole-signal-record.md` (notes de la session JEFFREY).
- **Relecture dans l'app ouverte (G3)** : après toute écriture d'une page sans écran (pont,
  notification, brief de secours), l'app relit poids, genou, macros, note, journal alimentaire,
  conversation, carnet, marqueur de mémoire et séances (G4-A) avant son prochain enregistrement. Trois
  déclencheurs : l'événement `storage`, l'événement natif `protocole:external`
  (`ExternalWrites.kt`) et le retour au premier plan (avant la synchro Health Connect).
- **G2, brief du matin (v3.153.0, décision de Yoann : « secours seulement »)**. Quand la règle du
  brief le lance (genou noté, 5 h–midi, une fois par jour), PROTOCOLE envoie une diffusion
  explicite à `fr.yrolland.jeffrey/.protocole.BriefSignalReceiver`, action
  `fr.yrolland.jeffrey.action.PROTOCOLE_BRIEF_READY`, extra `json` = `{ date, manque }`
  (`JeffreySignal.kt`). Il faut la permission `fr.yrolland.jeffrey.permission.PROTOCOLE_SIGNAL`
  (signature, **déclarée par JEFFREY** : installer JEFFREY d'abord, puis PROTOCOLE, sinon Android
  ne l'accorde pas). JEFFREY appelle l'op `brief_fait { date }` **avant** de parler :
  `{ fait: true }` (jour marqué fait par JEFFREY), `{ fait: false, deja: true }` (déjà fait ou
  réservé par PROTOCOLE), `{ fait: false }` (autre date). Sans confirmation dans la minute,
  JEFFREY absent, sans récepteur ou permission refusée : brief de PROTOCOLE comme avant. App à
  l'écran : l'app attend (relecture toutes les 5 s, carte « Votre brief part chez JEFFREY ») ;
  app quittée : réveil exact à +62 s (`BriefSignalCheckReceiver`, rien si l'app est à l'écran,
  `AppVisibility`) → page sans écran `brief.html?mode=signal`. Jamais deux briefs : PROTOCOLE
  **réserve** le jour (`claimDate`, `claimAt`) juste avant d'écrire, et `brief_fait` refuse un jour
  réservé. Après un échec, la réservation reste (JEFFREY ne reprend pas la main) mais « Le brief
  tout de suite » peut réessayer. « Le brief tout de suite » ne passe jamais par JEFFREY. Brief dit
  par JEFFREY : la copie du matin sur le serveur part quand même, une fois (`backupDate`). Règles
  pures et testées : `briefHandoff`, `claimPatch`, `briefDoneByJeffrey`, `jeffreyBackupDue`
  (`packages/core/src/coach/brief.js`). Marqueur `jeffreyBrief` = `{ doneDate, by, claimDate,
  claimAt, signal: { date, at, sent }, backupDate }`, toujours hors `DATA_KEYS`.
- **Essai sans toucher au vrai brief** : `adb shell am broadcast -n
  com.yoannrolland.protocole/.BriefSignalTestReceiver [--es manque '["pesée"]']` envoie le signal
  avec `essai: true` (date du jour) ; `brief_fait { date, essai: true }` répond `{ fait: true,
  essai: true }` sans rien marquer ; aucun contrôle de la minute, aucun brief de secours. Le
  récepteur est exporté mais protégé par `android.permission.DUMP` (shell d'adb seulement).
- Règles du sujet `brief` du pont : mêmes consignes de forme que le brief d'ici (ordre, 150 mots,
  texte simple, première phrase courte, donnée manquante dite et jamais inventée), test à l'appui.
- Limites connues :
  - le pont lit le stockage tel que l'app l'a laissé. Il ne relit pas Health Connect : une nuit ou
    une pesée pas encore synchronisée par l'app apparaît dans `manque`, et `noter_poids` passe
    alors, puis la balance reprend la main à la synchro suivante ;
  - l'écrasement de l'app ouverte (point, réponses depuis la notification) est corrigé par la
    relecture de G3.

**Modèle et fournisseur.**
- Un seul modèle pour toute l'IA de l'app (Jeffrey, Carte resto, Photo d'un plat) : **Claude
  Opus 5.5** choisi par Yoann le 26/10/2026. Le modèle et le fournisseur se règlent dans Réglages ›
  Appareil › « IA · fournisseur et modèle » : **Anthropic direct** (clé `apiKey`, modèle `model`)
  ou **LiteLLM**, son serveur Oracle `https://141.253.109.120` (clés `litellmUrl`, `litellmKey`,
  `litellmModel`, au format `anthropic/claude-opus-5-5`). Sans réglage stocké, le code retombe sur
  `claude-sonnet-5-5` en Anthropic direct.
- **Réglage en place sur le téléphone (relu le 31/10/2026)** : fournisseur **LiteLLM**, modèle
  `anthropic/claude-opus-5-5`, serveur `https://141.253.109.120`. Le secours « Anthropic direct »
  est prêt (clé saisie, modèle `claude-opus-5-5`) : il suffit de basculer en un tap si le serveur
  tombe. Dépensé en octobre 2026 : 2,97 $ (`aiSpend`).
- Sur l'app native, LiteLLM passe par le relais `JeffreyHttpPlugin.kt` (le serveur ne gère pas la
  vérification CORS). Anthropic direct passe par `fetch`.
- Réflexion : `low` pour la conversation et le brief, `medium` pour le point et le bilan
  (`effortFor`). Budget de réponse 16 000 tokens.
- Reprise : 3 essais, jamais après le début du flux ; puis repli sur Haiku 4.5 seulement pour un
  modèle Claude (`anthropic/claude-haiku-4-5` via LiteLLM).
- Coût mesuré (Opus 5.5) : environ 7 ¢ le premier message du jour, environ 2 ¢ les suivants grâce
  au cache, jusqu'à 11 ¢ quand la conversation du jour est longue. Total du mois dans Réglages
  (`aiSpend`).

**Voix.**
- Sa voix vient du **serveur Oracle** : Pocket TTS français (Kyutai), voix `jeffrey`, via LiteLLM
  (`POST {url}/v1/audio/speech`, modèle `protocole/jeffrey`, son PCM 24 kHz en flux). Le serveur
  produit toujours à vitesse 1,00 ; l'app lit à **1,20** (réglage `jeffreyVoice.speed`). Clé
  `voiceKey`, jamais exportée ; `jeffreyVoice.url` vide = même adresse que LiteLLM. Sur le
  téléphone (31/10/2026), `jeffreyVoice` garde encore l'ancienne forme de la voix Android
  (`voice`, `rate`, `pitch`), ignorée : la vitesse appliquée est donc celle par défaut, 1,20, et
  l'adresse celle de LiteLLM. Elle sera réécrite au prochain réglage de la vitesse. Config du
  serveur : autre dépôt, `LiteLLM_Oracle/protocole-voice/`.
- **La voix intégrée d'Android n'existe plus** (retirée en v3.136.0) : plus de choix de voix ni de
  hauteur. Sans réseau, Jeffrey se tait (pas de voix de secours).
- Quand il parle : **casque branché → il dit toutes ses réponses** (conversation, brief,
  réponses depuis la notification), séance ou pas. Sans casque : seulement si Monsieur lui a
  parlé à la voix ; sinon bouton « Écouter » sous chaque réponse (cache sur le téléphone, 60 Mo).
  Fin de repos : le bip seul, jamais de phrase (v3.157.2).
- La musique et les vidéos se mettent **en pause** pendant qu'il parle, puis reprennent (priorité
  audio `GAIN_TRANSIENT`). **Android 16 ne l'accorde qu'à une app à l'écran ou dans un service au
  premier plan** : le brief et les réponses depuis la notification passent par `BriefService`. La
  fin de repos ne prend plus la priorité audio (v3.157.2) : son bip se mêle au son en cours.
- **Interrupteur « Voix de Jeffrey »** (Réglages › Jeffrey › voix, v3.147.0) : Activée / En
  vacances, activée par défaut (`jeffreyVoice.enabled`, absent = activé). En vacances, il ne parle
  plus nulle part, mais écrit toujours tout ; dictée et bips de repos restent. Voir la section du
  01/11/2026 en fin de fichier.
- La dictée (micro dans la conversation) reste celle d'Android, en français, envoi quand Monsieur
  se tait.

**Fichiers.**
- Core (`packages/core/src/`) : `coach/jeffrey.js` (personnalité, règles, outils, requête,
  validation des actions, mémoire), `coach/brief.js` (décision du brief et réveils),
  `coach/stream.js` (lecture du flux), `coach/claudeApi.js` (`streamClaude`, reprise, coût),
  `coach/speechText.js` (texte découpé et écrit en toutes lettres pour la voix),
  `coach/prompt.js` (les données), `weather.js`, `healthMerge.js`.
- Pont JEFFREY : `packages/core/src/coach/bridge.js`, `apps/perso/src/lib/bridge.js`, Android
  `JeffreySignal.kt` (G2 : signal, contrôle de la minute, essai),
  `src/bridgePage.js` + `bridge.html`, `lib/pageHttp.js` (relais HTTP partagé avec `briefPage.js`),
  Android `bridge/JeffreyBridgeService.kt` ; G3 : `packages/core/src/coach/bridgeActions.js`,
  Android `ExternalWrites.kt`.
- App (`apps/perso/src/`) : `lib/jeffrey.js` (phrases fixes), `lib/jeffreyTurn.js` (un tour de
  conversation), `lib/coachInputs.js`, `lib/brief.js`, `lib/briefNative.js`,
  `lib/jeffreyNotify.js`, `lib/jeffreyHttp.js`, `lib/voice.js`, `lib/voiceConfig.js`,
  `lib/restSpeech.js`, `lib/weather.js`, `lib/ai.js` ; `screens/perf/JeffreyChat.jsx`,
  `screens/dashboard/JeffreyCard.jsx`, `components/JeffreyBubble.jsx`,
  `components/JeffreyOverlay.jsx` ; page sans écran `brief.html` + `src/briefPage.js` (réponses
  depuis la notification seulement).
- Android : `JeffreyVoice.kt` (voix, dictée, casque), `JeffreyHttpPlugin.kt`,
  `JeffreyNotifReceiver.kt`, `BriefRunner.kt`, `BriefService.kt`, `BriefPlugin.kt`,
  `BriefAlarmReceiver.kt` (ne fait plus que retirer un ancien réveil du brief), `HealthReads.kt`,
  `RestAlarmReceiver.kt` (voix de fin de repos).

**Clés.** Exportées (`DATA_KEYS`) : `jeffreyLog`, `jeffreyPersona`, `jeffreyVoice`, `aiProvider`,
`litellmUrl`, `litellmModel`, `model`, `aiSpend`, `coachProfile`, `coachJournal`, `noteLog`.
**Jamais exportées, volontairement** : `apiKey`, `litellmKey`, `voiceKey`, `backupKey` (clés secrètes),
`jeffreyMemoryDate`, `jeffreyBrief` (marqueurs du jour), `lastPosition` (position du téléphone).
Préférences Android privées : `jeffrey_brief` (Activé / Désactivé), `jeffrey_thread`, `rest_voice`, `protocole_backup` (réveils de sauvegarde actifs ou non), `jeffrey_voice`
(interrupteur de la voix, recopié depuis l'app).
