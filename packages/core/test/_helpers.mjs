// Outils partagés par les tests de @rawcare/core (chantier T1, 04/10/2026).
// Lancer : `npm test` à la racine du monorepo (node --test, aucune dépendance).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setClock, shiftDateKey } from "../src/dateUtils.js";

const here = dirname(fileURLToPath(import.meta.url));

// Date de référence FIGÉE de tous les tests : dimanche 4 octobre 2026, 10h00 locale.
// Hors fenêtre de sèche `DEFAULT_TARGETS.cut` (27/07 → 18/08/2026), un dimanche de match
// dans le planning réel (`BS.matchDates`). Tout ce qui passe par `today()`/`nowHM()` dans
// le core (prompt Coach IA, recommandeur sans `asOf`, targets) lit cette horloge.
export const T0 = "2026-10-04";
export const NOW = new Date(2026, 9, 4, 10, 0);
export const fixClock = (d = NOW) => setClock(() => new Date(d));
export const d = (n) => shiftDateKey(T0, -n); // il y a n jours
export const at = (key, h, m = 0) => { const [y, mo, dd] = key.split("-").map(Number); return new Date(y, mo - 1, dd, h, m); };
export const dow = (key) => { const [y, m, dd] = key.split("-").map(Number); return new Date(y, m - 1, dd).getDay(); };

// Planning réel de Yoann (copie de WEEKLY_PLAN_FAMILIES + règles d'App.jsx : semaine avec
// match détectée par un match le dimanche, Full Body le lendemain d'un match).
export const FAM = {
  sansMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Lower"], 0: ["Upper"] },
  avecMatch: { 1: ["Lower"], 2: ["Repos"], 3: ["Mobilité", "Basket"], 4: ["Upper"], 5: ["Mobilité", "Basket"], 6: ["Upper"], 0: ["Basket"] },
};
export const BS = { weekly: [3, 5], matchDates: ["2026-10-04", "2026-10-11"] };
export const planForWith = (bs) => (k) => {
  const w = dow(k), sunday = shiftDateKey(k, w === 0 ? 0 : 7 - w);
  const matchWeek = bs.matchDates.includes(sunday), postMatch = bs.matchDates.includes(shiftDateKey(k, -1));
  return { weeklyPlan: postMatch ? ["Full Body"] : FAM[matchWeek ? "avecMatch" : "sansMatch"][w], matchWeek, postMatch };
};
export const planFor = planForWith(BS);

export const session = (date, type, exercices = []) => ({ date, type, exercices });
export const exo = (nom, fait, poids = 50, val = 9) => ({ nom, series: [{ poids, val, fait }] });
export const kneeOk = (date = T0) => [{ date, pain: 2, baseline: true }];
export const kneeRed = (date = T0) => [{ date, pain: 7, baseline: false }];

// Extrait le JSON "RÉSUMÉ 14 JOURS" du message utilisateur du Coach IA.
export const summaryOf = (user) =>
  JSON.parse(user.split("RÉSUMÉ 14 JOURS (moyennes fiables, tendance de fond) :\n")[1].split("\n\nJOUR PAR JOUR")[0]);

// Capture de non-régression datée : la valeur est comparée au fichier `snapshots/<name>.json`.
// Fichier absent, ou `UPDATE_SNAPSHOTS=1` → (ré)écrit. Mettre à jour une capture est un acte
// volontaire : c'est acter qu'un changement de sortie est voulu.
export function snapshot(name, value) {
  const dir = join(here, "snapshots");
  const file = join(dir, `${name}.json`);
  if (!existsSync(file) || process.env.UPDATE_SNAPSHOTS) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
    return;
  }
  assert.deepEqual(value, JSON.parse(readFileSync(file, "utf8")), `capture ${name} : sortie différente de snapshots/${name}.json (UPDATE_SNAPSHOTS=1 pour acter le changement)`);
}
