# PROTOCOLE — Chantier V (après le module Nutrition)

Plan de travail établi le 03/08/2026, après la clôture du module Nutrition (M0-M7).
Même fonctionnement que les jalons M : **une étape à la fois**, chacune buildée,
testée, installée sur le téléphone et commitée avant de passer à la suivante.

Pour lancer une étape : « GO V1 ». Pour la relire d'abord : « détaille-moi V1 ».

| Étape | Contenu | Effort | État |
|---|---|---|---|
| V1 | Douleurs : harmoniser coude et genou | moyen | ✅ 03/08/2026 (v3.42.0) |
| V2 | Sauvegarde régulière hors du téléphone | petit | ✅ 03/08/2026 (v3.43.0) |
| V3 | Progression visible par exercice | moyen | ✅ 03/08/2026 (v3.44.0) |
| V4 | Détection de record sur une série | petit | ✅ 03/08/2026 (v3.45.0) |
| V5 | Escalade : suivi des blocs | moyen | ✅ 03/08/2026 (v3.47.0, cotations par couleur) |
| V6 | Corriger les valeurs d'un aliment | petit | ✅ 03/08/2026 (v3.48.0, rétroactif) |
| V7 | Dépense énergétique adaptative (TDEE calculé) | gros | ✅ 04/08/2026 (v3.49.0) |
| R1 | Recomposition : nouvelle phase, fin du poids cible, pilotage par tendance 7 j | moyen | ✅ 02/10/2026 (v3.85.0) |
| R2 | Recomposition : zone de déficit dans l'onglet TDEE + historique des paliers | moyen | ✅ 02/10/2026 (v3.86.0) |
| R3 | Recomposition : « Palier de la semaine » (moteur + carte + Appliquer + coach) | gros | ✅ 02/10/2026 (v3.87.0) |
| R4 | Recomposition : bloc de règles Coach IA attaché à la phase | petit | ✅ 02/10/2026 (v3.88.0) |
| S1 | Recommandeur temporel : créneaux, horizon aujourd'hui/demain, planning par défaut (core) | moyen | ✅ 04/10/2026 (v3.90.0) |
| S2 | Recommandeur temporel : carte à deux lignes + Coach IA | petit | ✅ 04/10/2026 (v3.91.0) |
| T1 | Tests committés (`packages/core/test`, `npm test`, bloquant avant commit) | moyen | ✅ 04/10/2026 (v3.93.0) |
| T2 | Volume hebdomadaire par groupe musculaire (carte, zéro donnée nouvelle) | petit | ✅ 04/10/2026 (v3.94.0) |
| T3 | Dashboard actionnable : genou en un tap + bouton « Démarrer » la séance proposée | petit | ✅ 04/10/2026 (v3.95.0) |
| T4 | Reps en réserve (RIR) par exercice, optionnel → plateau + Coach IA | moyen | ✅ 04/10/2026 (v3.96.0) |
| T5 | Bonus : retour haptique au cochage d'une série ; champ « alcool » en saisie libre | petit | ✅ 04/10/2026 (v3.97.0) |
| U0 | Refonte IHM — socle : découper `App.jsx` par écran, zéro changement visible, captures « avant » | moyen | ✅ 25/10/2026 (v3.109.2) |
| U1 | Refonte IHM — cadrage : audit chiffré + moments d'usage + arborescence maquettée | petit | ✅ 25/10/2026 (option A) |
| U2 | Refonte IHM — directions visuelles en maquettes, choix, design system v2 (variables CSS) | gros | ✅ 25/10/2026 (v3.110.0, direction A) |
| U3 | Refonte IHM — écran par écran (un commit + une install par écran) | gros | ✅ 25/10/2026 (8 étapes, v3.111.0 → v3.118.0) |
| U4 | Refonte IHM — audit final avant/après + mise à jour CLAUDE.md | petit | ✅ 25/10/2026 (v3.118.1) |
| J0 | Jeffrey — test jetable : l'app peut-elle préparer le brief seule, écran éteint et app fermée ? | petit | ✅ 29/10/2026 (piste A validée avec un réveil système) |
| JT | Jeffrey — textes de l'app et notifications dans sa voix (textes fixes, sans IA) | petit | ✅ 29/10/2026 (v3.126.0) |
| J1 | Jeffrey — la conversation, en 3 lots installés : J1.1 relais Android + cœur testé ; J1.2 conversation dans Analyse ; J1.3 bulle partout + carte Bord + mémoire | gros | J1.1 ✅ 29/10/2026 (v3.127.0) ; J1.2 ✅ 29/10/2026 (v3.128.0) ; J1.3 ✅ 29/10/2026 (v3.129.0) |
| J2 | Jeffrey — actions proposées, confirmées d'un tap (eau, genou, note, séance, repas, habituel) | moyen | ✅ 29/10/2026 (J2a + J2b) |
| J4 | Jeffrey — brief du matin en notification : attend la nuit, météo, réponse dans la notification | gros | en cours (J4.1 et J4.2 ✅ 29/10/2026) |
| J3 | Jeffrey — la voix : micro (dictée) + réponse lue à voix haute, voix réglable | moyen | à faire |

**Ordre choisi** : V1 d'abord car c'est le seul vrai angle mort médical et il
alimente le recommandeur + le Coach IA. V2 tôt parce que c'est une protection, pas
une fonctionnalité. V4 dépend de V3 (calcul partagé). V7 en dernier : il lui faut
2-3 semaines de journal alimentaire complet pour valoir quelque chose, et le
module Repas n'est en service que depuis le 01/08.

Les étapes sont indépendantes sauf V3 → V4. L'ordre est réarrangeable.

---

## Règles communes à toutes les étapes

Reprises de CLAUDE.md, à respecter sans les redemander :

1. **Ne jamais changer une clé localStorage existante.** Toute clé nouvelle doit
   être ajoutée à `DATA_KEYS` (`store.js`), sinon elle est absente de l'export JSON
   et perdue à la première restauration.
2. `npm run build` doit passer avant de considérer une étape terminée.
3. Bumper `APP_VERSION` (`App.jsx`) **et** `"version"` (`package.json`).
4. Vérifier dans le navigateur d'aperçu avant le build natif.
5. Build natif + `adb install -r` (téléphone en USB), puis mise à jour de CLAUDE.md.
6. Commit sur `dev`. **Jamais de push sur `main` sans demande explicite** (chaque
   déploiement de production coûte 15 crédits Netlify sur 300/mois).
7. Design system « Affirmée » : fond `#050505`, cartes `#121212`, accent citron
   `#d7ff3f` uniquement, chiffres en monospace, styling inline via l'objet `C`.
8. Avant de simplifier une règle métier (Silbernagel, HSR, recommandeur, contrat du
   Coach IA), demander confirmation.

**La PWA n'est pas abandonnée** : Yoann envisage de la détourner plus tard en
version simplifiée pour un tiers (sa copine / d'autres personnes). Ne pas proposer
d'arrêter de la déployer ni de supprimer le chemin PWA du code. Ce serait un
chantier séparé, non planifié ici.

---

## V1 — Douleurs : harmoniser coude et genou

### Objectif

Yoann a **deux** tendinopathies actives, mais une seule est mesurée. Le tendon
quadricipital a son onglet, son log 0-10, sa courbe 30 jours et la règle de
Silbernagel. Le tendon distal du biceps n'existe que comme *contrainte* : prises
neutres dans les templates, pénalités fixes escalade/Upper dans le recommandeur,
une phrase dans le `system` du Coach IA. Conséquence : le recommandeur écarte
l'escalade sur une règle figée, jamais sur l'état réel du coude, et le coach n'a
aucun chiffre à commenter.

### Ce qui change

- **`store.js`** : nouvelle clé `elbowLog`, ajoutée à `DATA_KEYS`.
- **`App.jsx`** : `KneeTab` devient un onglet « Douleurs » avec un sélecteur de zone
  (Pills : Genou / Coude). Le log 0-10, la courbe 30 jours, l'alerte et la règle de
  Silbernagel se généralisent sur les deux zones.
- **`recommendSessions`** : prend `elbow` en plus de `knee`.
- **Coach IA** (`buildPrompt`) : bloc temps réel + agrégats 14 j pour le coude.
- **Dashboard** : la tuile Genou devient une tuile Douleurs à deux valeurs.

### Décision structurante : nouvelle clé, pas de migration

Deux options étaient possibles :

- **(a) `painLog` unique avec un champ `zone`** — plus élégant si une 3e zone
  arrive un jour, mais impose de migrer `kneeLog`, donc de toucher à l'historique
  réel de douleur de Yoann.
- **(b) `elbowLog` séparé, même forme que `kneeLog`** — zéro migration, zéro
  risque sur l'historique existant.

**Retenu : (b).** L'entrée reste `{ date, pain, baseline }`, identique au genou.
L'UI et la logique doivent être écrites **génériquement** sur une petite config
`ZONES = [{ key: "knee", label: "Genou", log, save }, { key: "elbow", … }]`, pour
qu'une 3e zone ne coûte qu'une ligne — l'élégance de (a) sans son risque.

### À conserver absolument

- **Aucune valeur par défaut** : rien de présélectionné à l'ouverture, bouton
  Enregistrer désactivé tant qu'un chiffre n'a pas été touché. Décision explicite du
  30/07/2026, à répliquer telle quelle sur le coude — le but est de forcer une vraie
  évaluation, pas un enregistrement réflexe.
- **Rechargement de l'entrée existante** au changement de date, et remise à vide si
  le jour visé n'a rien (même piège que pour le genou : sinon la douleur d'un autre
  jour reste affichée et peut être enregistrée par erreur).
- **La table HSR et les deux routines guidées restent attachées au genou seul.**
  Elles ne doivent pas apparaître quand la zone Coude est sélectionnée.

### Nouvelles règles du recommandeur

Symétriques de celles du genou, à écrire dans le même style (raison chiffrée) :

- Coude hors base → **Escalade** et **Upper** écartés (volume de tirage).
- Douleur coude élevée récente → pénalité sur Upper, jamais sur Repos.
- Silence si la donnée est absente : une absence de saisie ne doit pas être traitée
  comme une alerte (même principe que les nudges sommeil/charge de l'étape 4).

### Coach IA

- `realtime` : `douleur_coude_hier` / `douleur_coude_aujourdhui`.
- `summary.coude` : `derniere_douleur`, `derniere_date`, `base_ok`,
  `jours_hors_base_14j`, `douleur_moy_7j` vs `douleur_moy_7j_precedents` — mêmes
  agrégats que `summary.genou`.
- Ajouter « coude » à la ligne « Traite explicitement CHAQUE domaine ».
- Coût : quelques dizaines de tokens, négligeable.

### Tests attendus

- Jour sans entrée coude → champ vide, bouton Enregistrer désactivé.
- Coude hors base → Escalade apparaît dans `avoid` avec une raison chiffrée.
- `kneeLog` **inchangé au bit près** après plusieurs saisies côté coude.
- L'export JSON contient bien `elbowLog`.
- La table HSR n'apparaît pas quand la zone Coude est active.

---

## V2 — Sauvegarde régulière hors du téléphone

### Objectif

`autoBackup.js` écrit déjà un export JSON quotidien dans `Documents/Protocole/`
(30 jours de rétention). Ça protège d'un bug qui corromprait le localStorage ou
d'une suppression accidentelle dans l'app. Ça ne protège **ni de la perte ou de la
casse du téléphone, ni d'un « vider les données »**, qui efface aussi ce dossier.
Tout l'historique tient dans quelques Mo : il n'y a aucune raison d'accepter ce
point unique de défaillance.

### Options écartées

- **API Google Drive** : impose un flux OAuth et un secret client embarqué dans
  l'app. Disproportionné, et contraire au principe « pas de backend ».
- **Endpoint cloud maison** (fonction Netlify + stockage) : ajoute un backend, ce
  que le projet refuse explicitement depuis le début.

### Retenu

1. **Bouton « Sauvegarder hors du téléphone »** dans Réglages : réutilise le
   `Share` Android déjà en place pour l'export manuel (Drive, mail, Fichiers…).
   Un tap, pas de credentials, aucune infra.
2. **Clé `lastCloudBackup`** (date de la dernière sauvegarde externe) + **bandeau
   d'alerte** dans Réglages et sur le Dashboard si elle date de plus de 14 jours.
   C'est ce rappel visible, pas le bouton, qui fait que la sauvegarde a lieu.
3. **Rappel hebdomadaire** via `@capacitor/local-notifications` (déjà installé).

**`lastCloudBackup` ne doit PAS entrer dans `DATA_KEYS`** — sinon restaurer une
vieille sauvegarde ferait croire à l'app qu'elle vient d'être sauvegardée. Même
raisonnement que `lastAutoBackup`, déjà hors de la liste.

### À vérifier au passage

`android:allowBackup="true"` est déjà positionné dans le manifeste : Android
sauvegarde en principe les données de l'app vers le compte Google (plafond 25 Mo,
seulement en charge / wifi / inactif). Le localStorage d'une WebView vit dans le
dossier de données de l'app, donc il est *probablement* couvert — mais c'est
silencieux et invérifiable depuis l'app. À traiter comme un filet gratuit
éventuel, **jamais** comme la sauvegarde principale. Vérifier si possible avec
`adb shell bmgr` avant de conclure quoi que ce soit.

