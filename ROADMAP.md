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
| V4 | Détection de record sur une série | petit | à faire |
| V5 | Escalade : suivi des blocs | moyen | à faire |
| V6 | Corriger les valeurs d'un aliment | petit | à faire |
| V7 | Dépense énergétique adaptative (TDEE calculé) | gros | à faire |

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

**Yoann ne fait que du bloc** (confirmé le 03/08/2026). Pas de sélecteur bloc/voie,
pas d'échelle française de cotation de voie — une seule échelle, Fontainebleau.
Ne pas réintroduire la notion de « voie » sans demande explicite.

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

### Décision à confirmer avant de coder

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

*À lancer quand il y aura au moins 2-3 semaines de journal alimentaire complet.*

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
