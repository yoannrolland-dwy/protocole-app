# Jeton des gestes de séance : contrat implémenté dans PROTOCOLE (12/11/2026, v3.162.0)

Pour la session JEFFREY. Plan d'origine : `jeffrey-app/docs/cadrage/PLAN_JETON_GESTES_SEANCE.md`.
**Préparé en local seulement** : rien de poussé, rien d'installé sur le S25. Rien à changer côté
JEFFREY pour garder le comportement actuel.

## Op `agir`, gestes `noter_serie`, `annuler_serie`, `aller_a`, `exercice_suivant`, `repos`

| Appel | Réponse |
|---|---|
| `verifier: true` | `{ ok: true, resume, immediat: true, jeton }`. Rien n'est écrit dans la séance ; seul le jeton est gardé (clé `jeffreyAgir`, hors données, 3 min, 5 au plus). Refus de la règle : inchangé, `{ fait: false, raison, choix?, besoin? }`, sans jeton. Jeton impossible à enregistrer : `{ fait: false, raison: "la relecture n'a pas pu être gardée (stockage) : rien n'a été écrit" }`. |
| `verifier: false`, **clé `jeton` présente** (quelle que soit sa valeur : `""`, `null`, nombre, texte inconnu…) | Jamais de repli vers le geste immédiat. Le jeton est retiré d'abord, qu'il soit valable ou non (usage unique). Jeton vide, inconnu, périmé, déjà utilisé, ou autres paramètres (autre action, autre valeur dite) : `{ fait: false, raison: "rien n'a été relu à Monsieur pour ce geste (…) : rien n'a été écrit ; relisez-le d'abord" }`. Sinon, le geste est recalculé sur la séance du moment. Si la règle refuse maintenant : `{ fait: false, raison: "la séance a changé depuis la relecture : <raison> ; rien n'a été écrit" }` (sans `choix` ni `besoin` : il faut relire). Si la cible diffère : `{ fait: false, raison: "la séance a changé depuis la relecture (…) : rien n'a été écrit ; relisez à Monsieur : <nouvelle phrase>" }`. Sinon le geste est écrit, réponse identique au geste immédiat : `{ fait: true, resume, record?, plateau? }`. |
| `verifier: false`, **sans clé `jeton`** | Inchangé : écrit tout de suite. |
| Restauration en cours | Inchangé : `{ ok: false, erreur: "restauration" }` (avant tout calcul). |

Le JEFFREY installé (`7e5e583`) n'envoie la clé `jeton` qu'à l'écriture et seulement s'il en a un
(`ProtocoleAction.json`) : ses gestes immédiats ne changent pas.

## Cible liée au jeton

Toujours l'identité de la séance : `type`, `date`, `start`, `editingId`.

| Geste | Cible comparée |
|---|---|
| `noter_serie` | exercice (index et nom), série (index), jambe, série encore non faite, **et les valeurs qui seront écrites** (répétitions ou secondes, kilos — y compris les kilos préremplis quand Monsieur n'en dit pas) |
| `annuler_serie` | série notée à la voix visée (index, nom), son état actuel et son état d'avant |
| `aller_a`, `exercice_suivant` | exercice de départ (celui de la série en cours) et exercice d'arrivée |
| `repos` `lancer` | exercice dont le repos est lancé et sa durée (l'effet ne dépend pas d'un minuteur déjà en cours) |
| `repos` `plus30`, `pause`, `reprendre`, `stop` | le minuteur visé : en cours ou non, heure de fin s'il tourne, reste s'il est arrêté, durée, exercice. Un minuteur remplacé (nouvelle série cochée) a une autre heure de fin, donc refus. |

Ni `rev` ni le décompte n'entrent dans la cible d'une série : un repos qui s'écoule, se termine,
démarre ou s'arrête entre la relecture et le « oui » ne fait pas refuser une série inchangée.

Écart au plan, pour la session JEFFREY : pour `repos` `lancer`, « minuteur en cours ou non » n'est pas
comparé (relancer donne le même effet dans les deux cas ; sinon la fin naturelle d'un repos ferait
refuser). Pour les autres actions de repos, l'heure de fin du minuteur s'ajoute à « en cours ou non »,
pour reconnaître un minuteur remplacé. `BRIDGE_VERSION` reste à 1 : la prise en charge se reconnaît
à la présence du `jeton` dans la relecture, comme prévu.

## Vérifié (local, données fictives)

`apps/perso/test/jeffreyGestureToken.test.mjs`, 17 tests ; 328 tests au total, tous verts. Pas
d'essai sur le téléphone.
