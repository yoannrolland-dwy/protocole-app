// Onglet Nutrition — journal alimentaire interne (M1 du chantier du 01/08/2026).
//
// BASCULE M6 (02/08/2026) : `foodLog` alimente désormais `macroLog` (voir l'effet de
// dérivation plus bas et `deriveMacroLog` dans foodStore.js) — l'onglet Macros, le Coach
// IA et le widget reflètent donc directement ce qui est loggé ici, sans code
// supplémentaire de leur côté. La lecture nutrition/eau depuis Health Connect est coupée
// (healthSync.js) : `foodLog` est l'unique écrivain des macros au quotidien désormais.

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Droplet, Zap, Copy } from "lucide-react";
import { C, Card, Label, Body, Btn, Empty, Stepper, DateField, ScreenHeader, Pills, today, fmt, upsert, shiftDateKey } from "../ui.jsx";
import {
  MEALS, useFoodLog, makeEntry, amounts, entriesFor, totals, isQuickRef,
  copySourceCandidates, copyEntries, deriveMacroLog,
} from "./foodStore.js";
import FoodSearch from "./FoodSearch.jsx";

const MEAL_OPTIONS = MEALS.map((m) => ({ key: m.key, label: m.label }));

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
  const [meal, setMeal] = useState(e.meal);
  const a = amounts(e);
  // Une saisie libre stocke la portion telle quelle (q = 100) : proposer d'en changer les
  // grammes n'aurait aucun sens. Le repas, en revanche, reste modifiable dans tous les cas.
  const isQuick = isQuickRef(e.ref);
  const changed = meal !== e.meal || (!isQuick && Number(q) !== e.q);
  return (
    <div style={{ borderBottom: `1px solid ${C.divider}` }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{e.name}</div>
          <div style={{ display: "flex", gap: 9, marginTop: 2, fontFamily: C.mono, fontSize: 10, color: C.muted }}>
            <span>{isQuick ? "portion" : `${e.q} g`}</span>
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
          <div>
            <Label style={{ marginBottom: 5 }}>Repas</Label>
            <Pills small options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
          </div>
          {!isQuick && <Stepper value={q} set={setQ} step={10} unit="g" min={1} int />}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" style={{ flex: 1 }} disabled={!changed}
              onClick={() => { onUpdate(e.id, { q: Number(q), meal }); setOpen(false); }}>Enregistrer</Btn>
            <Btn variant="danger" onClick={() => onRemove(e.id)}><Trash2 size={13} /></Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// "Copier un repas" (M4) : liste des jours qui ont déjà ce repas rempli, tap = copie
// immédiate. Panneau inline (pas une feuille plein écran) — c'est un choix rapide parmi
// peu d'options, pas une recherche.
function CopyPanel({ candidates, onPick, onClose }) {
  return (
    <div style={{ padding: "4px 0 10px" }}>
      {candidates.length === 0 ? (
        <Body style={{ fontSize: 11, color: C.dim }}>Aucun autre jour avec ce repas rempli.</Body>
      ) : candidates.map((c) => (
        <div key={c.date} onClick={() => onPick(c.date)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 2px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer",
        }}>
          <span style={{ fontSize: 12, color: C.text }}>{fmt(c.date)}</span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted }}>
            {c.count} aliment{c.count > 1 ? "s" : ""} · {c.kcal} kcal{c.missing > 0 ? " +?" : ""}
          </span>
        </div>
      ))}
      <Btn variant="ghost" onClick={onClose} style={{ width: "100%", marginTop: 6, padding: "6px 12px", fontSize: 10.5 }}>Annuler</Btn>
    </div>
  );
}

