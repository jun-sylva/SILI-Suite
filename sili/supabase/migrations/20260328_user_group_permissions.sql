-- ─────────────────────────────────────────────────────────────────
-- V3 — Permissions par Groupe
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_group_permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  societe_id  UUID NOT NULL,
  module      TEXT NOT NULL,
  permission  TEXT NOT NULL DEFAULT 'aucun'
              CHECK (permission IN ('aucun','lecteur','contributeur','gestionnaire','admin')),
  granted_by  UUID NOT NULL REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ugp_unique UNIQUE (group_id, societe_id, module)
);

-- ─────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;

-- Lecture : membres du même tenant
CREATE POLICY "ugp_select" ON user_group_permissions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_societes WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'
    )
  );

-- Gestion : tenant_admin uniquement
CREATE POLICY "ugp_insert" ON user_group_permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'tenant_admin'
    )
  );

CREATE POLICY "ugp_update" ON user_group_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'tenant_admin'
    )
  );

CREATE POLICY "ugp_delete" ON user_group_permissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'tenant_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- Index
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ugp_group_societe_module
  ON user_group_permissions (group_id, societe_id, module);

CREATE INDEX IF NOT EXISTS idx_ugp_societe_module
  ON user_group_permissions (societe_id, module);
