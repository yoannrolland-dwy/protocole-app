// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { HSR_TABLE, hsrForWeek } from "@rawcare/core/session/templates";
import { C, today, fmt, upsert, lastN, daysBetween, Card, Label, Body, Empty, Btn, DateField, Pills, ScreenHeader, chartAxis, tooltipStyle, tooltipItemStyle } from "../ui.jsx";

/* ============================================================
   TAB — DOULEURS (genou — le coude a été retiré le 05/09/2026)
   ============================================================ */
// Une zone = un journal (clé localStorage distincte, même forme `{date, pain, baseline}`)
// et son habillage. Ajouter une 3e zone un jour ne coûte qu'une entrée ici + une clé dans
// `DATA_KEYS` + une ligne dans `save` — c'est le but de cette table.
//
// Le coude (tendon distal du biceps) a été retiré le 05/09/2026 : plus aucune douleur
// depuis le retour de vacances de Yoann (confirmé par lui). `elbowLog` reste dans
// `DATA_KEYS` (store.js) pour ne pas perdre l'historique déjà exporté, mais plus aucun
// code ne le lit ni ne l'écrit — si le coude redevient un jour un problème, il suffira de
// rajouter une entrée ici.
const PAIN_ZONES = [
  {
    key: "knee", label: "Genou",
    title: "Genou · réhab", sub: "tendon quadricipital · HSR · Silbernagel",
    // Les routines guidées (rééduc/échauffement basket) ont déménagé dans l'onglet Séances
    // le 04/09/2026 (voir CLAUDE.md) — loguées comme de vraies séances ("Mobilité",
    // "Basket") plutôt que jouées ici hors historique.
    hsr: true,
    alertText: "Décharge : pas de basket ni de Lower tant que la douleur n'est pas revenue à sa base. Réduire charge ou amplitude à la prochaine exposition.",
  },
];

export function PainTab({ knee, save, hsrWeek }) {
  // Une seule zone désormais (genou) : plus de sélecteur de zone, `zone`/`log` sont fixes.
  const zone = PAIN_ZONES[0];
  const log = knee;

  const [date, setDate] = useState(today());
  // Aucune valeur par défaut (ni 4 ni 5) : rien n'est présélectionné à l'ouverture, et
  // l'enregistrement reste bloqué tant qu'un chiffre n'a pas été touché. Demandé
  // explicitement pour forcer une vraie évaluation de la sensation plutôt qu'un
  // enregistrement réflexe — une entrée « par défaut » fausserait l'historique et la
  // règle de Silbernagel.
  // ...mais si le jour affiché a DÉJÀ une entrée, on la recharge (exigence explicite) :
  // sinon l'écran afficherait « rien de noté » alors que la donnée existe, et on risquerait
  // de croire la journée non renseignée. Les onglets ne sont montés qu'une fois le
  // localStorage lu (voir le garde `loading` du composant App), donc les journaux sont
  // déjà peuplés ici, et rouvrir l'onglet relance cette initialisation.
  const existingToday = (knee || []).find((k) => k.date === today());
  const [pain, setPain] = useState(existingToday ? existingToday.pain : null);
  const [baseline, setBaseline] = useState(existingToday ? existingToday.baseline !== false : true);
  // Changer de date recharge l'entrée existante, ou remet à vide si le jour visé n'a rien —
  // sans ce reset, la douleur d'une autre date resterait affichée et pourrait être
  // enregistrée par erreur.
  const pickDate = (d) => {
    setDate(d);
    const e = (log || []).find((x) => x.date === d);
    setPain(e ? e.pain : null);
    setBaseline(e ? e.baseline !== false : true);
  };
  const add = () => { if (pain == null) return; save.knee(upsert(log, { date, pain, baseline })); };

  const kLast = lastN(log, 1)[0];
  // Même logique de péremption que le recommandeur : une alerte vieille de dix jours
  // n'est plus un signal, c'est une donnée périmée — on affiche son âge pour le dire.
  const kLastAge = kLast ? daysBetween(kLast.date, today()) : null;
  const alert = kLast && (kLast.baseline === false || kLast.pain >= 6);
  const alertStale = alert && kLastAge > 3;
  const data = lastN(log, 30).map((k) => ({ date: fmt(k.date), pain: k.pain, flag: k.baseline === false }));
  const curRow = hsrForWeek(hsrWeek);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title={zone.title} subtitle={zone.sub} />

      <Card>
        <Label style={{ marginBottom: 8 }}>Douleur · 30 jours</Label>
        {data.length ? (
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
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
              : zone.alertText}
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
          <Btn variant="primary" onClick={add} disabled={pain == null} style={{ flex: 1 }}><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Enregistrer</Btn>
          {log.some((k) => k.date === date) && (
            <Btn variant="danger" onClick={() => save.knee(log.filter((k) => k.date !== date))}><Trash2 size={14} /></Btn>
          )}
        </div>
      </Card>

      {/* Table HSR — genou uniquement */}
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

    </div>
  );
}
