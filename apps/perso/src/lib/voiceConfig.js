// Réglages de la voix de Jeffrey (29/10/2026), sans plugin : lus aussi par la page sans écran du
// brief (briefPage.js), qui n'a pas de pont Capacitor. La voix vient du serveur Oracle via LiteLLM
// (Pocket TTS) ; ce module ne fait que préparer ce qu'il faut envoyer.
import { speechChunks, speechKey } from "@rawcare/core/coach/speechText";
import { getSync, store } from "../store.js";

// `jeffreyVoice` (DATA_KEYS) : { speed, url }. Vitesse de LECTURE (le serveur produit à 1,00) ;
// 1,20 choisie par Yoann. url vide = même adresse que LiteLLM. Les anciens réglages de la voix
// Android ({ voice, rate, pitch }) sont ignorés.
export const VOICE_DEFAULTS = { speed: 1.2, url: "" };
export function voiceSettings() {
  const s = { ...VOICE_DEFAULTS, ...(getSync("jeffreyVoice", {}) || {}) };
  return { speed: Number(s.speed) || VOICE_DEFAULTS.speed, url: s.url || "" };
}
export const saveVoiceSettings = (v) => store.set("jeffreyVoice", { speed: v.speed, url: v.url || "" });

// Clé dédiée à la voix (`voiceKey`) : hors DATA_KEYS, comme les autres clés, jamais exportée.
export const voiceKey = () => getSync("voiceKey", "") || "";
export const saveVoiceKey = (k) => store.set("voiceKey", k);

/** { url, key, speed } si la voix est configurée, sinon null. */
export function voiceServer() {
  const s = voiceSettings();
  const url = (s.url || getSync("litellmUrl", "") || "").trim().replace(/\/+$/, "");
  const key = voiceKey().trim();
  return url && key ? { url, key, speed: s.speed } : null;
}

/** Phrases prêtes à dire et clé de cache d'un texte complet, ou null s'il n'y a rien à dire. */
export function speechPlan(text) {
  const chunks = speechChunks(text || "");
  return chunks.length ? { chunks, cacheKey: speechKey(chunks) } : null;
}
