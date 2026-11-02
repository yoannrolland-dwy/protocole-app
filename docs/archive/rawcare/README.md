# RawCare — archive de la version grand public de PROTOCOLE

> Arrêtée le **2 novembre 2026** par Yoann (« je n'en ai plus besoin »). Ce dossier garde de quoi
> comprendre ce qui a été fait et repartir si l'envie revient. Rien ici n'est utilisé par l'app.

| Fichier | Contenu |
|---|---|
| `README.md` (ce fichier) | Ce qu'était RawCare, son architecture, le schéma Supabase, comment repartir |
| `DECISIONS.md` | Les décisions produit (nom, positionnement, modèle économique, légal, sports, douleurs…) |
| `HISTORIQUE-CLAUDE-MD.md` | Les chapitres techniques retirés de `CLAUDE.md` (Phase 0 à 2, onboarding, Coach IA public, socle légal, retours bêta, bascule Netlify, ancien workflow de déploiement) |

**Le code** est dans le repère Git **`rawcare-final`** (commit `5631e68`, 02/11/2026) : dernier
état du dépôt avec `apps/public/` et `netlify.toml`. L'historique Git garde aussi chaque étape.

## Ce que c'était

Une version web de PROTOCOLE pour d'autres sportifs (cercle de la salle d'escalade et de
l'équipe de basket de Yoann), avec comptes. Gratuite, bêta fermée (comptes créés à la main).
Mise en ligne le 06/08/2026, en reprenant le site Netlify qui servait la PWA d'`apps/perso`.

- 7 écrans de données à parité avec l'app perso : Poids, Sommeil, Pas, Séances (carnet complet,
  HSR, records, minuteur web), Douleurs (zones libres), Macros, Repas (CIQUAL + Open Food Facts,
  recettes, portions, corrections) ; plus Accueil (« Prochaine séance ») et Coach IA.
- Onboarding : sports pratiqués (musculation, basket, escalade), zones de douleur (Genou, Coude,
  Autre), cibles macro, échelle d'escalade, clé API Anthropic optionnelle.
- Réglages : préférences (onboarding rejouable), export/import JSON (sans la clé API).
- Pages légales : politique de confidentialité RGPD et mentions légales (rédigées par Claude,
  pas relues par un juriste — suffisant pour une bêta fermée gratuite seulement).
- **Pas fait** : scan code-barres, Carte resto, Photo d'un plat (natif ou clé côté serveur
  nécessaires), Health Connect, catalogue de sports étendu dans l'interface, Jeffrey.

## Architecture

```
protocole-app/                monorepo npm workspaces (toujours en place)
  packages/core/              @rawcare/core — logique métier pure, partagée (toujours en place,
                              apps/perso en dépend)
  apps/perso/                 l'app de Yoann (Android natif, localStorage, sans compte)
  apps/public/                RawCare (retirée le 02/11/2026, voir le repère rawcare-final)
  netlify.toml                build de apps/public sur Netlify (retiré aussi)
```

- **apps/public** : React 19 + Vite 8 + Tailwind 4 + recharts + lucide-react, PWA
  (vite-plugin-pwa), `@supabase/supabase-js` 2.x. Port de dev 5174. Mêmes primitives d'interface
  que la v1 d'`apps/perso` (copie de `ui.jsx`).
- **Données** : une seule table `user_data` (une ligne par utilisateur, colonne `data` en JSONB
  qui reprend exactement la forme de l'export d'`apps/perso` : `weightLog`, `trainingLog`,
  `macroLog`…). `packages/core` consomme ces objets tels quels, zéro couche de transformation.
  Sécurité : Row Level Security, une seule règle (`auth.uid() = user_id`).
- **Écriture** : un seul `update()` par action (fusion puis `upsert` de tout `data`), pour ne
  jamais perdre une écriture entre deux allers-retours réseau.
- **Auth** : email + mot de passe Supabase, pas d'inscription libre.
- **Coach IA** : appel direct du navigateur à l'API Anthropic avec la clé de l'utilisateur
  (jamais via un serveur RawCare). Prompt partagé avec `apps/perso`, dépersonnalisé (paramètres
  `identity`, `zones`, `painLogs` de `buildCoachPrompt`).
- **Recommandeur** : le même que l'app perso (`recommendSessions`), avec des zones de douleur
  dynamiques (paramètre `zones`), suggestions filtrées aux sports cochés à l'onboarding.
- **Hébergement** : Netlify (site statique), Supabase projet `rawCARE`, région UE, offre gratuite.

## Schéma Supabase (reconstitué)

Le SQL avait été tapé directement dans l'éditeur SQL de Supabase le 06/08/2026, jamais commité.
Reconstitué à partir de la documentation et du code (`userData.js` écrit aussi `updated_at`) :
**à relire avant de s'en servir.**

```sql
create table public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "lire ses données" on public.user_data
  for select using (auth.uid() = user_id);
create policy "créer sa ligne" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "modifier ses données" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Pas de règle « delete » : les demandes de suppression (RGPD) passaient par email.
```

Réglages Supabase : Authentication › Providers › Email activé ; inscriptions publiques
désactivées (comptes créés à la main dans Authentication › Users).

## Comment repartir

1. **Ressortir le code** (depuis la racine du dépôt) :
   ```bash
   git checkout rawcare-final -- apps/public netlify.toml
   ```
   puis `npm install` à la racine (le workspace `apps/public` se relie à `@rawcare/core`).
2. **Rattraper `packages/core`** : il a continué d'évoluer pour `apps/perso` après l'arrêt.
   Lancer `npm run build --workspace=apps/public` et corriger ce qui a changé de signature.
   Les gabarits de séance (`TEMPLATES`) et les phrases ont bougé ; `apps/public` a ses propres
   écrans, donc l'essentiel devrait tenir.
3. **Supabase** : créer un projet (région UE), exécuter le SQL ci-dessus, désactiver les
   inscriptions publiques, créer les comptes.
4. **Variables** : copier `apps/public/.env.example` vers `apps/public/.env.local` et y mettre
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (la clé « publishable », jamais la « secret »).
   Mêmes variables dans le tableau de bord Netlify.
5. **Netlify** : créer un site relié au dépôt GitHub ; `netlify.toml` porte la commande
   (`npm run build --workspace=apps/public`) et le dossier publié (`apps/public/dist`). Laisser
   « Build command » et « Publish directory » vides dans le tableau de bord. *Branch deploys* sur
   « None » pour que `dev` ne coûte rien. Piège déjà rencontré : si le build Linux échoue avec
   `Cannot find native binding` (Rolldown), régénérer `package-lock.json` (`rm -rf node_modules
   package-lock.json && npm install`).
6. **Pages légales** (`apps/public/public/privacypolicy.html`, `mentionslegales.html`) : les
   relire et mettre à jour la date, l'hébergeur et le contact. Au-delà d'une bêta fermée
   gratuite, les faire relire par un professionnel.
7. Penser à remettre dans `CLAUDE.md` la règle de construire aussi `apps/public` à chaque
   changement du cœur.

## Ce qui a été perdu à l'arrêt

- Les données stockées dans Supabase (les essais de Yoann et ceux d'éventuels bêta-testeurs),
  supprimées avec le projet.
- L'adresse du site Netlify.
- Rien d'autre : code, décisions et architecture sont ici et dans Git.
