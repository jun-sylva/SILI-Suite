-- ============================================================
-- Module RH — Table rh_employes
-- DROP + CREATE (table vide)
-- ============================================================

DROP TABLE IF EXISTS public.rh_employes CASCADE;

-- ── Fonction matricule unique (8 chiffres) ───────────────────
CREATE OR REPLACE FUNCTION public.generate_matricule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mat  TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.matricule IS NOT NULL AND NEW.matricule != '' THEN
    RETURN NEW;
  END IF;
  LOOP
    v_mat := LPAD((FLOOR(RANDOM() * 90000000) + 10000000)::INT::TEXT, 8, '0');
    SELECT EXISTS(SELECT 1 FROM public.rh_employes WHERE matricule = v_mat) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  NEW.matricule := v_mat;
  RETURN NEW;
END;
$$;

-- ── Création table ───────────────────────────────────────────
CREATE TABLE public.rh_employes (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  societe_id      UUID        NOT NULL REFERENCES public.societes(id)   ON DELETE CASCADE,
  user_id         UUID        NULL     REFERENCES auth.users(id)        ON DELETE SET NULL,
  matricule       TEXT        UNIQUE NOT NULL DEFAULT '',

  -- Identité
  nom             TEXT        NOT NULL,
  prenom          TEXT        NOT NULL,
  sexe            TEXT        CHECK (sexe IN ('M', 'F')),
  date_naissance  DATE,
  lieu_naissance  TEXT,
  nationalite     TEXT,
  adresse         TEXT,

  -- Contact
  email           TEXT,
  telephone       TEXT,

  -- Poste
  poste           TEXT,
  departement     TEXT,
  date_embauche   DATE,
  type_contrat    TEXT        CHECK (type_contrat IN ('CDI','CDD','Stage','Freelance','Consultant')),
  salaire_base    NUMERIC(12,2),

  -- Documents officiels
  cni_numero      TEXT,
  cnps_numero     TEXT,
  photo_url       TEXT,

  -- Statut
  statut          TEXT        NOT NULL DEFAULT 'actif'
                              CHECK (statut IN ('actif','inactif','suspendu','conge')),

  -- Traçabilité
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Triggers ────────────────────────────────────────────────

-- Matricule auto-généré avant INSERT
CREATE TRIGGER trg_generate_matricule
  BEFORE INSERT ON public.rh_employes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_matricule();

-- updated_at auto
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_rh_employes_updated_at
  BEFORE UPDATE ON public.rh_employes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX idx_rh_employes_societe   ON public.rh_employes(societe_id);
CREATE INDEX idx_rh_employes_tenant    ON public.rh_employes(tenant_id);
CREATE INDEX idx_rh_employes_user      ON public.rh_employes(user_id);
CREATE INDEX idx_rh_employes_statut    ON public.rh_employes(statut);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.rh_employes ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur du même tenant
CREATE POLICY "rh_employes_select" ON public.rh_employes FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Écriture (INSERT/UPDATE) : tenant_admin uniquement
CREATE POLICY "rh_employes_insert" ON public.rh_employes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'tenant_admin'
      AND tenant_id = public.rh_employes.tenant_id
  )
);

CREATE POLICY "rh_employes_update" ON public.rh_employes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'tenant_admin'
      AND tenant_id = public.rh_employes.tenant_id
  )
);

-- Suppression : tenant_admin uniquement
CREATE POLICY "rh_employes_delete" ON public.rh_employes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'tenant_admin'
      AND tenant_id = public.rh_employes.tenant_id
  )
);
