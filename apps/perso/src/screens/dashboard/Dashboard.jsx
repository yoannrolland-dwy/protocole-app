// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; refait en design system v2 à
// l'étape 4 d'U3 (25/10/2026) : Énergie et Poids en tête (ordre gardé, choix de Yoann),
// puis Calories · Pas · Eau, Prochaine séance, Constats repliés, Palier seulement s'il y a une
// proposition. Le Coach IA a déménagé dans l'onglet Analyse.
import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Play, ChevronRight } from "lucide-react";
import { getSync } from "../../store.js";
import { isBackupStale, daysSinceBackup } from "../../cloudBackup.js";
import { TEMPLATES } from "@rawcare/core/session/templates";
import { computeEnergyScore, scoreLabel } from "@rawcare/core/energy";
import { computeFreeInsights } from "@rawcare/core/insights";
import { PHASES, targetsForDate, kcalFromMacros, kcalOfEntry, tdeeNow, weightTrend7 } from "@rawcare/core/targets";
import { nextSessions } from "@rawcare/core/nextSession";
import { today, fmt, round, lastN, fmtHM } from "../../ui.jsx";
import { T } from "../../design/tokens.js";
import { Panel, Eyebrow, Button } from "../../design/primitives.jsx";
import { phaseTarget, recompTrendColor, scoreColor, STEPS_TARGET } from "../../lib/helpers.js";
import { KneeQuickLog } from "./KneeQuickLog.jsx";
import { WhyNot } from "./WhyNot.jsx";
import { InsightsCard } from "./InsightsCard.jsx";
import { PalierCard } from "./PalierCard.jsx";

const mono = { fontFamily: T.f.num, fontVariantNumeric: "tabular-nums" };

function Bar({ pct }) {
  return (
    <div style={{ background: T.c.raised, borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{ background: T.c.accent, width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 99 }} />
    </div>
  );
}

// Tuile cliquable vers l'écran de détail. `big` : les deux tuiles de tête (Énergie, Poids).
function Tile({ label, value, unit, note, extra, bar, onClick, big = false, valueColor = T.c.text }) {
  return (
    <button type="button" className="p-tap p-card" onClick={onClick} style={{
      display: "grid", gap: 4, alignContent: "start", minWidth: 0, textAlign: "left",
      padding: big ? 14 : 12, color: T.c.text, fontFamily: T.f.body,
    }}>
      <span className="p-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: big ? 34 : 22, fontWeight: 700, lineHeight: 1.05, color: valueColor }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: T.c.text2, fontWeight: 600 }}>{unit}</span>}
      </span>
      {extra && <span style={{ fontSize: 14, fontWeight: 700, color: extra.col }}>{extra.txt}</span>}
      {note && <span style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.3 }}>{note}</span>}
      {bar != null && <Bar pct={bar} />}
    </button>
  );
}

