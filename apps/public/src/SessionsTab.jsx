import { useState, useMemo } from "react";
import { ChevronRight, CheckCircle2, Trash2 } from "lucide-react";
import { TEMPLATES, TYPES, hsrForWeek } from "@rawcare/core/session/templates";
import { exerciseList, recordsBySession, painOutOfBase } from "@rawcare/core/training";
import { SCHEMES, climbLabel } from "@rawcare/core/climbing";
import { today, fmt, round, byDate, daysBetween, lastN } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body, Btn, Field, DateField, Stepper, ScreenHeader, Empty } from "./ui.jsx";
import { FAMILY_TYPES } from "./onboarding.js";
import MuscuLogger from "./MuscuLogger.jsx";
import BlocsField from "./BlocsField.jsx";
import ProgressScreen from "./ProgressScreen.jsx";

// Écran Séances (carnet complet) — RawCare Phase 2, Phase B. Toute la logique métier vient
// de @rawcare/core (déjà extraite lors des chantiers V3/V4/V5/RawCare Phase 0/1) : ce
// fichier est de l'UI React consommant des fonctions pures, aucune nouvelle logique métier.
//
// Depuis le chantier onboarding (06/08/2026) : le sélecteur de type de séance est filtré aux
// familles actives de l'utilisateur (`data.activeSports`, voir onboarding.js), `climbScheme`
// est lu depuis `data.climbScheme` (plus figé sur "gym"), et `painOutOfBase` lit
// `data.painLogs` (N zones dynamiques) au lieu des `kneeLog`/`elbowLog` fixes d'apps/perso.

