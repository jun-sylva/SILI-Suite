-- Empêche d'ajouter deux fois le même utilisateur dans un groupe
ALTER TABLE user_group_members
  ADD CONSTRAINT unique_group_user UNIQUE (group_id, user_id);

-- Même chose pour les employés sans compte
ALTER TABLE user_group_members
  ADD CONSTRAINT unique_group_employe UNIQUE (group_id, employe_id);
