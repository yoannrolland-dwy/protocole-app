// Onglet Nutrition — journal alimentaire interne (M1 du chantier du 01/08/2026).
//
// BASCULE M6 (02/08/2026) : `foodLog` alimente désormais `macroLog` (voir l'effet de
// dérivation plus bas et `deriveMacroLog` dans foodStore.js) — l'onglet Analyse, le Coach
// IA et le widget reflètent donc directement ce qui est loggé ici, sans code
// supplémentaire de leur côté. La lecture nutrition/eau depuis Health Connect est coupée
// (healthSync.js) : `foodLog` est l'unique écrivain des macros au quotidien désormais.
//
// Design system v2 (chantier U, U3 étape 2, 25/10/2026) : primitives de design/primitives.jsx,
// texte 12 px minimum, cibles de 48 px. Ajouts de cette étape : flèches veille/lendemain,
// 3 habituels du repas en un tap (+ Annuler 5 s), « Comme hier » à cocher, ligne du journal
// modifiable au clavier numérique (Entrée = Enregistrer).

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Droplet, Zap, Copy, Search, Check, History } from "lucide-react";
import { today, fmt, longDate, upsert, shiftDateKey } from "../ui.jsx";
import { T, COLORS } from "../design/tokens.js";
import { progressColor, MACRO_KIND } from "../lib/progress.js";
import { Panel, Eyebrow, Button, IconButton, Chip, NumberField } from "../design/primitives.jsx";
import {
  MEALS, useFoodLog, makeEntry, amounts, entriesFor, totals, isQuickRef, newQuickRef,
  copySourceCandidates, copyEntries, deriveMacroLog, suggestions,
} from "./foodStore.js";
import FoodSearch from "./FoodSearch.jsx";
import { PeriCard } from "../screens/perf/ReferenceCards.jsx";
import { say, sayStable } from "../lib/jeffrey.js";

// Cibles PROTOCOLE (protein/carbs/fat/fiber) → noms internes du module (prot/gluc/lip/fib).
const TARGET_KEY = { prot: "protein", gluc: "carbs", lip: "fat", fib: "fiber" };
const MACRO_SHORT = { prot: "Prot", gluc: "Gluc", lip: "Lip", fib: "Fib" };

const n0 = (x) => Math.round(x);
const n1 = (x) => Math.round(x * 10) / 10;
const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };

function Bar({ pct, color = T.c.accent, h = 6 }) {
  return (
    <div style={{ background: T.c.raised, borderRadius: 99, height: h, overflow: "hidden" }}>
      <div style={{ background: color, width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 99 }} />
    </div>
  );
}

