-- Migration : Normalisation des Rôles et Permissions en Anglais
-- 1. Mise à jour de l'ENUM global_role
-- 2. Mise à jour de l'ENUM permission_level (si utilisé)
-- 3. Mise à jour de la table utilisateurs_societe
-- 4. Mise à jour de la RPC register_new_tenant

-- 1. ENUM global_role : Ajout des nouveaux rôles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'global_role' AND e.enumlabel = 'tenant_admin') THEN
        ALTER TYPE public.global_role ADD VALUE 'tenant_admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'global_role' AND e.enumlabel = 'tenant_user') THEN
        ALTER TYPE public.global_role ADD VALUE 'tenant_user';
    END IF;
END $$;

-- 2. Mise à jour des profils existants (Migration vers Anglais)
UPDATE public.profiles SET role = 'tenant_admin' WHERE role::text IN ('administrateur', 'admin');
UPDATE public.profiles SET role = 'tenant_user' WHERE role::text IN ('utilisateur', 'user');

-- 3. UTILISATEURS_SOCIETE : Rôles en anglais
-- On s'assure que la colonne supporte les nouvelles valeurs (VARCHAR pour flexibilité ou ENUM)
ALTER TABLE public.utilisateurs_societe ALTER COLUMN role SET DEFAULT 'viewer';

-- Migration des données existantes si besoin
UPDATE public.utilisateurs_societe SET role = 'viewer' WHERE role = 'Lecteur';
UPDATE public.utilisateurs_societe SET role = 'contributor' WHERE role = 'Contributeur';
UPDATE public.utilisateurs_societe SET role = 'manager' WHERE role = 'Gestionnaire';
UPDATE public.utilisateurs_societe SET role = 'admin' WHERE role = 'Admin';

-- 4. RPC Mise à jour : Utilisation de 'tenant_admin'
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

  -- 2. Tenant
  INSERT INTO public.tenants (name, slug, status)
  VALUES (p_raison_sociale, v_slug, 'actif')
  RETURNING id INTO v_tenant_id;

  -- 3. Profil : Role = 'tenant_admin' ✅
  INSERT INTO public.profiles (id, full_name, phone, role, tenant_id, created_at, updated_at)
  VALUES (v_user_id, p_admin_name, p_phone, 'tenant_admin', v_tenant_id, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET 
    full_name  = EXCLUDED.full_name, 
    phone      = EXCLUDED.phone, 
    role       = 'tenant_admin',
    tenant_id  = v_tenant_id,
    updated_at = NOW();

  RETURN jsonb_build_object('id', v_tenant_id, 'slug', v_slug);
END;
$function$;

-- 5. RLS : Mise à jour avec les nouveaux noms de rôles
DROP POLICY IF EXISTS "societes_admin_policy" ON public.societes;
CREATE POLICY "societes_admin_policy" ON public.societes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND public.profiles.role = 'tenant_admin'
    AND public.profiles.tenant_id = public.societes.tenant_id
  )
);

DROP POLICY IF EXISTS "utilisateurs_societe_membership_policy" ON public.utilisateurs_societe;
CREATE POLICY "utilisateurs_societe_membership_policy" ON public.utilisateurs_societe FOR SELECT
USING (utilisateur_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND public.profiles.role = 'tenant_admin'
));
