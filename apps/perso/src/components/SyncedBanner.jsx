// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 5 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { Zap } from "lucide-react";
import { C, Body, Btn } from "../design/compat.jsx";

// Bandeau affiché à la place de la saisie quand la donnée du jour vient d'ailleurs.
// `onCorrect` optionnel : pour Health Connect, corriger localement reste utile jusqu'à
// la prochaine synchro. Pour `foodLog` (bascule M6), corriger ici serait futile — l'effet
// de dérivation dans NutritionTab.jsx réécrase le jour au prochain changement du journal,
// où qu'il ait lieu — donc pas de bouton, juste l'information.
export const SyncedBanner = ({ onCorrect, label = "Synchronisé depuis Health Connect" }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
    <Body style={{ fontSize: 13, color: C.dim }}>
      <Zap size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} color={C.accent} />
      {label}
    </Body>
    {onCorrect && <Btn variant="ghost" onClick={onCorrect} style={{ padding: "4px 8px", fontSize: 12 }}>Corriger manuellement</Btn>}
  </div>
);
