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
| `public.tenants` | Tenants (organisations). Colonnes clés : `id`, `slug`, `name`, `status`, `max_societes`, `max_licences`, `max_storage_gb`, `timezone` (IANA, défaut `'Africa/Douala'`) |
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
| `public.rh_presences` | Pointage quotidien. Colonnes : `id`, `tenant_id`, `societe_id`, `employe_id` (FK → `rh_employes`), `date`, `statut` ('present'/'absent'/'retard'/'conge'/'mission'), `note`, `heure_entree timestamptz`, `heure_sortie timestamptz`, `created_by`, `created_at`, `updated_at`. Contrainte unique : `(employe_id, date)`. RLS : SELECT/INSERT/UPDATE/DELETE pour le même tenant. |
| `public.rh_bulletins_paie` | Bulletins de salaire. Colonnes : `id`, `tenant_id`, `societe_id`, `employe_id`, `mois` (1-12), `annee`, `storage_path`, `nom_fichier`, `taille_kb`, `uploaded_by`, `created_at`. Contrainte unique : `(employe_id, mois, annee)`. RLS par tenant. |
| `public.rh_conges` | Demandes de congé. Colonnes : `id`, `tenant_id`, `societe_id`, `employe_id`, `type_conge`, `typologie` ('daily'/'hourly'), `date_debut`, `date_fin` (nullable si horaire), `nb_jours` (nullable si horaire), `nb_heures numeric(5,2)` (nullable si journalier), `statut` ('en_attente'/'approuve'/'refuse'), `motif`, `justificatif_path` (Storage), `commentaire_rh`, `approuve_par`, `approuve_le`, `created_by`, `created_at`, `updated_at`. Pas de RLS. |
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

**Layout** (`rh/layout.tsx`) — navbar module RH sticky, 5 onglets :
- Tableau de bord → `/rh`
- Employés → `/rh/employes` (tab verrouillé si `< gestionnaire`)
- Présences → `/rh/presences`
- Paie → `/rh/paie`
- Rapport → `/rh/rapport` (tab verrouillé si `< gestionnaire`)
- ⚠️ Permission : requête directe `user_module_permissions` (pas de RPC)

**Dashboard** (`rh/page.tsx`) — 3 cartes :
- Employés (cliquable → `/rh/employes`)
- Présences (cliquable → `/rh/presences`, couleur teal)
- Paie (cliquable → `/rh/paie`, couleur green)

**Page Paie** (`rh/paie/page.tsx`) :
- **Tab Mes Bulletins** (contributeur+) : liste PDF par mois, téléchargement via URL signée
- **Tab Gestion** (gestionnaire+) : sélecteur mois/année, tableau tous employés avec statut bulletin, upload PDF par employé (upsert), remplacement, suppression (admin/tenant_admin uniquement)
- Storage : `{tenant_id}/societes/{societe_id}/rh/paie/{employe_id}/{annee}_{mois}_{filename}`