### Tests attendus

- Bouton → feuille de partage Android avec un JSON valide et complet.
- Bandeau d'alerte à J+15 sans sauvegarde, disparu après une sauvegarde.
- Un import de sauvegarde ne remet pas `lastCloudBackup` à la date du fichier.

---

## V3 — Progression visible par exercice

### Objectif

`exoProgress` (meilleure série par séance + tendance de volume) est **déjà calculé**
dans `buildPrompt` — et n'apparaît nulle part à l'écran. L'app a des courbes pour
Poids, Sommeil, Pas, Genou et Calories, mais **aucune pour l'entraînement**, qui est
pourtant son cœur. C'est la fonction n°1 des apps du marché (Strong, Hevy).

### Ce qui change

- **Extraire `bestSet` et `exoProgress`** des closures de `buildPrompt` vers un
  module partagé (`src/training.js`), avec une fenêtre paramétrable : 14 jours pour
  le Coach IA, historique complet pour l'écran. Le Coach IA doit continuer à
  produire **exactement** la même sortie qu'avant — c'est le test de non-régression
  de cette extraction.
- **Nouvel écran** accessible depuis l'onglet Séances : liste des exercices déjà
  réalisés → tap → historique de l'exercice (courbe + détail des séries par séance).

### Décisions

- **Quoi tracer : le volume de la meilleure série (charge × reps)**, pas la charge
  seule — c'est déjà la définition de « tendance » utilisée par le coach, et elle
  capte une progression même quand le poids ne bouge pas. Le tooltip affiche la
  série lisible (« 60 kg × 8 »).
- **Pas de 1RM estimé, volontairement.** C'est standard chez Strong/Hevy, mais les
  formules type Epley n'ont aucun sens sur un protocole HSR à tempo 6 s et
  amplitude 10-60°, et pousser un 1RM sur un tendon en rééducation est
  contre-indiqué. À ne pas ajouter sans demande explicite.
- **Exercices en mode « temps »** (planche, iso) : le volume charge × reps ne
  s'applique pas. Tracer les **secondes**. À traiter dès le départ, pas après coup —
  chaque template A comporte un finisher core en gainage.

### Tests attendus

- Le prompt du Coach IA est identique avant/après extraction (comparer la sortie de
  `buildPrompt` sur les mêmes données).
- Exercice fait 3+ fois → tendance hausse/baisse/stable correcte.
- Exercice en mode temps → courbe en secondes, pas un volume absurde.
- Exercice jamais fait → absent de la liste, pas d'écran vide cassé.

---

## V4 — Détection de record sur une série

*Dépend de V3 (réutilise `bestSet` extrait).*

### Objectif

Rendre visible une progression que l'app connaît déjà mais ne signale jamais.

### Définition d'un record

- **Mode reps** : meilleure charge jamais soulevée sur cet exercice ; à charge
  égale, meilleur nombre de reps.
- **Mode temps** : tenue la plus longue.
- Calculé **sur tout l'historique**, pas sur 14 jours — sinon tout redevient un
  record tous les quinze jours.

### Où l'afficher

- **Dans le carnet (`MuscuLogger`)**, au moment où une série cochée bat le
  précédent record : pastille discrète à côté de la série.
- **Dans « Dernières séances »** : marqueur sur les séances qui contenaient un record.

### Garde-fou spécifique au profil

**Ne pas signaler de record un jour où le genou ou le coude est hors base.**
Féliciter une charge record le jour où le tendon a flambé, c'est encourager
exactement ce que la règle de Silbernagel cherche à éviter. Le record reste
enregistré, il n'est simplement pas mis en avant ce jour-là.

Ton visuel : un fait, pas une célébration — pas de confettis, pas d'animation.
Le design system est austère, un record est une pastille accent, rien de plus.

### Piège

Au premier lancement, l'historique complet doit être balayé pour établir les
records existants, sinon la première séance après la mise à jour déclarerait un
record sur chaque exercice.

---

## V5 — Escalade : suivi des blocs

### Objectif

L'escalade est la séance la moins documentée des trois (durée + RPE), alors que
c'est celle qui charge le tendon du coude. Aujourd'hui le recommandeur applique une
pénalité **forfaitaire** : une session d'une heure tranquille et une grosse séance
de blocs comptent pareil.

### Périmètre : bloc uniquement

**Yoann ne fait que du bloc** (confirmé le 03/08/2026). Pas de sélecteur bloc/voie.
Ne pas réintroduire la notion de « voie » sans demande explicite.

> **Correction du 03/08/2026 (après livraison de la v3.46.0).** Ce qui suit
> supposait l'échelle Fontainebleau : c'était FAUX. Sa salle cote **par couleur de
> piste**, dans l'ordre jaune < vert < bleu < rouge < noir < violet, avec cinq
> niveaux dans chaque couleur (5 = le plus dur). C'est cette échelle qui est
> livrée en v3.47.0 (voir CLAUDE.md). Tout ce que la section dit par ailleurs
> (volume/intensité/réussite, table ordonnée, saisie au doigt, branchement sur le
> recommandeur) reste valable — seule la liste des cotations change.

### Proposition

Ajouter un détail « blocs » aux séances de type Escalade, dans `trainingLog`
(**aucune nouvelle clé localStorage** : ça vit dans l'entrée de séance existante,
comme `exercices` pour la muscu) :

```
blocs: [{ cotation: "6A+", issue: "flash" | "essais" | "echec" }]
```

Métriques dérivées, calculées en JS :

- **Volume** : nombre de blocs (le proxy de charge sur le coude).
- **Intensité** : cotation maximale et cotation médiane de la séance.
- **Réussite** : part de flash / après essais / échecs.

Il faut une **table de cotations Font ordonnée** pour pouvoir calculer un max et
une médiane (une cotation est une chaîne, `"6C+" > "6B"` n'a aucun sens en
comparaison de texte) :

```
3, 4, 5, 5+, 6A, 6A+, 6B, 6B+, 6C, 6C+,
7A, 7A+, 7B, 7B+, 7C, 7C+, 8A, 8A+, 8B, 8B+, 8C, 8C+
```

La saisie doit rester rapide au doigt en salle : une grille de cotations à taper,
pas un champ texte libre — et un moyen d'ajouter plusieurs blocs de même cotation
d'un coup (une séance, c'est souvent 10-20 blocs).

### Le vrai bénéfice : brancher ça sur V1

Une fois le volume connu, le recommandeur peut distinguer « escalade légère hier »
de « grosse session de blocs hier », au lieu d'une pénalité fixe. Croisé avec la
douleur de coude réelle (V1), c'est la première fois que la charge de tirage serait
évaluée sur des faits plutôt que sur une heuristique.

`autresSeances` dans `buildPrompt` doit remonter le résumé (nb de blocs, cotation
max et médiane) — pas la liste brute des blocs, conformément au principe « le JS
calcule les faits, l'IA les juge ». Sur une séance de 20 blocs, la liste brute
coûterait des tokens pour un signal que le JS calcule exactement.

---

## V6 — Corriger les valeurs d'un aliment

### Objectif

Répond directement au `+?` constaté le 03/08/2026 : quand un produit Open Food
Facts n'a pas de teneur en fibres, l'app affiche honnêtement « +? » plutôt qu'un
total faussement exact — mais il n'existe aujourd'hui aucun moyen de corriger la
valeur, donc le `+?` est définitif sur les produits habituels.

### Ce qui change

- **Nouvelle clé `foodOverrides`** : `{ [ref]: { kcal?, prot?, gluc?, lip?, fib? } }`,
  partielle (seuls les champs corrigés y figurent). À ajouter à `DATA_KEYS`.
- Action « Corriger les valeurs » depuis la fiche d'un aliment et/ou depuis « Vos
  aliments habituels ».
- Marqueur visuel discret sur les valeurs corrigées : une correction ne doit jamais
  être invisible, elle doit rester auditable et réversible.

### Décision à confirmer avant de coder — TRANCHÉE : rétroactif (03/08/2026)

`per100` est **figé à la saisie** (snapshot), décision prise à M1 pour que
l'historique reste reproductible si un produit OFF est corrigé ou disparaît.
Un override entre en tension avec ce principe :

