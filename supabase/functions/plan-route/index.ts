// Huta: Routenplanung mit Verkehrsdaten (Google Routes API).
// Zwei Arten:
//   Ganze Route (Standard): Start, Ziel, Stopps, auf Wunsch optimierte Reihenfolge.
//   mode "leg": beste Strecke von einem Punkt zum naechsten Stopp (waehrend der Fahrt), mit Route-Token
//   fuer die Navigation.
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

const isPt = (p: unknown): p is Pt =>
  !!p && Number.isFinite((p as Pt).lat) && Number.isFinite((p as Pt).lng);
const wp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
// Dauer kommt als "123s"
const seconds = (d?: string) => Number.parseInt((d ?? '0s').replace('s', ''), 10);

async function computeRoutes(key: string, body: unknown, fieldMask: string) {
  return fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  });
}

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

  let input: { mode?: string; start?: Pt; end?: Pt; stops?: Pt[]; optimize?: boolean; origin?: Pt; destination?: Pt };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Ungueltige Eingabe' }, 400);
  }

  if (input.mode === 'leg') {
    if (!isPt(input.origin) || !isPt(input.destination)) return json({ error: 'Ungueltige Eingabe' }, 400);
    const r = await computeRoutes(
      key,
      {
        origin: wp(input.origin),
        destination: wp(input.destination),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        computeAlternativeRoutes: true,
      },
      'routes.duration,routes.distanceMeters,routes.routeToken,routes.polyline.encodedPolyline',
    );
    if (!r.ok) return json({ available: false, error: `Google: ${r.status}` });
    const data = await r.json();
    const routes = (data.routes ?? []).map(
      (x: { duration?: string; distanceMeters?: number; routeToken?: string; polyline?: { encodedPolyline?: string } }) => ({
        seconds: seconds(x.duration),
        meters: x.distanceMeters ?? 0,
        routeToken: x.routeToken ?? null,
        polyline: x.polyline?.encodedPolyline ?? null,
      }),
    );
    if (!routes.length) return json({ available: false, error: 'Keine Route' });
    routes.sort((a: { seconds: number }, b: { seconds: number }) => a.seconds - b.seconds);
    return json({ available: true, routes });
  }

  const { start, end, stops, optimize } = input;
  if (!isPt(start) || !Array.isArray(stops) || stops.length === 0 || !stops.every(isPt)) {
    return json({ error: 'Ungueltige Eingabe' }, 400);
  }
  if (stops.length > 25) return json({ error: 'Zu viele Stationen' }, 400);

  const r = await computeRoutes(
    key,
    {
      origin: wp(start),
      destination: wp(isPt(end) ? end : start),
      intermediates: stops.map(wp),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      departureTime: new Date(Date.now() + 60_000).toISOString(),
      optimizeWaypointOrder: !!optimize && stops.length > 1,
    },
    'routes.optimizedIntermediateWaypointIndex,routes.legs.duration',
  );
  if (!r.ok) return json({ available: false, error: `Google: ${r.status}` });
  const data = await r.json();
  const route = data.routes?.[0];
  if (!route) return json({ available: false, error: 'Keine Route' });

  // Ohne Optimierung liefert Google keine Reihenfolge (oder [-1])
  const idx: number[] = route.optimizedIntermediateWaypointIndex ?? [];
  const order = idx.length === stops.length && idx.every((i) => i >= 0) ? idx : stops.map((_, i) => i);
  // legs[i] = Fahrzeit vom (i)-ten zum (i+1)-ten Punkt
  const legSeconds: number[] = (route.legs ?? []).map((l: { duration?: string }) => seconds(l.duration));
  return json({ available: true, order, legSeconds });
});
