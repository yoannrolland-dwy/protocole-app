// Photo d'un plat : la consigne donnée à l'IA et la lecture de sa réponse (sorties de
// PhotoDish.jsx le 13/11/2026 pour être testées sous Node).
//
// Détail de l'estimation (13/11/2026, demande de Yoann) : l'IA rend une ligne par composant de
// l'assiette (aliment, grammes, kcal et macros) et quelques phrases sur ses hypothèses. Quand ce
// détail est complet, le total affiché et ajouté au journal est la SOMME des lignes : ce que
// Monsieur lit s'additionne toujours. Sans détail exploitable (ancien format, modèle de secours),
// on garde le total annoncé, comme avant.

export const DISH_PROMPT = `Tu es un nutritionniste qui estime les macros d'une assiette à partir d'une photo.
On te donne une ou plusieurs photos du même plat (éventuellement plusieurs angles) et une note
complémentaire facultative écrite par l'utilisateur (une quantité, un ingrédient à corriger ou
préciser, ce qui n'a pas été mangé). Tâche :
1. Identifie les aliments visibles sur la ou les photos et estime les quantités au jugé, à l'aide des
   repères visuels disponibles (taille de l'assiette, des couverts, comparaison avec des portions
   courantes). Le poids estimé à partir d'une seule photo est la principale source d'erreur (peut
   facilement varier de 30 à 50 %) : reste réaliste.
   Si une carte au format carte bancaire est visible (85,6 × 54 mm : carte bancaire, de fidélité,
   vitale, d'identité, badge, quel que soit son motif), sers-t'en
   comme échelle en priorité : compare la surface et le diamètre de l'assiette et des aliments à
   ses dimensions, en tenant compte de la perspective (elle est posée à plat sur la table). Elle
   ne dit rien de la hauteur : juge l'épaisseur d'un tas (riz, pâtes) à part, avec prudence.
2. Si la note complémentaire précise ou corrige une quantité ou un ingrédient, PRIORISE cette
   information sur ton estimation visuelle — l'utilisateur en sait plus que la photo.
3. Détaille l'assiette : une ligne par composant ("detail"), avec son nom précis (cuisson comprise :
   "riz basmati cuit", "poulet rôti sans peau"), son poids estimé en grammes, et ses kcal/prot/gluc/
   lip/fib. La matière grasse de cuisson, la sauce et l'assaisonnement ont chacun leur ligne dès
   qu'il y en a, même estimés. 8 lignes au plus : regroupe les garnitures mineures.
4. Calcule kcal/prot/gluc/lip/fib (en grammes, kcal en kcal) pour l'ensemble de l'assiette : c'est
   exactement la somme des lignes du détail.
5. Donne un nom court et concret au plat (ex. "Poulet rôti, riz, brocolis"), pas une catégorie
   générique.
6. Explique ton estimation ("explication") en 2 à 4 phrases courtes, en français, sans t'adresser
   à personne et sans retour à la ligne : le repère d'échelle utilisé (carte, assiette, couverts, ou
   aucun), tes hypothèses de cuisson et de matière grasse, ce que la note complémentaire a changé
   s'il y en a une, et le point le plus incertain. Ne répète pas les chiffres du détail.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, exactement
selon ce schéma :
{"lisible":boolean,"nom":string,"kcal":number,"prot":number,"gluc":number,"lip":number,"fib":number,"detail":[{"aliment":string,"grammes":number,"kcal":number,"prot":number,"gluc":number,"lip":number,"fib":number}],"explication":string}

Si la ou les photos ne permettent pas d'identifier un plat exploitable (flou, hors-sujet, vide), mets
"lisible" à false plutôt que d'inventer — les autres champs peuvent alors être à 0/vide.`;

export function buildDishUserText(note) {
  const n = String(note || "").trim();
  return n
    ? `Estime les macros de ce plat à partir de la ou des photos ci-jointes.\n\nNote complémentaire de l'utilisateur : ${n}`
    : "Estime les macros de ce plat à partir de la ou des photos ci-jointes.";
}

/** Le JSON de la réponse, même entouré de texte ou d'une clôture markdown. Lève s'il est illisible. */
export function extractJson(raw) {
  let s = String(raw || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

const MACROS = ["kcal", "prot", "gluc", "lip", "fib"];
export const DISH_MAX_LINES = 12;
const EXPLANATION_MAX = 700;

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Réponse de l'IA → ce que l'écran affiche et ajoute au journal.
 * `null` si le plat n'est pas lisible. `fromDetail` dit si le total vient de la somme des lignes.
 */
export function readDishEstimate(parsed) {
  if (!parsed || typeof parsed !== "object" || !parsed.lisible) return null;
  const rawLines = Array.isArray(parsed.detail) ? parsed.detail : [];
  const detail = rawLines
    .filter((l) => l && typeof l === "object")
    .map((l) => ({
      aliment: String(l.aliment ?? "").trim(),
      grammes: num(l.grammes),
      ...Object.fromEntries(MACROS.map((k) => [k, num(l[k])])),
    }))
    .filter((l) => l.aliment && l.kcal !== null)
    .slice(0, DISH_MAX_LINES);
  // La somme ne fait foi que si aucune ligne n'a été écartée ou coupée, et si chaque valeur est là.
  const complete = detail.length > 0 && detail.length === rawLines.length
    && detail.every((l) => MACROS.every((k) => l[k] !== null));
  const total = Object.fromEntries(MACROS.map((k) => [
    k,
    complete ? round1(detail.reduce((sum, l) => sum + l[k], 0)) : (num(parsed[k]) ?? 0),
  ]));
  return {
    nom: String(parsed.nom ?? "").trim() || "Plat",
    ...total,
    detail,
    explication: String(parsed.explication ?? "").replace(/\s+/g, " ").trim().slice(0, EXPLANATION_MAX),
    fromDetail: complete,
  };
}
