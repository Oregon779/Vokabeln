-- Lumière Build 31: Coins im Admin-Panel, neue Rangliste (Zeitraum, Gesamt,
-- gespielte Runden, Coins, Online-Status). Einmal komplett im SQL-Editor
-- ausfuehren. Kann mehrfach laufen (idempotent).

-- 1) Coin-Buchungen durch Admins ------------------------------------------
-- Die Coins selbst liegen im synchronisierten Lernstand (user_data.data.coins),
-- den nur der Nutzer schreibt. Ein Admin legt deshalb eine Buchung an; die App
-- des Nutzers bucht sie beim naechsten Laden ein und setzt applied_at.
create table if not exists public.coin_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null check (delta <> 0 and delta between -1000000 and 1000000),
  reason      text,
  notified    boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  applied_at  timestamptz
);
create index if not exists coin_grants_user_idx on public.coin_grants (user_id, created_at desc);
alter table public.coin_grants enable row level security;

drop policy if exists coin_grants_admin_all on public.coin_grants;
create policy coin_grants_admin_all on public.coin_grants
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists coin_grants_select_own on public.coin_grants;
create policy coin_grants_select_own on public.coin_grants
  for select using (auth.uid() = user_id);
drop policy if exists coin_grants_apply_own on public.coin_grants;
create policy coin_grants_apply_own on public.coin_grants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Nutzer duerfen an ihren Buchungen nur applied_at setzen.
revoke update on public.coin_grants from authenticated;
grant select, insert, delete on public.coin_grants to authenticated;
grant update (applied_at) on public.coin_grants to authenticated;
-- Admins aendern Buchungen nicht, sie legen neue an oder loeschen offene.

-- Admin-Uebersicht: Coin-Stand je Konto (aus dem Lernstand) plus noch nicht
-- eingebuchte Buchungen.
create or replace function public.admin_coins()
returns table (user_id uuid, coins integer, pending integer)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'nur fuer Admins';
  end if;
  return query
    select p.user_id,
           coalesce(nullif(d.data->>'coins', '')::numeric, 0)::integer,
           coalesce((select sum(g.delta) from public.coin_grants g
                      where g.user_id = p.user_id and g.applied_at is null), 0)::integer
      from public.profiles p
      left join public.user_data d on d.user_id = p.user_id;
end;
$function$;
revoke all on function public.admin_coins() from public;
grant execute on function public.admin_coins() to authenticated;

-- 2) Jede gespielte Runde ---------------------------------------------------
-- game_records haelt nur die Bestleistung. Fuer Woche/Monat und die Zahl
-- der Runden braucht es jede Runde. Alte Runden zaehlen erst ab jetzt.
create table if not exists public.game_runs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  game        text not null check (char_length(game) between 1 and 24),
  score       integer not null check (score >= 0 and score < 100000000),
  created_at  timestamptz not null default now()
);
create index if not exists game_runs_game_time_idx on public.game_runs (game, created_at desc);
create index if not exists game_runs_user_idx on public.game_runs (user_id, game);
alter table public.game_runs enable row level security;
drop policy if exists game_runs_insert_own on public.game_runs;
create policy game_runs_insert_own on public.game_runs
  for insert with check (auth.uid() = user_id);
drop policy if exists game_runs_select_own on public.game_runs;
create policy game_runs_select_own on public.game_runs
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
grant select, insert on public.game_runs to authenticated;

