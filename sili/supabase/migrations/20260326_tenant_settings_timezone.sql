-- ============================================================
-- tenants — ajout colonne timezone
-- Fuseau horaire du tenant (IANA, ex: 'Africa/Douala')
-- Utilisé par le module RH pour l'affichage des heures
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Douala';