- **Rétroactif** (l'override s'applique à la lecture, donc à tout l'historique) :
  le `+?` disparaît partout, les totaux passés deviennent justes.
- **Non rétroactif** (seules les futures saisies en bénéficient) : fidèle au
  snapshot, mais le `+?` reste à vie sur les entrées déjà enregistrées.

**Recommandation : rétroactif.** Le principe du snapshot existe pour se protéger
d'une source externe qui change sous les pieds — pas pour empêcher Yoann de
corriger sa propre donnée quand il sait qu'elle est fausse. L'override est une
couche distincte et réversible, ce qui préserve la traçabilité.

### Piège : effet de bord sur `macroLog`

Si l'override est rétroactif, corriger un aliment **modifie les macros de toutes
les dates passées qui le contiennent**. La dérivation M6 gère déjà ça sans code
supplémentaire (elle tourne sur tout `foodLog` à chaque changement, et n'écrit que
pour les dates réellement présentes dans `foodLog`) — donc l'historique Cronometer
antérieur au module reste intact. **À vérifier explicitement au test**, c'est la
propriété la plus importante à ne pas casser.

---

## V7 — Dépense énergétique adaptative (TDEE calculé)

> **Note du 04/08/2026** : cette étape prévoyait d'attendre 2-3 semaines de journal
> alimentaire. Yoann a demandé de ne pas attendre — l'algorithme a un garde-fou intégré
> ("pas assez de données" plutôt qu'un chiffre non fiable), donc rien ne se serait affiché
> de trompeur en construisant maintenant. Livrée en v3.49.0, utilise déjà tout l'historique
> disponible (macroLog compris pour les dates antérieures au module Repas). Voir CLAUDE.md
> pour le détail.

### Objectif

La cible de ~2400 kcal est une estimation théorique. Depuis M6, la donnée existe
pour faire mieux : apports fiables (`foodLog`) **et** poids quotidien
(`weightLog`). Le principe, celui de MacroFactor : on lisse le poids pour éliminer
le bruit hydrique, on compare la tendance réelle à ce que le déficit loggé
prédisait, et on en déduit la dépense réelle. Si la perte ralentit sous ce que le
déficit annonçait, c'est que la dépense a baissé (adaptation métabolique) — et on
le voit au lieu de le subir.

### Algorithme

1. **Tendance de poids lissée** : moyenne mobile exponentielle sur les pesées
   quotidiennes, réglée pour réagir en ~7-10 jours. Jamais le poids brut : une
   pesée isolée ne veut rien dire, c'est déjà une règle du profil coach.
2. **Fenêtre** : minimum 14 jours, idéalement 21-28, avec au moins ~70 % des jours
   renseignés en apports. En dessous, afficher « pas assez de données » — jamais un
   chiffre non fiable.
3. **Calcul** :
   `TDEE = apports_moyens − (Δ_tendance_kg × 7700 / nb_jours)`
   Vérification de signe : 2200 kcal/j, −0,5 kg de tendance sur 14 j →
   2200 − (−0,5 × 7700 / 14) = 2200 + 275 = **2475 kcal/j**.
4. **Indice de fiabilité** (faible / moyenne / fiable) dérivé de la longueur de la
   fenêtre, du taux de jours loggés et de la densité des pesées.

### Source des calories : ne pas utiliser 4/4/9

`macroLog` **ne stocke pas les kcal** (`MACRO_FIELD` ne mappe que
protéines/glucides/lipides/fibres) : partout dans l'app, les calories sont
recalculées en 4/4/9. Or `foodLog` porte la **vraie** valeur mesurée de chaque
aliment (CIQUAL / OFF, règlement UE 1169/2011, fibres comprises) — c'est
précisément le « décalage fibres » déjà signalé à l'utilisateur dans l'onglet
Macros.

**Règle** : pour chaque jour, utiliser les kcal réelles issues de `foodLog` quand la
date y figure, et se rabattre sur 4/4/9 depuis `macroLog` pour les dates
historiques (Cronometer) qui n'existent que là. Sans ça, le TDEE est biaisé de
façon systématique.

### Piège majeur : les 2-3 premières semaines de sèche

Le coefficient 7700 kcal/kg vaut pour du tissu adipeux. En début de sèche, la perte
est majoritairement eau et glycogène — le profil coach de Yoann le chiffre
lui-même : « environ 3-3,5 kg d'eau et de glycogène perdus sur les 10-14 premiers
jours ». Sur cette période, la perte apparente **surestime largement** la dépense.

Conséquences à implémenter, pas seulement à documenter :

- Afficher explicitement une fiabilité dégradée tant que la fenêtre chevauche les
  ~21 premiers jours de sèche.
- Préférer une fenêtre qui exclut la phase de perte hydrique dès qu'assez de
  données existent.
- MacroFactor lui-même ne se stabilise qu'au bout d'une trentaine de jours : ne pas
  promettre mieux.

### Décision : pas d'ajustement automatique des cibles

MacroFactor ajuste les cibles tout seul. **Ne pas le faire ici.** Les cibles de
Yoann sont délibérées (215/205/80/35, fenêtre de sèche éditable dans les Réglages),
et les écraser automatiquement entrerait en conflit direct avec `targets.cut` et
avec la règle « ne pas simplifier une règle métier sans demander ». L'app affiche
le chiffre et le déficit réel ; l'arbitrage reste à Yoann et au Coach IA.

### Affichage

Carte dans l'onglet Macros (et/ou Dashboard) :
`Dépense estimée 2 640 kcal/j · fiabilité moyenne · sur 18 jours`
+ `Déficit réel actuel : −390 kcal/j` (contre la cible affichée).

### Coach IA

Ajouter `depense_estimee` à `summary` avec sa fiabilité et sa fenêtre. C'est le
vrai gain : aujourd'hui le coach ne peut qu'estimer le déficit à la louche à partir
du poids et des apports, alors que le JS peut le lui donner exact.

### Tests attendus

- Jeu de données synthétique : 21 jours à apports connus et perte linéaire connue →
  le TDEE calculé tombe à quelques kcal près de la valeur attendue.
- Jours manquants (apports ou pesée) correctement ignorés sans fausser la moyenne.
- Moins de 14 jours de données → « pas assez de données », jamais un chiffre.
- Une date présente dans `foodLog` utilise ses kcal réelles, pas 4/4/9.

---

## Idées non retenues à ce stade

Évoquées le 03/08/2026, écartées ou reportées — à ne pas reproposer sans raison :

- **Publication sur le Play Store** : 25 $, build signé release (clé à ne jamais
  perdre), formulaire Data safety sur des permissions santé sensibles, et une revue
  à chaque livraison. Disproportionné pour une app perso à livraison très fréquente.
  Si l'objectif est seulement d'éviter le câble USB, regarder le « Partage
  d'application interne » de Play Console.
- **Cache de prompt sur l'API Anthropic** : le bloc `system` est stable et prêt pour
  ça, mais avec une analyse par jour le cache aurait expiré à chaque appel. Aucun
  gain.
- **Photos de progression** et **tour de taille** : alignés avec l'objectif visuel
  du profil coach, mais pas retenus dans cette vague. Les photos imposeraient un
  stockage hors localStorage et hors export JSON (sinon la sauvegarde explose).

---

# Chantier R — Recomposition corporelle (spécifié le 02/10/2026)

Yoann passe de Maintenance à une **recomposition corporelle** (perte de gras lente + prise
de muscle). Point de départ : prompt rédigé par son suivi IA dans une autre conversation,
challengé point par point dans Claude Code, puis 7 décisions prises par question explicite.
Quatre lots, chacun buildé, testé (Node + aperçu), commité sur `dev` et documenté dans
`CLAUDE.md` avant le suivant ; install native à la fin. Pour lancer : « GO R1 ».

État au 02/10/2026 : cibles réelles 2800 kcal / 210 P / 270 G / 90 L (Yoann passera les
protéines à 200 lui-même sous quelques jours — l'app ne touche jamais aux cibles toute seule).

## Décisions prises (ne pas rouvrir sans raison)

1. **Ajouter une phase `recomposition`, PAS renommer `maintenance`.** `PHASES` est dans
   `packages/core` et `apps/public` le lit (`Onboarding.jsx` construit ses Pills dessus,
   `defaultTargets.js` lit `PHASES[phase]`) : renommer la clé planterait tout compte public
   stocké en `"maintenance"`. Additif, zéro migration. **Masquée du picker `apps/public`
   pour l'instant** (son `phaseTarget` local retomberait sur 96 kg et son UI ne gère pas un
   poids cible `null`) — à ouvrir plus tard si un bêta-testeur le demande, pas par réflexe.
2. **Aucun poids cible en recomposition.** `PHASES.recomposition.target = null` ET pas de
   repli sur `weightMaintenance` (contrairement à Maintenance) : `phaseTarget()` renvoie
   `null`. Le pilotage se fait sur la **moyenne glissante 7 j** et son delta vs la semaine
   précédente (déjà calculés pour le coach : `summary.poids.moy_7j` /
   `moy_7j_precedents` / `tendance_kg_sur_semaine`). Ajouter la 3e semaine (`moy_7j` d'il
   y a 2 semaines) pour que « perte > 0,3 kg/sem sur 2 semaines » soit vérifiable.
3. **Les cibles ne sont jamais modifiées automatiquement.** Le coach juge les protéines sur
   la moyenne hebdomadaire **contre la cible réelle de l'app** (`cibles.proteines`, déjà
   transmise) — aucun « ~200 g » codé en dur.
4. **Zone de recomposition = apports RÉELS moyens − dépense, sur 14 j ET 21 j.** Pas
   `realDeficit` (= cible du jour − dépense, le déficit *prévu*, pas celui *réalisé*) et pas
   le 7 j (trop bruité, déjà marqué « indicatif » depuis v3.84.0). Barème : surplus (≤ 0) =
   hors objectif ; 0-100 = sous la zone ; **100-300 = visée** ; 300-500 = haut ; > 500 = trop
   élevé pour gagner du muscle (Murphy & Koehler 2022). Les deux fenêtres sont affichées
   côte à côte ; si elles ne sont pas dans la même zone, le dire plutôt que choisir.
5. **Sommeil : la règle short sleeper du 13-17/08/2026 est conservée.** Le prompt d'origine
   voulait piloter sur la durée et ignorer « la qualité Samsung Health » — erreur de
   contexte : le score n'est pas celui de Samsung, il est calculé nativement depuis les
   phases Health Connect (efficacité + temps endormi). En recomposition, le sommeil devient
   un levier de récupération prioritaire **jugé sur le score qualité/sommeil, jamais sur
   la durée**. Recommandeur et score d'énergie inchangés.
6. **Règles coach : partage code / profil.** Dans le code, attaché à la phase (s'active en
   Recomposition, disparaît en changeant de phase, comme le bloc sèche `tempBlock`) : tout
   ce qui est structurel (voir R4). Dans le contexte permanent (Réglages, sans rebuild) :
   le texte d'objectif personnel. Les seuils chiffrés (kg/sem, taille des paliers) vivent
   dans le moteur R3 — ils sont des constantes documentées, pas du texte libre.
7. **Historique des paliers automatique** (`targetHistory`, nouvelle clé `DATA_KEYS`) : le
   coach ne peut pas appliquer « ignorer la hausse de poids 2 semaines après une hausse »
   sans savoir QUAND les cibles ont changé — l'app ne stocke que les cibles actuelles.
   Alimenté par `saveTargets` (si les kcal de base changent) et par le bouton « Appliquer »
   de R3. Pas d'amorçage à la date du jour (ça créerait à tort une période d'observation).
8. **« Palier de la semaine » = module séparé, PAS le recommandeur de séance.** « Prochaine
   séance » répond à « que fais-je aujourd'hui », ceci à « combien je mange cette semaine ».
   `packages/core/src/palier.js`, pur, même verdict transmis au Coach IA (jamais deux avis).
9. **Proposition FIGÉE par semaine** : calculée une fois le dimanche à partir de 14 h
   (locale), stockée, affichée toute la semaine suivante. Jamais un chiffre recalculé chaque
   jour au gré du bruit de la balance. Bouton **« Appliquer »** = un tap pour écrire les
   cibles + l'entrée `targetHistory`. Rien ne change sans ce tap.
