# SILI-Suite — Plan & Mémoire du Projet

## Architecture générale

**Stack** : Next.js App Router + Supabase (Auth + Postgres + RLS) + Zustand + next-intl (FR/EN)

**URL pattern** :
```
/[locale]/[tenant_slug]/[tenant_id]/[user_id]/                     ← espace tenant
/[locale]/[tenant_slug]/[tenant_id]/[user_id]/[societe_slug]/[societe_id]/[module]  ← espace société
/[locale]/admin/[adminId]/                                          ← espace Master (is_super_admin)
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
| `public.sys_modules` | Modules disponibles du système (géré par Master) |
| `public.tenant_modules` | Modules activés par tenant. Colonnes : `id`, `tenant_id`, `module`, `is_active`, `config`, `activated_at`. Contrainte unique : `(tenant_id, module)` |
| `public.tenant_settings` | Paramètres du tenant |
| `public.notifications` | Notifications in-app. Colonnes : `id`, `tenant_id`, `user_id`, `type`, `titre`, `message`, `data`, `is_read`, `read_at`, `created_at` |
| `public.audit_logs` | Journal d'audit général. Colonnes : `id`, `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `metadata`, `ip_address`, `user_agent`, `created_at` |
| `public.master_audit_logs` | Journal d'audit des comptes Master uniquement. Colonnes : `id`, `actor_id`, `action`, `level` (info/warning/error), `service` (auth/system/database/network), `resource_type`, `resource_id`, `message` (texte lisible pré-calculé), `metadata`, `ip_address`, `created_at`. Pas de FK tenant_id. |
| `public.tenant_backups` | Sauvegardes. Colonnes : `id`, `tenant_id`, `status`, `size_mb`, `triggered_by`, `storage_path`, `created_at`, `expires_at`, `completed_at` |
| `public.societe_modules` | Modules activés par société (sous-ensemble de `tenant_modules`). Colonnes : `id`, `societe_id`, `module`, `is_active`, `activated_at`. Contrainte unique : `(societe_id, module)`. |
| `public.societe_data_sharing` | Partage de données directionnel entre sociétés, par module. Colonnes : `id`, `source_societe_id`, `target_societe_id`, `module`, `is_active`, `created_at`. Contrainte unique : `(source_societe_id, target_societe_id, module)`. Le partage est à sens unique : source partage vers target, pas l'inverse sauf config explicite. |
| `public.rh_presences` | Pointage quotidien. Colonnes : `id`, `tenant_id`, `societe_id`, `employe_id` (FK → `rh_employes`), `date`, `statut` ('present'/'absent'/'retard'/'conge'/'mission'), `note`, `created_by`, `created_at`, `updated_at`. Contrainte unique : `(employe_id, date)`. RLS : SELECT/INSERT/UPDATE/DELETE pour le même tenant. |
| `public.rh_employes` | Employés RH. Colonnes : `id`, `tenant_id`, `societe_id`, `user_id` (nullable — NULL = sans compte plateforme), `matricule` (8 chiffres, auto-généré via trigger), `nom`, `prenom`, `sexe` ('M'/'F'), `date_naissance`, `lieu_naissance`, `nationalite`, `adresse`, `email`, `telephone`, `poste`, `departement`, `date_embauche`, `type_contrat` ('CDI'/'CDD'/'Stage'/'Freelance'/'Consultant'), `salaire_base`, `cni_numero`, `cnps_numero`, `photo_url`, `statut` ('actif'/'inactif'/'suspendu'/'conge'), `created_by`, `created_at`, `updated_at`. RLS : SELECT (même tenant), INSERT/UPDATE/DELETE (tenant_admin uniquement). |

### Rôles globaux (`global_role` enum)
- `super_admin` — accès total à tout *(non utilisé en pratique — remplacé par `is_super_admin`)*
- `tenant_admin` — accès à son tenant + toutes ses sociétés
- `tenant_user` — accès uniquement aux sociétés assignées via `user_societes`

### Compte Master
- `profiles.role = 'user'` + `profiles.is_super_admin = true` + `profiles.tenant_id = NULL`
- URL : `/[locale]/admin/[adminId]/` où `adminId = user.id.substring(0, 5)`
- Middleware : redirige vers `/admin/[adminId]/dashboard` si `is_super_admin = true`

