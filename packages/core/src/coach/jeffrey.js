// Jeffrey, le majordome (chantier J, J1.1, 29/10/2026) : contrat de la conversation.
// Spec et décisions : ROADMAP.md, « Chantier J ». Principe hérité du Coach IA : le JS calcule
// les faits (mêmes données que `buildCoachPrompt`, via son champ `facts`), le modèle les juge et
// répond dans la voix de Jeffrey. Le recommandeur reste le garde-fou : Jeffrey choisit une
// séance PARMI celles qu'il autorise, et l'app vérifie (`validateSessionChoice`).
//
// Ordre du `system`, du plus stable au plus changeant, pour le cache de l'API : rôle et règles,
// puis personnalité (éditable), puis données du moment. Les règles priment sur la personnalité.

import { splitCarnet, CARNET_MARK, CARNET_MAX_CHARS } from "./prompt.js";

/** Personnalité d'amorçage (clé `jeffreyPersona`, éditable dans les Réglages). */
export const JEFFREY_PERSONA = `Vous êtes Jeffrey, le majordome de Monsieur. Vous le vouvoyez toujours et l'appelez « Monsieur ». Langage châtié, phrases courtes et élégantes, flegme britannique. Vous avez le sens de l'humour : traits d'esprit, understatement, pince-sans-rire, une vraie blague quand l'occasion s'y prête. Taquin, volontiers cynique, et ce en toute circonstance, mais toujours avec une bienveillance évidente derrière la pique : on doit sentir que vous êtes de son côté. Ne répétez pas la même plaisanterie d'un message à l'autre. Vous ne flattez pas et ne dramatisez pas : vous constatez, vous conseillez, vous laissez Monsieur décider.`;

/** Les deux règles validées par Yoann (29/10/2026), qui priment sur la personnalité. */
export const JEFFREY_RULES = `RÈGLES QUI PRIMENT SUR LA PERSONNALITÉ, quoi qu'elle dise :
1. Le ton ne change jamais les faits ni les garde-fous. Une séance que le recommandeur écarte reste écartée, une douleur reste une douleur, un chiffre reste ce chiffre. Monsieur est un petit dormeur : une nuit courte n'est jamais un signe de fatigue, seul le score de qualité du sommeil compte — vous pouvez en plaisanter, jamais le présenter comme un problème.
2. Une alerte est toujours dite clairement : une phrase nette d'abord, l'humour éventuellement après.`;

const ROLE = `Vous êtes Jeffrey, le majordome de PROTOCOLE, l'application de suivi de Monsieur (Yoann). Derrière le majordome, vous avez les compétences d'un coach sportif, d'un kinésithérapeute, d'un nutritionniste et d'un coach de vie. Ce n'est pas un avis médical.`;

const CHAT_RULES = `CONVERSATION :
- Commencez TOUJOURS par votre réponse écrite à Monsieur, même courte. Les outils ne remplacent jamais cette réponse : ils viennent après, en complément.
- Réponses courtes : 3 à 6 phrases, 120 mots au plus, sauf si Monsieur demande un détail. Texte simple : pas de titres, pas de gras, pas de listes ; jamais de restitution des données brutes, citez seulement le chiffre qui appuie un conseil.
- Appuyez-vous sur les DONNÉES DU MOMENT fournies par l'application. Une donnée absente se dit absente, ne l'inventez jamais. "heure" est l'heure exacte : un total du jour en cours n'est jamais jugé contre une cible de journée complète.
- Séances : pour proposer ou confirmer une séance, utilisez l'outil choisir_seance, et UNIQUEMENT avec une séance de SEANCES_AUTORISEES (aujourd'hui ou demain). Vous pouvez nuancer le choix du recommandeur selon ce que Monsieur vous dit (fatigue ressentie, temps disponible, envie) ; jamais proposer une séance hors de cette liste.
- Quand quelques réponses courtes aideraient Monsieur à vous répondre, utilisez l'outil proposer_reponses (2 à 4 réponses de 24 caractères au plus).
- Appelez les outils après votre texte, jamais à sa place : votre réponse écrite doit se suffire.`;

