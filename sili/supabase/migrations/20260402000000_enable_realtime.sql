-- Activer le temps réel (Realtime) pour les notifications et les modules des sociétés
-- Ceci permet au client Supabase.channel().on('postgres_changes', ...) de recevoir les événements

BEGIN;

-- La publication 'supabase_realtime' existe par défaut dans Supabase, 
-- mais nous devons nous assurer que les tables y sont ajoutées.
DO $$
BEGIN
    if not exists (select pubname from pg_publication where pubname = 'supabase_realtime') then
        CREATE PUBLICATION supabase_realtime;
    end if;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE societe_modules;

COMMIT;
