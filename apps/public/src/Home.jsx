import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { recommendSessions } from "@rawcare/core/recommender";
import { buildZones } from "@rawcare/core/pain";
import { SCHEMES } from "@rawcare/core/climbing";
import { kcalFromMacros, kcalOfEntry } from "@rawcare/core/targets";
import { mergeTargets, phaseTarget, targetsForDate } from "./defaultTargets.js";
import { today, fmt, fmtHM, lastN, round } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body } from "./ui.jsx";
import { familyOf, FAMILY_TYPES, CATALOG_SPORT_TYPES } from "./onboarding.js";
import CoachIA from "./CoachIA.jsx";

// Écran d'accueil — RawCare Phase 2. Depuis le chantier onboarding (06/08/2026) : carte
// "Prochaine séance" (port du bloc apps/perso Dashboard, App.jsx:400-425), alimentée par
// `recommendSessions` avec les zones/sports choisis à l'onboarding. Depuis le chantier Coach
// IA public (06/08/2026) : carte CoachIA juste en dessous, même emplacement qu'apps/perso
// (Dashboard, pas un onglet séparé).
// Depuis le chantier "parité apps/public" (Lot B, 06/08/2026) : grille de tuiles
// Poids/Pas/Calories/Eau/Sommeil/Douleurs, port du tableau `tiles` d'apps/perso
// (App.jsx:296-398). Seule vraie différence : la tuile Douleurs est générique sur
// `data.painZones` (0 à N zones choisies à l'onboarding/Réglages) au lieu des deux zones
// figées Genou/Coude d'apps/perso — absente si 0 zone suivie, un item par zone sinon (le
// rendu `pair` d'apps/perso, en flex, s'adapte déjà à N éléments sans changement).
// La carte "Note de test (round-trip user_data)" (preuve de trajet Supabase des tout
// premiers jalons) a été retirée le 06/08/2026 : un reste de debug resté visible pour de
// vrais bêta-testeurs, jamais censé rester après les premiers jalons.
const STEPS_TARGET = 10000;

