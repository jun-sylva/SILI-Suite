-- Active le module Planning dans sys_modules (niveau global)
-- Nécessaire pour que les Masters puissent l'activer sur les tenants

UPDATE public.sys_modules
SET is_active = true
WHERE key = 'planning';
