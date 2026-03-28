-- Migration : Module Workflow — Tables workflow_requests et workflow_comments

-- ── Table principale des requêtes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  societe_id    UUID NOT NULL,
  titre         TEXT NOT NULL,
  type_demande  TEXT NOT NULL CHECK (type_demande IN ('materiel_it','finance','formation','deplacement','rh','autre')),
  description   TEXT,
  statut        TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','assigne','approuve','refuse')),
  priorite      TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  refused_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refused_at    TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_requests_tenant_idx    ON workflow_requests(tenant_id);
CREATE INDEX IF NOT EXISTS workflow_requests_societe_idx   ON workflow_requests(societe_id);
CREATE INDEX IF NOT EXISTS workflow_requests_created_by_idx ON workflow_requests(created_by);
CREATE INDEX IF NOT EXISTS workflow_requests_assigned_to_idx ON workflow_requests(assigned_to);
CREATE INDEX IF NOT EXISTS workflow_requests_statut_idx    ON workflow_requests(statut);

-- ── Table historique / commentaires ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES workflow_requests(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT CHECK (action IN ('assigne','approuve','refuse','commente')),
  contenu     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_comments_request_idx ON workflow_comments(request_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_comments ENABLE ROW LEVEL SECURITY;

-- workflow_requests : lecture/écriture par même tenant
CREATE POLICY "workflow_requests_select" ON workflow_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "workflow_requests_insert" ON workflow_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "workflow_requests_update" ON workflow_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "workflow_requests_delete" ON workflow_requests
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- workflow_comments : même tenant
CREATE POLICY "workflow_comments_select" ON workflow_comments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "workflow_comments_insert" ON workflow_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );
