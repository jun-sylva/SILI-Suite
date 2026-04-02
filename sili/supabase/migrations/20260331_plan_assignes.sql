-- ─────────────────────────────────────────────────────────────────
-- Multi-assignation : tâches et jalons planification
-- ─────────────────────────────────────────────────────────────────

-- 1. Assignations tâches
CREATE TABLE IF NOT EXISTS public.plan_tache_assignes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tache_id   uuid NOT NULL REFERENCES public.plan_taches(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id   uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pta_source CHECK (
    (user_id IS NOT NULL AND group_id IS NULL) OR
    (user_id IS NULL AND group_id IS NOT NULL)
  ),
  CONSTRAINT pta_unique UNIQUE (tache_id, user_id, group_id)
);

CREATE INDEX IF NOT EXISTS plan_tache_assignes_tache_idx ON public.plan_tache_assignes(tache_id);
CREATE INDEX IF NOT EXISTS plan_tache_assignes_user_idx  ON public.plan_tache_assignes(user_id);
CREATE INDEX IF NOT EXISTS plan_tache_assignes_group_idx ON public.plan_tache_assignes(group_id);

ALTER TABLE public.plan_tache_assignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pta_select ON public.plan_tache_assignes FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY pta_insert ON public.plan_tache_assignes FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY pta_delete ON public.plan_tache_assignes FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Assignations jalons
CREATE TABLE IF NOT EXISTS public.plan_jalon_assignes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jalon_id   uuid NOT NULL REFERENCES public.plan_jalons(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id   uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pja_source CHECK (
    (user_id IS NOT NULL AND group_id IS NULL) OR
    (user_id IS NULL AND group_id IS NOT NULL)
  ),
  CONSTRAINT pja_unique UNIQUE (jalon_id, user_id, group_id)
);

CREATE INDEX IF NOT EXISTS plan_jalon_assignes_jalon_idx ON public.plan_jalon_assignes(jalon_id);
CREATE INDEX IF NOT EXISTS plan_jalon_assignes_user_idx  ON public.plan_jalon_assignes(user_id);
CREATE INDEX IF NOT EXISTS plan_jalon_assignes_group_idx ON public.plan_jalon_assignes(group_id);

ALTER TABLE public.plan_jalon_assignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pja_select ON public.plan_jalon_assignes FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY pja_insert ON public.plan_jalon_assignes FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY pja_delete ON public.plan_jalon_assignes FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));