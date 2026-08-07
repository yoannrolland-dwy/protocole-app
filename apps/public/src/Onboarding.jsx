import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { kcalFromMacros, PHASES } from "@rawcare/core/targets";
import { mergeTargets } from "./defaultTargets.js";
import { C, Card, Label, Body, Btn, Field, Stepper, Pills, TextInput, ScreenHeader } from "./ui.jsx";
import { SPORT_FAMILIES, PAIN_ZONE_PRESETS, newZoneKey } from "./onboarding.js";

// Onboarding — RawCare, chantier onboarding (06/08/2026). Formulaire à défilement unique
// (pas d'assistant multi-étapes : aucun pattern wizard n'existe ailleurs dans l'app, un long
// formulaire en Cards reste cohérent avec le reste du design). Réutilisé en création (premier
// login, `data.onboarded !== true`, gate dans App.jsx) ET en modification (bouton
// « Préférences », `onClose` fourni) — même convention que RecipeBuilder/MuscuLogger pour le
// mode édition : `data` préremplit, un seul `update()` final.
//
// Portée volontairement réduite (voir CLAUDE.md, chantier onboarding) : sports limités aux 3
// familles supportées par le recommandeur (Musculation, Basket, Escalade — pas le catalogue
// étendu), zones de douleur limitées aux 3 options guidées (Genou/Coude/Autre) plutôt qu'un
// formulaire de seuils Silbernagel libres.

const chip = (on) => ({
  padding: "8px 13px", borderRadius: 6, cursor: "pointer", fontSize: 11.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: 0.5,
  background: on ? C.accent : C.card, color: on ? "#000" : C.muted,
  border: `1.5px solid ${on ? C.accent : C.border}`, fontFamily: "inherit",
});

