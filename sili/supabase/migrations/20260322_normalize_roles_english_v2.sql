-- Migration : Normalisation Sécurisée des Rôles (V2)
-- Cette version préserve le compte Master et utilise les nouveaux noms anglais uniquement pour le SaaS.

-- 1. Ajout des nouveaux rôles à l'ENUM global_role
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'global_role' AND e.enumlabel = 'tenant_admin') THEN
        ALTER TYPE public.global_role ADD VALUE 'tenant_admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'global_role' AND e.enumlabel = 'tenant_user') THEN
        ALTER TYPE public.global_role ADD VALUE 'tenant_user';
    END IF;
END $$;

-- 2. Mise à jour CHIRURGICALE des profils (On ne touche PAS aux Super Admin)
-- On migre vers 'tenant_admin' uniquement ceux qui sont liés à un tenant et ne sont pas super_admin
UPDATE public.profiles 
SET role = 'tenant_admin' 
WHERE tenant_id IS NOT NULL 
  AND is_super_admin = false 
  AND role::text IN ('administrateur', 'admin');

UPDATE public.profiles 
SET role = 'tenant_user' 
WHERE tenant_id IS NOT NULL 
  AND is_super_admin = false 
  AND role::text IN ('utilisateur', 'user');

-- 3. UTILISATEURS_SOCIETE : Rôles en anglais (viewer, contributor, manager, admin)
ALTER TABLE public.user_societes ALTER COLUMN role SET DEFAULT 'viewer';

-- 4. RPC Mise à jour : Création propre sans toucher au Master
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

  -- 1. Slug
  v_base_slug := lower(regexp_replace(p_raison_sociale, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) = 0 THEN v_base_slug := 'tenant'; END IF;
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || v_counter; v_counter := v_counter + 1;
  END LOOP;

  -- 2. Création du Tenant
  INSERT INTO public.tenants (name, slug, status)
  VALUES (p_raison_sociale, v_slug, 'actif')
  RETURNING id INTO v_tenant_id;

  -- 3. Mise à jour du Profil (tenant_admin)
  INSERT INTO public.profiles (id, full_name, phone, role, tenant_id, is_active)
  VALUES (v_user_id, p_admin_name, p_phone, 'tenant_admin', v_tenant_id, true)
  ON CONFLICT (id) DO UPDATE SET 
    full_name  = EXCLUDED.full_name, 
    phone      = EXCLUDED.phone, 
    role       = 'tenant_admin',
    tenant_id  = v_tenant_id,
    updated_at = NOW();

  RETURN jsonb_build_object('id', v_tenant_id, 'slug', v_slug);
END;
$function$;

-- 5. RLS : Autorisations pour tenant_admin
DROP POLICY IF EXISTS "societes_admin_policy" ON public.societes;
CREATE POLICY "societes_admin_policy" ON public.societes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (public.profiles.role = 'tenant_admin' OR public.profiles.role::text = 'admin')
    AND public.profiles.tenant_id = public.societes.tenant_id
  )
);
