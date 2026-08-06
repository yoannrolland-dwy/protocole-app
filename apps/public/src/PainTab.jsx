import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2, Play } from "lucide-react";
import { HSR_TABLE, hsrForWeek, ROUTINES } from "@rawcare/core/session/templates";
import { today, fmt, upsert, lastN, daysBetween } from "@rawcare/core/dateUtils";
import {
  C, Card, Label, Body, Empty, Btn, DateField, Pills, ScreenHeader,
  chartAxis, tooltipStyle, tooltipItemStyle,
} from "./ui.jsx";
import RoutinePlayer from "./RoutinePlayer.jsx";

// Écran Douleurs — RawCare, chantier onboarding (06/08/2026) : généralisé aux N zones
// choisies par l'utilisateur (`data.painZones`, construites à l'onboarding depuis les 3
// options guidées de onboarding.js — Genou/Coude/Autre), au lieu des deux zones fixes
// genou/coude d'apps/perso. `data.painLogs` remplace `kneeLog`/`elbowLog` : une map
// `{ [zoneKey]: [...entrées] }`, une entrée par zone présente dans `data.painZones`.
// Table HSR + routines guidées restent réservées à la zone dont le `gateTag` couvre "genou"
// (portées par `zone.hsr`/`zone.routines`, copiées depuis le preset à l'onboarding) — même
// convention qu'apps/perso, ce sont des outils propres au tendon quadricipital.
// Ajout/suppression d'une zone : géré depuis Onboarding.jsx (bouton « Réglages »), pas ici —
// cet écran ne fait que lire/écrire le journal des zones déjà choisies.
//
// `gateTag` (Lot E, 06/08/2026) : chaîne (Genou/Coude, presets figés) OU tableau (zone
// "Autre" avec gate choisi librement — voir Onboarding.jsx) — `hasGate` gère les deux formes.

const hasGate = (zone, tag) => zone.gateTag === tag || (Array.isArray(zone.gateTag) && zone.gateTag.includes(tag));

const alertTextFor = (zone) => {
  if (hasGate(zone, "genou")) return "Décharge : pas de basket ni de séance jambes tant que la douleur n'est pas revenue à sa base.";
  if (hasGate(zone, "tirage")) return "Décharge du tirage : pas d'escalade ni de haut du corps tant que la douleur n'est pas revenue à sa base.";
  return "Signal à surveiller — ajuste ton activité selon ta sensation.";
};
const subFor = (zone) => {
  if (hasGate(zone, "genou")) return "protocole HSR · règle de Silbernagel";
  if (hasGate(zone, "tirage")) return "règle de Silbernagel";
  return "suivi seul, sans effet sur les suggestions";
};

