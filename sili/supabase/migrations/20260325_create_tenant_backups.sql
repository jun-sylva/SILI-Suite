-- Migration: Création de la table tenant_backups

CREATE TABLE IF NOT EXISTS public.tenant_backups (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  size_mb       NUMERIC(10, 2),
  triggered_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tenant_backups_tenant_id_idx ON public.tenant_backups (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_backups_created_at_idx ON public.tenant_backups (created_at DESC);

ALTER TABLE public.tenant_backups ENABLE ROW LEVEL SECURITY;

-- tenant_admin lit les backups de son tenant ; super_admin lit tout
CREATE POLICY "tenant_backups_select"
ON public.tenant_backups FOR SELECT
USING (
  (
    SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()
  )
  OR
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role = 'tenant_admin'
  )
);

-- Insertion : le tenant_admin peut déclencher un backup
CREATE POLICY "tenant_backups_insert"
ON public.tenant_backups FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role = 'tenant_admin'
  )
);
