-- Huta: neues Konzept (Auftrag vom 26.11.2026).
-- Erweitert das vorhandene Modell. Bestehende Stationen, Kunden und Hunde bleiben unveraendert.

-- 1. Neue Felder ------------------------------------------------------------

alter table public.profiles add column must_change_password boolean not null default false;

alter table public.customers add column customer_since date;

alter table public.stations
  add column is_start boolean not null default false,
  add column is_end boolean not null default false;

alter table public.dogs
  add column apartment_buffer_minutes int check (apartment_buffer_minutes between 0 and 120),
  add column apartment_buffer_enabled boolean not null default true,
  add column has_key boolean not null default false;

-- week_entries haelt nur noch Ausnahmen. Je Hund und Tag: eine veroeffentlichte Zeile und hoechstens ein Entwurf.
-- station_id gilt morgens, station_id_afternoon nachmittags.
alter table public.week_entries
  add column station_id_afternoon uuid references public.stations(id) on delete set null,
  add column changed_at timestamptz not null default now(),
  add column changed_by uuid references public.profiles(id) on delete set null;
alter table public.week_entries drop constraint week_entries_dog_id_day_key;
alter table public.week_entries add constraint week_entries_dog_day_published_key unique (dog_id, day, published);

alter table public.vacations add column created_at timestamptz not null default now();

alter table public.trips
  add column end_label text,
  add column end_lat double precision,
  add column end_lng double precision;

alter table public.trip_stops add column urgent_notified_at timestamptz;

alter table public.trip_dogs add column apartment_minutes int not null default 0;

-- 2. Standardwerte ----------------------------------------------------------

insert into public.app_settings (key, value) values
  ('push_stage1_minutes', '15'),
  ('push_stage2_minutes', '5'),
  ('apartment_deadline_minutes', '20'),
  ('reroute_check_seconds', '120'),
  ('reroute_ask_minutes', '1'),
  ('reroute_auto_minutes', '4'),
  ('album_days', '3'),
  ('push_trip_started', '0'),
  ('plan_stamp', '0'),
  ('trip_stamp', '0'),
  ('album_stamp', '0')
on conflict (key) do nothing;

-- Bis zu diesem Tag ist die Vergangenheit festgeschrieben
insert into public.app_settings (key, value)
values ('frozen_until', (public.today_de() - 1)::text)
on conflict (key) do nothing;

-- Start- und Zielpunkte: die beiden bisher fest in der App hinterlegten Orte
update public.stations set is_start = true, is_end = true where label = 'Tolkewitzer Straße 70';
insert into public.stations (label, address, lat, lng, is_start, is_end)
select 'Huta (Halsbrücke)', 'Halsbrücke', 50.9785012, 13.4082957, true, true
where not exists (select 1 from public.stations where label = 'Huta (Halsbrücke)');

-- 3. Hilfsfunktionen --------------------------------------------------------

create function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value::int from public.app_settings where key = p_key and value ~ '^[0-9]{1,6}$'),
    p_default)
$$;

-- Kundendaten gibt es erst nach eigenem Passwort und Einwilligung
create or replace function public.my_customer_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id
  from public.customers c
  join public.profiles p on p.id = c.user_id
  where c.user_id = auth.uid()
    and not p.must_change_password
    and exists (select 1 from public.consents k where k.user_id = auth.uid())
$$;

-- Konten werden nicht mehr ueber die E-Mail verknuepft. Das macht nur die Edge Function der Dienstleister.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, name, email)
  values (new.id, 'customer', coalesce(new.raw_user_meta_data->>'name', ''), lower(new.email));
  return new;
end $$;

create function public.handle_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set must_change_password = false where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_password_changed after update of encrypted_password on auth.users
  for each row execute function public.handle_password_change();