export default function PainTab({ data, update, error: loadError }) {
  const zones = data?.painZones || [];
  const painLogs = data?.painLogs || {};
  const hsrWeek = data?.hsrWeek ?? 1;
  const [zoneKey, setZoneKey] = useState(zones[0]?.key ?? null);
  const zone = zones.find((z) => z.key === zoneKey) || null;
  const log = zone ? painLogs[zone.key] || [] : [];

  const [date, setDate] = useState(today());
  const [pain, setPain] = useState(null);
  const [baseline, setBaseline] = useState(true);
  const [routine, setRoutine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const pick = (zk, d) => {
    setZoneKey(zk); setDate(d);
    const zLog = painLogs[zk] || [];
    const e = zLog.find((x) => x.date === d);
    setPain(e ? e.pain : null);
    setBaseline(e ? e.baseline !== false : true);
    if (zk !== zoneKey) setRoutine(null);
    setSaveError("");
  };
  const pickDate = (d) => pick(zoneKey, d);

  const persist = async (next) => {
    setSaving(true);
    setSaveError("");
    try {
      await update({ painLogs: { ...painLogs, [zoneKey]: next } });
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };
  const add = () => { if (pain == null || !zoneKey) return; persist(upsert(log, { date, pain, baseline })); };
  const remove = () => persist(log.filter((k) => k.date !== date));

  if (zones.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ScreenHeader title="Douleurs" subtitle="aucune zone suivie" />
        <Empty>Aucune zone de douleur activée — ajoutes-en une depuis « Réglages » si tu veux en suivre une.</Empty>
      </div>
    );
  }

  const kLast = lastN(log, 1)[0];
  const kLastAge = kLast ? daysBetween(kLast.date, today()) : null;
  const alert = kLast && (kLast.baseline === false || kLast.pain >= 6);
  const alertStale = alert && kLastAge > 3;
  const chartData = lastN(log, 30).map((k) => ({ date: fmt(k.date), pain: k.pain, flag: k.baseline === false }));
  const curRow = hsrForWeek(hsrWeek);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={zone.label} subtitle={subFor(zone)} />

      {zones.length > 1 && (
        <Pills options={zones.map((z) => ({ key: z.key, label: z.label }))} value={zoneKey} onChange={(k) => pick(k, date)} />
      )}

      <Card>
        <Label style={{ marginBottom: 8 }}>Douleur · 30 jours</Label>
        {chartData.length ? (
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={C.divider} vertical={false} />
                <XAxis dataKey="date" tick={chartAxis} interval="preserveEnd" />
                <YAxis domain={[0, 10]} tick={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} itemStyle={tooltipItemStyle} />
                <ReferenceLine y={5} stroke={C.accent} strokeDasharray="2 3" strokeWidth={1} />
                <Line type="monotone" dataKey="pain" stroke={C.danger} strokeWidth={2.5}
                  dot={(p) => {
                    const { cx, cy, payload, index } = p;
                    return payload.flag
                      ? <circle key={index} cx={cx} cy={cy} r={5} fill={C.danger} stroke={C.text} strokeWidth={2} />
                      : <circle key={index} cx={cx} cy={cy} r={3} fill={C.text} />;
                  }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>Aucun relevé.</Empty>}
        <Body style={{ fontSize: 11, marginTop: 6 }}>Point cerclé = douleur non revenue à la base sous 24 h (surcharge).</Body>
      </Card>

      {alert && (
        <Card danger style={{ padding: "13px 14px" }}>
          <div style={{ fontSize: 12, color: C.danger, fontWeight: 800, marginBottom: 3, textTransform: "uppercase" }}>
            ⚠ Signal de surcharge{alertStale ? ` · relevé il y a ${kLastAge} j` : ""}
          </div>
          <Body style={{ color: C.dangerText }}>
            {alertStale
              ? "Ce signal date : note ta douleur du jour pour savoir où tu en es vraiment."
              : alertTextFor(zone)}
          </Body>
        </Card>
      )}

      <Card>
        <div style={{ marginBottom: 10 }}><DateField value={date} onChange={pickDate} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <Label>Douleur (0-10)</Label>
          {pain == null && <span style={{ fontSize: 10, color: C.dim }}>choisis un chiffre pour enregistrer</span>}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
            const on = pain === n;
            const col = n >= 6 ? C.danger : n >= 4 ? "#e8a33d" : C.accent;
            return (
              <button key={n} onClick={() => setPain(n)} style={{
                width: 30, height: 32, borderRadius: 6, fontFamily: C.mono, fontSize: 13, fontWeight: 800, cursor: "pointer",
                background: on ? col : C.card, color: on ? "#000" : C.muted,
                border: `1.5px solid ${on ? col : C.border}`,
              }}>{n}</button>
            );
          })}
        </div>
        <Label style={{ marginBottom: 6 }}>Retour à la base sous 24 h ?</Label>
        <Pills options={[{ key: true, label: "Oui" }, { key: false, label: "Non" }]} value={baseline} onChange={setBaseline} small />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn variant="primary" onClick={add} disabled={pain == null || saving} style={{ flex: 1 }}>
            <Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer
          </Btn>
          {log.some((k) => k.date === date) && (
            <Btn variant="danger" onClick={remove} disabled={saving}><Trash2 size={14} /></Btn>
          )}
        </div>
        {(saveError || loadError) && <p style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>{saveError || loadError}</p>}
      </Card>

      {zone.hsr && (
      <Card style={{ padding: "10px 14px" }}>
        <Label style={{ padding: "4px 0" }}>Table HSR · presse &amp; leg ext</Label>
        {HSR_TABLE.map((row) => {
          const cur = row.wk === curRow.wk;
          return (
            <div key={row.wk} style={{
              display: "flex", justifyContent: "space-between", padding: "7px 0",
              borderTop: `1px solid ${C.divider}`, fontSize: 12,
              background: cur ? C.accentRow : "transparent", fontWeight: cur ? 800 : 400,
            }}>
              <span style={{ color: cur ? C.accent : C.muted }}>Sem {row.wk}{cur ? " (en cours)" : ""}</span>
              <span style={{ color: cur ? C.accent : C.muted, fontFamily: C.mono }}>{row.scheme}</span>
            </div>
          );
        })}
      </Card>
      )}

      {zone.routines && (routine ? (
        <RoutinePlayer routine={ROUTINES[routine]} onClose={() => setRoutine(null)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(ROUTINES).map(([key, r]) => (
            <div key={key} onClick={() => setRoutine(key)} style={{
              background: C.card, border: `1.5px solid ${C.accent}`, borderRadius: 10,
              padding: "13px 14px", textAlign: "center", cursor: "pointer",
            }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, textTransform: "uppercase" }}>
                <Play size={12} style={{ display: "inline", marginRight: 5 }} />{r.title}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
