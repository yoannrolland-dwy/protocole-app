// Stockage local persistant (localStorage) + export/import JSON.
// Même API async (get/set) que la version artefact, pour ne rien changer dans App.jsx.

const PREFIX = "protocole:";

export const store = {
  async get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error("storage", e);
    }
  },
  async del(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};

// Clés de données (hors clé API, qui n'est pas exportée par sécurité).
// Toute nouvelle clé doit être ajoutée ici, sinon elle serait absente de l'export et
// silencieusement perdue à la prochaine restauration.
// `coachProfile` (contexte permanent écrit par l'utilisateur) et `coachJournal` (carnet de
// bord tenu par le modèle) sont du texte libre, ajoutés le 30/07/2026.
export const DATA_KEYS = [
  "weightLog", "sleepLog", "trainingLog", "kneeLog", "macroLog", "noteLog", "stepsLog",
  "targets", "phase", "hsrWeek", "model",
  "coachProfile", "coachJournal",
];

export function exportData() {
  const data = {};
  DATA_KEYS.forEach((k) => {
    const v = localStorage.getItem(PREFIX + k);
    if (v != null) { try { data[k] = JSON.parse(v); } catch { /* ignore */ } }
  });
  return { app: "PROTOCOLE", schema: 1, exportedAt: new Date().toISOString(), data };
}

export function importData(obj) {
  const data = obj && obj.data ? obj.data : obj;
  if (!data || typeof data !== "object") throw new Error("format invalide");
  DATA_KEYS.forEach((k) => {
    if (data[k] !== undefined) localStorage.setItem(PREFIX + k, JSON.stringify(data[k]));
  });
}
