import { useState } from "react";
import { kcalFromMacros } from "@rawcare/core/targets";
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

export default function Onboarding({ data, update, onClose }) {
  const [activeSports, setActiveSports] = useState(data?.activeSports || []);
  const [painZones, setPainZones] = useState(data?.painZones || []);
  const [addingOther, setAddingOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  // `mergeTargets` neutralise toujours `cut` (voir defaultTargets.js) : rouvrir Préférences
  // et enregistrer répare aussi, en base, un compte dont `targets.cut` porterait encore
  // l'ancien bug (fenêtre de sèche de Yoann héritée avant le correctif du 06/08/2026).
  const [targets, setTargets] = useState(mergeTargets(data?.targets));
  const [climbScheme, setClimbScheme] = useState(data?.climbScheme || "gym");
  const [apiKey, setApiKey] = useState(data?.apiKey || "");
  const [model, setModel] = useState(data?.model || "claude-sonnet-5");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const toggleSport = (key) => {
    setActiveSports((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  };

  const addPreset = (presetKey) => {
    const preset = PAIN_ZONE_PRESETS.find((p) => p.preset === presetKey);
    if (preset.freeName) { setAddingOther(true); return; }
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
      key: newZoneKey(), label: otherName.trim(), gateTag: null, unknownIsCaution: false,
      hsr: false, routines: false, coachClause: null,
    }]);
    setOtherName(""); setAddingOther(false);
  };
  const removeZone = (key) => setPainZones((zs) => zs.filter((z) => z.key !== key));

  const finish = async () => {
    setSaving(true); setSaveError("");
    try {
      await update({ activeSports, painZones, targets, climbScheme, apiKey, model, onboarded: true });
      onClose?.();
    } catch (e) {
      setSaveError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ScreenHeader title="Bienvenue" subtitle="quelques réglages avant de commencer" />

      <Card>
        <Label style={{ marginBottom: 8 }}>Sports pratiqués</Label>
        <Body style={{ fontSize: 10.5, color: C.dim, marginBottom: 10 }}>
          Seuls ces trois-là sont pleinement pris en charge par le recommandeur pour l'instant.
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
          Genou/Coude influencent les suggestions du recommandeur. « Autre » est un suivi
          libre, sans effet sur les suggestions.
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
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Nom de la zone (ex. Épaule)" style={{ flex: 1 }} />
            <Btn variant="primary" disabled={!otherName.trim()} onClick={confirmOther} style={{ padding: "0 14px" }}>OK</Btn>
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
        <Label style={{ marginBottom: 8 }}>Cibles macro de base</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field label="Protéines (g)"><Stepper value={targets.protein ?? 0} set={(v) => setTargets({ ...targets, protein: v })} step={5} min={0} int /></Field>
          <Field label="Glucides (g)"><Stepper value={targets.carbs ?? 0} set={(v) => setTargets({ ...targets, carbs: v })} step={5} min={0} int /></Field>
          <Field label="Lipides (g)"><Stepper value={targets.fat ?? 0} set={(v) => setTargets({ ...targets, fat: v })} step={5} min={0} int /></Field>
          <Field label="Fibres (g)"><Stepper value={targets.fiber ?? 0} set={(v) => setTargets({ ...targets, fiber: v })} step={1} min={0} int /></Field>
        </div>
        <Field label="Poids de maintenance (kg)">
          <Stepper value={targets.weightMaintenance ?? 80} set={(v) => setTargets({ ...targets, weightMaintenance: v })} step={0.5} min={0} />
        </Field>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          Ne sert de cible poids que si tu choisis la phase "Maintenance" dans l'onglet
          Poids. Les phases Sèche/Prise ont chacune leur propre cible, éditable directement
          dans l'onglet Poids (93/95 kg par défaut).
        </Body>
        <Body style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: C.mono }}>
          ≈ {Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber))} kcal
        </Body>
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

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={finish} disabled={saving} style={{ flex: 1 }}>
          {saving ? "Enregistrement…" : "Terminer"}
        </Btn>
        {onClose && <Btn variant="ghost" onClick={onClose} disabled={saving}>Annuler</Btn>}
      </div>
      {saveError && <p style={{ color: C.danger, fontSize: 12 }}>{saveError}</p>}
    </div>
  );
}