### Rôles par module (`user_module_permissions`)
`none` | `viewer` | `contributor` | `manager` | `admin`
Ces rôles s'appliquent **par module** (vente, achat, stock, rh, crm, comptabilite, rapports), **par société**.
⚠️ Le module `securite` a été **supprimé** — remplacé par la page tenant "Sécurité & Backup".

---

## RLS (Row Level Security) en place

### `public.tenants`
- `tenant_admin` lit uniquement son propre tenant (`profiles.tenant_id`)
- `super_admin/is_super_admin` lit et **met à jour** tout — policy `tenants_super_admin_update`
- Policy lecture : `tenants_read_admin`

### `public.societes`
- `tenant_admin` lit toutes les sociétés de son tenant
- `tenant_user` : RLS à implémenter (lecture sociétés assignées via `user_societes`)
- Policy : `societes_admin_policy`

### `public.user_societes`
- `tenant_user` lit ses propres lignes
- `tenant_admin` lit toutes les lignes du tenant
- Écriture : service role uniquement (API route `/api/admin/create-user`)

### `public.tenant_modules`
- Policies larges existantes : `tenant_modules_read_policy` + `tenant_modules_update_policy` (`using (true)`)
- Contrainte unique ajoutée : `(tenant_id, module)` — nécessaire pour upsert

### `public.notifications`
- SELECT/UPDATE : `user_id = auth.uid()` (tous comptes)
- INSERT : `is_super_admin = true` (Masters insèrent les notifs pour tous les Masters)

### `public.audit_logs`
- SELECT : `is_super_admin` ou `tenant_admin` (son propre tenant)
- INSERT : `is_super_admin` (Master écrit depuis client)

### `public.tenant_backups`
- SELECT/INSERT : `tenant_admin` de son propre tenant + `is_super_admin`

---

## Pages implémentées

### Espace Tenant

#### `/[user_id]/societes`
- Liste des sociétés + statut actif/inactif + indicateur quota
- Création société : modal avec storage_gb validé contre quota restant
- **Pattern clé** : `checkSessionAndFetch` → `profiles.tenant_id` (UUID complet) → `fetchAll`

#### `/[user_id]/utilisateurs`
- Liste utilisateurs + quota licences
- Création : rôle admin ou user, si `tenant_user` → assignation sociétés obligatoire
- Champ **Confirmer Mot de passe** avec indicateur de correspondance (vert/rouge)
- **Indicateur de robustesse** : barre 4 segments + 4 critères visuels (8 chars, majuscule, chiffre, spécial)
- Validation bloquante côté client + côté serveur
- Appel API : `POST /api/admin/create-user` (avec timeout 30s + try/catch)

#### `/[user_id]/securite-backup`
**Fichier** : `sili/app/[locale]/[tenant_slug]/[tenant_id]/[user_id]/securite-backup/page.tsx`
- 3 onglets : Journal d'activité (`audit_logs`) / Permissions (`user_module_permissions`) / Sauvegardes (`tenant_backups`)
- Accessible uniquement aux `tenant_admin` (pas de permission module requise)
- Bouton "Déclencher une sauvegarde" → insert dans `tenant_backups`

#### `/[user_id]/dashboard`, `/[user_id]/settings`, `/[user_id]/reporting`

### Espace Société
- `/[societe_id]/dashboard`, `/[societe_id]/vente`, `/[societe_id]/rh`, `/[societe_id]/crm`
- `/[societe_id]/settings` *(à créer)* — Paramètres société : 2 onglets Modules + Partage de données

#### Module RH `/[societe_id]/rh`

**Layout** (`rh/layout.tsx`) — navbar module RH sticky :
- Tableau de bord → `/rh` (actif si exact match ou se termine par `/rh`)
- Employés → `/rh/employes`
- Présences / Paie → désactivés avec badge "Bientôt"

**Dashboard** (`rh/page.tsx`) — 3 cartes :
- Employés (cliquable → `/rh/employes`)
- Présences (désactivé)
- Paie (désactivé)

