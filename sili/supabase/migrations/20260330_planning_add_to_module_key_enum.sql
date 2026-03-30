-- Ajoute 'planning' à l'enum module_key utilisé par tenant_modules.module
-- Nécessaire pour que les Masters puissent activer le module planning sur les tenants

ALTER TYPE module_key ADD VALUE IF NOT EXISTS 'planning';
