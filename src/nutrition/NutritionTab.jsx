// Onglet Nutrition — journal alimentaire interne (M1 du chantier du 01/08/2026).
//
// ISOLÉ : lit les cibles de PROTOCOLE (via la prop `targetsFor`) mais n'écrit que dans
// `foodLog`. `macroLog` et la synchro Health Connect ne sont pas touchés, donc Cronometer
// continue en parallèle et retirer l'onglet suffit à tout annuler.

import React, { useState, useMemo } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { C, Card, Label, Body, Btn, Empty, Stepper, DateField, ScreenHeader, today, fmt } from "../ui.jsx";
import { MEALS, useFoodLog, makeEntry, amounts, entriesFor, totals } from "./foodStore.js";
import FoodSearch from "./FoodSearch.jsx";

// Cibles PROTOCOLE (protein/carbs/fat/fiber) → noms internes du module (prot/gluc/lip/fib).
const TARGET_KEY = { prot: "protein", gluc: "carbs", lip: "fat", fib: "fiber" };
const MACRO_LABEL = { prot: "Protéines", gluc: "Glucides", lip: "Lipides", fib: "Fibres" };

const n0 = (x) => Math.round(x);
const n1 = (x) => Math.round(x * 10) / 10;

function MacroTile({ m, value, target, missing }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
      <Label>{MACRO_LABEL[m]}</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 3 }}>
        <span style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: C.text }}>{n1(value)}g</span>
        {/* Une donnée absente de la table ne doit pas se cacher derrière un total d'apparence exacte. */}
        {missing > 0 && <span style={{ fontSize: 10, color: C.dim, fontFamily: C.mono }} title={`${missing} aliment(s) sans cette donnée`}>+?</span>}
      </div>
      <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1, fontFamily: C.mono }}>/ {target}g</div>
      <div style={{ background: C.bg, borderRadius: 5, height: 5, overflow: "hidden", marginTop: 7 }}>
        <div style={{ background: C.accent, width: `${pct}%`, height: "100%" }} />
      </div>
    </div>
  );
}

function EntryRow({ e, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(e.q);
  const a = amounts(e);
  return (
    <div style={{ borderBottom: `1px solid ${C.divider}` }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{e.name}</div>
          <div style={{ display: "flex", gap: 9, marginTop: 2, fontFamily: C.mono, fontSize: 10, color: C.muted }}>
            <span>{e.ref === "quick" ? "portion" : `${e.q} g`}</span>
            <span>P{a.prot ?? "—"}</span>
            <span>G{a.gluc ?? "—"}</span>
            <span>L{a.lip ?? "—"}</span>
          </div>
        </div>
        <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 800, color: C.accent }}>{a.kcal ?? "—"}</span>
        {open ? <ChevronDown size={13} color={C.dim} /> : <ChevronRight size={13} color={C.dim} />}
      </div>
      {open && (
        <div style={{ padding: "4px 0 12px", display: "flex", flexDirection: "column", gap: 9 }}>
          {/* Une saisie libre stocke la portion telle quelle (q = 100) : proposer d'en
              changer les grammes n'aurait aucun sens, seule la suppression est utile. */}
          {e.ref !== "quick" && (
            <>
              <Stepper value={q} set={setQ} step={10} unit="g" min={1} int />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="primary" style={{ flex: 1 }} disabled={q === e.q}
                  onClick={() => { onUpdate(e.id, { q: Number(q) }); setOpen(false); }}>Modifier</Btn>
                <Btn variant="danger" onClick={() => onRemove(e.id)}><Trash2 size={13} /></Btn>
              </div>
            </>
          )}
          {e.ref === "quick" && (
            <Btn variant="danger" onClick={() => onRemove(e.id)} style={{ width: "100%" }}>
              <Trash2 size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Supprimer
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

export default function NutritionTab({ targetsFor }) {
  const [date, setDate] = useState(today());
  const [openMeal, setOpenMeal] = useState(null);
  const food = useFoodLog();

  const dayEntries = useMemo(() => entriesFor(food.log, date), [food.log, date]);
  const t = useMemo(() => totals(dayEntries), [dayEntries]);

  const tg = targetsFor(date);
  const kcalTarget = Math.round(tg.protein * 4 + tg.carbs * 4 + tg.fat * 9);
  const left = kcalTarget - t.kcal;

  const add = (f, q) => {
    food.add(makeEntry({ date, meal: openMeal, food: f, q }));
    setOpenMeal(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader
        title="Nutrition"
        subtitle={date === today() ? "aujourd'hui" : fmt(date)}
        right={<span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: "#000",
          background: C.accent, padding: "3px 6px", borderRadius: 4,
        }}>BÊTA</span>}
      />

      <Card>
        <DateField value={date} onChange={setDate} />
      </Card>

      {/* Calories du jour + reste à consommer : c'est l'information qu'on vient chercher
          en premier quand on ouvre l'app avant un repas. */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Label>Calories</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
              <span style={{ fontFamily: C.mono, fontSize: 34, fontWeight: 800, color: C.text, letterSpacing: -1 }}>{n0(t.kcal)}</span>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>/ {kcalTarget}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Label>{left >= 0 ? "Il reste" : "Dépassement"}</Label>
            <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, marginTop: 4, color: left >= 0 ? C.accent : C.danger }}>
              {n0(Math.abs(left))}
            </div>
          </div>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: "hidden", marginTop: 10 }}>
          <div style={{ background: left >= 0 ? C.accent : C.danger, width: `${Math.min(100, (t.kcal / kcalTarget) * 100)}%`, height: "100%" }} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {["prot", "gluc", "lip", "fib"].map((m) => (
          <MacroTile key={m} m={m} value={t[m]} target={tg[TARGET_KEY[m]]} missing={t.missing[m]} />
        ))}
      </div>

      {MEALS.map((meal) => {
        const entries = dayEntries.filter((e) => e.meal === meal.key);
        const mt = totals(entries);
        return (
          <Card key={meal.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: entries.length ? 4 : 10 }}>
              <Label style={{ fontSize: 10, color: C.text2 }}>{meal.label}</Label>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 800, color: entries.length ? C.accent : C.dim }}>
                {entries.length ? `${n0(mt.kcal)} kcal` : "—"}
              </span>
            </div>
            {entries.map((e) => (
              <EntryRow key={e.id} e={e} onUpdate={food.update} onRemove={food.remove} />
            ))}
            <Btn variant="plain" onClick={() => setOpenMeal(meal.key)} style={{ width: "100%", marginTop: 10, padding: "7px 12px", fontSize: 11 }}>
              <Plus size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />Ajouter
            </Btn>
          </Card>
        );
      })}

      {dayEntries.length === 0 && <Empty>Aucun aliment enregistré ce jour.</Empty>}

      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", padding: "4px 0 2px" }}>
        Module interne en test — n'alimente pas encore les Macros ni Health Connect.
      </Body>

      {openMeal && (
        <FoodSearch
          meal={openMeal}
          mealLabel={MEALS.find((m) => m.key === openMeal).label}
          date={date}
          log={food.log}
          pins={food.pins}
          onAdd={add}
          onTogglePin={food.togglePin}
          onClose={() => setOpenMeal(null)}
        />
      )}
    </div>
  );
}