export default function SessionsTab({ data, update, error: loadError }) {
  const training = data?.trainingLog || [];
  const hsrWeek = data?.hsrWeek ?? 1;
  const painLogs = data?.painLogs || {};
  const painLogList = Object.values(painLogs);
  const activeSports = data?.activeSports || [];
  const activeTypes = activeSports.flatMap((fam) => FAMILY_TYPES[fam] || []);
  const scheme = SCHEMES[data?.climbScheme] || SCHEMES.gym;

  const [open, setOpen] = useState(null);
  const [progress, setProgress] = useState(false);
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(60);
  const [rpe, setRpe] = useState(7);
  const [blocs, setBlocs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const setHsrWeek = async (n) => {
    try { await update({ hsrWeek: n }); } catch (e) { setSaveError(String(e.message || e)); }
  };

  const pickType = (type) => {
    const sel = open === type;
    setEditing(null);
    setDate(today());
    setStartTime(new Date().toTimeString().slice(0, 5));
    setDuration(60);
    setRpe(7);
    setBlocs([]);
    setOpen(sel ? null : type);
  };

  const editSession = (t) => {
    setEditing(t);
    setDate(t.date);
    setStartTime(t.start ?? new Date().toTimeString().slice(0, 5));
    setDuration(t.duration ?? 60);
    setRpe(t.rpe ?? 7);
    setBlocs(t.blocs ?? []);
    setOpen(t.type);
  };

  const persist = async (next) => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ trainingLog: next.sort(byDate) });
      setOpen(null); setEditing(null);
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const logSession = (type) => {
    const rec = { id: editing?.id ?? `${date}-${type}-${Date.now()}`, date, type, start: startTime, duration: round(duration), rpe,
      ...(type === "Escalade" && blocs.length ? { blocs } : {}) };
    persist(editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]);
  };
  const saveMuscu = (rec) => {
    persist(editing ? training.map((x) => (x === editing ? rec : x)) : [...training, rec]);
  };
  const deleteSession = (t) => {
    persist(training.filter((x) => x !== t));
  };

  const vol = {};
  training.filter((t) => daysBetween(t.date, today()) <= 14).forEach((t) => { vol[t.type] = (vol[t.type] || 0) + 1; });
  const exoCount = useMemo(() => exerciseList(training).length, [training]);
  const records = useMemo(() => recordsBySession(training), [training]);
  const painRed = painOutOfBase(painLogList, date);

  if (open && TEMPLATES[open]?.kind === "muscu") {
    return (
      <MuscuLogger key={editing?.id || `new-${open}`} type={open} training={training} hsrWeek={hsrWeek} date={date} onDate={setDate}
        onSave={saveMuscu} onCancel={() => { setOpen(null); setEditing(null); }} initial={editing} painRed={painRed} />
    );
  }
  if (progress) return <ProgressScreen training={training} onBack={() => setProgress(false)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Séances" subtitle="carnet · progressive overload" />

      {activeTypes.length === 0 && (
        <Empty>Aucun sport activé — choisis-en au moins un depuis « Réglages ».</Empty>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TYPES.filter((type) => activeTypes.includes(type)).map((type) => {
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
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: C.mono }}>
                {vol[type] ? `${vol[type]}× / 14j` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {open && TEMPLATES[open].kind !== "muscu" && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, color: C.accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>
            {open}{editing && <span style={{ fontSize: 11, textTransform: "none", marginLeft: 6 }}>(modification)</span>}
          </div>
          <Body style={{ marginBottom: 12 }}>
            {open === "Escalade"
              ? "Compte comme volume tirage — jamais un jour Upper, pour protéger le coude."
              : "Échauffement recommandé avant impact."}
          </Body>
          <div style={{ marginBottom: 10 }}><DateField value={date} onChange={setDate} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Début">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontFamily: C.mono, fontSize: 13, color: C.text, fontWeight: 700, width: "100%", outline: "none", boxSizing: "border-box" }} />
            </Field>
            <Field label="Durée (min)"><Stepper value={duration} set={setDuration} step={5} min={0} int /></Field>
          </div>
          <Field label="RPE"><Stepper value={rpe} set={setRpe} step={1} min={1} max={10} int /></Field>
          {open === "Escalade" && <BlocsField blocs={blocs} setBlocs={setBlocs} scheme={scheme} />}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={() => logSession(open)} disabled={saving} style={{ flex: 1 }}>
              <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />{editing ? "Enregistrer les modifications" : "Enregistrer"}
            </Btn>
            <Btn variant="ghost" onClick={() => { setOpen(null); setEditing(null); }}>Annuler</Btn>
          </div>
        </Card>
      )}

      <Card accentLeft onClick={() => setProgress(true)} style={{ padding: "13px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label style={{ letterSpacing: 1.5 }}>Progression par exercice</Label>
            <Body style={{ marginTop: 3 }}>
              {exoCount ? `${exoCount} exercice${exoCount > 1 ? "s" : ""} suivi${exoCount > 1 ? "s" : ""} · tendance` : "Aucune séance de muscu enregistrée pour l'instant."}
            </Body>
          </div>
          <ChevronRight size={15} color={C.accent} />
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Semaine HSR</Label>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, fontWeight: 800 }}>{hsrForWeek(hsrWeek).scheme}</span>
        </div>
        <Stepper value={hsrWeek} set={setHsrWeek} step={1} min={1} max={12} int unit="/12" />
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>Pilote presse à cuisses + leg extension en Lower A. Tempo 6 s · repos 2-3 min.</Body>
      </Card>

      <Card style={{ padding: "6px 14px" }}>
        <Label style={{ padding: "10px 0 6px", letterSpacing: 1.5 }}>Dernières séances</Label>
        {training.length ? lastN(training, 10).reverse().map((t, i) => {
          const rec = records.get(t);
          const recShown = rec && !painOutOfBase(painLogList, t.date);
          return (
          <div key={i} onClick={() => editSession(t)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.divider}`, cursor: "pointer" }}>
            <div>
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{t.type}</span>
              {recShown && (
                <span title={rec.join(" · ")} style={{ fontSize: 10, color: C.accent, fontWeight: 800, marginLeft: 6, fontFamily: C.mono }}>
                  ★{rec.length > 1 ? rec.length : ""}
                </span>
              )}
              <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 8, fontFamily: C.mono }}>{fmt(t.date)}{t.start ? ` · ${t.start}` : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>
                {t.exercices
                  ? `${t.exercices.length} exos · ${t.exercices.reduce((a, e) => a + (e.series?.length || 0), 0)} séries`
                  : `${t.duration != null ? t.duration + "′" : ""}${t.rpe != null ? ` · RPE ${t.rpe}` : ""}${climbLabel(t.blocs, scheme) ? ` · ${climbLabel(t.blocs, scheme)}` : ""}`}
              </span>
              <button onClick={(ev) => { ev.stopPropagation(); deleteSession(t); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          );
        }) : <Empty>Aucune séance enregistrée.</Empty>}
      </Card>
      {(saveError || loadError) && <p style={{ color: C.danger, fontSize: 12 }}>{saveError || loadError}</p>}
    </div>
  );
}
