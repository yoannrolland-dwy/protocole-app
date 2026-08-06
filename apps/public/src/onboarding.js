// Config partagée par l'onboarding (Onboarding.jsx), l'onglet Séances (filtrage des types
// actifs) et l'onglet Douleurs (zones dynamiques) — RawCare, chantier onboarding, 06/08/2026.
//
// Portée volontairement réduite par rapport à la vision "catalogue/zones entièrement
// libres" de la feuille de route (voir CLAUDE.md) : `recommendSessions`
// (@rawcare/core/recommender) reste câblé à la main sur exactement 6 types (Upper A/B,
// Lower A/B, Basket, Escalade) et ne réagit qu'à deux `gateTag` ("genou"/"tirage"), les
// seuls portés par ces 6 types. Décidé avec Yoann : le picker de sports se limite à un
// sous-ensemble de ces 3 familles déjà pleinement supportées, et les zones de douleur à un
// choix guidé à 3 options (Genou/Coude/Autre) plutôt qu'un formulaire libre.

// Familles de sport sélectionnables à l'onboarding. Chaque famille correspond à un ou
// plusieurs types de TEMPLATES (@rawcare/core/session/templates) — Upper/Lower forment UNE
// famille (un split musculation, pas deux sports séparés qu'on activerait indépendamment).
export const SPORT_FAMILIES = [
  { key: "musculation", label: "Musculation (Upper/Lower)" },
  { key: "basket", label: "Basket" },
  { key: "escalade", label: "Escalade" },
];

export const FAMILY_TYPES = {
  musculation: ["Upper A", "Upper B", "Lower A", "Lower B"],
  basket: ["Basket"],
  escalade: ["Escalade"],
};

// Famille portant un type de séance donné, pour filtrer les `suggestions`/`avoid` de
// `recommendSessions` aux sports actifs de l'utilisateur (voir Home.jsx). En préfixe plutôt
// qu'en membership exacte de `FAMILY_TYPES` : `recommendSessions` renvoie des types combinés
// dans `avoid` ("Upper A / B", "Lower A / B") mais un type unique résolu dans `suggestions`
// ("Upper A"). `null` = pas de famille (ex. "Repos / mobilité"), jamais filtré.
export function familyOf(type) {
  if (type.startsWith("Upper") || type.startsWith("Lower")) return "musculation";
  if (type.startsWith("Basket")) return "basket";
  if (type.startsWith("Escalade")) return "escalade";
  return null;
}

// Identifiant unique pour une zone "Autre" (nom libre, potentiellement plusieurs).
export const newZoneKey = () =>
  `other:${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`}`;

// Les 3 options guidées de l'onboarding. "Genou"/"Coude" ont une clé et un `gateTag` fixes
// (branchent directement le gate du recommandeur, comme DEFAULT_ZONES côté apps/perso).
// "Autre" est un gabarit : `key` est généré à l'ajout (newZoneKey), `label` saisi par
// l'utilisateur, `gateTag: null` — suivi pur, aucun effet sur les suggestions/l'écarté.
export const PAIN_ZONE_PRESETS = [
  {
    preset: "knee", label: "Genou", key: "knee", gateTag: "genou", unknownIsCaution: true,
    hsr: true, routines: true,
    coachClause: "genou (tendon en cours de gestion, charge HSR, règle de Silbernagel)",
  },
  {
    preset: "elbow", label: "Coude", key: "elbow", gateTag: "tirage", unknownIsCaution: false,
    hsr: false, routines: false,
    coachClause: "coude (tendon en cours de gestion, prises neutres/pronation privilégiées)",
  },
  {
    preset: "other", label: null, key: null, gateTag: null, unknownIsCaution: false,
    hsr: false, routines: false, coachClause: null, freeName: true,
  },
];
