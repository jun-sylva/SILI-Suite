-- Migration : Système de Rôles SaaS (Tenant Admin & Company Roles)
-- 1. Ajout du rôle au profil (Niveau Tenant)
-- 2. Mise à jour de la table de liaison user_societes (Niveau Société)
-- 3. Mise à jour de la RPC pour auto-assigner 'administrateur' au créateur

-- 1. PROFILES : Ajout du rôle global
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'utilisateur';

-- 2. UTILISATEURS_SOCIETE : Mise à jour des rôles autorisés (Lecteur, Contributeur, Gestionnaire, Admin)
-- On recrée la table si besoin avec les bons défauts
CREATE TABLE IF NOT EXISTS public.user_societes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  societe_id     UUID REFERENCES public.societes(id) ON DELETE CASCADE,
  role           VARCHAR(50) DEFAULT 'Lecteur', -- Rôles : Lecteur, Contributeur, Gestionnaire, Admin
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, societe_id)
);

-- Correction du défaut si la table existait déjà
ALTER TABLE public.user_societes ALTER COLUMN role SET DEFAULT 'Lecteur';

-- 3. RPC Mise à jour : Créateur = administrateur
DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.register_new_tenant(
  p_raison_sociale text,
  p_devise        text,
  p_admin_name    text,
  p_phone         text,
  p_user_id       uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id   uuid;
  v_tenant_id uuid;
  v_slug      text;
  v_base_slug text;
  v_counter   integer := 1;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non identifié.'; END IF;

  -- 1. Upsert profil + Rôle 'administrateur' ✅
  INSERT INTO public.profiles (id, full_name, phone, role, created_at, updated_at)
  VALUES (v_user_id, p_admin_name, p_phone, 'administrateur', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET 
    full_name  = EXCLUDED.full_name, 
    phone      = EXCLUDED.phone, 
    role       = 'administrateur', -- Devient admin du tenant
    updated_at = NOW();

  -- 2. Slug
  v_base_slug := lower(regexp_replace(p_raison_sociale, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) = 0 THEN v_base_slug := 'tenant'; END IF;
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || v_counter; v_counter := v_counter + 1;
  END LOOP;

  -- 3. Tenant
  INSERT INTO public.tenants (name, slug, status)
  VALUES (p_raison_sociale, v_slug, 'actif')
  RETURNING id INTO v_tenant_id;

  -- 4. Link Profile to Tenant
  UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = v_user_id;

  RETURN jsonb_build_object('id', v_tenant_id, 'slug', v_slug);
END;
$function$;

-- --- RLS : Privilèges Administrateur de Tenant ---

-- Un Administrateur de Tenant voit toutes les sociétés de son tenant
DROP POLICY IF EXISTS "societes_admin_policy" ON public.societes;
CREATE POLICY "societes_admin_policy" ON public.societes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND public.profiles.role = 'administrateur'
    AND (public.profiles.tenant_id = public.societes.tenant_id OR public.societes.tenant_id::text LIKE (SELECT left(tenant_id::text, 8) || '%' FROM public.profiles WHERE id = auth.uid()))
  )
);
