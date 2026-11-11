// Audit du 10/11/2026, lot 3 : procédure de livraison (règles pures) et branchements Android vérifiés
// dans le code source (les règles Android pures sont testées par Gradle : Lot3UnitTest.kt).
// Données fictives (commits, empreintes) ; aucune construction ni installation lancée.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProblems, installProblems, installedMatches } from "../scripts/releaseCheck.mjs";

const SHA = "a".repeat(64);
const manifest = { commit: "d462f9d0000000000000000000000000000000ab", version: "3.161.0", apkSha256: SHA, builtAt: "2026-11-11T18:00:00.000Z" };
const ok = { manifest, head: manifest.commit, dirty: false, apkSha256: SHA, version: "3.161.0" };
const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const K = "../android/app/src/main/java/com/yoannrolland/protocole/";

// --- Livraison ---------------------------------------------------------------------------------

test("livraison : on ne construit qu'un arbre commité", () => {
  assert.equal(buildProblems({ dirty: true }).length, 1);
  assert.deepEqual(buildProblems({ dirty: false }), []);
});

test("livraison : l'installation n'accepte que l'APK de la construction réussie du commit en cours", () => {
  assert.deepEqual(installProblems(ok), []);
  // Incident du 11/11/2026 : build échoué → pas de manifeste → rien à installer.
  assert.match(installProblems({ ...ok, manifest: null })[0], /aucune construction réussie/);
  assert.match(installProblems({ ...ok, head: "ff10948" + "0".repeat(33) }).join(), /pas du commit en cours/);
  assert.match(installProblems({ ...ok, apkSha256: "b".repeat(64) }).join(), /a changé depuis sa construction/);
  assert.match(installProblems({ ...ok, apkSha256: null }).join(), /introuvable/);
  assert.match(installProblems({ ...ok, dirty: true }).join(), /pas commités/);
  assert.match(installProblems({ ...ok, version: "3.162.0" }).join(), /version 3\.161\.0 construite/);
  assert.equal(installedMatches({ manifest, installedSha256: SHA }), true);
  assert.equal(installedMatches({ manifest, installedSha256: "c".repeat(64) }), false);
});

test("livraison : chaque étape arrête la chaîne à la première erreur, le manifeste s'écrit en dernier", () => {
  const s = src("../scripts/release.mjs");
  assert.match(s, /execFileSync\(cmd, args, \{ cwd, env, stdio: "inherit" \}\)/); // lève sur code ≠ 0
  const b = s.slice(s.indexOf("function build()"), s.indexOf("function install()"));
  // Tests JS puis tests unitaires Android avant la construction de l'APK ; manifeste en dernier.
  const order = ["buildProblems", "rmSync(MANIFEST", '"test"', '"build", "--workspace=apps/perso"', '"cap", "sync"', '"testDebugUnitTest"', '"assembleDebug"', "writeFileSync(MANIFEST"]
    .map((k) => b.indexOf(k));
  assert.ok(order.every((i) => i >= 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((x, y) => x - y), order);
  // Chemins depuis la racine du dépôt, quel que soit le dossier courant (cause de l'incident).
  assert.match(s, /const ROOT = join\(dirname\(fileURLToPath\(import\.meta\.url\)\), "\.\.", "\.\.", "\.\."\)/);
  const i = s.slice(s.indexOf("function install()"));
  assert.ok(i.indexOf("installProblems") < i.indexOf('"install", "-r"'));
  assert.doesNotMatch(s, /"uninstall"|"-d"|pm clear/);
});

// --- Branchements Android ----------------------------------------------------------------------

test("point 16 : chaque usage du service rend son ticket, plus d'arrêt global ; boutons rendus après un délai", () => {
  const runner = src(K + "BriefRunner.kt");
  const notif = src(K + "JeffreyNotifReceiver.kt");
  const bridge = src(K + "bridge/JeffreyBridgeService.kt");
  for (const [name, s] of [["BriefRunner", runner], ["JeffreyNotifReceiver", notif], ["JeffreyBridgeService", bridge]]) {
    assert.doesNotMatch(s, /stopService\(Intent\(context, BriefService::class\.java\)\)/, name);
    assert.match(s, /BriefServiceLease\.(acquire|release)/, name);
  }
  assert.match(runner, /val stop = \{ BriefServiceLease\.release\(context, held\.getAndSet\(null\)\) \}/);
  assert.match(runner, /if \(reply && .*postReplyFailed\(context\)/s);
  assert.match(runner, /REPLY_FAILED = "Je n'ai pas pu vous répondre à temps, Monsieur\. Réessayez dans un instant\."/);
});

test("point 17 : la synchro du widget se referme toujours (JS et garde native de 45 s)", () => {
  const app = src("../src/App.jsx");
  assert.match(app, /finally \{[\s\S]{0,400}if \(await isSilentSync\(\)\) setTimeout\(finishSilentSync, 150\);/);
  assert.match(src("../src/components/RecoveryScreen.jsx"), /if \(this\.props\.silent\) finishSilentSync\(\);/);
  const act = src(K + "SilentSyncActivity.kt");
  assert.match(act, /GUARD_MS = 45_000L/);
  assert.match(act, /override fun onDestroy\(\)[\s\S]*stopSpin/);
});

test("point 18 et 19 : appelant du pont vérifié par son nom ; sauvegarde Android coupée", () => {
  const bridge = src(K + "bridge/JeffreyBridgeService.kt");
  assert.match(bridge, /JEFFREY_PACKAGE = "fr\.yrolland\.jeffrey"/);
  assert.match(bridge, /BridgeCaller\.allowed\(packageManager\.getPackagesForUid\(msg\.sendingUid\), sameSignature\)/);
  const manifestXml = src("../android/app/src/main/AndroidManifest.xml");
  assert.match(manifestXml, /android:allowBackup="false"/);
  assert.doesNotMatch(manifestXml, /android:allowBackup="true"/);
  // La permission du pont reste exigée (signature).
  assert.match(manifestXml, /android:name="\.bridge\.JeffreyBridgeService"[\s\S]{0,120}android:permission="com\.yoannrolland\.protocole\.permission\.JEFFREY_BRIDGE"/);
});

test("points 20 et 21 : premier plan refusé sans plantage, lecteur libéré, réveil suivant d'abord, journaux sans contenu", () => {
  const rest = src(K + "RestAudioService.kt");
  assert.match(rest, /if \(!foreground\) stopSelf\(startId\)/);
  assert.match(rest, /runCatching \{ p\.release\(\) \}/);
  assert.match(src(K + "BriefService.kt"), /catch \(e: Exception\) \{[\s\S]{0,200}stopSelf\(startId\)/);
  const backup = src(K + "Backup.kt");
  const recv = backup.slice(backup.indexOf("class BackupAlarmReceiver"));
  assert.ok(recv.indexOf("BackupScheduler.scheduleNext(context)") < recv.indexOf("BriefRunner.runBackup"));
  assert.match(src(K + "HealthNutritionPlugin.kt"), /withContext\(Dispatchers\.Default\) \{ block\(hc, range\) \}/);
  const runner = src(K + "BriefRunner.kt");
  assert.doesNotMatch(runner, /Log\.e\(TAG, "résultat", it\)|Log\.w\(TAG, "http", e\)/);
});
