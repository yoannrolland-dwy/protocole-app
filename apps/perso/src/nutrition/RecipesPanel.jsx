// Sous-onglet Recettes de Nutrition (31/10/2026, demande de Yoann : pour revoir une recette et la
// refaire, il fallait passer par « Chercher » puis le crayon). Liste des recettes (la plus
// récemment mangée en tête), fiche avec ingrédients, valeurs du lot et d'une portion, ajout à un
// repas du jour affiché dans Journal (1 portion proposée), modification, duplication et suppression.
import { useState, useMemo, useEffect, useRef } from "react";
import { ChefHat, ChevronLeft, ChevronRight, Copy, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { T } from "../design/tokens.js";
import { Panel, Eyebrow, Button, IconButton, Chip, TextField } from "../design/primitives.jsx";
import { fmt } from "../ui.jsx";
import { normalize } from "@rawcare/core/nutrition/ciqual";
import { MEALS, makeEntry, compileRecipe, recipeAsFood, recipeSheet, sortRecipes, lastUseByRef } from "./foodStore.js";
import { RecipeBuilder } from "./FoodSearch.jsx";
import { say, sayStable } from "../lib/jeffrey.js";

const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };
const v = (x, unit = "") => (x === null || x === undefined ? "—" : `${x}${unit}`);

function Macros({ m }) {
  return (
    <div style={{ ...mono, display: "flex", flexWrap: "wrap", columnGap: 12, fontSize: 13, color: T.c.text2 }}>
      <span>P{v(m.prot)}</span><span>G{v(m.gluc)}</span><span>L{v(m.lip)}</span><span>Fib{v(m.fib)}</span>
    </div>
  );
}

function RecipeSheet({ recipe, dayLabel, onAdd, onEdit, onDuplicate, onRemove, onBack }) {
  const s = recipeSheet(recipe);
  const [meal, setMeal] = useState(null);
  const [n, setN] = useState(1);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef(null);
  useEffect(() => () => clearTimeout(armTimer.current), []);
  // Grammes calculés sur le poids total : la dernière portion = la recette entière.
  const grams = Math.round((s.totalWeight * n) / s.portions);
  const kcal = recipe.per100?.kcal == null ? null : Math.round((recipe.per100.kcal * grams) / 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconButton label="Retour aux recettes" size={44} style={{ border: "none" }} onClick={onBack}><ChevronLeft size={24} aria-hidden="true" /></IconButton>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>{recipe.name}</h2>
      </div>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <Eyebrow>{s.portions > 1 ? `1 portion · ${s.portionGrams} g` : `Recette · ${s.totalWeight} g`}</Eyebrow>
          <span style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.c.accent }}>{v(s.portion.kcal)} kcal</span>
        </div>
        <Macros m={s.portion} />
        {s.portions > 1 && (
          <div className="p-sec" style={mono}>
            Recette entière · {s.totalWeight} g · {s.portions} portions · {v(s.whole.kcal)} kcal
          </div>
        )}
      </Panel>

      <Panel>
        <Eyebrow>Ingrédients</Eyebrow>
        <div>
          {s.ingredients.map((i, k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "10px 0", borderTop: k ? `1px solid ${T.c.lineSoft}` : "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{i.name}</span>
              <span style={{ ...mono, fontSize: 14, color: T.c.text2, whiteSpace: "nowrap" }}>{i.q} g · {v(i.kcal)} kcal</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Eyebrow>Ajouter à un repas · {dayLabel}</Eyebrow>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MEALS.map((m) => <Chip key={m.key} on={meal === m.key} onClick={() => setMeal(m.key)}>{m.label}</Chip>)}
        </div>
        {s.portions > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Array.from({ length: s.portions }, (_, k) => k + 1).map((p) => (
              <Chip key={p} on={n === p} onClick={() => setN(p)}>{p} portion{p > 1 ? "s" : ""}</Chip>
            ))}
          </div>
        )}
        <Button variant="primary" block disabled={!meal} onClick={() => onAdd(meal, grams)}>
          <Plus size={18} aria-hidden="true" />{meal ? `Ajouter · ${grams} g · ${v(kcal)} kcal` : "Choisir un repas"}
        </Button>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Button variant="outline" onClick={onEdit}><PencilLine size={18} aria-hidden="true" />Modifier</Button>
        <Button variant="outline" onClick={onDuplicate}><Copy size={18} aria-hidden="true" />Dupliquer</Button>
      </div>
      <div style={{ display: "flex" }}>
        <Button variant={armed ? "danger" : "plain"} block onClick={() => {
          if (armed) { onRemove(); return; }
          setArmed(true); clearTimeout(armTimer.current); armTimer.current = setTimeout(() => setArmed(false), 3000);
        }}>
          <Trash2 size={18} aria-hidden="true" />{armed ? "Supprimer ?" : "Supprimer"}
        </Button>
      </div>
    </div>
  );
}

