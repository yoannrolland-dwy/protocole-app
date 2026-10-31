// « Ajouter un exercice » en cours de séance (31/10/2026) : catalogue de tout ce qui existe déjà
// dans l'application, un nom une seule fois, classé par muscle, sans l'échauffement Basket.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISE_CATALOG, catalogGroups, catalogEntry } from "../src/session/exoCatalog.js";
import { TEMPLATES } from "../src/session/templates.js";
import { EXERCISE_LIBRARY } from "../src/session/exercises.js";

test("chaque exercice des séances (hors Basket) et de la bibliothèque, une seule fois", () => {
  const names = EXERCISE_CATALOG.map((c) => c.n);
  assert.equal(new Set(names).size, names.length);
  for (const [type, t] of Object.entries(TEMPLATES)) {
    if (t.kind !== "muscu") continue;
    for (const e of t.exos) assert.equal(names.includes(e.n), type !== "Basket", `${type} : ${e.n}`);
  }
  for (const e of EXERCISE_LIBRARY) assert.ok(names.includes(e.n), e.n);
  // La première définition gagne : la presse HSR vient de Lower A, avec son gabarit.
  assert.equal(catalogEntry("Presse à cuisses (HSR)").type, "Lower A");
  assert.equal(catalogEntry("Presse à cuisses (poulie)").type, null);
});

test("groupes dans l'ordre des muscles, exclusions et recherche sans accents", () => {
  const all = catalogGroups();
  assert.equal(all[0].groupe, "pecs");
  assert.equal(all[0].label, "Pectoraux");
  assert.equal(all.at(-1).groupe, "mobilite");
  const sansIncline = catalogGroups({ exclude: ["Développé incliné haltères"] });
  assert.ok(!sansIncline[0].items.some((c) => c.n === "Développé incliné haltères"));
  const elev = catalogGroups({ query: "elevations" });
  assert.deepEqual(elev.map((g) => g.groupe), ["epaules"]);
  assert.deepEqual(elev[0].items.map((c) => c.n), ["Élévations latérales poulie", "Élévations latérales haltères"]);
  assert.ok(catalogGroups({ query: "mollets" }).some((g) => g.groupe === "mollets"), "recherche par muscle");
  assert.deepEqual(catalogGroups({ query: "zzz" }), []);
});
