// Écran de recherche et d'ajout d'un aliment (feuille plein écran).
//
// Deux temps : on choisit un aliment, puis on règle la quantité. Séparer les deux évite
// la liste de résultats encombrée de champs de saisie, et laisse la place à un aperçu
// des macros réelles avant de valider.
//
// M1 : CIQUAL + historique + saisie libre. Open Food Facts (M2) viendra s'ajouter sous
// un séparateur dans la même liste, déclenché après une pause de frappe — la recherche
// CIQUAL, elle, tourne à chaque caractère (0,24 ms mesuré).

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, ChevronLeft, Star, PencilLine } from "lucide-react";
import { C, Btn, Label, Body, Empty, Stepper, TextInput, inputStyle } from "../ui.jsx";
import { searchCiqual } from "./ciqual.js";
import { suggestions, searchBoost, MACROS } from "./foodStore.js";

const MACRO_LABEL = { kcal: "kcal", prot: "P", gluc: "G", lip: "L", fib: "Fib" };

// Une valeur absente de la table n'est pas un zéro : on l'affiche « — » pour que le
// total du jour puisse rester honnête (voir totals().missing dans foodStore).
const val = (v, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

function Row({ food, onClick, pinned, onPin }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      borderBottom: `1px solid ${C.divider}`, padding: "10px 2px",
    }}>
      <div onClick={onClick} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{food.name}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 3, fontFamily: C.mono, fontSize: 10.5, color: C.muted }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>{val(food.per100.kcal)} kcal</span>
          <span>P{val(food.per100.prot)}</span>
          <span>G{val(food.per100.gluc)}</span>
          <span>L{val(food.per100.lip)}</span>
          <span style={{ color: C.dim }}>/100 g</span>
        </div>
        {food.grp && <div style={{ fontSize: 9, color: C.dim, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>{food.grp}</div>}
      </div>
      {onPin && (
        <button onClick={onPin} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6,
          color: pinned ? C.accent : C.dim,
        }}>
          <Star size={15} fill={pinned ? C.accent : "none"} />
        </button>
      )}
    </div>
  );
}

/* ---------- saisie libre ----------
   Indispensable dès M1 : sans elle, un aliment absent de CIQUAL (skyr, whey, plat du
   restaurant) bloque la journée entière et rend le test en parallèle impossible.
   Les valeurs saisies sont les macros DE LA PORTION mangée — on les stocke donc en
   per100 avec une quantité de 100 g, ce qui garde le même modèle que le reste sans
   demander à l'utilisateur de faire une règle de trois. */
function FreeEntry({ onAdd, onBack }) {
  const [name, setName] = useState("");
  const [m, setM] = useState({ prot: "", gluc: "", lip: "", fib: "" });
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const kcal = Math.round(num(m.prot) * 4 + num(m.gluc) * 4 + num(m.lip) * 9 + num(m.fib) * 2);
  const ok = name.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>Saisie libre</Label>
      </div>
      <Body style={{ fontSize: 10.5, color: C.dim }}>
        Macros de la portion réellement mangée, pas pour 100 g.
      </Body>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Skyr vanille 150 g)" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["prot", "Protéines"], ["gluc", "Glucides"], ["lip", "Lipides"], ["fib", "Fibres"]].map(([k, l]) => (
          <div key={k}>
            <Label style={{ marginBottom: 4 }}>{l} (g)</Label>
            <input type="text" inputMode="decimal" value={m[k]} placeholder="0"
              onChange={(e) => setM({ ...m, [k]: e.target.value })}
              style={{ ...inputStyle(false), textAlign: "center" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Label>Calories calculées</Label>
        <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: C.accent }}>{kcal}</span>
      </div>
      <Btn variant="primary" disabled={!ok} onClick={() => onAdd({
        ref: "quick",
        name: name.trim(),
        per100: { kcal, prot: num(m.prot), gluc: num(m.gluc), lip: num(m.lip), fib: num(m.fib) },
      }, 100)}>Ajouter</Btn>
    </div>
  );
}