create function public.bump_stamp(p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.app_settings
  set value = (extract(epoch from clock_timestamp()) * 1000)::bigint::text
  where key = p_key
$$;

create function public.bump_stamp_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.bump_stamp(tg_argv[0]);
  return null;
end $$;

create trigger dogs_plan_stamp after insert or update or delete on public.dogs
  for each statement execute function public.bump_stamp_trigger('plan_stamp');
create trigger closures_plan_stamp after insert or update or delete on public.closures
  for each statement execute function public.bump_stamp_trigger('plan_stamp');
create trigger trips_trip_stamp after insert or update or delete on public.trips
  for each statement execute function public.bump_stamp_trigger('trip_stamp');
create trigger stops_trip_stamp after insert or update or delete on public.trip_stops
  for each statement execute function public.bump_stamp_trigger('trip_stamp');
create trigger tripdogs_trip_stamp after insert or update or delete on public.trip_dogs
  for each statement execute function public.bump_stamp_trigger('trip_stamp');

-- 4. Wochenplan: feste Tage plus Ausnahmen, Entwurf und Veroeffentlichen ----

create function public.is_closed(p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.closures c where p_day between c.date_from and c.date_to)
$$;

-- Faehrt der Hund an diesem Tag nach seiner festen Regel mit? (nur ab heute, Vergangenes ist festgeschrieben)
create function public.is_fixed_day(p_dog uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dogs d
    where d.id = p_dog and d.active and extract(isodow from p_day)::int = any (d.weekdays)
  ) and p_day >= public.today_de() and not public.is_closed(p_day)
$$;

-- Interne Grundlage: Entwurf (w_) und veroeffentlichter Stand (pub_) je Hund und Tag
create function public.plan_calc(p_from date, p_to date)
returns table (
  dog_id uuid, day date, draft boolean,
  w_status text, w_station_id uuid, w_station_id_afternoon uuid, w_handover_morning text, w_handover_afternoon text,
  pub_status text, pub_station_id uuid, pub_station_id_afternoon uuid, pub_handover_morning text, pub_handover_afternoon text
)
language sql stable security definer set search_path = '' as $$
  with grid as (
    select d.id as dog_id, g::date as day,
      (extract(isodow from g)::int = any (d.weekdays)
        and g::date >= public.today_de()
        and not exists (select 1 from public.closures c where g::date between c.date_from and c.date_to)) as fixed
    from public.dogs d
    cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
    where d.active
  ), joined as (
    select grid.dog_id, grid.day,
      dr.id is not null as draft,
      case when pu.id is not null then pu.status when grid.fixed then 'registered' end as p_status,
      pu.station_id as p_sm, pu.station_id_afternoon as p_sa, pu.handover_morning as p_hm, pu.handover_afternoon as p_ha,
      dr.status as d_status, dr.station_id as d_sm, dr.station_id_afternoon as d_sa,
      dr.handover_morning as d_hm, dr.handover_afternoon as d_ha
    from grid
    left join public.week_entries pu on pu.dog_id = grid.dog_id and pu.day = grid.day and pu.published
    left join public.week_entries dr on dr.dog_id = grid.dog_id and dr.day = grid.day and not dr.published
  )
  select dog_id, day, draft,
    case when draft then d_status else p_status end,
    case when draft then d_sm else p_sm end,
    case when draft then d_sa else p_sa end,
    case when draft then d_hm else p_hm end,
    case when draft then d_ha else p_ha end,
    p_status, p_sm, p_sa, p_hm, p_ha
  from joined
  where draft or p_status is not null
$$;

create function public.plan_rows(p_from date, p_to date)
returns table (
  dog_id uuid, day date, draft boolean,
  w_status text, w_station_id uuid, w_station_id_afternoon uuid, w_handover_morning text, w_handover_afternoon text,
  pub_status text, pub_station_id uuid, pub_station_id_afternoon uuid, pub_handover_morning text, pub_handover_afternoon text
)
language sql stable security definer set search_path = '' as $$
  select * from public.plan_calc(p_from, least(p_to, p_from + 62)) where public.is_provider()
$$;

-- Einen Tag aendern. Das ist immer ein Entwurf. p_status null verwirft den Entwurf.
create function public.set_plan_entry(
  p_dog uuid, p_day date, p_status text,
  p_station_morning uuid default null, p_station_afternoon uuid default null,
  p_handover_morning text default null, p_handover_afternoon text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pu public.week_entries%rowtype;
  pub_status text;
  same boolean;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  if p_status is null then
    delete from public.week_entries where dog_id = p_dog and day = p_day and not published;
  else
    if p_status not in ('registered', 'cancelled_billed', 'removed') then raise exception 'Unbekannter Status'; end if;
    select * into pu from public.week_entries where dog_id = p_dog and day = p_day and published;
    if pu.id is not null then pub_status := pu.status;
    elsif public.is_fixed_day(p_dog, p_day) then pub_status := 'registered';
    end if;
    -- "nicht dabei" und "gestrichen" sind dasselbe
    if coalesce(pub_status, 'removed') = 'removed' then
      same := p_status = 'removed';
    else
      same := p_status = pub_status
        and p_station_morning is not distinct from pu.station_id
        and p_station_afternoon is not distinct from pu.station_id_afternoon
        and p_handover_morning is not distinct from pu.handover_morning
        and p_handover_afternoon is not distinct from pu.handover_afternoon;
    end if;
    if same then
      delete from public.week_entries where dog_id = p_dog and day = p_day and not published;
    else
      insert into public.week_entries as e
        (dog_id, day, published, status, station_id, station_id_afternoon, handover_morning, handover_afternoon, changed_at, changed_by)
      values (p_dog, p_day, false, p_status,
        case when p_status = 'removed' then null else p_station_morning end,
        case when p_status = 'removed' then null else p_station_afternoon end,
        case when p_status = 'removed' then null else p_handover_morning end,
        case when p_status = 'removed' then null else p_handover_afternoon end,
        now(), auth.uid())
      on conflict (dog_id, day, published) do update set
        status = excluded.status, station_id = excluded.station_id,
        station_id_afternoon = excluded.station_id_afternoon,
        handover_morning = excluded.handover_morning, handover_afternoon = excluded.handover_afternoon,
        changed_at = now(), changed_by = auth.uid();
    end if;
  end if;
end $$;

-- Hund auf einen anderen Tag verschieben (verschwindet am alten, erscheint am neuen Tag)
create function public.move_plan_entry(p_dog uuid, p_from_day date, p_to_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare src record; dst record;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  if p_from_day = p_to_day then return; end if;
  select * into src from public.plan_calc(p_from_day, p_from_day) r where r.dog_id = p_dog;
  if src.w_status is null or src.w_status = 'removed' then raise exception 'Der Hund ist an diesem Tag nicht eingetragen'; end if;
  select * into dst from public.plan_calc(p_to_day, p_to_day) r where r.dog_id = p_dog;
  perform public.set_plan_entry(p_dog, p_from_day, 'removed');
  if dst.w_status is distinct from 'registered' then
    perform public.set_plan_entry(p_dog, p_to_day, 'registered',
      src.w_station_id, src.w_station_id_afternoon, src.w_handover_morning, src.w_handover_afternoon);
  end if;
end $$;

create function public.publish_plan() returns int
language plpgsql security definer set search_path = '' as $$
declare r public.week_entries%rowtype; n int := 0; fixed boolean; plain boolean;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  for r in select * from public.week_entries where not published for update loop
    fixed := public.is_fixed_day(r.dog_id, r.day);
    plain := r.station_id is null and r.station_id_afternoon is null
      and r.handover_morning is null and r.handover_afternoon is null;
    delete from public.week_entries where dog_id = r.dog_id and day = r.day and published;
    if (fixed and r.status = 'registered' and plain) or (not fixed and r.status = 'removed') then
      delete from public.week_entries where id = r.id; -- entspricht der festen Regel, keine Ausnahme noetig
    else
      update public.week_entries set published = true where id = r.id;
    end if;
    n := n + 1;
  end loop;
  if n > 0 then perform public.bump_stamp('plan_stamp'); end if;
  return n;
end $$;

create function public.discard_drafts() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  delete from public.week_entries where not published;
  get diagnostics n = row_count;
  return n;
end $$;

-- Vergangene Tage festschreiben, damit spaetere Regel-Aenderungen die Historie nicht veraendern
create function public.freeze_days() returns void
language plpgsql security definer set search_path = '' as $$
declare f date; upto date := public.today_de() - 1;
begin
  select value::date into f from public.app_settings where key = 'frozen_until';
  if f is null or f >= upto then return; end if;
  insert into public.week_entries (dog_id, day, status, published)
  select d.id, g::date, 'registered', true
  from public.dogs d
  cross join generate_series((f + 1)::timestamp, upto::timestamp, interval '1 day') g
  where d.active and extract(isodow from g)::int = any (d.weekdays) and not public.is_closed(g::date)
  on conflict (dog_id, day, published) do nothing;
  update public.app_settings set value = upto::text where key = 'frozen_until';
end $$;

-- Welchen Tag zeigt die Tagesliste? Nach beendeter Nachmittagsfahrt den naechsten Betriebstag.
create function public.home_day() returns date
language plpgsql stable security definer set search_path = '' as $$
declare d date := public.today_de(); i int := 0;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  while i < 400 loop
    exit when extract(isodow from d)::int <= 5
      and not public.is_closed(d)
      and not exists (select 1 from public.trips t where t.day = d and t.direction = 'afternoon' and t.state = 'done');
    d := d + 1;
    i := i + 1;
  end loop;
  return d;
end $$;

-- Wochenliste der Kunden: nur Veroeffentlichtes, von anderen nur Hundenamen
drop function public.week_names(date, date);

create function public.customer_week(p_monday date)
returns table (day date, dog_name text, own boolean, status text)
language sql stable security definer set search_path = '' as $$
  with me as (select public.my_customer_id() as id),
  wk as (
    -- am Wochenende gilt schon die kommende Woche als aktuelle
    select date_trunc('week', public.today_de() + 2)::date as current_monday
  )
  select r.day, d.name, d.customer_id = me.id, r.pub_status
  from me, wk, public.plan_calc(p_monday, p_monday + 4) r
  join public.dogs d on d.id = r.dog_id
  where me.id is not null
    and extract(isodow from p_monday) = 1
    and p_monday between wk.current_monday and wk.current_monday + 7
    and (r.pub_status = 'registered' or (r.pub_status = 'cancelled_billed' and d.customer_id = me.id))
  order by r.day, d.name
$$;

create function public.my_dogs() returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name from public.dogs d
  where d.customer_id = public.my_customer_id() and d.active
  order by d.name
$$;

-- 5. Fahrt ------------------------------------------------------------------

drop function public.trip_candidates(date, text);

create function public.trip_candidates(p_day date, p_direction text)
returns table (
  dog_id uuid, dog_name text, customer_id uuid, station_id uuid, station_label text,
  lat double precision, lng double precision, handover text, apartment_minutes int
)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name, d.customer_id, st.id, st.label, st.lat, st.lng, h.handover,
    case when h.handover = 'apartment' and d.apartment_buffer_enabled
      then coalesce(d.apartment_buffer_minutes, public.setting_int('apartment_extra_minutes', 5))
      else 0 end
  from public.plan_calc(p_day, p_day) r
  join public.dogs d on d.id = r.dog_id
  left join public.dog_rules ru on ru.dog_id = d.id and ru.period = p_direction
  cross join lateral (
    select coalesce(
      case p_direction when 'morning' then r.w_handover_morning else r.w_handover_afternoon end,
      ru.handover, 'station') as handover
  ) h
  left join public.stations st on st.id = coalesce(
    case p_direction when 'morning' then r.w_station_id else r.w_station_id_afternoon end, ru.station_id)
  where public.is_provider() and r.w_status = 'registered'
  order by d.name
$$;

-- Zeit an einer Station fuer Wohnungs-Uebergaben: je Kunde der laengste Puffer, Kunden addiert
create function public.stop_extra_minutes(p_stop uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(m), 0)::int from (
    select max(td.apartment_minutes) as m
    from public.trip_dogs td join public.dogs d on d.id = td.dog_id
    where td.stop_id = p_stop and td.handover = 'apartment'
    group by d.customer_id
  ) x
$$;

-- Fahrt in einem Schritt anlegen und starten
create function public.start_trip(
  p_day date, p_direction text,
  p_start_label text, p_start_lat double precision, p_start_lng double precision,
  p_end_label text, p_end_lat double precision, p_end_lng double precision,
  p_stops jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t_id uuid; s_id uuid; s jsonb; i int := 0; r record;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  if p_day <> public.today_de() then raise exception 'Eine Fahrt kann nur am Fahrtag gestartet werden'; end if;
  perform pg_advisory_xact_lock(hashtext('huta-start-trip'));
  if exists (select 1 from public.trips where day = p_day and state = 'running') then
    raise exception 'Es läuft bereits eine Fahrt';
  end if;
  if jsonb_array_length(coalesce(p_stops, '[]'::jsonb)) = 0 then raise exception 'Keine Stopps'; end if;
  delete from public.trips where day = p_day and direction = p_direction;
  insert into public.trips (day, direction, driver_id, start_label, start_lat, start_lng,
    end_label, end_lat, end_lng, state, started_at)
  values (p_day, p_direction, auth.uid(), p_start_label, p_start_lat, p_start_lng,
    p_end_label, p_end_lat, p_end_lng, 'running', now())
  returning id into t_id;
  for s in select value from jsonb_array_elements(p_stops) loop
    insert into public.trip_stops (trip_id, station_id, position, eta)
    values (t_id, (s->>'station_id')::uuid, i, (s->>'eta')::timestamptz)
    returning id into s_id;
    insert into public.trip_dogs (stop_id, dog_id, handover, apartment_minutes)
    select s_id, (x->>'dog_id')::uuid,
      case when x->>'handover' = 'apartment' then 'apartment' else 'station' end,
      coalesce((x->>'apartment_minutes')::int, 0)
    from jsonb_array_elements(s->'dogs') x;
    update public.trip_stops set extra_minutes = public.stop_extra_minutes(s_id) where id = s_id;
    i := i + 1;
  end loop;
  if public.setting_int('push_trip_started', 0) = 1 then
    update public.trips set start_notified_at = now() where id = t_id;
    for r in
      select c.user_id, string_agg(d.name, ', ' order by d.name) as names, min(ts.eta) as eta
      from public.trip_dogs td
      join public.trip_stops ts on ts.id = td.stop_id
      join public.dogs d on d.id = td.dog_id
      join public.customers c on c.id = d.customer_id
      where ts.trip_id = t_id and c.user_id is not null
      group by c.user_id
    loop
      perform public.send_push(array[r.user_id],
        case when p_direction = 'morning' then 'Die Abholung hat begonnen' else 'Die Rückfahrt hat begonnen' end,
        r.names || ': Ankunft gegen ' || to_char(r.eta at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr.',
        jsonb_build_object('type', 'trip_started'));
    end loop;
  end if;
  return t_id;
end $$;

create function public.finish_trip(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  update public.trips set state = 'done', ended_at = now() where id = p_trip and state <> 'done';
  delete from public.trip_location where trip_id = p_trip;
end $$;

-- Grosser Knopf "Naechster Stopp": nur die aktuelle Station, doppeltes Tippen schadet nicht.
-- Gibt true zurueck, wenn die Fahrt damit beendet ist.
create function public.arrive_stop(p_trip uuid, p_stop uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cur uuid;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  select id into cur from public.trip_stops where trip_id = p_trip and arrived_at is null order by position limit 1 for update;
  if cur = p_stop then
    update public.trip_stops set arrived_at = now() where id = cur;
  end if;
  if not exists (select 1 from public.trip_stops where trip_id = p_trip and arrived_at is null) then
    perform public.finish_trip(p_trip);
    return true;
  end if;
  return false;
end $$;

-- Neue Ankunftszeit fuer eine Station: alle folgenden offenen Stationen verschieben sich mit
create function public.shift_etas(p_stop uuid, p_eta timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.trip_stops%rowtype;
begin
  if not public.is_provider() then raise exception 'Nicht erlaubt'; end if;
  select * into s from public.trip_stops where id = p_stop and arrived_at is null for update;
  if s.id is null or s.eta is null then return; end if;
  update public.trip_stops set eta = eta + (p_eta - s.eta)
  where trip_id = s.trip_id and position >= s.position and arrived_at is null;
end $$;

drop function public.my_trip_status();
drop function public.my_trip_map();

create function public.my_trip_status()
returns table (
  trip_dog_id uuid, stop_id uuid, dog_name text, direction text, stops_before int, eta timestamptz,
  handover text, thumb_at timestamptz, thumb_open boolean, apartment_open boolean, apartment_requested boolean,
  arrived boolean, station_label text, lat double precision, lng double precision,
  vehicle_lat double precision, vehicle_lng double precision, vehicle_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with k as (select public.setting_int('apartment_deadline_minutes', 20) as mins)
  select td.id, s.id, d.name, t.direction,
    (select count(*)::int from public.trip_stops s2
       where s2.trip_id = t.id and s2.position < s.position and s2.arrived_at is null),
    s.eta, td.handover, td.thumb_at,
    (td.handover = 'station' and td.thumb_at is null and s.arrived_at is null
       and (s.ready_notified_at is not null or now() >= s.eta - make_interval(mins => k.mins))),
    (d.apartment_allowed and s.arrived_at is null and td.handover = 'station' and td.thumb_at is null
       and now() < s.eta - make_interval(mins => k.mins)),
    td.apartment_requested_at is not null,
    s.arrived_at is not null,
    st.label, st.lat, st.lng,
    case when s.arrived_at is null then l.lat end,
    case when s.arrived_at is null then l.lng end,
    case when s.arrived_at is null then l.updated_at end
  from k, public.trip_dogs td
  join public.trip_stops s on s.id = td.stop_id
  join public.trips t on t.id = s.trip_id
  join public.dogs d on d.id = td.dog_id
  join public.stations st on st.id = s.station_id
  left join public.trip_location l on l.trip_id = t.id
  where d.customer_id = public.my_customer_id()
    and t.day = public.today_de() and t.state = 'running'
  order by s.position, d.name
$$;

-- Daumen: gilt fuer alle eigenen Hunde an diesem Stopp
create or replace function public.customer_thumb(p_trip_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.my_customer_id(); s public.trip_stops%rowtype;
begin
  select ts.* into s
  from public.trip_dogs td
  join public.trip_stops ts on ts.id = td.stop_id
  join public.trips t on t.id = ts.trip_id
  join public.dogs d on d.id = td.dog_id
  where td.id = p_trip_dog and d.customer_id = me and t.state = 'running' and ts.arrived_at is null;
  if s.id is null or not (s.ready_notified_at is not null
      or now() >= s.eta - make_interval(mins => public.setting_int('apartment_deadline_minutes', 20))) then
    raise exception 'Die Bestätigung ist noch nicht freigeschaltet';
  end if;
  update public.trip_dogs td set thumb_at = now()
  from public.dogs d
  where d.id = td.dog_id and d.customer_id = me and td.stop_id = s.id and td.handover = 'station' and td.thumb_at is null;
end $$;

-- Wohnungs-Knopf: Puffer auf den eigenen Stopp rechnen, alle folgenden Zeiten verschieben sich sofort
create or replace function public.customer_apartment(p_trip_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.my_customer_id();
  s public.trip_stops%rowtype;
  extra int;
  n int;
begin
  select ts.* into s
  from public.trip_dogs td
  join public.trip_stops ts on ts.id = td.stop_id
  join public.trips t on t.id = ts.trip_id
  join public.dogs d on d.id = td.dog_id
  where td.id = p_trip_dog and d.customer_id = me and d.apartment_allowed
    and t.state = 'running' and ts.arrived_at is null
  for update of ts;
  if s.id is null or now() >= s.eta - make_interval(mins => public.setting_int('apartment_deadline_minutes', 20)) then
    raise exception 'Dafür ist es zu spät';
  end if;
  update public.trip_dogs td set
    apartment_requested_at = now(),
    handover = 'apartment',
    apartment_minutes = case when d.apartment_buffer_enabled
      then coalesce(d.apartment_buffer_minutes, public.setting_int('apartment_extra_minutes', 5)) else 0 end
  from public.dogs d
  where d.id = td.dog_id and d.customer_id = me and d.apartment_allowed
    and td.stop_id = s.id and td.handover = 'station' and td.thumb_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Dafür ist es zu spät'; end if;
  extra := public.stop_extra_minutes(s.id);
  update public.trip_stops set eta = eta + make_interval(mins => extra - s.extra_minutes)
  where trip_id = s.trip_id and position > s.position and arrived_at is null;
  update public.trip_stops set extra_minutes = extra where id = s.id;
end $$;

-- Darf der angemeldete Kunde gerade den Fahrzeugstandort dieser Fahrt sehen?
create function public.customer_sees_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trips t
    join public.trip_stops s on s.trip_id = t.id
    join public.trip_dogs td on td.stop_id = s.id
    join public.dogs d on d.id = td.dog_id
    where t.id = p_trip and t.state = 'running' and s.arrived_at is null
      and d.customer_id = public.my_customer_id())
$$;

-- 6. Benachrichtigungen (serverseitig, jede Minute) -------------------------

create or replace function public.send_push(p_users uuid[], p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  msgs jsonb;
  urgent boolean := coalesce(p_data ->> 'type' in ('ready', 'urgent'), false);
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
    'sound', case when urgent then 'huta_bald.wav' else 'default' end,
    'channelId', case when urgent then 'bald' else 'default' end,
    'interruptionLevel', case when urgent then 'time-sensitive' else 'active' end,
    'priority', 'high'))
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

-- Eine Stufe an alle Kunden einer Station, die noch nicht bestaetigt haben
create function public.notify_stop(p_stop uuid, p_stage int) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; mins int; title text; body text;
begin
  for r in
    select c.user_id, string_agg(d.name, ', ' order by d.name) as names, s.eta, t.direction
    from public.trip_dogs td
    join public.trip_stops s on s.id = td.stop_id
    join public.trips t on t.id = s.trip_id
    join public.dogs d on d.id = td.dog_id
    join public.customers c on c.id = d.customer_id
    where s.id = p_stop and td.handover = 'station' and td.thumb_at is null and c.user_id is not null
    group by c.user_id, s.eta, t.direction
  loop
    mins := greatest(1, round(extract(epoch from (r.eta - now())) / 60)::int);
    if p_stage = 1 then
      title := 'Wir sind in ' || mins || case when mins = 1 then ' Minute' else ' Minuten' end || ' bei dir';
      body := case when r.direction = 'morning'
        then 'Bitte mach dich mit ' || r.names || ' bereit und bestätige kurz in der App.'
        else 'Wir bringen ' || r.names || ' zurück. Bitte mach dich bereit und bestätige kurz in der App.' end;
    else
      title := 'Wir sind in ' || mins || case when mins = 1 then ' Minute' else ' Minuten' end || ' da';
      body := 'Bitte beeil dich. ' || r.names || ': Bestätige kurz in der App.';
    end if;
    perform public.send_push(array[r.user_id], title, body,
      jsonb_build_object('type', case when p_stage = 1 then 'ready' else 'urgent' end));
  end loop;
end $$;

create or replace function public.tick_trips() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  m1 int := public.setting_int('push_stage1_minutes', 15);
  m2 int := public.setting_int('push_stage2_minutes', 5);
begin
  -- vergessene Fahrten beenden, damit kein Standort geteilt bleibt
  update public.trips set state = 'done', ended_at = now()
  where state = 'running' and (day < public.today_de() or started_at < now() - interval '8 hours');
  delete from public.trip_location l using public.trips t where t.id = l.trip_id and t.state = 'done';

  for r in
    select s.id from public.trips t join public.trip_stops s on s.trip_id = t.id
    where t.state = 'running' and s.arrived_at is null and s.ready_notified_at is null
      and s.eta - make_interval(mins => m1) <= now()
  loop
    update public.trip_stops set ready_notified_at = now() where id = r.id;
    perform public.notify_stop(r.id, 1);
  end loop;

  for r in
    select s.id from public.trips t join public.trip_stops s on s.trip_id = t.id
    where t.state = 'running' and s.arrived_at is null and s.urgent_notified_at is null
      and s.ready_notified_at <= now() - interval '90 seconds'
      and s.eta - make_interval(mins => m2) <= now()
  loop
    update public.trip_stops set urgent_notified_at = now() where id = r.id;
    perform public.notify_stop(r.id, 2);
  end loop;
end $$;

-- 7. Alte Funktionen, die es im neuen Konzept nicht mehr gibt ----------------

drop trigger week_entries_notify on public.week_entries;
drop function public.notify_week_change();
drop function public.publish_week(date, date);
drop function public.trip_started(uuid);
drop function public.remind_laggards(uuid);
drop function public.customer_sick(uuid);
drop function public.my_rules();
drop function public.todays_contact(date);
drop function public.delete_my_account();
drop function public.provider_ids();

create function public.remove_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;

-- 8. Vertragsdateien (nur Dienstleister) ------------------------------------

create table public.customer_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  path text not null unique,
  name text not null,
  size bigint,
  mime text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid()
);
create index customer_files_customer on public.customer_files (customer_id);
alter table public.customer_files enable row level security;
create policy customer_files_provider on public.customer_files for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

-- 9. Album ------------------------------------------------------------------

create table public.album_items (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  kind text not null check (kind in ('photo', 'video')),
  width int,
  height int,
  duration_seconds int,
  size bigint,
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default now(), -- setzt der Trigger
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid()
);
create index album_items_expires on public.album_items (expires_at);

create table public.album_reactions (
  item_id uuid not null references public.album_items(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (item_id, customer_id)
);
create index album_reactions_customer on public.album_reactions (customer_id);

create function public.album_set_expiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.uploaded_at := now();
  new.expires_at := new.uploaded_at + make_interval(days => public.setting_int('album_days', 3));
  return new;
end $$;
create trigger album_items_expiry before insert on public.album_items
  for each row execute function public.album_set_expiry();

-- Geaenderte Frist gilt auch fuer vorhandene Dateien
create function public.album_days_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.key = 'album_days' and new.value ~ '^[0-9]{1,3}$' then
    update public.album_items set expires_at = uploaded_at + make_interval(days => new.value::int);
    perform public.bump_stamp('album_stamp');
  end if;
  return null;
end $$;
create trigger settings_album_days after insert or update on public.app_settings
  for each row execute function public.album_days_changed();

create trigger album_items_stamp after insert or delete on public.album_items
  for each statement execute function public.bump_stamp_trigger('album_stamp');
create trigger album_reactions_stamp after insert or update or delete on public.album_reactions
  for each statement execute function public.bump_stamp_trigger('album_stamp');

alter table public.album_items enable row level security;
alter table public.album_reactions enable row level security;

create policy album_provider on public.album_items for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy album_customer_read on public.album_items for select to authenticated
  using (expires_at > now() and public.my_customer_id() is not null);

create policy reactions_provider on public.album_reactions for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy reactions_own_read on public.album_reactions for select to authenticated
  using (customer_id = public.my_customer_id());
create policy reactions_own_insert on public.album_reactions for insert to authenticated
  with check (customer_id = public.my_customer_id()
    and exists (select 1 from public.album_items i where i.id = item_id and i.expires_at > now()));
create policy reactions_own_update on public.album_reactions for update to authenticated
  using (customer_id = public.my_customer_id())
  with check (customer_id = public.my_customer_id()
    and exists (select 1 from public.album_items i where i.id = item_id and i.expires_at > now()));
create policy reactions_own_delete on public.album_reactions for delete to authenticated
  using (customer_id = public.my_customer_id());

-- Zaehler je Emoji. Namen sehen nur die Dienstleister.
create function public.album_reaction_summary()
returns table (item_id uuid, emoji text, total int, mine boolean, names text[])
language sql stable security definer set search_path = '' as $$
  select r.item_id, r.emoji, count(*)::int,
    coalesce(bool_or(r.customer_id = public.my_customer_id()), false),
    case when public.is_provider() then array_agg(c.name order by c.name) end
  from public.album_reactions r
  join public.album_items i on i.id = r.item_id
  join public.customers c on c.id = r.customer_id
  where public.is_provider() or (public.my_customer_id() is not null and i.expires_at > now())
  group by r.item_id, r.emoji
  order by r.item_id, count(*) desc, r.emoji
$$;

-- 10. Zugriffsregeln nachschaerfen -------------------------------------------

-- Kunden sehen interne Regeln nicht und aendern nur Urlaub und Passwort
drop policy dogs_own on public.dogs;
drop policy entries_own on public.week_entries;
drop policy profiles_update_self on public.profiles;
drop policy closures_read on public.closures;
create policy closures_read on public.closures for select to authenticated
  using (public.is_provider() or public.my_customer_id() is not null);
drop policy settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated
  using (public.is_provider() or public.my_customer_id() is not null);

-- Standort nur fuer Kunden mit offenem Stopp in der laufenden Fahrt
create policy location_customer on public.trip_location for select to authenticated
  using (public.customer_sees_trip(trip_id));

-- 11. Dateispeicher ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('contracts', 'contracts', false, 20971520)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy huta_contracts_provider on storage.objects for all to authenticated
  using (bucket_id = 'contracts' and public.is_provider())
  with check (bucket_id = 'contracts' and public.is_provider());
create policy huta_album_provider on storage.objects for all to authenticated
  using (bucket_id = 'album' and public.is_provider())
  with check (bucket_id = 'album' and public.is_provider());
create policy huta_album_customer on storage.objects for select to authenticated
  using (bucket_id = 'album' and public.my_customer_id() is not null
    and exists (select 1 from public.album_items i where i.path = name and i.expires_at > now()));

-- 12. Live-Aktualisierung ----------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['week_entries', 'dogs', 'vacations', 'closures', 'trips', 'trip_stops', 'trip_dogs',
    'trip_location', 'app_settings', 'album_items', 'album_reactions']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 13. Geheimnis fuer den taeglichen Aufraeum-Auftrag (nur in der Datenbank, nie im Repo)

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'huta_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'huta_cron_secret');
  end if;
end $$;

create function public.check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'huta_cron_secret' and decrypted_secret = p_secret)
$$;

-- 14. Rechte: erst alles entziehen, dann gezielt freigeben ---------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_provider(), public.my_role(), public.my_customer_id(), public.today_de(),
  public.customer_sees_trip(uuid),
  public.plan_rows(date, date),
  public.set_plan_entry(uuid, date, text, uuid, uuid, text, text),
  public.move_plan_entry(uuid, date, date),
  public.publish_plan(), public.discard_drafts(), public.home_day(),
  public.customer_week(date), public.my_dogs(),
  public.trip_candidates(date, text),
  public.start_trip(date, text, text, double precision, double precision, text, double precision, double precision, jsonb),
  public.finish_trip(uuid), public.arrive_stop(uuid, uuid), public.shift_etas(uuid, timestamptz),
  public.my_trip_status(), public.customer_thumb(uuid), public.customer_apartment(uuid),
  public.album_reaction_summary(),
  public.accept_consent(text), public.save_push_token(text), public.remove_push_token(text)
to authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

-- 15. Geplante Auftraege ------------------------------------------------------

select cron.schedule('huta-freeze-days', '5 * * * *', 'select public.freeze_days()');
select cron.schedule('huta-album-cleanup', '17 2 * * *', $job$
  select net.http_post(
    url := 'https://eqzlxxvkxhxfejafoucl.supabase.co/functions/v1/album-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'huta_cron_secret')),
    body := '{}'::jsonb)
$job$);
