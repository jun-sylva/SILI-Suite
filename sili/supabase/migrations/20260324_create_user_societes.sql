-- Migration : Recréation propre de la table user_societes
-- La table existe déjà mais est vide — on la recrée pour corriger la structure.
--
-- NOTE : Les rôles (none/viewer/contributor/manager/admin) s'appliquent PAR MODULE
--        via la table user_module_permissions, PAS sur la liaison user_societes.
--        user_societes = simple table de liaison utilisateur ↔ société (accès actif/révoqué).

-- 1. Nettoyer l'ancienne table et l'éventuelle table legacy
DROP TABLE IF EXISTS public.utilisateurs_societe CASCADE;
DROP TABLE IF EXISTS public.user_societes CASCADE;

-- 2. Recréer la table propre
CREATE TABLE public.user_societes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  societe_id  UUID NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, societe_id)
);

-- 3. RLS
ALTER TABLE public.user_societes ENABLE ROW LEVEL SECURITY;

-- tenant_user : lit uniquement ses propres lignes
CREATE POLICY "user_societes_select_own" ON public.user_societes FOR SELECT
USING (user_id = auth.uid());

-- tenant_admin : lit toutes les lignes des sociétés de son tenant
CREATE POLICY "user_societes_select_admin" ON public.user_societes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.societes s ON s.tenant_id = p.tenant_id
    WHERE p.id = auth.uid()
      AND p.role = 'tenant_admin'
      AND s.id = public.user_societes.societe_id
  )
);

-- Insertion/Modification : service role uniquement (via API route /api/admin/create-user)
-- Pas de politique INSERT/UPDATE/DELETE côté client pour sécuriser.
