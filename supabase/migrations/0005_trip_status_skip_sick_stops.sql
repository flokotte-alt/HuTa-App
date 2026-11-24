-- Stationen, an denen nur kranke Hunde stehen, zaehlen beim Countdown der anderen Kunden nicht mit.
create or replace function public.my_trip_status()
returns table (
  trip_dog_id uuid, dog_id uuid, dog_name text, direction text, stops_before int,
  eta timestamptz, thumb_at timestamptz, thumb_open boolean, apartment_allowed boolean,
  apartment_open boolean, apartment_requested boolean, sick boolean, arrived boolean, driver_name text,
  handover text
)
language sql stable security definer set search_path = '' as $$
  select td.id, d.id, d.name, t.direction,
    (select count(*)::int from public.trip_stops s2
       where s2.trip_id = t.id and s2.position < s.position and s2.arrived_at is null
         and exists (select 1 from public.trip_dogs td2 where td2.stop_id = s2.id and not td2.sick)),
    s.eta, td.thumb_at,
    (td.thumb_at is null and not td.sick and s.arrived_at is null and now() >= s.eta - interval '15 minutes'),
    d.apartment_allowed,
    (d.apartment_allowed and not td.sick and s.arrived_at is null and td.handover <> 'apartment'
       and td.apartment_requested_at is null and now() <= s.eta - interval '20 minutes'),
    td.apartment_requested_at is not null, td.sick, s.arrived_at is not null, p.name,
    td.handover
  from public.trip_dogs td
  join public.trip_stops s on s.id = td.stop_id
  join public.trips t on t.id = s.trip_id
  join public.dogs d on d.id = td.dog_id
  left join public.profiles p on p.id = t.driver_id
  where d.customer_id = public.my_customer_id()
    and t.day = public.today_de() and t.state = 'running'
  order by t.direction
$$;
