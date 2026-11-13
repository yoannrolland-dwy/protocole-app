// Record coché à l'écran → JEFFREY félicite (13/11/2026, choix de Yoann : « le mélange des deux,
// seulement casque branché »). PROTOCOLE ne parle pas : il prévient l'appli JEFFREY par une
// diffusion protégée (même permission PROTOCOLE_SIGNAL que le brief, G2), et JEFFREY dit une
// phrase générale tout de suite, puis le détail (`detail`, déjà rédigé ici).
//
// Règles :
// - seulement une série cochée À L'ÉCRAN : une série notée à la voix (pont, `noter_serie`) porte
//   déjà `record: true` dans sa réponse, JEFFREY le sait ;
// - même définition du record que l'étoile du carnet (`recordSetIndexes`, V4) ;
// - jamais un jour où le genou est hors base (`painRed`, même garde-fou que l'étoile) ;
// - une seule fois par série et par valeurs (décocher puis recocher ne répète pas) ;
// - casque branché : vérifié côté natif au moment de l'envoi (JeffreySignal.sendRecord).
import { recordSetIndexes, ofName } from "@rawcare/core/session/engine";
import { kilos } from "@rawcare/core/session/voiceSession";

const sent = new Set();

const isTime = (e) => e.mode === "temps";

/** « Nouveau record de développé incliné haltères : 32 kilos, 9 répétitions. » */
export function recordDetail(e, s) {
  const reps = +s.val || 0;
  const what = isTime(e)
    ? `${reps} secondes`
    : [+s.poids > 0 ? kilos(+s.poids) : null, `${reps} répétition${reps >= 2 ? "s" : ""}`].filter(Boolean).join(", ");
  const leg = s.leg === "G" ? ", jambe gauche" : s.leg === "D" ? ", jambe droite" : "";
  return `Nouveau record ${ofName(e.nom)}${leg} : ${what}.`;
}

/**
 * Série `si` de l'exercice `ei` cochée à l'écran : `after` = exercices APRÈS le cochage, `ref` = le
 * record à battre de cet exercice (hors séance en cours). → la charge utile du signal, ou null.
 */
export function recordPayload({ after, ei, si, ref, painRed = false, date }) {
  if (painRed || !ref) return null;
  const e = after?.[ei];
  const s = e?.series?.[si];
  if (!e || !s?.fait) return null;
  const recs = recordSetIndexes(e, ref);
  if (!recs.has(si)) return null;
  // Le record battu par cette série : la dernière série record cochée avant elle, sinon l'historique.
  let prev = ref;
  for (const i of recs) if (i < si) prev = e.series[i];
  const time = isTime(e);
  return {
    date,
    exercice: e.nom,
    ...(time ? { secondes: +s.val || 0 } : { kg: +s.poids || 0, reps: +s.val || 0 }),
    ...(s.leg ? { jambe: s.leg } : {}),
    ancien: time ? { secondes: +prev.val || 0 } : { kg: +prev.poids || 0, reps: +prev.val || 0 },
    detail: recordDetail(e, s),
  };
}

/** Une seule fois par série et par valeurs dans cette ouverture de l'app. → true si nouveau. */
export function firstTime(p) {
  const k = [p.date, p.exercice, p.jambe || "", p.kg ?? "", p.reps ?? "", p.secondes ?? ""].join("|");
  if (sent.has(k)) return false;
  sent.add(k);
  return true;
}

/** Pour les tests. */
export function resetRecordSignals() {
  sent.clear();
}
