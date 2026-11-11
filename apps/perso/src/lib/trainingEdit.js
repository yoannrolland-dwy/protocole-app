// Séance passée en cours de modification (audit du 10/11/2026, lot 1, point 1).
//
// Le carnet gardait la séance modifiée par RÉFÉRENCE d'objet. Or l'app relit `trainingLog` à
// chaque retour au premier plan (relecture de G3, 05/11/2026) : les objets relus sont neufs, la
// référence ne correspond plus, et « Enregistrer les modifications » ne remplaçait rien, sans
// message. On la retrouve désormais par `id`, et, pour une vieille séance sans `id`, par son
// contenu (la relecture en fait une copie identique).

/** Vrai si `a` et `b` désignent la même séance enregistrée. */
export function sameSession(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.id || b.id) return !!a.id && a.id === b.id;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Remplace la séance `editing` par `rec`, ou ajoute `rec` s'il n'y a rien à modifier.
 * Si la séance modifiée a disparu entre-temps, `rec` est ajoutée plutôt que perdue
 * (`replaced: false`). Ne trie pas : l'appelant garde son ordre.
 */
export function upsertSession(training, editing, rec) {
  const list = training || [];
  if (!editing) return { list: [...list, rec], replaced: false };
  let replaced = false;
  const next = list.map((x) => {
    if (!replaced && sameSession(x, editing)) { replaced = true; return rec; }
    return x;
  });
  return { list: replaced ? next : [...list, rec], replaced };
}
