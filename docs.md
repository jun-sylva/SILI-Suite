# SILI ERP/CRM — Documentation de Récréation Complète

> **Multi-tenant SaaS ERP/CRM** conforme OHADA pour le marché camerounais/africain
> Stack recommandée : **Next.js 14 + Supabase + Vercel**

---

## RÉPONSE RAPIDE : Déploiement Vercel ✅

**Oui, 100% compatible Vercel.** Next.js est l'outil officiel de Vercel — c'est le déploiement le plus simple et performant possible. Supabase + Next.js + Vercel est la stack SaaS la plus adoptée en 2024-2025.

---

## TABLE DES MATIÈRES

1. [Analyse du projet existant](#1-analyse-du-projet-existant)
2. [Stack technologique recommandée](#2-stack-technologique-recommandée)
3. [Architecture générale](#3-architecture-générale)
4. [Schéma de base de données Supabase](#4-schéma-de-base-de-données-supabase)
5. [Système RBAC — La solution complète](#5-système-rbac--la-solution-complète)
6. [Structure du projet Next.js](#6-structure-du-projet-nextjs)
7. [Implémentation étape par étape](#7-implémentation-étape-par-étape)
8. [Modules à implémenter](#8-modules-à-implémenter)
9. [Déploiement Vercel](#9-déploiement-vercel)
10. [Checklist de migration](#10-checklist-de-migration)

---

## 1. ANALYSE DU PROJET EXISTANT

### Ce qu'est SILI
Application ERP/CRM multi-tenant pour entreprises africaines avec :
- **11 modules métier** : Comptabilité (OHADA), Vente, Achat, Stock, RH, CRM, Teams, Workflow, Rapports, Sécurité, Sauvegarde
- **Multi-tenant + Multi-société** : un tenant peut avoir plusieurs sociétés
- **RBAC granulaire** : 4 niveaux de permission par module par utilisateur
- **Temps réel** : synchronisation live via Supabase Realtime
- **Bilingue** : Français / Anglais

### Pourquoi recréer depuis zéro
Le projet Horizons (Vite + React SPA) a atteint ses limites :
- RBAC difficile à maintenir dans un SPA pur
- Pas d'API layer sécurisée côté serveur
- Performance sous-optimale (tout charger en JS côté client)
- Complexité des Context providers (37 fichiers de contexte !)
- Difficult à déployer proprement

### Ce qui est conservé
- **Supabase** (PostgreSQL + Auth + Realtime + Storage) — excellent choix, on garde
- **Tailwind CSS** — on garde
- **shadcn/ui** (version améliorée de Radix UI) — on adopte
- La logique métier et les schémas de données — on migre

---

## 2. STACK TECHNOLOGIQUE RECOMMANDÉE

| Couche | Technologie | Pourquoi |
|--------|-------------|----------|
| **Framework** | Next.js 14 (App Router) | SSR, API Routes, middleware, meilleur RBAC |
| **Base de données** | Supabase (PostgreSQL) | Déjà utilisé, RLS, Realtime, Auth |
| **ORM / Type Safety** | Supabase JS v2 + TypeScript | Types générés automatiquement |
| **UI Components** | shadcn/ui | Radix UI + Tailwind, copier-coller |
| **Styling** | Tailwind CSS 3.x | Déjà utilisé |
| **State Management** | Zustand + TanStack Query | Remplace les 37 Context providers |
| **Formulaires** | React Hook Form + Zod | Validation type-safe |
| **Charts** | Recharts | Déjà utilisé, on garde |
| **PDF** | @react-pdf/renderer | Meilleur que jsPDF pour React |
| **Icons** | Lucide React | Déjà utilisé |
| **Animations** | Framer Motion | Déjà utilisé |
| **Drag & Drop** | @dnd-kit/core | Remplace react-beautiful-dnd (déprécié) |
| **Dates** | date-fns | Déjà utilisé |
| **Email** | Resend | Notifications email transactionnelles |
| **Déploiement** | Vercel | Intégration native Next.js |
| **Monitoring** | Vercel Analytics + Sentry | Performances + erreurs |

### Pourquoi Next.js plutôt que Vite+React ?

```
Vite+React SPA (actuel)          Next.js App Router (recommandé)
─────────────────────────────    ─────────────────────────────────
❌ RBAC uniquement côté client   ✅ RBAC côté serveur via Middleware
❌ Secrets exposables             ✅ Variables serveur sécurisées
❌ 37 Context providers          ✅ Server Components + Zustand léger
❌ Tout chargé en JS              ✅ SSR/SSG pour perfs optimales
❌ Routes non sécurisées          ✅ Middleware intercepte tout
❌ Difficile à déployer           ✅ `git push` → deploy sur Vercel
```

---

## 3. ARCHITECTURE GÉNÉRALE

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   NEXT.JS 14                         │   │
│  │                                                      │   │
│  │  ┌──────────────┐    ┌──────────────────────────┐   │   │
│  │  │  Middleware   │    │    Server Components      │   │   │
│  │  │  (RBAC check) │    │    (Data fetching)        │   │   │
│  │  └──────┬───────┘    └──────────┬───────────────┘   │   │
│  │         │                       │                    │   │
│  │  ┌──────▼───────────────────────▼───────────────┐   │   │
│  │  │           App Router (pages)                  │   │   │
│  │  │  /login  /[tenant]/dashboard  /admin          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │           API Routes (/api/...)               │   │   │
│  │  │  Logique métier sécurisée côté serveur        │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│                                                             │
│  PostgreSQL    Auth    Realtime    Storage    Edge Fns      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Row Level Security (RLS)               │    │
│  │         Isolation des données par tenant            │    │
│  └────��───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Modèle Multi-tenant

```
Platform (Super Admin)
    │
    ├── Tenant A (entreprise cliente)
    │       ├── Société 1
    │       │       ├── User 1 (admin)
    │       │       ├── User 2 (gestionnaire vente)
    │       │       └── User 3 (lecteur comptabilité)
    │       └── Société 2
    │               └── User 4 (contributeur stock)
    │
    └── Tenant B
            └── Société 1
                    └── ...
```

---

## 4. SCHÉMA DE BASE DE DONNÉES SUPABASE

### Script SQL complet — À exécuter dans Supabase SQL Editor

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type permission_level as enum ('aucun', 'lecteur', 'contributeur', 'gestionnaire', 'admin');
create type global_role as enum ('super_admin', 'admin', 'user');
create type module_key as enum (
  'comptabilite', 'vente', 'achat', 'stock',
  'rh', 'crm', 'teams', 'workflow',
  'rapports', 'securite', 'sauvegarde', 'presence'
);

-- ============================================================
-- TABLE: tenants
-- ============================================================
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null, -- utilisé dans l'URL
  plan text default 'starter', -- starter, pro, enterprise
  is_active boolean default true,
  max_users int default 10,
  max_societes int default 3,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TABLE: societes (entreprises dans un tenant)
-- ============================================================
create table societes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  raison_sociale text not null,
  sigle text,
  logo_url text,
  adresse text,
  ville text,
  pays text default 'Cameroun',
  telephone text,
  email text,
  site_web text,
  numero_contribuable text, -- NIU Cameroun
  numero_rccm text,
  capital_social numeric(15,2),
  devise text default 'XAF', -- Franc CFA
  secteur_activite text,
  forme_juridique text, -- SARL, SA, GIE, etc.
  exercice_fiscal_debut int default 1, -- mois (1=janvier)
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TABLE: profiles (extension de auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  role global_role default 'user',
  is_super_admin boolean default false,
  full_name text,
  avatar_url text,
  phone text,
  preferred_language text default 'fr',
  preferred_currency text default 'XAF',
  is_active boolean default true,
  last_login_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TABLE: user_societes (assignment utilisateur <-> société)
-- ============================================================
create table user_societes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  is_primary boolean default false, -- société principale de l'utilisateur
  created_at timestamptz default now(),
  unique(user_id, societe_id)
);

-- ============================================================
-- TABLE: user_module_permissions (RBAC granulaire)
-- ============================================================
create table user_module_permissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid references societes(id) on delete cascade, -- null = all companies
  module module_key not null,
  permission permission_level not null default 'aucun',
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, societe_id, module)
);

-- ============================================================
-- TABLE: tenant_modules (modules activés par tenant)
-- ============================================================
create table tenant_modules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module module_key not null,
  is_active boolean default true,
  config jsonb default '{}',
  activated_at timestamptz default now(),
  unique(tenant_id, module)
);

-- ============================================================
-- MODULE: VENTE (Sales)
-- ============================================================
create table vente_clients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  nom text not null,
  email text,
  telephone text,
  adresse text,
  ville text,
  pays text default 'Cameroun',
  numero_contribuable text,
  contact_principal text,
  notes text,
  credit_limit numeric(15,2) default 0,
  solde_credit numeric(15,2) default 0,
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table vente_devis (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  numero text not null,
  client_id uuid references vente_clients(id),
  client_nom text, -- pour clients occasionnels
  statut text default 'brouillon', -- brouillon, envoyé, accepté, refusé, expiré, converti
  date_emission date default current_date,
  date_expiration date,
  montant_ht numeric(15,2) default 0,
  tva_montant numeric(15,2) default 0,
  montant_ttc numeric(15,2) default 0,
  taux_tva numeric(5,2) default 19.25, -- TVA Cameroun
  devise text default 'XAF',
  notes text,
  conditions text,
  version int default 1,
  parent_devis_id uuid references vente_devis(id), -- pour versioning
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(societe_id, numero)
);

create table vente_devis_lignes (
  id uuid primary key default uuid_generate_v4(),
  devis_id uuid not null references vente_devis(id) on delete cascade,
  ordre int not null default 0,
  designation text not null,
  description text,
  quantite numeric(15,3) not null default 1,
  unite text default 'unité',
  prix_unitaire numeric(15,2) not null default 0,
  remise_pct numeric(5,2) default 0,
  montant_ht numeric(15,2) generated always as (quantite * prix_unitaire * (1 - remise_pct/100)) stored,
  created_at timestamptz default now()
);

create table vente_factures (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  numero text not null,
  devis_id uuid references vente_devis(id),
  client_id uuid references vente_clients(id),
  client_nom text,
  statut text default 'brouillon', -- brouillon, envoyée, payée, partiellement_payée, annulée
  date_emission date default current_date,
  date_echeance date,
  montant_ht numeric(15,2) default 0,
  tva_montant numeric(15,2) default 0,
  montant_ttc numeric(15,2) default 0,
  montant_paye numeric(15,2) default 0,
  taux_tva numeric(5,2) default 19.25,
  devise text default 'XAF',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(societe_id, numero)
);

create table vente_factures_lignes (
  id uuid primary key default uuid_generate_v4(),
  facture_id uuid not null references vente_factures(id) on delete cascade,
  ordre int not null default 0,
  designation text not null,
  quantite numeric(15,3) not null default 1,
  unite text default 'unité',
  prix_unitaire numeric(15,2) not null default 0,
  remise_pct numeric(5,2) default 0,
  montant_ht numeric(15,2) generated always as (quantite * prix_unitaire * (1 - remise_pct/100)) stored,
  created_at timestamptz default now()
);

-- ============================================================
-- MODULE: ACHAT (Purchasing)
-- ============================================================
create table achat_fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  nom text not null,
  email text,
  telephone text,
  adresse text,
  contact_principal text,
  conditions_paiement text,
  delai_livraison_jours int default 0,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table achat_commandes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  numero text not null,
  fournisseur_id uuid references achat_fournisseurs(id),
  statut text default 'brouillon', -- brouillon, confirmée, expédiée, reçue, annulée
  date_commande date default current_date,
  date_livraison_prevue date,
  montant_ht numeric(15,2) default 0,
  montant_ttc numeric(15,2) default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(societe_id, numero)
);

-- ============================================================
-- MODULE: STOCK (Inventory)
-- ============================================================
create table stock_articles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  reference text not null,
  designation text not null,
  description text,
  categorie text,
  unite text default 'unité',
  prix_achat numeric(15,2) default 0,
  prix_vente numeric(15,2) default 0,
  stock_actuel numeric(15,3) default 0,
  stock_minimum numeric(15,3) default 0,
  stock_maximum numeric(15,3),
  emplacement text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(societe_id, reference)
);

create table stock_mouvements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  article_id uuid not null references stock_articles(id),
  type_mouvement text not null, -- entree, sortie, ajustement, transfert
  quantite numeric(15,3) not null,
  stock_avant numeric(15,3) not null,
  stock_apres numeric(15,3) not null,
  prix_unitaire numeric(15,2),
  reference_source text, -- N° commande, N° facture, etc.
  source_type text, -- commande_achat, facture_vente, inventaire, manuel
  motif text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- MODULE: RH (Human Resources)
-- ============================================================
create table rh_employes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  user_id uuid references profiles(id), -- null si pas de compte
  matricule text,
  nom text not null,
  prenom text not null,
  email text,
  telephone text,
  date_naissance date,
  lieu_naissance text,
  nationalite text default 'Camerounaise',
  sexe text,
  adresse text,
  poste text,
  departement text,
  date_embauche date,
  type_contrat text default 'CDI', -- CDI, CDD, Stage, Consultant
  salaire_base numeric(15,2),
  cnps_numero text,
  cni_numero text,
  statut text default 'actif', -- actif, suspendu, démissionnaire, licencié
  photo_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table rh_conges (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  employe_id uuid not null references rh_employes(id) on delete cascade,
  type_conge text not null, -- annuel, maladie, maternité, paternité, sans_solde
  date_debut date not null,
  date_fin date not null,
  nb_jours int,
  statut text default 'en_attente', -- en_attente, approuvé, refusé, annulé
  motif text,
  commentaire_rh text,
  approuve_par uuid references profiles(id),
  approuve_le timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MODULE: CRM
-- ============================================================
create table crm_leads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  nom text not null,
  email text,
  telephone text,
  entreprise text,
  source text, -- web, référence, publicité, événement
  statut text default 'nouveau', -- nouveau, contacté, qualifié, converti, perdu
  score int default 0, -- lead scoring
  valeur_estimee numeric(15,2),
  notes text,
  assigne_a uuid references profiles(id),
  converti_en uuid references vente_clients(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table crm_opportunites (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  titre text not null,
  client_id uuid references vente_clients(id),
  etape text default 'prospection', -- prospection, qualification, proposition, négociation, gagnée, perdue
  probabilite int default 0, -- 0-100
  valeur numeric(15,2),
  date_cloture_prevue date,
  notes text,
  assigne_a uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MODULE: COMPTABILITÉ OHADA
-- ============================================================
create table compta_plan_comptable (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  numero text not null,
  intitule text not null,
  type_compte text, -- actif, passif, charge, produit, capitaux
  classe int, -- 1-9 selon OHADA
  sens text default 'debit', -- debit, credit
  is_systeme boolean default false, -- compte système non modifiable
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(societe_id, numero)
);

create table compta_exercices (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  statut text default 'ouvert', -- ouvert, cloture, archive
  created_at timestamptz default now()
);

create table compta_ecritures (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  exercice_id uuid references compta_exercices(id),
  numero_piece text,
  date_ecriture date not null,
  libelle text not null,
  journal text not null, -- VTE, ACH, BNQ, CAI, OD
  compte_id uuid not null references compta_plan_comptable(id),
  debit numeric(15,2) default 0,
  credit numeric(15,2) default 0,
  is_validated boolean default false,
  validated_by uuid references profiles(id),
  reference_source text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- MODULE: TEAMS (Collaboration)
-- ============================================================
create table team_channels (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  nom text not null,
  description text,
  type text default 'public', -- public, prive, dm
  membres uuid[] default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table team_messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_id uuid not null references team_channels(id) on delete cascade,
  contenu text not null,
  type text default 'text', -- text, file, image
  piece_jointe_url text,
  edited_at timestamptz,
  author_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table team_taches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  societe_id uuid not null references societes(id) on delete cascade,
  titre text not null,
  description text,
  statut text default 'a_faire', -- a_faire, en_cours, en_revision, termine
  priorite text default 'normale', -- basse, normale, haute, urgente
  assigne_a uuid references profiles(id),
  date_echeance date,
  tags text[],
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id),
  societe_id uuid references societes(id),
  user_id uuid references profiles(id),
  action text not null, -- create, update, delete, login, logout, permission_change
  resource_type text not null, -- table name
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  titre text not null,
  message text,
  data jsonb default '{}',
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);
```

---

## 5. SYSTÈME RBAC — LA SOLUTION COMPLÈTE

C'est la partie la plus importante. Voici l'approche propre qui résout tous les problèmes de l'implémentation actuelle.

### 5.1 Principe de base

```
RBAC = 3 niveaux complémentaires
    │
    ├── 1. Rôle global (super_admin / admin / user)
    │      Stocké dans profiles.role
    │
    ├── 2. Modules activés pour le tenant
    │      Stocké dans tenant_modules
    │
    └── 3. Permission par module par utilisateur
           Stocké dans user_module_permissions
           Niveaux: aucun → lecteur → contributeur → gestionnaire → admin
```

### 5.2 Matrice de permissions

```
                    super_admin  admin   gestionnaire  contributeur  lecteur  aucun
─────────────────────────────────────────────────────────────────────────────────
Voir le module          ✅        ✅          ✅             ✅          ✅      ❌
Lire les données        ✅        ✅          ✅             ✅          ✅      ❌
Créer                   ✅        ✅          ✅             ✅          ❌      ❌
Modifier                ✅        ✅          ✅        les siens       ❌      ❌
Supprimer               ✅        ✅          ✅             ❌          ❌      ❌
Valider/Approuver       ✅        ✅          ✅             ❌          ❌      ❌
Configurer module       ✅        ✅          ❌             ❌          ❌      ❌
```

### 5.3 RLS Policies Supabase (sécurité serveur)

```sql
-- Activer RLS sur toutes les tables
alter table vente_clients enable row level security;
alter table vente_devis enable row level security;
-- ... répéter pour toutes les tables

-- ─── FONCTION HELPER ───
create or replace function get_user_permission(
  p_module module_key,
  p_societe_id uuid default null
) returns permission_level as $$
declare
  v_role global_role;
  v_permission permission_level;
begin
  -- Super admin a tous les droits
  select role into v_role from profiles where id = auth.uid();
  if v_role = 'super_admin' then return 'admin'; end if;

  -- Admin du tenant a tous les droits
  if v_role = 'admin' then return 'admin'; end if;

  -- Chercher la permission spécifique
  select permission into v_permission
  from user_module_permissions
  where user_id = auth.uid()
    and module = p_module
    and (societe_id = p_societe_id or societe_id is null)
  order by societe_id nulls last -- la permission société spécifique prime
  limit 1;

  return coalesce(v_permission, 'aucun');
end;
$$ language plpgsql security definer stable;

-- ─── POLITIQUE VENTE_CLIENTS ───
-- Lecture : lecteur et plus
create policy "vente_clients_select" on vente_clients
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and get_user_permission('vente', societe_id) != 'aucun'
  );

-- Insertion : contributeur et plus
create policy "vente_clients_insert" on vente_clients
  for insert with check (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and get_user_permission('vente', societe_id) in ('contributeur', 'gestionnaire', 'admin')
  );

-- Mise à jour : contributeur (ses propres) + gestionnaire (tous)
create policy "vente_clients_update" on vente_clients
  for update using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (
      get_user_permission('vente', societe_id) in ('gestionnaire', 'admin')
      or (get_user_permission('vente', societe_id) = 'contributeur'
          and created_by = auth.uid())
    )
  );

-- Suppression : gestionnaire et plus
create policy "vente_clients_delete" on vente_clients
  for delete using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and get_user_permission('vente', societe_id) in ('gestionnaire', 'admin')
  );
```

### 5.4 Middleware Next.js (sécurité route)

```typescript
// middleware.ts (racine du projet)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Récupérer la session
  const { data: { session } } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Routes publiques
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url))
    return res
  }

  // Protection générale
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protection super admin
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)']
}
```

### 5.5 Hook usePermission (côté client)

```typescript
// hooks/usePermission.ts
import { useQuery } from '@tanstack/react-query'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'
type ModuleKey = 'comptabilite' | 'vente' | 'achat' | 'stock' | 'rh' | 'crm' | 'teams' | 'workflow' | 'rapports' | 'securite'

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  aucun: 0,
  lecteur: 1,
  contributeur: 2,
  gestionnaire: 3,
  admin: 4,
}

