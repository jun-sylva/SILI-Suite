-- Migration : Nettoyage table societes + ajout storage_gb
-- 1. Supprimer les colonnes inutilisées
ALTER TABLE public.societes DROP COLUMN IF EXISTS exercice_fiscal_debut;

-- 2. Ajouter le champ d'allocation de stockage par société (en GB)
ALTER TABLE public.societes ADD COLUMN IF NOT EXISTS storage_gb NUMERIC(5,2) DEFAULT 0 NOT NULL;
