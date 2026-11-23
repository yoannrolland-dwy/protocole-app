# Pont PROTOCOLE → JEFFREY : repas détaillés, lecture d'un jour et d'une période (23/11/2026, PROTOCOLE v3.178.0)

À reprendre par la session JEFFREY (dépôt `jeffrey-app`, outil `protocole_lire`). Rien n'a été modifié
côté JEFFREY. Lecture seule, additive : aucun champ ni comportement existant ne change, aucune écriture.
Version du pont inchangée (`pont: 1`). Code : `packages/core/src/coach/bridgeHistory.js`, branché dans
`buildReading` (`packages/core/src/coach/bridge.js`) ; tests `packages/core/test/bridgeHistory.test.mjs`.

## Pourquoi
À 9 h, Jeffrey a dit « déjà mangé plus de 3 000 kcal » : `consomme` est le total de tout ce qui est
SAISI aujourd'hui, et Yoann saisit ses repas à l'avance (parfois plusieurs jours) puis les corrige.
Yoann veut aussi que Jeffrey puisse lire tout l'historique et le futur prévu, par jour ou par période,
avec les totaux et moyennes calculés par PROTOCOLE.

## Contrat
Toujours l'opération `lire`, réponse `{ date, regles, faits, manque }` (`date` = aujourd'hui).

| Question | Nouveau |
|---|---|
| `lire { sujet: "macros" }` | `faits.par_repas` et `faits.total_passe_ou_en_cours` en plus (tous les autres champs identiques, même ordre) |
| `lire { sujet: "jour", date: "AAAA-MM-JJ" }` | un jour passé, aujourd'hui ou futur ; `date` absente = aujourd'hui |
| `lire { sujet: "periode", du: "AAAA-MM-JJ", au: "AAAA-MM-JJ" }` | bornes comprises, 366 jours au plus |

- Erreur `inconnu` : date invalide (format, 30 février…), `au` avant `du`, `du`/`au` manquant, plus de
  366 jours. Aucun nouveau code d'erreur.
- Taille : une année pleine ≈ 99 000 caractères (mesuré sur données fictives), sous la limite de 200 000.
- `manque` : pour `jour`, seulement si la date est aujourd'hui (nuit, pesée, genou du jour) ; sinon `[]`.
  Pour `periode`, toujours `[]`.
- `regles` : `macros`, `jour` et `periode` gagnent la règle « REPAS » (saisi ≠ mangé, sens de `moment`) ;
  `jour` et `periode` gagnent la règle « HISTORIQUE ». Les autres sujets ont exactement les mêmes règles.

