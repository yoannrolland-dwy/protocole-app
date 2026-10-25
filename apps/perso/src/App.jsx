import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { store, getSync } from "./store.js";
import { scheduleBackupReminder } from "./cloudBackup.js";
import { computeEnergyScore, scoreLabel } from "@rawcare/core/energy";
import { computeBilanFacts } from "@rawcare/core/bilan";
import { PHASES, DEFAULT_TARGETS, targetsForDate, kcalFromMacros, kcalOfEntry, tdeeNow, buildKcalByDate, weightTrend7, recompWindows } from "@rawcare/core/targets";
import { recommendTargets, palierWeekOf, loggedRateLastDays } from "@rawcare/core/palier";
import { nextSessions } from "@rawcare/core/nextSession";
import { buildCoachPrompt, buildCoachBriefing, buildBilanPrompt, SEED_COACH_PROFILE } from "@rawcare/core/coach/prompt";
import { syncHealthConnect } from "./healthSync.js";
import { updateDashboardWidget } from "./widgetSync.js";
import { runAutoBackup } from "./autoBackup.js";
import { C, today, shiftDateKey, fmt, round, longDate, byDate, upsert, lastN, fmtHM } from "./ui.jsx";
import { Empty } from "./design/compat.jsx"; // « Chargement… » en gris lisible v2
import NutritionTab from "./nutrition/NutritionTab.jsx";
import { isSilentSync, finishSilentSync } from "./silentSync.js";
import { STEPS_TARGET, scoreColor } from "./lib/helpers.js";
import { progressColor } from "./lib/progress.js";
import { COLORS } from "./design/tokens.js";
import { familiesForToday, isMatchWeek, isPostMatchDay, planForDate } from "./lib/plan.js";
import { SettingsPanel } from "./screens/settings/SettingsPanel.jsx";
import { Dashboard } from "./screens/dashboard/Dashboard.jsx";
import { WeightTab } from "./screens/WeightTab.jsx";
import { SleepTab } from "./screens/SleepTab.jsx";
import { StepsTab } from "./screens/StepsTab.jsx";
import { TrainTab } from "./screens/train/TrainTab.jsx";
import { PainTab } from "./screens/PainTab.jsx";
import { PerformanceTab } from "./screens/perf/PerformanceTab.jsx";
import { CorpsTab, CORPS_SUBS } from "./screens/CorpsTab.jsx";
import { TabBar, TABS } from "./components/TabBar.jsx";
import { AppHeader } from "./components/AppHeader.jsx";
import { SessionBar } from "./components/SessionBar.jsx";

/* ============================================================
   PROTOCOLE — console perso de suivi (Yoann) · PWA
   Design "Affirmée" : noir profond, accent citron vert, mono.
   Logique inchangée : carnet série par série, mémoire des
   charges, timer, stockage local persistant, coach IA.

   Depuis le 25/10/2026 (chantier U, U0) ce fichier ne contient plus
   que le composant racine (état, synchro, navigation) : chaque écran
   vit dans src/screens/, les utilitaires partagés dans src/lib/.
   ============================================================ */

