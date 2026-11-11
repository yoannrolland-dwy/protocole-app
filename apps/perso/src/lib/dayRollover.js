// Passage au jour suivant d'un écran de saisie (audit du 10/11/2026, point 14). Les écrans de
// Corps fixaient leur date à l'ouverture (`useState(today())`). App laissée ouverte la nuit sur
// Corps › Genou : la douleur notée le matin était écrite sur la VEILLE (elle écrasait celle de la
// veille, et le brief, qui attend le genou du jour, ne partait pas).
//
// Règle : si l'écran affichait « aujourd'hui » et que le jour a changé, il passe au nouveau jour
// par le `pickDate` de l'écran (qui recharge l'entrée du jour ou remet le champ à vide). Si
// Monsieur avait choisi une autre date, elle n'est pas touchée.
import { useEffect, useRef } from "react";
import { today } from "@rawcare/core/dateUtils";

/**
 * `anchor` : le jour que l'écran tenait pour « aujourd'hui » ; `date` : le jour affiché ; `now` :
 * le jour réel. → `{ anchor, pick }` : nouveau repère, et le jour à afficher (`null` = ne rien changer).
 */
export function rolloverDecision({ anchor, date, now }) {
  if (now === anchor) return { anchor, pick: null };
  return { anchor: now, pick: date === anchor ? now : null };
}

/** Vérifie au retour dans l'app, à la reprise du focus, et une fois par minute. */
export function useDayRollover(date, pickDate) {
  const ref = useRef({ anchor: today(), date, pickDate });
  ref.current.date = date;
  ref.current.pickDate = pickDate;
  useEffect(() => {
    const check = () => {
      const r = ref.current;
      const d = rolloverDecision({ anchor: r.anchor, date: r.date, now: today() });
      r.anchor = d.anchor;
      if (d.pick) r.pickDate(d.pick);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const id = setInterval(check, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(id);
    };
  }, []);
}
