// Voix de Jeffrey (chantier J, J3, 29/10/2026) : pont vers JeffreyVoice.kt (dictée et synthèse
// vocale d'Android, gratuites et hors ligne). App native seulement : dans le navigateur, le micro
// et le haut-parleur ne s'affichent pas. Règle (décision 11) : il répond comme on lui a parlé —
// une question dictée reçoit sa réponse à voix haute, une question écrite une réponse écrite.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getSync, store } from "../store.js";

const Voice = registerPlugin("JeffreyVoice");

// Réglages { voice, rate, pitch } — clé `jeffreyVoice` (DATA_KEYS). voice null = voix française
// par défaut du téléphone.
export const VOICE_DEFAULTS = { voice: null, rate: 1, pitch: 1 };
export const voiceSettings = () => ({ ...VOICE_DEFAULTS, ...(getSync("jeffreyVoice", {}) || {}) });
export const saveVoiceSettings = (v) => store.set("jeffreyVoice", v);

export const voiceAvailable = () => Capacitor.isNativePlatform();

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

/** Lit le texte avec les réglages ; se résout à la fin de la lecture. */
export async function speak(text, settings = voiceSettings()) {
  if (!voiceAvailable() || !text) return;
  try {
    await Voice.speak({ text, voice: settings.voice, rate: settings.rate, pitch: settings.pitch });
  } catch (e) {
    console.warn("voix", e);
  }
}
export const stopSpeaking = () => (voiceAvailable() ? Voice.stop().catch(() => {}) : Promise.resolve());

/** Voix françaises installées : [{ name, label, local }]. */
export async function listVoices() {
  if (!voiceAvailable()) return [];
  try { return (await Voice.voices()).voices || []; } catch { return []; }
}

export async function headsetConnected() {
  if (!voiceAvailable()) return false;
  try { return (await Voice.headset()).connected === true; } catch { return false; }
}
