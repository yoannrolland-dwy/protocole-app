// Sous-onglet Aliments de Nutrition (31/10/2026, choix de Yoann) : ce qui règle « Vos aliments
// habituels », en un seul endroit — épinglés, masqués, portions nommées, valeurs corrigées (V6).
// Jusqu'ici chacun ne se défaisait qu'en retrouvant l'aliment dans la recherche. Rien ne touche au
// journal : retirer une correction rend sa valeur d'origine à toutes les lignes, comme avant.
import { useMemo } from "react";
import { T } from "../design/tokens.js";
import { Panel, Eyebrow, Button } from "../design/primitives.jsx";
import { refNames, MACROS, MEALS } from "./foodStore.js";
import { sayStable } from "../lib/jeffrey.js";

const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
const MACRO_LABEL = { kcal: "kcal", prot: "P", gluc: "G", lip: "L", fib: "Fib" };

function Section({ title, count, children }) {
  return (
    <Panel style={{ gap: 0, padding: "12px 16px 4px" }}>
      <Eyebrow style={{ marginBottom: 4 }}>{title} · {count}</Eyebrow>
      {children}
    </Panel>
  );
}

function Line({ name, detail, action, onAction, first }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "6px 0", borderTop: first ? "none" : `1px solid ${T.c.lineSoft}` }}>
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
        {detail && <span style={{ ...mono, fontSize: 13, color: T.c.text2 }}>{detail}</span>}
      </span>
      <Button variant="outline" onClick={onAction} style={{ minHeight: 44, flexShrink: 0 }} aria-label={`${action} · ${name}`}>{action}</Button>
    </div>
  );
}

export default function FoodsPanel({ food }) {
  const names = useMemo(() => refNames(food.log, food.recipes), [food.log, food.recipes]);
  const nameOf = (ref) => names.get(ref) ?? "Aliment introuvable";
  const portionRefs = Object.keys(food.portions || {}).filter((r) => food.portions[r]?.length);
  const fixed = Object.keys(food.overrides || {});
  // Favoris et masqués par repas (04/11/2026) : une ligne par repas et par aliment.
  const byMeal = (map) => MEALS.flatMap((m) => (map?.[m.key] || []).map((p) => ({ meal: m, ref: typeof p === "string" ? p : p.ref, name: typeof p === "object" ? p.name : null })));
  const pinned = byMeal(food.mealPins);
  const hidden = byMeal(food.mealMuted);
  const empty = !pinned.length && !hidden.length && !portionRefs.length && !fixed.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      {empty && <div className="p-sec" style={{ textAlign: "center", padding: "8px 0" }}>{sayStable("noFoodSettings")}</div>}

      {pinned.length > 0 && (
        <Section title="Favoris" count={pinned.length}>
          {pinned.map(({ meal, ref, name }, k) => (
            <Line key={`${meal.key}|${ref}`} first={!k} name={names.get(ref) ?? name ?? "Aliment introuvable"} detail={`En tête de ${meal.label}`} action="Retirer" onAction={() => food.togglePin(meal.key, { ref })} />
          ))}
        </Section>
      )}

      {hidden.length > 0 && (
        <Section title="Masqués" count={hidden.length}>
          {hidden.map(({ meal, ref }, k) => (
            <Line key={`${meal.key}|${ref}`} first={!k} name={nameOf(ref)} detail={`Absent de ${meal.label}`} action="Réafficher" onAction={() => food.unmute(meal.key, ref)} />
          ))}
        </Section>
      )}

      {portionRefs.length > 0 && (
        <Section title="Portions nommées" count={portionRefs.reduce((a, r) => a + food.portions[r].length, 0)}>
          {portionRefs.flatMap((ref) => food.portions[ref].map((p) => ({ ref, p }))).map(({ ref, p }, k) => (
            <Line key={`${ref}|${p.label}`} first={!k} name={nameOf(ref)} detail={`${p.label} = ${p.grams} g`} action="Retirer" onAction={() => food.removePortion(ref, p.label)} />
          ))}
        </Section>
      )}

      {fixed.length > 0 && (
        <Section title="Valeurs corrigées" count={fixed.length}>
          {fixed.map((ref, k) => {
            const o = food.overrides[ref];
            const detail = MACROS.filter((m) => o[m] !== undefined && o[m] !== null).map((m) => `${MACRO_LABEL[m]} ${o[m]}`).join(" · ") + " pour 100 g";
            return <Line key={ref} first={!k} name={nameOf(ref)} detail={detail} action="Retirer" onAction={() => food.clearOverride(ref)} />;
          })}
        </Section>
      )}
    </div>
  );
}
