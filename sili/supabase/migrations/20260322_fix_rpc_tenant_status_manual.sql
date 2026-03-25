-- Migration : RPC register_new_tenant avec retour JSON (Fix Redirection & RLS)
-- 1. Retourne { id, slug } pour éviter un SELECT supplémentaire côté client
-- 2. Garantit l'existence du profil et du tenant avec les colonnes correctes

DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text);
DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text, text);
DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.register_new_tenant(
  p_raison_sociale text,
  p_devise        text,
  p_admin_name    text,
  p_phone         text,
  p_user_id       uuid DEFAULT NULL
)
 RETURNS jsonb -- RETOURNE UN JSON ✅
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

  -- 1. Upsert profil
  INSERT INTO public.profiles (id, full_name, phone, created_at, updated_at)
  VALUES (v_user_id, p_admin_name, p_phone, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, updated_at = NOW();

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

  -- 4. Link
  UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = v_user_id;

  -- RETOUR JSON ✅
  RETURN jsonb_build_object(
    'id', v_tenant_id,
    'slug', v_slug
  );
END;
$function$;

-- --- POLITIQUES RLS (Fix erreur {}) ---

-- 1. Autoriser la lecture du tenant par ses membres (via profiles)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_membership_policy" ON public.tenants;
CREATE POLICY "tenants_membership_policy" ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (public.profiles.tenant_id = public.tenants.id OR public.tenants.id::text LIKE (SELECT left(id::text, 8) || '%' FROM public.profiles WHERE id = auth.uid()))
  )
);

-- 2. Autoriser la lecture de ses propres sociétés
ALTER TABLE public.societes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "societes_membership_policy" ON public.societes;
CREATE POLICY "societes_membership_policy" ON public.societes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_societes 
    WHERE user_id = auth.uid() 
    AND societe_id = public.societes.id
  )
);

-- 3. Autoriser la lecture de ses propres associations sociétés
ALTER TABLE public.user_societes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_societes_membership_policy" ON public.user_societes;
CREATE POLICY "user_societes_membership_policy" ON public.user_societes FOR SELECT
USING (user_id = auth.uid());
