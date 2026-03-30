-- ─────────────────────────────────────────────────────────────────
-- Module Planification — Tables + RLS + sys_modules
-- ─────────────────────────────────────────────────────────────────

-- 1. Projets
CREATE TABLE IF NOT EXISTS public.plan_projets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id    uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  titre         text NOT NULL,
  description   text,
  statut        text NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon','actif','en_pause','termine','annule')),
  priorite      text NOT NULL DEFAULT 'normale'
                  CHECK (priorite IN ('basse','normale','haute','critique')),
  couleur       text NOT NULL DEFAULT '#6366f1',
  date_debut    date,
  date_fin      date,
  responsable_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_projets_societe_idx ON public.plan_projets(societe_id);
CREATE INDEX IF NOT EXISTS plan_projets_tenant_idx  ON public.plan_projets(tenant_id);

ALTER TABLE public.plan_projets ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_projets_select ON public.plan_projets FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_projets_insert ON public.plan_projets FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_projets_update ON public.plan_projets FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_projets_delete ON public.plan_projets FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Tâches
CREATE TABLE IF NOT EXISTS public.plan_taches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id           uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  projet_id            uuid NOT NULL REFERENCES public.plan_projets(id) ON DELETE CASCADE,
  titre                text NOT NULL,
  description          text,
  statut               text NOT NULL DEFAULT 'todo'
                         CHECK (statut IN ('todo','en_cours','revue','fait')),
  priorite             text NOT NULL DEFAULT 'normale'
                         CHECK (priorite IN ('basse','normale','haute','critique')),
  assigne_a            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigne_groupe       uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  date_debut           date,
  date_echeance        date,
  date_completee       timestamptz,
  ordre                int NOT NULL DEFAULT 0,
  tags                 text[] DEFAULT '{}',
  workflow_instance_id uuid REFERENCES public.workflow_instances(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_taches_projet_idx  ON public.plan_taches(projet_id);
CREATE INDEX IF NOT EXISTS plan_taches_societe_idx ON public.plan_taches(societe_id);
CREATE INDEX IF NOT EXISTS plan_taches_assigne_idx ON public.plan_taches(assigne_a);

ALTER TABLE public.plan_taches ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_taches_select ON public.plan_taches FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_taches_insert ON public.plan_taches FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_taches_update ON public.plan_taches FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_taches_delete ON public.plan_taches FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 3. Jalons
CREATE TABLE IF NOT EXISTS public.plan_jalons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id   uuid NOT NULL REFERENCES public.plan_projets(id) ON DELETE CASCADE,
  titre       text NOT NULL,
  date_cible  date NOT NULL,
  statut      text NOT NULL DEFAULT 'en_attente'
                CHECK (statut IN ('en_attente','atteint','manque')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_jalons_projet_idx ON public.plan_jalons(projet_id);

ALTER TABLE public.plan_jalons ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_jalons_select ON public.plan_jalons FOR SELECT
  USING (projet_id IN (
    SELECT id FROM public.plan_projets WHERE tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY plan_jalons_insert ON public.plan_jalons FOR INSERT
  WITH CHECK (projet_id IN (
    SELECT id FROM public.plan_projets WHERE tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY plan_jalons_update ON public.plan_jalons FOR UPDATE
  USING (projet_id IN (
    SELECT id FROM public.plan_projets WHERE tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY plan_jalons_delete ON public.plan_jalons FOR DELETE
  USING (projet_id IN (
    SELECT id FROM public.plan_projets WHERE tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

-- 4. Événements
CREATE TABLE IF NOT EXISTS public.plan_evenements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id     uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  titre          text NOT NULL,
  description    text,
  type           text NOT NULL DEFAULT 'reunion'
                   CHECK (type IN ('reunion','formation','deadline','rappel','conge_equipe')),
  date_debut     timestamptz NOT NULL,
  date_fin       timestamptz NOT NULL,
  all_day        bool NOT NULL DEFAULT false,
  couleur        text NOT NULL DEFAULT '#6366f1',
  organisateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  participants   uuid[] DEFAULT '{}',
  lien_meet      text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_evenements_societe_idx   ON public.plan_evenements(societe_id);
CREATE INDEX IF NOT EXISTS plan_evenements_date_debut_idx ON public.plan_evenements(date_debut);

ALTER TABLE public.plan_evenements ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_evenements_select ON public.plan_evenements FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_evenements_insert ON public.plan_evenements FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_evenements_update ON public.plan_evenements FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY plan_evenements_delete ON public.plan_evenements FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 5. Enregistrement dans sys_modules (désactivé par défaut)
INSERT INTO public.sys_modules (key, name, description, icon, is_active)
VALUES ('planning', 'Planification', 'Projets, tâches, calendrier et gestion des ressources', 'CalendarDays', false)
ON CONFLICT (key) DO NOTHING;