function EntryRow({ e, onUpdate, onRemove, corrected = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(String(e.q));
  const [meal, setMeal] = useState(e.meal);
  const a = amounts(e);
  // Une saisie libre stocke la portion telle quelle (q = 100) : proposer d'en changer les
  // grammes n'aurait aucun sens. Le repas, en revanche, reste modifiable dans tous les cas.
  const isQuick = isQuickRef(e.ref);
  const qNum = Number(q);
  const valid = isQuick || (Number.isFinite(qNum) && qNum > 0);
  const changed = meal !== e.meal || (!isQuick && qNum !== e.q);
  const commit = () => { if (!changed || !valid) return; onUpdate(e.id, { q: isQuick ? e.q : qNum, meal }); setOpen(false); };
  const toggle = () => { if (!open) { setQ(String(e.q)); setMeal(e.meal); } setOpen(!open); };
  return (
    <div style={{ borderBottom: `1px solid ${T.c.lineSoft}` }}>
      <button type="button" className="p-tap" onClick={toggle} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 56, padding: "8px 0",
          background: "none", border: "none", color: T.c.text, textAlign: "left", fontFamily: "inherit" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Astérisque accent = valeurs corrigées à la main (V6). Une correction
              rétroactive ne doit jamais être invisible sur les lignes qu'elle modifie. */}
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
            {e.name}{corrected && <span title="valeurs corrigées" style={{ color: T.c.accent, fontWeight: 800 }}> *</span>}
          </div>
          <div style={{ ...mono, display: "flex", flexWrap: "wrap", columnGap: 10, marginTop: 3, fontSize: 13, color: T.c.text2 }}>
            <span>{isQuick ? "portion" : `${e.q} g`}</span>
            <span>P{a.prot ?? "—"}</span><span>G{a.gluc ?? "—"}</span><span>L{a.lip ?? "—"}</span><span>Fib{a.fib ?? "—"}</span>
          </div>
        </div>
        <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: T.c.accent }}>{a.kcal ?? "—"}</span>
        {open ? <ChevronDown size={18} color={T.c.muted} aria-hidden="true" /> : <ChevronRight size={18} color={T.c.muted} aria-hidden="true" />}
      </button>
      {open && (
        <div style={{ padding: "4px 0 14px", display: "grid", gap: 12 }}>
          {!isQuick && (
            <div style={{ display: "grid", gap: 6 }}>
              <Eyebrow>Quantité</Eyebrow>
              <NumberField value={q} onChange={setQ} unit="g" step={10} min={1} inputMode="numeric"
                label="Quantité en grammes" onEnter={commit} />
            </div>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            <Eyebrow>Repas</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MEALS.map((m) => <Chip key={m.key} on={meal === m.key} onClick={() => setMeal(m.key)}>{m.label}</Chip>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" style={{ flex: 1 }} disabled={!changed || !valid} onClick={commit}>Enregistrer</Button>
            <IconButton label={`Supprimer ${e.name}`} tone="danger" size={52} onClick={() => onRemove(e.id)}>
              <Trash2 size={20} aria-hidden="true" />
            </IconButton>
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
    <div style={{ display: "grid", gap: 4 }}>
      <Eyebrow>Copier depuis le…</Eyebrow>
      {candidates.length === 0 ? (
        <div className="p-sec" style={{ padding: "8px 0" }}>{sayStable("noOtherDay")}</div>
      ) : candidates.map((c) => (
        <button key={c.date} type="button" className="p-tap" onClick={() => onPick(c.date)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 52,
          padding: "0 4px", background: "none", border: "none", borderBottom: `1px solid ${T.c.lineSoft}`,
          color: T.c.text, fontFamily: "inherit", fontSize: 15, textAlign: "left",
        }}>
          <span>{fmt(c.date)}</span>
          <span style={{ ...mono, fontSize: 13, color: T.c.text2 }}>
            {c.count} aliment{c.count > 1 ? "s" : ""} · {c.kcal} kcal{c.missing > 0 ? " +?" : ""}
          </span>
        </button>
      ))}
      <Button variant="plain" block onClick={onClose} style={{ marginTop: 6 }}>Annuler</Button>
    </div>
  );
}

// « Comme hier » (U3 étape 2, demande de Yoann) : le même repas de la veille, chaque aliment
// coché au départ — on décoche ce qu'on ne reprend pas, puis on ajoute. Comme CopyPanel,
// n'AJOUTE que des lignes, ne remplace jamais rien.
function YesterdayPanel({ entries, onConfirm, onClose }) {
  const [kept, setKept] = useState(() => new Set(entries.map((e) => e.id)));
  const toggle = (id) => { const n = new Set(kept); if (n.has(id)) n.delete(id); else n.add(id); setKept(n); };
  const chosen = entries.filter((e) => kept.has(e.id));
  const kcal = n0(totals(chosen).kcal);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <Eyebrow>Hier · décoche ce que tu ne reprends pas</Eyebrow>
      {entries.map((e) => {
        const on = kept.has(e.id);
        const a = amounts(e);
        return (
          <button key={e.id} type="button" role="checkbox" aria-checked={on} className="p-tap p-check" onClick={() => toggle(e.id)}>
            <span className="p-check__box">{on && <Check size={18} strokeWidth={3} aria-hidden="true" />}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>{e.name}</span>
              <span style={{ ...mono, display: "block", fontSize: 13, color: on ? T.c.text2 : T.c.muted }}>
                {isQuickRef(e.ref) ? "portion" : `${e.q} g`} · {a.kcal ?? "—"} kcal
              </span>
            </span>
          </button>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button variant="primary" style={{ flex: 1 }} disabled={!chosen.length} onClick={() => onConfirm(chosen)}>
          {chosen.length ? `Ajouter ${chosen.length} · ${kcal} kcal` : "Rien de coché"}
        </Button>
        <Button variant="plain" onClick={onClose}>Annuler</Button>
      </div>
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

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Eyebrow>Repas à copier</Eyebrow>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MEALS.map((m) => <Chip key={m.key} on={checked.has(m.key)} onClick={() => toggle(m.key)}>{m.label}</Chip>)}
        <Chip on={allChecked} onClick={() => setChecked(allChecked ? new Set() : new Set(MEALS.map((m) => m.key)))}>Toute la journée</Chip>
      </div>
      <Eyebrow>Vers le</Eyebrow>
      <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="p-field" aria-label="Date de destination" />
      <div className="p-sec">
        {count} aliment{count > 1 ? "s" : ""} {count > 1 ? "seront ajoutés" : "sera ajouté"} au jour choisi — l'existant n'est jamais remplacé.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" style={{ flex: 1 }} disabled={!canConfirm} onClick={() => onConfirm([...checked], target)}>Copier</Button>
        <Button variant="plain" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  );
}

// Bandeau « Ajouté · Annuler » (5 s) pour les ajouts en un tap : un doigt qui glisse sur un
// habituel ne doit pas obliger à rouvrir la ligne pour la supprimer. Fixé juste au-dessus
// de la barre d'onglets (62 px + zone système).
function UndoBar({ undo, onUndo }) {
  // La bulle Jeffrey (J1.3) remonte de cette hauteur pour ne jamais cacher « Annuler ».
  useEffect(() => {
    const root = document.documentElement.style;
    if (undo) root.setProperty("--undo-bar-h", "68px"); else root.removeProperty("--undo-bar-h");
    return () => root.removeProperty("--undo-bar-h");
  }, [!!undo]);
  if (!undo) return null;
  return (
    <div role="status" style={{
      position: "fixed", left: 12, right: 12, zIndex: 40,
      bottom: "calc(62px + 12px + var(--session-bar-h, 0px) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
      display: "flex", alignItems: "center", gap: 10, padding: "6px 6px 6px 14px",
      background: T.c.raised, border: `1px solid ${T.c.accent}`, borderRadius: 14,
      boxShadow: "0 8px 24px rgba(0,0,0,.5)", fontFamily: T.f.body,
    }}>
      <Check size={18} color={T.c.accent} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{undo.text}</span>
      <Button variant="outline" onClick={onUndo} style={{ minHeight: 44 }}>Annuler</Button>
    </div>
  );
}

export default function NutritionTab({ targetsFor, macros, save, training, ai }) {
  const [date, setDate] = useState(today());
  const [openMeal, setOpenMeal] = useState(null);
  // Distinct de openMeal : "Macro rapide" ouvre la même feuille mais directement sur la
  // saisie libre, sans passer par la recherche — c'est justement la recherche qu'on
  // veut éviter pour un ajout rapide de macros sans aliment précis en tête.
  const [quickAdd, setQuickAdd] = useState(false);
  const [copyMeal, setCopyMeal] = useState(null);
  const [yesterdayMeal, setYesterdayMeal] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [undo, setUndo] = useState(null); // { ids, text }
  const undoTimer = useRef(null);
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
      if (!cur || cur.protein !== d.protein || cur.carbs !== d.carbs || cur.fat !== d.fat || cur.fiber !== d.fiber || cur.kcal !== d.kcal || cur.source !== "foodlog") {
        next = upsert(next, d);
        changed = true;
      }
    }
    if (changed) save.macros(next);
    // food.log et macros suffisent à déterminer si une dérivation est nécessaire ; save
    // est stable (vient de App.jsx), l'omettre évite une boucle de dépendances inutile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.log, food.ready, macros]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const offerUndo = (ids, text) => {
    clearTimeout(undoTimer.current);
    setUndo({ ids, text });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };
  const runUndo = () => {
    if (!undo) return;
    food.removeMany(undo.ids);
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  const dayEntries = useMemo(() => entriesFor(food.log, date), [food.log, date]);
  const t = useMemo(() => totals(dayEntries), [dayEntries]);
  const yesterday = shiftDateKey(date, -1);
  const yesterdayEntries = useMemo(() => entriesFor(food.log, yesterday), [food.log, yesterday]);

  const tg = targetsFor(date);
  // Fibres comptées (2 kcal/g, règlement UE 1169/2011) : sans ça, la cible était
  // systématiquement sous-évaluée par rapport aux calories réelles consommées (qui, elles,
  // comptent déjà les fibres via la table CIQUAL) — corrigé le 05/08/2026.
  const kcalTarget = Math.round(tg.protein * 4 + tg.carbs * 4 + tg.fat * 9 + (tg.fiber ?? 0) * 2);
  const left = kcalTarget - t.kcal;

  // Eau : PAS une donnée du module Nutrition. `macroLog.water` existe déjà (saisie
  // manuelle + synchro Health Connect via runHealthSync dans App.jsx) — on l'affiche
  // simplement ici aussi, pour éviter d'avoir à changer d'onglet, sans dupliquer ni
  // déplacer la donnée. Même cible que partout (dont le bonus basket +1 L, porté par
  // targetsFor via targetsForDate).
  const curMacro = macros.find((m) => m.date === date) || {};
  const water = curMacro.water ?? 0;
  const basketDay = training.some((tr) => tr.type === "Basket" && tr.date === date);
  const waterTgt = tg.water + (basketDay ? 1000 : 0);
  const kcalColor = progressColor(t.kcal, kcalTarget, "limit");
  const waterColor = progressColor(water, waterTgt, "goal");
  const addWater = (ml) => {
    const next = Math.max(0, (macros.find((m) => m.date === date)?.water ?? 0) + ml);
    save.macros(upsert(macros, { date, water: next, source: "manual" }));
  };

  // Ne ferme plus le tiroir de recherche (01/09/2026) : "Ajouter" ramène désormais à l'écran
  // précédent À L'INTÉRIEUR du tiroir (voir QtyPanel/FreeEntry dans FoodSearch.jsx), pour
  // pouvoir enchaîner plusieurs ajouts sans revenir sur cet onglet à chaque fois. Seul le
  // bouton "X" (closeSearch) referme le tiroir désormais.
  const add = (f, q) => {
    food.add(makeEntry({ date, meal: openMeal, food: f, q }));
  };

  // Habituel en un tap (U3 étape 2) : dernière quantité utilisée, comme le + de la liste
  // « Vos aliments habituels » dans la recherche.
  const addHabit = (mealKey, s) => {
    const q = s.lastQ ?? 100;
    const entry = makeEntry({ date, meal: mealKey, food: s, q });
    food.add(entry);
    offerUndo([entry.id], say("added", { x: `${s.name} · ${q} g` }));
  };

  // Carte resto : le reste de macros envoyé à l'IA et la date d'enregistrement sont ceux
  // du jour AFFICHÉ (`date`), exactement comme "Ajouter"/"Saisie libre" juste à côté dans
  // FoodSearch — pas forcément aujourd'hui. Corrigé le 05/08/2026 : la toute première
  // version forçait `today()`, donc un test sur "demain" (navigation par date) se
  // retrouvait silencieusement loggé sur aujourd'hui.
  const remainingResto = {
    kcal: kcalTarget - t.kcal,
    prot: tg.protein - t.prot,
    gluc: tg.carbs - t.gluc,
    lip: tg.fat - t.lip,
    fib: (tg.fiber ?? 0) - t.fib,
  };
  // Une estimation IA n'est pas une mesure CIQUAL/OFF : le suffixe la rend visible sur
  // chaque ligne du journal (même esprit que le `*` des corrections V6), et `newQuickRef`
  // réutilise exactement le même circuit que "Macro rapide" (portion figée, pas de grammage
  // éditable) puisqu'un plat de restaurant n'a pas de `per100` qui aurait un sens.
  // TOUJOURS food.addMany (jamais food.add en boucle) : `add` capture `raw` par fermeture
  // au moment du render, donc deux appels synchrones (ex. logger une suggestion à deux
  // plats) perdraient silencieusement le premier — bug réel trouvé au test le 05/08/2026.
  const logRestoDishes = (items) => {
    food.addMany(items.map(({ name, macros: m, meal }) => makeEntry({
      date,
      meal,
      food: {
        ref: newQuickRef(),
        name: `${name} (estimé IA)`,
        per100: { kcal: m.kcal, prot: m.prot, gluc: m.gluc, lip: m.lip, fib: m.fib },
      },
      q: 100,
    })));
  };
  const closeSearch = () => { setOpenMeal(null); setQuickAdd(false); };

  const copyFrom = (mealKey, fromDate) => {
    const entries = food.log.filter((e) => e.date === fromDate && e.meal === mealKey);
    const copies = copyEntries(entries, { date, meal: mealKey });
    food.addMany(copies);
    setCopyMeal(null);
    offerUndo(copies.map((e) => e.id), say("copied", { x: `${copies.length} aliment${copies.length > 1 ? "s" : ""} copié${copies.length > 1 ? "s" : ""}` }));
  };

  const addFromYesterday = (mealKey, chosen) => {
    const copies = copyEntries(chosen, { date, meal: mealKey });
    food.addMany(copies);
    setYesterdayMeal(null);
    offerUndo(copies.map((e) => e.id), say("fromYesterday", { x: `${copies.length} aliment${copies.length > 1 ? "s" : ""} repris d'hier` }));
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
    const tt = e.touches[0];
    touchStart.current = tt.clientX < EDGE_GUARD ? null : { x: tt.clientX, y: tt.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const tt = e.changedTouches[0];
    const dx = tt.clientX - start.x;
    const dy = tt.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DIST || Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_SLOPE) return;
    setDate((d) => shiftDateKey(d, dx < 0 ? 1 : -1));
  };

  // Barre du jour collante (05/08/2026, refaite en U3) : le jour affiché reste visible en
  // scrollant, avec flèches veille/lendemain de 48 px (30 % des repas sont saisis à l'avance,
  // mesuré en U1). Toucher la date ouvre le calendrier. Écart de jours en arithmétique
  // locale pure (mêmes `new Date(y,m-1,d)` que `shiftDateKey`), jamais par un instant UTC.
  const dayDiff = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const [ty, tm, td] = today().split("-").map(Number);
    return Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000);
  };
  const diff = dayDiff(date);
  const dayName = diff === 0 ? "Aujourd'hui" : diff === -1 ? "Hier" : diff === 1 ? "Demain"
    : diff < 0 ? `Il y a ${-diff} jours` : `Dans ${diff} jours`;

  return (
    // `minmax(0, 1fr)` (27/10/2026) : une ligne trop large ne peut plus élargir tout l'écran
    // (défilement horizontal constaté avec la police d'Android agrandie).
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, fontFamily: T.f.body, color: T.c.text }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Barre du jour collante. Hors aujourd'hui elle passe en CITRON PLEIN, texte noir, avec le
          bouton « Aujourd'hui » à l'intérieur (25/10/2026, retour de Yoann : « beaucoup plus
          visible ») : en v2 elle restait sombre et seul le mot « Hier » changeait de couleur — on
          ne voyait plus en scrollant qu'on n'était pas sur le jour courant (c'était tout l'intérêt
          de la barre du 05/08/2026). */}
      {(() => {
        const away = diff !== 0;
        const fg = away ? T.c.onAccent : T.c.text;
        const arrow = away ? { color: T.c.onAccent, borderColor: "rgba(0,0,0,.35)" } : undefined;
        return (
          <div style={{
            position: "sticky", top: -14, zIndex: 5, margin: "-14px -16px 0", padding: "10px 12px",
            display: "flex", alignItems: "center", gap: 8,
            background: away ? T.c.accent : T.c.bg,
            borderBottom: `1px solid ${away ? T.c.accent : T.c.lineSoft}`,
          }}>
            <IconButton label="Jour précédent" style={arrow} onClick={() => setDate((d) => shiftDateKey(d, -1))}><ChevronLeft size={22} aria-hidden="true" /></IconButton>
            <label style={{ position: "relative", flex: 1, minWidth: 0, textAlign: "center", cursor: "pointer", color: fg }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{dayName}</div>
              <div style={{ fontSize: 13, fontWeight: away ? 700 : 400, color: away ? fg : T.c.text2 }}>{longDate(date)}</div>
              {/* Champ date invisible posé sur le libellé : le toucher ouvre le calendrier natif. */}
              <input type="date" value={date} aria-label="Choisir le jour"
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />
            </label>
            {away && (
              <button type="button" className="p-tap" onClick={() => setDate(today())} style={{
                minHeight: 44, padding: "0 12px", borderRadius: 10, border: "none", flexShrink: 0,
                background: T.c.onAccent, color: T.c.accent, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              }}>Aujourd'hui</button>
            )}
            <IconButton label="Jour suivant" style={arrow} onClick={() => setDate((d) => shiftDateKey(d, 1))}><ChevronRight size={22} aria-hidden="true" /></IconButton>
          </div>
        );
      })()}

      {/* Calories du jour + reste à consommer : c'est l'information qu'on vient chercher
          en premier quand on ouvre l'app avant un repas. Les 4 macros dans la même carte. */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <div>
            <Eyebrow>Calories</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ ...mono, fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>{n0(t.kcal)}</span>
              <span style={{ ...mono, fontSize: 14, color: T.c.text2 }}>/ {kcalTarget}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Eyebrow>{left >= 0 ? "Il reste" : "Dépassement"}</Eyebrow>
            <div style={{ ...mono, fontSize: 22, fontWeight: 700, marginTop: 4, color: kcalColor }}>
              {left >= 0 ? "" : "+"}{n0(Math.abs(left))}
            </div>
          </div>
        </div>
        <Bar pct={(t.kcal / kcalTarget) * 100} color={kcalColor} h={8} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {["prot", "gluc", "lip", "fib"].map((m) => {
            const target = tg[TARGET_KEY[m]];
            // Protéines/fibres : bleu une fois la cible atteinte ; glucides/lipides : orange puis
            // rouge au-delà (lib/progress.js, même règle partout).
            const col = progressColor(t[m], target, MACRO_KIND[m]);
            return (
              <div key={m} style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <Eyebrow>{MACRO_SHORT[m]}</Eyebrow>
                <div style={{ ...mono, fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", color: col === COLORS.accent ? T.c.text : col }}>
                  {n0(t[m])}
                  {/* Une donnée absente de la table ne doit pas se cacher derrière un total d'apparence exacte. */}
                  {t.missing[m] > 0 && <span style={{ fontSize: 13, color: T.c.muted }} title={`${t.missing[m]} aliment(s) sans cette donnée`}>+?</span>}
                </div>
                <div style={{ ...mono, fontSize: 13, color: T.c.muted }}>/ {target} g</div>
                <Bar pct={target ? (t[m] / target) * 100 : 0} color={col} />
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Eau en une seule rangée (25/10/2026, « beaucoup trop grosse ») : valeur + barre fine à
          gauche, trois boutons compacts de 44 px à droite. Bleu une fois la cible atteinte. */}
      <Panel aria-label="Eau" style={{ padding: "10px 12px", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Droplet size={18} color={waterColor} aria-hidden="true" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
            {/* La cible passe sous la valeur quand la place manque (police agrandie, 27/10/2026). */}
            <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: waterColor === COLORS.accent ? T.c.text : waterColor }}>
              {(water / 1000).toFixed(2)}<span style={{ fontSize: 13, color: T.c.text2, whiteSpace: "nowrap" }}> / {(waterTgt / 1000).toFixed(1)} L</span>
            </span>
            <Bar pct={(water / waterTgt) * 100} color={waterColor} h={4} />
          </div>
          {[[250, "+250"], [500, "+500"], [-250, "−250"]].map(([ml, l]) => (
            <button key={ml} type="button" className="p-tap" onClick={() => addWater(ml)} aria-label={ml > 0 ? `Ajouter ${ml} ml d'eau` : "Retirer 250 ml d'eau"}
              style={{ minWidth: 44, height: 44, padding: "0 6px", borderRadius: 10, border: `1px solid ${T.c.line}`, background: T.c.raised,
                color: T.c.text, fontFamily: T.f.num, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{l}</button>
          ))}
        </div>
      </Panel>

      {MEALS.map((meal) => {
        const entries = dayEntries.filter((e) => e.meal === meal.key);
        const mt = totals(entries);
        const yEntries = yesterdayEntries.filter((e) => e.meal === meal.key);
        // 3 habituels de CE repas (même classement que la recherche), sans ceux déjà
        // présents dans le repas du jour affiché.
        const present = new Set(entries.map((e) => e.ref));
        const habits = suggestions(food.log, { meal: meal.key, pins: food.pins, muted: food.muted, date })
          .filter((s) => !present.has(s.ref)).slice(0, 3);
        const panelOpen = copyMeal === meal.key || yesterdayMeal === meal.key;
        return (
          <Panel key={meal.key} aria-label={meal.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{meal.label}</h2>
              <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: entries.length ? T.c.accent : T.c.muted }}>
                {entries.length ? `${n0(mt.kcal)} kcal` : "—"}
              </span>
            </div>
            {entries.length > 0 && (
              <div style={{ ...mono, display: "flex", flexWrap: "wrap", columnGap: 12, fontSize: 13, color: T.c.text2, marginTop: -6 }}>
                <span>P{n1(mt.prot)}</span><span>G{n1(mt.gluc)}</span><span>L{n1(mt.lip)}</span><span>Fib{n1(mt.fib)}</span>
              </div>
            )}
            {entries.length > 0 && (
              <div>
                {entries.map((e) => (
                  <EntryRow key={e.id} e={e} onUpdate={food.update} onRemove={food.remove}
                    corrected={!!food.overrides?.[e.ref]} />
                ))}
              </div>
            )}

            {copyMeal === meal.key && (
              <CopyPanel
                candidates={copySourceCandidates(food.log, { meal: meal.key, excludeDate: date })}
                onPick={(d) => copyFrom(meal.key, d)}
                onClose={() => setCopyMeal(null)}
              />
            )}
            {yesterdayMeal === meal.key && (
              <YesterdayPanel entries={yEntries} onConfirm={(chosen) => addFromYesterday(meal.key, chosen)} onClose={() => setYesterdayMeal(null)} />
            )}

            {!panelOpen && (
              <>
                {/* Une seule ligne fine qui défile (26/10/2026, proposition A choisie par Yoann sur
                    démo) : les grosses pastilles de 44 px sur deux lignes prenaient trop de place. */}
                {(habits.length > 0 || (entries.length === 0 && yEntries.length > 0)) && (
                  <div className="p-strip" role="group" aria-label={`Aliments habituels · ${meal.label}`} style={{ marginBlock: -6 }}>
                    {entries.length === 0 && yEntries.length > 0 && (
                      <button type="button" className="p-tap p-pill" onClick={() => { setYesterdayMeal(meal.key); setCopyMeal(null); }}>
                        <span className="p-pill__face"><History size={14} color={T.c.accent} aria-hidden="true" />Comme hier</span>
                      </button>
                    )}
                    {habits.map((s) => (
                      <button type="button" key={s.ref} className="p-tap p-pill" onClick={() => addHabit(meal.key, s)} aria-label={`Ajouter ${s.name}, ${s.lastQ ?? 100} grammes`}>
                        <span className="p-pill__face">
                          <Plus size={14} color={T.c.accent} aria-hidden="true" />
                          <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                          <span style={{ ...mono, fontSize: 12, color: T.c.text2 }}>{s.lastQ ?? 100} g</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="outline" style={{ flex: 1 }} onClick={() => { setOpenMeal(meal.key); setQuickAdd(false); }}>
                    <Search size={18} aria-hidden="true" />Chercher
                  </Button>
                  <IconButton label={`Macro rapide · ${meal.label}`} size={52} onClick={() => { setOpenMeal(meal.key); setQuickAdd(true); }}>
                    <Zap size={20} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Copier ${meal.label} depuis un autre jour`} size={52} onClick={() => { setCopyMeal(meal.key); setYesterdayMeal(null); }}>
                    <Copy size={20} aria-hidden="true" />
                  </IconButton>
                </div>
              </>
            )}
          </Panel>
        );
      })}

      {dayEntries.length === 0 && <div className="p-sec" style={{ textAlign: "center", padding: "8px 0" }}>{sayStable("noFoodDay")}</div>}

      <Panel>
        {duplicating ? (
          <DuplicatePanel entries={dayEntries} date={date} onConfirm={duplicateTo} onClose={() => setDuplicating(false)} />
        ) : (
          <Button variant="plain" block onClick={() => setDuplicating(true)}>
            <Copy size={18} aria-hidden="true" />Dupliquer cette journée vers un autre jour
          </Button>
        )}
      </Panel>

      {/* Péri-training + protocoles basket (déplacés depuis l'onglet Analyse, U3 étape 7) */}
      <PeriCard />

      <UndoBar undo={undo} onUndo={runUndo} />

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
          overrides={food.overrides}
          onAdd={add}
          onSaveOverride={food.saveOverride}
          onClearOverride={food.clearOverride}
          onTogglePin={food.togglePin}
          onMute={food.muteFromSuggestions}
          onSavePortion={food.savePortion}
          onRemovePortion={food.removePortion}
          onCreateRecipe={food.addRecipe}
          onRemoveRecipe={food.removeRecipe}
          onUpdateRecipe={food.updateRecipe}
          ai={ai}
          remaining={remainingResto}
          onLogDishes={logRestoDishes}
          onClose={closeSearch}
          startFree={quickAdd}
        />
      )}
    </div>
  );
}
