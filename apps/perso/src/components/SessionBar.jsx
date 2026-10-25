// Barre « Séance en cours » (chantier U, U3 étape 3, 25/10/2026) : visible sur les autres
// onglets tant qu'un carnet est ouvert (brouillon `trainingDraft`), avec le minuteur partagé.
// Yoann change d'app ou d'onglet entre deux séries (moments d'usage U1) : un tap le ramène au
// carnet. Dans le flux, juste au-dessus de la barre d'onglets, jamais par-dessus le contenu.
import { useEffect } from "react";
import { Dumbbell, ChevronRight } from "lucide-react";
import { getSync } from "../store.js";
import { T } from "../design/tokens.js";
import { mmss } from "../lib/helpers.js";
import { useRestTimer } from "../lib/restTimer.js";

const BAR_H = 56;

export function SessionBar({ onOpen }) {
  const timer = useRestTimer();
  // Lecture seule, à chaque rendu (≥ 1 par seconde pendant un décompte) : le carnet est démonté
  // sur cet onglet, le brouillon en localStorage est la seule trace de la séance en cours.
  const draft = getSync("trainingDraft", null);
  const visible = !!draft?.type;

  // Le bandeau « Annuler » de Nutrition (position fixe) se décale de cette hauteur.
  useEffect(() => {
    const root = document.documentElement.style;
    if (visible) root.setProperty("--session-bar-h", `${BAR_H + 8}px`); else root.removeProperty("--session-bar-h");
    return () => root.removeProperty("--session-bar-h");
  }, [visible]);

  if (!visible) return null;
  const exos = Array.isArray(draft.exos) ? draft.exos : null;
  const done = exos ? exos.filter((e) => e.series?.some((s) => s.fait)).length : null;
  const running = timer.running;

  return (
    <button type="button" className="p-tap" onClick={onOpen}
      aria-label={`Séance en cours : ${draft.type}${exos ? `, ${done} exercices sur ${exos.length}` : ""}${running ? `, repos ${mmss(timer.remaining)}` : ""}. Revenir au carnet`}
      style={{
        flexShrink: 0, margin: "0 10px 8px", minHeight: BAR_H, borderRadius: 14, border: "none",
        display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
        background: T.c.accent, color: T.c.onAccent, fontFamily: T.f.body, textAlign: "left",
      }}>
      <Dumbbell size={20} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {draft.type}{exos ? ` · ${done}/${exos.length}` : ""}
      </span>
      {running && <span style={{ fontFamily: T.f.num, fontVariantNumeric: "tabular-nums", fontSize: 20, fontWeight: 800 }}>{mmss(timer.remaining)}</span>}
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );
}
