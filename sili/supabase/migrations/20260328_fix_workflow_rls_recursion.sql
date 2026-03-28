-- ─────────────────────────────────────────────────────────────────
-- Fix : récursion infinie dans les politiques RLS workflow
--
-- Cause : wi_select (workflow_instances) interroge workflow_instance_steps
--         wis_select (workflow_instance_steps) interroge workflow_instances
--         → cycle infini
--
-- Solution :
--   1. Fonction SECURITY DEFINER pour interroger workflow_instance_steps
--      sans déclencher ses propres politiques RLS (bypasse le cycle)
--   2. Réécriture de wi_select pour utiliser cette fonction
--   3. Réécriture de wis_select sans référencer workflow_instances via sa politique
-- ─────────────────────────────────────────────────────────────────

-- 1. Fonction helper (SECURITY DEFINER = s'exécute en tant que owner, bypass RLS)
CREATE OR REPLACE FUNCTION wf_is_actor_in_instance(p_instance_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workflow_instance_steps
    WHERE instance_id = p_instance_id AND actor_id = auth.uid()
  );
$$;

-- 2. Recréer wi_select sans sous-requête vers workflow_instance_steps
DROP POLICY IF EXISTS "wi_select" ON workflow_instances;
CREATE POLICY "wi_select" ON workflow_instances
  FOR SELECT USING (
    initiator_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'
    )
    OR wf_is_actor_in_instance(id)
    OR EXISTS (
      SELECT 1 FROM user_module_permissions
      WHERE user_id = auth.uid()
        AND societe_id = workflow_instances.societe_id
        AND module = 'workflow'
        AND permission IN ('gestionnaire', 'admin')
    )
  );

-- 3. Recréer wis_select sans passer par la politique de workflow_instances
--    (vérifie directement les colonnes de la table, pas via SELECT id FROM workflow_instances)
DROP POLICY IF EXISTS "wis_select" ON workflow_instance_steps;
CREATE POLICY "wis_select" ON workflow_instance_steps
  FOR SELECT USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_instance_steps.instance_id
        AND (
          wi.initiator_id = auth.uid()
          OR wi.tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'
          )
          OR EXISTS (
            SELECT 1 FROM user_module_permissions
            WHERE user_id = auth.uid()
              AND societe_id = wi.societe_id
              AND module = 'workflow'
              AND permission IN ('gestionnaire', 'admin')
          )
        )
    )
  );
