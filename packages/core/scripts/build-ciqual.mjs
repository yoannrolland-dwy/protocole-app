// Génère src/data/ciqual.json depuis la table officielle ANSES-CIQUAL 2020.
//
// À lancer À LA MAIN, une seule fois (ou à chaque nouvelle version de la table) :
//   node scripts/build-ciqual.mjs
// Le JSON produit est COMMITÉ dans le dépôt : aucun accès réseau n'est fait au
// build Netlify ni au build Android.
//
// Source : https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual
// Licence Ouverte / Open Licence 2.0 (Etalab) — redistribution autorisée avec attribution.
//
// Format de sortie : COLONNAIRE (tableau de tableaux), pas un tableau d'objets.
// Répéter 8 noms de clés sur 3 185 lignes coûterait ~40 % de poids pour zéro information.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ZIP_URL = "https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip";
const VERSION = "2020-07-07";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "ciqual.json");

// Codes constituants CIQUAL retenus. On s'arrête volontairement aux 5 valeurs que
// PROTOCOLE suit déjà (voir macroLog) — pas de micronutriments, décision du 01/08/2026.
// 328 = énergie du Règlement UE 1169/2011, c'est-à-dire EXACTEMENT la kcal affichée sur
// les étiquettes et renvoyée par Open Food Facts (fibres comptées à 2 kcal/g). Ne pas
// utiliser 333 (facteur Jones), qui donnerait des totaux incohérents avec les produits OFF.
const KCAL = "328";
const PROT = "25000";   // Protéines, N x facteur de Jones (colonne de référence de la table)
const PROT_ALT = "25003"; // Protéines, N x 6.25 — repli quand 25000 est absent
const GLUC = "31000";
const LIP = "40000";
const FIB = "34100";
// L'alcool n'est PAS stocké dans le JSON final (PROTOCOLE ne suit pas l'éthanol) : il ne
// sert qu'à recalculer correctement l'énergie des boissons alcoolisées, dont l'ANSES ne
// tabule souvent pas l'énergie (vin doux, sangria, kir…). Sans lui elles seraient
// sous-estimées de moitié.
const ALC = "60000";
const WANTED = new Set([KCAL, PROT, PROT_ALT, GLUC, LIP, FIB, ALC]);

// --- Récupération -----------------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), "ciqual-"));
console.log("→ téléchargement", ZIP_URL);
execFileSync("curl", ["-sSL", "--max-time", "180", "-o", join(dir, "x.zip"), ZIP_URL]);
execFileSync("unzip", ["-o", "-q", join(dir, "x.zip"), "-d", dir]);

// Les fichiers ANSES sont en windows-1252, pas en UTF-8.
const read = (f) => new TextDecoder("windows-1252").decode(readFileSync(join(dir, f)));
const alimXml = read(`alim_${VERSION.replace(/-/g, "_")}.xml`);
const grpXml = read(`alim_grp_${VERSION.replace(/-/g, "_")}.xml`);
const compoXml = read(`compo_${VERSION.replace(/-/g, "_")}.xml`);

// --- Parsing ----------------------------------------------------------------
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : "";
};
const records = (xml, name) => xml.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, "g")) || [];

// Sous-groupes : badge affiché à côté de l'aliment ("viandes cuites", "légumes crus"…).
// Plus parlant que le groupe de tête (11 valeurs) sans être plus lourd, puisqu'on
// déduplique dans un tableau `grps` et qu'on ne stocke qu'un index par ligne.
const ssgrpNom = new Map();
for (const r of records(grpXml, "ALIM_GRP")) {
  const code = tag(r, "alim_ssgrp_code");
  const nom = tag(r, "alim_ssgrp_nom_fr");
  if (code && nom && nom !== "-" && !ssgrpNom.has(code)) ssgrpNom.set(code, nom);
}

