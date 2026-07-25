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

**PROTOCOLE** : PWA (Progressive Web App) personnelle de suivi sport/
nutrition/récupération. Un seul utilisateur (moi), pas de compte, pas de
backend — toutes les données vivent dans le `localStorage` du navigateur,
sur mon téléphone (Samsung S25).

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

### Structure des fichiers
```
protocole-app/
  index.html
  vite.config.js        # React + Tailwind v4 + PWA
  package.json / package-lock.json
  public/                # icônes PWA (icon-192, icon-512, maskable, apple-touch)
  src/
    main.jsx             # point d'entrée + enregistrement service worker
    App.jsx              # TOUT le code applicatif (~1900 lignes, un seul fichier)
    store.js             # persistance localStorage + export/import JSON
    index.css            # @import "tailwindcss" + resets minimaux
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

- **6 onglets** : Tableau de bord, Poids, Sommeil, Séances, Genou, Macros
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
- **Minuteur** dans le carnet : repos réglable (chips 2:00/1:30/1:00/0:45/
  0:30 — PAS de 2:30, retiré volontairement pour tenir sur une ligne), bip
  sonore (Web Audio, 3 impulsions) + vibration en fin de décompte, pastille
  flottante visible **seulement pendant le décompte** (jamais épinglée en
  permanence — ça gênait le scroll, corrigé exprès).
- **Genou** : log douleur 0-10 (défaut pré-sélectionné = **5**, pas 2) +
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
- **Macros** : protéines/glucides/lipides/fibres, cibles par défaut
  **215/210/100/30 g**, graphique 14 jours en **calories** (pas protéines —
  changé exprès). Eau en boutons rapides (+250/+500 ml, PAS de saisie
  manuelle pour l'eau — décision explicite). Cible eau **+1 L automatique
  les jours où une séance Basket est loggée** (je transpire beaucoup au
  basket).
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
- **Dates + suppression** sur les 5 onglets de saisie (Poids, Sommeil,
  Séances, Genou, Macros) — sélecteur de date avec pré-remplissage si la
  date a déjà une entrée, bouton Supprimer conditionnel.
- **Réglages (⚙)** : export/import JSON (Réglages → Exporter/Importer),
  champ clé API Anthropic + modèle pour le Coach IA.

### Coach IA — contrat exact (ne pas simplifier sans le signaler)
- Appel direct à `https://api.anthropic.com/v1/messages` depuis le
  navigateur avec la clé API saisie par l'utilisateur (stockée en local
  uniquement), header `anthropic-dangerous-direct-browser-access: true`.
- `max_tokens: 6000` — volontairement haut car le modèle peut consommer du
  budget en amont du texte visible ; on a eu des "réponses vides" et des
  troncatures avec des valeurs plus basses (1000 → 1800 → 4096 → 6000).
- Le prompt envoie systématiquement : un bloc **temps réel** (hier vs
  aujourd'hui : poids, sommeil, macros/eau en cours, séances, douleur
  genou), un **résumé 14 jours** (moyennes), un **dataset fusionné jour par
  jour** (poids + kcal + macros + fibres + eau, pour que le modèle corrèle
  lui-même poids et apports plutôt que de deviner), et les données brutes
  de séances/sommeil/genou.
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

## Règles absolues à ne jamais casser

1. **Ne jamais changer les clés localStorage** (`weightLog`, `sleepLog`,
   `trainingLog`, `kneeLog`, `macroLog`, `noteLog`, `targets`, `phase`,
   `hsrWeek`, `apiKey`, `model` — préfixées `protocole:` dans `store.js`)
   sans écrire une migration. Casser une clé = perdre l'historique de
   l'utilisateur, ce qui est la pire chose possible ici.
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
6. **Pas d'import "coller depuis MyFitnessPal"** ni d'automatisation
   partielle des macros — proposé puis explicitement refusé. La seule voie
   de synchro macro/santé validée est l'objectif Capacitor + Health Connect
   ci-dessous, pas d'étape intermédiaire de ce type.

## Workflow de déploiement (déjà en place, ne pas en proposer un autre)

- Dépôt GitHub : `yoannrolland-dwy/protocole-app`, branche `main`.
- Dossier local : `/Users/yrolland/Documents/GitHub/protocole-app`.
- **Netlify est connecté en Continuous Deployment à ce dépôt** : chaque
  `git push` sur `main` déclenche automatiquement un rebuild + redéploiement
  sur le site existant (Build command: `npm run build`, Publish directory:
  `dist`).
- Client Git utilisé par l'utilisateur : **GitHub Desktop** (interface
  graphique, pas de ligne de commande Git manuelle) — mais si Claude Code
  gère lui-même git add/commit/push directement, c'est very bien aussi et
  probablement plus fluide que de repasser par GitHub Desktop à la main.
- Sauvegarde des données utilisateur = export JSON manuel (Réglages →
  Exporter), à ne jamais oublier de rappeler avant une mise à jour
  importante — GitHub ne contient que le code, jamais les données perso.

## Objectif futur (prochain gros chantier, pas urgent)

**Passer à Capacitor** pour deux raisons combinées :
1. **Minuteur fiable en toutes circonstances** — actuellement en PWA pure,
   le minuteur du carnet de muscu n'est fiable que si l'app reste ouverte à
   l'écran ; écran verrouillé/app en arrière-plan, le décompte et le bip ne
   sont pas garantis (limite du web, pas un bug). Capacitor + notifications
   locales natives réglerait ça (Android 12+ nécessite la permission
   SCHEDULE_EXACT_ALARM).
2. **Lecture automatique de Health Connect** pour macros, fibres, sommeil,
   etc. — MyFitnessPal écrit officiellement ses résumés de repas dans
   Health Connect (Android, activé dans l'app MFP), et Samsung Health y lit/
   écrit aussi. Mais Health Connect est une API Android **native**,
   totalement inaccessible depuis un navigateur/PWA. Il faut que l'app
   devienne une vraie app Android (via Capacitor) pour pouvoir demander la
   permission de lecture Health Connect et pré-remplir automatiquement les
   onglets Macros/Sommeil.

Les deux objectifs pointent vers la même solution technique (Capacitor),
donc ça vaut le coup de les traiter ensemble le jour où on s'y attaque.
Prérequis déjà remplis : Node.js installé sur le Mac, Xcode/Android Studio
restent à installer le moment venu. Le plugin Capacitor exact pour Health
Connect n'a pas encore été choisi/vérifié — à rechercher sérieusement au
moment de démarrer ce chantier plutôt que de supposer un nom de paquet.

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
