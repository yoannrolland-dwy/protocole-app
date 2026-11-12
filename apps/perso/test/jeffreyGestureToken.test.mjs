// Jeton des gestes de séance (12/11/2026, plan jeffrey-app/docs/cadrage/PLAN_JETON_GESTES_SEANCE.md).
// Un geste confirmé après relecture n'est écrit que si son jeton est valable (même action, mêmes
// paramètres, 3 minutes, une seule fois) et si sa cible n'a pas changé. Sans jeton : geste immédiat,
// inchangé. Faux stockage, séances inventées, réveil natif simulé ; aucun réseau.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
const alarms = [];
globalThis.window = {
  JeffreyBridgePage: { restAlarm: (json) => alarms.push(JSON.parse(json)) },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
};

const { runSessionNow, NOT_READ_BACK, SESSION_CHANGED, canon } = await import("../src/lib/sessionGestures.js");
const { AGIR_KEY, AGIR_TTL_MS } = await import("../src/lib/agirTokens.js");
const { newSessionDraft, logSet, restAction } = await import("@rawcare/core/session/voiceSession");
const { writeDraft, readDraft } = await import("../src/lib/sessionDraft.js");

const T0 = Date.parse("2026-11-12T07:10:00");
const raw = () => mem.get("protocole:trainingDraft");
const tokens = () => JSON.parse(mem.get(`protocole:${AGIR_KEY}`) || "{}");
const ctx = (now = T0) => ({ training: [], knee: [], now });
const ROWING = 2;

/** Séance Upper A fictive, carnet ouvert ; `screen(edit)` = un geste fait à l'écran. */
function session(over = {}) {
  return writeDraft({ ...newSessionDraft({ type: "Upper A", training: [], hsrWeek: 9, date: "2026-11-12", start: "07:00" }), ...over });
}
const screen = (edit) => writeDraft(edit(readDraft()));
const set = (d, ei, si, s) => ({ ...d, exos: d.exos.map((e, i) => (i !== ei ? e : { ...e, series: e.series.map((x, j) => (j !== si ? x : { ...x, ...s })) })) });
const dryRun = (action, p, now = T0) => runSessionNow(action, p, { now, write: false });
const confirm = (action, p, jeton, now = T0) => runSessionNow(action, p, { now, write: true, jeton });

beforeEach(() => { mem.clear(); alarms.length = 0; });

// --- Relecture ---------------------------------------------------------------------------------

test("relecture d'un geste : jeton, resume et immediat ; rien n'est écrit dans la séance", async () => {
  session();
  const before = raw();
  const r = await dryRun("noter_serie", { reps: 8, kg: 30 });
  assert.equal(r.ok, true);
  assert.equal(r.immediat, true);
  assert.match(r.resume, /Développé incliné haltères, série 1 notée, 8 à 30 kilos, repos 2 min 30\./);
  assert.match(r.jeton, /^[a-z0-9]+$/);
  assert.equal(raw(), before, "brouillon identique (rev compris)");
  assert.equal(alarms.length, 0, "aucun réveil");
  const t = tokens()[r.jeton];
  assert.equal(t.exp, T0 + AGIR_TTL_MS);
  assert.equal(typeof t.cible, "string");
  assert.doesNotMatch(t.cible, /"rev"|endAt/, "la cible d'une série ne porte ni rev ni minuteur");
});

test("relecture refusée par la règle : même refus qu'avant, aucun jeton", async () => {
  session();
  const r = await dryRun("aller_a", { exercice: "squat" });
  assert.equal(r.fait, false);
  assert.match(r.raison, /aucun exercice « squat »/);
  assert.deepEqual(tokens(), {});
});

// --- Écriture avec jeton -----------------------------------------------------------------------

