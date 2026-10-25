// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 6 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Trash2, ChevronRight } from "lucide-react";
import { store, getSync } from "../../store.js";
import { splitExerciseList, recordsBySession, painOutOfBase } from "@rawcare/core/training";
import { loadLabel, geneLabel } from "@rawcare/core/sessionLoad";
import { TEMPLATES, TYPES, hsrForWeek } from "@rawcare/core/session/templates";
import { C, today, fmt, round, byDate, lastN, daysBetween, Card, Label, Body, Empty, Btn, inputStyle, Stepper, Field, DateField, ScreenHeader } from "../../design/compat.jsx";
import { MuscuLogger } from "./MuscuLogger.jsx";
import { restTimer } from "../../lib/restTimer.js";
import { ProgressScreen } from "./ProgressScreen.jsx";
import { GeneField } from "./GeneField.jsx";
import { VolumeCard } from "./VolumeCard.jsx";

export function TrainTab({ training, save, hsrWeek, setHsrWeek, knee, startType, onStartConsumed }) {
  // Séance dont la suppression est « armée » (1er tap sur la corbeille), voir Dernières séances.
  const [armed, setArmed] = useState(null);
  const armTimer = useRef(null);
  useEffect(() => () => clearTimeout(armTimer.current), []);
  // Brouillon auto-sauvegardé (localStorage, hors DATA_KEYS — voir Règles absolues #1) :
  // restaure au montage la séance laissée en cours (TrainTab démonte tout son état à
  // chaque changement d'onglet, ce qui effaçait la séance avant ce correctif). Lu une
  // seule fois (`useState` paresseux). `TEMPLATES[d.type]` vérifié pour ne jamais rouvrir
  // sur un type devenu invalide.
  const [draft0] = useState(() => getSync("trainingDraft", null));
  const [open, setOpen] = useState(() => (draft0?.type && TEMPLATES[draft0.type]) ? draft0.type : null);
  const [progress, setProgress] = useState(false);
  const [date, setDate] = useState(() => draft0?.date ?? today());
  const [startTime, setStartTime] = useState(() => draft0?.start ?? new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(() => draft0?.duration ?? 60);
  const [rpe, setRpe] = useState(() => draft0?.rpe ?? 7);
  const [gene, setGene] = useState(() => draft0?.gene ?? null);
  // Séance déjà enregistrée en cours de modification (référence exacte de l'objet
  // dans `training`) — null quand on démarre une nouvelle séance à blanc.
  const [editing, setEditing] = useState(() => {
    const id = draft0?.editingId;
    return id ? (training.find((t) => t.id === id) ?? null) : null;
  });

  // T3 : arrivée via « Démarrer » (Dashboard) → ouvrir ce type d'emblée (force, pas de toggle),
  // en écrasant un éventuel brouillon comme le ferait un tap sur la tuile.
  useEffect(() => {
    if (startType && TEMPLATES[startType]) { pickType(startType, true); onStartConsumed?.(); }
  }, [startType]);

  const pickType = (type, force = false) => {
    const sel = !force && open === type;
    store.set("trainingDraft", null);
    restTimer.stop(); // minuteur partagé (U3) : une nouvelle séance repart sans le décompte de la précédente
    setEditing(null);
    setDate(today());
    setStartTime(new Date().toTimeString().slice(0, 5));
    setDuration(60);
    setRpe(7);
    setGene(null);
    setOpen(sel ? null : type);
  };

  const editSession = (t) => {
    store.set("trainingDraft", null);
    restTimer.stop();
    setEditing(t);
    setDate(t.date);
    setStartTime(t.start ?? new Date().toTimeString().slice(0, 5));
    setDuration(t.duration ?? 60);
    setRpe(t.rpe ?? 7);
    setGene(t.gene ?? null);
    setOpen(t.type);
  };

  const logSession = (type) => {
    const rec = { id: editing?.id ?? `${date}-${type}-${Date.now()}`, date, type, start: startTime, duration: round(duration), rpe,
      // Gêne (08/10/2026) omise quand rien n'est noté : une séance sans gêne reste exactement
      // la même entrée qu'avant. Les anciens `blocs` d'une séance rééditée ne sont pas repris.
      ...(type === "Escalade" && gene && Object.keys(gene).length ? { gene } : {}) };
    store.set("trainingDraft", null);
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };
  const saveMuscu = (rec) => {
    save.training((editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]).sort(byDate));
    setOpen(null); setEditing(null);
  };

  // Brouillon Escalade (durée/RPE/gêne) — même protection que le carnet muscu,
  // gérée ici puisque Escalade reste rendue directement par TrainTab (kind "sport", pas de
  // MuscuLogger). Ignoré tant qu'un autre type est ouvert.
  useEffect(() => {
    if (open !== "Escalade") return;
    store.set("trainingDraft", { type: "Escalade", date, editingId: editing?.id ?? null, start: startTime, duration, rpe, gene });
  }, [open, date, editing, startTime, duration, rpe, gene]);

  const vol = {};
  training.filter((t) => daysBetween(t.date, today()) <= 14).forEach((t) => { vol[t.type] = (vol[t.type] || 0) + 1; });
  const exoCount = useMemo(() => splitExerciseList(training).active.length, [training]);
  // Records rejoués sur tout l'historique (V4) : quelles séances contenaient un record au
  // moment où elles ont eu lieu. Clé par référence d'objet, comme la suppression.
  const records = useMemo(() => recordsBySession(training), [training]);
  const painRed = painOutOfBase([knee], date);

  if (open && TEMPLATES[open]?.kind === "muscu") {
    return (
      <MuscuLogger key={editing?.id || `new-${open}`} type={open} training={training} hsrWeek={hsrWeek} date={date} onDate={setDate}
        onSave={saveMuscu} onCancel={() => { setOpen(null); setEditing(null); }} initial={editing} painRed={painRed} />
    );
  }
  if (progress) return <ProgressScreen training={training} knee={knee} onBack={() => setProgress(false)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader subtitle="carnet · progressive overload" />

      {/* Choix du type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TYPES.map((type) => {
          const sel = open === type;
          return (
            <button key={type} onClick={() => pickType(type)} style={{
              background: sel ? C.accentRow : C.card, textAlign: "left", cursor: "pointer",
              border: `1.5px solid ${sel ? C.accent : C.border}`, borderRadius: 10, padding: "13px 14px", fontFamily: "inherit",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: sel ? C.accent : C.text, textTransform: "uppercase" }}>{type}</span>
                <ChevronRight size={13} color={sel ? C.accent : C.dim} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontFamily: C.mono }}>
                {vol[type] ? `${vol[type]}× / 14j` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Séance non-muscu */}
      {open && TEMPLATES[open].kind !== "muscu" && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, color: C.accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>
            {open}{editing && <span style={{ fontSize: 13, textTransform: "none", marginLeft: 6 }}>(modification)</span>}
          </div>
          {/* Basket est passé en carnet d'exercices (04/09/2026, kind:"muscu") : cette carte
              ne sert plus qu'à Escalade, seul type "sport" restant. */}
          <Body style={{ marginBottom: 12 }}>Compte comme volume tirage — jamais un jour Upper, pour protéger le coude.</Body>
          <div style={{ marginBottom: 10 }}><DateField value={date} onChange={setDate} /></div>
          <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
            <Field label="Début">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle(false)} />
            </Field>
            <Field label="Durée (min)"><Stepper value={duration} set={setDuration} step={5} min={0} int /></Field>
          </div>
          <Field label="RPE"><Stepper value={rpe} set={setRpe} step={1} min={1} max={10} int /></Field>
          {open === "Escalade" && <GeneField gene={gene} setGene={setGene} />}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={() => logSession(open)} style={{ flex: 1 }}>
              <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />{editing ? "Enregistrer les modifications" : "Enregistrer"}
            </Btn>
            <Btn variant="ghost" onClick={() => { store.set("trainingDraft", null); setOpen(null); setEditing(null); }}>Annuler</Btn>
          </div>
        </Card>
      )}

      {/* Progression par exercice */}
      <Card accentLeft onClick={() => setProgress(true)} style={{ padding: "13px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label style={{ letterSpacing: 1.5 }}>Progression par exercice</Label>
            <Body style={{ marginTop: 3 }}>
              {exoCount ? `${exoCount} exercice${exoCount > 1 ? "s" : ""} suivi${exoCount > 1 ? "s" : ""} · courbe et tendance` : "Aucune séance de muscu enregistrée pour l'instant."}
            </Body>
          </div>
          <ChevronRight size={15} color={C.accent} />
        </div>
      </Card>

      {/* Volume hebdo par groupe musculaire (T2, 04/10/2026) : séries cochées sur 7 jours,
          hors gainage — même calcul que `volume_hebdo_series` envoyé au Coach IA. Zone cible
          10-20 séries/sem. sur les groupes prioritaires (pecs, épaules), compte neutre ailleurs. */}
      <VolumeCard training={training} />

      {/* Semaine HSR */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Semaine HSR</Label>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, fontWeight: 800 }}>{hsrForWeek(hsrWeek).scheme}</span>
        </div>
        <Stepper value={hsrWeek} set={setHsrWeek} step={1} min={1} max={12} int unit="/12" />
        <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>Pilote presse à cuisses + leg extension en Lower A et Lower C. Tempo 6 s · repos 2-3 min.</Body>
      </Card>

      {/* Historique */}
      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Dernières séances</Label>
        {training.length ? lastN(training, 10).reverse().map((t, i) => {
          // Marqueur record : la séance contenait au moins une meilleure série de tous les
          // temps AU MOMENT où elle a eu lieu, et aucun tendon n'était hors base ce jour-là.
          const rec = records.get(t);
          const recShown = rec && !painOutOfBase([knee], t.date);
          return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, borderTop: `1px solid ${C.divider}` }}>
            <button type="button" className="p-tap" onClick={() => editSession(t)} aria-label={`Modifier la séance ${t.type} du ${fmt(t.date)}`} style={{
              flex: 1, minWidth: 0, minHeight: 60, padding: "8px 0", background: "none", border: "none", textAlign: "left", fontFamily: "inherit", color: C.text,
              display: "grid", gap: 3,
            }}>
            <div>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{t.type}</span>
              {recShown && (
                <span title={rec.join(" · ")} style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginLeft: 6, fontFamily: C.mono }}>
                  ★{rec.length > 1 ? rec.length : ""}
                </span>
              )}
              <span style={{ fontSize: 13, color: C.muted, marginLeft: 8, fontFamily: C.mono }}>{fmt(t.date)}{t.start ? ` · ${t.start}` : ""}</span>
            </div>
              <span style={{ fontSize: 13, color: C.text2, fontFamily: C.mono }}>
                {/* Basket (04/09/2026) porte désormais exercices ET durée/RPE à la fois — les
                    deux se combinent, au lieu de l'ancien "soit l'un soit l'autre". */}
                {[
                  t.exercices?.length ? `${t.exercices.length} exos · ${t.exercices.reduce((a, e) => a + (e.series?.length || 0), 0)} séries` : null,
                  t.duration != null ? `${t.duration}′` : null,
                  t.rpe != null ? `RPE ${t.rpe}` : null,
                  t.exercices ? null : loadLabel(t) || null,
                  geneLabel(t) || null,
                ].filter(Boolean).join(" · ")}
              </span>
            </button>
            {/* Suppression en deux taps (U3 étape 6) : la corbeille passe de 13 à 48 px, donc plus
                facile à toucher par erreur — le 1er tap arme « Supprimer ? » 3 s, le 2e supprime. */}
            <button type="button" className="p-tap" aria-label={armed === t ? `Confirmer la suppression de ${t.type} du ${fmt(t.date)}` : `Supprimer la séance ${t.type} du ${fmt(t.date)}`}
              onClick={() => {
                if (armed === t) { setArmed(null); save.training(training.filter((x) => x !== t)); return; }
                setArmed(t); clearTimeout(armTimer.current); armTimer.current = setTimeout(() => setArmed(null), 3000);
              }}
              style={{
                flexShrink: 0, minWidth: 48, height: 48, padding: armed === t ? "0 10px" : 0, borderRadius: 10,
                display: "grid", placeItems: "center", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                background: armed === t ? C.dangerBg : "transparent", color: armed === t ? C.danger : C.text2,
                border: `1px solid ${armed === t ? C.danger : "transparent"}`,
              }}>
              {armed === t ? "Supprimer ?" : <Trash2 size={18} aria-hidden="true" />}
            </button>
          </div>
          );
        }) : <Empty>Aucune séance enregistrée.</Empty>}
      </Card>
    </div>
  );
}
