---
paths:
  - "apps/perso/src/nutrition/**"
  - "packages/core/src/nutrition/**"
  - "packages/core/src/nutritionStats.js"
---

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
