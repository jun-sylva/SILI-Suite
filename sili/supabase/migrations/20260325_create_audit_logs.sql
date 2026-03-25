-- Migration: Création de la table audit_logs
-- Journalise toutes les actions sensibles par tenant

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  action        TEXT        NOT NULL,        -- ex: 'user.created', 'societe.deactivated', 'auth.login', 'auth.login_failed'
  resource_type TEXT,                        -- 'user', 'societe', 'auth', 'permission', ...
  resource_id   TEXT,                        -- id de la ressource concernée
  metadata      JSONB       DEFAULT '{}',    -- données supplémentaires
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx    ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx      ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx       ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx   ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- tenant_admin voit les logs de son tenant ; super_admin voit tout
CREATE POLICY "audit_logs_select"
ON public.audit_logs FOR SELECT
USING (
  (
    SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()
  )
  OR
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role = 'tenant_admin'
  )
);

-- Insertion : service role uniquement (journalisation côté serveur)
