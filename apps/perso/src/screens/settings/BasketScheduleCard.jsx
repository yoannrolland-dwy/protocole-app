// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { X } from "lucide-react";
import { C, today, fmt, Card, Label, Body, Btn, inputStyle } from "../../ui.jsx";

// Planning Basket fixe (01/09/2026) : jours de semaine récurrents (entraînement hebdo,
// 0=dimanche...6=samedi comme Date#getDay()) + dates de matchs ponctuelles (calendrier de
// saison, irrégulier — 22 dimanches sur les ~34 possibles entre octobre et mai, donc jamais
// "tous les dimanches"). Deux mécanismes distincts pour deux réalités distinctes : un jour
// fixe se répète indéfiniment, une date de match ne se répète jamais toute seule.
const WEEKDAYS = [
  { key: 1, label: "Lun" }, { key: 2, label: "Mar" }, { key: 3, label: "Mer" },
  { key: 4, label: "Jeu" }, { key: 5, label: "Ven" }, { key: 6, label: "Sam" }, { key: 0, label: "Dim" },
];

export function BasketScheduleCard({ basketSchedule, setBasketSchedule }) {
  const [newDate, setNewDate] = useState("");
  const weekly = basketSchedule.weekly || [];
  const matchDates = basketSchedule.matchDates || [];
  const toggleDay = (d) => {
    const next = weekly.includes(d) ? weekly.filter((x) => x !== d) : [...weekly, d].sort();
    setBasketSchedule({ ...basketSchedule, weekly: next });
  };
  const addMatch = () => {
    if (!newDate || matchDates.includes(newDate)) return;
    setBasketSchedule({ ...basketSchedule, matchDates: [...matchDates, newDate].sort() });
    setNewDate("");
  };
  const removeMatch = (d) => setBasketSchedule({ ...basketSchedule, matchDates: matchDates.filter((x) => x !== d) });
  // Liste repliée par défaut (30/09/2026) : une saison entière = 22 dates, trop long à
  // dérouler dans les Réglages. Replié = seulement les 3 prochains matchs ; "Voir tout"
  // déplie la saison complète. Aucune date passée ici : elles sont purgées au chargement
  // (voir l'effet de chargement d'`App`), décision de Yoann — inutile de garder une donnée
  // sans effet.
  const [showAll, setShowAll] = useState(false);
  // Le match d'hier est gardé en mémoire pour le Full Body du lundi : jamais affiché replié.
  const shown = showAll ? matchDates : matchDates.filter((d) => d >= today()).slice(0, 3);
  const hiddenCount = matchDates.length - shown.length;

  return (
    <Card>
      <Label style={{ marginBottom: 8 }}>Planning Basket fixe</Label>
      <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
        Le recommandeur sait qu'un Basket est prévu avant même que tu l'aies loggé : il évite
        de proposer un Lower le même jour, le propose en priorité ("c'est le jour de
        l'entraînement") le jour même, et bascule sur le planning "semaine avec match" dès
        qu'un match tombe le dimanche.
      </Body>

      <Label style={{ marginBottom: 6 }}>Entraînement hebdomadaire</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {WEEKDAYS.map((d) => {
          const on = weekly.includes(d.key);
          return (
            <button key={d.key} onClick={() => toggleDay(d.key)} style={{
              padding: "7px 12px", borderRadius: 6, cursor: "pointer",
              fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
              background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
              border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
            }}>{d.label}</button>
          );
        })}
      </div>

      <Label style={{ marginBottom: 6 }}>Dates de matchs (saison)</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...inputStyle(false), flex: 1 }} />
        <Btn variant="primary" disabled={!newDate} onClick={addMatch} style={{ padding: "0 16px" }}>Ajouter</Btn>
      </div>
      {matchDates.length === 0 ? (
        <Body style={{ fontSize: 11, color: C.dim }}>Aucune date de match enregistrée.</Body>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shown.map((d) => (
            <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px", borderBottom: `1px solid ${C.divider}` }}>
              <span style={{ fontSize: 12, color: C.text, fontFamily: C.mono }}>{fmt(d)}</span>
              <button onClick={() => removeMatch(d)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <X size={13} />
              </button>
            </div>
          ))}
          {(hiddenCount > 0 || showAll) && (
            <button onClick={() => setShowAll((v) => !v)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "8px 2px 2px",
              textAlign: "left", color: C.accent, fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, fontFamily: "inherit",
            }}>
              {showAll ? "Réduire" : `Voir tout (${matchDates.length})`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