// Une teneur CIQUAL n'est pas toujours un nombre :
//   "-"        → donnée absente (63 688 cas) : on garde null, surtout pas 0.
//   "traces"   → quantité négligeable : 0.
//   "< 0,5"    → on retient la borne haute (convention prudente pour un compteur de macros).
//   "1,23"     → virgule décimale française.
const teneur = (raw) => {
  const v = raw.trim();
  if (!v || v === "-") return null;
  if (/^traces$/i.test(v)) return 0;
  const n = parseFloat(v.replace("<", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

// compo est le gros fichier (55 Mo) : on le balaie en une passe sans construire d'AST.
const compo = new Map(); // alim_code -> { const_code: valeur }
for (const r of records(compoXml, "COMPO")) {
  const cc = tag(r, "const_code");
  if (!WANTED.has(cc)) continue;
  const ac = tag(r, "alim_code");
  const v = teneur(tag(r, "teneur"));
  if (v === null) continue;
  let e = compo.get(ac);
  if (!e) compo.set(ac, (e = {}));
  e[cc] = v;
}

const grps = [];
const grpIdx = (nom) => {
  if (!nom) return -1;
  let i = grps.indexOf(nom);
  if (i < 0) i = grps.push(nom) - 1;
  return i;
};

// Mots déjà présents dans le nom d'affichage : inutile de payer l'alias pour eux.
const words = (s) => new Set(
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter((w) => w.length > 2)
);

const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
const rows = [];
let skipped = 0;
let computed = 0;
const alcoolCalc = [];

for (const r of records(alimXml, "ALIM")) {
  const code = tag(r, "alim_code");
  const nom = tag(r, "alim_nom_fr");
  const idx = tag(r, "ALIM_NOM_INDEX_FR");
  const c = compo.get(code) || {};

  const prot = c[PROT] ?? c[PROT_ALT] ?? null;
  const gluc = c[GLUC] ?? null;
  const lip = c[LIP] ?? null;
  const fib = c[FIB] ?? null;

  // Un aliment sans aucune macro n'est pas loggable : il polluerait les résultats de
  // recherche en promettant une donnée qu'on ne peut pas compter.
  if (prot === null && gluc === null && lip === null) { skipped++; continue; }

  // 887 aliments de la table n'ont AUCUNE valeur d'énergie renseignée (ni 328 ni 333) —
  // et pas des cas rares : sucre blanc, lentilles cuites, amandes. On la recalcule alors
  // depuis les macros avec les coefficients du Règlement UE 1169/2011, ce qui est
  // exactement la définition du constituant 328. Vérifié : sur les 2 298 aliments où
  // l'ANSES fournit les deux, 328 et 333 concordent à 0,4 kcal de moyenne, donc le
  // calcul est cohérent avec la table et avec les étiquettes.
  // L'éthanol compte pour 7 kcal/g et représente l'essentiel de l'énergie d'une boisson
  // alcoolisée : sans lui, un verre de vin doux serait donné à moitié prix.
  let kcal = c[KCAL] ?? null;
  let kcalCalc = false;
  if (kcal === null) {
    kcal = (prot ?? 0) * 4 + (gluc ?? 0) * 4 + (lip ?? 0) * 9 + (fib ?? 0) * 2 + (c[ALC] ?? 0) * 7;
    kcalCalc = true;
    computed++;
  }

  // ALIM_NOM_INDEX_FR est le nom réarrangé pour l'index alphabétique de l'ANSES, et il
  // contient souvent de vrais SYNONYMES ("Cocktail à base de rhum" → "Mojito, pina colada,
  // daïquiri, cuba libre, mai tai"). C'est une table d'alias de recherche gratuite : on la
  // garde, mais uniquement quand elle apporte des mots absents du nom d'affichage.
  const nw = words(nom);
  const extra = [...words(idx)].some((w) => !nw.has(w));
  const alias = extra ? idx : null;

  const grpNom = ssgrpNom.get(tag(r, "alim_ssgrp_code")) || "";
  if (kcalCalc && /alcool/i.test(grpNom) && c[ALC] == null) alcoolCalc.push(nom);

  rows.push([
    Number(code), nom, alias, grpIdx(grpNom),
    Math.round(kcal), r1(prot), r1(gluc), r1(lip), r1(fib),
  ]);
}

// Garde-fou : une boisson alcoolisée dont l'énergie est recalculée SANS teneur en alcool
// connue serait sous-estimée de moitié. Doit rester à zéro ; à traiter à la main si une
// future version de la table en fait apparaître.
if (alcoolCalc.length) {
  console.warn(`⚠ ${alcoolCalc.length} boisson(s) alcoolisée(s) sans teneur en alcool → kcal sous-estimée :`);
  alcoolCalc.slice(0, 10).forEach((n) => console.warn(`   - ${n}`));
}

const out = {
  v: VERSION,
  src: "Table Ciqual 2020 — ANSES · Licence Ouverte 2.0 (Etalab)",
  cols: ["code", "nom", "alias", "grp", "kcal", "prot", "gluc", "lip", "fib"],
  grps,
  rows,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const kb = (n) => `${(n / 1024).toFixed(0)} Ko`;
console.log(`✓ ${rows.length} aliments (${skipped} écartés, sans aucune macro)`);
console.log(`✓ kcal : ${rows.length - computed} tabulées ANSES, ${computed} recalculées depuis les macros`);
console.log(`✓ ${grps.length} sous-groupes`);
console.log(`✓ ${OUT} — ${kb(JSON.stringify(out).length)}`);
console.log(`  avec alias : ${rows.filter((r) => r[2]).length}`);