### `par_repas` (macros et jour)
Objet, une clé par repas saisi (repas vides absents), dans l'ordre de l'app :
`pretraining`, `petitdej`, `dejeuner`, `gouter`, `diner`, `posttraining`, `autre` (= « Extra »).
Chaque repas : `libelle`, `moment`, `horaire`, `kcal`, `proteines`, `glucides`, `lipides`, `fibres`,
`aliments` (« nom quantité g »), et `incomplet` (liste des macros dont un aliment n'a pas la valeur)
seulement s'il y a lieu. Corrections d'aliments appliquées (mêmes chiffres que l'onglet Repas).

`moment` :
- jour passé → `fait` ; jour futur → `prevu` ;
- aujourd'hui, d'après les horaires de Yoann (23/11/2026) : petit-déjeuner avant 10 h ; déjeuner
  12 h-14 h ; goûter 16 h-17 h ; dîner 19 h-20 h → `a_venir` avant le début, `en_cours` dans la plage,
  `passe` à partir de l'heure de fin (14:00 → déjeuner `passe`) ;
- pré-training, post-training, Extra → `sans_horaire` (`horaire: null`).

`total_passe_ou_en_cours` (aujourd'hui seulement) : somme des repas `passe` ou `en_cours`. Les repas
`sans_horaire` n'y sont pas.

### `jour` → `faits`
`date`, `jour_semaine`, `statut_jour` (`passe` | `aujourdhui` | `futur`), `heure` (aujourd'hui
seulement), `total_saisi` (total de l'onglet Macros, ou somme des repas ; `null` si rien), `par_repas`,
`total_passe_ou_en_cours` (aujourd'hui), `alcool_g` (si > 0), `cible` (cibles en vigueur ce jour-là ;
eau +1 L un jour de basket fait, règle de l'app).
- Passé et aujourd'hui seulement : `eau_ml`, `pas`, `sommeil_nuit_precedente` (`heures`, `qualite`,
  `score`), `sieste_min`, `poids_kg`, `genou` (`douleur`, `base_ok`), `fc_repos`, `note`,
  `seances_faites` (`type`, `debut`, `duree_min`, `rpe` s'ils existent, `exercices` : `nom`, `unite`
  `repetitions`|`secondes`, `par_jambe` éventuel, `series` : `poids_kg`, `val`, `fait`, `jambe` éventuel).
- Aujourd'hui et futur seulement : `prevu` = `basket` (`match` | `entrainement` | `null`, d'après le
  calendrier du basket), `planning_ideal` (familles du planning hebdomadaire : un repère de Yoann, pas
  une séance programmée), `recommandeur` (aujourd'hui et demain seulement, même forme que
  `sport_du_jour.aujourdhui` / `.demain`).

### `periode` → `faits`
`du`, `au`, `nb_jours`, `jours_passes`, `calcul` (phrase qui rappelle la règle), `totaux_et_moyennes`,
`jours`.
- `totaux_et_moyennes` : calculés sur les jours PASSÉS de la période seulement (aujourd'hui en cours et
  futur exclus). Chaque mesure = `{ moyenne, total?, min, max, jours }` (`jours` = jours où elle existe),
  ou `null` sans donnée : `kcal`, `proteines`, `glucides`, `lipides`, `fibres` (avec total), `eau_ml`,
  `pas` (avec total), `sommeil_h`, `sommeil_qualite`, `poids_kg` (+ `premier`, `dernier`, `variation`),
  `genou` (+ `jours_hors_base`), `fc_repos`, `seances` (`total`, `par_type`), `alcool_g_total` (si > 0).
- `jours` : une ligne par jour, futur compris : `date`, `jour`, `statut`, puis seulement ce qui existe
  (`kcal`, `proteines`, `glucides`, `lipides`, `fibres`, `eau_ml`, `pas`, `sommeil_h`,
  `sommeil_qualite`, `poids_kg`, `genou`, `genou_hors_base`, `fc_repos`, `seances` ; futur :
  `basket_prevu`, `planning_ideal`).

## Exemples (valeurs fictives, produites par le vrai code ; aujourd'hui = 23/11/2026, 9 h)

`lire { sujet: "macros" }`, extrait des nouveaux champs :
```json
{
  "par_repas": {
    "petitdej": { "libelle": "Petit-déjeuner", "moment": "en_cours", "horaire": "avant 10 h", "kcal": 424, "proteines": 30.4, "glucides": 56, "lipides": 6, "fibres": 8, "aliments": ["Flocons d'avoine 80g", "Skyr 200g"] },
    "dejeuner": { "libelle": "Déjeuner", "moment": "a_venir", "horaire": "12 h-14 h", "kcal": 565, "proteines": 55.5, "glucides": 70, "lipides": 4.8, "fibres": 1, "aliments": ["Poulet 200g", "Riz 250g"] },
    "diner": { "libelle": "Dîner", "moment": "a_venir", "horaire": "19 h-20 h", "kcal": 690, "proteines": 69, "glucides": 84, "lipides": 5.9, "fibres": 1.2, "aliments": ["Poulet 250g", "Riz 300g"] }
  },
  "total_passe_ou_en_cours": { "kcal": 424, "proteines": 30.4, "glucides": 56, "lipides": 6, "fibres": 8 }
}
```

`lire { sujet: "jour", date: "2026-11-22" }` (jour passé), `faits` :
```json
{
  "date": "2026-11-22", "jour_semaine": "dimanche", "statut_jour": "passe",
  "total_saisi": { "kcal": 544, "proteines": 58.4, "glucides": 48, "lipides": 9.6, "fibres": 8 },
  "par_repas": {
    "petitdej": { "libelle": "Petit-déjeuner", "moment": "fait", "horaire": "avant 10 h", "kcal": 304, "proteines": 10.4, "glucides": 48, "lipides": 5.6, "fibres": 8, "aliments": ["Flocons d'avoine 80g"] },
    "diner": { "libelle": "Dîner", "moment": "fait", "horaire": "19 h-20 h", "kcal": 240, "proteines": 48, "glucides": 0, "lipides": 4, "fibres": 0, "aliments": ["Poulet 200g"] }
  },
  "cible": { "kcal": 2470, "proteines": 215, "glucides": 205, "lipides": 80, "fibres": 35, "eau_ml": 2000 },
  "eau_ml": 2100, "pas": 13100,
  "sommeil_nuit_precedente": { "heures": 6.1, "qualite": 4, "score": 91 },
  "sieste_min": null, "poids_kg": 93.6, "genou": { "douleur": 2, "base_ok": true }, "fc_repos": 51, "note": null,
  "seances_faites": [
    { "type": "Upper B", "debut": "18:05", "exercices": [
      { "nom": "Développé haltères", "unite": "repetitions", "series": [{ "poids_kg": 30, "val": 10, "fait": true }, { "poids_kg": 30, "val": 9, "fait": true }] },
      { "nom": "Gainage", "unite": "secondes", "series": [{ "poids_kg": 0, "val": 60, "fait": true }] }
    ] }
  ]
}
```

`lire { sujet: "jour", date: "2026-11-25" }` (jour futur), `faits` :
```json
{
  "date": "2026-11-25", "jour_semaine": "mercredi", "statut_jour": "futur",
  "total_saisi": { "kcal": 565, "proteines": 55.5, "glucides": 70, "lipides": 4.8, "fibres": 1 },
  "par_repas": {
    "dejeuner": { "libelle": "Déjeuner", "moment": "prevu", "horaire": "12 h-14 h", "kcal": 565, "proteines": 55.5, "glucides": 70, "lipides": 4.8, "fibres": 1, "aliments": ["Poulet 200g", "Riz 250g"] }
  },
  "cible": { "kcal": 2470, "proteines": 215, "glucides": 205, "lipides": 80, "fibres": 35, "eau_ml": 2000 },
  "prevu": { "basket": "entrainement", "planning_ideal": ["Mobilité", "Basket"] }
}
```

`lire { sujet: "periode", du: "2026-11-21", au: "2026-11-25" }`, `faits` :
```json
{
  "du": "2026-11-21", "au": "2026-11-25", "nb_jours": 5, "jours_passes": 2,
  "calcul": "totaux et moyennes sur les jours passés de la période (aujourd'hui et le futur exclus) ; « jours » = jours où la mesure existe",
  "totaux_et_moyennes": {
    "kcal": { "moyenne": 1562, "total": 3124, "min": 544, "max": 2580, "jours": 2 },
    "proteines": { "moyenne": 116.7, "total": 233.4, "min": 58.4, "max": 175, "jours": 2 },
    "glucides": { "moyenne": 154, "total": 308, "min": 48, "max": 260, "jours": 2 },
    "lipides": { "moyenne": 42.3, "total": 84.6, "min": 9.6, "max": 75, "jours": 2 },
    "fibres": { "moyenne": 18, "total": 36, "min": 8, "max": 28, "jours": 2 },
    "eau_ml": { "moyenne": 2350, "min": 2100, "max": 2600, "jours": 2 },
    "pas": { "moyenne": 11250, "total": 22500, "min": 9400, "max": 13100, "jours": 2 },
    "sommeil_h": { "moyenne": 5.9, "min": 5.6, "max": 6.1, "jours": 2 },
    "sommeil_qualite": { "moyenne": 3.5, "min": 3, "max": 4, "jours": 2 },
    "poids_kg": { "premier": 93.9, "dernier": 93.6, "variation": -0.3, "moyenne": 93.8, "min": 93.6, "max": 93.9, "jours": 2 },
    "genou": { "moyenne": 2, "min": 2, "max": 2, "jours": 1, "jours_hors_base": 0 },
    "fc_repos": { "moyenne": 51, "min": 51, "max": 51, "jours": 1 },
    "seances": { "total": 1, "par_type": { "Upper B": 1 } }
  },
  "jours": [
    { "date": "2026-11-21", "jour": "samedi", "statut": "passe", "kcal": 2580, "proteines": 175, "glucides": 260, "lipides": 75, "fibres": 28, "eau_ml": 2600, "pas": 9400, "sommeil_h": 5.6, "sommeil_qualite": 3, "poids_kg": 93.9 },
    { "date": "2026-11-22", "jour": "dimanche", "statut": "passe", "kcal": 544, "proteines": 58.4, "glucides": 48, "lipides": 9.6, "fibres": 8, "eau_ml": 2100, "pas": 13100, "sommeil_h": 6.1, "sommeil_qualite": 4, "poids_kg": 93.6, "genou": 2, "fc_repos": 51, "seances": ["Upper B"] },
    { "date": "2026-11-23", "jour": "lundi", "statut": "aujourdhui", "kcal": 1679, "proteines": 154.9, "glucides": 210, "lipides": 16.7, "fibres": 10.2 },
    { "date": "2026-11-24", "jour": "mardi", "statut": "futur" },
    { "date": "2026-11-25", "jour": "mercredi", "statut": "futur", "kcal": 565, "proteines": 55.5, "glucides": 70, "lipides": 4.8, "fibres": 1, "basket_prevu": "entrainement", "planning_ideal": ["Mobilité", "Basket"] }
  ]
}
```

## Côté JEFFREY (à faire dans sa session)
- `protocole_lire` : accepter `date` (sujet `jour`) et `du`/`au` (sujet `periode`), et transmettre ces
  champs tels quels dans le JSON de `lire`. Jeffrey convertit « hier », « cette semaine », « le mois
  dernier » en dates avant d'appeler.
- Utiliser `par_repas` / `moment` / `total_passe_ou_en_cours` pour dire « saisi » ou « prévu » plutôt
  que « mangé ».

## Pas vérifié
- Aucun appel réel depuis JEFFREY sur le téléphone : la v3.178.0 n'est ni commitée ni installée.
