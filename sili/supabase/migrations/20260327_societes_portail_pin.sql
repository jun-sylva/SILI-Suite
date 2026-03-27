-- ============================================================
-- societes — ajout colonne portail_pin
-- PIN 4 chiffres pour quitter le Portail Présences (kiosque)
-- ============================================================

ALTER TABLE public.societes
  ADD COLUMN IF NOT EXISTS portail_pin text NOT NULL DEFAULT '0000';