**Page Employés** (`rh/employes/page.tsx`) :
- **Section 1 — Employés avec Compte** : `user_societes` → `profiles` (tenant_user, is_active=true) → `rh_employes` pour enrichissement. Affiche les utilisateurs assignés à la société avec leur fiche RH si elle existe.
- **Section 2 — Employés sans Compte** : `rh_employes WHERE user_id IS NULL AND societe_id = X`. Employés sans accès plateforme.
- **Modal création/édition** : 4 fieldsets (Identité, Contact, Poste & Contrat, Documents officiels)
- **Matricule** : auto-généré via trigger Postgres (8 chiffres uniques), affiché en lecture seule
- **Statuts** : actif (emerald), inactif (slate), suspendu (red), conge (amber)
- **i18n** : namespace `rh` (FR + EN)

### Espace Master (`/admin/[adminId]/`)

#### `tenants/page.tsx`
- Liste tous les tenants + bloc/débloc/suppression
- Modal Paramètres → 2 onglets :
  - **Permissions Modulaires** : toggles par module → upsert `tenant_modules` (colonne `module`, conflit `tenant_id,module`)
  - **Réglages & Quotas** : `max_societes`, `max_licences`, `max_storage_gb` → update `tenants`
- Après chaque action : `writeAuditLog()` + `notifyAllMasters()` (notif à tous les `is_super_admin`)

#### `tools/logs/page.tsx`
- Connecté à `master_audit_logs` (données réelles, 200 derniers logs)
- `level` et `service` lus directement depuis la table — plus de mapping client
- `message` pré-calculé stocké en base, passé par l'appelant
- Filtres niveau + service + recherche texte

---

## Composants

### `Header.tsx` (`sili/components/layout/Header.tsx`)
- **CompanySwitcher** :
  - En **espace tenant** (`params.societe_id` absent) : affiche toujours `t('select_company')` — jamais de nom persistant
  - En **espace société** : affiche le nom de la société active (basé sur URL uniquement, pas le store Zustand)
  - `tenant_admin/super_admin` : charge toutes les sociétés actives du tenant
  - `tenant_user` : charge uniquement les sociétés assignées via `user_societes`
  - "Gérer les sociétés" : visible uniquement pour `tenant_admin/super_admin`
- **NotificationBell** : cloche avec badge rouge, dropdown, realtime Supabase, marquer lu
- **ProfileDropdown** : profil, paramètres, déconnexion

### `NotificationBell.tsx` (`sili/components/ui/NotificationBell.tsx`)
- Fetch `notifications` filtrée par `user_id = auth.uid()` (fonctionne pour Master ET Tenant)
- Realtime : souscription INSERT Supabase en temps réel
- Masters : `tenant_id = NULL` dans leurs notifications
- Intégré dans `Header.tsx` (tenant) ET `admin/[adminId]/layout.tsx` (Master)

### `Sidebar.tsx`
- `navGroup1` (espace tenant, admins uniquement) : dashboard, societes, utilisateurs, reporting, **securite-backup**, settings
- `navGroup2` (espace société, avec `usePermission`) : vente, achat, stock, rh, crm, comptabilite, teams, rapports
- `navGroupApplications` *(à créer)* — groupe **Applications** dans l'espace société : charge dynamiquement les modules depuis `societe_modules` où `is_active = true` pour la `societe_id` courante. Chaque module → item de menu vers `/[societe_id]/[module]`.
- ⚠️ Module `securite` **supprimé** de `navGroup2` et de `ModuleKey` dans `usePermission.ts`

### `middleware.ts`
- `is_super_admin` → `/admin/[adminId]/dashboard`
- `tenant_admin` → `/[slug]/[shortId]/[userId]/dashboard`
- `tenant_user` → première société assignée ou dashboard tenant

---

## Stockage fichiers (`sili-files`)

### Architecture bucket
Bucket unique `sili-files`, isolation par chemin :
```
{tenant_id}/societes/{societe_id}/documents/   ← fichiers métier
{tenant_id}/societes/{societe_id}/exports/      ← exports générés
{tenant_id}/societes/{societe_id}/imports/      ← fichiers importés
{tenant_id}/backups/                            ← sauvegardes
{tenant_id}/shared/                             ← fichiers partagés
```
RLS : chaque utilisateur ne peut accéder qu'aux fichiers sous son `tenant_id`.

