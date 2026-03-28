-- Fix RLS rh_conges
-- Problème : table créée sans politique RLS explicite (ou politique trop restrictive)
-- → les congés soumis via le portail présence ne remontaient pas dans "Demandes en attente"
-- → les congés soumis via la page Présences non plus si RLS bloquait le SELECT

-- 1. Activer RLS (idempotent)
ALTER TABLE public.rh_conges ENABLE ROW LEVEL SECURITY;

-- 2. SELECT : tout utilisateur du même tenant peut voir tous les congés de sa société
DROP POLICY IF EXISTS "rh_conges_select" ON public.rh_conges;
CREATE POLICY "rh_conges_select" ON public.rh_conges
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. INSERT : tout utilisateur du même tenant peut créer un congé
--    (portail présence + page Présences + self-service employé)
DROP POLICY IF EXISTS "rh_conges_insert" ON public.rh_conges;
CREATE POLICY "rh_conges_insert" ON public.rh_conges
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 4. UPDATE : tout utilisateur du même tenant peut mettre à jour
--    (approbation / refus par gestionnaire, upload justificatif)
DROP POLICY IF EXISTS "rh_conges_update" ON public.rh_conges;
CREATE POLICY "rh_conges_update" ON public.rh_conges
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. FK employe_id → rh_employes (nécessaire pour le join PostgREST !employe_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rh_conges_employe_id_fkey'
      AND table_name      = 'rh_conges'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE public.rh_conges
      ADD CONSTRAINT rh_conges_employe_id_fkey
      FOREIGN KEY (employe_id) REFERENCES public.rh_employes(id) ON DELETE CASCADE;
  END IF;
END $$;
