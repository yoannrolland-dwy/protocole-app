# Pont PROTOCOLE → JEFFREY : nouveau code d'erreur `restauration` (11/11/2026, PROTOCOLE v3.159.0)

À reprendre par la session JEFFREY (dépôt `jeffrey-app`). Rien n'a été modifié côté JEFFREY.

## Ce qui change dans le contrat
- Nouveau code court dans la réponse d'erreur (`what = 2`, Bundle `{ id, ok = false, erreur }`) :
  **`restauration`**.
- Sens : une restauration de sauvegarde vient d'avoir lieu dans PROTOCOLE. Pendant 15 s au plus
  (jusqu'au redémarrage de l'app), plus rien n'est écrit. **Rien n'a été fait** : réessayer dans
  quelques secondes.
- Opérations concernées : `agir` (relecture `verifier: true` comprise, le jeton n'est pas écrit),
  `analyse`, `brief_fait`. Si la restauration commence pendant l'opération, son résultat est
  écarté et le code est rendu à la place : jamais `fait: true`.
- `version` et `lire` ne sont pas concernées (aucune écriture).
- Le service Android relaie le code tel quel ; liste des codes dans `packages/core/src/coach/bridge.js`
  (`BRIDGE_ERRORS`).

## Ce que JEFFREY fait aujourd'hui, sans changement
Il reçoit `ok: false` : il ne peut donc pas annoncer un succès. Il ne connaît pas le code et le
traite comme une erreur générique.

## À faire côté JEFFREY (proposition, non faite)
- Dire en clair : « PROTOCOLE restaure une sauvegarde, je réessaie dans un instant. »
- Réessayer une fois après quelques secondes, ou proposer de réessayer, sans rejouer une action déjà
  confirmée si la seconde tentative renvoie autre chose qu'un succès.
- Ajouter `restauration` au catalogue des erreurs (notes G3 / G4).
