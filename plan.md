# SILI-Suite — Plan & Mémoire du Projet

## Architecture générale

**Stack** : Next.js App Router + Supabase (Auth + Postgres + RLS) + Zustand + next-intl (FR/EN)

**URL pattern** :
```
/[locale]/[tenant_slug]/[tenant_id]/[user_id]/                     ← espace tenant
/[locale]/[tenant_slug]/[tenant_id]/[user_id]/[societe_slug]/[societe_id]/[module]  ← espace société
```

**⚠️ Bug connu — UUID tronqué dans l'URL** :
Le `tenant_id` dans l'URL est les 8 premiers caractères du UUID (`tenant_id.substring(0, 8)`).
**Ne jamais utiliser le param URL pour des requêtes Supabase sur colonne UUID.**
Toujours récupérer `profiles.tenant_id` (UUID complet) via `supabase.from('profiles').select('tenant_id')`.

---

## Tables Supabase principales

| Table | Description |
|---|---|
| `public.tenants` | Tenants (organisations). Colonnes clés : `id`, `slug`, `name`, `status`, `max_societes`, `max_licences`, `max_storage_gb` |
| `public.profiles` | Profils utilisateurs. Colonnes : `id` (= auth.users.id), `full_name`, `phone`, `role` (global_role enum), `tenant_id`, `is_super_admin` |
| `public.societes` | Sociétés d'un tenant. Colonnes : `id`, `tenant_id`, `raison_sociale`, `is_active`, `rccm`, `numero_contribuable`, `storage_gb`, `devise`, `site_web`, `capital_social` |
| `public.user_societes` | Liaison utilisateur ↔ société (accès). Colonnes : `user_id`, `societe_id`, `is_active` |
| `public.user_module_permissions` | Permissions par module. Colonnes : `user_id`, `societe_id`, `module`, `permission` (none/viewer/contributor/manager/admin) |
| `public.sys_modules` | Modules disponibles du système |
| `public.tenant_settings` | Paramètres du tenant |

### Rôles globaux (`global_role` enum)
- `super_admin` — accès total à tout
- `tenant_admin` — accès à son tenant + toutes ses sociétés
- `tenant_user` — accès uniquement aux sociétés assignées via `user_societes`

### Rôles par module (`user_module_permissions`)
`none` | `viewer` | `contributor` | `manager` | `admin`
Ces rôles s'appliquent **par module** (vente, achat, stock, rh, crm, comptabilite, rapports, securite), **pas** sur la liaison société.

---

## RLS (Row Level Security) en place

### `public.tenants`
- `tenant_admin` lit uniquement le tenant auquel son `profiles.tenant_id` correspond
- `super_admin` lit tout
- Policy : `tenants_read_admin`

### `public.societes`
- `tenant_admin` lit toutes les sociétés de son tenant (`profiles.tenant_id = societes.tenant_id`)
- `tenant_user` lit uniquement ses sociétés assignées (via `user_societes`) — **à implémenter**
- Policy : `societes_admin_policy`

### `public.user_societes`
- `tenant_user` lit ses propres lignes (`user_id = auth.uid()`)
- `tenant_admin` lit toutes les lignes des sociétés de son tenant
- Écriture : service role uniquement (API route `/api/admin/create-user`)

---

## Pages implémentées

### `/[locale]/[tenant_slug]/[tenant_id]/[user_id]/societes`
**Fichier** : `sili/app/[locale]/[tenant_slug]/[tenant_id]/[user_id]/societes/page.tsx`

Fonctionnalités :
- Liste des sociétés du tenant avec statut actif/inactif
- Indicateur quota : `X / max_societes sociétés` dans la carte header
- Création de société : modal avec champs `raison_sociale`, `devise`, `rccm`, `numero_contribuable`, `storage_gb`
  - `storage_gb` : bordure verte si valide, rouge si dépasse quota restant, bouton désactivé si invalide
  - Quota restant = `max_storage_gb` (tenant) − somme des `storage_gb` existants
- Lignes cliquables → `SocieteDetailModal` avec tous les détails
- Colonne Actions : toggle actif/inactif (stopPropagation)
- **Pattern clé** : `checkSessionAndFetch` → fetch `profiles.tenant_id` (UUID complet) → `fetchAll(realTenantId)`

### `/[locale]/[tenant_slug]/[tenant_id]/[user_id]/utilisateurs`
**Fichier** : `sili/app/[locale]/[tenant_slug]/[tenant_id]/[user_id]/utilisateurs/page.tsx`

Fonctionnalités :
- Liste de tous les utilisateurs du tenant avec rôle et statut
- Indicateur quota : `X / max_licences utilisateurs`
- Bouton "Nouvel Utilisateur" → dropdown choix rôle (Administrateur / Utilisateur)
- Modal création :
  - Champs : `full_name`, `email`, `phone`, `password`
  - Si `tenant_user` : sélection obligatoire de sociétés (checkboxes, au moins 1)
  - Appel API : `POST /api/admin/create-user`
