import { supabase } from "./supabaseClient.js";
import { useAuth } from "./useAuth.js";
import LoginScreen from "./LoginScreen.jsx";
import Home from "./Home.jsx";
import { C } from "./ui.js";

// RawCare Phase 2 : orchestration minimale des états d'auth. Pas de router — un seul écran
// affiché à la fois selon l'état de connexion, suffisant tant qu'il n'y a qu'un écran
// post-connexion (Home). Un vrai router viendra avec les premiers vrais écrans de données.
export default function App() {
  if (!supabase) {
    return (
      <Centered>
        <p style={{ color: C.secondary }}>
          Pas encore configuré — renseigner <code>apps/public/.env.local</code>{" "}
          (voir <code>.env.example</code>).
        </p>
      </Centered>
    );
  }

  const { session, loading } = useAuth();

  if (loading) {
    return <Centered><p style={{ color: C.secondary }}>Chargement…</p></Centered>;
  }
  if (!session) {
    return <LoginScreen />;
  }
  return <Home session={session} />;
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
      fontFamily: C.mono, textAlign: "center",
    }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        <span style={{ color: C.secondary }}>raw</span><span style={{ color: C.accent }}>CARE</span>
      </div>
      <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: "16px 20px", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}
