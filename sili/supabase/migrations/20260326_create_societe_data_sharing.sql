-- Migration: Table societe_data_sharing
-- Partage de données directionnel entre sociétés, par module
-- source partage vers target — le retour n'est pas automatique

CREATE TABLE IF NOT EXISTS public.societe_data_sharing (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_societe_id uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  target_societe_id uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  module            text NOT NULL,
  is_active         bool NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (source_societe_id, target_societe_id, module),
  CHECK (source_societe_id <> target_societe_id)
);

CREATE INDEX IF NOT EXISTS societe_data_sharing_source_idx ON public.societe_data_sharing (source_societe_id);
CREATE INDEX IF NOT EXISTS societe_data_sharing_target_idx ON public.societe_data_sharing (target_societe_id);

ALTER TABLE public.societe_data_sharing ENABLE ROW LEVEL SECURITY;

-- SELECT : tenant_admin ou tenant_user du même tenant que la source
CREATE POLICY "societe_data_sharing_select"
ON public.societe_data_sharing FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_data_sharing.source_societe_id AND p.id = auth.uid()
  )
);

-- INSERT : tenant_admin du tenant de la source uniquement
CREATE POLICY "societe_data_sharing_insert"
ON public.societe_data_sharing FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_data_sharing.source_societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);

-- UPDATE : tenant_admin du tenant de la source uniquement
CREATE POLICY "societe_data_sharing_update"
ON public.societe_data_sharing FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_data_sharing.source_societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);

-- DELETE : tenant_admin du tenant de la source uniquement
CREATE POLICY "societe_data_sharing_delete"
ON public.societe_data_sharing FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_data_sharing.source_societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);
