// Laufende Fahrt: laden, weiterschalten, Zeiten neu rechnen
import { supabase } from './supabase';
import { planRoute } from './route';
import type { Pt } from './trip';

export type RunDog = {
  id: string;
  dog_id: string;
  handover: 'station' | 'apartment';
  thumb_at: string | null;
  apartment_requested_at: string | null;
  dogs: { name: string } | null;
};
export type RunStop = {
  id: string;
  position: number;
  eta: string;
  arrived_at: string | null;
  extra_minutes: number;
  stations: { label: string; lat: number; lng: number } | null;
  trip_dogs: RunDog[];
};
export type Trip = {
  id: string;
  day: string;
  direction: 'morning' | 'afternoon';
  state: 'planned' | 'running' | 'done';
  driver_id: string | null;
  start_label: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_label: string | null;
  end_lat: number | null;
  end_lng: number | null;
};

export async function loadStops(tripId: string): Promise<RunStop[] | null> {
  const { data, error } = await supabase
    .from('trip_stops')
    .select('id, position, eta, arrived_at, extra_minutes, stations(label, lat, lng), trip_dogs(id, dog_id, handover, thumb_at, apartment_requested_at, dogs(name))')
    .eq('trip_id', tripId)
    .order('position');
  if (error) return null;
  return (data as unknown as RunStop[]) ?? [];
}

// Bestaetigt ist ein Hund mit Daumen oder wenn er in die Wohnung gebracht wird (dann ist alles klar)
export const isConfirmed = (d: RunDog) => d.handover === 'apartment' || !!d.thumb_at;

// Zeiten aller offenen Stationen ab einem Ort neu rechnen (mit Verkehrsdaten, sobald Google eingerichtet ist)
async function recomputeEtas(tripId: string, from: Pt) {
  const stops = await loadStops(tripId);
  if (!stops) return;
  const open = stops.filter((s) => !s.arrived_at && s.stations);
  if (!open.length) return;
  const last = open[open.length - 1].stations!;
  const { etas } = await planRoute(
    from,
    last,
    open.map((s) => ({ lat: s.stations!.lat, lng: s.stations!.lng, extra: s.extra_minutes })),
    false,
  );
  await Promise.all(open.map((s, i) => supabase.from('trip_stops').update({ eta: etas[i].toISOString() }).eq('id', s.id)));
}

// Grosser Knopf "Naechster Stopp". Gibt true zurueck, wenn das der letzte Stopp war.
export async function arriveStop(tripId: string, stop: RunStop): Promise<boolean> {
  const { data, error } = await supabase.rpc('arrive_stop', { p_trip: tripId, p_stop: stop.id });
  if (error) throw error;
  if (!data && stop.stations) await recomputeEtas(tripId, stop.stations);
  return !!data;
}
