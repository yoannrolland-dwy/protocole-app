import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// État de session, partagé par tout écran qui a besoin de savoir si quelqu'un est connecté.
// `onAuthStateChange` couvre à la fois la connexion initiale (session déjà en cache dans le
// navigateur) et les changements en cours de vie de l'app (connexion/déconnexion) — pas
// besoin d'un `getSession()` séparé en plus, l'abonnement le déclenche déjà une première
// fois avec l'état courant.
export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = pas encore su, null = déconnecté

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading: session === undefined };
}