export function usePermission(module: ModuleKey, societeId?: string) {
  const supabase = createClientComponentClient()

  const { data: permission = 'aucun' } = useQuery({
    queryKey: ['permission', module, societeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_permission', {
        p_module: module,
        p_societe_id: societeId ?? null,
      })
      if (error) return 'aucun'
      return data as PermissionLevel
    },
  })

  const level = PERMISSION_HIERARCHY[permission]

  return {
    permission,
    canView: level >= 1,
    canCreate: level >= 2,
    canEdit: level >= 2,
    canDelete: level >= 3,
    canValidate: level >= 3,
    canConfigure: level >= 4,
    isAdmin: level >= 4,
    // Utilitaire
    hasAtLeast: (required: PermissionLevel) => level >= PERMISSION_HIERARCHY[required],
  }
}
```

### 5.6 Composants de garde (Guard Components)

```typescript
// components/guards/ModuleGuard.tsx
import { usePermission } from '@/hooks/usePermission'
import type { ModuleKey, PermissionLevel } from '@/types'

interface ModuleGuardProps {
  module: ModuleKey
  required?: PermissionLevel
  societeId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function ModuleGuard({
  module,
  required = 'lecteur',
  societeId,
  fallback = null,
  children,
}: ModuleGuardProps) {
  const { hasAtLeast } = usePermission(module, societeId)

  if (!hasAtLeast(required)) return <>{fallback}</>
  return <>{children}</>
}

// Utilisation dans une page
function VentePage() {
  const { canCreate, canDelete } = usePermission('vente')

  return (
    <div>
      <ModuleGuard module="vente" required="contributeur">
        <Button onClick={handleCreate}>+ Nouveau client</Button>
      </ModuleGuard>

      <ClientsList>
        {clients.map(client => (
          <ClientRow key={client.id}>
            {canDelete && (
              <Button variant="destructive" onClick={() => handleDelete(client.id)}>
                Supprimer
              </Button>
            )}
          </ClientRow>
        ))}
      </ClientsList>
    </div>
  )
}
```

---

## 6. STRUCTURE DU PROJET NEXT.JS

```
sili/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── (app)/
│   │   ├── layout.tsx                    # Layout principal avec Sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── settings/page.tsx
│   │   │
│   │   ├── modules/
│   │   │   ├── vente/
│   │   │   │   ├── page.tsx              # Dashboard vente
│   │   │   │   ├── clients/
│   │   │   │   │   ├── page.tsx          # Liste clients
│   │   │   │   │   ├── [id]/page.tsx     # Détail client
│   │   │   │   │   └── nouveau/page.tsx  # Création
│   │   │   │   ├── devis/...
│   │   │   │   └── factures/...
│   │   │   │
│   │   │   ├── achat/...
│   │   │   ├── stock/...
│   │   │   ├── rh/...
│   │   │   ├── crm/...
│   │   │   ├── comptabilite/...
│   │   │   ├── teams/...
│   │   │   ├── rapports/...
│   │   │   └── securite/...
│   │   │
│   │   └── company-select/page.tsx
│   │
│   ├── admin/                            # Super Admin uniquement
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Dashboard super admin
│   │   ├── tenants/...
│   │   ├── users/...
│   │   └── modules/...
│   │
│   └── api/
│       ├── auth/callback/route.ts
│       ├── tenants/route.ts
│       ├── users/route.ts
│       └── modules/[module]/route.ts
│
├── components/
│   ├── ui/                               # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── DashboardLayout.tsx
│   ├── guards/
│   │   ├── ModuleGuard.tsx
│   │   ├── AdminGuard.tsx
│   │   └── SuperAdminGuard.tsx
│   └── modules/
│       ├── vente/
│       ├── achat/
│       └── ...
│
├── hooks/
│   ├── usePermission.ts
│   ├── useCurrentSociete.ts
│   ├── useModules.ts
│   └── useRealtime.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Client-side Supabase
│   │   ├── server.ts                    # Server-side Supabase
│   │   └── types.ts                     # Types générés par Supabase CLI
│   └── utils.ts
│
├── stores/                              # Zustand stores
│   ├── authStore.ts
│   ├── societeStore.ts
│   └── uiStore.ts
│
├── types/
│   ├── database.ts                      # Types DB (générés)
│   ├── permissions.ts
│   └── modules.ts
│
├── middleware.ts                        # RBAC + auth middleware
├── next.config.js
├── tailwind.config.ts
└── package.json
```

---

## 7. IMPLÉMENTATION ÉTAPE PAR ÉTAPE

### Étape 1 — Initialiser le projet

```bash
# Créer le projet Next.js
npx create-next-app@latest sili --typescript --tailwind --eslint --app --src-dir=false

cd sili

# Installer les dépendances core
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod

# UI components
npx shadcn@latest init
npx shadcn@latest add button input label card dialog table badge select tabs

# Autres
npm install lucide-react recharts date-fns framer-motion
npm install @dnd-kit/core @dnd-kit/sortable
npm install @react-pdf/renderer
```

### Étape 2 — Configurer Supabase

```bash
# Installer Supabase CLI
npm install -g supabase

# Initialiser
supabase init
supabase login

# Générer les types TypeScript depuis le schéma
supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
```

```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './types'

export const supabase = createClientComponentClient<Database>()

// lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from './types'

export const createServerClient = () =>
  createServerComponentClient<Database>({ cookies })
```

```typescript
// .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # JAMAIS exposé côté client
```

### Étape 3 — Exécuter le schéma SQL

Dans Supabase Dashboard → SQL Editor :
1. Exécuter le script complet de la section 4
2. Activer RLS sur toutes les tables
3. Créer les policies RLS (section 5.3)
4. Insérer les modules par défaut :

```sql
-- Modules disponibles par défaut pour tous les tenants
-- (à activer manuellement selon le plan)
insert into tenant_modules (tenant_id, module, is_active)
select t.id, m.module, false
from tenants t
cross join (
  values
    ('comptabilite'::module_key),
    ('vente'::module_key),
    ('achat'::module_key),
    ('stock'::module_key),
    ('rh'::module_key),
    ('crm'::module_key),
    ('teams'::module_key),
    ('rapports'::module_key),
    ('securite'::module_key),
    ('workflow'::module_key)
) as m(module);
```

### Étape 4 — Authentification

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleLogin}>
      {/* formulaire shadcn/ui */}
    </form>
  )
}
```

### Étape 5 — State Management avec Zustand

```typescript
// stores/societeStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Societe {
  id: string
  tenant_id: string
  raison_sociale: string
  devise: string
}

interface SocieteStore {
  currentSociete: Societe | null
  societes: Societe[]
  setSocietes: (societes: Societe[]) => void
  setCurrentSociete: (societe: Societe) => void
}

export const useSocieteStore = create<SocieteStore>()(
  persist(
    (set) => ({
      currentSociete: null,
      societes: [],
      setSocietes: (societes) => set({ societes }),
      setCurrentSociete: (societe) => set({ currentSociete: societe }),
    }),
    { name: 'sili-societe' }
  )
)
```

### Étape 6 — TanStack Query pour les données

```typescript
// hooks/useClients.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useSocieteStore } from '@/stores/societeStore'

export function useClients() {
  const { currentSociete } = useSocieteStore()

  return useQuery({
    queryKey: ['clients', currentSociete?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vente_clients')
        .select('*')
        .eq('societe_id', currentSociete!.id)
        .order('nom')

      if (error) throw error
      return data
    },
    enabled: !!currentSociete,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { currentSociete } = useSocieteStore()

  return useMutation({
    mutationFn: async (data: Partial<VenteClient>) => {
      const { data: client, error } = await supabase
        .from('vente_clients')
        .insert({ ...data, societe_id: currentSociete!.id, tenant_id: currentSociete!.tenant_id })
        .select()
        .single()

      if (error) throw error
      return client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
```

---

## 8. MODULES À IMPLÉMENTER

### Priorité 1 — Fondations (Semaine 1-2)
- [ ] Auth (login, logout, reset password)
- [ ] Multi-tenancy (tenant creation, user invitation)
- [ ] RBAC complet (permissions, middleware, guards)
- [ ] Layout principal (sidebar, header, navigation)
- [ ] Gestion des sociétés

### Priorité 2 — Modules Core (Semaine 3-6)
- [ ] **Vente** : Clients → Devis → Factures → Paiements
- [ ] **Achat** : Fournisseurs → Commandes → Réceptions → Factures
- [ ] **Stock** : Articles → Mouvements → Alertes

### Priorité 3 — Modules Avancés (Semaine 7-10)
- [ ] **Comptabilité OHADA** : Plan comptable → Journal → Grand livre → Bilan
- [ ] **RH** : Employés → Congés → Présences → Paie
- [ ] **CRM** : Leads → Opportunités → Pipeline

### Priorité 4 — Collaboration & Analytics (Semaine 11-14)
- [ ] **Teams** : Messagerie (Realtime) → Tâches → Calendrier
- [ ] **Rapports** : Builder → Exports PDF/Excel
- [ ] **Sécurité** : Audit logs → Backup

### Fonctionnalités transversales
- [ ] Notifications en temps réel (Supabase Realtime)
- [ ] Export PDF (factures, devis, rapports)
- [ ] Upload fichiers (Supabase Storage)
- [ ] Internationalisation FR/EN (next-intl)
- [ ] Mode sombre/clair (shadcn/ui themes)

---

## 9. DÉPLOIEMENT VERCEL

### Configuration de base

```bash
# Installer Vercel CLI
npm i -g vercel

# Depuis le dossier du projet
vercel login
vercel

# Production
vercel --prod
```

### Variables d'environnement sur Vercel

Dans le dashboard Vercel → Settings → Environment Variables :

```
NEXT_PUBLIC_SUPABASE_URL         = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = eyJ...
SUPABASE_SERVICE_ROLE_KEY        = eyJ...  (Environment: Production & Preview uniquement)
NEXTAUTH_SECRET                  = (générer avec: openssl rand -base64 32)
NEXT_PUBLIC_APP_URL              = https://votre-domaine.com
```

### vercel.json (configuration optionnelle)

```json
{
  "regions": ["cdg1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Configuration Supabase pour la prod

Dans Supabase → Auth → URL Configuration :
```
Site URL: https://votre-app.vercel.app
Redirect URLs:
  - https://votre-app.vercel.app/**
  - https://votre-domaine.com/**
```

### Pipeline CI/CD recommandé

```
Git Push → GitHub
    ↓
GitHub Actions (tests, lint)
    ↓
Vercel Preview Deploy (PR)
    ↓
Review & Merge
    ↓
Vercel Production Deploy (auto)
```

---

## 10. CHECKLIST DE MIGRATION

### Base de données
- [ ] Exécuter le schéma SQL sur le nouveau projet Supabase
- [ ] Configurer toutes les policies RLS
- [ ] Créer la fonction `get_user_permission()`
- [ ] Migrer les données existantes (script d'export/import)
- [ ] Vérifier l'isolation des tenants

### Authentification
- [ ] Configurer Supabase Auth
- [ ] Tester login/logout/reset
- [ ] Configurer les URLs de redirection
- [ ] Tester le flow d'invitation utilisateur

### RBAC
- [ ] Tester chaque niveau de permission (lecteur/contributeur/gestionnaire/admin)
- [ ] Vérifier que le middleware bloque les routes non autorisées
- [ ] Vérifier que les policies RLS bloquent les requêtes directes
- [ ] Tester l'isolation multi-tenant (un user ne doit JAMAIS voir les données d'un autre tenant)

### Modules
- [ ] Vente : CRUD complet + workflow devis→facture
- [ ] Achat : CRUD complet + workflow commande→réception
- [ ] Stock : mouvements auto (achat/vente) + alertes
- [ ] Comptabilité : plan OHADA + écritures + états financiers
- [ ] RH : employés + congés + workflow approbation
- [ ] CRM : leads + pipeline Kanban
- [ ] Teams : messagerie Realtime + tâches

### Performance
- [ ] Ajouter les index manquants sur tenant_id + societe_id
- [ ] Configurer le caching TanStack Query
- [ ] Tester avec 10+ tenants simultanés

---

## COÛT ESTIMATIF

| Service | Plan | Prix/mois |
|---------|------|-----------|
| Supabase | Pro | 25$ |
| Vercel | Pro | 20$ |
| Domaine | - | 10$/an |
| **Total** | | **~50$/mois** |

Pour un SaaS multi-tenant en production avec des dizaines de clients, ce coût est très raisonnable. Supabase Pro inclut 8GB de stockage, 100k requêtes auth/mois, et Realtime illimité.

---

## RESSOURCES

- [Next.js 14 App Router](https://nextjs.org/docs/app)
- [Supabase Auth Helpers for Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query)
- [Zustand State Management](https://zustand-demo.pmnd.rs)
