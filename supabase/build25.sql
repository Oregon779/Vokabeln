-- Lumière Build 25: Profilbilder (Avatar-Baukasten + eigenes Foto mit Freigabe)
-- Einmal komplett im Supabase SQL-Editor ausfuehren. Laesst sich gefahrlos
-- wiederholen.

-- 1) Profil-Spalten ------------------------------------------------------------
--   avatar_kind         'avatar' | 'photo' | null (= Initialen)
--   avatar_config       Bauplan des Baukastens, z.B. {"v":1,"face":"f3","eyes":"e7",...}
--   photo_path          freigegebenes Foto im oeffentlichen Bucket "avatars"
--   photo_pending_path  wartendes Foto im privaten Bucket "avatars-pending"
--   photo_status        'pending' | 'rejected' | null
--   photo_reason        Grund einer Ablehnung (leer = Standardtext)
alter table public.profiles add column if not exists avatar_kind text;
alter table public.profiles add column if not exists avatar_config jsonb;
alter table public.profiles add column if not exists photo_path text;
alter table public.profiles add column if not exists photo_pending_path text;
alter table public.profiles add column if not exists photo_status text;
alter table public.profiles add column if not exists photo_reason text;
alter table public.profiles add column if not exists photo_updated_at timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_avatar_kind_check check (avatar_kind in ('avatar', 'photo'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_photo_status_check check (photo_status in ('pending', 'rejected'));
exception when duplicate_object then null; end $$;

-- 2) Nutzer duerfen nur ihr WARTENDES Foto setzen, nie selbst freigeben ---------
create or replace function public.protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.is_admin := old.is_admin;
    new.banned := old.banned;
    new.ai_limit_override := old.ai_limit_override;
    new.plan := old.plan;
    new.plan_until := old.plan_until;
    new.plan_reminded_for := old.plan_reminded_for;
    -- Freigegebenes Foto: entfernen ja, selbst setzen nein.
    if new.photo_path is not null and new.photo_path is distinct from old.photo_path then
      new.photo_path := old.photo_path;
    end if;
    -- Status: nur "wartet" oder leer; Grund nur leeren.
    if new.photo_status is not null and new.photo_status <> 'pending' then
      new.photo_status := old.photo_status;
    end if;
    if new.photo_reason is not null and new.photo_reason is distinct from old.photo_reason then
      new.photo_reason := old.photo_reason;
    end if;
    -- Wartendes Foto nur aus dem eigenen Ordner.
    if new.photo_pending_path is not null and new.photo_pending_path not like (auth.uid()::text || '/%') then
      new.photo_pending_path := old.photo_pending_path;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

-- 3) Bilder fuer andere (Ranglisten): nur Bauplan und FREIGEGEBENES Foto -------
create or replace function public.public_avatars(uids uuid[])
returns table (user_id uuid, avatar_kind text, avatar_config jsonb, photo_path text)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.user_id, p.avatar_kind, p.avatar_config, p.photo_path
  from public.profiles p
  where p.user_id = any(uids[1:100]);
$function$;
grant execute on function public.public_avatars(uuid[]) to anon, authenticated;

-- 4) Speicher: oeffentlich (freigegeben) und privat (wartet auf Freigabe) -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars-pending', 'avatars-pending', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Wartende Fotos: der Nutzer im eigenen Ordner (<user_id>/...), der Admin ueberall.
drop policy if exists "avatars_pending_insert_own" on storage.objects;
create policy "avatars_pending_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars-pending' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_pending_select" on storage.objects;
create policy "avatars_pending_select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars-pending' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));
drop policy if exists "avatars_pending_delete" on storage.objects;
create policy "avatars_pending_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars-pending' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));

-- Freigegebene Fotos: hineinlegen nur der Admin (beim Freigeben), loeschen der
-- Admin oder der Nutzer selbst ("Profilbild entfernen"). Lesen ist oeffentlich.
drop policy if exists "avatars_insert_admin" on storage.objects;
create policy "avatars_insert_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_admin(auth.uid()));
-- (Loeschen ueber die API braucht zusaetzlich Leserecht auf den Eintrag.)
drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));
