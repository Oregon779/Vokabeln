-- Lumière Build 29: Sperre mit Grund und Dauer, Namen durch den Admin,
-- KI-Limit nach deutscher Zeit. Einmal komplett im SQL-Editor ausfuehren.
-- Kann mehrfach laufen (idempotent).

-- 1) Neue Spalten --------------------------------------------------------
alter table public.profiles add column if not exists ban_reason   text;
alter table public.profiles add column if not exists banned_until timestamptz;  -- null = dauerhaft
alter table public.profiles add column if not exists name_locked  boolean not null default false;

-- 2) Nutzer duerfen die neuen Felder nicht selbst setzen, und bei gesperrtem
--    Namen auch den Namen nicht mehr aendern. (Rest wie in Build 26.)
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
    new.ban_reason := old.ban_reason;
    new.banned_until := old.banned_until;
    new.name_locked := old.name_locked;
    if old.name_locked then
      new.display_name := old.display_name;
    end if;
    new.ai_limit_override := old.ai_limit_override;
    new.plan := old.plan;
    new.plan_until := old.plan_until;
    new.plan_reminded_for := old.plan_reminded_for;
    new.avatar_locked := old.avatar_locked;
    new.photo_locked := old.photo_locked;
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

-- 3) Ranglisten ziehen den Namen immer aus dem Profil - nach einer
--    Umbenennung sofort, und niemand kann dort einen anderen Namen eintragen.
create or replace function public.game_records_name()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  select display_name into new.display_name from public.profiles where user_id = new.user_id;
  return new;
end;
$function$;
drop trigger if exists game_records_name on public.game_records;
create trigger game_records_name before insert or update on public.game_records
  for each row execute function public.game_records_name();

create or replace function public.profiles_name_to_records()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.game_records set display_name = new.display_name where user_id = new.user_id;
  return null;
end;
$function$;
drop trigger if exists profiles_name_to_records on public.profiles;
create trigger profiles_name_to_records after update of display_name on public.profiles
  for each row when (old.display_name is distinct from new.display_name)
  execute function public.profiles_name_to_records();

-- Einmal alle vorhandenen Eintraege angleichen.
update public.game_records g set display_name = p.display_name
  from public.profiles p where p.user_id = g.user_id and g.display_name is distinct from p.display_name;

-- 4) KI-Anfragen: Tag nach deutscher Zeit (vorher UTC = 2 Uhr nachts),
--    abgelaufene Sperren zaehlen nicht mehr.
create or replace function public.increment_ai_usage()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_limit int;
  v_default_limit int;
  v_plan_limit int;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', true, 'reason', 'guest');
  end if;

  select * into v_profile from public.profiles where user_id = v_uid for update;
  if not found then
    insert into public.profiles (user_id) values (v_uid) returning * into v_profile;
  end if;

  if v_profile.banned and (v_profile.banned_until is null or v_profile.banned_until > now()) then
    return jsonb_build_object('allowed', false, 'reason', 'banned');
  end if;

  if v_profile.ai_requests_date is distinct from v_today then
    update public.profiles set ai_requests_today = 0, ai_requests_date = v_today
      where user_id = v_uid returning * into v_profile;
  end if;

  select ai_daily_limit into v_default_limit from public.site_settings where id = 1;
  if v_profile.plan_until is not null and v_profile.plan_until > now() then
    v_plan_limit := case v_profile.plan when 'plus' then 200 when 'pro' then 1000 end;
  end if;
  v_limit := coalesce(v_profile.ai_limit_override, v_plan_limit, v_default_limit, 50);

  if v_profile.ai_requests_today >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'limit', v_limit, 'used', v_profile.ai_requests_today);
  end if;

  update public.profiles set ai_requests_today = ai_requests_today + 1 where user_id = v_uid;

  return jsonb_build_object('allowed', true, 'limit', v_limit, 'used', v_profile.ai_requests_today + 1);
end;
$function$;

-- 5) Stuendlich aufraeumen: Zaehler von gestern auf 0 (damit auch das
--    Admin-Panel stimmt, wenn jemand heute noch nichts gefragt hat) und
--    abgelaufene Sperren aufheben.
select cron.unschedule('lumiere-stuendlich') where exists (select 1 from cron.job where jobname = 'lumiere-stuendlich');
select cron.schedule('lumiere-stuendlich', '7 * * * *', $$
  update public.profiles
     set ai_requests_today = 0, ai_requests_date = (now() at time zone 'Europe/Berlin')::date
   where ai_requests_date is distinct from (now() at time zone 'Europe/Berlin')::date
     and ai_requests_today <> 0;
  update public.profiles
     set banned = false, banned_until = null, ban_reason = null
   where banned and banned_until is not null and banned_until <= now();
$$);

-- Sofort einmal angleichen.
update public.profiles
   set ai_requests_today = 0, ai_requests_date = (now() at time zone 'Europe/Berlin')::date
 where ai_requests_date is distinct from (now() at time zone 'Europe/Berlin')::date
   and ai_requests_today <> 0;
