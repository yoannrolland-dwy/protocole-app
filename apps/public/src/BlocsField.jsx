import { useState } from "react";
import { ISSUES, gradeIndex, climbSummary } from "@rawcare/core/climbing";
import { C, Label, Pills } from "./ui.jsx";

// Port quasi identique de BlocsField (apps/perso/src/App.jsx) — RawCare Phase 2, Séances.
// Doit rester rapide au doigt EN SALLE : une grille de cotations à taper, jamais un champ
// texte libre, et un moyen d'ajouter plusieurs blocs de même cotation d'un coup.
// `scheme` vient de `data.climbScheme` (choisi à l'onboarding), résolu par SessionsTab —
// le composant garde son paramètre explicite pour rester identique à apps/perso, sans état
// module global.
export default function BlocsField({ blocs, setBlocs, scheme }) {
  // Issue « armée » : on choisit une fois, puis on tape les cotations. Défaut « après
  // essais », le cas le plus fréquent — flash et échec sont les exceptions.
  const [issue, setIssue] = useState("essais");

  const add = (cotation, n = 1) => setBlocs([...blocs, ...Array.from({ length: n }, () => ({ cotation, issue }))]);
  const rm = (cotation, iss) => {
    const i = blocs.map((b) => b.cotation === cotation && b.issue === iss).lastIndexOf(true);
    if (i >= 0) setBlocs(blocs.filter((_, j) => j !== i));
  };

  const groupes = [];
  blocs.forEach((b) => {
    const g = groupes.find((x) => x.cotation === b.cotation && x.issue === b.issue);
    if (g) g.n += 1; else groupes.push({ cotation: b.cotation, issue: b.issue, n: 1 });
  });
  groupes.sort((a, b) => gradeIndex(scheme, a.cotation) - gradeIndex(scheme, b.cotation)
    || ISSUES.findIndex((x) => x.key === a.issue) - ISSUES.findIndex((x) => x.key === b.issue));

  const s = climbSummary(blocs, scheme);
  const parCotation = {};
  blocs.forEach((b) => { parCotation[b.cotation] = (parCotation[b.cotation] || 0) + 1; });

  const isGrid = !!(scheme.colors && scheme.levels);

  return (
    <div style={{ marginTop: 12 }}>
      <Label style={{ marginBottom: 6 }}>Blocs · issue à enregistrer</Label>
      <Pills options={ISSUES.map((i) => ({ key: i.key, label: i.label }))} value={issue} onChange={setIssue} small />

      <Label style={{ margin: "10px 0 6px" }}>Taper un niveau pour l'ajouter</Label>
      {isGrid ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {scheme.colors.map((col) => (
            <div key={col.key} style={{ display: "grid", gridTemplateColumns: `62px repeat(${scheme.levels.length}, 1fr)`, gap: 5, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: col.hex, flexShrink: 0,
                  border: col.key === "noir" ? `1px solid ${C.border}` : "none" }} />
                <span style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 }}>{col.label}</span>
              </span>
              {scheme.levels.map((lv) => {
                const g = scheme.makeGrade(col.key, lv);
                const n = parCotation[g] || 0;
                return (
                  <button key={lv} onClick={() => add(g)} style={{
                    padding: "8px 2px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
                    fontSize: 12, fontWeight: 800,
                    background: n ? C.accentRow : C.card, color: n ? C.accent : C.muted,
                    border: `1.5px solid ${n ? C.accent : C.border}`,
                  }}>
                    {lv}{n > 0 && <span style={{ fontSize: 9, marginLeft: 1 }}>×{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {scheme.grades.map((g) => {
            const n = parCotation[g] || 0;
            return (
              <button key={g} onClick={() => add(g)} style={{
                padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
                fontSize: 12, fontWeight: 800,
                background: n ? C.accentRow : C.card, color: n ? C.accent : C.muted,
                border: `1.5px solid ${n ? C.accent : C.border}`,
              }}>
                {g}{n > 0 && <span style={{ fontSize: 9, marginLeft: 2 }}>×{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {groupes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {groupes.map((g) => (
            <div key={`${g.cotation}-${g.issue}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 0", borderTop: `1px solid ${C.divider}`,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: C.mono, fontSize: 12, color: C.text, fontWeight: 700 }}>
                {isGrid && <span style={{ width: 9, height: 9, borderRadius: 3, background: scheme.gradeColor(g.cotation) || C.dim,
                  border: g.cotation.startsWith("noir") ? `1px solid ${C.border}` : "none" }} />}
                {scheme.gradeLabel(g.cotation)}
                <span style={{ color: g.issue === "echec" ? C.danger : C.muted, fontWeight: 400, marginLeft: 2, fontFamily: "inherit" }}>
                  {ISSUES.find((i) => i.key === g.issue)?.label}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => rm(g.cotation, g.issue)} style={blocStep}>−</button>
                <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.accent, minWidth: 16, textAlign: "center" }}>{g.n}</span>
                <button onClick={() => setBlocs([...blocs, { cotation: g.cotation, issue: g.issue }])} style={blocStep}>+</button>
              </span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono, marginTop: 8 }}>
            {s.n} bloc{s.n > 1 ? "s" : ""}
            {s.max ? ` · max ${scheme.gradeLabel(s.max)} · médiane ${scheme.gradeLabel(s.mediane)}` : " · aucun réussi"}
            {` · ${s.flash} flash / ${s.essais} essais / ${s.echec} échec${s.echec > 1 ? "s" : ""}`}
          </div>
        </div>
      )}
    </div>
  );
}
const blocStep = {
  width: 28, height: 28, borderRadius: 6, background: C.card, color: C.accent,
  border: `1.5px solid ${C.border}`, cursor: "pointer", fontSize: 15, fontWeight: 800,
  fontFamily: "inherit", lineHeight: 1,
};
