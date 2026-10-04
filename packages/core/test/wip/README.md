# Scripts de test bruts (04/10/2026) — à porter en vrais tests (chantier T1)

Copiés tels quels depuis le dossier temporaire de la session du 02-04/10/2026 pour ne pas
les perdre. Ils utilisent des chemins ABSOLUS vers `packages/core/src` et `assert/strict` ;
certains dépendent de la date du jour (`today()`) ou d'une capture `*.json` de référence.
Ne sont PAS lancés par le build. Lancer un script : `cd apps/perso && node ../../packages/core/test/wip/<fichier>.mjs`.

| Fichier | Couvre |
|---|---|
| r1-baseline.mjs | hash du prompt Coach IA (3 phases) — capture avant/après |
| r2-test.mjs | zone de recomposition, recompWindows, paliers dans le prompt |
| r3-test.mjs, r3b-test.mjs | moteur palier.js (seuils, split, weekOf, isPalierEntry) |
| r4-test.mjs | bloc de règles coach attaché à la phase |
| fb-test.mjs | reps ≤ 12, gabarit Full Body, postMatch |
| s1-baseline.mjs, s1-test.mjs | recommandeur temporel : non-régression + créneaux/horizon |
| s2-test.mjs, s3-test.mjs | coach journee/demain ; escalade selon tirage coché ; notProposed |
| cdp.mjs | utilitaire : lire/écrire le localStorage de l'app native via adb + CDP |
