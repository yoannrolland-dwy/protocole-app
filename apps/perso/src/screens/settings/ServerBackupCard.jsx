// Sauvegarde automatique sur le serveur Oracle (02/11/2026), Réglages › Appareil. Clé dédiée saisie
// par Monsieur lui-même (jamais exportée, jamais affichée en clair), état de la dernière copie,
// « Sauvegarder maintenant » et restauration d'une copie choisie dans la liste du serveur.
// Logique : src/lib/serverBackup.js ; requêtes : client HTTP natif (lib/backupNative.js).
import { useState, useEffect, useRef } from "react";
import { importData, getSync, store } from "../../store.js";
import { restoreErrorText } from "../../lib/restoreMessage.js";
import { C, Card, Label, Body, Btn, TextInput } from "../../design/compat.jsx";
import { say } from "../../lib/jeffrey.js";
import { BACKUP_DEFAULT_URL, backupConfig, serverBackupState, sendBackup, listBackups, fetchBackup } from "../../lib/serverBackup.js";
import { backupRequest } from "../../lib/backupNative.js";

const when = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};
const mo = (bytes) => `${(bytes / 1e6).toFixed(1).replace(".", ",")} Mo`;
const SLOT_LABEL = { matin: "matin", "14h": "14 h", "23h": "23 h", manuel: "à la main" };

export function ServerBackupCard({ onChange }) {
  const [hasKey, setHasKey] = useState(() => !!backupConfig().key);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState(() => getSync("backupUrl", "") || "");
  const [state, setState] = useState(serverBackupState);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [list, setList] = useState(null);
  const [armed, setArmed] = useState(null);
  const armTimer = useRef(null);
  useEffect(() => () => clearTimeout(armTimer.current), []);

  const refresh = () => { setState(serverBackupState()); onChange?.(); };

  const saveKey = () => {
    store.set("backupUrl", url.trim());
    if (key.trim()) store.set("backupKey", key.trim());
    setKey("");
    setHasKey(!!backupConfig().key);
    setMsg(say("serverBackupKeySaved"));
    refresh();
  };
  const removeKey = () => {
    store.set("backupKey", "");
    setHasKey(false); setList(null);
    setMsg(say("serverBackupKeyRemoved"));
    refresh();
  };
  const sendNow = async () => {
    setBusy(true); setMsg("");
    const r = await sendBackup("manuel", backupRequest);
    setBusy(false);
    setMsg(r.ok ? say("serverBackupSaved") : say("serverBackupFailed", { x: r.error }));
    refresh();
  };
  const loadList = async () => {
    setBusy(true); setMsg("");
    try {
      const l = await listBackups(backupRequest);
      setList(l);
      if (!l.length) setMsg(say("serverNoCopy"));
    } catch (e) { setMsg(say("serverListFailed", { x: e.message })); }
    setBusy(false);
  };
  // Restaurer remplace les données du téléphone : deux taps (le premier arme la ligne 4 s).
  const restore = async (id) => {
    if (armed !== id) {
      setArmed(id);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null); setBusy(true); setMsg("");
    let obj;
    try { obj = await fetchBackup(id, backupRequest); }
    catch (e) { setBusy(false); setMsg(say("serverRestoreFailed", { x: e.message })); return; }
    try {
      importData(obj);
      setMsg(say("imported"));
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setBusy(false);
      setMsg(restoreErrorText(e));
    }
  };

  const lastError = state.errorAt && (!state.okAt || state.errorAt > state.okAt);
  return (
    <Card>
      <Label style={{ marginBottom: 8 }}>Sauvegarde automatique · serveur</Label>
      <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
        Trois copies par jour sur votre serveur Oracle : juste après le brief, à 14 h et à 23 h.
        Le serveur garde la dernière semaine, et une copie par mois pendant un an. Les clés
        secrètes (IA, LiteLLM, voix, sauvegarde) ne partent jamais.
      </Body>
      {hasKey && (
        <Body style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
          {state.okAt ? `Dernière copie : ${when(state.okAt)} (${SLOT_LABEL[state.slot] || state.slot}).` : "Pas encore de copie sur le serveur."}
          {lastError && <span style={{ color: C.warn }}>{` Dernier essai le ${when(state.errorAt)} : ${state.error}.`}</span>}
        </Body>
      )}

      <Label style={{ marginBottom: 6 }}>{hasKey ? "Clé de sauvegarde · posée" : "Clé de sauvegarde"}</Label>
      <TextInput type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off"
        placeholder={hasKey ? "Laisser vide pour la garder" : "Collez la clé ici"} style={{ marginBottom: 10 }} />
      <Label style={{ marginBottom: 6 }}>Adresse du serveur</Label>
      <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder={BACKUP_DEFAULT_URL} style={{ marginBottom: 10 }} />
      <Btn variant="primary" onClick={saveKey} style={{ width: "100%" }}>Enregistrer</Btn>

      {hasKey && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <Btn variant="outline" disabled={busy} onClick={sendNow} style={{ width: "100%" }}>Sauvegarder maintenant</Btn>
          <Btn variant="outline" disabled={busy} onClick={loadList} style={{ width: "100%" }}>Restaurer depuis le serveur</Btn>
          {list && list.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <Body style={{ fontSize: 13, color: C.warn }}>
                Restaurer remplace toutes les données de ce téléphone par la copie choisie. Les clés restent.
              </Body>
              {list.map((b) => (
                <button key={b.id} type="button" className="p-tap" disabled={busy} onClick={() => restore(b.id)}
                  style={{
                    minHeight: 52, padding: "8px 12px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                    background: armed === b.id ? C.dangerBg : C.card, color: armed === b.id ? C.danger : C.text,
                    border: `1px solid ${armed === b.id ? C.danger : C.border}`, fontSize: 15,
                  }}>
                  {armed === b.id ? "Toucher encore pour restaurer cette copie" : `${when(b.savedAt)} · ${SLOT_LABEL[b.slot] || b.slot} · ${mo(b.bytes)}`}
                </button>
              ))}
            </div>
          )}
          <Btn variant="plain" disabled={busy} onClick={removeKey} style={{ width: "100%" }}>Retirer la clé</Btn>
        </div>
      )}
      {msg && <Body style={{ fontSize: 13, color: C.text2, marginTop: 8 }}>{msg}</Body>}
    </Card>
  );
}