test("séance inchangée : écrite une fois ; le même jeton une seconde fois est refusé, rien d'écrit", async () => {
  session();
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  const ok = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.equal(ok.fait, true);
  assert.match(ok.resume, /série 1 notée, 8 à 30 kilos/);
  const s = readDraft().exos[0].series[0];
  assert.deepEqual([s.val, s.poids, s.fait], [8, 30, true]);
  assert.equal(alarms.length, 1, "repos lancé, comme le geste immédiat");
  assert.equal(readDraft().rest.source, "jeffrey");
  assert.deepEqual(tokens(), {}, "jeton retiré");
  const after = raw();
  const again = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.deepEqual(again, { fait: false, raison: NOT_READ_BACK });
  assert.equal(raw(), after, "pas de deuxième série notée");
});

test("jeton vide, nul, d'un autre type, inconnu ou périmé : refusé, jamais de repli vers le geste immédiat", async () => {
  session();
  const before = raw();
  for (const jeton of ["", null, undefined, 123, {}, "inconnu"]) {
    const r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
    assert.deepEqual(r, { fait: false, raison: NOT_READ_BACK }, `jeton ${JSON.stringify(jeton)}`);
  }
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  const late = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton, T0 + AGIR_TTL_MS + 1);
  assert.deepEqual(late, { fait: false, raison: NOT_READ_BACK }, "périmé après 3 minutes");
  assert.equal(raw(), before, "rien d'écrit");
});

test("autres paramètres (autre valeur dite, autre geste) : refusé, et le jeton est consommé", async () => {
  session();
  const before = raw();
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  assert.deepEqual(await confirm("noter_serie", { reps: 8, kg: 32.5 }, jeton), { fait: false, raison: NOT_READ_BACK });
  assert.deepEqual(await confirm("noter_serie", { reps: 8, kg: 30 }, jeton), { fait: false, raison: NOT_READ_BACK }, "usage unique même après un refus");
  const j2 = (await dryRun("noter_serie", { reps: 8, kg: 30 })).jeton;
  assert.deepEqual(await confirm("exercice_suivant", {}, j2), { fait: false, raison: NOT_READ_BACK });
  assert.equal(raw(), before);
});

test("sans jeton : geste immédiat inchangé (écrit tout de suite)", async () => {
  session();
  const r = await runSessionNow("noter_serie", { reps: 9, kg: 30 }, { now: T0, write: true });
  assert.equal(r.fait, true);
  assert.equal(readDraft().exos[0].series[0].val, 9);
  assert.deepEqual(tokens(), {});
});

// --- Cible changée avant « oui » ----------------------------------------------------------------

test("remplacement de la série : la série visée a été notée à l'écran → refusé, rien d'écrit", async () => {
  session();
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  screen((d) => set(d, 0, 0, { val: 10, poids: 32, fait: true }));
  const before = raw();
  const r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.equal(r.fait, false);
  assert.ok(r.raison.startsWith(SESSION_CHANGED), r.raison);
  assert.match(r.raison, /relisez à Monsieur : Développé incliné haltères, série 2 notée/);
  assert.equal(raw(), before, "ni la série 1 ni la série 2 touchées");
  assert.equal(alarms.length, 0);
});

test("exercice remplacé à l'écran (même place, autre nom) → refusé", async () => {
  session();
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  screen((d) => ({ ...d, exos: d.exos.map((e, i) => (i ? e : { ...e, nom: "Développé incliné machine", origine: e.nom })) }));
  const before = raw();
  const r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.equal(r.fait, false);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(raw(), before);
});

test("exercice courant passé à un autre (rowing), puis autre séance, puis séance finie → refusé", async () => {
  session();
  let { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  screen((d) => ({ ...d, courant: ROWING }));
  let r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.equal(r.fait, false);
  assert.match(r.raison, /Rowing/);

  session();
  ({ jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 }));
  session({ start: "07:05" }); // autre séance commencée (même type)
  r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(readDraft().exos[0].series[0].fait, false);

  session();
  ({ jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 }));
  mem.set("protocole:trainingDraft", "null"); // séance enregistrée ou abandonnée entre-temps
  r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.deepEqual(r, { fait: false, raison: `${SESSION_CHANGED} : aucune séance en cours dans PROTOCOLE ; rien n'a été écrit` });
  assert.equal(raw(), "null");
});

