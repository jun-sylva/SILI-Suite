-- ============================================================
-- Module Stock — Migration complète
-- stock_articles, stock_mouvements, stock_inventaires, stock_inventaire_lignes
-- RLS, trigger recalc, sys_modules, module_key enum
-- ============================================================

-- Note : 'stock' existe déjà dans l'enum module_key et dans sys_modules.

-- ── 1. stock_articles ────────────────────────────────────────
-- Table déjà créée par l'utilisateur — on active juste RLS
ALTER TABLE public.stock_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_articles_rls" ON public.stock_articles;
CREATE POLICY "stock_articles_rls" ON public.stock_articles FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 2. stock_mouvements ──────────────────────────────────────
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_mouvements_rls" ON public.stock_mouvements;
CREATE POLICY "stock_mouvements_rls" ON public.stock_mouvements FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 3. Trigger recalc stock_actuel ───────────────────────────
CREATE OR REPLACE FUNCTION public.trg_stock_recalc_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stock_articles
  SET stock_actuel = NEW.stock_apres,
      updated_at   = now()
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_recalc ON public.stock_mouvements;
CREATE TRIGGER trg_stock_recalc
  AFTER INSERT ON public.stock_mouvements
  FOR EACH ROW EXECUTE FUNCTION public.trg_stock_recalc_fn();

-- ── 4. stock_inventaires ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_inventaires (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  societe_id     uuid NOT NULL REFERENCES public.societes(id)  ON DELETE CASCADE,
  titre          text NOT NULL,
  date_inventaire date NOT NULL DEFAULT CURRENT_DATE,
  statut         text NOT NULL DEFAULT 'brouillon'
                   CHECK (statut IN ('brouillon', 'valide', 'annule')),
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.stock_inventaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_inventaires_rls" ON public.stock_inventaires FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ── 5. stock_inventaire_lignes ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_inventaire_lignes (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventaire_id    uuid NOT NULL REFERENCES public.stock_inventaires(id) ON DELETE CASCADE,
  article_id       uuid NOT NULL REFERENCES public.stock_articles(id)    ON DELETE CASCADE,
  stock_theorique  numeric(15,3) NOT NULL DEFAULT 0,
  stock_compte     numeric(15,3),
  ecart            numeric(15,3) GENERATED ALWAYS AS (COALESCE(stock_compte, stock_theorique) - stock_theorique) STORED,
  adjusted         boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (inventaire_id, article_id)
);

ALTER TABLE public.stock_inventaire_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_inventaire_lignes_rls" ON public.stock_inventaire_lignes FOR ALL TO authenticated
  USING (
    inventaire_id IN (
      SELECT id FROM public.stock_inventaires
      WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Note : le module 'stock' existe déjà dans sys_modules.
