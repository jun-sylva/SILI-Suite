-- Migration : création table rh_bulletins_paie
-- Date : 2026-03-27

CREATE TABLE IF NOT EXISTS public.rh_bulletins_paie (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id)      ON DELETE CASCADE,
  societe_id   uuid        NOT NULL REFERENCES public.societes(id)     ON DELETE CASCADE,
  employe_id   uuid        NOT NULL REFERENCES public.rh_employes(id)  ON DELETE CASCADE,
  mois         int         NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee        int         NOT NULL CHECK (annee >= 2000),
  storage_path text        NOT NULL,
  nom_fichier  text        NOT NULL,
  taille_kb    int,
  uploaded_by  uuid        REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rh_bulletins_paie_unique UNIQUE (employe_id, mois, annee)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rh_bulletins_paie_employe  ON public.rh_bulletins_paie(employe_id);
CREATE INDEX IF NOT EXISTS idx_rh_bulletins_paie_societe  ON public.rh_bulletins_paie(societe_id);
CREATE INDEX IF NOT EXISTS idx_rh_bulletins_paie_tenant   ON public.rh_bulletins_paie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_bulletins_paie_mois     ON public.rh_bulletins_paie(mois, annee);

-- RLS
ALTER TABLE public.rh_bulletins_paie ENABLE ROW LEVEL SECURITY;

-- SELECT : isolation par tenant (contrôle fin géré dans l'app)
CREATE POLICY "rh_bulletins_paie_select" ON public.rh_bulletins_paie
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- INSERT : même tenant
CREATE POLICY "rh_bulletins_paie_insert" ON public.rh_bulletins_paie
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- UPDATE : même tenant
CREATE POLICY "rh_bulletins_paie_update" ON public.rh_bulletins_paie
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- DELETE : même tenant (contrôle admin/gestionnaire géré dans l'app)
CREATE POLICY "rh_bulletins_paie_delete" ON public.rh_bulletins_paie
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );
