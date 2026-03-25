-- Migration : Correction des quotas NULL sur les tenants existants
-- Les tenants créés avant la migration des quotas ont des valeurs NULL

UPDATE public.tenants
SET
  max_societes   = COALESCE(max_societes, 1),
  max_licences   = COALESCE(max_licences, 1),
  max_storage_gb = COALESCE(max_storage_gb, 0.1)
WHERE
  max_societes IS NULL
  OR max_licences IS NULL
  OR max_storage_gb IS NULL;

-- Contraintes NOT NULL avec défauts pour les futurs inserts
ALTER TABLE public.tenants
  ALTER COLUMN max_societes   SET NOT NULL,
  ALTER COLUMN max_societes   SET DEFAULT 1,
  ALTER COLUMN max_licences   SET NOT NULL,
  ALTER COLUMN max_licences   SET DEFAULT 1,
  ALTER COLUMN max_storage_gb SET NOT NULL,
  ALTER COLUMN max_storage_gb SET DEFAULT 0.1;
