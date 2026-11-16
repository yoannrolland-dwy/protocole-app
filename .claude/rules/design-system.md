---
paths:
  - "apps/perso/src/design/**"
  - "apps/perso/src/components/**"
  - "apps/perso/src/screens/**"
  - "apps/perso/src/**/*.css"
---

### Design system v2 — direction A « Affirmée mûrie » (U2, 25/10/2026)

Choisie par Yoann sur maquettes (`docs/refonte-ihm/U2-directions.html`, face à « Tableau
de salle » et « Plein jour »). C'est l'identité Affirmée gardée (noir, citron, chiffres en
monospace), corrigée pour la lisibilité mesurée à l'audit U1.

- **Source unique des jetons : `apps/perso/src/design/tokens.js`** (JS pur). `applyTheme()`
  (appelé dans `main.jsx`) les pose en variables CSS : `--c-*` couleurs, `--f-*` polices,
  `--t-*` tailles, `--s-*` espacements, `--r-*` rayons, `--touch`. `T` (ré-exporté par
  `ui.jsx`) donne les mêmes jetons en `var(--…)` pour le style en ligne ; **dans un attribut
  SVG (fill/stroke de recharts), passer `COLORS.x`**, `var()` n'y fonctionne pas.
- **Couleurs** : fond `#050505` · carte `#131312` · relief `#22221f` · champ `#0b0b0a` ·
  filets `#34342f` / `#262623` · texte `#f5f5f0` · secondaire `#bdbdb4` (9,8:1) · discret
  `#96968d` (6,2:1) · accent citron `#d7ff3f` (texte posé dessus `#0a0a0a`) · bordure de
  carte mise en avant `#4a5a12` · alerte `#f2a33a` · danger `#ff5a4f`. **Le citron reste le
  seul accent**, réservé aux actions et à ce qui compte aujourd'hui. Les anciens gris
  `#6b6b66` / `#4a4a46` (3,5:1 et 2,1:1) ne doivent plus servir de couleur de texte.
- **Contraste garanti par un test** : `apps/perso/test/tokens.test.mjs` (lancé par
  `npm test`, donc par le hook pre-commit) exige 4,5:1 sur chaque paire texte/fond déclarée
  dans `TEXT_PAIRS`. Ajouter une couleur de texte = l'ajouter à `TEXT_PAIRS`.
- **Typographie** : Instrument Sans (texte) et JetBrains Mono (TOUS les chiffres), embarquées
  via `@fontsource` (l'app tourne hors ligne, 116 Ko au total, sous-ensemble latin). Échelle
  `TYPE` : libellé 12 (capitales, interlettrage large) · secondaire 13 · texte 15 · saisie et
  boutons 16 · titre 20/22 · chiffres 22/34/40. **Rien sous 12 px.**
- **Toucher** : cible minimale 48 px (`TOUCH`), boutons et champs principaux 52 px.
- **Classes `p-*`** (`design/theme.css`) pour ce que le style en ligne ne sait pas faire :
  `p-tap` (retour au toucher, focus visible, désactivé à 45 %, transitions 120 ms coupées si
  « réduire les animations »), `p-btn` + `--primary/--outline/--plain/--danger/--block`,
  `p-chip` (`aria-pressed`), `p-field`, `p-card` (+ `--key`, `--danger`), `p-label`, `p-num`,
  `p-sec`, `p-muted`. **La règle « tout en style en ligne » est levée** (décision 5 du
  chantier U) ; le style en ligne reste permis pour du ponctuel.
- **État après U3/U4** : tous les écrans de l'arborescence passent par `design/primitives.jsx` ou
  `design/compat.jsx` (mêmes noms que les primitives v1, valeurs v2) ; depuis v3.119.0 plus aucun
  écran ne passe par les primitives v1 de `ui.jsx`. Un `onClick` va sur un `<button>`, jamais sur
  un `<div>` (les mesures d'accessibilité ne voient pas un `div` cliquable).
- **Migration écran par écran (U3)** : l'ancien objet `C` et les primitives de `ui.jsx`
  (`Card`, `Label`, `Btn`…) restent tels quels tant qu'un écran n'est pas refait, pour que
  chaque écran change dans son propre commit et sa propre installation. Ne pas modifier `C`
  globalement : ça changerait tous les écrans d'un coup.