10. **Répartition d'un palier : 75 % glucides / 25 % lipides**, arrondis à 5 g, protéines
    et fibres jamais touchées. **Amendé le 02/10/2026 après le premier usage réel : pas FIXE
    de ±100 kcal** (le +150/+200 initial jugé trop brutal — rétention d'eau, tendons), et un
    changement manuel de cibles ne compte comme palier (ne déclenche l'observation de 14 j)
    que si le changement **net sur la journée atteint 100 kcal** — une retouche protéines/
    glucides à total constant n'en est pas un. Une proposition non appliquée se **recalcule
    immédiatement** si les cibles sont modifiées à la main (un changement manuel est une
    décision, pas du bruit).
11. **Pas de notification dimanche 14 h** (Yoann ouvre l'app tous les jours ; notifs
    proactives déjà écartées le 07/09/2026). Carte sur le **Dashboard, sous « Constats »**.
12. Tendinopathies, Silbernagel, règles escalade/basket, planning hebdo, recommandeur de
    séance : **rien ne bouge**.

## R1 — Phase « Recomposition », fin du poids cible

### Ce qui change
- `packages/core/src/targets.js` : `PHASES.recomposition = { label: "Recomposition",
  target: null, noFallback: true, msg: "Perte de gras lente + prise de muscle. Pas de poids
  cible : pilotage par la moyenne 7 j et le palier de la semaine." }`. `phaseTarget()`
  renvoie `null` pour cette phase (pas de repli `weightMaintenance`).
- `apps/perso/src/App.jsx` : `phaseTarget` local idem. Partout où `tgtW` est affiché, un
  `null` affiche à la place **« moy. 7 j X kg · ±Y kg/sem »** : sous-titre de l'onglet
  Poids, `ReferenceLine` du graphique (masquée), tuile Dashboard, carte Phase des Réglages
  (aucun Stepper de poids cible pour cette phase, le `msg` explique).
- `packages/core/src/coach/prompt.js` (quotidien ET bilan) : `"Phase X, poids cible N kg"`
  devient, si `tgtW == null`, `"Phase Recomposition — pas de poids cible, pilotage par la
  moyenne glissante 7 j"`. `summary.poids` gagne `moy_7j_il_y_a_2_sem` et
  `tendance_kg_sem_precedente`.
- `apps/public/src/Onboarding.jsx` : Pills filtrées sur `k !== "recomposition"` (décision 1).

### Pièges
- `insights.js` (projection fin de sèche) dépend de `targets.cut`, pas de la phase : rien à
  toucher. `recommender.js` lit `isCutWindow`, pas la phase : rien à toucher.
- Le prompt pour `seche`/`maintenance`/`prise` doit rester **identique au caractère près**
  (vérifier par hash avant/après, méthode Phase 0).

### Tests attendus
- Aperçu, phase = recomposition : aucun « cible », tendance 7 j affichée partout, Réglages
  sans Stepper de poids cible. Phase = sèche : strictement comme avant.
- Script Node : `buildCoachPrompt` identique pour les 3 anciennes phases ; pour
  recomposition, `system` sans « poids cible », `summary.poids` avec les 3 semaines.

## R2 — Zone de recomposition (onglet TDEE) + `targetHistory`

### Ce qui change
- `packages/core/src/tdee.js` : `computeTDEE`/`tdeeOverWindow` exposent `intakeMean`
  (déjà calculé en interne, jamais renvoyé). Nouvelle `recompZone(deficit)` → `{ zone, label }`
  selon le barème de la décision 4 (`deficit = tdee − intakeMean`, positif = déficit).
- `TdeeCard` (App.jsx) : section « Zone de recomposition », visible seulement en phase
  recomposition — deux lignes 14 j / 21 j (via `tdeeOverWindow`) avec badge coloré
  (accent = visée, ambre = haut / sous la zone, danger = trop élevé / surplus), et une phrase
  si les deux fenêtres divergent. La ligne « déficit vs cible » existante reste.
- Coach : `summary.depense_estimee.recomposition = { j14: {deficit_reel, zone}, j21: {...} }`
  en phase recomposition seulement.
- `store.js` : `targetHistory` dans `DATA_KEYS`, forme `[{ date, kcal, protein, carbs, fat,
  fiber, source: "manual" | "palier" }]`. `saveTargets` ajoute une entrée si les kcal de
  base (`kcalFromMacros` des 4 macros) diffèrent de la dernière entrée. Transmis au coach
  (`summary.paliers`, 90 j max) avec la consigne « ignorer une hausse de poids dans les 14 j
  qui suivent une hausse de kcal ».

### Tests attendus
- Node : `recompZone` sur chaque seuil et sur les bornes exactes (0, 100, 300, 500).
- Aperçu : historique synthétique où 14 j et 21 j tombent dans des zones différentes → phrase
  de divergence ; changer les cibles dans les Réglages crée une entrée `targetHistory`,
  resauvegarder sans changer les kcal n'en crée pas.

## R3 — « Palier de la semaine »

### Moteur (`packages/core/src/palier.js`, pur, testable en Node)
`recommendTargets({ today, phase, targets, weight, tdee14, tdee21, targetHistory,
loggedRate7 })` → `{ weekOf, action: "hold" | "up" | "down", deltaKcal, proposed: { protein,
carbs, fat, fiber, kcal }, reasons: [...], blocked: null | raison }`.
- **Observation** : si la dernière entrée `targetHistory` a moins de 14 jours → `hold`,
  raison « observation J+N/14 » (bloquant, prime sur tout le reste).
- **Données** : `loggedRate7 < 0,7`, ou 14 j/21 j indisponibles, ou dans des zones non
  adjacentes → `hold` avec la raison. Jamais un chiffre inventé.
- **Hausse** : déficit réel (14 j et 21 j d'accord) entre 300 et 500 → +150 ; > 500 → +200 ;
  OU perte > 0,3 kg/sem sur les 2 dernières semaines (`moy_7j` vs `moy_7j_precedents` vs
  il y a 2 sem) → +150.
- **Baisse** : moyenne 7 j en hausse 2-3 semaines de suite, ou surplus → −100.
- **Sinon** : `hold`, « zone visée, maintenir ».
- Répartition : décision 10. Plafond ±200. Constantes nommées en tête de fichier.
- `weekOf` = lundi suivant le dimanche 14 h courant (arithmétique locale, famille
  `shiftDateKey`, jamais UTC).

### Figement + carte
- Nouvelle clé `palierWeekly` (`DATA_KEYS`) : `{ weekOf, computedAt, result, appliedAt }`.
  Au chargement/retour au premier plan : si `now ≥ dimanche 14 h` et aucune entrée pour le
  `weekOf` à venir → calculer et stocker. Avant dimanche 14 h : afficher l'entrée de la
  semaine en cours, ou « Première proposition dimanche à 14 h ».
- `PalierCard` (Dashboard, sous `InsightsCard`) : titre « Palier de la semaine du lundi X »,
  verdict + raisons chiffrées, cibles proposées vs actuelles, bouton **Appliquer** (écrit
  `targets` + `targetHistory` source `"palier"`, puis « Appliqué ✓ »). Un `hold` n'a pas de
  bouton. Visible seulement en phase recomposition.
- Coach : `summary.palier_semaine` (verdict + appliqué ou non) + consigne : commenter /
  nuancer ce verdict, ne pas en inventer un autre (même contrat que `recommandeur`).

### Pièges
- Dimanche après un match : poids du matin déshydraté — la moyenne 7 j l'absorbe, c'est
  précisément pourquoi aucun poids isolé n'entre dans le moteur.
- Ne pas recalculer si l'app est ouverte plusieurs fois le dimanche : idempotent par `weekOf`.
- « Appliquer » doit passer par `saveTargets` (une seule voie d'écriture des cibles).

### Tests attendus
- Node (≥ 8 scénarios) : perte 0,4 kg/sem × 2 → +150 ; déficit 600 → +200 ; poids en hausse
  3 sem → −100 ; observation J+9 → hold même avec déficit 600 ; 60 % loggé → hold ; 14 j
  « visée » / 21 j « trop » → hold divergence ; répartition +150 → +30 G / +5 L (arrondis) ;
  `weekOf` à dimanche 13 h 59 vs 14 h 01.
- Aperçu : historique synthétique, horloge réelle — vérifier l'état « avant dimanche 14 h »
  et un figement forcé (seed `palierWeekly`), bouton Appliquer → cibles changées, entrée
  `targetHistory` créée, carte en « Appliqué ✓ », Coach IA (`buildBriefing`) montrant le
  même verdict.

## R4 — Bloc de règles Coach IA attaché à la phase

`PHASES.recomposition.coach` (texte) injecté dans le `system` quotidien ET bilan quand
`phase === "recomposition"`, à la place du « poids cible » :
- pas de poids cible, pilotage moy. 7 j ; un poids stable n'est **jamais** un échec (le corps
  change sans que la balance bouge) ;
- déficit visé 100-300 kcal/j réels ; ~500 empêche les gains de masse maigre (Murphy &
  Koehler 2022) ; une progression en force seule ne prouve pas une prise de muscle ;
- après chaque hausse de kcal (dates dans `paliers`), ignorer une petite hausse de poids
  pendant 14 j (eau/glycogène) ;
- surcharge progressive jugée surtout sur le haut du corps ; presse à cuisses et leg
  extension suivent le protocole HSR, volontairement plafonnés par la rééduc du genou — une
  stagnation là-dessus n'est pas un problème à signaler (`progressiveOverloadSuggestion` les
  exclut déjà, mais `exoProgress` les montre encore au coach) ;
- protéines jugées sur la moyenne hebdo contre la cible de l'app ; un dépassement ponctuel
  sans dépassement calorique n'est pas un problème ;
- sommeil = levier de récupération prioritaire, jugé sur le score qualité/sommeil, jamais sur
  la durée (short sleeper) ;
- s'appuyer sur `palier_semaine` et `depense_estimee.recomposition` plutôt que recalculer.
Vérifier par hash que les 3 autres phases produisent un prompt identique.

---

# Chantier S — Recommandeur temporel (spécifié le 04/10/2026)

**Constat de Yoann** (dimanche 21h10, après un match) : « Prochaine séance » affichait Lower C
alors que le lendemain serait un Full Body. Cause : `recommendSessions` ne connaît que la DATE,
jamais l'heure, et ne raisonne que sur le planning du jour — à 21h il propose encore la séance
du matin. Objectif : un recommandeur qui sait quelle heure il est, ce qui reste faisable
aujourd'hui, et ce qui est prévu demain. Deux lots, chacun buildé/testé/commité, install à la
fin. Pour lancer : « GO S1 ».

## Décisions prises (questions posées le 04/10/2026, ne pas rouvrir sans raison)

1. **Créneaux** (habitudes de Yoann, constantes nommées dans le core) :
   - **Matin (< 12h)** : musculation (Upper A/B, Lower A/B/C, Full Body), escalade, mobilité.
   - **Midi (12h-14h)** : escalade ; basket **s'il est au planning** (vendredi midi).
   - **Soir (≥ 14h)** : rien, sauf le **basket au planning** (mercredi soir, ou un match).
   - Un basket planifié (jour hebdo de `basketSchedule.weekly` ou date de `matchDates`) reste
     « faisable aujourd'hui » jusqu'à ce qu'il soit loggé, quelle que soit l'heure.
   - Ce sont des habitudes, pas des règles : rien n'est jamais bloqué à la saisie, seule la
     suggestion affichée change.
2. **Planning idéal = proposition PAR DÉFAUT** (remplace le bonus modéré +18 du 05/09/2026).
   Le type du planning du jour sort en tête dès qu'il n'est pas écarté ; le recommandeur ne
   s'en écarte que pour une raison EXPLICITE (genou, fatigue, déjà fait aujourd'hui, créneau
   passé) et l'affiche. Basket planifié (999) reste au-dessus.
3. **Deuxième séance dans la journée** : après une séance du matin, la carte peut encore
   proposer l'**escalade le midi**, ou le **basket si c'est mercredi ou vendredi** (planning).
   **La mobilité loggée n'est JAMAIS une contrainte** (ne ferme rien, ne compte pas comme
   « séance du jour »). Règles existantes conservées telles quelles, notamment **pas
   d'escalade le jour d'un Upper** (règle coude — signalée à Yoann, conservée par défaut tant
   qu'il ne demande pas de la lever).
4. **Un match loggé ferme la journée** — plus aucune proposition aujourd'hui, sauf la mobilité.
   Un match = une séance Basket loggée à une date de `matchDates`. **Pas de double comptage**
   dans la charge 3 jours (choix de Yoann). Le lendemain, le Full Body modéré s'applique déjà
   (v3.89.0).
5. **Deux lignes en permanence** sur la carte : « Aujourd'hui » (ce qui reste faisable, ou
   « Journée terminée — mobilité possible ») et « Demain · <jour> » (prévision). Exemple de
   Yoann : match fini à 13h → il veut déjà savoir ce qu'il fait le lendemain.
6. **Demain est une prévision** : nuit, douleur genou du matin et score d'énergie de demain
   sont inconnus → nudges sommeil/énergie NON appliqués à l'horizon demain (silence plutôt
   qu'une donnée périmée), mention « sous réserve de ton genou et de ta nuit ». La douleur
   genou d'aujourd'hui compte (relevé frais à J−1). La carte se recalcule le matin.
7. Sécurité inchangée : genou rouge → Lower/Full Body/Basket écartés, quel que soit
   l'horizon ou le planning.

## S1 — Core (packages/core)

- `recommendSessions` reçoit un paramètre optionnel **`asOf`** (date de référence, défaut
  `today()`). Auditer TOUS les `today()` internes au module (`t0`, `isScheduledBasket`,
  `buildZones`, fenêtres) pour qu'ils utilisent `asOf` — sinon « demain » mélangerait deux
  dates. Absent → comportement identique bit pour bit (vérifier par diff sur les scénarios
  existants, méthode Phase 0).