export default function RecipesPanel({ food, date, dayLabel, onAdded }) {
  const [openId, setOpenId] = useState(null);
  // null | "new" | { recipe, copy } : recette à modifier, ou à dupliquer (préremplit une nouvelle)
  const [building, setBuilding] = useState(null);
  const [q, setQ] = useState("");
  const sorted = useMemo(() => sortRecipes(food.recipes, food.log), [food.recipes, food.log]);
  const use = useMemo(() => lastUseByRef(food.log), [food.log]);
  const shown = useMemo(() => {
    const nq = normalize(q.trim());
    return nq ? sorted.filter((r) => normalize(r.name).includes(nq)) : sorted;
  }, [sorted, q]);
  const open = openId && food.recipes.find((r) => r.id === openId);

  if (building) {
    // Dupliquer (31/10/2026) : nouvelle recette préremplie (nom « (copie) », mêmes ingrédients et
    // portions) ; elle n'existe qu'une fois enregistrée, avec son propre identifiant.
    const { recipe = null, copy = false } = building === "new" ? {} : building;
    const editing = copy ? null : recipe;
    return (
      <RecipeBuilder recipe={recipe} copy={copy} log={food.log} pins={food.pins} muted={food.muted}
        onBack={() => setBuilding(null)}
        onSave={(name, ingredients, portions) => {
          const r = compileRecipe(name, ingredients, editing, portions);
          if (editing) food.updateRecipe(r); else food.addRecipe(r);
          setBuilding(null);
          setOpenId(r.id);
        }} />
    );
  }

  if (open) {
    return (
      <RecipeSheet key={open.id} recipe={open} dayLabel={dayLabel}
        onBack={() => setOpenId(null)}
        onEdit={() => setBuilding({ recipe: open })}
        onDuplicate={() => setBuilding({ recipe: { ...open, name: `${open.name} (copie)` }, copy: true })}
        onRemove={() => { food.removeRecipe(open.id); setOpenId(null); }}
        onAdd={(meal, grams) => {
          const entry = makeEntry({ date, meal, food: recipeAsFood(open), q: grams });
          food.add(entry);
          onAdded([entry.id], say("added", { x: `${open.name} · ${grams} g` }));
        }} />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <Button variant="primary" block onClick={() => setBuilding("new")}><Plus size={18} aria-hidden="true" />Nouvelle recette</Button>
      {sorted.length > 6 && <TextField value={q} onChange={setQ} placeholder="Chercher une recette" icon={Search} />}
      {shown.length ? (
        <Panel style={{ gap: 0, padding: "4px 16px" }}>
          {shown.map((r, k) => {
            const s = recipeSheet(r);
            const u = use.get(`recipe:${r.id}`);
            return (
              <button key={r.id} type="button" className="p-tap" onClick={() => setOpenId(r.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 64, padding: "10px 0",
                background: "none", border: "none", borderTop: k ? `1px solid ${T.c.lineSoft}` : "none",
                textAlign: "left", color: T.c.text, fontFamily: "inherit",
              }}>
                <ChefHat size={20} color={T.c.accent} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</span>
                  <span style={{ ...mono, fontSize: 13, color: T.c.text2 }}>
                    {s.portions > 1 ? `${s.portions} portions · ${v(s.portion.kcal)} kcal la portion` : `${s.totalWeight} g · ${v(s.whole.kcal)} kcal`}
                    {u ? ` · ${fmt(u.date)}` : ""}
                  </span>
                </span>
                <ChevronRight size={18} color={T.c.text2} aria-hidden="true" />
              </button>
            );
          })}
        </Panel>
      ) : (
        <div className="p-sec" style={{ textAlign: "center", padding: "8px 0" }}>{sayStable(sorted.length ? "noRecipeMatch" : "noRecipe")}</div>
      )}
    </div>
  );
}
