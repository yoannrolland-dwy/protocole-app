// Voix de Jeffrey : pont vers JeffreyVoice.kt. Dictée : reconnaissance vocale d'Android (J3).
// Voix : Pocket TTS sur le serveur Oracle via LiteLLM (29/10/2026, remplace la synthèse d'Android),
// jouée en flux par le natif à la vitesse choisie. App native seulement : dans le navigateur, le
// micro et le haut-parleur ne s'affichent pas. Règle (décision 11) : il répond comme on lui a
// parlé — une question dictée reçoit sa réponse à voix haute, une question écrite une réponse
// écrite. Sans réseau ou sans serveur, il se tait (choix de Yoann) : la réponse reste écrite.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { createSentenceSplitter, speechChunks } from "@rawcare/core/coach/speechText";
import { voiceServer, speechPlan } from "./voiceConfig.js";

export { VOICE_DEFAULTS, voiceSettings, saveVoiceSettings, voiceKey, saveVoiceKey } from "./voiceConfig.js";

const Voice = registerPlugin("JeffreyVoice");

export const voiceAvailable = () => Capacitor.isNativePlatform();
/** La voix peut parler : app native, adresse et clé renseignées. */
export const voiceReady = () => voiceAvailable() && !!voiceServer();

/** Dictée en français ; `onPartial(texte)` au fil de la parole. → texte final ("" si rien entendu). */
export async function listen(onPartial) {
  const handle = await Voice.addListener("voicePartial", (e) => onPartial?.(e.text || ""));
  try {
    const { text } = await Voice.listen();
    return text || "";
  } finally {
    handle.remove();
  }
}
export const stopListening = () => Voice.stopListening().catch(() => {});

export async function headsetConnected() {
  if (!voiceAvailable()) return false;
  try { return (await Voice.headset()).connected === true; } catch { return false; }
}

// Fin d'une session : un seul écouteur natif `speechDone`, réparti par identifiant.
const waiting = new Map();
let doneListener = null;
function whenDone(id) {
  if (!doneListener) doneListener = Voice.addListener("speechDone", (e) => { waiting.get(e.id)?.(e); waiting.delete(e.id); });
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
    const r = await Voice.speechBegin({ id, ...server, play, final: true, chunks: plan.chunks, cacheKey: cache ? plan.cacheKey : undefined });
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
  const send = (sentence) => {
    const chunks = speechChunks(sentence);
    if (!chunks.length) return;
    if (!done) {
      done = whenDone(id);
      Voice.speechBegin({ id, ...server, play: true, final: false, chunks }).catch((e) => {
        waiting.get(id)?.({ id, ok: false, error: e?.message || "voix indisponible" });
        waiting.delete(id);
      });
    } else Voice.speechPush({ id, chunks }).catch(() => {});
  };
  const splitter = createSentenceSplitter(send);
  return {
    feed: (all) => splitter.feed(all || ""),
    finish: async () => {
      splitter.flush();
      if (!done) return { ok: true, skipped: true };
      Voice.speechFinish({ id }).catch(() => {});
      return done;
    },
  };
}

/** Coupe la voix : requête réseau fermée, lecteur vidé. */
export const stopSpeaking = () => (voiceAvailable() ? Voice.speechStop().catch(() => {}) : Promise.resolve());
