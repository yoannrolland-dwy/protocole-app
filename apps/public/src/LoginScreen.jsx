import { useState } from "react";
import { supabase } from "./supabaseClient.js";
import { C, Card, Field, Btn, inputStyle } from "./ui.jsx";

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
        <span style={{ color: C.text2 }}>raw</span><span style={{ color: C.accent }}>CARE</span>
      </div>
      <Card style={{ width: "100%", maxWidth: 340 }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Email">
            <input type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} style={inputStyle(false)} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} style={inputStyle(false)} />
          </Field>
          {error && <p style={{ color: C.danger, fontSize: 13, fontFamily: C.mono, margin: 0 }}>{error}</p>}
          {/* Pas de `onClick` : ce bouton n'a pas de `type` explicite, donc c'est le
              type="submit" natif dans ce <form> qui déclenche `submit` (Entrée y compris) —
              lui donner un onClick en plus déclencherait la connexion deux fois. */}
          <Btn variant="primary" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Connexion…" : "Se connecter"}
          </Btn>
        </form>
      </Card>
      <p style={{ color: C.dim, fontSize: 12, fontFamily: C.mono, marginTop: 16, maxWidth: 340, textAlign: "center" }}>
        Bêta fermée — pas d'inscription libre. Ton compte t'a été créé directement.
      </p>
      <p style={{ color: C.dim, fontSize: 11, fontFamily: C.mono, marginTop: 20, textAlign: "center" }}>
        <a href="/privacypolicy.html" style={{ color: C.muted }}>Confidentialité</a>
        {" · "}
        <a href="/mentionslegales.html" style={{ color: C.muted }}>Mentions légales</a>
      </p>
    </div>
  );
}
