// Écran de recherche et d'ajout d'un aliment (feuille plein écran).
//
// Deux temps : on choisit un aliment, puis on règle la quantité. Séparer les deux évite
// la liste de résultats encombrée de champs de saisie, et laisse la place à un aperçu
// des macros réelles avant de valider.
//
// CIQUAL tourne à chaque caractère (0,24 ms mesuré) et reste toujours en tête. Open Food
// Facts (M2, produits de marque à code-barres) est sous un séparateur en dessous,
// déclenché seulement 700 ms après la dernière frappe — son quota de recherche texte est
// étroit (~10 req/min, une deuxième requête à moins de 5 s de la première renvoie déjà
// une 503, vérifié le 01/08/2026), une recherche à la volée le ferait sauter en quelques
// secondes d'utilisation normale.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, ChevronLeft, Star, PencilLine, Trash2, ScanBarcode } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { C, Btn, Label, Body, Empty, Stepper, TextInput, inputStyle } from "../ui.jsx";
import { searchCiqual } from "./ciqual.js";
import { searchOFF, getOFFByBarcode } from "./off.js";
import { suggestions, searchBoost, MACROS, newQuickRef } from "./foodStore.js";
import { scanBarcode } from "./scan.js";

const OFF_DEBOUNCE_MS = 700;

const MACRO_LABEL = { kcal: "kcal", prot: "P", gluc: "G", lip: "L", fib: "Fib" };

// Une valeur absente de la table n'est pas un zéro : on l'affiche « — » pour que le
// total du jour puisse rester honnête (voir totals().missing dans foodStore).
const val = (v, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

// OFF est crowdsourcé : beaucoup de produits n'ont pas toutes les macros renseignées.
// Un badge honnête plutôt que de faire passer une donnée manquante pour un vrai zéro.
const missingCount = (food) => MACROS.filter((m) => food.per100[m] === null || food.per100[m] === undefined).length;

function Row({ food, onClick, pinned, onPin, onRemove }) {
  const incomplete = food.ref.startsWith("off:") && missingCount(food) > 0;
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
        {(food.brand || food.grp) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 0.8 }}>{food.brand || food.grp}</span>
            {incomplete && (
              <span style={{ fontSize: 8.5, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 4px" }}>
                données incomplètes
              </span>
            )}
          </div>
        )}
      </div>
      {onPin && (
        <button onClick={onPin} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6,
          color: pinned ? C.accent : C.dim,
        }}>
          <Star size={15} fill={pinned ? C.accent : "none"} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer", padding: 6, color: C.dim,
        }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------- saisie libre / ajout rapide ----------
   Indispensable dès M1 : sans elle, un aliment absent de CIQUAL (skyr, whey, plat du
   restaurant) bloque la journée entière et rend le test en parallèle impossible.
   Les valeurs saisies sont les macros DE LA PORTION mangée — on les stocke donc en
   per100 avec une quantité de 100 g, ce qui garde le même modèle que le reste sans
   demander à l'utilisateur de faire une règle de trois.
   Le nom est optionnel (02/08/2026, "ajout rapide" demandé explicitement) : quand on
   veut juste loguer "35g de protéines" sans réfléchir à un intitulé, exiger un nom est
   la friction qui pousse à abandonner. Un nom vide se sauvegarde sous "Ajout rapide". */
function FreeEntry({ onAdd, onBack, backLabel = "Saisie libre" }) {
  const [name, setName] = useState("");
  const [m, setM] = useState({ prot: "", gluc: "", lip: "", fib: "" });
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const kcal = Math.round(num(m.prot) * 4 + num(m.gluc) * 4 + num(m.lip) * 9 + num(m.fib) * 2);
  const ok = MACROS.some((k) => k !== "kcal" && m[k] !== "" && num(m[k]) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <Label style={{ fontSize: 11 }}>{backLabel}</Label>
      </div>
      <Body style={{ fontSize: 10.5, color: C.dim }}>
        Macros de la portion réellement mangée, pas pour 100 g.
      </Body>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (optionnel — ex. Skyr vanille 150 g)" />
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
        ref: newQuickRef(),
        name: name.trim() || "Ajout rapide",
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
            Certaines valeurs sont absentes de {food.ref.startsWith("off:") ? "la fiche Open Food Facts" : "la table CIQUAL"} et ne seront pas comptées.
          </Body>
        )}
      </div>

      <Btn variant="primary" onClick={() => onAdd(food, q)}>Ajouter</Btn>
    </div>
  );
}

