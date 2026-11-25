# Modifier à la voix, lot 1 : la séance en cours (25/11/2026, v3.181.0)

Cadrage : `jeffrey-app/docs/cadrage/PROTOCOLE_MODIFIER.md` (décisions de Yoann du 25/11/2026 : séance en
cours d'abord, toujours relu avec l'avant et l'après, puis « oui »).

## Actions (`agir`, relecture obligatoire)

| Action | Paramètres | Relecture (`resume`) |
|---|---|---|
| `modifier_seance` | `debut` (HH:MM, obligatoire) | « Corriger l'heure de début de la séance Upper A : 18:10 au lieu de 18:30 » |
| `corriger_serie` | `serie` (entier ≥ 1, obligatoire) ; `exercice` (nom dit, sinon l'exercice en cours) ; `jambe` (G/D, exercice jambe par jambe, obligatoire alors) ; `reps` (1 à 100) ou `secondes` (1 à 900) ; `kg` (0 à 500, pas pour un exercice en temps) ; `cochee` (booléen) ; au moins une valeur | « Corriger Rowing, série 2 : 10 à 50 kilos au lieu de 8 à 60 kilos » ; « …, 8 à 60 kilos, décochée » |

- `verifier: true` → `{ ok, resume, jeton }` (pas de `question`) ; `verifier: false` avec le jeton → la
  vérification est refaite sur le brouillon du moment ; si `resume` a changé : `{ fait: false, raison }`.
- Écrit : `{ fait: true, resume: "Heure de début corrigée, Monsieur." | "Série corrigée, Monsieur." }`.
- `besoin` possibles : `debut`, `serie`, `exercice`, `jambe`, `valeur`, `reps`, `secondes`.
- Refus : aucune séance en cours, heure à venir, rien ne change, série absente (« Rowing n'a que 3 séries »),
  valeurs hors bornes, exercice inconnu ou ambigu (`choix`).

## Hors du lot 1

La date de la séance (le carnet ouvert la réécrirait), les séances passées, les repas, les mesures d'un
jour : lots suivants du cadrage.

## Lots 2 et 3 (v3.182.0) : un aliment, les mesures d'un jour

`jour` : `aujourdhui` (défaut), `hier` ou `AAAA-MM-JJ` des 7 derniers jours ; jamais un jour à venir.

| Action | Paramètres | Relecture (`resume`) |
|---|---|---|
| `modifier_aliment` | `aliment` ; `repas?` ; `grammes?` (1 à 2000) et/ou `vers_repas?` | « Corriger Riz basmati, cuit du déjeuner d'aujourd'hui : 150 g au lieu de 200 g » |
| `retirer_aliment` | `aliment` ; `repas?` | « Retirer Yaourt nature, 125 g, du goûter d'aujourd'hui » |
| `corriger_poids` | `kg` (40 à 200) ou `effacer: true` | « Corriger le poids du vendredi 2 octobre : 93,2 kg au lieu de 93,5 kg » ; refus si pesée de la balance |
| `corriger_genou` | `douleur` (0 à 10) + `retour_base` (au-dessus de 0), ou `effacer: true` | « Corriger le genou d'hier : 3 sur 10, revenu à la base, au lieu de 5 sur 10 » |
| `corriger_eau` | `ml` (0 à 6000, total du jour) | « Corriger l'eau d'aujourd'hui : 1500 ml au lieu de 1250 ml » |
| `corriger_note` | `texte` ou `effacer: true` | « Remplacer la note d'aujourd'hui par « … » ; elle disait « … » » |

- Écrit : `{ fait: true, resume: "C'est corrigé dans PROTOCOLE" }` (genou et poids : leur phrase habituelle).
- `besoin` possibles : `aliment`, `repas` (même aliment à plusieurs repas), `valeur`, `kg`, `douleur`,
  `retour_base`, `ml`, `texte` ; `choix` : noms exacts d'aliments différents.