### Suivi du stockage (`tenant_storage_usage`)
| Colonne | Source | Mise à jour |
|---|---|---|
| `files_mb` | Bucket `sili-files` | Trigger automatique INSERT/DELETE sur `storage.objects` |
| `database_mb` | Postgres (tables tenant) | Batch quotidien (Phase 3) |
| `logs_mb` | `audit_logs` | Batch quotidien (Phase 3) |
| `backups_mb` | `tenant_backups.size_mb` | Batch quotidien (Phase 3) |

Vue `tenant_storage_summary` : expose `total_mb = sum(files_mb + database_mb + logs_mb + backups_mb)`.

### Utilitaire client (`lib/storage.ts`)
- `societeFilePath(tenantId, societeId, category, filename)` — génère le chemin
- `uploadFile(path, file)` — upload + tracking automatique via trigger
- `deleteFiles(paths)` — suppression + tracking automatique via trigger
- `getSignedUrl(path, expiresIn)` — URL temporaire sécurisée
- `getStorageUsage(tenantId)` — lit `tenant_storage_summary`
- `checkStorageQuota(tenantId, maxGb, fileSize)` — vérifie avant upload

### Phasage
- **Phase 1** ✅ Implémentée — bucket + RLS + `tenant_storage_usage` + triggers + `lib/storage.ts`
- **Phase 2** — UI détaillée dans Paramètres Tenant (barre de stockage par composante) — à implémenter avec le premier module métier
- **Phase 3** — Edge Function pg_cron recalcul `database_mb` / `logs_mb` / `backups_mb` — en production

---

## API Routes

### `POST /api/admin/create-user`
Requiert `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` ✅ (clé configurée).
1. Guard : échec rapide si `SUPABASE_SERVICE_ROLE_KEY` absente (évite hang infini)
2. `supabase.auth.admin.createUser`
3. `upsert` dans `profiles`
4. Si `tenant_user` : `insert` dans `user_societes`
5. Rollback si étape 3 ou 4 échoue

---

## Migrations SQL

| Fichier | Description | Statut |
|---|---|---|
| `20260321_sys_modules_manual.sql` | Création table `sys_modules` | ✅ |
| `20260321_tenant_settings_manual.sql` | Création table `tenant_settings` | ✅ |
| `20260322_fix_link_table_manual.sql` | Ancienne liaison user_societes | ✅ |
| `20260322_fix_roles_and_permissions.sql` | RLS `user_module_permissions` | ✅ |
| `20260322_fix_rpc_phone_manual.sql` | Fix RPC phone | ✅ |
| `20260322_fix_rpc_tenant_status_manual.sql` | Fix statut tenant dans RPC | ✅ |
| `20260322_normalize_roles_english.sql` | Normalisation rôles en anglais | ✅ |
| `20260322_normalize_roles_english_v2.sql` | V2 normalisation rôles | ✅ |
| `20260324_fix_tenants_rls.sql` | RLS `tenants` pour tenant_admin | ✅ |
| `20260324_fix_tenants_quotas_notnull.sql` | Fix NULL sur quotas | ✅ |
| `20260324_societes_storage_cleanup.sql` | Nettoyage colonnes storage | ✅ |
| `20260324_create_user_societes.sql` | Recréation propre `user_societes` | ✅ |
| `20260325_notifications_rls.sql` | RLS `notifications` (SELECT/UPDATE par user_id, INSERT super_admin) | ✅ |
| `20260325_create_audit_logs.sql` | Table `audit_logs` + RLS | ✅ |
| `20260325_create_tenant_backups.sql` | Table `tenant_backups` + RLS | ✅ |
| `20260325_remove_securite_module.sql` | Suppression module `securite` de `sys_modules` + `user_module_permissions` | ✅ |
| `20260325_fix_rls_master_operations.sql` | Contrainte unique `tenant_modules(tenant_id,module)` + policies UPDATE tenants / INSERT audit_logs / INSERT notifications pour super_admin | ✅ |
| `20260325_create_master_audit_logs.sql` | Table `master_audit_logs` + index + RLS SELECT pour super_admin | ✅ |
| `20260326_create_societe_modules.sql` | Table `societe_modules` + RLS + contrainte unique `(societe_id, module)` | ✅ |
| `20260326_create_societe_data_sharing.sql` | Table `societe_data_sharing` + RLS + contrainte unique `(source, target, module)` | ✅ |
| `20260326_user_module_permissions_rls.sql` | RLS `user_module_permissions` + contrainte unique `(user_id, societe_id, module)` | ✅ |
| `20260326_tenants_rls_tenant_user.sql` | Policy SELECT `tenants` pour `tenant_user` (lecture de son propre tenant) | ✅ |
| `20260326_storage_phase1.sql` | Bucket `sili-files` + RLS storage + table `tenant_storage_usage` + triggers auto files_mb | ✅ |
| `20260326_rh_employes.sql` | DROP + CREATE `rh_employes` + trigger `generate_matricule()` (8 chiffres uniques) + RLS + indexes | ✅ |
| `20260326_rh_presences.sql` | CREATE `rh_presences` (pointage quotidien) + RLS (lecture/écriture même tenant) + indexes | ✅ |

