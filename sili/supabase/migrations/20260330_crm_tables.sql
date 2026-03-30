-- ============================================================
-- Module CRM — Tables complètes
-- contacts, activités, devis, factures, paiements + triggers
-- ============================================================

-- ── 1. crm_contacts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id  uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  nom         text NOT NULL,
  prenom      text,
  email       text,
  telephone   text,
  entreprise  text,
  poste       text,
  notes       text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_contacts_rls" ON public.crm_contacts FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 2. crm_activites ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_activites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id      uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'appel' CHECK (type IN ('appel','email','reunion','autre')),
  titre           text NOT NULL,
  description     text,
  date_prevue     timestamptz,
  statut          text NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire','fait','annule')),
  assigne_a       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  opportunite_id  uuid REFERENCES public.crm_opportunites(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.crm_activites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_activites_rls" ON public.crm_activites FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 3. Séquences pour numérotation auto ─────────────────────
CREATE TABLE IF NOT EXISTS public.crm_sequences (
  tenant_id       uuid NOT NULL,
  societe_id      uuid NOT NULL,
  type            text NOT NULL, -- 'devis' | 'facture'
  annee           int NOT NULL,
  dernier_numero  int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, societe_id, type, annee)
);

ALTER TABLE public.crm_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sequences_rls" ON public.crm_sequences FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Fonction utilitaire : obtenir le prochain numéro de séquence
CREATE OR REPLACE FUNCTION public.crm_next_numero(
  p_tenant_id  uuid,
  p_societe_id uuid,
  p_type       text,
  p_annee      int
) RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_num int;
BEGIN
  INSERT INTO public.crm_sequences (tenant_id, societe_id, type, annee, dernier_numero)
  VALUES (p_tenant_id, p_societe_id, p_type, p_annee, 1)
  ON CONFLICT (tenant_id, societe_id, type, annee)
  DO UPDATE SET dernier_numero = crm_sequences.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;
  RETURN v_num;
END;
$$;