// Dupliquer la journée affichée vers une autre date (M4, sens inverse de CopyPanel :
// ici on part du jour courant pour choisir où COLLER, plutôt que de choisir d'où TIRER).
// Fusion, jamais d'écrasement : copyEntries ne fait qu'AJOUTER des lignes, ce qui suffit
// à garantir qu'un aliment déjà présent sur le jour cible n'est jamais touché.
function DuplicatePanel({ entries, date, onConfirm, onClose }) {
  const [checked, setChecked] = useState(
    () => new Set(MEALS.filter((m) => entries.some((e) => e.meal === m.key)).map((m) => m.key)),
  );
  const [target, setTarget] = useState("");
  const allChecked = checked.size === MEALS.length;
  const toggle = (key) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChecked(next);
  };
  const count = entries.filter((e) => checked.has(e.meal)).length;
  const canConfirm = target && target !== date && checked.size > 0;

  const chip = (on) => ({
    padding: "6px 11px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: 0.5,
    background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
    border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Label>Repas à copier</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MEALS.map((m) => (
          <button key={m.key} onClick={() => toggle(m.key)} style={chip(checked.has(m.key))}>{m.label}</button>
        ))}
        <button onClick={() => setChecked(allChecked ? new Set() : new Set(MEALS.map((m) => m.key)))} style={chip(allChecked)}>
          Toute la journée
        </button>
      </div>
      <Label>Vers le</Label>
      <input type="date" value={target} onChange={(e) => setTarget(e.target.value)}
        style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, color: C.text, width: "100%" }} />
      <Body style={{ fontSize: 10.5, color: C.dim }}>
        {count} aliment{count > 1 ? "s" : ""} {count > 1 ? "seront ajoutés" : "sera ajouté"} au jour choisi — l'existant n'est jamais remplacé.
      </Body>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" style={{ flex: 1 }} disabled={!canConfirm} onClick={() => onConfirm([...checked], target)}>Copier</Btn>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
      </div>
    </div>
  );
}

