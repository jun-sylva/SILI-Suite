-- ============================================================
-- Table: rh_employe_documents
-- Documents officiels des employés (CNI, Passeport, CNPS, etc.)
-- Stockés dans le bucket sili-files
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_employe_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id)     ON DELETE CASCADE,
  societe_id   uuid        NOT NULL REFERENCES public.societes(id)    ON DELETE CASCADE,
  employe_id   uuid        NOT NULL REFERENCES public.rh_employes(id) ON DELETE CASCADE,
  type_doc     text        NOT NULL CHECK (type_doc IN ('cni','passeport','cnps','diplome','contrat','autre')),
  nom_fichier  text        NOT NULL,
  storage_path text        NOT NULL,
  taille_kb    integer,
  uploaded_by  uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS rh_employe_docs_employe_idx ON public.rh_employe_documents (employe_id);
CREATE INDEX IF NOT EXISTS rh_employe_docs_tenant_idx  ON public.rh_employe_documents (tenant_id);

-- RLS
ALTER TABLE public.rh_employe_documents ENABLE ROW LEVEL SECURITY;

-- Lecture : même tenant
CREATE POLICY "rh_employe_docs_select" ON public.rh_employe_documents
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Écriture : même tenant (permission gestionnaire vérifiée côté application)
CREATE POLICY "rh_employe_docs_insert" ON public.rh_employe_documents
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "rh_employe_docs_delete" ON public.rh_employe_documents
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