**Page Rapport** (`rh/rapport/page.tsx`) — accès gestionnaire+ / tenant_admin :
- **KPIs** : effectif actif, taux de présence moyen, congés en attente, masse salariale
- **Conformité des Employés** : tableau par employé — jours présents / ouvrables, taux avec barre CSS, badge Présence (conforme/non-conforme), badge Bulletin (uploadé/manquant). Seuil configurable (70/80/90/100%). Trié par taux croissant.
- **Répartition** : barres horizontales CSS par département + par type de contrat
- **Masse Salariale** : total brut + répartition par département (barres CSS)
- Jours ouvrables = Lun–Ven (calcul auto, sans jours fériés pour l'instant)

**Page Employés** (`rh/employes/page.tsx`) :
- **Section 1 — Employés avec Compte** : `user_societes` → `profiles` (tenant_user, is_active=true) → `rh_employes` pour enrichissement. Affiche les utilisateurs assignés à la société avec leur fiche RH si elle existe.
- **Section 2 — Employés sans Compte** : `rh_employes WHERE user_id IS NULL AND societe_id = X`. Employés sans accès plateforme.
- **Modal création/édition** : 4 fieldsets (Identité, Contact, Poste & Contrat, Documents officiels)
- **Matricule** : auto-généré via trigger Postgres (8 chiffres uniques), affiché en lecture seule
- **Statuts** : actif (emerald), inactif (slate), suspendu (red), conge (amber)
- **Poste / Département** : listes déroulantes prédéfinies (11 postes, 7 départements)
- **Documents officiels** : drawer latéral par employé — upload CNI, Passeport, CNPS, Diplôme, Contrat, Autre. Storage : `{tenant_id}/societes/{societe_id}/rh/employes/{employe_id}/`. Table `rh_employe_documents`. Téléchargement via URL signée (60s). Max 5 Mo, formats PDF/JPG/PNG.
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
| `20260326_tenant_settings_timezone.sql` | `ALTER TABLE tenants ADD COLUMN timezone text DEFAULT 'Africa/Douala'` | ✅ |
| `20260326_rh_presences_v2.sql` | `ALTER TABLE rh_presences ADD COLUMN heure_entree timestamptz, heure_sortie timestamptz` + statut nullable | ✅ |
| `20260326_rh_employe_documents.sql` | CREATE `rh_employe_documents` (CNI, Passeport, CNPS, Diplôme, Contrat, Autre) + RLS + indexes | ✅ |
| `20260327_societes_portail_pin.sql` | `ALTER TABLE societes ADD COLUMN portail_pin text DEFAULT '0000'` | ✅ |
| `20260327_rh_conges_typologie.sql` | `ALTER TABLE rh_conges ADD COLUMN typologie text DEFAULT 'daily'`, `nb_heures numeric(5,2)`, `justificatif_path text` | ✅ |
| `20260327_rh_bulletins_paie.sql` | CREATE `rh_bulletins_paie` (bulletins de salaire PDF, unique par employe+mois+annee) + RLS + indexes | ✅ |
| `20260327_add_workflow_module.sql` | INSERT `workflow` dans `sys_modules` avec `is_active = false` (désactivé globalement par défaut) | ✅ |
| `20260327_workflow_tables.sql` | CREATE `workflow_requests` + `workflow_comments` + RLS par tenant | ✅ |
| `20260327_notifications_tenant_id_nullable.sql` | `ALTER TABLE notifications ALTER COLUMN tenant_id DROP NOT NULL` — Masters ont `tenant_id = NULL` | ✅ |
| `20260327_workflow_justificatif.sql` | `ALTER TABLE workflow_requests ADD COLUMN justificatif_path TEXT` | ✅ |
| `20260327_user_groups.sql` | CREATE `user_groups` + `user_group_members` + `ALTER TABLE workflow_requests ADD COLUMN assigned_to_group` + RLS + indexes | ⏳ à exécuter |
| `20260328_user_group_permissions.sql` | CREATE `user_group_permissions` (héritage permissions modules par groupe) + RLS + indexes | ⏳ à exécuter |

---

## i18n — Namespaces chargés (`i18n/request.ts`)
`auth`, `blocked`, `dashboard`, `diagnostic`, `errors`, `login`, `logs`, `modules`, `navigation`, `recovery`, `register`, `remediation`, `reporting`, `rh`, `securite`, `societes`, `societe_settings`, `societe_users`, `superadmin`, `tenant_settings`, `tenants`, `utilisateurs`, `validation`, `workflow`

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

#### Module Workflow `/[societe_id]/workflow`

**Layout** (`workflow/layout.tsx`) — navbar module sticky, 3 onglets :
- Tableau de bord → `/workflow`
- Mes Requêtes → `/workflow/mes-requetes` (tous les niveaux)
- Requêtes Assignées → `/workflow/assignees` (verrouillé si `< gestionnaire`)

**Dashboard** (`workflow/page.tsx`) — 4 cartes stats + 2 cartes cliquables :
- Stats : Mes Requêtes, En Attente, Approuvées, Assignées à moi
- Carte cliquable → `/workflow/mes-requetes`
- Carte cliquable → `/workflow/assignees` (désactivée si non gestionnaire)

**Page Mes Requêtes** (`workflow/mes-requetes/page.tsx`) :
- Tableau de toutes les requêtes créées par l'utilisateur connecté
- Bouton "Nouvelle requête" → modal création (titre, type, priorité, description, justificatif, assignation)
- Assignation : bouton radio « Gestionnaire individuel » / « Groupe » → `assigned_to` ou `assigned_to_group`
- Assignation au moment de la soumission → change le statut à `assigne` directement
- Justificatif : upload PDF/Word/image, max 5 Mo → Storage `{tenant_id}/societes/{societe_id}/workflow/{request_id}/justificatif_...`
- Colonne « Assigné à » : icône UsersRound si groupe, nom du groupe ou du gestionnaire
- Bouton détail → modal avec historique des actions + download justificatif (créateur)
- Bouton suppression → **seule la personne directement assignée (`assigned_to = uid`)**

**Page Requêtes Assignées** (`workflow/assignees/page.tsx`) — gestionnaire+ / tenant_admin :
- `gestionnaire` : voit les requêtes `assigned_to = lui-même` + requêtes `assigned_to_group` dans ses groupes (rôle manager)
- `admin module` / `tenant_admin` : voit toutes les requêtes de la société
- Badge « Groupe » sur les requêtes remontées via groupe
- Actions par ligne : Voir détail, Approuver (✓), Refuser (✗), Supprimer (assigned_to uniquement)
- Modal approuver/refuser avec commentaire optionnel → enregistré dans `workflow_comments`
- Justificatif : visible si `assigned_to = uid` OU membre manager du groupe OU admin
- **Conflit Realtime** : Supabase Realtime souscrit au record pendant le modal approuver/refuser → popup si un autre gestionnaire traite la requête en même temps

**Flux des statuts** :
```
Soumission sans assignation → en_attente
Soumission avec assignation → assigne  (remplace en_attente)
Gestionnaire approuve        → approuve
Gestionnaire refuse          → refuse
```

**Tables SQL** :
- `workflow_requests` : id, tenant_id, societe_id, titre, type_demande, description, statut, priorite, assigned_to, **assigned_to_group** (FK → user_groups), justificatif_path, approved_by/at, refused_by/at, created_by, created_at, updated_at
- `workflow_comments` : id, request_id, tenant_id, author_id, action (assigne/approuve/refuse/commente), contenu, created_at
- **`user_groups`** : id, tenant_id, societe_id, nom, description, type (compte/mixte), created_by, created_at, updated_at
- **`user_group_members`** : id, group_id, user_id (nullable), employe_id (nullable), role (membre/manager), created_at

**Types de demandes** : materiel_it, finance, formation, deplacement, rh, autre
**Priorités** : basse, normale, haute, urgente
**Permissions** : contributeur+ soumettent · gestionnaire+ gèrent (approuvent/refusent) · **seule la personne directement assignée peut supprimer une requête**
**Séparé du module RH** : les congés restent dans `/rh/presences` (onglet Congés)

#### Groupe Utilisateurs V2 (`utilisateurs/page.tsx` — onglet Groupes)
- Accessible uniquement aux `tenant_admin`
- 2 onglets : **Utilisateurs** (permissions modules, inchangé) + **Groupes** (nouveau)
- CRUD groupes : créer, modifier, supprimer, gérer les membres + leur rôle (membre/manager)
- Types de groupe : `compte` (utilisateurs avec compte), `mixte` (avec + sans compte via rh_employes)
- Héritage de permissions : **implémenté en V3** via `user_group_permissions`
- Un manager dans un groupe voit et peut traiter toutes les requêtes assignées à ce groupe
- Détection de conflit temps réel : popup si un autre manager traite la même requête simultanément

#### Permissions par Groupe V3
- **Table** `user_group_permissions` : group_id, tenant_id, societe_id, module, permission, granted_by — contrainte unique `(group_id, societe_id, module)`
- **Résolution** : `getEffectivePermission()` dans `lib/permissions.ts` — `MAX(permission individuelle via RPC, permission max des groupes)`
- **Hook** : `usePermission.ts` refactoré pour appeler `getEffectivePermission()` après la vérification `sys_modules`
- **UI** : bouton "Permissions" par groupe dans l'onglet Groupes → modal tableau croisé (module × permission) + colonne "Héritage" informative
- **Règle** : la permission individuelle ne peut jamais être réduite par un groupe — toujours le MAX

---

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
- [x] **Module RH — Présences** : table `rh_presences` ✅ + page Présences (3 onglets : Pointage / Récapitulatif / Congés)
  - Contributeur : self-pointage (entrée/sortie) + demande congé + mes récapitulatifs + mes congés
  - Gestionnaire/Admin : pointage global + récapitulatif global + approbation congés
  - tenant_admin : accès total
  - Fuseau horaire depuis `tenants.timezone` (IANA)
  - Statut `present` = heure_entree + heure_sortie ; sinon `absent`
- **Portail Présences** (`rh/portail/page.tsx`) : kiosque tactile pour employés sans compte
  - Plein écran fixe (z-200), horloge live, pas de timeout
  - Recherche temps réel (4 chars min, debounce 300ms) — `rh_employes WHERE user_id IS NULL`
  - Mini fiche sélectionnée → Entrée/Sortie (même logique que Présences), statut live
  - Formulaire demande congé (pliable) + historique des 5 dernières demandes
  - Bouton ← Retour protégé par PIN 4 chiffres (stocké dans `societes.portail_pin`, défaut `'0000'`)
  - PIN modifiable depuis la carte Portail du dashboard RH
  - Visible uniquement pour gestionnaire+ et tenant_admin sur le dashboard

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

## Checklist d'intégration — Nouveau module

À chaque fois qu'un nouveau module est créé, appliquer les étapes suivantes dans l'ordre :

### 1. Base de données
- [ ] **Migration SQL** : `INSERT INTO sys_modules (key, name, description, icon, is_active) VALUES ('...', ..., false)` — **`is_active = false` par défaut**, le Master l'active manuellement
- [ ] Exécuter la migration dans Supabase Dashboard

### 2. Typage (1 fichier)
- [ ] [hooks/usePermission.ts](sili/hooks/usePermission.ts) — ajouter `'<module>'` au type `ModuleKey`
  - ⚠️ `'workflow'` est **déjà présent** dans `ModuleKey`

### 3. Navigation (4 fichiers)
- [ ] [components/layout/Sidebar.tsx](sili/components/layout/Sidebar.tsx) — ajouter l'entrée dans `navGroup2` avec `moduleKey` et icône lucide-react
- [ ] Vérifier que `societe_modules` filtre bien l'entrée (automatique via `activeModules`)
- [ ] [messages/fr/navigation.json](sili/messages/fr/navigation.json) — ajouter `"<key>": "Nom FR"` (utilisé par `tNav(moduleKey)` dans settings + utilisateurs)
- [ ] [messages/en/navigation.json](sili/messages/en/navigation.json) — idem EN

### 4. Icônes dans les pages d'administration (2 fichiers)
- [ ] [settings/page.tsx](sili/app/%5Blocale%5D/%5Btenant_slug%5D/%5Btenant_id%5D/%5Buser_id%5D/%5Bsociete_slug%5D/%5Bsociete_id%5D/settings/page.tsx) — ajouter l'icône dans `MODULE_ICONS`
- [ ] [utilisateurs/page.tsx](sili/app/%5Blocale%5D/%5Btenant_slug%5D/%5Btenant_id%5D/%5Buser_id%5D/%5Bsociete_slug%5D/%5Bsociete_id%5D/utilisateurs/page.tsx) — ajouter l'icône dans `MODULE_ICONS`

### 5. Page de login (3 fichiers)
- [ ] [messages/fr/auth.json](sili/messages/fr/auth.json) — ajouter `module_<key>` et `module_<key>_desc`
- [ ] [messages/en/auth.json](sili/messages/en/auth.json) — idem en anglais
- [ ] [login/page.tsx](sili/app/%5Blocale%5D/%28auth%29/login/page.tsx) — ajouter l'entrée dans le tableau `modules` + import de l'icône

### 6. Pages du module (nouveaux fichiers)
- [ ] `app/[locale]/[...]/[societe_id]/<module>/layout.tsx` — layout avec navbar interne si sous-pages
- [ ] `app/[locale]/[...]/[societe_id]/<module>/page.tsx` — page principale (dashboard du module)
- [ ] Sous-pages selon les fonctionnalités

### 7. i18n
- [ ] Créer `messages/fr/<module>.json` et `messages/en/<module>.json`
- [ ] Ajouter le namespace dans [i18n/request.ts](sili/i18n/request.ts)

### 8. Documentation
- [ ] Documenter le module dans ce fichier `plan.md` (tables SQL, pages, règles métier)

### Règle : désactivation par défaut
Tout nouveau module est inséré dans `sys_modules` avec **`is_active = false`**. Il n'est activé pour aucun tenant ni société. Le Master l'active via la page `/admin/[adminId]/modules`, puis le tenant_admin l'active pour ses sociétés.

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
