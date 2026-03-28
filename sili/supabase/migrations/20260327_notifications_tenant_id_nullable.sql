-- Migration : Rendre tenant_id nullable dans notifications
-- Les Masters (is_super_admin = true) ont tenant_id = NULL dans leurs notifications

ALTER TABLE notifications ALTER COLUMN tenant_id DROP NOT NULL;