- Nouveau module **`packages/core/src/nextSession.js`** (pur) : `nextSessions({ now, training,
  knee, sleep, targets, scheme, basketSchedule, weeklyPlanFor, energy, ... })` →
  `{ today: { status: "open"|"closed", suggestions, avoid, note }, tomorrow: { date, label,
  suggestions, avoid, caveat } }`.
  - **Aujourd'hui** = `recommendSessions(asOf: aujourd'hui)` puis filtrage par créneaux encore
    ouverts à `now` (décision 1) ; match loggé aujourd'hui → `closed` (seule la mobilité
    reste) ; séances du jour hors mobilité prises en compte pour la décision 3.
  - **Demain** = `recommendSessions(asOf: demain)` avec `weeklyPlan`/`postMatch`/`matchWeek`
    calculés pour demain, sans `energy` ni nudge sommeil (décision 6).
  - `weeklyPlanFor(dateKey)` fourni par l'appelant (le planning idéal vit dans App.jsx) —
    le core reste agnostique du contenu du planning.
- Planning par défaut (décision 2) dans `applyPlanBonus` : le type planifié non écarté reçoit
  `max(scores des autres) + 10` et la raison « Planning idéal du jour » ; plus de +18 fixe.
- Les helpers App (`isMatchWeek`, `familiesForToday`, `isPostMatchDay`) prennent une date en
  paramètre (défaut aujourd'hui).

### Tests attendus (Node, ≥ 10 scénarios)
Dimanche 21h après match loggé → aujourd'hui `closed`, demain Full Body ; dimanche 13h match
loggé → idem ; lundi 10h Full Body loggé → aujourd'hui escalade midi proposable (Lower/Full
Body le matin), demain = planning de mardi ; jeudi 10h Upper loggé → escalade NON proposée
aujourd'hui (règle coude) ; mercredi 15h → aujourd'hui Basket (soir planifié) ; mercredi 22h
basket loggé → `closed`, demain = jeudi Upper ; samedi 15h rien loggé → demain ; mobilité
loggée le matin → ne ferme rien ; genou rouge → Lower/Full Body écartés aujourd'hui ET demain ;
planning par défaut : type planifié en tête même si un autre type a un meilleur score brut ;
`asOf` absent → sorties identiques à avant sur les scénarios Phase 0/1.

## S2 — UI + Coach IA (apps/perso)

- Carte « Prochaine séance » : deux blocs « Aujourd'hui » / « Demain · lundi » (titre de
  demain = jour de la semaine), même style que l'actuelle ; « Journée terminée — mobilité
  possible » quand `closed` ; mention de réserve sous « Demain ». Recalcul à chaque rendu du
  Dashboard + au retour au premier plan (l'heure change).
- Coach IA : `summary.recommandeur` garde `top`/`alternatives`/`a_eviter` pour aujourd'hui et
  gagne `demain: { type, motif }` ; consigne inchangée (commenter, ne pas recalculer). Hash du
  prompt identique quand rien ne change (comparaison avant/après LE MÊME JOUR, `git stash` —
  piège rencontré le 04/10 : une capture d'un autre jour diffère par la date).
- Aperçu : vérifier les 3 cas types de Yoann (dimanche soir après match, lundi matin après
  Full Body, mercredi après-midi) en simulant l'heure (`now` injectable dans `nextSessions`).


---

# Chantier T — Améliorations retenues le 04/10/2026 (tous les points acceptés par Yoann)

Issu d'une revue libre (« quelles améliorations verrais-tu ? »), après la livraison des
chantiers R et S. Ordre décidé : **T1 → T2 → T3 → T4**, T5 en bonus au passage. Une session par
chantier, chacun buildé/testé/commité, install native à la fin de chaque lot. Pour lancer :
« GO T1 ». Mesures prises le 04/10/2026 : 0 test commité, 11 scripts bruts dans
`packages/core/test/wip/` (copiés pour ne pas les perdre), `App.jsx` 3 352 lignes, bundle
838 KB (245 KB gzip — pas un chantier).

## T1 — Tests committés ✅ livré le 04/10/2026 (apps/perso v3.93.0, voir CLAUDE.md)
- `packages/core/test/*.test.mjs` avec `node --test` (aucune dépendance). Script `npm test` à
  la racine, et un hook pre-commit qui le lance (bloquant). Porter les scripts de `test/wip/`
  (remplacer les chemins absolus par des imports relatifs, rendre les dates déterministes via
  `asOf`/`now` plutôt que `today()` quand c'est possible, garder les captures de hash prompt
  comme tests de non-régression datés). Supprimer `test/wip/` à la fin.
- Trois régressions de septembre à transformer en tests nommés : « déjà fait aujourd'hui »
  (14/09), Lower C jamais suggéré (14/09), notes absentes du bilan (07/09).

## T2 — Volume hebdomadaire par groupe musculaire ✅ livré le 04/10/2026 (apps/perso v3.94.0, voir CLAUDE.md)
- Zéro donnée nouvelle : séries COCHÉES des 7 derniers jours, sommées par `groupe` (tag déjà
  présent sur chaque exercice des gabarits + bibliothèque, lu par nom comme `heavyPullDoneOn`).
- Carte dans l'onglet Séances (sous « Progression ») : une ligne par groupe, zone cible
  10-20 séries/semaine pour les groupes prioritaires de Yoann (pecs, épaules), affichage
  neutre pour les autres. Mode « temps » (gainage) exclu du décompte. Le Coach IA reçoit le
  même tableau (`summary.volume_hebdo`).

## T3 — Dashboard actionnable ✅ livré le 04/10/2026 (apps/perso v3.95.0, voir CLAUDE.md)
- La ligne d'alerte « douleur genou pas notée » devient une rangée de chips 0-10 directement
  dans la carte « Prochaine séance » → écrit `kneeLog` (même règle que l'onglet Douleurs :
  aucune valeur présélectionnée). Question « retour à la base ? » posée seulement si douleur
  ≥ 1 (sinon baseline = true).
- Bouton « Démarrer » sur la suggestion du jour : ouvre directement le carnet du type proposé
  (`pickType`), au lieu de l'onglet Séances puis la tuile. Pas de bouton quand la journée est
  fermée.

## T4 — Reps en réserve par exercice ✅ livré le 04/10/2026 (apps/perso v3.96.0, voir CLAUDE.md)
- Choix 0 / 1 / 2 / 3+ **par exercice** (pas par série), optionnel, stocké dans l'entrée
  d'exercice du `trainingLog` (`rir`, additif — aucune migration). Doute explicite de Yoann à
  vérifier à l'usage : utile seulement si rempli honnêtement.
- `progressiveOverloadSuggestion` : une série « stable » avec un RIR qui augmente n'est pas un
  plateau (effort qui baisse = progression) ; `exoProgress` transmet le RIR au Coach IA.

## T5 — Bonus ✅ livré le 04/10/2026 (apps/perso v3.97.0, voir CLAUDE.md)
- Haptique (`@capacitor/haptics`, natif seulement) au cochage d'une série — impulsion brève.
- Champ « alcool (g) » optionnel dans `FreeEntry` (7 kcal/g, déjà le coefficient CIQUAL),
  stocké dans la ligne `foodLog`, remonté au Coach IA (`alcool_g` dans macros hier/aujourd'hui).
  Jamais une macro cible.

---

## Chantier U — Refonte de l'IHM (cadré le 25/10/2026)

Plan validé par Yoann le 25/10/2026. Constat d'audit (lecture du code, v3.109.1) : l'IHM est
du React dans une WebView Capacitor (pas de Compose/XML, hors widget) ; `App.jsx` = 3 486
lignes ; 100 % styles en ligne ; 0 attribut d'accessibilité ; texte majoritairement en
9-11 px ; gris `muted` à 3,5:1 et `dim` à 2,3:1 (minimum lisible 4,5:1) ; 8 onglets en 9 px.

### Décisions prises (ne pas les rouvrir sans raison)
1. **Périmètre : `apps/perso` seul.** `apps/public` plus tard, si ça a du sens (pas par réflexe).
2. **Identité : direction A « Affirmée mûrie » retenue le 25/10/2026 (U2)**, face à
   « Tableau de salle » et « Plein jour » (`docs/refonte-ihm/U2-directions.html`).
3. **Navigation : option A retenue le 25/10/2026 (U1)** : 5 onglets (Aujourd'hui ·
   Séance · Nutrition · Corps · Analyse). Yoann consulte peu Poids, Pas et Douleurs → candidats
   au regroupement dans « Corps ».
4. **Coach IA quitte le Dashboard** → onglet « Analyse » (avec TDEE, progression, Bilan 3 mois).
   Le Dashboard plaît par ailleurs : on l'allège, on ne le réinvente pas.
5. **La règle « tout en style en ligne » est levée** : jetons en variables CSS + classes pour
   les états (toucher, focus, désactivé, transitions). Le style en ligne reste permis pour du
   ponctuel. La section design system de CLAUDE.md sera réécrite à U2.
6. **Widget Android : après, à part** (XML natif, chantier séparé une fois l'identité fixée).
7. **Saisie Macro prioritaire** (c'est là que Yoann écrit le plus) : effacer un champ d'un coup
   (×), clavier numérique pour les quantités + validation par Entrée, modifier une ligne du
   journal sans tout rouvrir, ajouter un habituel / relancer un repas en 1-2 taps.
8. **Lisibilité partout** : texte ≥ 12-13 px, contraste ≥ 4,5:1, cibles tactiles ≥ 44-48 px
   (usage à la salle, mains moites, lumière forte).

### Invariants
- `packages/core` et ses tests ne bougent pas pour des raisons d'IHM (aucune règle métier).
- Aucune clé localStorage renommée ; aucune donnée migrée.
- Une étape = build + `npm test` vert + vérification dans l'aperçu + install + commit.

### Outils retenus
- U0 : ecc:react-patterns. U1 : Lighthouse (chrome-devtools) + `audit-suite` / `ux-ui-audit`
  si installés. U2 : ecc:frontend-design-direction, ecc:design-system, ecc:accessibility,
  UXKIN (références d'écrans réels) si installé. U3 : ecc:make-interfaces-feel-better.
  U4 : mêmes mesures qu'en U1.
- Écartés : Compose / Flutter / React Native (réécriture sans bénéfice), plugin « Mobile
  Design System » (Material 3, effacerait l'identité), ux-superpowers (personas surdimensionnés
  pour un seul utilisateur).

### Ordre des écrans (U3)
1. Barre d'onglets + en-tête · 2. Macro (saisie) · 3. Carnet de séance (`MuscuLogger`) ·
4. Dashboard (allégé, sans Coach IA) · 5. Corps (Poids/Énergie/Pas/Douleurs) · 6. Séances
(liste, progression, volume) · 7. Analyse (TDEE + Coach IA) · 8. Réglages.


### U1 — Audit chiffré (25/10/2026, v3.109.2, aperçu 375 px, jeu de données U0)

Mesuré par script dans l'aperçu (tous les éléments texte visibles de chaque écran, contraste
calculé contre le fond réel) + Lighthouse mobile. **Ce sont les chiffres « avant » que U4
refera à l'identique.**

| Écran | Texte < 12 px | Contraste < 4,5:1 | Cibles < 44 px | Boutons sans nom |
|---|---|---|---|---|
| Tableau de bord | 79 % | 58 % | 13 / 13 | 1 |
| Poids | 58 % | 40 % | 15 / 15 | 2 |
| Énergie | 78 % | 42 % | 11 / 11 | 1 |
| Pas | 81 % | 41 % | 14 / 14 | 1 |
| Séances (liste) | 59 % | 62 % | 22 / 31 | 11 |
| Carnet Upper A | 74 % | 60 % | 42 / 42 | 10 |
| Douleurs | 57 % | 59 % | 25 / 25 | 2 |
| TDEE | 94 % | 43 % | 14 / 14 | 1 |
| Macro | 73 % | 63 % | 34 / 35 | 15 |
| Recherche d'aliment | 71 % | 62 % | 38 / 41 | 16 |

- **Lighthouse accessibilité : 64/100** (bonnes pratiques 100). Échecs : bouton sans nom
  (engrenage), contraste (32 nœuds), et `maximum-scale=1` dans `index.html` qui **bloque le
  zoom** — à retirer en U2/U3.
- **Tailles** : le texte le plus fréquent est en 9-11 px ; 8,5 px pour les sous-libellés des
  tuiles (« / 2470 KCAL », « CIBLE 93 »). Les onglets sont en 9 px, 40 px de haut et **26 à
  62 px de large** (« PAS » = 26 px).
- **Contraste** : deux couleurs font tout l'échec — `muted #6b6b66` à 3,5:1 (sur carte) /
  3,8:1 (sur fond), et `dim #4a4a46` à 2,1-2,3:1. Les remonter suffit pour l'essentiel.
- **Carnet** (le pire endroit, mains moites) : la case de validation d'une série fait
  **26 × 18 px** et touche le × de suppression (**18 × 13 px**) ; les champs reps/poids font
  37 px de haut (`inputMode` numeric/decimal déjà en place) ; chips RIR 30 × 26.
- **Macro** : boutons « Ajouter » d'un repas 215 × 34, icônes voisines 44 × 34 et 39 × 34
  sans nom ; recherche 39 px de haut.
- **Accessibilité** : 0 `className`, 767 `style={{}}`, quasi aucun `aria-*`.

### U1 — Moments d'usage (réponses de Yoann, 25/10/2026)

- **Le matin sur le tableau de bord** : Prochaine séance, score d'énergie, poids et tendance
  (pas Constats/Palier, à replier).
- **À la salle entre deux séries** : minuteur, dernière fois / record, série en cours,
  exercice suivant — tout sans scroller. **Il change d'application entre les séries**
  (Instagram) → d'où la barre « Séance en cours » visible hors du carnet dans les maquettes.
- **Bug trouvé par cette question, corrigé à part (v3.109.3)** : le minuteur du carnet
  retirait 1 s par tic de `setInterval`, ralenti par Android en arrière-plan → retard sur la
  notification. Il se cale maintenant sur l'heure de fin et se recalcule au retour au premier
  plan (`visibilitychange`).
- **Repas** : un mélange — planifiés puis corrigés dans la journée (cohérent avec la
  correction négative de Macro rapide du 07/10).
- **Regroupement Poids/Énergie/Pas/Douleurs** : à décider sur maquette.

**Mesuré sur le téléphone (lecture seule, 25/08 → 25/10/2026, 59 jours de journal)** :
- **Macro est de loin l'écran le plus écrit : 1 230 lignes, soit 20,8 par jour.** C'est ce qui
  justifie de traiter la saisie Macro en premier en U3.
- **30 % des lignes sont saisies en avance** (369 sur 1 230, date du repas après le jour de
  saisie), 70 % le jour même, quasi aucune en rattrapage (2). Le « mélange » de Yoann est
  donc surtout de la planification, puis des ajustements.
- Pics de saisie : 13 h (104 lignes), puis 18 h à 21 h (97 à 125 par heure).
- **20 aliments font 57 % des lignes** (247 aliments distincts) : les habituels en 1 tap
  couvriront plus de la moitié des saisies. 15 % sont des saisies libres (186), 4 % des
  recettes (53), 3 corrections négatives.
- **Séances : 51 sur 80 commencent entre 6 h et 8 h** (salle le matin), basket à 12 h ou
  21 h. Le carnet est donc utilisé tôt, souvent juste après le réveil.

### U1 — Arborescence maquettée

`docs/refonte-ihm/U1-arborescence.html` (publiée en artifact) : 3 options cliquables —
**A** 5 onglets Aujourd'hui · Séance · Nutrition · Corps · Analyse (recommandée), **B**
Énergie garde son onglet + « Plus », **C** 4 onglets + bouton d'ajout central.

**Choix de Yoann le 25/10/2026 : option A** — Aujourd'hui · Séance · Nutrition · Corps · Analyse.
Répartition actée (sert de référence à U3) :
- **Aujourd'hui** : Prochaine séance (+ Démarrer, genou en un tap), Énergie + Poids en tête,
  Calories · Pas · Eau, Constats replié, Palier si proposition. Plus de Coach IA.
- **Séance** : choix du type, carnet, dernières séances, Progression, Volume 7 j, **planning
  idéal** (déplacé depuis TDEE).
- **Nutrition** : l'actuel Macro + **péri-training et protocoles basket** (déplacés depuis TDEE).
- **Corps** : sous-onglets Poids · Énergie · Pas · Genou, le dernier ouvert retenu.
- **Analyse** : Coach IA (Analyser, Bilan 3 mois, note du jour), TDEE, moyenne kcal/protéines.
- **Réglages** : engrenage en haut, inchangé.
- **Barre « Séance en cours »** visible sur les autres onglets tant qu'un carnet est ouvert.

**Précision de Yoann (25/10/2026, U2)** : sur Aujourd'hui, Énergie et Poids restent
au-dessus de « Prochaine séance » (ordre actuel). La maquette U2 les montrait en dessous :
ne pas la suivre sur ce point en U3.

### U2 — Design system v2 (25/10/2026, v3.110.0)

Posé sans changement visible : `apps/perso/src/design/tokens.js` (jetons, source unique),
`design/theme.css` (classes `p-*`, polices embarquées), `T`/`COLORS` ré-exportés par
`ui.jsx`, test de contraste `apps/perso/test/tokens.test.mjs`. L'objet `C` reste en place :
chaque écran migre dans son propre commit en U3. Description complète dans CLAUDE.md,
section design system. **Reste pour U3 (étape 1, barre d'onglets + en-tête)** : retirer
`maximum-scale=1` d'`index.html` (zoom bloqué, échec Lighthouse).

### U3 — avancement
1. ✅ Barre d'onglets + en-tête (25/10/2026, v3.111.0) — 5 onglets, Corps à sous-onglets,
   zoom réautorisé, Lighthouse accessibilité 64 → 94. La barre « Séance en cours » est
   reportée à l'étape 3 (le minuteur doit d'abord vivre au-dessus du carnet).
2. ✅ Saisie Nutrition (25/10/2026, v3.112.0) — habituels en 1 tap + Annuler, « Comme
   hier » à cocher, flèches de jour, ligne modifiable au clavier. Restent en v1 : recettes,
   correction V6, Carte resto, Photo d'un plat.
   **À réévaluer à l'usage** : Yoann n'est pas sûr d'aimer l'ajout d'un habituel en 1 tap
   (dit au commit, 25/10/2026). Repli possible : le tap ouvre la quantité pré-remplie
   (2 taps, option écartée au cadrage).
3. ✅ Carnet + minuteur partagé + barre « Séance en cours » (25/10/2026, v3.113.0) — minuteur
   fixé seulement pendant le décompte, « − série », cases de 52 px. Réveil natif à confirmer à
   la prochaine séance.
4. ✅ Aujourd'hui (25/10/2026, v3.114.0) — Énergie + Poids en tête, Constats repliés, Palier
   seulement s'il propose, Coach IA déplacé dans Analyse. Lighthouse accessibilité 100.
5. ✅ Corps (25/10/2026, v3.115.0) — via design/compat.jsx (primitives v1, rendu v2), échelle
   de douleur en 48 px.
6. ✅ Séances (25/10/2026, v3.116.0) — suppression d'une séance en deux taps, gêne escalade en
   44 px.
7. ✅ Analyse (25/10/2026, v3.117.0) — planning idéal → Séance, péri-training et protocoles
   basket → Nutrition.
8. ✅ Réglages (25/10/2026, v3.118.0) — pastilles du planning basket, cibles macro sur une
   colonne.

**Restent en v1 après U3** (fonctionnels, pas refaits ni mesurés) : création/modification de
recette, correction des valeurs d'un aliment (V6), Carte resto, Photo d'un plat (`nutrition/`).

### U4 — Audit final avant/après (25/10/2026, v3.118.1)

Même fonction de mesure qu'en U1 (tous les éléments texte visibles de la page, en-tête et barre
d'onglets compris ; contraste contre le fond réel ; seuil 3:1 pour le gros texte), même jeu de
données U0 rechargé à l'identique, aperçu 375 px. Les écrans de l'arborescence A remplacent les
anciens onglets (Poids/Énergie/Pas/Douleurs → Corps).

| Écran (avant → après) | Texte < 12 px | Contraste < 4,5:1 | Cibles < 44 px | Boutons sans nom |
|---|---|---|---|---|
| Tableau de bord → Aujourd'hui | 79 % → **0** | 58 % → **0** | 13/13 → **0/15** | 1 → **0** |
| Poids → Corps › Poids | 58 % → **0** | 40 % → **0** | 15/15 → **0/16** | 2 → **0** |
| Énergie → Corps › Énergie | 78 % → **0** | 42 % → **0** | 11/11 → **0/12** | 1 → **0** |
| Pas → Corps › Pas | 81 % → **0** | 41 % → **0** | 14/14 → **0/15** | 1 → **0** |
| Douleurs → Corps › Genou | 57 % → **0** | 59 % → **0** | 25/25 → **0/26** | 2 → **0** |
| Séances (liste) → Séance | 59 % → **0** | 62 % → **0** | 22/31 → **0/40** | 11 → **0** |
| Carnet Upper A | 74 % → **0** | 60 % → **0** | 42/42 → **0/47** | 10 → **0** |
| TDEE → Analyse | 94 % → **0** | 43 % → **0** | 14/14 → **0/9** | 1 → **0** |
| Macro → Nutrition | 73 % → **0** | 63 % → **0** | 34/35 → **0/43** | 15 → **0** |
| Recherche d'aliment | 71 % → **0** | 62 % → **0** | 38/41 → **0/57** | 16 → **0** |
| Réglages (non mesuré en U1) | — | **0** | **0/54** | **0** |

- **Lighthouse mobile, accessibilité : 64 → 100** (bonnes pratiques 100 → 100). Zoom réautorisé.
- Seul correctif fait pendant U4 : les 4 corbeilles « supprimer l'entrée de ce jour » de Corps
  (Poids, Énergie, Pas, Genou) n'avaient pas de nom accessible → `aria-label` ajouté (v3.118.1).
- **Restent en v1, mesurés pour mémoire** (pas refaits en U3) :

| Écran v1 | Texte < 12 px | Contraste < 4,5:1 | Cibles < 44 px | Boutons sans nom |
|---|---|---|---|---|
| Nouvelle recette | 1 % | 1 % | 4/48 | 1 |
| Carte resto | 4 % | 4 % | 3/50 | 1 |
| Photo d'un plat | 4 % | 4 % | 2/49 | 1 |
| Correction des valeurs (V6) | 4 % | 5 % | 7/64 | 0 |

  **Faits le même jour (v3.119.0)** : les 4 passés sur `design/compat.jsx`, et 6 `<div onClick>`
  que la mesure ne voyait pas (elle ne comptait que boutons/champs/liens) changés en boutons. Mesure
  élargie aux éléments au curseur `pointer` : 0 partout, écrans principaux et 9 sous-écrans de Nutrition.

---

## Chantier J — Jeffrey, le majordome (cadré le 29/10/2026)

Demande de Yoann : « plus d'IA dans l'app », qu'elle devienne « un peu mon JARVIS ». Un brief
chaque matin qui arrive tout seul (date, météo, programme du jour, recommandation), un coach qui
pose des questions et à qui l'on répond, à qui l'on peut écrire ou parler à tout moment, et qui
agit dans l'app. Le tout avec la clé et le modèle des Réglages. Cadré par questions le 29/10/2026.

**Ordre retenu** : J0 → JT → J1 (J1.1, J1.2, J1.3) → J2 → J4 → J3 (JT ajouté et J1 découpé le
29/10/2026, choix de Yoann : les textes d'abord, petit lot sans IA ni coût). J4 (notification) a besoin de J2 pour enregistrer les
réponses (genou, note) ; J3 (voix) se branche sur la conversation de J1. Réarrangeable sauf J0 en
premier et J1 avant tout le reste.

### Décisions prises (ne pas rouvrir sans raison)

1. **Le recommandeur n'est PAS remplacé par l'IA.** Il reste le garde-fou : il dit ce qui est
   autorisé (gates genou, tirage du jour, déjà fait, créneaux). Raisons : un modèle ne garantit
   pas qu'il respecte une règle à chaque appel, ça ne se teste pas, ça coûte à chaque affichage
   (la carte se recalcule toutes les 5 min), et ça ne marche pas hors réseau. La carte
   « Prochaine séance » reste 100 % JS, instantanée.
2. **L'IA apporte la nuance** (réponse de Yoann : « il manque de nuance ») : elle **choisit parmi
   les séances autorisées** en tenant compte de ce que Yoann lui dit (fatigue ressentie, temps
   disponible, envie). **L'app vérifie** que la séance choisie est dans la liste autorisée ;
   sinon elle l'ignore et garde le choix du recommandeur. Une séance de `avoid` n'est jamais
   proposée, quoi que le modèle écrive.
3. **Un seul coach, une seule conversation par jour, visible à trois endroits** (réponse de
   Yoann : « un mixte de tout ») :
   - **Bord** : le compte rendu du matin en carte (repliée à quelques lignes), un tap ouvre la
     conversation ;
   - **Analyse** : la conversation complète **remplace la carte Coach IA**. « Analyser » devient
     « Refaire le point » (un message d'analyse complète dans le fil, même contrat que l'analyse
     actuelle). Le Bilan 3 mois reste un bouton à part ;
   - **Partout** : une bulle en bas à droite qui ouvre la conversation par-dessus l'écran
     courant. **Masquée dans le carnet de séance et dans les Réglages** (elle gênerait la saisie).
4. **Mélange point du matin court / conversation libre selon la disponibilité** : le matin,
   1-2 questions avec réponses rapides (boutons) ou réponse écrite dans la notification ; pressé,
   on répond en un tap et c'est fini ; disponible, on ouvre l'app et la même conversation
   continue. On peut lui écrire à toute heure.
5. **Il agit, toujours avec confirmation** : chaque action proposée s'affiche en carte
   « Confirmer / Annuler », rien n'est écrit sans un tap. Les actions passent par les mêmes
   fonctions d'enregistrement que les écrans (jamais une écriture parallèle). Une valeur que l'IA
   a déduite d'un texte libre (« ça tire un peu » → genou 2/10) est **montrée en chiffre** avant
   confirmation : c'est le journal du genou qui pilote les gates.
6. **Modèle : celui des Réglages, et tout passe par LiteLLM** (précisé le 29/10/2026 : c'est le
   fournisseur réglé sur le téléphone). Y compris en arrière-plan, où la WebView sans écran n'a
   pas `CapacitorHttp` : l'appel passe par un **relais HTTP natif** exposé à la page par
   l'interface JS (le serveur ne répond pas au CORS). Coût affiché après chaque réponse, comme
   aujourd'hui. Si le fournisseur est rebasculé sur Anthropic direct dans les Réglages, Jeffrey
   suit le réglage.
   **Si LiteLLM ne répond pas** (serveur saturé, refus « trop de requêtes » vus le 26/10) :
   Jeffrey réessaie quelques minutes, puis envoie un **brief court sans IA** (date, planning du
   jour, séance du recommandeur, ce qui manque) en le disant (« Mon cerveau est en grève ce
   matin, Monsieur ; voici l'essentiel »). **Pas de bascule automatique sur Anthropic direct.**
7. **Météo : position du téléphone, mais jamais lue en arrière-plan.** L'app note la position
   approximative (arrondie à ~1 km) à chaque ouverture, au premier plan seulement ; le brief du
   matin utilise la dernière connue. Pas de permission de localisation en arrière-plan (la plus
   intrusive d'Android). Météo via Open-Meteo (gratuit, sans clé). **Les coordonnées ne partent
   qu'à Open-Meteo** : le modèle ne reçoit que la météo (températures, pluie par créneau), jamais
   la position.
8. **Il répond à l'écrit ET à voix haute** ; la voix et la façon de répondre sont réglables.
9. **Personnalité : Jeffrey**, un majordome (inspiration Geoffrey du *Prince de Bel-Air* et Alfred
   de *Batman*, sans les citer ni les imiter) : vouvoiement, appelle Yoann « Monsieur », langage
   châtié, flegme britannique, bienveillant mais taquin. Texte de personnalité éditable dans les
   Réglages (amorcé avec la version ci-dessous), séparé du « contexte permanent » du coach.
10. **L'app est Jeffrey** (29/10/2026) : c'est lui qui écrit, qui notifie, qui répond.
    - **Toutes les notifications** dans sa voix : brief, demandes de ce qui manque, fin de repos,
      rappel de sauvegarde, et les futures. La fin de repos reste **très courte** (lue entre deux
      séries) : quelques variantes qui tournent, jamais une phrase longue.
    - **Les messages de l'app** dans sa voix : confirmations (« Ajouté, Monsieur. »), erreurs,
      écrans vides. Ce sont des **textes fixes écrits à l'avance** (variantes tirées au hasard),
      **sans appel à l'IA**, donc gratuits et instantanés. Les libellés (Protéines, Poids…) et
      les chiffres ne changent pas.
    - **Il ne parle pas à chaque action** : un ajout donne une confirmation écrite, jamais de voix.
    - Nom et icône de l'app : **inchangés** (« Protocole »), non retenus à ce stade.
11. **La voix seulement au casque, à la salle** (29/10/2026) : lecture à voix haute
    automatique **uniquement si un casque (filaire USB-C ou Bluetooth) est connecté ET qu'une
    séance est en cours** (brouillon du carnet actif). Jamais par le haut-parleur, jamais quand
    Yoann travaille, dort ou regarde la télé. Hors de ce cas : texte seul, avec un bouton
    haut-parleur sur chaque message pour écouter volontairement. Détection du casque : même code
    que `RestAlarmReceiver` (types filaire, USB, Bluetooth).
    **Exception : la conversation qu'il lance lui-même** (précisé le 29/10/2026). Quand Yoann
    parle à Jeffrey (bouton micro), Jeffrey lui répond à voix haute, avec ou sans écouteurs,
    haut-parleur compris : il a choisi de parler, il attend une réponse parlée. Quand il écrit,
    Jeffrey répond par écrit. Règle simple : **il répond comme on lui a parlé**. Le garde-fou
    casque + séance ne vise que ce que Jeffrey dit **de lui-même** (brief, relances,
    notifications).
12. **Le brief attend la nuit, la pesée et le genou, jusqu'à 10 h** (29/10/2026). Il dit ce
    qu'il lui manque dans **une seule notification mise à jour sur place** (pas de sonnerie à
    chaque mise à jour) : « Bonjour Monsieur. J'ai votre nuit ; il me manque votre pesée et
    votre genou. » **Une seule relance sonore, vers 9 h** si quelque chose manque encore. À
    **10 h**, brief avec ce qu'il a, en disant ce qui manquait. Dès que tout est là, brief
    aussitôt.
13. **Le genou se donne en écrivant dans la notification** (29/10/2026) : Yoann tape « 2 »,
    Jeffrey enregistre 2/10 puis demande « Retour à la base sous 24 h ? » avec deux boutons
    Oui / Non. Un chiffre tapé est une saisie explicite (pas une déduction de l'IA), donc pas de
    confirmation supplémentaire. Même chemin d'enregistrement que l'onglet Genou. Si la pesée
    manque encore à 9 h, la même réponse écrite accepte un poids (« 93,8 », enregistré en
    saisie manuelle).

### Personnalité d'amorçage (clé `jeffreyPersona`, éditable)

> Vous êtes Jeffrey, le majordome de Monsieur. Vous le vouvoyez toujours et l'appelez
> « Monsieur ». Langage châtié, phrases courtes et élégantes, flegme britannique. Vous avez le
> sens de l'humour : traits d'esprit, understatement, pince-sans-rire, une vraie blague quand
> l'occasion s'y prête. Taquin, volontiers cynique, et ce en toute circonstance, mais toujours
> avec une bienveillance évidente derrière la pique : on doit sentir que vous êtes de son côté.
> Ne répétez pas la même plaisanterie d'un message à l'autre. Vous ne flattez pas et ne
> dramatisez pas : vous constatez, vous conseillez, vous laissez Monsieur décider.

**Deux règles qui priment sur la personnalité** (dans le code, pas dans le texte éditable,
validées par Yoann le 29/10/2026) : **le ton ne change jamais les faits ni les garde-fous** ;
**une alerte est toujours dite clairement**, sans détour stylistique (une phrase nette, l'humour
éventuellement après). Ordre dans le `system` : règles du coach > ces deux règles > personnalité.
La taquinerie est permise partout, y compris sur la douleur et le sommeil (choix de Yoann, qui a
retiré les deux interdits proposés). Ce qui reste vrai par la première règle : une nuit courte
n'est pas un problème (short sleeper, seul le score de qualité compte), donc Jeffrey peut en
plaisanter sans jamais la présenter comme un signal de fatigue ; un genou hors base reste une
séance écartée, quelle que soit la tournure de la phrase.

### J0 — Test jetable : le brief préparé app fermée

La question qui décide de l'architecture de J4. Toute la logique (recommandeur, score d'énergie,
planning, prompt) est en JavaScript, et Android ne la fait pas tourner app fermée.

- **Piste A (à tester en premier)** : un réveil Android lance un travail en arrière-plan qui crée
  une WebView sans écran, charge l'app avec un drapeau (`?brief=1`), et laisse le JS calculer,
  appeler l'API et poster la notification. Même origine que l'app, donc même localStorage. Zéro
  logique dupliquée.
- **Piste B (repli)** : l'app écrit le contexte du lendemain à chaque fermeture ou passage en
  arrière-plan (elle sait déjà calculer « demain », c'est la ligne Demain de la carte), et un
  travail Kotlin complète le matin avec la nuit et la pesée lues dans Health Connect, puis
  appelle l'API. Coût : un peu de logique en double côté Kotlin.
- **Critères de réussite de A**, app tuée (`am kill`), écran verrouillé : la WebView lit le
  localStorage, `fetch` vers l'API passe, un plugin (Health Connect, notification) répond, le
  tout en moins de ~1 min et sans afficher d'activité. Mesurer aussi la batterie.
- Jetable : rien n'est commité de la piste perdante. Résultat documenté ici.

**Résultat (29/10/2026, sur le téléphone, app tuée par `am kill`, écran d'accueil au premier
plan) : piste A validée, mais pas avec le déclencheur prévu.**

- **WorkManager : échec.** La tâche (`OneTimeWorkRequest`, délai 60 s) est restée en attente plus
  de 8 min, et même `cmd jobscheduler run -f` ne l'a pas lancée. `dumpsys jobscheduler` :
  `Ready: false`, `readyNotRestrictedInBg: false`, alors que l'app n'a aucune restriction réglée
  (`RUN_ANY_IN_BACKGROUND` à `allow`, compartiment de veille 10 = actif). La gestion d'énergie de
  Samsung retient les tâches d'une app fermée. **Ne pas construire le brief sur WorkManager.**
- **Réveil système (`AlarmManager.setAlarmClock`, comme le minuteur de repos) : réussite.** Il a
  sonné à la seconde près (11:02:58), Android a relancé l'app sans rien afficher, et un
  `BroadcastReceiver` (`goAsync`) a chargé une page de l'app dans une **WebView sans écran**
  (créée avec le contexte de l'application, jamais affichée). Mesures : origine
  `https://localhost` (la même que Capacitor, donc **le même localStorage** : 32 clés lues,
  dernière pesée lue), fichiers de l'app servis par `WebViewAssetLoader` (domaine `localhost`,
  dossier `assets/public/`), `fetch` vers l'API Anthropic en 200 avec la clé des Réglages,
  réponse rendue à Kotlin par `addJavascriptInterface`, notification postée. **1,0 s au total**
  (0,8 s dans la page). Rien à l'écran pendant le test.
- **Ce que ça décide pour J4** : réveil `setAlarmClock` → récepteur → WebView sans écran qui
  charge une **page dédiée** (entrée Vite séparée qui importe `packages/core` et lit le
  localStorage, sans monter l'app React). Toute la logique reste en JavaScript, rien n'est
  dupliqué en Kotlin.
- **Non vérifié par J0, à traiter en J4** :
  - **Durée.** Un récepteur réveillé en arrière-plan n'a qu'environ une minute ; un brief en
    Opus 5.5 (réflexion comprise) peut en prendre autant. Prévoir un service au premier plan
    court lancé depuis le réveil (le réveil exact autorise ce démarrage), avec une notification
    discrète pendant la préparation.
  - **LiteLLM.** Les Réglages du téléphone sont sur `litellm` ; le test a appelé Anthropic direct
    (la clé Anthropic est aussi présente). Depuis la WebView sans écran, `fetch` vers le serveur
    LiteLLM sera bloqué par le CORS (déjà constaté le 26/10) et `CapacitorHttp` n'existe pas
    hors de l'app : il faudra un relais HTTP natif exposé par l'interface JS.
  - **Les plugins Capacitor ne sont pas disponibles** dans cette WebView (pas de pont). Health
    Connect (nuit, pesée) se lit côté Kotlin avant de charger la page, comme le widget, et se
    passe à la page par l'interface JS.
  - **Bruit sans gravité** : `WebViewAssetLoader` journalise une exception pour un fichier absent
    (probablement `favicon.ico`) ; servir une réponse vide pour les fichiers manquants.
- Code de test retiré du dépôt après la mesure (les deux essais, la page de test et les
  dépendances `work-runtime-ktx`/`webkit`) ; le téléphone a été réinstallé sans.

### J1 — La conversation

- **`packages/core/src/coach/jeffrey.js`** (pur, testé) : construit le `system` (règles + sécurité
  + persona) et le contexte (réutilise les faits déjà calculés de `buildCoachPrompt` : temps
  réel, résumé 14 j, recommandeur, séances autorisées/interdites aujourd'hui et demain,
  carnet). Ordre pensé pour le cache : parties stables d'abord, temps réel en dernier.
- **Outils (tool use) plutôt que JSON libre** : `choisir_seance(type, raison)` (validé contre la
  liste autorisée), `proposer_reponses(options[])` (2 à 4 réponses rapides affichées en boutons),
  et à partir de J2 les actions. Le texte de la réponse s'affiche au fil de l'eau (streaming) —
  Opus 5.5 réfléchit avant de répondre, l'attente doit se voir le moins possible.
- **Cache de l'API** (`cache_control`) sur le préfixe stable : à partir du 2e message d'une
  conversation, l'entrée coûte ~10 % du prix. À mesurer sur le `usage` réel, jamais estimer.
- **Mémoire** : la conversation de la veille est résumée dans le carnet de bord existant
  (`coachJournal`, mécanisme `---CARNET---`) au premier appel du jour (le brief), dans le même
  appel. Le lendemain, il s'en souvient sans tout relire.
- **Données** : `jeffreyLog` (fils par jour, 30 j glissants — consultables, ajouté à
  `DATA_KEYS`), `jeffreyPersona` (`DATA_KEYS`). Compteur de coût du mois affiché dans les
  Réglages (`aiSpend`, `{ month, cents }`, `DATA_KEYS`).
- Note du jour conservée (Jeffrey peut aussi l'écrire via une action en J2).
- **Carte « compte rendu » sur Bord (tranché le 29/10/2026)** : tout en haut, au-dessus
  d'Énergie et Poids, **jusqu'à midi** ; l'après-midi elle passe sous les tuiles, repliée en
  une ligne (un tap la déplie ou ouvre la conversation).
- **Réponse au fil de l'eau (tranché le 29/10/2026) : relais Android maison.** Un plugin Kotlin
  fait la requête vers LiteLLM et lit la réponse en flux (événements SSE de `/v1/messages`
  avec `stream: true`), puis la renvoie morceau par morceau à la page. Le même relais sert au
  brief en arrière-plan (J4), via l'interface JS de la WebView sans écran. Rien à changer sur
  le serveur Oracle.
- **Découpage** : J1.1 relais + `jeffrey.js` + tests (rien de visible, sauf un essai réel sur le
  serveur) ; J1.2 conversation dans Analyse (remplace la carte Coach IA) ; J1.3 bulle partout,
  carte sur Bord, mémoire dans le carnet, compteur de coût. Une installation par lot.
- **À vérifier au début de J1.1** : le serveur LiteLLM répond-il enfin sur Opus 5.5 / Sonnet
  5.5 ? Le 26/10, tout sauf Haiku 4.5 renvoyait un refus « trop de requêtes ».
- Tests : validation du choix de séance (hors liste → ignoré), règles de ton présentes dans le
  `system`, capture datée du prompt.

**J1.1 livré (29/10/2026, v3.127.0) — essai réel sur le téléphone avec le serveur LiteLLM,
Opus 5.5, vraies données :**
- Le serveur répond de nouveau sur Opus 5.5 (1,1 s) et Sonnet 5.5 (1,9 s), plus seulement Haiku.
- Chaîne complète validée : requête de Jeffrey → relais Android → LiteLLM → flux SSE relu. Premier
  mot après **7 à 11 s** (réflexion d'Opus), réponse complète en **11 à 16 s**. Outils appelés
  correctement (`choisir_seance` dans la liste autorisée, `proposer_reponses`). Deuxième tour avec
  `tool_result` et réflexion signée renvoyée : accepté par l'API.
- **Cache** : premier message ~9 600 tokens écrits (**≈ 6,9 ¢**), messages suivants **≈ 9 500 lus,
  ~600 écrits : ≈ 2,2 ¢**. Deux corrections faites à la suite de l'essai : (1) l'heure sortie du bloc
  de données (elle le réécrivait à chaque minute) et mise en tête du dernier message ; (2) le coût
  compte désormais une écriture dans le cache à 125 % du tarif d'entrée (`costCents`).
- **Réponse muette** : au 2e tour, Opus a répondu deux fois uniquement par des boutons, sans
  texte, malgré la consigne (même renforcée). Filet `continuationIfSilent` : l'app relance
  aussitôt « répondez par écrit » → réponse correcte, **≈ 1,8 ¢** de plus. À câbler en J1.2.
- **Fuite de la clé LiteLLM dans le journal Android** : en version de développement, Capacitor
  recopiait les arguments de chaque appel de plugin dans le journal, y compris l'en-tête
  d'autorisation (vrai pour tous les appels LiteLLM depuis le 26/10). Coupé par
  `loggingBehavior: "none"` (capacitor.config.json). Yoann invité à remplacer sa clé.
- **Écran en veille = réseau coupé** : un essai lancé écran éteint échoue (« délai de connexion
  dépassé ») et l'inspection du téléphone se fige. Pour J4 (brief app fermée), c'est le réveil
  système qui garantit le réseau ; à vérifier à ce moment-là.
- **À mesurer en J1.2** : sur une réponse courte, le texte est arrivé presque d'un bloc après la
  réflexion (sur les longues, il s'étalait sur 3-5 s). Possible mise en tampon par le serveur ou
  la lecture côté Android.

**J1.2 livré (29/10/2026, v3.128.0) — conversation dans l'onglet Analyse.** Décisions prises par
question avant de coder : « Faites-moi le point » remplace « Analyser » (point complet dans sa voix,
300 mots, et **mise à jour du carnet de bord** comme avant) ; le **bilan 3 mois passe dans sa voix**
(mêmes calculs sur 90 jours) ; **réflexion réduite** (`effort: low`) pour la conversation, normale
(`medium`) pour le point et le bilan.
- Écran `screens/perf/JeffreyChat.jsx` à la place de la carte Coach IA (fichier `CoachIA.jsx`
  retiré) : conversation du jour, réponse au fil de l'eau, carte de séance avec « Démarrer » si
  c'est pour aujourd'hui, réponses rapides en pastilles, coût par réponse et total du jour, note du
  jour conservée (repliée). Relance automatique d'une réponse muette, invisible pour Monsieur.
- Nouvelles clés dans `DATA_KEYS` : **`jeffreyLog`** (`{ "AAAA-MM-JJ": [messages] }`, 30 jours
  glissants) et **`jeffreyPersona`** (amorcée avec `JEFFREY_PERSONA`, même règle que le profil du
  coach : `null` = jamais amorcée). Carte **« Jeffrey · personnalité »** dans les Réglages, avec
  « Rétablir la personnalité d'origine ».
- Une réponse en cours s'enregistre même si Monsieur change d'onglet (écriture par App).
- **Vérifié dans l'aperçu** (réponses simulées, aucun appel réseau, 360 px) : texte au fil de l'eau,
  carte de séance, réponses rapides (le résultat d'outil dit « Monsieur a touché « Parfait » »),
  relance d'une réponse muette, changement d'onglet en pleine réponse, personnalité amorcée et
  rétablie, aucun débordement. **Essayé en vrai par Yoann sur le téléphone le jour même : « ça
  fonctionne »** (saisie au clavier, dictée possible par le micro du clavier Samsung en attendant J3).
- **Non fait, prévu en J1.3** : bulle sur tous les onglets, carte sur Bord, mémoire de la
  conversation de la veille dans le carnet, compteur de coût du mois. Conversations des jours
  précédents : enregistrées mais pas encore consultables à l'écran.

**J1.3 livré (29/10/2026, v3.129.0).**
- **Bulle « Parler à Jeffrey »** (`components/JeffreyBubble.jsx`, icône de sonnette de majordome) en
  bas à droite de la zone de contenu, donc toujours au-dessus de la barre « Séance en cours » et
  des onglets ; elle remonte de la hauteur du bandeau « Annuler » de Nutrition (`--undo-bar-h`).
  Masquée dans Analyse (la conversation y est), dans les Réglages et pendant un carnet ouvert.
  Ouvre **`components/JeffreyOverlay.jsx`** : la même conversation par-dessus l'écran, fermée
  par la croix (pas de gestion du bouton retour d'Android : en ajouter une changerait son
  comportement partout). « Démarrer » depuis la conversation ferme la surimpression.
- **Carte du Bord** (`screens/dashboard/JeffreyCard.jsx`) : avant midi, tout en haut (dernier
  message du jour + « Continuer la conversation », ou « Faites-moi le point » s'il n'a encore
  rien dit, qui ouvre la conversation et lance le point) ; l'après-midi, une ligne sous les tuiles.
  En attendant le brief du matin (J4).
- **Mémoire** (`pendingMemoryDate`, `memoryTranscript`, `withMemory` dans `coach/jeffrey.js`) : la
  conversation du dernier jour passé non encore versée part avec le premier message suivant
  (6 000 caractères au plus, messages cachés exclus), et Jeffrey réécrit son carnet dans la même
  réponse — pas d'appel en plus. Marqueur **`jeffreyMemoryDate`, hors `DATA_KEYS`** (comme
  `lastCloudBackup`). Si le carnet ne revient pas, la mémoire repart au jour suivant.
- **Coût du mois** : clé **`aiSpend`** (`{ month, cents }`, dans `DATA_KEYS`), alimentée par
  `recordSpend` (Jeffrey, Carte resto, Photo d'un plat), affichée dans Réglages › IA. Compte à
  partir du 29/10/2026.
- **Vérifié dans l'aperçu** (360 px, réponses simulées) : bulle présente sur Bord et Nutrition,
  absente dans Analyse ; surimpression ouverte et fermée ; mémoire envoyée au 1er message puis plus
  jamais, carnet mis à jour et retiré du texte affiché, marqueur posé ; coût du mois additionné ;
  carte en haut à 9 h simulées, repliée l'après-midi. **Pas vérifié** : la variante matin « Faites-
  moi le point » d'une journée sans message (la simulation d'heure ne survit pas au rechargement).
- **Calories du jour** ajoutées aux données de Jeffrey (et du bilan/briefing qui partagent
  `buildCoachPrompt`) : `kcal` et `cible_kcal`. Jeffrey l'avait signalé lui-même dans une vraie
  conversation de Yoann.

### J2 — Actions confirmées

Liste fermée d'outils, chacun mappé sur la fonction d'écran existante : ajouter de l'eau,
enregistrer la douleur genou (+ retour à la base), écrire la note du jour, démarrer une séance
(ouvre le carnet comme le bouton « Démarrer »), reprendre un repas d'hier (`copyEntries`),
ajouter un aliment habituel à sa dernière quantité. Chaque appel d'outil → carte
« Confirmer / Annuler » dans le fil ; le résultat est renvoyé au modèle (`tool_result`) pour qu'il
enchaîne. Annuler n'écrit rien. Tests : chaque outil produit exactement la même écriture que
l'écran correspondant.

**J2a livré le 29/10/2026 (v3.130.0)** : eau, genou, note du jour. Outils `ajouter_eau`,
`noter_genou`, `ecrire_note` ; validation bornée côté app (`validateAction`) ; écritures en
fonctions pures testées, identiques à celles des écrans (`applyWater`, `applyKnee`, `appendNote`) ;
carte « Confirmer / Annuler » (genou sans réponse sur la base : « Oui / Non / Annuler ») ; après
le tap, phrase fixe et `tool_result` mis à jour, aucun nouvel appel à l'IA. « Démarrer une séance »
était déjà couvert par `choisir_seance` (J1.2). **Reste J2b** : reprendre un repas d'hier
(`copyEntries`) et ajouter un aliment habituel — à écrire dans `foodLog` ET à dériver dans
`macroLog` depuis App, l'onglet Nutrition (qui fait la dérivation M6) n'étant pas forcément monté.
Correctif v3.130.1 : Jeffrey recomptait une eau déjà ajoutée (aucune double écriture). Ses données comptent déjà les actions confirmées : c'est désormais dit dans ses règles et en tête des données, et le résultat d'une eau confirmée donne le nouveau total.
Correctif v3.130.2 : la relance d'une réponse sans texte part avec les outils interdits (`tool_choice: none`), donc toujours une réponse écrite.

**J2b livré le 29/10/2026 (v3.131.0)** : `reprendre_repas` (même repas d'hier → aujourd'hui) et
`ajouter_habituel` (nom donné par Jeffrey, retrouvé parmi les habituels de ce repas, dernière
quantité). Carte en tout ou rien. Journal écrit par App avec macros du jour dérivées, et événement
`FOOD_LOG_EVENT` pour qu'un onglet Nutrition ouvert relise le journal. **J2 terminé.**

### J4 — Le brief du matin en notification

- **Déclencheur : un réveil système** (`setAlarmClock`, validé par J0 ; WorkManager est retenu
  par Samsung app fermée). À partir de 6 h, réveils successifs (~toutes les 20 min) qui lisent
  Health Connect côté Kotlin : nuit du jour, pesée du jour ; et le genou dans le localStorage.
  Tout est là → brief. Sinon, la notification « il me manque… » est mise à jour en silence
  (décision 12), relance sonore unique vers 9 h, brief avec ce qu'il a à 10 h (sans jamais
  inventer une nuit ou une pesée). Un service au premier plan court, lancé depuis le réveil,
  couvre l'appel à l'IA (notification « Je prépare votre brief, Monsieur. » pendant ce
  temps). **Si l'app est ouverte avant**,
  le brief est généré dans l'app (carte sur Bord) et aucune notification ne part — jamais deux
  appels payés pour le même matin.
- **Contenu** : salutation datée, météo du jour (créneaux de séance), nuit (score de qualité,
  jamais la durée seule), énergie, pesée/tendance, planning du jour + séance proposée (choisie
  parmi les autorisées), 1-2 questions (genou si pas noté, ressenti), un rappel utile si
  pertinent (sauvegarde en retard, palier de la semaine).
- **Notification de conversation Android** (style messagerie) : 3-4 lignes visibles, boutons de
  réponse rapide, « Répondre » (réponse écrite dans la notification), « Ouvrir ». Une réponse
  dans la notification appelle l'API en arrière-plan et la réponse de Jeffrey s'affiche dans la
  même notification ; une action à confirmer (genou 2/10) apparaît en bouton « Confirmer ».
- Nouveau canal de notification « Jeffrey », désactivable dans les réglages Android.

**J4.1 livré le 29/10/2026 (v3.132.0)** : le brief du matin (sans météo ni réponse dans la
notification). Choix de Yoann : 5 h 17 puis toutes les 20 min, tous les jours, brief dans l'app
si elle est ouverte avant. Architecture J0 : réveil exact (`setExactAndAllowWhileIdle`, sans icône)
→ récepteur → Health Connect lu en Kotlin (`HealthReads.kt`) → page `brief.html` sans écran qui
décide (`core/coach/brief.js`) et écrit le brief avec le même tour que la conversation
(`lib/jeffreyTurn.js`). Essai réel : l'économie d'énergie coupe le réseau des apps en
arrière-plan, d'où un service au premier plan court (`BriefService.kt`, `shortService`) le temps
de l'appel. Le brief s'écrit sans outils (`tool_choice: none`) : un seul appel, 8 s au réel ;
la carte de séance et les réponses rapides reviendront dans la notification avec J4.3.

**J4.2 livré le 29/10/2026 (v3.133.0)** : météo Open-Meteo par créneau (matin, midi, après-midi,
soir) dans le brief ; position approximative notée à l'ouverture seulement (`ACCESS_COARSE_LOCATION`,
arrondie à ~1 km, clé `lastPosition` hors sauvegarde), jamais transmise à l'IA. **Reste J4.3
(répondre dans la notification).**

### J3 — La voix

- **Dictée** : bouton micro dans la conversation, reconnaissance vocale d'Android en français
  (le micro du clavier Samsung marche déjà en attendant). **Pas de mot de réveil** (« Hé
  Jeffrey » à tout moment) : micro en écoute permanente, coûteux en batterie et fragile.
- **Réponse lue à voix haute** : synthèse vocale d'Android (gratuite, hors ligne). Réglages :
  choix parmi les voix françaises installées sur le téléphone, vitesse, hauteur, bouton
  « Tester ». **Lecture automatique de ce qu'il dit de lui-même seulement casque connecté ET
  séance en cours** (décision 11), sinon bouton haut-parleur par message. **Réponse à une
  question posée au micro : toujours à voix haute**, casque ou haut-parleur (il répond comme on
  lui a parlé ; une question écrite reçoit une réponse écrite).
- **Limite à dire à Yoann** : un vrai « majordome britannique qui parle français » n'existe pas
  dans les voix d'Android ; une voix premium (service de synthèse payant, autre clé) est hors
  périmètre, à rouvrir s'il trouve les voix Android trop plates.

### Coût attendu (à remplacer par la mesure réelle)

Brief : quelques centimes par matin avec Opus 5.5. Conversation : surtout la sortie, l'entrée
étant en cache à partir du 2e message. En discutant chaque jour, peut-être 3 à 6 $/mois —
surveiller le crédit Anthropic. Le compteur `aiSpend` donnera le vrai chiffre.

### Hors périmètre

`apps/public` (aucun de ces écrans) ; mot de réveil vocal ; voix premium payante ; Jeffrey qui
modifie les cibles, le planning ou les gabarits de séance (les actions restent celles de J2).
