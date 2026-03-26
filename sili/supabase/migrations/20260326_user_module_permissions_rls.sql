-- Migration: RLS + contrainte unique sur user_module_permissions
-- Contrainte unique nécessaire pour upsert (user_id, societe_id, module)

ALTER TABLE public.user_module_permissions
  ADD CONSTRAINT ump_unique_user_societe_module UNIQUE (user_id, societe_id, module);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur lui-même OU tenant_admin du même tenant
CREATE POLICY "ump_select"
ON public.user_module_permissions FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'tenant_admin'
      AND p.tenant_id = user_module_permissions.tenant_id
  )
);

-- INSERT : tenant_admin du même tenant uniquement
CREATE POLICY "ump_insert"
ON public.user_module_permissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'tenant_admin'
      AND p.tenant_id = user_module_permissions.tenant_id
  )
);

-- UPDATE : tenant_admin du même tenant uniquement
CREATE POLICY "ump_update"
ON public.user_module_permissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'tenant_admin'
      AND p.tenant_id = user_module_permissions.tenant_id
  )
);

-- DELETE : tenant_admin du même tenant uniquement
CREATE POLICY "ump_delete"
ON public.user_module_permissions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'tenant_admin'
      AND p.tenant_id = user_module_permissions.tenant_id
  )
);
