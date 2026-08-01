// Recherche dans la table CIQUAL (aliments bruts et génériques français).
//
// Pas de base de données, pas d'index inversé, pas de plugin natif : 3 178 lignes en
// mémoire et un balayage linéaire. Mesuré sur S25 : bien en dessous de la milliseconde,
// donc la recherche peut tourner à CHAQUE frappe sans debounce. C'est ce qui permettra
// de garder Open Food Facts (quota ~10 req/min sur la recherche texte) en second rideau,
// déclenché seulement après une pause de frappe.
//
// Données produites par scripts/build-ciqual.mjs — voir ce fichier pour la provenance
// et les conventions (kcal règlement UE 1169/2011, valeurs pour 100 g).

let indexPromise = null;

// Minuscules + suppression des accents + tout ce qui n'est pas alphanumérique devient une
// espace. « Bœuf, faux-filet, grillé » → « b uf faux filet grille ». Exporté parce que la
// recherche Open Food Facts (M2) devra normaliser exactement pareil.
export function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Chargement paresseux : le JSON (246 Ko, ~65 Ko sur le réseau) n'est téléchargé qu'à la
// première recherche, pas au démarrage de l'app. Vite en fait un chunk séparé et haché,
// que le service worker précache — donc hors-ligne dès la deuxième ouverture.
export function loadCiqual() {
  if (!indexPromise) {
    indexPromise = import("../data/ciqual.json").then((m) => {
      const d = m.default;
      // Une passe de normalisation à la construction plutôt qu'à chaque frappe.
      const items = d.rows.map((r) => ({
        code: r[0],
        nom: r[1],
        grp: r[3] >= 0 ? d.grps[r[3]] : "",
        kcal: r[4], prot: r[5], gluc: r[6], lip: r[7], fib: r[8],
        _n: normalize(r[1]),
        _a: r[2] ? normalize(r[2]) : "",
      }));
      return { items, byCode: new Map(items.map((i) => [i.code, i])), meta: { v: d.v, src: d.src } };
    });
  }
  return indexPromise;
}

// Score d'un terme dans une chaîne normalisée. L'idée : un mot entier vaut mieux qu'un
// préfixe, qui vaut mieux qu'un fragment au milieu d'un mot ; et une correspondance en
// tête de libellé vaut mieux que la même en fin. « poulet » doit sortir « Poulet, filet »
// avant « Escalope panée de poulet ».
function termScore(hay, term) {
  let best = 0;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(term, from);
    if (i < 0) break;
    from = i + 1;
    const atStart = i === 0;
    const wordStart = atStart || hay[i - 1] === " ";
    const end = i + term.length;
    const wholeWord = wordStart && (end === hay.length || hay[end] === " ");
    let s;
    if (wholeWord) s = atStart ? 100 : 70;
    else if (wordStart) s = atStart ? 80 : 55;
    else s = 20;
    if (s > best) best = s;
    if (best === 100) break;
  }
  return best;
}

// Repli morphologique. Le français accorde en genre et en nombre, et les libellés CIQUAL
// sont au pluriel ou au féminin sans prévenir : « pâte complète » cherché à la main ne
// trouvait pas « Pâtes sèches, au blé complet, crues » (« complete » n'est pas contenu
// dans « complet »). Quand un terme ne matche pas, on retente en lui retirant une puis
// deux lettres finales — ce qui couvre s / e / es / ne / le. Léger malus pour qu'une
// correspondance exacte reste toujours devant.
const STEM_PENALTY = 0.85;
const STEM_MIN = 3;

function matchTerm(hay, term) {
  const s = termScore(hay, term);
  if (s) return s;
  for (let cut = 1; cut <= 2; cut++) {
    if (term.length - cut < STEM_MIN) break;
    const st = termScore(hay, term.slice(0, term.length - cut));
    if (st) return st * STEM_PENALTY;
  }
  return 0;
}

// Mots vides : sans ça, « blanc de poulet » impose que « de » matche aussi, ce qui fait
// remonter n'importe quel libellé contenant « de » et écarte « Poulet (var. blanc) ».
const STOP = new Set(["de", "du", "des", "au", "aux", "la", "le", "les", "un", "une",
  "en", "et", "ou", "a", "d", "l", "sans", "avec"]);

// Les libellés CIQUAL sont volontairement très spécifiques (« Poulet, croquette panée ou
// nuggets »). À correspondance égale, le libellé le plus court est le plus générique,
// donc le plus probablement recherché. Pondération réglable : c'est le seul curseur à
// toucher si le classement paraît mauvais à l'usage.
const BREVITY = 0.35;

// Un alias ne vaut pas un nom d'affichage : il sert à retrouver l'aliment (« mojito » →
// « Cocktail à base de rhum »), pas à le classer devant une correspondance directe.
const ALIAS_WEIGHT = 0.6;

/**
 * @param {string} query      texte tapé par l'utilisateur
 * @param {object} [opts]
 * @param {number} [opts.limit]  nombre de résultats (40 par défaut)
 * @param {(code:number)=>number} [opts.boost]  bonus par aliment, en points de score.
 *   Sert à faire remonter ce que l'utilisateur mange réellement (voir foodStore) : c'est
 *   ce signal, et pas le scoring textuel, qui rend la recherche vraiment agréable après
 *   quelques jours d'usage.
 */
export async function searchCiqual(query, { limit = 40, boost } = {}) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const all = q.split(" ").filter(Boolean);
  // On ne retire les mots vides que s'il reste quelque chose : quelqu'un qui cherche
  // littéralement « eau » ou « sel » doit obtenir un résultat.
  const kept = all.filter((t) => !STOP.has(t));
  const terms = kept.length ? kept : all;
  const { items } = await loadCiqual();

  const out = [];
  for (const it of items) {
    let total = 0;
    let ok = true;
    for (const t of terms) {
      // Tous les termes doivent matcher (ET) : « filet poulet » ne doit pas ramener
      // tous les filets de la table.
      const sn = matchTerm(it._n, t);
      const sa = it._a ? matchTerm(it._a, t) * ALIAS_WEIGHT : 0;
      const s = Math.max(sn, sa);
      if (!s) { ok = false; break; }
      total += s;
    }
    if (!ok) continue;
    total -= it._n.length * BREVITY;
    if (boost) total += boost(it.code);
    out.push({ item: it, score: total });
  }

  out.sort((a, b) => b.score - a.score || a.item._n.length - b.item._n.length);
  return out.slice(0, limit).map((o) => toFood(o.item));
}

export async function getCiqual(code) {
  const { byCode } = await loadCiqual();
  const it = byCode.get(Number(code));
  return it ? toFood(it) : null;
}

// Forme commune à toutes les sources d'aliments (CIQUAL, Open Food Facts en M2, aliments
// persos). `ref` porte la source, ce qui rend une ligne de journal auto-suffisante pour
// être rejouée, dédupliquée et scorée sans connaître d'où elle vient.
function toFood(it) {
  return {
    ref: `ciqual:${it.code}`,
    name: it.nom,
    grp: it.grp,
    // Valeurs pour 100 g. `null` = donnée absente de la table, à ne jamais confondre
    // avec un vrai 0 (voir build-ciqual.mjs).
    per100: { kcal: it.kcal, prot: it.prot, gluc: it.gluc, lip: it.lip, fib: it.fib },
  };
}
