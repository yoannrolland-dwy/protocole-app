---
name: installer-android
description: Construire et installer l'app PROTOCOLE sur le S25 (release.mjs build, puis install). À utiliser quand Yoann demande d'installer, de livrer ou de mettre à jour l'app sur le téléphone.
---

## Mise à jour de l'app Android native

`git push` ne met rien à jour sur le téléphone.
L'app native installée sur le téléphone ne se met JAMAIS à jour seule — il
faut rebuild + réinstaller à la main à chaque changement de code qui la
concerne. **Depuis le 11/11/2026 (fin de la campagne d'audit), une seule procédure**, après le
commit, **depuis la racine du dépôt** (`/Users/yrolland/Documents/GitHub/protocole-app`) :
```
node apps/perso/scripts/release.mjs build
node apps/perso/scripts/release.mjs install
```
Depuis un autre dossier, donner le chemin absolu du script
(`node /Users/yrolland/Documents/GitHub/protocole-app/apps/perso/scripts/release.mjs build`) ; le
script retrouve alors lui-même la racine pour toutes ses étapes.
- `build` refuse un arbre non commité, enchaîne `npm test`, le build Vite, `npx cap sync android`,
  les tests unitaires Android (`./gradlew testDebugUnitTest`) et Gradle, et **s'arrête à la
  première erreur**. Seulement si tout réussit, il écrit
  `apps/perso/android/app/build/outputs/apk/debug/release.json` = `{ commit, version, apkSha256,
  builtAt }`, la preuve que cet APK vient de la construction réussie de ce commit.
- `install` refuse sans ce manifeste, si le commit en cours n'est pas le sien, si l'APK a changé ou
  si l'arbre n'est pas propre ; puis `adb install -r` (jamais de désinstallation ni `-d`), et
  vérifie l'empreinte de l'APK en place sur le téléphone. Règles : `scripts/releaseCheck.mjs`
  (testées). Incident à l'origine : le 11/11/2026, un build lancé depuis `apps/perso` avec
  `--workspace` a échoué sans arrêter la chaîne, et un APK plus ancien a été installé.
- Les sauvegardes d'avant installation (copie de l'APK installé, copie serveur, empreintes) restent
  à faire avant `install`.
Téléphone branché en USB, débogage USB activé et autorisé sur l'appareil.
Variables d'environnement requises (déjà ajoutées à `~/.zshrc`) :
`ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`,
`JAVA_HOME=/opt/homebrew/opt/openjdk@21`.

**Correctif historique** : un ancien bug faisait que l'app native semblait "ne plus se
mettre à jour" après un `adb install -r` tant qu'on n'avait pas accepté une popup "Nouvelle
version disponible" héritée du service worker de la PWA. Corrigé dans `main.jsx` :
côté natif (`Capacitor.isNativePlatform()`), le service worker est désenregistré et ses
caches vidés au démarrage — l'APK fait toujours foi, aucune popup de ce type ne peut plus
apparaître sur l'app native (confirmé par Yoann le 06/08/2026 : jamais vue). Cette popup
reste normale et à accepter uniquement si elle apparaît dans un navigateur (PWA).
