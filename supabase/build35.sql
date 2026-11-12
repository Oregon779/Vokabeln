-- Lumière Build 35: Lehrkräfte, Klassen mit Code, Klassen-Sets, Fortschritt.
-- Einmal komplett im SQL-Editor ausführen. Kann mehrfach laufen (idempotent).
-- Setzt die früheren Builds voraus (public.is_admin, profiles, user_messages).

-- 1) Lehrkräfte ---------------------------------------------------------------
-- Wer hier steht, darf Klassen anlegen. Eintragen darf nur ein Admin
-- (nach einer Anfrage aus "Mein Konto").
create table if not exists public.teachers (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  school       text,
  subject      text,
  approved_at  timestamptz not null default now(),
  approved_by  uuid references auth.users(id) on delete set null
);
alter table public.teachers enable row level security;
drop policy if exists teachers_select on public.teachers;
create policy teachers_select on public.teachers
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists teachers_admin_all on public.teachers;
create policy teachers_admin_all on public.teachers
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select, insert, update, delete on public.teachers to authenticated;

create or replace function public.is_teacher(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (select 1 from public.teachers t where t.user_id = p_uid);
$function$;
grant execute on function public.is_teacher(uuid) to authenticated;

create table if not exists public.teacher_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  school      text not null check (char_length(school) between 2 and 120),
  subject     text check (subject is null or char_length(subject) <= 80),
  message     text check (message is null or char_length(message) <= 600),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason      text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users(id) on delete set null
);
create unique index if not exists teacher_requests_one_open on public.teacher_requests (user_id) where status = 'pending';
alter table public.teacher_requests enable row level security;
drop policy if exists treq_select on public.teacher_requests;
create policy treq_select on public.teacher_requests
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists treq_insert_own on public.teacher_requests;
create policy treq_insert_own on public.teacher_requests
  for insert with check (auth.uid() = user_id and status = 'pending' and reason is null and decided_at is null);
drop policy if exists treq_admin_update on public.teacher_requests;
create policy treq_admin_update on public.teacher_requests
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists treq_admin_delete on public.teacher_requests;
create policy treq_admin_delete on public.teacher_requests
  for delete using (public.is_admin(auth.uid()));
grant select, insert, update, delete on public.teacher_requests to authenticated;

-- 2) Klassen -------------------------------------------------------------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at  timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes (teacher_id);

create table if not exists public.class_members (
  class_id   uuid not null references public.classes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on public.class_members (user_id);

create table if not exists public.class_sets (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  source_id   text,
  name        text not null check (char_length(name) between 1 and 80),
  pairs       jsonb not null default '[]'::jsonb
              check (jsonb_typeof(pairs) = 'array' and jsonb_array_length(pairs) <= 500),
  updated_at  timestamptz not null default now()
);
create unique index if not exists class_sets_source_idx on public.class_sets (class_id, source_id);

create table if not exists public.class_progress (
  set_id   uuid not null references public.class_sets(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  runs     integer not null default 0,
  correct  integer not null default 0,
  wrong    integer not null default 0,
  last_at  timestamptz,
  primary key (set_id, user_id)
);

-- Hilfsfunktionen (security definer, damit sich die Regeln von classes und
-- class_members nicht gegenseitig endlos aufrufen).
create or replace function public.is_class_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid());
$function$;
create or replace function public.is_class_member(p_class uuid)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.class_members m where m.class_id = p_class and m.user_id = auth.uid());
$function$;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;

alter table public.classes enable row level security;
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select using (teacher_id = auth.uid() or public.is_class_member(id) or public.is_admin(auth.uid()));
drop policy if exists classes_owner_update on public.classes;
create policy classes_owner_update on public.classes
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists classes_owner_delete on public.classes;
create policy classes_owner_delete on public.classes
  for delete using (teacher_id = auth.uid() or public.is_admin(auth.uid()));
grant select, update, delete on public.classes to authenticated;
-- Anlegen nur über create_class() (erzeugt den Code und prüft die Lehrkraft).

alter table public.class_members enable row level security;
drop policy if exists cm_select on public.class_members;
create policy cm_select on public.class_members
  for select using (user_id = auth.uid() or public.is_class_teacher(class_id) or public.is_admin(auth.uid()));
drop policy if exists cm_delete on public.class_members;
create policy cm_delete on public.class_members
  for delete using (user_id = auth.uid() or public.is_class_teacher(class_id) or public.is_admin(auth.uid()));
grant select, delete on public.class_members to authenticated;
-- Beitreten nur über join_class().

alter table public.class_sets enable row level security;
drop policy if exists cs_select on public.class_sets;
create policy cs_select on public.class_sets
  for select using (public.is_class_teacher(class_id) or public.is_class_member(class_id) or public.is_admin(auth.uid()));
drop policy if exists cs_teacher_write on public.class_sets;
create policy cs_teacher_write on public.class_sets
  for all using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
