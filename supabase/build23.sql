-- Lumière Build 23: Tarife mit Laufzeit, Absage-Grund, Mail-Status, Erinnerung
-- Einmal komplett im Supabase SQL-Editor ausfuehren. Laesst sich gefahrlos
-- wiederholen (if not exists / create or replace).

-- 1) Tarif mit Laufzeit am Profil ------------------------------------------
alter table public.profiles add column if not exists plan text;
alter table public.profiles add column if not exists plan_until timestamptz;
alter table public.profiles add column if not exists plan_reminded_for timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('plus', 'pro'));
exception when duplicate_object then null; end $$;

-- 2) Anfragen: Laufzeit, Preis, Grund, Mail-Status ----------------------------
alter table public.upgrade_requests add column if not exists kind text not null default 'anfrage';
alter table public.upgrade_requests add column if not exists months int;
alter table public.upgrade_requests add column if not exists price_cents int;
alter table public.upgrade_requests add column if not exists reason text;
alter table public.upgrade_requests add column if not exists decided_at timestamptz;
alter table public.upgrade_requests add column if not exists mail_sent_at timestamptz;
alter table public.upgrade_requests add column if not exists mail_error text;
do $$ begin
  alter table public.upgrade_requests add constraint upgrade_requests_kind_check check (kind in ('anfrage', 'verlaengerung'));
exception when duplicate_object then null; end $$;

-- Verlaengerungen traegt der Admin fuer andere Konten ein (fuer den Verlauf
-- und die Einnahmen-Uebersicht).
drop policy if exists "upgrade_requests_insert_admin" on public.upgrade_requests;
create policy "upgrade_requests_insert_admin" on public.upgrade_requests
  for insert to authenticated with check (public.is_admin(auth.uid()));

-- 3) Tarif-Felder darf nur ein Admin setzen ----------------------------------
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
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

-- 4) Tageslimit: Einzel-Limit > laufender Tarif > Standard ---------------------
-- Ist "bezahlt bis" vorbei, gilt automatisch wieder das Gratis-Limit.
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
begin
  if v_uid is null then
    return jsonb_build_object('allowed', true, 'reason', 'guest');
  end if;

  select * into v_profile from public.profiles where user_id = v_uid for update;
  if not found then
    insert into public.profiles (user_id) values (v_uid) returning * into v_profile;
  end if;

  if v_profile.banned then
    return jsonb_build_object('allowed', false, 'reason', 'banned');
  end if;

  if v_profile.ai_requests_date <> current_date then
    update public.profiles set ai_requests_today = 0, ai_requests_date = current_date
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

-- 5) Taegliche Erinnerung 3 Tage vor Ablauf (8 Uhr UTC) -----------------------
-- HIER_DEIN_CRON_SECRET durch dieselbe lange Zeichenkette ersetzen, die du bei
-- der Edge Function als Secret CRON_SECRET eintraegst.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('lumiere-abo-erinnerung')
  where exists (select 1 from cron.job where jobname = 'lumiere-abo-erinnerung');
select cron.schedule('lumiere-abo-erinnerung', '0 8 * * *', $cron$
  select net.http_post(
    url := 'https://imjlrfemiptuwobliydq.supabase.co/functions/v1/lumiere-mail',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', 'HIER_DEIN_CRON_SECRET'),
    body := '{"kind":"reminders"}'::jsonb
  );
$cron$);
