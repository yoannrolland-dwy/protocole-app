// Client Supabase — RawCare Phase 2. Lit l'URL du projet et la clé publique (publishable/
// anon) depuis les variables d'environnement Vite (`VITE_...`), jamais en dur dans le code :
// voir apps/public/.env.example. La clé publique est conçue pour être exposée côté client
// (protégée par les policies RLS côté base) — la clé secrète (`sb_secret_...`) ne doit
// JAMAIS transiter par ce fichier ni par aucun fichier committé.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// `createClient` lève une exception SYNCHRONE si l'URL est vide (pas une simple erreur
// réseau plus tard) — donc pas question de l'appeler avec des chaînes vides en attendant
// que .env.local soit rempli, ça ferait planter toute l'app au chargement. `supabase` reste
// `null` tant que les deux variables ne sont pas renseignées ; les appelants doivent le
// vérifier avant usage (voir App.jsx).
export const supabase = (url && anonKey) ? createClient(url, anonKey) : null;

if (!supabase) {
  console.warn(
    "[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — copier " +
    "apps/public/.env.example vers apps/public/.env.local et renseigner les vraies valeurs."
  );
}
