# PROTOCOLE — PWA

Console perso de suivi (muscu, sommeil, genou, macros). Application web installable
sur Android/iOS, fonctionne hors-ligne, données stockées **localement sur l'appareil**.

Stack (versions validées au build) : React 19 · Vite 8 · Tailwind CSS v4 · recharts 3 ·
lucide-react 1 · vite-plugin-pwa 1.3.

---

## 1. Prérequis
- **Node.js 20+** (vérifier : `node -v`).
- Un éditeur de texte, un terminal.

## 2. Lancer en développement
```bash
npm install        # installe les dépendances (versions figées par package-lock.json)
npm run dev        # démarre le serveur local, ouvre l'URL affichée (http://localhost:5173)
```

## 3. Construire la version de production
```bash
npm run build      # génère le dossier dist/ (fichiers statiques + service worker PWA)
npm run preview    # sert dist/ localement pour tester le rendu de prod
```

## 4. L'installer sur ton téléphone (S25)
La PWA doit être servie en **HTTPS** pour être installable. Deux options :

**A. Test rapide sur ton réseau local**
```bash
npm run preview -- --host
```
Ouvre l'URL réseau affichée (http://IP-de-ton-PC:4173) depuis Chrome sur le téléphone,
même Wi-Fi. Remarque : en HTTP simple, Chrome installe la PWA mais certaines
fonctions restent limitées ; pour l'expérience complète, héberge en HTTPS (option B).

**B. Hébergement HTTPS (recommandé, gratuit)**
Déploie le contenu de `dist/` sur n'importe quel hébergeur statique HTTPS
(Netlify, Vercel, Cloudflare Pages, GitHub Pages…). Puis, depuis **Chrome sur le S25** :
ouvre l'URL → menu ⋮ → **Ajouter à l'écran d'accueil / Installer l'application**.
L'app s'ouvre alors en plein écran, avec son icône.

## 5. Mises à jour (versioning)
C'est l'avantage de la PWA : pour publier une nouvelle version, tu **redéploies `dist/`**.
À la prochaine ouverture, l'app détecte la nouvelle version et propose
« Nouvelle version disponible. Recharger ? ». Aucune réinstallation.

Pense à incrémenter `APP_VERSION` dans `src/App.jsx` et `version` dans `package.json`.

## 6. Données et sauvegarde ⚠️
- Les données vivent dans le **stockage local du navigateur** de l'appareil.
- **Vider les données de navigation / désinstaller effacerait tout.**
- Onglet **Réglages (⚙)** → **Exporter** : télécharge une sauvegarde JSON. Fais-le
  régulièrement. **Importer** restaure une sauvegarde (écrase les données locales).
- Une sauvegarde n'inclut pas la clé API (par sécurité) ; à re-saisir après import.

## 7. Coach IA (optionnel)
Hors de l'interface Claude, l'analyse IA appelle l'API Anthropic avec **ta propre clé**.
Dans **Réglages (⚙)** : colle ta clé (`sk-ant-...`) et choisis le modèle
(défaut `claude-sonnet-5` ; liste à jour sur https://docs.claude.com).
- La clé est stockée **uniquement sur l'appareil** et envoyée directement à l'API.
- Chaque analyse **consomme des crédits** de ton compte Anthropic.
- Si tu ne mets pas de clé, tout le reste de l'app fonctionne normalement.

## 8. Limites connues (PWA v1)
- **Minuteur** : fiable quand l'app est ouverte à l'écran. Écran verrouillé / app en
  arrière-plan, le décompte et le bip ne sont **pas garantis** (limite du web). Le passage
  à une appli native (Capacitor) réglerait ça sans réécrire le code — à décider après
  quelques semaines d'usage.

## Structure
```
protocole-pwa/
  index.html
  vite.config.js        # React + Tailwind v4 + PWA (manifeste, service worker)
  package.json
  package-lock.json     # versions figées (build validé)
  public/               # icônes PWA
  src/
    main.jsx            # point d'entrée + enregistrement du service worker
    App.jsx             # toute l'application
    store.js            # persistance localStorage + export/import JSON
    index.css           # @import "tailwindcss"
```
