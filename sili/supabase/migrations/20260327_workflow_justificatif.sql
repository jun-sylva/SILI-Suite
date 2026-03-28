-- Migration : Ajout colonne justificatif_path à workflow_requests

ALTER TABLE workflow_requests ADD COLUMN IF NOT EXISTS justificatif_path TEXT;
