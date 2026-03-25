-- Migration: Fix RLS pour les opérations Master (is_super_admin)
-- tenant_modules existe déjà — on ajoute uniquement les policies manquantes

-- ─── 1. tenant_modules — contrainte unique pour upsert par (tenant_id, module) ──
-- Nécessaire pour que le upsert fonctionne sans id explicite
ALTER TABLE public.tenant_modules
  ADD CONSTRAINT tenant_modules_tenant_module_unique UNIQUE (tenant_id, module);

-- ─── 2. RLS tenants — UPDATE pour super_admin ───────────────────────────────
CREATE POLICY "tenants_super_admin_update"
ON public.tenants FOR UPDATE
USING    ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()))
WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()));

-- ─── 3. RLS audit_logs — INSERT pour super_admin ────────────────────────────
CREATE POLICY "audit_logs_super_admin_insert"
ON public.audit_logs FOR INSERT
WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()));

-- ─── 4. RLS notifications — INSERT pour super_admin ─────────────────────────
CREATE POLICY "notifications_super_admin_insert"
ON public.notifications FOR INSERT
WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()));