export function Dashboard({ weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, setTab, lastCloudBackup, openSettings, basketSchedule, planFor, palier, onApplyPalier, saveKnee, onStart }) {
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

  // Poids : delta à la cible (sèche/prise) ou tendance hebdo (recomposition).
  // Recomposition (05/10/2026) : ±0,3 kg/sem = attendu (citron), au-delà dans un sens ou
  // l'autre = ambre (perte trop rapide → muscle à risque ; prise nette → gras/eau), jamais
  // rouge — mêmes seuils que le moteur Palier (R3). La logique sèche (prise = rouge) ne
  // s'applique qu'avec un poids cible.
  const wExtra = wDelta != null ? { txt: `${wDelta > 0 ? "▲" : "▼"} ${Math.abs(wDelta)} kg de la cible`, col: wDelta > 0 ? T.c.danger : T.c.accent }
    : wTrend?.deltaWeek != null ? { txt: `${wTrend.deltaWeek > 0 ? "▲" : "▼"} ${Math.abs(wTrend.deltaWeek)} kg/sem`, col: recompTrendColor(wTrend.deltaWeek) }
    : null;
  const nightNote = lastNightDash
    ? `nuit ${fmtHM(lastNightDash.hours)}${lastNightDash.quality != null ? " · " + "★".repeat(lastNightDash.quality) : ""}${lastNightDash.date !== today() ? ` (${fmt(lastNightDash.date)})` : ""}`
    : "nuit non synchronisée";
  const top = suggestions[0];

  return (
    <div style={{ display: "grid", gap: 12, fontFamily: T.f.body, color: T.c.text }}>
      {/* Sauvegarde externe périmée : le rappel doit être là où l'app s'ouvre, pas seulement
          enterré dans les Réglages — c'est lui qui fait que la sauvegarde a lieu. */}
      {isBackupStale(lastCloudBackup) && (
        <button type="button" className="p-tap p-card p-card--danger" onClick={openSettings} style={{
          display: "grid", gap: 4, textAlign: "left", fontFamily: "inherit", color: T.c.text,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.c.danger }}>
            <AlertTriangle size={18} aria-hidden="true" />Sauvegarde hors du téléphone
          </span>
          <span style={{ fontSize: 13, color: T.c.text2 }}>
            {lastCloudBackup ? `Dernière il y a ${daysSinceBackup(lastCloudBackup)} jours (${fmt(lastCloudBackup)}).` : "Jamais faite."} Toucher ici pour sauvegarder.
          </span>
        </button>
      )}

      {/* Énergie + Poids : ce que Yoann regarde en premier le matin (moments d'usage U1). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Tile big label="Énergie" onClick={() => setTab("sleep")}
          value={energy.status === "ok" ? energy.total : "—"} unit={energy.status === "ok" ? "/100" : ""}
          // Couleur portée par le libellé, pas par le chiffre, et la MÊME que dans Corps › Énergie
          // (`scoreColor`) — un 59 « Risque » ne doit pas s'afficher en citron.
          extra={energy.status === "ok" ? { txt: scoreLabel(energy.total), col: scoreColor(energy.total) } : null}
          note={energy.status === "ok" ? nightNote : "pas assez de données"} />
        <Tile big label={tgtW != null ? "Poids" : "Poids · moy. 7 j"} onClick={() => setTab("weight")}
          value={tgtW != null ? (wLast ? wLast.kg : "—") : (wTrend?.avg7 ?? "—")} unit="kg"
          extra={wExtra}
          note={tgtW != null ? `cible ${tgtW} kg` : wLast ? `pesée ${wLast.kg} kg${wLast.date !== today() ? ` (${fmt(wLast.date)})` : ""}` : "pas de pesée"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <Tile label="Kcal" onClick={() => setTab("macro")} value={kcalToday ?? "—"} note={`/ ${kcalTgt}`}
          bar={kcalToday != null ? (kcalToday / kcalTgt) * 100 : null} />
        <Tile label="Pas" onClick={() => setTab("steps")} value={stepsToday.toLocaleString("fr-FR")} note={`/ ${STEPS_TARGET.toLocaleString("fr-FR")}`}
          bar={(stepsToday / STEPS_TARGET) * 100} />
        <Tile label="Eau" onClick={() => setTab("macro")} value={(waterToday / 1000).toFixed(2)} unit="L"
          note={`/ ${(waterTgt / 1000).toFixed(1)} L${basketToday ? " · basket" : ""}`} bar={(waterToday / waterTgt) * 100} />
      </div>

      {/* Prochaine séance */}
      <Panel tone="key" aria-label="Prochaine séance">
        <Eyebrow>Prochaine séance</Eyebrow>
        {!knee.some((k) => k.date === today()) && <KneeQuickLog knee={knee} saveKnee={saveKnee} />}

        <div style={{ display: "grid", gap: 6 }}>
          <Eyebrow style={{ color: T.c.accent }}>Aujourd'hui</Eyebrow>
          {next.today.status === "closed" ? (
            <div style={{ fontSize: 15, color: T.c.text2 }}>{next.today.note}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{top?.type}</span>
                <span style={{ ...mono, fontSize: 13, color: T.c.muted }}>score {top?.score}</span>
              </div>
              <div style={{ fontSize: 14, color: T.c.text2, lineHeight: 1.4 }}>{top?.reason}</div>
              {/* T3 : ouvrir directement le carnet du type proposé (pas de bouton pour Repos,
                  qui n'est pas un gabarit, ni quand la journée est fermée — branche ci-dessus). */}
              {top && TEMPLATES[top.type] && (
                <Button variant="primary" block onClick={() => onStart(top.type)} style={{ marginTop: 4 }}>
                  <Play size={18} aria-hidden="true" />Démarrer {top.type}
                </Button>
              )}
            </>
          )}
          {suggestions.slice(1).map((r) => (
            <div key={r.type} style={{ paddingTop: 8, borderTop: `1px solid ${T.c.lineSoft}`, display: "grid", gap: 2 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{r.type}</span>
                <span style={{ ...mono, fontSize: 13, color: T.c.muted }}>{r.score}</span>
              </span>
              <span style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.4 }}>{r.reason}</span>
            </div>
          ))}
          {avoid.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: `1px solid ${T.c.lineSoft}`, display: "grid", gap: 6 }}>
              <Eyebrow style={{ color: T.c.danger }}>À éviter aujourd'hui</Eyebrow>
              {avoid.map((a) => (
                <div key={a.type} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color={T.c.danger} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontSize: 15, color: T.c.danger, fontWeight: 700 }}>{a.type}</div>
                    <div style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.4 }}>{a.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <WhyNot items={(next.today.notProposed || []).filter((x) => x.kind !== "avoid" && x.kind !== "closed")} />
        </div>

        {/* Demain (S2) : toujours affiché — prévision, sous réserve du genou et de la nuit. */}
        <div style={{ paddingTop: 12, borderTop: `1px solid ${T.c.line}`, display: "grid", gap: 6 }}>
          <Eyebrow style={{ color: T.c.accent }}>
            Demain · {new Date(next.tomorrow.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "numeric" })}
          </Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{next.tomorrow.suggestions[0]?.type ?? "—"}</span>
            <span style={{ ...mono, fontSize: 13, color: T.c.muted }}>{next.tomorrow.suggestions[0]?.score}</span>
          </div>
          {next.tomorrow.suggestions[0] && <div style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.4 }}>{next.tomorrow.suggestions[0].reason}</div>}
          {/* Alternatives de demain (05/10/2026) : `nextSessions` en calcule 3 et « Pourquoi pas
              les autres ? » les considère affichées — sans cette ligne, la 2e et la 3e (ex.
              l'escalade) n'apparaissaient nulle part. */}
          {next.tomorrow.suggestions.length > 1 && (
            <div style={{ fontSize: 13, color: T.c.text2, lineHeight: 1.4 }}>
              Alternatives : {next.tomorrow.suggestions.slice(1).map((s) => `${s.type} (${s.score})`).join(" · ")}
            </div>
          )}
          {next.tomorrow.avoid.length > 0 && (
            <div style={{ fontSize: 13, color: T.c.danger, lineHeight: 1.4 }}>
              À éviter : {next.tomorrow.avoid.map((a) => a.type).join(", ")}
            </div>
          )}
          <div className="p-muted" style={{ fontStyle: "italic" }}>{next.tomorrow.caveat}</div>
          <WhyNot items={next.tomorrow.notProposed} />
        </div>
      </Panel>

      {/* Constats gratuits (repliés : Yoann ne les regarde pas le matin, moments d'usage U1) */}
      <InsightsCard insights={insights} />

      {/* Palier de la semaine (R3) — recomposition seulement, et seulement s'il y a une proposition */}
      {PHASES[phase]?.noTarget && palier?.result && <PalierCard palier={palier} targets={targets} onApply={onApplyPalier} />}

      <button type="button" className="p-tap" onClick={() => setTab("perf")} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48,
        background: "none", border: "none", color: T.c.text2, fontSize: 14, fontFamily: "inherit",
      }}>Coach IA et dépense estimée : onglet Analyse <ChevronRight size={16} aria-hidden="true" /></button>

      <div className="p-muted" style={{ textAlign: "center", padding: "0 8px 8px" }}>
        Outil de suivi personnel, pas un avis médical. Douleur aiguë ou persistante → kiné.
      </div>
    </div>
  );
}
