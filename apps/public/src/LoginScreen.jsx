import { useState } from "react";
import { supabase } from "./supabaseClient.js";
import { C, inputStyle, buttonPrimary, labelStyle } from "./ui.js";

// Pas d'inscription libre à ce stade (bêta fermée, comptes créés à la main par Yoann dans
// le dashboard Supabase — voir CLAUDE.md) : cet écran ne propose QUE la connexion, jamais
// de lien "créer un compte".
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message === "Invalid login credentials"
      ? "Email ou mot de passe incorrect."
      : err.message);
  };

  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: C.mono, marginBottom: 24 }}>
        <span style={{ color: C.secondary }}>raw</span><span style={{ color: C.accent }}>CARE</span>
      </div>
      <form onSubmit={submit} style={{
        width: "100%", maxWidth: 340, background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" required autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Mot de passe</label>
          <input type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </div>
        {error && <p style={{ color: C.danger, fontSize: 13, fontFamily: C.mono, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ ...buttonPrimary, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p style={{ color: C.dim, fontSize: 12, fontFamily: C.mono, marginTop: 16, maxWidth: 340, textAlign: "center" }}>
        Bêta fermée — pas d'inscription libre. Ton compte t'a été créé directement.
      </p>
    </div>
  );
}