export default function NutritionTab({ targetsFor, macros, save, training }) {
  const [date, setDate] = useState(today());
  const [openMeal, setOpenMeal] = useState(null);
  // Distinct de openMeal : "Macro rapide" ouvre la même feuille mais directement sur la
  // saisie libre, sans passer par la recherche — c'est justement la recherche qu'on
  // veut éviter pour un ajout rapide de macros sans aliment précis en tête.
  const [quickAdd, setQuickAdd] = useState(false);
  const [copyMeal, setCopyMeal] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const food = useFoodLog();

  // BASCULE M6 : recalcule les totaux macroLog pour CHAQUE date présente dans foodLog à
  // chaque changement du journal, quelle que soit la date affichée à l'écran — une
  // copie/duplication peut très bien modifier un autre jour que celui-ci ("Dupliquer
  // cette journée" cible explicitement une AUTRE date). deriveMacroLog ne renvoie que les
  // dates qui ont des entrées, jamais la liste complète : un jour qui n'existe que dans
  // l'historique Cronometer (avant le module) n'est donc jamais recalculé ni écrasé.
  // Comparaison avant écriture pour ne déclencher un save.macros que si quelque chose a
  // réellement changé (évite une boucle de re-render/écriture à chaque frappe).
  useEffect(() => {
    if (!food.ready) return;
    const derived = deriveMacroLog(food.log);
    if (!derived.length) return;
    let next = macros;
    let changed = false;
    for (const d of derived) {
      const cur = macros.find((m) => m.date === d.date);
      if (!cur || cur.protein !== d.protein || cur.carbs !== d.carbs || cur.fat !== d.fat || cur.fiber !== d.fiber || cur.source !== "foodlog") {
        next = upsert(next, d);
        changed = true;
      }
    }
    if (changed) save.macros(next);
    // food.log et macros suffisent à déterminer si une dérivation est nécessaire ; save
    // est stable (vient de App.jsx), l'omettre évite une boucle de dépendances inutile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.log, food.ready, macros]);

  const dayEntries = useMemo(() => entriesFor(food.log, date), [food.log, date]);
  const t = useMemo(() => totals(dayEntries), [dayEntries]);

  const tg = targetsFor(date);
  const kcalTarget = Math.round(tg.protein * 4 + tg.carbs * 4 + tg.fat * 9);
  const left = kcalTarget - t.kcal;

  // Eau : PAS une donnée du module Nutrition. `macroLog.water` existe déjà (saisie
  // manuelle + synchro Health Connect via runHealthSync dans App.jsx) — on l'affiche
  // simplement ici aussi, pour éviter d'avoir à changer d'onglet, sans dupliquer ni
  // déplacer la donnée. Mêmes boutons que l'onglet Macros, même cible (dont le bonus
  // basket +1 L, porté par targetsFor via targetsForDate).
  const curMacro = macros.find((m) => m.date === date) || {};
  const water = curMacro.water ?? 0;
  const basketDay = training.some((tr) => tr.type === "Basket" && tr.date === date);
  const waterTgt = tg.water + (basketDay ? 1000 : 0);
  const addWater = (ml) => {
    const next = Math.max(0, (macros.find((m) => m.date === date)?.water ?? 0) + ml);
    save.macros(upsert(macros, { date, water: next, source: "manual" }));
  };

  const add = (f, q) => {
    food.add(makeEntry({ date, meal: openMeal, food: f, q }));
    setOpenMeal(null);
    setQuickAdd(false);
  };
  const closeSearch = () => { setOpenMeal(null); setQuickAdd(false); };

  const copyFrom = (mealKey, fromDate) => {
    const entries = food.log.filter((e) => e.date === fromDate && e.meal === mealKey);
    food.addMany(copyEntries(entries, { date, meal: mealKey }));
    setCopyMeal(null);
  };

  const duplicateTo = (mealKeys, targetDate) => {
    const toAdd = mealKeys.flatMap((mealKey) =>
      copyEntries(dayEntries.filter((e) => e.meal === mealKey), { date: targetDate, meal: mealKey }));
    if (toAdd.length) food.addMany(toAdd);
    setDuplicating(false);
  };

  // Navigation au doigt (demandé le 03/08/2026) : swipe gauche = jour suivant, droite =
  // jour précédent. Décision volontairement AU RELÂCHÉ (touchend), jamais preventDefault
  // sur touchmove — le scroll vertical normal de la page n'est donc jamais bloqué ni
  // saccadé, on se contente d'observer si le trajet final ressemble à un swipe horizontal
  // une fois le doigt levé. Départ ignoré si trop près du bord gauche de l'écran, pour ne
  // jamais entrer en conflit avec le geste "retour" du système Android.
  const touchStart = useRef(null);
  const EDGE_GUARD = 24;
  const SWIPE_MIN_DIST = 60;
  const SWIPE_MAX_SLOPE = 0.6; // vertical / horizontal — au-delà, c'est un scroll, pas un swipe
  const onTouchStart = (e) => {
    if (openMeal) { touchStart.current = null; return; } // FoodSearch est une feuille à part, pas concernée
    const t = e.touches[0];
    touchStart.current = t.clientX < EDGE_GUARD ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DIST || Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_SLOPE) return;
    setDate((d) => shiftDateKey(d, dx < 0 ? 1 : -1));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <ScreenHeader
        title="Nutrition"
        subtitle={date === today() ? "aujourd'hui" : fmt(date)}
        right={<span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: "#000",
          background: C.accent, padding: "3px 6px", borderRadius: 4,
        }}>BÊTA</span>}
      />

      <Card>
        <DateField value={date} onChange={setDate} future />
        {duplicating ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
            <DuplicatePanel entries={dayEntries} date={date} onConfirm={duplicateTo} onClose={() => setDuplicating(false)} />
          </div>
        ) : (
          <Btn variant="ghost" onClick={() => setDuplicating(true)} style={{ width: "100%", marginTop: 10, padding: "6px 0", fontSize: 10.5 }}>
            <Copy size={11} style={{ display: "inline", verticalAlign: -1, marginRight: 5 }} />
            Dupliquer cette journée vers un autre jour
          </Btn>
        )}
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

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <Droplet size={12} color={C.accent} />
          <Label>Eau</Label>
          <span style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: C.text }}>
            {(water / 1000).toFixed(2)}<span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}> / {(waterTgt / 1000).toFixed(1)} L</span>
          </span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 6, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ background: C.accent, width: `${Math.min(100, (water / waterTgt) * 100)}%`, height: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="plain" onClick={() => addWater(250)} style={{ flex: 1 }}>+250 ml</Btn>
          <Btn variant="plain" onClick={() => addWater(500)} style={{ flex: 1 }}>+500 ml</Btn>
          <Btn variant="ghost" onClick={() => addWater(-250)}>−250</Btn>
        </div>
      </Card>

      {MEALS.map((meal) => {
        const entries = dayEntries.filter((e) => e.meal === meal.key);
        const mt = totals(entries);
        return (
          <Card key={meal.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: entries.length ? 2 : 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <Label style={{ fontSize: 10, color: C.text2 }}>{meal.label}</Label>
                {/* Repère discret du jour affiché — le swipe seul ne se voit pas assez
                    (demandé le 03/08/2026) : sans ça, rien à l'écran n'indique qu'on a
                    changé de jour après un swipe. */}
                <span style={{ fontSize: 9, color: C.dim, fontFamily: C.mono }}>
                  {date === today() ? "aujourd'hui" : fmt(date)}
                </span>
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 800, color: entries.length ? C.accent : C.dim }}>
                {entries.length ? `${n0(mt.kcal)} kcal` : "—"}
              </span>
            </div>
            {entries.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 8, fontFamily: C.mono, fontSize: 10, color: C.muted }}>
                <span>P{mt.prot}</span><span>G{mt.gluc}</span><span>L{mt.lip}</span><span>Fib{mt.fib}</span>
              </div>
            )}
            {entries.map((e) => (
              <EntryRow key={e.id} e={e} onUpdate={food.update} onRemove={food.remove} />
            ))}
            {copyMeal === meal.key ? (
              <CopyPanel
                candidates={copySourceCandidates(food.log, { meal: meal.key, excludeDate: date })}
                onPick={(d) => copyFrom(meal.key, d)}
                onClose={() => setCopyMeal(null)}
              />
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn variant="plain" onClick={() => { setOpenMeal(meal.key); setQuickAdd(false); }} style={{ flex: 1, padding: "7px 12px", fontSize: 11 }}>
                  <Plus size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />Ajouter
                </Btn>
                <Btn variant="plain" onClick={() => { setOpenMeal(meal.key); setQuickAdd(true); }} style={{ padding: "7px 12px", fontSize: 11 }}>
                  <Zap size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />
                </Btn>
                <Btn variant="plain" onClick={() => setCopyMeal(meal.key)} style={{ padding: "7px 12px", fontSize: 11 }}>
                  <Copy size={12} />
                </Btn>
              </div>
            )}
          </Card>
        );
      })}

      {dayEntries.length === 0 && <Empty>Aucun aliment enregistré ce jour.</Empty>}

      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", padding: "4px 0 2px" }}>
        Module interne en test — calories et macros alimentent l'onglet Macros,
        plus Health Connect côté nutrition (coupé depuis la bascule M6).
      </Body>

      {openMeal && (
        <FoodSearch
          meal={openMeal}
          mealLabel={MEALS.find((m) => m.key === openMeal).label}
          date={date}
          log={food.log}
          pins={food.pins}
          muted={food.muted}
          portions={food.portions}
          recipes={food.recipes}
          onAdd={add}
          onTogglePin={food.togglePin}
          onMute={food.muteFromSuggestions}
          onSavePortion={food.savePortion}
          onRemovePortion={food.removePortion}
          onCreateRecipe={food.addRecipe}
          onRemoveRecipe={food.removeRecipe}
          onClose={closeSearch}
          startFree={quickAdd}
        />
      )}
    </div>
  );
}
