import { supabase } from './supabase';
import { computeEtas, type Pt } from './trip';

type StopRow = {
  id: string;
  position: number;
  arrived_at: string | null;
  extra_minutes: number;
  stations: { lat: number; lng: number } | null;
};

const DWELL_MIN = 2;

async function loadStops(tripId: string) {
  const { data } = await supabase
    .from('trip_stops')
    .select('id, position, arrived_at, extra_minutes, stations(lat, lng)')
    .eq('trip_id', tripId)
    .order('position');
  return ((data as unknown as StopRow[]) ?? []).filter((s) => s.stations);
}

// Neue Ankunftszeiten fuer alle offenen Stationen ab einem Ort und Zeitpunkt
export async function recomputeEtas(tripId: string, from: Pt, at: Date) {
  const stops = await loadStops(tripId);
  const open = stops.filter((s) => !s.arrived_at);
  const etas = computeEtas(
    from,
    open.map((s) => ({ lat: s.stations!.lat, lng: s.stations!.lng, extra: s.extra_minutes })),
    at,
  );
  await Promise.all(open.map((s, i) => supabase.from('trip_stops').update({ eta: etas[i].toISOString() }).eq('id', s.id)));
}

// Aktuelle Station als erreicht markieren und den Rest neu rechnen
export async function arriveCurrentStop(tripId: string): Promise<boolean> {
  const stops = await loadStops(tripId);
  const cur = stops.find((s) => !s.arrived_at);
  if (!cur) return false;
  const now = new Date();
  await supabase.from('trip_stops').update({ arrived_at: now.toISOString() }).eq('id', cur.id);
  await recomputeEtas(tripId, cur.stations!, new Date(now.getTime() + (DWELL_MIN + cur.extra_minutes) * 60000));
  return true;
}

// Von wo aus gerade gerechnet wird: letzte erledigte Station oder der Startpunkt
export async function currentOrigin(tripId: string): Promise<Pt | null> {
  const stops = await loadStops(tripId);
  const done = stops.filter((s) => s.arrived_at).pop();
  if (done?.stations) return done.stations;
  const { data: t } = await supabase.from('trips').select('start_lat, start_lng').eq('id', tripId).maybeSingle();
  return t && t.start_lat != null ? { lat: t.start_lat, lng: t.start_lng } : null;
}