---

## i18n — Namespaces chargés (`i18n/request.ts`)
`auth`, `blocked`, `dashboard`, `diagnostic`, `errors`, `login`, `logs`, `modules`, `navigation`, `recovery`, `register`, `remediation`, `reporting`, `rh`, `securite`, `societes`, `societe_settings`, `societe_users`, `superadmin`, `tenant_settings`, `tenants`, `utilisateurs`, `validation`

### Clés notables
- `navigation.json` : `select_company`, `company_switcher_title`, `manage_companies`, `security_backup`, `notifications`, `notifications_empty`, `notifications_mark_all_read`, `notifications_mark_read`
- `securite.json` : page complète Sécurité & Backup (tabs audit/permissions/backups)

---

## À faire / Prochaines étapes

### Migrations SQL à exécuter dans Supabase (dans l'ordre)
- [x] `20260324_create_user_societes.sql` ✅ exécutée
- [ ] `20260324_fix_tenants_quotas_notnull.sql` — fix NULL sur quotas
- [ ] `20260324_fix_tenants_rls.sql` — RLS `tenants` pour tenant_admin
- [ ] `20260324_societes_storage_cleanup.sql` — nettoyage colonnes storage
- [x] `20260325_notifications_rls.sql` ✅ exécutée
- [x] `20260325_create_audit_logs.sql` ✅ exécutée
- [x] `20260325_create_tenant_backups.sql` ✅ exécutée
- [x] `20260325_remove_securite_module.sql` ✅ exécutée
- [x] `20260325_fix_rls_master_operations.sql` ✅ exécutée
- [x] `20260325_create_master_audit_logs.sql` ✅ exécutée
- [x] `20260326_create_societe_modules.sql` ✅ exécutée
- [x] `20260326_create_societe_data_sharing.sql` ✅ exécutée
- [x] `20260326_user_module_permissions_rls.sql` ✅ exécutée
- [x] `20260326_tenants_rls_tenant_user.sql` ✅ exécutée — policy SELECT `tenants` pour `tenant_user`
- [x] `20260326_storage_phase1.sql` ✅ exécutée — bucket + RLS storage + tenant_storage_usage + triggers
- [x] `20260326_rh_employes.sql` ✅ exécutée — table `rh_employes` + trigger matricule + RLS
- [x] `20260326_rh_presences.sql` ✅ exécutée — table `rh_presences` + RLS + indexes

### Environnement
- [x] **`SUPABASE_SERVICE_ROLE_KEY`** ajoutée dans `.env.local` ✅

### Fonctionnalités
- [ ] **RLS `societes` pour `tenant_user`** : lecture uniquement des sociétés assignées via `user_societes`
- [x] **`user_module_permissions`** : UI implémentée — page `/[societe_id]/utilisateurs` (tableau croisé utilisateurs × modules). Migration RLS ⚠️ À exécuter.

