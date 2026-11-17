# PROTOCOLE — Contexte projet (pour Claude Code)

Ce fichier est lu à chaque session : il ne garde que ce qui sert tout le temps.
Le reste est rangé, voir « Où trouver le reste » en bas.

## État courant (14/11/2026) : à lire en premier dans une session neuve

À tenir à jour à chaque installation.
- **Installé sur le S25** : v3.172.0, commit `ee1a90f`, le 17/11/2026 à 11 h 48 (fin d'exercice et
  compte rendu dits par JEFFREY, séances rouvertes comprises, annonce redite).
- **Git** : `dev` = `origin/dev` (poussé le 17/11/2026 à 11 h 50), dossier propre, aucune autre branche
  de travail, aucun worktree, rien de mis de côté. `main` a été aligné sur `dev` le 13/11/2026, à
  la demande de Yoann : il ne déclenche plus rien et n'est mis à jour que sur sa demande.
- **Repères de retour arrière** (étiquettes poussées) : `avant-refonte`, `rawcare-final`,
  `avant-campagne-audit`, `apres-lot1-audit`, `apres-lot2-audit`, `avant-jetons-gestes`. APK
  précédents : `~/Documents/protocole-sauvegardes/` (hors Git).
- **Tests** : 373 (`npm test`), plus les tests unitaires Android lancés par `release.mjs build`.
- **Chantiers** : tous ceux de `ROADMAP.md` sont livrés (V, R, S, T, U, J). La campagne d'audit du
  10/11/2026 est faite (lots 1 à 3). Ce qui reste ouvert est dans « Reportés à la fin de la
  campagne » (`docs/journal/2026-11.md`).
- **Chantier en cours : démonstrations 3D** (sections du 13/11/2026 de `docs/journal/2026-11.md`). Étape 1
  (Mobilité) et étape 2 (haltères, barre, bancs) installées. Gestes corrigés d'après la
  littérature en v3.166.0, installée (« c'est mieux », Yoann) ; sources dans `docs/demos-3d/`.
  Étape 3 (poulies et machines) installée en v3.167.0 ; échauffement basket installé en v3.168.0.
  Tous les exercices des séances ont leur démonstration. Sans démonstration : curls poignets,
  rowing machine à disques (hors séances). Reste : l'avis de Yoann sur les gestes.
- **Côté appli JEFFREY** (dépôt `jeffrey-app`, dont le journal fait foi) : récepteur du signal de
  record installé et validé en réel le 13/11/2026 ; fin d'exercice et compte rendu (v3.172.0) : contrat
  `docs/suivi-jeffrey/2026-11-17-fin-exercice-compte-rendu.md`, partie JEFFREY à coder ; jeton des gestes de séance installé le
  12/11/2026, pas encore validé sur le téléphone ; affichage en clair du code `restauration` :
  état à confirmer. Notes : `docs/suivi-jeffrey/`.
- **Jamais essayé sur le téléphone** : voir les lignes « Pas vérifié » et « Pas essayé » des
  sections de `docs/journal/2026-11.md` (restauration réelle, gestes avec jeton, vraie photo de plat avec
  son détail, record coché casque branché, une vraie séance Mobilité à 18 exercices).
- **Plusieurs sessions peuvent travailler dans ce dossier en même temps** (celle du pont JEFFREY
  surtout) : relancer `git status` avant de toucher à la version, à ce fichier, et avant chaque
  commit ; commiter par chemins explicites, jamais tout le dossier.

## Qui je suis (Yoann)

43 ans, athlète (musculation / basket / escalade), en recomposition corporelle depuis le
02/10/2026, sans poids cible.
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
  voir `docs/journal/2026-09.md`), jamais la durée seule. Le recommandeur ET le Coach IA suivent
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

**Une seule cible utilisée : l'app Android native** (le build web, une PWA, existe toujours
dans le code car l'app native est construite par Vite, mais il n'est plus publié nulle part
depuis le 06/08/2026) :
- **App Android native** (dossier `android/`, appId
  `com.yoannrolland.protocole`) : installée à la main sur le téléphone via
  USB/adb (pas de store, pas de mise à jour automatique). C'est la seule
  des deux à avoir accès à Health Connect (pas, sommeil, macros, eau
  automatiques — voir `.claude/rules/health-connect.md`).

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
- @capacitor/core, @capacitor/android 8.5.1 (depuis le 11/11/2026, avis de sécurité),
  @capacitor/app 8.1.x, @capacitor/haptics 8.0.x (app native)