export default function Home({ session, data, update, error: loadError, setTab }) {
  const training = data?.trainingLog || [];
  const sleep = data?.sleepLog || [];
  const targets = mergeTargets(data?.targets);
  const activeSports = data?.activeSports || [];
  const scheme = SCHEMES[data?.climbScheme] || SCHEMES.gym;
  const phase = data?.phase || "seche";
  const painZones = data?.painZones || [];
  const painLogs = data?.painLogs || {};

  const t0 = today();
  const tgtW = phaseTarget(phase, targets);
  const wLast = lastN(data?.weightLog || [], 1)[0];
  const wDelta = wLast ? round(wLast.kg - tgtW) : null;

  const stepsToday = (data?.stepsLog || []).find((s) => s.date === t0)?.count ?? 0;
  const lastNight = lastN(sleep, 1)[0];

  const macros = data?.macroLog || [];
  const mToday = macros.find((m) => m.date === t0);
  const at = targetsForDate(t0, targets);
  const kcalTgt = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));
  const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;
  const waterToday = mToday?.water ?? 0;
  const basketToday = training.some((tr) => tr.type === "Basket" && tr.date === t0);
  const waterTgt = targets.water + (basketToday ? 1000 : 0);

  // Une tuile par zone suivie — pas de couple figé genou/coude comme apps/perso, puisque
  // les zones sont dynamiques (0 à N, choisies à l'onboarding/Réglages).
  const painTiles = painZones.map((z) => {
    const e = (painLogs[z.key] || []).find((x) => x.date === t0);
    return {
      k: z.label, val: e ? e.pain : "—",
      col: e && (e.baseline === false || e.pain >= 6) ? C.danger : e ? C.accent : C.muted,
    };
  });

  const tiles = [
    { label: "Poids", tab: "weight", val: wLast ? wLast.kg : "—", unit: "kg",
      note: `cible ${tgtW}`, color: C.text,
      extra: wDelta != null ? { txt: `${wDelta > 0 ? "▲" : "▼"}${Math.abs(wDelta)}`, col: wDelta > 0 ? C.danger : C.accent } : null },
    { label: "Pas", tab: "steps", val: stepsToday.toLocaleString("fr-FR"), unit: "",
      note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}`, color: C.text,
      bar: Math.min(100, (stepsToday / STEPS_TARGET) * 100) },
    { label: "Calories", tab: "macros", val: kcalToday ?? "—", unit: "",
      note: `/ ${kcalTgt} kcal`, color: C.text,
      bar: kcalToday != null ? Math.min(100, (kcalToday / kcalTgt) * 100) : null },
    { label: "Eau", tab: "macros", val: (waterToday / 1000).toFixed(2), unit: "L",
      note: `/ ${(waterTgt / 1000).toFixed(1)} L${basketToday ? " · basket" : ""}`, color: C.text,
      bar: Math.min(100, (waterToday / waterTgt) * 100) },
    { label: "Sommeil", tab: "sleep", val: lastNight ? fmtHM(lastNight.hours) : "—", unit: "",
      note: lastNight ? `${fmt(lastNight.date)}${lastNight.quality != null ? " · " + "★".repeat(lastNight.quality) : ""}` : "—",
      color: C.text },
  ];
  if (painTiles.length > 0) {
    tiles.push({ label: "Douleurs", tab: "pain", note: "aujourd'hui", pair: painTiles });
  }

  const { suggestions, avoid } = useMemo(() => {
    const zones = buildZones(data?.painZones || [], data?.painLogs || {}, today());
    // Lot F : sports du catalogue étendu réellement actifs pour cet utilisateur — absent
    // pour un compte n'ayant coché ni Course à pied, ni Vélo, ni Foot, donc aucun des trois
    // blocs de score dédiés ne s'exécute (voir recommender.js).
    const extraSports = activeSports.flatMap((f) => FAMILY_TYPES[f] || []).filter((t) => CATALOG_SPORT_TYPES.includes(t));
    const r = recommendSessions({ training, zones, sleep, targets, scheme, extraSports });
    // Ne jamais suggérer/écarter un sport non activé — familyOf renvoie null pour "Repos /
    // mobilité" (toujours gardé) et gère les types combinés d'`avoid` ("Upper A / B").
    const keep = (x) => { const f = familyOf(x.type); return !f || activeSports.includes(f); };
    return { suggestions: r.suggestions.filter(keep), avoid: r.avoid.filter(keep) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training, sleep, targets, scheme, activeSports, data?.painZones, data?.painLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <p style={{ color: C.text2, fontSize: 13, margin: 0 }}>Connecté en tant que</p>
        <p style={{ color: C.text, fontSize: 14, margin: "4px 0 0" }}>{session.user.email}</p>
      </Card>

      {/* Tuiles : poids/pas · calories/eau · sommeil/douleurs — toutes cliquables, même
          rendu qu'apps/perso (App.jsx:361-398). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.label} onClick={() => setTab?.(t.tab)} style={{
            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: 11, cursor: "pointer",
          }}>
            <Label>{t.label}</Label>
            {t.pair ? (
              <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
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

      {suggestions.length > 0 && (
        <Card accentLeft style={{ padding: "13px 14px" }}>
          <Label style={{ letterSpacing: 1.5, marginBottom: 5 }}>Prochaine séance</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
            <div style={{ fontSize: 16, color: C.text, fontWeight: 800 }}>{suggestions[0]?.type}</div>
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim }}>{suggestions[0]?.score}</div>
          </div>
          <Body>{suggestions[0]?.reason}</Body>
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
        </Card>
      )}

      <CoachIA data={data} update={update} error={loadError} />

      {loadError && <p style={{ color: C.danger, fontSize: 12 }}>{loadError}</p>}
    </div>
  );
}