#### Modules par société (implémenté)
- [x] **Migration** `20260326_create_societe_modules.sql` ✅ exécutée
- [x] **Migration** `20260326_create_societe_data_sharing.sql` ✅ exécutée
- [x] **Menu "..." sociétés** (`societes/page.tsx`) — entrée "Paramètres" ajoutée (lien vers `/[societe_slug]/[societe_id]/settings`)
- [x] **Page** `/[societe_id]/settings/page.tsx` — 2 onglets :
  - **Onglet Modules** : modules disponibles depuis `tenant_modules`, toggle → upsert `societe_modules`
  - **Onglet Partage de données** : autres sociétés du tenant, toggles par module commun → upsert `societe_data_sharing`. Seuls les modules actifs des deux côtés sont proposables.
- [x] **Sidebar espace société** — groupe **"Applications"** chargé depuis `societe_modules WHERE is_active = true`. Lien "Paramètres Société" visible uniquement pour tenant_admin.
- [ ] **Modules métier** : pages Vente, Achat, Stock, CRM, Comptabilité, Rapports (le partage effectif des données sera implémenté module par module lors du dev de chaque page)
- [x] **Module RH — Phase 1** : table `rh_employes` + layout navbar + dashboard + page Employés (2 sections avec/sans compte) ✅ (migration ⚠️ à exécuter)
- [x] **Module RH — Présences** : table `rh_presences` ✅ + page Présences (3 onglets : Pointage / Récapitulatif mensuel / Congés) — permissions : lecteur (lecture) / gestionnaire+ (pointage + approbation congés)

---

## Contact Master (plateforme)

| Champ | Valeur |
|---|---|
| Nom | Michael Biya |
| Téléphone | +237 93 48 06 42 |
| Email | m.biya@bbmediatech.com |

Affiché sur la page `/tenant-bloque` pour les `tenant_admin` dont le tenant est suspendu.

---

## Règles métier importantes

### Désactivation de module — rétention des données
Désactiver un module (au niveau tenant via Master, ou au niveau société via `societe_modules`) **ne supprime jamais les données**. Seul `is_active = false` est positionné. Les données restent en base et sont réactivées immédiatement si le module est réactivé.

### Blocage d'un tenant par le Master
- Le Master positionne `tenants.status = 'bloqué'`
- Le middleware vérifie ce statut à chaque requête pour les routes non-admin
- `tenant_admin` bloqué → redirigé vers `/tenant-bloque?role=admin` → voit les coordonnées du Master (Michael Biya)
- `tenant_user` bloqué → redirigé vers `/tenant-bloque?role=user` → voit un message pour contacter son admin
- La page Master `/admin/[adminId]/tenants` n'est pas affectée (exemptée du check)

---

## Points d'attention / Pièges

1. **UUID tronqué dans URL** : `params.tenant_id` = 8 chars. Toujours utiliser `profiles.tenant_id`.
2. **`user_societes` n'a pas de colonne `role`** — les rôles sont dans `user_module_permissions`.
3. **Écriture dans `user_societes`** : service role uniquement.
4. **`tenant_modules` — colonne `module`** (pas `module_key`) + conflit upsert sur `(tenant_id, module)`.
5. **Compte Master** : `role = 'user'` + `is_super_admin = true` + `tenant_id = NULL`. Ne pas confondre avec `role = 'super_admin'` (enum non utilisé).
6. **`toSlug(str)`** : conversion `raison_sociale` → slug URL, utilisée partout pour la navigation société.
7. **`dayjs/locale/fr`** : ne pas importer — incompatible Turbopack (CJS). Utiliser `dayjs` seul avec format `DD/MM/YY HH:mm`.
8. **Module `securite`** : supprimé de `navGroup2`, `ModuleKey`, `sys_modules`. La page "Sécurité & Backup" est dans l'espace tenant à `/securite-backup`, non soumise aux permissions modules.
9. **Hiérarchie modules** : Master active dans `sys_modules` → tenant_admin active dans `tenant_modules` → tenant_admin active dans `societe_modules` → `user_module_permissions` donne accès par utilisateur. Ne jamais sauter un niveau.
10. **Partage de données** (`societe_data_sharing`) : directionnel par module. Source partage vers target, pas l'inverse. L'effet réel sur les requêtes SQL est à implémenter module par module lors du dev des pages métier — la table ne fait que stocker la configuration.
