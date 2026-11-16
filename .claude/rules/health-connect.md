---
paths:
  - "apps/perso/src/healthSync.js"
  - "packages/core/src/healthMerge.js"
---

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
