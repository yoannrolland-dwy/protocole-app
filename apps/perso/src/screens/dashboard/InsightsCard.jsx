// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { VOLUME_TARGET } from "@rawcare/core/volume";
import { C, fmt, Card, Label } from "../../ui.jsx";
import { TDEE_RELIABILITY_LABEL } from "../../lib/helpers.js";

/** Carte "Constats" (07/09/2026, point 1 du chantier IA) : aucun appel API, tout est calculé
 * en JS pur à partir de données déjà en mémoire (records V4, TDEE V7, score d'énergie...).
 * Chaque ligne n'apparaît que si le constat correspondant a assez de données ; la carte
 * entière disparaît s'il n'y en a aucune (rien à montrer plutôt qu'une carte vide). */
export function InsightsCard({ insights }) {
  const rows = [];
  if (insights.streaks.training > 0) {
    rows.push({ label: "Streak entraînement", value: `${insights.streaks.training} j`, note: "jours d'affilée entraînés" });
  }
  if (insights.streaks.logging > 0) {
    rows.push({ label: "Streak apports loggés", value: `${insights.streaks.logging} j`, note: "jours d'affilée avec macros loggées" });
  }
  if (insights.records) {
    const r = insights.records;
    rows.push({ label: "Records récents", value: `${r.count}`, note: `sur ${r.sessions} séance${r.sessions > 1 ? "s" : ""} · ${r.windowDays} derniers jours` });
  }
  if (insights.weightTdee) {
    const w = insights.weightTdee;
    rows.push({
      label: "Déficit réel", value: `${w.deficit > 0 ? "+" : ""}${w.deficit} kcal/j`,
      note: `${w.deltaKg > 0 ? "+" : ""}${w.deltaKg} kg sur ${w.days} j · confiance ${TDEE_RELIABILITY_LABEL[w.reliability] ?? w.reliability}`,
    });
  }
  if (insights.cutProjection) {
    const p = insights.cutProjection;
    rows.push({ label: "Projection fin de sèche", value: `${p.projectedKg} kg`, note: `au ${fmt(p.endDate)} (dans ${p.daysLeft} j)` });
  }
  if (insights.neglected) {
    const n = insights.neglected;
    rows.push({ label: "Type délaissé", value: n.type, note: n.daysSince == null ? "jamais loggé" : `pas fait depuis ${n.daysSince} j` });
  }
  // Plateaux en cours + volume prioritaire sous la zone (05/10/2026) — voir insights.js.
  if (insights.plateaus) {
    const p = insights.plateaus;
    rows.push({ label: "Plateaux en cours", value: `${p.length}`, note: p.map((x) => `${x.nom} (${x.sessions} séances)`).join(" · ") });
  }
  if (insights.volumeShortfall) {
    const v = insights.volumeShortfall;
    rows.push({ label: "Volume sous la zone", value: v.map((g) => `${g.label} ${g.series}/${VOLUME_TARGET.min}`).join(" · "), note: "séries cochées sur 7 j · groupes prioritaires" });
  }
  if (insights.cutAdherence) {
    const a = insights.cutAdherence;
    rows.push({ label: "Régularité de la sèche", value: `${a.pct}%`, note: `des jours dans la cible (${a.loggedDays} jours loggés)` });
  }
  if (insights.sleepEnergy) {
    const s = insights.sleepEnergy;
    // Reformulé le 05/10/2026 (demande de Yoann : titre parlant + phrase + lecture).
    const gap = s.goodAvg - s.poorAvg;
    const lecture = gap >= 15 ? "Grand écart : ton sommeil pilote ton énergie, c'est le levier à protéger."
      : gap >= 8 ? "Écart modéré : une mauvaise nuit se paie, sans être dramatique."
      : gap >= 0 ? "Petit écart : tu encaisses bien une nuit moyenne."
      : "Écart inversé : d'autres facteurs dominent (charge de la veille, FC repos).";
    rows.push({ label: "Effet du sommeil sur l'énergie", value: `${s.goodAvg} vs ${s.poorAvg}`,
      note: `Après une excellente nuit, ton score d'énergie du matin est à ${s.goodAvg} en moyenne, contre ${s.poorAvg} après une mauvaise nuit (${s.goodN} et ${s.poorN} nuits comparées, 60 derniers jours). ${lecture}` });
  }

  if (!rows.length) return null;

  return (
    <Card style={{ padding: 16 }}>
      <Label style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>Constats</Label>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${C.divider}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.text2 }}>{r.label}</div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 1 }}>{r.note}</div>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.text, flexShrink: 0, marginLeft: 8, textAlign: "right" }}>{r.value}</div>
        </div>
      ))}
    </Card>
  );
}
