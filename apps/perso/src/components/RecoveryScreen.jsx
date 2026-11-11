// Écran de secours (audit du 10/11/2026, lot 1, point 5). Sans limite d'erreur React, une erreur
// dans un écran donnait un écran noir à chaque lancement, sans accès à la sauvegarde. Il reste
// volontairement simple (style en ligne, jetons bruts, aucune primitive d'écran) pour ne pas
// dépendre de ce qui vient peut-être de planter.
import { Component, useState } from "react";
import { COLORS } from "../design/tokens.js";
import { store } from "../store.js";
import { shareExport } from "../lib/offPhoneExport.js";
import { say, sayStable } from "../lib/jeffrey.js";
import { today } from "@rawcare/core/dateUtils";
import { finishSilentSync } from "../silentSync.js";

const btn = (primary) => ({
  minHeight: 52, width: "100%", borderRadius: 10, fontSize: 16, fontWeight: 700, fontFamily: "inherit",
  background: primary ? COLORS.accent : "transparent", color: primary ? COLORS.onAccent : COLORS.accent,
  border: `1.5px solid ${COLORS.accent}`, cursor: "pointer",
});

export function RecoveryScreen({ error }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await shareExport();
      // Même marqueur que la sauvegarde des Réglages (fait taire le rappel de 14 jours).
      await store.set("lastCloudBackup", today());
      setMsg(say("backupSent"));
    } catch (e) {
      const txt = String(e?.message || e);
      setMsg(/cancel/i.test(txt) ? say("backupCancelled") : say("backupFailed", { x: txt }));
    }
    setBusy(false);
  };
  const detail = String(error?.message || error || "").slice(0, 200);
  return (
    <div role="alert" style={{
      minHeight: "100%", boxSizing: "border-box", padding: "32px 16px", display: "flex", flexDirection: "column",
      gap: 14, background: COLORS.bg, color: COLORS.text, fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.danger }}>{sayStable("recoveryTitle")}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5 }}>{sayStable("recoveryBody")}</div>
      <button type="button" style={btn(true)} disabled={busy} onClick={save}>Sauvegarder hors du téléphone</button>
      <button type="button" style={btn(false)} onClick={() => window.location.reload()}>Recharger</button>
      {msg && <div style={{ fontSize: 13, color: COLORS.accent }}>{msg}</div>}
      {detail && <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace", wordBreak: "break-word" }}>{detail}</div>}
    </div>
  );
}

/** Limite d'erreur autour de l'app. En mode silencieux (bouton Sync du widget), rien ne s'affiche. */
export class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    console.error("app", error?.name || "erreur");
    // Bouton Sync du widget (point 17) : l'app n'a pas pu se charger, l'activité invisible se referme.
    if (this.props.silent) finishSilentSync();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.silent ? null : <RecoveryScreen error={this.state.error} />;
  }
}
