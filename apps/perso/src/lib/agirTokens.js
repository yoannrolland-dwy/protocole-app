// Jetons de relecture de l'op `agir` du pont JEFFREY (G3, 05/11/2026), sortis de lib/bridge.js le
// 12/11/2026 pour être partagés avec les gestes de séance (lib/sessionGestures.js) et testés sous
// Node. Clé `jeffreyAgir`, hors DATA_KEYS (marqueur du moment, jamais exporté) : 3 minutes, 5 au plus.
import { getSync } from "../store.js";

export const AGIR_KEY = "jeffreyAgir";
export const AGIR_TTL_MS = 3 * 60_000;
export const AGIR_MAX = 5;

/** Jetons encore valables à l'instant `now` : { [jeton]: { key, resume, exp, cible? } }. */
export const pendingAgir = (now) => Object.fromEntries(Object.entries(getSync(AGIR_KEY, {}) || {}).filter(([, v]) => v?.exp > now));
export const newJeton = () => Math.random().toString(36).slice(2, 8);

/** Les jetons gardés quand on en ajoute un : les plus récents, `AGIR_MAX - 1` au plus. */
export const keptAgir = (now) => Object.entries(pendingAgir(now)).sort((a, b) => b[1].exp - a[1].exp).slice(0, AGIR_MAX - 1);
