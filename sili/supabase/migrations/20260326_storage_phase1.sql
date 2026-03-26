-- ============================================================
-- Phase 1 — Architecture stockage multi-tenant
-- ============================================================
-- 1. Bucket sili-files (isolation par tenant_id dans le chemin)
-- 2. RLS storage.objects
-- 3. Table tenant_storage_usage
-- 4. Triggers automatiques sur storage.objects
-- ============================================================

-- ── 1. Bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sili-files', 'sili-files', false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;
-- file_size_limit = 100 MB par fichier

-- ── 2. RLS sur storage.objects ──────────────────────────────

-- SELECT : un utilisateur ne voit que les fichiers sous son tenant_id/
CREATE POLICY "storage_select_own_tenant" ON storage.objects FOR SELECT
USING (
  bucket_id = 'sili-files' AND
  (string_to_array(name, '/'))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- INSERT : un utilisateur ne peut uploader que sous son tenant_id/
CREATE POLICY "storage_insert_own_tenant" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'sili-files' AND
  (string_to_array(name, '/'))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- UPDATE : uniquement ses propres fichiers
CREATE POLICY "storage_update_own_tenant" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'sili-files' AND
  (string_to_array(name, '/'))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- DELETE : uniquement ses propres fichiers
CREATE POLICY "storage_delete_own_tenant" ON storage.objects FOR DELETE
USING (
  bucket_id = 'sili-files' AND
  (string_to_array(name, '/'))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- ── 3. Table tenant_storage_usage ───────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_storage_usage (
  tenant_id    UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  files_mb     NUMERIC(12, 3) NOT NULL DEFAULT 0, -- fichiers uploadés (bucket)
  database_mb  NUMERIC(12, 3) NOT NULL DEFAULT 0, -- base de données (recalculé par cron)
  logs_mb      NUMERIC(12, 3) NOT NULL DEFAULT 0, -- audit_logs (recalculé par cron)
  backups_mb   NUMERIC(12, 3) NOT NULL DEFAULT 0, -- sauvegardes (recalculé par cron)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonne calculée total_mb (vue pour éviter d'écrire la somme partout)
CREATE OR REPLACE VIEW public.tenant_storage_summary AS
SELECT
  tenant_id,
  files_mb,
  database_mb,
  logs_mb,
  backups_mb,
  ROUND(files_mb + database_mb + logs_mb + backups_mb, 3) AS total_mb,
  updated_at
FROM public.tenant_storage_usage;

-- RLS tenant_storage_usage
ALTER TABLE public.tenant_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_usage_read_own" ON public.tenant_storage_usage FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- ── 4. Triggers automatiques : files_mb ─────────────────────

-- Fonction INSERT : ajoute la taille du fichier uploadé
CREATE OR REPLACE FUNCTION public.handle_storage_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_size_mb   NUMERIC;
BEGIN
  -- Ignore les buckets autres que sili-files
  IF NEW.bucket_id != 'sili-files' THEN RETURN NEW; END IF;

  BEGIN
    v_tenant_id := (string_to_array(NEW.name, '/'))[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- chemin invalide, on ignore
  END;

  -- metadata->>'size' est en octets (peut être null si non encore renseigné)
  v_size_mb := COALESCE((NEW.metadata->>'size')::NUMERIC, 0) / 1048576.0;

  INSERT INTO public.tenant_storage_usage (tenant_id, files_mb)
  VALUES (v_tenant_id, v_size_mb)
  ON CONFLICT (tenant_id) DO UPDATE
    SET files_mb   = GREATEST(0, tenant_storage_usage.files_mb + v_size_mb),
        updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Fonction DELETE : soustrait la taille du fichier supprimé
CREATE OR REPLACE FUNCTION public.handle_storage_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_size_mb   NUMERIC;
BEGIN
  IF OLD.bucket_id != 'sili-files' THEN RETURN OLD; END IF;

  BEGIN
    v_tenant_id := (string_to_array(OLD.name, '/'))[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN OLD;
  END;

  v_size_mb := COALESCE((OLD.metadata->>'size')::NUMERIC, 0) / 1048576.0;

  UPDATE public.tenant_storage_usage
  SET files_mb   = GREATEST(0, files_mb - v_size_mb),
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id;

  RETURN OLD;
END;
$$;

-- Attache les triggers sur storage.objects
CREATE TRIGGER on_storage_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_storage_upload();

CREATE TRIGGER on_storage_delete
  AFTER DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_storage_delete();
