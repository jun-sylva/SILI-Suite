-- Migration : ajout champs typologie, nb_heures, justificatif_path sur rh_conges
-- Date : 2026-03-27

ALTER TABLE public.rh_conges
  ADD COLUMN IF NOT EXISTS typologie        text    NOT NULL DEFAULT 'daily'
    CHECK (typologie IN ('daily', 'hourly')),
  ADD COLUMN IF NOT EXISTS nb_heures        numeric(5,2),
  ADD COLUMN IF NOT EXISTS justificatif_path text;