- Lignes cliquables → `UserDetailModal`

### `/[locale]/[tenant_slug]/[tenant_id]/[user_id]/dashboard`
- CompanySwitcher dans la TopBar
- Label "Accéder à une Société" pour le menu société

---

## Composants

### `Header.tsx` (`sili/components/layout/Header.tsx`)
- **CompanySwitcher** : visible si `societes.length >= 1`
  - `tenant_admin/super_admin` : charge toutes les sociétés actives du tenant
  - `tenant_user` : charge uniquement les sociétés assignées via `user_societes`
  - Clic sur société → navigation `/${locale}${tenantBase}/${toSlug(raison_sociale)}/${id}/dashboard`
  - Lien "Gérer les sociétés" pour admins seulement
- **ProfileDropdown** : profil, paramètres, déconnexion

### `middleware.ts`
- Authentification Supabase SSR
- `tenant_user` connecté → redirigé vers sa première société assignée (via `user_societes`)
- Fallback : dashboard tenant si aucune société assignée

---

## API Routes

### `POST /api/admin/create-user`
**Fichier** : `sili/app/api/admin/create-user/route.ts`

Requiert `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`.

Flow :
1. `supabase.auth.admin.createUser({ email, password, ... })`
2. `upsert` dans `profiles` (role, tenant_id, full_name, phone)
3. Si `tenant_user` : `insert` dans `user_societes` pour chaque société sélectionnée
4. Rollback : supprime l'auth user si étape 2 ou 3 échoue

---

## Migrations SQL

| Fichier | Description |
|---|---|
| `20260321_sys_modules_manual.sql` | Création table `sys_modules` |
| `20260321_tenant_settings_manual.sql` | Création table `tenant_settings` |
| `20260322_fix_link_table_manual.sql` | Ancienne liaison (révisée — references user_societes) |
| `20260322_fix_roles_and_permissions.sql` | RLS pour `user_module_permissions` |
| `20260322_fix_rpc_phone_manual.sql` | Fix RPC phone |
| `20260322_fix_rpc_tenant_status_manual.sql` | Fix statut tenant dans RPC |
| `20260322_normalize_roles_english.sql` | Normalisation rôles en anglais (tenant_admin, tenant_user) |
| `20260322_normalize_roles_english_v2.sql` | V2 normalisation rôles |
| `20260324_fix_tenants_rls.sql` | Fix RLS `tenants` (tenant_admin lit uniquement son propre tenant) |
| `20260324_fix_tenants_quotas_notnull.sql` | Fix valeurs NULL sur max_societes/max_licences/max_storage_gb |
| `20260324_societes_storage_cleanup.sql` | Nettoyage colonnes storage societes |
| `20260324_create_user_societes.sql` | **Recréation propre de `user_societes`** (DROP + CREATE) — **À EXÉCUTER** |

---

## i18n — Clés de traduction ajoutées

### `navigation.json`
- `select_company` — "Accéder à une Société" / "Access a Company"
- `company_switcher_title` — "Mes Sociétés" / "My Companies"
- `manage_companies` — "Gérer les sociétés" / "Manage companies"

### `societes.json`
- `field_numero_contribuable`, `field_numero_rccm`
- `storage_*` — quota stockage
- `quota_*` — indicateurs quota
- `detail_*` — champs de détail dans le modal

### `utilisateurs.json`
- `new_user`, `quota_label`, `quota_reached`
- `role_admin_desc`, `role_user_desc`
- `modal_create_title`, `field_*`, `placeholder_*`
- `password_hint`, `btn_*`, `toast_*`, `error_*`
- `field_societes`, `no_societes_available`, `societes_selected`, `error_societe_required`
- `detail_phone`, `detail_created_at`

---

## À faire / Prochaines étapes

- [ ] **Exécuter** `20260324_create_user_societes.sql` dans Supabase (table existe mais vide)
- [ ] **Ajouter** `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`
- [ ] **RLS `societes` pour `tenant_user`** : lecture uniquement des sociétés assignées (à faire lors du travail sur les permissions modules)
- [ ] **`user_module_permissions`** : UI de gestion des permissions par module (none/viewer/contributor/manager/admin) pour chaque utilisateur dans chaque société
- [ ] **Modules** : pages Vente, Achat, Stock, RH, CRM, Comptabilité, Rapports, Sécurité

---

## Points d'attention / Pièges

1. **UUID tronqué dans URL** : `params.tenant_id` = 8 chars. Toujours utiliser `profiles.tenant_id`.
2. **`user_societes` n'a pas de colonne `role`** — les rôles sont dans `user_module_permissions`.
3. **Écriture dans `user_societes`** : service role uniquement (pas de policy client INSERT/UPDATE/DELETE).
4. **`utilisateurs_societe`** : ancienne table qui n'a jamais existé correctement — remplacée par `user_societes`.
5. **`toSlug(str)`** : fonction de conversion `raison_sociale` → slug URL, utilisée partout pour la navigation société.
