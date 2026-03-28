-- Fix RLS user_group_members : tenant_admin n'est pas dans user_societes
-- → la policy SELECT précédente l'excluait, donc loadMembers retournait vide

DROP POLICY IF EXISTS "user_group_members_select" ON user_group_members;

CREATE POLICY "user_group_members_select" ON user_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM user_groups
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_societes WHERE user_id = auth.uid()
        UNION
        SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'
      )
    )
  );
