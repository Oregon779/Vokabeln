-- Lumière Build 26: Profilbild-Sperren je Nutzer und Nachrichten in "Mein Konto"
-- Einmal komplett im Supabase SQL-Editor ausfuehren. Laesst sich gefahrlos
-- wiederholen. Nichts muss ersetzt werden.

-- 1) Sperren je Konto (Avatar-Baukasten und Foto-Upload getrennt) --------------
alter table public.profiles add column if not exists avatar_locked boolean not null default false;
alter table public.profiles add column if not exists photo_locked boolean not null default false;

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
    new.avatar_locked := old.avatar_locked;
    new.photo_locked := old.photo_locked;
    -- Freigegebenes Foto: entfernen ja, selbst setzen nein.
    if new.photo_path is not null and new.photo_path is distinct from old.photo_path then
      new.photo_path := old.photo_path;
    end if;
    if new.photo_status is not null and new.photo_status <> 'pending' then
      new.photo_status := old.photo_status;
    end if;
    if new.photo_reason is not null and new.photo_reason is distinct from old.photo_reason then
      new.photo_reason := old.photo_reason;
    end if;
    if new.photo_pending_path is not null and new.photo_pending_path not like (auth.uid()::text || '/%') then
      new.photo_pending_path := old.photo_pending_path;
    end if;
    -- Gesperrt: nichts Neues setzen (entfernen bleibt erlaubt).
    if old.avatar_locked and new.avatar_config is not null then
      new.avatar_config := null;
    end if;
    if old.photo_locked and new.photo_pending_path is not null and new.photo_pending_path is distinct from old.photo_pending_path then
      new.photo_pending_path := old.photo_pending_path;
      new.photo_status := old.photo_status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

-- Ranglisten: Gesperrtes nie herausgeben.
create or replace function public.public_avatars(uids uuid[])
returns table (user_id uuid, avatar_kind text, avatar_config jsonb, photo_path text)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.user_id, p.avatar_kind,
         case when p.avatar_locked then null else p.avatar_config end,
         case when p.photo_locked then null else p.photo_path end
  from public.profiles p
  where p.user_id = any(uids[1:100]);
$function$;
grant execute on function public.public_avatars(uuid[]) to anon, authenticated;

-- Gesperrte duerfen auch nichts mehr in den Warte-Ordner legen.
drop policy if exists "avatars_pending_insert_own" on storage.objects;
create policy "avatars_pending_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars-pending'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.photo_locked)
  );

-- 2) Nachrichten ------------------------------------------------------------------
--   kind: 'photo' | 'avatar' | 'plan' | 'reminder' | 'admin'
--   tone: 'ok' | 'no' | 'info'   (Farbe des Punkts)
--   dedupe: verhindert doppelte automatische Nachrichten (Erinnerungen)
create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  tone text not null default 'info',
  title text not null,
  body text,
  dedupe text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists user_messages_user_idx on public.user_messages (user_id, created_at desc);
create unique index if not exists user_messages_dedupe on public.user_messages (user_id, dedupe);
alter table public.user_messages enable row level security;

drop policy if exists "user_messages_select_own" on public.user_messages;
create policy "user_messages_select_own" on public.user_messages for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "user_messages_delete_own" on public.user_messages;
create policy "user_messages_delete_own" on public.user_messages for delete to authenticated
  using (auth.uid() = user_id);
drop policy if exists "user_messages_update_own" on public.user_messages;
create policy "user_messages_update_own" on public.user_messages for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_messages_insert_admin" on public.user_messages;
create policy "user_messages_insert_admin" on public.user_messages for insert to authenticated
  with check (public.is_admin(auth.uid()));
-- Nutzer duerfen an ihren Nachrichten nur "gelesen" setzen, nichts umschreiben.
revoke update on public.user_messages from authenticated;
grant update (read_at) on public.user_messages to authenticated;

-- Rundnachricht an alle Konten (nur Admin).
create or replace function public.send_message_to_all(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare n integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'nur fuer Admins';
  end if;
  insert into public.user_messages (user_id, kind, tone, title, body)
  select p.user_id, 'admin', 'info', p_title, p_body from public.profiles p;
  get diagnostics n = row_count;
  return n;
end;
$function$;
grant execute on function public.send_message_to_all(text, text) to authenticated;

-- 3) Taeglich: "laeuft bald ab" (3 Tage vorher) und "abgelaufen" ---------------
create extension if not exists pg_cron;
select cron.unschedule('lumiere-nachrichten')
  where exists (select 1 from cron.job where jobname = 'lumiere-nachrichten');
select cron.schedule('lumiere-nachrichten', '5 8 * * *', $cron$
  insert into public.user_messages (user_id, kind, tone, title, body, dedupe)
  select p.user_id, 'reminder', 'info',
         initcap(p.plan) || ' läuft bald ab',
         'Dein Tarif ' || initcap(p.plan) || ' gilt noch bis ' || to_char(p.plan_until at time zone 'Europe/Berlin', 'DD.MM.YYYY')
           || '. Danach gilt automatisch wieder der Gratis-Tarif. Verlängern kannst du unten unter „Mehr KI-Anfragen“.',
         'bald:' || p.plan_until::text
  from public.profiles p
  where p.plan is not null and p.plan_until > now() and p.plan_until <= now() + interval '3 days'
  on conflict (user_id, dedupe) do nothing;

  insert into public.user_messages (user_id, kind, tone, title, body, dedupe)
  select p.user_id, 'reminder', 'no',
         initcap(p.plan) || ' ist abgelaufen',
         'Dein Tarif ' || initcap(p.plan) || ' ist am ' || to_char(p.plan_until at time zone 'Europe/Berlin', 'DD.MM.YYYY')
           || ' abgelaufen. Ab jetzt gilt wieder der Gratis-Tarif.',
         'ab:' || p.plan_until::text
  from public.profiles p
  where p.plan is not null and p.plan_until <= now() and p.plan_until > now() - interval '7 days'
  on conflict (user_id, dedupe) do nothing;
$cron$);
