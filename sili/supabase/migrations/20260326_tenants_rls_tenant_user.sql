-- Migration : Ajout accès SELECT tenants pour tenant_user
-- Problème : la policy tenants_read_admin exclut tenant_user,
-- qui ne peut donc pas lire le slug de son propre tenant dans le middleware → redirect /unauthorized
--
-- Fix : tenant_user peut lire son propre tenant (lecture seule, son profil doit pointer vers ce tenant)

CREATE POLICY "tenants_read_tenant_user" ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'tenant_user'
      AND tenant_id = public.tenants.id
  )
);
