// Restauration en cours (audit du 10/11/2026, point 4, fin) : pendant le gel qui suit une
// restauration (store.js, `storageFrozen`), les écritures sont refusées sans bruit. Le pont JEFFREY
// et la réponse depuis la notification ne lisaient pas ce refus : une action aurait été annoncée
// faite sans être écrite. Ici, une opération qui écrit est refusée AVANT de commencer, et son
// résultat est écarté si le gel est apparu PENDANT (rien n'est alors sûr) : on répond
// « restauration en cours, réessayez », jamais un succès.
import { storageFrozen } from "../store.js";

export const RESTORING = "restauration";

/** Opérations du pont qui écrivent (y compris `agir` en relecture : le jeton est écrit). */
export const BRIDGE_WRITE_OPS = ["analyse", "brief_fait", "agir"];

/**
 * Exécute `run()` sauf pendant une restauration. → `{ blocked: true }` si le gel était là avant ou
 * est apparu pendant ; sinon `{ blocked: false, value }`.
 */
export async function guardWrite(run, { frozen = storageFrozen } = {}) {
  if (frozen()) return { blocked: true };
  const value = await run();
  if (frozen()) return { blocked: true };
  return { blocked: false, value };
}

/**
 * Aiguillage du pont : une opération qui écrit passe par `guardWrite` ; bloquée, elle rend
 * `{ ok: false, erreur: "restauration" }` (code court du contrat, voir BRIDGE_ERRORS).
 */
export async function dispatchBridge(op, run, { frozen = storageFrozen } = {}) {
  if (!BRIDGE_WRITE_OPS.includes(op)) return run();
  const r = await guardWrite(run, { frozen });
  return r.blocked ? { ok: false, erreur: RESTORING } : r.value;
}
