# RawCare — décisions produit

> Copie de la mémoire de projet de Claude (« project-public-version »), écrite entre le 04/08 et
> le 06/08/2026, au moment des décisions. Archivée telle quelle le 02/11/2026, à l'arrêt de la
> version publique. La feuille de route en 5 phases avait été publiée en page claude.ai le
> 05/08/2026 (« RawCare — Feuille de route ») ; elle n'apparaît plus dans la liste des pages de
> Yoann au 02/11/2026, ce document en garde l'essentiel.

Yoann envisage d'ouvrir PROTOCOLE (jusqu'ici strictement personnelle, voir CLAUDE.md) au grand
public, en plus de garder sa version perso. Discuté et tranché à partir du 04/08/2026, rien
encore implémenté à cette date (05/08/2026).

**Validation déjà obtenue** : ce n'est pas une idée en l'air — des pratiquants de sa salle
d'escalade et de son équipe de basket lui ont eux-mêmes demandé de sortir l'app publiquement.
Pas de kiné dans ce cercle. Ambition : pas de but lucratif affiché, mais ouvert à monétiser si
ça prend ("pas envie de devenir riche mais pourquoi pas").

**Positionnement (corrigé le 05/08/2026, à ne pas re-simplifier)** : PROTOCOLE/CARE n'est PAS
une "app pour tendinites". C'est un carnet de bord musculation + préparateur physique +
nutritionniste pour sportifs sérieux (muscu + autres sports, comme Yoann : basket, escalade).
La gestion intelligente de la douleur tendineuse est une capacité différenciante EN PLUS,
pas la raison d'être de l'app. Erreur de lecture initiale de Claude sur ce point, corrigée
explicitement par Yoann — n'y revenir qu'avec confirmation.

