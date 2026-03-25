-- Migration: RLS pour public.notifications
-- Les comptes Master (is_super_admin = true) ont tenant_id = NULL dans leurs notifications
-- Le filtre user_id = auth.uid() couvre tous les types de comptes sans distinction

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : chaque utilisateur voit uniquement ses propres notifications
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

-- Mise à jour (marquer comme lu) : uniquement ses propres notifications
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Insertion : service role uniquement (les notifs sont créées côté serveur)
-- Pas de policy INSERT pour le rôle anon/authenticated → seul le service role peut insérer
