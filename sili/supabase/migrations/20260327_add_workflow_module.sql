-- Migration : Ajout du module workflow dans sys_modules
-- Désactivé globalement par défaut — le Master devra l'activer manuellement

INSERT INTO sys_modules (key, name, description, icon, is_active) VALUES
('workflow', 'Workflow & Processus', 'Gestion des processus et requêtes internes (approbations, formulaires, circuits de validation)', 'GitBranch', false)
ON CONFLICT (key) DO NOTHING;