**Nom verrouillé : RawCare** (05/08/2026, décision finale après plusieurs itérations).
Historique : CARE seul repéré en premier (mot compréhensible FR/EN, acronyme naturel
**C**orps/**A**limentation/**R**écupération/**E**ntraînement — les quatre piliers de l'app,
dans l'ordre où Yoann les a lui-même décrits) mais écarté par prudence après une recherche web
ayant suggéré une possible marque déposée conflictuelle en France (santé/coaching
sportif/nutrition) — **résultat non fiable et jamais confirmé** (voir mise en garde ci-dessous),
mais assez de doute pour changer de nom plutôt que risquer. HardCare testé ensuite (jeu de mots
hardcore+care) mais Yoann voulait que "care" ressorte davantage. **RawCare retenu** : "raw"
(3 lettres, discret) laisse "CARE" dominant visuellement/phonétiquement, et le sens colle aux
trois piliers (raw lifting = musculation loyale, raw food = alimentation brute/CIQUAL, données
brutes/honnêtes = ton du design "Affirmée").
**Traitement typographique tranché** : `raw` toujours en petit/discret, `CARE` toujours en
énorme/accent citron, mais **RawCare reste UN seul bloc partout où c'est officiel** (titre Play
Store, mentions légales, nom de domaine) — jamais séparé en deux noms distincts (ex. proscrire
un titre de type "CARE - RawCare" sur une fiche store, qui réintroduirait "CARE" seul et
annulerait l'intérêt d'avoir changé de nom). Un sous-titre/description courte peut porter autre
chose ("Musculation, nutrition, récupération") sans redire CARE séparément.
**Vérification encore à faire avant tout engagement définitif (pas faite à ce stade)** : dépôt
de marque INPI (outil officiel : data.inpi.fr / inpi.fr, PAS une recherche web générique —
celle-ci s'est révélée non fiable, voir juste en dessous), disponibilité sur Play Store/App
Store, nom de domaine.
**Mise en garde méthodologique importante** : la vérification de marque déposée via WebSearch
générique s'est avérée non fiable le 05/08/2026 — un même numéro de fiche INPI (FR4817253) a
été cité par le résumé automatique comme preuve pour trois requêtes différentes ("CARE",
"SEUIL", "SOCLE") avec des listes de classes différentes à chaque fois, signe d'un résumé
halluciné plutôt que d'une lecture réelle de la fiche. Tentative de vérification directe via
WebFetch sur data.inpi.fr → 403 (bloqué). **Ne jamais présenter un résultat de WebSearch comme
une vérification de marque déposée fiable** — seule la recherche directe sur l'outil officiel
INPI (faite par un humain, formulaire interactif) fait foi. La recherche de noms d'app déjà
existants (Play Store/App Store) via WebSearch s'est en revanche montrée cohérente et fiable
(pas de contradiction observée) — c'est une vérification différente et valable, mais elle ne
remplace pas une recherche de marque.

**Architecture technique retenue** (voir aussi conversation du 04/08) : monorepo, cœur logique
partagé (`packages/core`), deux coquilles séparées `apps/perso` (inchangée, localStorage, sans
compte) et `apps/public` (CARE, comptes, backend). Coach IA : chaque utilisateur fournit sa
propre clé API Anthropic. Backend : plateforme managée type Supabase/Firebase.

**Décisions produit du 05/08/2026** :
- **Bêta = PWA uniquement**, pas de build natif ni Health Connect au lancement — juste un lien
  partagé au cercle de 5-10 testeurs déjà acquis, saisie 100% manuelle. Natif + Health Connect
  repoussés en V2, seulement si la bêta montre une vraie rétention (pas juste de l'enthousiasme
  de façade). Idée V2 notée : un réglage "toujours saisir à la main" même avec Health Connect
  connecté (override de l'écrasement automatique actuel).
- **Généralisation des zones de douleur** : pas de liste fermée de "tendinites courantes"
  codées en dur (Yoann n'est pas qualifié cliniquement pour des tendons qu'il n'a pas vécus,
  et c'est un vrai sujet de responsabilité). À la place : cadre configurable libre (nom de
  zone libre, paramètres HSR réglables par l'utilisateur), zéro zone par défaut, entièrement
  optionnel — beaucoup d'utilisateurs n'auront aucune douleur à suivre.
- **Sports** : passer des gabarits figés (Upper/Lower/Basket/Escalade) à une bibliothèque de
  sports sélectionnables, chaque sport taggé par type de charge (impact articulaire, tirage...)
  pour que le recommandeur généralise ses règles au lieu de nommer "Basket"/"Escalade" en dur.
  **Périmètre confirmé par Yoann (05/08/2026)** : musculation (prioritaire), basket, course à
  pied, vélo, escalade, foot (soccer) — 6 sports au total, scope suffisant pour le MVP plutôt
  qu'une bibliothèque ouverte à tout sport dès le départ (garder une case "autre" pour plus
  tard si besoin).
- **Escalade** : sélecteur de système de cotation (couleur par salle façon Arkose, ou échelle
  standard type Fontainebleau) au lieu d'une seule échelle figée.
- **Coach IA côté public** : sujet de responsabilité nommé (une IA qui commente la douleur d'un
  inconnu sans professionnel de santé dans la boucle) — pas encore tranché, prévoir un
  disclaimer et probablement reformuler le rôle du coach pour le public (moins "kiné", plus
  "aide au suivi").

**Modèle économique (tranché 05/08/2026)** : gratuit, pas de freemium ni d'abonnement pour la
bêta ni le lancement public — Yoann ne vise pas d'en vivre. Juste un lien de don libre
(Ko-fi/Buy Me a Coffee), zéro développement de facturation. Un abonnement simple pourrait être
envisagé plus tard SEULEMENT si l'usage dépasse largement le cercle initial et que les coûts
d'infra pèsent — décision à prendre avec de vraies données d'usage, pas maintenant.

**Légal (tranché 05/08/2026)** : minimum obligatoire seulement — mentions légales + politique
de confidentialité RGPD (données de santé = catégorie spéciale, étendre la `privacypolicy.html`
existante au stockage cloud multi-utilisateur), et un disclaimer clair sur le Coach IA ("ne
remplace pas un avis médical ou un kiné"). Pas de structure légale (micro-entreprise) tant qu'il
n'y a pas d'argent qui rentre.

**Bibliothèque d'exercices musculation (ouvert le 05/08/2026, en discussion)** : Yoann veut une
bibliothèque d'exercices sélectionnables pour bêta/public (PAS perso — ses gabarits actuels
restent la config par défaut, comme déjà pour sports/zones/escalade), et se demande si la
musculation devrait devenir un module à part (comme `src/nutrition/`), avec différents types de
séance (Upper/Lower déjà existant, + Full body, Bro split, etc.) auxquels la bibliothèque serait
rattachée. Recommandation de Claude : oui à un sous-système musculation cohérent qui réutilise
`training.js` (déjà pur/isolé) comme fondation et une bibliothèque d'exercices taggée (groupe
musculaire, pattern de mouvement, matériel, contrainte tendon) — mais PAS un silo isolé comme
Nutrition, parce que les séances muscu doivent continuer à alimenter le même `trainingLog` et le
même recommandeur unifié que les autres sports (c'est cette intelligence transverse qui fait la
valeur de l'app). Portée des "types de séance" sélectionnables : Claude a challengé Yoann
(comme demandé, voir (règle de travail « ne pas propager un changement par réflexe entre perso et public »)) sur le fait de scoper d'abord
sur des splits réellement demandés par le cercle bêta plutôt qu'un configurateur de split
entièrement libre — cohérent avec la méthode déjà appliquée aux sports/zones de douleur (liste
concrète scoping sur le réel, pas de généralisation spéculative). **Tranché le 05/08/2026** :
Upper/Lower (déjà existant), Full body, Bro split — 3 presets confirmés par Yoann, pas de
configurateur de split libre pour le MVP.

**Exigence produit verrouillée le 05/08/2026 : l'app doit rester 100% utilisable sans Coach
IA.** Vérifié dans le code de PROTOCOLE (pas supposé) : `apiKey` n'apparaît que dans le chemin
Coach IA (bouton "Analyser") et l'écran Réglages ; `callClaude` — seul appel réseau vers
Anthropic dans toute l'app — n'est invoqué qu'à un endroit, gardé par `if (!coach.apiKey)`.
Rien d'autre (recommandeur, TDEE, records, douleurs, macros) n'en dépend. Principe déjà
appliqué au Coach IA lui-même ("le JS calcule les faits, l'IA les juge") mais qui va plus loin
ici : la clé API doit être un vrai PLUS, jamais un prérequis.
**Conséquence directe pour RawCare** : un maximum d'intelligence doit passer par des moteurs de
décision déterministes dans `packages/core` (comme le recommandeur, le TDEE, la détection de
records, la règle de Silbernagel, la charge d'escalade) plutôt que par le Coach IA. S'applique
en particulier à la Phase 1 (généralisation du recommandeur, bibliothèque d'exercices/types de
séance, escalade des zones de douleur généralisées) : ces logiques doivent être conçues comme
des moteurs déterministes, jamais dépendantes d'une clé API.

**Brainstorm produit complet le 05/08/2026** — tous les grands sujets (nom/branding,
distribution bêta, modèle économique, légal, scope MVP, sports du cercle bêta, types de
séance) ont été tranchés. Il reste seulement : la vérification de marque "RawCare" par Yoann
(INPI/stores/domaine, hors du champ de Claude). Feuille de route complète en 5 phases publiée
en artifact le 05/08/2026 ("RawCare — Feuille de route").

**État technique au 06/08/2026 — Phase 0 ET Phase 1 (4 lots) livrées et poussées sur `dev`**
(voir CLAUDE.md pour le détail exact, section "Chantier RawCare", c'est la source de vérité
technique, pas ce fichier) :
- **Phase 0** (extraction `packages/core`, monorepo npm workspaces `apps/perso`/`apps/public`)
  : terminée en une session, zéro changement de comportement vérifié à chaque étape.
- **Phase 1, quatre lots livrés dans la foulée** (même session que Phase 0 + une session
  suivante, cette dernière poussée par Yoann en accès distant sans PC pour reprendre plus
  tard, d'où plusieurs lots enchaînés au lieu d'être étalés) :
  1. Sélecteur de cotation escalade (couleur de salle / Fontainebleau) + cibles macro de base
     éditables dans les Réglages.
  2. Catalogue de données taggé (exercices existants + `chargeTags`, `SPORTS_CATALOG`/
     `SESSION_TYPES_CATALOG` avec Course à pied/Vélo/Foot/Full body/Bro split) — jamais
     importé par `apps/perso`, sert de preuve que le modèle de données scale.
  3. Moteur du recommandeur (`recommendSessions`) généralisé par tag de charge plutôt que par
     nom de sport codé en dur — la pièce la plus risquée du chantier (code de sécurité qui
     protège les tendons de Yoann en ce moment), vérifiée par 18 scénarios de diff caractère
     près + capture avant/après du Coach IA.
  4. `zoneState`/`buildZones` (`packages/core/src/pain.js`) généralisés en cadre à N zones
     avec seuils Silbernagel réglables par zone (au lieu de "genou"/"coude" en dur), via
     `DEFAULT_ZONES` pour `apps/perso` — vérifié par diff caractère près sur 6 scénarios.
     Stockage `kneeLog`/`elbowLog` toujours pas migré (voir point ci-dessous, inchangé).
- **Ce qui reste, explicitement et délibérément repoussé** (documenté dans CLAUDE.md, pas à
  refaire découvrir à une future session) : stockage dynamique RÉEL des zones de douleur côté
  `apps/perso`/`apps/public` (passer de `kneeLog`/`elbowLog` figés à une clé arbitraire = 
  décision de migration de données, à prendre au calme — le MOTEUR sait déjà gérer N zones
  depuis le lot 4, seul le stockage reste figé) ; bibliothèque d'exercices avec un vrai
  système d'identité (au-delà du `n`/`nom` actuel, qui reste la clé de `DEFAULT_WEIGHTS`/
  `trainingLog`) ; activation du catalogue côté UI (picker, formulaire — n'a de sens qu'avec
  `apps/public`, Phase 2) ; rôle du Coach IA reformulé pour un public multi-utilisateur (pas
  de surface UI multi-tenant à date pour le tester). Ces points attendent tous, d'une manière
  ou d'une autre, que la Phase 2 (backend minimal, `apps/public` réel) existe pour avoir un
  vrai consommateur — probable prochaine étape technique. Quand la question de reprendre
  RawCare revient, redemander à Yoann s'il veut du code (comme Phase 1) ou du backend (Phase
  2, implique la création d'un projet Supabase/Firebase par lui, hors du champ de Claude).

**Note de session (05-06/08/2026)** : entre la planification RawCare et la Phase 0, une
longue série de petites améliorations a été livrée sur PROTOCOLE (v3.51.0 à v3.52.0 — édition
de recettes, cohérence des calories Repas/Macros, barre collante de navigation par jour).
Détail complet dans CLAUDE.md, pas dupliqué ici. Yoann veut séparer ce type de travail
(petites améliorations perso) des chantiers RawCare en sessions Claude Code distinctes
(`/clear` entre les deux) plutôt que de les mélanger dans un seul fil — préférence de travail
à respecter pour la suite (voir (une session par chantier)).

**Phase 2 terminée et `apps/public` en production (06/08/2026)** — même session que les
points ci-dessus, poursuivie jusqu'au déploiement réel. Dans l'ordre :
- Les 7 écrans de données (Poids/Sommeil/Pas/Séances/Douleurs/Macros/Repas) livrés — dont
  plusieurs jamais commités avant cette session malgré CLAUDE.md les documentant comme
  "livrés" (rattrapé par un commit dédié, voir plus bas).
- **Chantier onboarding** : `recommendSessions` généralisé de façon additive pour accepter
  des zones de douleur dynamiques (`zones` optionnel, `apps/perso` inchangé bit pour bit) ;
  écran `Onboarding.jsx` (sports limités aux 3 familles supportées par le recommandeur,
  zones limitées à 3 options guidées Genou/Coude/Autre — portée réduite validée avec Yoann,
  pas la vision "libre" originale de la feuille de route).
- **Chantier Coach IA public** : `buildCoachPrompt`/`buildCoachBriefing` généralisés pareil
  (découverte en chemin : sans ça, le prompt aurait affirmé à tort une tendinopathie à un
  utilisateur qui n'en suit aucune — pas un choix de portée, un prérequis de correction).
  Rôle gardé proche de l'original (coach + kiné + nutri + coach de vie) sur demande de
  Yoann, juste dépersonnalisé, disclaimer ajouté en UI permanente.
- **Socle légal** : `privacypolicy.html`/`mentionslegales.html` rédigés par Claude (pas une
  relecture juridique pro — suffisant pour bêta fermée gratuite, à revoir si le périmètre
  change).
- **Déploiement réel** : Yoann a choisi d'abandonner la PWA `apps/perso` (jamais utilisée
  pour de vraies données, seulement l'app native) et de réutiliser le site Netlify existant
  pour `apps/public` plutôt que d'en créer un nouveau — confirmé sans risque après
  vérification que `main.jsx` désenregistre déjà le service worker côté natif (zéro
  couplage). `netlify.toml` repointé. Premier déploiement en échec (bug npm connu sur les
  dépendances optionnelles : lockfile généré sur macOS sans le binaire natif Linux de
  Rolldown/Vite 8, `npm/cli#4828`) — corrigé par réinstallation complète, lockfile
  régénéré. **Second déploiement réussi, `apps/public` est en ligne.**
- **Rattrapage git** : un très gros backlog de travail jamais commité (remontant à plusieurs
  sessions avant celle-ci) a été découvert au moment de préparer le déploiement — tout
  commité et poussé en 5 commits groupés par chantier avant de fusionner sur `main`. Voir
  (confirmation avant chaque commit et avant chaque mise en production) : Yoann veut désormais une confirmation à chaque
  commit, séparée d'une confirmation avant tout passage en prod.

**Ce qui reste avant la Phase 3 (bêta réelle)** : rien côté produit/code — juste envoyer le
lien à son cercle déjà acquis (salle d'escalade + équipe de basket) et mesurer la rétention.
Toujours en attente, hors du champ de Claude : vérification de marque INPI pour "RawCare".
