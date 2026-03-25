-- Migration : Fix Structure de Liaison (Error 42P01)
-- 1. Création de la table de liaison manquante user_societes
-- 2. Activation RLS
-- 3. Politique SELECT

CREATE TABLE IF NOT EXISTS public.user_societes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  societe_id     UUID REFERENCES public.societes(id) ON DELETE CASCADE,
  role           VARCHAR(50) DEFAULT 'membre',
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, societe_id)
);

-- Activation RLS
ALTER TABLE public.user_societes ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : Un utilisateur voit ses propres associations
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'user_societes' AND policyname = 'util_soc_read_policy'
  ) THEN
      CREATE POLICY "util_soc_read_policy" ON public.user_societes FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END
$$;

-- Politique d'insertion/Update : Pour l'instant permissive pour les tests
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'user_societes' AND policyname = 'util_soc_all_policy'
  ) THEN
      CREATE POLICY "util_soc_all_policy" ON public.user_societes FOR ALL TO authenticated USING (true);
  END IF;
END
$$;
