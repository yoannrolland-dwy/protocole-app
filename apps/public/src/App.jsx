import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// Écran de vérification de branchement Supabase — RawCare Phase 2, premier jalon.
// `getSession()` ne touche à aucune table : ça suffit pour valider que l'URL + la clé
// publique pointent vers un vrai projet Supabase joignable, avant de construire l'auth et
// le schéma par-dessus. Sera remplacé par l'écran de connexion réel une fois le schéma et
// le flux d'auth de la bêta décidés.
export default function App() {
  const [status, setStatus] = useState(supabase ? "checking" : "unconfigured");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession()
      .then(({ error }) => {
        if (error) { setStatus("error"); setDetail(error.message); }
        else setStatus("ok");
      })
      .catch((e) => { setStatus("error"); setDetail(String(e?.message || e)); });
  }, []);

  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
      fontFamily: "ui-monospace, Menlo, Monaco, monospace", textAlign: "center",
    }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        <span style={{ color: "#8a8a84" }}>raw</span><span style={{ color: "#d7ff3f" }}>CARE</span>
      </div>
      <div style={{
        border: "1px solid #2a2a2a", background: "#121212", borderRadius: 10,
        padding: "16px 20px", maxWidth: 420,
      }}>
        {status === "unconfigured" && (
          <p style={{ color: "#8a8a84" }}>
            Pas encore configuré — renseigner <code>apps/public/.env.local</code>{" "}
            (voir <code>.env.example</code>).
          </p>
        )}
        {status === "checking" && <p style={{ color: "#8a8a84" }}>Connexion à Supabase…</p>}
        {status === "ok" && (
          <p style={{ color: "#d7ff3f" }}>✓ Connexion Supabase OK — projet joignable.</p>
        )}
        {status === "error" && (
          <>
            <p style={{ color: "#ff3b30" }}>✗ Échec de connexion Supabase.</p>
            <p style={{ color: "#6b6b66", fontSize: 12, marginTop: 8 }}>{detail}</p>
          </>
        )}
      </div>
    </div>
  );
}
