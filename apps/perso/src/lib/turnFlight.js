// Un seul tour de Jeffrey à la fois dans l'app (audit du 10/11/2026, point 13). La conversation
// est affichée par deux composants (onglet Analyse et surimpression de la bulle) qui ne partagent
// pas leur état « occupé » : ce petit verrou en mémoire, lui, est commun. Rien n'est stocké.
let inFlight = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const turnFlight = {
  /** Prend le verrou. `false` si un tour est déjà en cours (rien n'est alors à rendre). */
  begin() {
    if (inFlight > 0) return false;
    inFlight = 1;
    emit();
    return true;
  },
  end() {
    if (inFlight === 0) return;
    inFlight = 0;
    emit();
  },
  count: () => inFlight,
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
};
