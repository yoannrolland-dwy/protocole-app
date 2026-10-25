// Minuteur de repos partagé (chantier U, U3 étape 3, 25/10/2026). Il vivait dans l'état de
// MuscuLogger, donc s'arrêtait à l'écran dès qu'on quittait l'onglet Séance (seule la
// notification native continuait). Il vit maintenant au niveau du module : le carnet et la
// barre « Séance en cours » lisent le même décompte, qui continue d'un onglet à l'autre.
//
// Logique reprise du carnet : décompte calé sur l'heure de FIN (Android ralentit les
// setInterval en arrière-plan — correctif du 25/10/2026), recalcul au retour au premier plan,
// bip Web Audio seulement hors app native (le réveil système sonne déjà, voir timerNotify.js).
import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { scheduleRestAlarm, cancelRestAlarm, hideRestCountdown } from "../timerNotify.js";

// endAt != null ⇔ décompte en cours. `remaining` = secondes affichées (figées en pause).
let state = { secs: 120, remaining: 120, endAt: null, label: "" };
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const now = () => Date.now();
const left = () => (state.endAt ? Math.max(0, Math.ceil((state.endAt - now()) / 1000)) : state.remaining);

let interval = null;
const stopTicking = () => { clearInterval(interval); interval = null; };
const startTicking = () => { stopTicking(); interval = setInterval(tick, 500); };
function tick() {
  if (!state.endAt) return;
  const r = left();
  if (r === 0) { stopTicking(); set({ endAt: null, remaining: 0 }); finish(); }
  else if (r !== state.remaining) set({ remaining: r });
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", tick);

// Volume et durée divisés par deux (04/08/2026) : gain de crête 0,175, 3 impulsions ~0,29 s.
let audio = null;
const ensureAudio = () => {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { /* audio indispo */ }
};
const beep = () => {
  try {
    if (audio) {
      const t0 = audio.currentTime;
      [0, 0.1, 0.2].forEach((t) => {
        const o = audio.createOscillator(); const g = audio.createGain();
        o.type = "sine"; o.frequency.value = 880;
        o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, t0 + t);
        g.gain.exponentialRampToValueAtTime(0.175, t0 + t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.08);
        o.start(t0 + t); o.stop(t0 + t + 0.085);
      });
    }
  } catch { /* ignore */ }
  try { navigator.vibrate?.([200, 90, 200]); } catch { /* ignore */ }
};
function finish() {
  if (!Capacitor.isNativePlatform()) beep();
  hideRestCountdown();
}

export const restTimer = {
  /** Lance un décompte de `secs` secondes (coche d'une série, bouton repos/maintien). */
  start(secs, label = "") {
    ensureAudio();
    set({ secs, remaining: secs, endAt: now() + secs * 1000, label });
    startTicking();
    scheduleRestAlarm(secs, label);
  },
  /** Pause / reprise ; relance depuis la durée réglée si le décompte était fini. */
  toggle(label) {
    if (state.endAt) {
      const r = left();
      stopTicking(); set({ endAt: null, remaining: r });
      cancelRestAlarm();
      return;
    }
    const secs = state.remaining > 0 ? state.remaining : state.secs;
    ensureAudio();
    set({ remaining: secs, endAt: now() + secs * 1000, label: label ?? state.label });
    startTicking();
    scheduleRestAlarm(secs, label ?? state.label);
  },
  /** Règle la durée sans lancer (pastilles 2:00…0:30, remise à zéro). Arrête un décompte. */
  set(secs) {
    stopTicking(); set({ secs, remaining: secs, endAt: null });
    cancelRestAlarm();
  },
  /** Ajoute du temps (+30 s) ; reprogramme le réveil natif, qui remplace le précédent. */
  add(secs) {
    if (state.endAt) {
      set({ endAt: state.endAt + secs * 1000 });
      const r = left(); set({ remaining: r });
      scheduleRestAlarm(r, state.label);
    } else {
      set({ remaining: state.remaining + secs });
    }
  },
  /** Fin de séance (validée ou annulée) : plus aucun décompte ni réveil. */
  stop() {
    stopTicking(); set({ endAt: null, remaining: state.secs });
    cancelRestAlarm();
  },
};

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const snapshot = () => state;
/** `{ secs, remaining, running, label }`, mis à jour à chaque seconde pendant un décompte. */
export function useRestTimer() {
  const s = useSyncExternalStore(subscribe, snapshot);
  return { ...s, running: s.endAt != null };
}
