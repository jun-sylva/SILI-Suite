-- Migration : Quotas des Tenants et Permissions granulaires des Modules

-- 1. Ajout des colonnes de gestion de quotas et de statut pour les tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'actif',
ADD COLUMN IF NOT EXISTS max_societes INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_licences INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_storage_gb NUMERIC(5,2) DEFAULT 0.1;

-- 2. Table de liaison pour autoriser/bloquer des modules de façon ciblée pour un tenant
CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  module_key VARCHAR(50) REFERENCES sys_modules(key) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tenant_id, module_key)
);

-- 3. Sécurité (RLS) pour tenant_modules
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'tenant_modules' AND policyname = 'tenant_modules_read_policy'
  ) THEN
      CREATE POLICY "tenant_modules_read_policy" ON tenant_modules FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'tenant_modules' AND policyname = 'tenant_modules_update_policy'
  ) THEN
      -- Dans une vraie application, restreindre aux Super Admins.
      CREATE POLICY "tenant_modules_update_policy" ON tenant_modules FOR ALL TO authenticated USING (true);
  END IF;
END
$$;
