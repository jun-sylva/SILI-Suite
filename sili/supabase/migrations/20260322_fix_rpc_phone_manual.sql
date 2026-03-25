-- Migration : Élargissement du champ téléphone et Nettoyage des fonctions obsolètes

ALTER TABLE public.profiles ALTER COLUMN phone TYPE VARCHAR(255);

-- On supprime les anciennes versions de la fonction pour éviter tout conflit de signature (overloading)
DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text);
DROP FUNCTION IF EXISTS public.register_new_tenant(text, text, text, text);

-- On recrée la fonction unique, propre et sécurisée
CREATE OR REPLACE FUNCTION public.register_new_tenant(
  p_raison_sociale text,
  p_devise text,
  p_admin_name text,
  p_phone text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_societe_id uuid;
  v_slug text;
  v_base_slug text;
  v_counter integer := 1;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié. Veuillez créer le compte utilisateur d abord.';
  END IF;

  UPDATE public.profiles SET full_name = p_admin_name, phone = p_phone WHERE id = v_user_id;

  -- Create Tenant
  v_base_slug := lower(regexp_replace(p_raison_sociale, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) = 0 THEN
    v_base_slug := 'tenant';
  END IF;
  
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;

  INSERT INTO public.tenants (name, slug, is_active)
  VALUES (p_raison_sociale, v_slug, false)
  RETURNING id INTO v_tenant_id;

  -- Create Societe
  INSERT INTO public.societes (tenant_id, raison_sociale, devise, is_active)
  VALUES (v_tenant_id, p_raison_sociale, p_devise, false)
  RETURNING id INTO v_societe_id;

  -- Link profile to tenant
  UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = v_user_id;

  -- Link user to societe
  INSERT INTO public.user_societes (societe_id, user_id, is_active)
  VALUES (v_societe_id, v_user_id, true);

  RETURN v_tenant_id;
END;
$function$;
