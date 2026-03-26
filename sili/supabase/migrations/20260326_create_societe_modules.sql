-- Migration: Table societe_modules
-- Modules activés par société (sous-ensemble de tenant_modules)
-- Contrainte : seuls les modules actifs dans tenant_modules peuvent être activés ici

CREATE TABLE IF NOT EXISTS public.societe_modules (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  societe_id   uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  module       text NOT NULL,
  is_active    bool NOT NULL DEFAULT true,
  activated_at timestamptz DEFAULT now(),
  UNIQUE (societe_id, module)
);

CREATE INDEX IF NOT EXISTS societe_modules_societe_id_idx ON public.societe_modules (societe_id);
CREATE INDEX IF NOT EXISTS societe_modules_module_idx     ON public.societe_modules (module);

ALTER TABLE public.societe_modules ENABLE ROW LEVEL SECURITY;

-- SELECT : tout utilisateur appartenant au même tenant que la société
CREATE POLICY "societe_modules_select"
ON public.societe_modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_modules.societe_id AND p.id = auth.uid()
  )
);

-- INSERT : tenant_admin uniquement
CREATE POLICY "societe_modules_insert"
ON public.societe_modules FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_modules.societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);

-- UPDATE : tenant_admin uniquement
CREATE POLICY "societe_modules_update"
ON public.societe_modules FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_modules.societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);

-- DELETE : tenant_admin uniquement
CREATE POLICY "societe_modules_delete"
ON public.societe_modules FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.societes s
    JOIN public.profiles p ON p.tenant_id = s.tenant_id
    WHERE s.id = societe_modules.societe_id AND p.id = auth.uid() AND p.role = 'tenant_admin'
  )
);