grant select, insert, update, delete on public.class_sets to authenticated;

alter table public.class_progress enable row level security;
drop policy if exists cp_select on public.class_progress;
create policy cp_select on public.class_progress
  for select using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (select 1 from public.class_sets s where s.id = set_id and public.is_class_teacher(s.class_id))
  );
grant select on public.class_progress to authenticated;
-- Schreiben nur über class_log_run().

-- 3) Funktionen -----------------------------------------------------------------
-- Klasse anlegen: nur Lehrkräfte (und Admins). Code aus 6 gut lesbaren Zeichen
-- (ohne 0/O und 1/I).
create or replace function public.create_class(p_name text)
returns public.classes
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text;
  v_row public.classes;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null or not (public.is_teacher(auth.uid()) or public.is_admin(auth.uid())) then
    raise exception 'Nur freigeschaltete Lehrkräfte können Klassen anlegen.';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'Bitte einen Namen angeben.';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes c where c.code = v_code);
  end loop;
  insert into public.classes (teacher_id, name, code)
  values (auth.uid(), left(btrim(p_name), 60), v_code)
  returning * into v_row;
  return v_row;
end;
$function$;
revoke all on function public.create_class(text) from public;
grant execute on function public.create_class(text) to authenticated;

-- Beitreten per Code. Gesperrte Konten können nicht beitreten.
create or replace function public.join_class(p_code text)
returns table (class_id uuid, name text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_class public.classes;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
  if exists (select 1 from public.profiles p where p.user_id = auth.uid()
             and p.banned and (p.banned_until is null or p.banned_until > now())) then
    raise exception 'Dein Konto ist gesperrt.';
  end if;
  select * into v_class from public.classes c where c.code = upper(btrim(p_code));
  if not found then raise exception 'Diesen Klassen-Code gibt es nicht.'; end if;
  if v_class.teacher_id = auth.uid() then raise exception 'Das ist deine eigene Klasse.'; end if;
  insert into public.class_members (class_id, user_id) values (v_class.id, auth.uid())
  on conflict do nothing;
  return query select v_class.id, v_class.name;
end;
$function$;
revoke all on function public.join_class(text) from public;
grant execute on function public.join_class(text) to authenticated;

-- Meine Klassen (als Schüler) mit dem Namen der Lehrkraft.
create or replace function public.my_classes()
returns table (class_id uuid, name text, teacher_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select c.id, c.name, coalesce(p.display_name, 'Lehrkraft'), m.joined_at
    from public.class_members m
    join public.classes c on c.id = m.class_id
    left join public.profiles p on p.user_id = c.teacher_id
   where m.user_id = auth.uid()
   order by m.joined_at;
$function$;
revoke all on function public.my_classes() from public;
grant execute on function public.my_classes() to authenticated;

-- Eine geübte Runde in einem Klassen-Set zählen (nur Mitglieder).
create or replace function public.class_log_run(p_set uuid, p_correct integer, p_wrong integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_class uuid;
begin
  select s.class_id into v_class from public.class_sets s where s.id = p_set;
  if v_class is null then return; end if;
  if not exists (select 1 from public.class_members m where m.class_id = v_class and m.user_id = auth.uid()) then
    return;
  end if;
  insert into public.class_progress (set_id, user_id, runs, correct, wrong, last_at)
  values (p_set, auth.uid(), 1, greatest(0, least(p_correct, 500)), greatest(0, least(p_wrong, 500)), now())
  on conflict (set_id, user_id) do update
    set runs = public.class_progress.runs + 1,
        correct = public.class_progress.correct + excluded.correct,
        wrong = public.class_progress.wrong + excluded.wrong,
        last_at = now();
end;
$function$;
revoke all on function public.class_log_run(uuid, integer, integer) from public;
grant execute on function public.class_log_run(uuid, integer, integer) to authenticated;

-- Übersicht für die Lehrkraft: Mitglieder mit Fortschritt je Klassen-Set.
create or replace function public.class_overview(p_class uuid)
returns table (user_id uuid, display_name text, joined_at timestamptz, set_id uuid,
               runs integer, correct integer, wrong integer, last_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (public.is_class_teacher(p_class) or public.is_admin(auth.uid())) then
    raise exception 'Nur für die Lehrkraft dieser Klasse.';
  end if;
  return query
    select m.user_id, coalesce(p.display_name, 'Ohne Namen'), m.joined_at, s.id,
           coalesce(g.runs, 0), coalesce(g.correct, 0), coalesce(g.wrong, 0), g.last_at
      from public.class_members m
      left join public.profiles p on p.user_id = m.user_id
      left join public.class_sets s on s.class_id = m.class_id
      left join public.class_progress g on g.set_id = s.id and g.user_id = m.user_id
     where m.class_id = p_class
     order by p.display_name nulls last, m.user_id;
end;
$function$;
revoke all on function public.class_overview(uuid) from public;
grant execute on function public.class_overview(uuid) to authenticated;
