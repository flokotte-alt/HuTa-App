// Routen ueber die Edge Function plan-route (Google mit Verkehr), sonst die Naeherung aus trip.ts
import { supabase } from './supabase';
import { computeEtas, driveSeconds, etasFromLegs, orderStops, type Pt } from './trip';

export type RouteSource = 'google' | 'estimate';

const xy = (p: Pt) => ({ lat: p.lat, lng: p.lng });

export async function planRoute<T extends Pt & { extra: number }>(
  start: Pt,
  end: Pt,
  stops: T[],
  optimize: boolean,
  from = new Date(),
): Promise<{ ordered: T[]; etas: Date[]; source: RouteSource }> {
  if (stops.length === 0) return { ordered: [], etas: [], source: 'estimate' };
  try {
    const { data, error } = await supabase.functions.invoke('plan-route', {
      body: { start: xy(start), end: xy(end), stops: stops.map(xy), optimize },
    });
    if (!error && data?.available) {
      const ordered = (data.order as number[]).map((i) => stops[i]);
      return { ordered, etas: etasFromLegs(ordered, data.legSeconds as number[], from), source: 'google' };
    }
  } catch {
    /* Ausweichloesung unten */
  }
  const ordered = optimize ? orderStops(start, stops, end) : stops;
  return { ordered, etas: computeEtas(start, ordered, from), source: 'estimate' };
}

export type Leg = { seconds: number; routeToken: string | null };

// Beste Strecke vom Standort zum naechsten Stopp
export async function bestLeg(origin: Pt, destination: Pt): Promise<Leg & { source: RouteSource }> {
  try {
    const { data, error } = await supabase.functions.invoke('plan-route', {
      body: { mode: 'leg', origin: xy(origin), destination: xy(destination) },
    });
    if (!error && data?.available) return { ...(data.routes[0] as Leg), source: 'google' };
  } catch {
    /* Ausweichloesung unten */
  }
  return { seconds: Math.round(driveSeconds(origin, destination)), routeToken: null, source: 'estimate' };
}