-- ── 4. crm_devis ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_devis (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id      uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  numero          text,
  objet           text NOT NULL,
  statut          text NOT NULL DEFAULT 'brouillon'
                    CHECK (statut IN ('brouillon','envoye','accepte','refuse','expire')),
  client_nom      text,
  contact_id      uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunite_id  uuid REFERENCES public.crm_opportunites(id) ON DELETE SET NULL,
  date_emission   date NOT NULL DEFAULT CURRENT_DATE,
  date_expiration date,
  remise_globale  numeric(5,2)  NOT NULL DEFAULT 0,
  tva_pct         numeric(5,2)  NOT NULL DEFAULT 19.25,
  montant_ht      numeric(14,2) NOT NULL DEFAULT 0,
  montant_ttc     numeric(14,2) NOT NULL DEFAULT 0,
  notes           text,
  assigne_a       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Trigger : génère le numéro DEV-YYYY-NNNN à l'insertion
CREATE OR REPLACE FUNCTION public.crm_devis_set_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_annee int := EXTRACT(YEAR FROM NEW.date_emission)::int;
  v_num   int;
BEGIN
  IF NEW.numero IS NULL THEN
    v_num := public.crm_next_numero(NEW.tenant_id, NEW.societe_id, 'devis', v_annee);
    NEW.numero := 'DEV-' || v_annee || '-' || LPAD(v_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_devis_numero ON public.crm_devis;
CREATE TRIGGER trg_crm_devis_numero
  BEFORE INSERT ON public.crm_devis
  FOR EACH ROW EXECUTE FUNCTION public.crm_devis_set_numero();

ALTER TABLE public.crm_devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_devis_rls" ON public.crm_devis FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 5. crm_devis_lignes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_devis_lignes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id      uuid NOT NULL REFERENCES public.crm_devis(id) ON DELETE CASCADE,
  ordre         int NOT NULL DEFAULT 0,
  designation   text NOT NULL,
  description   text,
  quantite      numeric(10,2) NOT NULL DEFAULT 1,
  prix_unitaire numeric(14,2) NOT NULL DEFAULT 0,
  remise_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  montant_ht    numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.crm_devis_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_devis_lignes_rls" ON public.crm_devis_lignes FOR ALL TO authenticated
  USING (devis_id IN (
    SELECT id FROM public.crm_devis
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

-- ── 6. crm_factures ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_factures (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id       uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  numero           text,
  devis_id         uuid REFERENCES public.crm_devis(id) ON DELETE SET NULL,
  opportunite_id   uuid REFERENCES public.crm_opportunites(id) ON DELETE SET NULL,
  objet            text NOT NULL,
  statut           text NOT NULL DEFAULT 'brouillon'
                     CHECK (statut IN ('brouillon','emise','partiellement_payee','payee','en_retard','annulee')),
  client_nom       text,
  contact_id       uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  date_emission    date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance    date,
  remise_globale   numeric(5,2)  NOT NULL DEFAULT 0,
  tva_pct          numeric(5,2)  NOT NULL DEFAULT 19.25,
  montant_ht       numeric(14,2) NOT NULL DEFAULT 0,
  montant_ttc      numeric(14,2) NOT NULL DEFAULT 0,
  montant_paye     numeric(14,2) NOT NULL DEFAULT 0,
  montant_restant  numeric(14,2) NOT NULL DEFAULT 0,
  notes            text,
  conditions_paiement text,
  assigne_a        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Trigger : génère le numéro FAC-YYYY-NNNN à l'insertion
CREATE OR REPLACE FUNCTION public.crm_facture_set_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_annee int := EXTRACT(YEAR FROM NEW.date_emission)::int;
  v_num   int;
BEGIN
  IF NEW.numero IS NULL THEN
    v_num := public.crm_next_numero(NEW.tenant_id, NEW.societe_id, 'facture', v_annee);
    NEW.numero := 'FAC-' || v_annee || '-' || LPAD(v_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_facture_numero ON public.crm_factures;
CREATE TRIGGER trg_crm_facture_numero
  BEFORE INSERT ON public.crm_factures
  FOR EACH ROW EXECUTE FUNCTION public.crm_facture_set_numero();

ALTER TABLE public.crm_factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_factures_rls" ON public.crm_factures FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 7. crm_factures_lignes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_factures_lignes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id    uuid NOT NULL REFERENCES public.crm_factures(id) ON DELETE CASCADE,
  ordre         int NOT NULL DEFAULT 0,
  designation   text NOT NULL,
  description   text,
  quantite      numeric(10,2) NOT NULL DEFAULT 1,
  prix_unitaire numeric(14,2) NOT NULL DEFAULT 0,
  remise_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  montant_ht    numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.crm_factures_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_factures_lignes_rls" ON public.crm_factures_lignes FOR ALL TO authenticated
  USING (facture_id IN (
    SELECT id FROM public.crm_factures
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

-- ── 8. crm_paiements ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_paiements (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  societe_id      uuid NOT NULL REFERENCES public.societes(id) ON DELETE CASCADE,
  facture_id      uuid NOT NULL REFERENCES public.crm_factures(id) ON DELETE CASCADE,
  reference       text,
  montant         numeric(14,2) NOT NULL,
  mode_paiement   text NOT NULL DEFAULT 'virement'
                    CHECK (mode_paiement IN ('virement','especes','cheque','mobile_money','carte')),
  date_paiement   date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  enregistre_par  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- Trigger : recalcule montant_paye, montant_restant, statut après chaque paiement
CREATE OR REPLACE FUNCTION public.crm_recalc_facture_paiements()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_facture_id  uuid;
  v_ttc         numeric(14,2);
  v_paye        numeric(14,2);
  v_restant     numeric(14,2);
  v_statut      text;
  v_echeance    date;
BEGIN
  v_facture_id := COALESCE(NEW.facture_id, OLD.facture_id);

  SELECT montant_ttc, date_echeance
  INTO v_ttc, v_echeance
  FROM public.crm_factures
  WHERE id = v_facture_id;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_paye
  FROM public.crm_paiements
  WHERE facture_id = v_facture_id;

  v_restant := GREATEST(v_ttc - v_paye, 0);

  IF v_paye >= v_ttc THEN
    v_statut := 'payee';
  ELSIF v_paye > 0 THEN
    v_statut := 'partiellement_payee';
  ELSIF v_echeance IS NOT NULL AND v_echeance < CURRENT_DATE THEN
    v_statut := 'en_retard';
  ELSE
    v_statut := 'emise';
  END IF;

  UPDATE public.crm_factures
  SET montant_paye    = v_paye,
      montant_restant = v_restant,
      statut          = v_statut,
      updated_at      = now()
  WHERE id = v_facture_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_paiement_recalc ON public.crm_paiements;
CREATE TRIGGER trg_crm_paiement_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_paiements
  FOR EACH ROW EXECUTE FUNCTION public.crm_recalc_facture_paiements();

ALTER TABLE public.crm_paiements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_paiements_rls" ON public.crm_paiements FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 9. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_contacts_societe    ON public.crm_contacts(societe_id);
CREATE INDEX IF NOT EXISTS idx_crm_activites_societe   ON public.crm_activites(societe_id);
CREATE INDEX IF NOT EXISTS idx_crm_activites_assigne   ON public.crm_activites(assigne_a);
CREATE INDEX IF NOT EXISTS idx_crm_devis_societe       ON public.crm_devis(societe_id);
CREATE INDEX IF NOT EXISTS idx_crm_devis_statut        ON public.crm_devis(statut);
CREATE INDEX IF NOT EXISTS idx_crm_factures_societe    ON public.crm_factures(societe_id);
CREATE INDEX IF NOT EXISTS idx_crm_factures_statut     ON public.crm_factures(statut);
CREATE INDEX IF NOT EXISTS idx_crm_factures_echeance   ON public.crm_factures(date_echeance);
CREATE INDEX IF NOT EXISTS idx_crm_paiements_facture   ON public.crm_paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_crm_paiements_societe   ON public.crm_paiements(societe_id);
