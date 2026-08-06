import { useCallback, useEffect, useState } from "react";
import { loadUserData, saveUserData } from "./userData.js";

// Chargement + écriture partagés de la ligne user_data — extrait de Home.jsx (RawCare Phase
// 2, deuxième jalon) pour que plusieurs écrans (Poids, puis Séances/Macros/Douleurs...)
// lisent/écrivent le même état sans re-fetch à chaque changement d'onglet.
export function useUserData(userId) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("loading");
    loadUserData(userId)
      .then((d) => { setData(d); setStatus("ready"); })
      .catch((e) => { setError(String(e.message || e)); setStatus("error"); });
  }, [userId]);

  // `patch` est fusionné avec les données actuelles (comme un setState partiel) ; passer un
  // objet complet écraserait les autres clés, donc les appelants ne fournissent que ce qui
  // change (ex. { weightLog: next }).
  const update = useCallback(async (patch) => {
    setStatus("saving");
    setError("");
    try {
      const next = { ...data, ...patch };
      await saveUserData(userId, next);
      setData(next);
      setStatus("ready");
      return next;
    } catch (e) {
      setError(String(e.message || e));
      setStatus("error");
      throw e;
    }
  }, [data, userId]);

  return { data, status, error, update };
}