-- Zeitraum -> Beginn (deutsche Zeit). 'all' = kein Beginn.
create or replace function public.lb_since(p_period text)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select case p_period
    when 'week'  then (date_trunc('week',  now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
    when 'month' then (date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
    else null end;
$function$;

-- Rangliste eines Spiels: Rang, Name, Bestleistung, Runden, Coins, Status.
-- Top p_limit, dazu immer die eigene Zeile (is_me), auch wenn sie weiter
-- hinten steht. Gesperrte Konten erscheinen nicht.
create or replace function public.lb_game(p_game text, p_period text default 'all', p_limit integer default 50)
returns table (rank integer, user_id uuid, display_name text, best integer, runs integer,
               coins integer, status text, is_me boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  with since as (select public.lb_since(p_period) as t),
  best as (
    select r.user_id, max(r.score) as best, count(*)::integer as runs
      from public.game_runs r, since
     where r.game = p_game and (since.t is null or r.created_at >= since.t)
     group by r.user_id
    union all
    -- Allzeit: auch die Rekorde von vor Build 31 (ohne Runden-Zaehlung).
    select g.user_id, g.score, 0
      from public.game_records g, since
     where g.game = p_game and since.t is null
  ),
  agg as (
    select b.user_id, max(b.best) as best, sum(b.runs)::integer as runs
      from best b group by b.user_id
  ),
  ranked as (
    select a.*, rank() over (order by a.best desc)::integer as rnk
      from agg a
      join public.profiles p on p.user_id = a.user_id
     where not (p.banned and (p.banned_until is null or p.banned_until > now()))
       and a.best > 0
  )
  select r.rnk, r.user_id, p.display_name, r.best::integer, r.runs,
         coalesce(nullif(d.data->>'coins', '')::numeric, 0)::integer,
         (select case when max(s.last_seen) > now() - interval '10 minutes' then 'online'
                      when max(s.last_seen) >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' then 'heute'
                      else null end
            from public.active_sessions s where s.user_id = r.user_id),
         r.user_id = auth.uid()
    from ranked r
    join public.profiles p on p.user_id = r.user_id
    left join public.user_data d on d.user_id = r.user_id
   where r.rnk <= p_limit or r.user_id = auth.uid()
   order by r.rnk, p.display_name;
$function$;

-- Gesamtwertung: je Spiel Platz 1 = 10 Punkte, Platz 2 = 9 ... Platz 10 = 1.
-- p_games = die Spiele, die der Nutzer sieht (Freigabe-Gate).
create or replace function public.lb_overall(p_games text[], p_period text default 'all', p_limit integer default 50)
returns table (rank integer, user_id uuid, display_name text, points integer, firsts integer,
               runs integer, coins integer, status text, is_me boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  with per as (
    select g.game, l.user_id, l.rank as rnk, l.runs
      from unnest(p_games) as g(game)
      cross join lateral public.lb_game(g.game, p_period, 10) l
     where l.rank <= 10
  ),
  runs_all as (
    select r.user_id, count(*)::integer as runs
      from public.game_runs r
     where r.game = any(p_games)
       and (public.lb_since(p_period) is null or r.created_at >= public.lb_since(p_period))
     group by r.user_id
  ),
  agg as (
    select per.user_id, sum(greatest(0, 11 - per.rnk))::integer as points,
           count(*) filter (where per.rnk = 1)::integer as firsts
      from per group by per.user_id
  ),
  ranked as (
    select a.*, rank() over (order by a.points desc, a.firsts desc)::integer as rnk from agg a
  )
  select r.rnk, r.user_id, p.display_name, r.points, r.firsts, coalesce(ra.runs, 0),
         coalesce(nullif(d.data->>'coins', '')::numeric, 0)::integer,
         (select case when max(s.last_seen) > now() - interval '10 minutes' then 'online'
                      when max(s.last_seen) >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' then 'heute'
                      else null end
            from public.active_sessions s where s.user_id = r.user_id),
         r.user_id = auth.uid()
    from ranked r
    join public.profiles p on p.user_id = r.user_id
    left join public.user_data d on d.user_id = r.user_id
    left join runs_all ra on ra.user_id = r.user_id
   where r.rnk <= p_limit or r.user_id = auth.uid()
   order by r.rnk, p.display_name;
$function$;

revoke all on function public.lb_game(text, text, integer) from public;
revoke all on function public.lb_overall(text[], text, integer) from public;
grant execute on function public.lb_game(text, text, integer) to anon, authenticated;
grant execute on function public.lb_overall(text[], text, integer) to anon, authenticated;
grant execute on function public.lb_since(text) to anon, authenticated;
