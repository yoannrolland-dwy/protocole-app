import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { recommendSessions } from "@rawcare/core/recommender";
import { buildZones } from "@rawcare/core/pain";
import { SCHEMES } from "@rawcare/core/climbing";
import { mergeTargets } from "./defaultTargets.js";
import { today } from "@rawcare/core/dateUtils";
import { C, Card, Label, Body } from "./ui.jsx";
import { familyOf } from "./onboarding.js";
import CoachIA from "./CoachIA.jsx";

// Écran d'accueil — RawCare Phase 2. Depuis le chantier onboarding (06/08/2026) : carte
// "Prochaine séance" (port du bloc apps/perso Dashboard, App.jsx:400-425), alimentée par
// `recommendSessions` avec les zones/sports choisis à l'onboarding. Depuis le chantier Coach
// IA public (06/08/2026) : carte CoachIA juste en dessous, même emplacement qu'apps/perso
// (Dashboard, pas un onglet séparé). Pas de grille de tuiles complète (poids/pas/eau...) —
// hors scope, jalon Dashboard séparé si voulu plus tard.
// La carte "Note de test (round-trip user_data)" (preuve de trajet Supabase des tout
// premiers jalons) a été retirée le 06/08/2026 : un reste de debug resté visible pour de
// vrais bêta-testeurs, jamais censé rester après les premiers jalons.
export default function Home({ session, data, update, error: loadError }) {
  const training = data?.trainingLog || [];
  const sleep = data?.sleepLog || [];
  const targets = mergeTargets(data?.targets);
  const activeSports = data?.activeSports || [];
  const scheme = SCHEMES[data?.climbScheme] || SCHEMES.gym;

  const { suggestions, avoid } = useMemo(() => {
    const zones = buildZones(data?.painZones || [], data?.painLogs || {}, today());
    const r = recommendSessions({ training, zones, sleep, targets, scheme });
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
