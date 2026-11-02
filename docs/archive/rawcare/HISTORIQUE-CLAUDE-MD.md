# RawCare — historique technique (extrait de CLAUDE.md le 02/11/2026)

Chapitres retirés de `CLAUDE.md` quand Yoann a arrêté la version publique. Copiés tels quels,
sans retouche : ils décrivent l'état au moment où ils ont été écrits (août 2026). Voir
`README.md` dans ce dossier pour l'architecture et la marche à suivre pour repartir.

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

## Workflow de déploiement tel qu'il était (avant le 02/11/2026)


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

