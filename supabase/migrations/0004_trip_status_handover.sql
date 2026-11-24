-- Kunden-Status: zeigt die Uebergabeart und blendet den Wohnungs-Wunsch aus, wenn die Uebergabe schon in der Wohnung ist.
drop function public.my_trip_status();

create function public.my_trip_status()
returns table (
  trip_dog_id uuid, dog_id uuid, dog_name text, direction text, stops_before int,
  eta timestamptz, thumb_at timestamptz, thumb_open boolean, apartment_allowed boolean,
  apartment_open boolean, apartment_requested boolean, sick boolean, arrived boolean, driver_name text,
  handover text
)
language sql stable security definer set search_path = '' as $$
  select td.id, d.id, d.name, t.direction,
    (select count(*)::int from public.trip_stops s2
       where s2.trip_id = t.id and s2.position < s.position and s2.arrived_at is null),
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

revoke execute on function public.my_trip_status() from public, anon;
grant execute on function public.my_trip_status() to authenticated;
