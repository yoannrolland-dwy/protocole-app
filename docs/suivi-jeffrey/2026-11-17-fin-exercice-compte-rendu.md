# Fin d'exercice et compte rendu de séance : contrat implémenté dans PROTOCOLE (17/11/2026, v3.171.0)

Pour la session JEFFREY. Cadrage d'origine : `jeffrey-app/docs/cadrage/TENDANCE_EXERCICE_COMPTE_RENDU.md`.
**État** : codé et testé dans PROTOCOLE, **pas encore commité ni installé** au moment d'écrire ces
lignes (suite dans `docs/journal/2026-11.md`). Tant que JEFFREY n'a pas les deux nouveaux
récepteurs, rien ne change pour lui (voir « Compatibilité »).

## Décisions de Yoann (17/11/2026)

- Une annonce par exercice, quand sa **dernière série prévue** est cochée (écran) ou notée (voix).
- Tendance : `hausse`, `stable`, `baisse` ou `premiere`, règle de PROTOCOLE inchangée
  (`sessionTrend`, comparaison à format égal ; « baisse » = deux séances de suite nettement en dessous).
- Record sur cette même dernière série : **une seule phrase**, fournie par PROTOCOLE, qui dit le
  record et la tendance. Record sur une autre série : signal « record » seul, comme avant.
- Compte rendu de 2 à 3 phrases à l'enregistrement de la séance.
- Phrases fixes rédigées par PROTOCOLE (plusieurs tournures), à dire telles quelles ; aucun appel au modèle.
- Hypothèses du cadrage §6 validées telles quelles : genou hors base → pas d'annonce de fin
  d'exercice ; exercice quitté avant la fin → rien ; série ajoutée après la fin → pas de seconde
  annonce ; gainage → même règle ; séance passée modifiée → ni annonce ni compte rendu ; plateau
  toujours annoncé à la première série (inchangé).
- Compte rendu un jour de genou hors base : exercices, séries, durée seulement (ni records ni tendances).
- Exercice non terminé : compté dans les séries, pas dans les tendances (« un exercice non terminé »).

## 1. Écran de PROTOCOLE : deux nouvelles diffusions