// --- Le décompte d'un repos n'invalide pas une série inchangée ----------------------------------

test("repos qui s'écoule, se termine, démarre ou s'arrête entre relecture et « oui » : série écrite", async () => {
  // Repos en cours au moment de la relecture (série précédente notée à l'écran).
  session();
  screen((d) => ({ ...set(d, 0, 0, { val: 8, poids: 30, fait: true }), rest: { secs: 150, remaining: 150, endAt: T0 + 150_000, label: d.exos[0].nom, speech: "" } }));
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 }, T0 + 20_000);
  // Le repos se termine (l'app le range), puis un repos est lancé et arrêté à l'écran : rev change.
  screen((d) => ({ ...d, rest: { ...d.rest, endAt: null, remaining: 0 } }));
  screen((d) => ({ ...d, rest: { ...d.rest, remaining: 90, secs: 90, endAt: T0 + 200_000 } }));
  screen((d) => ({ ...d, rest: { ...d.rest, endAt: null, remaining: 90 } }));
  const r = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton, T0 + 170_000);
  assert.equal(r.fait, true, r.raison);
  assert.match(r.resume, /série 2 notée/);
  assert.equal(readDraft().exos[0].series[1].fait, true);
});

test("repos : minuteur remplacé → refusé ; même minuteur qui s'écoule → accepté", async () => {
  session();
  screen((d) => ({ ...d, rest: { secs: 120, remaining: 120, endAt: T0 + 120_000, label: d.exos[0].nom, speech: "" } }));
  let { jeton } = await dryRun("repos", { action: "pause" }, T0 + 5_000);
  // Une série cochée à l'écran relance un nouveau repos (autre heure de fin).
  screen((d) => ({ ...set(d, 0, 0, { fait: true }), rest: { ...d.rest, endAt: T0 + 160_000, remaining: 150, secs: 150 } }));
  const before = raw();
  let r = await confirm("repos", { action: "pause" }, jeton, T0 + 10_000);
  assert.equal(r.fait, false);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(raw(), before, "minuteur non mis en pause");

  ({ jeton } = await dryRun("repos", { action: "pause" }, T0 + 11_000));
  r = await confirm("repos", { action: "pause" }, jeton, T0 + 40_000); // 29 s de décompte en plus
  assert.equal(r.fait, true, r.raison);
  assert.match(r.resume, /Repos en pause, il reste 2 min/);
  assert.equal(readDraft().rest.endAt, null);
});

test("repos +30 s : minuteur terminé entre-temps (en cours → arrêté) → refusé", async () => {
  session();
  screen((d) => ({ ...d, rest: { secs: 60, remaining: 60, endAt: T0 + 60_000, label: d.exos[0].nom, speech: "" } }));
  const { jeton } = await dryRun("repos", { action: "plus30" }, T0 + 50_000);
  const r = await confirm("repos", { action: "plus30" }, jeton, T0 + 61_000);
  assert.equal(r.fait, false);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
});

// --- Annuler, aller à, exercice suivant ---------------------------------------------------------

test("annuler_serie : série visée modifiée à l'écran, ou autre série notée à la voix → refusé ; inchangée → annulée", async () => {
  session();
  await runSessionNow("noter_serie", { reps: 8, kg: 30 }, { now: T0 });
  let { jeton } = await dryRun("annuler_serie", {});
  screen((d) => set(d, 0, 0, { val: 9 })); // corrigée à l'écran
  let r = await confirm("annuler_serie", {}, jeton);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(readDraft().exos[0].series[0].val, 9, "correction de l'écran gardée");

  ({ jeton } = await dryRun("annuler_serie", {}));
  await runSessionNow("noter_serie", { reps: 7, kg: 30 }, { now: T0 + 1_000 }); // série 2 notée à la voix
  r = await confirm("annuler_serie", {}, jeton);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(readDraft().exos[0].series[1].fait, true, "la série 2 reste");

  ({ jeton } = await dryRun("annuler_serie", {}));
  r = await confirm("annuler_serie", {}, jeton);
  assert.equal(r.fait, true, r.raison);
  assert.match(r.resume, /série 2 annulée/);
  assert.equal(readDraft().exos[0].series[1].fait, false);
});

