-- Migration : ajout situation familiale sur rh_employes
-- Date : 2026-03-29

ALTER TABLE public.rh_employes
  ADD COLUMN IF NOT EXISTS etat_civil  text CHECK (etat_civil IN ('celibataire','marie','veuf','separe','divorce')),
  ADD COLUMN IF NOT EXISTS nb_enfants  int  NOT NULL DEFAULT 0 CHECK (nb_enfants >= 0);
