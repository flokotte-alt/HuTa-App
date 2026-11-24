// Huta: Routenplanung mit Verkehrsdaten (Google Routes API).
// Ohne Schluessel (Secret GOOGLE_MAPS_KEY) antwortet die Funktion mit { available: false },
// dann rechnet die App selbst mit einer Naeherung.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Pt = { lat: number; lng: number };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Nur Dienstleister duerfen Routen berechnen (schuetzt das Google-Kontingent)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isProvider } = await supabase.rpc('is_provider');
  if (!isProvider) return json({ error: 'Nicht erlaubt' }, 403);

  const key = Deno.env.get('GOOGLE_MAPS_KEY');
  if (!key) return json({ available: false });

  const { start, end, stops, optimize } = (await req.json()) as {
    start: Pt;
    end?: Pt;
    stops: Pt[];
    optimize: boolean;
  };
  if (!start || !Array.isArray(stops) || stops.length === 0) return json({ error: 'Ungueltige Eingabe' }, 400);
  if (stops.length > 25) return json({ error: 'Zu viele Stationen' }, 400);

  const wp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const body = {
    origin: wp(start),
    destination: wp(end ?? start),
    intermediates: stops.map(wp),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    departureTime: new Date(Date.now() + 60_000).toISOString(),
    optimizeWaypointOrder: !!optimize && stops.length > 1,
  };

  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) return json({ available: false, error: `Google: ${r.status}` });
  const data = await r.json();
  const route = data.routes?.[0];
  if (!route) return json({ available: false, error: 'Keine Route' });

  const order: number[] = route.optimizedIntermediateWaypointIndex ?? stops.map((_, i) => i);
  // legs[i] = Fahrzeit vom (i)-ten zum (i+1)-ten Punkt, Dauer als "123s"
  const legSeconds: number[] = (route.legs ?? []).map((l: { duration?: string }) =>
    Number.parseInt((l.duration ?? '0s').replace('s', ''), 10),
  );
  return json({ available: true, order, legSeconds });
});
