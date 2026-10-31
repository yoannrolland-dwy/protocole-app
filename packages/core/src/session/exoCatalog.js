// « Ajouter un exercice » en cours de séance (31/10/2026, demande de Yoann) : tous les exercices
// déjà dans l'application, classés par muscle. Gabarits d'abord (Upper, Lower, Full Body,
// Mobilité — pas l'échauffement Basket), puis les variantes poulie/disque de la bibliothèque.
// Un nom n'apparaît qu'une fois : la première définition trouvée donne la prescription (séries,
// reps, repos), comme `metaFor`. Le nom reste la clé d'historique : un exercice ajouté retrouve
// sa « dernière fois », ses records et sa progression.
import { TEMPLATES } from "./templates.js";
import { EXERCISE_LIBRARY } from "./exercises.js";
import { GROUP_LABELS, GROUP_ORDER } from "../volume.js";

const SKIP_TYPES = new Set(["Basket"]);
const EXTRA_LABELS = { mobilite: "Mobilité", cardio: "Cardio" };
const ORDER = [...GROUP_ORDER, "mobilite"];
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** [{ n, groupe, label, ex, type }] — `ex` : définition (gabarit ou bibliothèque), `type` : gabarit d'origine ou null. */
export const EXERCISE_CATALOG = (() => {
  const seen = new Set();
  const out = [];
  const push = (ex, type) => {
    if (seen.has(ex.n)) return;
    seen.add(ex.n);
    out.push({ n: ex.n, groupe: ex.groupe, label: GROUP_LABELS[ex.groupe] ?? EXTRA_LABELS[ex.groupe] ?? ex.groupe, ex, type });
  };
  Object.entries(TEMPLATES).forEach(([type, t]) => { if (t.kind === "muscu" && !SKIP_TYPES.has(type)) t.exos.forEach((e) => push(e, type)); });
  EXERCISE_LIBRARY.forEach((e) => push(e, null));
  return out;
})();

/**
 * Catalogue filtré et regroupé par muscle : exclut les noms déjà dans la séance, filtre par
 * recherche (sans accents, chaque mot doit apparaître dans le nom ou le muscle).
 * → [{ groupe, label, items: [entrée du catalogue] }] dans l'ordre des muscles.
 */
export function catalogGroups({ exclude = [], query = "" } = {}) {
  const ex = new Set(exclude);
  const words = norm(query).split(/\s+/).filter(Boolean);
  const groups = new Map();
  for (const c of EXERCISE_CATALOG) {
    if (ex.has(c.n)) continue;
    const hay = norm(`${c.n} ${c.label}`);
    if (!words.every((w) => hay.includes(w))) continue;
    if (!groups.has(c.groupe)) groups.set(c.groupe, { groupe: c.groupe, label: c.label, items: [] });
    groups.get(c.groupe).items.push(c);
  }
  const rank = (g) => (ORDER.indexOf(g) + 1) || 99;
  return [...groups.values()].sort((a, b) => rank(a.groupe) - rank(b.groupe));
}

/** Entrée du catalogue par nom (réouverture d'une séance qui contient un exercice ajouté). */
export const catalogEntry = (nom) => EXERCISE_CATALOG.find((c) => c.n === nom);
