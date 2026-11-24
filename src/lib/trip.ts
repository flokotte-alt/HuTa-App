export type Pt = { lat: number; lng: number };

export function distKm(a: Pt, b: Pt) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Einfache Naeherung ohne Verkehrsdaten: naechster Nachbar
export function orderStops<T extends Pt>(start: Pt, stops: T[]): T[] {
  const rest = [...stops];
  const out: T[] = [];
  let cur = start;
  while (rest.length) {
    let best = 0;
    for (let i = 1; i < rest.length; i++) {
      if (distKm(cur, rest[i]) < distKm(cur, rest[best])) best = i;
    }
    const [next] = rest.splice(best, 1);
    out.push(next);
    cur = next;
  }
  return out;
}

const SPEED_KMH = 28; // Stadtverkehr, Naeherung
const DETOUR = 1.3; // Luftlinie -> Strasse
const DWELL_MIN = 2; // Standard-Halt pro Station

// ETAs fuer die Stationsfolge ab "from" (Zeitpunkt) und "start" (Ort)
export function computeEtas(start: Pt, stops: (Pt & { extra: number })[], from: Date): Date[] {
  let t = from.getTime();
  let cur = start;
  return stops.map((s) => {
    t += ((distKm(cur, s) * DETOUR) / SPEED_KMH) * 3600000;
    const eta = new Date(t);
    t += (DWELL_MIN + s.extra) * 60000;
    cur = s;
    return eta;
  });
}
