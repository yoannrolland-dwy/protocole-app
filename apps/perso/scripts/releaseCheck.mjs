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
