-- Migration: Création de master_audit_logs
-- Table dédiée aux actions des comptes Master (is_super_admin)
-- level et service sont stockés nativement — pas de mapping côté client

CREATE TABLE IF NOT EXISTS public.master_audit_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  level         text NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  service       text NOT NULL CHECK (service IN ('auth', 'system', 'database', 'network')),
  resource_type text,
  resource_id   text,
  message       text NOT NULL,
  metadata      jsonb DEFAULT '{}',
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS master_audit_logs_created_at_idx ON public.master_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS master_audit_logs_actor_id_idx   ON public.master_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS master_audit_logs_level_idx      ON public.master_audit_logs (level);

-- RLS
ALTER TABLE public.master_audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT : uniquement les super_admin
CREATE POLICY "master_audit_logs_select"
ON public.master_audit_logs FOR SELECT
USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()));

-- INSERT : uniquement via service role (API route) — aucune policy INSERT anon/auth
