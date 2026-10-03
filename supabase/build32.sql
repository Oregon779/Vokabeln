-- Lumière Build 32: Zeitraum "Heute" fuer die Rangliste (auch fuer die
-- Neon-Drift-Tages-Challenge, Spielschluessel "neondaily").
-- Setzt build31.sql voraus. Kann mehrfach laufen.

create or replace function public.lb_since(p_period text)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select case p_period
    when 'day'   then (date_trunc('day',   now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
    when 'week'  then (date_trunc('week',  now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
    when 'month' then (date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
    else null end;
$function$;

grant execute on function public.lb_since(text) to anon, authenticated;