- @capgo/capacitor-health 8.10.0 (lecture Health Connect : pas, sommeil,
  énergie, hydratation — PAS le détail des macros, voir `.claude/rules/health-connect.md`)
- @capacitor-mlkit/barcode-scanning 8.1.0 (scan code-barres, module Nutrition M3,
  natif seulement)
- @fontsource/instrument-sans 5.3.0 et @fontsource/jetbrains-mono 5.3.0 (polices du
  design system v2, embarquées pour le hors-ligne)

## Règles absolues à ne jamais casser

1. **Ne jamais changer les clés localStorage** (`weightLog`, `sleepLog`,
   `trainingLog`, `kneeLog`, `elbowLog`, `rhrLog`, `napLog`, `macroLog`, `noteLog`, `stepsLog`, `targets`,
   `phase`, `hsrWeek`, `climbScheme`, `basketSchedule`, `apiKey`, `model`, `coachProfile`,
   `coachJournal`, `foodLog`, `foodPins`, `foodMuted`, `foodPortions`, `foodRecipes`,
   `foodOverrides`, `foodMealPins`, `foodMealMuted`, `targetHistory`, `palierWeekly`, `aiProvider`, `litellmUrl`, `litellmKey`,
   `litellmModel`, `aiSpend`, `jeffreyLog`, `jeffreyPersona`, `jeffreyVoice`, `voiceKey`, `backupUrl`,
   `backupKey` —
   préfixées `protocole:` dans `store.js`)
   sans écrire une migration. Casser une clé = perdre l'historique de
   l'utilisateur, ce qui est la pire chose possible ici.
   **Toute nouvelle clé doit être ajoutée à `DATA_KEYS` dans `store.js`**,
   sinon elle est absente de l'export JSON et silencieusement perdue à la
   prochaine restauration. **Deux exceptions volontaires**, à ne pas « corriger » :
   `lastAutoBackupDate` et `lastCloudBackup` sont des marqueurs de sauvegarde —
   les restaurer ferait croire à l'app qu'une sauvegarde vient d'avoir lieu.
   `foodPins` et `foodMuted` sont dans le même cas depuis le 04/11/2026 (remplacés par
   `foodMealPins`/`foodMealMuted`, plus lus, gardés dans `DATA_KEYS`).
   `elbowLog` est un troisième cas particulier depuis le 05/09/2026 : le coude a été
   retiré (plus aucun code ne le lit/l'écrit, voir `docs/journal/2026-09.md`), la clé reste dans
   `DATA_KEYS` uniquement pour ne pas perdre l'historique déjà exporté.
   `trainingDraft` (19/09/2026, brouillon auto-sauvegardé du carnet en cours — voir
   chantier dédié dans `docs/journal/2026-09.md`) est une quatrième exception volontaire : état éphémère lié à
   l'appareil au moment présent, pas une donnée à restaurer sur un autre appareil ou à une
   autre date — ne jamais l'ajouter à `DATA_KEYS`.
   **Autres clés volontairement hors `DATA_KEYS`, à ne jamais y ajouter** : les clés secrètes
   `apiKey`, `litellmKey`, `voiceKey`, `backupKey` (jamais dans un export) ; `serverBackup` (marqueur
   de la dernière copie serveur, même raison que `lastCloudBackup`) ; les marqueurs du jour de Jeffrey
   `jeffreyMemoryDate` et `jeffreyBrief` (les restaurer ferait sauter un brief ou une mise en
   mémoire) ; `restoreLock` (gel de 15 s après une restauration, 11/11/2026) ; `jeffreyAgir` (jetons de relecture du pont, valables 3 minutes) ; `jeffreyStart` (séance à
   ouvrir demandée par JEFFREY, valable 10 minutes) ; `lastPosition` (position du téléphone, propre à l'appareil). `climbScheme` reste
   dans `DATA_KEYS` mais n'est plus lu depuis le 08/10/2026 (même cas qu'`elbowLog`).
2. **Toujours vérifier que le build passe** (`npm run build --workspace=apps/perso`,
   toujours depuis la racine du monorepo : contrôle rapide seulement ; avant une installation, la
   seule commande est `release.mjs build`) **et que `npm test` est vert** avant de considérer une
   modification terminée. Depuis le chantier T1 (04/10/2026), un hook pre-commit lance
   `npm test` et bloque le commit s'il échoue — ne jamais le contourner ; si une capture
   datée (`packages/core/test/snapshots/`) diffère, c'est soit une régression à corriger,
   soit un changement voulu à acter avec `UPDATE_SNAPSHOTS=1 npm test` (et à expliquer dans
   le commit).
3. **Bumper `APP_VERSION`** (dans `apps/perso/src/version.js` depuis U0, 25/10/2026) et `"version"` (dans
   `apps/perso/package.json`) à chaque changement livré.
4. **Pas de déploiement web** : depuis le 02/11/2026, plus aucun site n'est publié (la PWA perso
   depuis le 06/08/2026, la version publique RawCare arrêtée le 02/11/2026). Ne pas en recréer
   sans demande explicite de Yoann ; l'app se met à jour par installation USB seulement.
