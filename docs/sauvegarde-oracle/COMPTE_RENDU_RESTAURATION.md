# Compte rendu à la session Oracle : sauvegarde et restauration testées depuis l'app

> De la session PROTOCOLE, le 2 novembre 2026. Aucune clé ni aucune donnée de santé dans ce
> document. Rien n'a été modifié côté Oracle.

## En bref

**Le contrat fonctionne de bout en bout, sur le téléphone de Yoann (Samsung S25), avec la vraie
clé et le vrai serveur.** Envoi, liste, lecture d'une copie et restauration complète ont réussi.
Après restauration, les données de l'app sont identiques à l'octet près à celles d'avant l'envoi.
Aucune déviation du contrat n'a été nécessaire.

## Côté app (pour mémoire)

- Version **3.149.0**, commit `5631e68` sur la branche `dev` de `protocole-app`.
- Requêtes faites par le client HTTP natif d'Android (`HttpURLConnection`), TLS vérifié
  normalement, aucun contrôle désactivé. Pas de CORS. Délais : 15 s pour la connexion, 40 s pour
  la lecture.
- Envoi : `PUT /v1/backup`, `Content-Type: application/json`, `X-Backup-Slot` = `matin`, `14h`,
  `23h` ou `manuel`. Le corps est l'export de l'app (`{ app: "PROTOCOLE", schema: 1, exportedAt,
  data }`), compact, **sans aucune clé secrète** (vérifié par un test automatique et sur la copie
  réelle).
- **Jamais de reprise automatique** : si un envoi échoue (réseau, 429, 503…), l'app note l'erreur
  et attend le créneau suivant. Cela respecte la limite de 6 envois par minute et évite les
  doublons, puisque le PUT n'est pas idempotent.
- Restauration : `GET /v1/backup` (liste), puis `GET /v1/backup/{id}`. L'app vérifie
  `app == "PROTOCOLE"` et un objet `data` avant d'écrire quoi que ce soit. Deux taps sont
  nécessaires pour confirmer.
- L'app n'utilise ni `/v1/backup/latest` ni `/v1/health` pour l'instant.
- Le journal Android n'écrit que la méthode, le chemin et le code de réponse : jamais la clé,
  jamais le contenu.
- La clé a été posée dans l'app par Yoann lui-même.

## Ce qui s'est passé (heure de Paris, 2 novembre 2026)

| Heure | Requête | Réponse | Ce que c'était |
|---|---|---|---|
| 10:06:19 | `PUT /v1/backup` (slot `manuel`) | **201** | Premier envoi réel, par Yoann (« Sauvegarder maintenant »). Copie de 789 990 octets. |
| 10:07:15 | `GET /v1/backup` | **200** | Vérification par la session PROTOCOLE : une copie dans la liste. |
| 10:07:15 | `GET /v1/backup/c1fcabcbbf6a4cd98a35108bb0a29d9a` | **200** | Copie relue : `app` = PROTOCOLE, 32 clés de données, aucune clé secrète, historique de poids identique à celui du téléphone. |
| 10:17:34 | `PUT /v1/backup` (slot `manuel`) | **201** | Deuxième envoi, juste avant le test de restauration. |
| 10:17:5x | `GET /v1/backup` | **200** | La liste montre deux copies (10:17 et 10:06, 0,8 Mo chacune), la plus récente d'abord. |
| 10:18:01 | `GET /v1/backup/dc5d4b857b7643808eeca064a367278f` | **200** | Restauration de la copie de 10:17. |

Six requêtes au total. Aucune 401, 429, 413 ni 503.

## Méthode du test de restauration

1. Une copie de secours locale des données du téléphone a été prise sur le Mac. Elle a été
   supprimée une fois le test réussi.
2. Envoi d'une copie (10:17), puis relevé d'une **empreinte SHA-256 de chacune des 38 données**
   stockées dans l'app (hors clés secrètes et hors position du téléphone, qui ne sont jamais
   exportées).
3. Restauration de cette même copie **par les vrais boutons de l'écran Réglages** :
   « Restaurer depuis le serveur », choix de la copie, confirmation en deux taps. L'app a
   appliqué la copie puis a redémarré (rechargement constaté).
4. Nouveau relevé des empreintes et comparaison.

## Résultat

- **38 données sur 38 identiques à l'octet près** après restauration ; aucune perdue, aucune
  ajoutée.
- **Les quatre clés secrètes sont restées en place** sur le téléphone (IA, LiteLLM, voix,
  sauvegarde) : la restauration ne les touche pas, et elles ne sont pas dans la copie.
- Le réveil de sauvegarde suivant (14 h) était toujours programmé après le redémarrage.

## Ce qui reste à vérifier côté app

- Les envois automatiques de **14 h** et **23 h**, app fermée (réveil exact Android → page sans
  écran → service au premier plan le temps de l'envoi). Le premier est prévu aujourd'hui à 14 h.
- La copie du **matin**, envoyée juste après le brief de Jeffrey (demain matin).
- Une restauration sur un **téléphone vierge** (scénario de perte du téléphone) : pas testée.

## État du serveur après le test

Deux copies réelles de Yoann (10:06 et 10:17, slot `manuel`), à garder : ce ne sont pas des
copies de test. Elles comptent normalement dans les 21 dernières.

## Pas de demande d'évolution

Rien à changer côté serveur pour l'instant. Une idée pour plus tard, seulement si Yoann le
souhaite : la copie quotidienne vers Oracle Object Storage, déjà évoquée, pour ne pas dépendre
d'une seule machine.
