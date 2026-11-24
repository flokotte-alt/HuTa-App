-- Huta: Grundschema mit Zugriffsregeln (Row Level Security)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('provider','customer')),
  name text not null default '',
  phone text,
  email text
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  phone text,
  user_id uuid unique references auth.users(id) on delete set null
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  archived boolean not null default false
);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text,
  notes text,
  apartment_allowed boolean not null default false,
  weekdays smallint[] not null default '{}',
  active boolean not null default true
);

create table public.dog_rules (
  dog_id uuid not null references public.dogs(id) on delete cascade,
  period text not null check (period in ('morning','afternoon')),
  handover text not null default 'station' check (handover in ('station','apartment','self')),
  station_id uuid references public.stations(id) on delete set null,
  primary key (dog_id, period)
);

create table public.week_entries (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  day date not null,
  status text not null default 'registered'
    check (status in ('registered','cancelled_billed','vacation','removed','sick')),
  station_id uuid references public.stations(id) on delete set null,
  handover_morning text check (handover_morning in ('station','apartment','self')),
  handover_afternoon text check (handover_afternoon in ('station','apartment','self')),
  published boolean not null default false,
  unique (dog_id, day)
);

create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  date_from date not null,
  date_to date not null check (date_to >= date_from)
);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null check (date_to >= date_from),
  note text
);

create table public.duty (
  day date primary key,
  driver_id uuid not null references public.profiles(id) on delete cascade
);

create table public.app_settings (
  key text primary key,
  value text not null
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  direction text not null check (direction in ('morning','afternoon')),
  driver_id uuid references public.profiles(id) on delete set null,
  start_label text,
  start_lat double precision,
  start_lng double precision,
  state text not null default 'planned' check (state in ('planned','running','done')),
  started_at timestamptz,
  ended_at timestamptz,
  unique (day, direction)
);

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  station_id uuid not null references public.stations(id),
  position int not null,
  eta timestamptz,
  arrived_at timestamptz,
  extra_minutes int not null default 0
);

create table public.trip_dogs (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.trip_stops(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  handover text not null default 'station' check (handover in ('station','apartment')),
  thumb_at timestamptz,
  apartment_requested_at timestamptz,
  sick boolean not null default false
);

create table public.trip_location (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique
);

-- Hilfsfunktionen -----------------------------------------------------------

create function public.is_provider() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_customer_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.customers where user_id = auth.uid()
$$;

create function public.today_de() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;

-- Konto anlegen: Profil erzeugen und mit vorhandenem Kunden (gleiche E-Mail) verknuepfen
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.customers%rowtype;
begin
  insert into public.profiles (id, role, name, email)
  values (new.id, 'customer', coalesce(new.raw_user_meta_data->>'name', ''), lower(new.email));
  select * into c from public.customers where email = lower(new.email) and user_id is null;
  if found then
    update public.customers set user_id = new.id where id = c.id;
    update public.profiles set name = c.name, phone = c.phone where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zugriffsregeln --------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.stations enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_rules enable row level security;
alter table public.week_entries enable row level security;
alter table public.vacations enable row level security;
alter table public.closures enable row level security;
alter table public.duty enable row level security;
alter table public.app_settings enable row level security;
alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;
alter table public.trip_dogs enable row level security;
alter table public.trip_location enable row level security;
alter table public.push_tokens enable row level security;

-- Dienstleister: alles, Kunde: nur Eigenes
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_provider());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
create policy profiles_provider_all on public.profiles for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy customers_provider on public.customers for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy customers_own on public.customers for select to authenticated
  using (user_id = auth.uid());

create policy stations_provider on public.stations for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy dogs_provider on public.dogs for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy dogs_own on public.dogs for select to authenticated
  using (customer_id = public.my_customer_id());

create policy rules_provider on public.dog_rules for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy entries_provider on public.week_entries for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy entries_own on public.week_entries for select to authenticated
  using (exists (select 1 from public.dogs d where d.id = dog_id and d.customer_id = public.my_customer_id()));

create policy vacations_provider on public.vacations for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy vacations_own on public.vacations for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());

create policy closures_read on public.closures for select to authenticated using (true);
create policy closures_provider on public.closures for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy duty_provider on public.duty for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_provider on public.app_settings for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy trips_provider on public.trips for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy stops_provider on public.trip_stops for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy tripdogs_provider on public.trip_dogs for all to authenticated
  using (public.is_provider()) with check (public.is_provider());
create policy location_provider on public.trip_location for all to authenticated
  using (public.is_provider()) with check (public.is_provider());

create policy push_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Funktionen fuer Kunden (geben nur Eigenes bzw. reine Hundenamen zurueck) -----

create function public.week_names(p_from date, p_to date)
returns table (day date, dog_name text, status text)
language sql stable security definer set search_path = '' as $$
  select e.day, d.name, e.status
  from public.week_entries e join public.dogs d on d.id = e.dog_id
  where auth.uid() is not null and e.published and d.active
    and e.day between p_from and p_to
  order by e.day, d.name
