-- ─────────────────────────────────────────────────────────────────
-- Workflow V2 — Processus Multi-Étapes
-- ─────────────────────────────────────────────────────────────────

-- 1. Modèles de processus (templates)
--    societe_id nullable → template global pour tout le tenant
CREATE TABLE IF NOT EXISTS workflow_process_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  societe_id    UUID REFERENCES societes(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  description   TEXT,
  type_process  TEXT NOT NULL CHECK (type_process IN (
    'note_de_frais', 'bon_de_commande', 'demande_recrutement',
    'contrat_prestataire', 'validation_budget', 'deplacement_pro',
    'demande_investissement', 'onboarding', 'offboarding',
    'rapport_audit', 'autre'
  )),
  form_schema   JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Étapes d'un modèle
--    Étapes de même `ordre` = parallèles (toutes doivent être complètes avant de passer au suivant)
CREATE TABLE IF NOT EXISTS workflow_process_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES workflow_process_templates(id) ON DELETE CASCADE,
  ordre           INTEGER NOT NULL,
  nom             TEXT NOT NULL,
  description     TEXT,
  action_type     TEXT NOT NULL CHECK (action_type IN (
    'approbation',  -- approuver / refuser
    'signature',    -- signature numérique
    'avis',         -- avis consultatif (ne bloque pas le flux)
    'verification'  -- vérification documentaire
  )),
  mode_signature  TEXT CHECK (mode_signature IN ('canvas', 'approbation', 'both')),
  assignee_type   TEXT NOT NULL CHECK (assignee_type IN ('user', 'group', 'role')),
  assignee_id     UUID,                           -- user_id ou group_id selon assignee_type
  assignee_role   TEXT,                           -- 'gestionnaire' | 'admin' si assignee_type='role'
  deadline_days   INTEGER,                        -- jours ouvrés avant escalade
  escalation_to   UUID REFERENCES auth.users(id), -- destinataire de l'escalade
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT step_assignee_check CHECK (
    (assignee_type = 'role' AND assignee_role IS NOT NULL) OR
    (assignee_type IN ('user','group') AND assignee_id IS NOT NULL) OR
    (assignee_type = 'role')
  )
);

-- 3. Instances (exécutions d'un template)
CREATE TABLE IF NOT EXISTS workflow_instances (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id         UUID NOT NULL REFERENCES workflow_process_templates(id),
  tenant_id           UUID NOT NULL,
  societe_id          UUID NOT NULL,
  titre               TEXT NOT NULL,
  statut              TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN (
    'brouillon', 'en_cours', 'approuve', 'refuse', 'annule'
  )),
  current_step_ordre  INTEGER NOT NULL DEFAULT 1,
  form_data           JSONB NOT NULL DEFAULT '{}',
  initiator_id        UUID NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Étapes d'instance (une ligne par étape par instance)
CREATE TABLE IF NOT EXISTS workflow_instance_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id     UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_id         UUID NOT NULL REFERENCES workflow_process_steps(id),
  ordre           INTEGER NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente', 'en_cours', 'approuve', 'refuse', 'signe', 'avis_donne', 'skipped'
  )),
  actor_id        UUID REFERENCES auth.users(id),
  commentaire     TEXT,
  signature_data  TEXT,       -- base64 (canvas) | 'approbation_confirmee' | 'avis_donne'
  deadline_at     TIMESTAMPTZ,
  escalated_at    TIMESTAMPTZ,
  traite_le       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- RLS : workflow_process_templates
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workflow_process_templates ENABLE ROW LEVEL SECURITY;

-- Lecture : même tenant (global si societe_id IS NULL, ou societe concernée)
CREATE POLICY "wpt_select" ON workflow_process_templates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Gestion : tenant_admin uniquement
CREATE POLICY "wpt_insert" ON workflow_process_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );
CREATE POLICY "wpt_update" ON workflow_process_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );
CREATE POLICY "wpt_delete" ON workflow_process_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );

-- ─────────────────────────────────────────────────────────────────
-- RLS : workflow_process_steps
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workflow_process_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wps_select" ON workflow_process_steps
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM workflow_process_templates WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
CREATE POLICY "wps_insert" ON workflow_process_steps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );
CREATE POLICY "wps_update" ON workflow_process_steps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );
CREATE POLICY "wps_delete" ON workflow_process_steps
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );

-- ─────────────────────────────────────────────────────────────────
-- RLS : workflow_instances
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

-- Lecture : initiateur OU acteur d'une étape OU gestionnaire/admin module OU tenant_admin
CREATE POLICY "wi_select" ON workflow_instances
  FOR SELECT USING (
    initiator_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
    OR id IN (
      SELECT instance_id FROM workflow_instance_steps WHERE actor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_module_permissions
      WHERE user_id = auth.uid()
        AND societe_id = workflow_instances.societe_id
        AND module = 'workflow'
        AND permission IN ('gestionnaire', 'admin')
    )
  );

CREATE POLICY "wi_insert" ON workflow_instances
  FOR INSERT WITH CHECK (initiator_id = auth.uid());

CREATE POLICY "wi_update" ON workflow_instances
  FOR UPDATE USING (
    initiator_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (
      SELECT 1 FROM user_module_permissions
      WHERE user_id = auth.uid()
        AND societe_id = workflow_instances.societe_id
        AND module = 'workflow'
        AND permission IN ('gestionnaire', 'admin')
    )
  );

CREATE POLICY "wi_delete" ON workflow_instances
  FOR DELETE USING (
    initiator_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
  );

-- ─────────────────────────────────────────────────────────────────
-- RLS : workflow_instance_steps
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workflow_instance_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wis_select" ON workflow_instance_steps
  FOR SELECT USING (
    instance_id IN (SELECT id FROM workflow_instances)
  );

CREATE POLICY "wis_insert" ON workflow_instance_steps
  FOR INSERT WITH CHECK (
    instance_id IN (SELECT id FROM workflow_instances WHERE initiator_id = auth.uid()
      OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin'))
  );

CREATE POLICY "wis_update" ON workflow_instance_steps
  FOR UPDATE USING (
    actor_id = auth.uid()
    OR instance_id IN (
      SELECT id FROM workflow_instances
      WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role = 'tenant_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- Index
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wpt_tenant ON workflow_process_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_wpt_societe ON workflow_process_templates (societe_id);
CREATE INDEX IF NOT EXISTS idx_wps_template ON workflow_process_steps (template_id, ordre);
CREATE INDEX IF NOT EXISTS idx_wi_tenant_societe ON workflow_instances (tenant_id, societe_id);
CREATE INDEX IF NOT EXISTS idx_wi_initiator ON workflow_instances (initiator_id);
CREATE INDEX IF NOT EXISTS idx_wi_statut ON workflow_instances (statut);
CREATE INDEX IF NOT EXISTS idx_wis_instance ON workflow_instance_steps (instance_id, ordre);
CREATE INDEX IF NOT EXISTS idx_wis_actor ON workflow_instance_steps (actor_id);
CREATE INDEX IF NOT EXISTS idx_wis_deadline ON workflow_instance_steps (deadline_at) WHERE deadline_at IS NOT NULL;
