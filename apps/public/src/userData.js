// Lecture/écriture de la ligne unique `user_data` de l'utilisateur connecté — voir
// CLAUDE.md (RawCare Phase 2) pour le choix de schéma : une ligne par utilisateur, une
// colonne `data` JSONB qui reprend exactement la forme de `DATA_KEYS` côté apps/perso
// (weightLog, trainingLog, macroLog, ...). RLS côté Supabase garantit qu'un utilisateur ne
// peut lire/écrire QUE sa propre ligne (policies posées à la création de la table).
import { supabase } from "./supabaseClient.js";

/**
 * Renvoie l'objet `data` de l'utilisateur (ex. `{ weightLog: [...], ... }`).
 * Si la ligne n'existe pas encore (première connexion), en crée une vide plutôt que
 * d'échouer — un nouveau bêta-testeur n'a par définition aucune donnée au premier login.
 */
export async function loadUserData(userId) {
  const { data: row, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (row) return row.data || {};

  const { error: insertError } = await supabase
    .from("user_data")
    .insert({ user_id: userId, data: {} });
  if (insertError) throw insertError;
  return {};
}

/** Remplace intégralement l'objet `data` de l'utilisateur (upsert = crée si absent). */
export async function saveUserData(userId, data) {
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}
