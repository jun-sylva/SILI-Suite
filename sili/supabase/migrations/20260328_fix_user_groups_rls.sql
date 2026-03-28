-- Fix RLS user_groups : ajouter tenant_admin dans la policy SELECT
-- (tenant_admin n'est pas dans user_societes → la policy précédente l'excluait)

DROP POLICY IF EXISTS "user_groups_select" ON user_groups;

CREATE POLICY "user_groups_select" ON user_groups
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_societes WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'
    )
  );