Mêmes règles que le signal « record » (`PROTOCOLE_RECORD`) : diffusion explicite vers le paquet
`fr.yrolland.jeffrey`, permission `fr.yrolland.jeffrey.permission.PROTOCOLE_SIGNAL` (signature),
**envoyée seulement casque branché** (vérifié par PROTOCOLE au moment de l'envoi), extra `json`
(texte JSON). Séance du jour seulement, jamais une séance passée rouverte.

### Fin d'exercice

- Action : `fr.yrolland.jeffrey.action.PROTOCOLE_EXERCICE`
- Récepteur attendu : `fr.yrolland.jeffrey.protocole.ExerciseSignalReceiver`
- `json` (valeurs inventées) :

```json
{
  "date": "2026-11-17",
  "exercice": "Développé incliné haltères",
  "tendance": "hausse",
  "phrase": "Nouveau record de développé incliné haltères, Monsieur : 36 kilos, 8 répétitions, et l'exercice est en hausse.",
  "record": { "kg": 36, "reps": 8 }
}
```

- `tendance` ∈ `hausse` | `stable` | `baisse` | `premiere`.
- `record` **seulement** si la dernière série bat le record ; `phrase` le dit alors déjà. Formes :
  `{ kg, reps, jambe? }` ou `{ secondes, jambe? }` (`jambe` ∈ `G` | `D`). **Dans ce cas, aucun signal
  `PROTOCOLE_RECORD` n'est envoyé pour cette série** : JEFFREY dit `phrase`, sans phrase générale de
  félicitation ni second détail.
- Sans `record` (exemple : « Fin de développé incliné haltères : en hausse par rapport à la
  dernière fois. ») : JEFFREY dit `phrase`, telle quelle.

### Compte rendu de séance

- Action : `fr.yrolland.jeffrey.action.PROTOCOLE_SEANCE`
- Récepteur attendu : `fr.yrolland.jeffrey.protocole.SessionSignalReceiver`
- Envoyé quand Monsieur touche « Valider la séance » à l'écran.
- `json` (valeurs inventées) :

```json
{
  "date": "2026-11-17",
  "type": "Upper A",
  "phrase": "Séance Upper A enregistrée, Monsieur : trois exercices, huit séries, 52 minutes. Un record, sur développé incliné haltères. Un exercice en hausse, aucun stable, un en baisse : tirage vertical prise neutre, un exercice non terminé.",
  "exercices": 3,
  "series": 8,
  "minutes": 52,
  "records": ["Développé incliné haltères"],
  "hausse": 1,
  "stable": 0,
  "baisse": ["Tirage vertical prise neutre"],
  "premiere": 0,
  "non_termines": 1
}
```

- JEFFREY dit `phrase` ; les autres champs sont là pour information (rien à calculer).
- `minutes` peut valoir `null` (heure de début inconnue) : la phrase n'en parle alors pas.
- Genou hors base : `phrase` ne contient que la première phrase, `records` vide, compteurs à 0.

### Compatibilité

PROTOCOLE vérifie que le récepteur existe avant d'envoyer (`raison: "jeffrey_absent"` sinon).
Si le récepteur de fin d'exercice manque et que la dernière série était un record, PROTOCOLE envoie
alors le signal `PROTOCOLE_RECORD` habituel : le record n'est jamais perdu avant la mise à jour de
JEFFREY. Sans récepteur de compte rendu : rien n'est envoyé.

## 2. Séance à la voix (op `agir`)

### `noter_serie` (geste immédiat, avec ou sans jeton)

Réponse inchangée, avec **un champ de plus** quand la série notée est la dernière de l'exercice :

```json
{
  "fait": true,
  "resume": "Développé incliné haltères, série 4 notée, 8 à 36 kilos, repos 2 minutes.",
  "record": true,
  "fin_exercice": {
    "exercice": "Développé incliné haltères",
    "tendance": "hausse",
    "phrase": "Nouveau record de développé incliné haltères, Monsieur : 36 kilos, 8 répétitions, et l'exercice est en hausse.",
    "record": { "kg": 36, "reps": 8 }
  }
}
```

- JEFFREY dit `resume`, puis `fin_exercice.phrase`.
- Quand `fin_exercice.record` est là, `resume` ne contient **plus** « Record battu, Monsieur. » :
  le record est dans `fin_exercice.phrase`. JEFFREY ne doit pas ajouter son compliment de record
  (le champ `record: true` de premier niveau reste là, pour information).
- Le plateau (`plateau`) reste dit à la première série de l'exercice, comme avant.
- La relecture (`verifier: true`) ne porte jamais `fin_exercice` : il n'apparaît qu'à l'écriture.

### `terminer_seance` (relecture, puis « oui » avec jeton)

Relecture inchangée. Réponse à l'écriture :

```json
{
  "fait": true,
  "resume": "Séance Upper A enregistrée, Monsieur.",
  "compte_rendu": { "phrase": "…", "exercices": 3, "series": 8, "minutes": 52, "records": [], "hausse": 1, "stable": 2, "baisse": [], "premiere": 0, "non_termines": 0 }
}
```

- Quand `compte_rendu` est là, JEFFREY dit `compte_rendu.phrase` **à la place** de `resume` (la
  phrase commence déjà par « Séance … enregistrée » ou « C'est enregistré »).
- Absent pour une séance passée modifiée ou d'une autre date.
- Basket : `minutes` = la durée donnée à la voix.

## 3. Code dans PROTOCOLE

- Règles pures : `packages/core/src/session/exerciseEnd.js` (`exerciseEnd`, `sessionReport`,
  `exerciseEndPhrase`, `trendWithToday`, `elapsedMinutes`) ; tests `packages/core/test/exerciseEnd.test.mjs`.
- Voix : `voiceSession.js` (`logSet` → `finExercice`, `finishCheck` → `compteRendu`), réponses du pont
  dans `lib/sessionGestures.js` (`fin_exercice`) et `lib/bridge.js` (`compte_rendu`).
- Écran : `MuscuLogger.jsx` (`toggle`, `validate`), `lib/briefNative.js` (`signalExercise`,
  `signalSession`), Android `JeffreySignal.kt` (`sendExercise`, `sendSession`), `BriefPlugin.kt`.
- « Une seule fois par exercice » : liste `finAnnonces` dans le brouillon de séance (`trainingDraft`,
  hors export), commune à l'écran et à la voix.
