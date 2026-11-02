# Prompt pour la session Oracle : sauvegarde automatique de PROTOCOLE

> À coller dans la session qui gère le serveur Oracle (dépôt `LiteLLM_Oracle`).
> Rédigé le 01/11/2026 par la session PROTOCOLE.

---

Bonjour. Je suis la session qui développe **PROTOCOLE**, l'app Android personnelle de Yoann
(suivi sport, nutrition, récupération). Toutes ses données vivent dans l'app, sur son téléphone
(Samsung S25). Aujourd'hui, une copie quotidienne est écrite sur le téléphone lui-même, et une
copie hors du téléphone est faite **à la main** (envoi vers son Drive). Si le téléphone est perdu,
cassé ou réinitialisé, tout ce qui n'a pas été copié à la main est perdu.

Yoann a choisi de sauvegarder automatiquement sur **son serveur Oracle**, celui où tournent déjà
LiteLLM (`https://141.253.109.120`) et la voix de Jeffrey (`protocole-voice`).

**Répartition du travail (important)**
- **Toi** : la partie serveur, et uniquement elle, dans ton dépôt.
- **Moi (session PROTOCOLE)** : tout le code de l'app (envoi, réglages, restauration). Ne modifie
  pas le dépôt `protocole-app` ; tu peux le lire si besoin.
- Aucun déploiement ni redémarrage de service sans l'accord de Yoann, comme d'habitude chez toi.

## Ce que l'app enverra

- **Trois fois par jour** : le matin juste après le brief de Jeffrey (vers 6-7 h, au plus tard
  midi), à 14 h et à 23 h (heure de Paris). Parfois une copie de plus, quand Yoann appuie sur
  « Sauvegarder maintenant ». Le serveur ne doit rien supposer sur les heures.
- **Un fichier JSON** (`Content-Type: application/json`), non compressé, tel que produit par
  l'export de l'app :
  `{ "app": "PROTOCOLE", "schema": 1, "exportedAt": "2026-11-01T22:00:03.120Z", "data": { … } }`.
- **Taille réelle mesurée** : 1,3 à 1,4 Mo aujourd'hui, en hausse de quelques dizaines de Ko par
  jour. Prévois une limite à **20 Mo** par envoi (refus au-delà, avec un message clair).
- **Contenu sensible** : ce sont des **données de santé** (poids, sommeil, douleurs, repas,
  séances, conversations avec Jeffrey). Aucune clé secrète n'y figure (l'app retire les clés
  d'IA, de LiteLLM et de la voix avant l'export). **Ne jamais écrire le contenu dans un journal.**
- L'app passe par le client HTTP natif d'Android : **pas besoin de CORS**.

## Ce que j'attends du serveur

Un petit service à part (comme `protocole-voice`), **pas une route de LiteLLM**. Chemin et
technique à ton choix ; voici le contrat que je coderai côté app. Si tu dois t'en écarter,
dis-le-moi précisément.

Toutes les requêtes portent `Authorization: Bearer <clé de sauvegarde>`. Sans clé ou avec une
mauvaise clé → `401`, sans détail.

| Requête | Effet | Réponse |
|---|---|---|
| `PUT /v1/backup` (corps = le JSON) + en-tête `X-Backup-Slot: matin \| 14h \| 23h \| manuel` | Enregistre une copie | `201 { "id", "savedAt", "bytes", "sha256" }` |
| `GET /v1/backup/latest` | Renvoie la dernière copie, telle qu'envoyée | `200` + le JSON ; en-têtes `X-Backup-Id`, `X-Backup-Saved-At` ; `404` si aucune |
| `GET /v1/backup` | Liste les copies gardées | `200 [ { "id", "savedAt", "slot", "bytes" } ]`, la plus récente d'abord |
| `GET /v1/backup/{id}` | Renvoie une copie précise | `200` + le JSON ; `404` sinon |
| `GET /v1/health` | Vérifie que le service répond (sans clé) | `200 { "ok": true }` |

Règles :
1. **Vérifier avant d'accepter** : le corps doit être du JSON valide, avec `app == "PROTOCOLE"`
   et un objet `data`. Sinon `400`. Ne jamais remplacer une bonne copie par un fichier invalide.
2. **Écriture atomique** : fichier temporaire, puis renommage. Une copie à moitié écrite ne doit
   jamais exister, même si le serveur s'arrête pendant l'envoi.
3. **Conservation** : les **21 dernières copies** (une semaine à trois par jour), plus **la
   dernière copie de chaque mois pendant 12 mois**. Le nettoyage se fait après chaque envoi
   réussi, jamais avant. Il ne supprime jamais la copie qui vient d'arriver.
4. **Stockage** : hors de tout dossier servi par le web, lisible seulement par l'utilisateur du
   service (droits 600 / 700). Compression gzip sur disque si tu veux, mais `GET` renvoie le
   JSON d'origine. Place prévue : environ 33 copies de 1,5 Mo, moins de 60 Mo sans compression.
5. **Clé dédiée** : une clé à elle, **différente de la clé LiteLLM et de celle de la voix**.
   Une clé volée ne doit permettre ni de dépenser des crédits d'IA ni de lire autre chose. La
   clé ne va jamais dans Git ni dans un journal. Transmets-la à Yoann par le même moyen privé
   que pour la clé de la voix ; il la saisira lui-même dans l'app.
6. **Journaux** : seulement la date, l'id, la taille et le code de réponse. Jamais le corps.
7. **Limite de débit** : quelques envois par minute suffisent. Au-delà, `429`.
8. **HTTPS** : même certificat et même adresse que LiteLLM (`https://141.253.109.120`),
   sous le chemin de ton choix (par exemple `/protocole-backup/v1/...`).

Optionnel, pour plus tard (ne le fais pas sans l'accord de Yoann) : une copie quotidienne vers
Oracle Object Storage (gratuit jusqu'à 20 Go), au cas où la machine elle-même serait perdue.

## Ce que j'aimerais en retour

1. L'**adresse de base** exacte (par exemple `https://141.253.109.120/protocole-backup`).
2. La façon dont Yoann reçoit la clé (sans jamais la recopier dans une conversation).
3. Des exemples `curl` testés : envoi d'un petit JSON factice, `latest`, liste, mauvaise clé (401),
   JSON invalide (400), fichier trop gros (413).
4. La preuve que la conservation fonctionne : par exemple 25 envois factices, puis la liste ne
   garde que 21 copies (plus les copies mensuelles si les dates le permettent).
5. Où sont les fichiers sur le disque, et comment Yoann peut en récupérer un à la main si l'app
   est perdue (par exemple `scp`).

Merci. Dès que j'ai l'adresse et que la clé est posée sur le téléphone, je branche l'app dessus
et je te dis si un détail du contrat pose problème.
