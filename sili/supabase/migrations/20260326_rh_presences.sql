-- ============================================================
-- Table: rh_presences
-- Pointage quotidien des employés
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_presences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id)     ON DELETE CASCADE,
  societe_id  uuid        NOT NULL REFERENCES public.societes(id)    ON DELETE CASCADE,
  employe_id  uuid        NOT NULL REFERENCES public.rh_employes(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  statut      text        NOT NULL CHECK (statut IN ('present','absent','retard','conge','mission')),
  note        text,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employe_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS rh_presences_societe_date_idx ON public.rh_presences (societe_id, date);
CREATE INDEX IF NOT EXISTS rh_presences_employe_idx      ON public.rh_presences (employe_id);
CREATE INDEX IF NOT EXISTS rh_presences_tenant_idx       ON public.rh_presences (tenant_id);

-- RLS
ALTER TABLE public.rh_presences ENABLE ROW LEVEL SECURITY;

-- Lecture : même tenant
CREATE POLICY "rh_presences_select" ON public.rh_presences
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Écriture : même tenant (permission gestionnaire vérifiée côté application)
CREATE POLICY "rh_presences_insert" ON public.rh_presences
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "rh_presences_update" ON public.rh_presences
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "rh_presences_delete" ON public.rh_presences
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
