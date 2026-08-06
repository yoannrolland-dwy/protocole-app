import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { loadUserData, saveUserData } from "./userData.js";
import { C, inputStyle, buttonPrimary, labelStyle } from "./ui.js";

// Écran post-connexion — RawCare Phase 2, deuxième jalon. Volontairement minimal : le but
// ici n'est pas encore une vraie fonctionnalité, c'est de PROUVER que le trajet complet
// marche (connexion → lecture user_data → écriture → relecture après rechargement), avant
// de construire les vrais écrans (séances, macros...) par-dessus. Le champ "note de test"
// écrit dans data.testNote et se recharge après un F5 : si la valeur survit, RLS + schéma
// fonctionnent réellement, pas juste en théorie.
export default function Home({ session }) {
  const userId = session.user.id;
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    loadUserData(userId)
      .then((d) => { setData(d); setNote(d.testNote || ""); setStatus("ready"); })
      .catch((e) => { setError(String(e.message || e)); setStatus("error"); });
  }, [userId]);

  const save = async () => {
    setStatus("saving");
    setError("");
    try {
      const next = { ...data, testNote: note };
      await saveUserData(userId, next);
      setData(next);
      setStatus("saved");
    } catch (e) {
      setError(String(e.message || e));
      setStatus("error");
    }
  };

  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", padding: 24, fontFamily: C.mono,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, display: "flex",
        justifyContent: "space-between", alignItems: "center", marginBottom: 24,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          <span style={{ color: C.secondary }}>raw</span><span style={{ color: C.accent }}>CARE</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{
          background: "none", border: `1px solid ${C.border}`, color: C.secondary,
          borderRadius: 8, padding: "6px 12px", fontFamily: C.mono, fontSize: 12, cursor: "pointer",
        }}>
          Se déconnecter
        </button>
      </div>

      <div style={{
        width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 20, marginBottom: 16,
      }}>
        <p style={{ color: C.secondary, fontSize: 13, margin: 0 }}>Connecté en tant que</p>
        <p style={{ color: C.text, fontSize: 14, margin: "4px 0 0" }}>{session.user.email}</p>
      </div>

      <div style={{
        width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 20,
      }}>
        <label style={labelStyle}>Note de test (round-trip user_data)</label>
        {status === "loading" && <p style={{ color: C.secondary, fontSize: 13 }}>Chargement…</p>}
        {status !== "loading" && (
          <>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle}
              placeholder="Tape quelque chose, sauvegarde, recharge la page…" />
            <button onClick={save} disabled={status === "saving"}
              style={{ ...buttonPrimary, marginTop: 12, opacity: status === "saving" ? 0.6 : 1 }}>
              {status === "saving" ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            {status === "saved" && (
              <p style={{ color: C.accent, fontSize: 12, marginTop: 10 }}>
                ✓ Sauvegardé — recharge la page pour vérifier que ça tient.
              </p>
            )}
            {status === "error" && (
              <p style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
