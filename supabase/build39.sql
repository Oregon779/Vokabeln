-- Lumière Build 39: Wartung greift sofort + voraussichtliches Ende
-- Einmal im Supabase-SQL-Editor ausführen. Ohne dieses SQL läuft alles weiter:
-- die Seiten fragen die Einstellungen dann alle 20 Sekunden ab (statt sofort),
-- und das Feld "Voraussichtlich zurück" im Admin-Panel bleibt ohne Wirkung.

-- 1) Voraussichtliches Ende der Wartung (Countdown auf dem Wartungs-Bildschirm)
alter table public.site_settings add column if not exists maintenance_until timestamptz;

-- 2) Realtime: jede Änderung an site_settings geht sofort an alle offenen Seiten.
--    Lesen darf site_settings ohnehin jeder (Policy site_settings_select_all),
--    ändern weiterhin nur Admins (site_settings_update_admin).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
  ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end $$;

-- Hinweis Klassen/Lehrkräfte: die Tabellen aus build35.sql wurden in diesem Projekt
-- nie angelegt (geprüft am 12.11.2026) - es gibt nichts aufzuräumen.