/* ---------- réglage de la quantité ---------- */
function QtyPanel({ food, initialQ, onAdd, onBack }) {
  const [q, setQ] = useState(initialQ ?? 100);
  const k = q / 100;
  // `int` pour les calories : cohérent avec amounts() dans foodStore, où une décimale de
  // kcal a été jugée trompeuse.
  const amount = (v, int = false) =>
    (v === null || v === undefined ? "—" : int ? Math.round(v * k) : Math.round(v * k * 10) / 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, lineHeight: 1.35 }}>{food.name}</div>
          {food.grp && <div style={{ fontSize: 9, color: C.dim, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{food.grp}</div>}
        </div>
      </div>

      <div>
        <Label style={{ marginBottom: 6 }}>Quantité (g)</Label>
        <Stepper value={q} set={setQ} step={10} unit="g" min={1} int />
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[30, 50, 100, 150, 200, 250].map((v) => (
            <button key={v} onClick={() => setQ(v)} style={{
              padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: C.mono,
              fontSize: 11, fontWeight: 800,
              background: q === v ? C.accent : C.card, color: q === v ? "#000" : C.muted,
              border: `1.5px solid ${q === v ? C.accent : C.border}`,
            }}>{v}</button>
          ))}
        </div>
      </div>

      <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <Label>Apport</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: C.accent }}>{amount(food.per100.kcal, true)}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>kcal</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {["prot", "gluc", "lip", "fib"].map((m) => (
            <div key={m} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 800, color: C.text }}>{amount(food.per100[m])}</div>
              <div style={{ fontSize: 8.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{MACRO_LABEL[m]}</div>
            </div>
          ))}
        </div>
        {MACROS.some((m) => food.per100[m] === null || food.per100[m] === undefined) && (
          <Body style={{ fontSize: 10, color: C.dim, marginTop: 9 }}>
            Certaines valeurs sont absentes de la table CIQUAL et ne seront pas comptées.
          </Body>
        )}
      </div>

      <Btn variant="primary" onClick={() => onAdd(food, q)}>Ajouter</Btn>
    </div>
  );
}

/* ---------- feuille principale ---------- */
export default function FoodSearch({ meal, mealLabel, date, log, pins, onAdd, onTogglePin, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState(null);
  const [free, setFree] = useState(false);
  const inputRef = useRef(null);
  const runId = useRef(0);

  const boost = useMemo(() => searchBoost(log, { meal, date }), [log, meal, date]);
  const sugg = useMemo(() => suggestions(log, { meal, pins, date }), [log, meal, pins, date]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    // Jeton de course : searchCiqual est asynchrone (le JSON se charge à la première
    // frappe), donc une réponse tardive ne doit jamais écraser une plus récente.
    const id = ++runId.current;
    searchCiqual(q, { limit: 40, boost }).then((r) => { if (runId.current === id) setResults(r); });
  }, [q, boost]);

  const showSugg = q.trim().length < 2;
  const list = showSugg ? sugg : results;

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 60,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: `1.5px solid ${C.border}`,
      }}>
        <Label style={{ fontSize: 11, color: C.text }}>{mealLabel}</Label>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {free ? (
          <FreeEntry onAdd={onAdd} onBack={() => setFree(false)} />
        ) : sel ? (
          <QtyPanel food={sel} initialQ={sel.lastQ} onAdd={onAdd} onBack={() => setSel(null)} />
        ) : (
          <>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={15} color={C.muted} style={{ position: "absolute", left: 10, top: 11 }} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un aliment…"
                style={{ ...inputStyle(false), paddingLeft: 32, fontFamily: "inherit", fontWeight: 600 }} />
            </div>

            <Label style={{ marginBottom: 4 }}>
              {showSugg ? "Vos aliments habituels" : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
            </Label>

            {list.length === 0 ? (
              <Empty>{showSugg ? "Rien encore. Cherchez un aliment." : "Aucun résultat dans CIQUAL."}</Empty>
            ) : (
              list.map((f) => (
                <Row key={f.ref + f.name} food={f} pinned={f.pinned}
                  onClick={() => setSel(f)}
                  onPin={showSugg ? () => onTogglePin(f.ref) : undefined} />
              ))
            )}

            <Btn variant="plain" onClick={() => setFree(true)} style={{ width: "100%", marginTop: 14 }}>
              <PencilLine size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
              Saisie libre
            </Btn>
            <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 10, textAlign: "center" }}>
              Table Ciqual 2020 — ANSES · Licence Ouverte 2.0
            </Body>
          </>
        )}
      </div>
    </div>
  );
}
