// Voix de Jeffrey : pont vers JeffreyVoice.kt. Dictée : reconnaissance vocale d'Android (J3).
// Voix : Pocket TTS sur le serveur Oracle via LiteLLM (29/10/2026, remplace la synthèse d'Android),
// jouée en flux par le natif à la vitesse choisie. App native seulement : dans le navigateur, le
// micro et le haut-parleur ne s'affichent pas. Règle (décision 11) : il répond comme on lui a
// parlé — une question dictée reçoit sa réponse à voix haute, une question écrite une réponse
// écrite. Sans réseau ou sans serveur, il se tait (choix de Yoann) : la réponse reste écrite.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { createSentenceSplitter, speechChunks } from "@rawcare/core/coach/speechText";
import { voiceServer, speechPlan, voiceEnabled, saveVoiceSettings } from "./voiceConfig.js";

export { VOICE_DEFAULTS, voiceSettings, saveVoiceSettings, voiceKey, saveVoiceKey, voiceEnabled } from "./voiceConfig.js";

const Voice = registerPlugin("JeffreyVoice");
// Pont et plateforme injectables (tests) : par défaut le plugin natif et Capacitor.
let bridge = Voice;
let isNative = () => Capacitor.isNativePlatform();
export function _setVoiceBridge(b, native) {
  bridge = b || Voice;
  isNative = native ? () => true : () => Capacitor.isNativePlatform();
  doneListener = null;
  waiting.clear();
}

export const voiceAvailable = () => isNative();
/** La voix peut parler : app native, adresse et clé renseignées. */
export const voiceReady = () => voiceAvailable() && !!voiceServer();

/** Dictée en français ; `onPartial(texte)` au fil de la parole. → texte final ("" si rien entendu). */
export async function listen(onPartial) {
  const handle = await bridge.addListener("voicePartial", (e) => onPartial?.(e.text || ""));
  try {
    const { text } = await bridge.listen();
    return text || "";
  } finally {
    handle.remove();
  }
}
export const stopListening = () => bridge.stopListening().catch(() => {});

export async function headsetConnected() {
  if (!voiceAvailable()) return false;
  try { return (await bridge.headset()).connected === true; } catch { return false; }
}

// Fin d'une session : un seul écouteur natif `speechDone`, réparti par identifiant.
const waiting = new Map();
let doneListener = null;
function whenDone(id) {
  if (!doneListener) doneListener = bridge.addListener("speechDone", (e) => { waiting.get(e.id)?.(e); waiting.delete(e.id); });
  return new Promise((resolve) => waiting.set(id, resolve));
}
let seq = 0;
const newSpeechId = () => `v${Date.now().toString(36)}${++seq}`;

/**
 * Dit un texte complet (réponse, brief), phrase par phrase. `play: false` prépare seulement
 * l'audio en cache (jamais si une voix joue déjà). `cache: false` ignore et n'écrit pas le cache
 * (essai de la voix). → { ok, cancelled, cached, firstAudioMs, underruns, error, skipped }.
 */
export async function speak(text, { play = true, cache = true } = {}) {
  const server = voiceAvailable() ? voiceServer() : null;
  const plan = speechPlan(text);
  if (!server || !plan) return { ok: false, skipped: true };
  const id = newSpeechId();
  const done = whenDone(id);
  try {
    const r = await bridge.speechBegin({ id, ...server, play, final: true, chunks: plan.chunks, cacheKey: cache ? plan.cacheKey : undefined });
    if (r?.skipped) { waiting.delete(id); return { ok: false, skipped: true }; }
  } catch (e) {
    waiting.delete(id);
    return { ok: false, error: e?.message || "voix indisponible" };
  }
  return done;
}

/**
 * Voix pendant que la réponse s'écrit : `feed(texteComplet)` à chaque morceau reçu (même texte
 * que l'affichage en direct), `finish()` à la fin de la réponse → se résout quand tout est dit.
 * La première phrase part dès qu'elle est complète. Rien n'est gardé en cache.
 */
export function createSpeechStream() {
  const server = voiceAvailable() ? voiceServer() : null;
  if (!server) return { feed() {}, finish: async () => ({ ok: false, skipped: true }) };
  const id = newSpeechId();
  let done = null;
  let off = false; // voix coupée en cours de réponse : plus rien n'est envoyé au natif
  const settle = (res) => { waiting.get(id)?.({ id, ...res }); waiting.delete(id); };
  const send = (sentence) => {
    if (off) return;
    // L'interrupteur est relu à chaque phrase : couper la voix pendant que la réponse s'écrit
    // arrête la parole (setVoiceEnabled) et les phrases suivantes ne partent plus. Le texte, lui,
    // continue de s'écrire : le flux de la réponse ne dépend pas de la voix.
    if (!voiceEnabled()) { off = true; if (done) settle({ ok: false, cancelled: true, disabled: true }); return; }
    const chunks = speechChunks(sentence);
    if (!chunks.length) return;
    if (!done) {
      done = whenDone(id);
      bridge.speechBegin({ id, ...server, play: true, final: false, chunks }).then((r) => {
        // Le natif refuse une session quand la voix est coupée de son côté (réglage synchronisé).
        if (r?.skipped) { off = true; settle({ ok: false, skipped: true, disabled: !!r.disabled }); }
      }, (e) => settle({ ok: false, error: e?.message || "voix indisponible" }));
    } else bridge.speechPush({ id, chunks }).catch(() => {});
  };
  const splitter = createSentenceSplitter(send);
  return {
    feed: (all) => splitter.feed(all || ""),
    finish: async () => {
      splitter.flush();
      if (!done) return off ? { ok: false, skipped: true, disabled: true } : { ok: true, skipped: true };
      if (!off) bridge.speechFinish({ id }).catch(() => {});
      return done;
    },
  };
}

/** Coupe la voix : requête réseau fermée, lecteur vidé. */
export const stopSpeaking = () => (voiceAvailable() ? bridge.speechStop().catch(() => {}) : Promise.resolve());

/**
 * Interrupteur « Voix de Jeffrey » (01/11/2026). Enregistré dans `jeffreyVoice.enabled`, puis
 * confié au natif (préférences privées `jeffrey_voice`), qui le lit lui-même pour tout ce qui
 * parle app fermée (brief, notification, fin de repos). Couper : la parole en cours s'arrête, la
 * requête vocale est fermée, les phrases en attente sont jetées. Réactiver : rien n'est rejoué, la
 * voix sert seulement aux demandes suivantes.
 */
export async function setVoiceEnabled(on) {
  saveVoiceSettings({ enabled: !!on });
  if (!voiceAvailable()) return;
  try { await bridge.setEnabled({ enabled: !!on }); } catch { /* resynchronisé au prochain lancement */ }
  if (!on) await stopSpeaking();
}

/** Au lancement : recopie l'interrupteur vers le natif (installation neuve, restauration d'une
 *  sauvegarde, appel précédent perdu). Le stockage de l'app fait foi. */
export async function syncVoiceEnabled() {
  if (!voiceAvailable()) return;
  try { await bridge.setEnabled({ enabled: voiceEnabled() }); } catch { /* ancienne version native */ }
}
