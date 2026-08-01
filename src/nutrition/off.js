// Open Food Facts — recherche texte des produits industriels (M2, 02/08/2026).
//
// Complète CIQUAL, qui ne couvre que les aliments bruts/génériques : les produits de
// marque (yaourts, barres protéinées, plats préparés) n'y sont pas. C'est justement ce
// qui manquait le plus à l'usage réel — la majorité des repas de Yoann sont des produits
// à code-barres, pas des aliments bruts.
//
// Comportement mesuré par test réel le 01-02/08/2026, en variant l'espacement entre deux
// requêtes successives : 4 s → 503, 5 s → 200, 6 s → 503 de nouveau. Ce n'est PAS une
// simple fenêtre glissante ("1 requête toutes les N secondes") — un espacement fixe côté
// client ne peut donc jamais garantir de passer. D'où une défense en deux temps plutôt
// qu'un seul délai plus long (qui n'aurait rien garanti de plus, juste ralenti l'usage
// normal) :
//  - déclenchement seulement après une pause de frappe (voir FoodSearch.jsx, 700 ms), et
//    un espacement minimum forcé ici entre deux requêtes RÉELLES au cas où l'utilisateur
//    enchaîne plusieurs recherches rapprochées malgré le debounce ;
//  - une reprise automatique et silencieuse en cas d'échec (2 essais supplémentaires,
//    délais croissants 2,5 s / 4 s — même logique que la reprise déjà en place pour
//    l'API Claude dans App.jsx) — un 503 isolé, voire deux d'affilée, n'affichent donc
//    jamais rien à l'utilisateur ; seul un troisième échec consécutif affiche un message.
// Un cache mémoire (session, non persisté) évite en plus qu'une requête déjà vue retape
// l'API — retaper "poulet" puis effacer puis retaper ne doit pas compter deux fois.
// Volontairement NON persisté dans localStorage : un produit OFF peut être corrigé par la
// communauté, et re-servir une valeur périmée indéfiniment serait pire que de la
// re-télécharger.
//
// L'API exige idéalement un User-Agent identifiant l'app. fetch() du navigateur interdit
// de le fixer (en-tête réservé) — sur l'app native, CapacitorHttp le permet et contourne
// le CORS au passage. Sur la PWA (dev + build web), repli sur fetch() sans le header.

import { Capacitor, CapacitorHttp } from "@capacitor/core";

const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FIELDS = "code,product_name,brands,nutriments,quantity";
const UA = "PROTOCOLE-App/1.0 (usage personnel, non commercial)";

const MIN_GAP_MS = 3000;
let lastRequestAt = 0;
const cache = new Map(); // query normalisée -> résultat (tableau de food)

async function get(url) {
  if (Capacitor.isNativePlatform()) {
    const { data, status } = await CapacitorHttp.get({ url, headers: { "User-Agent": UA } });
    if (status >= 400) throw new Error(`OFF ${status}`);
    return data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  return res.json();
}

// energy-kcal_100g est le champ correct (kcal). Certains produits n'ont que energy_100g
// (kJ) : repli avec la conversion standard 1 kcal = 4,184 kJ plutôt que de perdre l'info.
function toFood(p) {
  const n = p.nutriments || {};
  const kcalRaw = n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  return {
    ref: `off:${p.code}`,
    name: p.product_name?.trim() || "(sans nom)",
    brand: (p.brands || "").split(",")[0].trim(),
    grp: "",
    per100: {
      kcal: kcalRaw == null ? null : Math.round(kcalRaw),
      prot: n.proteins_100g ?? null,
      gluc: n.carbohydrates_100g ?? null,
      lip: n.fat_100g ?? null,
      fib: n.fiber_100g ?? null,
    },
  };
}

// Délais entre tentatives, croissants pour laisser un vrai coup de mou serveur se
// résorber (2 essais de rattrapage après le premier, donc 3 au total).
const RETRY_DELAYS_MS = [2500, 4000];

async function fetchOnce(q, limit) {
  const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(q)}&search_simple=1`
    + `&action=process&json=1&page_size=${limit}&fields=${FIELDS}&lc=fr&cc=fr`;
  const data = await get(url);
  return (data.products || [])
    .filter((p) => p.product_name && p.code)
    .map(toFood);
}

/**
 * Recherche par nom. Ne throw jamais pour un problème réseau/quota — retourne
 * `{ items: [], error: true }` pour que FoodSearch affiche un message plutôt que de
 * planter le reste de l'écran (CIQUAL, lui, doit continuer à fonctionner).
 *
 * Un échec est retenté jusqu'à 2 fois (délais croissants) avant d'abandonner : le seuil
 * réel du serveur n'étant pas prévisible côté client (voir plus haut), la plupart des
 * 503 se résolvent d'eux-mêmes en quelques secondes sans que l'utilisateur ne voie
 * jamais rien — seule une vraie panne prolongée affiche encore un message.
 */
export async function searchOFF(query, { limit = 20 } = {}) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { items: [], error: false };
  if (cache.has(q)) return { items: cache.get(q), error: false };

  for (let attempt = 0; ; attempt++) {
    try {
      const items = await fetchOnce(q, limit);
      cache.set(q, items);
      return { items, error: false };
    } catch {
      if (attempt >= RETRY_DELAYS_MS.length) return { items: [], error: true };
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}
