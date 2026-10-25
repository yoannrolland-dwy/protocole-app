// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 6 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { GENE_ZONES } from "@rawcare/core/sessionLoad";
import { C, Label, Body } from "../../design/compat.jsx";

/* ============================================================
   GÊNE ARTICULAIRE PENDANT UNE ESCALADE (08/10/2026)
   Remplace la saisie des blocs (V5, retirée : les pistes changent, Yoann les note déjà dans
   l'app de sa salle, et le nombre de blocs était un mauvais proxy de charge — voir
   packages/core/src/sessionLoad.js). Zone + intensité 0-10, optionnel, jamais présélectionné.
   ============================================================ */
// Forme stockée : `{ [zone]: pain }` — plusieurs zones à la fois (retour de Yoann le jour même :
// « je pourrais avoir les 3 en même temps »). Une zone non touchée n'est pas écrite ; 0 = retirée.
export function GeneField({ gene, setGene }) {
  const map = gene?.zone ? { [gene.zone]: gene.pain } : (gene || {});
  const setPain = (zone, n) => {
    const next = { ...map };
    if (n == null || n === 0) delete next[zone]; else next[zone] = n;
    setGene(Object.keys(next).length ? next : null);
  };
  return (
    <div style={{ marginTop: 10 }}>
      <Label style={{ marginBottom: 6 }}>Gêne pendant la séance</Label>
      {GENE_ZONES.map((z) => {
        const pain = map[z.key] ?? null;
        return (
          <div key={z.key} style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: pain ? C.accent : C.text2, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{z.label}{pain ? ` · ${pain}/10` : ""}</span>
            <div role="group" aria-label={`Gêne ${z.label} de 0 à 10`} style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 }}>
              {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                const on = n === 0 ? pain == null : pain === n;
                return (
                  <button key={n} type="button" className="p-tap" onClick={() => setPain(z.key, n)} aria-pressed={on} aria-label={`${z.label} ${n} sur 10`}
                    style={{ minHeight: 44, borderRadius: 10, border: `1.5px solid ${on ? C.accent : C.border}`, background: on ? C.accent : C.card, color: on ? "#000" : C.text2, fontFamily: C.mono, fontSize: 16, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <Body style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>
        À partir de 4/10, l'escalade et le tirage lourd sont pénalisés le lendemain. Si ça revient plusieurs séances de suite, rouvre une zone de douleur.
      </Body>
    </div>
  );
}
