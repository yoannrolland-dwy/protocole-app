// Règles de la livraison de l'APK (audit du 10/11/2026, fin de campagne). Pures, testées
// (apps/perso/test/release.test.mjs). Incident du 11/11/2026 : un build lancé depuis le mauvais
// dossier avait échoué, la chaîne avait continué, et l'APK installé n'était pas celui du commit.

/** Ce qui empêche de CONSTRUIRE un APK livrable : il doit venir d'un commit, sans modification. */
export function buildProblems({ dirty }) {
  return dirty ? ["des fichiers ne sont pas commités : l'APK ne correspondrait à aucun commit"] : [];
}

/**
 * Ce qui empêche d'INSTALLER : le manifeste écrit par une construction réussie doit exister, être
 * celui du commit en cours, sur un arbre propre, et l'APK doit être exactement celui qu'il décrit.
 * → liste vide = installation permise.
 */
export function installProblems({ manifest, head, dirty, apkSha256, version }) {
  const out = [];
  if (!manifest) return ["aucune construction réussie enregistrée (release.json absent) : lancer d'abord « build »"];
  if (dirty) out.push("des fichiers ne sont pas commités");
  if (manifest.commit !== head) out.push(`l'APK vient du commit ${String(manifest.commit).slice(0, 7)}, pas du commit en cours ${String(head).slice(0, 7)}`);
  if (!apkSha256) out.push("APK introuvable");
  else if (manifest.apkSha256 !== apkSha256) out.push("l'APK a changé depuis sa construction (empreinte différente)");
  if (version && manifest.version !== version) out.push(`version ${manifest.version} construite, ${version} attendue`);
  return out;
}

/** Après installation : l'APK en place sur le téléphone doit être celui de la construction. */
export function installedMatches({ manifest, installedSha256 }) {
  return !!manifest && !!installedSha256 && manifest.apkSha256 === installedSha256;
}

/**
 * Montre (17/11/2026) : avec la montre branchée en débogage sans fil, `adb` voit deux appareils et
 * refuserait toute commande sans `-s`. Chaque appareil connu (`adb devices`, état « device ») est
 * classé par sa caractéristique Android (`ro.build.characteristics` contient « watch » sur Wear OS).
 * → { phone, watch, problems } ; `problems` ne concerne que l'appareil demandé (`want`).
 */
export function pickDevice(devices, want) {
  const watches = devices.filter((d) => /\bwatch\b/.test(d.characteristics || ""));
  const phones = devices.filter((d) => !watches.includes(d));
  const list = want === "watch" ? watches : phones;
  const name = want === "watch" ? "montre" : "téléphone";
  if (!list.length) {
    return { serial: null, problems: [want === "watch"
      ? "montre non connectée : débogage sans fil activé sur la montre, puis « adb connect » (voir le journal du 17/11/2026)"
      : "téléphone non branché ou non autorisé"] };
  }
  if (list.length > 1) return { serial: null, problems: [`plusieurs appareils de type ${name} connectés : n'en garder qu'un`] };
  return { serial: list[0].serial, problems: [] };
}

/** Lignes de `adb devices` → numéros de série des appareils prêts (état « device »). */
export function readySerials(adbDevicesOutput) {
  return adbDevicesOutput.split("\n").map((l) => l.trim().split(/\s+/)).filter((c) => c[1] === "device").map((c) => c[0]);
}
