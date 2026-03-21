-- Migration : Création de la table sys_modules pour le contrôle global

CREATE TABLE IF NOT EXISTS sys_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sys_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'sys_modules' AND policyname = 'sys_modules_read_policy'
  ) THEN
      CREATE POLICY "sys_modules_read_policy" ON sys_modules FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'sys_modules' AND policyname = 'sys_modules_update_policy'
  ) THEN
      -- Pour l'instant, update pour tout utilisateur authentifié (jusqu'à la liaison formelle avec profiles.is_super_admin stricte)
      CREATE POLICY "sys_modules_update_policy" ON sys_modules FOR UPDATE TO authenticated USING (true);
  END IF;
END
$$;

INSERT INTO sys_modules (key, name, description, icon, is_active) VALUES
('vente', 'Ventes', 'Gestion commerciale, devis, factures, encaissements et suivi client', 'ShoppingCart', true),
('achat', 'Achats', 'Gestion des commandes fournisseurs, réceptions et factures achats', 'PackageSearch', true),
('stock', 'Stocks', 'Contrôle des inventaires, mouvements, alertes et valorisation', 'Building2', true),
('rh', 'Ressources Humaines', 'Gestion du personnel, contrats, paie et évaluations', 'Users', true),
('crm', 'CRM & Prospection', 'Relation client, suivi des opportunités et des interactions', 'HardHat', true),
('comptabilite', 'Comptabilité', 'Tenue des comptes, journaux, bilans et déclarations', 'CircleDollarSign', true),
('teams', 'Collaboration', 'Messagerie interne, partage et gestion de tâches', 'MessageSquare', true),
('rapports', 'Rapports & Analytique', 'Statistiques, BI et tableaux de bord décisionnels', 'FileText', true),
('securite', 'Sécurité & Audits', 'Traçabilité, sauvegardes et contrôle d''accès renforcé', 'Shield', true)
ON CONFLICT (key) DO NOTHING;