test("aller_a et exercice_suivant : départ ou arrivée changés → refusé ; inchangés → faits", async () => {
  session();
  let { jeton } = await dryRun("aller_a", { exercice: "rowing" });
  screen((d) => ({ ...d, courant: 1 })); // départ changé à l'écran (tirage vertical)
  let r = await confirm("aller_a", { exercice: "rowing" }, jeton);
  assert.ok(r.raison.startsWith(SESSION_CHANGED));
  assert.equal(readDraft().courant, 1);

  ({ jeton } = await dryRun("aller_a", { exercice: "rowing" }));
  screen((d) => ({ ...d, exos: d.exos.map((e, i) => (i !== ROWING ? e : { ...e, series: e.series.map((s) => ({ ...s, fait: true })) })) }));
  r = await confirm("aller_a", { exercice: "rowing" }, jeton);
  assert.match(r.raison, new RegExp(`^${SESSION_CHANGED} : Rowing barre ou machine est déjà fini`));

  session();
  ({ jeton } = await dryRun("exercice_suivant", {}));
  r = await confirm("exercice_suivant", {}, jeton);
  assert.equal(r.fait, true, r.raison);
  assert.equal(readDraft().courant, 1);
});

// --- Restauration (stockage gelé) --------------------------------------------------------------

test("stockage gelé : la relecture ne rend pas de jeton, et l'écriture avec jeton n'écrit rien", async () => {
  session();
  const { jeton } = await dryRun("noter_serie", { reps: 8, kg: 30 });
  const before = raw();
  mem.set("protocole:restoreLock", String(Date.now()));
  const r1 = await dryRun("noter_serie", { reps: 8, kg: 30 });
  assert.equal(r1.fait, false);
  assert.equal(r1.jeton, undefined);
  const r2 = await confirm("noter_serie", { reps: 8, kg: 30 }, jeton);
  assert.equal(r2.fait, false);
  assert.match(r2.raison, /n'a pas pu être retiré/);
  assert.equal(raw(), before);
  mem.delete("protocole:restoreLock");
});

// --- Cible et branchement ----------------------------------------------------------------------

test("cible canonique : l'ordre des champs ne change rien, une valeur différente si", () => {
  assert.equal(canon({ b: 1, a: { d: [1, { y: 2, x: null }], c: "z" } }), canon({ a: { c: "z", d: [1, { x: null, y: 2 }] }, b: 1 }));
  assert.notEqual(canon({ a: 1 }), canon({ a: 2 }));
  // Même règle que le cœur : logSet rend bien l'exercice et la série visés.
  const d = newSessionDraft({ type: "Upper A", training: [], hsrWeek: 9, date: "2026-11-12", start: "07:00" });
  const r = logSet({ ...d, courant: ROWING }, { reps: 8, kg: 50 }, ctx());
  assert.deepEqual([r.ei, r.si], [ROWING, 0]);
  assert.equal(restAction(d, "pause", T0).ok, false);
});

test("pont : le jeton n'est passé aux gestes que s'il est fourni ; chemin des autres actions inchangé", () => {
  const s = readFileSync(new URL("../src/lib/bridge.js", import.meta.url), "utf8");
  assert.match(s, /if \(args && Object\.prototype\.hasOwnProperty\.call\(args, "jeton"\)\) opts\.jeton = args\.jeton;/);
  assert.match(s, /return runSessionNow\(action, parametres, opts\);/);
  assert.match(s, /if \(!p \|\| p\.key !== key\) \{/);
  assert.match(s, /if \(res\.resume !== p\.resume\) return \{ fait: false/);
});
