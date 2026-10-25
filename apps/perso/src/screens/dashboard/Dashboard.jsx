// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) : code déplacé tel quel.
import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Play } from "lucide-react";
import { getSync } from "../../store.js";
import { isBackupStale, daysSinceBackup } from "../../cloudBackup.js";
import { TEMPLATES } from "@rawcare/core/session/templates";
import { computeEnergyScore } from "@rawcare/core/energy";
import { computeFreeInsights } from "@rawcare/core/insights";
import { PHASES, targetsForDate, kcalFromMacros, kcalOfEntry, tdeeNow, weightTrend7 } from "@rawcare/core/targets";
import { nextSessions } from "@rawcare/core/nextSession";
import { C, today, fmt, round, lastN, fmtHM, Card, Label, Body, Btn } from "../../ui.jsx";
import { phaseTarget, recompTrendColor, STEPS_TARGET } from "../../lib/helpers.js";
import { KneeQuickLog } from "./KneeQuickLog.jsx";
import { WhyNot } from "./WhyNot.jsx";
import { InsightsCard } from "./InsightsCard.jsx";
import { PalierCard } from "./PalierCard.jsx";
import { CoachIA } from "./CoachIA.jsx";

export function Dashboard({ weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, coach, todayNote, saveNote, saveJournal, setTab, lastCloudBackup, openSettings, basketSchedule, planFor, palier, onApplyPalier, saveKnee, onStart }) {
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(weight, 1)[0];
  const wDelta = wLast && tgtW != null ? round(wLast.kg - tgtW) : null;
  // Recomposition (chantier R) : pas de poids cible, la tuile montre la moyenne 7 j et son
  // delta hebdo à la place (même calcul que l'onglet Poids et le Coach IA).
  const wTrend = tgtW == null ? weightTrend7(weight, today()) : null;

  const lastNightDash = lastN(sleep, 1)[0];
  const energy = useMemo(() => computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }), [rhr, sleep, steps, naps]);

  const mToday = macros.find((m) => m.date === today());
  const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;

  // Recommandeur temporel (chantier S, S2, 04/10/2026) : « Aujourd'hui » (ce qui reste faisable à
  // cette heure) + « Demain » (prévision), via `nextSessions` (packages/core/src/nextSession.js).
  // `clock` force un recalcul toutes les 5 min : l'heure change même sans nouvelle donnée
  // (un créneau se ferme à 12h/14h). Le retour au premier plan re-rend déjà le Dashboard.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 5 * 60 * 1000); return () => clearInterval(id); }, []);
  const next = useMemo(() => nextSessions({
    now: new Date(clock),
    base: { training, knee, sleep, targets, basketSchedule, energy },
    planFor,
  }), [training, knee, sleep, targets, basketSchedule, energy, clock]);
  const { suggestions, avoid } = next.today;

  const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
  const waterTgt = targets.water + (basketToday ? 1000 : 0);
  const kcalTgt = (() => { const a = targetsForDate(today(), targets); return Math.round(kcalFromMacros(a.protein, a.carbs, a.fat, a.fiber)); })();

  // Constats gratuits (07/09/2026, point 1 du chantier IA) : réutilise le même calcul TDEE
  // que la carte Macros (lecture fraîche de foodLog/overrides via getSync, jamais mise en
  // cache) pour ne jamais afficher un chiffre différent de celui de l'onglet Macro.
  const tdeeForInsights = useMemo(
    () => tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets }),
    [macros, weight, targets]
  );
  const insights = useMemo(
    () => computeFreeInsights({ training, weight, macros, sleep, rhr, steps, knee, targets, tdeeResult: tdeeForInsights, kcalTargetToday: kcalTgt, todayDate: today() }),
    [training, weight, macros, sleep, rhr, steps, knee, targets, tdeeForInsights, kcalTgt]
  );

  // 3 paires, toutes cliquables vers l'onglet correspondant.
  const tiles = [
    { label: "Poids", tab: "weight", val: wLast ? wLast.kg : "—", unit: "kg",
      note: tgtW != null ? `cible ${tgtW}` : `moy. 7 j ${wTrend?.avg7 ?? "—"}`, color: C.text,
      extra: wDelta != null ? { txt: `${wDelta > 0 ? "▲" : "▼"}${Math.abs(wDelta)}`, col: wDelta > 0 ? C.danger : C.accent }
        // Recomposition (05/10/2026) : ±0,3 kg/sem = attendu (citron), au-delà dans un sens ou
        // l'autre = ambre (perte trop rapide → muscle à risque ; prise nette → gras/eau), jamais
        // rouge — mêmes seuils que le moteur Palier (R3). La logique sèche (prise = rouge) ne
        // s'applique qu'avec un poids cible.
        : wTrend?.deltaWeek != null ? { txt: `${wTrend.deltaWeek > 0 ? "▲" : "▼"}${Math.abs(wTrend.deltaWeek)}/sem`, col: recompTrendColor(wTrend.deltaWeek) }
        : null },
    { label: "Pas", tab: "steps", val: stepsToday.toLocaleString("fr-FR"), unit: "",
      note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}`, color: C.text,
      bar: Math.min(100, (stepsToday / STEPS_TARGET) * 100) },
    { label: "Calories", tab: "macro", val: kcalToday ?? "—", unit: "",
      note: `/ ${kcalTgt} kcal`, color: C.text,
      bar: kcalToday != null ? Math.min(100, (kcalToday / kcalTgt) * 100) : null },
    { label: "Eau", tab: "macro", val: (waterToday / 1000).toFixed(2), unit: "L",
      note: `/ ${(waterTgt / 1000).toFixed(1)} L${basketToday ? " · basket" : ""}`, color: C.text,
      bar: Math.min(100, (waterToday / waterTgt) * 100) },
    { label: "Sommeil", tab: "sleep", val: lastNightDash ? fmtHM(lastNightDash.hours) : "—", unit: "",
      note: lastNightDash ? `${fmt(lastNightDash.date)}${lastNightDash.quality != null ? " · " + "★".repeat(lastNightDash.quality) : ""}` : "—",
      color: C.text },
    // Remplace la tuile "Douleurs" (05/09/2026, demande explicite de Yoann — le coude est
    // retiré, le genou reste suivi mais n'a plus besoin de sa propre tuile ici). Score
    // d'énergie façon Samsung Health, reconstruit depuis FC repos/sommeil/pas — "pas assez
    // de données" tant que la FC repos n'a jamais été synchronisée (natif uniquement).
    { label: "Score d'énergie", tab: "sleep", val: energy.status === "ok" ? energy.total : "—", unit: energy.status === "ok" ? "/100" : "",
      note: energy.status === "ok" ? "aujourd'hui" : "pas assez de données", color: C.text,
      bar: energy.status === "ok" ? energy.total : null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Sauvegarde externe périmée : le rappel doit être là où l'app s'ouvre, pas seulement
          enterré dans les Réglages — c'est lui qui fait que la sauvegarde a lieu. */}
      {isBackupStale(lastCloudBackup) && (
        <Card danger onClick={openSettings} style={{ padding: "11px 13px", cursor: "pointer" }}>
          <div style={{ fontSize: 11, color: C.danger, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ⚠ Sauvegarde hors du téléphone
          </div>
          <Body style={{ color: C.dangerText, fontSize: 11, marginTop: 3 }}>
            {lastCloudBackup
              ? `Dernière il y a ${daysSinceBackup(lastCloudBackup)} jours (${fmt(lastCloudBackup)}).`
              : "Jamais faite."} Toucher ici pour sauvegarder (Réglages).
          </Body>
        </Card>
      )}

      {/* Tuiles : poids/pas · calories/eau · sommeil/douleurs — toutes cliquables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.label} onClick={() => setTab(t.tab)} style={{
            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: 11, cursor: "pointer",
          }}>
            <Label>{t.label}</Label>
            {t.pair ? (
              <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                {t.pair.map((p) => (
                  <div key={p.k} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: p.col }}>
                      {p.val}<span style={{ fontSize: 11, color: C.muted }}>/10</span>
                    </div>
                    <div style={{ fontSize: 8.5, color: C.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.k}</div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 800, color: t.color }}>
                {t.val}<span style={{ fontSize: 11, color: C.muted }}>{t.unit}</span>
              </span>
              {t.extra && (
                <span style={{ fontSize: 11, color: t.extra.col, fontWeight: 700, marginLeft: "auto" }}>{t.extra.txt}</span>
              )}
            </div>
            )}
            <div style={{ fontSize: 8.5, color: C.dim, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.note}</div>
            {t.bar != null && (
              <div style={{ background: C.bg, borderRadius: 6, height: 4, overflow: "hidden", marginTop: 5 }}>
                <div style={{ background: C.accent, width: `${t.bar}%`, height: "100%" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prochaine séance */}
      <Card accentLeft onClick={() => setTab("train")} style={{ padding: "13px 14px", cursor: "pointer" }}>
        <Label style={{ letterSpacing: 1.5, marginBottom: 5 }}>Prochaine séance</Label>
        {!knee.some((k) => k.date === today()) && <KneeQuickLog knee={knee} saveKnee={saveKnee} />}
        <Label style={{ fontSize: 9, color: C.accent, marginBottom: 4 }}>Aujourd'hui</Label>
        {next.today.status === "closed" ? (
          <Body style={{ fontSize: 11.5, color: C.text2 }}>{next.today.note}</Body>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
              <div style={{ fontSize: 16, color: C.text, fontWeight: 800 }}>{suggestions[0]?.type}</div>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>{suggestions[0]?.score}</div>
            </div>
            <Body>{suggestions[0]?.reason}</Body>
            {/* T3 : ouvrir directement le carnet du type proposé (pas de bouton pour Repos,
                qui n'est pas un gabarit, ni quand la journée est fermée — branche ci-dessus). */}
            {suggestions[0] && TEMPLATES[suggestions[0].type] && (
              <Btn variant="primary" onClick={(e) => { e.stopPropagation(); onStart(suggestions[0].type); }} style={{ marginTop: 8, padding: "7px 12px", fontSize: 11 }}>
                <Play size={12} style={{ display: "inline", marginRight: 5 }} />Démarrer {suggestions[0].type}
              </Btn>
            )}
          </>
        )}
        {suggestions.slice(1).map((r) => (
          <div key={r.type} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: 12, color: C.text2, fontWeight: 700 }}>{r.type}</div>
              <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.dim }}>{r.score}</div>
            </div>
            <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.4, marginTop: 1 }}>{r.reason}</div>
          </div>
        ))}
        {avoid.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
            <Label style={{ color: C.danger, marginBottom: 6 }}>À éviter aujourd'hui</Label>
            {avoid.map((a) => (
              <div key={a.type} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 5 }}>
                <AlertTriangle size={12} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 11.5, color: C.dangerText, fontWeight: 700 }}>{a.type}</span>
                  <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.4 }}>{a.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <WhyNot items={(next.today.notProposed || []).filter((x) => x.kind !== "avoid" && x.kind !== "closed")} />
        {/* Demain (S2) : toujours affiché — prévision, sous réserve du genou et de la nuit. */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <Label style={{ fontSize: 9, color: C.accent, marginBottom: 4 }}>
            Demain · {new Date(next.tomorrow.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "numeric" })}
          </Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 800 }}>{next.tomorrow.suggestions[0]?.type ?? "—"}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.dim }}>{next.tomorrow.suggestions[0]?.score}</div>
          </div>
          {next.tomorrow.suggestions[0] && <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.4 }}>{next.tomorrow.suggestions[0].reason}</div>}
          {/* Alternatives de demain (05/10/2026) : `nextSessions` en calcule 3 et « Pourquoi pas
              les autres ? » les considère affichées — sans cette ligne, la 2e et la 3e (ex.
              l'escalade) n'apparaissaient nulle part. */}
          {next.tomorrow.suggestions.length > 1 && (
            <div style={{ fontSize: 10.5, color: C.text2, lineHeight: 1.5, marginTop: 4 }}>
              Alternatives : {next.tomorrow.suggestions.slice(1).map((s) => `${s.type} (${s.score})`).join(" · ")}
            </div>
          )}
          {next.tomorrow.avoid.length > 0 && (
            <div style={{ fontSize: 10.5, color: C.dangerText, lineHeight: 1.4, marginTop: 4 }}>
              À éviter : {next.tomorrow.avoid.map((a) => a.type).join(", ")}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: "italic" }}>{next.tomorrow.caveat}</div>
          <WhyNot items={next.tomorrow.notProposed} />
        </div>
      </Card>

      {/* Constats gratuits */}
      <InsightsCard insights={insights} />

      {/* Palier de la semaine (R3) — recomposition seulement */}
      {PHASES[phase]?.noTarget && <PalierCard palier={palier} targets={targets} onApply={onApplyPalier} />}

      {/* Coach IA */}
      <CoachIA coach={coach} todayNote={todayNote} saveNote={saveNote} saveJournal={saveJournal} />

      <Body style={{ fontSize: 10, color: C.dim, textAlign: "center", padding: "0 8px" }}>
        Outil de suivi personnel, pas un avis médical. Douleur aiguë ou persistante → kiné.
      </Body>
    </div>
  );
}
