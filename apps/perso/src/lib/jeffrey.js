// Jeffrey (chantier J, lot JT, 29/10/2026) : l'app parle dans la voix de son majordome.
// Textes fixes écrits à l'avance, sans appel à l'IA : gratuits, instantanés, hors ligne.
// Voix : vouvoiement, « Monsieur », flegme britannique, humour pince-sans-rire, taquin mais
// bienveillant (voir ROADMAP.md, chantier J). Deux règles qui priment sur le ton : il ne change
// jamais les faits, et une alerte reste dite clairement.
//
// Chaque clé a une ou plusieurs variantes ; `{x}`, `{t}`… sont remplacés par les valeurs passées.
// Les libellés (boutons, champs) et les chiffres ne passent jamais par ici.

import { today } from "@rawcare/core/dateUtils";

export const PHRASES = {
  // --- Confirmations (ce qui vient d'être fait passe en tête : la barre coupe la fin si trop long)
  added: [
    "{x} : noté, Monsieur.",
    "{x} ajouté. Avec ma bénédiction, Monsieur.",
    "{x} : c'est consigné, Monsieur.",
    "{x}. Votre estomac a été prévenu, Monsieur.",
  ],
  copied: ["{x}, Monsieur.", "{x}. Rien n'a été écrasé, Monsieur."],
  fromYesterday: ["{x}. La tradition a du bon, Monsieur.", "{x}. On ne change pas une équipe qui gagne, Monsieur."],
  settingsSaved: ["Réglages enregistrés, Monsieur.", "C'est noté, Monsieur."],
  contextCopied: ["Contexte copié, Monsieur. Collez-le dans une conversation Claude."],
  backupSent: ["Sauvegarde envoyée, Monsieur. Vérifiez tout de même qu'elle est bien arrivée."],
  backupCancelled: ["Sauvegarde annulée, Monsieur. Rien n'est parti."],
  backupFailed: ["La sauvegarde a échoué, Monsieur : {x}"],
  imported: ["Données restaurées, Monsieur. Je recharge…"],
  invalidFile: ["Ce fichier n'est pas une sauvegarde, Monsieur."],
  modelsFailed: ["Je n'ai pas pu lire la liste des modèles, Monsieur : {x}"],

  // --- Health Connect
  hcRunning: ["Synchronisation en cours, Monsieur…"],
  hcOk: ["À jour, Monsieur · dernière synchro {t}"],
  hcUnavailable: ["Health Connect est absent de cet appareil, Monsieur."],
  hcDenied: ["Accès refusé, Monsieur : autorisez pas, sommeil, poids et fréquence cardiaque dans Health Connect."],
  hcError: ["Health Connect fait des siennes, Monsieur : {x}"],
  hcIdle: ["Pas encore synchronisé, Monsieur."],

  // --- Écrans vides
  noData: [
    "Rien à montrer pour l'instant, Monsieur.",
    "Néant, Monsieur. Pour le moment.",
    "Page blanche, Monsieur. Elle ne demande qu'à se remplir.",
  ],
  noWeight: ["Aucune pesée, Monsieur. La balance ne vous en tient pas rigueur.", "Pas encore de pesée, Monsieur."],
  noNight: ["Aucune nuit enregistrée, Monsieur. Je n'ose croire que vous ne dormiez jamais."],
  noKnee: ["Aucun relevé, Monsieur. Le genou garde le silence."],
  noSession: ["Aucune séance enregistrée, Monsieur. Le carnet attend son premier chapitre."],
  noMuscu: ["Aucune séance de muscu pour l'instant, Monsieur."],
  noVolume: ["Aucune série de musculation cochée ces 7 derniers jours, Monsieur. Les haltères s'ennuient."],
  noRecentExercise: ["Aucun exercice fait ces 60 derniers jours, Monsieur."],
  noExercise: ["Aucun exercice enregistré, Monsieur. Validez une séance de muscu, il apparaîtra ici."],
  firstTime: ["Première fois, Monsieur.", "Terrain vierge, Monsieur."],
  noFoodDay: ["Rien d'avalé ce jour, Monsieur. Officiellement.", "Aucun aliment ce jour, Monsieur."],
  noOtherDay: ["Aucun autre jour avec ce repas rempli, Monsieur."],
  noProduct: ["Aucun produit trouvé, Monsieur."],
  noCiqual: ["Rien dans CIQUAL, Monsieur. Tentez un autre mot."],
  searchHint: ["À vous, Monsieur : cherchez un aliment."],
  noMatch: ["Aucune date de match enregistrée, Monsieur."],
  noDish: ["Aucun plat reconnu, Monsieur. La carte reste muette."],
  energyPartial: ["Pas assez de données pour un score complet, Monsieur. Le détail est ci-dessous."],

  // --- IA : configuration et erreurs (le détail technique reste affiché tel quel)
  aiMissingLite: ["Renseignez l'adresse, la clé et le modèle LiteLLM dans les Réglages, Monsieur, et je m'y mets."],
  aiMissingKey: ["Il me faut votre clé API Anthropic dans les Réglages, Monsieur."],
  aiError: ["Je crains un contretemps, Monsieur : {x}"],
  aiRateLimit: ["Le serveur demande grâce, Monsieur. Patientez une minute, puis"],
  aiThinkingBudget: ["Le modèle a épuisé son budget de réflexion avant de répondre, Monsieur. Réessayez ; si cela se répète, dites-le-moi."],
  aiCut: ["Réponse coupée avant la fin, Monsieur (budget atteint). Réessayez."],
  aiEmpty: ["Réponse vide, Monsieur (stop_reason : {x}). Signalez-le-moi pour diagnostic."],
  aiUnreadable: ["Réponse illisible, Monsieur. Réessayez."],
  photoUnread: ["Une photo n'a pas pu être lue, Monsieur. Réessayez."],
  photoUnknown: ["Je ne reconnais pas ce plat, Monsieur. Une photo plus proche ou mieux éclairée, peut-être ?"],
  menuCut: ["Réponse coupée, Monsieur : la carte est trop fournie pour le budget actuel. Réessayez."],
  menuUnreadable: ["Réponse illisible, Monsieur. Réessayez, ou simplifiez le texte ou la photo."],
  linkFailed: ["Lecture du lien échouée, Monsieur : {x} Essayez une photo à la place."],

  // --- Conversation (J1.2)
  chatHello: ["À votre service, Monsieur. Que puis-je pour vous ?", "Monsieur m'a sonné ? Je vous écoute."],
  chatThinking: ["Un instant, Monsieur, je réfléchis…", "Je consulte vos registres, Monsieur…"],
  chatPlaceholder: ["Écrivez à Jeffrey, Monsieur…"],
  personaReset: ["Personnalité d'origine rétablie, Monsieur."],
  cardHello: ["Bonjour Monsieur. Je vous fais le point de la matinée ?", "Bien le bonjour, Monsieur. Un point sur la journée ?"],
  cardTalk: ["Un mot, Monsieur ?", "Je suis là, Monsieur."],
  actionDone: ["Fait, Monsieur.", "C'est fait, Monsieur.", "Voilà qui est fait, Monsieur."],
  actionCancelled: ["Bien, Monsieur, je n'en fais rien."],

  // --- Brief du matin (J4.1) : {x} = « J'ai votre nuit ; il me manque votre pesée et votre genou. »
  briefWaiting: ["Bonjour Monsieur. {x}", "Bien le bonjour, Monsieur. {x}"],
  briefRemind: ["Monsieur, {x} Le brief partira à 10 h, avec ou sans.", "Je me permets d'insister, Monsieur : {x} Le brief part à 10 h quoi qu'il arrive."],
  briefPreparing: ["Je prépare votre brief, Monsieur."],
  briefRetry: ["Un contretemps, Monsieur. Nouvel essai dans cinq minutes."],
  briefFallback: ["Mon cerveau est en grève ce matin, Monsieur ; voici l'essentiel."],
  briefTest: ["Dans dix secondes, Monsieur. Fermez l'app si vous voulez voir la notification arriver."],

  // --- Notifications
  backupReminderTitle: ["Jeffrey"],
  backupReminder: ["Monsieur, voilà une semaine que vos données n'ont pas quitté ce téléphone. Réglages → Sauvegarder hors du téléphone."],
};

const hash = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};

/** Une phrase de Jeffrey. `stable` : même variante toute la journée (écrans vides, statuts
 *  affichés à chaque rendu) ; sinon tirée au hasard (confirmations, calculées une fois). */
export function say(key, vars = {}, { stable = false } = {}) {
  const list = PHRASES[key];
  if (!list) return key;
  const i = stable ? hash(key + today()) % list.length : Math.floor(Math.random() * list.length);
  return list[i].replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

/** Même variante toute la journée : pour ce qui est recalculé à chaque rendu. */
export const sayStable = (key, vars) => say(key, vars, { stable: true });

/** Erreur affichée : déjà dans la voix de Jeffrey (elle vient de ce recueil) → telle quelle ;
 *  sinon (message technique d'un serveur) → précédée de son « contretemps ». */
export const sayError = (err) => (/Monsieur/.test(String(err || "")) ? String(err) : sayStable("aiError", { x: err || "cause inconnue" }));