$$;

create function public.my_rules()
returns table (dog_id uuid, dog_name text, period text, handover text, station_label text, weekdays smallint[], apartment_allowed boolean)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name, r.period, r.handover, s.label, d.weekdays, d.apartment_allowed
  from public.dogs d
  left join public.dog_rules r on r.dog_id = d.id
  left join public.stations s on s.id = r.station_id
  where d.customer_id = public.my_customer_id() and d.active
  order by d.name, r.period
$$;

create function public.todays_contact(p_day date default null)
returns table (name text, phone text)
language sql stable security definer set search_path = '' as $$
  select p.name, p.phone
  from public.duty du join public.profiles p on p.id = du.driver_id
  where auth.uid() is not null and du.day = coalesce(p_day, public.today_de())
$$;

create function public.my_trip_status()
returns table (
  trip_dog_id uuid, dog_id uuid, dog_name text, direction text, stops_before int,
  eta timestamptz, thumb_at timestamptz, thumb_open boolean, apartment_allowed boolean,
  apartment_open boolean, apartment_requested boolean, sick boolean, arrived boolean, driver_name text
)
language sql stable security definer set search_path = '' as $$
  select td.id, d.id, d.name, t.direction,
    (select count(*)::int from public.trip_stops s2
       where s2.trip_id = t.id and s2.position < s.position and s2.arrived_at is null),
    s.eta, td.thumb_at,
    (td.thumb_at is null and not td.sick and s.arrived_at is null and now() >= s.eta - interval '15 minutes'),
    d.apartment_allowed,
    (d.apartment_allowed and not td.sick and s.arrived_at is null
       and td.apartment_requested_at is null and now() <= s.eta - interval '20 minutes'),
    td.apartment_requested_at is not null, td.sick, s.arrived_at is not null, p.name
  from public.trip_dogs td
  join public.trip_stops s on s.id = td.stop_id
  join public.trips t on t.id = s.trip_id
  join public.dogs d on d.id = td.dog_id
  left join public.profiles p on p.id = t.driver_id
  where d.customer_id = public.my_customer_id()
    and t.day = public.today_de() and t.state = 'running'
  order by t.direction
$$;

create function public.customer_thumb(p_trip_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.trip_dogs td set thumb_at = now()
  from public.trip_stops s, public.trips t, public.dogs d
  where td.id = p_trip_dog and s.id = td.stop_id and t.id = s.trip_id and d.id = td.dog_id
    and d.customer_id = public.my_customer_id() and t.state = 'running'
    and now() >= s.eta - interval '15 minutes';
  if not found then raise exception 'Daumen noch nicht freigeschaltet'; end if;
end $$;

create function public.customer_apartment(p_trip_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.trip_dogs td set apartment_requested_at = now()
  from public.trip_stops s, public.trips t, public.dogs d
  where td.id = p_trip_dog and s.id = td.stop_id and t.id = s.trip_id and d.id = td.dog_id
    and d.customer_id = public.my_customer_id() and d.apartment_allowed
    and t.state = 'running' and now() <= s.eta - interval '20 minutes';
  if not found then raise exception 'Wohnungs-Wunsch nicht mehr moeglich, bitte per WhatsApp melden'; end if;
end $$;

create function public.customer_sick(p_dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.dogs where id = p_dog and customer_id = public.my_customer_id()) then
    raise exception 'Nicht erlaubt';
  end if;
  insert into public.week_entries (dog_id, day, status, published)
  values (p_dog, public.today_de(), 'sick', true)
  on conflict (dog_id, day) do update set status = 'sick';
  update public.trip_dogs set sick = true
  where dog_id = p_dog and stop_id in (
    select s.id from public.trip_stops s join public.trips t on t.id = s.trip_id where t.day = public.today_de());
end $$;

-- Planung fuer Dienstleister: wer faehrt an einem Tag wohin
create function public.trip_candidates(p_day date, p_direction text)
returns table (dog_id uuid, dog_name text, station_id uuid, station_label text, lat double precision, lng double precision, handover text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name, st.id, st.label, st.lat, st.lng,
    coalesce(case p_direction when 'morning' then e.handover_morning else e.handover_afternoon end, r.handover, 'station')
  from public.week_entries e
  join public.dogs d on d.id = e.dog_id
  left join public.dog_rules r on r.dog_id = d.id and r.period = p_direction
  left join public.stations st on st.id = coalesce(e.station_id, r.station_id)
  where public.is_provider() and e.day = p_day and e.status = 'registered' and d.active
$$;

-- Rechte: nur angemeldete Nutzer duerfen die Funktionen aufrufen
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_provider(), public.my_role(), public.my_customer_id(), public.today_de(),
  public.week_names(date, date), public.my_rules(), public.todays_contact(date),
  public.my_trip_status(), public.customer_thumb(uuid), public.customer_apartment(uuid),
  public.customer_sick(uuid), public.trip_candidates(date, text)
to authenticated;

insert into public.app_settings (key, value) values ('apartment_extra_minutes', '5');
