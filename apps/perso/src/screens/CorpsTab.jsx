// Onglet « Corps » (chantier U, U3 étape 1, 25/10/2026) : regroupe Poids, Énergie, Pas et
// Genou derrière des sous-onglets (arborescence A, U1). Les 4 écrans sont affichés tels
// quels en enfant ; ils seront refaits à l'étape 5 d'U3.
import { SubTabs } from "../components/SubTabs.jsx";

export const CORPS_SUBS = [
  { key: "weight", label: "Poids" },
  { key: "sleep", label: "Énergie" },
  { key: "steps", label: "Pas" },
  { key: "pain", label: "Genou" },
];

export function CorpsTab({ sub, onSub, children }) {
  return (
    // `minmax(0, 1fr)` (27/10/2026) : un sous-écran trop large ne peut plus élargir la page.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <SubTabs label="Corps" tabs={CORPS_SUBS} value={sub} onChange={onSub} />
      <div role="tabpanel">{children}</div>
    </div>
  );
}
