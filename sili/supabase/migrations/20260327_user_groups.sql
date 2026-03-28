-- ─────────────────────────────────────────────────────────────────
-- Groupe Utilisateurs V2
-- ─────────────────────────────────────────────────────────────────

-- 1. Table user_groups
CREATE TABLE IF NOT EXISTS user_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  societe_id  UUID NOT NULL,
  nom         TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'compte' CHECK (type IN ('compte', 'mixte')),
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table user_group_members
CREATE TABLE IF NOT EXISTS user_group_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,      -- utilisateur avec compte
  employe_id  UUID REFERENCES rh_employes(id) ON DELETE CASCADE,      -- employé sans compte (mixte)
  role        TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'manager')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT member_source CHECK (
    (user_id IS NOT NULL AND employe_id IS NULL) OR
    (user_id IS NULL AND employe_id IS NOT NULL)
  )
);

-- 3. Colonne assigned_to_group sur workflow_requests
ALTER TABLE workflow_requests
  ADD COLUMN IF NOT EXISTS assigned_to_group UUID REFERENCES user_groups(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- RLS : user_groups
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- Lecture : membres du tenant
CREATE POLICY "user_groups_select" ON user_groups
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_societes
      WHERE user_id = auth.uid()
    )
  );

-- Insertion : tenant_admin uniquement
CREATE POLICY "user_groups_insert" ON user_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

-- Mise à jour : tenant_admin uniquement
CREATE POLICY "user_groups_update" ON user_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

-- Suppression : tenant_admin uniquement
CREATE POLICY "user_groups_delete" ON user_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- RLS : user_group_members
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;

-- Lecture : membres du même tenant (via le groupe)
CREATE POLICY "user_group_members_select" ON user_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM user_groups
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_societes WHERE user_id = auth.uid()
      )
    )
  );

-- Gestion (insert/update/delete) : tenant_admin uniquement
CREATE POLICY "user_group_members_insert" ON user_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

CREATE POLICY "user_group_members_update" ON user_group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

CREATE POLICY "user_group_members_delete" ON user_group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- Index
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_groups_tenant_societe
  ON user_groups (tenant_id, societe_id);

CREATE INDEX IF NOT EXISTS idx_user_group_members_group
  ON user_group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_user_group_members_user
  ON user_group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_requests_assigned_group
  ON workflow_requests (assigned_to_group);
