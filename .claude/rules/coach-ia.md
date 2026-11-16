---
paths:
  - "packages/core/src/coach/**"
  - "apps/perso/src/lib/coach*"
  - "apps/perso/src/lib/jeffrey*"
  - "packages/core/test/coach-prompt.test.mjs"
---

### Coach IA — contrat exact (ne pas simplifier sans le signaler)

> **Historique pour `apps/perso`** : depuis v3.128.0 (29/10/2026), la carte Coach IA et son bouton
> « Analyser » sont remplacés par Jeffrey (voir « Jeffrey, état actuel » en tête). Restent valables
> ici : les données envoyées (`buildCoachPrompt`, que Jeffrey reçoit via `facts`), le carnet de
> bord, l'export claude.ai et le principe « le JS calcule, l'IA juge ». **Périmés pour
> `apps/perso`** : le modèle (Sonnet 5), `effort: "medium"` partout, `max_tokens: 6000`, la limite
> de 500 mots, le bouton « Analyser ».
- **Détail des repas dans le prompt** (02/08/2026) : jusqu'ici le Coach IA ne
  voyait que les totaux macros du jour (`macroLog`, alimenté par `foodLog`
  depuis M6) — jamais QUOI a été mangé. `buildPrompt` lit désormais `foodLog`
  directement (`getSync("foodLog", [])` dans `store.js`, lecture **synchrone**
  au moment précis du clic sur "Analyser" — pas une copie chargée au montage
  de l'app comme `macros`/`weight`/etc., pour ne jamais rater un repas ajouté
  dans l'onglet Repas pendant la session en cours) et regroupe hier/aujourd'hui
  par repas (`repas_hier`/`repas_aujourdhui` dans le bloc TEMPS RÉEL : nom +
  quantité de chaque aliment, PAS les macros qui sont déjà dans `macros_*`).
  Consigne explicite au modèle : commenter la COMPOSITION quand elle appelle un
  conseil concret (répartition protéique entre repas, repas pauvre en fibres,
  timing autour de l'entraînement), pas relire la liste. `buildBriefing`
  (export claude.ai, tokens gratuits) va plus loin et dumpe les 14 jours de
  repas bruts aliment par aliment (`REPAS BRUTS 14 jours`), même logique que
  les séries de musculation brutes déjà présentes.
- Appel direct à `https://api.anthropic.com/v1/messages` depuis le
  navigateur avec la clé API saisie par l'utilisateur (stockée en local
  uniquement), header `anthropic-dangerous-direct-browser-access: true`.
- **Découpage system / user** (30/07/2026) : le rôle + les contraintes
  permanentes + le bloc sèche vont dans `system` (stable d'un appel à l'autre,
  donc rendu en préfixe et prêt pour le cache) ; les données et les consignes
  de sortie restent dans le message utilisateur. `buildPrompt` retourne donc
  `{ system, user }`, pas une chaîne.
- **`output_config: { effort: "medium" }`** (30/07/2026) : Sonnet 5 active la
  réflexion adaptative dès qu'on ne précise rien, et cette réflexion est
  facturée au tarif de SORTIE tout en consommant `max_tokens` — c'est la cause
  réelle des "réponses vides"/troncatures historiques. `medium` garde la
  qualité d'un Sonnet 4.6 en `high` pour bien moins cher. **Ne jamais envoyer
  `output_config` à Haiku 4.5 : il rejette ce paramètre (400)** — d'où le set
  `SUPPORTS_EFFORT`.
- **Reprise automatique** (`callClaude`) : 3 tentatives sur le modèle demandé
  espacées de 1,2 s puis 4 s en cas d'erreur transitoire (429 / 5xx / réseau),
  puis bascule sur `claude-haiku-4-5`. Motivé par une saturation réelle le
  28/07/2026 au soir (Sonnet et Opus en "overloaded", Haiku disponible) alors
  que l'app ne faisait qu'un seul essai. Les erreurs définitives (clé
  invalide, requête malformée) ne sont jamais reprises.
- **Coût réel affiché** après chaque analyse (tokens entrée/sortie + centimes),
  calculé depuis `usage` via la table `PRICING`. Celle-ci porte le tarif
  d'intro Sonnet 5 (2 $/10 $ jusqu'au 31/08/2026) ET le tarif normal
  (3 $/15 $) avec bascule automatique à la date — sans ça l'app
  sous-estimerait silencieusement le coût à partir du 01/09/2026.
- **Mesure réelle du 30/07/2026** : ~7 200 tokens en entrée / ~1 700 en sortie
  = **3,1 ¢ par analyse**. À noter : l'entrée (1,44 ¢) pèse presque autant que
  la sortie (1,7 ¢) — une estimation à la main basée sur le nombre de
  caractères donnait 2× moins, donc **toujours se fier au `usage` affiché,
  jamais à une estimation**. Le plus gros poste d'entrée reste le dump brut
  14 jours des séances.
- `max_tokens: 6000` — volontairement haut car le modèle peut consommer du
  budget en amont du texte visible ; on a eu des "réponses vides" et des
  troncatures avec des valeurs plus basses (1000 → 1800 → 4096 → 6000).
- Le prompt envoie systématiquement : un bloc **temps réel** (hier vs
  aujourd'hui : poids, sommeil, macros/eau en cours, séances, douleur
  genou), un **résumé 14 jours** (moyennes), un **dataset fusionné jour par
  jour** (poids + kcal + macros + fibres + eau, pour que le modèle corrèle
  lui-même poids et apports plutôt que de deviner), et une **progression par
  exercice pré-calculée**.
- **Principe adopté le 30/07/2026 : le JS calcule les faits, l'IA les juge.**
  Les dumps bruts 14 jours (séries de chaque séance, sommeil, genou) ont été
  remplacés par des agrégats calculés en JS : meilleure série par séance +
  tendance de volume (`exoProgress`), moyennes glissantes, pire nuit, douleur
  moyenne 7 j vs 7 j précédents. Mesuré : **entrée 7 457 → 5 845 tokens
  (−22 %), coût 3,4 → 3,1 ¢, et analyse plus fine** (le modèle repère
  désormais une baisse de volume sur un exercice précis et compare la douleur
  d'une semaine à l'autre — impossible depuis le dump brut, où on lui
  demandait de faire l'arithmétique dans 500 mots). Ne pas revenir aux dumps
  bruts : c'était plus cher ET moins bon.
- Le dataset jour par jour utilise des **clés courtes** (`d/p/kc/P/G/L/F/eau/
  pas/cible_kc`) avec les champs nuls omis, et une légende dans le prompt.
- **Le coût est désormais dominé par la SORTIE** (1 895 tok ≈ 1,9 ¢ contre
  1,17 ¢ en entrée) : pour descendre plus bas il faudrait raccourcir la
  réponse, pas le prompt.
- **Export vers claude.ai** (`coach.buildBriefing`, Réglages → « Copier le
  contexte ») : briefing complet dans le presse-papier, volontairement **plus
  riche** que le prompt API (il garde les séries brutes, le profil et le
  carnet) puisque la conversation claude.ai est couverte par l'abonnement et
  ne consomme aucun crédit API. C'est le pendant « suivi de fond » du point du
  jour. `navigator.clipboard` fonctionne dans la WebView Capacitor (vérifié le
  30/07/2026) ; en cas d'échec, le texte s'affiche pour copie manuelle.
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
