-- Migration: Suppression du module "securite" de sys_modules
-- Ce module est remplacé par la page "Sécurité & Backup" au niveau tenant (non soumise aux permissions modules)

DELETE FROM public.sys_modules WHERE key = 'securite';

-- Nettoyage des permissions existantes liées à ce module
DELETE FROM public.user_module_permissions WHERE module = 'securite';