export default function Onboarding({ data, update, onClose, mode = "onboarding" }) {
  const [activeSports, setActiveSports] = useState(data?.activeSports || []);
  const [painZones, setPainZones] = useState(data?.painZones || []);
  const [addingOther, setAddingOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  // Gate au choix pour une zone "Autre" (Lot E, 06/08/2026) : quelles catégories de séance
  // cette zone doit pénaliser/écarter dans le recommandeur — genou (impact : Lower/Basket),
  // tirage (haut du corps : Upper/Escalade), les deux, ou aucun (suivi pur). Ce n'est pas un
  // protocole kiné par tendon — la règle de Silbernagel (péremption, seuils) est déjà
  // générique côté packages/core/src/pain.js, identique quelle que soit la zone.
  const [otherGates, setOtherGates] = useState([]);
  const toggleGate = (tag) => {
    setOtherGates((gs) => (gs.includes(tag) ? gs.filter((g) => g !== tag) : [...gs, tag]));
  };
  // `mergeTargets` neutralise toujours `cut` (voir defaultTargets.js) : rouvrir Préférences
  // et enregistrer répare aussi, en base, un compte dont `targets.cut` porterait encore
  // l'ancien bug (fenêtre de sèche de Yoann héritée avant le correctif du 06/08/2026).
  const [targets, setTargets] = useState(mergeTargets(data?.targets));
  // Carte Phase (07/08/2026) : déplacée depuis WeightTab.jsx, où elle vivait faute d'écran
  // Réglages au moment de sa création — même raisonnement que la carte "Cibles macro de
  // base" juste en dessous, qui vit ici pour la même raison.
  const [phase, setPhase] = useState(data?.phase || "seche");
  const [climbScheme, setClimbScheme] = useState(data?.climbScheme || "gym");
  const [apiKey, setApiKey] = useState(data?.apiKey || "");
  const [model, setModel] = useState(data?.model || "claude-sonnet-5");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [backupMsg, setBackupMsg] = useState("");

  const toggleSport = (key) => {
    setActiveSports((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  };

  const addPreset = (presetKey) => {
    const preset = PAIN_ZONE_PRESETS.find((p) => p.preset === presetKey);
    if (preset.freeName) { setOtherGates([]); setAddingOther(true); return; }
    if (painZones.some((z) => z.key === preset.key)) return; // déjà ajoutée
    setPainZones((zs) => [...zs, {
      key: preset.key, label: preset.label, gateTag: preset.gateTag,
      unknownIsCaution: preset.unknownIsCaution, hsr: preset.hsr, routines: preset.routines,
      coachClause: preset.coachClause,
    }]);
  };
  const confirmOther = () => {
    if (!otherName.trim()) return;
    setPainZones((zs) => [...zs, {
      key: newZoneKey(), label: otherName.trim(), gateTag: otherGates.length ? otherGates : null,
      unknownIsCaution: false, hsr: false, routines: false, coachClause: null,
    }]);
    setOtherName(""); setOtherGates([]); setAddingOther(false);
  };
  const removeZone = (key) => setPainZones((zs) => zs.filter((z) => z.key !== key));

  // Sauvegarde manuelle (07/08/2026, retour de Yoann) : `data` vit déjà dans Supabase et se
  // sauvegarde à chaque modification, mais aucune copie n'existait hors de ce backend — ni
  // pour la portabilité RGPD déjà promise dans la politique de confidentialité, ni comme
  // filet en cas de souci côté compte/base. Exporte `data` TEL QUEL, sauf `apiKey` (même
  // exclusion que `exportData()` côté apps/perso, pour ne jamais faire atterrir une clé API
  // dans un fichier qui peut finir sur Drive/par mail). `update()` fusionne par clé (voir
  // useUserData.js), donc restaurer un export — qui ne contient jamais `apiKey` — ne touche
  // jamais la clé actuellement configurée.
  const doExport = () => {
    const { apiKey: _omit, ...rest } = data || {};
    const json = JSON.stringify({ app: "RawCare", schema: 1, exportedAt: new Date().toISOString(), data: rest }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rawcare-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const doImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let imported;
      try {
        const parsed = JSON.parse(reader.result);
        imported = parsed && typeof parsed.data === "object" ? parsed.data : parsed;
        if (!imported || typeof imported !== "object") throw new Error("format invalide");
      } catch {
        setBackupMsg("Fichier invalide.");
        return;
      }
      try {
        await update(imported);
        setBackupMsg("Données restaurées.");
      } catch (err) {
        setBackupMsg(String(err.message || err));
      }
    };
    reader.readAsText(file);
  };

  const finish = async () => {
    setSaving(true); setSaveError("");
    try {
      await update({ activeSports, painZones, targets, phase, climbScheme, apiKey, model, onboarded: true });
      onClose?.();
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {mode === "settings" ? (
        <ScreenHeader title="Réglages" subtitle="sports, zones de douleur, cibles macro, Coach IA" />
      ) : (
        <ScreenHeader title="Bienvenue" subtitle="quelques réglages avant de commencer" />
      )}

      <Card>
        <Label style={{ marginBottom: 8 }}>Sports pratiqués</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Tous pris en charge par le recommandeur — chacun influence tes suggestions du jour.
        </Body>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SPORT_FAMILIES.map((f) => (
            <button key={f.key} onClick={() => toggleSport(f.key)} style={chip(activeSports.includes(f.key))}>
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Zone(s) de douleur — optionnel</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Genou/Coude influencent déjà les suggestions du recommandeur. Pour « Autre », tu
          choisis toi-même ce qu'elle doit affecter — ou rien, pour un suivi pur.
        </Body>
        {painZones.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {painZones.map((z) => (
              <div key={z.key} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 10px", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 6,
              }}>
                <span style={{ fontSize: 12, color: C.text }}>{z.label}</span>
                <button onClick={() => removeZone(z.key)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 4, fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {addingOther ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TextInput value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Nom de la zone (ex. Épaule)" />
            <div>
              <Body style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>
                Cette zone doit-elle influencer le recommandeur ?
              </Body>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => toggleGate("genou")} style={chip(otherGates.includes("genou"))}>
                  Genou (impact : Lower/Basket)
                </button>
                <button onClick={() => toggleGate("tirage")} style={chip(otherGates.includes("tirage"))}>
                  Tirage (haut du corps : Upper/Escalade)
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="primary" disabled={!otherName.trim()} onClick={confirmOther} style={{ flex: 1 }}>Ajouter</Btn>
              <Btn variant="ghost" onClick={() => { setAddingOther(false); setOtherName(""); setOtherGates([]); }}>Annuler</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PAIN_ZONE_PRESETS.map((p) => {
              const already = !p.freeName && painZones.some((z) => z.key === p.key);
              return (
                <button key={p.preset} disabled={already} onClick={() => addPreset(p.preset)}
                  style={{ ...chip(false), opacity: already ? 0.4 : 1, cursor: already ? "default" : "pointer" }}>
                  + {p.freeName ? "Autre" : p.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 11 }}>{PHASES[phase].msg}</Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cibles macro de base</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field label="Protéines (g)"><Stepper value={targets.protein ?? 0} set={(v) => setTargets({ ...targets, protein: v })} step={5} min={0} int /></Field>
          <Field label="Glucides (g)"><Stepper value={targets.carbs ?? 0} set={(v) => setTargets({ ...targets, carbs: v })} step={5} min={0} int /></Field>
          <Field label="Lipides (g)"><Stepper value={targets.fat ?? 0} set={(v) => setTargets({ ...targets, fat: v })} step={5} min={0} int /></Field>
          <Field label="Fibres (g)"><Stepper value={targets.fiber ?? 0} set={(v) => setTargets({ ...targets, fiber: v })} step={1} min={0} int /></Field>
        </div>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: -2, marginBottom: 8, fontFamily: C.mono }}>
          ≈ {Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber))} kcal
        </Body>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          Poids cible par phase — pilote la cible affichée dans l'onglet Poids selon la
          phase choisie ci-dessus.
        </Body>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Sèche (kg)">
            <Stepper value={targets.weightCutTarget ?? PHASES.seche.target} set={(v) => setTargets({ ...targets, weightCutTarget: v })} step={0.5} min={0} />
          </Field>
          <Field label="Maintenance (kg)">
            <Stepper value={targets.weightMaintenance ?? 80} set={(v) => setTargets({ ...targets, weightMaintenance: v })} step={0.5} min={0} />
          </Field>
          <Field label="Prise (kg)">
            <Stepper value={targets.weightBulkTarget ?? PHASES.prise.target} set={(v) => setTargets({ ...targets, weightBulkTarget: v })} step={0.5} min={0} />
          </Field>
        </div>
      </Card>

      {activeSports.includes("escalade") && (
        <Card>
          <Label style={{ marginBottom: 8 }}>Système de cotation escalade</Label>
          <Pills options={[{ key: "gym", label: "Couleur de salle" }, { key: "fontainebleau", label: "Fontainebleau" }]}
            value={climbScheme} onChange={setClimbScheme} />
        </Card>
      )}

      <Card>
        <Label style={{ marginBottom: 8 }}>Clé API Anthropic — optionnel</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Pour le Coach IA (à venir). L'app fonctionne entièrement sans — tu pourras aussi
          l'ajouter plus tard.
        </Body>
        <TextInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" />
        <div style={{ marginTop: 10 }}>
          <Field label="Modèle">
            <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-5" />
          </Field>
        </div>
      </Card>

      {mode === "settings" && (
        <Card>
          <Label style={{ marginBottom: 8 }}>Sauvegarde des données</Label>
          <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
            Tes données sont déjà sauvegardées automatiquement à chaque modification. Ce
            fichier est une copie manuelle en plus — pour la garder de ton côté ou la
            récupérer si besoin.
          </Body>
          <Btn variant="primary" onClick={doExport} style={{ width: "100%" }}>
            <Download size={14} style={{ display: "inline", marginRight: 4 }} />Télécharger mes données
          </Btn>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
            <label>
              <span style={{
                display: "block", textAlign: "center", background: C.card, color: C.accent,
                border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: "9px 12px",
                fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
              }}><Upload size={14} style={{ display: "inline", marginRight: 4 }} />Restaurer un fichier</span>
              <input type="file" accept="application/json" onChange={doImportFile} style={{ display: "none" }} />
            </label>
            <Body style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
              Écrase les données existantes clé par clé avec celles du fichier — à utiliser
              en connaissance de cause si tu es aussi connecté ailleurs.
            </Body>
          </div>
          {backupMsg && <Body style={{ fontSize: 11, color: C.accent, marginTop: 8 }}>{backupMsg}</Body>}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={finish} disabled={saving} style={{ flex: 1 }}>
          {saving ? "Enregistrement…" : mode === "settings" ? "Enregistrer" : "Terminer"}
        </Btn>
        {onClose && <Btn variant="ghost" onClick={onClose} disabled={saving}>Annuler</Btn>}
      </div>
      {saveError && <p style={{ color: C.danger, fontSize: 12 }}>{saveError}</p>}
    </div>
  );
}
