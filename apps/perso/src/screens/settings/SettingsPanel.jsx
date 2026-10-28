// Extrait d'App.jsx le 25/10/2026 (chantier U, étape U0) ; rendu v2 à l'étape 8 d'U3 via
// design/compat.jsx (mêmes primitives, valeurs v2), polices écrites en dur remontées à 12-13 px.
import { useState, useEffect } from "react";
import { Download, Upload, X, Copy } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { exportData, importData } from "../../store.js";
import { isBackupStale, daysSinceBackup } from "../../cloudBackup.js";
import { PHASES, kcalFromMacros } from "@rawcare/core/targets";
import { C, today, fmt, Card, Label, Body, Btn, inputStyle, TextInput, Stepper, Field, Pills, ScreenHeader } from "../../design/compat.jsx";
import { BasketScheduleCard } from "./BasketScheduleCard.jsx";
import { APP_VERSION } from "../../version.js";
import { listLiteLLMModels } from "@rawcare/core/coach/claudeApi";
import { widgetBackgroundStatus, requestWidgetBackground } from "../../healthSync.js";

/* ============================================================
   RÉGLAGES
   ============================================================ */
export function SettingsPanel({ apiKey, setApiKey, model, setModel,
                         aiProvider, setAiProvider, litellmUrl, setLitellmUrl, litellmKey, setLitellmKey, litellmModel, setLitellmModel, onClose, healthSync, onHealthSync,
                         coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, saveTargets, buildBriefing,
                         lastAutoBackup, lastCloudBackup, onCloudBackupDone, phase, setPhase,
                         basketSchedule, setBasketSchedule }) {
  const [k, setK] = useState(apiKey);
  const [m, setM] = useState(model);
  // Accès Health Connect en arrière-plan pour le widget (28/10/2026), relu à chaque ouverture.
  const [widgetBg, setWidgetBg] = useState(null);
  useEffect(() => { widgetBackgroundStatus().then(setWidgetBg); }, []);
  const [lUrl, setLUrl] = useState(litellmUrl);
  const [lKey, setLKey] = useState(litellmKey);
  const [lModel, setLModel] = useState(litellmModel);
  const [lModels, setLModels] = useState(null);   // liste renvoyée par le serveur, null = pas chargée
  const [lMsg, setLMsg] = useState("");
  const loadModels = async () => {
    setLMsg("Chargement…");
    try {
      const ids = await listLiteLLMModels({ baseUrl: lUrl.trim(), apiKey: lKey.trim() });
      setLModels(ids); setLMsg(ids.length ? "" : "Le serveur ne liste aucun modèle.");
    } catch (e) { setLModels(null); setLMsg(`Impossible de lire la liste : ${e.message}`); }
  };
  const [msg, setMsg] = useState("");
  const [prof, setProf] = useState(coachProfile);
  const [jour, setJour] = useState(coachJournal);
  const [briefing, setBriefing] = useState("");   // rempli seulement si la copie auto échoue

  // navigator.clipboard existe dans la WebView Capacitor (origine sécurisée), mais peut
  // échouer selon le contexte : on affiche alors le texte pour une copie manuelle plutôt
  // que de laisser l'utilisateur devant un bouton qui n'a rien fait.
  const doBriefing = async () => {
    const txt = buildBriefing();
    try {
      await navigator.clipboard.writeText(txt);
      setBriefing("");
      setMsg("Contexte copié — colle-le dans une conversation Claude.");
    } catch {
      setBriefing(txt);
      setMsg("");
    }
  };
  const doExport = async () => {
    const json = JSON.stringify(exportData(), null, 2);
    const name = `protocole-${today()}.json`;
    // Le téléchargement via <a download> ne fonctionne pas dans la WebView native :
    // on écrit le fichier puis on ouvre le partage Android (Drive, mail, Fichiers…).
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
        // `Share.share` ne résout QUE si une destination a été choisie (annuler la feuille
        // rejette la promesse) : c'est le seul signal disponible côté app pour dire que la
        // sauvegarde est partie. On ne peut évidemment pas vérifier qu'elle est bien
        // arrivée sur Drive — on date une intention aboutie, pas une réception.
        await Share.share({ title: name, files: [uri] });
        onCloudBackupDone?.();
        setMsg("Sauvegarde envoyée — vérifie qu'elle est bien arrivée à destination.");
      } catch (e) {
        const txt = String(e?.message || e);
        setMsg(/cancel/i.test(txt) ? "Sauvegarde annulée — rien n'a été envoyé." : `Sauvegarde impossible : ${txt}`);
      }
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    // Sur la PWA le fichier atterrit dans les téléchargements de la machine qui affiche
    // l'app — donc hors du téléphone aussi, du point de vue du risque couvert.
    onCloudBackupDone?.();
  };
  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importData(JSON.parse(reader.result)); setMsg("Données importées. Rechargement…"); setTimeout(() => window.location.reload(), 800); }
      catch { setMsg("Fichier invalide."); }
    };
    reader.readAsText(file);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Titre et bouton de fermeture : dans l'en-tête de l'app (AppHeader) depuis U3. */}

      {/* Réordonné le 14/09/2026 (retour de Yoann : "c'est un peu le bordel"), puis affiné le
          même jour après un premier essai trop grossier ("mettre un rappel actif en tête" ≠
          "utilisé souvent" — Sauvegarde n'est en fait PAS un réglage fréquent malgré son
          bandeau/sa notification). Ordre final confirmé par Yoann réglage par réglage : du
          plus fréquemment utilisé au moins fréquent, sans regrouper "Coach IA" comme un seul
          bloc — contexte permanent/carnet de bord/revue de fond sont utilisés souvent, clé
          API/modèle quasi jamais, donc les deux moitiés ne sont plus adjacentes. "Objectif
          temporaire" reste retiré de l'écran (jugé inutile) — `targets.cut` reste intact en
          interne, juste plus affiché nulle part. */}

      <BasketScheduleCard basketSchedule={basketSchedule} setBasketSchedule={setBasketSchedule} />

      <Card>
        <Label style={{ marginBottom: 8 }}>Phase</Label>
        <Pills options={Object.entries(PHASES).map(([k, v]) => ({ key: k, label: v.label }))} value={phase} onChange={setPhase} small />
        <Body style={{ marginTop: 8, fontSize: 13 }}>{PHASES[phase].msg}</Body>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cibles macro de base</Label>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 10 }}>
          Cibles quotidiennes, appliquées partout dans l'app.
        </Body>
        {/* Une colonne (U3 étape 8) : en deux colonnes, le champ ne faisait que 30 px entre ses −/+ de 52 px. */}
        <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
          <Field label="Protéines (g)"><Stepper value={targets.protein ?? 0} set={(v) => saveTargets({ ...targets, protein: v })} step={5} min={0} int /></Field>
          <Field label="Glucides (g)"><Stepper value={targets.carbs ?? 0} set={(v) => saveTargets({ ...targets, carbs: v })} step={5} min={0} int /></Field>
          <Field label="Lipides (g)"><Stepper value={targets.fat ?? 0} set={(v) => saveTargets({ ...targets, fat: v })} step={5} min={0} int /></Field>
          <Field label="Fibres (g)"><Stepper value={targets.fiber ?? 0} set={(v) => saveTargets({ ...targets, fiber: v })} step={1} min={0} int /></Field>
        </div>
        <Body style={{ fontSize: 12, color: C.dim, marginTop: -2, marginBottom: 8, fontFamily: C.mono }}>
          ≈ {Math.round(kcalFromMacros(targets.protein, targets.carbs, targets.fat, targets.fiber))} kcal
        </Body>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
          Poids cible par phase — pilote la tuile Poids et le sous-titre de l'onglet Poids
          selon la phase active ci-dessus.
        </Body>
        {/* Empilé verticalement (07/08/2026, retour de Yoann) : 3 Stepper (chacun déjà
            −/champ/+) sur une seule ligne ne tenaient pas dans la largeur d'une Card,
            débordaient du cadre et laissaient le champ de saisie trop étroit pour taper
            dedans. Une ligne par phase, comme suggéré. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Sèche (kg)">
            <Stepper value={targets.weightCutTarget ?? PHASES.seche.target} set={(v) => saveTargets({ ...targets, weightCutTarget: v })} step={0.5} min={0} />
          </Field>
          <Field label="Maintenance (kg)">
            <Stepper value={targets.weightMaintenance ?? 96} set={(v) => saveTargets({ ...targets, weightMaintenance: v })} step={0.5} min={0} />
          </Field>
          <Field label="Prise (kg)">
            <Stepper value={targets.weightBulkTarget ?? PHASES.prise.target} set={(v) => saveTargets({ ...targets, weightBulkTarget: v })} step={0.5} min={0} />
          </Field>
        </div>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Cible eau de base</Label>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 10 }}>
          Cible quotidienne hors basket. +1 L automatique les jours où une séance Basket est loggée.
        </Body>
        <Field label="Eau (mL)"><Stepper value={targets.water ?? 0} set={(v) => saveTargets({ ...targets, water: v })} step={100} min={0} int /></Field>
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Coach IA · contexte permanent</Label>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
          Envoyé à chaque analyse comme une contrainte. C'est ici que vit ton objectif en cours.
        </Body>
        <textarea rows={10} value={prof} onChange={(e) => setProf(e.target.value)}
          onBlur={() => setCoachProfile(prof)}
          style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 13, fontWeight: 400, resize: "vertical", padding: "10px 12px", minHeight: 0, lineHeight: 1.45 }} />
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Label>Coach IA · carnet de bord</Label>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>{(jour || "").length} car.</span>
        </div>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
          Écrit par le coach à la fin de chaque analyse : c'est sa mémoire d'une fois sur l'autre.
          Corrige-le s'il note une bêtise, vide-le pour repartir de zéro.
        </Body>
        {(jour || "").trim() ? (
          <>
            <textarea rows={8} value={jour} onChange={(e) => setJour(e.target.value)}
              onBlur={() => setCoachJournal(jour)}
              style={{ ...inputStyle(false), fontFamily: "inherit", fontSize: 13, fontWeight: 400, resize: "vertical", padding: "10px 12px", minHeight: 0, lineHeight: 1.45 }} />
            <Btn variant="danger" onClick={() => { setJour(""); setCoachJournal(""); }} style={{ marginTop: 8, width: "100%" }}>
              Vider le carnet
            </Btn>
          </>
        ) : (
          <Body style={{ fontSize: 13, color: C.muted }}>Vide — il se remplira à ta prochaine analyse.</Body>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Revue de fond dans claude.ai</Label>
        <Body style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>
          Copie tout ton contexte (profil, carnet, 14 jours de données, séries brutes) pour le coller
          dans une conversation Claude. Plus complet que l'analyse de l'app, et sans consommer de crédits API.
        </Body>
        <Btn variant="outline" onClick={doBriefing} style={{ width: "100%" }}>
          <Copy size={14} style={{ display: "inline", marginRight: 4 }} />Copier le contexte
        </Btn>
        {briefing && (
          <>
            <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
              Copie automatique refusée par le système : sélectionne tout le texte ci-dessous et copie-le à la main.
            </Body>
            <textarea rows={6} readOnly value={briefing}
              style={{ ...inputStyle(false), fontFamily: C.mono, fontSize: 12, fontWeight: 400, resize: "vertical", padding: "10px 12px", minHeight: 0, marginTop: 6 }} />
          </>
        )}
      </Card>

      {Capacitor.isNativePlatform() && (
        <Card>
          <Label style={{ marginBottom: 8 }}>Health Connect · pas, sommeil & macros</Label>
          <Body style={{ fontSize: 12, color: C.text2, marginBottom: 10 }}>
            {healthSync.status === "running" && "Synchronisation en cours…"}
            {healthSync.status === "ok" && `À jour · dernière synchro ${new Date(healthSync.at).toLocaleTimeString("fr-FR")}`}
            {healthSync.status === "unavailable" && "Health Connect indisponible sur cet appareil."}
            {healthSync.status === "denied" && "Accès refusé — autorise pas, sommeil, nutrition et hydratation dans Health Connect."}
            {healthSync.status === "error" && `Erreur : ${healthSync.message}`}
            {healthSync.status === "idle" && "Pas encore synchronisé."}
          </Body>
          <Btn variant="outline" onClick={onHealthSync} style={{ width: "100%" }} disabled={healthSync.status === "running"}>
            Synchroniser maintenant
          </Btn>
          <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
            Synchronise automatiquement au lancement et à chaque retour au premier plan. Écrase toujours la valeur locale du jour concerné.
          </Body>
          {/* Widget (28/10/2026) : sans cet accès, le widget ne change que quand l'app tourne. */}
          {widgetBg?.supported && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <Label style={{ marginBottom: 6 }}>Widget · pas en arrière-plan</Label>
              {widgetBg.granted ? (
                <Body style={{ fontSize: 13, color: C.text2 }}>
                  Activé : le widget relit tes pas toutes les 30 min environ, sans ouvrir l'app.
                </Body>
              ) : (
                <>
                  <Body style={{ fontSize: 13, color: C.text2, marginBottom: 10 }}>
                    Pour que le widget mette à jour tes pas tout seul (toutes les 30 min environ), autorise l'accès en arrière-plan dans Health Connect.
                  </Body>
                  <Btn variant="primary" style={{ width: "100%" }}
                    onClick={async () => { await requestWidgetBackground(); setWidgetBg(await widgetBackgroundStatus()); }}>
                    Autoriser l'accès en arrière-plan
                  </Btn>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Fournisseur IA (26/10/2026) : Anthropic direct ou serveur LiteLLM. Le modèle choisi sert
          à toute l'IA de l'app (Coach, Bilan, Carte resto, Photo d'un plat). */}
      <Card>
        <Label style={{ marginBottom: 8 }}>IA · fournisseur et modèle</Label>
        <Pills options={[{ key: "anthropic", label: "Anthropic direct" }, { key: "litellm", label: "LiteLLM" }]}
          value={aiProvider} onChange={(v) => { setAiProvider(v); setMsg(""); }} small />
        <div style={{ height: 12 }} />
        {aiProvider === "litellm" ? (
          <>
            <Label style={{ marginBottom: 6 }}>Adresse du serveur</Label>
            <TextInput type="url" inputMode="url" value={lUrl} onChange={(e) => setLUrl(e.target.value)} placeholder="https://…" style={{ marginBottom: 10 }} />
            <Label style={{ marginBottom: 6 }}>Clé LiteLLM</Label>
            <TextInput type="password" value={lKey} onChange={(e) => setLKey(e.target.value)} placeholder="sk-..." style={{ marginBottom: 10 }} />
            <Label style={{ marginBottom: 6 }}>Modèle</Label>
            <TextInput value={lModel} onChange={(e) => setLModel(e.target.value)} placeholder="anthropic/claude-sonnet-5-5" style={{ marginBottom: 8 }} />
            <Btn variant="plain" onClick={loadModels} disabled={!lUrl.trim() || !lKey.trim()} style={{ width: "100%", marginBottom: 8 }}>
              Charger les modèles du serveur
            </Btn>
            {lMsg && <Body style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>{lMsg}</Body>}
            {lModels?.length > 0 && (
              <div role="group" aria-label="Modèles du serveur" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {lModels.map((id) => (
                  <button key={id} type="button" className="p-tap p-chip" aria-pressed={lModel === id} onClick={() => setLModel(id)}>{id}</button>
                ))}
              </div>
            )}
            <Btn variant="primary" onClick={() => { setLitellmUrl(lUrl.trim()); setLitellmKey(lKey.trim()); setLitellmModel(lModel.trim()); setMsg("Réglages enregistrés."); }} style={{ width: "100%" }}>
              Enregistrer
            </Btn>
            <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
              Clé stockée uniquement sur cet appareil, envoyée à ton serveur LiteLLM. La lecture d'un lien dans Carte resto n'existe qu'avec un modèle Claude.
            </Body>
          </>
        ) : (
          <>
            <Label style={{ marginBottom: 6 }}>Clé API Anthropic</Label>
            <TextInput type="password" value={k} onChange={(e) => setK(e.target.value)} placeholder="sk-ant-..." style={{ marginBottom: 10 }} />
            <Label style={{ marginBottom: 6 }}>Modèle</Label>
            <TextInput value={m} onChange={(e) => setM(e.target.value)} placeholder="claude-sonnet-5-5" style={{ marginBottom: 12 }} />
            <Btn variant="primary" onClick={() => { setApiKey(k.trim()); setModel(m.trim() || "claude-sonnet-5-5"); setMsg("Réglages enregistrés."); }} style={{ width: "100%" }}>
              Enregistrer
            </Btn>
            <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
              Clé stockée uniquement sur cet appareil, envoyée directement à l'API Anthropic. Chaque analyse consomme des crédits.
            </Body>
          </>
        )}
      </Card>

      <Card>
        <Label style={{ marginBottom: 8 }}>Sauvegarde des données</Label>
        {/* Bandeau d'alerte : c'est lui, pas le bouton, qui fait que la sauvegarde a lieu. */}
        {isBackupStale(lastCloudBackup) && (
          <div style={{
            background: C.dangerBg, border: `1.5px solid ${C.danger}`, borderRadius: 8,
            padding: "9px 11px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, color: C.danger, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ⚠ Sauvegarde hors du téléphone
            </div>
            <Body style={{ color: C.dangerText, fontSize: 13, marginTop: 3 }}>
              {lastCloudBackup
                ? `Dernière il y a ${daysSinceBackup(lastCloudBackup)} jours (${fmt(lastCloudBackup)}).`
                : "Jamais faite."} Perdre ou casser le téléphone effacerait tout l'historique.
            </Body>
          </div>
        )}
        <Btn variant="primary" onClick={doExport} style={{ width: "100%" }}>
          <Download size={14} style={{ display: "inline", marginRight: 4 }} />Sauvegarder hors du téléphone
        </Btn>
        <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
          {Capacitor.isNativePlatform()
            ? "Ouvre le partage Android : envoie le fichier vers Drive, un mail ou Fichiers. Rappel automatique au bout d'une semaine sans sauvegarde."
            : "Télécharge le fichier JSON complet. Vider les données du navigateur effacerait l'app."}
          {lastCloudBackup && !isBackupStale(lastCloudBackup) ? ` Dernière : ${fmt(lastCloudBackup)}.` : ""}
        </Body>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
          <label>
            <span style={{
              display: "block", textAlign: "center", background: C.card, color: C.accent,
              border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: "9px 12px",
              fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer",
            }}><Upload size={14} style={{ display: "inline", marginRight: 4 }} />Restaurer un fichier</span>
            <input type="file" accept="application/json" onChange={doImport} style={{ display: "none" }} />
          </label>
        </div>
        {Capacitor.isNativePlatform() && (
          <Body style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>
            Sauvegarde auto locale (dossier Documents/Protocole) : {lastAutoBackup ? `dernière le ${fmt(lastAutoBackup)}` : "pas encore faite"}.
            Ne remplace pas celle ci-dessus : elle reste sur le téléphone, donc elle disparaît avec lui.
          </Body>
        )}
      </Card>

      {msg && <Body style={{ color: C.accent, fontSize: 12 }}>{msg}</Body>}
      <Body style={{ fontSize: 12, color: C.dim, textAlign: "center", fontFamily: C.mono }}>Protocole v{APP_VERSION}</Body>
    </div>
  );
}
