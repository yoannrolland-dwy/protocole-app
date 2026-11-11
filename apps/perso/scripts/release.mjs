// Livraison de l'APK sur le téléphone (audit du 10/11/2026, fin de campagne). Deux commandes, à
// lancer DEPUIS LA RACINE DU DÉPÔT (ou avec le chemin absolu du script, depuis n'importe où) ; le
// script retrouve lui-même la racine pour toutes ses étapes :
//
//   node apps/perso/scripts/release.mjs build    tests JS → build → synchro Capacitor →
//                                                tests unitaires Android → Gradle
//   node apps/perso/scripts/release.mjs install  adb install -r de l'APK construit, puis vérification
//
// `build` s'arrête à la PREMIÈRE erreur (chaque étape lève une exception sur un code de sortie non
// nul) et refuse un arbre avec des fichiers non commités. Une fois tout réussi, il écrit à côté de
// l'APK `release.json` = { commit, version, apkSha256, builtAt } : c'est la preuve que CET APK vient
// d'une construction réussie de CE commit. `install` refuse si ce manifeste manque, ne correspond
// pas au commit en cours, ou si l'APK a changé ; il n'installe jamais avec désinstallation ni -d.
// Aucune donnée personnelle ni secret n'est lu ou écrit.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { buildProblems, installProblems, installedMatches } from "./releaseCheck.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const APP = join(ROOT, "apps", "perso");
const APK = join(APP, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const MANIFEST = join(dirname(APK), "release.json");
const env = {
  ...process.env,
  ANDROID_HOME: process.env.ANDROID_HOME || "/opt/homebrew/share/android-commandlinetools",
  JAVA_HOME: process.env.JAVA_HOME || "/opt/homebrew/opt/openjdk@21",
};
env.PATH = `${env.ANDROID_HOME}/platform-tools:${env.JAVA_HOME}/bin:${env.PATH}`;

const run = (cmd, args, cwd = ROOT) => {
  console.log(`\n› ${cmd} ${args.join(" ")}  (${cwd.replace(ROOT, ".") || "."})`);
  execFileSync(cmd, args, { cwd, env, stdio: "inherit" }); // lève une exception au moindre échec
};
const out = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, env, encoding: "utf8" }).trim();
const sha = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null);
const head = () => out("git", ["rev-parse", "HEAD"]);
const dirty = () => out("git", ["status", "--porcelain"]).length > 0;
const version = () => readFileSync(join(APP, "src", "version.js"), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const stop = (problems) => { console.error(`\n✖ Arrêt :\n- ${problems.join("\n- ")}`); process.exit(1); };

function build() {
  const p = buildProblems({ dirty: dirty() });
  if (p.length) stop(p);
  const commit = head();
  rmSync(MANIFEST, { force: true }); // un ancien manifeste ne doit jamais survivre à un échec
  run("npm", ["test"]);
  run("npm", ["run", "build", "--workspace=apps/perso"]);
  run("npx", ["cap", "sync", "android"], APP);
  // Tests unitaires Android (Lot3UnitTest…) : un échec arrête la livraison comme les tests JS.
  run("./gradlew", ["testDebugUnitTest", "-q"], join(APP, "android"));
  run("./gradlew", ["assembleDebug", "-q"], join(APP, "android"));
  if (head() !== commit || dirty()) stop(["le dépôt a changé pendant la construction"]);
  const v = version();
  const apkSha256 = sha(APK);
  if (!apkSha256) stop(["APK absent après Gradle"]);
  const manifest = { commit, version: v, apkSha256, builtAt: new Date().toISOString() };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✔ APK prêt : v${v}, commit ${commit.slice(0, 7)}, empreinte ${apkSha256.slice(0, 16)}`);
}

function install() {
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null;
  const p = installProblems({ manifest, head: head(), dirty: dirty(), apkSha256: sha(APK), version: version() });
  if (p.length) stop(p);
  if (!/\tdevice$/m.test(out("adb", ["devices"]))) stop(["téléphone non branché ou non autorisé"]);
  run("adb", ["install", "-r", APK]); // jamais de désinstallation, jamais -d
  const path = out("adb", ["shell", "pm", "path", "com.yoannrolland.protocole"]).replace(/^package:/, "").trim();
  const copy = join(tmpdir(), `protocole-installe-${Date.now()}.apk`);
  run("adb", ["pull", path, copy]);
  const installedSha256 = sha(copy);
  rmSync(copy, { force: true });
  if (!installedMatches({ manifest, installedSha256 })) stop(["l'APK en place sur le téléphone n'est pas celui construit"]);
  console.log(`\n✔ Installé : v${manifest.version}, commit ${manifest.commit.slice(0, 7)}, empreinte vérifiée sur le téléphone`);
}

const cmd = process.argv[2];
if (cmd === "build") build();
else if (cmd === "install") install();
else stop(["commande attendue : build ou install"]);