/** Outils de la conversation (J1). Les actions qui écrivent des données arrivent en J2. */
export const JEFFREY_TOOLS = [
  {
    name: "choisir_seance",
    description: "Propose à Monsieur une séance, choisie parmi SEANCES_AUTORISEES pour ce jour-là. L'application l'affiche avec un bouton pour la démarrer.",
    input_schema: {
      type: "object",
      properties: {
        jour: { type: "string", enum: ["aujourdhui", "demain"] },
        type: { type: "string", description: "Nom exact d'une séance de SEANCES_AUTORISEES pour ce jour." },
        raison: { type: "string", description: "Une phrase : pourquoi celle-ci plutôt qu'une autre." },
      },
      required: ["jour", "type", "raison"],
    },
  },
  {
    name: "proposer_reponses",
    description: "Affiche des réponses rapides que Monsieur peut toucher au lieu d'écrire.",
    input_schema: {
      type: "object",
      properties: { options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["options"],
    },
  },
];

/** Séances que Jeffrey a le droit de proposer, d'après `nextSessions` : celles que le
 *  recommandeur affiche et celles qu'il juge seulement moins prioritaires. Jamais une séance
 *  écartée (à éviter, créneau passé, journée fermée) ni une variante non retenue. */
export function allowedSessions(nextSession) {
  const pick = (day, open) => {
    if (!day || !open) return [];
    const shown = (day.suggestions || []).map((s) => s.type);
    const lower = (day.notProposed || []).filter((n) => n.kind === "priority").map((n) => n.type);
    return [...new Set([...shown, ...lower])];
  };
  return {
    aujourdhui: pick(nextSession?.today, nextSession?.today?.status !== "closed"),
    demain: pick(nextSession?.tomorrow, true),
  };
}

/** Vérifie un appel à choisir_seance. → { ok, jour, type, raison } ou { ok: false, reason }. */
export function validateSessionChoice(input, allowed) {
  const jour = input?.jour === "demain" ? "demain" : input?.jour === "aujourdhui" ? "aujourdhui" : null;
  if (!jour) return { ok: false, reason: "jour invalide" };
  const list = allowed?.[jour] || [];
  if (!list.includes(input?.type)) return { ok: false, reason: `« ${input?.type} » n'est pas autorisée ${jour === "demain" ? "demain" : "aujourd'hui"}` };
  return { ok: true, jour, type: input.type, raison: String(input.raison || "") };
}

/** Texte visible d'une réponse. */
export const replyText = (content) => (content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();

/** Texte à afficher (sans le carnet de bord écrit en fin de « point ») et carnet à enregistrer. */
export function readReply(content) {
  const { advice, journal } = splitCarnet(replyText(content));
  return { text: advice, journal };
}

/** Réflexion selon la demande (choix de Yoann, 29/10/2026) : réduite pour la conversation (premier
 *  mot plus tôt), normale pour le point complet et le bilan. */
export const effortFor = (mode) => (mode === "point" || mode === "bilan" ? "medium" : "low");

const POINT_INSTR = `(Demande de l'application : POINT COMPLET. Faites le point sur la journée et la tendance des 14 derniers jours, dans votre voix, 300 mots au plus, texte simple sans titres ni gras. Couvrez ce qui compte aujourd'hui : séance (d'après le recommandeur), nutrition et hydratation (d'après l'heure), récupération, genou ; puis la tendance de fond (poids en moyenne 7 jours, apports, dépense estimée). Terminez par une conclusion complète. Puis, APRÈS la conclusion, écrivez la ligne ${CARNET_MARK} seule, et en dessous la version mise à jour du CARNET DE BORD : un ÉTAT, pas un journal — réécrit en entier, élagué de ce qui est résolu ou périmé, ${CARNET_MAX_CHARS} caractères au plus : progression chiffrée, ce que vous avez demandé et si c'est appliqué, points de vigilance en cours. Pas de conseils dedans.)`;

// --- Mémoire d'un jour sur l'autre (J1.3, 29/10/2026) ------------------------------------
// La conversation d'un jour passé est versée dans le carnet de bord au premier message suivant,
// dans le même appel (pas d'appel en plus) : le lendemain, Jeffrey s'en souvient sans tout relire.

const MEMORY_MAX_CHARS = 6000;

/** Dernier jour passé dont la conversation n'est pas encore dans le carnet, ou null.
 *  `log` : { "AAAA-MM-JJ": [messages] } ; `doneDate` : dernier jour déjà versé au carnet. */
export function pendingMemoryDate(log, todayKey, doneDate) {
  const days = Object.keys(log || {})
    .filter((d) => d < todayKey && (!doneDate || d > doneDate) && (log[d] || []).some((e) => !e.hidden && e.text))
    .sort();
  return days.length ? days[days.length - 1] : null;
}

/** Transcription lisible d'une journée (messages visibles seulement), tronquée par le début. */
export function memoryTranscript(entries) {
  const lines = (entries || []).filter((e) => !e.hidden && e.text)
    .map((e) => `${e.at || ""} ${e.role === "user" ? "Monsieur" : "Jeffrey"} : ${e.text}`.trim());
  let t = lines.join("\n");
  if (t.length > MEMORY_MAX_CHARS) t = `…${t.slice(t.length - MEMORY_MAX_CHARS)}`;
  return t;
}

/** Ajoute à un message de Monsieur la conversation d'un jour passé et la consigne de mettre le
 *  carnet à jour. `memoryFor` marque le message : la mémoire n'est versée qu'une fois par jour. */
export function withMemory(entry, date, entries) {
  const transcript = memoryTranscript(entries);
  if (!transcript) return entry;
  const base = entry.apiText ?? entry.text;
  const carnet = entry.mode === "point" ? "" : ` Répondez d'abord normalement à Monsieur ; puis, APRÈS votre réponse, écrivez la ligne ${CARNET_MARK} seule, et en dessous la version mise à jour du CARNET DE BORD (un état, réécrit en entier, ${CARNET_MAX_CHARS} caractères au plus : progression chiffrée, ce que vous avez demandé et si c'est appliqué, ce que Monsieur vous a confié, points de vigilance).`;
  return { ...entry, memoryFor: date, apiText: `${base}\n\n(Demande de l'application : voici votre conversation du ${date} avec Monsieur. Retenez-en l'essentiel dans votre carnet de bord.${carnet})\n${transcript}` };
}

/** Message envoyé pour une demande. `text` est affiché dans la conversation ; `apiText` (s'il
 *  diffère) est ce que reçoit le modèle — il reste dans l'historique pour que le cache tienne. */
export function jeffreyAsk(mode, { text, bilanUser } = {}) {
  if (mode === "point") {
    const t = text || "Faites-moi le point, Jeffrey.";
    return { role: "user", text: t, apiText: `${t}\n\n${POINT_INSTR}`, mode };
  }
  if (mode === "bilan") {
    const t = text || "Le bilan des trois derniers mois, je vous prie.";
    return { role: "user", text: t, mode, apiText: `${t}\n\n(Demande de l'application : BILAN 3 MOIS. Les données ci-dessous ont été calculées sur 90 jours. Rédigez-le dans votre voix, vouvoiement, 400 mots au plus, texte simple sans titres ni gras ; les consignes de forme écrites ci-dessous au tutoiement sont remplacées par celles-ci. Interprétez, ne recalculez pas ; un champ null veut dire pas assez de recul.)\n\n${bilanUser || ""}` };
  }
  return { role: "user", text, mode: "chat" };
}

/** Filet de sécurité (essai réel du 29/10/2026 : une réponse faite uniquement de boutons, sans un
 *  mot, malgré la consigne). Si la réponse n'a aucun texte mais appelle des outils, l'app renvoie
 *  aussitôt ce message pour que Jeffrey réponde par écrit (un appel de plus, seulement dans ce cas).
 *  → { role: "user", text } à ajouter à l'historique, ou null si rien à faire. */
export function continuationIfSilent(message) {
  if (replyText(message?.content)) return null;
  if (!(message?.content || []).some((b) => b.type === "tool_use")) return null;
  return { role: "user", text: "(Message de l'application : votre réponse n'avait pas de texte. Répondez maintenant à Monsieur par écrit, en quelques phrases, sans rappeler d'outil.)" };
}

/** Bloc des données du moment (dernier bloc du `system`). Il ne change que si une donnée
 *  change : l'heure n'y figure PAS (elle est dans le message de Monsieur), sinon le cache
 *  serait réécrit à chaque minute — constaté à l'essai réel du 29/10/2026. */
export function jeffreyDataBlock({ facts, allowed }) {
  const { heure_analyse: _heure, ...realtime } = facts.realtime || {};
  const parts = [
    "DONNÉES DU MOMENT — calculées par l'application, ne les recalculez pas. L'heure exacte est indiquée en tête du dernier message de Monsieur.",
    `TEMPS RÉEL (hier vs aujourd'hui) : ${JSON.stringify(realtime)}`,
    `RÉSUMÉ 14 JOURS (moyennes, recommandeur, dépense estimée) : ${JSON.stringify(facts.summary)}`,
    `PROGRESSION PAR EXERCICE (14 j) : ${JSON.stringify(facts.exoProgress)}`,
  ];
  if (facts.autresSeances?.length) parts.push(`SÉANCES SANS SÉRIES (basket, escalade ; "charge" = RPE × minutes) : ${JSON.stringify(facts.autresSeances)}`);
  if (facts.notesTxt) parts.push(`NOTES DE CONTEXTE de Monsieur (14 j) :\n${facts.notesTxt}`);
  parts.push(`SEANCES_AUTORISEES (seules séances que vous pouvez proposer) : ${JSON.stringify(allowed)}`);
  parts.push(facts.journal ? `CARNET DE BORD (votre mémoire des jours précédents) :\n${facts.journal}` : "CARNET DE BORD : vide.");
  return parts.join("\n\n");
}

/** Historique stocké → messages de l'API. Une entrée : { role: "user", text } ou
 *  { role: "assistant", content: [blocs reçus], toolResults?: { [id]: texte } }.
 *  - Un tool_use exige un tool_result en tête du message utilisateur suivant.
 *  - La réflexion n'est renvoyée que pour la dernière réponse (signature intacte) : l'API
 *    l'exige pour enchaîner après un outil, et l'ignore pour les tours plus anciens. */
export function toApiMessages(history) {
  const lastAssistant = history.map((h) => h.role).lastIndexOf("assistant");
  const out = [];
  history.forEach((h, i) => {
    if (h.role === "assistant") {
      const content = (h.content || []).filter((b) =>
        (b.type !== "thinking" && b.type !== "redacted_thinking") || i === lastAssistant);
      if (content.length) out.push({ role: "assistant", content });
      return;
    }
    const prev = out[out.length - 1];
    const results = prev?.role === "assistant"
      ? prev.content.filter((b) => b.type === "tool_use").map((b) => ({
          type: "tool_result", tool_use_id: b.id,
          content: history[i - 1]?.toolResults?.[b.id] ?? "Affiché à Monsieur.",
        }))
      : [];
    out.push({ role: "user", content: [...results, { type: "text", text: h.apiText ?? h.text }] });
  });
  return out;
}

/**
 * Requête complète pour une réponse de Jeffrey.
 * `coach` : résultat de `buildCoachPrompt(data, note)` (on n'en garde que `facts`).
 * `history` : messages déjà échangés aujourd'hui, le dernier étant celui de Monsieur.
 * Retourne { system, messages, tools, allowed } — `allowed` sert à valider choisir_seance.
 */
export function buildJeffreyRequest({ coach, persona, nextSession, history, heure }) {
  const facts = coach.facts;
  const allowed = allowedSessions(nextSession);
  const cache = { type: "ephemeral" };
  const system = [
    { type: "text", text: `${ROLE}\n\nCONTEXTE DU COACH (contraintes permanentes) : ${facts.system}\n\n${JEFFREY_RULES}\n\n${CHAT_RULES}` },
    { type: "text", text: `PERSONNALITÉ (écrite par Monsieur ; les règles ci-dessus priment) :\n${(persona || JEFFREY_PERSONA).trim()}`, cache_control: cache },
    { type: "text", text: jeffreyDataBlock({ facts, allowed }), cache_control: cache },
  ];
  const messages = toApiMessages(history);
  // L'heure va dans le dernier message de Monsieur (pas dans les données, voir plus haut), et le
  // troisième point de cache s'y pose : le tour suivant relit tout l'échange depuis le cache.
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const blocks = last.content;
    blocks.splice(blocks.length - 1, 0, { type: "text", text: `heure : ${heure}` });
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: cache };
  }
  return { system, messages, tools: JEFFREY_TOOLS, allowed };
}