export default function App({ silent = false } = {}) {
  const [tab, setTab] = useState("dash");
  // U3 étape 1 (25/10/2026) : Poids, Énergie, Pas et Genou vivent dans l'onglet « Corps ».
  // Le dernier sous-onglet ouvert est retenu pendant la session (pas sauvegardé).
  const [corpsSub, setCorpsSub] = useState("weight");
  // Les écrans (tuiles du tableau de bord…) appellent encore les anciennes clés d'onglet
  // ("weight", "sleep"…) : `goTo` les envoie sur le bon sous-onglet de Corps.
  const goTo = (key) => {
    if (CORPS_SUBS.some((c) => c.key === key)) { setCorpsSub(key); setTab("corps"); }
    else setTab(key);
    setShowSettings(false);
  };
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  const [weight, setWeight] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [training, setTraining] = useState([]);
  const [knee, setKnee] = useState([]);
  // T3 : type de séance à ouvrir directement dans le carnet depuis « Démarrer » (Dashboard).
  // Consommé par TrainTab à son montage, puis remis à null.
  const [startType, setStartType] = useState(null);
  const startSession = (type) => { setStartType(type); setTab("train"); };
  // FC repos (Health Connect, natif seulement — 05/09/2026, score d'énergie) : `{date, bpm}`,
  // même famille que weightLog/stepsLog. Vide sur la PWA (jamais synchronisée), le score
  // d'énergie affiche alors "pas assez de données" plutôt qu'un chiffre inventé.
  const [rhr, setRhr] = useState([]);
  // Siestes détectées par la montre (Health Connect, natif seulement — 23/09/2026, gestion
  // des siestes) : `{date, minutes}`. Jamais de saisie manuelle (comme rhrLog), pas de champ
  // "source" à arbitrer. Affichées à titre informatif dans l'onglet Énergie, à côté du vrai
  // sommeil — volontairement PAS intégrées au score d'énergie/de sommeil pour l'instant (la
  // science ne les rattache ni à la nuit d'avant ni à celle d'après, voir la discussion).
  const [naps, setNaps] = useState([]);
  const [macros, setMacros] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [phase, setPhaseState] = useState("seche");
  const [hsrWeek, setHsrWeekState] = useState(1);
  // Planning Basket fixe (01/09/2026) : `weekly` = jours de semaine récurrents (entraînement
  // hebdo, 0=dimanche...6=samedi comme Date#getDay()), `matchDates` = dates ponctuelles
  // (calendrier de matchs, irrégulier — pas un simple jour de semaine). Défaut vide : aucun
  // effet sur le recommandeur tant que rien n'est configuré dans les Réglages.
  const [basketSchedule, setBasketScheduleState] = useState({ weekly: [], matchDates: [] });
  // Historique des paliers de cibles (chantier R, R2, 02/10/2026) : une entrée par changement
  // des kcal de base, voir `save.targets`. Clé `targetHistory` (DATA_KEYS).
  const [targetHistory, setTargetHistory] = useState([]);
  // "Palier de la semaine" (R3) : proposition FIGÉE par semaine (`weekOf` = lundi), jamais un
  // chiffre recalculé chaque jour au gré du bruit de la balance. `palierTick` force une
  // revérification au retour au premier plan (la semaine a pu changer entre-temps).
  const [palierWeekly, setPalierWeekly] = useState(null);
  const [palierTick, setPalierTick] = useState(0);
  const [apiKey, setApiKeyState] = useState("");
  const [model, setModelState] = useState("claude-sonnet-5-5");
  const [coachProfile, setCoachProfileState] = useState("");
  const [coachJournal, setCoachJournalState] = useState("");
  const [lastAutoBackup, setLastAutoBackup] = useState(null);
  const [lastCloudBackup, setLastCloudBackup] = useState(null);

  useEffect(() => {
    (async () => {
      setWeight(await store.get("weightLog", []));
      setSleep(await store.get("sleepLog", []));
      // Migration (01/09/2026) : "Leg curl bilatéral" était une erreur de nom, l'exercice
      // réel est unilatéral — le gabarit Lower B a été corrigé, mais le nom d'un exercice
      // est aussi sa clé d'historique (lastPerf/records/progression matchent par `nom`).
      // Sans renommer aussi les séances déjà enregistrées, l'historique de cet exercice
      // repartirait de zéro. Idempotent : sans occurrence à corriger, c'est un no-op.
      const rawTraining = await store.get("trainingLog", []);
      let trainingMigrated = false;
      const migratedTraining = rawTraining.map((s) => {
        if (!s.exercices?.some((e) => e.nom === "Leg curl bilatéral")) return s;
        trainingMigrated = true;
        return { ...s, exercices: s.exercices.map((e) => (e.nom === "Leg curl bilatéral" ? { ...e, nom: "Leg curl unilatéral" } : e)) };
      });
      if (trainingMigrated) store.set("trainingLog", migratedTraining);
      setTraining(migratedTraining);
      setKnee(await store.get("kneeLog", []));
      setRhr(await store.get("rhrLog", []));
      setNaps(await store.get("napLog", []));
      setMacros(await store.get("macroLog", []));
      setSteps(await store.get("stepsLog", []));
      setNotes(await store.get("noteLog", []));
      // Fusion avec les défauts : un `targets` déjà stocké (sans le sous-objet `cut`, qui
      // n'existait pas avant le 30/07/2026) écraserait sinon entièrement les défauts et
      // laisserait `cut` absent. La fusion comble les champs manquants sans toucher aux
      // valeurs que l'utilisateur a réglées, et couvrira aussi les champs futurs.
      const storedTargets = await store.get("targets", {});
      setTargets({ ...DEFAULT_TARGETS, ...storedTargets, cut: { ...DEFAULT_TARGETS.cut, ...(storedTargets.cut || {}) } });
      setPhaseState(await store.get("phase", "seche"));
      setHsrWeekState(await store.get("hsrWeek", 1));
      setTargetHistory(await store.get("targetHistory", []));
      setPalierWeekly(await store.get("palierWeekly", null));
      // Purge des dates de match passées (30/09/2026, décision explicite de Yoann) : une date
      // passée n'a plus aucun effet (le recommandeur ne regarde que le dimanche à venir) et
      // n'a pas à encombrer la liste des Réglages. Strictement antérieure à aujourd'hui : un
      // match le jour même reste, `isMatchWeek` en a besoin le dimanche. La clé n'est réécrite
      // que si quelque chose a été retiré — même pattern que la migration Leg curl ci-dessus.
      const rawSchedule = await store.get("basketSchedule", { weekly: [], matchDates: [] });
      const allMatches = rawSchedule.matchDates || [];
      // Garde aussi HIER (04/10/2026) : sans elle, le lundi l'app aurait déjà effacé le match
      // de la veille et ne pourrait pas savoir que c'est un jour de Full Body (`isPostMatchDay`).
      const futureMatches = allMatches.filter((d) => d >= shiftDateKey(today(), -1));
      const purgedSchedule = futureMatches.length === allMatches.length ? rawSchedule : { ...rawSchedule, matchDates: futureMatches };
      if (purgedSchedule !== rawSchedule) store.set("basketSchedule", purgedSchedule);
      setBasketScheduleState(purgedSchedule);
      setApiKeyState(await store.get("apiKey", ""));
      setModelState(await store.get("model", "claude-sonnet-5-5"));
      // Profil : amorcé une seule fois avec les règles auparavant codées en dur, pour que
      // rien ne soit perdu au passage. `null` = jamais initialisé ; une chaîne vide est un
      // choix délibéré de l'utilisateur et n'est donc jamais réamorcée.
      const storedProfile = await store.get("coachProfile", null);
      if (storedProfile == null) {
        setCoachProfileState(SEED_COACH_PROFILE);
        store.set("coachProfile", SEED_COACH_PROFILE);
      } else {
        setCoachProfileState(storedProfile);
      }
      setCoachJournalState(await store.get("coachJournal", ""));
      setLastAutoBackup(await store.get("lastAutoBackupDate", null));
      // Hors de DATA_KEYS volontairement (voir cloudBackup.js) : restaurer une vieille
      // sauvegarde ne doit pas faire croire à l'app qu'elle vient d'être sauvegardée.
      setLastCloudBackup(await store.get("lastCloudBackup", null));
      setLoading(false);
    })();
  }, []);

  // Synchro Health Connect (app native uniquement, no-op sur la PWA) — pas + sommeil,
  // 14 derniers jours, écrase toujours la valeur locale du jour concerné.
  const [healthSync, setHealthSync] = useState({ status: "idle", at: null });
  const runHealthSync = async () => {
    setHealthSync((s) => ({ ...s, status: "running" }));
    const result = await syncHealthConnect();
    if (result.status !== "ok") {
      setHealthSync({ status: result.status, message: result.message || result.reason, at: new Date().toISOString() });
      return;
    }
    if (Object.keys(result.stepsByDate).length) {
      setSteps((prev) => {
        let next = prev;
        Object.entries(result.stepsByDate).forEach(([date, count]) => { next = upsert(next, { date, count, source: "healthconnect" }); });
        store.set("stepsLog", next);
        return next;
      });
    }
    if (Object.keys(result.sleepByDate).length) {
      setSleep((prev) => {
        let next = prev;
        // quality n'est présent que les nuits où Health Connect a le détail par phase
        // (voir HealthNutritionPlugin.readSleep) — absent, on ne touche pas à une note
        // saisie à la main pour ce jour-là.
        Object.entries(result.sleepByDate).forEach(([date, d]) => {
          next = upsert(next, { date, hours: round(d.hours, 2), ...(d.quality != null ? { quality: d.quality } : {}), source: "healthconnect" });
        });
        store.set("sleepLog", next);
        return next;
      });
    }
    // Nutrition/eau : plus lues depuis Health Connect (bascule M6, 02/08/2026) — foodLog
    // est l'unique écrivain de macroLog désormais, voir la dérivation dans NutritionTab.jsx.
    if (Object.keys(result.weightByDate || {}).length || Object.keys(result.weightTimeByDate || {}).length) {
      setWeight((prev) => {
        let next = prev;
        // `time` (08/10/2026, heure de pesée) : "HH:MM" local, posé seulement quand Health Connect
        // la fournit — une pesée manuelle n'en a pas. Affichée dans l'historique du poids.
        Object.entries(result.weightByDate || {}).forEach(([date, kg]) => {
          const time = result.weightTimeByDate?.[date];
          next = upsert(next, { date, kg, source: "healthconnect", ...(time ? { time } : {}) });
        });
        // Rattrapage de l'heure seule (90 j) sur les pesées déjà présentes hors fenêtre de synchro.
        Object.entries(result.weightTimeByDate || {}).forEach(([date, time]) => {
          if (result.weightByDate?.[date] != null) return;
          const cur = next.find((w) => w.date === date);
          if (cur && !cur.time) next = upsert(next, { ...cur, time });
        });
        store.set("weightLog", next);
        return next;
      });
    }
    // FC repos (05/09/2026, score d'énergie) — pas de note "source" ici : contrairement au
    // poids/sommeil/pas, il n'existe aucune saisie manuelle de la FC repos dans l'app, donc
    // pas de conflit "manuel vs synchronisé" à arbitrer.
    if (Object.keys(result.rhrByDate || {}).length) {
      setRhr((prev) => {
        let next = prev;
        Object.entries(result.rhrByDate).forEach(([date, bpm]) => { next = upsert(next, { date, bpm }); });
        store.set("rhrLog", next);
        return next;
      });
    }
    if (Object.keys(result.napsByDate || {}).length) {
      setNaps((prev) => {
        let next = prev;
        Object.entries(result.napsByDate).forEach(([date, minutes]) => { next = upsert(next, { date, minutes }); });
        store.set("napLog", next);
        return next;
      });
    }
    setHealthSync({ status: "ok", at: new Date().toISOString() });
  };

  useEffect(() => {
    if (loading) return;
    (async () => {
      await runHealthSync();
      // Lancé par le bouton Sync du widget (activité invisible, voir SilentSyncActivity.kt) :
      // laisser React committer les setState de runHealthSync (donc l'effet qui pousse
      // l'instantané au widget, plus bas) avant de refermer l'activité.
      if (await isSilentSync()) {
        setTimeout(finishSilentSync, 150);
      }
    })();
  }, [loading]);

  // Sauvegarde locale auto (une fois par jour, voir autoBackup.js) : un ref pour lire la
  // dernière date à jour depuis le listener "resume" (monté une seule fois, sinon il
  // resterait bloqué sur la valeur de `lastAutoBackup` au premier rendu).
  const lastAutoBackupRef = useRef(lastAutoBackup);
  useEffect(() => { lastAutoBackupRef.current = lastAutoBackup; }, [lastAutoBackup]);
  const doAutoBackup = () => {
    runAutoBackup(lastAutoBackupRef.current, (date) => {
      lastAutoBackupRef.current = date;
      setLastAutoBackup(date);
      store.set("lastAutoBackupDate", date);
    });
  };
  useEffect(() => {
    if (loading) return;
    doAutoBackup();
  }, [loading]);

  // Rappel de sauvegarde externe : reprogrammé au démarrage ET après chaque sauvegarde
  // (la date change ⇒ l'échéance recule). Sans la dépendance à `lastCloudBackup`, un export
  // fait aujourd'hui laisserait le rappel de la semaine dernière sonner quand même.
  useEffect(() => {
    if (loading) return;
    scheduleBackupReminder(lastCloudBackup);
  }, [loading, lastCloudBackup]);
  const markCloudBackup = () => {
    const d = today();
    setLastCloudBackup(d);
    store.set("lastCloudBackup", d);
  };

  // Resynchro à chaque retour au premier plan (pas seulement au lancement à froid)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener("resume", () => { runHealthSync(); doAutoBackup(); setPalierTick((t) => t + 1); });
    return () => { handle.then((h) => h.remove()); };
  }, []);

  // Widget d'écran d'accueil (Android) : 5 valeurs des tuiles du tableau de bord
  // (Poids, Calories, Énergie, Pas, Eau), reformatées pour l'affichage natif — la 6e
  // tuile du widget est un bouton Sync, pas une donnée (voir widgetSync.js /
  // DashboardWidgetProvider.kt). La tuile "Sommeil" est devenue "Énergie" le 05/09/2026 :
  // valeur = score d'énergie, note = durée de sommeil réelle (demande explicite de Yoann,
  // qui préfère la durée brute au score de sommeil sur cette tuile).
  useEffect(() => {
    if (loading || !Capacitor.isNativePlatform()) return;
    const wLast = lastN(weight, 1)[0];
    const lastNightDash = lastN(sleep, 1)[0];
    const energyDash = computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps });
    const mToday = macros.find((m) => m.date === today());
    const kcalToday = mToday ? Math.round(kcalOfEntry(mToday)) : null;
    const stepsToday = steps.find((s) => s.date === today())?.count ?? 0;
    const waterToday = mToday?.water ?? 0;
    const basketToday = training.some((t) => t.type === "Basket" && t.date === today());
    const waterTgt = targets.water + (basketToday ? 1000 : 0);
    const at = targetsForDate(today(), targets);
    const kcalTgt = Math.round(kcalFromMacros(at.protein, at.carbs, at.fat, at.fiber));

    // Notes raccourcies le 25/10/2026 (« / 3210 », « Nuit 5h12 », « MAJ 21:35 ») : en 12 sp elles
    // ne tenaient plus sur une ligne dans les tuiles du widget.
    // Couleurs (25/10/2026) : mêmes règles que les tuiles du tableau de bord. Le chiffre reste
    // blanc tant que la cible n'est pas atteinte (citron = « en cours »), puis prend la couleur
    // de `progressColor` ; pour l'énergie, seul le libellé est coloré (`scoreColor`). "" = blanc.
    const valColor = (c) => (c === COLORS.accent ? "" : c);
    updateDashboardWidget({
      poids: { value: wLast ? `${wLast.kg} kg` : "—", note: wLast ? fmt(wLast.date) : "—" },
      pas: { value: stepsToday.toLocaleString("fr-FR"), note: `/ ${STEPS_TARGET.toLocaleString("fr-FR")}`,
        color: valColor(progressColor(stepsToday, STEPS_TARGET, "goal")) },
      calories: { value: kcalToday != null ? `${kcalToday}` : "—", note: `/ ${kcalTgt}`,
        color: valColor(progressColor(kcalToday, kcalTgt, "limit")) },
      eau: { value: `${(waterToday / 1000).toFixed(2)} L`, note: `/ ${(waterTgt / 1000).toFixed(1)} L`,
        color: valColor(progressColor(waterToday, waterTgt, "goal")) },
      energie: {
        value: energyDash.status === "ok" ? `${energyDash.total} ${scoreLabel(energyDash.total)}` : "—",
        note: lastNightDash ? `Nuit ${fmtHM(lastNightDash.hours)}` : "—",
        labelColor: energyDash.status === "ok" ? scoreColor(energyDash.total) : "",
      },
      // Pas de "value" affichée pour ce tile (juste l'icône Sync) — seule la note sert,
      // horodatage du dernier instantané poussé au widget (peu importe si déclenché par
      // l'ouverture normale de l'app ou par le bouton Sync lui-même).
      // "À jour · dernière synchro : HH:MM:SS" tient sur 4 lignes et écrase l'icône dans
      // une tuile aussi étroite — condensé pour rester sur une ligne comme les autres notes.
      sync: { value: "", note: `MAJ ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` },
    });
  }, [loading, weight, sleep, macros, steps, training, targets, naps]);

  const save = {
    weight: (v) => { setWeight(v); store.set("weightLog", v); },
    sleep: (v) => { setSleep(v); store.set("sleepLog", v); },
    training: (v) => { setTraining(v); store.set("trainingLog", v); },
    knee: (v) => { setKnee(v); store.set("kneeLog", v); },
    rhr: (v) => { setRhr(v); store.set("rhrLog", v); },
    naps: (v) => { setNaps(v); store.set("napLog", v); },
    macros: (v) => { setMacros(v); store.set("macroLog", v); },
    steps: (v) => { setSteps(v); store.set("stepsLog", v); },
    notes: (v) => { setNotes(v); store.set("noteLog", v); },
    // Historique des paliers (chantier R, R2) : une entrée datée à chaque changement des kcal
    // de BASE (jamais pour un poids cible ou la fenêtre de sèche) — le Coach IA et le "Palier
    // de la semaine" (R3) ont besoin de savoir QUAND les cibles ont changé. Comparé à l'état
    // précédent, pas à la dernière entrée : pas d'amorçage à la date du jour sur un
    // historique vide (ça créerait à tort une période d'observation de 14 j). Plusieurs
    // changements le même jour = une seule entrée (la dernière remplace).
    // Correctif du 02/10/2026 (retour de Yoann : −10 g protéines puis +10 g glucides à total
    // constant avaient été enregistrés comme un palier) : l'entrée du jour porte `prevKcal`
    // = kcal en DÉBUT de journée, et c'est le changement NET du jour qui compte. Si une
    // retouche ramène exactement au point de départ, l'entrée du jour est supprimée ; sous
    // 100 kcal net elle reste journalisée mais n'est pas un palier (`isPalierEntry`, palier.js).
    targets: (v, source = "manual") => {
      const kcalOf = (t) => Math.round(kcalFromMacros(t.protein, t.carbs, t.fat, t.fiber));
      const nextKcal = kcalOf(v), prevState = kcalOf(targets);
      if (nextKcal !== prevState) {
        const d = today();
        const sameDay = targetHistory.at(-1)?.date === d ? targetHistory.at(-1) : null;
        const rest = sameDay ? targetHistory.slice(0, -1) : targetHistory;
        const prevKcal = sameDay?.prevKcal ?? prevState;
        const next = nextKcal === prevKcal && sameDay?.source !== "palier"
          ? rest // retour au point de départ : la journée n'a rien changé
          : [...rest, { date: d, kcal: nextKcal, prevKcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: v.fiber, source: sameDay?.source === "palier" ? "palier" : source }];
        setTargetHistory(next); store.set("targetHistory", next);
      }
      setTargets(v); store.set("targets", v);
    },
  };
  // "Palier de la semaine" (R3) — calcul figé par semaine. Ne tourne qu'une fois les données
  // chargées (`loading`), en phase Recomposition, et seulement si la semaine stockée n'est
  // plus la semaine courante (`palierWeekOf`, bascule dimanche 14 h) : idempotent, l'app
  // peut être ouverte dix fois le dimanche sans recalcul. Mêmes fonctions que le reste de
  // l'app (`weightTrend7`, `recompWindows`) — jamais deux chiffres différents.
  // Correctif du 02/10/2026 : la proposition mémorise les cibles sur lesquelles elle s'est
  // basée (`baseTargets`). Si Yoann les modifie à la main ensuite (et qu'elle n'a pas été
  // appliquée), elle se recalcule tout de suite au lieu d'afficher une photo périmée — un
  // changement manuel est une décision explicite, pas du bruit de balance. Une proposition
  // déjà appliquée reste figée (ses cibles sont forcément différentes de la base).
  useEffect(() => {
    if (loading || !PHASES[phase]?.noTarget) return;
    const wk = palierWeekOf(new Date());
    const baseNow = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fiber: targets.fiber };
    const sameWeek = palierWeekly?.weekOf === wk;
    const baseChanged = !palierWeekly?.appliedAt && JSON.stringify(palierWeekly?.baseTargets ?? null) !== JSON.stringify(baseNow);
    if (sameWeek && !baseChanged) return;
    const foodLog = getSync("foodLog", []), overrides = getSync("foodOverrides", {});
    const kcalByDate = buildKcalByDate({ foodLog, overrides, macros, today: today() });
    const result = recommendTargets({
      targets, trend: weightTrend7(weight, today()),
      recomp: recompWindows({ foodLog, overrides, macros, weight, targets }),
      targetHistory, loggedRate7: loggedRateLastDays(kcalByDate, today()),
    });
    const next = { weekOf: wk, computedAt: new Date().toISOString(), baseTargets: baseNow, result, appliedAt: null };
    setPalierWeekly(next); store.set("palierWeekly", next);
  }, [loading, phase, palierWeekly, weight, macros, targets, targetHistory, palierTick]);
  // Bouton « Appliquer » : la SEULE voie d'écriture des cibles reste `save.targets` (qui
  // journalise l'entrée `targetHistory`, ici avec `source: "palier"`).
  const applyPalier = () => {
    const p = palierWeekly?.result?.proposed;
    if (!p) return;
    save.targets({ ...targets, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber }, "palier");
    const next = { ...palierWeekly, appliedAt: today() };
    setPalierWeekly(next); store.set("palierWeekly", next);
  };
  const setPhase = (v) => { setPhaseState(v); store.set("phase", v); };
  const setHsrWeek = (v) => { setHsrWeekState(v); store.set("hsrWeek", v); };
  const setBasketSchedule = (v) => { setBasketScheduleState(v); store.set("basketSchedule", v); };
  const setApiKey = (v) => { setApiKeyState(v); store.set("apiKey", v); };
  const setModel = (v) => { setModelState(v); store.set("model", v); };
  const setCoachProfile = (v) => { setCoachProfileState(v); store.set("coachProfile", v); };
  const setCoachJournal = (v) => { setCoachJournalState(v); store.set("coachJournal", v); };

  const todayNote = notes.find((n) => n.date === today())?.text || "";
  const saveNote = (text) => {
    const t = (text || "").trim();
    const rest = notes.filter((n) => n.date !== today());
    save.notes(t ? [...rest, { date: today(), text: t }].sort(byDate) : rest);
  };
  // Écrit par le modèle en fin d'analyse (voir splitCarnet), relisible et corrigeable dans
  // les Réglages : c'est la mémoire du coach, elle ne doit pas être une boîte noire.
  const saveJournal = (text) => setCoachJournal((text || "").trim());

  // Assemble le "sac de données" pour @rawcare/core/coach/prompt. `foodLog`/`foodOverrides`
  // sont lus fraîchement (getSync, jamais mis en cache) au moment précis de l'appel — un
  // repas ajouté dans l'onglet Repas pendant la session en cours doit être vu immédiatement.
  const coach = {
    buildPrompt: (note, { profile = coachProfile, journal = coachJournal } = {}) =>
      buildCoachPrompt({
        weight, sleep, training, knee, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile, journal, basketSchedule, weeklyPlan: familiesForToday(basketSchedule),
        matchWeek: isMatchWeek(basketSchedule), postMatch: isPostMatchDay(basketSchedule), targetHistory, palier: palierWeekly,
        // Recommandeur temporel (S2) : même verdict Aujourd'hui/Demain que la carte du Dashboard.
        nextSession: nextSessions({ now: new Date(), base: { training, knee, sleep, targets, basketSchedule,
          energy: computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }) }, planFor: planForDate(basketSchedule) }),
        energy: computeEnergyScore(today(), { rhrLog: rhr, sleepLog: sleep, stepsLog: steps, napLog: naps }),
      }, note),
    buildBriefing: () =>
      buildCoachBriefing({
        weight, sleep, training, knee, macros, notes, steps, targets, phase,
        foodLog: getSync("foodLog", []), foodOverrides: getSync("foodOverrides", {}),
        profile: coachProfile, journal: coachJournal,
      }),
    // Bilan long terme (point 4 du chantier IA, 07/09/2026) : mêmes données que l'analyse
    // quotidienne, mais résumées sur 90 jours par `computeBilanFacts` (packages/core/src/
    // bilan.js) — le JS calcule les corrélations, `buildBilanPrompt` ne fait que les mettre
    // en mots. Même calcul TDEE que la carte Macros/point 1 (lecture fraîche foodLog/
    // overrides), jamais un chiffre différent pour la même réalité.
    buildBilan: () => {
      const tdeeResult = tdeeNow({ foodLog: getSync("foodLog", []), overrides: getSync("foodOverrides", {}), macros, weight, targets });
      const atToday = targetsForDate(today(), targets);
      const kcalTargetToday = Math.round(kcalFromMacros(atToday.protein, atToday.carbs, atToday.fat, atToday.fiber));
      const facts = computeBilanFacts({ training, weight, macros, sleep, rhr, steps, knee, targets, tdeeResult, kcalTargetToday, todayDate: today() });
      return buildBilanPrompt({ facts, phase, targets, profile: coachProfile, notes });
    },
    apiKey, model,
  };

  // Retour en haut au changement d'onglet (07/08/2026, retour de Yoann) : `<main>` est un
  // conteneur scrollable UNIQUE dont le contenu change avec `tab` — React ne le démonte pas
  // entre deux onglets, donc le navigateur conservait le scroll de l'onglet précédent au
  // lieu de repartir du haut.
  const mainRef = useRef(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [tab, corpsSub, showSettings]);


  // Lancé par le bouton Sync du widget (SilentSyncActivity, voir main.jsx) : tous les
  // effets ci-dessus (chargement, runHealthSync, mise à jour du widget) tournent
  // normalement, mais rien ne doit jamais s'afficher à l'écran.
  if (silent) return null;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: C.bg, color: C.text,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* En-tête */}
      <AppHeader title={showSettings ? "Réglages" : (() => { const t = TABS.find((x) => x.key === tab); return t?.title ?? t?.label; })()}
        phaseLabel={PHASES[phase].label} settingsOpen={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)} />

      {/* Contenu */}
      <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        {loading ? <Empty>Chargement…</Empty> : showSettings ? (
          <SettingsPanel {...{ apiKey, setApiKey, model, setModel, healthSync, coachProfile, setCoachProfile, coachJournal, setCoachJournal, targets, lastAutoBackup, lastCloudBackup, phase, setPhase, basketSchedule, setBasketSchedule }} onCloudBackupDone={markCloudBackup} saveTargets={save.targets} buildBriefing={coach.buildBriefing} onHealthSync={runHealthSync} onClose={() => setShowSettings(false)} />
        ) : (
          <>
            {tab === "dash" && <Dashboard {...{ weight, sleep, knee, rhr, naps, macros, steps, targets, training, phase, lastCloudBackup, basketSchedule, planFor: planForDate(basketSchedule), palier: palierWeekly, onApplyPalier: applyPalier, saveKnee: save.knee, onStart: startSession }} setTab={goTo} openSettings={() => setShowSettings(true)} />}
            {tab === "corps" && (
              <CorpsTab sub={corpsSub} onSub={setCorpsSub}>
                {corpsSub === "weight" && <WeightTab {...{ weight, targets, save, phase }} />}
                {corpsSub === "sleep" && <SleepTab {...{ sleep, rhr, steps, naps, save }} />}
                {corpsSub === "steps" && <StepsTab {...{ steps, save }} />}
                {corpsSub === "pain" && <PainTab {...{ knee, save, hsrWeek }} />}
              </CorpsTab>
            )}
            {tab === "train" && <TrainTab {...{ training, save, hsrWeek, setHsrWeek, knee, startType }} onStartConsumed={() => setStartType(null)} />}
            {tab === "perf" && <PerformanceTab {...{ macros, targets, training, weight, phase, coach, todayNote, saveNote, saveJournal }} />}
            {tab === "macro" && <NutritionTab targetsFor={(d) => targetsForDate(d, targets)} macros={macros} save={save} training={training} apiKey={apiKey} model={model} />}
          </>
        )}
      </main>

      {/* Séance en cours (U3 étape 3) : rappel + minuteur partagé hors de l'onglet Séance. */}
      {!loading && tab !== "train" && !showSettings && <SessionBar onOpen={() => goTo("train")} />}

      {/* Navigation */}
      <TabBar tab={tab} dimmed={showSettings} onSelect={goTo} />
    </div>
  );
}
