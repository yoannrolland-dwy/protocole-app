// Charge d'une séance sans séries (escalade, et tout type "sport") — 08/10/2026.
//
// Remplace le suivi des blocs d'escalade (V5, 03/08/2026 → retiré le 08/10/2026 à la demande
// de Yoann : les pistes changent, il les note déjà dans l'app de sa salle, et le NOMBRE de
// blocs était un mauvais proxy de charge — 20 blocs faciles et 8 blocs à la limite n'ont rien
// à voir). La charge-séance de Foster (2001), RPE × durée en minutes, est validée dans
// beaucoup de sports, escalade comprise, et ne demande AUCUN champ nouveau : durée et RPE
// existaient déjà sur la séance Escalade.
//
// Les blocs déjà enregistrés (`blocs: [...]` sur d'anciennes séances) restent dans
// `trainingLog`, simplement plus lus par personne — jamais de perte de données.
//
// Fonctions pures, testables seules en Node.

/** Seuils de charge-séance (RPE × minutes). Séance type de Yoann : 60 min × RPE 7 = 420. */
export const LOAD_LIGHT = 300; // ≤ 300 : légère (ex. 50 min à RPE 6)
export const LOAD_HEAVY = 540; // ≥ 540 : grosse (ex. 60 min à RPE 9, ou 90 min à RPE 6)

/**
 * `{ load, level, duration, rpe }` ou `null` si la séance n'a pas durée ET RPE — pas de
 * charge supposée à partir d'une donnée absente (même principe que l'ancien `climbLoad`).
 */
export function sessionLoad(session) {
  if (!session || session.duration == null || session.rpe == null) return null;
  const duration = Number(session.duration), rpe = Number(session.rpe);
  if (!(duration > 0) || !(rpe > 0)) return null;
  const load = Math.round(duration * rpe);
  const level = load <= LOAD_LIGHT ? "legere" : load >= LOAD_HEAVY ? "grosse" : "normale";
  return { load, level, duration, rpe };
}

/** Libellé court pour « Dernières séances » : « charge 420 (normale) ». */
export function loadLabel(session) {
  const l = sessionLoad(session);
  if (!l) return "";
  return `charge ${l.load} (${l.level === "legere" ? "légère" : l.level})`;
}

/* ============================================================
   Gêne articulaire ressentie PENDANT une séance (08/10/2026)
   ============================================================
   Champ optionnel `gene: { [zone]: pain }` (plusieurs zones possibles, 08/10/2026 — la forme
   initiale `{ zone, pain }` à une seule zone reste lue) sur une séance Escalade — distinct du journal de
   douleur quotidien (kneeLog / Silbernagel, qui juge le LENDEMAIN) : ici c'est ce que la
   séance elle-même a provoqué. Une gêne ≥ GENE_THRESHOLD à la dernière escalade pénalise le
   lendemain l'escalade et le tirage lourd (recommender.js). Si une gêne revient plusieurs
   séances de suite, c'est le signal pour rouvrir une vraie zone de douleur. */

// `pull` : la zone est aussi sollicitée par le tirage du haut du corps (Upper). Les orteils
// (chaussons d'escalade, 30/10/2026) ne pénalisent que l'escalade du lendemain.
export const GENE_ZONES = [
  { key: "doigts", label: "Doigts", pull: true },
  { key: "poignets", label: "Poignets", pull: true },
  { key: "coudes", label: "Coudes", pull: true },
  { key: "orteils", label: "Orteils", pull: false },
];
export const GENE_THRESHOLD = 4;

/**
 * Liste `[{ zone, pain }]` des gênes ≥ 1 notées sur la séance (ordre de GENE_ZONES), ou `null`
 * si aucune. Accepte la forme multi `{ doigts: 5, coudes: 3 }` et l'ancienne `{ zone, pain }`.
 */
export function sessionGenes(session) {
  const g = session?.gene;
  if (!g) return null;
  const map = g.zone ? { [g.zone]: g.pain } : g;
  const list = GENE_ZONES.map((z) => ({ zone: z.key, pain: Number(map[z.key]) })).filter((x) => x.pain >= 1);
  return list.length ? list : null;
}

/** La gêne la plus forte (`{ zone, pain }`) ou `null` — c'est elle qui pilote la pénalité.
 *  `{ pullOnly: true }` : seulement parmi les zones que le tirage du haut du corps sollicite. */
export function sessionGene(session, { pullOnly = false } = {}) {
  const list = (sessionGenes(session) || []).filter((g) => !pullOnly || GENE_ZONES.find((z) => z.key === g.zone)?.pull);
  return list.length ? list.reduce((a, b) => (b.pain > a.pain ? b : a)) : null;
}

export const geneZoneLabel = (key) => GENE_ZONES.find((z) => z.key === key)?.label?.toLowerCase() || key;

/** « gêne coudes 5/10 · doigts 3/10 » ou "". */
export function geneLabel(session) {
  const list = sessionGenes(session);
  return list ? `gêne ${list.map((g) => `${geneZoneLabel(g.zone)} ${g.pain}/10`).join(" · ")}` : "";
}