/* ---------- feuille principale ---------- */
export default function FoodSearch({ meal, mealLabel, date, log, pins, muted, onAdd, onTogglePin, onMute, onClose, startFree = false }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [offResults, setOffResults] = useState([]);
  const [offState, setOffState] = useState("idle"); // idle | loading | done | error
  const [sel, setSel] = useState(null);
  // L'ajout rapide (bouton "Macro rapide" par repas) ouvre directement ce panneau, sans
  // passer par la recherche — la friction visée est justement d'éviter la recherche.
  const [free, setFree] = useState(startFree);
  // idle | scanning | lookup | notfound | error — distinct de offState : le scan peut
  // échouer avant même d'atteindre OFF (module Play Services, annulation).
  const [scanState, setScanState] = useState("idle");
  const [scanCode, setScanCode] = useState(null);
  const inputRef = useRef(null);
  const runId = useRef(0);
  const offRunId = useRef(0);

  const scan = async () => {
    setScanState("idle"); // efface un message d'un scan précédent (notfound/error)
    const { code, status } = await scanBarcode();
    if (status !== "ok") { if (status === "error") setScanState("error"); return; }
    setScanCode(code);
    setScanState("lookup");
    const { item, notFound, error } = await getOFFByBarcode(code);
    if (item) { setSel(item); setScanState("idle"); }
    else setScanState(error ? "error" : "notfound");
  };

  const boost = useMemo(() => searchBoost(log, { meal, date }), [log, meal, date]);
  const sugg = useMemo(() => suggestions(log, { meal, pins, muted, date }), [log, meal, pins, muted, date]);

  useEffect(() => { if (!startFree) inputRef.current?.focus(); }, [startFree]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    // Jeton de course : searchCiqual est asynchrone (le JSON se charge à la première
    // frappe), donc une réponse tardive ne doit jamais écraser une plus récente.
    const id = ++runId.current;
    searchCiqual(q, { limit: 40, boost }).then((r) => { if (runId.current === id) setResults(r); });
  }, [q, boost]);

  // Open Food Facts : jamais à la frappe (voir le commentaire en tête de fichier). Un
  // timer redémarré à chaque caractère ne se déclenche que quand la frappe s'arrête
  // vraiment, ce qui suffit à rester largement sous le quota en usage normal.
  useEffect(() => {
    if (q.trim().length < 2) { setOffResults([]); setOffState("idle"); return; }
    setOffState("idle");
    const id = ++offRunId.current;
    const t = setTimeout(() => {
      if (offRunId.current !== id) return;
      setOffState("loading");
      searchOFF(q).then(({ items, error }) => {
        if (offRunId.current !== id) return;
        setOffResults(items);
        setOffState(error ? "error" : "done");
      });
    }, OFF_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

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
          <FreeEntry onAdd={onAdd} onBack={() => setFree(false)}
            backLabel={startFree ? "Macro rapide" : "Saisie libre"} />
        ) : sel ? (
          <QtyPanel food={sel} initialQ={sel.lastQ} onAdd={onAdd} onBack={() => setSel(null)} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color={C.muted} style={{ position: "absolute", left: 10, top: 11 }} />
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un aliment…"
                  style={{ ...inputStyle(false), paddingLeft: 32, fontFamily: "inherit", fontWeight: 600 }} />
              </div>
              {/* M3, natif seulement : scan() (Google Code Scanner) — pas de permission
                  caméra, pas d'écran web équivalent. */}
              {Capacitor.isNativePlatform() && (
                <button onClick={scan} disabled={scanState === "lookup"} style={{
                  background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 6,
                  width: 40, color: scanState === "lookup" ? C.dim : C.accent, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ScanBarcode size={18} />
                </button>
              )}
            </div>

            {scanState === "lookup" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>Recherche du produit scanné…</Body>
            )}
            {scanState === "notfound" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>
                Code {scanCode} inconnu d'Open Food Facts. Cherchez-le à la main ou utilisez la saisie libre.
              </Body>
            )}
            {scanState === "error" && (
              <Body style={{ fontSize: 11, color: C.dim, padding: "0 0 10px" }}>
                Scan indisponible pour le moment — réessayez.
              </Body>
            )}

            <Label style={{ marginBottom: 4 }}>
              {showSugg ? "Vos aliments habituels" : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
            </Label>

            {list.length === 0 ? (
              <Empty>{showSugg ? "Rien encore. Cherchez un aliment." : "Aucun résultat dans CIQUAL."}</Empty>
            ) : (
              list.map((f) => (
                <Row key={f.ref + f.name} food={f} pinned={f.pinned}
                  onClick={() => setSel(f)}
                  onPin={showSugg ? () => onTogglePin(f.ref) : undefined}
                  onRemove={showSugg ? () => onMute(f.ref) : undefined} />
              ))
            )}

            {!showSugg && (
              <>
                <Label style={{ marginTop: 18, marginBottom: 4 }}>Produits industriels</Label>
                {(offState === "idle" || offState === "loading") && (
                  <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>
                    {offState === "loading" ? "Recherche Open Food Facts…" : "…"}
                  </Body>
                )}
                {offState === "error" && (
                  <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>
                    Open Food Facts est indisponible pour le moment — réessayez dans quelques secondes.
                  </Body>
                )}
                {offState === "done" && offResults.length === 0 && (
                  <Body style={{ fontSize: 11, color: C.dim, padding: "6px 0" }}>Aucun produit trouvé.</Body>
                )}
                {offResults.map((f) => (
                  <Row key={f.ref} food={f} onClick={() => setSel(f)} />
                ))}
              </>
            )}

            <Btn variant="plain" onClick={() => setFree(true)} style={{ width: "100%", marginTop: 14 }}>
              <PencilLine size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
              Saisie libre
            </Btn>
            <Body style={{ fontSize: 9.5, color: C.dim, marginTop: 10, textAlign: "center" }}>
              Table Ciqual 2020 — ANSES · Licence Ouverte 2.0<br />
              Open Food Facts · Licence Open Database (ODbL)
            </Body>
          </>
        )}
      </div>
    </div>
  );
}
