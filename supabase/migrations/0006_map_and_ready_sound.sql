-- Karte fuer Kunden: nur die eigene Station und nur waehrend der laufenden Fahrt.
create or replace function public.my_trip_map()
returns table (trip_dog_id uuid, station_label text, lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select td.id, st.label, st.lat::double precision, st.lng::double precision
  from public.trip_dogs td
  join public.trip_stops s on s.id = td.stop_id
  join public.trips t on t.id = s.trip_id
  join public.dogs d on d.id = td.dog_id
  join public.stations st on st.id = s.station_id
  where d.customer_id = public.my_customer_id()
    and t.day = public.today_de() and t.state = 'running'
$$;
revoke execute on function public.my_trip_map() from public, anon;
grant execute on function public.my_trip_map() to authenticated;

-- "Gleich bist du dran": eigener Ton, eigener Android-Kanal, auf dem iPhone als dringende Mitteilung.
create or replace function public.send_push(p_users uuid[], p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  msgs jsonb;
  urgent boolean := coalesce(p_data ->> 'type' = 'ready', false);
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
