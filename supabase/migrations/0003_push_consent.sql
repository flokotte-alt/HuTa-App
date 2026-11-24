-- Huta: Push-Nachrichten (ueber Expo), Einwilligung, Konto loeschen

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.trips add column start_notified_at timestamptz;
alter table public.trip_stops add column notified_eta timestamptz, add column ready_notified_at timestamptz;

create table public.consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.consents enable row level security;
create policy consents_own on public.consents for select to authenticated using (user_id = auth.uid());

-- Interner Versand ----------------------------------------------------------

create function public.send_push(p_users uuid[], p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token, 'title', p_title, 'body', p_body, 'sound', 'default',
    'channelId', 'default', 'data', p_data))
  into msgs
  from public.push_tokens t
  where t.user_id = any (p_users);
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
  );
end $$;

create function public.provider_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'provider'
$$;

-- Fahrt gestartet ------------------------------------------------------------

create function public.trip_started(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  update public.trips set start_notified_at = now() where id = p_trip;
  update public.trip_stops set notified_eta = eta where trip_id = p_trip;
  for r in
    select c.user_id, d.name, s.eta, t.direction
    from public.trip_dogs td
    join public.trip_stops s on s.id = td.stop_id
    join public.trips t on t.id = s.trip_id
    join public.dogs d on d.id = td.dog_id
    join public.customers c on c.id = d.customer_id
    where t.id = p_trip and c.user_id is not null and not td.sick
  loop
    perform public.send_push(
      array[r.user_id],
      case when r.direction = 'morning' then 'Die Abholung hat begonnen' else 'Die Rückfahrt hat begonnen' end,
      r.name || ': Ankunft ca. ' || to_char(r.eta at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr.',
      jsonb_build_object('type', 'trip_started'));
  end loop;
end $$;

-- Jede Minute: "Bitte bereit machen" und Verschiebungen ---------------------------

create function public.tick_trips() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select s.id as stop_id, s.eta, t.direction,
           array_agg(distinct c.user_id) filter (where c.user_id is not null and not td.sick) as users,
           string_agg(distinct d.name, ', ') as names
    from public.trips t
    join public.trip_stops s on s.trip_id = t.id
    join public.trip_dogs td on td.stop_id = s.id
    join public.dogs d on d.id = td.dog_id
    join public.customers c on c.id = d.customer_id
    where t.state = 'running' and s.arrived_at is null and s.ready_notified_at is null
      and s.eta - interval '15 minutes' <= now()
    group by s.id, s.eta, t.direction
  loop
    perform public.send_push(
      r.users,
      'Gleich bist du dran',
      case when r.direction = 'morning'
        then 'Bitte ' || r.names || ' fertig machen und den Daumen drücken. Wir sind gegen ' || to_char(r.eta at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr da.'
        else 'Wir bringen ' || r.names || ' gegen ' || to_char(r.eta at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr nach Hause. Bitte den Daumen drücken.' end,
      jsonb_build_object('type', 'ready'));
    update public.trip_stops set ready_notified_at = now(), notified_eta = eta where id = r.stop_id;
  end loop;

  for r in
    select s.id as stop_id, s.eta,
           array_agg(distinct c.user_id) filter (where c.user_id is not null and not td.sick) as users
    from public.trips t
    join public.trip_stops s on s.trip_id = t.id
    join public.trip_dogs td on td.stop_id = s.id
    join public.dogs d on d.id = td.dog_id
    join public.customers c on c.id = d.customer_id
    where t.state = 'running' and s.arrived_at is null and s.ready_notified_at is null
      and s.notified_eta is not null
      and abs(extract(epoch from (s.eta - s.notified_eta))) / 60 > 10
    group by s.id, s.eta
  loop
    perform public.send_push(
      r.users,
      'Neue Ankunftszeit',
      'Wir sind jetzt gegen ' || to_char(r.eta at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr bei dir.',
      jsonb_build_object('type', 'eta_changed'));
    update public.trip_stops set notified_eta = eta where id = r.stop_id;
  end loop;
end $$;

-- Nachzuegler erinnern --------------------------------------------------------

create function public.remind_laggards(p_trip uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  for r in
    select c.user_id, d.name
    from public.trip_dogs td
    join public.trip_stops s on s.id = td.stop_id
    join public.dogs d on d.id = td.dog_id
    join public.customers c on c.id = d.customer_id
    where s.trip_id = p_trip and s.arrived_at is null and td.thumb_at is null
      and not td.sick and c.user_id is not null
  loop
    perform public.send_push(array[r.user_id], 'Daumen fehlt noch',
      'Bitte kurz den Daumen für ' || r.name || ' drücken.', jsonb_build_object('type', 'reminder'));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Woche veroeffentlichen ---------------------------------------------------------

create function public.publish_week(p_from date, p_to date) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  update public.week_entries set published = true
  where day between p_from and p_to and not published;
  get diagnostics n = row_count;
  if n > 0 then
    perform public.send_push(
      (select coalesce(array_agg(distinct c.user_id), '{}')
         from public.week_entries e
         join public.dogs d on d.id = e.dog_id
         join public.customers c on c.id = d.customer_id
        where e.day between p_from and p_to and c.user_id is not null),
      'Neuer Wochenplan',
      'Der Plan für ' || to_char(p_from, 'DD.MM.') || ' bis ' || to_char(p_to, 'DD.MM.') || ' ist da.',
      jsonb_build_object('type', 'week'));
  end if;
  return n;
end $$;

-- Aenderung nach der Veroeffentlichung -----------------------------------------------

create function public.notify_week_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid; nm text; txt text;
begin
  if not public.is_provider() then return new; end if;
  if tg_op = 'INSERT' then
    if not new.published then return new; end if;
  else
    if not (old.published and new.published) then return new; end if;
    if old.status = new.status and old.station_id is not distinct from new.station_id
       and old.handover_morning is not distinct from new.handover_morning
       and old.handover_afternoon is not distinct from new.handover_afternoon then
      return new;
    end if;
  end if;
  select c.user_id, d.name into u, nm
  from public.dogs d join public.customers c on c.id = d.customer_id where d.id = new.dog_id;
  if u is null then return new; end if;
  txt := case new.status
    when 'registered' then 'angemeldet'
    when 'cancelled_billed' then 'Absage (berechnet)'
    when 'vacation' then 'Urlaub'
    when 'removed' then 'gestrichen'
    else 'krank' end;
  perform public.send_push(array[u], 'Änderung im Wochenplan',
    nm || ' am ' || to_char(new.day, 'DD.MM.') || ': ' || txt, jsonb_build_object('type', 'week_change'));
  return new;
end $$;

create trigger week_entries_notify after insert or update on public.week_entries
  for each row execute function public.notify_week_change();

-- Krankmeldung und Wohnungs-Wunsch benachrichtigen die Dienstleister ------------------

create or replace function public.customer_sick(p_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  select name into nm from public.dogs where id = p_dog and customer_id = public.my_customer_id();
  if nm is null then raise exception 'Nicht erlaubt'; end if;
  insert into public.week_entries (dog_id, day, status, published)
  values (p_dog, public.today_de(), 'sick', true)
  on conflict (dog_id, day) do update set status = 'sick';
  update public.trip_dogs set sick = true
  where dog_id = p_dog and stop_id in (
    select s.id from public.trip_stops s join public.trips t on t.id = s.trip_id where t.day = public.today_de());
  perform public.send_push(public.provider_ids(), 'Krankmeldung', nm || ' ist heute krank, bitte nicht abholen.',
    jsonb_build_object('type', 'sick'));
end $$;

create or replace function public.customer_apartment(p_trip_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  update public.trip_dogs td set apartment_requested_at = now()
  from public.trip_stops s, public.trips t, public.dogs d
  where td.id = p_trip_dog and s.id = td.stop_id and t.id = s.trip_id and d.id = td.dog_id
    and d.customer_id = public.my_customer_id() and d.apartment_allowed
    and t.state = 'running' and now() <= s.eta - interval '20 minutes';
  if not found then raise exception 'Wohnungs-Wunsch nicht mehr moeglich, bitte per WhatsApp melden'; end if;
  select d.name into nm from public.trip_dogs td join public.dogs d on d.id = td.dog_id where td.id = p_trip_dog;
  perform public.send_push(public.provider_ids(), 'Wohnungs-Wunsch', nm || ': bitte in die Wohnung bringen oder holen.',
    jsonb_build_object('type', 'apartment'));
end $$;

-- Push-Token, Einwilligung, Konto loeschen --------------------------------------------

create function public.save_push_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.push_tokens where token = p_token;
  insert into public.push_tokens (user_id, token) values (auth.uid(), p_token);
end $$;

create function public.accept_consent(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into public.consents (user_id, version) values (auth.uid(), p_version)
  on conflict (user_id) do update set version = excluded.version, accepted_at = now();
end $$;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if public.is_provider() then
    raise exception 'Dienstleister-Konten koennen nur serverseitig geloescht werden';
  end if;
  delete from public.customers where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- Rechte -------------------------------------------------------------------------------

revoke execute on function
  public.send_push(uuid[], text, text, jsonb), public.provider_ids(), public.tick_trips(),
  public.notify_week_change(), public.trip_started(uuid), public.remind_laggards(uuid),
  public.publish_week(date, date), public.save_push_token(text), public.accept_consent(text),
  public.delete_my_account()
from public, anon, authenticated;

grant execute on function
  public.trip_started(uuid), public.remind_laggards(uuid), public.publish_week(date, date),
  public.save_push_token(text), public.accept_consent(text), public.delete_my_account()
to authenticated;

select cron.schedule('huta-trip-tick', '* * * * *', 'select public.tick_trips()');