5. Avant de simplifier une règle métier (Silbernagel, table HSR, logique
   du recommandeur, contrat du Coach IA), demander confirmation — ce sont
   des décisions prises après plusieurs itérations, pas des choix
   arbitraires.
6. **Pas d'import "coller depuis MyFitnessPal"** ni d'automatisation par
   demi-mesure des macros — proposé puis explicitement refusé. La seule
   voie validée est la synchro Health Connect complète (voir section
   dédiée), **désormais en place et fonctionnelle**. Ne pas resimplifier
   vers un import partiel (ex. calories seules sans le détail macro).

## Workflow Git (depuis le 02/11/2026)

- Dépôt GitHub : `yoannrolland-dwy/protocole-app`. Dossier local :
  `/Users/yrolland/Documents/GitHub/protocole-app`.
- **Plus aucun déploiement web** : la PWA d'`apps/perso` n'est plus publiée depuis le 06/08/2026,
  et le site Netlify de la version publique a été arrêté le 02/11/2026. L'app ne se met à jour
  que par installation USB (section suivante). `git push` ne fait que sauvegarder le code.
- **`dev`** = branche de travail, où l'on pousse. **`main`** = mise à jour seulement sur demande
  explicite de Yoann (ça ne déclenche plus rien, mais on garde l'habitude d'une branche stable).
- On demande toujours avant de committer, et avant de pousser.
- Les données de Yoann ne sont jamais dans Git : sauvegarde automatique sur son serveur Oracle
  (trois fois par jour, voir la section du 02/11/2026) et sauvegarde manuelle en secours
  (Réglages › Sauvegarder hors du téléphone).

## Mise à jour de l'app Android native

`git push` ne met rien à jour sur le téléphone. Une seule procédure, après le commit, depuis la
racine du dépôt : `node apps/perso/scripts/release.mjs build`, puis
`node apps/perso/scripts/release.mjs install`. Détail, refus et sauvegardes d'avant installation :
skill `installer-android` (`.claude/skills/installer-android/SKILL.md`), à lire avant de lancer.

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

## Où trouver le reste

| Besoin | Où |
|---|---|
| Ce qui a été livré, et pourquoi (sections datées) | `docs/journal/INDEX.md`, puis `docs/journal/2026-MM.md` |
| Jeffrey dans PROTOCOLE, pont vers l'appli JEFFREY | `docs/reference/jeffrey-etat.md`, `docs/suivi-jeffrey/` |
| Fonctionnalités en place (ne pas régresser sans le signaler) | `docs/reference/fonctionnalites.md` |
| Structure des fichiers | `docs/reference/structure-fichiers.md` |
| Coach IA, Health Connect, Nutrition, design system | `.claude/rules/` (chargées seules quand on ouvre ces fichiers) |
| Chantiers passés et leurs décisions | `ROADMAP.md` (tous livrés ; à lire seulement sur demande) |

## Tenir ce fichier court

- À chaque installation : mettre à jour « État courant » ici, et rien d'autre.
- Le livré se documente dans `docs/journal/2026-MM.md` (nouvelle section à la fin) avec une ligne
  dans `docs/journal/INDEX.md`, jamais dans ce fichier.
- Une règle qui ne vaut que pour certains fichiers va dans `.claude/rules/`, avec ses chemins.
