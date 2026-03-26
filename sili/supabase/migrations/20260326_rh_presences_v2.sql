-- ============================================================
-- rh_presences v2
-- Ajout heure_entree / heure_sortie
-- statut devient nullable (NULL = en cours, géré côté app)
-- présent = entrée + sortie enregistrées
-- absent  = aucune entrée (pas de ligne ou statut forcé)
-- ============================================================

-- Nouvelles colonnes
ALTER TABLE public.rh_presences
  ADD COLUMN IF NOT EXISTS heure_entree timestamptz,
  ADD COLUMN IF NOT EXISTS heure_sortie timestamptz;

-- Rendre statut nullable
ALTER TABLE public.rh_presences ALTER COLUMN statut DROP NOT NULL;
ALTER TABLE public.rh_presences ALTER COLUMN statut SET DEFAULT NULL;

-- Mettre à jour la contrainte CHECK pour autoriser NULL
ALTER TABLE public.rh_presences DROP CONSTRAINT IF EXISTS rh_presences_statut_check;
ALTER TABLE public.rh_presences ADD CONSTRAINT rh_presences_statut_check
  CHECK (statut IS NULL OR statut IN ('present','absent','retard','conge','mission'));
