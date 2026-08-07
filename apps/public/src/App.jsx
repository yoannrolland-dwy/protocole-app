import { useState } from "react";
import { Settings } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { useAuth } from "./useAuth.js";
import { useUserData } from "./useUserData.js";
import LoginScreen from "./LoginScreen.jsx";
import Home from "./Home.jsx";
import WeightTab from "./WeightTab.jsx";
import SleepTab from "./SleepTab.jsx";
import StepsTab from "./StepsTab.jsx";
import SessionsTab from "./SessionsTab.jsx";
import PainTab from "./PainTab.jsx";
import MacroTab from "./MacroTab.jsx";
import NutritionTab from "./nutrition/NutritionTab.jsx";
import Onboarding from "./Onboarding.jsx";
import { C } from "./ui.jsx";

// RawCare Phase 2 : orchestration des états d'auth. Pas de router — un simple state `tab`
// suffit tant que la nav tient sur une ligne scrollable ; un vrai router viendra quand le
// nombre d'écrans le justifiera. Ordre des onglets = ordre de construction des écrans de
// données, aligné sur apps/perso (Tableau de bord, Poids, Sommeil, Pas, Séances, Douleurs,
// Macros, Repas) une fois tous livrés.
const TABS = [
  { key: "home", label: "Accueil" },
  { key: "weight", label: "Poids" },
  { key: "sleep", label: "Sommeil" },
  { key: "steps", label: "Pas" },
  { key: "sessions", label: "Séances" },
  { key: "pain", label: "Douleurs" },
  { key: "macros", label: "Macros" },
  { key: "food", label: "Repas" },
];

export default function App() {
  if (!supabase) {
    return (
      <Centered>
        <p style={{ color: C.text2 }}>
          Pas encore configuré — renseigner <code>apps/public/.env.local</code>{" "}
          (voir <code>.env.example</code>).
        </p>
      </Centered>
    );
  }

  const { session, loading } = useAuth();

  if (loading) {
    return <Centered><p style={{ color: C.text2 }}>Chargement…</p></Centered>;
  }
  if (!session) {
    return <LoginScreen />;
  }
  return <Authenticated session={session} />;
}

function Authenticated({ session }) {
  const userId = session.user.id;
  const { data, status, error, update } = useUserData(userId);
  const [tab, setTab] = useState("home");
  // Réglages (07/08/2026) : overlay déclenché par la roue crantée du header, pas un onglet
  // de la barre — même architecture que apps/perso (`showSettings`, séparé de `tab`, pour
  // revenir sur le contenu déjà sélectionné en fermant/en changeant d'onglet). Avant ce
  // changement, "Réglages" était un onglet de `TABS` au même niveau que "Poids"/"Repas" — ce
  // n'est pas un contenu de suivi au même titre, il n'a pas sa place dans cette barre.
  const [showSettings, setShowSettings] = useState(false);
  // Gate de première ouverture : tant que `data.onboarded` n'est pas vrai, l'onboarding
  // remplace tout le reste (même principe que `!session` → LoginScreen). `status ===
  // "loading"` passe avant : `data` est encore `null` au tout premier rendu.
  const needsOnboarding = status !== "loading" && !data?.onboarded;
  const selectTab = (key) => { setTab(key); setShowSettings(false); };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: C.mono }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "24px 24px 0", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            <span style={{ color: C.text2 }}>raw</span><span style={{ color: C.accent }}>CARE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!needsOnboarding && (
              <button onClick={() => setShowSettings((s) => !s)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: showSettings ? C.accent : C.dim, padding: 0, display: "flex",
              }}>
                <Settings size={19} />
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} style={{
              background: "none", border: `1px solid ${C.border}`, color: C.text2,
              borderRadius: 8, padding: "6px 12px", fontFamily: C.mono, fontSize: 12, cursor: "pointer",
            }}>
              Se déconnecter
            </button>
          </div>
        </div>
        {!needsOnboarding && <NavBar tab={tab} setTab={selectTab} />}
      </div>

      <div style={{ width: "100%", maxWidth: 420, padding: "16px 24px 24px", boxSizing: "border-box" }}>
        {status === "loading" ? (
          <p style={{ color: C.text2, fontSize: 13 }}>Chargement…</p>
        ) : needsOnboarding ? (
          <Onboarding data={data} update={update} />
        ) : showSettings ? (
          <Onboarding data={data} update={update} mode="settings" onClose={() => setShowSettings(false)} />
        ) : tab === "home" ? (
          <Home session={session} data={data} update={update} error={error} setTab={selectTab} />
        ) : tab === "weight" ? (
          <WeightTab data={data} update={update} error={error} />
        ) : tab === "sleep" ? (
          <SleepTab data={data} update={update} error={error} />
        ) : tab === "steps" ? (
          <StepsTab data={data} update={update} error={error} />
        ) : tab === "sessions" ? (
          <SessionsTab data={data} update={update} error={error} />
        ) : tab === "pain" ? (
          <PainTab data={data} update={update} error={error} />
        ) : tab === "macros" ? (
          <MacroTab data={data} update={update} error={error} />
        ) : (
          <NutritionTab data={data} update={update} error={error} />
        )}
      </div>

      <div style={{ padding: "0 24px 20px", fontSize: 10.5, color: C.dim }}>
        <a href="/privacypolicy.html" style={{ color: C.dim }}>Confidentialité</a>
        {" · "}
        <a href="/mentionslegales.html" style={{ color: C.dim }}>Mentions légales</a>
      </div>
    </div>
  );
}

function NavBar({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, overflowX: "auto" }}>
      {TABS.map((t) => {
        const active = t.key === tab;
        return (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: "0 0 auto", background: active ? C.accent : "none",
            color: active ? "#050505" : C.text2,
            border: `1px solid ${active ? C.accent : C.border}`,
            borderRadius: 8, padding: "8px 12px", fontFamily: C.mono,
            fontSize: 12, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
      fontFamily: C.mono, textAlign: "center",
    }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        <span style={{ color: C.text2 }}>raw</span><span style={{ color: C.accent }}>CARE</span>
      </div>
      <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: "16px 20px", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}
