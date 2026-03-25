-- Migration : Correction politique RLS table tenants
-- Problème : la condition LIKE sur UUID était instable et bloquait la lecture de max_storage_gb
--
-- Règles :
--   - super_admin    → accès à tous les tenants
--   - tenant_admin   → accès uniquement au tenant auquel son profil est rattaché
--   - tenant_user    → pas d'accès direct au tenant (géré via societes, traité lors des formulaires utilisateurs)

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Remplace l'ancienne politique défaillante
DROP POLICY IF EXISTS "tenants_membership_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_read_own" ON public.tenants;

-- tenant_admin : lecture de son propre tenant
CREATE POLICY "tenants_read_admin" ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'tenant_admin'
      AND tenant_id = public.tenants.id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  )
);
